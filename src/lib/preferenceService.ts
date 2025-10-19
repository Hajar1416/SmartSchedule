import { supabase } from './supabase'

export interface ElectivePreference {
  id: string
  student_id: string
  course_id: string
  priority: number
  semester: string
  status: 'pending' | 'fulfilled' | 'not_fulfilled'
  created_at: string
  course?: {
    id: string
    code: string
    title: string
    level: number
    credits: number
  }
}

export interface PreferenceAnalytics {
  course_id: string
  course_code: string
  course_title: string
  level: number
  student_count: number
  sections_needed: number
  priority_breakdown: {
    priority_1: number
    priority_2: number
    priority_3: number
    priority_4: number
    priority_5: number
  }
}

/**
 * Preference Service
 * Manages student elective preferences
 */
export class PreferenceService {
  /**
   * Submit student preferences
   */
  static async submitPreferences(
    studentId: string,
    preferences: { course_id: string; priority: number }[],
    semester: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete existing preferences for this student and semester
      const { error: deleteError } = await supabase
        .from('elective_choices')
        .delete()
        .eq('student_id', studentId)
        .eq('semester', semester)

      if (deleteError) throw deleteError

      // Insert new preferences
      const preferencesData = preferences.map((pref) => ({
        student_id: studentId,
        course_id: pref.course_id,
        priority: pref.priority,
        semester: semester,
        status: 'pending'
      }))

      const { error: insertError } = await supabase
        .from('elective_choices')
        .insert(preferencesData)

      if (insertError) throw insertError

      return { success: true }
    } catch (error: any) {
      console.error('Error submitting preferences:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get student's submitted preferences
   */
  static async getStudentPreferences(
    studentId: string,
    semester: string
  ): Promise<ElectivePreference[]> {
    const { data, error } = await supabase
      .from('elective_choices')
      .select(`
        *,
        course:courses(id, code, title, level, credits)
      `)
      .eq('student_id', studentId)
      .eq('semester', semester)
      .order('priority', { ascending: true })

    if (error) {
      console.error('Error fetching student preferences:', error)
      return []
    }

    return data || []
  }

  /**
   * Get preference analytics for a specific level
   */
  static async getPreferenceAnalytics(
    level: number,
    semester: string
  ): Promise<PreferenceAnalytics[]> {
    try {
      // Get all elective choices for this level and semester
      const { data: choices, error } = await supabase
        .from('elective_choices')
        .select(`
          *,
          course:courses!inner(id, code, title, level, credits, course_type)
        `)
        .eq('semester', semester)
        .eq('course.level', level)
        .eq('course.course_type', 'elective')

      if (error) throw error

      // Group by course and count
      const courseMap = new Map<string, PreferenceAnalytics>()

      choices?.forEach((choice: any) => {
        const course = choice.course
        const courseId = course.id

        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, {
            course_id: courseId,
            course_code: course.code,
            course_title: course.title,
            level: course.level,
            student_count: 0,
            sections_needed: 0,
            priority_breakdown: {
              priority_1: 0,
              priority_2: 0,
              priority_3: 0,
              priority_4: 0,
              priority_5: 0
            }
          })
        }

        const analytics = courseMap.get(courseId)!
        analytics.student_count++

        // Track priority breakdown
        if (choice.priority === 1) analytics.priority_breakdown.priority_1++
        else if (choice.priority === 2) analytics.priority_breakdown.priority_2++
        else if (choice.priority === 3) analytics.priority_breakdown.priority_3++
        else if (choice.priority === 4) analytics.priority_breakdown.priority_4++
        else if (choice.priority === 5) analytics.priority_breakdown.priority_5++
      })

      // Calculate sections needed (students / 25, rounded up)
      const analytics = Array.from(courseMap.values())
      analytics.forEach((a) => {
        a.sections_needed = Math.ceil(a.student_count / 25)
      })

      // Sort by student count (most popular first)
      analytics.sort((a, b) => b.student_count - a.student_count)

      return analytics
    } catch (error) {
      console.error('Error fetching preference analytics:', error)
      return []
    }
  }

  /**
   * Get preference submission statistics
   */
  static async getSubmissionStats(
    level: number,
    semester: string
  ): Promise<{
    total_students: number
    submitted: number
    pending: number
    percentage: number
  }> {
    try {
      // Get total students in this level
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('level', level)
        .eq('is_irregular', false) // Only regular students

      if (studentsError) throw studentsError

      const totalStudents = students?.length || 0

      // Get unique students who submitted preferences
      const { data: submissions, error: submissionsError } = await supabase
        .from('elective_choices')
        .select('student_id')
        .eq('semester', semester)
        .in(
          'student_id',
          students?.map((s) => s.id) || []
        )

      if (submissionsError) throw submissionsError

      const uniqueStudents = new Set(submissions?.map((s) => s.student_id))
      const submitted = uniqueStudents.size
      const pending = totalStudents - submitted
      const percentage = totalStudents > 0 ? (submitted / totalStudents) * 100 : 0

      return {
        total_students: totalStudents,
        submitted,
        pending,
        percentage: Math.round(percentage)
      }
    } catch (error) {
      console.error('Error fetching submission stats:', error)
      return {
        total_students: 0,
        submitted: 0,
        pending: 0,
        percentage: 0
      }
    }
  }

  /**
   * Check if student has submitted preferences
   */
  static async hasSubmittedPreferences(
    studentId: string,
    semester: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('elective_choices')
      .select('id')
      .eq('student_id', studentId)
      .eq('semester', semester)
      .limit(1)

    if (error) {
      console.error('Error checking preferences:', error)
      return false
    }

    return (data?.length || 0) > 0
  }

  /**
   * Get all elective courses for a level
   */
  static async getElectiveCourses(level: number) {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('level', level)
      .eq('course_type', 'elective')
      .order('title')

    if (error) {
      console.error('Error fetching elective courses:', error)
      return []
    }

    return data || []
  }
}

