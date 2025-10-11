import { supabase } from './supabase'

export interface ScheduleComment {
  id: string
  schedule_version_id: string
  section_id: string | null
  user_id: string
  student_id: string
  comment_text: string
  comment_type: 'general' | 'conflict' | 'suggestion' | 'issue'
  is_resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  student?: {
    full_name: string
    student_number: string
  }
  user?: {
    email: string
  }
}

export interface CreateCommentData {
  schedule_version_id: string
  section_id?: string
  comment_text: string
  comment_type: 'general' | 'conflict' | 'suggestion' | 'issue'
}

export class CommentsService {
  /**
   * Get all comments for a specific schedule version
   */
  static async getCommentsForSchedule(scheduleVersionId: string): Promise<ScheduleComment[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(full_name, student_number)
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
   * Get comments for a specific section
   */
  static async getCommentsForSection(sectionId: string): Promise<ScheduleComment[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(full_name, student_number)
        `)
        .eq('section_id', sectionId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []) as ScheduleComment[]
    } catch (error: any) {
      console.error('Error fetching section comments:', error)
      throw new Error(`Failed to fetch section comments: ${error.message}`)
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
          student:students!schedule_comments_student_id_fkey(full_name, student_number)
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
   * Create a new comment (for students)
   */
  static async createComment(commentData: CreateCommentData, userId: string): Promise<ScheduleComment> {
    try {
      // Get student ID from user ID
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (studentError || !student) {
        throw new Error('Student record not found for this user')
      }

      const { data, error } = await supabase
        .from('schedule_comments')
        .insert({
          schedule_version_id: commentData.schedule_version_id,
          section_id: commentData.section_id || null,
          user_id: userId,
          student_id: student.id,
          comment_text: commentData.comment_text,
          comment_type: commentData.comment_type
        })
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(full_name, student_number)
        `)
        .single()

      if (error) throw error

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
    commentType: 'general' | 'conflict' | 'suggestion' | 'issue'
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
          student:students!schedule_comments_student_id_fkey(full_name, student_number)
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
   * Resolve a comment (for committee members)
   */
  static async resolveComment(commentId: string, userId: string): Promise<ScheduleComment> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .update({
          is_resolved: true,
          resolved_by: userId,
          resolved_at: new Date().toISOString()
        })
        .eq('id', commentId)
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(full_name, student_number)
        `)
        .single()

      if (error) throw error

      return data as ScheduleComment
    } catch (error: any) {
      console.error('Error resolving comment:', error)
      throw new Error(`Failed to resolve comment: ${error.message}`)
    }
  }

  /**
   * Unresolve a comment (for committee members)
   */
  static async unresolveComment(commentId: string): Promise<ScheduleComment> {
    try {
      const { data, error } = await supabase
        .from('schedule_comments')
        .update({
          is_resolved: false,
          resolved_by: null,
          resolved_at: null
        })
        .eq('id', commentId)
        .select(`
          *,
          student:students!schedule_comments_student_id_fkey(full_name, student_number)
        `)
        .single()

      if (error) throw error

      return data as ScheduleComment
    } catch (error: any) {
      console.error('Error unresolving comment:', error)
      throw new Error(`Failed to unresolve comment: ${error.message}`)
    }
  }

  /**
   * Get comment statistics for a schedule
   */
  static async getCommentStatistics(scheduleVersionId: string): Promise<{
    total: number
    byType: Record<string, number>
    resolved: number
    unresolved: number
  }> {
    try {
      const comments = await this.getCommentsForSchedule(scheduleVersionId)

      const stats = {
        total: comments.length,
        byType: {
          general: 0,
          conflict: 0,
          suggestion: 0,
          issue: 0
        },
        resolved: 0,
        unresolved: 0
      }

      comments.forEach(comment => {
        stats.byType[comment.comment_type]++
        if (comment.is_resolved) {
          stats.resolved++
        } else {
          stats.unresolved++
        }
      })

      return stats
    } catch (error: any) {
      console.error('Error getting comment statistics:', error)
      return {
        total: 0,
        byType: { general: 0, conflict: 0, suggestion: 0, issue: 0 },
        resolved: 0,
        unresolved: 0
      }
    }
  }

  /**
   * Get unresolved comments count for a schedule
   */
  static async getUnresolvedCommentsCount(scheduleVersionId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('schedule_comments')
        .select('*', { count: 'exact', head: true })
        .eq('schedule_version_id', scheduleVersionId)
        .eq('is_resolved', false)

      if (error) throw error

      return count || 0
    } catch (error: any) {
      console.error('Error counting unresolved comments:', error)
      return 0
    }
  }
}

