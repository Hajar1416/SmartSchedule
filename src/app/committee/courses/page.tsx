'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { CourseService, CreateCourseData } from '@/lib/courseService'
import { Course } from '@/lib/supabase'
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Filter,
  Clock,
  Users,
  Building,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

export default function CourseManagementPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Local form type to support UI-only field `course_category`, mapped to `course_type` on submit
  type CourseFormData = Omit<CreateCourseData, 'course_type'> & { course_category: 'compulsory' | 'elective' }

  // Form state
  const [formData, setFormData] = useState<CourseFormData>({
    code: '',
    title: '',
    level: 1,
    is_fixed: false,
    duration_hours: 1.5,
    allowable_rooms: [],
    course_category: 'compulsory',
    credits: 3,
    prerequisites: [],
    offered_semesters: ['Fall', 'Spring'],
    department: 'Computer Science'
  })

  const [roomInput, setRoomInput] = useState('')
  const [prerequisiteInput, setPrerequisiteInput] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Load courses on component mount
  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    try {
      setLoading(true)
      const data = await CourseService.getAllCourses()
      setCourses(data)
    } catch (error: any) {
      setError('Failed to load courses: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')
    setSuccess('')

    try {
      // Map course_category to course_type for database
      const dataToSubmit = {
        ...formData,
        course_type: formData.course_category,
        allowable_rooms: formData.allowable_rooms || [],
        prerequisites: formData.prerequisites || []
      }
      delete (dataToSubmit as any).course_category

      if (editingCourse) {
        await CourseService.updateCourse({
          id: editingCourse.id,
          ...dataToSubmit
        })
        setSuccess('Course updated successfully!')
      } else {
        await CourseService.createCourse(dataToSubmit)
        setSuccess('Course created successfully!')
      }
      
      await loadCourses()
      resetForm()
      setIsAddDialogOpen(false)
    } catch (error: any) {
      setError('Failed to save course: ' + error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return

    try {
      await CourseService.deleteCourse(id)
      setSuccess('Course deleted successfully!')
      await loadCourses()
    } catch (error: any) {
      setError('Failed to delete course: ' + error.message)
    }
  }

  const handleEdit = (course: Course) => {
    setEditingCourse(course)
    setFormData({
      code: course.code,
      title: course.title,
      level: course.level,
      is_fixed: course.is_fixed,
      duration_hours: course.duration_hours,
      allowable_rooms: course.allowable_rooms || [],
      course_category: (course as any).course_category || (course as any).course_type || 'compulsory',
      credits: (course as any).credits || 3,
      prerequisites: (course as any).prerequisites || [],
      offered_semesters: (course as any).offered_semesters || ['Fall', 'Spring'],
      department: (course as any).department || 'Computer Science'
    })
    setIsAddDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      code: '',
      title: '',
      level: 1,
      is_fixed: false,
      duration_hours: 1.5,
      allowable_rooms: [],
      course_category: 'compulsory',
      credits: 3,
      prerequisites: [],
      offered_semesters: ['Fall', 'Spring'],
      department: 'Computer Science'
    })
    setRoomInput('')
    setPrerequisiteInput('')
    setEditingCourse(null)
  }

  const addRoom = () => {
    const rooms = formData.allowable_rooms || []
    if (roomInput.trim() && !rooms.includes(roomInput.trim())) {
      setFormData({
        ...formData,
        allowable_rooms: [...rooms, roomInput.trim()]
      })
      setRoomInput('')
    }
  }

  const removeRoom = (room: string) => {
    setFormData({
      ...formData,
      allowable_rooms: (formData.allowable_rooms || []).filter(r => r !== room)
    })
  }

  const addPrerequisite = () => {
    if (prerequisiteInput.trim() && !formData.prerequisites!.includes(prerequisiteInput.trim())) {
      setFormData({
        ...formData,
        prerequisites: [...(formData.prerequisites || []), prerequisiteInput.trim()]
      })
      setPrerequisiteInput('')
    }
  }

  const removePrerequisite = (prereq: string) => {
    setFormData({
      ...formData,
      prerequisites: formData.prerequisites!.filter(p => p !== prereq)
    })
  }

  const toggleSemester = (semester: string) => {
    const current = formData.offered_semesters || []
    if (current.includes(semester)) {
      setFormData({
        ...formData,
        offered_semesters: current.filter(s => s !== semester)
      })
    } else {
      setFormData({
        ...formData,
        offered_semesters: [...current, semester]
      })
    }
  }

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesLevel = levelFilter === 'all' || course.level.toString() === levelFilter
    const matchesCategory = categoryFilter === 'all' || (course as any).course_type === categoryFilter
    return matchesSearch && matchesLevel && matchesCategory
  })

  return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Course Management</h1>
            <p className="text-gray-600">Manage courses, sections, and scheduling parameters</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Course
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCourse ? 'Edit Course' : 'Add New Course'}
                </DialogTitle>
                <DialogDescription>
                  {editingCourse ? 'Update course information' : 'Create a new course for the scheduling system'}
                </DialogDescription>
              </DialogHeader>
              
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

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Course Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({...formData, code: e.target.value})}
                      placeholder="e.g., CS101"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="level">Level *</Label>
                    <Select value={formData.level.toString()} onValueChange={(value) => setFormData({...formData, level: parseInt(value)})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Level 1</SelectItem>
                        <SelectItem value="2">Level 2</SelectItem>
                        <SelectItem value="3">Level 3</SelectItem>
                        <SelectItem value="4">Level 4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="title">Course Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g., Introduction to Programming"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="category">Course Category *</Label>
                    <Select 
                      value={formData.course_category} 
                      onValueChange={(value: 'compulsory' | 'elective') => setFormData({...formData, course_category: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compulsory">Compulsory (Required)</SelectItem>
                        <SelectItem value="elective">Elective (Optional)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="credits">Credits *</Label>
                    <Input
                      id="credits"
                      type="number"
                      value={formData.credits}
                      onChange={(e) => setFormData({...formData, credits: parseInt(e.target.value)})}
                      placeholder="3"
                      min="1"
                      max="6"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration (hours) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={formData.duration_hours}
                      onChange={(e) => setFormData({...formData, duration_hours: parseFloat(e.target.value)})}
                      placeholder="1.5"
                      min="0.5"
                      max="3"
                      step="0.5"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    placeholder="e.g., Computer Science"
                    required
                  />
                </div>

                <div>
                  <Label>Offered Semesters</Label>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="fall"
                        checked={formData.offered_semesters?.includes('Fall')}
                        onCheckedChange={() => toggleSemester('Fall')}
                      />
                      <Label htmlFor="fall">Fall</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="spring"
                        checked={formData.offered_semesters?.includes('Spring')}
                        onCheckedChange={() => toggleSemester('Spring')}
                      />
                      <Label htmlFor="spring">Spring</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="summer"
                        checked={formData.offered_semesters?.includes('Summer')}
                        onCheckedChange={() => toggleSemester('Summer')}
                      />
                      <Label htmlFor="summer">Summer</Label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_fixed"
                    checked={formData.is_fixed}
                    onCheckedChange={(checked) => setFormData({...formData, is_fixed: !!checked})}
                  />
                  <Label htmlFor="is_fixed">Fixed Schedule (managed by another department)</Label>
                </div>

                <div>
                  <Label>Prerequisites (Course Codes)</Label>
                  <div className="flex space-x-2 mt-1">
                    <Input
                      value={prerequisiteInput}
                      onChange={(e) => setPrerequisiteInput(e.target.value)}
                      placeholder="e.g., CS101"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPrerequisite())}
                    />
                    <Button type="button" onClick={addPrerequisite} variant="outline">
                      Add
                    </Button>
                  </div>
                  {formData.prerequisites && formData.prerequisites.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.prerequisites.map((prereq, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {prereq}
                          <button
                            type="button"
                            onClick={() => removePrerequisite(prereq)}
                            className="ml-1 hover:text-red-600"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Allowable Rooms</Label>
                  <div className="flex space-x-2 mt-1">
                    <Input
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      placeholder="e.g., A101"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRoom())}
                    />
                    <Button type="button" onClick={addRoom} variant="outline">
                      Add
                    </Button>
                  </div>
                  {formData.allowable_rooms && formData.allowable_rooms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.allowable_rooms.map((room, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {room}
                          <button
                            type="button"
                            onClick={() => removeRoom(room)}
                            className="ml-1 hover:text-red-600"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={formLoading}>
                    {formLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingCourse ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingCourse ? 'Update Course' : 'Create Course'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search courses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="4">Level 4</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="compulsory">Compulsory</SelectItem>
                    <SelectItem value="elective">Elective</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

        {/* Courses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Courses ({filteredCourses.length})</CardTitle>
            <CardDescription>Manage all courses in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading courses...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCourses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No courses found. Create your first course to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCourses.map((course) => {
                      const courseCategory = (course as any).course_type || 'compulsory'
                      const credits = (course as any).credits || 3
                      const department = (course as any).department || 'N/A'
                      
                      return (
                        <TableRow key={course.id}>
                          <TableCell className="font-medium">{course.code}</TableCell>
                          <TableCell>{course.title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">Level {course.level}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={courseCategory === 'elective' ? "default" : "outline"}>
                              {courseCategory === 'elective' ? '📚 Elective' : '✓ Compulsory'}
                            </Badge>
                          </TableCell>
                          <TableCell>{credits} CR</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Clock className="mr-1 h-4 w-4 text-gray-400" />
                              {course.duration_hours} hrs
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{department}</TableCell>
                          <TableCell>
                            <Badge variant={course.is_fixed ? "destructive" : "secondary"}>
                              {course.is_fixed ? "Fixed" : "Flexible"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(course)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDelete(course.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{courses.length}</p>
                  <p className="text-sm text-gray-600">Total Courses</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">
                    {courses.filter(c => (c as any).course_type === 'compulsory').length}
                  </p>
                  <p className="text-sm text-gray-600">Compulsory</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">
                    {courses.filter(c => (c as any).course_type === 'elective').length}
                  </p>
                  <p className="text-sm text-gray-600">Electives</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">
                    {courses.filter(c => !c.is_fixed).length}
                  </p>
                  <p className="text-sm text-gray-600">Flexible</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">
                    {new Set(courses.flatMap(course => course.allowable_rooms)).size}
                  </p>
                  <p className="text-sm text-gray-600">Unique Rooms</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
