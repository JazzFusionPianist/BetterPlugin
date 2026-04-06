import { useEffect, useState, useCallback, useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppNotification } from '../types/collab'

export function useFriendEvents(supabase: SupabaseClient, currentUserId: string) {
  const [events, setEvents] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, read, created_at, actor:profiles!actor_id(id, display_name, avatar_color, avatar_url)')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setEvents(data as unknown as AppNotification[])
    setLoading(false)
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
