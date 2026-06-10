import { useEffect, useRef, useState } from 'react'
import type { LiveChatMessage } from '../../hooks/useLiveChat'
import { useT } from '../../i18n/LanguageContext'

interface Props {
  messages: LiveChatMessage[]
  currentUserId: string
  onSend: (text: string) => void
}

export default function LiveChat({ messages, currentUserId, onSend }: Props) {
  const { t } = useT()
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className="live-chat">
      <div className="live-chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="live-chat-empty">Be the first to say something…</div>
        )}
        {messages.map(m => {
          const mine = m.senderId === currentUserId
          return (
            <div key={m.id} className={`live-chat-msg${mine ? ' mine' : ''}`}>
              {!mine && (
                <span className="live-chat-name" style={{ color: m.senderColor }}>
                  {m.senderName}
                </span>
              )}
              <span className="live-chat-text">{m.content}</span>
            </div>
          )
        })}
      </div>
      <div className="live-chat-inputrow">
        <input
          className="live-chat-input"
          type="text"
          placeholder={t('liveChat.placeholder')}
          maxLength={280}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key !== 'Enter') return
            // Skip the Enter that ends an IME composition (Korean/Japanese/
            // Chinese). nativeEvent.isComposing is true during composition;
            // keyCode 229 is the legacy "compose-key" sentinel some browsers
            // still fire even after composition ends.
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            e.preventDefault()
            submit()
          }}
        />
        <button
          className="live-chat-send"
          onClick={submit}
          disabled={!text.trim()}
        >
          {t('common.send')}
        </button>
      </div>
    </div>
  )
}
