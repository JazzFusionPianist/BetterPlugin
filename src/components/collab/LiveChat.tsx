import { useEffect, useRef, useState } from 'react'
import type { LiveChatMessage } from '../../hooks/useLiveChat'

interface Props {
  messages: LiveChatMessage[]
  currentUserId: string
  onSend: (text: string) => void
}

export default function LiveChat({ messages, currentUserId, onSend }: Props) {
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const submit = () => {
    const t = text.trim()
    if (!t) return
    onSend(t)
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
          placeholder="Say something…"
          maxLength={280}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />
        <button
          className="live-chat-send"
          onClick={submit}
          disabled={!text.trim()}
        >
          Send
        </button>
      </div>
    </div>
  )
}
