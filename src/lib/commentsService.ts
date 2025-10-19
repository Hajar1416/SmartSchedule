import { supabase } from './supabase'

export interface ScheduleComment {
  id: string
  schedule_version_id: string | null
  irregular_schedule_id: string | null
  student_id: string | null
  faculty_id: string | null
  comment_text: string
  comment_type: 'general' | 'issue'
  status: 'pending' | 'reviewed'
  admin_reply: string | null
  created_at: string
  updated_at: string
  student?: {
    full_name: string
    student_number: string
    user?: {
      email: string
      full_name: string | null
    }
  }
  faculty?: {
    full_name: string
    faculty_number: string
    department: string
    user?: {
      email: string
      full_name: string | null
    }
  }
  schedule_version?: {
    level: number
    semester: string
    generated_at: string
  }
}

export interface CreateCommentData {
  schedule_version_id?: string
  irregular_schedule_id?: string
  comment_text: string
  comment_type: 'general' | 'issue'
}

export class CommentsService {
  /**
   * Get all comments and feedback across the system
   */
  static async getAllComments(): Promise<ScheduleComment[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(
            full_name, 
            student_number,
            user:users!students_user_id_fkey(email, full_name)
          ),
          faculty:faculty!schedule_comments_faculty_id_fkey(
            full_name, 
            faculty_number, 
            department,
            user:users!faculty_user_id_fkey(email, full_name)
          ),
          schedule_version:schedule_versions!schedule_comments_schedule_version_id_fkey(level, semester, generated_at)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []) as ScheduleComment[]
    } catch (error: any) {
      console.error('Error fetching all comments:', error)
      throw new Error(`Failed to fetch all comments: ${error.message}`)
    }
  }

  /**
   * Get all comments for a specific schedule version
   */
  static async getCommentsForSchedule(scheduleVersionId: string): Promise<ScheduleComment[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(
            full_name, 
            student_number,
            user:users!students_user_id_fkey(email, full_name)
          ),
          faculty:faculty!schedule_comments_faculty_id_fkey(
            full_name, 
            faculty_number, 
            department,
            user:users!faculty_user_id_fkey(email, full_name)
          )
        `)
        .eq('schedule_version_id', scheduleVersionId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []) as ScheduleComment[]
    } catch (error: any) {
      console.error('Error fetching comments:', error)
      throw new Error(`Failed to fetch comments: ${error.message}`)
    }
  }


  /**
   * Get all comments by a specific student
   */
  static async getCommentsByStudent(studentId: string): Promise<ScheduleComment[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(full_name, student_number),
          faculty:faculty!schedule_comments_faculty_id_fkey(full_name, faculty_number, department)
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []) as ScheduleComment[]
    } catch (error: any) {
      console.error('Error fetching student comments:', error)
      throw new Error(`Failed to fetch student comments: ${error.message}`)
    }
  }

  /**
   * Get all feedback by a specific faculty member
   */
  static async getCommentsByFaculty(facultyId: string): Promise<ScheduleComment[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(full_name, student_number),
          faculty:faculty!schedule_comments_faculty_id_fkey(full_name, faculty_number, department)
        `)
        .eq('faculty_id', facultyId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []) as ScheduleComment[]
    } catch (error: any) {
      console.error('Error fetching faculty comments:', error)
      throw new Error(`Failed to fetch faculty comments: ${error.message}`)
    }
  }

  /**
   * Create a new comment (for students or faculty)
   */
  static async createComment(commentData: CreateCommentData, userId: string, userRole?: string): Promise<ScheduleComment> {
    try {
      console.log('🔍 Creating comment for:', { userId, userRole })
      
      let studentId = null
      let facultyId = null

      // Simplified approach: if userRole is faculty, treat as faculty; otherwise treat as student
      if (userRole === 'faculty') {
        // First, let's check if the user exists in the users table
        console.log('🔍 Checking if user exists in users table...')
        const { data: userCheck, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()
        
        console.log('👤 User table lookup result:', { userCheck, userError })
        
        // Check what's actually in the faculty table
        console.log('🔍 Checking faculty table contents...')
        const { data: allFacultyCheck, error: allFacultyError } = await supabase
          .from('faculty')
          .select('*')
          .limit(10)
        
        console.log('📋 All faculty records:', { allFacultyCheck, allFacultyError })
        
        // For faculty, try to find faculty record, but if not found, create a temporary one
        const { data: faculty, error: facultyError } = await supabase
          .from('faculty')
          .select('id, user_id, full_name, faculty_number')
          .eq('user_id', userId)
          .single()

        console.log('👨‍🏫 Faculty lookup result:', { faculty, facultyError })

        if (!facultyError && faculty) {
          facultyId = faculty.id
          console.log('✅ Found existing faculty record:', faculty)
        } else {
          console.log('⚠️ No faculty record found, but allowing comment anyway...')
          // Don't set facultyId - let it remain null
          // The comment will be created without a faculty_id
        }
      } else {
        // For students or unknown roles, try to find student record
        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (!studentError && student) {
          studentId = student.id
        } else {
          // If no student record exists, create one automatically
          console.log('🔧 Creating student record for user:', userId)
          const { data: newStudent, error: createError } = await supabase
            .from('students')
            .insert({
              user_id: userId,
              student_number: `STU-${userId.slice(-6)}`,
              full_name: 'Student',
              level: 1,
              contact: ''
            })
            .select('id')
            .single()

          if (!createError && newStudent) {
            studentId = newStudent.id
            console.log('✅ Created student record with ID:', studentId)
          }
        }
      }

      console.log('🎯 Final IDs:', { studentId, facultyId })

      // Allow comments even if no specific user record is found
      // The comment will be created with null student_id and faculty_id
      console.log('✅ Proceeding with comment creation...')
      
      const insertData = {
        schedule_version_id: commentData.schedule_version_id || null,
        irregular_schedule_id: commentData.irregular_schedule_id || null,
        student_id: studentId,
        faculty_id: facultyId,
        comment_text: commentData.comment_text,
        comment_type: commentData.comment_type,
        status: 'pending'
      }
      
      console.log('📝 Inserting comment data:', insertData)

      const { data, error } = await supabase
        .from('schedule_comments')
        .insert(insertData)
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(full_name, student_number),
          faculty:faculty!schedule_comments_faculty_id_fkey(full_name, faculty_number, department)
        `)
        .single()

      console.log('💾 Insert result:', { data, error })
      
      if (error) {
        console.error('❌ Database insert error:', error)
        console.error('❌ Error message:', error.message)
        console.error('❌ Error code:', error.code)
        console.error('❌ Error details:', error.details)
        console.error('❌ Error hint:', error.hint)
        throw error
      }

      return data as ScheduleComment
    } catch (error: any) {
      console.error('Error creating comment:', error)
      throw new Error(`Failed to create comment: ${error.message}`)
    }
  }

  /**
   * Update an existing comment
   */
  static async updateComment(
    commentId: string, 
    commentText: string, 
    commentType: 'general' | 'conflict' | 'issue' | 'time_conflict' | 'room_issue'
  ): Promise<ScheduleComment> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .update({
          comment_text: commentText,
          comment_type: commentType
        })
        .eq('id', commentId)
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(full_name, student_number),
          faculty:faculty!schedule_comments_faculty_id_fkey(full_name, faculty_number, department)
        `)
        .single()

      if (error) throw error

      return data as ScheduleComment
    } catch (error: any) {
      console.error('Error updating comment:', error)
      throw new Error(`Failed to update comment: ${error.message}`)
    }
  }

  /**
   * Delete a comment
   */
  static async deleteComment(commentId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('schedule_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error deleting comment:', error)
      throw new Error(`Failed to delete comment: ${error.message}`)
    }
  }


  /**
   * Get comment statistics for a schedule
   */
  static async getCommentStatistics(scheduleVersionId: string): Promise<{
    total: number
    byType: Record<string, number>
    pending: number
    reviewed: number
  }> {
    try {
      const comments = await this.getCommentsForSchedule(scheduleVersionId)

      const stats = {
        total: comments.length,
        byType: {
          general: 0,
          conflict: 0,
          issue: 0,
          time_conflict: 0,
          room_issue: 0
        },
        pending: 0,
        reviewed: 0
      }

      comments.forEach(comment => {
        stats.byType[comment.comment_type]++
        if (comment.status === 'pending') {
          stats.pending++
        } else {
          stats.reviewed++
        }
      })

      return stats
    } catch (error: any) {
      console.error('Error getting comment statistics:', error)
      return {
        total: 0,
        byType: { general: 0, conflict: 0, issue: 0, time_conflict: 0, room_issue: 0 },
        pending: 0,
        reviewed: 0
      }
    }
  }

  /**
   * Get pending comments count for a schedule
   */
  static async getPendingCommentsCount(scheduleVersionId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('schedule_comments')
        .select('*', { count: 'exact', head: true })
        .eq('schedule_version_id', scheduleVersionId)
        .eq('status', 'pending')

      if (error) throw error

      return count || 0
    } catch (error: any) {
      console.error('Error counting pending comments:', error)
      return 0
    }
  }

  /**
   * Reply to a comment (for committee/admin)
   */
  static async replyToComment(commentId: string, reply: string): Promise<ScheduleComment> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .update({
          admin_reply: reply,
          status: 'reviewed',
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(full_name, student_number),
          faculty:faculty!schedule_comments_faculty_id_fkey(full_name, faculty_number, department)
        `)
        .single()

      if (error) throw error

      return data as ScheduleComment
    } catch (error: any) {
      console.error('Error replying to comment:', error)
      throw new Error(`Failed to reply to comment: ${error.message}`)
    }
  }
}

