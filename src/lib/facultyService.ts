import { supabase } from './supabase'

export interface Faculty {
  id: string
  user_id: string
  faculty_number: string
  full_name: string
  department: string
  contact: string
  created_at: string
  updated_at: string
}

export interface FacultyAvailability {
  id: string
  faculty_id: string
  day_of_week: string
  start_time: string
  end_time: string
  is_available: boolean
  notes?: string
}

export interface FacultyPreference {
  id: string
  faculty_id: string
  preference_type: 'time' | 'room' | 'course_load' | 'other'
  preference_value: string
  priority: number
  notes?: string
}

export interface TeachingAssignment {
  id: string
  faculty_id: string
  course_id: string
  section_id: string
  semester: string
  course_code: string
  course_title: string
  level: number
  group_name: string
  day: string
  start_time: string
  end_time: string
  room: string
  student_count: number
}

export class FacultyService {
  /**
   * Ensure a faculty row is linked to the given auth user by email.
   * This links existing faculty where contact=email; it's safe to call on login.
   */
  static async linkFacultyToUser(userId: string, email: string): Promise<boolean> {
    if (!userId || !email) return false;
    const { error } = await supabase
      .from('faculty')
      .update({ user_id: userId })
      .eq('contact', email)
      .is('user_id', null);
    if (error) {
      console.error('Error linking faculty to user:', error);
      return false;
    }
    return true;
  }

  /**
   * Get faculty by user ID
   */
  static async getFacultyByUserId(userId: string): Promise<Faculty | null> {
    const { data, error } = await supabase
      .from('faculty')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // If no row found, data will be null and error undefined with maybeSingle()
    if (error) {
      // Log only unexpected errors
      console.error('Error fetching faculty:', error)
      return null
    }

    return data
  }

  /**
   * Get all faculty members
   */
  static async getAllFaculty(): Promise<Faculty[]> {
    const { data, error } = await supabase
      .from('faculty')
      .select('*')
      .order('full_name')

    if (error) {
      console.error('Error fetching faculty:', error)
      return []
    }

    return data || []
  }

  /**
   * Get faculty by department
   */
  static async getFacultyByDepartment(department: string): Promise<Faculty[]> {
    const { data, error } = await supabase
      .from('faculty')
      .select('*')
      .eq('department', department)
      .order('full_name')

    if (error) {
      console.error('Error fetching faculty by department:', error)
      return []
    }

    return data || []
  }

  /**
   * Get faculty teaching schedule
   */
  static async getTeachingSchedule(facultyId: string, semester?: string): Promise<TeachingAssignment[]> {
    let query = supabase
      .from('course_sections')
      .select(`
        id,
        course_id,
        semester,
        courses!inner (
          code,
          title,
          level
        ),
        schedule_slots!inner (
          day,
          start_time,
          end_time,
          room
        )
      `)
      .eq('instructor_id', facultyId)

    if (semester) {
      query = query.eq('semester', semester)
    }

    const { data, error } = await supabase
      .from('course_sections')
      .select(`
        id,
        course_id,
        section_label,
        semester,
        instructor_id,
        courses (
          code,
          title,
          level
        ),
        schedule_slots (
          day,
          start_time,
          end_time,
          room
        )
      `)
      .eq('instructor_id', facultyId)
      .order('semester', { ascending: false })

    if (error) {
      console.error('Error fetching teaching schedule:', error)
      return []
    }

    // Transform the data
    const assignments: TeachingAssignment[] = []
    
    if (data) {
      for (const section of data as any[]) {
        const courseInfo = Array.isArray(section.courses) ? section.courses[0] : section.courses
        if (section.schedule_slots && Array.isArray(section.schedule_slots)) {
          for (const slot of section.schedule_slots) {
            assignments.push({
              id: section.id,
              faculty_id: facultyId,
              course_id: section.course_id,
              section_id: section.id,
              semester: section.semester,
              course_code: courseInfo?.code || 'N/A',
              course_title: courseInfo?.title || 'N/A',
              level: courseInfo?.level || 0,
              group_name: section.section_label || 'A',
              day: slot.day,
              start_time: slot.start_time,
              end_time: slot.end_time,
              room: slot.room || 'TBD',
              student_count: 0 // Will be calculated separately if needed
            })
          }
        }
      }
    }

    return assignments
  }

