import { supabaseAdmin } from './supabase'

export interface CollaborationSession {
  id: string
  schedule_version_id: string
  title: string | null
  description: string | null
  status: 'active' | 'closed'
  created_by: string
  created_at: string
  updated_at: string
  expires_at: string | null
}

export interface CollaborationParticipant {
  id: string
  collaboration_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  joined_at: string
  last_active_at: string | null
}

export interface CollaborationComment {
  id: string
  collaboration_id: string
  user_id: string
  body: string
  thread_key: string | null
  created_at: string
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
}

export interface CreateSessionData {
  schedule_version_id: string
  title?: string
  description?: string
  created_by: string
  expires_at?: string | null
  participants?: Array<{
    user_id: string
    role?: 'editor' | 'viewer'
  }>
}

export class CollaborationService {
  static async createSession(data: CreateSessionData): Promise<CollaborationSession> {
    const { data: session, error } = await supabaseAdmin
      .from('collaboration_sessions')
      .insert({
        schedule_version_id: data.schedule_version_id,
        title: data.title || null,
        description: data.description || null,
        status: 'active',
        created_by: data.created_by,
        expires_at: data.expires_at || null
      })
      .select()
      .single()

    if (error) throw error
    const createdSession = session as CollaborationSession

    const participants: Partial<CollaborationParticipant>[] = [
      {
        collaboration_id: createdSession.id,
        user_id: data.created_by,
        role: 'owner'
      }
    ]

    if (data.participants) {
      data.participants.forEach(p => {
        participants.push({
          collaboration_id: createdSession.id,
          user_id: p.user_id,
          role: p.role || 'editor'
        })
      })
    }

    if (participants.length > 0) {
      const { error: participantsError } = await supabaseAdmin
        .from('collaboration_participants')
        .insert(participants)

      if (participantsError) throw participantsError
    }

    return createdSession
  }

  static async getSessionById(id: string): Promise<CollaborationSession | null> {
    const { data, error } = await supabaseAdmin
      .from('collaboration_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if ((error as any).code === 'PGRST116') return null
      throw error
    }

    return data as CollaborationSession
  }

  static async getSessionsForVersion(scheduleVersionId: string): Promise<CollaborationSession[]> {
    const { data, error } = await supabaseAdmin
      .from('collaboration_sessions')
      .select('*')
      .eq('schedule_version_id', scheduleVersionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as CollaborationSession[]
  }

  static async joinSession(sessionId: string, userId: string, role: 'editor' | 'viewer' = 'editor'): Promise<void> {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('collaboration_participants')
      .select('*')
      .eq('collaboration_id', sessionId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingError) throw existingError

    if (existing) {
      const { error } = await supabaseAdmin
        .from('collaboration_participants')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('collaboration_participants')
        .insert({
          collaboration_id: sessionId,
          user_id: userId,
          role,
          last_active_at: new Date().toISOString()
        })

      if (error) throw error
    }
  }

  static async touchParticipant(sessionId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('collaboration_participants')
      .update({ last_active_at: new Date().toISOString() })
      .eq('collaboration_id', sessionId)
      .eq('user_id', userId)

    if (error) throw error
  }

  static async getParticipants(sessionId: string): Promise<CollaborationParticipant[]> {
    const { data, error } = await supabaseAdmin
      .from('collaboration_participants')
      .select('*')
      .eq('collaboration_id', sessionId)
      .order('joined_at', { ascending: true })

    if (error) throw error
    return (data || []) as CollaborationParticipant[]
  }

  static async addComment(params: {
    collaboration_id: string
    user_id: string
    body: string
    thread_key?: string | null
  }): Promise<CollaborationComment> {
    const { data, error } = await supabaseAdmin
      .from('collaboration_comments')
      .insert({
        collaboration_id: params.collaboration_id,
        user_id: params.user_id,
        body: params.body,
        thread_key: params.thread_key || null,
        resolved: false
      })
      .select()
      .single()

    if (error) throw error
    return data as CollaborationComment
  }

  static async getCommentsForSession(collaborationId: string): Promise<CollaborationComment[]> {
    const { data, error } = await supabaseAdmin
      .from('collaboration_comments')
      .select('*')
      .eq('collaboration_id', collaborationId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data || []) as CollaborationComment[]
  }

  static async closeSession(sessionId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('collaboration_sessions')
      .update({
        status: 'closed',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (error) throw error
  }
}
