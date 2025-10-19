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

export async function POST(request: Request) {
  try {
    const { email, password, role, student_number, level, contact, faculty_number, full_name, department } = await request.json()

    // Create auth user using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the user
    })

    if (authError) {
      // If user already exists, get their ID
      if (authError.message.includes('already registered')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = existingUsers.users.find(u => u.email === email)
        
        if (existingUser) {
          // Create user record
          const { error: userError } = await supabaseAdmin
            .from('users')
            .upsert({
              id: existingUser.id,
              email: email,
              full_name: full_name || null,
              role: role,
            })

          if (userError) throw userError

          // Create student record if role is student
          if (role === 'student') {
            const { error: studentError } = await supabaseAdmin
              .from('students')
              .upsert({
                user_id: existingUser.id,
                student_number: student_number,
                level: level,
                contact: contact || ''
              })

            if (studentError) throw studentError
          }

          // Create faculty record if role is faculty
          if (role === 'faculty') {
            const { error: facultyError } = await supabaseAdmin
              .from('faculty')
              .upsert({
                user_id: existingUser.id,
                faculty_number: faculty_number || email.split('@')[0], // Use email prefix as faculty number if not provided
                full_name: full_name || email.split('@')[0], // Use email prefix as name if not provided
                department: department || 'General',
                contact: contact || ''
              })

            if (facultyError) throw facultyError
          }

          return NextResponse.json({ 
            success: true, 
            message: 'User updated successfully',
            userId: existingUser.id 
          })
        } else {
          throw new Error('User exists in auth but not found')
        }
      } else {
        throw authError
      }
    }

    if (!authData.user) {
      throw new Error('Failed to create auth user')
    }

    // Create user record
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: full_name || null,
        role: role,
      })

    if (userError) throw userError

    // Create student record if role is student
    if (role === 'student') {
      const { error: studentError } = await supabaseAdmin
        .from('students')
        .insert({
          user_id: authData.user.id,
          student_number: student_number,
          level: level,
          contact: contact || ''
        })

      if (studentError) throw studentError
    }

    // Create faculty record if role is faculty
    if (role === 'faculty') {
      const { error: facultyError } = await supabaseAdmin
        .from('faculty')
        .insert({
          user_id: authData.user.id,
          faculty_number: faculty_number || email.split('@')[0], // Use email prefix as faculty number if not provided
          full_name: full_name || email.split('@')[0], // Use email prefix as name if not provided
          department: department || 'General',
          contact: contact || ''
        })

      if (facultyError) throw facultyError
    }

    return NextResponse.json({ 
      success: true, 
      message: 'User created successfully',
      userId: authData.user.id 
    })

  } catch (error: any) {
    console.error('Error creating user:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}
