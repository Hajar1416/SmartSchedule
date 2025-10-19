import { supabase } from './supabase'

export interface LevelGroupSettings {
  id: string
  level: number
  semester: string
  total_students: number
  students_per_group: number
  num_groups: number
  group_names: string[]
  created_at: string
  updated_at: string
}

/**
 * Group Settings Service
 * Manages dynamic group sizing and student assignment
 */
export class GroupSettingsService {
  /**
   * Get group settings for a specific level and semester
   */
  static async getGroupSettings(
    level: number,
    semester: string
  ): Promise<LevelGroupSettings | null> {
    const { data, error } = await supabase
      .from('level_group_settings')
      .select('*')
      .eq('level', level)
      .eq('semester', semester)
      .single()

    if (error) {
      console.error('Error fetching group settings:', error)
      return null
    }

    return data
  }

  /**
   * Calculate and create group settings for a level
   */
  static async calculateGroupSettings(
    level: number,
    semester: string,
    studentsPerGroup?: number
  ): Promise<LevelGroupSettings> {
    // Count regular students in this level
    const { data: students, error: countError } = await supabase
      .from('students')
      .select('id', { count: 'exact' })
      .eq('level', level)
      .eq('is_irregular', false)

    if (countError) throw countError

    const totalStudents = students?.length || 0
    const defaultStudentsPerGroup = studentsPerGroup || 25

    // Calculate number of groups needed
    const numGroups = Math.ceil(totalStudents / defaultStudentsPerGroup)

    // Generate group names (A, B, C, D, E, F, ...)
    const groupNames = this.generateGroupNames(numGroups)

    // Create or update settings
    const { data, error } = await supabase
      .from('level_group_settings')
      .upsert({
        level,
        semester,
        total_students: totalStudents,
        students_per_group: defaultStudentsPerGroup,
        num_groups: numGroups,
        group_names: groupNames
      })
      .select()
      .single()

    if (error) throw error

    return data
  }

  /**
   * Update group settings manually
   */
  static async updateGroupSettings(
    level: number,
    semester: string,
    studentsPerGroup: number
  ): Promise<LevelGroupSettings> {
    return await this.calculateGroupSettings(level, semester, studentsPerGroup)
  }

  /**
   * Assign students to groups automatically
   */
  static async assignStudentsToGroups(
    level: number,
    semester: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get settings
      const settings = await this.getGroupSettings(level, semester)
      if (!settings) {
        throw new Error('Group settings not found. Please calculate settings first.')
      }

      // Get all regular students for this level
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, student_number')
        .eq('level', level)
        .eq('is_irregular', false)
        .order('student_number')

      if (studentsError) throw studentsError

      if (!students || students.length === 0) {
        return { success: true } // No students to assign
      }

      // Distribute students evenly across groups
      const studentsPerGroup = Math.ceil(students.length / settings.num_groups)
      const updates = []

      for (let i = 0; i < students.length; i++) {
        const groupIndex = Math.floor(i / studentsPerGroup)
        const groupName = settings.group_names[groupIndex] || settings.group_names[0]

        updates.push({
          id: students[i].id,
          group_name: groupName
        })
      }

      // Update students in batches
      for (const update of updates) {
        await supabase
          .from('students')
          .update({ student_group: update.group_name })
          .eq('id', update.id)
      }

      return { success: true }
    } catch (error: any) {
      console.error('Error assigning students to groups:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get all group settings for all levels in a semester
   */
  static async getAllGroupSettings(semester: string): Promise<LevelGroupSettings[]> {
    const { data, error } = await supabase
      .from('level_group_settings')
      .select('*')
      .eq('semester', semester)
      .order('level')

    if (error) {
      console.error('Error fetching all group settings:', error)
      return []
    }

    return data || []
  }

  /**
   * Generate group names (A, B, C, ... Z, AA, AB, ...)
   */
  private static generateGroupNames(count: number): string[] {
    const names: string[] = []
    for (let i = 0; i < count; i++) {
      if (i < 26) {
        // A-Z
        names.push(String.fromCharCode(65 + i))
      } else {
        // AA, AB, AC, ...
        const first = Math.floor((i - 26) / 26)
        const second = (i - 26) % 26
        names.push(String.fromCharCode(65 + first) + String.fromCharCode(65 + second))
      }
    }
    return names
  }

  /**
   * Get student distribution per group
   */
  static async getGroupDistribution(
    level: number
  ): Promise<Record<string, { count: number; students: string[] }>> {
    const { data: students, error } = await supabase
      .from('students')
      .select('id, student_number, student_group, full_name')
      .eq('level', level)
      .eq('is_irregular', false)
      .order('student_group')

    if (error) {
      console.error('Error fetching group distribution:', error)
      return {}
    }

    const distribution: Record<string, { count: number; students: string[] }> = {}

    students?.forEach((student) => {
      const group = student.student_group || 'Unassigned'
      if (!distribution[group]) {
        distribution[group] = { count: 0, students: [] }
      }
      distribution[group].count++
      distribution[group].students.push(student.full_name)
    })

    return distribution
  }
}

