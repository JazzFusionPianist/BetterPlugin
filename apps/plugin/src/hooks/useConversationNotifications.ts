/**
 * Per-conversation notification state.
 *
 * Replaces the friend-keyed `useFriendNotifications` from the 1:1-only
 * era. Returned `unread` is `Map<conversationId, count>`; `lastMessages`
 * is `Map<conversationId, Message>`. `markSeen(convId)` clears the
 * per-conversation pulse and persists the timestamp.
 *
 * For DM-rendering surfaces (ProfilePanel orb pulse) the caller maps
 * conversation_id → partner user_id via the conversation list. We
 * deliberately don't bake that translation in here — group conversations
 * (Phase 5) get the same notification machinery but have no single
 * "friend" to map to.
 *
 * Storage model:
 *   • `conversation_reads(conversation_id, user_id, last_seen_at)` —
 *     server source of truth, see migration 20260603.
 *   • localStorage caches `last_seen_at` per conversation so we don't
 *     round-trip on every realtime push.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message } from '../types/collab'

const lsKey = (uid: string, cid: string) => `notif_lastseen_${uid}_${cid}`
const readLocal  = (uid: string, cid: string) => Number(localStorage.getItem(lsKey(uid, cid)) ?? 0)
const writeLocal = (uid: string, cid: string, ts: number) =>
  localStorage.setItem(lsKey(uid, cid), String(ts))

export function useConversationNotifications (supabase: SupabaseClient, currentUserId: string) {
  // Map<conversationId, unreadCount>. Empty → no orb gets a pulse.
  const [unread, setUnread] = useState<Map<string, number>>(new Map())
  // Most recent unread message per conversation — drives the banner.
  const [lastMessages, setLastMessages] = useState<Map<string, Message>>(new Map())

  // Per-conversation last-seen timestamps (epoch ms). Updated
  // optimistically on markSeen and after the server fetch in init.
  const lastSeenRef = useRef<Map<string, number>>(new Map())
  const initialisedRef = useRef(false)

  // Prefer local — we may have an optimistic update the server hasn't flushed.
  const effectiveSeen = useCallback((convId: string) => {
    return Math.max(
      readLocal(currentUserId, convId),
      lastSeenRef.current.get(convId) ?? 0,
    )
  }, [currentUserId])

  useEffect(() => {
    let alive = true
    initialisedRef.current = false
    // Buffer realtime arrivals that come before init has set the seen
    // baseline so we don't drop a message that lands mid-fetch.
    const pending: Message[] = []

    ;(async () => {
      // 1. Pull current last_seen_at rows for me.
      const { data: reads } = await supabase
        .from('conversation_reads')
        .select('conversation_id, last_seen_at')
        .eq('user_id', currentUserId)

      const seenMap = new Map<string, number>()
      if (reads) {
        for (const row of reads as Array<{ conversation_id: string; last_seen_at: string }>) {
          const ts = new Date(row.last_seen_at).getTime()
          seenMap.set(row.conversation_id, ts)
          writeLocal(currentUserId, row.conversation_id, ts)
        }
      }
      lastSeenRef.current = seenMap

      // 2. Pull recent inbox across every conversation I'm a member of
      //    (last 30 days, capped 500). RLS filters server-side.
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .neq('sender_id', currentUserId)   // my own sends never count as unread
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(500)

      if (!alive) return

      // 3. First-run init: stamp `last_seen_at = now` for any conversation
      //    we have no read row for, so a brand-new device doesn't act
      //    like every old message is suddenly unread.
      const messages = (msgs as Message[] | null) ?? []
      const convs    = new Set(messages.map(m => m.conversation_id))
      const initRows: Array<{ user_id: string; conversation_id: string; last_seen_at: string }> = []
      const nowMs    = Date.now()
      const nowIso   = new Date(nowMs).toISOString()
      for (const cid of convs) {
        if (!seenMap.has(cid)) {
          seenMap.set(cid, nowMs)
          writeLocal(currentUserId, cid, nowMs)
          initRows.push({ user_id: currentUserId, conversation_id: cid, last_seen_at: nowIso })
        }
      }
      if (initRows.length > 0) {
        supabase.from('conversation_reads')
          .upsert(initRows, { onConflict: 'conversation_id,user_id' })
          .then(() => {})
      }

      if (!alive) return

      // 4. Build the unread map from the baseline + dedupe in anything
      //    realtime queued during the fetch.
      const counted = new Set<string>()
      const map = new Map<string, number>()
      const latest = new Map<string, Message>()
      const apply = (m: Message) => {
        if (counted.has(m.id)) return
        counted.add(m.id)
        if (m.sender_id === currentUserId) return
        const seen = seenMap.get(m.conversation_id) ?? 0
        if (new Date(m.created_at).getTime() <= seen) return
        map.set(m.conversation_id, (map.get(m.conversation_id) ?? 0) + 1)
        const prev = latest.get(m.conversation_id)
        if (!prev || new Date(m.created_at).getTime() > new Date(prev.created_at).getTime())
          latest.set(m.conversation_id, m)
      }
      for (const m of messages) apply(m)
      for (const m of pending) apply(m)
      pending.length = 0

      initialisedRef.current = true
      setUnread(map)
      setLastMessages(latest)
    })()

    // 5. Realtime — RLS gates the stream to conversations I'm in.
    const ch = supabase
      .channel(`conv-notif:${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, payload => {
        const msg = payload.new as Message
        if (msg.sender_id === currentUserId) return   // my own send
        if (!initialisedRef.current) { pending.push(msg); return }
        const seen = effectiveSeen(msg.conversation_id)
        if (new Date(msg.created_at).getTime() <= seen) return
        setUnread(prev => {
          const next = new Map(prev)
          next.set(msg.conversation_id, (next.get(msg.conversation_id) ?? 0) + 1)
          return next
        })
        setLastMessages(prev => {
          const next = new Map(prev)
          next.set(msg.conversation_id, msg)
          return next
        })
      })
      .subscribe()

    return () => { alive = false; supabase.removeChannel(ch) }
  }, [supabase, currentUserId, effectiveSeen])

  // Mark a conversation as seen — orb pulse clears, server row updates.
  const markSeen = useCallback((conversationId: string) => {
    const ts = Date.now()
    lastSeenRef.current.set(conversationId, ts)
    writeLocal(currentUserId, conversationId, ts)
    setUnread(prev => {
      if (!prev.has(conversationId)) return prev
      const next = new Map(prev)
      next.delete(conversationId)
      return next
    })
    setLastMessages(prev => {
      if (!prev.has(conversationId)) return prev
      const next = new Map(prev)
      next.delete(conversationId)
      return next
    })
    supabase.from('conversation_reads')
      .upsert(
        { user_id: currentUserId, conversation_id: conversationId, last_seen_at: new Date(ts).toISOString() },
        { onConflict: 'conversation_id,user_id' },
      )
      .then(() => {})
  }, [supabase, currentUserId])

  return { unread, lastMessages, markSeen }
}
