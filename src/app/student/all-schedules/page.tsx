'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TimetableView } from '@/components/ui/TimetableView'
import { SystemSettingsService } from '@/lib/systemSettingsService'

export default function AllSchedulesPage() {
  const { user, userRole, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState<any>(null)
  const [semester, setSemester] = useState<string>('Fall 2025')
  const [scheduleVersion, setScheduleVersion] = useState<any>(null)
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const [groups, setGroups] = useState<string[]>([])

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

      // Get current semester
      const currentSemester = await SystemSettingsService.getCurrentSemester()
      setSemester(currentSemester)

      // Get schedule version for student's level (new schema)
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule_versions')
        .select('id, level, semester, groups, total_sections, conflicts, efficiency, created_at, generated_at')
        .eq('level', studentData.level)
        .eq('semester', currentSemester)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (scheduleError) {
        console.error('No schedule found:', scheduleError)
        setScheduleVersion(null)
        return
      }

      setScheduleVersion(scheduleData)

      // Extract group names from schedule
      const groupNames = Object.keys((scheduleData as any).groups || {})
      setGroups(groupNames)

      // Set selected group to student's group if available
      if (studentData.student_group && groupNames.includes(studentData.student_group)) {
        setSelectedGroup(studentData.student_group)
      } else if (groupNames.length > 0) {
        setSelectedGroup(groupNames[0])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getScheduleForGroup = (groupName: string) => {
    if (!scheduleVersion || !(scheduleVersion as any).groups) return []

    const groupData = (scheduleVersion as any).groups[groupName]
    if (!groupData || !groupData.sections) return []

    return groupData.sections
  }

  const convertToTimetableEntries = (sections: any[]) => {
    return sections.map((section: any) => {
      const timeslot = section.timeslot && section.timeslot.day
        ? section.timeslot
        : {
            day: section.day || 'Monday',
            start: section.start_time,
            end: section.end_time
          }
      return {
        course_code: section.course_code,
        course_title: section.course_title,
        section_label: section.section_label || 'A',
        timeslot,
        room: section.room,
        instructor: section.instructor || 'TBA'
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading schedules...</p>
        </div>
      </div>
    )
  }

  if (!scheduleVersion) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-2xl mx-auto border-yellow-200">
          <CardHeader>
            <CardTitle>No Schedule Available</CardTitle>
            <CardDescription>
              Schedules for Level {student?.level} - {semester} have not been generated yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Please check back later or contact the scheduling committee.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentGroupSchedule = getScheduleForGroup(selectedGroup)
  const timetableEntries = convertToTimetableEntries(currentGroupSchedule)

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">All Group Schedules</h1>
        <p className="text-gray-600">
          Level {student?.level} - {semester}
        </p>
        {student?.student_group && (
          <Badge variant="default" className="mt-2">
            Your Group: {student.student_group}
          </Badge>
        )}
      </div>

      {/* Group Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Group</CardTitle>
          <CardDescription>
            View schedules for all groups in your level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  selectedGroup === group
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Group {group}
                {student?.student_group === group && (
                  <span className="ml-2 text-xs">(Your Group)</span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Schedule Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Group {selectedGroup} Schedule</span>
            <Badge variant="outline">
              {currentGroupSchedule.length} sections
            </Badge>
          </CardTitle>
          <CardDescription>
            Timetable for all students in Group {selectedGroup}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timetableEntries.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No schedule available for Group {selectedGroup}
            </p>
          ) : (
            <TimetableView schedule={timetableEntries} />
          )}
        </CardContent>
      </Card>

      {/* Course List */}
      {currentGroupSchedule.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Course Details - Group {selectedGroup}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentGroupSchedule.map((section: any, index: number) => (
                <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-semibold">{section.course_title}</h3>
                        <Badge variant={section.course_type === 'elective' ? 'secondary' : 'default'}>
                          {section.course_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {section.course_code} • Section {section.section_label || 'A'}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        {(() => {
                          const day = section.timeslot?.day || section.day || 'N/A'
                          const start = section.timeslot?.start || section.start_time || 'N/A'
                          const end = section.timeslot?.end || section.end_time || 'N/A'
                          return `📅 ${day} ${start} - ${end}`
                        })()}
                      </p>
                      <p className="text-sm text-gray-500">
                        🏫 Room: {section.room} • 👤 Instructor: {section.instructor || 'TBA'}
                      </p>
                    </div>
                    <Badge variant="outline">{section.credits || 3} credits</Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-4">
              <p className="font-semibold">
                Total Credits: {currentGroupSchedule.reduce((sum: number, s: any) => sum + (s.credits || 3), 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

