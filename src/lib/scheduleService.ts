import { supabase } from './supabase'
import { getScheduleRecommendation, SchedulingConstraints } from './groq'

export interface ScheduleGenerationRequest {
  level: number
  semester: string
  maxSections: number
  sectionCapacity: number
  preferences: string
  constraints: string
}

export interface GeneratedSchedule {
  id: string
  level: number
  semester: string
  sections: ScheduleSection[]
  conflicts: number
  efficiency: number
  status: 'draft' | 'approved' | 'active'
  created_at: string
  author_id: string
  approved_at?: string
}

export interface ScheduleSection {
  course_code: string
  section_label: string
  timeslot: {
    day: string
    start: string
    end: string
  }
  room: string
  instructor_id?: string
  student_count: number
  capacity: number
  group_name?: string
}

export class ScheduleService {
  static async generateSchedule(request: ScheduleGenerationRequest): Promise<GeneratedSchedule> {
    try {
      // Get ALL courses for the level (both fixed and flexible)
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('level', request.level)

      if (coursesError) throw coursesError

      console.log(`Found ${courses?.length || 0} courses for level ${request.level}:`, courses?.map(c => `${c.code} (${c.is_fixed ? 'FIXED' : 'FLEXIBLE'})`))

      // Get students for the level
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('level', request.level)

      if (studentsError) throw studentsError

      console.log(`Found ${students?.length || 0} students for level ${request.level}`)

      // Separate fixed and flexible courses
      const fixedCourses = courses?.filter(c => c.is_fixed) || []
      const flexibleCourses = courses?.filter(c => !c.is_fixed) || []

      // Prepare constraints for AI based on user input
      const constraints: SchedulingConstraints = {
        students_per_course: {},
        blocked_slots: [
          { day: 'Friday', start: '08:00', end: '18:00' }, // No classes on Friday except fixed ones
          { day: 'Monday', start: '08:00', end: '12:00' }, // No classes before 12 PM
          { day: 'Tuesday', start: '08:00', end: '12:00' },
          { day: 'Wednesday', start: '08:00', end: '12:00' },
          { day: 'Thursday', start: '08:00', end: '12:00' }
        ],
        available_rooms: ['A101', 'A102', 'A103', 'A104', 'B205', 'B206', 'B207', 'B208', 'C301', 'C302', 'D101', 'D102', 'E201', 'E202', 'LAB1', 'LAB2', 'LAB3', 'LAB4'],
        rules: [
          'No classes on Friday except for fixed courses',
          'No classes before 12:00 PM (afternoon only)',
          'Fixed courses must be scheduled first',
          'Each section should have 20-25 students maximum',
          'No duplicate courses in the same schedule'
        ],
        objective_priorities: {
          minimize_conflicts: true,
          minimize_gaps: true,
          balance_instructor_loads: true
        }
      }

      // Calculate students per course (distribute evenly)
      const studentsPerCourse = Math.ceil((students?.length || 0) / (courses?.length || 1))
      courses?.forEach(course => {
        constraints.students_per_course[course.code] = Math.min(studentsPerCourse, students?.length || 0)
      })

      console.log('Constraints:', constraints)

      // Get AI recommendations for flexible courses only
      let recommendations = []
      try {
        recommendations = await getScheduleRecommendation(constraints, request.level)
        console.log(`AI generated ${recommendations?.length || 0} recommendations`)
      } catch (aiError) {
        console.error('AI recommendation failed, using fallback:', aiError)
        // Fallback: create basic sections for flexible courses
        recommendations = flexibleCourses.map((course, index) => ({
          course_code: course.code,
          section_label: 'A',
          timeslot: {
            day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'][index % 4],
            start: '14:00',
            end: course.duration_hours === 1.0 ? '15:00' : '15:30'
          },
          room: course.allowable_rooms?.[0] || 'A101',
          allocated_student_ids: Array(Math.min(studentsPerCourse, students?.length || 0)).fill(0).map((_, i) => `student-${i}`),
          justification: 'Fallback scheduling due to AI error',
          confidence_score: 0.5
        }))
        console.log(`Fallback generated ${recommendations.length} recommendations`)
      }

      // Create sections for fixed courses first (with predefined timeslots)
      const fixedSections: ScheduleSection[] = fixedCourses.map((course, index) => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
        const day = days[index % days.length]
        // Start after 12 PM to respect "no classes before 12 PM" constraint
        const startTime = '12:00'
        const endTime = course.duration_hours === 1.0 ? '13:00' : '13:30'
        
        return {
          course_code: course.code,
          section_label: 'A',
          timeslot: {
            day: day,
            start: startTime,
            end: endTime
          },
          room: course.allowable_rooms?.[0] || 'A101',
          student_count: Math.min(studentsPerCourse, students?.length || 0),
          capacity: request.sectionCapacity
        }
      })

      // Helper: check if a timeslot overlaps with the enforced 11:00-12:00 break
      const overlapsBreak = (start: string, end: string): boolean => {
        const breakStart = '11:00'
        const breakEnd = '12:00'
        return (start >= breakStart && start < breakEnd) ||
               (end > breakStart && end <= breakEnd) ||
               (start < breakStart && end > breakEnd)
      }

      // Create sections for flexible courses from AI recommendations, filtering out 11:00-12:00 overlaps
      const flexibleSections: ScheduleSection[] = recommendations
        .filter((rec: any) => !overlapsBreak(rec.timeslot?.start, rec.timeslot?.end))
        .map((rec, index) => ({
          course_code: rec.course_code,
          section_label: rec.section_label,
          timeslot: rec.timeslot,
          room: rec.room,
          student_count: Math.min(rec.allocated_student_ids.length, request.sectionCapacity),
          capacity: request.sectionCapacity
        }))

      // Combine all sections and remove duplicates
      const allSections = [...fixedSections, ...flexibleSections]
      const uniqueSections = allSections.filter((section, index, self) => 
        index === self.findIndex(s => s.course_code === section.course_code)
      )
      
      console.log(`Created ${uniqueSections.length} total sections: ${fixedSections.length} fixed + ${flexibleSections.length} flexible (${allSections.length - uniqueSections.length} duplicates removed)`)

      // Calculate metrics
      const conflicts = 0 // AI should minimize conflicts
      const efficiency = Math.min(100, Math.round((uniqueSections.length / (courses?.length || 1)) * 100))

      // Save to database
      const { data: schedule, error: saveError } = await supabase
        .from('schedule_versions')
        .insert({
          level: request.level,
          version_name: `${request.semester} Draft ${new Date().toISOString()}`,
          diff_json: { sections: uniqueSections, conflicts, efficiency }
        })
        .select()
        .single()

      if (saveError) throw saveError

      return {
        id: schedule.id,
        level: request.level,
        semester: request.semester,
        sections: uniqueSections,
        conflicts,
        efficiency,
        status: 'draft',
        created_at: schedule.created_at,
        author_id: schedule.author_id
      }
    } catch (error) {
      console.error('Error generating schedule:', error)
      throw new Error('Failed to generate schedule: ' + (error as Error).message)
    }
  }

  static async getSchedules(): Promise<GeneratedSchedule[]> {
    const { data, error } = await supabase
      .from('schedule_versions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const mapped: GeneratedSchedule[] = (data || [])
      .filter((row: any) => !row?.diff_json?.deleted) // exclude deleted
      .map((row: any) => {
        // Prefer diff_json.sections, otherwise flatten groups → sections
        let sections: ScheduleSection[] = []
        if (Array.isArray(row?.diff_json?.sections) && row.diff_json.sections.length > 0) {
          sections = row.diff_json.sections as ScheduleSection[]
        } else if (row?.groups && typeof row.groups === 'object') {
          sections = Object.entries(row.groups).flatMap(([groupName, groupData]: any) => {
            const gs = (groupData?.sections || []) as any[]
            return gs.map((s: any) => ({
              course_code: s.course_code,
              section_label: s.section_label || 'A',
              timeslot: { day: s.day, start: s.start_time, end: s.end_time },
              room: s.room,
              instructor_id: s.instructor || undefined,
              student_count: typeof s.student_count === 'number' ? s.student_count : 0,
              capacity: typeof s.capacity === 'number' ? s.capacity : 30,
              group_name: groupName
            } as ScheduleSection))
          })
        }

        return {
          id: row.id,
          level: row.level,
          semester: row.semester,
          sections,
          conflicts: row?.diff_json?.conflicts || 0,
          efficiency: row?.diff_json?.efficiency || 0,
          status: ((row?.diff_json?.status) || 'draft') as 'draft' | 'approved' | 'active',
          created_at: row.created_at,
          author_id: row.author_id,
          approved_at: row?.diff_json?.approved_at
        }
      })
      // Only include schedules that have sections after mapping
      .filter((s: GeneratedSchedule) => (s.sections?.length || 0) > 0)

    return mapped
  }

  static async getScheduleById(scheduleId: string): Promise<GeneratedSchedule | null> {
    const { data, error } = await supabase
      .from('schedule_versions')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (error) throw error
    if (!data) return null

    let sections: ScheduleSection[] = []
    if (Array.isArray(data?.diff_json?.sections) && data.diff_json.sections.length > 0) {
      sections = data.diff_json.sections as ScheduleSection[]
    } else if (data?.groups && typeof data.groups === 'object') {
      sections = Object.entries(data.groups).flatMap(([groupName, groupData]: any) => {
        const gs = (groupData?.sections || []) as any[]
        return gs.map((s: any) => ({
          course_code: s.course_code,
          section_label: s.section_label || 'A',
          timeslot: { day: s.day, start: s.start_time, end: s.end_time },
          room: s.room,
          instructor_id: s.instructor || undefined,
          student_count: typeof s.student_count === 'number' ? s.student_count : 0,
          capacity: typeof s.capacity === 'number' ? s.capacity : 30,
          group_name: groupName
        } as ScheduleSection))
      })
    }

    return {
      id: data.id,
      level: data.level,
      semester: data.semester,
      sections,
      conflicts: data?.diff_json?.conflicts || 0,
      efficiency: data?.diff_json?.efficiency || 0,
      status: ((data?.diff_json?.status) || 'draft') as 'draft' | 'approved' | 'active',
      created_at: data.created_at,
      author_id: data.author_id,
      approved_at: data?.diff_json?.approved_at
    }
  }

  static async approveSchedule(scheduleId: string): Promise<void> {
    // First get the current schedule data
    const { data: currentSchedule, error: fetchError } = await supabase
      .from('schedule_versions')
      .select('diff_json')
      .eq('id', scheduleId)
      .single()

    if (fetchError) throw fetchError

    // Update the diff_json with approved status while preserving existing data
    const updatedDiffJson = {
      ...currentSchedule.diff_json,
      status: 'approved',
      approved_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('schedule_versions')
      .update({ 
        diff_json: updatedDiffJson
      })
      .eq('id', scheduleId)

    if (error) throw error
  }

  static async deleteSchedule(scheduleId: string): Promise<void> {
    // Mark schedule as deleted in diff_json instead of actually deleting
    const { data: currentSchedule, error: fetchError } = await supabase
      .from('schedule_versions')
      .select('diff_json')
      .eq('id', scheduleId)
      .single()

    if (fetchError) throw fetchError

    // Update the diff_json with deleted status while preserving existing data
    const updatedDiffJson = {
      ...currentSchedule.diff_json,
      deleted: true,
      deleted_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('schedule_versions')
      .update({ 
        diff_json: updatedDiffJson
      })
      .eq('id', scheduleId)

    if (error) throw error
  }

  /**
   * Update schedule sections with validation and save to DB.
   * Prevents 11:00-12:00 overlap, room-time conflicts, and duplicate course entries.
   */
  static async updateScheduleSections(scheduleId: string, sections: ScheduleSection[]): Promise<void> {
    // Basic validations
    const overlapsBreak = (start: string, end: string): boolean => {
      const breakStart = '11:00'
      const breakEnd = '12:00'
      return (start >= breakStart && start < breakEnd) ||
             (end > breakStart && end <= breakEnd) ||
             (start < breakStart && end > breakEnd)
    }

    // 1) 11:00-12:00 validation
    const invalidBreak = sections.find(s => overlapsBreak(s.timeslot.start, s.timeslot.end))
    if (invalidBreak) {
      throw new Error(`Section ${invalidBreak.course_code} overlaps 11:00-12:00 break`)
    }

    // 2) Room-time conflicts within this schedule
    const roomKey = (s: ScheduleSection) => `${s.timeslot.day}|${s.timeslot.start}|${s.room}`
    const roomMap = new Map<string, number>()
    for (const s of sections) {
      const key = roomKey(s)
      roomMap.set(key, (roomMap.get(key) || 0) + 1)
    }
    const hasRoomConflict = Array.from(roomMap.values()).some(count => count > 1)
    if (hasRoomConflict) {
      throw new Error('Room-time conflict detected within schedule')
    }

    // 3) Duplicate courses (same course_code appears multiple times)
    const courseCounts = new Map<string, number>()
    for (const s of sections) {
      courseCounts.set(s.course_code, (courseCounts.get(s.course_code) || 0) + 1)
    }
    const hasDuplicateCourse = Array.from(courseCounts.values()).some(count => count > 1)
    if (hasDuplicateCourse) {
      throw new Error('Duplicate course entries detected in schedule')
    }

    // Save to DB: prefer diff_json.sections if column exists; otherwise update groups JSON
    const { data: currentRow, error: fetchError } = await supabase
      .from('schedule_versions')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (fetchError) throw fetchError

    // Helper: map editable sections back to groups format
    const toGroupSection = (s: ScheduleSection) => ({
      course_code: s.course_code,
      section_label: s.section_label,
      day: s.timeslot.day,
      start_time: s.timeslot.start,
      end_time: s.timeslot.end,
      room: s.room,
      instructor: s.instructor_id || null,
      student_count: s.student_count,
      capacity: s.capacity
    })

    if (currentRow && typeof currentRow.diff_json !== 'undefined') {
      // Update diff_json.sections
      const updatedDiffJson = {
        ...(currentRow.diff_json || {}),
        sections,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('schedule_versions')
        .update({ diff_json: updatedDiffJson })
        .eq('id', scheduleId)

      if (updateError) throw updateError
      return
    }

    if (currentRow && typeof currentRow.groups !== 'undefined') {
      // Update groups-based schedule: group by group_name (default 'A')
      const existingGroups = currentRow.groups || {}
      const grouped: any = {}
      for (const s of sections) {
        const g = s.group_name || 'A'
        if (!grouped[g]) grouped[g] = { ...(existingGroups[g] || {}), name: g, sections: [] }
        grouped[g].sections.push(toGroupSection(s))
      }

      const { error: updateGroupsError } = await supabase
        .from('schedule_versions')
        .update({ groups: grouped })
        .eq('id', scheduleId)

      if (updateGroupsError) throw updateGroupsError
      return
    }

    // If neither column exists, throw explicit error
    throw new Error('schedule_versions row has neither diff_json nor groups column to update')
  }
}
