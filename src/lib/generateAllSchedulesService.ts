import { supabase } from './supabase'
import { getScheduleRecommendation, SchedulingConstraints } from './groq'
import { ScheduleService } from './scheduleService'
import { PreferenceService } from './preferenceService'
import { SystemSettingsService } from './systemSettingsService'
import { RuleDefinitionsService } from './ruleDefinitionsService'

export interface ScheduleGroup {
  name: string
  student_count: number
  sections: ScheduleSection[]
}

export interface ScheduleSection {
  course_code: string
  course_title: string
  section_label: string
  day: string
  start_time: string
  end_time: string
  room: string
  instructor: string
  student_count: number
  capacity: number
}

export interface GeneratedSchedule {
  id?: string
  level: number
  semester?: string
  groups: {
    [key: string]: ScheduleGroup
  }
  total_sections: number
  conflicts: number
  efficiency: number
  generated_at: string
}

export class GenerateAllSchedulesService {
  // Global room usage tracking across all levels
  private static globalRoomUsage = new Map<string, Set<string>>() // room -> Set of time slots
  
  // Initialize global room tracking
  private static initializeGlobalRoomTracking(): void {
    const allRooms = [
      'A101', 'A102', 'A103', 'A104', 'A105', 'A106',
      'B201', 'B202', 'B203', 'B204', 'B205', 'B206',
      'C301', 'C302', 'C303', 'C304', 'C305', 'C306',
      'D401', 'D402', 'D403', 'D404', 'D405', 'D406',
      'LAB1', 'LAB2', 'LAB3', 'LAB4', 'LAB5', 'LAB6'
    ]
    
    allRooms.forEach(room => {
      if (!this.globalRoomUsage.has(room)) {
        this.globalRoomUsage.set(room, new Set())
      }
    })
  }

  // Clear global room usage (for fresh start)
  private static clearGlobalRoomUsage(): void {
    this.globalRoomUsage.clear()
    this.initializeGlobalRoomTracking()
  }

  // Check if room is available globally
  private static isRoomAvailableGlobally(room: string, day: string, startTime: string): boolean {
    const timeSlot = `${day}-${startTime}`
    return !this.globalRoomUsage.get(room)?.has(timeSlot)
  }

  // Reserve room globally
  private static reserveRoomGlobally(room: string, day: string, startTime: string): void {
    const timeSlot = `${day}-${startTime}`
    this.globalRoomUsage.get(room)?.add(timeSlot)
  }

