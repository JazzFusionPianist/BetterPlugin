/**
 * One conversation's messages + send action.
 *
 * Accepts a `ChatTarget` — either `{ kind: 'dm', otherUserId }` or
 * `{ kind: 'group', conversationId }`. DMs are resolved to (or
 * created as) a conversation via `getOrCreateDmConversation`; groups
 * already have a conversation_id and pass through. From there on,
 * everything is conversation_id-keyed: fetch, subscribe, send.
 *
 * Realtime: we subscribe to *all* INSERTs on `messages` and filter
 * client-side by conversation_id. That's safe because RLS only delivers
 * rows the user can SELECT, which by policy is "conversations I'm a
 * member of." Supabase's channel filter syntax is single-column-eq
 * only, so this is the cleanest pattern.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message, AttachType, ChatTarget } from '../types/collab'
import { getOrCreateDmConversation } from '../lib/conversations'

export function useMessages(
  supabase: SupabaseClient,
  currentUserId: string,
  target: ChatTarget | null,
) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  // The DM's conversation_id once resolved. `null` while loading or if
  // no thread is open. Used by `send()` and the realtime filter.
  const [convId, setConvId] = useState<string | null>(null)
  const convIdRef = useRef<string | null>(null)
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)

  useEffect(() => { convIdRef.current = convId }, [convId])

  useEffect(() => {
    // Tear down any prior channel before swapping threads.
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    if (!target) {
      setMessages([])
      setConvId(null)
      return
    }

    let alive = true
    setLoading(true)

    ;(async () => {
      let cid: string
      try {
        if (target.kind === 'dm') {
          cid = await getOrCreateDmConversation(supabase, currentUserId, target.otherUserId)
        } else {
          cid = target.conversationId
        }
      } catch (err) {
        console.error('[useMessages] conversation resolve failed', err)
        if (alive) { setLoading(false); setMessages([]) }
        return
      }
      if (!alive) return
      setConvId(cid)

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', cid)
        .order('created_at', { ascending: true })
        .limit(100)

      if (!alive) return
      setMessages((data as Message[]) ?? [])
      setLoading(false)

      // Subscribe AFTER history loads so the dedupe below has the right
      // baseline. RLS filters server-side; we further gate by conv id.
      const channel = supabase
        .channel(`chat:${cid}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        }, (payload) => {
          const msg = payload.new as Message
          if (msg.conversation_id !== convIdRef.current) return
          setMessages(prev => {
            // Already seen by real id (re-subscribe edge case) — drop.
            if (prev.some(m => m.id === msg.id)) return prev
            // Echo of my own send: replace the matching optimistic row
            // (same sender, same content, same attachment) in-place so
            // the user doesn't see it twice. The optimistic id starts
            // with "opt-" — unique enough to identify locally.
            if (msg.sender_id === currentUserId) {
              const optIdx = prev.findIndex(m =>
                m.id.startsWith('opt-')
                && m.sender_id === currentUserId
                && m.content === msg.content
                && (m.attachment_url ?? null) === (msg.attachment_url ?? null)
              )
              if (optIdx >= 0) {
                const next = prev.slice()
                next[optIdx] = msg
                return next
              }
            }
            return [...prev, msg]
          })
        })
        .subscribe()

      channelRef.current = channel
    })()

    return () => {
      alive = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  // Stringify the target so we re-run when the actual target changes,
  // not on every parent re-render that creates a new object literal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, currentUserId, target ? `${target.kind}:${target.kind === 'dm' ? target.otherUserId : target.conversationId}` : null])

  const send = useCallback(async (
    content: string,
    attachment?: { url: string; type: AttachType; name: string },
  ): Promise<boolean> => {
    const cid = convIdRef.current
    if (!cid || (!content.trim() && !attachment)) return false

    const expiresAt = attachment
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null

    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      conversation_id: cid,
      sender_id: currentUserId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_expires_at: expiresAt,
      attachment_expired: false,
    }

    setMessages(prev => [...prev, optimistic])

    const { error } = await supabase.from('messages').insert({
      conversation_id: cid,
      sender_id: currentUserId,
      content: content.trim(),
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_expires_at: expiresAt,
    })

    if (error) {
      console.error('[useMessages] send failed', {
        error,
        conversation_id: cid,
        sender_id: currentUserId,
        content_len: content.trim().length,
        has_attachment: !!attachment,
      })
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      return false
    }
    return true
  }, [supabase, currentUserId])

  return { messages, loading, send, conversationId: convId }
}
