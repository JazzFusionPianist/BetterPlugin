import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

export interface LiveChatMessage {
  id: string
  senderId: string
  senderName: string
  senderColor: string
  content: string
  ts: number
}

/**
 * Ephemeral live-session chat.
 * All participants (host + viewers) subscribe to a per-session broadcast
 * channel. Messages are not persisted — they exist only for the duration
 * of the live session. Each message's `id` is uuid-like (random enough
 * for React keys + duplicate suppression).
 */
export function useLiveChat(
  client: SupabaseClient,
  sessionId: string | null,
  me: { id: string; name: string; color: string } | null,
) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!sessionId) return
    setMessages([])

    const channel = client.channel(`live-chat:${sessionId}`, {
      config: { broadcast: { self: true, ack: false } },
    })

    channel
      .on('broadcast', { event: 'msg' }, ({ payload }) => {
        const msg = payload as LiveChatMessage
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      client.removeChannel(channel)
      channelRef.current = null
    }
  }, [client, sessionId])

  const sendMessage = useCallback((content: string) => {
    const ch = channelRef.current
    if (!ch || !me || !content.trim()) return
    const msg: LiveChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderId:    me.id,
      senderName:  me.name,
      senderColor: me.color,
      content:     content.trim(),
      ts:          Date.now(),
    }
    ch.send({ type: 'broadcast', event: 'msg', payload: msg })
  }, [me])

  return { messages, sendMessage }
}
