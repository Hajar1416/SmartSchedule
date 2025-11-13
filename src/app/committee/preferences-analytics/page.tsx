'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { SystemSettingsService } from '@/lib/systemSettingsService'
import { PreferenceService, PreferenceAnalytics } from '@/lib/preferenceService'

export default function PreferencesAnalyticsPage() {
  const { user, userRole, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [semester, setSemester] = useState<string>('Fall 2025')
  const [selectedLevel, setSelectedLevel] = useState<number>(1)
  
  const [analytics, setAnalytics] = useState<PreferenceAnalytics[]>([])
  const [stats, setStats] = useState({
    total_students: 0,
    submitted: 0,
    pending: 0,
    percentage: 0
  })

  useEffect(() => {
    if (!authLoading && userRole) {
      if (!user || (userRole !== 'scheduling_committee' && userRole !== 'admin')) {
        router.push('/login')
      } else {
        loadData()
      }
    }
  }, [user, userRole, authLoading, router])

  useEffect(() => {
    if (!authLoading && user) {
      loadAnalytics()
    }
  }, [selectedLevel, semester, user, authLoading])

  const loadData = async () => {
    setLoading(true)
    try {
      const currentSemester = await SystemSettingsService.getCurrentSemester()
      setSemester(currentSemester)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      const analyticsData = await PreferenceService.getPreferenceAnalytics(selectedLevel, semester)
      setAnalytics(analyticsData)

      const statsData = await PreferenceService.getSubmissionStats(selectedLevel, semester)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading analytics:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Preference Analytics</h1>
        <p className="text-gray-600">
          View student elective preferences for <strong>{semester}</strong>
        </p>
      </div>

      {/* Level Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((level) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  selectedLevel === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Level {level}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submission Statistics */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Submission Statistics - Level {selectedLevel}</CardTitle>
          <CardDescription>
            Track how many students have submitted their preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{stats.total_students}</div>
              <div className="text-sm text-gray-600">Total Students</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{stats.submitted}</div>
              <div className="text-sm text-gray-600">Submitted</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{stats.percentage}%</div>
              <div className="text-sm text-gray-600">Completion</div>
            </div>
          </div>
          <Progress value={stats.percentage} className="h-3" />
        </CardContent>
      </Card>

      {/* Course Demand Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Elective Course Demand</CardTitle>
          <CardDescription>
            How many students want each elective course
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No preference data available for Level {selectedLevel}
            </p>
          ) : (
            <div className="space-y-4">
              {analytics.map((course, index) => (
                <div key={course.course_id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <h3 className="font-semibold text-lg">{course.course_title}</h3>
                      </div>
                      <p className="text-sm text-gray-600">{course.course_code}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {course.student_count}
                      </div>
                      <div className="text-sm text-gray-600">students</div>
                    </div>
                  </div>

                  {/* Sections Needed */}
                  <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                    <p className="text-sm font-semibold text-green-800">
                      📊 Sections Needed: {course.sections_needed} sections
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      (Based on {course.student_count} students ÷ 25 per section)
                    </p>
                  </div>

                  {/* Priority Breakdown */}
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-sm font-semibold mb-2">Priority Breakdown:</p>
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">
                          {course.priority_breakdown.priority_1}
                        </div>
                        <div className="text-gray-600">1st</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-blue-500">
                          {course.priority_breakdown.priority_2}
                        </div>
                        <div className="text-gray-600">2nd</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-blue-400">
                          {course.priority_breakdown.priority_3}
                        </div>
                        <div className="text-gray-600">3rd</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-blue-300">
                          {course.priority_breakdown.priority_4}
                        </div>
                        <div className="text-gray-600">4th</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-blue-200">
                          {course.priority_breakdown.priority_5}
                        </div>
                        <div className="text-gray-600">5th</div>
                      </div>
                    </div>
                  </div>

                  {/* Popularity Bar */}
                  <div className="mt-3">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min((course.student_count / stats.total_students) * 100, 100)}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.round((course.student_count / stats.total_students) * 100)}% of students
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Banner */}
      {analytics.length > 0 && (
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">📋 Generation Summary</h3>
            <p className="text-sm text-gray-700">
              Based on current preferences, you need to generate{' '}
              <strong>
                {analytics.reduce((sum, course) => sum + course.sections_needed, 0)} total sections
              </strong>{' '}
              across <strong>{analytics.length} elective courses</strong> for Level {selectedLevel}.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

