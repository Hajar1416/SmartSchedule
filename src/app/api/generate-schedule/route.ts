import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { supabase } from '@/lib/supabase'

const groqApiKey = (process.env.GROQ_API_KEY || '').trim()

if (!groqApiKey) {
  console.error('GROQ_API_KEY is not set in environment variables')
} else {
  const masked = groqApiKey.length > 8 ? `${groqApiKey.slice(0,4)}...${groqApiKey.slice(-4)}` : '****'
  console.log(`Using GROQ_API_KEY (masked): ${masked}`)
}

const groq = new Groq({
  apiKey: groqApiKey || undefined,
})

export interface ScheduleRecommendation {
  course_code: string
  section_label: string
  timeslot: {
    day: string
    start: string
    end: string
  }
  room: string
  allocated_student_ids: string[]
  justification: string
  confidence_score: number
}

export interface SchedulingConstraints {
  students_per_course: Record<string, number>
  blocked_slots: Array<{ day: string; start: string; end: string }>
  available_rooms: string[]
  rules: any[]
  objective_priorities: {
    minimize_conflicts: boolean
    minimize_gaps: boolean
    balance_instructor_loads: boolean
  }
}

export async function POST(request: NextRequest) {
  try {
    const { constraints: _incomingConstraints, level } = await request.json()

    if (!level) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Validate API key format early to avoid confusing 401s from SDK
    if (!groqApiKey || !groqApiKey.startsWith('gsk_')) {
      return NextResponse.json({ error: 'GROQ_API_KEY missing or malformed' }, { status: 500 })
    }

    // Load dynamic scheduling policy from DB
    const { data: policyRow } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'scheduling_policy')
      .single()

    const policy = (policyRow as any)?.setting_value || {}
    const availableDays: string[] = policy.allow_days || ['Monday','Tuesday','Wednesday','Thursday']
    const startTime: string = policy.start_time || '08:00'
    const endTime: string = policy.end_time || '18:00'

    // Load level group sizing to set section capacity guidance
    const { data: levelRow } = await supabase
      .from('level_group_settings')
      .select('students_per_group, group_names')
      .eq('level', level)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const studentsPerGroup = (levelRow as any)?.students_per_group || 25

    // Load active rule definitions from DB and scope to this level
    const { data: ruleRows } = await supabase
      .from('rule_definitions')
      .select('rule_text, rule_category, is_active, applies_to_levels')
      .eq('is_active', true)

    const activeRules: string[] = (ruleRows || [])
      .filter((r: any) => !r.applies_to_levels || r.applies_to_levels.length === 0 || (r.applies_to_levels as number[]).includes(level))
      .map((r: any) => r.rule_text)

    const finalRules = [...activeRules]

    // Load rooms from DB
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('name')

    const availableRooms: string[] = (roomsData || []).map((r: any) => r.name).filter(Boolean)

    // Load courses for this level (metadata used by the model)
    const { data: coursesData } = await supabase
      .from('courses')
      .select('code, title, level, course_type, is_lab, duration_hours, allowable_rooms, required_hours')
      .eq('level', level)

    // Load students count for this level
    const { count: studentCountExact } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('level', level)

    const totalStudents = studentCountExact || 0
    const totalCourses = (coursesData || []).length || 1
    const perCourse = Math.ceil(totalStudents / totalCourses)
    const studentsPerCourse: Record<string, number> = {}
    ;(coursesData || []).forEach((c: any) => {
      studentsPerCourse[c.code] = perCourse
    })

    // Enforce a universal 12:00-13:00 break (Mon-Thu) regardless of incoming constraints
    const enforcedBreak = [
      { day: 'Monday', start: '12:00', end: '13:00' },
      { day: 'Tuesday', start: '12:00', end: '13:00' },
      { day: 'Wednesday', start: '12:00', end: '13:00' },
      { day: 'Thursday', start: '12:00', end: '13:00' }
    ]

    const mergedBlockedSlots = enforcedBreak

    // Deduplicate blocked slots by (day,start,end)
    const dedupBlockedSlots = Array.from(
      new Map(
        mergedBlockedSlots.map((b: any) => [`${b.day}|${b.start}|${b.end}`, b])
      ).values()
    )

    const prompt = `
You are an academic timetable optimizer. Generate a schedule for level ${level} students.

⚠️ CRITICAL BREAK TIME REQUIREMENT ⚠️
MANDATORY BREAK: 12:00 PM - 1:00 PM (1 hour) on Monday, Tuesday, Wednesday, and Thursday
- The entire 12:00-13:00 time block must be COMPLETELY FREE
- Classes MUST END BEFORE 12:00 PM (e.g., end at 11:30 AM or 11:00 AM)
- OR classes MUST START AT OR AFTER 1:00 PM (e.g., start at 1:00 PM or 1:30 PM)
- NO class can have an end time of 12:00 PM or later if it started before 12:00 PM
- NO class can have a start time before 1:00 PM if it ends after 12:00 PM
- This break time is SACRED and MUST NOT be violated under any circumstances
- Example VALID schedules: 9:00-11:30, 10:00-12:00 is INVALID (ends AT 12:00), 1:00-2:30, 1:30-3:00
- Example INVALID schedules: 9:30-12:00 (touches break), 10:00-12:30 (crosses break), 12:00-13:00 (IS the break), 12:30-14:00 (starts during break)

SYSTEM CONSTRAINTS:
- Allowed days: ${availableDays.join(', ')}
- Allowed time window: ${startTime}-${endTime}
- Target section size: up to ${studentsPerGroup} students

HARD BLOCKED SLOTS (absolutely no scheduling allowed):
${dedupBlockedSlots.map(slot => `  • ${slot.day}: ${slot.start} - ${slot.end} (BREAK TIME - DO NOT SCHEDULE)`).join('\n')}

Rules (from rule_definitions, prioritized):
${finalRules.map(r => `- ${r}`).join('\n')}

Course Requirements:
- Students per course: ${JSON.stringify(studentsPerCourse)}
- Available rooms: ${JSON.stringify(availableRooms)}

Course Metadata (level ${level}): ${JSON.stringify((coursesData || []).map(c => ({
  code: c.code,
  title: c.title,
  type: c.course_type,
  is_lab: c.is_lab,
  duration_hours: c.duration_hours,
  allowable_rooms: c.allowable_rooms,
  required_hours: c.required_hours
})))}

Generate sections for FLEXIBLE (elective) courses only — compulsory courses are handled separately.

SCHEDULING VALIDATION CHECKLIST:
Before including any timeslot in your response, verify:
✓ Does this timeslot avoid 12:00-13:00 break period?
✓ Does it fall within allowed days (${availableDays.join(', ')})?
✓ Does it fall within allowed hours (${startTime}-${endTime})?
✓ Does it avoid all blocked slots?

Return a JSON array of sections with fields: course_code, section_label, timeslot (day, start, end), room, allocated_student_ids, justification, confidence_score.

CRITICAL: Return ONLY a valid JSON array. Do not include any markdown formatting, explanations, or additional text. Just the JSON array.

IMPORTANT: The timeslot.start and timeslot.end must be in HH:MM format (24-hour).

Example response format:
[
  {
    "course_code": "CS2EL1",
    "section_label": "A",
    "timeslot": {
      "day": "Monday",
      "start": "08:00",
      "end": "10:00"
    },
    "room": "A101",
    "allocated_student_ids": ["student1", "student2", "student3"],
    "justification": "Ends at 11:30 AM, before mandatory break period (12:00-13:00)",
    "confidence_score": 0.95
  },
  {
    "course_code": "CS2EL2",
    "section_label": "B",
    "timeslot": {
      "day": "Monday",
      "start": "12:00",
      "end": "14:00"
    },
    "room": "A102",
    "allocated_student_ids": ["student4", "student5", "student6"],
    "justification": "Starts at 1:00 PM, after mandatory break period (12:00-13:00)",
    "confidence_score": 0.95
  }
]
    `

    console.log('Sending request to Groq with constraints (DB-derived):', {
      students_per_course: studentsPerCourse,
      available_rooms: availableRooms,
      blocked_slots: dedupBlockedSlots,
      rules: finalRules,
      policy: { availableDays, startTime, endTime },
      totals: { totalStudents, totalCourses }
    })
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful academic scheduling assistant. CRITICAL RULE: The 12:00-13:00 time block on Monday-Thursday must be COMPLETELY FREE. Classes must end BEFORE 12:00 PM (not AT 12:00) or start AT/AFTER 1:00 PM. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
    })

    console.log('Groq response received:', completion)

    const content = completion.choices[0]?.message?.content || ""
    console.log('Groq content:', content)
    
    // Parse the JSON response (handle markdown code blocks)
    let recommendations: ScheduleRecommendation[]
    try {
      // Clean the content to remove markdown code blocks
      let cleanContent = content.trim()
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      recommendations = JSON.parse(cleanContent) as ScheduleRecommendation[]
      
      // POST-PROCESSING: Filter out any recommendations that violate the break time
      recommendations = recommendations.filter(rec => {
        const { day, start, end } = rec.timeslot
        
        // Check if this is a break day (Mon-Thu)
        const breakDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
        if (!breakDays.includes(day)) return true
        
        // Convert times to minutes for easier comparison
        const toMinutes = (time: string) => {
          const [h, m] = time.split(':').map(Number)
          return h * 60 + m
        }
        
        const startMin = toMinutes(start)
        const endMin = toMinutes(end)
        const breakStart = 12 * 60 // 12:00
        const breakEnd = 13 * 60   // 13:00
        
        // Check if class overlaps with break (12:00-13:00)
        // Class must either end BEFORE 12:00 or start AT OR AFTER 13:00
        const overlapsBreak = !(endMin < breakStart || startMin >= breakEnd)
        
        if (overlapsBreak) {
          console.warn(`Filtered out invalid schedule: ${rec.course_code} ${rec.section_label} on ${day} ${start}-${end} (overlaps with break time)`)
          return false
        }
        
        return true
      })
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Raw content:', content)
      // Return empty array if parsing fails
      recommendations = []
    }
    
    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('Error generating schedule:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to generate schedule recommendation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}