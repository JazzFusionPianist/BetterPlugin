import { useEffect, useState, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message } from '../types/collab'

// localStorage acts as a quick cache for the server-side last-seen map so we
// don't hit the DB on every realtime push. Source of truth lives in the
// `conversation_reads` table.
const lastSeenKey = (userId: string, senderId: string) =>
  `notif_lastseen_${userId}_${senderId}`

function readLocalSeen(userId: string, senderId: string): number {
  const raw = localStorage.getItem(lastSeenKey(userId, senderId))
  return raw ? Number(raw) : 0
}

function writeLocalSeen(userId: string, senderId: string, ts: number) {
  localStorage.setItem(lastSeenKey(userId, senderId), String(ts))
}

export function useNotifications(supabase: SupabaseClient, currentUserId: string) {
  // Map<senderId, Message[]> — unread messages grouped by sender
  const [unread, setUnread] = useState<Map<string, Message[]>>(new Map())
  // Server-loaded last_seen_at per partner (in epoch ms). Initialised on mount.
  const lastSeenRef = useRef<Map<string, number>>(new Map())
  const initRef = useRef(false)
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)

  const getEffectiveSeen = useCallback((senderId: string) => {
    const local  = readLocalSeen(currentUserId, senderId)
    const server = lastSeenRef.current.get(senderId) ?? 0
    return Math.max(local, server)
  }, [currentUserId])

  useEffect(() => {
    let alive = true
    initRef.current = false

    ;(async () => {
      // 1. Pull existing reads from the server.
      const { data: reads } = await supabase
        .from('conversation_reads')
        .select('partner_id, last_seen_at')
        .eq('user_id', currentUserId)

      const seenMap = new Map<string, number>()
      if (reads) {
        for (const row of reads as Array<{ partner_id: string; last_seen_at: string }>) {
          const ts = new Date(row.last_seen_at).getTime()
          seenMap.set(row.partner_id, ts)
          writeLocalSeen(currentUserId, row.partner_id, ts)
        }
      }
      lastSeenRef.current = seenMap

      // 2. Fetch recent messages (last 30 days).
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('receiver_id', currentUserId)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(500)

      if (!alive) return

      // 3. First-run init: for any sender we have no read record for, treat
      //    every existing message as already seen by stamping last_seen_at = now.
      //    This stops a fresh device / cleared cache from flooding the user
      //    with old messages they already read elsewhere.
      const messages = (msgs as Message[] | null) ?? []
      const senders  = new Set(messages.map(m => m.sender_id))
      const initRows: Array<{ user_id: string; partner_id: string; last_seen_at: string }> = []
      const nowMs    = Date.now()
      const nowIso   = new Date(nowMs).toISOString()
      for (const sid of senders) {
        if (!seenMap.has(sid)) {
          seenMap.set(sid, nowMs)
          writeLocalSeen(currentUserId, sid, nowMs)
          initRows.push({ user_id: currentUserId, partner_id: sid, last_seen_at: nowIso })
        }
      }
      if (initRows.length > 0) {
        // Fire-and-forget upsert. If it fails the localStorage cache will keep
        // the user covered for the rest of the session.
        supabase.from('conversation_reads')
          .upsert(initRows, { onConflict: 'user_id,partner_id' })
          .then(() => {})
      }

      if (!alive) return
      initRef.current = true

      // 4. Compute the unread map relative to the now-correct baseline.
      const unreadMap = new Map<string, Message[]>()
      for (const msg of messages) {
        const seen = seenMap.get(msg.sender_id) ?? 0
        if (new Date(msg.created_at).getTime() > seen) {
          const list = unreadMap.get(msg.sender_id) ?? []
          list.push(msg)
          unreadMap.set(msg.sender_id, list)
        }
      }
      setUnread(unreadMap)
    })()

    // Subscribe to incoming messages so the unread map updates live.
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
          // Defer until init has loaded the server-side baseline so we don't
          // miscount messages that arrive during the initial fetch window.
          if (!initRef.current) return
          const msg  = payload.new as Message
          const seen = getEffectiveSeen(msg.sender_id)
          if (new Date(msg.created_at).getTime() > seen) {
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
      alive = false
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [supabase, currentUserId, getEffectiveSeen])

  const markSeen = useCallback((senderId: string) => {
    const ts = Date.now()
    lastSeenRef.current.set(senderId, ts)
    writeLocalSeen(currentUserId, senderId, ts)
    setUnread(prev => {
      if (!prev.has(senderId)) return prev
      const next = new Map(prev)
      next.delete(senderId)
      return next
    })
    // Persist to server so other devices / re-logins agree on the timestamp.
    supabase.from('conversation_reads')
      .upsert(
        { user_id: currentUserId, partner_id: senderId, last_seen_at: new Date(ts).toISOString() },
        { onConflict: 'user_id,partner_id' }
      )
      .then(() => {})
  }, [currentUserId, supabase])

  return { unread, markSeen }
}
