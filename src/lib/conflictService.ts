import { supabase } from './supabase'

export interface Conflict {
  id: string
  schedule_version_id: string
  conflict_type: 'room_conflict' | 'instructor_conflict' | 'student_conflict' | 'time_overlap' | 'inter_level_conflict'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affected_sections: any
  suggested_resolution: string | null
  is_resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

export interface ConflictSummary {
  total_conflicts: number
  by_type: Record<string, number>
  by_severity: Record<string, number>
  resolved: number
  unresolved: number
  critical_conflicts: Conflict[]
  conflicts: Conflict[]
}

export interface ChangesSummary {
  sections_added: number
  sections_modified: number
  sections_removed: number
  rooms_changed: number
  times_changed: number
  instructors_changed: number
  changes_details: Array<{
    section: string
    change_type: string
    before: any
    after: any
  }>
}

export class ConflictService {
  /**
   * Detect all conflicts in a schedule
   */
  static async detectConflicts(scheduleVersionId: string, scheduleData: any): Promise<Conflict[]> {
    const conflicts: Conflict[] = []

    try {
      // Get the schedule data
      const groups = scheduleData.groups || {}
      const level = scheduleData.level

      // Detect room conflicts within the same schedule
      const roomConflicts = this.detectRoomConflicts(groups, level)
      conflicts.push(...roomConflicts)

      // Detect inter-level conflicts
      const interLevelConflicts = await this.detectInterLevelConflicts(groups, level, scheduleVersionId)
      conflicts.push(...interLevelConflicts)

      // Detect time overlaps for student groups
      const timeOverlaps = this.detectTimeOverlaps(groups, level)
      conflicts.push(...timeOverlaps)

      // Save conflicts to database
      if (conflicts.length > 0) {
        await this.saveConflicts(scheduleVersionId, conflicts)
      }

      return conflicts
    } catch (error) {
      console.error('Error detecting conflicts:', error)
      return []
    }
  }

  /**
   * Detect room conflicts (same room, same time)
   */
  private static detectRoomConflicts(groups: any, level: number): Conflict[] {
    const conflicts: Conflict[] = []
    const roomTimeMap = new Map<string, any[]>()

    // Build room-time map
    Object.entries(groups).forEach(([groupName, groupData]: [string, any]) => {
      groupData.sections?.forEach((section: any) => {
        const key = `${section.room}-${section.day}-${section.start_time}`
        if (!roomTimeMap.has(key)) {
          roomTimeMap.set(key, [])
        }
        roomTimeMap.get(key)!.push({ ...section, group: groupName })
      })
    })

    // Check for conflicts
    roomTimeMap.forEach((sections, key) => {
      if (sections.length > 1) {
        conflicts.push({
          id: `conflict-${Date.now()}-${Math.random()}`,
          schedule_version_id: '',
          conflict_type: 'room_conflict',
          severity: 'high',
          description: `Room ${sections[0].room} is double-booked on ${sections[0].day} at ${sections[0].start_time}`,
          affected_sections: sections,
          suggested_resolution: `Assign one of the sections to a different room or time slot`,
          is_resolved: false,
          resolved_at: null,
          resolved_by: null,
          created_at: new Date().toISOString()
        })
      }
    })

    return conflicts
  }

  /**
   * Detect conflicts with other levels
   */
  private static async detectInterLevelConflicts(
    groups: any, 
    currentLevel: number, 
    currentScheduleId: string
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = []

    try {
      // Get all schedules from other levels
      const { data: otherSchedules } = await supabase
        .from('schedule_versions')
        .select('id, level, diff_json')
        .neq('level', currentLevel)
        .neq('id', currentScheduleId)

      if (!otherSchedules) return conflicts

      // Build occupied slots map
      const occupiedSlots = new Map<string, any>()
      otherSchedules.forEach(schedule => {
        const otherGroups = schedule.diff_json?.groups || {}
        Object.values(otherGroups).forEach((groupData: any) => {
          groupData.sections?.forEach((section: any) => {
            const key = `${section.room}-${section.day}-${section.start_time}`
            occupiedSlots.set(key, {
              ...section,
              level: schedule.level,
              schedule_id: schedule.id
            })
          })
        })
      })

      // Check current schedule against occupied slots
      Object.entries(groups).forEach(([groupName, groupData]: [string, any]) => {
        groupData.sections?.forEach((section: any) => {
          const key = `${section.room}-${section.day}-${section.start_time}`
          if (occupiedSlots.has(key)) {
            const conflictingSection = occupiedSlots.get(key)
            conflicts.push({
              id: `conflict-${Date.now()}-${Math.random()}`,
              schedule_version_id: '',
              conflict_type: 'inter_level_conflict',
              severity: 'critical',
              description: `Level ${currentLevel} ${groupName} course ${section.course_code} conflicts with Level ${conflictingSection.level} course ${conflictingSection.course_code} in room ${section.room} on ${section.day} at ${section.start_time}`,
              affected_sections: [section, conflictingSection],
              suggested_resolution: `Move Level ${currentLevel} ${section.course_code} to a different time slot or room`,
              is_resolved: false,
              resolved_at: null,
              resolved_by: null,
              created_at: new Date().toISOString()
            })
          }
        })
      })
    } catch (error) {
      console.error('Error detecting inter-level conflicts:', error)
    }

    return conflicts
  }