  // Generate schedule for a specific level using AI
  static async generateLevelSchedule(level: number, specificGroups?: string[], skipDatabaseSave?: boolean): Promise<GeneratedSchedule> {
    try {
      console.log(`🤖 Generating AI-powered schedule for Level ${level}...`)
      if (skipDatabaseSave) {
        console.log(`⚠️ Skip database save mode - will return data only`)
      }

      // Initialize global room tracking
      this.initializeGlobalRoomTracking()

      // STRICT: Load ALL existing schedules from other levels to prevent ANY overlap
      const occupiedSlots = await this.getAllOccupiedSlotsFromOtherLevels(level)
      console.log(`🔒 STRICT MODE: Loaded ${occupiedSlots.length} occupied time/room slots from other levels`)

      // 🆕 PREFERENCE-DRIVEN: Load student preferences and active rules
      const currentSemester = await SystemSettingsService.getCurrentSemester()
      const preferenceAnalytics = await PreferenceService.getPreferenceAnalytics(level, currentSemester)
      const activeRules = await RuleDefinitionsService.getRulesAsAIConstraints()
      
      console.log(`📊 PREFERENCE DATA: Found ${preferenceAnalytics.length} elective courses with student demand`)
      console.log(`📋 ACTIVE RULES: ${activeRules.length} scheduling rules enabled`)

      // Get courses for this level
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('level', level)

      if (coursesError) throw coursesError
      if (!courses || courses.length === 0) {
        throw new Error(`No courses found for Level ${level}`)
      }

      // Get students for this level
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('level', level)

      if (studentsError) throw studentsError
      if (!students || students.length === 0) {
        throw new Error(`No students found for Level ${level}`)
      }

      console.log(`📚 Found ${courses.length} courses and ${students.length} students for Level ${level}`)

      // Load level group settings to determine per-group capacity and group names
      const { data: levelSettings } = await supabase
        .from('level_group_settings')
        .select('students_per_group, num_groups, group_names')
        .eq('level', level)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const studentsPerGroup = (levelSettings as any)?.students_per_group || 25
      const configuredGroupNames: string[] = (levelSettings as any)?.group_names || ['A','B','C']

      // Group students by their assigned group (if present)
      const studentsByGroup = students.reduce((acc: any, student: any) => {
        const group = student.student_group || 'A'
        if (!acc[group]) acc[group] = []
        acc[group].push(student)
        return acc
      }, {})

      // Rebalance overflow to subsequent groups based on students_per_group and configured group names (without changing DB)
      const balancedGroups: Record<string, any[]> = {}
      let remaining = [...students]
      for (const letter of configuredGroupNames) {
        balancedGroups[letter] = []
      }
      // If students already have groups, preserve but cap per group and spill overflow in order A->B->C...
      for (const letter of configuredGroupNames) {
        const current = studentsByGroup[letter] || []
        const keep = current.slice(0, studentsPerGroup)
        const spill = current.slice(studentsPerGroup)
        balancedGroups[letter].push(...keep)
        remaining = remaining.filter(s => !keep.includes(s))
        remaining.push(...spill)
      }
      // Assign any remaining (unassigned or overflow) to next groups with capacity
      for (const student of remaining) {
        let placed = false
        for (const letter of configuredGroupNames) {
          if (balancedGroups[letter].length < studentsPerGroup) {
            balancedGroups[letter].push(student)
            placed = true
            break
          }
        }
        if (!placed) {
          // If all full, append to last group (soft overflow)
          balancedGroups[configuredGroupNames[configuredGroupNames.length - 1]].push(student)
        }
      }

      console.log(`📊 Students per group (balanced):`, configuredGroupNames.map(l => `${l}: ${balancedGroups[l]?.length || 0}`).join(', '))

      // Create groups only for groups that have students (or specificGroups if provided)
      const groups: {
        [key: string]: {
          name: string
          student_count: number
          sections: ScheduleSection[]
        }
      } = {}

      const allGroupLetters = specificGroups || configuredGroupNames
      
      for (const groupLetter of allGroupLetters) {
        const studentsInGroup = balancedGroups[groupLetter] || []
        
        if (studentsInGroup.length === 0) {
          console.warn(`⚠️ No students in Group ${groupLetter}, skipping schedule generation`)
          continue
        }

        groups[`Group ${groupLetter}`] = {
          name: `Group ${groupLetter}`,
          student_count: studentsInGroup.length,
          sections: []
        }
      }

      if (Object.keys(groups).length === 0) {
        throw new Error(`No groups with students found for Level ${level}`)
      }

      console.log(`✅ Will generate schedules for groups: ${Object.keys(groups).join(', ')}`)

      // Generate schedule for each group using AI
      for (const [groupName, group] of Object.entries(groups)) {
        console.log(`🎯 Generating schedule for ${groupName}...`)
        
        if (courses.length === 0) {
          console.warn(`⚠️ No courses available for ${groupName}, skipping`)
          group.sections = []
          continue
        }
        
        const groupSchedule = await this.generateGroupScheduleWithAI(
          courses,
          group.student_count,
          groupName,
          level,
          occupiedSlots,
          preferenceAnalytics,
          activeRules
        )
        
        // Enforce 12:00-13:00 break by filtering out overlapping sections
        const overlapsBreak = (start: string, end: string): boolean => {
          const breakStart = '12:00'
          const breakEnd = '13:00'
          return (start >= breakStart && start < breakEnd) ||
                 (end > breakStart && end <= breakEnd) ||
                 (start < breakStart && end > breakEnd)
        }
        const filteredSchedule = groupSchedule.filter((s: any) => !overlapsBreak(s.start_time, s.end_time))
        if (filteredSchedule.length !== groupSchedule.length) {
          console.warn(`⏱️ Removed ${groupSchedule.length - filteredSchedule.length} section(s) in ${groupName} overlapping 12:00-13:00`)
        }
        group.sections = filteredSchedule
        console.log(`✅ ${groupName}: Assigned ${groupSchedule.length} sections`)
      }

      // Calculate totals
      const totalSections = Object.values(groups).reduce((sum, group) => sum + group.sections.length, 0)
      const conflicts = this.detectConflicts(groups)
      const efficiency = Math.min(100, Math.round((totalSections / (courses.length * 3)) * 100))

      const schedule: GeneratedSchedule = {
        id: `level-${level}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        level,
        groups,
        total_sections: totalSections,
        conflicts,
        efficiency,
        generated_at: new Date().toISOString()
      }

      console.log(`🔍 Created schedule object:`, JSON.stringify(schedule, null, 2))
      console.log(`🔍 Schedule level: ${schedule.level} (type: ${typeof schedule.level})`)

      // Check for inter-level conflicts and resolve them
      const interLevelConflicts = await this.detectInterLevelConflicts(schedule)
      console.log(`🔍 Detected ${interLevelConflicts} inter-level conflicts`)

      let finalSchedule = schedule
      if (interLevelConflicts > 0) {
        console.log(`🔧 Resolving ${interLevelConflicts} inter-level conflicts...`)
        finalSchedule = await this.resolveConflicts(schedule)
        
        // Recalculate conflicts after resolution
        const resolvedConflicts = this.detectConflicts(finalSchedule.groups)
        const resolvedInterLevelConflicts = await this.detectInterLevelConflicts(finalSchedule)
        
        finalSchedule = {
          ...finalSchedule,
          conflicts: resolvedConflicts + resolvedInterLevelConflicts,
          efficiency: Math.max(0, efficiency - (interLevelConflicts * 5)) // Reduce efficiency for each conflict resolved
        }
        
        console.log(`✅ Conflict resolution complete. Final conflicts: ${finalSchedule.conflicts}`)
      }

      // Save to database immediately and get the real UUID (unless skipping)
      if (!skipDatabaseSave) {
        const savedId = await this.saveSingleScheduleToDatabase(finalSchedule)
        
        // Update finalSchedule with the real UUID from database
        if (savedId) {
          finalSchedule.id = savedId
        }

        console.log(`✅ Level ${level} schedule generated and saved with ID ${savedId}: ${finalSchedule.total_sections} sections, ${finalSchedule.conflicts} conflicts, ${finalSchedule.efficiency}% efficiency`)
      } else {
        console.log(`✅ Level ${level} schedule generated (not saved): ${finalSchedule.total_sections} sections, ${finalSchedule.conflicts} conflicts, ${finalSchedule.efficiency}% efficiency`)
      }
      
      return finalSchedule

    } catch (error) {
      console.error(`❌ Error generating schedule for Level ${level}:`, error)
      throw error
    }
  }

  // Generate schedule for all levels
  static async generateAllLevels(): Promise<GeneratedSchedule[]> {
    try {
      // Clear global room usage for fresh start
      this.clearGlobalRoomUsage()
      console.log('🧹 Cleared global room usage for fresh start')

      // Get available levels
      const { data: levels, error } = await supabase
        .from('courses')
        .select('level')
        .order('level', { ascending: true })

      if (error) throw error
      if (!levels || levels.length === 0) {
        throw new Error('No levels found')
      }

      // Get unique levels
      const uniqueLevels = [...new Set(levels.map((l: any) => l.level))]
      const levelNumbers = uniqueLevels.sort((a, b) => a - b)
      console.log(`🎓 Found levels: ${levelNumbers.join(', ')}`)

      const allSchedules: GeneratedSchedule[] = []

      // Generate schedule for each level
      for (const level of levelNumbers) {
        console.log(`\n🏗️ Starting Level ${level} generation...`)
        const schedule = await this.generateLevelSchedule(level)
        allSchedules.push(schedule)
        console.log(`✅ Completed Level ${level} generation`)
      }

      console.log(`\n🎉 Successfully generated schedules for all ${levelNumbers.length} levels!`)
      return allSchedules

    } catch (error) {
      console.error('Error generating all schedules:', error)
      throw error
    }
  }

  // Generate schedule for a specific group using AI
  private static async generateGroupScheduleWithAI(
    courses: any[],
    studentCount: number,
    groupName: string,
    level: number,
    occupiedSlots: Array<{room: string, day: string, start: string, level: number, course: string}> = [],
    preferenceAnalytics: any[] = [],
    activeRules: string[] = []
  ): Promise<ScheduleSection[]> {
    
    console.log(`🤖 Starting AI generation for ${groupName} with ${courses.length} courses`)
    console.log(`📊 Using ${preferenceAnalytics.length} preference-based elective constraints`)
    console.log(`📋 Applying ${activeRules.length} active scheduling rules`)
    
    // Split courses by type to ensure compulsory coverage
    const compulsoryCourses = courses.filter((c: any) => {
      const t = (c.course_type || '').toString().toLowerCase()
      return t !== 'elective' // default/unknown treated as compulsory
    })
    const electiveCourses = courses.filter((c: any) => {
      const t = (c.course_type || '').toString().toLowerCase()
      return t === 'elective'
    })

    // Get all available rooms (global pool)
    const allRooms = [
      'A101', 'A102', 'A103', 'A104', 'A105', 'A106',
      'B201', 'B202', 'B203', 'B204', 'B205', 'B206',
      'C301', 'C302', 'C303', 'C304', 'C305', 'C306',
      'D401', 'D402', 'D403', 'D404', 'D405', 'D406',
      'LAB1', 'LAB2', 'LAB3', 'LAB4', 'LAB5', 'LAB6'
    ]
    
    // Add occupied slots from other levels as STRICT blocked slots
    const blockedSlotsFromOtherLevels = occupiedSlots.map(slot => ({
      day: slot.day,
      start: slot.start,
      end: this.calculateEndTime(slot.start, 90), // Calculate end time (90 min = 1.5 hours)
      room: slot.room
    }))
    
    // Prepare constraints for AI
    const constraints: SchedulingConstraints = {
      students_per_course: {},
      blocked_slots: [
        { day: 'Friday', start: '08:00', end: '18:00' }, // No classes on Friday
        { day: 'Monday', start: '12:00', end: '13:00' }, // Break time
        { day: 'Tuesday', start: '12:00', end: '13:00' },
        { day: 'Wednesday', start: '12:00', end: '13:00' },
        { day: 'Thursday', start: '12:00', end: '13:00' },
        ...blockedSlotsFromOtherLevels // Add occupied slots from other levels
      ],
      available_rooms: allRooms,
      rules: [
        `This is for ${groupName} in Level ${level} - create a UNIQUE schedule`,
        '🔒 CRITICAL: NEVER use time/room slots that are OCCUPIED by other levels',
        `🔒 OCCUPIED SLOTS (MUST AVOID): ${occupiedSlots.map(s => `${s.room} on ${s.day} at ${s.start} (Level ${s.level})`).join(', ') || 'None yet'}`,
        'No classes on Friday',
        'No classes during 12:00-13:00 break time',
        'Each section should have 20-30 students maximum',
        'No duplicate courses in the same group schedule',
        'Lab courses must use LAB rooms (LAB1-LAB6)',
        'Lecture courses must use regular rooms (A101-D406)',
        'MATH102 and MATH103 should be scheduled sequentially if possible',
        'Create a balanced schedule across all days',
        'Avoid scheduling all courses on the same day',
        '🔒 STRICTLY check room availability - rooms ARE used by other levels',
        'Distribute courses evenly across Monday-Thursday',
        `${occupiedSlots.length} slots are ALREADY OCCUPIED - avoid them at ALL costs`,
        ...activeRules, // 🆕 Include active scheduling rules
        // 🆕 Add preference-based elective constraints
        ...(preferenceAnalytics.length > 0 ? [
          '\n🎯 ELECTIVE COURSES (PREFERENCE-DRIVEN):',
          ...preferenceAnalytics.map(pref => 
            `- Generate ${pref.sections_needed} section(s) of "${pref.course_title}" (${pref.course_code}) because ${pref.student_count} students requested it`
          ),
          'IMPORTANT: Only generate elective sections for courses that students have requested.',
          'Do NOT create elective sections with zero student demand.'
        ] : [])
      ],
      objective_priorities: {
        minimize_conflicts: true,
        minimize_gaps: true,
        balance_instructor_loads: true
      }
    }

    // Calculate students per elective course only for AI
    electiveCourses.forEach(course => {
      constraints.students_per_course[course.code] = studentCount
    })

    console.log(`📋 Constraints for ${groupName}:`, {
      courses: courses.map(c => c.code),
      students_per_course: constraints.students_per_course,
      available_rooms: constraints.available_rooms,
      group_specific: true
    })

    try {
      // Get AI recommendations
      console.log(`🚀 Calling AI API for ${groupName}...`)
      const recommendations = await getScheduleRecommendation(constraints, level)
      console.log(`📊 AI returned ${recommendations.length} recommendations for ${groupName}`)
      
      if (!recommendations || recommendations.length === 0) {
        console.warn(`⚠️ AI returned empty recommendations for ${groupName}, using fallback`)
        return this.generateFallbackSchedule(courses, studentCount, groupName)
      }
      
      // Convert AI recommendations to schedule sections with global and per-group checks
      const sections: ScheduleSection[] = []
      const usedGroupSlots = new Set<string>() // per-group day-start uniqueness
      const usedCourseCodes = new Set<string>() // prevent duplicate course in same group
      
      for (const rec of recommendations) {
        // Prevent duplicate course in the same group
        if (usedCourseCodes.has(rec.course_code)) {
          console.warn(`⚠️ Skipping duplicate course ${rec.course_code} in ${groupName}`)
          continue
        }
        const groupSlotKey = `${rec.timeslot.day}-${rec.timeslot.start}`
        if (usedGroupSlots.has(groupSlotKey)) {
          console.warn(`⚠️ Skipping time collision in ${groupName} at ${groupSlotKey}`)
          continue
        }
        // Check if room is available globally
        if (this.isRoomAvailableGlobally(rec.room, rec.timeslot.day, rec.timeslot.start)) {
          // Reserve the room globally
          this.reserveRoomGlobally(rec.room, rec.timeslot.day, rec.timeslot.start)
          
          const section: ScheduleSection = {
            course_code: rec.course_code,
            course_title: courses.find(c => c.code === rec.course_code)?.title || rec.course_code,
            section_label: this.getGroupSectionLabel(groupName),
            day: rec.timeslot.day,
            start_time: rec.timeslot.start,
            end_time: rec.timeslot.end,
            room: rec.room,
            instructor: `Dr. ${rec.course_code}`,
            student_count: Math.min(rec.allocated_student_ids?.length || studentCount, 30),
            capacity: 30
          }
          
          sections.push(section)
          usedGroupSlots.add(groupSlotKey)
          usedCourseCodes.add(rec.course_code)
          console.log(`✅ Reserved ${rec.room} for ${rec.course_code} on ${rec.timeslot.day} ${rec.timeslot.start}`)
        } else {
          console.warn(`⚠️ Room ${rec.room} not available for ${rec.course_code} on ${rec.timeslot.day} ${rec.timeslot.start}, skipping`)
        }
      }

      // Ensure ALL compulsory courses are present (AI returns electives only)
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
      const timeSlots = [
        { start: '08:00', end: '09:30' },
        { start: '09:30', end: '11:00' },
        { start: '11:00', end: '12:30' },
        { start: '12:30', end: '14:00' },
        { start: '14:00', end: '15:30' },
        { start: '15:30', end: '17:00' }
      ]
      let offset = 0
      for (const course of compulsoryCourses) {
        if (usedCourseCodes.has(course.code)) continue
        let placed = false
        for (let i = 0; i < days.length * timeSlots.length; i++) {
          const day = days[(i + offset) % days.length]
          const slot = timeSlots[(i + offset) % timeSlots.length]
          const key = `${day}-${slot.start}`
          const isLab = !!course.is_lab || (course.code || '').toUpperCase().includes('LAB') || (course.title || '').toLowerCase().includes('lab')
          const candidateRooms = allRooms.filter(r => isLab ? r.startsWith('LAB') : !r.startsWith('LAB'))
          for (const room of candidateRooms) {
            if (!usedGroupSlots.has(key) && this.isRoomAvailableGlobally(room, day, slot.start)) {
              this.reserveRoomGlobally(room, day, slot.start)
              sections.push({
                course_code: course.code,
                course_title: course.title,
                section_label: this.getGroupSectionLabel(groupName),
                day,
                start_time: slot.start,
                end_time: slot.end,
                room,
                instructor: `Dr. ${course.code}`,
                student_count: Math.min(studentCount, 30),
                capacity: 30
              })
              usedGroupSlots.add(key)
              usedCourseCodes.add(course.code)
              placed = true
              break
            }
          }
          if (placed) break
        }
        if (!placed) console.warn(`⚠️ Could not place compulsory course ${course.code} for ${groupName}`)
        offset++
      }

      console.log(`✅ ${groupName}: Generated ${sections.length} sections (compulsory + electives)`)
      return sections

    } catch (aiError) {
      console.error(`❌ AI generation failed for ${groupName}:`, aiError)
      console.log(`🔄 Using fallback schedule for ${groupName}...`)
      
      // Fallback: Create basic schedule without AI
      const fallbackSections = this.generateFallbackSchedule(courses, studentCount, groupName)
      console.log(`✅ ${groupName}: Generated ${fallbackSections.length} sections using fallback`)
      return fallbackSections
    }
  }

  // Get group-specific rooms to avoid conflicts
  private static getGroupSpecificRooms(groupName: string): string[] {
    switch (groupName) {
      case 'Group A':
        return ['A101', 'A102', 'A103', 'A104', 'A105', 'A106', 'LAB1', 'LAB2']
      case 'Group B':
        return ['B201', 'B202', 'B203', 'B204', 'B205', 'B206', 'LAB3', 'LAB4']
      case 'Group C':
        return ['C301', 'C302', 'C303', 'C304', 'C305', 'C306', 'LAB5', 'LAB6']
      default:
        return ['A101', 'A102', 'A103', 'B201', 'B202', 'B203', 'C301', 'C302', 'LAB1', 'LAB2']
    }
  }

  // Get group-specific section label
  private static getGroupSectionLabel(groupName: string): string {
    switch (groupName) {
      case 'Group A': return 'A'
      case 'Group B': return 'B'
      case 'Group C': return 'C'
      default: return 'A'
    }
  }

  // Fallback schedule generation (when AI fails)
  private static generateFallbackSchedule(
    courses: any[],
    studentCount: number,
    groupName: string
  ): ScheduleSection[] {
    console.log(`🔄 Creating fallback schedule for ${groupName} with ${courses.length} courses`)
    
    // Enforce system policy: afternoon-only, Monday-Thursday
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
    const timeSlots = [
      { start: '08:00', end: '09:30' },
      { start: '09:30', end: '11:00' },
      { start: '11:00', end: '12:30' },
      { start: '12:30', end: '14:00' },
      { start: '14:00', end: '15:30' },
      { start: '15:30', end: '17:00' }
    ]
    
    // Get all available rooms (global pool)
    const allRooms = [
      'A101', 'A102', 'A103', 'A104', 'A105', 'A106',
      'B201', 'B202', 'B203', 'B204', 'B205', 'B206',
      'C301', 'C302', 'C303', 'C304', 'C305', 'C306',
      'D401', 'D402', 'D403', 'D404', 'D405', 'D406',
      'LAB1', 'LAB2', 'LAB3', 'LAB4', 'LAB5', 'LAB6'
    ]
    
    const lectureRooms = allRooms.filter(room => !room.startsWith('LAB'))
    const labRooms = allRooms.filter(room => room.startsWith('LAB'))

    // Create group-specific time offset to avoid conflicts
    const groupOffset = this.getGroupTimeOffset(groupName)

    const sections: ScheduleSection[] = []
    const usedGroupSlots = new Set<string>() // ensure no two courses for same group at same day-start

    // Precompute all slots (Mon-Thu x 4)
    const allSlots: Array<{ day: string; start: string; end: string }> = []
    for (const d of days) {
      for (const s of timeSlots) {
        allSlots.push({ day: d, start: s.start, end: s.end })
      }
    }

    let slotCursor = groupOffset % allSlots.length

    for (let index = 0; index < courses.length; index++) {
      const course = courses[index]
      const isLab = (course.code || '').toUpperCase().includes('LAB') || (course.title || '').toLowerCase().includes('lab')
      const availableRooms = isLab ? labRooms : lectureRooms

      let placed = false
      // Try up to allSlots.length positions to find a free group slot
      for (let attempt = 0; attempt < allSlots.length && !placed; attempt++) {
        const slot = allSlots[(slotCursor + attempt) % allSlots.length]
        const groupKey = `${slot.day}-${slot.start}`
        if (usedGroupSlots.has(groupKey)) continue

        // Find a free room at this group slot
        for (const room of availableRooms) {
          if (this.isRoomAvailableGlobally(room, slot.day, slot.start)) {
            this.reserveRoomGlobally(room, slot.day, slot.start)
            usedGroupSlots.add(groupKey)

            const section: ScheduleSection = {
              course_code: course.code,
              course_title: course.title,
              section_label: this.getGroupSectionLabel(groupName),
              day: slot.day,
              start_time: slot.start,
              end_time: slot.end,
              room,
              instructor: `Dr. ${course.code}`,
              student_count: Math.min(studentCount, 30),
              capacity: 30
            }
            sections.push(section)
            console.log(`📚 Fallback section: ${course.code} - ${slot.day} ${slot.start} - ${room}`)
            placed = true
            break
          }
        }
      }

      if (!placed) {
        console.warn(`⚠️ No available unique group slot for ${course.code}; skipping`)
      }

      // Advance cursor to vary distribution across groups
      slotCursor = (slotCursor + 1) % allSlots.length
    }

    console.log(`✅ Fallback generated ${sections.length} sections for ${groupName}`)
    return sections
  }

  // Get group-specific time offset to avoid conflicts
  private static getGroupTimeOffset(groupName: string): number {
    switch (groupName) {
      case 'Group A': return 0
      case 'Group B': return 2  // Offset by 2 time slots
      case 'Group C': return 4  // Offset by 4 time slots
      default: return 0
    }
  }

  // Detect conflicts in the generated schedule
  private static detectConflicts(groups: any): number {
    let conflicts = 0
    const allSections = Object.values(groups).flatMap((group: any) => group.sections)
    
    // Check for room conflicts within the same level
    const roomTimeMap = new Map<string, string[]>()
    
    for (const section of allSections) {
      const key = `${section.room}-${section.day}-${section.start_time}`
      if (roomTimeMap.has(key)) {
        roomTimeMap.get(key)!.push(section.course_code)
        conflicts++
      } else {
        roomTimeMap.set(key, [section.course_code])
      }
    }
    
    return conflicts
  }

  // Detect conflicts with existing schedules from other levels
  private static async detectInterLevelConflicts(newSchedule: GeneratedSchedule): Promise<number> {
    try {
      let conflicts = 0
      
      // Get all existing schedules from other levels
      const { data: existingSchedules } = await supabase
        .from('schedule_versions')
        .select('*')
        .neq('level', newSchedule.level)

      if (!existingSchedules || existingSchedules.length === 0) {
        return 0 // No other levels to conflict with
      }

      console.log(`🔍 Checking for conflicts with ${existingSchedules.length} existing schedules from other levels`)

      // Extract all time slots from existing schedules
      const existingTimeSlots = new Map<string, { level: number, course: string }>()
      
      for (const schedule of existingSchedules) {
        const groups = (schedule as any).groups || schedule.diff_json?.groups || {}
        for (const [groupName, groupData] of Object.entries(groups)) {
          for (const section of (groupData as any).sections || []) {
            const timeSlot = `${section.room}-${section.day}-${section.start_time}`
            existingTimeSlots.set(timeSlot, {
              level: schedule.level,
              course: section.course_code
            })
          }
        }
      }

      // Check new schedule against existing time slots
      const newSections = Object.values(newSchedule.groups).flatMap((group: any) => group.sections)
      
      for (const section of newSections) {
        const timeSlot = `${section.room}-${section.day}-${section.start_time}`
        if (existingTimeSlots.has(timeSlot)) {
          const conflict = existingTimeSlots.get(timeSlot)!
          console.log(`⚠️ Conflict detected: Level ${newSchedule.level} ${section.course_code} conflicts with Level ${conflict.level} ${conflict.course} at ${timeSlot}`)
          conflicts++
        }
      }

      return conflicts
    } catch (error) {
      console.error('Error detecting inter-level conflicts:', error)
      return 0
    }
  }

  // Resolve conflicts by adjusting schedule times and rooms
  private static async resolveConflicts(schedule: GeneratedSchedule): Promise<GeneratedSchedule> {
    try {
      console.log(`🔧 Resolving conflicts for Level ${schedule.level}...`)
      
      // Get all existing schedules from other levels
      const { data: existingSchedules } = await supabase
        .from('schedule_versions')
        .select('*')
        .neq('level', schedule.level)

      if (!existingSchedules || existingSchedules.length === 0) {
        return schedule // No conflicts to resolve
      }

      // Extract occupied time slots from existing schedules
      const occupiedSlots = new Map<string, { level: number, course: string }>()
      
      for (const existingSchedule of existingSchedules) {
        const groups = (existingSchedule as any).groups || existingSchedule.diff_json?.groups || {}
        for (const [groupName, groupData] of Object.entries(groups)) {
          for (const section of (groupData as any).sections || []) {
            const timeSlot = `${section.room}-${section.day}-${section.start_time}`
            occupiedSlots.set(timeSlot, {
              level: existingSchedule.level,
              course: section.course_code
            })
          }
        }
      }

      // Available time slots (afternoon only, no Friday)
      const availableTimes = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
      const availableDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
      const availableRooms = ['A101', 'A102', 'A103', 'A104', 'A105', 'A106', 'B201', 'B202', 'B203', 'B204', 'B205', 'B206', 'C301', 'C302', 'C303', 'C304', 'C305', 'C306', 'D401', 'D402', 'D403', 'D404', 'D405', 'D406', 'LAB1', 'LAB2', 'LAB3', 'LAB4', 'LAB5', 'LAB6']

      // Resolve conflicts for each group
      const resolvedGroups = { ...schedule.groups }
      
      for (const [groupName, groupData] of Object.entries(resolvedGroups)) {
        const sections = (groupData as any).sections || []
        const resolvedSections = []
        
        for (const section of sections) {
          let resolvedSection = { ...section }
          let attempts = 0
          const maxAttempts = 50
          
          // Try to find a non-conflicting time slot
          while (attempts < maxAttempts) {
            const timeSlot = `${resolvedSection.room}-${resolvedSection.day}-${resolvedSection.start_time}`
            
            if (!occupiedSlots.has(timeSlot)) {
              // No conflict, use this slot
              break
            }
            
            // Conflict found, try a different time/room
            const randomDay = availableDays[Math.floor(Math.random() * availableDays.length)]
            const randomTime = availableTimes[Math.floor(Math.random() * availableTimes.length)]
            const randomRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)]
            
            resolvedSection = {
              ...resolvedSection,
              day: randomDay,
              start_time: randomTime,
              end_time: this.calculateEndTime(randomTime, 90), // 90 minutes duration
              room: randomRoom
            }
            
            attempts++
          }
          
          if (attempts >= maxAttempts) {
            console.log(`⚠️ Could not resolve conflict for ${section.course_code} in ${groupName} after ${maxAttempts} attempts`)
          } else {
            console.log(`✅ Resolved conflict for ${section.course_code} in ${groupName}`)
          }
          
          resolvedSections.push(resolvedSection)
        }
        
        resolvedGroups[groupName] = {
          ...groupData,
          sections: resolvedSections
        }
      }

      return {
        ...schedule,
        groups: resolvedGroups
      }
    } catch (error) {
      console.error('Error resolving conflicts:', error)
      return schedule
    }
  }

  // Calculate end time based on start time and duration
  private static calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + durationMinutes
    const endHours = Math.floor(totalMinutes / 60)
    const endMinutes = totalMinutes % 60
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  }

  // Save a single schedule to database and return the saved schedule with real UUID
  static async saveSingleScheduleToDatabase(schedule: GeneratedSchedule): Promise<string | null> {
    try {
      console.log(`💾 Attempting to save Level ${schedule.level} schedule to database...`)
      console.log(`💾 Schedule object:`, JSON.stringify(schedule, null, 2))
      
      // Validate required fields
      if (!schedule.level) {
        throw new Error('Schedule level is required but was not provided')
      }
      
      // Final validation: ensure zero conflicts across rooms and per-group slots
      const seenSlots = new Set<string>()
      for (const [gName, g] of Object.entries(schedule.groups)) {
        const seenGroupSlots = new Set<string>()
        const seenCourses = new Set<string>()
        ;(g as any).sections = (g as any).sections.filter((s: any) => {
          const roomKey = `${s.room}-${s.day}-${s.start_time}`
          const groupKey = `${s.day}-${s.start_time}`
          if (seenSlots.has(roomKey) || seenGroupSlots.has(groupKey) || seenCourses.has(s.course_code)) {
            console.warn(`🧹 Dropping conflicting/duplicate section ${s.course_code} @ ${roomKey} in ${gName}`)
            return false
          }
          seenSlots.add(roomKey)
          seenGroupSlots.add(groupKey)
          seenCourses.add(s.course_code)
          return true
        })
      }

      const semester = await SystemSettingsService.getCurrentSemester()

      const totalSections = Object.values(schedule.groups).reduce((sum: number, g: any) => sum + (g.sections?.length || 0), 0)

      const { data, error } = await supabase
        .from('schedule_versions')
        .insert({
          level: schedule.level,
          semester,
          groups: schedule.groups,
          total_sections: totalSections,
          conflicts: schedule.conflicts,
          efficiency: schedule.efficiency,
          generated_at: schedule.generated_at
        })
        .select()

      if (error) {
        console.error(`❌ Database error saving schedule for Level ${schedule.level}:`, error)
        console.error(`❌ Error details:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        // Insert payload is constructed inline above in .insert(); nothing else to print
        
        // If it's an RLS error, provide helpful message
        if (error.code === '42501' || error.message.includes('permission denied')) {
          console.error(`❌ RLS Policy Error: You need to run the fix-schedule-insert-rls.sql file in your Supabase SQL Editor to allow schedule inserts`)
          throw new Error(`Database permission error. Please run the fix-schedule-insert-rls.sql file in your Supabase SQL Editor to allow schedule inserts.`)
        }
        
        // If it's a null constraint error, provide specific help
        if (error.message.includes('null value') && error.message.includes('semester')) {
          console.error(`❌ Semester null constraint error.`)
          throw new Error(`Semester field is null. This should not happen. Please check the console logs for details.`)
        }
        
        throw error
      }

      // Return the UUID from the saved schedule
      const savedScheduleId = data && data.length > 0 ? data[0].id : null
      console.log(`✅ Successfully saved Level ${schedule.level} schedule to database with ID: ${savedScheduleId}`)
      return savedScheduleId
    } catch (error) {
      console.error('❌ Error saving schedule to database:', error)
      throw error
    }
  }

