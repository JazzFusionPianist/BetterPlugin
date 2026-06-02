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
    fetchSessions()

    const channel = client
      .channel('live-sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, (payload) => {
        console.log('[useLive] realtime event:', payload.eventType, payload.new ?? payload.old)
        fetchSessions()
      })
      .subscribe(status => console.log('[useLive] sub status:', status))
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

  /** Update fields on the running session (e.g. has_video when source switches). */
  const updateLive = useCallback(async (
    opts: Partial<Pick<LiveSession, 'has_video' | 'has_audio' | 'video_source'>>
  ) => {
    const { error } = await client
      .from('live_sessions')
      .update(opts)
      .eq('host_id', userId)
    if (error) console.error('updateLive failed:', error)
    await fetchSessions()
  }, [client, userId, fetchSessions])

  const liveHostIds = new Set(liveSessions.map(s => s.host_id))
  // Quick lookup so ChatView / FriendsList can render the broadcast title
  // (and join the session) by hostId without re-scanning the array.
  const liveSessionByHost = new Map(liveSessions.map(s => [s.host_id, s]))

  return { liveSessions, mySession, liveHostIds, liveSessionByHost, startLive, endLive, updateLive }
}
