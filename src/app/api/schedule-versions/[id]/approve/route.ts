import { NextResponse } from 'next/server'
import { ScheduleVersionService } from '@/lib/scheduleVersionService'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { approved_by } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Version ID is required' },
        { status: 400 }
      )
    }

    if (!approved_by) {
      return NextResponse.json(
        { error: 'Approved by user ID is required' },
        { status: 400 }
      )
    }

    await ScheduleVersionService.approveVersion(id, approved_by)

    return NextResponse.json({
      success: true
    })
  } catch (error: any) {
    console.error('Error approving version:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

