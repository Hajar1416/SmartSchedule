'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { CommentsService, ScheduleComment } from '@/lib/commentsService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  MessageSquare,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  GraduationCap,
  BookOpen,
  Search,
  Filter,
  Reply,
  Calendar,
  Eye
} from 'lucide-react'

type FilterType = 'all' | 'students' | 'faculty' | 'pending' | 'reviewed'
type CommentType = 'all' | 'general' | 'issue'

export default function CommitteeCommentsFeedbackPage() {
  const { user, userRole, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<ScheduleComment[]>([])
  const [filteredComments, setFilteredComments] = useState<ScheduleComment[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [commentTypeFilter, setCommentTypeFilter] = useState<CommentType>('all')
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replying, setReplying] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!authLoading && userRole) {
      if (!user || !['admin', 'scheduling_committee'].includes(userRole)) {
        router.push('/login')
      } else {
        loadComments()
      }
    }
  }, [user, userRole, authLoading, router])

  useEffect(() => {
    filterComments()
  }, [comments, searchTerm, filterType, commentTypeFilter])

  const loadComments = async () => {
    setLoading(true)
    try {
      const allComments = await CommentsService.getAllComments()
      setComments(allComments)
    } catch (error: any) {
      console.error('Error loading comments:', error)
      setError('Failed to load comments: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const filterComments = () => {
    let filtered = [...comments]

    // Filter by type (student/faculty)
    if (filterType === 'students') {
      filtered = filtered.filter(comment => comment.student_id && !comment.faculty_id)
    } else if (filterType === 'faculty') {
      filtered = filtered.filter(comment => comment.faculty_id && !comment.student_id)
    } else if (filterType === 'pending') {
      filtered = filtered.filter(comment => comment.status === 'pending')
    } else if (filterType === 'reviewed') {
      filtered = filtered.filter(comment => comment.status === 'reviewed')
    }

    // Filter by comment type
    if (commentTypeFilter !== 'all') {
      filtered = filtered.filter(comment => comment.comment_type === commentTypeFilter)
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(comment => {
        const studentName = comment.student?.full_name?.toLowerCase() || ''
        const facultyName = comment.faculty?.full_name?.toLowerCase() || ''
        const commentText = comment.comment_text?.toLowerCase() || ''
        return studentName.includes(searchLower) || 
               facultyName.includes(searchLower) || 
               commentText.includes(searchLower)
      })
    }

    setFilteredComments(filtered)
  }

  const handleReply = async (commentId: string) => {
    const reply = replyText[commentId]
    if (!reply || !reply.trim()) {
      setError('Please enter a reply')
      return
    }

    try {
      setReplying({ ...replying, [commentId]: true })
      setError('')
      setSuccess('')

      await CommentsService.replyToComment(commentId, reply.trim())
      
      setReplyText({ ...replyText, [commentId]: '' })
      setSuccess('✅ Reply sent successfully!')
      await loadComments()
    } catch (error: any) {
      console.error('Error sending reply:', error)
      setError('❌ Failed to send reply: ' + error.message)
    } finally {
      setReplying({ ...replying, [commentId]: false })
    }
  }

  const getCommentTypeColor = (type: string) => {
    switch (type) {
      case 'issue':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    return status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading comments and feedback...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comments & Feedback</h1>
          <p className="text-gray-600">
            View and respond to student comments and faculty feedback
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or comment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter by type */}
              <Select value={filterType} onValueChange={(value: FilterType) => setFilterType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="students">Students Only</SelectItem>
                  <SelectItem value="faculty">Faculty Only</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                </SelectContent>
              </Select>

              {/* Filter by comment type */}
              <Select value={commentTypeFilter} onValueChange={(value: CommentType) => setCommentTypeFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by comment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="issue">Issue</SelectItem>
                </SelectContent>
              </Select>

              {/* Stats */}
              <div className="flex items-center justify-center">
                <Badge variant="outline">
                  {filteredComments.length} of {comments.length} comments
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments List */}
        {filteredComments.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Comments Found</CardTitle>
              <CardDescription>
                {searchTerm || filterType !== 'all' || commentTypeFilter !== 'all'
                  ? 'No comments match your current filters'
                  : 'There are no comments or feedback yet'}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredComments.map((comment) => (
              <Card key={comment.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {comment.student_id ? (
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-5 w-5 text-blue-600" />
                          <div>
                            <CardTitle className="text-lg">
                              {comment.student?.full_name || 'Anonymous Student'}
                            </CardTitle>
                            <CardDescription>
                              Student #{comment.student?.student_number}
                            </CardDescription>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-green-600" />
                          <div>
                            <CardTitle className="text-lg">
                              {comment.faculty?.user?.full_name || 
                               comment.faculty?.full_name || 
                               comment.faculty?.user?.email || 
                               comment.faculty?.faculty_number || 
                               'Faculty'}
                            </CardTitle>
                            <CardDescription>
                              {comment.faculty?.department && `${comment.faculty.department} • `}
                              {comment.faculty?.user?.email || `#${comment.faculty?.faculty_number}`}
                            </CardDescription>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getCommentTypeColor(comment.comment_type)}>
                        {comment.comment_type.replace('_', ' ')}
                      </Badge>
                      <Badge className={getStatusColor(comment.status)}>
                        {comment.status}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Schedule Information */}
                  {comment.schedule_version && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {/* Only show level for student comments */}
                              {comment.student_id && `Level ${comment.schedule_version.level} • `}
                              {comment.schedule_version.semester}
                            </p>
                            <p className="text-xs text-gray-500">
                              Generated {new Date(comment.schedule_version.generated_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {comment.schedule_version_id && comment.student_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/committee/edit?level=${comment.schedule_version?.level}`, '_blank')}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View Schedule
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 rounded p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {comment.comment_text}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(comment.created_at).toLocaleString()}
                    </p>
                  </div>

                  {comment.admin_reply && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-4">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Admin Reply:</p>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">
                        {comment.admin_reply}
                      </p>
                    </div>
                  )}

                  {comment.status === 'pending' && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Write your reply..."
                        value={replyText[comment.id] || ''}
                        onChange={(e) =>
                          setReplyText({ ...replyText, [comment.id]: e.target.value })
                        }
                        rows={3}
                        disabled={replying[comment.id]}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleReply(comment.id)}
                          disabled={replying[comment.id] || !replyText[comment.id]?.trim()}
                          size="sm"
                        >
                          {replying[comment.id] ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Sending...
                            </>
                          ) : (
                            <>
                              <Reply className="mr-2 h-4 w-4" />
                              Send Reply
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
  )
}
