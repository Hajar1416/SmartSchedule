import { NextResponse } from 'next/server'
import { ScheduleVersionService } from '@/lib/scheduleVersionService'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { created_by, change_description } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Version ID is required' },
        { status: 400 }
      )
    }

    if (!created_by) {
      return NextResponse.json(
        { error: 'Created by user ID is required' },
        { status: 400 }
      )
    }

    const newVersion = await ScheduleVersionService.revertToVersion(
      id,
      created_by,
      change_description
    )

    return NextResponse.json({
      success: true,
      version: newVersion
    })
  } catch (error: any) {
    console.error('Error reverting to version:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

