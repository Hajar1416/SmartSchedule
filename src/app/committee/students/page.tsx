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
import { StudentService, CreateStudentData } from '@/lib/studentService'
import { Student } from '@/lib/supabase'

// Extend Student with optional joined users relation for UI
interface StudentWithUser extends Student {
  users?: { email?: string; role?: string }
}
import { 
  GraduationCap, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Filter,
  Mail,
  Phone,
  User,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

export default function StudentManagementPage() {
  const [students, setStudents] = useState<StudentWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<StudentWithUser | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState<CreateStudentData>({
    user_id: '',
    student_number: '',
    level: 1,
    contact: ''
  })

  // Load students on component mount
  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    try {
      setLoading(true)
      const data = await StudentService.getAllStudents()
      setStudents(data as unknown as StudentWithUser[])
    } catch (error: any) {
      setError('Failed to load students: ' + error.message)
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
      if (editingStudent) {
        await StudentService.updateStudent({
          id: editingStudent.id,
          ...formData
        })
        setSuccess('Student updated successfully!')
      } else {
        await StudentService.createStudent(formData)
        setSuccess('Student created successfully!')
      }
      
      await loadStudents()
      resetForm()
      setIsAddDialogOpen(false)
    } catch (error: any) {
      setError('Failed to save student: ' + error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return

    try {
      await StudentService.deleteStudent(id)
      setSuccess('Student deleted successfully!')
      await loadStudents()
    } catch (error: any) {
      setError('Failed to delete student: ' + error.message)
    }
  }

  const handleEdit = (student: StudentWithUser) => {
    setEditingStudent(student)
    setFormData({
      user_id: student.user_id,
      student_number: student.student_number,
      level: student.level,
      contact: student.contact || ''
    })
    setIsAddDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      user_id: '',
      student_number: '',
      level: 1,
      contact: ''
    })
    setEditingStudent(null)
  }

  const filteredStudents = students.filter(student => {
    const q = searchTerm.toLowerCase()
    const emailLower = (student.users?.email || '').toLowerCase()
    const contactLower = (student.contact || '').toLowerCase()
    const matchesSearch = student.student_number.toLowerCase().includes(q) ||
                         emailLower.includes(q) ||
                         contactLower.includes(q)
    const matchesLevel = levelFilter === 'all' || student.level.toString() === levelFilter
    return matchesSearch && matchesLevel
  })

  return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Student Management</h1>
            <p className="text-gray-600">Manage student records and information</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingStudent ? 'Edit Student' : 'Add New Student'}
                </DialogTitle>
                <DialogDescription>
                  {editingStudent ? 'Update student information' : 'Create a new student record'}
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
                <div>
                  <Label htmlFor="student_number">Student Number *</Label>
                  <Input
                    id="student_number"
                    value={formData.student_number}
                    onChange={(e) => setFormData({...formData, student_number: e.target.value})}
                    placeholder="e.g., 2024001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="level">Academic Level *</Label>
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

                <div>
                  <Label htmlFor="contact">Contact Information</Label>
                  <Input
                    id="contact"
                    value={formData.contact}
                    onChange={(e) => setFormData({...formData, contact: e.target.value})}
                    placeholder="Phone number or additional contact info"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={formLoading}>
                    {formLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingStudent ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingStudent ? 'Update Student' : 'Create Student'
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
                    placeholder="Search students..."
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

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle>Students ({filteredStudents.length})</CardTitle>
            <CardDescription>Manage all students in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading students...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Number</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No students found. Create your first student to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.student_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Mail className="mr-1 h-4 w-4 text-gray-400" />
                            {student.users?.email ? (
                              <span className="text-green-600">{student.users.email}</span>
                            ) : student.contact ? (
                              <span className="text-orange-600" title="Email from contact field - no auth account linked">
                                {student.contact}
                              </span>
                            ) : (
                              'No email linked'
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Level {student.level}</Badge>
                        </TableCell>
                        <TableCell>
                          {student.contact ? (
                            <div className="flex items-center">
                              <Phone className="mr-1 h-4 w-4 text-gray-400" />
                              {student.contact}
                            </div>
                          ) : (
                            <span className="text-gray-400">No contact info</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(student)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(student.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <GraduationCap className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{students.length}</p>
                  <p className="text-sm text-gray-600">Total Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <User className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">
                    {students.filter(s => s.level === 1).length}
                  </p>
                  <p className="text-sm text-gray-600">Level 1 Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Mail className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">
                    {students.filter(s => s.contact).length}
                  </p>
                  <p className="text-sm text-gray-600">With Contact Info</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Phone className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">
                    {new Set(students.map(s => s.level)).size}
                  </p>
                  <p className="text-sm text-gray-600">Active Levels</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
