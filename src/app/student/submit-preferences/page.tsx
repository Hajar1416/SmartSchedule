'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { SystemSettingsService } from '@/lib/systemSettingsService'
import { PreferenceService } from '@/lib/preferenceService'
import { supabase } from '@/lib/supabase'

interface Course {
  id: string
  code: string
  title: string
  credits: number
  category?: string
}

interface SelectedPreference {
  course_id: string
  priority: number
}

export default function SubmitPreferencesPage() {
  const { user, userRole, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [student, setStudent] = useState<any>(null)
  const [electiveCourses, setElectiveCourses] = useState<Course[]>([])
  const [selectedPreferences, setSelectedPreferences] = useState<SelectedPreference[]>([])
  const [existingPreferences, setExistingPreferences] = useState<any[]>([])
  
  const [preferenceOpen, setPreferenceOpen] = useState(false)
  const [deadline, setDeadline] = useState<string>('')
  const [semester, setSemester] = useState<string>('Fall 2025')

  useEffect(() => {
    if (!authLoading && userRole) {
      if (!user || userRole !== 'student') {
        router.push('/login')
      } else {
        loadData()
      }
    }
  }, [user, userRole, authLoading, router])

  const loadData = async () => {
    setLoading(true)
    try {
      // Get student info
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user?.id)
        .single()

      if (studentError) throw studentError
      setStudent(studentData)

      // Check if preference collection is open
      const isOpen = await SystemSettingsService.isPreferenceCollectionOpen()
      setPreferenceOpen(isOpen)

      // Get deadline
      const deadlineDate = await SystemSettingsService.getPreferenceDeadline()
      setDeadline(deadlineDate || '')

      // Get current semester
      const currentSemester = await SystemSettingsService.getCurrentSemester()
      setSemester(currentSemester)

      // Get elective courses for student's level
      const courses = await PreferenceService.getElectiveCourses(studentData.level)
      setElectiveCourses(courses)

      // Get existing preferences
      const existing = await PreferenceService.getStudentPreferences(studentData.id, currentSemester)
      setExistingPreferences(existing)

      // Pre-populate selections if existing
      if (existing.length > 0) {
        setSelectedPreferences(
          existing.map((e: any) => ({
            course_id: e.course_id,
            priority: e.priority
          }))
        )
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCourseSelect = (courseId: string, priority: number) => {
    // Remove if already selected
    const filtered = selectedPreferences.filter((p) => p.course_id !== courseId)

    // Add with new priority
    setSelectedPreferences([...filtered, { course_id: courseId, priority }])
  }

  const handleCourseRemove = (courseId: string) => {
    setSelectedPreferences(selectedPreferences.filter((p) => p.course_id !== courseId))
  }

  const getPriorityForCourse = (courseId: string): number | null => {
    const pref = selectedPreferences.find((p) => p.course_id === courseId)
    return pref ? pref.priority : null
  }

  const handleSubmit = async () => {
    if (selectedPreferences.length === 0) {
      alert('Please select at least one elective course')
      return
    }

    // Check for duplicate priorities
    const priorities = selectedPreferences.map((p) => p.priority)
    const uniquePriorities = new Set(priorities)
    if (priorities.length !== uniquePriorities.size) {
      alert('Each preference must have a unique priority (1st choice, 2nd choice, etc.)')
      return
    }

    setSubmitting(true)
    try {
      const result = await PreferenceService.submitPreferences(
        student.id,
        selectedPreferences,
        semester
      )

      if (result.success) {
        alert('✅ Your preferences have been submitted successfully!')
        await loadData() // Reload to show updated data
      } else {
        alert(`❌ Failed to submit preferences: ${result.error}`)
      }
    } catch (error) {
      console.error('Error submitting preferences:', error)
      alert('❌ An error occurred while submitting preferences')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading preferences...</p>
        </div>
      </div>
    )
  }

  if (!preferenceOpen) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-2xl mx-auto border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Preference Collection Closed</CardTitle>
            <CardDescription>
              The preference submission period is currently closed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              You can only submit your elective preferences when the scheduling committee opens the
              preference collection period.
            </p>
            {existingPreferences.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="font-semibold mb-2">Your Previously Submitted Preferences:</p>
                <ul className="space-y-2">
                  {existingPreferences.map((pref: any) => (
                    <li key={pref.id} className="flex items-center justify-between">
                      <span>
                        {pref.priority}. {pref.course?.title}
                      </span>
                      <Badge
                        variant={
                          pref.status === 'fulfilled'
                            ? 'default'
                            : pref.status === 'not_fulfilled'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {pref.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Submit Elective Preferences</h1>
          <p className="text-gray-600">
            Select your preferred elective courses for <strong>{semester}</strong>
          </p>
          {deadline && (
            <p className="text-sm text-red-600 mt-2">
              ⚠️ Deadline: {new Date(deadline).toLocaleDateString()}
            </p>
          )}
        </div>

        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>✅ Select elective courses you want to take this semester</p>
            <p>✅ Assign priorities (1st choice = highest priority)</p>
            <p>
              ✅ The system will generate schedules based on ALL student preferences
            </p>
            <p>⚠️ Higher priority preferences are more likely to be fulfilled</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Available Electives (Level {student?.level})</CardTitle>
            <CardDescription>
              {electiveCourses.length} elective courses available
            </CardDescription>
          </CardHeader>
          <CardContent>
            {electiveCourses.length === 0 ? (
              <p className="text-gray-500">No elective courses available for your level</p>
            ) : (
              <div className="space-y-3">
                {electiveCourses.map((course) => {
                  const priority = getPriorityForCourse(course.id)
                  return (
                    <div
                      key={course.id}
                      className={`border rounded-lg p-4 ${
                        priority ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold">{course.title}</h3>
                            {course.category && (
                              <Badge variant="outline">{course.category}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {course.code} • {course.credits} credits
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {priority ? (
                            <>
                              <Badge variant="default">Priority {priority}</Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCourseRemove(course.id)}
                              >
                                Remove
                              </Button>
                            </>
                          ) : (
                            <select
                              className="border rounded px-3 py-1 text-sm"
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleCourseSelect(course.id, parseInt(e.target.value))
                                }
                              }}
                              value=""
                            >
                              <option value="">Select Priority</option>
                              <option value="1">1st Choice</option>
                              <option value="2">2nd Choice</option>
                              <option value="3">3rd Choice</option>
                              <option value="4">4th Choice</option>
                              <option value="5">5th Choice</option>
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedPreferences.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Your Selected Preferences</CardTitle>
              <CardDescription>
                {selectedPreferences.length} course(s) selected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedPreferences
                  .sort((a, b) => a.priority - b.priority)
                  .map((pref) => {
                    const course = electiveCourses.find((c) => c.id === pref.course_id)
                    return (
                      <div key={pref.course_id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span>
                          <strong>Priority {pref.priority}:</strong> {course?.title}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCourseRemove(pref.course_id)}
                        >
                          ✕
                        </Button>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={loadData} disabled={submitting}>
            Reset
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedPreferences.length === 0}
          >
            {submitting ? 'Submitting...' : 'Submit Preferences'}
          </Button>
        </div>
      </div>
    </div>
  )
}

