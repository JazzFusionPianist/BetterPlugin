'use client'

/**
 * The studio's chat pane on the web — the Orb Chat plug-in's messenger
 * grammar, ported: avatar + name bursts under four minutes, white
 * hairline bubbles theirs / ink mine with the corner notch on a burst's
 * first piece, timestamps outside at the tail, day rules across the
 * pane, audio as printed plates (the waveform is the artwork and the
 * scrubber), one shared <audio> engine with a docked now-playing bar,
 * the admission ticket for game invites, read receipts at the right
 * edge. Uploads ride the app's presign → PUT helper; the voice memo is
 * the phone thread's recorder, in words.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useMessages, useConversationReads, type ChatTarget, type Message, type Profile } from '@orb/core'
import { uploadAttachment, type UploadedAttachment } from '@/lib/upload'
import type { JoinResult } from '@/lib/games/gameRooms'

/* ── little formatters ────────────────────────────────────────────── */

const BURST_MS = 4 * 60 * 1000

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function fmtDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase()
}

const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;"')\]!?])/gi
function linkify(text: string): ReactNode {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0
    if (i > last) parts.push(text.slice(last, i))
    const raw = m[0]!
    const href = raw.startsWith('http') ? raw : `https://${raw}`
    parts.push(<a key={i} className="msg-link" href={href} target="_blank" rel="noopener noreferrer">{raw}</a>)
    last = i + raw.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : parts
}

/* ── waveform tech (audioPeaks recipe, cached per url) ────────────── */

const WAVE_BUCKETS = 90
interface WaveMeta { peaks: number[]; duration: number }
const waveCache = new Map<string, WaveMeta>()
const waveInflight = new Map<string, Promise<WaveMeta>>()

function pseudoPeaks(seed: string): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const phase = ((h >>> 0) % 628) / 100
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000 }
  const out: number[] = []
  let v = 0.35 + rand() * 0.35
  for (let i = 0; i < WAVE_BUCKETS; i++) {
    v += (rand() - 0.5) * 0.3
    v += (0.5 - v) * 0.12
    const swell = 0.72 + 0.28 * Math.sin(i / 9 + phase)
    out.push(Math.min(1, Math.max(0.06, v * swell)))
  }
  return out
}

function probeDuration(url: string): Promise<number> {
  return new Promise(resolve => {
    const a = new Audio()
    a.preload = 'metadata'
    const done = (d: number) => { a.onloadedmetadata = null; a.onerror = null; a.removeAttribute('src'); resolve(d) }
    const timer = setTimeout(() => done(0), 8000)
    a.onloadedmetadata = () => { clearTimeout(timer); done(Number.isFinite(a.duration) ? a.duration : 0) }
    a.onerror = () => { clearTimeout(timer); done(0) }
    a.src = url
  })
}

async function decodePeaks(url: string): Promise<WaveMeta> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  type AC = typeof AudioContext
  const Ctx: AC | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext
  if (!Ctx) throw new Error('no AudioContext')
  const ctx = new Ctx()
  try {
    const audio = await ctx.decodeAudioData(buf)
    const ch0 = audio.getChannelData(0)
    const ch1 = audio.numberOfChannels > 1 ? audio.getChannelData(1) : null
    const n = ch0.length
    const per = Math.max(1, Math.floor(n / WAVE_BUCKETS))
    const peaks: number[] = []
    for (let b = 0; b < WAVE_BUCKETS; b++) {
      const start = b * per
      if (start >= n) break
      const end = Math.min(n, start + per)
      let max = 0
      const step = end - start > 8192 ? 32 : 1
      for (let i = start; i < end; i += step) {
        const v = Math.abs(ch0[i]!) + (ch1 ? Math.abs(ch1[i]!) : 0)
        if (v > max) max = v
      }
      peaks.push(max)
    }
    const top = Math.max(...peaks, 0.0001)
    return { peaks: peaks.map(p => p / top), duration: audio.duration }
  } finally {
    ctx.close().catch(() => {})
  }
}

