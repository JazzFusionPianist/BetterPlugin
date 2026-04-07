import { useEffect, useState, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message, AttachType } from '../types/collab'

export function useMessages(
  supabase: SupabaseClient,
  currentUserId: string,
  otherUserId: string | null,
) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)

  const fetchHistory = useCallback(async (otherId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherId}),` +
        `and(sender_id.eq.${otherId},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true })
      .limit(100)

    setMessages((data as Message[]) ?? [])
    setLoading(false)
  }, [supabase, currentUserId])

  useEffect(() => {
    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    if (!otherUserId) {
      setMessages([])
      return
    }

    fetchHistory(otherUserId)

    // Subscribe to incoming messages
    const channel = supabase
      .channel(`chat:${currentUserId}:${otherUserId}`)
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
          if (msg.sender_id === otherUserId) {
            setMessages(prev => [...prev, msg])
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [supabase, currentUserId, otherUserId, fetchHistory])

  const send = useCallback(async (
    content: string,
    attachment?: { url: string; type: AttachType; name: string },
  ): Promise<boolean> => {
    if (!otherUserId || (!content.trim() && !attachment)) return false

    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_name: attachment?.name ?? null,
    }

    setMessages(prev => [...prev, optimistic])

    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content: content.trim(),
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_name: attachment?.name ?? null,
    })

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      return false
    }
    return true
  }, [supabase, currentUserId, otherUserId])

  return { messages, loading, send }
}
