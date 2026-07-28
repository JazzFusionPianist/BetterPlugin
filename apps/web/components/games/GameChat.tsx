'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message } from '@/lib/games/types'
import { useMessages } from '@/lib/games/useMessages'
import { useT } from '@/lib/games/i18n'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  otherUserId: string | null
  otherName?: string | null
}

function messageLabel(message: Message, t: ReturnType<typeof useT>['t']): string {
  if (message.content.trim()) return message.content
  switch (message.attachment_type) {
    case 'image': return t('chat.attachPhoto')
    case 'video': return t('chat.attachVideo')
    case 'audio':
    case 'multi-audio': return t('chat.attachAudio')
    case 'game_invite': return t('conv.sentGameInvite')
    default: return ''
  }
}

export default function GameChat({ supabase, currentUserId, otherUserId, otherName }: Props) {
  const { t } = useT()
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const target = useMemo(
    () => otherUserId ? { kind: 'dm' as const, otherUserId } : null,
    [otherUserId],
  )
  const { messages, loading, send } = useMessages(supabase, currentUserId, target)
  const visibleMessages = messages.slice(-30)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [visibleMessages.length])

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || !otherUserId) return
    setDraft('')
    const ok = await send(text)
    if (!ok) setDraft(text)
  }

  const placeholder = otherName
    ? t('chat.messageWith', { name: otherName })
    : t('chat.placeholder')

  return (
    <div className="game-chat">
      <div className="game-chat-scroll">
        {!otherUserId ? (
          <div className="game-chat-empty">{t('common.waiting')}</div>
        ) : loading ? (
          <div className="game-chat-empty">{t('common.loading')}</div>
        ) : visibleMessages.length === 0 ? (
          <div className="game-chat-empty">{t('chat.noMessages')}</div>
        ) : (
          visibleMessages.map(message => {
            const mine = message.sender_id === currentUserId
            const label = messageLabel(message, t)
            if (!label) return null
            return (
              <div key={message.id} className={`game-chat-msg${mine ? ' mine' : ''}`}>
                <span>{label}</span>
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
          disabled={!otherUserId}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          className="game-chat-send"
          onClick={handleSend}
          disabled={!otherUserId || draft.trim().length === 0}
        >
          {t('common.send')}
        </button>
      </div>
    </div>
  )
}