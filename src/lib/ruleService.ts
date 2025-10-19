import { supabase } from './supabase'

export interface Rule {
  id: string
  rule_text?: string
  rule_category?: string
  priority?: number
  is_active?: boolean
  applies_to_levels?: number[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateRuleData {
  rule_text: string
  rule_category: string
  priority?: number
  is_active?: boolean
  applies_to_levels?: number[]
}

export interface UpdateRuleData extends Partial<CreateRuleData> {
  id: string
}

export class RuleService {
  static async getAllRules(): Promise<Rule[]> {
    const { data, error } = await supabase
      .from('rule_definitions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async getRuleById(id: string): Promise<Rule | null> {
    const { data, error } = await supabase
      .from('rule_definitions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async createRule(ruleData: CreateRuleData): Promise<Rule> {
    const { data, error } = await supabase
      .from('rule_definitions')
      .insert(ruleData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateRule(ruleData: UpdateRuleData): Promise<Rule> {
    const { id, ...updateData } = ruleData
    const { data, error } = await supabase
      .from('rule_definitions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async deleteRule(id: string): Promise<void> {
    const { error } = await supabase
      .from('rule_definitions')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  static async getRulesByType(type: string): Promise<Rule[]> {
    const { data, error } = await supabase
      .from('rule_definitions')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}
