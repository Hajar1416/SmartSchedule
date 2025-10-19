import { supabase } from './supabase'
import { IrregularStudentService } from './irregularStudentService'
import { SystemSettingsService } from './systemSettingsService'
import { getScheduleRecommendation, SchedulingConstraints } from './groq'

export interface IrregularScheduleSection {
  course_id: string
  course_code: string
  course_title: string
  course_level: number
  section_label: string
  timeslot: {
    day: string
    start: string
    end: string
  }
  room: string
  instructor: string
  credits: number
}

/**
 * Irregular Schedule Service
 * Generates personalized schedules for irregular students
 */
export class IrregularScheduleService {
  /**
   * Generate personalized schedule for an irregular student
   */
  static async generatePersonalizedSchedule(
    studentId: string,
    semester: string
  ): Promise<{
    success: boolean
    schedule?: any
    error?: string
  }> {
    try {
      console.log(`🎯 Generating personalized schedule for irregular student: ${studentId}`)

      // Get irregular student data with requirements
      const student = await IrregularStudentService.getIrregularStudent(studentId)
      if (!student) {
        throw new Error('Irregular student not found')
      }

      console.log(`📋 Student: ${student.full_name}, Level: ${student.level}`)
      console.log(`📚 Failed courses: ${student.requirements.length}`)

      // Get all failed/required courses from past levels
      const failedCourses = student.requirements.map((req: any) => ({
        ...req.course,
        original_level: req.original_level,
        reason: req.reason
      }))

      // Get current level courses (compulsory + electives)
      const { data: currentLevelCourses, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('level', student.level)

      if (coursesError) throw coursesError

      // Combine all courses the student needs
      const allCoursesNeeded = [
        ...failedCourses.map((fc: any) => ({ ...fc, source: 'failed' })),
        ...currentLevelCourses.filter((c: any) => c.course_type === 'compulsory').map((c: any) => ({ ...c, source: 'current' }))
      ]

      console.log(`✅ Total courses needed: ${allCoursesNeeded.length}`)

      // Fetch available sections from ALL levels involved
      const levelsInvolved = [
        ...new Set([
          ...failedCourses.map((fc: any) => fc.original_level),
          student.level
        ])
      ]

      console.log(`🔍 Fetching sections from levels: ${levelsInvolved.join(', ')}`)

      // Get all available sections from these levels
      const { data: availableSchedules, error: schedulesError } = await supabase
        .from('schedule_versions')
        .select('*')
        .in('level', levelsInvolved)
        .eq('semester', semester)

      if (schedulesError) throw schedulesError

      // Extract all available sections across levels
      const allAvailableSections: any[] = []
      availableSchedules?.forEach((schedule: any) => {
        Object.values(schedule.groups || {}).forEach((group: any) => {
          (group as any).sections?.forEach((section: any) => {
            allAvailableSections.push({
              ...section,
              level: schedule.level,
              schedule_version_id: schedule.id
            })
          })
        })
      })

      console.log(`📦 Found ${allAvailableSections.length} available sections across all levels`)

      // Filter sections for courses the student needs
      const relevantSections = allAvailableSections.filter((section: any) =>
        allCoursesNeeded.some((course: any) => course.code === section.course_code)
      )

      console.log(`✅ Filtered to ${relevantSections.length} relevant sections`)

      // Use AI to create conflict-free combination
      const personalizedSchedule = await this.selectConflictFreeSections(
        allCoursesNeeded,
        relevantSections,
        student
      )

      // Calculate totals
      const totalCredits = personalizedSchedule.reduce(
        (sum: number, section: any) => sum + (section.credits || 3),
        0
      )

      // Save to irregular_schedules table
      const { data: savedSchedule, error: saveError } = await supabase
        .from('irregular_schedules')
        .upsert({
          student_id: studentId,
          enrolled_level: student.level,
          semester: semester,
          schedule_data: personalizedSchedule,
          total_courses: personalizedSchedule.length,
          total_credits: totalCredits,
          conflicts: 0,
          generated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (saveError) throw saveError

      console.log(`✅ Saved personalized schedule for ${student.full_name}`)

      return {
        success: true,
        schedule: {
          id: savedSchedule.id,
          student_id: savedSchedule.student_id,
          semester: savedSchedule.semester,
          sections: savedSchedule.schedule_data || [],
          total_credits: savedSchedule.total_credits || 0,
          created_at: savedSchedule.created_at,
          student: student
        }
      }
    } catch (error: any) {
      console.error('Error generating personalized schedule:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Select conflict-free sections using AI
   */
  private static async selectConflictFreeSections(
    coursesNeeded: any[],
    availableSections: any[],
    student: any
  ): Promise<IrregularScheduleSection[]> {
    // Group sections by course
    const sectionsByCourse = coursesNeeded.map((course) => {
      const sections = availableSections.filter((s) => s.course_code === course.code)
      return {
        course,
        sections
      }
    })

    // Use AI to find optimal conflict-free combination
    const constraints: SchedulingConstraints = {
      students_per_course: {},
      available_rooms: [],
      blocked_slots: [],
      rules: [
        `Select ONE section for each of the ${coursesNeeded.length} required courses`,
        'CRITICAL: Ensure NO time conflicts - student cannot be in two places at once',
        'Prefer sections with more available seats',
        'Try to minimize gaps between classes',
        'Prefer morning classes if possible',
        `Student needs courses from levels: ${[...new Set(coursesNeeded.map((c: any) => c.original_level || c.level))].join(', ')}`
      ],
      objective_priorities: {
        minimize_conflicts: true,
        minimize_gaps: true,
        balance_instructor_loads: false
      }
    }

    // Simple conflict-free selection algorithm
    const selectedSections: any[] = []
    const occupiedSlots = new Map<string, any>()

    console.log('🔍 Starting conflict-free section selection')
    console.log('Sections by course:', sectionsByCourse)

    for (const { course, sections } of sectionsByCourse) {
      if (sections.length === 0) {
        console.warn(`⚠️ No sections available for ${course.code}`)
        continue
      }

      // Find first section that doesn't conflict
      let selectedSection = null
      console.log(`🔍 Processing ${sections.length} sections for ${course.code}`)
      
      for (const section of sections) {
        console.log('Section data:', section)
        
        // Handle different data structures - check if timeslot exists or use direct properties
        const day = section.timeslot?.day || section.day
        const startTime = section.timeslot?.start || section.start_time
        
        console.log(`Extracted: day=${day}, startTime=${startTime}`)
        
        if (!day || !startTime) {
          console.warn(`⚠️ Section missing day or start time:`, section)
          continue
        }
        
        const slotKey = `${day}-${startTime}`
        if (!occupiedSlots.has(slotKey)) {
          selectedSection = section
          occupiedSlots.set(slotKey, section)
          console.log(`✅ Selected section for ${course.code}: ${slotKey}`)
          break
        } else {
          console.log(`❌ Slot ${slotKey} already occupied for ${course.code}`)
        }
      }

      if (selectedSection) {
        // Create proper timeslot structure
        const timeslot = {
          day: selectedSection.timeslot?.day || selectedSection.day,
          start: selectedSection.timeslot?.start || selectedSection.start_time,
          end: selectedSection.timeslot?.end || selectedSection.end_time
        }
        
        selectedSections.push({
          course_id: course.id,
          course_code: course.code,
          course_title: course.title,
          course_level: course.original_level || course.level,
          section_label: selectedSection.section_label,
          timeslot: timeslot,
          room: selectedSection.room,
          instructor: selectedSection.instructor,
          credits: course.credits || 3
        })
      } else {
        console.warn(`⚠️ Could not find conflict-free section for ${course.code}`)
      }
    }

    return selectedSections
  }

  /**
   * Get irregular student's schedule
   */
  static async getIrregularStudentSchedule(
    studentId: string,
    semester: string
  ): Promise<any> {
    try {
      console.log(`🎯 Getting irregular student schedule for: ${studentId}`)
      
      // Get student data
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*, user_id')
        .eq('id', studentId)
        .single()

      if (studentError || !student) {
        console.error('Error fetching student:', studentError)
        return null
      }

      // Get student's saved preferences (elective selections) from elective_choices table
      const { data: preferences, error: prefsError } = await supabase
        .from('elective_choices')
        .select(`
          *,
          course:courses(*)
        `)
        .eq('student_id', studentId)
        .eq('semester', semester)

      if (prefsError) {
        console.error('Error fetching preferences:', prefsError)
      } else {
        console.log(`📋 Found ${preferences?.length || 0} preferences for student ${studentId} in semester ${semester}`)
        if (preferences && preferences.length > 0) {
          console.log('Selected course codes:', preferences.map(p => p.course?.code).filter(Boolean))
          console.log('Selected course details:', preferences.map(p => ({
            course_code: p.course?.code,
            course_title: p.course?.title,
            course_level: p.course?.level,
            priority: p.priority
          })))
        } else {
          console.log('⚠️ No preferences found - this might be why failed courses are not showing in schedule')
        }
      }

      // Get current level schedule
      const { data: levelSchedule, error: scheduleError } = await supabase
        .from('schedule_versions')
        .select('*')
        .eq('level', student.level)
        .eq('semester', semester)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (scheduleError) {
        console.error('Error fetching level schedule:', scheduleError)
        return null
      }

      // Extract ONLY compulsory courses from current level
      // Irregular students should only see compulsory courses, not electives from other groups
      const currentLevelSections: any[] = []
      const seenSections = new Set<string>() // Track unique sections to avoid duplicates
      
      if (levelSchedule && levelSchedule.groups) {
        // Get all course codes from all groups
        const allCourseCodes = new Set<string>()
        Object.values(levelSchedule.groups).forEach((group: any) => {
          (group as any).sections?.forEach((section: any) => {
            allCourseCodes.add(section.course_code)
          })
        })
        
        // Fetch course details to check which are compulsory
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('code, title, course_type, credits, level')
          .in('code', Array.from(allCourseCodes))
          .eq('level', student.level)
        
        if (!coursesError && coursesData) {
          // Create a map of course codes to their types
          const courseTypeMap = new Map<string, string>()
          const courseTitleMap = new Map<string, string>()
          const courseCreditsMap = new Map<string, number>()
          
          coursesData.forEach((course: any) => {
            courseTypeMap.set(course.code, course.course_type)
            courseTitleMap.set(course.code, course.title)
            courseCreditsMap.set(course.code, course.credits || 3)
          })
          
          console.log(`📚 Found ${coursesData.length} courses for level ${student.level}`)
          console.log(`📚 Compulsory courses:`, coursesData.filter((c: any) => c.course_type === 'compulsory').map((c: any) => c.code))
          console.log(`📚 Elective courses:`, coursesData.filter((c: any) => c.course_type === 'elective').map((c: any) => c.code))
          
          // Now filter sections to only include compulsory courses
          Object.values(levelSchedule.groups).forEach((group: any) => {
            (group as any).sections?.forEach((section: any) => {
              const courseType = courseTypeMap.get(section.course_code)
              
              // Only include compulsory courses
              if (courseType === 'compulsory') {
                // Create unique key for this section
                const sectionKey = `${section.course_code}-${section.section_label}-${section.day}-${section.start_time}`
                
                // Only add if we haven't seen this section before
                if (!seenSections.has(sectionKey)) {
                  seenSections.add(sectionKey)
                  currentLevelSections.push({
                    ...section,
                    course_title: courseTitleMap.get(section.course_code) || section.course_title,
                    credits: courseCreditsMap.get(section.course_code) || section.credits || 3,
                    level: student.level,
                    source: 'current_level',
                    course_level: student.level,
                    course_type: 'compulsory'
                  })
                }
              }
            })
          })
          
          console.log(`✅ Filtered to ${currentLevelSections.length} compulsory course sections for level ${student.level}`)
        }
      }

      // Get sections for preference courses from their respective levels
      const preferenceSections: any[] = []
      
      if (preferences && preferences.length > 0) {
        // Get unique levels from preferences (excluding current level)
        const preferenceLevels = [...new Set(
          preferences
            .map((p: any) => p.course?.level)
            .filter((level: number) => level && level !== student.level) // Exclude current level
        )]
        
        if (preferenceLevels.length > 0) {
          // Get schedules from those levels
          const { data: preferenceSchedules, error: prefSchedError } = await supabase
            .from('schedule_versions')
            .select('*')
            .in('level', preferenceLevels)
            .eq('semester', semester)

          if (!prefSchedError && preferenceSchedules) {
            // Get course codes that student selected as preferences
            const selectedCourseCodes = preferences.map((p: any) => p.course?.code).filter(Boolean)
            console.log(`📋 Student selected ${selectedCourseCodes.length} preference courses:`, selectedCourseCodes)
            
            // Track unique preference sections
            const seenPreferenceSections = new Set<string>()
            
            // Extract ALL sections from preference levels
            preferenceSchedules.forEach((schedule: any) => {
              if (schedule.groups) {
                Object.values(schedule.groups).forEach((group: any) => {
                  const groupSections = (group as any).sections || []
                  
                  groupSections.forEach((section: any) => {
                    // Create unique key for this section
                    const sectionKey = `${section.course_code}-${section.section_label}-${section.day}-${section.start_time}`
                    
                    // Only add if we haven't seen this section before
                    if (!seenPreferenceSections.has(sectionKey)) {
                      seenPreferenceSections.add(sectionKey)
                      
                      // Check if this course is one of the student's selected preferences
                      const isStudentPreference = selectedCourseCodes.includes(section.course_code)
                      
                      preferenceSections.push({
                        ...section,
                        level: schedule.level,
                        source: 'preference_level',
                        course_level: schedule.level,
                        is_student_preference: isStudentPreference // Mark if it's their selected course
                      })
                    }
                  })
                })
              }
            })
            
            console.log(`✅ Found ${preferenceSections.length} total sections from preference levels`)
            console.log(`✅ Student's selected preference sections:`, 
              preferenceSections.filter(s => s.is_student_preference).map(s => ({
                course: s.course_code,
                level: s.course_level,
                day: s.day,
                time: `${s.start_time}-${s.end_time}`
              }))
            )
          }
        }
      }

      // Combine all sections for display
      const allSections = [...currentLevelSections, ...preferenceSections]
      
      // Calculate actual student courses and credits
      // Only count: current level compulsory courses + student's selected preference courses
      
      // Get course codes that student selected as preferences
      const selectedCourseCodes = preferences?.map((p: any) => p.course?.code).filter(Boolean) || []
      
      // Count unique courses for the student
      const studentCourses = new Set<string>()
      let studentCredits = 0
      
      // Add current level compulsory courses
      currentLevelSections.forEach((section: any) => {
        // Assuming we need to get course info to check if compulsory
        // For now, add all current level courses as they should all be relevant
        const courseKey = section.course_code
        if (!studentCourses.has(courseKey)) {
          studentCourses.add(courseKey)
          studentCredits += (section.credits || 3)
        }
      })
      
      // Add only the selected preference courses
      preferenceSections.forEach((section: any) => {
        if (section.is_student_preference === true) {
          const courseKey = section.course_code
          if (!studentCourses.has(courseKey)) {
            studentCourses.add(courseKey)
            studentCredits += (section.credits || 3)
          }
        }
      })

      // For comments, use the current level's schedule version ID (like regular students)
      // This allows irregular students to post comments on the same schedule as regular students
      let scheduleId = null
      
      if (levelSchedule && levelSchedule.id) {
        scheduleId = levelSchedule.id
        console.log(`✅ Using current level schedule version ID for comments: ${scheduleId}`)
      } else {
        console.log(`⚠️ No current level schedule found, comments won't be available`)
      }

      return {
        id: scheduleId,
        student_id: studentId,
        semester: semester,
        sections: allSections,
        currentLevelSections: currentLevelSections,
        preferenceSections: preferenceSections,
        total_credits: studentCredits,
        total_courses: studentCourses.size,
        student: student
      }

    } catch (error) {
      console.error('Error fetching irregular schedule:', error)
      return null
    }
  }

  /**
   * Generate schedules for all irregular students in a level
   */
  static async generateForAllIrregularStudents(
    level: number,
    semester: string
  ): Promise<{ success: number; failed: number; total: number }> {
    console.log(`🎯 Generating schedules for all irregular students in Level ${level}`)

    const irregularStudents = await IrregularStudentService.getIrregularStudentsByLevel(level)

    let success = 0
    let failed = 0

    for (const student of irregularStudents) {
      const result = await this.generatePersonalizedSchedule(student.id, semester)
      if (result.success) {
        success++
      } else {
        failed++
        console.error(`Failed for ${student.full_name}: ${result.error}`)
      }
    }

    console.log(`✅ Generated ${success} schedules, ${failed} failed out of ${irregularStudents.length} total`)

    return {
      success,
      failed,
      total: irregularStudents.length
    }
  }
}

