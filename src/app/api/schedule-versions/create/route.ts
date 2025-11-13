import { NextResponse } from 'next/server'
import { ScheduleVersionService } from '@/lib/scheduleVersionService'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      level,
      semester,
      groups,
      total_sections,
      conflicts,
      efficiency,
      created_by,
      change_description,
      parent_version_id,
      status,
      is_active
    } = body

    if (!level || !semester || !groups) {
      return NextResponse.json(
        { error: 'Level, semester, and groups are required' },
        { status: 400 }
      )
    }

    const newVersion = await ScheduleVersionService.createVersion({
      level,
      semester,
      groups,
      total_sections: total_sections || 0,
      conflicts: conflicts || 0,
      efficiency: efficiency || null,
      created_by,
      change_description,
      parent_version_id,
      status,
      is_active
    })

    return NextResponse.json({
      success: true,
      version: newVersion
    })
  } catch (error: any) {
    console.error('Error creating version:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

