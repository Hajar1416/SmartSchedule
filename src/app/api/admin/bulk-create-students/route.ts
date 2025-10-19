import { NextResponse } from 'next/server'
import { PasswordService } from '@/lib/passwordService'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { students } = body

    if (!students || !Array.isArray(students)) {
      return NextResponse.json(
        { error: 'Invalid students data' },
        { status: 400 }
      )
    }

    const credentials = await PasswordService.bulkCreateStudents(students)

    return NextResponse.json({ 
      credentials,
      count: credentials.length 
    })
  } catch (error: any) {
    console.error('Error bulk creating students:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

