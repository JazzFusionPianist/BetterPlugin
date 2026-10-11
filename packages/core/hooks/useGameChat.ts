import {useCallback, useEffect, useRef, useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'

export interface GameChatMessage {id:string;room_id:string;sender_id:string;content:string;created_at:string}
export function mergeGameMessages(...groups:GameChatMessage[][]) {
  const rows = new Map(groups.flat().map(row => [row.id, row]))
  return [...rows.values()].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).slice(-80)
}

export function useGameChat(supabase:SupabaseClient, currentUserId:string, roomId:string|null) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<GameChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const roomRef = useRef(roomId)
  roomRef.current = roomId
  const pending = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  useEffect(() => {
    let alive = true
    setMessages([]); setDraft(''); setLoading(!!roomId); pinned.current = true
    if (!roomId) return
    const channel = supabase.channel(`game_chat:${roomId}`)
      .on('postgres_changes', {event:'INSERT',schema:'public',table:'game_chats',filter:`room_id=eq.${roomId}`}, payload => {
        const row = payload.new as GameChatMessage
        if (alive && row.room_id === roomId) setMessages(prev => mergeGameMessages(prev,[row]))
      }).subscribe()
    void (async () => {
      try {
        const {data} = await supabase.from('game_chats').select('*').eq('room_id',roomId)
          .order('created_at',{ascending:false}).limit(80)
        if (alive) setMessages(prev => mergeGameMessages((data ?? []) as GameChatMessage[],prev))
      } finally {if (alive) setLoading(false)}
    })().catch(() => {})
    return () => {alive = false; void supabase.removeChannel(channel)}
  }, [supabase,roomId])
  useEffect(() => {
    const el = scrollRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [messages,loading])
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) pinned.current = el.scrollHeight - el.clientHeight - el.scrollTop < 32
  }, [])
  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || !roomId || pending.current) return
    pending.current = true; setSending(true); setDraft('')
    try {
      const {data,error} = await supabase.from('game_chats')
        .insert({room_id:roomId,sender_id:currentUserId,content:text}).select().single()
      if (error || !data) throw error ?? new Error('Message not sent')
      if (roomRef.current === roomId) {
        pinned.current = true
        setMessages(prev => mergeGameMessages(prev,[data as GameChatMessage]))
      }
    } catch {
      if (roomRef.current === roomId) setDraft(current => current || text)
    } finally {pending.current = false; setSending(false)}
  }, [draft,roomId,supabase,currentUserId])
  return {draft,setDraft,messages,loading,sending,scrollRef,onScroll,handleSend}
}
