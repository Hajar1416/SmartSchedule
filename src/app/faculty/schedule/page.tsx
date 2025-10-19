'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { FacultyService, Faculty, TeachingAssignment } from '@/lib/facultyService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScheduleService, GeneratedSchedule } from '@/lib/scheduleService'
import { SystemSettingsService } from '@/lib/systemSettingsService'
import { supabase } from '@/lib/supabase'
import { TimetableView } from '@/components/ui/TimetableView'
import { ScheduleCommentsPanel } from '@/components/ui/ScheduleCommentsPanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Download,
  Printer,
  AlertCircle,
  BookOpen,
  TrendingUp,
  MessageSquare
} from 'lucide-react'

export default function FacultySchedulePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([])
  const [teachingStats, setTeachingStats] = useState<any>(null)
  const [error, setError] = useState('')
  const [globalSchedules, setGlobalSchedules] = useState<GeneratedSchedule[]>([])
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [scheduleVersionId, setScheduleVersionId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadSchedule()
    }
  }, [user])

  const loadSchedule = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError('')

      // Get faculty record
      let facultyData = await FacultyService.getFacultyByUserId(user.id)
      if (!facultyData) {
        // Try to auto-link by email if contact matches
        await FacultyService.linkFacultyToUser(user.id, user.email || '')
        facultyData = await FacultyService.getFacultyByUserId(user.id)
      }
      
      // Sync faculty record to ensure it has correct information
      if (facultyData) {
        try {
          // If faculty name is generic, update it with proper name from form
          if (facultyData.full_name === 'Faculty Member' || facultyData.full_name === facultyData.faculty_number) {
            // Try to get proper name from email or use a better default
            const properName = user.email?.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Faculty Member'
            await fetch('/api/faculty/update-name', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, fullName: properName })
            })
            console.log('✅ Faculty name updated to:', properName)
          }
          
          await fetch('/api/faculty/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
          })
          console.log('✅ Faculty record synced')
          // Reload faculty data to get updated info
          facultyData = await FacultyService.getFacultyByUserId(user.id)
        } catch (syncError) {
          console.log('⚠️ Could not sync faculty record:', syncError)
        }
      }
      // Get current schedule version ID for comments (always load this)
      const currentSemester = await SystemSettingsService.getCurrentSemester()
      const { data: scheduleVersion, error: scheduleError } = await supabase
        .from('schedule_versions')
        .select('id, level, semester, created_at')
        .eq('semester', currentSemester)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (scheduleVersion && !scheduleError) {
        setScheduleVersionId(scheduleVersion.id)
        console.log('✅ Faculty schedule version loaded:', scheduleVersion.id)
      } else {
        console.log('⚠️ No schedule version found for faculty comments:', scheduleError?.message)
      }

      if (!facultyData) {
        // No linked faculty: fall back to global schedules (read-only)
        setFaculty(null)
        setAssignments([])
        setTeachingStats(null)
        const schedules = await ScheduleService.getSchedules()
        setGlobalSchedules(schedules)
        return
      }
      setFaculty(facultyData)

      // Get teaching schedule
      const schedule = await FacultyService.getTeachingSchedule(facultyData.id)
      setAssignments(schedule)

      // Get teaching stats
      const stats = await FacultyService.getTeachingLoadStats(facultyData.id)
      setTeachingStats(stats)

    } catch (error: any) {
      console.error('Error loading schedule:', error)
      setError(error.message || 'Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation for faculty schedule
    alert('PDF download will be implemented')
  }

  const handlePrint = () => {
    window.print()
  }

  // Group assignments by day
  const groupedByDay = assignments.reduce((acc, assignment) => {
    if (!acc[assignment.day]) {
      acc[assignment.day] = []
    }
    acc[assignment.day].push(assignment)
    return acc
  }, {} as Record<string, TeachingAssignment[]>)

  // Sort by day
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const sortedDays = Object.keys(groupedByDay).sort((a, b) => days.indexOf(a) - days.indexOf(b))

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Teaching Schedule</h1>
            {faculty && (
              <p className="text-gray-600">
                {faculty.full_name} • {faculty.department} Department
              </p>
            )}
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleDownloadPDF} disabled={loading}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={loading}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Teaching Load Summary */}
        {faculty && teachingStats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Hours</p>
                    <p className="text-xl font-bold">{teachingStats.totalHours.toFixed(1)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Courses</p>
                    <p className="text-xl font-bold">{teachingStats.totalCourses}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Sections</p>
                    <p className="text-xl font-bold">{teachingStats.totalSections}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Days/Week</p>
                    <p className="text-xl font-bold">{teachingStats.daysPerWeek}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">Avg/Day</p>
                    <p className="text-xl font-bold">{teachingStats.averageHoursPerDay.toFixed(1)}h</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Global Schedules (fallback when no faculty) */}
        {!faculty && globalSchedules.length > 0 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Schedules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="max-w-xs">
                    <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        {Array.from(new Set(globalSchedules.map(s => s.level))).sort((a, b) => a - b).map(level => (
                          <SelectItem key={level} value={level.toString()}>Level {level}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {globalSchedules
                    .filter(s => selectedLevel === 'all' || s.level.toString() === selectedLevel)
                    .map((sched) => (
                      <div key={sched.id} className="border rounded-md p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">Level {sched.level} • {sched.semester || 'Semester'}</h4>
                            <p className="text-sm text-gray-600">Sections: {sched.sections.length} • Efficiency: {sched.efficiency}% • Status: {sched.status}</p>
                          </div>
                          <Badge variant="outline">{new Date(sched.created_at).toLocaleDateString()}</Badge>
                        </div>

                        <TimetableView
                          schedule={sched.sections.map(s => ({
                            course_code: s.course_code,
                            section_label: s.section_label,
                            timeslot: { day: s.timeslot.day, start: s.timeslot.start, end: s.timeslot.end },
                            room: s.room,
                            instructor_id: s.instructor_id,
                            student_count: s.student_count,
                            capacity: s.capacity
                          }))}
                          title={`Level ${sched.level} Timetable${selectedLevel === 'all' ? '' : ''}`}
                          studentInfo={{ level: sched.level }}
                        />
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Schedule and Comments Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timetable (2/3 width) */}
          <div className="lg:col-span-2">
            {faculty && (loading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2">Loading schedule...</span>
                </CardContent>
              </Card>
            ) : assignments.length > 0 ? (
              <TimetableView
                schedule={assignments.map(a => ({
                  course_code: a.course_code,
                  section_label: a.group_name || 'A',
                  timeslot: { day: a.day, start: a.start_time, end: a.end_time },
                  room: a.room,
                  instructor_id: faculty?.full_name,
                  student_count: a.student_count,
                  capacity: undefined
                }))}
                title={faculty ? `${faculty.full_name}'s Timetable` : 'My Timetable'}
              />
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Available</h3>
                  <p className="text-gray-600">
                    Your teaching schedule hasn't been generated yet, or you have no courses assigned this semester.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comments Panel (1/3 width) */}
          <div className="lg:col-span-1">
            {user ? (
              scheduleVersionId ? (
                <ScheduleCommentsPanel
                  scheduleVersionId={scheduleVersionId}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                      Comments & Feedback
                    </CardTitle>
                    <CardDescription>
                      Share your thoughts on the current schedule
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Available</h3>
                    <p className="text-gray-600 text-sm">
                      Comments will be available once the schedule is generated.
                    </p>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Comments & Feedback</h3>
                  <p className="text-gray-600 text-sm">
                    Please log in to view and submit comments.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Course Summary */}
        {faculty && assignments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Course Summary</CardTitle>
              <CardDescription>All courses you're teaching this semester</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from(new Set(assignments.map(a => a.course_id))).map(courseId => {
                  const courseAssignments = assignments.filter(a => a.course_id === courseId)
                  const firstAssignment = courseAssignments[0]
                  return (
                    <div key={courseId} className="p-3 border rounded-lg flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">
                          {firstAssignment.course_code} - {firstAssignment.course_title}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Level {firstAssignment.level} • {courseAssignments.length} {courseAssignments.length === 1 ? 'section' : 'sections'}
                        </p>
                      </div>
                      <Badge>
                        {courseAssignments.reduce((total, a) => {
                          const start = new Date(`1970-01-01T${a.start_time}`)
                          const end = new Date(`1970-01-01T${a.end_time}`)
                          return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                        }, 0).toFixed(1)}h/week
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
