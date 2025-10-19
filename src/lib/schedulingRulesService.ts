import { supabase } from './supabase'

export interface SchedulingRule {
  id: string
  rule_text: string
  rule_category: 'general' | 'timing' | 'room' | 'instructor' | 'student' | 'level_specific' | 'conflict_prevention'
  priority: number
  is_active: boolean
  applies_to_levels: number[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateRuleData {
  rule_text: string
  rule_category: 'general' | 'timing' | 'room' | 'instructor' | 'student' | 'level_specific' | 'conflict_prevention'
  priority: number
  applies_to_levels: number[]
}

export class SchedulingRulesService {
  /**
   * Get all active rules
   */
  static async getActiveRules(): Promise<SchedulingRule[]> {
    try {
      const { data, error } = await supabase
        .from('rule_definitions')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error: any) {
      console.error('Error fetching active rules:', error)
      throw new Error(`Failed to fetch active rules: ${error.message}`)
    }
  }

  /**
   * Get all rules (including inactive)
   */
  static async getAllRules(): Promise<SchedulingRule[]> {
    try {
      const { data, error } = await supabase
        .from('rule_definitions')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error: any) {
      console.error('Error fetching all rules:', error)
      throw new Error(`Failed to fetch rules: ${error.message}`)
    }
  }

  /**
   * Get rules for a specific level
   */
  static async getRulesForLevel(level: number): Promise<SchedulingRule[]> {
    try {
      const allRules = await this.getActiveRules()
      
      // Filter rules that apply to this level
      return allRules.filter(rule => 
        rule.applies_to_levels.length === 0 || 
        rule.applies_to_levels.includes(level)
      )
    } catch (error: any) {
      console.error('Error fetching rules for level:', error)
      throw new Error(`Failed to fetch rules for level ${level}: ${error.message}`)
    }
  }

  /**
   * Get rules by category
   */
  static async getRulesByCategory(category: string): Promise<SchedulingRule[]> {
    try {
      const { data, error } = await supabase
        .from('rule_definitions')
        .select('*')
        .eq('rule_category', category)
        .eq('is_active', true)
        .order('priority', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error: any) {
      console.error('Error fetching rules by category:', error)
      throw new Error(`Failed to fetch rules for category ${category}: ${error.message}`)
    }
  }

  /**
   * Create a new rule
   */
  static async createRule(ruleData: CreateRuleData, userId: string): Promise<SchedulingRule> {
    try {
      const { data, error } = await supabase
        .from('rule_definitions')
        .insert({
          ...ruleData,
          created_by: userId,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error: any) {
      console.error('Error creating rule:', error)
      throw new Error(`Failed to create rule: ${error.message}`)
    }
  }

  /**
   * Update a rule
   */
  static async updateRule(ruleId: string, updateData: Partial<CreateRuleData>): Promise<SchedulingRule> {
    try {
      const { data, error } = await supabase
        .from('rule_definitions')
        .update(updateData)
        .eq('id', ruleId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error: any) {
      console.error('Error updating rule:', error)
      throw new Error(`Failed to update rule: ${error.message}`)
    }
  }

  /**
   * Delete a rule (soft delete by setting is_active to false)
   */
  static async deleteRule(ruleId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('rule_definitions')
        .update({ is_active: false })
        .eq('id', ruleId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error deleting rule:', error)
      throw new Error(`Failed to delete rule: ${error.message}`)
    }
  }

  /**
   * Permanently delete a rule
   */
  static async permanentlyDeleteRule(ruleId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('rule_definitions')
        .delete()
        .eq('id', ruleId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error permanently deleting rule:', error)
      throw new Error(`Failed to permanently delete rule: ${error.message}`)
    }
  }

  /**
   * Activate a rule
   */
  static async activateRule(ruleId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('rule_definitions')
        .update({ is_active: true })
        .eq('id', ruleId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error activating rule:', error)
      throw new Error(`Failed to activate rule: ${error.message}`)
    }
  }

  /**
   * Deactivate a rule
   */
  static async deactivateRule(ruleId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('rule_definitions')
        .update({ is_active: false })
        .eq('id', ruleId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error deactivating rule:', error)
      throw new Error(`Failed to deactivate rule: ${error.message}`)
    }
  }

  /**
   * Bulk create rules from text array
   */
  static async bulkCreateRules(rules: CreateRuleData[], userId: string): Promise<SchedulingRule[]> {
    try {
      const { data, error } = await supabase
        .from('rule_definitions')
        .insert(rules.map(rule => ({
          ...rule,
          created_by: userId,
          is_active: true
        })))
        .select()

      if (error) throw error

      return data || []
    } catch (error: any) {
      console.error('Error bulk creating rules:', error)
      throw new Error(`Failed to bulk create rules: ${error.message}`)
    }
  }

  /**
   * Format rules for AI prompt
   * Converts rules into a formatted string for AI to understand
   */
  static async formatRulesForAI(level: number): Promise<string> {
    try {
      const rules = await this.getRulesForLevel(level)
      
      if (rules.length === 0) {
        return 'No specific rules defined. Use general scheduling best practices.'
      }

      // Group rules by category
      const rulesByCategory: Record<string, SchedulingRule[]> = {}
      rules.forEach(rule => {
        if (!rulesByCategory[rule.rule_category]) {
          rulesByCategory[rule.rule_category] = []
        }
        rulesByCategory[rule.rule_category].push(rule)
      })

      // Format into readable string
      let formattedRules = `Scheduling Rules for Level ${level}:\n\n`

      // Critical rules first (priority >= 8)
      const criticalRules = rules.filter(r => r.priority >= 8)
      if (criticalRules.length > 0) {
        formattedRules += '🚨 CRITICAL RULES (MUST FOLLOW):\n'
        criticalRules.forEach(rule => {
          formattedRules += `- [Priority ${rule.priority}] ${rule.rule_text}\n`
        })
        formattedRules += '\n'
      }

      // Other rules by category
      Object.entries(rulesByCategory).forEach(([category, categoryRules]) => {
        const nonCriticalRules = categoryRules.filter(r => r.priority < 8)
        if (nonCriticalRules.length > 0) {
          formattedRules += `📋 ${category.toUpperCase().replace('_', ' ')} RULES:\n`
          nonCriticalRules.forEach(rule => {
            formattedRules += `- [Priority ${rule.priority}] ${rule.rule_text}\n`
          })
          formattedRules += '\n'
        }
      })

      return formattedRules
    } catch (error) {
      console.error('Error formatting rules for AI:', error)
      return 'Error loading rules. Use default scheduling practices.'
    }
  }

  /**
   * Validate schedule against rules
   * Returns array of rule violations
   */
  static async validateScheduleAgainstRules(scheduleData: any, level: number): Promise<Array<{
    rule: SchedulingRule
    violation: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }>> {
    try {
      const rules = await this.getRulesForLevel(level)
      const violations: Array<{ rule: SchedulingRule; violation: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = []

      // This is a simplified validation - you can expand this with more sophisticated checks
      rules.forEach(rule => {
        const ruleText = rule.rule_text.toLowerCase()
        
        // Check for Friday classes
        if (ruleText.includes('no classes on friday')) {
          const hasFridayClasses = this.checkForFridayClasses(scheduleData)
          if (hasFridayClasses) {
            violations.push({
              rule,
              violation: 'Schedule contains classes on Friday',
              severity: rule.priority >= 8 ? 'critical' : 'high'
            })
          }
        }

        // Check for break time violations
        if (ruleText.includes('break time') || ruleText.includes('12:00')) {
          const hasBreakTimeViolation = this.checkForBreakTimeViolations(scheduleData)
          if (hasBreakTimeViolation) {
            violations.push({
              rule,
              violation: 'Schedule contains classes during break time (12:00-1:00 PM)',
              severity: rule.priority >= 8 ? 'critical' : 'high'
            })
          }
        }

        // Add more rule checks as needed...
      })

      return violations
    } catch (error) {
      console.error('Error validating schedule against rules:', error)
      return []
    }
  }

  /**
   * Check if schedule has Friday classes
   */
  private static checkForFridayClasses(scheduleData: any): boolean {
    const groups = scheduleData.groups || {}
    for (const groupData of Object.values(groups)) {
      const sections = (groupData as any).sections || []
      if (sections.some((s: any) => s.day?.toLowerCase() === 'friday')) {
        return true
      }
    }
    return false
  }

  /**
   * Check if schedule has break time violations (12:00-13:00)
   */
  private static checkForBreakTimeViolations(scheduleData: any): boolean {
    const groups = scheduleData.groups || {}
    for (const groupData of Object.values(groups)) {
      const sections = (groupData as any).sections || []
      if (sections.some((s: any) => {
        const start = s.start_time
        const end = s.end_time
        // Check if class overlaps with 12:00-13:00
        return (start >= '12:00' && start < '13:00') || 
               (end > '12:00' && end <= '13:00') ||
               (start < '12:00' && end > '13:00')
      })) {
        return true
      }
    }
    return false
  }

  /**
   * Get rule statistics
   */
  static async getRuleStatistics(): Promise<{
    total: number
    active: number
    inactive: number
    by_category: Record<string, number>
    by_priority: Record<string, number>
  }> {
    try {
      const allRules = await this.getAllRules()

      const stats = {
        total: allRules.length,
        active: 0,
        inactive: 0,
        by_category: {} as Record<string, number>,
        by_priority: {} as Record<string, number>
      }

      allRules.forEach(rule => {
        if (rule.is_active) {
          stats.active++
        } else {
          stats.inactive++
        }

        stats.by_category[rule.rule_category] = (stats.by_category[rule.rule_category] || 0) + 1
        
        const priorityLevel = rule.priority >= 8 ? 'critical' : rule.priority >= 5 ? 'medium' : 'low'
        stats.by_priority[priorityLevel] = (stats.by_priority[priorityLevel] || 0) + 1
      })

      return stats
    } catch (error) {
      console.error('Error getting rule statistics:', error)
      return {
        total: 0,
        active: 0,
        inactive: 0,
        by_category: {},
        by_priority: {}
      }
    }
  }
}