function getWaveMeta(url: string): Promise<WaveMeta> {
  const cached = waveCache.get(url)
  if (cached) return Promise.resolve(cached)
  const inflight = waveInflight.get(url)
  if (inflight) return inflight
  const p = decodePeaks(url)
    .catch(async () => ({ peaks: pseudoPeaks(url), duration: await probeDuration(url) }))
    .then(meta => { waveCache.set(url, meta); waveInflight.delete(url); return meta })
  waveInflight.set(url, p)
  return p
}

function useWaveMeta(url: string): WaveMeta | null {
  const [meta, setMeta] = useState<WaveMeta | null>(() => waveCache.get(url) ?? null)
  useEffect(() => {
    const cached = waveCache.get(url)
    if (cached) { setMeta(cached); return }
    setMeta(null)
    let dead = false
    void getWaveMeta(url).then(m => { if (!dead) setMeta(m) })
    return () => { dead = true }
  }, [url])
  return meta
}

/** The waveform IS the scrubber: 1.5px ink bars, 1px gap, green needle;
 *  pointer-down seeks, dragging keeps scrubbing (pointer capture). */
function StudioWaveform({ peaks, frac, height, head, onSeek }: {
  peaks: number[] | null; frac: number; height: number; head?: boolean; onSeek: (frac: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef(false)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const g = canvas.getContext('2d')
    if (!g) return
    g.scale(dpr, dpr)
    const BAR = 1.5, GAP = 1
    const n = Math.max(1, Math.floor((width + GAP) / (BAR + GAP)))
    const p = peaks && peaks.length > 1 ? peaks : null
    const playX = Math.min(1, Math.max(0, frac)) * width
    for (let i = 0; i < n; i++) {
      const x = i * (BAR + GAP)
      let h = 2
      if (p) {
        const pos = (i / Math.max(1, n - 1)) * (p.length - 1)
        const lo = Math.floor(pos)
        const hi = Math.min(p.length - 1, lo + 1)
        const v = p[lo]! + (p[hi]! - p[lo]!) * (pos - lo)
        h = Math.max(2, v * height)
      }
      const played = x + BAR / 2 <= playX
      g.fillStyle = played ? 'rgba(26,25,23,0.85)' : 'rgba(26,25,23,0.22)'
      g.fillRect(x, Math.round((height - h) / 2), BAR, Math.round(h))
    }
    if (head || frac > 0) {
      g.fillStyle = '#1B6E48'
      g.fillRect(Math.max(0, Math.min(width - 1.5, playX - 0.75)), 0, 1.5, height)
    }
  }, [peaks, frac, width, height, head])

  const seekAt = (clientX: number) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width <= 0) return
    onSeek(Math.min(1, Math.max(0, (clientX - r.left) / r.width)))
  }

  return (
    <div ref={wrapRef} className="wd-wave" style={{ height }}
      onPointerDown={e => {
        draggingRef.current = true
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* older WebKit */ }
        seekAt(e.clientX)
      }}
      onPointerMove={e => { if (draggingRef.current) seekAt(e.clientX) }}
      onPointerUp={() => { draggingRef.current = false }}
      onPointerCancel={() => { draggingRef.current = false }}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}

function PlayGlyph({ playing, size = 16 }: { playing: boolean; size?: number }) {
  return playing
    ? <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
    : <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}><path d="M8 5v14l11-7z" /></svg>
}

/* ── shared engine + plates ───────────────────────────────────────── */

interface AudioEngine {
  activeUrl: string | null
  playing: boolean
  current: number
  duration: number
  start: (t: { url: string; name: string }, at?: number) => void
  toggle: () => void
  seekTo: (sec: number) => void
}
const AudioEngineContext = createContext<AudioEngine | null>(null)

interface StudioTrack { url: string; name: string }

function useStudioTrack(url: string, name: string) {
  const engine = useContext(AudioEngineContext)
  const meta = useWaveMeta(url)
  const active = !!engine && engine.activeUrl === url
  const playing = active && !!engine && engine.playing
  const cur = active && engine ? engine.current : 0
  const total = (active && engine ? engine.duration : 0) || meta?.duration || 0
  const toggle = useCallback(() => {
    if (!engine) return
    if (active) engine.toggle()
    else engine.start({ url, name })
  }, [engine, active, url, name])
  const seek = useCallback((frac: number) => {
    if (!engine || !total) return
    const t = frac * total
    if (active) engine.seekTo(t)
    else engine.start({ url, name }, t)
  }, [engine, total, active, url, name])
  return { peaks: meta?.peaks ?? null, active, playing, cur, total, toggle, seek }
}

