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
  Trash2
} from 'lucide-react'
import { CommentsService, ScheduleComment } from '@/lib/commentsService'
import { useAuth } from '@/contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'

interface ScheduleCommentsPanelProps {
  scheduleVersionId: string
  sectionId?: string
}

export function ScheduleCommentsPanel({ scheduleVersionId, sectionId }: ScheduleCommentsPanelProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<ScheduleComment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // New comment form
  const [newCommentText, setNewCommentText] = useState('')
  const [newCommentType, setNewCommentType] = useState<'general' | 'conflict' | 'suggestion' | 'issue'>('general')

  useEffect(() => {
    loadComments()
  }, [scheduleVersionId, sectionId])

  const loadComments = async () => {
    try {
      setLoading(true)
      setError('')

      let loadedComments: ScheduleComment[]
     loadedComments = await CommentsService.getCommentsForSchedule(scheduleVersionId)

      /*
      if (sectionId) {
        loadedComments = await CommentsService.getCommentsForSection(sectionId)
      } else {
        loadedComments = await CommentsService.getCommentsForSchedule(scheduleVersionId)
      }
        */

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

      const newComment = await CommentsService.createComment(
        {
          schedule_version_id: scheduleVersionId,
         // section_id: sectionId,
          comment_text: newCommentText.trim(),
          comment_type: newCommentType
        },
        user.id
      )

      setComments([newComment, ...comments])
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
      case 'conflict':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'issue':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case 'suggestion':
        return <Lightbulb className="h-4 w-4 text-blue-500" />
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />
    }
  }

  const getCommentTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      conflict: 'bg-red-100 text-red-700',
      issue: 'bg-orange-100 text-orange-700',
      suggestion: 'bg-blue-100 text-blue-700',
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
          {sectionId 
            ? 'Comments for this specific course section' 
            : 'View and add comments on this schedule'}
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
                  <SelectItem value="conflict">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Report Conflict
                    </div>
                  </SelectItem>
                  <SelectItem value="issue">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Report Issue
                    </div>
                  </SelectItem>
                  <SelectItem value="suggestion">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Suggestion
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
            {comments.filter(c => !c.is_resolved).length > 0 && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                {comments.filter(c => !c.is_resolved).length} Unresolved
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
                <Card key={comment.id} className={comment.is_resolved ? 'bg-gray-50' : 'bg-white'}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Comment Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getCommentIcon(comment.comment_type)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {comment.student?.full_name || 'Anonymous'}
                              </span>
                              {getCommentTypeBadge(comment.comment_type)}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {comment.is_resolved && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                          {comment.user_id === user?.id && (
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

                      {/* Resolved Info */}
                      {comment.is_resolved && comment.resolved_at && (
                        <div className="text-xs text-gray-500 pt-2 border-t">
                          Resolved {formatDistanceToNow(new Date(comment.resolved_at), { addSuffix: true })}
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

