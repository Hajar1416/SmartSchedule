import { supabase } from './supabase'

export type RuleType =
  | 'break_time'
  | 'midterm_slot'
  | 'elective_timing'
  | 'lab_continuous'
  | 'day_off_balance'
  | 'prerequisite_alignment'
  | 'custom'

export interface RuleDefinition {
  id: string
  rule_type: RuleType
  rule_name: string
  description?: string
  parameters: any
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
}

/**
 * Rule Definitions Service
 * Manages structured scheduling rules
 */
export class RuleDefinitionsService {
  /**
   * Get all rule definitions
   */
  static async getAllRules(): Promise<RuleDefinition[]> {
    const { data, error } = await supabase
      .from('rule_definitions')
      .select('*')
      .order('priority', { ascending: false })

    if (error) {
      console.error('Error fetching rules:', error)
      return []
    }

    return data || []
  }

  /**
   * Get active rules only
   */
  static async getActiveRules(): Promise<RuleDefinition[]> {
    const { data, error } = await supabase
      .from('rule_definitions')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (error) {
      console.error('Error fetching active rules:', error)
      return []
    }

    return data || []
  }

  /**
   * Update rule activation status
   */
  static async toggleRuleStatus(ruleId: string, isActive: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('rule_definitions')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', ruleId)

    if (error) {
      console.error('Error updating rule status:', error)
      return false
    }

    return true
  }

  /**
   * Update rule parameters
   */
  static async updateRuleParameters(
    ruleId: string,
    parameters: any
  ): Promise<boolean> {
    const { error } = await supabase
      .from('rule_definitions')
      .update({ parameters, updated_at: new Date().toISOString() })
      .eq('id', ruleId)

    if (error) {
      console.error('Error updating rule parameters:', error)
      return false
    }

    return true
  }

  /**
   * Create custom rule
   */
  static async createCustomRule(
    ruleName: string,
    description: string,
    parameters: any,
    priority: number = 5
  ): Promise<{ success: boolean; ruleId?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('rule_definitions')
        .insert({
          rule_type: 'custom',
          rule_name: ruleName,
          description,
          parameters,
          is_active: true,
          priority
        })
        .select()
        .single()

      if (error) throw error

      return { success: true, ruleId: data.id }
    } catch (error: any) {
      console.error('Error creating custom rule:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete a rule
   */
  static async deleteRule(ruleId: string): Promise<boolean> {
    const { error } = await supabase
      .from('rule_definitions')
      .delete()
      .eq('id', ruleId)

    if (error) {
      console.error('Error deleting rule:', error)
      return false
    }

    return true
  }

  /**
   * Convert rules to natural language constraints for AI
   */
  static async getRulesAsAIConstraints(): Promise<string[]> {
    const activeRules = await this.getActiveRules()
    const constraints: string[] = []

    for (const rule of activeRules) {
      switch (rule.rule_type) {
        case 'break_time':
          constraints.push(
            `MANDATORY: Do NOT schedule any classes between ${rule.parameters.start_time}-${rule.parameters.end_time} on ${rule.parameters.days.join(', ')} (Lunch Break).`
          )
          break

        case 'midterm_slot':
          constraints.push(
            `RESERVED: ${rule.parameters.days.join(' and ')} from ${rule.parameters.start_time}-${rule.parameters.end_time} are reserved for midterm examinations. Do NOT schedule regular classes.`
          )
          break

        case 'elective_timing':
          const times = rule.parameters.preferred_times
            .map((t: any) => `${t.start}-${t.end}`)
            .join(' or ')
          constraints.push(
            `PREFERENCE: Schedule elective courses during preferred times: ${times} (early morning or late afternoon).`
          )
          break

        case 'lab_continuous':
          constraints.push(
            `REQUIREMENT: Lab courses (marked as is_lab) MUST be scheduled as continuous ${rule.parameters.duration_hours}-hour blocks. No breaks between lab time slots.`
          )
          break

        case 'day_off_balance':
          constraints.push(
            `BALANCE: Ensure each group has at least ${rule.parameters.min_light_days} day(s) per week with ${rule.parameters.max_classes_on_light_day} or fewer classes (light day).`
          )
          break

        case 'prerequisite_alignment':
          constraints.push(
            `ALIGNMENT: If prerequisite-linked courses are marked for alignment, schedule them at the same time across groups when beneficial.`
          )
          break

        case 'custom':
          constraints.push(`CUSTOM RULE: ${rule.description || rule.rule_name}`)
          break
      }
    }

    return constraints
  }

  /**
   * Get rule icon and color
   */
  static getRuleStyle(ruleType: RuleType): { icon: string; color: string } {
    const styles: Record<RuleType, { icon: string; color: string }> = {
      break_time: { icon: '🍽️', color: 'bg-orange-100 text-orange-800' },
      midterm_slot: { icon: '📝', color: 'bg-purple-100 text-purple-800' },
      elective_timing: { icon: '⏰', color: 'bg-blue-100 text-blue-800' },
      lab_continuous: { icon: '🧪', color: 'bg-green-100 text-green-800' },
      day_off_balance: { icon: '⚖️', color: 'bg-yellow-100 text-yellow-800' },
      prerequisite_alignment: { icon: '🔗', color: 'bg-indigo-100 text-indigo-800' },
      custom: { icon: '⚙️', color: 'bg-gray-100 text-gray-800' }
    }

    return styles[ruleType] || styles.custom
  }
}

