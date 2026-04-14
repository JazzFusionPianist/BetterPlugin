import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface LiveSession {
  id: string
  host_id: string
  title: string
  started_at: string
  has_video: boolean
  has_audio: boolean
  video_source: 'daw' | 'screen' | 'camera' | 'none'
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
    // Clean up any stale session left from a previous app session
    client.from('live_sessions').delete().eq('host_id', userId).then(() => fetchSessions())

    const channel = client
      .channel('live-sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        fetchSessions()
      })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [client, userId, fetchSessions])

  const startLive = useCallback(async (
    title: string,
    opts: { has_video: boolean; has_audio: boolean; video_source: LiveSession['video_source'] }
  ) => {
    // End any existing session first (in case of stale row)
    await client.from('live_sessions').delete().eq('host_id', userId)
    const { data, error } = await client
      .from('live_sessions')
      .insert({ host_id: userId, title, ...opts })
      .select()
      .single()
    if (error) {
      console.error('startLive insert failed:', error)
      throw new Error(error.message)
    }
    if (data) {
      setMySession(data as LiveSession)
      await fetchSessions()
      return data as LiveSession
    }
    return null
  }, [client, userId, fetchSessions])

  const endLive = useCallback(async () => {
    await client.from('live_sessions').delete().eq('host_id', userId)
    setMySession(null)
    await fetchSessions()
  }, [client, userId, fetchSessions])

  const liveHostIds = new Set(liveSessions.map(s => s.host_id))

  return { liveSessions, mySession, liveHostIds, startLive, endLive }
}
