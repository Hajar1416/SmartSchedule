'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface TimetableEntry {
  course_code: string
  section_label: string
  timeslot: {
    day: string
    start: string
    end: string
  }
  room: string
  instructor_id?: string
  student_count?: number
  capacity?: number
  // Optional flags for student preference coloring
  is_student_preference?: boolean
}

interface TimetableViewProps {
  schedule: TimetableEntry[]
  title?: string
  studentInfo?: {
    name?: string
    level?: number
    studentNumber?: string
  }
}

// Convert 24-hour time to 12-hour format with AM/PM
function formatTime12Hour(time24: string): string {
  if (!time24 || time24 === 'TBA') return time24
  const [hours, minutes] = time24.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
}

// Get time slots from schedule dynamically (fallback to sensible defaults)
function getTimeSlots12Hour(schedule: TimetableEntry[]): string[] {
  const uniqueStarts = Array.from(
    new Set(
      (schedule || [])
        .map(e => e?.timeslot?.start)
        .filter(Boolean) as string[]
    )
  )
  if (uniqueStarts.length > 0) {
    // Sort by time HH:MM
    uniqueStarts.sort((a, b) => a.localeCompare(b))
    return uniqueStarts.map(formatTime12Hour)
  }
  // Fallback (common academic slots)
  const slots24 = ['12:00', '13:30', '15:00', '16:30']
  return slots24.map(formatTime12Hour)
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function TimetableView({ schedule, title = "Class Timetable", studentInfo }: TimetableViewProps) {
  const timeSlots = getTimeSlots12Hour(schedule)

  const getSectionsAtTime = (day: string, timeSlot: string) => {
    return schedule.filter(entry => {
      const entryDay = entry.timeslot.day
      const entryStartTime = formatTime12Hour(entry.timeslot.start)
      return entryDay === day && entryStartTime === timeSlot
    })
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-bold text-gray-900">{title}</CardTitle>
        {studentInfo && (
          <div className="text-sm text-gray-600 space-y-1">
            {studentInfo.name && <p className="font-medium">Student: {studentInfo.name}</p>}
            {studentInfo.studentNumber && <p>Student Number: {studentInfo.studentNumber}</p>}
            {studentInfo.level && <p>Level: {studentInfo.level}</p>}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-xs">
            {/* Header Row */}
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="border border-gray-300 px-2 py-2 text-center font-bold text-xs">
                  Time
                </th>
                {DAYS.map(day => (
                  <th key={day} className="border border-gray-300 px-1 py-2 text-center font-bold text-xs min-w-[80px]">
                    {day.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            
            {/* Time Slot Rows */}
            <tbody>
              {timeSlots.map((timeSlot, index) => (
                <tr key={timeSlot} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {/* Time Column */}
                  <td className="border border-gray-300 px-1 py-2 text-center font-bold text-xs bg-gray-100">
                    {timeSlot}
                  </td>
                  
                  {/* Day Columns */}
                  {DAYS.map(day => {
                    const sections = getSectionsAtTime(day, timeSlot)
                    return (
                      <td key={`${day}-${timeSlot}`} className="border border-gray-300 px-1 py-1 text-center align-top">
                        {sections.length > 0 ? (
                          <div className="text-xs leading-tight space-y-0.5">
                            {sections.map((section, sectionIndex) => {
                              // Determine background color based on student preference
                              let bgColor = 'bg-white border-gray-200'
                              let textColor = 'text-gray-900'
                              
                              if (section.is_student_preference === true) {
                                // Green for student's selected preferences
                                bgColor = 'bg-green-100 border-green-400'
                                textColor = 'text-green-900'
                              } else if (section.is_student_preference === false) {
                                // Red/Light for courses NOT selected by student
                                bgColor = 'bg-red-50 border-red-200'
                                textColor = 'text-red-700'
                              } else if (sections.length > 1) {
                                // Blue for multiple groups (current level)
                                bgColor = 'bg-blue-50 border-blue-200'
                                textColor = 'text-gray-900'
                              }
                              
                              return (
                                <div 
                                  key={`${section.course_code}-${section.section_label}-${sectionIndex}`}
                                  className={`p-2 rounded border ${bgColor} mb-1`}
                                >
                                  <div className={`font-bold ${textColor} text-xs`}>{section.course_code}</div>
                                  <div className={`${textColor} text-xs`}>Group {section.section_label}</div>
                                  <div className={`${textColor} text-xs`}>Sec {section.section_label}</div>
                                  <div className={`${textColor} text-xs`}>R{section.room}</div>
                                  {section.instructor_id && section.instructor_id !== 'TBA' && (
                                    <div className={`${textColor} italic text-xs`}>{section.instructor_id}</div>
                                  )}
                                  <div className={`${textColor} text-xs`}>
                                    {formatTime12Hour(section.timeslot.start)} - {formatTime12Hour(section.timeslot.end)}
                                  </div>
                                  {section.is_student_preference === true && (
                                    <div className="text-xs text-green-700 font-semibold mt-1">
                                      ✓ Your Course
                                    </div>
                                  )}
                                  {sections.length > 1 && sectionIndex < sections.length - 1 && (
                                    <div className="border-t border-gray-300 mt-1 pt-1"></div>
                                  )}
                                </div>
                              )
                            })}
                            {sections.length > 1 && (
                              <div className="text-xs text-blue-600 font-semibold">
                                {sections.length} grps
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-16"></div> // Empty cell with consistent height
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer with generation info */}
        <div className="mt-4 text-center text-xs text-gray-500 italic">
          Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  )
}

// Alternative compact version for smaller displays
export function CompactTimetableView({ schedule, title = "Schedule Overview" }: TimetableViewProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {schedule.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No classes scheduled</p>
          ) : (
            schedule.map((entry, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex-1">
                  <div className="font-bold text-gray-900">{entry.course_code} - Section {entry.section_label}</div>
                  <div className="text-sm text-gray-600">
                    {entry.timeslot.day} • {formatTime12Hour(entry.timeslot.start)} - {formatTime12Hour(entry.timeslot.end)}
                  </div>
                  <div className="text-sm text-gray-500">Room {entry.room}</div>
                </div>
                {entry.student_count && entry.capacity && (
                  <div className="text-xs text-gray-500">
                    {entry.student_count}/{entry.capacity}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
