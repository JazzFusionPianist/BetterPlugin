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
import type { Message, AttachType, ChatTarget, AttachmentTimelineMetadata } from '../types/collab'
import { getOrCreateDmConversation } from '../lib/conversations'
import { sendAccountMessage } from '../lib/accountChat'
import {readAttachmentStatus,withAttachmentRetention,expireAttachments} from '../lib/attachmentRetention'

import { messageId, decryptChatMessage } from '../lib/chatCrypto'

// The plugin deployment hosts the API routes. Core is bundler-agnostic
// (no env access), so the origin is fixed here; app-local copies of
// this hook resolve it their own way (plugin: same-origin, web:
// NEXT_PUBLIC_UPLOAD_API_BASE — see apps/web/lib/upload.ts).
const DELETE_API_BASE = 'https://better-plugin.vercel.app'

export function useMessages(
  supabase: SupabaseClient,
  currentUserId: string,
  target: ChatTarget | null,
) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [deliveryVersion, setDeliveryVersion] = useState(0)
  // The DM's conversation_id once resolved. `null` while loading or if
  // no thread is open. Used by `send()` and the realtime filter.
  const [convId, setConvId] = useState<string | null>(null)
  const convIdRef = useRef<string | null>(null)
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)

  useEffect(() => { convIdRef.current = convId }, [convId])
  useEffect(()=>{
    const timer=setInterval(()=>setMessages(previous=>expireAttachments(previous)),30000)
    return()=>clearInterval(timer)
  },[])
  useEffect(() => {
    const delivered=(event:Event)=>{
      if((event as CustomEvent).detail?.conversation===convIdRef.current)setDeliveryVersion(n=>n+1)
    }
    window.addEventListener('slur-chat-delivered',delivered)
    return ()=>window.removeEventListener('slur-chat-delivered',delivered)
  },[])

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
          cid = target.conversationId ?? await getOrCreateDmConversation(supabase, currentUserId, target.otherUserId)
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
        .order('created_at', { ascending: false })
        .limit(100)

      if (!alive) return
      const clear=await Promise.all(((data as Message[]) ?? []).reverse().map(m=>decryptChatMessage(supabase,currentUserId,m)))
      const statuses=await readAttachmentStatus(supabase,cid)
      if(!alive)return
      setMessages(clear.map(m=>withAttachmentRetention(m,statuses)))
      setLoading(false)

      // Subscribe AFTER history loads so the dedupe below has the right
      // baseline. RLS filters server-side; we further gate by conv id.
      const channel = supabase
        .channel(`chat:${cid}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        }, async (payload) => {
          const incoming = payload.new as Message
          if(incoming.conversation_id!==cid)return
          const msg = withAttachmentRetention(await decryptChatMessage(supabase,currentUserId,incoming),await readAttachmentStatus(supabase,cid))
          if(!alive)return
          if (msg.conversation_id !== convIdRef.current) return
          setMessages(prev => {
            // Already seen by real id (re-subscribe edge case) — drop.
            if (prev.some(m => m.id === msg.id)) return prev.map(m=>m.id===msg.id?msg:m)
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
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        }, (payload) => {
          // messages has REPLICA IDENTITY FULL (20260916_message_delete),
          // so the old row carries conversation_id and passes the same
          // client-side gate the INSERTs use.
          const old = payload.old as Partial<Message>
          if (!old.id) return
          if (old.conversation_id && old.conversation_id !== convIdRef.current) return
          setMessages(prev => prev.filter(m => m.id !== old.id))
        })
        .subscribe()

      channelRef.current = channel
    })().catch(()=>{
      if(alive){setLoading(false);window.dispatchEvent(new CustomEvent('orb-chat-error',{detail:'Could not load messages. Try again.'}))}
    })

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
  }, [supabase, currentUserId, deliveryVersion, target ? `${target.kind}:${target.kind === 'dm' ? `${target.otherUserId}:${target.conversationId ?? ''}` : target.conversationId}` : null])

  const send = useCallback(async (
    content: string,
    attachment?: { url: string; type: AttachType; name: string; metadata?: AttachmentTimelineMetadata },
  ): Promise<boolean> => {
    const cid = convIdRef.current
    if (!cid || (!content.trim() && !attachment)) return false

    // The server determines expiry from the uploader's plan; no client-supplied deadline.
    const expiresAt = null

    const id=await messageId()
    const optimistic: Message = {
      id: `opt-${id}`,
      conversation_id: cid,
      sender_id: currentUserId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_metadata: attachment?.metadata ?? null,
      attachment_expires_at: expiresAt,
      attachment_expired: false,
      pending: true,
    }

    setMessages(prev => [...prev, optimistic])

    let error: unknown
    try {
      await sendAccountMessage(supabase,currentUserId,id,cid,content,attachment)
      const statuses=attachment?await readAttachmentStatus(supabase,cid):[]
      setMessages(prev=>prev.map(m=>m.id===optimistic.id?withAttachmentRetention({...m,id,pending:false},statuses):m))
    }catch(e){error=e}

    if (error) {
      window.dispatchEvent(new CustomEvent('orb-chat-error',{detail:'Could not send the message. Check your connection and try again.'}))
      console.error('[useMessages] send failed', {
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

  /** Delete one of my own messages via /api/message-delete — the row
   *  dies under RLS (sender-only) and the endpoint reclaims its R2
   *  attachment objects. Local state drops the message on success;
   *  realtime DELETE covers everyone else. */
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    let token: string | undefined
    try {
      const { data } = await supabase.auth.getSession()
      token = data.session?.access_token
    } catch { /* no session — the guard below reports it */ }
    if (!token) {
      console.error('[useMessages] delete failed: no session')
      return false
    }
    try {
      const res = await fetch(`${DELETE_API_BASE}/api/message-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageId }),
      })
      if (!res.ok) {
        console.error('[useMessages] delete failed', { status: res.status, messageId })
        return false
      }
    } catch (err) {
      console.error('[useMessages] delete failed', err)
      return false
    }
    setMessages(prev => prev.filter(m => m.id !== messageId))
    return true
  }, [supabase])

  return { messages, loading, send, deleteMessage, conversationId: convId }
}
