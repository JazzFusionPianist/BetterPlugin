/**
 * Returns who has read the given conversation up to when — used to
 * paint the "read by" indicator below my last sent message.
 *
 * Shape: `Map<userId, last_seen_at_ms>`, excluding the current user
 * (we don't need to mark our own messages as read by ourselves). For
 * any of my messages, anyone whose `last_seen_at_ms >= msg.created_at`
 * has seen it.
 *
 * Updates live via Realtime — when a peer opens the chat, their
 * `markSeen` upserts a `conversation_reads` row and we pick the
 * change up here without a refetch.
 */

import { useEffect, useState, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function useConversationReads(
  supabase: SupabaseClient,
  conversationId: string | null,
  currentUserId: string,
) {
  const [reads, setReads] = useState<Map<string, number>>(new Map())

  const fetchReads = useCallback(async (cid: string) => {
    const { data, error } = await supabase
      .from('conversation_reads')
      .select('user_id, last_seen_at')
      .eq('conversation_id', cid)
      .neq('user_id', currentUserId)
    if (error) { console.error('[useConversationReads]', error); return }
    const next = new Map<string, number>()
    for (const r of (data ?? []) as Array<{ user_id: string; last_seen_at: string }>)
      next.set(r.user_id, new Date(r.last_seen_at).getTime())
    setReads(next)
  }, [supabase, currentUserId])

  useEffect(() => {
    if (!conversationId) { setReads(new Map()); return }
    fetchReads(conversationId)

    // Live updates — peer opens chat → upsert fires INSERT or UPDATE
    // depending on whether they had a prior read row. Subscribe to
    // both. RLS keeps this row-level safe (we only see our own
    // conversations' reads).
    const ch = supabase
      .channel(`reads:${conversationId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_reads',
          filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { user_id: string; last_seen_at?: string } | null
          if (!row || row.user_id === currentUserId) return
          if (!payload.new) {
            // DELETE — drop the user from the map
            setReads(prev => {
              const next = new Map(prev); next.delete(row.user_id); return next
            })
            return
          }
          const ts = new Date((payload.new as { last_seen_at: string }).last_seen_at).getTime()
          setReads(prev => {
            const next = new Map(prev); next.set(row.user_id, ts); return next
          })
        })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [conversationId, fetchReads, supabase, currentUserId])

  return reads
}
