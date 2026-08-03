'use client'

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useMessages, type Profile, type Message } from '@orb/core'
import { uploadAttachment, attachTypeFor, type UploadedAttachment } from '@/lib/upload'
import ChatSettingsSheet from './ChatSettingsSheet'

/** What a thread points at — a DM partner or a group conversation. */
export type ThreadTarget =
  | { kind: 'dm'; friend: Profile & { isOnline?: boolean } }
  | { kind: 'group'; conversationId: string; title: string; memberCount: number; avatarUrl?: string | null }

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  target: ThreadTarget
  /** Resolve a sender id → profile (group sender names). */
  profileById: Map<string, Profile>
  /** Called with the conversation id when the user has seen the thread. */
  onSeen?: (conversationId: string) => void
  /** Join a game room from an invite bubble (opens the games page). */
  onJoinGame?: GameInviteBubbleJoin
  /** Invite pool for the settings sheet (group member adding). */
  friends?: Profile[]
  onClose: () => void
}

type GameInviteBubbleJoin = (gameType: string, roomId: string) => Promise<'joined' | 'already-in' | 'full' | 'missing'>

interface PendingUpload { id: string; name: string; progress: number }

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

const fmtDur = (s: number) => {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/* ── Shared now-playing engine ────────────────────────────────────────
   One <audio> per thread. Inline bubbles are remote controls for it, and
   a bottom bar with a finger-sized scrubber appears while it plays —
   precise seeking on a phone happens there, not on the tiny waveform. */
interface NowPlayingTrack { url: string; name: string }
interface NowPlayingApi {
  track: NowPlayingTrack | null
  playing: boolean
  cur: number
  dur: number
  start: (t: NowPlayingTrack, at?: number) => void
  toggle: () => void
  seekTo: (sec: number) => void
  close: () => void
}
const NowPlayingCtx = createContext<NowPlayingApi | null>(null)

/** Inline audio player — the whole point of mobile chat for this app:
 *  audio people drop in from the DAW must play right here. */
function AudioPlayer({ url, name }: { url: string; name: string }) {
  const np = useContext(NowPlayingCtx)
  // A metadata-only element so every bubble can show its duration
  // before it has ever been played.
  const metaRef = useRef<HTMLAudioElement>(null)
  const [metaDur, setMetaDur] = useState(0)

  const active = np?.track?.url === url
  const playing = !!(active && np?.playing)
  const cur = active ? np!.cur : 0
  const dur = (active && np!.dur) || metaDur

  const toggle = () => {
    if (!np) return
    if (active) np.toggle()
    else np.start({ url, name })
  }
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!np || !dur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * dur
    if (active) np.seekTo(t)
    else np.start({ url, name }, t)
  }

  return (
    <div className="msg-audio">
      <audio
        ref={metaRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => setMetaDur(metaRef.current?.duration ?? 0)}
      />
      <div className="msg-audio-head">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
        <span className="msg-audio-name">{name}</span>
      </div>
      <div className="msg-audio-player">
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

/** Docked player — drag anywhere on the big waveform to scrub. */
function NowPlayingBar() {
  const np = useContext(NowPlayingCtx)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  if (!np || !np.track) return null

  const scrub = (clientX: number) => {
    const el = trackRef.current
    if (!el || !np.dur) return
    const r = el.getBoundingClientRect()
    np.seekTo(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * np.dur)
  }

  const pct = np.dur ? (np.cur / np.dur) * 100 : 0
  return (
    <div className="nowbar">
      <button className="nowbar-btn" onClick={np.toggle} aria-label={np.playing ? 'Pause' : 'Play'}>
        {np.playing
          ? <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          : <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z" /></svg>}
      </button>
      <div className="nowbar-main">
        <div className="nowbar-toprow">
          <span className="nowbar-name">{np.track.name}</span>
          <span className="nowbar-time">{fmtDur(np.cur)} / {fmtDur(np.dur)}</span>
        </div>
        <div
          ref={trackRef}
          className="nowbar-track"
          onPointerDown={(e) => {
            dragging.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            scrub(e.clientX)
          }}
          onPointerMove={(e) => { if (dragging.current) scrub(e.clientX) }}
          onPointerUp={() => { dragging.current = false }}
          onPointerCancel={() => { dragging.current = false }}
        >
          <div className="nowbar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <button className="nowbar-x" onClick={np.close} aria-label="Close player">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  )
}

/** A game invite in the thread — the room id rides attachment_url and
 *  the game type attachment_name. Join claims the seat and opens the
 *  games page (host taps re-enter their own room). */
const GAME_NAMES: Record<string, string> = {
  chess: 'chess', falling_blocks: 'falling blocks', poker: 'poker', ear_training: 'ear training',
}
const GAME_MARKS: Record<string, string> = {
  chess: '♞', falling_blocks: '▚', poker: '♠', ear_training: '♪',
}
function GameInviteBubble({ roomId, gameType, mine, onJoin }: {
  roomId: string
  gameType: string
  mine: boolean
  onJoin?: (gameType: string, roomId: string) => Promise<'joined' | 'already-in' | 'full' | 'missing'>
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  return (
    <div className="msg-game-invite">
      <div className="mgi-main">
        <span className="mgi-eyebrow">{mine ? 'invitation sent' : 'game invitation'}</span>
        <div className="mgi-title">{GAME_NAMES[gameType] ?? gameType}</div>
        <div className="mgi-admit">admit one · no. {roomId.slice(0, 4)}</div>
        {note && <div className="mgi-note">{note}</div>}
      </div>
      <button
        className="mgi-stub"
        disabled={busy || !onJoin}
        onClick={async () => {
          if (!onJoin) return
          setBusy(true)
          const r = await onJoin(gameType, roomId)
          setBusy(false)
          if (r === 'full') setNote('room is full')
          else if (r === 'missing') setNote('this game has ended')
        }}
      >
        <span className="mgi-mark" aria-hidden="true">{GAME_MARKS[gameType] ?? '♞'}</span>
        <span className="mgi-stub-label">{busy ? '…' : mine ? 'enter' : 'join'}</span>
      </button>
    </div>
  )
}

/** Render whatever a message carries as an attachment. */
function Attachment({ m, mine, onJoinGame }: { m: Message; mine: boolean; onJoinGame?: GameInviteBubbleJoin }) {
  if (m.attachment_expired) {
    const icon =
      m.attachment_type === 'image' ? '🖼️'
      : m.attachment_type === 'video' ? '🎬'
      : m.attachment_type === 'audio' || m.attachment_type === 'multi-audio' ? '🎵'
      : '📎'
    return (
      <div className="msg-tomb">
        <span aria-hidden="true">{icon}</span>
        <span className="msg-tomb-name">{m.attachment_name ?? 'attachment'}</span>
        <span className="msg-tomb-note">expired</span>
      </div>
    )
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
      return <GameInviteBubble roomId={url} gameType={name} mine={mine} onJoin={onJoinGame} />
    default:
      return <a className="msg-file" href={url} target="_blank" rel="noreferrer">📎 {name}</a>
  }
}

/** Full-screen thread — 1:1 or group — over the orb home on mobile. */
export default function ChatThread({ supabase, currentUserId, target, profileById, onSeen, onJoinGame, friends, onClose }: Props) {
  const { messages, loading, send, conversationId } = useMessages(
    supabase,
    currentUserId,
    target.kind === 'dm'
      ? { kind: 'dm', otherUserId: target.friend.id }
      : { kind: 'group', conversationId: target.conversationId },
  )
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [uploads, setUploads] = useState<PendingUpload[]>([])
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [kbInset, setKbInset] = useState(0)
  const [recording, setRecording] = useState(false)
  const [recElapsed, setRecElapsed] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recRef = useRef<{ rec: MediaRecorder; stream: MediaStream; chunks: Blob[]; timer: ReturnType<typeof setInterval> } | null>(null)

  // ── Now-playing engine (one audio element for the whole thread) ────────
  const audioRef = useRef<HTMLAudioElement>(null)
  // Seek requested before the new track's metadata is ready — applied
  // in onLoadedMetadata (Safari ignores currentTime until then).
  const pendingSeekRef = useRef<number | null>(null)
  const [npTrack, setNpTrack] = useState<NowPlayingTrack | null>(null)
  const [npPlaying, setNpPlaying] = useState(false)
  const [npCur, setNpCur] = useState(0)
  const [npDur, setNpDur] = useState(0)
  const npApi: NowPlayingApi = {
    track: npTrack, playing: npPlaying, cur: npCur, dur: npDur,
    start: (t, at = 0) => {
      const a = audioRef.current
      if (!a) return
      if (npTrack?.url !== t.url) {
        setNpTrack(t); setNpCur(at); setNpDur(0)
        a.src = t.url
        pendingSeekRef.current = at > 0 ? at : null
      } else {
        a.currentTime = at
      }
      a.play().then(() => setNpPlaying(true)).catch(() => {})
    },
    toggle: () => {
      const a = audioRef.current
      if (!a || !npTrack) return
      if (npPlaying) { a.pause(); setNpPlaying(false) }
      else { a.play().then(() => setNpPlaying(true)).catch(() => {}) }
    },
    seekTo: (sec) => {
      const a = audioRef.current
      if (!a) return
      a.currentTime = sec
      setNpCur(sec)
    },
    close: () => {
      const a = audioRef.current
      a?.pause()
      setNpTrack(null); setNpPlaying(false); setNpCur(0); setNpDur(0)
    },
  }

  const isGroup = target.kind === 'group'
  const title = isGroup ? target.title : target.friend.display_name

  // Keep the newest message in view.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, uploads.length])

  // Mark the conversation read while the thread is open (clears unread
  // badges everywhere — the same conversation_reads row the plugin uses).
  useEffect(() => {
    if (conversationId && onSeen) onSeen(conversationId)
  }, [conversationId, messages.length, onSeen])

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

  // ── Voice memo ─────────────────────────────────────────────────────────
  // Musicians live one hum away from an idea — record on the phone mic and
  // it lands in the thread as a playable (and DAW-importable) audio file.
  const stopTracks = () => {
    const r = recRef.current
    if (!r) return
    clearInterval(r.timer)
    r.stream.getTracks().forEach(t => t.stop())
  }

  const startRecording = async () => {
    if (recording) return
    setUploadErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Safari/WKWebView records AAC in an mp4 container; Chrome uses webm.
      const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const entry = { rec, stream, chunks: [] as Blob[], timer: setInterval(() => setRecElapsed(s => s + 1), 1000) }
      rec.ondataavailable = (e) => { if (e.data.size > 0) entry.chunks.push(e.data) }
      recRef.current = entry
      setRecElapsed(0)
      setRecording(true)
      rec.start(250)
    } catch (err) {
      console.error('[voice-memo]', err)
      setUploadErr('Microphone unavailable — check the app permission.')
    }
  }

  const cancelRecording = () => {
    const r = recRef.current
    if (r && r.rec.state !== 'inactive') r.rec.stop()
    stopTracks()
    recRef.current = null
    setRecording(false)
  }

  const sendRecording = async () => {
    const r = recRef.current
    if (!r) return
    // Collect the final chunk, then hand the blob to the normal upload path.
    const blob = await new Promise<Blob>((resolve) => {
      r.rec.onstop = () => resolve(new Blob(r.chunks, { type: r.rec.mimeType || 'audio/mp4' }))
      if (r.rec.state !== 'inactive') r.rec.stop()
      else resolve(new Blob(r.chunks, { type: r.rec.mimeType || 'audio/mp4' }))
    })
    stopTracks()
    recRef.current = null
    setRecording(false)
    if (blob.size === 0) return

    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('webm') ? 'webm' : 'audio'
    const stamp = new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    const file = new File([blob], `Voice memo ${stamp}.${ext}`, { type: blob.type || 'audio/mp4' })

    const pid = `up-${Date.now()}-vm`
    setUploads(prev => [...prev, { id: pid, name: file.name, progress: 0 }])
    try {
      const att = await uploadAttachment(file, currentUserId, (ratio) =>
        setUploads(prev => prev.map(u => u.id === pid ? { ...u, progress: ratio } : u)))
      await send('', att)
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploads(prev => prev.filter(u => u.id !== pid))
    }
  }

  // Never leave the mic running when the thread unmounts.
  useEffect(() => () => { stopTracks(); recRef.current = null }, [])

  // ── Attachments ────────────────────────────────────────────────────────
  const MAX_MB = 200
  const pickFiles = () => fileRef.current?.click()
  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''   // allow re-picking the same file
    if (files.length === 0) return
    setUploadErr(null)

    const ok = files.filter(f => {
      if (f.size > MAX_MB * 1024 * 1024) {
        setUploadErr(`${f.name}: too large (max ${MAX_MB}MB)`)
        return false
      }
      return true
    })
    if (ok.length === 0) return

    const done: UploadedAttachment[] = []
    for (const f of ok) {
      const pid = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setUploads(prev => [...prev, { id: pid, name: f.name, progress: 0 }])
      try {
        const att = await uploadAttachment(f, currentUserId, (r) =>
          setUploads(prev => prev.map(u => u.id === pid ? { ...u, progress: r } : u)))
        done.push(att)
      } catch (err) {
        setUploadErr(err instanceof Error ? err.message : 'Upload failed.')
      } finally {
        setUploads(prev => prev.filter(u => u.id !== pid))
      }
    }
    if (done.length === 0) return

    // Several audio files at once → one multi-track message (same shape the
    // plugin sends); otherwise one message per file.
    const allAudio = done.every(a => a.type === 'audio')
    if (allAudio && done.length > 1) {
      await send('', {
        url: JSON.stringify(done.map(a => ({ url: a.url, name: a.name }))),
        type: 'multi-audio',
        name: `${done.length} Tracks`,
      })
    } else {
      for (const a of done) await send('', a)
    }
  }

  return (
    <NowPlayingCtx.Provider value={npApi}>
    <div className="chatt">
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={() => setNpCur(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (!a) return
          setNpDur(a.duration ?? 0)
          if (pendingSeekRef.current != null) {
            a.currentTime = pendingSeekRef.current
            setNpCur(pendingSeekRef.current)
            pendingSeekRef.current = null
          }
        }}
        onEnded={() => { setNpPlaying(false); setNpCur(0) }}
      />
      <header className="chatt-head">
        <button className="chatt-back" onClick={onClose} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        {isGroup ? (
          <div className="chatt-av chatt-av-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c0-3 2.6-4.6 5.5-4.6s5.5 1.6 5.5 4.6M15 18.6c0-1.8.9-3 2.6-3.2" /></svg>
          </div>
        ) : (
          <div className="chatt-av" style={{ background: target.friend.avatar_color }}>
            {target.friend.avatar_url ? <img src={target.friend.avatar_url} alt="" /> : <span>{target.friend.initials}</span>}
            {target.friend.isOnline && <span className="chatt-dot" />}
          </div>
        )}
        <div className="chatt-who">
          <div className="chatt-name">{title}</div>
          <div className="chatt-status">
            {isGroup
              ? `${target.memberCount} members`
              : target.friend.isOnline ? 'Online now' : 'Offline'}
          </div>
        </div>
        <button
          className="chatt-settings"
          onClick={() => setSettingsOpen(true)}
          aria-label="Chat settings"
          title="Chat settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
        </button>
      </header>

      <div className="chatt-scroll" ref={scrollRef}>
        {!loading && messages.length === 0 && uploads.length === 0 && (
          <div className="chatt-empty">Say hi{isGroup ? '' : ` to ${title}`} 👋</div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === currentUserId
          const prev = messages[i - 1]
          const grouped = prev && prev.sender_id === m.sender_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 4 * 60 * 1000
          const hasAttach = !!m.attachment_url || m.attachment_expired
          const sender = isGroup && !mine && !grouped ? profileById.get(m.sender_id) : null
          return (
            <div key={m.id} className={`chatt-row${mine ? ' mine' : ''}${grouped ? ' grouped' : ''}`}>
              <div className="chatt-col">
                {sender && (
                  <span className="chatt-sender" style={{ color: sender.avatar_color }}>
                    {sender.display_name}
                  </span>
                )}
                <div className={`chatt-bubble${hasAttach ? ' has-att' : ''}`}>
                  {hasAttach && <Attachment m={m} mine={mine} onJoinGame={onJoinGame} />}
                  {m.content && <span className="chatt-text">{m.content}</span>}
                  <span className="chatt-time">{fmtTime(m.created_at)}</span>
                </div>
              </div>
            </div>
          )
        })}
        {uploads.map(u => (
          <div key={u.id} className="chatt-row mine">
            <div className="chatt-bubble has-att">
              <div className="msg-uploading">
                <span className="msg-uploading-name">{u.name}</span>
                <div className="msg-uploading-track"><div className="msg-uploading-fill" style={{ width: `${Math.round(u.progress * 100)}%` }} /></div>
                <span className="msg-uploading-pct">{Math.round(u.progress * 100)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {uploadErr && <div className="chatt-uperr">{uploadErr}</div>}

      <NowPlayingBar />

      <div className="chatt-compose" style={{ paddingBottom: `calc(10px + env(safe-area-inset-bottom) + ${kbInset}px)` }}>
        {recording ? (
          <div className="chatt-bar chatt-recbar">
            <span className="chatt-recdot" />
            <span className="chatt-rectime">{fmtDur(recElapsed)}</span>
            <span className="chatt-reclabel">Recording…</span>
            <button className="chatt-reccancel" onClick={cancelRecording}>Cancel</button>
            <button className="chatt-send" onClick={sendRecording} aria-label="Send voice memo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        ) : (
          <div className="chatt-bar">
            <button className="chatt-attach" onClick={pickFiles} aria-label="Attach audio">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,image/*,video/*"
              multiple
              hidden
              onChange={onFiles}
            />
            <textarea
              ref={taRef}
              rows={1}
              value={text}
              placeholder={`Message ${title}…`}
              onChange={(e) => { setText(e.target.value); grow() }}
              onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            />
            {text.trim() ? (
              <button className="chatt-send" onClick={submit} disabled={sending} aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            ) : (
              <button className="chatt-send chatt-mic" onClick={startRecording} aria-label="Record voice memo">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></svg>
              </button>
            )}
          </div>
        )}
      </div>
      {settingsOpen && conversationId && (
        <ChatSettingsSheet
          supabase={supabase}
          currentUserId={currentUserId}
          conversationId={conversationId}
          chatKind={isGroup ? 'group' : 'dm'}
          title={title}
          avatarUrl={isGroup ? target.avatarUrl : null}
          friends={friends ?? []}
          profileById={profileById}
          onClose={() => setSettingsOpen(false)}
          onLeft={() => { setSettingsOpen(false); onClose() }}
        />
      )}
    </div>
    </NowPlayingCtx.Provider>
  )
}
