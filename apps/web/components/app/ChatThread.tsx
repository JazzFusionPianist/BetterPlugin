'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useMessages, type Profile, type Message } from '@orb/core'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  friend: Profile & { isOnline?: boolean }
  onClose: () => void
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

const fmtDur = (s: number) => {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/** Inline audio player — the whole point of mobile chat for this app:
 *  audio people drop in from the DAW must play right here. */
function AudioPlayer({ url, name }: { url: string; name: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)

  const toggle = () => {
    const a = ref.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play().then(() => setPlaying(true)).catch(() => {}) }
  }
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = ref.current
    if (!a || !dur) return
    const rect = e.currentTarget.getBoundingClientRect()
    a.currentTime = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * dur
  }

  return (
    <div className="msg-audio">
      <div className="msg-audio-head">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
        <span className="msg-audio-name">{name}</span>
      </div>
      <div className="msg-audio-player">
        <audio
          ref={ref}
          src={url}
          preload="metadata"
          onTimeUpdate={() => setCur(ref.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDur(ref.current?.duration ?? 0)}
          onEnded={() => { setPlaying(false); setCur(0) }}
        />
        <button className="msg-audio-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing
            ? <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            : <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z" /></svg>}
        </button>
        <div className="msg-audio-track" onClick={seek}>
          <div className="msg-audio-fill" style={{ width: dur ? `${(cur / dur) * 100}%` : '0%' }} />
        </div>
        <span className="msg-audio-time">{fmtDur(cur)} / {fmtDur(dur)}</span>
      </div>
    </div>
  )
}

/** Render whatever a message carries as an attachment. */
function Attachment({ m }: { m: Message }) {
  if (m.attachment_expired) {
    return <div className="msg-tomb">🎵 This attachment has expired</div>
  }
  const url = m.attachment_url
  const name = m.attachment_name ?? 'Audio'
  if (!url) return null
  switch (m.attachment_type) {
    case 'audio':
      return <AudioPlayer url={url} name={name} />
    case 'multi-audio': {
      let tracks: { url: string; name: string }[] = []
      try { tracks = JSON.parse(url) } catch { /* ignore */ }
      return (
        <div className="msg-audio-multi">
          {tracks.map((t, i) => <AudioPlayer key={i} url={t.url} name={t.name || `Track ${i + 1}`} />)}
        </div>
      )
    }
    case 'image':
      return <img className="msg-img" src={url} alt={name} onClick={() => window.open(url, '_blank')} />
    case 'video':
      return <video className="msg-video" src={url} controls playsInline preload="metadata" />
    case 'game_invite':
      return <div className="msg-tomb">🎮 Game invite</div>
    default:
      return <a className="msg-file" href={url} target="_blank" rel="noreferrer">📎 {name}</a>
  }
}

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
          const hasAttach = !!m.attachment_url || m.attachment_expired
          return (
            <div key={m.id} className={`chatt-row${mine ? ' mine' : ''}${grouped ? ' grouped' : ''}`}>
              <div className={`chatt-bubble${hasAttach ? ' has-att' : ''}`}>
                {hasAttach && <Attachment m={m} />}
                {m.content && <span className="chatt-text">{m.content}</span>}
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
