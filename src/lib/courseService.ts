import { supabase } from './supabase'
import { Course } from './supabase'

export interface CreateCourseData {
  code: string
  title: string
  level: number
  is_fixed: boolean
  duration_hours: number
  allowable_rooms: string[]
  course_type?: 'compulsory' | 'elective'
  credits?: number
  prerequisites?: string[]
  offered_semesters?: string[]
  department?: string
}

export interface UpdateCourseData extends Partial<CreateCourseData> {
  id: string
}

export class CourseService {
  static async getAllCourses(): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('level', { ascending: true })
      .order('code', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async getCourseById(id: string): Promise<Course | null> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async createCourse(courseData: CreateCourseData): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .insert(courseData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateCourse(courseData: UpdateCourseData): Promise<Course> {
    const { id, ...updateData } = courseData
    const { data, error } = await supabase
      .from('courses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async deleteCourse(id: string): Promise<void> {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  static async getCoursesByLevel(level: number): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('level', level)
      .order('code', { ascending: true })

    if (error) throw error
    return data || []
  }

  // ========================================
  // ELECTIVE/COMPULSORY SPECIFIC METHODS
  // ========================================

  static async getCoursesByCategory(category: 'compulsory' | 'elective'): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('course_type', category)
      .order('level', { ascending: true })
      .order('code', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async getElectivesByLevel(level: number): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('level', level)
      .eq('course_type', 'elective')
      .order('code', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async getElectivesForIrregularStudent(level: number): Promise<Course[]> {
    // Irregular students can take electives from their level AND lower levels
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('course_type', 'elective')
      .lte('level', level) // level <= student's level (includes lower levels)
      .order('level', { ascending: false }) // Show higher levels first
      .order('code', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async getElectivesForSpecificLevels(levels: number[]): Promise<Course[]> {
    // Get electives from specific levels only
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('course_type', 'elective')
      .in('level', levels) // Only include specified levels
      .order('level', { ascending: true }) // Show levels in order
      .order('code', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async getCompulsoryCoursesByLevel(level: number): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('level', level)
      .eq('course_type', 'compulsory')
      .order('code', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async getCourseStatistics() {
    const { data, error } = await supabase
      .from('course_statistics')
      .select('*')

    if (error) throw error
    return data || []
  }

  static async validateElectiveSelection(studentId: string, courseId: string) {
    const { data, error } = await supabase
      .rpc('validate_elective_selection', {
        p_student_id: studentId,
        p_course_id: courseId
      })

    if (error) throw error
    return data?.[0] || { is_valid: false, error_message: 'Validation failed' }
  }

  static async getAvailableElectivesForStudent(studentLevel: number) {
    const { data, error } = await supabase
      .rpc('get_available_electives_for_student', {
        student_level: studentLevel
      })

    if (error) throw error
    return data || []
  }
}