  /**
   * Get students enrolled in faculty's courses
   */
  static async getEnrolledStudents(facultyId: string, courseId?: string) {
    let query = supabase
      .from('enrollments')
      .select(`
        *,
        students!inner (
          id,
          student_number,
          full_name,
          level,
          group_name,
          contact
        ),
        course_sections!inner (
          id,
          section_label,
          instructor_id,
          courses (
            code,
            title
          )
        )
      `)
      .eq('course_sections.instructor_id', facultyId)

    if (courseId) {
      query = query.eq('course_sections.course_id', courseId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching enrolled students:', error)
      return []
    }

    return data || []
  }

  /**
   * Get faculty availability
   */
  static async getAvailability(facultyId: string): Promise<FacultyAvailability[]> {
    const { data, error } = await supabase
      .from('faculty_availability')
      .select('*')
      .eq('faculty_id', facultyId)
      .order('day_of_week')
      .order('start_time')

    if (error) {
      console.error('Error fetching availability:', error)
      return []
    }

    return data || []
  }

  /**
   * Set faculty availability
   */
  static async setAvailability(
    facultyId: string,
    availability: Omit<FacultyAvailability, 'id' | 'faculty_id'>[]
  ): Promise<boolean> {
    // Delete existing availability
    const { error: deleteError } = await supabase
      .from('faculty_availability')
      .delete()
      .eq('faculty_id', facultyId)

    if (deleteError) {
      console.error('Error deleting availability:', deleteError)
      return false
    }

    // Insert new availability
    const availabilityRecords = availability.map(a => ({
      ...a,
      faculty_id: facultyId
    }))

    const { error: insertError } = await supabase
      .from('faculty_availability')
      .insert(availabilityRecords)

    if (insertError) {
      console.error('Error inserting availability:', insertError)
      return false
    }

    return true
  }

  /**
   * Get faculty preferences
   */
  static async getPreferences(facultyId: string): Promise<FacultyPreference[]> {
    const { data, error } = await supabase
      .from('faculty_preferences')
      .select('*')
      .eq('faculty_id', facultyId)
      .order('priority', { ascending: false })

    if (error) {
      console.error('Error fetching preferences:', error)
      return []
    }

    return data || []
  }

  /**
   * Save faculty preference
   */
  static async savePreference(
    facultyId: string,
    preference: Omit<FacultyPreference, 'id' | 'faculty_id'>
  ): Promise<boolean> {
    const { error } = await supabase
      .from('faculty_preferences')
      .insert({
        ...preference,
        faculty_id: facultyId
      })

    if (error) {
      console.error('Error saving preference:', error)
      return false
    }

    return true
  }

  /**
   * Delete faculty preference
   */
  static async deletePreference(preferenceId: string): Promise<boolean> {
    const { error } = await supabase
      .from('faculty_preferences')
      .delete()
      .eq('id', preferenceId)

    if (error) {
      console.error('Error deleting preference:', error)
      return false
    }

    return true
  }

  /**
   * Calculate teaching load (total hours per week)
   */
  static calculateTeachingLoad(assignments: TeachingAssignment[]): number {
    let totalHours = 0

    for (const assignment of assignments) {
      const start = new Date(`1970-01-01T${assignment.start_time}`)
      const end = new Date(`1970-01-01T${assignment.end_time}`)
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      totalHours += hours
    }

    return totalHours
  }

  /**
   * Get teaching load statistics
   */
  static async getTeachingLoadStats(facultyId: string, semester?: string) {
    const assignments = await this.getTeachingSchedule(facultyId, semester)
    const totalHours = this.calculateTeachingLoad(assignments)
    const uniqueCourses = new Set(assignments.map(a => a.course_id)).size
    const uniqueDays = new Set(assignments.map(a => a.day)).size

    return {
      totalHours,
      totalCourses: uniqueCourses,
      totalSections: assignments.length,
      daysPerWeek: uniqueDays,
      averageHoursPerDay: uniqueDays > 0 ? totalHours / uniqueDays : 0
    }
  }

  /**
   * Submit schedule feedback
   */
  static async submitFeedback(
    facultyId: string,
    scheduleVersionId: string,
    comment: string,
    requestedChanges?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('schedule_comments')
      .insert({
        schedule_version_id: scheduleVersionId,
        user_id: facultyId,
        comment_text: comment,
        requested_changes: requestedChanges,
        status: 'pending'
      })

    if (error) {
      console.error('Error submitting feedback:', error)
      return false
    }

    return true
  }
}

