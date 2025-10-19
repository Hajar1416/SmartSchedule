import { supabase } from './supabase'
import { Student } from './supabase'

// Returned rows include a joined users relation with email and role
export interface StudentWithUser extends Student {
  users?: { email?: string; role?: string }
}

export interface CreateStudentData {
  user_id: string
  student_number: string
  level: number
  contact?: string
}

export interface UpdateStudentData extends Partial<CreateStudentData> {
  id: string
}

export class StudentService {
  static async getAllStudents(): Promise<StudentWithUser[]> {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        users(email, role)
      `)
      .order('level', { ascending: true })
      .order('student_number', { ascending: true })

    if (error) throw error
    return (data || []) as unknown as StudentWithUser[]
  }

  static async getStudentById(id: string): Promise<StudentWithUser | null> {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        users(email, role)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return (data as unknown as StudentWithUser) || null
  }

  static async createStudent(studentData: CreateStudentData): Promise<StudentWithUser> {
    const { data, error } = await supabase
      .from('students')
      .insert(studentData)
      .select(`
        *,
        users(email, role)
      `)
      .single()

    if (error) throw error
    return data as unknown as StudentWithUser
  }

  static async updateStudent(studentData: UpdateStudentData): Promise<StudentWithUser> {
    const { id, ...updateData } = studentData
    const { data, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        users(email, role)
      `)
      .single()

    if (error) throw error
    return data as unknown as StudentWithUser
  }

  static async deleteStudent(id: string): Promise<void> {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  static async getStudentsByLevel(level: number): Promise<StudentWithUser[]> {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        users(email, role)
      `)
      .eq('level', level)
      .order('student_number', { ascending: true })

    if (error) throw error
    return (data || []) as unknown as StudentWithUser[]
  }
}
