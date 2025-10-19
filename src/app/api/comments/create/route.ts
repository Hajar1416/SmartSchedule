import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create admin client with service role key to bypass RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function POST(request: Request) {
  try {
    const { 
      userId, 
      userRole, 
      scheduleVersionId, 
      commentText, 
      commentType 
    } = await request.json()

    console.log('🔍 API: Creating comment for:', { userId, userRole })

    let studentId = null
    let facultyId = null

    // Find or create student/faculty record
    if (userRole === 'faculty') {
      // Try to find faculty record
      const { data: faculty, error: facultyError } = await supabaseAdmin
        .from('faculty')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!facultyError && faculty) {
        facultyId = faculty.id
        console.log('✅ Found faculty record:', faculty.id)
      } else {
        // Create faculty record
        console.log('🔧 Creating faculty record for user:', userId)
        
        // Get user details first
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('email, full_name')
          .eq('id', userId)
          .single()

        // Use full_name from users table if available, otherwise use email prefix
        const facultyName = userData?.full_name || userData?.email?.split('@')[0] || 'Faculty Member'
        const facultyNumber = userData?.email?.split('@')[0] || `FAC-${userId.slice(-6)}`

        const { data: newFaculty, error: createError } = await supabaseAdmin
          .from('faculty')
          .insert({
            user_id: userId,
            faculty_number: facultyNumber,
            full_name: facultyName,
            department: 'General',
            contact: ''
          })
          .select('id')
          .single()

        if (!createError && newFaculty) {
          facultyId = newFaculty.id
          console.log('✅ Created faculty record:', newFaculty.id)
        } else {
          console.error('❌ Failed to create faculty:', createError)
        }
      }
    } else {
      // Try to find student record
      const { data: student, error: studentError } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!studentError && student) {
        studentId = student.id
        console.log('✅ Found student record:', student.id)
      }
    }

    // Create comment using admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('schedule_comments')
      .insert({
        schedule_version_id: scheduleVersionId || null,
        irregular_schedule_id: null,
        student_id: studentId,
        faculty_id: facultyId,
        comment_text: commentText,
        comment_type: commentType,
        status: 'pending'
      })
      .select(`
        *,
        student:students!schedule_comments_student_id_fkey(full_name, student_number),
        faculty:faculty!schedule_comments_faculty_id_fkey(full_name, faculty_number, department)
      `)
      .single()

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    console.log('✅ Comment created successfully')

    return NextResponse.json({ 
      success: true, 
      comment: data 
    })

  } catch (error: any) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}

