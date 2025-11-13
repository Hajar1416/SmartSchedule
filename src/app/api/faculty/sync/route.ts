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
    const { userId } = await request.json()

    console.log('🔄 Syncing faculty record for user:', userId)

    // Get user details from users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    console.log('👤 User data:', userData)

    // Get faculty record
    const { data: faculty, error: facultyError } = await supabaseAdmin
      .from('faculty')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (facultyError || !faculty) {
      throw new Error('Faculty record not found')
    }

    console.log('👨‍🏫 Current faculty data:', faculty)

    // Update faculty record with proper information
    const facultyName = userData.full_name || userData.email?.split('@')[0] || faculty.full_name
    const facultyNumber = userData.email?.split('@')[0] || faculty.faculty_number

    const { data: updatedFaculty, error: updateError } = await supabaseAdmin
      .from('faculty')
      .update({
        full_name: facultyName,
        faculty_number: facultyNumber,
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    console.log('✅ Faculty record updated:', updatedFaculty)

    return NextResponse.json({ 
      success: true, 
      faculty: updatedFaculty 
    })

  } catch (error: any) {
    console.error('Error syncing faculty:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}

