import { supabase, supabaseAdmin } from './supabase'

export interface ScheduleVersion {
  id: string
  level: number
  semester: string
  groups: any
  total_sections: number
  efficiency: number | null
  conflicts: number
  generated_at: string
  created_at: string
  version_number: number
  parent_version_id: string | null
  status: 'draft' | 'approved' | 'active' | 'archived'
  is_active: boolean
  approved_by: string | null
  approved_at: string | null
  created_by: string | null
  change_description: string | null
  version_metadata: any
}

export interface VersionDiff {
  added_sections: any[]
  removed_sections: any[]
  modified_sections: Array<{
    section: any
    old_value: any
    new_value: any
    changes: string[]
  }>
  efficiency_diff: number
  conflicts_diff: number
  sections_count_diff: number
}

export interface CreateVersionData {
  level: number
  semester: string
  groups: any
  total_sections: number
  conflicts: number
  efficiency: number | null
  created_by?: string
  change_description?: string
  parent_version_id?: string
  status?: 'draft' | 'approved' | 'active' | 'archived'
  is_active?: boolean
}

export class ScheduleVersionService {
  /**
   * Create a new version of a schedule
   */
  static async createVersion(data: CreateVersionData): Promise<ScheduleVersion> {
    try {
      // Get the next version number for this level/semester
      const nextVersionNumber = await this.getNextVersionNumber(data.level, data.semester)

      // If creating from a parent version, copy its data
      let versionData: CreateVersionData = { ...data }
      if (data.parent_version_id && !data.groups) {
        const parentVersion = await this.getVersionById(data.parent_version_id)
        if (parentVersion) {
          versionData = {
            ...versionData,
            groups: parentVersion.groups,
            total_sections: parentVersion.total_sections,
            conflicts: parentVersion.conflicts,
            efficiency: parentVersion.efficiency
          }
        }
      }

      const { data: newVersion, error } = await supabaseAdmin
        .from('schedule_versions')
        .insert({
          level: versionData.level,
          semester: versionData.semester,
          groups: versionData.groups,
          total_sections: versionData.total_sections,
          conflicts: versionData.conflicts,
          efficiency: versionData.efficiency,
          version_number: nextVersionNumber,
          parent_version_id: versionData.parent_version_id || null,
          status: versionData.status || 'draft',
          is_active: versionData.is_active || false,
          created_by: versionData.created_by || null,
          change_description: versionData.change_description || null,
          generated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      return newVersion as ScheduleVersion
    } catch (error: any) {
      console.error('Error creating version:', error)
      throw new Error(`Failed to create version: ${error.message}`)
    }
  }

  /**
   * Get the next version number for a level/semester
   */
  static async getNextVersionNumber(level: number, semester: string): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('schedule_versions')
        .select('version_number')
        .eq('level', level)
        .eq('semester', semester)
        .order('version_number', { ascending: false })
        .limit(1)

      if (error) throw error

      if (!data || data.length === 0) {
        return 1
      }

      return (data[0].version_number || 0) + 1
    } catch (error: any) {
      console.error('Error getting next version number:', error)
      return 1
    }
  }

