'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScheduleService, GeneratedSchedule } from '@/lib/scheduleService'
import { CourseService } from '@/lib/courseService'
import { supabase } from '@/lib/supabase'
import { 
  Calendar, 
  Clock, 
  Building, 
  Users, 
  Edit, 
  Save, 
  RotateCcw,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  Download
} from 'lucide-react'

interface ScheduleSection {
  id?: string
  course_code: string
  section_label: string
  timeslot: {
    day: string
    start: string
    end: string
  }
  room: string
  instructor_id?: string
  student_count: number
  capacity: number
  group_name?: string
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']

export default function EditSchedulePage() {
  const [schedules, setSchedules] = useState<GeneratedSchedule[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<GeneratedSchedule | null>(null)
  const [sections, setSections] = useState<ScheduleSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<ScheduleSection | null>(null)
  const [availableRooms, setAvailableRooms] = useState<string[]>([])
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Build dynamic time options from current sections (separate start/end lists)
  const startTimeOptions = useMemo(() => {
    const set = new Set<string>()
    sections.forEach(s => { if (s?.timeslot?.start) set.add(s.timeslot.start) })
    if (set.size === 0) {
      ;['08:00','09:00','09:30','10:00','10:30','11:00','12:00','12:30','13:00','14:00','15:00','15:30','16:00','17:00'].forEach(t => set.add(t))
    }
    return Array.from(set).sort()
  }, [sections])

  const endTimeOptions = useMemo(() => {
    const set = new Set<string>()
    sections.forEach(s => { if (s?.timeslot?.end) set.add(s.timeslot.end) })
    if (set.size === 0) {
      ;['09:00','09:30','10:00','10:30','11:00','12:00','12:30','13:00','14:00','15:00','15:30','16:00','17:00','18:00'].forEach(t => set.add(t))
    }
    return Array.from(set).sort()
  }, [sections])

  useEffect(() => {
    loadSchedules()
    loadAvailableRooms()
  }, [])

  const loadSchedules = async () => {
    try {
      setLoading(true)
      const data = await ScheduleService.getSchedules()
      setSchedules(data)
      if (data.length > 0) {
        setSelectedSchedule(data[0])
        setSections(data[0].sections)
      }
    } catch (error: any) {
      setError('Failed to load schedules: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableRooms = async () => {
    try {
      // Prefer rooms table if available
      const { data: roomsData } = await supabase.from('rooms').select('name')
      if (roomsData && roomsData.length > 0) {
        setAvailableRooms(roomsData.map((r: any) => r.name).filter(Boolean))
        return
      }

      // Fallback: aggregate allowable_rooms from courses safely
      const courses = await CourseService.getAllCourses()
      const rooms = new Set<string>()
      courses.forEach((course: any) => {
        const list = Array.isArray(course.allowable_rooms) ? course.allowable_rooms : []
        list.forEach((room: string) => rooms.add(room))
      })
      setAvailableRooms(Array.from(rooms))
    } catch (error) {
      console.error('Error loading rooms:', error)
    }
  }

  const handleScheduleSelect = (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId)
    if (schedule) {
      setSelectedSchedule(schedule)
      // Ensure each section has a unique ID (UI-only)
      const sectionsWithIds: ScheduleSection[] = schedule.sections.map((section, index) => ({
        ...(section as any),
        id: `section-${scheduleId}-${index}-${Date.now()}`
      }))
      console.log('Loaded sections with IDs:', sectionsWithIds)
      setSections(sectionsWithIds)
    }
  }

  const handleEditSection = (section: ScheduleSection) => {
    // Ensure section has an ID
    const sectionWithId: ScheduleSection = {
      ...(section as any),
      id: section.id || `section-${sections.indexOf(section)}`
    }
    console.log('Editing section:', sectionWithId)
    setEditingSection(sectionWithId)
    setIsEditDialogOpen(true)
  }

  const handleSaveSection = (updatedSection: ScheduleSection) => {
    setSections(prev => 
      prev.map((s, index) => {
        const currentId = s.id || `section-${index}`
        const updatedId = updatedSection.id || `section-${index}`
        return currentId === updatedId ? ({ ...(updatedSection as any) } as ScheduleSection) : s
      })
    )
    setIsEditDialogOpen(false)
    setEditingSection(null)
    setSuccess(`Section ${updatedSection.course_code} - ${updatedSection.section_label} updated successfully`)
  }

  const handleDeleteSection = (sectionId: string | undefined) => {
    console.log('Attempting to delete section with ID:', sectionId)
    console.log('Current sections:', sections)
    
    if (!sectionId) {
      console.error('Cannot delete section: no ID provided')
      return
    }
    
    const sectionToDelete = sections.find((s, index) => {
      const currentId = s.id || `section-${index}`
      return currentId === sectionId
    })
    
    if (!sectionToDelete) {
      console.error('Section not found for deletion')
      return
    }
    
    console.log('Found section to delete:', sectionToDelete)
    
    if (confirm(`Are you sure you want to delete section ${sectionToDelete.course_code} - ${sectionToDelete.section_label}?`)) {
      setSections(prev => prev.filter((s, index) => {
        const currentId = s.id || `section-${index}`
        return currentId !== sectionId
      }))
      setSuccess(`Section ${sectionToDelete.course_code} - ${sectionToDelete.section_label} deleted successfully`)
    }
  }

  const handleSaveSchedule = async () => {
    if (!selectedSchedule) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      // Client-side validations before saving
      const overlapsBreak = (start: string, end: string): boolean => {
        const breakStart = '12:00'
        const breakEnd = '13:00'
        return (start >= breakStart && start < breakEnd) ||
               (end > breakStart && end <= breakEnd) ||
               (start < breakStart && end > breakEnd)
      }

      // 1) 12:00-13:00 break
      const invalidBreak = sections.find(s => overlapsBreak(s.timeslot.start, s.timeslot.end))
      if (invalidBreak) {
        setError(`Cannot save: ${invalidBreak.course_code} overlaps the 12:00-13:00 break`)
        return
      }

      // 2) Room-time conflicts (same day, start, room)
      const roomKey = (s: any) => `${s.timeslot.day}|${s.timeslot.start}|${s.room}`
      const roomCounts = new Map<string, number>()
      for (const s of sections) {
        const key = roomKey(s)
        roomCounts.set(key, (roomCounts.get(key) || 0) + 1)
      }
      if (Array.from(roomCounts.values()).some(c => c > 1)) {
        setError('Cannot save: room-time conflict detected')
        return
      }

      // 3) Duplicate courses (same course_code appears multiple times)
      const courseCounts = new Map<string, number>()
      for (const s of sections) {
        courseCounts.set(s.course_code, (courseCounts.get(s.course_code) || 0) + 1)
      }
      if (Array.from(courseCounts.values()).some(c => c > 1)) {
        setError('Cannot save: duplicate course entries in schedule')
        return
      }

      // Validate and save to DB via service
      await ScheduleService.updateScheduleSections(selectedSchedule.id, sections as any)
      setSuccess('Schedule saved successfully!')

      // Reload latest schedules to reflect persisted changes
      await loadSchedules()
    } catch (error: any) {
      setError('Failed to save schedule: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSchedule = async () => {
    if (!selectedSchedule) return

    try {
      setDeleting(true)
      setError('')
      
      // Delete the schedule
      await ScheduleService.deleteSchedule(selectedSchedule.id)
      
      setSuccess('Schedule deleted successfully!')
      setIsDeleteDialogOpen(false)
      
      // Clear selected schedule and sections
      setSelectedSchedule(null)
      setSections([])
      
      // Reload schedules to get updated data
      await loadSchedules()
    } catch (error: any) {
      setError('Failed to delete schedule: ' + error.message)
    } finally {
      setDeleting(false)
    }
  }

  const getSectionsAtTime = (day: string, time: string) => {
    return sections.filter(section => 
      section.timeslot.day === day && section.timeslot.start === time
    )
  }

  const getConflicts = () => {
    const conflicts: string[] = []
    const roomBookings: { [key: string]: ScheduleSection[] } = {}
    
    sections.forEach(section => {
      const key = `${section.timeslot.day}-${section.timeslot.start}-${section.room}`
      if (!roomBookings[key]) roomBookings[key] = []
      roomBookings[key].push(section)
    })

    Object.entries(roomBookings).forEach(([key, sections]) => {
      if (sections.length > 1) {
        conflicts.push(`Room conflict: ${sections[0].room} at ${sections[0].timeslot.day} ${sections[0].timeslot.start}`)
      }
    })

    return conflicts
  }

  const conflicts = getConflicts()

  if (loading) {
    return (
        <div className="p-6 flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading schedules...</p>
          </div>
        </div>
    )
  }

  return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Schedule</h1>
            <p className="text-gray-600">Modify and manage existing schedules</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={loadSchedules}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleSaveSchedule} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
            {selectedSchedule && (
              <Button 
                variant="destructive" 
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={saving || deleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Schedule
              </Button>
            )}
          </div>
        </div>

        {/* Schedule Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Schedule to Edit</CardTitle>
            <CardDescription>Choose a schedule to modify</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Select value={selectedSchedule?.id || ''} onValueChange={handleScheduleSelect}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a schedule" />
                </SelectTrigger>
                <SelectContent>
                  {schedules.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      Level {schedule.level} - {schedule.semester} - {schedule.status.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSchedule && (
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">
                    {selectedSchedule.sections.length} Sections
                  </Badge>
                  <Badge variant="outline">
                    {selectedSchedule.conflicts} Conflicts
                  </Badge>
                  {/* Efficiency removed per request */}
                  <Badge 
                    variant={selectedSchedule.status === 'approved' ? 'default' : 'secondary'}
                    className={selectedSchedule.status === 'approved' ? 'bg-green-500' : ''}
                  >
                    {selectedSchedule.status.toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error/Success Messages */}
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

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div>
                <p className="font-medium">Scheduling Conflicts Detected:</p>
                <ul className="list-disc list-inside mt-1">
                  {conflicts.map((conflict, index) => (
                    <li key={index}>{conflict}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Schedule Grid */}
        {selectedSchedule && (
          <Card>
            <CardHeader>
              <CardTitle>Schedule Grid</CardTitle>
              <CardDescription>
                Click on a section to edit, or drag to move
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-gray-50 font-medium">Time</th>
                      {DAYS.map(day => (
                        <th key={day} className="border p-2 bg-gray-50 font-medium min-w-32">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Set(sections.map(s => s.timeslot.start))].sort().map(time => (
                      <tr key={time}>
                        <td className="border p-2 bg-gray-50 font-medium">{time}</td>
                        {DAYS.map(day => {
                          const atCell = getSectionsAtTime(day, time)
                          return (
                            <td key={`${day}-${time}`} className="border p-1 min-h-16">
                              {atCell.length > 0 ? (
                                <div className="space-y-2">
                                  {atCell.map((section, idx) => (
                                    <div 
                                      key={section.id || `${day}-${time}-${idx}`}
                                      className="bg-blue-100 border border-blue-300 rounded p-2 cursor-pointer hover:bg-blue-200 transition-colors"
                                      onClick={() => handleEditSection(section)}
                                    >
                                      <div className="font-medium text-sm">{section.course_code} {section.group_name ? `(${section.group_name})` : ''}</div>
                                      {/* section label removed per request */}
                                      <div className="text-xs text-gray-600">{section.room}</div>
                                      <div className="text-xs text-gray-600">{section.student_count}/{section.capacity}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="h-16 border-2 border-dashed border-gray-200 rounded flex items-center justify-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
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
        )}

        {/* Section List */}
        {selectedSchedule && (
          <Card>
            <CardHeader>
              <CardTitle>All Sections</CardTitle>
              <CardDescription>Manage all sections in this schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sections.map((section, index) => (
                  <div key={section.id || `section-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{section.course_code}</div>
                        <div className="text-sm text-gray-600">
                          {section.timeslot.day} {section.timeslot.start}-{section.timeslot.end} • {section.room}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {section.student_count}/{section.capacity} students
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditSection(section)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteSection(section.id || `section-${sections.indexOf(section)}`)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Section Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Section</DialogTitle>
              <DialogDescription>Modify section details</DialogDescription>
            </DialogHeader>
            {editingSection && (
              <EditSectionForm
                section={editingSection}
                availableRooms={availableRooms}
                startTimeOptions={startTimeOptions}
                endTimeOptions={endTimeOptions}
                onSave={handleSaveSection}
                onCancel={() => setIsEditDialogOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Schedule Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Schedule</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this schedule? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-red-800">Warning</h4>
                    <p className="text-sm text-red-700 mt-1">
                      This will permanently delete the schedule for Level {selectedSchedule?.level} - {selectedSchedule?.semester}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteSchedule}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {deleting ? 'Deleting...' : 'Delete Schedule'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  )
}

interface EditSectionFormProps {
  section: ScheduleSection
  availableRooms: string[]
  startTimeOptions: string[]
  endTimeOptions: string[]
  onSave: (section: ScheduleSection) => void
  onCancel: () => void
}

function EditSectionForm({ section, availableRooms, startTimeOptions, endTimeOptions, onSave, onCancel }: EditSectionFormProps) {
  const [formData, setFormData] = useState({
    day: section.timeslot.day,
    start: section.timeslot.start,
    end: section.timeslot.end,
    room: section.room,
    instructor_id: section.instructor_id || '',
    capacity: section.capacity
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...section,
      timeslot: {
        day: formData.day,
        start: formData.start,
        end: formData.end
      },
      room: formData.room,
      instructor_id: formData.instructor_id,
      capacity: formData.capacity
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="day">Day</Label>
          <Select value={formData.day} onValueChange={(value) => setFormData({...formData, day: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map(day => (
                <SelectItem key={day} value={day}>{day}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="room">Room</Label>
          <Select value={formData.room} onValueChange={(value) => setFormData({...formData, room: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableRooms.map(room => (
                <SelectItem key={room} value={room}>{room}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start">Start Time</Label>
          <Select value={formData.start} onValueChange={(value) => setFormData({...formData, start: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {startTimeOptions.map(time => (
                <SelectItem key={time} value={time}>{time}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="end">End Time</Label>
          <Select value={formData.end} onValueChange={(value) => setFormData({...formData, end: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {endTimeOptions.map(time => (
                <SelectItem key={time} value={time}>{time}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="instructor">Instructor ID</Label>
          <Input
            id="instructor"
            value={formData.instructor_id}
            onChange={(e) => setFormData({...formData, instructor_id: e.target.value})}
            placeholder="Optional"
          />
        </div>
        <div>
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            type="number"
            value={formData.capacity}
            onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
            min="1"
            max="50"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Changes
        </Button>
      </div>
    </form>
  )
}
