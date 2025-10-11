import { supabase } from './supabase'

export interface IrregularCourseRequirement {
  course_id: string
  original_level: number
  failed_semester?: string
  reason: string
}

export interface IrregularStudent {
  id: string
  user_id?: string
  student_number: string
  full_name: string
  level: number
  student_group: null
  is_irregular: true
  contact?: string
  requirements: IrregularCourseRequirement[]
}

/**
 * Irregular Student Service
 * Manages students with failed/missing courses from previous levels
 */
export class IrregularStudentService {
  /**
   * Create an irregular student with authentication
   */
  static async createIrregularStudent(
    studentData: {
      student_number: string
      full_name: string
      level: number
      contact?: string
    },
    requirements: IrregularCourseRequirement[]
  ): Promise<{ success: boolean; studentId?: string; error?: string; credentials?: { email: string; password: string } }> {
    try {
      const response = await fetch('/api/admin/create-irregular-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentData,
          requirements
        })
      })

      const result = await response.json()

      if (!response.ok) {
        return { success: false, error: result.error }
      }

      return result
    } catch (error: any) {
      console.error('Error creating irregular student:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get all irregular students for a specific level
   */
  static async getIrregularStudentsByLevel(level: number): Promise<IrregularStudent[]> {
    try {
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('level', level)
        .eq('is_irregular', true)

      if (studentsError) throw studentsError

      // Get requirements for each student
      const studentsWithRequirements = await Promise.all(
        students.map(async (student) => {
          const { data: requirements } = await supabase
            .from('irregular_course_requirements')
            .select(`
              *,
              course:courses(id, code, title, level)
            `)
            .eq('student_id', student.id)

          return {
            ...student,
            requirements: requirements || []
          }
        })
      )

      return studentsWithRequirements as IrregularStudent[]
    } catch (error) {
      console.error('Error fetching irregular students:', error)
      return []
    }
  }

  /**
   * Get irregular student by ID
   */
  static async getIrregularStudent(studentId: string): Promise<IrregularStudent | null> {
    try {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .eq('is_irregular', true)
        .single()

      if (studentError) throw studentError

      const { data: requirements, error: reqError } = await supabase
        .from('irregular_course_requirements')
        .select(`
          *,
          course:courses(id, code, title, level, credits)
        `)
        .eq('student_id', studentId)

      if (reqError) throw reqError

      return {
        ...student,
        requirements: requirements || []
      } as IrregularStudent
    } catch (error) {
      console.error('Error fetching irregular student:', error)
      return null
    }
  }

  /**
   * Update irregular student requirements
   */
  static async updateRequirements(
    studentId: string,
    requirements: IrregularCourseRequirement[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete existing requirements
      const { error: deleteError } = await supabase
        .from('irregular_course_requirements')
        .delete()
        .eq('student_id', studentId)

      if (deleteError) throw deleteError

      // Insert new requirements
      const requirementsData = requirements.map((req) => ({
        student_id: studentId,
        course_id: req.course_id,
        original_level: req.original_level,
        failed_semester: req.failed_semester,
        reason: req.reason
      }))

      const { error: insertError } = await supabase
        .from('irregular_course_requirements')
        .insert(requirementsData)

      if (insertError) throw insertError

      return { success: true }
    } catch (error: any) {
      console.error('Error updating requirements:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get count of irregular students per level
   */
  static async getIrregularStudentCount(level: number): Promise<number> {
    const { data, error } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('level', level)
      .eq('is_irregular', true)

    if (error) {
      console.error('Error counting irregular students:', error)
      return 0
    }

    return data?.length || 0
  }

  /**
   * Get all courses from a specific level (for selection)
   */
  static async getCoursesByLevel(level: number) {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('level', level)
      .order('code')

    if (error) {
      console.error('Error fetching courses:', error)
      return []
    }

    return data || []
  }
}

