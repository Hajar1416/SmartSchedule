'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CollaborationParticipant } from '@/components/ui/CollaborationIndicator'

type DbParticipantRow = {
  id: string
  collaboration_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  joined_at: string
  last_active_at: string | null
}

type DbUserRow = {
  id: string
  full_name?: string | null
  email?: string | null
  //avatar_url?: string | null
}

interface UseCollabResult {
  participants: CollaborationParticipant[]
  sessionId: string | null
}

/**
 * Hook: given a scheduleVersionId + current userId,
 * - find or create an active collaboration_session
 * - ensure the user is a participant
 * - keep a real-time list of participants for CollaborationIndicator
 */
export function useCollaborationParticipantsForSchedule(
  scheduleVersionId: string | null | undefined,
  userId: string | null | undefined
): UseCollabResult {
  const [participants, setParticipants] = useState<CollaborationParticipant[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!scheduleVersionId || !userId) return

    let isCancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    let heartbeat: ReturnType<typeof setInterval> | null = null

    const ONLINE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

    const loadParticipants = async (collabId: string) => {
      const { data: participantRows, error: participantsError } = await supabase
        .from('collaboration_participants')
        .select('id, collaboration_id, user_id, role, joined_at, last_active_at')
        .eq('collaboration_id', collabId)

      if (participantsError || !participantRows) {
        console.error('Error loading participants', participantsError)
        return
      }

      const userIds = Array.from(
        new Set(participantRows.map((p: DbParticipantRow) => p.user_id))
      )

      let userMap = new Map<string, DbUserRow>()

      if (userIds.length > 0) {
        const { data: userRows, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', userIds)

        if (usersError) {
          console.error('Error loading user profiles', usersError)
        } else if (userRows) {
          userMap = new Map(userRows.map((u: DbUserRow) => [u.id, u]))
        }
      }

      const now = Date.now()

      const uiParticipants: CollaborationParticipant[] = participantRows.map(
        (row: DbParticipantRow) => {
          const profile = userMap.get(row.user_id)
          const lastActive = row.last_active_at
            ? new Date(row.last_active_at).getTime()
            : 0
          const isOnline = now - lastActive < ONLINE_WINDOW_MS

          return {
            id: row.user_id,
            name:
              profile?.full_name ||
              profile?.email ||
              `User ${row.user_id.slice(0, 6)}`,
           // avatar_url: profile?.avatar_url ?? undefined,
            isOnline,
          }
        }
      )

      if (!isCancelled) {
        setParticipants(uiParticipants)
      }
    }

    const touchCurrentUser = async (collabId: string) => {
      const { error } = await supabase
        .from('collaboration_participants')
        .update({ last_active_at: new Date().toISOString() })
        .eq('collaboration_id', collabId)
        .eq('user_id', userId)

      if (error) {
        console.error('Error updating last_active_at', error)
      }
    }

    const init = async () => {
      // 1) Find existing active session for this schedule version
      const { data: existingSessions, error: sessionError } = await supabase
        .from('collaboration_sessions')
        .select('*')
        .eq('schedule_version_id', scheduleVersionId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)

     if (sessionError) {
  console.error(
    'Error loading collaboration session',
    sessionError,
    (sessionError as any).message,
    (sessionError as any).hint,
    (sessionError as any).details
  )
  return
}

      let session = existingSessions?.[0]

      // 2) If none, create a session
      if (!session) {
        const { data: newSession, error: createError } = await supabase
          .from('collaboration_sessions')
          .insert({
            schedule_version_id: scheduleVersionId,
            status: 'active',
            created_by: userId,
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating collaboration session', createError)
          return
        }

        session = newSession
      }

      if (isCancelled) return

      setSessionId(session.id)

      // 3) Make sure current user is a participant
      const { data: existingParticipant, error: participantError } = await supabase
        .from('collaboration_participants')
        .select('*')
        .eq('collaboration_id', session.id)
        .eq('user_id', userId)
        .maybeSingle()

      if (participantError) {
        console.error('Error checking participant', participantError)
      } else if (!existingParticipant) {
        const { error: insertError } = await supabase
          .from('collaboration_participants')
          .insert({
            collaboration_id: session.id,
            user_id: userId,
            role: 'editor',
            last_active_at: new Date().toISOString(),
          })

        if (insertError) {
          console.error('Error inserting participant', insertError)
        }
      } else {
        await touchCurrentUser(session.id)
      }

      // 4) Initial load
      await loadParticipants(session.id)

      // 5) Subscribe to realtime changes
      channel = supabase
        .channel(`collaboration-participants-${session.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'collaboration_participants',
            filter: `collaboration_id=eq.${session.id}`,
          },
          () => {
            loadParticipants(session.id)
          }
        )
        .subscribe()

      // 6) Heartbeat – keep current user online
      heartbeat = setInterval(() => {
        touchCurrentUser(session.id)
      }, 2 * 60 * 1000)
    }

    init()

    return () => {
      isCancelled = true
      if (channel) supabase.removeChannel(channel)
      if (heartbeat) clearInterval(heartbeat)
    }
  }, [scheduleVersionId, userId])

  return { participants, sessionId }
}
