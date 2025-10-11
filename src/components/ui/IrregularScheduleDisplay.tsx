'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  BookOpen,
  AlertCircle,
  GraduationCap,
  Info
} from 'lucide-react'

interface ScheduleSection {
  course_code: string
  course_title: string
  section_label: string
  day: string
  start_time: string
  end_time: string
  room: string
  instructor: string
  credits: number
  level?: number
  course_level?: number
  source?: string
  is_failed_course?: boolean
}

interface IrregularScheduleDisplayProps {
  currentLevelSections: ScheduleSection[]
  preferenceSections: ScheduleSection[]
  studentInfo?: {
    name: string
    level: number
    studentNumber: string
  }
}

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function IrregularScheduleDisplay({ 
  currentLevelSections, 
  preferenceSections,
  studentInfo 
}: IrregularScheduleDisplayProps) {
  
  // Group sections by day
  const groupByDay = (sections: ScheduleSection[]) => {
    const grouped: { [key: string]: ScheduleSection[] } = {}
    sections.forEach(section => {
      if (!grouped[section.day]) {
        grouped[section.day] = []
      }
      grouped[section.day].push(section)
    })
    
    // Sort each day's sections by time
    Object.keys(grouped).forEach(day => {
      grouped[day].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })
    
    return grouped
  }

  const currentLevelByDay = groupByDay(currentLevelSections)
  const preferenceByDay = groupByDay(preferenceSections)

  // Get unique course codes for current level
  const currentLevelCourses = [...new Set(currentLevelSections.map(s => s.course_code))]
  
  // Get unique preference courses with their levels
  const preferenceCourses = [...new Map(
    preferenceSections.map(s => [s.course_code, { 
      code: s.course_code, 
      title: s.course_title, 
      level: s.course_level || s.level 
    }])
  ).values()]

  const renderSection = (section: ScheduleSection) => (
    <div 
      key={`${section.course_code}-${section.section_label}-${section.day}-${section.start_time}`}
      className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all bg-white"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm">{section.course_code}</h4>
            <Badge variant="outline" className="text-xs">
              {section.section_label}
            </Badge>
            {section.is_failed_course && (
              <Badge variant="destructive" className="text-xs">
                Failed Course
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-600 mb-2">{section.course_title}</p>
        </div>
        <div className="text-right">
          <Badge variant="secondary" className="text-xs">
            {section.credits || 3} CR
          </Badge>
        </div>
      </div>
      
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{section.start_time} - {section.end_time}</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span>{section.room || 'TBA'}</span>
        </div>
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          <span>{section.instructor || 'TBA'}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Student Info */}
      {studentInfo && (
        <Alert>
          <GraduationCap className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>{studentInfo.name}</strong> ({studentInfo.studentNumber})
                <span className="ml-2 text-sm">Level {studentInfo.level} - Irregular Student</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <p className="text-sm">
            Below are the schedules for your current level and your selected preference courses from other levels.
            You can see all available sections to help you plan which sections to attend without conflicts.
          </p>
        </AlertDescription>
      </Alert>

      {/* Current Level Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Level {studentInfo?.level} Schedule (Current Level)
          </CardTitle>
          <CardDescription>
            All sections available for Level {studentInfo?.level} courses
            {currentLevelCourses.length > 0 && (
              <div className="mt-2">
                <strong>Courses:</strong> {currentLevelCourses.join(', ')}
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(currentLevelByDay).length > 0 ? (
            <div className="space-y-4">
              {DAYS_ORDER.filter(day => currentLevelByDay[day]).map(day => (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <h3 className="font-semibold text-blue-600">{day}</h3>
                    <Badge variant="outline" className="text-xs">
                      {currentLevelByDay[day].length} sections
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {currentLevelByDay[day].map(section => renderSection(section))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No schedule available for your current level</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preference Courses Schedule */}
      {preferenceCourses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Preference Courses Schedule (Selected Failed/Elective Courses)
            </CardTitle>
            <CardDescription>
              Sections for your selected preference courses from other levels
              <div className="mt-2">
                <strong>Selected Courses:</strong>
                <div className="flex flex-wrap gap-2 mt-1">
                  {preferenceCourses.map(course => (
                    <Badge key={course.code} variant="outline" className="text-xs">
                      {course.code} (Level {course.level})
                    </Badge>
                  ))}
                </div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(preferenceByDay).length > 0 ? (
              <div className="space-y-4">
                {DAYS_ORDER.filter(day => preferenceByDay[day]).map(day => (
                  <div key={day}>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                      <Calendar className="h-4 w-4 text-orange-600" />
                      <h3 className="font-semibold text-orange-600">{day}</h3>
                      <Badge variant="outline" className="text-xs">
                        {preferenceByDay[day].length} sections
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {preferenceByDay[day].map(section => renderSection(section))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No sections found for your preference courses</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No preferences alert */}
      {preferenceCourses.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <p className="text-sm">
              You haven't selected any preference courses yet. Go to the <strong>Elective Preferences</strong> page to select failed or elective courses you want to retake.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

