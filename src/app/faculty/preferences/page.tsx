'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { FacultyService, Faculty, FacultyAvailability, FacultyPreference } from '@/lib/facultyService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Save,
  Calendar,
  Settings
} from 'lucide-react'

export default function FacultyPreferencesPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [availability, setAvailability] = useState<Partial<FacultyAvailability>[]>([])
  const [preferences, setPreferences] = useState<Partial<FacultyPreference>[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const preferenceTypes = ['time', 'room', 'course_load', 'other'] as const

  useEffect(() => {
    if (user?.id) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError('')

      // Get faculty record
      const facultyData = await FacultyService.getFacultyByUserId(user.id)
      if (!facultyData) {
        throw new Error('Faculty record not found')
      }
      setFaculty(facultyData)

      // Get availability and preferences
      const [availabilityData, preferencesData] = await Promise.all([
        FacultyService.getAvailability(facultyData.id),
        FacultyService.getPreferences(facultyData.id)
      ])

      setAvailability(availabilityData)
      setPreferences(preferencesData)

    } catch (error: any) {
      console.error('Error loading data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const addAvailability = () => {
    setAvailability([
      ...availability,
      {
        day_of_week: 'Monday',
        start_time: '08:00',
        end_time: '16:00',
        is_available: true,
        notes: ''
      }
    ])
  }

  const updateAvailability = (index: number, field: string, value: any) => {
    const updated = [...availability]
    updated[index] = { ...updated[index], [field]: value }
    setAvailability(updated)
  }

  const removeAvailability = (index: number) => {
    setAvailability(availability.filter((_, i) => i !== index))
  }

  const addPreference = () => {
    setPreferences([
      ...preferences,
      {
        preference_type: 'time',
        preference_value: '',
        priority: 5,
        notes: ''
      }
    ])
  }

  const updatePreference = (index: number, field: string, value: any) => {
    const updated = [...preferences]
    updated[index] = { ...updated[index], [field]: value }
    setPreferences(updated)
  }

  const removePreference = (index: number) => {
    setPreferences(preferences.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!faculty) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      // Save availability
      await FacultyService.setAvailability(
        faculty.id,
        availability as Omit<FacultyAvailability, 'id' | 'faculty_id'>[]
      )

      // Save preferences (delete existing and insert new)
      for (const preference of preferences) {
        if (preference.preference_value) {
          await FacultyService.savePreference(
            faculty.id,
            preference as Omit<FacultyPreference, 'id' | 'faculty_id'>
          )
        }
      }

      setSuccess('Preferences saved successfully!')
      
      // Reload data
      await loadData()

    } catch (error: any) {
      console.error('Error saving preferences:', error)
      setError('Failed to save preferences: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Preferences & Availability</h1>
            {faculty && (
              <p className="text-gray-600">
                Set your teaching preferences and available time slots
              </p>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save All
              </>
            )}
          </Button>
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

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading preferences...</span>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Availability Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Weekly Availability
                </CardTitle>
                <CardDescription>
                  Set the time slots when you're available to teach
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {availability.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No availability set</p>
                    <p className="text-sm">Add your available time slots below</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availability.map((slot, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant={slot.is_available ? "default" : "secondary"}>
                            {slot.is_available ? 'Available' : 'Not Available'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeAvailability(index)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={slot.day_of_week}
                            onChange={(e) => updateAvailability(index, 'day_of_week', e.target.value)}
                            className="px-3 py-2 border rounded-md text-sm"
                          >
                            {days.map(day => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>

                          <input
                            type="time"
                            value={slot.start_time}
                            onChange={(e) => updateAvailability(index, 'start_time', e.target.value)}
                            className="px-3 py-2 border rounded-md text-sm"
                          />

                          <input
                            type="time"
                            value={slot.end_time}
                            onChange={(e) => updateAvailability(index, 'end_time', e.target.value)}
                            className="px-3 py-2 border rounded-md text-sm"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={slot.is_available}
                            onChange={(e) => updateAvailability(index, 'is_available', e.target.checked)}
                            className="rounded"
                          />
                          <label className="text-sm">I am available during this time</label>
                        </div>

                        <Input
                          placeholder="Notes (optional)"
                          value={slot.notes || ''}
                          onChange={(e) => updateAvailability(index, 'notes', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={addAvailability} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Time Slot
                </Button>
              </CardContent>
            </Card>

            {/* Preferences Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-purple-600" />
                  Teaching Preferences
                </CardTitle>
                <CardDescription>
                  Specify your teaching preferences and constraints
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {preferences.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No preferences set</p>
                    <p className="text-sm">Add your teaching preferences below</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {preferences.map((pref, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge>Priority: {pref.priority}/10</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removePreference(index)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <select
                          value={pref.preference_type}
                          onChange={(e) => updatePreference(index, 'preference_type', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                          <option value="time">Time Preference</option>
                          <option value="room">Room Preference</option>
                          <option value="course_load">Course Load</option>
                          <option value="other">Other</option>
                        </select>

                        <Input
                          placeholder="Preference value (e.g., 'Prefer morning classes')"
                          value={pref.preference_value || ''}
                          onChange={(e) => updatePreference(index, 'preference_value', e.target.value)}
                          className="text-sm"
                        />

                        <div className="space-y-2">
                          <label className="text-sm text-gray-600">Priority (1-10)</label>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={pref.priority || 5}
                            onChange={(e) => updatePreference(index, 'priority', parseInt(e.target.value))}
                            className="w-full"
                          />
                        </div>

                        <Textarea
                          placeholder="Additional notes (optional)"
                          value={pref.notes || ''}
                          onChange={(e) => updatePreference(index, 'notes', e.target.value)}
                          className="text-sm"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={addPreference} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Preference
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Availability</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>Set your regular weekly availability</li>
                  <li>Specify exact times you can teach</li>
                  <li>Mark time slots as available or unavailable</li>
                  <li>Add notes for special circumstances</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Preferences</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>Time: Preferred teaching times (e.g., mornings)</li>
                  <li>Room: Preferred classrooms or lab requirements</li>
                  <li>Course Load: Maximum hours per week</li>
                  <li>Priority: Higher number = stronger preference</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

