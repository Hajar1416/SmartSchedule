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
    const { userId, fullName } = await request.json()

    console.log('🔄 Updating name for user:', userId, 'to:', fullName)

    // Update users table
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        full_name: fullName
      })
      .eq('id', userId)

    if (userError) {
      throw userError
    }

    // Update faculty table
    const { error: facultyError } = await supabaseAdmin
      .from('faculty')
      .update({
        full_name: fullName
      })
      .eq('user_id', userId)

    if (facultyError) {
      throw facultyError
    }

    console.log('✅ Name updated successfully')

    return NextResponse.json({ 
      success: true,
      message: 'Name updated successfully'
    })

  } catch (error: any) {
    console.error('Error updating name:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}

