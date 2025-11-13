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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const scheduleVersionId = searchParams.get('scheduleVersionId')
    const userRole = searchParams.get('userRole')
    const userId = searchParams.get('userId')

    console.log('🔍 API: Fetching comments', { scheduleVersionId, userRole, userId })

    let query = supabaseAdmin
      .from('schedule_comments')
      .select(`
        *,
        student:students!schedule_comments_student_id_fkey(
          full_name, 
          student_number,
          user:users!students_user_id_fkey(email, full_name)
        ),
        faculty:faculty!schedule_comments_faculty_id_fkey(
          full_name, 
          faculty_number, 
          department,
          user:users!faculty_user_id_fkey(email, full_name)
        ),
        schedule_version:schedule_versions!schedule_comments_schedule_version_id_fkey(level, semester, generated_at)
      `)

    // If scheduleVersionId is provided, filter by it
    if (scheduleVersionId) {
      query = query.eq('schedule_version_id', scheduleVersionId)
      console.log('🔍 Filtering by scheduleVersionId:', scheduleVersionId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    // Filter comments based on user role
    let filteredComments = data || []
    
    // If user is a student, filter out committee/load committee internal comments
    if (userRole === 'student' && data) {
      filteredComments = data.filter((comment: any) => {
        // Students can see:
        // 1. All comments made by students (student_id is not null)
        // 2. Comments made by regular faculty (faculty_id exists but department is NOT committee)
        // 3. They should NOT see committee-only internal comments (comments made by committee members)
        
        const isStudentComment = comment.student_id !== null
        const isFacultyComment = comment.faculty_id !== null
        const isCommitteeComment = isFacultyComment && (
          comment.faculty?.department === 'Scheduling Committee' || 
          comment.faculty?.department === 'Teaching Load Committee'
        )
        
        // Allow all student comments (they can see their own and other students' comments)
        if (isStudentComment) {
          return true
        }
        
        // Allow faculty comments that are NOT committee comments (regular faculty feedback)
        if (isFacultyComment && !isCommitteeComment) {
          return true
        }
        
        // Don't show committee-only internal comments (these are committee members discussing internally)
        // Note: admin_reply on student comments will still show because those comments have student_id
        return false
      })
      
      console.log(`📊 Filtered comments: ${filteredComments.length} of ${data.length} (hidden ${data.length - filteredComments.length} committee-only comments)`)
    }

    console.log(`✅ Found ${filteredComments.length} comments`)

    return NextResponse.json({ 
      success: true, 
      comments: filteredComments
    })

  } catch (error: any) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}

