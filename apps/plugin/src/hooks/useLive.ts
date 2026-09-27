import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface LiveSession {
  id: string
  host_id: string
  title: string
  started_at: string
  has_video: boolean
  has_audio: boolean
  audience: 'authenticated' | 'invited'
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        fetchSessions()
      })
      .subscribe()
    const timer=setInterval(fetchSessions,15000)
    return () => { client.removeChannel(channel); clearInterval(timer) }
  }, [client, userId, fetchSessions])

  const startLive = useCallback(async (
    title: string,
    opts: { has_video: boolean; has_audio: boolean; video_source: LiveSession['video_source']; audience?: LiveSession['audience']; invited?: string[] }
  ) => {
    const {data,error}=await client.rpc('live_start',{p_title:title,p_video:opts.has_video,p_audio:opts.has_audio,p_source:opts.video_source,p_audience:opts.audience??'invited',p_invited:opts.invited??[]})
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
    if(mySession) { const {error}=await client.rpc('live_manage',{p_session:mySession.id,p_action:'end'}); if(error) throw error }
    setMySession(null)
    await fetchSessions()
  }, [client, userId, fetchSessions, mySession])

  /** Update fields on the running session (e.g. has_video when source switches). */
  const updateLive = useCallback(async (
    opts: Partial<Pick<LiveSession, 'has_video' | 'has_audio' | 'video_source'>>
  ) => {
    if (!mySession) return
    const { error } = await client.rpc('live_manage',{p_session:mySession.id,p_action:'update',p_video:opts.has_video??null,p_audio:opts.has_audio??null,p_source:opts.video_source??null})
    if (error) console.error('updateLive failed:', error)
    await fetchSessions()
  }, [client, userId, fetchSessions, mySession])

  const liveHostIds = new Set(liveSessions.map(s => s.host_id))
  // Quick lookup so ChatView / FriendsList can render the broadcast title
  // (and join the session) by hostId without re-scanning the array.
  const liveSessionByHost = new Map(liveSessions.map(s => [s.host_id, s]))

  return { liveSessions, mySession, liveHostIds, liveSessionByHost, startLive, endLive, updateLive }
}