  /**
   * Detect time overlaps for student groups
   */
  private static detectTimeOverlaps(groups: any, level: number): Conflict[] {
    const conflicts: Conflict[] = []

    Object.entries(groups).forEach(([groupName, groupData]: [string, any]) => {
      const sections = groupData.sections || []
      const timeMap = new Map<string, any[]>()

      sections.forEach((section: any) => {
        const key = `${section.day}-${section.start_time}`
        if (!timeMap.has(key)) {
          timeMap.set(key, [])
        }
        timeMap.get(key)!.push(section)
      })

      timeMap.forEach((sectionsAtTime, key) => {
        if (sectionsAtTime.length > 1) {
          conflicts.push({
            id: `conflict-${Date.now()}-${Math.random()}`,
            schedule_version_id: '',
            conflict_type: 'time_overlap',
            severity: 'medium',
            description: `${groupName} has ${sectionsAtTime.length} courses scheduled at the same time: ${key}`,
            affected_sections: sectionsAtTime,
            suggested_resolution: `Reschedule one of the courses to a different time`,
            is_resolved: false,
            resolved_at: null,
            resolved_by: null,
            created_at: new Date().toISOString()
          })
        }
      })
    })

    return conflicts
  }

  /**
   * Save conflicts to database
   */
  private static async saveConflicts(scheduleVersionId: string, conflicts: Conflict[]): Promise<void> {
    try {
      const conflictsToInsert = conflicts.map(c => ({
        schedule_version_id: scheduleVersionId,
        conflict_type: c.conflict_type,
        severity: c.severity,
        description: c.description,
        affected_sections: c.affected_sections,
        suggested_resolution: c.suggested_resolution,
        is_resolved: false
      }))

      const { error } = await supabase
        .from('schedule_conflicts')
        .insert(conflictsToInsert)

      if (error) {
        console.error('Error saving conflicts:', error)
      }
    } catch (error) {
      console.error('Error in saveConflicts:', error)
    }
  }

  /**
   * Get conflicts for a schedule
   */
  static async getConflictsForSchedule(scheduleVersionId: string): Promise<Conflict[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_conflicts')
        .select('*')
        .eq('schedule_version_id', scheduleVersionId)
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching conflicts:', error)
      return []
    }
  }