function StudioAudioPlate({ track }: { track: StudioTrack }) {
  const { peaks, active, playing, cur, total, toggle, seek } = useStudioTrack(track.url, track.name)
  return (
    <div className="wd-plate">
      <div className="wd-plate-art">
        <StudioWaveform peaks={peaks} frac={total ? cur / total : 0} height={52} head={active} onSeek={seek} />
      </div>
      <div className="wd-plate-rule" />
      <div className="wd-plate-cap">
        <button className="wd-ac-play" onClick={toggle} aria-label={playing ? 'pause' : 'play'}>
          <PlayGlyph playing={playing} size={14} />
        </button>
        <span className="wd-plate-name">{track.name}</span>
        <span className="wd-plate-right">
          <span className="wd-plate-time">{fmtDur(cur)} / {fmtDur(total)}</span>
          <a className="wd-plate-dl" href={track.url} download={track.name} target="_blank" rel="noopener noreferrer">download</a>
        </span>
      </div>
    </div>
  )
}

function StudioPlateSection({ track }: { track: StudioTrack }) {
  const { peaks, active, playing, cur, total, toggle, seek } = useStudioTrack(track.url, track.name)
  return (
    <div className="wd-plate-sec">
      <div className="wd-plate-secrow">
        <button className="wd-ac-play" onClick={toggle} aria-label={playing ? 'pause' : 'play'}>
          <PlayGlyph playing={playing} size={12} />
        </button>
        <span className="wd-plate-secname" title={track.name}>{track.name}</span>
        <span className="wd-plate-right">
          <span className="wd-plate-time">{fmtDur(cur)} / {fmtDur(total)}</span>
          <a className="wd-plate-dl" href={track.url} download={track.name} target="_blank" rel="noopener noreferrer">download</a>
        </span>
      </div>
      <div className="wd-plate-secwave">
        <StudioWaveform peaks={peaks} frac={total ? cur / total : 0} height={24} head={active} onSeek={seek} />
      </div>
    </div>
  )
}

function StudioAudioCard({ tracks }: { tracks: StudioTrack[] }) {
  if (tracks.length === 0) return null
  if (tracks.length === 1) return <StudioAudioPlate track={tracks[0]!} />
  return <div className="wd-plate">{tracks.map(t => <StudioPlateSection key={t.url} track={t} />)}</div>
}

function StudioNowBar({ url, name, playing, cur, dur, onToggle, onSeek, onClose }: {
  url: string; name: string; playing: boolean; cur: number; dur: number
  onToggle: () => void; onSeek: (sec: number) => void; onClose: () => void
}) {
  const meta = useWaveMeta(url)
  return (
    <div className="wd-nowbar">
      <button className="wd-nowbar-btn" onClick={onToggle} aria-label={playing ? 'pause' : 'play'}>
        <PlayGlyph playing={playing} size={14} />
      </button>
      <span className="wd-nowbar-name">{name}</span>
      <span className="wd-nowbar-time">{fmtDur(cur)} / {fmtDur(dur)}</span>
      <div className="wd-nowbar-wave">
        <StudioWaveform peaks={meta?.peaks ?? null} frac={dur ? Math.min(1, cur / dur) : 0} height={28} head
          onSeek={f => { if (dur) onSeek(f * dur) }} />
      </div>
      <button className="wd-nowbar-x" onClick={onClose} aria-label="close player">✕</button>
    </div>
  )
}

