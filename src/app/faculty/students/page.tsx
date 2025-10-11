'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { FacultyService, Faculty } from '@/lib/facultyService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import {
  Users,
  Search,
  Download,
  Mail,
  User,
  AlertCircle,
  BookOpen,
  Filter
} from 'lucide-react'

interface EnrolledStudent {
  id: string
  student_number: string
  full_name: string
  level: number
  group_name: string
  contact: string
  course_code: string
  course_title: string
  section_label: string
}

export default function FacultyStudentsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [students, setStudents] = useState<any[]>([])
  const [filteredStudents, setFilteredStudents] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.id) {
      loadStudents()
    }
  }, [user])

  useEffect(() => {
    filterStudents()
  }, [searchTerm, selectedCourse, students])

  const loadStudents = async () => {
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

      // Get enrolled students
      const enrolledStudents = await FacultyService.getEnrolledStudents(facultyData.id)
      
      // Transform data
      const transformedStudents = enrolledStudents.map((enrollment: any) => ({
        id: enrollment.students.id,
        student_number: enrollment.students.student_number,
        full_name: enrollment.students.full_name,
        level: enrollment.students.level,
        group_name: enrollment.students.student_group || 'N/A',
        contact: enrollment.students.contact,
        course_code: enrollment.course_sections?.courses?.code || 'N/A',
        course_title: enrollment.course_sections?.courses?.title || 'N/A',
        section_label: enrollment.course_sections?.section_label || 'A'
      }))

      setStudents(transformedStudents)
      setFilteredStudents(transformedStudents)

    } catch (error: any) {
      console.error('Error loading students:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const filterStudents = () => {
    let filtered = [...students]

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.contact.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by course
    if (selectedCourse && selectedCourse !== 'all') {
      filtered = filtered.filter(student => student.course_code === selectedCourse)
    }

    setFilteredStudents(filtered)
  }

  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return

    const headers = ['Student Number', 'Name', 'Level', 'Group', 'Email', 'Course', 'Section']
    const rows = filteredStudents.map(s => [
      s.student_number,
      s.full_name,
      s.level,
      s.group_name,
      s.contact,
      s.course_code,
      s.section_label
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `students-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Get unique courses
  const courses = Array.from(new Set(students.map(s => s.course_code)))

  // Group students by course
  const studentsByCourse = students.reduce((acc, student) => {
    if (!acc[student.course_code]) {
      acc[student.course_code] = {
        code: student.course_code,
        title: student.course_title,
        students: []
      }
    }
    acc[student.course_code].students.push(student)
    return acc
  }, {} as Record<string, any>)

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Students</h1>
            {faculty && (
              <p className="text-gray-600">
                Students enrolled in your courses • {faculty.department} Department
              </p>
            )}
          </div>
          <Button onClick={handleExportCSV} disabled={filteredStudents.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold">{students.length}</p>
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
                  <p className="text-2xl font-bold">{courses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Filtered</p>
                  <p className="text-2xl font-bold">{filteredStudents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Mail className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Avg per Course</p>
                  <p className="text-2xl font-bold">
                    {courses.length > 0 ? Math.round(students.length / courses.length) : 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, student number, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Courses</option>
                {courses.map(course => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Students List */}
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading students...</span>
            </CardContent>
          </Card>
        ) : filteredStudents.length > 0 ? (
          <div className="space-y-6">
            {(Object.values(studentsByCourse) as any[])
              .filter((course: any) => selectedCourse === 'all' || course.code === selectedCourse)
              .map((course: any) => (
                <Card key={course.code}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      {course.code} - {course.title}
                      <Badge variant="outline" className="ml-2">
                        {course.students.length} {course.students.length === 1 ? 'student' : 'students'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {course.students
                        .filter((student: any) =>
                          !searchTerm ||
                          student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.student_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.contact.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((student: any) => (
                          <div
                            key={student.id + student.course_code}
                            className="p-4 border rounded-lg flex items-center justify-between hover:bg-gray-50"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="p-2 bg-blue-100 rounded-full">
                                <User className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-medium">{student.full_name}</h4>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>{student.student_number}</span>
                                  <span>Level {student.level}</span>
                                  <span>Group {student.group_name}</span>
                                  <span>Section {student.section_label}</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.location.href = `mailto:${student.contact}`}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Email
                            </Button>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Found</h3>
              <p className="text-gray-600">
                {searchTerm || selectedCourse !== 'all'
                  ? 'Try adjusting your filters'
                  : 'You have no students enrolled in your courses yet'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}

