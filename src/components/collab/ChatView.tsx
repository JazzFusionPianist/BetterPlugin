import { useEffect, useRef, useState } from 'react'
import type { Profile, Message } from '../../types/collab'

interface Props {
  currentUserId: string
  otherProfile: Profile
  messages: Message[]
  loading: boolean
  onSend: (content: string) => Promise<void>
  onBack: () => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'today'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ChatView({ currentUserId, otherProfile, messages, loading, onSend, onBack }: Props) {
  const [input, setInput] = useState('')
  const chatAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = chatAreaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    const val = input
    setInput('')
    await onSend(val)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages with timestamp separators
  const groups: Array<{ type: 'ts'; label: string } | { type: 'msg'; msg: Message }> = []
  let lastDate = ''
  for (const msg of messages) {
    const dateLabel = formatDate(msg.created_at)
    if (dateLabel !== lastDate) {
      groups.push({ type: 'ts', label: `${dateLabel}  ${formatTime(msg.created_at)}` })
      lastDate = dateLabel
    }
    groups.push({ type: 'msg', msg })
  }

  return (
    <>
      {/* Sub-bar */}
      <div className="csub">
        <div className="back" onClick={onBack}>&#8249;</div>
        <div className="chdr-av" style={{ background: otherProfile.avatar_color }}>
          {otherProfile.initials}
          <div className={`chdr-dot ${otherProfile.isOnline ? 'don' : 'doff'}`} />
        </div>
        <div className="chdr-info">
          <div className="chdr-name">{otherProfile.display_name}</div>
          <div className="chdr-sub">{otherProfile.isOnline ? 'online' : 'offline'}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-area" ref={chatAreaRef}>
        {loading && <div className="collab-loading" style={{ flex: 'unset' }}>Loading...</div>}
        {groups.map((g, i) =>
          g.type === 'ts' ? (
            <div key={i} className="ts">{g.label}</div>
          ) : (
            <div key={g.msg.id} className={`mg ${g.msg.sender_id === currentUserId ? 'mine' : 'theirs'}`}>
              <div className="mb">{g.msg.content}</div>
            </div>
          )
        )}
        {messages.length === 0 && !loading && (
          <div className="collab-loading" style={{ flex: 'unset', marginTop: 40 }}>
            No messages yet
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="input-bar">
        <div className="mi-wrap">
          <input
            className="mi"
            type="text"
            placeholder={`message ${otherProfile.display_name.split(' ')[0]}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button className="send-btn" onClick={handleSend}>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </>
  )
}