/** In-chat game invite — an admission ticket, not a bubble. */
function InviteTicket({ roomId, gameType, isMine, senderName, gameName, onJoin }: {
  roomId: string; gameType: string; isMine: boolean; senderName: string
  gameName: (id: string) => string
  onJoin?: (gameType: string, roomId: string) => Promise<JoinResult>
}) {
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<null | 'full' | 'missing'>(null)
  const go = async () => {
    if (busy || !onJoin) return
    setBusy(true)
    const r = await onJoin(gameType, roomId)
    setBusy(false)
    if (r === 'full' || r === 'missing') setState(r)
  }
  return (
    <div className="wd-ticket">
      <span className="wd-ticket-stub"><span className="wd-ticket-game">{gameName(gameType)}</span></span>
      <span className="wd-ticket-body">
        <span className="wd-ticket-line">{isMine ? 'you sent an invite' : `${senderName} invited you`}</span>
        {state && <span className="wd-ticket-state">{state === 'full' ? 'the room is full' : 'the room has closed'}</span>}
      </span>
      {!state && (
        <button className="wd-word acc wd-ticket-act" disabled={busy} onClick={() => void go()}>
          {busy ? '…' : isMine ? 'open' : 'join'}
        </button>
      )}
    </div>
  )
}

/* ── the pane ─────────────────────────────────────────────────────── */

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  target: ChatTarget
  isGroup: boolean
  /** Everyone who could appear — senders, readers. Includes me. */
  profileById: Map<string, Profile & { isOnline?: boolean }>
  /** Reader candidates for receipts (the other members). */
  members: Profile[]
  title: string
  onSeen?: (conversationId: string) => void
  onJoinGame?: (gameType: string, roomId: string) => Promise<JoinResult>
  gameName: (id: string) => string
  /** The parent learns the resolved conversation id (notes, calendar, ⋯). */
  onConversation?: (id: string | null) => void
}

