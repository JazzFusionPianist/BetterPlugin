'use client'

import {GameButton} from '@orb/core/components/GameButton'
import {useGameChat, type GameChatMessage} from '@orb/core/hooks/useGameChat'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useT } from '@/lib/games/i18n'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  /** The game room this chat belongs to. No room yet → chat disabled. */
  roomId: string | null
  /** sender id → display name, for the per-message meta line. */
  names?: Record<string, string>
  /** Kept for API compatibility; chat is enabled whenever a room exists. */
  otherUserId?: string | null
  otherName?: string | null
}

const fmtChatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

/** Show the name/time line when the sender changes or 5+ min pass. */
function needsMeta(prev: GameChatMessage | undefined, m: GameChatMessage): boolean {
  if (!prev || prev.sender_id !== m.sender_id) return true
  return new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000
}

/**
 * In-game chat — its own little world. Messages live in `game_chats`
 * keyed by room id, so the match banter never mixes with the players'
 * real DM thread, and it disappears with the room.
 */
export default function GameChat({ supabase, currentUserId, roomId, names, otherName }: Props) {
  const { t } = useT()
  const {draft,setDraft,messages,loading,sending,scrollRef,onScroll,handleSend} = useGameChat(supabase,currentUserId,roomId)

  const placeholder = otherName
    ? t('chat.messageWith', { name: otherName })
    : t('chat.placeholder')

  return (
    <div className={`game-chat${roomId ? '' : ' no-room'}`}>
      <div className="game-chat-scroll" ref={scrollRef} onScroll={onScroll}>
        {!roomId ? (
          <div className="game-chat-empty">{t('common.waiting')}</div>
        ) : loading ? (
          <div className="game-chat-empty">{t('common.loading')}</div>
        ) : messages.length === 0 ? (
          <div className="game-chat-empty">{t('chat.noMessages')}</div>
        ) : (
          messages.map((message, i) => {
            const mine = message.sender_id === currentUserId
            const meta = needsMeta(messages[i - 1], message)
            const name = names?.[message.sender_id] ?? (mine ? 'me' : otherName ?? 'player')
            return (
              <div key={message.id} className={`game-chat-msg${mine ? ' mine' : ''}${meta ? ' with-meta' : ''}`}>
                {meta && (
                  <div className="game-chat-meta">
                    <span className="game-chat-meta-name">{name}</span>
                    <span className="game-chat-meta-time">{fmtChatTime(message.created_at)}</span>
                  </div>
                )}
                <span className="game-chat-text">{message.content}</span>
              </div>
            )
          })
        )}
      </div>
      <div className="game-chat-inputrow">
        <input
          className="game-chat-input"
          value={draft}
          placeholder={placeholder}
          disabled={!roomId}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Korean/Japanese IME: Enter during composition also fires
            // keydown — sending there duplicates the message.
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSend()
            }
          }}
        />
        <GameButton
          className="game-chat-send"
          onClick={handleSend}
          disabled={!roomId || sending || draft.trim().length === 0}
        >
          {t('common.send')}
        </GameButton>
      </div>
    </div>
  )
}