  /**
   * Get conflict summary for a schedule
   */
  static async getConflictSummary(scheduleVersionId: string): Promise<ConflictSummary> {
    try {
      const conflicts = await this.getConflictsForSchedule(scheduleVersionId)

      const summary: ConflictSummary = {
        total_conflicts: conflicts.length,
        by_type: {
          room_conflict: 0,
          instructor_conflict: 0,
          student_conflict: 0,
          time_overlap: 0,
          inter_level_conflict: 0
        },
        by_severity: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        },
        resolved: 0,
        unresolved: 0,
        critical_conflicts: [],
        conflicts: conflicts
      }

      conflicts.forEach(conflict => {
        summary.by_type[conflict.conflict_type]++
        summary.by_severity[conflict.severity]++
        if (conflict.is_resolved) {
          summary.resolved++
        } else {
          summary.unresolved++
        }
        if (conflict.severity === 'critical') {
          summary.critical_conflicts.push(conflict)
        }
      })

      return summary
    } catch (error) {
      console.error('Error getting conflict summary:', error)
      return {
        total_conflicts: 0,
        by_type: {},
        by_severity: {},
        resolved: 0,
        unresolved: 0,
        critical_conflicts: [],
        conflicts: []
      }
    }
  }

  /**
   * Resolve a conflict
   */
  static async resolveConflict(conflictId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('schedule_conflicts')
        .update({
          is_resolved: true,
          resolved_by: userId,
          resolved_at: new Date().toISOString()
        })
        .eq('id', conflictId)

      if (error) throw error
    } catch (error) {
      console.error('Error resolving conflict:', error)
      throw error
    }
  }

  /**
   * Generate changes summary between two schedule versions
   */
  static generateChangesSummary(oldSchedule: any, newSchedule: any): ChangesSummary {
    const summary: ChangesSummary = {
      sections_added: 0,
      sections_modified: 0,
      sections_removed: 0,
      rooms_changed: 0,
      times_changed: 0,
      instructors_changed: 0,
      changes_details: []
    }

    try {
      const oldSections = this.flattenScheduleSections(oldSchedule)
      const newSections = this.flattenScheduleSections(newSchedule)

      // Find added sections
      newSections.forEach(newSection => {
        const oldSection = oldSections.find(s => s.course_code === newSection.course_code && s.group === newSection.group)
        if (!oldSection) {
          summary.sections_added++
          summary.changes_details.push({
            section: `${newSection.course_code} (${newSection.group})`,
            change_type: 'added',
            before: null,
            after: newSection
          })
        }
      })

      // Find removed and modified sections
      oldSections.forEach(oldSection => {
        const newSection = newSections.find(s => s.course_code === oldSection.course_code && s.group === oldSection.group)
        
        if (!newSection) {
          summary.sections_removed++
          summary.changes_details.push({
            section: `${oldSection.course_code} (${oldSection.group})`,
            change_type: 'removed',
            before: oldSection,
            after: null
          })
        } else {
          // Check for modifications
          if (oldSection.room !== newSection.room) {
            summary.rooms_changed++
            summary.sections_modified++
            summary.changes_details.push({
              section: `${oldSection.course_code} (${oldSection.group})`,
              change_type: 'room_changed',
              before: oldSection.room,
              after: newSection.room
            })
          }
          
          if (oldSection.day !== newSection.day || oldSection.start_time !== newSection.start_time) {
            summary.times_changed++
            summary.sections_modified++
            summary.changes_details.push({
              section: `${oldSection.course_code} (${oldSection.group})`,
              change_type: 'time_changed',
              before: `${oldSection.day} ${oldSection.start_time}`,
              after: `${newSection.day} ${newSection.start_time}`
            })
          }
          
          if (oldSection.instructor !== newSection.instructor) {
            summary.instructors_changed++
            summary.sections_modified++
            summary.changes_details.push({
              section: `${oldSection.course_code} (${oldSection.group})`,
              change_type: 'instructor_changed',
              before: oldSection.instructor,
              after: newSection.instructor
            })
          }
        }
      })
    } catch (error) {
      console.error('Error generating changes summary:', error)
    }

    return summary
  }

  /**
   * Flatten schedule into array of sections
   */
  private static flattenScheduleSections(schedule: any): any[] {
    const sections: any[] = []
    
    if (!schedule?.groups) return sections

    Object.entries(schedule.groups).forEach(([groupName, groupData]: [string, any]) => {
      groupData.sections?.forEach((section: any) => {
        sections.push({
          ...section,
          group: groupName
        })
      })
    })

    return sections
  }

  /**
   * Log changes to audit log
   */
  static async logScheduleChanges(
    scheduleVersionId: string,
    actionType: string,
    userId: string | null,
    level: number,
    groupName: string | null,
    promptUsed: string | null,
    changesSummary: ChangesSummary,
    conflictsSummary: ConflictSummary,
    executionTimeMs: number
  ): Promise<void> {
    try {
      await supabase.from('schedule_audit_log').insert({
        schedule_version_id: scheduleVersionId,
        action_type: actionType,
        user_id: userId,
        level,
        group_name: groupName,
        prompt_used: promptUsed,
        changes_summary: changesSummary,
        conflicts_detected: {
          total: conflictsSummary.total_conflicts,
          by_type: conflictsSummary.by_type,
          critical: conflictsSummary.critical_conflicts.length
        },
        conflicts_resolved: {
          total: conflictsSummary.resolved
        },
        ai_model_used: 'groq-llama',
        execution_time_ms: executionTimeMs
      })
    } catch (error) {
      console.error('Error logging schedule changes:', error)
    }
  }

  /**
   * Get audit log for a schedule
   */
  static async getAuditLog(scheduleVersionId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_audit_log')
        .select('*')
        .eq('schedule_version_id', scheduleVersionId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching audit log:', error)
      return []
    }
  }
}