export default function StudioChat({
  supabase, currentUserId, target, isGroup, profileById, members, title, onSeen, onJoinGame, gameName, onConversation,
}: Props) {
  const { messages, loading, send, conversationId } = useMessages(supabase, currentUserId, target)
  const reads = useConversationReads(supabase, conversationId ?? null, currentUserId)

  useEffect(() => { onConversation?.(conversationId ?? null) }, [conversationId, onConversation])
  useEffect(() => { if (conversationId) onSeen?.(conversationId) }, [conversationId, messages.length, onSeen])

  // ── one <audio> for the pane ──────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null)
  const trackRef = useRef<{ url: string; name: string } | null>(null)
  const pendingSeekRef = useRef<number | null>(null)
  const [npTrack, setNpTrack] = useState<{ url: string; name: string } | null>(null)
  const [npPlaying, setNpPlaying] = useState(false)
  const [npCur, setNpCur] = useState(0)
  const [npDur, setNpDur] = useState(0)
  const npStart = useCallback((t: { url: string; name: string }, at = 0) => {
    const a = audioRef.current
    if (!a) return
    if (trackRef.current?.url !== t.url) {
      trackRef.current = t
      setNpTrack(t); setNpCur(at); setNpDur(0)
      pendingSeekRef.current = at > 0 ? at : null
      a.src = t.url
    } else {
      a.currentTime = at
      setNpCur(at)
    }
    a.play().then(() => setNpPlaying(true)).catch(() => {})
  }, [])
  const npToggle = useCallback(() => {
    const a = audioRef.current
    if (!a || !trackRef.current) return
    if (a.paused) a.play().then(() => setNpPlaying(true)).catch(() => {})
    else { a.pause(); setNpPlaying(false) }
  }, [])
  const npSeekTo = useCallback((sec: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = sec
    setNpCur(sec)
  }, [])
  const npClose = useCallback(() => {
    const a = audioRef.current
    a?.pause()
    if (a) a.removeAttribute('src')
    trackRef.current = null
    pendingSeekRef.current = null
    setNpTrack(null); setNpPlaying(false); setNpCur(0); setNpDur(0)
  }, [])
  const engine = useMemo<AudioEngine>(() => ({
    activeUrl: npTrack?.url ?? null, playing: npPlaying, current: npCur, duration: npDur,
    start: npStart, toggle: npToggle, seekTo: npSeekTo,
  }), [npTrack, npPlaying, npCur, npDur, npStart, npToggle, npSeekTo])

  // ── composer ──────────────────────────────────────────────────────
  const [draft, setDraft] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const growTa = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 90)}px`
  }, [])
  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    requestAnimationFrame(growTa)
    await send(text)
  }, [draft, send, growTa])

  const [uploads, setUploads] = useState<{ id: string; name: string; progress: number }[]>([])
  const [notices, setNotices] = useState<{ id: string; text: string }[]>([])
  const notify = useCallback((text: string) => {
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setNotices(prev => [...prev, { id, text }])
    setTimeout(() => setNotices(prev => prev.filter(n => n.id !== id)), 7000)
  }, [])
  const MAX_MB = 200
  const onFilesPicked = useCallback(async (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    const done: UploadedAttachment[] = []
    for (const f of files) {
      if (f.size > MAX_MB * 1024 * 1024) { notify(`${f.name} didn’t go out — files up to ${MAX_MB} mb`); continue }
      const pid = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setUploads(prev => [...prev, { id: pid, name: f.name, progress: 0 }])
      try {
        const att = await uploadAttachment(f, currentUserId, r =>
          setUploads(prev => prev.map(u => u.id === pid ? { ...u, progress: r } : u)))
        done.push(att)
      } catch (err) {
        notify(`${f.name} didn’t go out — ${err instanceof Error ? err.message : 'try again'}`)
      } finally {
        setUploads(prev => prev.filter(u => u.id !== pid))
      }
    }
    if (done.length === 0) return
    const allAudio = done.every(a => a.type === 'audio')
    if (allAudio && done.length > 1) {
      await send('', { url: JSON.stringify(done.map(a => ({ url: a.url, name: a.name }))), type: 'multi-audio', name: `${done.length} tracks` })
    } else {
      for (const a of done) await send('', a)
    }
  }, [currentUserId, send, notify])

  // ── voice memo — the phone thread's recorder, in words ────────────
  const [recording, setRecording] = useState(false)
  const [recElapsed, setRecElapsed] = useState(0)
  const recRef = useRef<{ rec: MediaRecorder; stream: MediaStream; chunks: Blob[]; timer: ReturnType<typeof setInterval> } | null>(null)
  const stopTracks = () => {
    const r = recRef.current
    if (!r) return
    clearInterval(r.timer)
    r.stream.getTracks().forEach(t => t.stop())
  }
  const startRecording = async () => {
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const entry = { rec, stream, chunks: [] as Blob[], timer: setInterval(() => setRecElapsed(s => s + 1), 1000) }
      rec.ondataavailable = e => { if (e.data.size > 0) entry.chunks.push(e.data) }
      recRef.current = entry
      setRecElapsed(0)
      setRecording(true)
      rec.start(250)
    } catch (err) {
      console.error('[voice-memo]', err)
      notify('microphone unavailable — check the browser permission')
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
    const blob = await new Promise<Blob>(resolve => {
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
    const file = new File([blob], `voice memo ${stamp}.${ext}`, { type: blob.type || 'audio/mp4' })
    const pid = `up-${Date.now()}-vm`
    setUploads(prev => [...prev, { id: pid, name: file.name, progress: 0 }])
    try {
      const att = await uploadAttachment(file, currentUserId, ratio =>
        setUploads(prev => prev.map(u => u.id === pid ? { ...u, progress: ratio } : u)))
      await send('', att)
    } catch (err) {
      notify(`the memo didn’t go out — ${err instanceof Error ? err.message : 'try again'}`)
    } finally {
      setUploads(prev => prev.filter(u => u.id !== pid))
    }
  }
  useEffect(() => () => { stopTracks(); recRef.current = null }, [])

  // ── scroll: pinned to the bottom unless the reader scrolled up ────
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => { stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48 }
    el.addEventListener('scroll', onScroll)
    const ro = new ResizeObserver(() => { if (stickRef.current) el.scrollTop = el.scrollHeight })
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect() }
  }, [messages, loading])
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [messages, uploads.length, npTrack])

  // ── read receipts, iMessage-style ─────────────────────────────────
  const readersByMsgId = useMemo(() => {
    const map = new Map<string, Profile[]>()
    if (reads.size === 0) return map
    const mine = messages.filter(m => m.sender_id === currentUserId)
    for (const reader of members) {
      const readerTs = reads.get(reader.id) ?? 0
      if (readerTs <= 0) continue
      let lastReadId: string | null = null
      for (const m of mine) {
        if (new Date(m.created_at).getTime() <= readerTs) lastReadId = m.id
        else break
      }
      if (lastReadId) {
        const arr = map.get(lastReadId) ?? []
        arr.push(reader)
        map.set(lastReadId, arr)
      }
    }
    return map
  }, [reads, messages, members, currentUserId])

  // ── rows ──────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const out: ReactNode[] = []
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]!
      const prev = i > 0 ? messages[i - 1]! : null
      const next = i < messages.length - 1 ? messages[i + 1]! : null
      const t = new Date(m.created_at).getTime()
      const dk = dayKey(m.created_at)
      const newDay = !prev || dayKey(prev.created_at) !== dk
      const first = newDay || prev!.sender_id !== m.sender_id || t - new Date(prev!.created_at).getTime() > BURST_MS
      const lastInBurst = !next || dayKey(next.created_at) !== dk || next.sender_id !== m.sender_id
        || new Date(next.created_at).getTime() - t > BURST_MS
      const isMine = m.sender_id === currentUserId
      const senderP = isMine ? undefined : profileById.get(m.sender_id)

      if (newDay) out.push(<div key={`day-${dk}`} className="wd-day">{dayLabel(m.created_at)}</div>)

      const pieces: ReactNode[] = []
      const tailCls = () => (first && pieces.length === 0 ? ' tail' : '')
      if (m.attachment_type === 'game_invite') {
        if (m.attachment_url && m.attachment_name) {
          pieces.push(<InviteTicket key="att" roomId={m.attachment_url} gameType={m.attachment_name} isMine={isMine}
            senderName={senderP?.display_name ?? '…'} gameName={gameName} onJoin={onJoinGame} />)
        }
      } else if (m.attachment_type) {
        if (m.attachment_expired) {
          pieces.push(<div key="att" className="wd-expired">file expired</div>)
        } else if (m.attachment_url) {
          const url = m.attachment_url
          const name = m.attachment_name ?? 'file'
          if (m.attachment_type === 'image') {
            pieces.push(<a key="att" href={url} target="_blank" rel="noopener noreferrer">
              <img className={`wd-img${tailCls()}`} src={url} alt={name} /></a>)
          } else if (m.attachment_type === 'video') {
            pieces.push(<video key="att" className={`wd-vid${tailCls()}`} src={url} controls preload="metadata" />)
          } else if (m.attachment_type === 'audio') {
            pieces.push(<StudioAudioCard key="att" tracks={[{ url, name }]} />)
          } else if (m.attachment_type === 'multi-audio') {
            let tracks: StudioTrack[] = []
            try { tracks = JSON.parse(url) as StudioTrack[] } catch { /* chip below */ }
            pieces.push(tracks.length > 0
              ? <StudioAudioCard key="att" tracks={tracks} />
              : <div key="att" className="wd-file"><i>♪</i><span>{name}</span></div>)
          } else {
            pieces.push(<a key="att" className="wd-file" href={url} target="_blank" rel="noopener noreferrer"><i>▤</i><span>{name}</span></a>)
          }
        }
      }
      if (m.content) pieces.push(<div key="txt" className={`wd-bub${tailCls()}`}>{linkify(m.content)}</div>)
      if (pieces.length === 0) continue

      const readers = isMine ? readersByMsgId.get(m.id) : undefined
      const time = fmtTime(m.created_at)
      const wideAudio = (m.attachment_type === 'audio' || m.attachment_type === 'multi-audio') && !m.attachment_expired && !!m.attachment_url

      out.push(
        <div key={m.id} className={`wd-mrow${isMine ? ' mine' : ' theirs'}${first ? ' first' : ''}`}>
          {!isMine && (
            <div className="wd-mav">
              {first && (
                <span style={{ background: senderP?.avatar_color ?? '#C0BCB3' }}>
                  {senderP?.avatar_url ? <img src={senderP.avatar_url} alt="" /> : (senderP?.initials ?? '').slice(0, 1)}
                </span>
              )}
            </div>
          )}
          <div className={`wd-mcol${wideAudio ? ' wide' : ''}`}>
            {!isMine && first && isGroup && <div className="wd-mname">{senderP?.display_name ?? '…'}</div>}
            {pieces.map((p, idx) => {
              const withTime = lastInBurst && idx === pieces.length - 1
              return (
                <div key={idx} className="wd-mline">
                  {isMine && withTime && <span className="wd-mtime">{time}</span>}
                  {p}
                  {!isMine && withTime && <span className="wd-mtime">{time}</span>}
                </div>
              )
            })}
            {readers && readers.length > 0 && (
              <div className="wd-read">
                {isGroup ? (
                  <span className="wd-read-avs">
                    {readers.slice(0, 4).map(r => (
                      <span key={r.id} style={{ background: r.avatar_color }}>
                        {r.avatar_url ? <img src={r.avatar_url} alt="" /> : r.initials.slice(0, 1)}
                      </span>
                    ))}
                  </span>
                ) : (
                  <>
                    <span>read</span>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
      )
    }
    return out
  }, [messages, currentUserId, profileById, readersByMsgId, isGroup, gameName, onJoinGame])

  return (
    <AudioEngineContext.Provider value={engine}>
      <audio ref={audioRef} preload="metadata"
        onTimeUpdate={() => setNpCur(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (!a) return
          setNpDur(a.duration ?? 0)
          if (pendingSeekRef.current != null) { a.currentTime = pendingSeekRef.current; setNpCur(pendingSeekRef.current); pendingSeekRef.current = null }
        }}
        onEnded={() => { setNpPlaying(false); setNpCur(0) }}
      />
      <div className="wd-chat" ref={scrollRef}>
        {loading
          ? <div className="wd-quiet">…</div>
          : rows.length > 0
            ? <div className="wd-chat-col">{rows}</div>
            : <div className="wd-quiet">no messages yet — say hi</div>}
      </div>
      {(uploads.length > 0 || notices.length > 0) && (
        <div className="wd-upcards">
          {notices.map(n => (
            <button key={n.id} className="wd-upnote" onClick={() => setNotices(prev => prev.filter(x => x.id !== n.id))}>{n.text}</button>
          ))}
          {uploads.map(u => (
            <div key={u.id} className="wd-upcard">
              <div className="wd-upcard-name">{u.name}</div>
              <div className="wd-upcard-row">
                <div className="wd-upcard-track"><div className="wd-upcard-fill" style={{ width: `${Math.round(u.progress * 100)}%` }} /></div>
                <span className="wd-upcard-pct">{Math.round(u.progress * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {npTrack && (
        <StudioNowBar url={npTrack.url} name={npTrack.name} playing={npPlaying} cur={npCur} dur={npDur}
          onToggle={npToggle} onSeek={npSeekTo} onClose={npClose} />
      )}
      <div className="wd-input">
        <input ref={fileRef} type="file" accept="audio/*,image/*,video/*,.wav,.aif,.aiff,.m4a,.ogg,.flac,.caf,.opus,.aac,.mp3" multiple
          style={{ display: 'none' }} onChange={e => { void onFilesPicked(e.target.files); if (e.target) e.target.value = '' }} />
        {recording ? (
          <div className="wd-rec">
            <span className="wd-rec-dot" />
            <span className="wd-rec-time">{fmtDur(recElapsed)}</span>
            <span className="wd-rec-fine">recording</span>
            <button className="wd-word acc" onClick={() => void sendRecording()}>send</button>
            <button className="wd-word" onClick={cancelRecording}>cancel</button>
          </div>
        ) : (
          <>
            <button className="wd-attach" onClick={() => fileRef.current?.click()} aria-label="attach a file">+</button>
            <textarea ref={taRef} rows={1} value={draft} placeholder={`message ${title}…`}
              onChange={e => { setDraft(e.target.value); growTa() }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void handleSend() }
              }} />
            {draft.trim()
              ? <button className="wd-send" onClick={() => void handleSend()}>→</button>
              : <button className="wd-mic" onClick={() => void startRecording()} aria-label="record a voice memo" title="voice memo">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                </button>}
          </>
        )}
      </div>
    </AudioEngineContext.Provider>
  )
}

export type { Message }
