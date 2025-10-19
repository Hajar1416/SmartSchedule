'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { IrregularStudentService, IrregularCourseRequirement } from '@/lib/irregularStudentService'

interface Course {
  id: string
  code: string
  title: string
  level: number
  credits: number
}

export default function CreateIrregularStudentPage() {
  const { user, userRole, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [studentData, setStudentData] = useState({
    student_number: '',
    full_name: '',
    level: 4,
    contact: ''
  })

  const [selectedLevel, setSelectedLevel] = useState(4)
  const [availableLevels] = useState([4, 6, 8])
  const [coursesByLevel, setCoursesByLevel] = useState<Record<number, Course[]>>({})
  const [selectedCourses, setSelectedCourses] = useState<IrregularCourseRequirement[]>([])

  useEffect(() => {
    if (!authLoading && userRole) {
      if (!user || (userRole !== 'scheduling_committee' && userRole !== 'admin')) {
        router.push('/login')
      } else {
        loadCourses()
      }
    }
  }, [user, userRole, authLoading, router])

  const loadCourses = async () => {
    setLoading(true)
    try {
      // Load courses for levels 1-7 (for failed courses)
      const levels = [1, 2, 3, 4, 5, 6, 7]
      const coursesData: Record<number, Course[]> = {}

      for (const level of levels) {
        const courses = await IrregularStudentService.getCoursesByLevel(level)
        coursesData[level] = courses
      }

      setCoursesByLevel(coursesData)
    } catch (error) {
      console.error('Error loading courses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCourseToggle = (course: Course, checked: boolean) => {
    if (checked) {
      setSelectedCourses([
        ...selectedCourses,
        {
          course_id: course.id,
          original_level: course.level,
          failed_semester: '',
          reason: 'failed'
        }
      ])
    } else {
      setSelectedCourses(selectedCourses.filter((c) => c.course_id !== course.id))
    }
  }

  const updateCourseRequirement = (courseId: string, field: string, value: string) => {
    setSelectedCourses(
      selectedCourses.map((c) =>
        c.course_id === courseId ? { ...c, [field]: value } : c
      )
    )
  }

  const handleSubmit = async () => {
    if (!studentData.student_number || !studentData.full_name) {
      alert('Please fill in student number and full name')
      return
    }

    if (selectedCourses.length === 0) {
      alert('Please select at least one course from previous levels')
      return
    }

    setLoading(true)
    try {
      const result = await IrregularStudentService.createIrregularStudent(
        studentData,
        selectedCourses
      )

      if (result.success) {
        // Show success message with credentials
        const credentials = result.credentials
        if (credentials) {
          alert(`✅ Irregular student created successfully!

Login Credentials:
Email: ${credentials.email}
Password: ${credentials.password}

Please save these credentials securely!`)
        } else {
          alert('✅ Irregular student created successfully!')
        }
        
        // Reset form
        setStudentData({
          student_number: '',
          full_name: '',
          level: 4,
          contact: ''
        })
        setSelectedCourses([])
      } else {
        alert(`❌ Failed to create student: ${result.error}`)
      }
    } catch (error) {
      console.error('Error creating irregular student:', error)
      alert('❌ An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading && Object.keys(coursesByLevel).length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading courses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create Irregular Student</h1>

        <Card className="mb-6 bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-lg">What is an Irregular Student?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              ⚠️ Irregular students have <strong>failed or missed courses</strong> from previous
              levels
            </p>
            <p>
              📚 They are officially enrolled in Level {studentData.level} but must retake courses
              from lower levels
            </p>
            <p>
              📅 They will receive a <strong>personalized schedule</strong> mixing courses from
              multiple levels
            </p>
            <p>
              🚫 Levels 4, 6, 8 are designated for irregular students (along with regular students)
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
            <CardDescription>Basic details about the irregular student</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="student_number">Student Number *</Label>
                <Input
                  id="student_number"
                  value={studentData.student_number}
                  onChange={(e) =>
                    setStudentData({ ...studentData, student_number: e.target.value })
                  }
                  placeholder="e.g., CS2021001"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={studentData.full_name}
                  onChange={(e) =>
                    setStudentData({ ...studentData, full_name: e.target.value })
                  }
                  placeholder="e.g., Ahmed Ali"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="level">Enrolled Level *</Label>
                <select
                  id="level"
                  value={studentData.level}
                  onChange={(e) =>
                    setStudentData({ ...studentData, level: parseInt(e.target.value) })
                  }
                  className="w-full mt-2 border rounded px-3 py-2"
                >
                  {availableLevels.map((level) => (
                    <option key={level} value={level}>
                      Level {level}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Irregular students can only be in Level 4, 6, or 8
                </p>
              </div>

              <div>
                <Label htmlFor="contact">Contact (Optional)</Label>
                <Input
                  id="contact"
                  value={studentData.contact}
                  onChange={(e) =>
                    setStudentData({ ...studentData, contact: e.target.value })
                  }
                  placeholder="e.g., ahmed@university.edu"
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Failed/Missing Courses</CardTitle>
            <CardDescription>
              Select courses from previous levels that this student needs to retake
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Level Selector for Courses */}
              <div>
                <Label>Select Level to View Courses</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((level) => (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      className={`px-3 py-1 rounded text-sm ${
                        selectedLevel === level
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Level {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Courses List */}
              <div>
                <h3 className="font-semibold mb-3">
                  Level {selectedLevel} Courses ({coursesByLevel[selectedLevel]?.length || 0})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto border rounded p-4">
                  {coursesByLevel[selectedLevel]?.map((course) => {
                    const isSelected = selectedCourses.some((c) => c.course_id === course.id)
                    return (
                      <div
                        key={course.id}
                        className={`border rounded p-3 ${
                          isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleCourseToggle(course, checked as boolean)
                            }
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{course.title}</p>
                                <p className="text-sm text-gray-600">
                                  {course.code} • {course.credits} credits
                                </p>
                              </div>
                              <Badge variant="outline">Level {course.level}</Badge>
                            </div>

                            {isSelected && (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Failed Semester (e.g., Fall 2023)"
                                  value={
                                    selectedCourses.find((c) => c.course_id === course.id)
                                      ?.failed_semester || ''
                                  }
                                  onChange={(e) =>
                                    updateCourseRequirement(
                                      course.id,
                                      'failed_semester',
                                      e.target.value
                                    )
                                  }
                                  className="text-sm"
                                />
                                <select
                                  value={
                                    selectedCourses.find((c) => c.course_id === course.id)
                                      ?.reason || 'failed'
                                  }
                                  onChange={(e) =>
                                    updateCourseRequirement(course.id, 'reason', e.target.value)
                                  }
                                  className="text-sm border rounded px-2 py-1"
                                >
                                  <option value="failed">Failed</option>
                                  <option value="medical_leave">Medical Leave</option>
                                  <option value="transfer">Transfer Credit Missing</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedCourses.length > 0 && (
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold mb-2">
                {studentData.full_name || 'Student'} will retake {selectedCourses.length} course(s):
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {selectedCourses.map((req) => {
                  const course = Object.values(coursesByLevel)
                    .flat()
                    .find((c) => c.id === req.course_id)
                  return (
                    <li key={req.course_id}>
                      {course?.code} - {course?.title} (Level {req.original_level})
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={() => {
              setStudentData({
                student_number: '',
                full_name: '',
                level: 4,
                contact: ''
              })
              setSelectedCourses([])
            }}
            disabled={loading}
          >
            Reset
          </Button>
          <Button onClick={handleSubmit} disabled={loading || selectedCourses.length === 0}>
            {loading ? 'Creating...' : 'Create Irregular Student'}
          </Button>
        </div>
      </div>
    </div>
  )
}

