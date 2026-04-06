import { useEffect, useState, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message } from '../types/collab'

const lastSeenKey = (userId: string, senderId: string) =>
  `notif_lastseen_${userId}_${senderId}`

function getLastSeen(userId: string, senderId: string): number {
  const raw = localStorage.getItem(lastSeenKey(userId, senderId))
  return raw ? Number(raw) : 0
}

export function useNotifications(supabase: SupabaseClient, currentUserId: string) {
  // Map<senderId, Message[]> — unread messages grouped by sender
  const [unread, setUnread] = useState<Map<string, Message[]>>(new Map())
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)

  const computeUnread = (messages: Message[]): Map<string, Message[]> => {
    const map = new Map<string, Message[]>()
    for (const msg of messages) {
      const lastSeen = getLastSeen(currentUserId, msg.sender_id)
      if (new Date(msg.created_at).getTime() > lastSeen) {
        const list = map.get(msg.sender_id) ?? []
        list.push(msg)
        map.set(msg.sender_id, list)
      }
    }
    return map
  }

  const fetchUnread = useCallback(async () => {
    // Look back 30 days for unread messages
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver_id', currentUserId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(500)

    setUnread(computeUnread((data as Message[]) ?? []))
  }, [supabase, currentUserId])

  useEffect(() => {
    fetchUnread()

    // Subscribe to every incoming message for me
    const channel = supabase
      .channel(`notif:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          const lastSeen = getLastSeen(currentUserId, msg.sender_id)
          if (new Date(msg.created_at).getTime() > lastSeen) {
            setUnread(prev => {
              const next = new Map(prev)
              const list = next.get(msg.sender_id) ?? []
              next.set(msg.sender_id, [...list, msg])
              return next
            })
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [supabase, currentUserId, fetchUnread])

  const markSeen = useCallback((senderId: string) => {
    localStorage.setItem(lastSeenKey(currentUserId, senderId), String(Date.now()))
    setUnread(prev => {
      if (!prev.has(senderId)) return prev
      const next = new Map(prev)
      next.delete(senderId)
      return next
    })
  }, [currentUserId])

  return { unread, markSeen }
}
