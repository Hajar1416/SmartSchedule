import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    if (!studentId) {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Debug: Checking irregular requirements for student:', studentId)

    // First check if student exists and is irregular
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, full_name, is_irregular, level')
      .eq('id', studentId)
      .single()

    if (studentError) {
      return NextResponse.json({
        success: false,
        error: `Student not found: ${studentError.message}`,
        studentExists: false
      })
    }

    console.log('✅ Student found:', student)

    // Check if table exists and get structure
    const { data: requirements, error } = await supabase
      .from('irregular_course_requirements')
      .select(`
        *,
        course:courses(id, code, title, level, credits)
      `)
      .eq('student_id', studentId)

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        tableExists: false,
        student: student
      })
    }

    console.log('✅ Requirements found:', requirements)

    return NextResponse.json({
      success: true,
      data: requirements,
      count: requirements?.length || 0,
      tableExists: true,
      student: student
    })

  } catch (error: any) {
    console.error('Debug API error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        type: 'exception'
      },
      { status: 500 }
    )
  }
}
