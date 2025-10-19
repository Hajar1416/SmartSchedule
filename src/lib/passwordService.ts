import { supabase, supabaseAdmin } from './supabase'

export interface GeneratedCredentials {
  email: string
  password: string
  studentNumber: string
  fullName: string
  group?: string
  level?: number
}

export class PasswordService {
  /**
   * Generate a random password for students
   * Format: 8 characters with uppercase letters and numbers
   */
  static generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let password = ''
    
    for (let i = 0; i < 8; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length)
      password += chars[randomIndex]
    }
    
    return password
  }

  /**
   * Generate email from student name and number
   * Format: firstname.lastname@university.edu or student{number}@university.edu
   */
  static generateEmail(fullName: string, studentNumber: string): string {
    const cleanName = fullName.toLowerCase().trim()
    const nameParts = cleanName.split(' ')
    
    if (nameParts.length >= 2) {
      const firstName = nameParts[0].replace(/[^a-z]/g, '')
      const lastName = nameParts[nameParts.length - 1].replace(/[^a-z]/g, '')
      return `${firstName}.${lastName}@university.edu`
    }
    
    // Fallback: use student number
    return `student${studentNumber}@university.edu`
  }

  /**
   * Create a new student with auto-generated credentials
   */
  static async createStudentWithCredentials(
    fullName: string,
    studentNumber: string,
    level: number,
    contact?: string
  ): Promise<GeneratedCredentials> {
    try {
      // Generate email and password
      const email = this.generateEmail(fullName, studentNumber)
      const password = this.generatePassword()

      // Create auth user in Supabase using admin client
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: 'student'
        }
      })

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`)
      }

      if (!authData.user) {
        throw new Error('No user returned from auth creation')
      }

      // Create user record
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          role: 'student'
        })

      if (userError) {
        throw new Error(`Failed to create user record: ${userError.message}`)
      }

      // Create student record with generated password stored
      // Group will be auto-assigned by database trigger based on capacity
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .insert({
          user_id: authData.user.id,
          student_number: studentNumber,
          full_name: fullName,
          level,
          contact: contact || null,
          generated_password: password,
          password_changed: false
          // student_group will be auto-assigned by trigger
        })
        .select('student_group')
        .single()

      if (studentError) {
        throw new Error(`Failed to create student record: ${studentError.message}`)
      }

      return {
        email,
        password,
        studentNumber,
        fullName,
        group: studentData?.student_group || 'A',
        level
      }
    } catch (error: any) {
      console.error('Error creating student with credentials:', error)
      throw error
    }
  }

  /**
   * Bulk create students with auto-generated credentials
   */
  static async bulkCreateStudents(
    students: Array<{
      fullName: string
      studentNumber: string
      level: number
      contact?: string
    }>
  ): Promise<GeneratedCredentials[]> {
    const credentials: GeneratedCredentials[] = []
    const errors: Array<{ studentNumber: string; error: string }> = []

    for (const student of students) {
      try {
        const creds = await this.createStudentWithCredentials(
          student.fullName,
          student.studentNumber,
          student.level,
          student.contact
        )
        credentials.push(creds)
      } catch (error: any) {
        errors.push({
          studentNumber: student.studentNumber,
          error: error.message
        })
      }
    }

    if (errors.length > 0) {
      console.warn('Some students failed to create:', errors)
    }

    return credentials
  }

  /**
   * Export credentials to CSV format for download
   */
  static exportCredentialsToCSV(credentials: GeneratedCredentials[]): string {
    const headers = 'Full Name,Student Number,Level,Group,Email,Password\n'
    const rows = credentials.map(c => 
      `"${c.fullName}","${c.studentNumber}","${c.level || 'N/A'}","${c.group || 'A'}","${c.email}","${c.password}"`
    ).join('\n')
    
    return headers + rows
  }

  /**
   * Download credentials as CSV file
   */
  static downloadCredentialsCSV(credentials: GeneratedCredentials[], filename: string = 'student_credentials.csv') {
    const csv = this.exportCredentialsToCSV(credentials)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  /**
   * Get student credentials (for admin viewing only)
   */
  static async getStudentCredentials(studentId: string): Promise<{ email: string; password: string } | null> {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('generated_password, users(email)')
        .eq('id', studentId)
        .single()

      if (error || !data) {
        return null
      }

      return {
        email: (data.users as any)?.email || '',
        password: data.generated_password || 'N/A'
      }
    } catch (error) {
      console.error('Error fetching student credentials:', error)
      return null
    }
  }

  /**
   * Reset student password
   */
  static async resetStudentPassword(studentId: string): Promise<string> {
    try {
      const newPassword = this.generatePassword()

      // Get student's user_id
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('user_id')
        .eq('id', studentId)
        .single()

      if (studentError || !student) {
        throw new Error('Student not found')
      }

      // Update password in auth using admin client
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        student.user_id,
        { password: newPassword }
      )

      if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`)
      }

      // Update stored password
      await supabase
        .from('students')
        .update({ 
          generated_password: newPassword,
          password_changed: false
        })
        .eq('id', studentId)

      return newPassword
    } catch (error: any) {
      console.error('Error resetting password:', error)
      throw error
    }
  }

  /**
   * Mark password as changed by student
   */
  static async markPasswordAsChanged(studentId: string): Promise<void> {
    await supabase
      .from('students')
      .update({ password_changed: true })
      .eq('id', studentId)
  }
}