  /**
   * Get version history for a level/semester
   */
  static async getVersionHistory(level: number, semester: string): Promise<ScheduleVersion[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('schedule_versions')
        .select(`
          *,
          created_by_user:users!schedule_versions_created_by_fkey(id, email, full_name),
          approved_by_user:users!schedule_versions_approved_by_fkey(id, email, full_name)
        `)
        .eq('level', level)
        .eq('semester', semester)
        .order('version_number', { ascending: false })

      if (error) throw error

      return (data || []) as ScheduleVersion[]
    } catch (error: any) {
      console.error('Error getting version history:', error)
      throw new Error(`Failed to get version history: ${error.message}`)
    }
  }

  /**
   * Get the currently active version for a level/semester
   */
  static async getActiveVersion(level: number, semester: string): Promise<ScheduleVersion | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('schedule_versions')
        .select('*')
        .eq('level', level)
        .eq('semester', semester)
        .eq('is_active', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null
        }
        throw error
      }

      return data as ScheduleVersion
    } catch (error: any) {
      console.error('Error getting active version:', error)
      throw new Error(`Failed to get active version: ${error.message}`)
    }
  }

  /**
   * Get a version by ID
   */
  static async getVersionById(versionId: string): Promise<ScheduleVersion | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('schedule_versions')
        .select('*')
        .eq('id', versionId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }

      return data as ScheduleVersion
    } catch (error: any) {
      console.error('Error getting version by ID:', error)
      throw new Error(`Failed to get version: ${error.message}`)
    }
  }

  /**
   * Set a version as active (deactivates others for the same level/semester)
   */
  static async setActiveVersion(versionId: string): Promise<void> {
    try {
      // Get the version to activate
      const version = await this.getVersionById(versionId)
      if (!version) {
        throw new Error('Version not found')
      }

      // First, deactivate all versions for this level/semester
      const { error: deactivateError } = await supabaseAdmin
        .from('schedule_versions')
        .update({ is_active: false })
        .eq('level', version.level)
        .eq('semester', version.semester)

      if (deactivateError) throw deactivateError

      // Then activate the selected version
      const { error: activateError } = await supabaseAdmin
        .from('schedule_versions')
        .update({ 
          is_active: true,
          status: 'active'
        })
        .eq('id', versionId)

      if (activateError) throw activateError
    } catch (error: any) {
      console.error('Error setting active version:', error)
      throw new Error(`Failed to set active version: ${error.message}`)
    }
  }

  /**
   * Approve a version
   */
  static async approveVersion(versionId: string, approvedBy: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('schedule_versions')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString()
        })
        .eq('id', versionId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error approving version:', error)
      throw new Error(`Failed to approve version: ${error.message}`)
    }
  }

  /**
   * Revert to a specific version (destructive - creates new version from target)
   */
  static async revertToVersion(targetVersionId: string, createdBy: string, changeDescription?: string): Promise<ScheduleVersion> {
    try {
      // Get the target version
      const targetVersion = await this.getVersionById(targetVersionId)
      if (!targetVersion) {
        throw new Error('Target version not found')
      }

      // Get the currently active version to archive it
      const activeVersion = await this.getActiveVersion(targetVersion.level, targetVersion.semester)
      if (activeVersion) {
        await supabaseAdmin
          .from('schedule_versions')
          .update({ status: 'archived' })
          .eq('id', activeVersion.id)
      }

      // Create a new version from the target version
      const newVersion = await this.createVersion({
        level: targetVersion.level,
        semester: targetVersion.semester,
        groups: targetVersion.groups,
        total_sections: targetVersion.total_sections,
        conflicts: targetVersion.conflicts,
        efficiency: targetVersion.efficiency,
        parent_version_id: targetVersionId,
        created_by: createdBy,
        change_description: changeDescription || `Reverted to version ${targetVersion.version_number}`,
        status: 'active',
        is_active: true
      })

      // Set as active (this will deactivate others)
      await this.setActiveVersion(newVersion.id)

      return newVersion
    } catch (error: any) {
      console.error('Error reverting to version:', error)
      throw new Error(`Failed to revert to version: ${error.message}`)
    }
  }

  /**
   * Compare two versions and return differences
   */
  static async compareVersions(version1Id: string, version2Id: string): Promise<VersionDiff> {
    try {
      const [version1, version2] = await Promise.all([
        this.getVersionById(version1Id),
        this.getVersionById(version2Id)
      ])

      if (!version1 || !version2) {
        throw new Error('One or both versions not found')
      }

      return this.getVersionDiff(version1, version2)
    } catch (error: any) {
      console.error('Error comparing versions:', error)
      throw new Error(`Failed to compare versions: ${error.message}`)
    }
  }

  /**
   * Get detailed diff between two versions
   */
  static getVersionDiff(version1: ScheduleVersion, version2: ScheduleVersion): VersionDiff {
    // Extract all sections from both versions
    const sections1 = this.extractSections(version1)
    const sections2 = this.extractSections(version2)

    // Create maps for quick lookup
    const sections1Map = new Map<string, any>()
    sections1.forEach(section => {
      const key = `${section.course_code}-${section.section_label}-${section.group_name}`
      sections1Map.set(key, section)
    })

    const sections2Map = new Map<string, any>()
    sections2.forEach(section => {
      const key = `${section.course_code}-${section.section_label}-${section.group_name}`
      sections2Map.set(key, section)
    })

    // Find added, removed, and modified sections
    const addedSections: any[] = []
    const removedSections: any[] = []
    const modifiedSections: Array<{
      section: any
      old_value: any
      new_value: any
      changes: string[]
    }> = []

    // Check for additions and modifications
    sections2.forEach(section2 => {
      const key = `${section2.course_code}-${section2.section_label}-${section2.group_name}`
      const section1 = sections1Map.get(key)

      if (!section1) {
        addedSections.push(section2)
      } else {
        // Check for modifications
        const changes: string[] = []
        if (section1.day !== section2.day || section1.start_time !== section2.start_time || section1.end_time !== section2.end_time) {
          changes.push('timeslot')
        }
        if (section1.room !== section2.room) {
          changes.push('room')
        }
        if (section1.instructor !== section2.instructor) {
          changes.push('instructor')
        }

        if (changes.length > 0) {
          modifiedSections.push({
            section: section2,
            old_value: section1,
            new_value: section2,
            changes
          })
        }
      }
    })

    // Check for removals
    sections1.forEach(section1 => {
      const key = `${section1.course_code}-${section1.section_label}-${section1.group_name}`
      if (!sections2Map.has(key)) {
        removedSections.push(section1)
      }
    })

    return {
      added_sections: addedSections,
      removed_sections: removedSections,
      modified_sections: modifiedSections,
      efficiency_diff: (version2.efficiency || 0) - (version1.efficiency || 0),
      conflicts_diff: version2.conflicts - version1.conflicts,
      sections_count_diff: version2.total_sections - version1.total_sections
    }
  }

  /**
   * Extract sections from a version's groups structure
   */
  private static extractSections(version: ScheduleVersion): any[] {
    const sections: any[] = []
    
    if (!version.groups || typeof version.groups !== 'object') {
      return sections
    }

    Object.entries(version.groups).forEach(([groupName, groupData]: [string, any]) => {
      if (groupData && groupData.sections && Array.isArray(groupData.sections)) {
        groupData.sections.forEach((section: any) => {
          sections.push({
            ...section,
            group_name: groupName
          })
        })
      }
    })

    return sections
  }

  /**
   * Delete a version (only if not active)
   */
  static async deleteVersion(versionId: string): Promise<void> {
    try {
      // Get the version to check if it's active
      const version = await this.getVersionById(versionId)
      if (!version) {
        throw new Error('Version not found')
      }

      // Prevent deletion of active versions
      if (version.is_active) {
        throw new Error('Cannot delete active version. Please set another version as active first.')
      }

      // Delete the version
      const { error } = await supabaseAdmin
        .from('schedule_versions')
        .delete()
        .eq('id', versionId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error deleting version:', error)
      throw new Error(`Failed to delete version: ${error.message}`)
    }
  }

  /**
   * Update version metadata
   */
  static async updateVersionMetadata(versionId: string, metadata: any): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('schedule_versions')
        .update({ version_metadata: metadata })
        .eq('id', versionId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error updating version metadata:', error)
      throw new Error(`Failed to update version metadata: ${error.message}`)
    }
  }
}

