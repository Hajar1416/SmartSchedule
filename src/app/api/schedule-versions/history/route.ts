import { NextResponse } from 'next/server'
import { ScheduleVersionService } from '@/lib/scheduleVersionService'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level')
    const semester = searchParams.get('semester')

    if (!level || !semester) {
      return NextResponse.json(
        { error: 'Level and semester are required' },
        { status: 400 }
      )
    }

    const history = await ScheduleVersionService.getVersionHistory(
      parseInt(level),
      semester
    )

    return NextResponse.json({
      success: true,
      history
    })
  } catch (error: any) {
    console.error('Error fetching version history:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

