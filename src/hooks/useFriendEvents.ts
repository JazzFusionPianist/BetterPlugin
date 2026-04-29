import { useEffect, useState, useCallback, useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppNotification } from '../types/collab'

export function useFriendEvents(supabase: SupabaseClient, currentUserId: string) {
  const [events, setEvents] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    // Two-step fetch — avoids PostgREST foreign-key relationship inference
    // (which requires schema cache to know notifications.actor_id → profiles.id)
    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('id, type, read, created_at, metadata, actor_id')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) { console.error('[useFriendEvents] fetch error:', error); setLoading(false); return }
    if (!notifs || notifs.length === 0) { setEvents([]); setLoading(false); return }

    const actorIds = Array.from(new Set(notifs.map((n: any) => n.actor_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_color, avatar_url')
      .in('id', actorIds)

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
    const merged = notifs.map((n: any) => ({
      id: n.id,
      type: n.type,
      read: n.read,
      created_at: n.created_at,
      metadata: n.metadata,
      actor: profileMap.get(n.actor_id) ?? { id: n.actor_id, display_name: 'Unknown', avatar_color: '#999', avatar_url: null },
    }))
    setEvents(merged as unknown as AppNotification[])
    setLoading(false)
  }, [supabase, currentUserId])

  // Debug: log realtime events
  useEffect(() => {
    const ch = supabase
      .channel(`debug_notifs:${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${currentUserId}`,
      }, payload => console.log('[useFriendEvents] realtime INSERT:', payload))
      .subscribe(status => console.log('[useFriendEvents] subscription status:', status))
    return () => { supabase.removeChannel(ch) }
  }, [supabase, currentUserId])

  useEffect(() => {
    fetch()

    const channel = supabase
      .channel(`friend_events:${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${currentUserId}`,
      }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetch, supabase, currentUserId])

  const unreadCount = useMemo(() => events.filter(e => !e.read).length, [events])

  const markAllRead = useCallback(async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', currentUserId).eq('read', false)
    setEvents(prev => prev.map(e => ({ ...e, read: true })))
  }, [supabase, currentUserId])

  const dismiss = useCallback(async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }, [supabase])

  return { events, loading, unreadCount, markAllRead, dismiss, refetch: fetch }
}
