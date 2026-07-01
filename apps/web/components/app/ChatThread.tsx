'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useMessages, type Profile } from '@orb/core'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  friend: Profile & { isOnline?: boolean }
  onClose: () => void
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** Minimal 1:1 chat — a full-screen thread over the orb home on mobile. */
export default function ChatThread({ supabase, currentUserId, friend, onClose }: Props) {
  const { messages, loading, send } = useMessages(supabase, currentUserId, { kind: 'dm', otherUserId: friend.id })
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [kbInset, setKbInset] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Keep the newest message in view.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Lift the composer above the on-screen keyboard.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => setKbInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize) }
  }, [])

  const grow = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }
  const submit = async () => {
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
    try { await send(value) } finally { setSending(false) }
  }

  return (
    <div className="chatt">
      <header className="chatt-head">
        <button className="chatt-back" onClick={onClose} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="chatt-av" style={{ background: friend.avatar_color }}>
          {friend.avatar_url ? <img src={friend.avatar_url} alt="" /> : <span>{friend.initials}</span>}
          {friend.isOnline && <span className="chatt-dot" />}
        </div>
        <div className="chatt-who">
          <div className="chatt-name">{friend.display_name}</div>
          <div className="chatt-status">{friend.isOnline ? 'Online now' : 'Offline'}</div>
        </div>
      </header>

      <div className="chatt-scroll" ref={scrollRef}>
        {!loading && messages.length === 0 && (
          <div className="chatt-empty">Say hi to {friend.display_name} 👋</div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === currentUserId
          const prev = messages[i - 1]
          const grouped = prev && prev.sender_id === m.sender_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 4 * 60 * 1000
          return (
            <div key={m.id} className={`chatt-row${mine ? ' mine' : ''}${grouped ? ' grouped' : ''}`}>
              <div className="chatt-bubble">
                {m.content}
                <span className="chatt-time">{fmtTime(m.created_at)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="chatt-compose" style={{ paddingBottom: `calc(10px + env(safe-area-inset-bottom) + ${kbInset}px)` }}>
        <div className="chatt-bar">
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            placeholder={`Message ${friend.display_name}…`}
            onChange={(e) => { setText(e.target.value); grow() }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          />
          <button className="chatt-send" onClick={submit} disabled={!text.trim() || sending} aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