  // Save schedules to database
  static async saveSchedulesToDatabase(schedules: GeneratedSchedule[]): Promise<void> {
    try {
      for (const schedule of schedules) {
        const semester = await SystemSettingsService.getCurrentSemester()
        const totalSections = Object.values(schedule.groups).reduce((sum: number, g: any) => sum + (g.sections?.length || 0), 0)

        const { error } = await supabase
          .from('schedule_versions')
          .insert({
            level: schedule.level,
            semester,
            groups: schedule.groups,
            total_sections: totalSections,
            conflicts: schedule.conflicts,
            efficiency: schedule.efficiency,
            generated_at: schedule.generated_at
          })

        if (error) {
          console.error(`Error saving schedule for Level ${schedule.level}:`, error)
          throw error
        }
      }

      console.log(`✅ Saved ${schedules.length} schedules to database`)
    } catch (error) {
      console.error('Error saving schedules to database:', error)
      throw error
    }
  }

  // Get existing schedules from database
  static async getExistingSchedules(): Promise<GeneratedSchedule[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_versions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []).map(schedule => ({
        id: schedule.id,
        level: schedule.level,
        groups: (schedule as any).groups || {},
        total_sections: (schedule as any).total_sections || Object.values(((schedule as any).groups || {})).reduce((sum: number, g: any) => sum + (g.sections?.length || 0), 0),
        conflicts: (schedule as any).conflicts || 0,
        efficiency: (schedule as any).efficiency || 0,
        generated_at: (schedule as any).generated_at || schedule.created_at
      }))
    } catch (error) {
      console.error('Error loading existing schedules:', error)
      throw error
    }
  }

  // Delete a schedule
  static async deleteSchedule(scheduleId: string): Promise<void> {
    try {
      console.log(`🗑️ Attempting to delete schedule: ${scheduleId}`)
      
      const { data, error } = await supabase
        .from('schedule_versions')
        .delete()
        .eq('id', scheduleId)
        .select()

      if (error) {
        console.error('Supabase delete error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw new Error(`Failed to delete schedule: ${error.message || 'Unknown error'}`)
      }
      
      console.log(`✅ Deleted schedule ${scheduleId}`, data)
    } catch (error: any) {
      console.error('Error deleting schedule:', {
        error,
        message: error?.message,
        scheduleId
      })
      throw new Error(error?.message || 'Failed to delete schedule')
    }
  }


  // Generate schedule with AI prompt for editing
  static async generateLevelScheduleWithPrompt(
    level: number, 
    userPrompt: string, 
    enhancedConstraints: any
  ): Promise<GeneratedSchedule> {
    try {
      console.log(`🤖 Regenerating schedule for Level ${level}`)
      console.log(`📝 User instructions: ${userPrompt}`)
      console.log(`🔒 Occupied slots from other levels: ${enhancedConstraints.occupiedSlots?.length || 0}`)
      
      // SIMPLE APPROACH: Just use the regular generation method
      // It already has all the strict conflict prevention built-in
      console.log(`✅ Using regular generation method (already has strict conflict prevention)`)
      
      // The regular generateLevelSchedule already:
      // 1. Loads occupied slots from other levels
      // 2. Passes them to AI with strict rules
      // 3. Detects and resolves conflicts
      // 4. Returns a proper schedule
      
      // Generate fresh schedule using the proven method (don't save to DB yet)
      const newSchedule = await this.generateLevelSchedule(level, undefined, true)
      
      console.log(`✅ Generated schedule for Level ${level}:`, {
        groupsCount: Object.keys(newSchedule.groups).length,
        totalSections: newSchedule.total_sections,
        conflicts: newSchedule.conflicts
      })
      
      return newSchedule

    } catch (error) {
      console.error('Error in schedule regeneration:', error)
      throw error
    }
  }

  // Call AI service for schedule editing
  private static async callAIForScheduleEditing(constraints: any, courses: any[]): Promise<any> {
    try {
      console.log(`🤖 Sending to AI:`, {
        level: constraints.level,
        occupiedSlotsCount: constraints.occupiedSlots?.length || 0,
        occupiedSlotsSample: constraints.occupiedSlots?.slice(0, 3) || [],
        userPrompt: constraints.userPrompt,
        coursesCount: courses.length
      })

      const response = await fetch('/api/generate-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          constraints: {
            ...constraints,
            courses: courses.map(c => ({
              code: c.code,
              title: c.title,
              is_fixed: c.is_fixed,
              allowable_rooms: c.allowable_rooms
            }))
          },
          level: constraints.level,
          editingMode: true,
          userPrompt: constraints.userPrompt
        }),
      })

      if (!response.ok) {
        console.error(`❌ AI API returned error status: ${response.status}`)
        throw new Error(`AI API error: ${response.status}`)
      }

      const data = await response.json()
      console.log(`📡 AI API response:`, {
        hasRecommendations: !!data.recommendations,
        recommendationsCount: data.recommendations?.length || 0,
        dataSample: data
      })
      
      if (!data.recommendations || data.recommendations.length === 0) {
        console.warn(`⚠️ AI API returned empty recommendations`)
      }
      
      return data.recommendations || []
    } catch (error) {
      console.error('AI API call failed:', error)
      // Fallback to basic regeneration
      return this.generateFallbackEditedSchedule(constraints, courses)
    }
  }

  // Process AI response for editing
  private static async processAIEditingResponse(aiResponse: any[], level: number, userPrompt: string): Promise<GeneratedSchedule> {
    console.log(`📥 Processing AI response for Level ${level}:`, {
      aiResponseLength: aiResponse?.length || 0,
      aiResponseSample: aiResponse?.slice(0, 2) || [],
      userPrompt
    })
    
    // Check if AI response is empty
    if (!aiResponse || aiResponse.length === 0) {
      console.error(`❌ AI returned EMPTY response for Level ${level}!`)
      console.error(`❌ This means the AI API failed to generate any schedule sections.`)
      throw new Error(`AI API returned empty schedule for Level ${level}. Please try again with different instructions.`)
    }
    
    const groups: { [key: string]: ScheduleGroup } = {}
    
    // Create groups A, B, C with distributed sections
    const groupNames = ['Group A', 'Group B', 'Group C']
    
    groupNames.forEach((groupName, groupIndex) => {
      const groupSections = aiResponse
        .filter((_, index) => index % groupNames.length === groupIndex)
        .map(recommendation => ({
          course_code: recommendation.course_code,
          course_title: recommendation.course_code,
          section_label: recommendation.section_label,
          day: recommendation.timeslot.day,
          start_time: recommendation.timeslot.start,
          end_time: recommendation.timeslot.end,
          room: recommendation.room,
          instructor: 'TBA',
          student_count: Math.min(25, recommendation.allocated_student_ids?.length || 25),
          capacity: 30
        }))
      
      console.log(`📋 ${groupName}: ${groupSections.length} sections`)
      
      groups[groupName] = {
        name: groupName,
        student_count: Math.floor(75 / groupNames.length), // Distribute students
        sections: groupSections
      }
    })

    // Calculate total sections from all groups
    const totalSections = Object.values(groups).reduce((sum, group) => sum + group.sections.length, 0)
    console.log(`📊 Total sections calculated: ${totalSections}`)
    
    // DON'T create a new ID - the caller will handle updating the existing schedule
    const schedule: GeneratedSchedule = {
      level,
      groups,
      total_sections: totalSections,
      conflicts: 0,
      efficiency: 85,
      generated_at: new Date().toISOString()
    }

    // Detect internal conflicts (within groups)
    const internalConflicts = this.detectConflicts(schedule.groups)
    console.log(`🔍 Detected ${internalConflicts} internal conflicts in edited schedule`)

    // Check for inter-level conflicts
    const interLevelConflicts = await this.detectInterLevelConflicts(schedule)
    console.log(`🔍 Detected ${interLevelConflicts} inter-level conflicts in edited schedule`)

    const totalConflicts = internalConflicts + interLevelConflicts

    let finalSchedule = schedule
    if (totalConflicts > 0) {
      console.warn(`⚠️ AI generated schedule still has ${totalConflicts} conflicts (${internalConflicts} internal + ${interLevelConflicts} inter-level)`)
      console.warn(`⚠️ This means the AI did NOT properly follow the conflict avoidance instructions`)
      
      // Try to resolve conflicts
      finalSchedule = await this.resolveConflicts(schedule)
      
      // Recalculate conflicts after resolution attempt
      const resolvedInternalConflicts = this.detectConflicts(finalSchedule.groups)
      const resolvedInterLevelConflicts = await this.detectInterLevelConflicts(finalSchedule)
      const finalTotalConflicts = resolvedInternalConflicts + resolvedInterLevelConflicts
      
      finalSchedule = {
        ...finalSchedule,
        conflicts: finalTotalConflicts,
        efficiency: Math.max(0, 85 - (finalTotalConflicts * 5))
      }
      
      if (finalTotalConflicts > 0) {
        console.error(`❌ Still have ${finalTotalConflicts} conflicts after resolution attempt`)
        console.error(`❌ AI is not properly avoiding occupied time slots`)
      } else {
        console.log(`✅ Conflict resolution successful! All conflicts resolved.`)
      }
    } else {
      console.log(`✅ No conflicts detected in edited schedule!`)
      finalSchedule.conflicts = 0
    }

    // DON'T save to database here - the caller (saveEdits) will handle updating the existing schedule
    console.log(`✅ Edited schedule ready (${finalSchedule.conflicts} conflicts)`)

    return finalSchedule
  }

  // Fallback schedule generation for editing
  private static generateFallbackEditedSchedule(constraints: any, courses: any[]): any[] {
    return courses.slice(0, 6).map((course, index) => ({
      course_code: course.code,
      section_label: 'A',
      timeslot: {
        day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'][index % 4],
        start: index < 3 ? '14:00' : '15:30',
        end: index < 3 ? '15:30' : '17:00'
      },
      room: constraints.availableRooms[index % constraints.availableRooms.length],
      allocated_student_ids: Array(25).fill(0).map((_, i) => `student-${i}`),
      justification: `Fallback editing for ${course.code} based on user prompt`,
      confidence_score: 0.7
    }))
  }

  /**
   * Update an existing schedule in the database
   */
  static async updateSchedule(
    scheduleId: string,
    updateData: {
      groups: any;
      total_sections: number;
      conflicts: number;
      efficiency: number;
    }
  ): Promise<void> {
    try {
      console.log('💾 Updating schedule in database:', {
        id: scheduleId,
        groupsCount: Object.keys(updateData.groups || {}).length,
        groupNames: Object.keys(updateData.groups || {}),
        totalSections: updateData.total_sections
      })

      const { data, error } = await supabase
        .from('schedule_versions')
        .update({
          diff_json: {
            groups: updateData.groups,
            total_sections: updateData.total_sections,
            conflicts: updateData.conflicts,
            efficiency: updateData.efficiency,
            status: 'draft',
            generated_at: new Date().toISOString()
          }
        })
        .eq('id', scheduleId)
        .select()

      if (error) {
        console.error('❌ Database update error:', error)
        throw new Error(`Failed to update schedule: ${error.message}`)
      }

      console.log('✅ Successfully updated schedule in database:', {
        id: scheduleId,
        updatedData: data,
        groupsSaved: Object.keys(updateData.groups || {}).length
      })
    } catch (error) {
      console.error('Error updating schedule:', error)
      throw error
    }
  }

  /**
   * Get group statistics for a specific level
   * Returns which groups have students and how many
   */
  static async getGroupStatistics(level: number): Promise<{
    groups: { letter: string; studentCount: number; hasSchedule: boolean }[]
  }> {
    try {
      // Count total students for this level
      const { data: allStudents } = await supabase
        .from('students')
        .select('id')
        .eq('level', level)

      const totalStudents = (allStudents || []).length

      // Load level group settings
      const { data: levelSettings } = await supabase
        .from('level_group_settings')
        .select('students_per_group, group_names')
        .eq('level', level)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const studentsPerGroup = (levelSettings as any)?.students_per_group || 25
      const configuredGroupNames: string[] = (levelSettings as any)?.group_names || ['A','B','C']

      // Compute balanced counts for display
      let remaining = totalStudents
      const balancedCounts: Record<string, number> = {}
      for (const letter of configuredGroupNames) {
        const take = Math.min(studentsPerGroup, remaining)
        balancedCounts[letter] = take
        remaining -= take
      }

      // Check which groups have schedules
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedule_versions')
        .select('groups')
        .eq('level', level)
        .order('created_at', { ascending: false })
        .limit(1)

      if (schedulesError) throw schedulesError

      const existingGroups = schedules && schedules.length > 0 
        ? Object.keys((schedules[0] as any).groups || {}).map(g => g.replace('Group ', ''))
        : []

      // Build group statistics using configured groups and balanced counts
      const groups = configuredGroupNames.map(letter => ({
        letter,
        studentCount: balancedCounts[letter] || 0,
        hasSchedule: existingGroups.includes(letter)
      }))

      return { groups }
    } catch (error) {
      console.error('Error getting group statistics:', error)
      throw error
    }
  }

  /**
   * Generate schedule for specific groups of a level
   * Useful when new students are added to a group that didn't have a schedule before
   */
  static async generateGroupSchedules(level: number, groupLetters: string[]): Promise<GeneratedSchedule> {
    try {
      console.log(`🎯 Generating schedules for Level ${level}, Groups: ${groupLetters.join(', ')}`)
      
      // Generate schedule for specific groups
      const schedule = await this.generateLevelSchedule(level, groupLetters)
      
      return schedule
    } catch (error) {
      console.error(`Error generating group schedules for Level ${level}:`, error)
      throw error
    }
  }

  /**
   * Get all occupied time/room slots from ALL other levels
   * This ensures STRICT no-overlap between levels
   */
  private static async getAllOccupiedSlotsFromOtherLevels(
    currentLevel: number
  ): Promise<Array<{room: string, day: string, start: string, level: number, course: string}>> {
    try {
      const { data: schedules, error } = await supabase
        .from('schedule_versions')
        .select('*')
        .neq('level', currentLevel)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error loading other level schedules:', error)
        return []
      }

      if (!schedules || schedules.length === 0) {
        console.log('🔒 No other level schedules found - first schedule being generated')
        return []
      }

      const occupiedSlots: Array<{room: string, day: string, start: string, level: number, course: string}> = []

      // Get the latest schedule for each level
      const latestSchedulesByLevel = new Map<number, any>()
      for (const schedule of schedules) {
        if (!latestSchedulesByLevel.has(schedule.level)) {
          latestSchedulesByLevel.set(schedule.level, schedule)
        }
      }

      // Extract all time/room slots from all groups in all levels
      for (const [levelNum, schedule] of latestSchedulesByLevel.entries()) {
        const groups = (schedule as any).groups || schedule.diff_json?.groups || {}
        
        for (const [groupName, groupData] of Object.entries(groups)) {
          const sections = (groupData as any).sections || []
          
          for (const section of sections) {
            occupiedSlots.push({
              room: section.room,
              day: section.day,
              start: section.start_time,
              level: levelNum,
              course: section.course_code
            })
          }
        }
      }

      console.log(`🔒 Found ${occupiedSlots.length} occupied slots from ${latestSchedulesByLevel.size} other levels`)
      return occupiedSlots
    } catch (error) {
      console.error('Error getting occupied slots:', error)
      return []
    }
  }

}