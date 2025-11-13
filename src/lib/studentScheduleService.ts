import { supabase } from './supabase'

export interface StudentScheduleEntry {
  course_code: string
  course_title: string
  section_label: string
  day: string
  start_time: string
  end_time: string
  room: string
  instructor: string
  is_elective: boolean
  credits: number
}

export class StudentScheduleService {
  /**
   * Get personalized schedule for a student
   * Includes: Compulsory courses for their group + their selected electives
   */
  static async getStudentSchedule(userId: string): Promise<{
    schedule: StudentScheduleEntry[]
    student: any
    totalCredits: number
    scheduleVersionId: string | null
  }> {
    try {
      // Get student info (level, group)
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, full_name, student_number, level, student_group, user_id')
        .eq('user_id', userId)
        .single()

      if (studentError || !student) {
        throw new Error('Student not found')
      }

      console.log(`📚 Loading schedule for ${student.full_name} (Level ${student.level}, Group ${student.student_group})`)

      // Get the latest schedule for this level (new schema)
      const { data: scheduleVersion, error: scheduleError } = await supabase
        .from('schedule_versions')
        .select('id, level, semester, groups, created_at, generated_at')
        .eq('level', student.level)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (scheduleError || !scheduleVersion) {
        console.log('No schedule found for this level')
        return {
          schedule: [],
          student,
          totalCredits: 0,
          scheduleVersionId: null
        }
      }

      const scheduleVersionId = scheduleVersion.id

      const schedule: StudentScheduleEntry[] = []

      // Extract compulsory courses for student's group
      const groupKey = `Group ${student.student_group}`
      const groupSchedule = (scheduleVersion as any).groups?.[groupKey]

      if (groupSchedule && groupSchedule.sections) {
        console.log(`✅ Found ${groupSchedule.sections.length} compulsory courses for ${groupKey}`)
        
        for (const section of groupSchedule.sections) {
          // Get course details
          const { data: course } = await supabase
            .from('courses')
            .select('code, title, credits, course_type')
            .eq('code', section.course_code)
            .single()

          if (course && course.course_type === 'compulsory') {
            schedule.push({
              course_code: section.course_code,
              course_title: course.title || section.course_title || section.course_code,
              section_label: section.section_label || student.student_group,
              day: section.day,
              start_time: section.start_time,
              end_time: section.end_time,
              room: section.room,
              instructor: section.instructor || 'TBA',
              is_elective: false,
              credits: course.credits || 3
            })
          }
        }
      }

      // Get student's selected electives
      const { data: electiveChoices, error: electivesError } = await supabase
        .from('elective_choices')
        .select('course_id, priority')
        .eq('student_id', student.id)
        .order('priority')

      if (!electivesError && electiveChoices && electiveChoices.length > 0) {
        console.log(`✅ Found ${electiveChoices.length} elective choices`)

        // For each selected elective, find it in the schedule
        for (const choice of electiveChoices) {
          const { data: course } = await supabase
            .from('courses')
            .select('code, title, credits')
            .eq('id', choice.course_id)
            .single()

          if (course) {
            // Find this elective in the group schedule or any group schedule
            let electiveSection = null

            // Check all groups for this elective course
            const groups = (scheduleVersion as any).groups
            if (groups) {
              for (const [gKey, gData] of Object.entries(groups as any)) {
                const section = (gData as any).sections?.find((s: any) => s.course_code === course.code)
                if (section) {
                  electiveSection = section
                  break
                }
              }
            }

            if (electiveSection) {
              schedule.push({
                course_code: course.code,
                course_title: course.title,
                section_label: student.student_group,
                day: electiveSection.day,
                start_time: electiveSection.start_time,
                end_time: electiveSection.end_time,
                room: electiveSection.room,
                instructor: electiveSection.instructor || 'TBA',
                is_elective: true,
                credits: course.credits || 3
              })
            }
          }
        }
      }

      const totalCredits = schedule.reduce((sum, entry) => sum + entry.credits, 0)

      console.log(`✅ Total schedule: ${schedule.length} courses, ${totalCredits} credits`)

      return {
        schedule,
        student,
        totalCredits,
        scheduleVersionId
      }

    } catch (error) {
      console.error('Error loading student schedule:', error)
      throw error
    }
  }

  /**
   * Check for schedule conflicts
   */
  static detectConflicts(schedule: StudentScheduleEntry[]): string[] {
    const conflicts: string[] = []
    const timeSlots = new Map<string, StudentScheduleEntry>()

    for (const entry of schedule) {
      const key = `${entry.day}-${entry.start_time}`
      if (timeSlots.has(key)) {
        const existing = timeSlots.get(key)!
        conflicts.push(
          `Time conflict: ${entry.course_code} and ${existing.course_code} both scheduled on ${entry.day} at ${entry.start_time}`
        )
      } else {
        timeSlots.set(key, entry)
      }
    }

    return conflicts
  }
}

