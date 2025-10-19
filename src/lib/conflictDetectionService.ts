import { supabase } from './supabase'

export interface Conflict {
  id: string
  type: 'room' | 'instructor' | 'student' | 'time'
  severity: 'high' | 'medium' | 'low'
  description: string
  affectedCourses: string[]
  affectedLevel: number
  affectedGroup: string
  details: any
}

export class ConflictDetectionService {
  /**
   * Convert 24-hour time to 12-hour format (e.g., 17:00 -> 5:00 PM)
   */
  private static formatTime12Hour(time24: string): string {
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`
  }

  /**
   * Detect all conflicts in generated schedules
   */
  static async detectAllConflicts(): Promise<Conflict[]> {
    try {
      const conflicts: Conflict[] = []

      // Get all schedule versions
      const { data: schedules, error } = await supabase
        .from('schedule_versions')
        .select('id, level, groups')
        .order('created_at', { ascending: false })

      if (error || !schedules) {
        console.error('Error loading schedules:', error)
        return []
      }

      // Check room conflicts
      const roomConflicts = this.detectRoomConflicts(schedules)
      conflicts.push(...roomConflicts)

      // Check time slot conflicts within same level
      const timeConflicts = this.detectTimeConflicts(schedules)
      conflicts.push(...timeConflicts)

      console.log(`🔍 Total conflicts detected: ${conflicts.length}`)
      return conflicts

    } catch (error) {
      console.error('Error detecting conflicts:', error)
      return []
    }
  }

  /**
   * Detect room conflicts (same room, same time, different levels/groups)
   */
  private static detectRoomConflicts(schedules: any[]): Conflict[] {
    const conflicts: Conflict[] = []
    const roomSlots = new Map<string, any[]>() // key: room-day-time, value: sections

    schedules.forEach(schedule => {
      const groups = (schedule as any).groups || {}
      
      Object.entries(groups).forEach(([groupName, groupData]: [string, any]) => {
        const sections = groupData.sections || []
        
        sections.forEach((section: any) => {
          const key = `${section.room}-${section.day}-${section.start_time}`
          
          if (!roomSlots.has(key)) {
            roomSlots.set(key, [])
          }
          
          roomSlots.get(key)!.push({
            ...section,
            level: schedule.level,
            group: groupName,
            scheduleId: schedule.id
          })
        })
      })
    })

    // Find conflicts
    roomSlots.forEach((sections, key) => {
      if (sections.length > 1) {
        const [room, day, time] = key.split('-')
        const time12Hour = this.formatTime12Hour(time)
        
        conflicts.push({
          id: `room-conflict-${Date.now()}-${Math.random()}`,
          type: 'room',
          severity: 'high',
          description: `Room ${room} is double-booked on ${day} at ${time12Hour}`,
          affectedCourses: sections.map(s => `${s.course_code} (Level ${s.level}, ${s.group})`),
          affectedLevel: sections[0].level,
          affectedGroup: sections[0].group,
          details: {
            room,
            day,
            time: time12Hour,
            sections: sections.map(s => ({
              course: s.course_code,
              level: s.level,
              group: s.group
            }))
          }
        })
      }
    })

    return conflicts
  }

  /**
   * Detect REAL time conflicts within same level/group
   * ONLY flag conflicts where students need to be in 2 places at once
   * Different rooms at same time is OK - that's normal scheduling!
   */
  private static detectTimeConflicts(schedules: any[]): Conflict[] {
    const conflicts: Conflict[] = []

    schedules.forEach(schedule => {
      const groups = schedule.diff_json?.groups || {}
      
      Object.entries(groups).forEach(([groupName, groupData]: [string, any]) => {
        const sections = groupData.sections || []
        
        // Group by time slot AND check if SAME students need to attend
        const timeSlots = new Map<string, any[]>()

        sections.forEach((section: any) => {
          const key = `${section.day}-${section.start_time}`
          
          if (!timeSlots.has(key)) {
            timeSlots.set(key, [])
          }
          
          timeSlots.get(key)!.push(section)
        })

        // Check for REAL overlaps (students can't be in 2 places at once)
        timeSlots.forEach((sectionList, key) => {
          if (sectionList.length > 1) {
            // Get unique course codes (ignore section labels)
            const uniqueCourses = new Set(sectionList.map(s => s.course_code))
            
            // ONLY report conflict if different courses (not just different sections of same course)
            if (uniqueCourses.size > 1) {
              const [day, time] = key.split('-')
              const time12Hour = this.formatTime12Hour(time)
              
              // Check if they're in the SAME room (room conflict)
              const rooms = new Set(sectionList.map(s => s.room))
              const conflictType = rooms.size === 1 ? 'Same room and time' : 'Students need to be in multiple places'
              
              conflicts.push({
                id: `time-conflict-${Date.now()}-${Math.random()}`,
                type: 'time',
                severity: 'high',
                description: `${conflictType}: Level ${schedule.level} ${groupName} on ${day} at ${time12Hour} - ${Array.from(uniqueCourses).join(', ')}`,
                affectedCourses: Array.from(uniqueCourses),
                affectedLevel: schedule.level,
                affectedGroup: groupName,
                details: {
                  day,
                  time: time12Hour,
                  conflictReason: conflictType,
                  courses: sectionList.map(s => ({
                    code: s.course_code,
                    room: s.room
                  }))
                }
              })
            }
            // If same course code, different sections - that's OK (parallel sections)
          }
        })
      })
    })

    return conflicts
  }

  /**
   * Get conflicts for a specific level
   */
  static async getConflictsForLevel(level: number): Promise<Conflict[]> {
    const allConflicts = await this.detectAllConflicts()
    return allConflicts.filter(c => c.affectedLevel === level)
  }

  /**
   * Get conflict summary
   */
  static async getConflictSummary(): Promise<{
    total: number
    byType: Record<string, number>
    bySeverity: Record<string, number>
    byLevel: Record<number, number>
  }> {
    const conflicts = await this.detectAllConflicts()

    const summary = {
      total: conflicts.length,
      byType: { room: 0, instructor: 0, student: 0, time: 0 },
      bySeverity: { high: 0, medium: 0, low: 0 },
      byLevel: {} as Record<number, number>
    }

    conflicts.forEach(conflict => {
      summary.byType[conflict.type]++
      summary.bySeverity[conflict.severity]++
      summary.byLevel[conflict.affectedLevel] = (summary.byLevel[conflict.affectedLevel] || 0) + 1
    })

    return summary
  }
}

