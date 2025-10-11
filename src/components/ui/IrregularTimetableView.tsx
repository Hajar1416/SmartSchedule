'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  BookOpen,
  AlertCircle,
  GraduationCap
} from 'lucide-react'

interface IrregularScheduleEntry {
  course_code: string
  course_title: string
  course_level: number
  section_label: string
  day: string
  start_time: string
  end_time: string
  room: string
  instructor: string
  credits: number
  source: 'failed' | 'current' | 'elective'
  original_level?: number
}

interface IrregularTimetableViewProps {
  schedule: IrregularScheduleEntry[]
  studentInfo?: {
    name: string
    level: number
    studentNumber: string
  }
  title?: string
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
const TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
]

export function IrregularTimetableView({ 
  schedule, 
  studentInfo, 
  title = "Personalized Schedule" 
}: IrregularTimetableViewProps) {
  
  // Group schedule by day and time
  const scheduleByDay = DAYS.reduce((acc, day) => {
    acc[day] = {}
    TIME_SLOTS.forEach(time => {
      acc[day][time] = []
    })
    return acc
  }, {} as Record<string, Record<string, IrregularScheduleEntry[]>>)

  // Fill in the schedule
  schedule.forEach(entry => {
    const day = entry.day
    const startTime = entry.start_time
    
    if (scheduleByDay[day] && scheduleByDay[day][startTime]) {
      scheduleByDay[day][startTime].push(entry)
    }
  })

  // Group courses by level for summary
  const coursesByLevel = schedule.reduce((acc, entry) => {
    const level = entry.course_level
    if (!acc[level]) acc[level] = []
    acc[level].push(entry)
    return acc
  }, {} as Record<number, IrregularScheduleEntry[]>)

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'failed': return 'bg-orange-100 border-orange-300 text-orange-800'
      case 'current': return 'bg-blue-100 border-blue-300 text-blue-800'
      case 'elective': return 'bg-green-100 border-green-300 text-green-800'
      default: return 'bg-gray-100 border-gray-300 text-gray-800'
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'failed': return <AlertCircle className="h-3 w-3" />
      case 'current': return <GraduationCap className="h-3 w-3" />
      case 'elective': return <BookOpen className="h-3 w-3" />
      default: return <BookOpen className="h-3 w-3" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {studentInfo && (
            <p className="text-gray-600">
              {studentInfo.name} • Level {studentInfo.level} • {studentInfo.studentNumber}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Courses</p>
          <p className="text-2xl font-bold text-blue-600">{schedule.length}</p>
        </div>
      </div>

      {/* Course Summary by Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Summary by Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(coursesByLevel)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([level, courses]) => (
                <div key={level} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Level {level}</h3>
                    <Badge variant="outline">{courses.length} courses</Badge>
                  </div>
                  <div className="space-y-1">
                    {courses.map((course, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div className={`p-1 rounded ${getSourceColor(course.source)}`}>
                          {getSourceIcon(course.source)}
                        </div>
                        <span className="font-medium">{course.course_code}</span>
                        <span className="text-gray-500">({course.credits}cr)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Course Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded flex items-center justify-center">
                <AlertCircle className="h-2 w-2 text-orange-800" />
              </div>
              <span className="text-sm">Failed Courses (Retake)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded flex items-center justify-center">
                <GraduationCap className="h-2 w-2 text-blue-800" />
              </div>
              <span className="text-sm">Current Level (Compulsory)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded flex items-center justify-center">
                <BookOpen className="h-2 w-2 text-green-800" />
              </div>
              <span className="text-sm">Elective Courses</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timetable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-300 p-2 bg-gray-50 font-semibold text-left">Time</th>
                  {DAYS.map(day => (
                    <th key={day} className="border border-gray-300 p-2 bg-gray-50 font-semibold text-center min-w-[150px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(time => (
                  <tr key={time}>
                    <td className="border border-gray-300 p-2 bg-gray-50 font-medium text-sm">
                      {time}
                    </td>
                    {DAYS.map(day => {
                      const courses = scheduleByDay[day][time] || []
                      return (
                        <td key={day} className="border border-gray-300 p-1 min-h-[60px]">
                          {courses.map((course, index) => (
                            <div
                              key={index}
                              className={`p-2 rounded text-xs mb-1 ${getSourceColor(course.source)}`}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                {getSourceIcon(course.source)}
                                <span className="font-semibold">{course.course_code}</span>
                              </div>
                              <div className="text-xs opacity-75">
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-2 w-2" />
                                  {course.room}
                                </div>
                                <div className="flex items-center gap-1">
                                  <User className="h-2 w-2" />
                                  {course.instructor}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-2 w-2" />
                                  {course.start_time}-{course.end_time}
                                </div>
                              </div>
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

     
    </div>
  )
}
