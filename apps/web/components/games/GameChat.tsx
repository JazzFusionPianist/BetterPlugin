'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useT } from '@/lib/games/i18n'

interface GameChatMessage {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
}

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  /** The game room this chat belongs to. No room yet → chat disabled. */
  roomId: string | null
  /** Kept for API compatibility; chat is enabled whenever a room exists. */
  otherUserId?: string | null
  otherName?: string | null
}

/**
 * In-game chat — its own little world. Messages live in `game_chats`
 * keyed by room id, so the match banter never mixes with the players'
 * real DM thread, and it disappears with the room.
 */
export default function GameChat({ supabase, currentUserId, roomId, otherName }: Props) {
  const { t } = useT()
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<GameChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([])
    if (!roomId) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('game_chats')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(80)
      .then(({ data }) => {
        if (cancelled) return
        setMessages((data as GameChatMessage[] | null) ?? [])
        setLoading(false)
      })
    const channel = supabase
      .channel(`game_chat:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'game_chats',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const msg = payload.new as GameChatMessage
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      })
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [supabase, roomId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || !roomId) return
    setDraft('')
    const { data, error } = await supabase
      .from('game_chats')
      .insert({ room_id: roomId, sender_id: currentUserId, content: text })
      .select()
      .single()
    if (error) { setDraft(text); return }
    const msg = data as GameChatMessage
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
  }, [draft, roomId, supabase, currentUserId])

  const placeholder = otherName
    ? t('chat.messageWith', { name: otherName })
    : t('chat.placeholder')

  return (
    <div className="game-chat">
      <div className="game-chat-scroll">
        {!roomId ? (
          <div className="game-chat-empty">{t('common.waiting')}</div>
        ) : loading ? (
          <div className="game-chat-empty">{t('common.loading')}</div>
        ) : messages.length === 0 ? (
          <div className="game-chat-empty">{t('chat.noMessages')}</div>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === currentUserId
            return (
              <div key={message.id} className={`game-chat-msg${mine ? ' mine' : ''}`}>
                <span>{message.content}</span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="game-chat-inputrow">
        <input
          className="game-chat-input"
          value={draft}
          placeholder={placeholder}
          disabled={!roomId}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          className="game-chat-send"
          onClick={handleSend}
          disabled={!roomId || draft.trim().length === 0}
        >
          {t('common.send')}
        </button>
      </div>
    </div>
  )
}
