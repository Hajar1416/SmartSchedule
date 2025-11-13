import { NextResponse } from 'next/server'
import { ScheduleVersionService } from '@/lib/scheduleVersionService'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const version1Id = searchParams.get('version1')
    const version2Id = searchParams.get('version2')

    if (!version1Id || !version2Id) {
      return NextResponse.json(
        { error: 'Both version1 and version2 IDs are required' },
        { status: 400 }
      )
    }

    const diff = await ScheduleVersionService.compareVersions(version1Id, version2Id)

    return NextResponse.json({
      success: true,
      diff
    })
  } catch (error: any) {
    console.error('Error comparing versions:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

