import { supabase } from './supabase'

export interface SystemSetting {
  id: string
  setting_key: string
  setting_value: any
  description?: string
  updated_at: string
}

/**
 * System Settings Service
 * Manages global system configuration
 */
export class SystemSettingsService {
  /**
   * Get a specific setting by key
   */
  static async getSetting(key: string): Promise<any> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single()

    if (error) {
      console.error(`Error fetching setting ${key}:`, error)
      return null
    }

    return data?.setting_value
  }

  /**
   * Get all settings
   */
  static async getAllSettings(): Promise<Record<string, any>> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')

    if (error) {
      console.error('Error fetching settings:', error)
      return {}
    }

    const settings: Record<string, any> = {}
    data?.forEach((setting) => {
      settings[setting.setting_key] = setting.setting_value
    })

    return settings
  }

  /**
   * Update a setting
   */
  static async updateSetting(key: string, value: any): Promise<boolean> {
    const { error } = await supabase
      .from('system_settings')
      .update({
        setting_value: value,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', key)

    if (error) {
      console.error(`Error updating setting ${key}:`, error)
      return false
    }

    return true
  }

  /**
   * Check if preference collection is open
   */
  static async isPreferenceCollectionOpen(): Promise<boolean> {
    const value = await this.getSetting('preference_collection_open')
    return value === true || value === 'true'
  }

  /**
   * Open/Close preference collection
   */
  static async setPreferenceCollection(isOpen: boolean): Promise<boolean> {
    return await this.updateSetting('preference_collection_open', isOpen)
  }

  /**
   * Get current semester
   */
  static async getCurrentSemester(): Promise<string> {
    const value = await this.getSetting('current_semester')
    return value || 'Fall 2025'
  }

  /**
   * Set current semester
   */
  static async setCurrentSemester(semester: string): Promise<boolean> {
    return await this.updateSetting('current_semester', semester)
  }

  /**
   * Get preference deadline
   */
  static async getPreferenceDeadline(): Promise<string | null> {
    return await this.getSetting('preference_deadline')
  }

  /**
   * Set preference deadline
   */
  static async setPreferenceDeadline(deadline: string): Promise<boolean> {
    return await this.updateSetting('preference_deadline', deadline)
  }

  /**
   * Get default students per group
   */
  static async getDefaultStudentsPerGroup(): Promise<number> {
    const value = await this.getSetting('default_students_per_group')
    return value || 25
  }
}
