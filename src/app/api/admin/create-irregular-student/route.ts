import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Regular supabase client for database operations
const supabase = createClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function generateEmail(fullName: string, studentNumber: string): string {
  // Convert name to lowercase and replace spaces with dots
  const namePart = fullName.toLowerCase().replace(/\s+/g, '.')
  return `${namePart}.${studentNumber}@university.edu`
}

function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    password += chars[randomIndex]
  }
  return password
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { studentData, requirements } = body

    if (!studentData.student_number || !studentData.full_name || !studentData.level) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!requirements || requirements.length === 0) {
      return NextResponse.json(
        { error: 'At least one course requirement is required' },
        { status: 400 }
      )
    }

    // Generate email and password for the student
    const email = generateEmail(studentData.full_name, studentData.student_number)
    const password = generatePassword()

    // Create auth user using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: studentData.full_name,
        role: 'student'
      }
    })

    if (authError) {
      return NextResponse.json(
        { error: `Failed to create auth user: ${authError.message}` },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'No user returned from auth creation' },
        { status: 500 }
      )
    }

    // Create user record
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        role: 'student'
      })

    if (userError) {
      return NextResponse.json(
        { error: `Failed to create user record: ${userError.message}` },
        { status: 500 }
      )
    }

    // Create student record
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        user_id: authData.user.id,
        student_number: studentData.student_number,
        full_name: studentData.full_name,
        level: studentData.level,
        student_group: null, // Irregular students have no group
        is_irregular: true,
        contact: studentData.contact
      })
      .select()
      .single()

    if (studentError) {
      return NextResponse.json(
        { error: `Failed to create student record: ${studentError.message}` },
        { status: 500 }
      )
    }

    // Create irregular course requirements
    const requirementsData = requirements.map((req: any) => ({
      student_id: student.id,
      course_id: req.course_id,
      original_level: req.original_level,
      failed_semester: req.failed_semester,
      reason: req.reason
    }))

    const { error: reqError } = await supabaseAdmin
      .from('irregular_course_requirements')
      .insert(requirementsData)

    if (reqError) {
      return NextResponse.json(
        { error: `Failed to create course requirements: ${reqError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      studentId: student.id,
      credentials: { email, password }
    })

  } catch (error: any) {
    console.error('Error creating irregular student:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
