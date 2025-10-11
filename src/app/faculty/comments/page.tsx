'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SystemSettingsService } from '@/lib/systemSettingsService'

export default function FacultyCommentsPage() {
  const { user, userRole, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [faculty, setFaculty] = useState<any>(null)
  const [semester, setSemester] = useState<string>('Fall 2025')
  const [comments, setComments] = useState<any[]>([])
  const [replyText, setReplyText] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!authLoading && userRole) {
      if (!user || userRole !== 'faculty') {
        router.push('/login')
      } else {
        loadData()
      }
    }
  }, [user, userRole, authLoading, router])

  const loadData = async () => {
    setLoading(true)
    try {
      // Get faculty info
      const { data: facultyData, error: facultyError } = await supabase
        .from('faculty')
        .select('*')
        .eq('user_id', user?.id)
        .single()

      if (facultyError) throw facultyError
      setFaculty(facultyData)

      // Get current semester
      const currentSemester = await SystemSettingsService.getCurrentSemester()
      setSemester(currentSemester)

      // Get comments related to faculty's courses
      const { data: commentsData, error: commentsError } = await supabase
        .from('schedule_comments')
        .select(`
          *,
          student:students(full_name, student_number),
          schedule_version:schedule_versions(level, semester)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (commentsError) throw commentsError

      setComments(commentsData || [])

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async (commentId: string) => {
    try {
      const reply = replyText[commentId]
      if (!reply || !reply.trim()) {
        alert('Please enter a reply')
        return
      }

      const { error } = await supabase
        .from('schedule_comments')
        .update({
          admin_reply: reply,
          status: 'reviewed',
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)

      if (error) throw error

      alert('✅ Reply sent successfully!')
      setReplyText({ ...replyText, [commentId]: '' })
      await loadData()
    } catch (error) {
      console.error('Error sending reply:', error)
      alert('❌ Failed to send reply')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading comments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Student Comments</h1>

        {comments.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Comments</CardTitle>
              <CardDescription>There are no pending student comments</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <Card key={comment.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {comment.student?.full_name || 'Anonymous'}
                      </CardTitle>
                      <CardDescription>
                        {comment.student?.student_number} • Level {comment.schedule_version?.level}
                      </CardDescription>
                    </div>
                    <Badge variant={
                      comment.comment_type === 'time_conflict' ? 'destructive' :
                      comment.comment_type === 'room_issue' ? 'default' :
                      'secondary'
                    }>
                      {comment.comment_type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 rounded p-4">
                    <p className="text-sm text-gray-700">{comment.comment_text}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(comment.created_at).toLocaleString()}
                    </p>
                  </div>

                  {comment.admin_reply && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-4">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Admin Reply:</p>
                      <p className="text-sm text-blue-800">{comment.admin_reply}</p>
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
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleReply(comment.id)}
                          size="sm"
                        >
                          Send Reply
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
    </div>
  )
}

