'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  MessageSquare, 
  Send, 
  AlertCircle, 
  CheckCircle, 
  Lightbulb,
  AlertTriangle,
  User,
  Calendar,
  Loader2,
  Trash2,
  Clock
} from 'lucide-react'
import { CommentsService, ScheduleComment } from '@/lib/commentsService'
import { useAuth } from '@/contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'

interface ScheduleCommentsPanelProps {
  scheduleVersionId: string
}

export function ScheduleCommentsPanel({ scheduleVersionId }: ScheduleCommentsPanelProps) {
  const { user, userRole } = useAuth()
  const [comments, setComments] = useState<ScheduleComment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // New comment form
  const [newCommentText, setNewCommentText] = useState('')
  const [newCommentType, setNewCommentType] = useState<'general' | 'issue'>('general')

  useEffect(() => {
    loadComments()
  }, [scheduleVersionId])

  const loadComments = async () => {
    try {
      setLoading(true)
      setError('')

      const loadedComments = await CommentsService.getCommentsForSchedule(scheduleVersionId)
      setComments(loadedComments)
    } catch (err: any) {
      setError(`Failed to load comments: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async () => {
    if (!newCommentText.trim() || !user?.id) {
      setError('Please enter a comment')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      // Use API route to create comment (bypasses RLS issues)
      const response = await fetch('/api/comments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userRole: userRole || 'student',
          scheduleVersionId: scheduleVersionId,
          commentText: newCommentText.trim(),
          commentType: newCommentType
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create comment')
      }

      setComments([result.comment, ...comments])
      setNewCommentText('')
      setNewCommentType('general')
      setSuccess('✅ Comment added successfully!')
    } catch (err: any) {
      setError(`Failed to add comment: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return
    }

    try {
      await CommentsService.deleteComment(commentId)
      setComments(comments.filter(c => c.id !== commentId))
      setSuccess('✅ Comment deleted')
    } catch (err: any) {
      setError(`Failed to delete comment: ${err.message}`)
    }
  }

  const getCommentIcon = (type: string) => {
    switch (type) {
      case 'issue':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />
    }
  }

  const getCommentTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      issue: 'bg-orange-100 text-orange-700',
      general: 'bg-gray-100 text-gray-700'
    }

    return (
      <Badge className={variants[type] || variants.general}>
        {type}
      </Badge>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments & Feedback
        </CardTitle>
        <CardDescription>
          View and add comments on this schedule
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {/* New Comment Form */}
        <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold">Add a Comment</h4>
          </div>

          <div className="space-y-3">
            <div>
              <Select value={newCommentType} onValueChange={(value: any) => setNewCommentType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      General Comment
                    </div>
                  </SelectItem>
                  <SelectItem value="issue">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Report Issue
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Enter your comment, feedback, or report an issue..."
              rows={4}
              disabled={submitting}
            />

            <Button 
              onClick={handleSubmitComment} 
              disabled={submitting || !newCommentText.trim()}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Post Comment
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-gray-700">
              {comments.length} Comment{comments.length !== 1 ? 's' : ''}
            </h4>
            {comments.filter(c => c.status === 'pending').length > 0 && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                {comments.filter(c => c.status === 'pending').length} Pending
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2">Loading comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No comments yet</p>
              <p className="text-sm">Be the first to add a comment!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <Card key={comment.id} className={comment.status === 'reviewed' ? 'bg-gray-50' : 'bg-white'}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Comment Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getCommentIcon(comment.comment_type)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {comment.student_id 
                                  ? (comment.student?.user?.full_name || 
                                     comment.student?.full_name || 
                                     comment.student?.user?.email || 
                                     comment.student?.student_number || 
                                     'Student')
                                  : (comment.faculty?.user?.full_name || 
                                     comment.faculty?.full_name || 
                                     comment.faculty?.user?.email || 
                                     comment.faculty?.faculty_number || 
                                     'Faculty')}
                              </span>
                              {getCommentTypeBadge(comment.comment_type)}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              {comment.student_id && (comment.student?.student_number || comment.student?.user?.email) && (
                                <span className="text-gray-400">
                                  • {comment.student?.student_number ? `#${comment.student.student_number}` : comment.student?.user?.email}
                                </span>
                              )}
                              {comment.faculty_id && (comment.faculty?.faculty_number || comment.faculty?.user?.email) && (
                                <span className="text-gray-400">
                                  • {comment.faculty?.faculty_number ? `#${comment.faculty.faculty_number}` : comment.faculty?.user?.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {comment.status === 'reviewed' && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Reviewed
                            </Badge>
                          )}
                          {((comment.student_id && comment.student?.user?.email === user?.email) || 
                            (comment.faculty_id && comment.faculty?.user?.email === user?.email)) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Comment Text */}
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {comment.comment_text}
                      </p>

                      {/* Admin Reply */}
                      {comment.admin_reply && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
                          <p className="text-sm font-semibold text-blue-900 mb-1">Admin Reply:</p>
                          <p className="text-sm text-blue-800 whitespace-pre-wrap">
                            {comment.admin_reply}
                          </p>
                          <p className="text-xs text-blue-600 mt-2">
                            Replied {formatDistanceToNow(new Date(comment.updated_at), { addSuffix: true })}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <Alert>
          <MessageSquare className="h-4 w-4" />
          <AlertDescription>
            <strong>Note:</strong> Use comments to report conflicts, suggest improvements, or ask questions. 
            The scheduling committee will review and respond to your feedback.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

