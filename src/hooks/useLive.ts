import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface LiveSession {
  id: string
  host_id: string
  title: string
  started_at: string
}

export function useLive(client: SupabaseClient, userId: string) {
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([])
  const [mySession, setMySession] = useState<LiveSession | null>(null)

  const fetchSessions = useCallback(async () => {
    const { data } = await client.from('live_sessions').select('*').order('started_at', { ascending: true })
    if (data) {
      setLiveSessions(data as LiveSession[])
      setMySession((data as LiveSession[]).find(s => s.host_id === userId) ?? null)
    }
  }, [client, userId])

  useEffect(() => {
    fetchSessions()
    const channel = client
      .channel('live-sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        fetchSessions()
      })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [client, fetchSessions])

  const startLive = useCallback(async (title: string) => {
    // End any existing session first (in case of stale row)
    await client.from('live_sessions').delete().eq('host_id', userId)
    const { data } = await client
      .from('live_sessions')
      .insert({ host_id: userId, title })
      .select()
      .single()
    if (data) {
      setMySession(data as LiveSession)
      await fetchSessions()
    }
  }, [client, userId, fetchSessions])

  const endLive = useCallback(async () => {
    await client.from('live_sessions').delete().eq('host_id', userId)
    setMySession(null)
    await fetchSessions()
  }, [client, userId, fetchSessions])

  const liveHostIds = new Set(liveSessions.map(s => s.host_id))

  return { liveSessions, mySession, liveHostIds, startLive, endLive }
}
