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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json(
        { error: 'commentId is required' },
        { status: 400 }
      )
    }

    console.log('🔍 API: Deleting comment:', commentId)

    // Delete comment using admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('schedule_comments')
      .delete()
      .eq('id', commentId)
      .select()

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    if (!data || data.length === 0) {
      console.error('❌ No comment found to delete')
      return NextResponse.json({ 
        error: 'Comment not found or already deleted'
      }, { status: 404 })
    }

    console.log('✅ Comment deleted successfully:', data[0])

    return NextResponse.json({ 
      success: true,
      deletedComment: data[0]
    })

  } catch (error: any) {
    console.error('Error deleting comment:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}

