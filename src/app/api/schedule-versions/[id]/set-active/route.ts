import { NextResponse } from 'next/server'
import { ScheduleVersionService } from '@/lib/scheduleVersionService'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Version ID is required' },
        { status: 400 }
      )
    }

    await ScheduleVersionService.setActiveVersion(id)

    return NextResponse.json({
      success: true
    })
  } catch (error: any) {
    console.error('Error setting active version:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

