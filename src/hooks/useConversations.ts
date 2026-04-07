import { useEffect, useState, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message } from '../types/collab'

export interface Conversation {
  partnerId: string
  lastMessage: Message
}

export function useConversations(supabase: SupabaseClient, userId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(300)
    if (!data) return

    const seen = new Set<string>()
    const convs: Conversation[] = []
    for (const msg of data as Message[]) {
      const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id
      if (seen.has(partnerId)) continue
      seen.add(partnerId)
      convs.push({ partnerId, lastMessage: msg })
    }
    setConversations(convs)
  }, [supabase, userId])

  useEffect(() => {
    fetch()
    const ch = supabase
      .channel(`conv:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` }, fetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetch, supabase, userId])

  return { conversations }
}
