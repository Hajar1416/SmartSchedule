'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CourseService } from '@/lib/courseService'
import { supabase } from '@/lib/supabase'
import { Course } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { SystemSettingsService } from '@/lib/systemSettingsService'
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Star,
  Clock,
  Users
} from 'lucide-react'

// Extend Course with optional fields used for irregular/failed courses display
type ExtendedCourse = Course & {
  is_failed_course?: boolean
  original_level?: number
  failed_semester?: string
  reason?: string
}

interface ElectiveChoice {
  id: string
  course_id: string
  priority: number
  course: ExtendedCourse
}

export default function ElectivePreferencesPage() {
  const [courses, setCourses] = useState<ExtendedCourse[]>([])
  const [selectedElectives, setSelectedElectives] = useState<ElectiveChoice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isIrregular, setIsIrregular] = useState(false)
  const [preferenceCollectionOpen, setPreferenceCollectionOpen] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [failedCourses, setFailedCourses] = useState<any[]>([])
  const [studentLevel, setStudentLevel] = useState(1)
  const { user, userRole } = useAuth()

  useEffect(() => {
    if (user && userRole) {
      loadData()
    }
  }, [user?.id, userRole])

  const reloadPreferences = async () => {
    if (!user?.id) return

    try {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (student) {
        const { data: preferences, error: preferencesError } = await supabase
          .from('elective_choices')
          .select(`
            *,
            courses(*)
          `)
          .eq('student_id', student.id)
          .eq('semester', 'Fall 2025')
          .order('priority')

        if (preferencesError) {
          console.error('❌ Reload preferences error:', preferencesError)
        } else if (preferences && preferences.length > 0) {
          console.log('✅ Reloaded preferences:', preferences)
          setSelectedElectives(preferences.map(p => ({
            id: p.id,
            course_id: p.course_id,
            priority: p.priority,
            course: p.courses
          })))
        } else {
          console.log('ℹ️ No preferences found after reload')
          setSelectedElectives([])
        }
      }
    } catch (error) {
      console.error('Error reloading preferences:', error)
    }
  }

  const loadSystemSettings = async () => {
    try {
      const isOpen = await SystemSettingsService.isPreferenceCollectionOpen()
      const deadline = await SystemSettingsService.getPreferenceDeadline()
      setPreferenceCollectionOpen(isOpen)
      setDeadline(deadline || '')
    } catch (error) {
      console.error('Error loading system settings:', error)
    }
  }

  const loadFailedCourses = async (studentId: string, studentLevel: number) => {
    try {
      console.log('🔍 Loading failed courses for student:', studentId)
      
      const { data: requirements, error } = await supabase
        .from('irregular_course_requirements')
        .select(`
          *,
          course:courses(id, code, title, level, credits)
        `)
        .eq('student_id', studentId)

      if (error) {
        console.error('❌ Error loading failed courses:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        // If table doesn't exist, show empty array
        if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
          console.log('⚠️ irregular_course_requirements table may not exist yet')
          setFailedCourses([])
          // Load electives with just current level
          await loadElectivesForIrregularStudent(studentLevel, [])
          return
        }
        return
      }

      console.log('✅ Loaded failed courses:', requirements)
      console.log('📊 Failed courses count:', requirements?.length || 0)
      if (requirements && requirements.length > 0) {
        console.log('📋 Failed course details:', requirements.map(r => ({
          course_code: r.course?.code,
          course_title: r.course?.title,
          original_level: r.original_level,
          reason: r.reason
        })))
      }
      setFailedCourses(requirements || [])
      
      // Load electives based on failed courses
      await loadElectivesForIrregularStudent(studentLevel, requirements || [])
    } catch (error) {
      console.error('❌ Exception loading failed courses:', error)
      setFailedCourses([])
      // Load electives with just current level
      await loadElectivesForIrregularStudent(studentLevel, [])
    }
  }

  const loadElectivesForIrregularStudent = async (studentLevel: number, failedCourses: any[]) => {
    try {
      console.log('🎯 Loading electives for irregular student')
      console.log('Student Level:', studentLevel)
      console.log('Failed Courses:', failedCourses)
      
      // Get current level electives
      const currentLevelElectives = await CourseService.getElectivesByLevel(studentLevel)
      console.log('Current level electives:', currentLevelElectives)
      
      // Get ALL failed courses (both compulsory and elective) - they can all be selected as electives
      const failedCourseElectives = failedCourses
        .filter(req => req.course) // Include all failed courses, not just electives
        .map(req => ({
          ...req.course,
          is_failed_course: true,
          original_level: req.original_level,
          failed_semester: req.failed_semester,
          reason: req.reason
        }))
      
      console.log('📚 Failed course electives count:', failedCourseElectives.length)
      console.log('📚 Failed course electives:', failedCourseElectives.map(fc => ({
        code: fc.code,
        title: fc.title,
        level: fc.level,
        original_level: fc.original_level,
        reason: fc.reason
      })))
      
      // Combine current level electives with failed course electives
      const allElectives = [...currentLevelElectives, ...failedCourseElectives]
      
      // Remove duplicates based on course ID
      const uniqueElectives = allElectives.filter((course, index, self) => 
        index === self.findIndex(c => c.id === course.id)
      )
      
      console.log('🎯 Final electives for irregular student count:', uniqueElectives.length)
      console.log('🎯 Final electives for irregular student:', uniqueElectives.map(c => ({
        code: c.code,
        title: c.title,
        level: c.level,
        is_failed_course: c.is_failed_course,
        original_level: c.original_level
      })))
      setCourses(uniqueElectives)
    } catch (error) {
      console.error('Error loading electives for irregular student:', error)
      setCourses([])
    }
  }

  const debugIrregularData = async () => {
    if (!user?.id) return
    
    try {
      const { data: student } = await supabase
        .from('students')
        .select('id, full_name, is_irregular, level')
        .eq('user_id', user.id)
        .single()

      if (student) {
        const response = await fetch(`/api/debug/irregular-requirements?studentId=${student.id}`)
        const result = await response.json()
        console.log('🔍 Debug result:', result)
        alert(`Debug Result: ${JSON.stringify(result, null, 2)}`)
      }
    } catch (error) {
      console.error('Debug error:', error)
    }
  }

  const loadData = async () => {
    if (!user?.id) {
      console.log('⚠️ No user ID available, skipping loadData')
      return
    }

    try {
      setLoading(true)
      console.log('🔄 Loading data for user:', user.id)
      
      // Load system settings first
      await loadSystemSettings()
      
      // Get student's level and irregular status
      const { data: student } = await supabase
        .from('students')
        .select('id, level, is_irregular')
        .eq('user_id', user.id)
        .single()
        
        if (student) {
          setStudentLevel(student.level)
          setIsIrregular(student.is_irregular || false)
          
          // Load failed courses for irregular students first
          if (student.is_irregular) {
            console.log('🔍 Loading failed courses for irregular student:', student.id)
            await loadFailedCourses(student.id, student.level)
          } else {
            // Regular students can only take their exact level
            const electiveCourses = await CourseService.getElectivesByLevel(student.level)
            setCourses(electiveCourses)
          }
        }

      // Load existing preferences
      if (user?.id) {
        console.log('🔍 Looking for student with user_id:', user.id)
        
        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id, full_name, level')
          .eq('user_id', user.id)
          .single()

        if (studentError) {
          console.error('❌ Student lookup error:', studentError)
        } else if (student) {
          console.log('✅ Found student:', student)
          console.log('🔍 Looking for preferences for student_id:', student.id)
          
          // Get current semester
          const { SystemSettingsService } = await import('@/lib/systemSettingsService')
          const currentSemester = await SystemSettingsService.getCurrentSemester()

          const { data: preferences, error: preferencesError } = await supabase
            .from('elective_choices')
            .select(`
              *,
              courses(*)
            `)
            .eq('student_id', student.id)
            .eq('semester', currentSemester)
            .order('priority')

          if (preferencesError) {
            console.error('❌ Preferences query error:', preferencesError)
          } else if (preferences && preferences.length > 0) {
            console.log('✅ Loaded preferences:', preferences)
            setSelectedElectives(preferences.map(p => ({
              id: p.id,
              course_id: p.course_id,
              priority: p.priority,
              course: p.courses
            })))
          } else {
            console.log('ℹ️ No preferences found for student_id:', student.id, 'semester:', currentSemester)
            
            // Let's also check if there are ANY preferences for this student (any semester)
            const { data: allPreferences } = await supabase
              .from('elective_choices')
              .select('*')
              .eq('student_id', student.id)
            
            console.log('🔍 All preferences for this student (any semester):', allPreferences)
          }
        } else {
          console.log('❌ Student not found for user_id:', user.id)
        }
      }
    } catch (error: any) {
      setError('Failed to load data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const addElective = (course: ExtendedCourse) => {
    if (!preferenceCollectionOpen) {
      setError('Preference collection is currently closed. Please contact your administrator.')
      return
    }

    if (selectedElectives.length >= 5) {
      setError('You can select a maximum of 5 elective courses')
      return
    }

    if (selectedElectives.some(e => e.course_id === course.id)) {
      setError('This course is already selected')
      return
    }

    const newRank = selectedElectives.length + 1
    const newElective: ElectiveChoice = {
      id: `temp-${Date.now()}`,
      course_id: course.id,
      priority: newRank,
      course
    }

    setSelectedElectives([...selectedElectives, newElective])
    setError('')
  }

  const removeElective = (courseId: string) => {
    const updated = selectedElectives
      .filter(e => e.course_id !== courseId)
      .map((e, index) => ({ ...e, priority: index + 1 }))
    
    setSelectedElectives(updated)
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    
    const updated = [...selectedElectives]
    const temp = updated[index]
    updated[index] = updated[index - 1]
    updated[index - 1] = temp
    
    // Update ranks
    updated.forEach((e, i) => {
      e.priority = i + 1
    })
    
    setSelectedElectives(updated)
  }

  const moveDown = (index: number) => {
    if (index === selectedElectives.length - 1) return
    
    const updated = [...selectedElectives]
    const temp = updated[index]
    updated[index] = updated[index + 1]
    updated[index + 1] = temp
    
    // Update ranks
    updated.forEach((e, i) => {
      e.priority = i + 1
    })
    
    setSelectedElectives(updated)
  }

  const savePreferences = async () => {
    if (!user?.id) return

    // Check if preference collection is open
    if (!preferenceCollectionOpen) {
      setError('Preference collection is currently closed. Please contact your administrator.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      // Get student ID
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!student) {
        throw new Error('Student record not found')
      }

      // Get current semester
      const { SystemSettingsService } = await import('@/lib/systemSettingsService')
      const currentSemester = await SystemSettingsService.getCurrentSemester()

      // Delete existing preferences for this semester
      await supabase
        .from('elective_choices')
        .delete()
        .eq('student_id', student.id)
        .eq('semester', currentSemester)

      // Insert new preferences
      const preferences = selectedElectives.map(e => ({
        student_id: student.id,
        course_id: e.course_id,
        priority: e.priority,
        semester: currentSemester // Use current semester
      }))

      console.log('💾 Saving preferences:', preferences)

      const { data: insertData, error } = await supabase
        .from('elective_choices')
        .insert(preferences)
        .select()

      if (error) {
        console.error('❌ Save error:', error)
        throw error
      }

      console.log('✅ Preferences saved successfully:', insertData)
      setSuccess('Elective preferences saved successfully!')
      
      // Small delay to ensure database transaction is complete
      setTimeout(async () => {
        await reloadPreferences()
      }, 500)
    } catch (error: any) {
      setError('Failed to save preferences: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Elective Preferences</h1>
            <p className="text-gray-600">Select and rank your preferred elective courses</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Selected: {selectedElectives.length}/5</p>
            <p className="text-xs text-gray-500">Rank your preferences from 1 (highest) to 5 (lowest)</p>
          </div>
        </div>

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

        {/* Preference Collection Status */}
        <Alert variant={preferenceCollectionOpen ? "default" : "destructive"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>Preference Collection Status:</strong>{' '}
                {preferenceCollectionOpen ? (
                  <span className="text-green-600 font-semibold">OPEN</span>
                ) : (
                  <span className="text-red-600 font-semibold">CLOSED</span>
                )}
                {deadline && (
                  <span className="block text-sm mt-1">
                    Deadline: {new Date(deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Failed Courses for Irregular Students */}
        {isIrregular && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Failed Courses to Retake
              </CardTitle>
              <CardDescription>
                These are the courses you need to retake from previous levels
              </CardDescription>
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={debugIrregularData}
                  className="text-xs"
                >
                  🔍 Debug Data
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {failedCourses.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {failedCourses.map((req, index) => (
                      <div key={index} className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="bg-orange-100 text-orange-800">
                            Level {req.original_level}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {req.reason}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-sm">{req.course?.code}</h4>
                        <p className="text-xs text-gray-600 mb-2">{req.course?.title}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{req.course?.credits} credits</span>
                          {req.failed_semester && (
                            <span>Failed: {req.failed_semester}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> These failed courses are shown above for reference. 
                      You can select them as electives in the section below, along with your current level electives.
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-orange-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Failed Courses</h3>
                  <p className="text-gray-600 mb-4">
                    You don't have any failed courses to retake yet. You can select electives from your current level below.
                  </p>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> As an irregular student, you can select electives from your current level and any failed courses.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available Courses */}
          <Card>
            <CardHeader>
              <CardTitle>Available Elective Courses</CardTitle>
              <CardDescription>
                Click to add courses to your preferences
                {isIrregular && (
                  <div className="mt-2 space-y-1">
                    <span className="block text-blue-600 text-sm">
                      📚 As an irregular student, you can select from your current level electives and your failed courses (both compulsory and elective)
                    </span>
                    <div className="flex gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
                        <span>Current Level Electives</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                        <span>Failed Courses (Selectable)</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading courses...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        !preferenceCollectionOpen
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                          : selectedElectives.some(e => e.course_id === course.id)
                          ? 'border-green-200 bg-green-50 cursor-pointer'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                      }`}
                      onClick={() => preferenceCollectionOpen && addElective(course)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{course.code} - {course.title}</h4>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                course.is_failed_course
                                  ? 'bg-red-100 text-red-800 border-red-300' 
                                  : 'bg-blue-100 text-blue-800 border-blue-300'
                              }`}
                            >
                              Level {course.level}
                              {course.is_failed_course ? ' (Failed - Selectable)' : ' (Current Level)'}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {course.duration_hours} hours
                            </div>
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {(course as any).credits || 3} credits
                            </div>
                          </div>
                        </div>
                        {selectedElectives.some(e => e.course_id === course.id) ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Plus className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Your Preferences</CardTitle>
              <CardDescription>Drag to reorder or remove courses</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedElectives.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No courses selected yet</p>
                  <p className="text-sm">Choose courses from the left panel</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedElectives.map((elective, index) => (
                    <div key={elective.id} className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={() => moveUp(index)}
                              disabled={index === 0}
                              className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveDown(index)}
                              disabled={index === selectedElectives.length - 1}
                              className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              ↓
                            </button>
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary">#{elective.priority}</Badge>
                              <h4 className="font-medium">{elective.course.code}</h4>
                            </div>
                            <p className="text-sm text-gray-600">{elective.course.title}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeElective(elective.course_id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedElectives.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <Button 
                    onClick={savePreferences} 
                    disabled={saving || !preferenceCollectionOpen}
                    className="w-full"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving Preferences...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Save Preferences
                      </>
                    )}
                  </Button>
                  {!preferenceCollectionOpen && (
                    <p className="text-sm text-red-600 mt-2 text-center">
                      ⚠️ Preference collection is currently closed
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start space-x-2">
                <Star className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium">Rank Your Preferences</p>
                  <p className="text-gray-600">Use the up/down arrows to rank courses from 1 (highest preference) to 5 (lowest preference)</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <BookOpen className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium">Select Up to 5 Courses</p>
                  <p className="text-gray-600">Choose from available elective courses for your academic level</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Save Your Choices</p>
                  <p className="text-gray-600">Remember to save your preferences before the deadline</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
