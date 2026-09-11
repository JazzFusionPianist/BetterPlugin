/**
 * greenroom — the workspace surface for the Orb Chat plugin build
 * (?surface=chat). Layout and print styling replicate the approved
 * WorkspaceDemo mockup (.wd-* classes, see studio.css): a project-first
 * rail on the left, a tabbed main pane (chat / files / calendar / notes)
 * on the right. ("files" is the StemPanel — the tab label is studio
 * copy only; the component keeps its name.)
 *
 * Data wiring reuses CollabPage's exact hook patterns:
 *   rail projects  → useConversations().groupConversations
 *   rail people    → useProfiles + useFollows mutualIds (+ usePresence)
 *   unread badges  → useConversationNotifications
 *   chat           → useMessages (dm / group ChatTarget, same shape)
 *   read receipts  → useConversationReads (ChatView's iMessage anchoring)
 *   uploads        → ChatView's presign → XHR PUT flow, verbatim
 *   stems tab      → StemPanel (existing component, collab.css styles)
 *   calendar tab   → ChatCalendar, events filtered to this conversation
 *   notes tab      → conversation_notes (document list per room, realtime)
 *   presence       → 'studio-presence' realtime channel (client-only)
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type ReactNode } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useProfiles } from '../hooks/useProfiles'
import { usePresence } from '../hooks/usePresence'
import { useFollows } from '../hooks/useFollows'
import { useConversations } from '../hooks/useConversations'
import { useConversationNotifications } from '../hooks/useConversationNotifications'
import { useConversationReads } from '../hooks/useConversationReads'
import { useMessages } from '../hooks/useMessages'
import { useCalendarEvents, type NewCalendarEvent, type CalendarEvent } from '../hooks/useCalendarEvents'
import { useEventCategories } from '../hooks/useEventCategories'
import { parseSchedule } from '../lib/parseSchedule'
import { linkify, firstUrl, openExternalUrl } from '../lib/linkify'
import { getDawTimelineSnapshot, initAudioTimelineTracking, refreshDawTimelineSnapshot } from '../lib/audioTimeline'
import StemPanel from '../components/collab/StemPanel'
import ChatCalendar from '../components/collab/ChatCalendar'
import SchedulePrompt from '../components/collab/SchedulePrompt'
import LinkPreviewCard from '../components/collab/LinkPreviewCard'
import { AudioAttachment, AudioEngineContext, ScheduleChip, looksLikeSchedule, type ExternalAudioEngine } from '../components/collab/ChatView'
import { LanguageProvider } from '../i18n/LanguageContext'
import type { AttachmentTimelineMetadata, ChatTarget, Message, Profile } from '../types/collab'
import type { StemDropRequest } from '../types/stems'
import './studio.css'

interface Props { supabase: SupabaseClient; user: User }

type Sel =
  | { kind: 'dm'; userId: string }
  | { kind: 'group'; conversationId: string }
  | { kind: 'me' }

type Tab = 'chat' | 'stems' | 'calendar' | 'notes'

/* ── DAW / Finder drag-and-drop plumbing (ChatView's grammar) ─────── */

const DROP_AUDIO_EXTS = new Set(['mp3', 'wav', 'aif', 'aiff', 'm4a', 'ogg', 'flac', 'caf', 'opus', 'aac'])

function isAudioFile(f: File): boolean {
  return f.type.startsWith('audio/') || DROP_AUDIO_EXTS.has(f.name.split('.').pop()?.toLowerCase() ?? '')
}

/** Native-bridge base64 payload ({name,data} from __juceFileDrop) → File.
 *  Same decode as StemPanel.nativeFile / ChatView.b64ToAudioFile. */
function nativeToFile(name: string, data: string): File {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const mime: Record<string, string> = {
    wav: 'audio/wav', aif: 'audio/aiff', aiff: 'audio/aiff', mp3: 'audio/mpeg',
    m4a: 'audio/mp4', caf: 'audio/x-caf', ogg: 'audio/ogg', flac: 'audio/flac',
  }
  return new File([bytes], name, { type: mime[ext] ?? 'audio/wav' })
}

/** True when a React drag event is carrying real files (not text/UI drags). */
function dragHasFiles(e: ReactDragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

/** Average a set of #RRGGBB strings into one hex — same helper CollabPage
 *  uses for group tint (visually unifies a member set). */
function mixHexColors(hexes: string[]): string {
  if (hexes.length === 0) return '#4A8FE7'
  let r = 0, g = 0, b = 0
  for (const h of hexes) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim())
    if (!m) continue
    const v = parseInt(m[1]!, 16)
    r += (v >> 16) & 0xff
    g += (v >> 8) & 0xff
    b += v & 0xff
  }
  const n = hexes.length
  const to2 = (x: number) => Math.round(x / n).toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

/** Same-sender messages closer than this form one bubble burst. */
const BURST_MS = 4 * 60 * 1000

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "1:04" — elapsed/total readout for the now-playing bar. */
function fmtDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/* ── waveform tech — the web app's audioPeaks technique, ported ──────
   The open-call feed on the web (apps/web/lib/audioPeaks.ts + the
   OpenCallPanel Waveform) decodes each track once and prints max-abs
   amplitude buckets as bars. Same recipe here: fetch(url) →
   AudioContext.decodeAudioData → ~90 normalized peak buckets, cached
   per URL at module level so a track decodes once per session. When
   fetch/decode can't run (CORS, odd codec), deterministic pseudo-peaks
   seeded from the URL string stand in — a smoothed random walk that
   reads as organic — and duration falls back to an <audio> metadata
   probe (media elements aren't CORS-gated the way fetch is). */

const WAVE_BUCKETS = 90
interface WaveMeta { peaks: number[]; duration: number }
const waveCache = new Map<string, WaveMeta>()
const waveInflight = new Map<string, Promise<WaveMeta>>()

/** URL hash → xorshift random walk with a pull to the middle and a slow
 *  swell — stable per URL, organic enough to pass as a real print. */
function pseudoPeaks(seed: string): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const phase = ((h >>> 0) % 628) / 100
  const rand = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5
    return ((h >>> 0) % 1000) / 1000
  }
  const out: number[] = []
  let v = 0.35 + rand() * 0.35
  for (let i = 0; i < WAVE_BUCKETS; i++) {
    v += (rand() - 0.5) * 0.3          // walk
    v += (0.5 - v) * 0.12              // gentle pull home
    const swell = 0.72 + 0.28 * Math.sin(i / 9 + phase)
    out.push(Math.min(1, Math.max(0.06, v * swell)))
  }
  return out
}

/** Duration via a media element — used only on the fetch-less fallback. */
function probeDuration(url: string): Promise<number> {
  return new Promise(resolve => {
    const a = new Audio()
    a.preload = 'metadata'
    const done = (d: number) => {
      a.onloadedmetadata = null; a.onerror = null
      a.removeAttribute('src')
      resolve(d)
    }
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
  const Ctx: AC | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext
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
      // Stride big buckets — max-abs of every 32nd sample reads the same
      // at bar scale and is 30× cheaper on long stems (web-app parity).
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

/** The waveform IS the scrubber. 2px ink bars, 1px gap, min-height 2px,
 *  vertically centered on a DPR-aware canvas; the ~90 cached buckets are
 *  linearly resampled to however many bars the width holds. Unplayed
 *  bars rgba-ink .18, played .85; the boundary carries a 1.5px accent
 *  needle. Pointer-down anywhere seeks and dragging keeps scrubbing
 *  (pointer capture — works while paused too). Peaks still decoding →
 *  a quiet 2px dotted baseline in the same grammar. */
function StudioWaveform({ peaks, frac, height, head, onSeek }: {
  peaks: number[] | null; frac: number; height: number; head?: boolean
  onSeek: (frac: number) => void
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
    const BAR = 2, GAP = 1
    const n = Math.max(1, Math.floor((width + GAP) / (BAR + GAP)))
    const p = peaks && peaks.length > 1 ? peaks : null
    const playX = Math.min(1, Math.max(0, frac)) * width
    for (let i = 0; i < n; i++) {
      const x = i * (BAR + GAP)
      let h = 2
      if (p) {
        // Linear interpolation between buckets — no plateau steps.
        const pos = (i / Math.max(1, n - 1)) * (p.length - 1)
        const lo = Math.floor(pos)
        const hi = Math.min(p.length - 1, lo + 1)
        const v = p[lo]! + (p[hi]! - p[lo]!) * (pos - lo)
        h = Math.max(2, v * height)
      }
      const played = x + BAR / 2 <= playX
      g.fillStyle = played ? 'rgba(26,25,23,0.85)' : 'rgba(26,25,23,0.18)'
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
    <div
      ref={wrapRef}
      className="wd-wave"
      style={{ height }}
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

/* ── studio audio cards ──────────────────────────────────────────────
   The studio's OWN card component replaces AudioAttachment's chrome in
   this chat — but the real AudioAttachment still mounts inside each
   card (hidden by .wd-ac-import CSS, import button excepted), so the
   whole import-to-DAW machinery — prefetch → writeAudioFile → drag-out
   arming, __juceImported / cooldown handling — runs byte-for-byte
   unchanged. Playback is a remote control on the shared engine. */

interface StudioTrack { url: string; name: string; metadata?: AttachmentTimelineMetadata }

/** Bind one track to the shared engine + its cached waveform. Duration
 *  prefers the live engine, then the decoded meta, so a card reads its
 *  total before it has ever been played. */
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

/** Single track — the full grammar: [glyph · name · total], the 40px
 *  waveform, then [elapsed · import word]. */
function StudioAudioSingle({ track }: { track: StudioTrack }) {
  const { peaks, active, playing, cur, total, toggle, seek } = useStudioTrack(track.url, track.name)
  return (
    <div className="wd-acard">
      <div className="wd-ac-top">
        <button className="wd-ac-play" onClick={toggle} aria-label={playing ? 'pause' : 'play'}>
          <PlayGlyph playing={playing} size={16} />
        </button>
        <span className="wd-ac-name">{track.name}</span>
        <span className="wd-ac-dur">{fmtDur(total)}</span>
      </div>
      <StudioWaveform peaks={peaks} frac={total ? cur / total : 0} height={40} head={active} onSeek={seek} />
      <div className="wd-ac-foot">
        <span className="wd-ac-cur">{fmtDur(cur)}</span>
        <span className="wd-ac-import">
          <AudioAttachment url={track.url} name={track.name} metadata={track.metadata} />
        </span>
      </div>
    </div>
  )
}

/** Multi-audio row — compact grammar: glyph · name · mini 24px
 *  waveform · time · its own import word. */
function StudioAudioRow({ track }: { track: StudioTrack }) {
  const { peaks, active, playing, cur, total, toggle, seek } = useStudioTrack(track.url, track.name)
  return (
    <div className="wd-ac-row">
      <button className="wd-ac-play" onClick={toggle} aria-label={playing ? 'pause' : 'play'}>
        <PlayGlyph playing={playing} size={13} />
      </button>
      <span className="wd-ac-name" title={track.name}>{track.name}</span>
      <StudioWaveform peaks={peaks} frac={total ? cur / total : 0} height={24} head={active} onSeek={seek} />
      <span className="wd-ac-time">{active ? `${fmtDur(cur)} / ${fmtDur(total)}` : fmtDur(total)}</span>
      <span className="wd-ac-import">
        <AudioAttachment url={track.url} name={track.name} metadata={track.metadata} />
      </span>
    </div>
  )
}

function StudioAudioCard({ tracks }: { tracks: StudioTrack[] }) {
  if (tracks.length === 0) return null
  if (tracks.length === 1) return <StudioAudioSingle track={tracks[0]!} />
  return (
    <div className="wd-acard multi">
      {tracks.map(t => <StudioAudioRow key={t.url} track={t} />)}
    </div>
  )
}

/** Docked now-playing bar — 56px, white over a hairline top rule.
 *  Fixed left cluster (glyph · name · elapsed/total); the REST of the
 *  width is the playing track's waveform (28px, same bar rendering,
 *  same seek-drag) — the waveform IS the scrubber. Grey ✕ far right. */
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
        <StudioWaveform
          peaks={meta?.peaks ?? null}
          frac={dur ? Math.min(1, cur / dur) : 0}
          height={28}
          head
          onSeek={f => { if (dur) onSeek(f * dur) }}
        />
      </div>
      <button className="wd-nowbar-x" onClick={onClose} aria-label="close player">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  )
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  if (dayKey(iso) === dayKey(today.toISOString())) return 'today'
  if (dayKey(iso) === dayKey(yest.toISOString())) return 'yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase()
}

/** One-line preview of a message for the rail rows. */
function snippet(m: Message | null | undefined, senderName?: string): string {
  if (!m) return ''
  const body = m.attachment_type === 'audio' || m.attachment_type === 'multi-audio'
    ? `♪ ${m.attachment_name ?? 'audio'}`
    : m.attachment_type === 'image' ? 'image'
    : m.attachment_type === 'video' ? 'video'
    : m.attachment_type === 'game_invite' ? 'game invite'
    : m.content
  return senderName ? `${senderName}: ${body}` : body
}

/** " / 2h" elapsed-in-the-studio suffix; empty under a minute. */
function studioFor(since: number, now: number): string {
  const min = Math.floor((now - since) / 60000)
  if (min < 1) return ''
  if (min < 60) return ` / ${min}m`
  return ` / ${Math.floor(min / 60)}h`
}

/** "in the studio" presence — a client-only realtime presence channel.
 *  Everyone with the plugin open joins; the map is user_id → joined-at ms
 *  (earliest, if they hold several connections). */
function useStudioPresence(supabase: SupabaseClient, userId: string): Map<string, number> {
  const [present, setPresent] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    const ch = supabase.channel('studio-presence')
    ch
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<{ user_id: string; at: number }>()
        const next = new Map<string, number>()
        for (const metas of Object.values(state)) {
          for (const m of metas) {
            if (!m.user_id) continue
            const prev = next.get(m.user_id)
            if (prev === undefined || m.at < prev) next.set(m.user_id, m.at)
          }
        }
        setPresent(next)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await ch.track({ user_id: userId, at: Date.now() })
      })
    return () => { supabase.removeChannel(ch) }
  }, [supabase, userId])
  return present
}

/** ── todos — the home prompt's plain-task lane ─────────────────────
 *  todos(id, user_id, content, done, created_at) — own rows only (RLS).
 *  Newest first; toggles and clears are optimistic with a refresh on
 *  error, and realtime keeps other devices in step. */
interface TodoRow {
  id: string
  user_id: string
  content: string
  done: boolean
  created_at: string
}

function useTodos(supabase: SupabaseClient, userId: string) {
  const [todos, setTodos] = useState<TodoRow[]>([])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) { console.error('[StudioTodos] load failed', error); return }
    setTodos((data ?? []) as TodoRow[])
  }, [supabase, userId])

  useEffect(() => {
    void refresh()
    const ch = supabase
      .channel(`studio-todos:${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` },
        () => { void refresh() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, userId, refresh])

  const add = useCallback(async (content: string) => {
    const { error } = await supabase.from('todos').insert({ user_id: userId, content })
    if (error) { console.error('[StudioTodos] add failed', error); throw error }
    await refresh()
  }, [supabase, userId, refresh])

  const toggle = useCallback(async (t: TodoRow) => {
    setTodos(prev => prev.map(x => x.id === t.id ? { ...x, done: !t.done } : x))
    const { error } = await supabase.from('todos').update({ done: !t.done }).eq('id', t.id)
    if (error) { console.error('[StudioTodos] toggle failed', error); void refresh() }
  }, [supabase, refresh])

  const clearDone = useCallback(async () => {
    setTodos(prev => prev.filter(x => !x.done))
    const { error } = await supabase.from('todos').delete().eq('user_id', userId).eq('done', true)
    if (error) { console.error('[StudioTodos] clear failed', error); void refresh() }
  }, [supabase, userId, refresh])

  return { todos, add, toggle, clearDone }
}

function Avatar({ color, label, group, avatarUrl, dot }: {
  color: string; label: string; group?: boolean; avatarUrl?: string | null; dot?: 'on' | 'studio'
}) {
  return (
    <span className={`wd-av${group ? ' grp' : ''}`} style={{ background: color }}>
      {avatarUrl ? <img src={avatarUrl} alt="" /> : label}
      {dot && <span className={`wd-dot${dot === 'studio' ? ' studio' : ''}`} />}
    </span>
  )
}

/** The greenroom mark — a small room (rounded-square outline, hairline
 *  ink) with the green presence dot inside. Quiet on purpose. */
function BrandMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="0.75" y="0.75" width="10.5" height="10.5" rx="3.2" stroke="#1A1917" strokeWidth="1" />
      <circle cx="6" cy="6" r="2" fill="var(--acc)" />
    </svg>
  )
}

/** Programme-margin upcoming list — date column · time · title, hairline
 *  separators, today in the accent. Shared by the home pane and the
 *  "my calendar" view (mirrors the web app's UpcomingList split). */
function UpcomingRows({ events, groupTitleById, limit, nowTick }: {
  events: CalendarEvent[]; groupTitleById: Map<string, string>; limit: number; nowTick: number
}) {
  const rows = useMemo(() => {
    const now = new Date(nowTick)
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return events
      .filter(e => new Date(e.starts_at) >= (e.all_day ? dayStart : now))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, limit)
  }, [events, limit, nowTick])

  if (rows.length === 0) {
    return <div className="wd-up"><div className="wd-up-head">upcoming</div>
      <div className="wd-up-none">nothing scheduled — enjoy the quiet</div></div>
  }

  const now = new Date(nowTick)
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const label = (iso: string): { text: string; today: boolean } => {
    const d = new Date(iso)
    const days = Math.floor(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - dayStart.getTime()) / 86400000)
    if (days <= 0) return { text: 'today', today: true }
    if (days === 1) return { text: 'tomorrow', today: false }
    if (days < 7) return { text: d.toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase(), today: false }
    return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase(), today: false }
  }

  return (
    <div className="wd-up">
      <div className="wd-up-head">upcoming</div>
      {rows.map(e => {
        const l = label(e.starts_at)
        return (
          <div key={e.id} className="wd-up-row">
            <span className={`wd-up-date${l.today ? ' today' : ''}`}>{l.text}</span>
            <span className="wd-up-time">{e.all_day ? 'all day' : fmtTime(e.starts_at)}</span>
            <span className="wd-up-title">{e.title}</span>
            {e.conversation_id && (
              <span className="wd-up-from">{groupTitleById.get(e.conversation_id) ?? ''}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** ── notes — one document per show ──────────────────────────────────
 *  A band's room accumulates a note per show/broadcast/flight sheet
 *  (일정 · 타임테이블 · 셋리스트 · 예약번호), each opened and edited on
 *  its own. conversation_notes is the v2 document table (uuid rows). */

interface NoteRow {
  id: string
  conversation_id: string
  title: string
  content: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** "just now" → "4m ago" → "2h ago" → "yesterday" → "12 aug". */
function relTime(iso: string, now: number): string {
  const min = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (min < 24 * 60) return `${Math.floor(min / 60)}h ago`
  const d = new Date(iso)
  const dayStart = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  const days = Math.floor((dayStart(new Date(now)) - dayStart(d)) / 86400000)
  if (days <= 1) return 'yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase()
}

/** Tags the note toolbar can produce — everything else is unwrapped. */
const NOTE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'H3', 'P', 'BR', 'DIV'])

/** Small allowlist sanitizer for note HTML. script/style subtrees are
 *  dropped whole; other off-list tags are unwrapped (children kept);
 *  every attribute is stripped. Applied before save AND before any
 *  remote HTML touches the editor. */
function sanitizeNoteHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const clean = (node: Element) => {
    for (const el of Array.from(node.children)) {
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') { el.remove(); continue }
      clean(el)
      if (NOTE_TAGS.has(el.tagName)) {
        for (const a of Array.from(el.attributes)) el.removeAttribute(a.name)
      } else {
        const parent = el.parentNode
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el)
          el.remove()
        }
      }
    }
  }
  clean(doc.body)
  return doc.body.innerHTML
}

/** Decode a tagless HTML fragment back to plain text (entities → chars). */
function htmlToText(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
}

/** One-line plain preview of note content, HTML or legacy plain text. */
function noteSnippet(content: string): string {
  const plain = content.includes('<')
    ? htmlToText(content.replace(/<br\s*\/?>/gi, ' ').replace(/></g, '> <'))
    : content
  return plain.replace(/\s+/g, ' ').trim()
}

/** Note documents for the open conversation — list + realtime refresh.
 *  Lives at the shell level so the notes tab can badge its count the
 *  way calendar does. Any INSERT/UPDATE/DELETE on this conversation's
 *  rows re-pulls the ordered list. */
function useConversationNotes(supabase: SupabaseClient, conversationId: string | null) {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!conversationId) return
    const { data, error } = await supabase
      .from('conversation_notes')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('updated_at', { ascending: false })
    if (error) { console.error('[StudioNotes] load failed', error); setLoaded(true); return }
    setNotes((data ?? []) as NoteRow[])
    setLoaded(true)
  }, [supabase, conversationId])

  useEffect(() => {
    setNotes([]); setLoaded(false)
    if (!conversationId) return
    void refresh()
    const ch = supabase
      .channel(`studio-notes:${conversationId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_notes',
          filter: `conversation_id=eq.${conversationId}` },
        () => { void refresh() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, conversationId, refresh])

  return { notes, loaded, refresh }
}

/** The notes tab — a document list (default) and a per-note editor. */
function StudioNotes({ supabase, conversationId, userId, nameOf, notes, loaded, refresh, nowTick }: {
  supabase: SupabaseClient; conversationId: string; userId: string
  nameOf: (id: string | null) => string
  notes: NoteRow[]; loaded: boolean; refresh: () => Promise<void>; nowTick: number
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [focusNew, setFocusNew] = useState(false)
  const [delSureId, setDelSureId] = useState<string | null>(null)
  const creatingRef = useRef(false)

  // Conversation switched under the tab — back to that room's list.
  useEffect(() => { setOpenId(null); setFocusNew(false); setDelSureId(null) }, [conversationId])

  const openNote = openId ? notes.find(n => n.id === openId) ?? null : null

  // The open note deleted elsewhere (another member, another device) —
  // fall back to the list quietly.
  useEffect(() => {
    if (openId && loaded && !notes.some(n => n.id === openId)) {
      setOpenId(null); setFocusNew(false)
    }
  }, [openId, loaded, notes])

  const createNote = useCallback(async () => {
    if (creatingRef.current) return
    creatingRef.current = true
    const { data, error } = await supabase
      .from('conversation_notes')
      .insert({ conversation_id: conversationId, created_by: userId, updated_by: userId })
      .select()
      .single()
    creatingRef.current = false
    if (error || !data) { console.error('[StudioNotes] create failed', error); return }
    await refresh()
    setFocusNew(true)
    setOpenId((data as NoteRow).id)
  }, [supabase, conversationId, userId, refresh])

  const deleteNote = useCallback(async (id: string) => {
    const { error } = await supabase.from('conversation_notes').delete().eq('id', id)
    if (error) { console.error('[StudioNotes] delete failed', error); return }
    setOpenId(null); setFocusNew(false)
    void refresh()
  }, [supabase, refresh])

  if (openNote) {
    return (
      <NoteEditor
        key={openNote.id}
        supabase={supabase}
        note={openNote}
        userId={userId}
        nameOf={nameOf}
        nowTick={nowTick}
        autoFocusTitle={focusNew}
        onBack={() => { setOpenId(null); setFocusNew(false) }}
        onDelete={() => { void deleteNote(openNote.id) }}
      />
    )
  }

  return (
    <div className="wd-notes">
      <div className="wd-notes-bar">
        <button className="wd-notes-new" onClick={() => void createNote()}>+ new note</button>
      </div>
      <div className="wd-notes-list">
        {!loaded
          ? <div className="wd-quiet">…</div>
          : notes.length === 0
            ? <div className="wd-quiet">no notes yet — keep setlists, schedules, anything the band needs</div>
            : notes.map(n => {
              const title = n.title.trim()
              const snip = noteSnippet(n.content)
              return (
                <div key={n.id} className="wd-note-row"
                  onClick={() => { setFocusNew(false); setDelSureId(null); setOpenId(n.id) }}>
                  <div className="wd-note-row-main">
                    <div className={`wd-note-title${title ? '' : ' untitled'}`}>{title || 'untitled'}</div>
                    {snip && <div className="wd-note-snip">{snip}</div>}
                    <div className="wd-note-meta">
                      {`edited by ${n.updated_by ? nameOf(n.updated_by) : '—'} / ${relTime(n.updated_at, nowTick)}`}
                    </div>
                  </div>
                  <button
                    className={`wd-note-del row${delSureId === n.id ? ' sure' : ''}`}
                    onClick={e => {
                      e.stopPropagation()
                      if (delSureId !== n.id) { setDelSureId(n.id); return }
                      setDelSureId(null)
                      void deleteNote(n.id)
                    }}
                  >
                    {delSureId === n.id ? 'sure?' : 'delete'}
                  </button>
                </div>
              )
            })}
      </div>
    </div>
  )
}

/** One note opened — borderless serif title + quiet paper body, both
 *  autosaved (800ms debounce). The body is a contentEditable storing
 *  sanitized HTML (legacy plain text renders as before). Remote
 *  realtime edits arrive as new `note` props and are adopted ONLY
 *  while the local editor is clean — mid-typing or mid-save, local
 *  text wins (v1's typing guard, now an innerHTML dirty check). */
function NoteEditor({ supabase, note, userId, nameOf, nowTick, autoFocusTitle, onBack, onDelete }: {
  supabase: SupabaseClient; note: NoteRow; userId: string
  nameOf: (id: string | null) => string; nowTick: number
  autoFocusTitle: boolean; onBack: () => void; onDelete: () => void
}) {
  const [title, setTitle] = useState(note.title)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [delSure, setDelSure] = useState(false)

  const titleRef = useRef(note.title)
  const contentRef = useRef(note.content)   // raw editor innerHTML (or legacy text at open)
  const dirtyRef = useRef(false)
  const inFlightRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // A fresh note opens with the title ready to type.
  useEffect(() => {
    if (autoFocusTitle) titleInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback(async () => {
    const snapTitle = titleRef.current
    const snapContent = contentRef.current
    // Sanitize on the way out; a tagless fragment decodes back to plain
    // text so legacy notes stay legacy until formatting is used.
    const html = sanitizeNoteHtml(snapContent)
    inFlightRef.current = true
    const { error } = await supabase
      .from('conversation_notes')
      .update({
        title: snapTitle,
        content: html.includes('<') ? html : htmlToText(html),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', note.id)
    inFlightRef.current = false
    if (error) { console.error('[StudioNotes] save failed', error); return }
    // Still dirty only if more typing landed while the save flew.
    if (titleRef.current === snapTitle && contentRef.current === snapContent) dirtyRef.current = false
    setSavedAt(Date.now())
  }, [supabase, note.id, userId])

  const queueSave = useCallback(() => {
    dirtyRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void persist() }, 800)
  }, [persist])

  // Closing the editor (back, tab switch, unmount) flushes a pending edit.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (dirtyRef.current) void persist()
  }, [persist])

  // Remote realtime edits arrive as new note props — adopt them only
  // while the local editor is clean, protecting in-flight typing.
  // Remote HTML is sanitized before it touches the DOM; legacy plain
  // text (no '<') goes in as text. Also paints the initial content.
  useEffect(() => {
    if (dirtyRef.current || inFlightRef.current) return
    setTitle(note.title); titleRef.current = note.title
    const el = bodyRef.current
    if (!el) return
    if (note.content.includes('<')) {
      const target = sanitizeNoteHtml(note.content)
      if (el.innerHTML !== target) el.innerHTML = target
    } else if ((el.textContent ?? '') !== note.content || el.innerHTML.includes('<')) {
      el.textContent = note.content
    }
    contentRef.current = el.innerHTML
  }, [note.title, note.content, note.updated_at])

  const syncBody = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    contentRef.current = el.innerHTML
    queueSave()
  }, [queueSave])

  // Toolbar commands — execCommand keeps the selection's formatting in
  // the small allowlist the sanitizer accepts.
  const exec = useCallback((cmd: string) => {
    const el = bodyRef.current
    if (!el) return
    el.focus()
    document.execCommand(cmd)
    syncBody()
  }, [syncBody])
  const block = useCallback((tag: string) => {
    const el = bodyRef.current
    if (!el) return
    el.focus()
    // Older WebKits want the bracketed form.
    if (!document.execCommand('formatBlock', false, tag)) {
      document.execCommand('formatBlock', false, `<${tag}>`)
    }
    syncBody()
  }, [syncBody])
  const toggleH3 = useCallback(() => {
    const cur = String(document.queryCommandValue('formatBlock') || '').toLowerCase()
    block(cur === 'h3' ? 'p' : 'h3')
  }, [block])
  const keepSel = (e: { preventDefault: () => void }) => e.preventDefault()

  const fine = savedAt !== null && note.updated_by === userId
    ? `saved / ${relTime(new Date(savedAt).toISOString(), Math.max(nowTick, savedAt))}`
    : `edited by ${note.updated_by ? nameOf(note.updated_by) : '—'} / ${relTime(note.updated_at, nowTick)}`

  return (
    <div className="wd-note-ed">
      <div className="wd-note-ed-head">
        <button className="wd-note-back" onClick={onBack} aria-label="back to notes">‹</button>
        <input
          ref={titleInputRef}
          className="wd-note-ed-title"
          value={title}
          placeholder="title…"
          spellCheck={false}
          onChange={e => { setTitle(e.target.value); titleRef.current = e.target.value; queueSave() }}
        />
        <span className="wd-note-ed-fine">{fine}</span>
      </div>
      <div className="wd-note-tools">
        <button className="wd-tool" title="bold" onMouseDown={keepSel} onClick={() => exec('bold')}><b>B</b></button>
        <button className="wd-tool" title="italic" onMouseDown={keepSel} onClick={() => exec('italic')}><i>I</i></button>
        <button className="wd-tool" title="underline" onMouseDown={keepSel} onClick={() => exec('underline')}><u>U</u></button>
        <button className="wd-tool" title="strikethrough" onMouseDown={keepSel} onClick={() => exec('strikeThrough')}><s>S</s></button>
        <button className="wd-tool" title="bulleted list" onMouseDown={keepSel} onClick={() => exec('insertUnorderedList')}>• list</button>
        <button className="wd-tool" title="numbered list" onMouseDown={keepSel} onClick={() => exec('insertOrderedList')}>1. list</button>
        <button className="wd-tool" title="heading" onMouseDown={keepSel} onClick={toggleH3}>H</button>
      </div>
      <div
        ref={bodyRef}
        className="wd-note-ed-body rich"
        contentEditable
        spellCheck={false}
        data-placeholder="setlists, timetables, flight numbers — anything worth keeping"
        onInput={syncBody}
      />
      <div className="wd-note-ed-foot">
        <button
          className={`wd-note-del${delSure ? ' sure' : ''}`}
          onClick={() => {
            if (!delSure) { setDelSure(true); return }
            // A dying row shouldn't get a farewell autosave.
            if (timerRef.current) clearTimeout(timerRef.current)
            dirtyRef.current = false
            onDelete()
          }}
        >
          {delSure ? 'sure?' : 'delete note'}
        </button>
      </div>
    </div>
  )
}

export default function StudioShell({ supabase, user }: Props) {
  return (
    <LanguageProvider>
      <StudioShellInner supabase={supabase} user={user} />
    </LanguageProvider>
  )
}

function StudioShellInner({ supabase, user }: Props) {
  const [sel, setSel] = useState<Sel | null>(null)
  const [tab, setTab] = useState<Tab>('chat')

  // Minute tick — re-splits the upcoming lists and advances the
  // "in the studio / 2h" elapsed labels while the plugin sits open.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { profiles, me, loading: profilesLoading, refetch: refetchProfiles } = useProfiles(supabase, user.id)
  const onlineIds = usePresence(supabase, user.id)
  const studioAt = useStudioPresence(supabase, user.id)
  const { mutualIds } = useFollows(supabase, user.id)
  const { conversations, groupConversations } = useConversations(supabase, user.id)
  const { unread: convUnread, lastMessages: convLastMessages, markSeen } = useConversationNotifications(supabase, user.id)

  // Ensure a profile row exists (same guard as CollabPage).
  useEffect(() => {
    if (!profilesLoading && !me) {
      supabase.from('profiles').upsert(
        { id: user.id, display_name: user.email?.split('@')[0] ?? 'User' },
        { onConflict: 'id', ignoreDuplicates: true },
      ).then(() => refetchProfiles())
    }
  }, [profilesLoading, me, supabase, user.id, user.email, refetchProfiles])

  const profilesWithStatus = useMemo(
    () => profiles.map(p => ({ ...p, isOnline: onlineIds.has(p.id) })),
    [profiles, onlineIds],
  )
  const profileById = useMemo(() => {
    const m = new Map(profilesWithStatus.map(p => [p.id, p]))
    if (me) m.set(me.id, { ...me, isOnline: true })
    return m
  }, [profilesWithStatus, me])

  // Rail "people" — DM-able friends: the mutual-follow set, exactly as
  // CollabPage builds friendProfiles. Sorted online-first, then by name.
  const friendProfiles = useMemo(() => {
    const list = profilesWithStatus.filter(p => mutualIds.has(p.id))
    return list.sort((a, b) =>
      Number(b.isOnline) - Number(a.isOnline) || a.display_name.localeCompare(b.display_name))
  }, [profilesWithStatus, mutualIds])

  // DM conversation summaries keyed by partner id (for rail snippets + badges).
  const dmConvByPartner = useMemo(() => {
    const m = new Map<string, { conversationId: string; lastMessage: Message }>()
    for (const c of conversations) m.set(c.partnerId, { conversationId: c.conversationId, lastMessage: c.lastMessage })
    return m
  }, [conversations])

  // Group tint = averaged member colors (CollabPage's groupColorByConv).
  const groupColorByConv = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groupConversations) {
      const colors = g.memberIds
        .map(id => profileById.get(id)?.avatar_color)
        .filter((c): c is string => !!c)
      m.set(g.conversationId, mixHexColors(colors))
    }
    return m
  }, [groupConversations, profileById])

  // ── active chat ─────────────────────────────────────────────────────
  const chatTarget: ChatTarget | null = useMemo(() => {
    if (!sel || sel.kind === 'me') return null
    return sel.kind === 'dm'
      ? { kind: 'dm', otherUserId: sel.userId }
      : { kind: 'group', conversationId: sel.conversationId }
  }, [sel])
  const { messages, loading: messagesLoading, send, conversationId: activeConvId } = useMessages(supabase, user.id, chatTarget)
  const reads = useConversationReads(supabase, activeConvId ?? null, user.id)

  // Clear the unread badge for whatever is open — on open (once the DM
  // conversation resolves) and again when new messages land while open.
  useEffect(() => {
    if (activeConvId && (convUnread.get(activeConvId) ?? 0) > 0) markSeen(activeConvId)
  }, [activeConvId, convUnread, markSeen])
  useEffect(() => {
    if (activeConvId) markSeen(activeConvId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId])

  const selectedGroup = sel?.kind === 'group'
    ? groupConversations.find(g => g.conversationId === sel.conversationId) ?? null
    : null
  const selectedProfile = sel?.kind === 'dm'
    ? profileById.get(sel.userId) ?? null
    : null

  const headerTitle = selectedGroup?.title ?? selectedProfile?.display_name ?? ''

  // Inline group rename — double-click the title, type, Enter/blur
  // saves, Escape walks away. null = not editing.
  const [titleEdit, setTitleEdit] = useState<string | null>(null)
  useEffect(() => { setTitleEdit(null) }, [activeConvId])
  const commitTitle = useCallback(async () => {
    const t = (titleEdit ?? '').trim()
    setTitleEdit(null)
    if (!t || t === headerTitle || !activeConvId || sel?.kind !== 'group') return
    const { error } = await supabase.from('conversations').update({ title: t }).eq('id', activeConvId)
    if (error) console.error('[Studio] rename failed', error)
  }, [titleEdit, headerTitle, activeConvId, sel, supabase])
  const headerSub = useMemo(() => {
    if (selectedGroup) {
      const n = selectedGroup.memberIds.length
      const inStudio = selectedGroup.memberIds.filter(id => studioAt.has(id)).length
      if (inStudio > 0) return `${n} members / ${inStudio} in the studio now`
      const online = selectedGroup.memberIds.filter(id => id === user.id || onlineIds.has(id)).length
      return `${n} members / ${online} online`
    }
    if (selectedProfile) {
      if (studioAt.has(selectedProfile.id)) return 'in the studio'
      return selectedProfile.isOnline ? 'online' : 'offline'
    }
    return ''
  }, [selectedGroup, selectedProfile, studioAt, onlineIds, user.id])

  // Stems participants — me + the other side, same as CollabPage.
  const stemParticipants = useMemo(() => {
    const members: Profile[] = []
    if (me) members.push({ ...me, isOnline: true })
    if (selectedGroup) {
      for (const id of selectedGroup.memberIds) {
        if (id === user.id) continue
        const p = profileById.get(id)
        if (p) members.push(p)
      }
    } else if (selectedProfile) members.push(selectedProfile)
    return Array.from(new Map(members.map(m => [m.id, m])).values())
  }, [me, selectedGroup, selectedProfile, profileById, user.id])

  // ── calendar wiring ─────────────────────────────────────────────────
  const { events: allCalEvents, addEvents: calAddEvents, deleteEvent: calDeleteEvent, updateEvent: calUpdateEvent } = useCalendarEvents(supabase, user.id)
  const { categories: calCategories, ensureCategory: calEnsureCategory, renameCategory: calRenameCategory, deleteCategory: calDeleteCategory } = useEventCategories(supabase, user.id)

  // The calendar TAB shows only this conversation's events; MY schedule
  // (everything RLS lets me see) lives on the home pane + "my calendar".
  const convCalEvents = useMemo(
    () => allCalEvents.filter(e => e.conversation_id != null && e.conversation_id === activeConvId),
    [allCalEvents, activeConvId],
  )
  const convUpcomingCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return convCalEvents.filter(e => new Date(e.starts_at) >= today).length
  }, [convCalEvents])

  // ── notes wiring — list lives up here so the tab can badge count ────
  const { notes, loaded: notesLoaded, refresh: refreshNotes } = useConversationNotes(supabase, activeConvId ?? null)

  const groupTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groupConversations) m.set(g.conversationId, g.title || 'Group')
    if (activeConvId && headerTitle && !m.has(activeConvId)) m.set(activeConvId, headerTitle)
    return m
  }, [groupConversations, activeConvId, headerTitle])

  const saveChatEvents = useCallback(async (list: NewCalendarEvent[]): Promise<CalendarEvent[]> => {
    const withMeta = await Promise.all(list.map(async e => ({
      ...e,
      category_color: await calEnsureCategory(e.category),
      conversation_id: activeConvId ?? null,
    })))
    return calAddEvents(withMeta)
  }, [calEnsureCategory, calAddEvents, activeConvId])

  // Unscoped personal events — the home prompt's schedule lane.
  const saveMyEvents = useCallback(async (text: string): Promise<CalendarEvent[]> => {
    const parsed = await parseSchedule(supabase, text)
    const withMeta = await Promise.all(parsed.map(async e => ({
      ...e,
      category_color: await calEnsureCategory(e.category),
      conversation_id: null,
    })))
    return calAddEvents(withMeta)
  }, [supabase, calEnsureCategory, calAddEvents])

  // ── home todos ──────────────────────────────────────────────────────
  const { todos, add: addTodo, toggle: toggleTodo, clearDone: clearDoneTodos } = useTodos(supabase, user.id)

  // The home prompt takes both lanes: schedule-looking text goes down
  // the existing parse→calendar path; anything else lands in todos.
  const saveHomePrompt = useCallback(async (text: string): Promise<CalendarEvent[]> => {
    if (looksLikeSchedule(text)) return saveMyEvents(text)
    await addTodo(text)
    return []
  }, [saveMyEvents, addTodo])

  // ── shared now-playing engine ───────────────────────────────────────
  // ONE <audio> for the whole shell (the web ChatThread pattern): the
  // chat's audio cards are remote controls for it via AudioEngineContext,
  // and the docked bar above the input owns precise scrubbing. Playback
  // survives tab/room switches until closed.
  const npAudioRef = useRef<HTMLAudioElement>(null)
  const npTrackRef = useRef<{ url: string; name: string } | null>(null)
  // Seek requested before the new track's metadata is ready — applied
  // in onLoadedMetadata (Safari ignores currentTime until then).
  const npPendingSeekRef = useRef<number | null>(null)
  const [npTrack, setNpTrack] = useState<{ url: string; name: string } | null>(null)
  const [npPlaying, setNpPlaying] = useState(false)
  const [npCur, setNpCur] = useState(0)
  const [npDur, setNpDur] = useState(0)

  const npStart = useCallback((t: { url: string; name: string }, at = 0) => {
    const a = npAudioRef.current
    if (!a) return
    if (npTrackRef.current?.url !== t.url) {
      npTrackRef.current = t
      setNpTrack(t); setNpCur(at); setNpDur(0)
      a.src = t.url
      npPendingSeekRef.current = at > 0 ? at : null
    } else {
      a.currentTime = at
      setNpCur(at)
    }
    a.play().then(() => setNpPlaying(true)).catch(() => {})
  }, [])
  const npToggle = useCallback(() => {
    const a = npAudioRef.current
    if (!a || !npTrackRef.current) return
    if (a.paused) a.play().then(() => setNpPlaying(true)).catch(() => {})
    else { a.pause(); setNpPlaying(false) }
  }, [])
  const npSeekTo = useCallback((sec: number) => {
    const a = npAudioRef.current
    if (!a) return
    a.currentTime = sec
    setNpCur(sec)
  }, [])
  const npClose = useCallback(() => {
    const a = npAudioRef.current
    a?.pause()
    if (a) a.removeAttribute('src')
    npTrackRef.current = null
    npPendingSeekRef.current = null
    setNpTrack(null); setNpPlaying(false); setNpCur(0); setNpDur(0)
  }, [])

  const audioEngine = useMemo<ExternalAudioEngine>(() => ({
    activeUrl: npTrack?.url ?? null,
    playing: npPlaying,
    current: npCur,
    duration: npDur,
    start: npStart,
    toggle: npToggle,
    seekTo: npSeekTo,
  }), [npTrack, npPlaying, npCur, npDur, npStart, npToggle, npSeekTo])

  // ── input bar + uploads ─────────────────────────────────────────────
  const [draft, setDraft] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<{ id: string; name: string; progress: number }[]>([])

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

  // ChatView's R2 upload flow: presign → XHR PUT (for onprogress) → send.
  const MAX_SIZE = 1000 * 1024 * 1024
  const uploadFile = useCallback(async (file: File, type: 'audio' | 'image'):
    Promise<{ url: string; type: 'audio' | 'image'; name: string } | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const contentType = file.type || 'application/octet-stream'
    const pid = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setUploads(prev => [...prev, { id: pid, name: file.name, progress: 0 }])
    const drop = () => setUploads(prev => prev.filter(u => u.id !== pid))
    try {
      const presignRes = await fetch('/api/r2-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // scope temp = 7-day expiring key; chat attachments only
        body: JSON.stringify({ ext, contentType, userId: user.id, scope: 'temp' }),
      })
      if (!presignRes.ok) {
        console.error('[studio upload] presign failed:', presignRes.status, await presignRes.text())
        drop(); return null
      }
      const { uploadUrl, publicUrl } = await presignRes.json() as { uploadUrl: string; publicUrl: string }
      const ok = await new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', contentType)
        let lastUpdate = 0   // throttle to ~10fps for older WebKits
        xhr.upload.onprogress = e => {
          if (!e.lengthComputable) return
          const now = performance.now()
          if (now - lastUpdate < 100 && e.loaded < e.total) return
          lastUpdate = now
          const progress = Math.min(0.99, e.loaded / e.total)
          setUploads(prev => prev.map(u => u.id === pid ? { ...u, progress } : u))
        }
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
        xhr.onerror = () => { console.error('[studio upload] R2 PUT network error'); resolve(false) }
        xhr.send(file)
      })
      drop()
      return ok ? { url: publicUrl, type, name: file.name } : null
    } catch (e) {
      console.error('[studio upload] error:', e)
      drop(); return null
    }
  }, [user.id])

  const onFilesPicked = useCallback(async (list: FileList | File[] | null) => {
    if (!list || list.length === 0) return
    const AUDIO_EXTS = new Set(['mp3', 'wav', 'aif', 'aiff', 'm4a', 'ogg', 'flac', 'caf', 'opus', 'aac'])
    const typed = Array.from(list)
      .map(f => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
        const type = f.type.startsWith('image/') ? 'image' as const
          : (f.type.startsWith('audio/') || AUDIO_EXTS.has(ext)) ? 'audio' as const
          : null
        return { f, type }
      })
      .filter((x): x is { f: File; type: 'audio' | 'image' } => x.type !== null && x.f.size <= MAX_SIZE)
    if (typed.length === 0) return

    // Several audio files at once → one multi-track message (ChatView parity).
    const audios = typed.filter(t => t.type === 'audio')
    if (audios.length > 1 && audios.length === typed.length) {
      const uploaded: { url: string; name: string }[] = []
      for (const t of audios) {
        const a = await uploadFile(t.f, 'audio')
        if (a) uploaded.push({ url: a.url, name: a.name })
      }
      if (uploaded.length === 1) await send('', { url: uploaded[0].url, type: 'audio', name: uploaded[0].name })
      else if (uploaded.length > 1) await send('', { url: JSON.stringify(uploaded), type: 'multi-audio', name: `${uploaded.length} Tracks` })
      return
    }
    for (const t of typed) {
      const a = await uploadFile(t.f, t.type)
      if (a) await send('', a)
    }
  }, [uploadFile, send, MAX_SIZE])

  // ── DAW drag-and-drop → main pane ───────────────────────────────────
  // Two entry paths, mirroring ChatView/CollabPage:
  //  · HTML5 dataTransfer drops (Finder etc.) on the .wd-main handlers
  //  · the native DragMonitor bridge — DragMonitor.mm / PluginEditor.cpp
  //    evaluateJavaScript window CustomEvents into the WKWebView:
  //    __juceDragEnter[Cancel] / __juceDragExit / __juceDragComplete for
  //    the overlay, then __juceDropGroupStart{count} + N × __juceFileDrop
  //    {name, data(base64)} for the files themselves.
  // Routing: files tab open → StemPanel via pendingStemDrop; any other
  // tab with a conversation open → chat attachment (the + button path).
  const [dragOver, setDragOver] = useState(false)
  const [dragKind, setDragKind] = useState<'attach' | 'cancel'>('attach')
  const [pendingStemDrop, setPendingStemDrop] = useState<StemDropRequest | null>(null)
  const dragCounter = useRef(0)
  const juceDragActive = useRef(false)      // C++ owns the overlay while true
  const isCancelDrag = useRef(false)        // own drag-out returning → don't attach
  const outDragActive = useRef(false)       // an AudioAttachment drag-out is live
  const outDragArmedUrl = useRef<string | null>(null)
  const outDragCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropBuffer = useRef<{ name: string; data: string }[]>([])
  const dropGroupCount = useRef(1)
  const dropTimelineRef = useRef<ReturnType<typeof getDawTimelineSnapshot>>(null)
  const dropTimelinePromiseRef = useRef<Promise<ReturnType<typeof getDawTimelineSnapshot>> | null>(null)

  // Keep the DAW playhead/tempo snapshot warm (ChatView does the same).
  useEffect(() => { initAudioTimelineTracking() }, [])

  // Live values for the mount-once native listeners.
  const tabRef = useRef(tab); tabRef.current = tab
  const activeConvIdRef = useRef(activeConvId); activeConvIdRef.current = activeConvId
  const onFilesPickedRef = useRef(onFilesPicked); onFilesPickedRef.current = onFilesPicked

  // A new conversation invalidates a stale routed drop.
  useEffect(() => { setPendingStemDrop(null) }, [activeConvId])

  const consumeStemDrop = useCallback((id: string) => {
    setPendingStemDrop(current => current?.id === id ? null : current)
  }, [])

  // __juceDragEnter / __juceDragEnterCancel — C++ heartbeats (~100 ms)
  // while a native drag hovers the WKWebView.
  useEffect(() => {
    const onEnter = () => {
      if (!activeConvIdRef.current) return
      juceDragActive.current = true
      if (outDragActive.current) { isCancelDrag.current = true; setDragKind('cancel') }
      else { isCancelDrag.current = false; setDragKind('attach') }
      dragCounter.current = 1
      setDragOver(true)
    }
    const onEnterCancel = () => {
      if (!activeConvIdRef.current) return
      juceDragActive.current = true
      isCancelDrag.current = true
      setDragKind('cancel')
      dragCounter.current = 1
      setDragOver(true)
    }
    const onLeave = () => {
      juceDragActive.current = false
      isCancelDrag.current = false
      dragCounter.current = 0
      setDragOver(false)
    }
    window.addEventListener('__juceDragEnter', onEnter)
    window.addEventListener('__juceDragEnterCancel', onEnterCancel)
    window.addEventListener('__juceDragExit', onLeave)
    window.addEventListener('__juceDragComplete', onLeave)
    return () => {
      window.removeEventListener('__juceDragEnter', onEnter)
      window.removeEventListener('__juceDragEnterCancel', onEnterCancel)
      window.removeEventListener('__juceDragExit', onLeave)
      window.removeEventListener('__juceDragComplete', onLeave)
    }
  }, [])

  // __juceDropGroupStart — C++ announces how many __juceFileDrop events
  // follow, so a multi-region drag lands as ONE grouped message.
  useEffect(() => {
    const handler = (e: Event) => {
      dropGroupCount.current = (e as CustomEvent<{ count: number }>).detail?.count ?? 1
      dropBuffer.current = []
      // Freeze host context at the drop, before slow async exports.
      dropTimelineRef.current = getDawTimelineSnapshot()
      dropTimelinePromiseRef.current = refreshDawTimelineSnapshot()
    }
    window.addEventListener('__juceDropGroupStart', handler)
    return () => window.removeEventListener('__juceDropGroupStart', handler)
  }, [])

  // __juceFileDrop — one resolved base64 file per event.
  useEffect(() => {
    const handler = (e: Event) => {
      if (outDragActive.current) return
      const { name, data } = (e as CustomEvent<{ name: string; data: string }>).detail
      dropBuffer.current.push({ name, data })
      if (dropBuffer.current.length < dropGroupCount.current) return

      const batch = dropBuffer.current
      dropBuffer.current = []
      dropGroupCount.current = 1
      if (!activeConvIdRef.current) return

      void (async () => {
        const fresh = await (dropTimelinePromiseRef.current ?? refreshDawTimelineSnapshot())
        const fallback = fresh ?? dropTimelineRef.current
        dropTimelineRef.current = null
        dropTimelinePromiseRef.current = null
        if (tabRef.current === 'stems') {
          setPendingStemDrop({
            id: `native-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            nativeFiles: batch,
            fallbackMetadata: fallback,
          })
          return
        }
        await onFilesPickedRef.current(batch.map(f => nativeToFile(f.name, f.data)))
      })()
    }
    window.addEventListener('__juceFileDrop', handler)
    return () => window.removeEventListener('__juceFileDrop', handler)
  }, [])

  // Own drag-OUT tracking (AudioAttachment → DAW). Without this, a
  // drag that comes straight back would read as a new attach drop.
  useEffect(() => {
    const onArmed = (e: Event) => {
      outDragActive.current = true
      outDragArmedUrl.current = (e as CustomEvent<{ url: string }>).detail?.url ?? null
    }
    const onStart = () => { outDragActive.current = true }
    const onEnd = (e: Event) => {
      const op = (e as CustomEvent<{ op: string }>).detail?.op ?? 'none'
      const armedUrl = outDragArmedUrl.current
      isCancelDrag.current = false
      dragCounter.current = 0
      setDragOver(false)
      if (op === 'none') {
        outDragActive.current = false
        outDragArmedUrl.current = null
        if (outDragCooldownTimer.current) { clearTimeout(outDragCooldownTimer.current); outDragCooldownTimer.current = null }
        if (armedUrl) window.dispatchEvent(new CustomEvent('__juceOutDragCancel', { detail: { url: armedUrl } }))
      } else {
        // Accepted by the DAW — it may bounce our own audio back as a new
        // NSDraggingSession, so stay "out" for 30 s (ChatView parity).
        if (armedUrl) window.dispatchEvent(new CustomEvent('__juceImported', { detail: { url: armedUrl } }))
        if (outDragCooldownTimer.current) clearTimeout(outDragCooldownTimer.current)
        outDragCooldownTimer.current = setTimeout(() => {
          outDragActive.current = false
          outDragArmedUrl.current = null
          outDragCooldownTimer.current = null
        }, 30_000)
      }
    }
    window.addEventListener('__localDragArmed', onArmed)
    window.addEventListener('__juceOutDragStart', onStart)
    window.addEventListener('__juceOutDragEnd', onEnd)
    return () => {
      window.removeEventListener('__localDragArmed', onArmed)
      window.removeEventListener('__juceOutDragStart', onStart)
      window.removeEventListener('__juceOutDragEnd', onEnd)
    }
  }, [])

  // HTML5 dataTransfer path — Finder drops and browser-dev drags.
  const handleMainDragEnter = useCallback((e: ReactDragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    dragCounter.current++
    if (!activeConvId) return
    if (!juceDragActive.current) {
      if (outDragActive.current) { isCancelDrag.current = true; setDragKind('cancel') }
      else { isCancelDrag.current = false; setDragKind('attach') }
    }
    setDragOver(true)
  }, [activeConvId])

  const handleMainDragOver = useCallback((e: ReactDragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
  }, [])

  const handleMainDragLeave = useCallback((e: ReactDragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    // C++ owns exit timing while a native drag runs (JS dragleave is
    // unreliable for NSFilePromise drags — relatedTarget is null).
    if (juceDragActive.current) return
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    dragCounter.current = 0
    setDragOver(false)
  }, [])

  const handleMainDrop = useCallback((e: ReactDragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    dragCounter.current = 0
    const wasCancel = isCancelDrag.current
    isCancelDrag.current = false
    juceDragActive.current = false
    setDragOver(false)

    if (!activeConvId) return
    if (wasCancel || outDragActive.current) return

    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length === 0) return

    if (tab === 'stems') {
      // StemPanel's own drop zone already handled anything released over
      // it (the event bubbles up here afterwards) — don't double-upload.
      if ((e.target as HTMLElement | null)?.closest?.('.stem-panel')) return
      const audio = files.filter(isAudioFile)
      const rest = files.filter(f => !isAudioFile(f))
      if (audio.length > 0) {
        void (async () => {
          const fresh = await refreshDawTimelineSnapshot()
          setPendingStemDrop({
            id: `files-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            files: audio,
            fallbackMetadata: fresh ?? getDawTimelineSnapshot(),
          })
        })()
      }
      if (rest.length > 0) void onFilesPicked(rest)  // images still go to chat
      return
    }

    void onFilesPicked(files)
  }, [activeConvId, tab, onFilesPicked])

  // Chat scroll — jump to the bottom whenever a conversation (re)opens;
  // after that, new messages re-pin the view only while the reader is
  // already near the bottom (<120px). Scrolled up = reading history —
  // leave them exactly where they are.
  const NEAR_BOTTOM_PX = 120
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)          // near-bottom as of the last scroll event
  const chatKeyRef = useRef('')          // which conversation the pane last showed
  useEffect(() => {
    const el = chatScrollRef.current
    if (tab !== 'chat' || !el) { chatKeyRef.current = ''; return }
    const key = JSON.stringify(sel)
    const opened = chatKeyRef.current !== key
    chatKeyRef.current = key
    if (opened || stickRef.current) {
      el.scrollTop = el.scrollHeight
      stickRef.current = true
    }
  }, [messages, messagesLoading, tab, sel])
  // Track the reader's position, and keep the view pinned while
  // late-loading content (images, link-preview cards) grows the list —
  // but only when they were already at the bottom.
  useEffect(() => {
    const el = chatScrollRef.current
    if (tab !== 'chat' || !el) return
    const onScroll = () => {
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect() }
  }, [messages, messagesLoading, tab, sel])

  const openSel = useCallback((next: Sel) => {
    setSel(next)
    setTab('chat')
    if (next.kind === 'me') return
    const cid = next.kind === 'group'
      ? next.conversationId
      : dmConvByPartner.get(next.userId)?.conversationId
    if (cid) markSeen(cid)
  }, [dmConvByPartner, markSeen])

  const isSel = (s: Sel) => !!sel && (
    (sel.kind === 'dm' && s.kind === 'dm' && sel.userId === s.userId)
    || (sel.kind === 'group' && s.kind === 'group' && sel.conversationId === s.conversationId)
    || (sel.kind === 'me' && s.kind === 'me')
  )

  // Read receipts, iMessage-style (ported from ChatView): each reader is
  // anchored to the LATEST of my messages their last_seen_at covers.
  const readersByMsgId = useMemo(() => {
    const map = new Map<string, Profile[]>()
    if (reads.size === 0) return map
    const candidates: Profile[] = selectedGroup
      ? selectedGroup.memberIds
          .filter(id => id !== user.id)
          .map(id => profileById.get(id))
          .filter((p): p is Profile & { isOnline: boolean } => !!p)
      : selectedProfile ? [selectedProfile] : []
    const mine = messages.filter(m => m.sender_id === user.id)
    for (const reader of candidates) {
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
  }, [reads, messages, selectedGroup, selectedProfile, profileById, user.id])

  // ── messenger rows (kakao/imessage grammar) ─────────────────────────
  // Calendar-chip verdicts survive reloads (ChatView parity) — a message
  // already saved (or waved off) doesn't re-offer its chip forever.
  const [chipDone, setChipDone] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('orb_cal_chip_done') ?? '[]') as string[]) }
    catch { return new Set() }
  })
  const markChipDone = useCallback((msgId: string) => {
    setChipDone(prev => {
      const next = new Set(prev)
      next.add(msgId)
      try { localStorage.setItem('orb_cal_chip_done', JSON.stringify([...next].slice(-200))) } catch { /* full/blocked */ }
      return next
    })
  }, [])

  const chatRows = useMemo(() => {
    const rows: ReactNode[] = []
    const isGroup = !!selectedGroup
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]!
      const prev = i > 0 ? messages[i - 1]! : null
      const next = i < messages.length - 1 ? messages[i + 1]! : null
      const t = new Date(m.created_at).getTime()
      const dk = dayKey(m.created_at)
      const newDay = !prev || dayKey(prev.created_at) !== dk
      // Burst = consecutive same-sender messages under 4 minutes apart.
      const first = newDay || prev!.sender_id !== m.sender_id
        || t - new Date(prev!.created_at).getTime() > BURST_MS
      const lastInBurst = !next || dayKey(next.created_at) !== dk
        || next.sender_id !== m.sender_id
        || new Date(next.created_at).getTime() - t > BURST_MS
      const isMine = m.sender_id === user.id
      const senderP = isMine ? undefined : profileById.get(m.sender_id)

      if (newDay) {
        rows.push(<div key={`day-${dk}`} className="wd-day">{dayLabel(m.created_at)}</div>)
      }

      // Bubble-like pieces, attachment first then text (ChatView's paint
      // order). The tail notch sits on the burst's first piece; the
      // outside timestamp rides the burst's last piece.
      const pieces: ReactNode[] = []
      const tailCls = () => (first && pieces.length === 0 ? ' tail' : '')
      if (m.attachment_type === 'game_invite') {
        pieces.push(
          <div key="att" className="wd-file">
            <i>◳</i><span>game invite</span><small>{m.attachment_name ?? ''}</small>
          </div>,
        )
      } else if (m.attachment_type) {
        if (m.attachment_expired) {
          pieces.push(<div key="att" className="wd-expired">file expired (7 days)</div>)
        } else if (m.attachment_url) {
          const url = m.attachment_url
          const name = m.attachment_name ?? 'file'
          if (m.attachment_type === 'image') {
            pieces.push(
              <img key="att" className={`wd-img${tailCls()}`} src={url} alt={name}
                onClick={() => { void openExternalUrl(url) }} />,
            )
          } else if (m.attachment_type === 'video') {
            pieces.push(
              <video key="att" className={`wd-vid${tailCls()}`} src={url} controls preload="metadata" />,
            )
          } else if (m.attachment_type === 'audio') {
            pieces.push(
              <StudioAudioCard key="att" tracks={[{ url, name, metadata: m.attachment_metadata ?? undefined }]} />,
            )
          } else if (m.attachment_type === 'multi-audio') {
            let tracks: { url: string; name: string }[] = []
            try { tracks = JSON.parse(url) } catch { /* fall through to chip */ }
            pieces.push(tracks.length > 0
              ? <StudioAudioCard key="att" tracks={tracks} />
              : <div key="att" className="wd-file"><i>♪</i><span>{name}</span></div>)
          } else {
            pieces.push(<div key="att" className="wd-file"><i>▤</i><span>{name}</span></div>)
          }
        }
      }
      if (m.content) {
        pieces.push(
          <div key="txt" className={`wd-bub${tailCls()}`}>{linkify(m.content)}</div>,
        )
      }
      if (pieces.length === 0) continue

      const previewUrl = m.content ? firstUrl(m.content) : null
      const readers = isMine ? readersByMsgId.get(m.id) : undefined
      const time = fmtTime(m.created_at)
      // Audio cards get a wide column — the text-bubble cap doesn't apply.
      const wideAudio = (m.attachment_type === 'audio' || m.attachment_type === 'multi-audio')
        && !m.attachment_expired && !!m.attachment_url

      rows.push(
        <div key={m.id} className={`wd-mrow${isMine ? ' mine' : ' theirs'}${first ? ' first' : ''}`}>
          {!isMine && (
            <div className="wd-mav">
              {first && (
                <span style={{ background: senderP?.avatar_color ?? '#C0BCB3' }}>
                  {senderP?.avatar_url
                    ? <img src={senderP.avatar_url} alt="" />
                    : (senderP?.initials ?? '').slice(0, 1)}
                </span>
              )}
            </div>
          )}
          <div className={`wd-mcol${wideAudio ? ' wide' : ''}`}>
            {!isMine && first && isGroup && (
              <div className="wd-mname">{senderP?.display_name ?? '…'}</div>
            )}
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
            {previewUrl && <div className="wd-linkcard"><LinkPreviewCard url={previewUrl} /></div>}
            {m.content && activeConvId && !chipDone.has(m.id) && looksLikeSchedule(m.content) && (
              <div className="wd-chip">
                <ScheduleChip
                  text={m.content}
                  onParse={(text) => parseSchedule(supabase, text)}
                  onSave={async evs => { await saveChatEvents(evs) }}
                  onDone={() => markChipDone(m.id)}
                />
              </div>
            )}
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
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12.5l5 5L20 6.5" />
                    </svg>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
      )
    }
    return rows
  }, [messages, user.id, profileById, readersByMsgId, selectedGroup, chipDone,
    activeConvId, supabase, saveChatEvents, markChipDone])

  const myName = me?.display_name ?? user.email?.split('@')[0] ?? 'me'
  const nameOf = useCallback((id: string | null): string => {
    if (!id) return '—'
    if (id === user.id) return myName
    return profileById.get(id)?.display_name ?? '—'
  }, [user.id, myName, profileById])

  const greeting = useMemo(() => {
    const h = new Date(nowTick).getHours()
    return h < 5 ? 'working late' : h < 12 ? 'good morning' : h < 18 ? 'good afternoon' : 'good evening'
  }, [nowTick])

  return (
    <div className="wd-stage">
      <div className="wd">

        {/* ── rail ─────────────────────────────────────────────── */}
        <div className="wd-rail">
          <div className="wd-brand"><BrandMark />orb</div>
          <div className="wd-rail-scroll">
            <div className="wd-sec">projects</div>
            {groupConversations.map(g => {
              const s: Sel = { kind: 'group', conversationId: g.conversationId }
              const unread = convUnread.get(g.conversationId) ?? 0
              const last = convLastMessages.get(g.conversationId) ?? g.lastMessage
              const senderName = last && last.sender_id !== user.id
                ? profileById.get(last.sender_id)?.display_name
                : (last ? myName : undefined)
              return (
                <div key={g.conversationId} className={`wd-row${isSel(s) ? ' on' : ''}`} onClick={() => openSel(s)}>
                  <Avatar group color={groupColorByConv.get(g.conversationId) ?? '#4A8FE7'} label={(g.title || 'G').slice(0, 1)} />
                  <span className="wd-rname">
                    <b>{g.title || 'Unnamed group'}</b>
                    <span>{last ? snippet(last, senderName) : `${g.memberIds.length} members`}</span>
                  </span>
                  {unread > 0 && <span className="wd-badge">{unread}</span>}
                </div>
              )
            })}
            {groupConversations.length === 0 && (
              <div className="wd-row" style={{ cursor: 'default' }}>
                <span className="wd-rname"><span>no projects yet</span></span>
              </div>
            )}
            <div className="wd-sec">people</div>
            {friendProfiles.map(p => {
              const s: Sel = { kind: 'dm', userId: p.id }
              const conv = dmConvByPartner.get(p.id)
              const unread = conv ? (convUnread.get(conv.conversationId) ?? 0) : 0
              const last = conv ? (convLastMessages.get(conv.conversationId) ?? conv.lastMessage) : null
              const since = studioAt.get(p.id)
              return (
                <div key={p.id} className={`wd-row${isSel(s) ? ' on' : ''}`} onClick={() => openSel(s)}>
                  <Avatar color={p.avatar_color} label={p.initials.slice(0, 1)} avatarUrl={p.avatar_url}
                    dot={since !== undefined ? 'studio' : p.isOnline ? 'on' : undefined} />
                  <span className="wd-rname">
                    <b>{p.display_name}</b>
                    {since !== undefined
                      ? <span className="studio">{`in the studio${studioFor(since, nowTick)}`}</span>
                      : <span>{last ? snippet(last, last.sender_id === user.id ? 'you' : undefined) : (p.isOnline ? 'online' : 'offline')}</span>}
                  </span>
                  {unread > 0 && <span className="wd-badge">{unread}</span>}
                </div>
              )
            })}
            {friendProfiles.length === 0 && !profilesLoading && (
              <div className="wd-row" style={{ cursor: 'default' }}>
                <span className="wd-rname"><span>follow someone to start</span></span>
              </div>
            )}
          </div>
          <div className={`wd-rail-foot${sel?.kind === 'me' ? ' on' : ''}`} onClick={() => openSel({ kind: 'me' })}>
            <Avatar color={me?.avatar_color ?? '#1A1917'} label={(me?.initials ?? myName).slice(0, 1)}
              avatarUrl={me?.avatar_url} dot="studio" />
            <span>{myName}</span>
          </div>
        </div>

        {/* ── main ─────────────────────────────────────────────── */}
        <div
          className="wd-main"
          onDragEnter={handleMainDragEnter}
          onDragOver={handleMainDragOver}
          onDragLeave={handleMainDragLeave}
          onDrop={handleMainDrop}
        >
          {/* The shared now-playing engine's one <audio> — always mounted
              so playback survives tab and room switches. */}
          <audio
            ref={npAudioRef}
            preload="metadata"
            onTimeUpdate={() => setNpCur(npAudioRef.current?.currentTime ?? 0)}
            onLoadedMetadata={() => {
              const a = npAudioRef.current
              if (!a) return
              setNpDur(a.duration ?? 0)
              if (npPendingSeekRef.current != null) {
                a.currentTime = npPendingSeekRef.current
                setNpCur(npPendingSeekRef.current)
                npPendingSeekRef.current = null
              }
            }}
            onEnded={() => { setNpPlaying(false); setNpCur(0) }}
          />
          {dragOver && activeConvId && sel && sel.kind !== 'me' && (
            <div className={`wd-drop${dragKind === 'cancel' ? ' cancel' : ''}`}>
              <div className="wd-drop-card">
                <span className="wd-drop-glyph">{dragKind === 'cancel' ? '×' : '↓'}</span>
                <span className="wd-drop-label">
                  {dragKind === 'cancel' ? 'release to cancel' : 'drop to attach'}
                </span>
                <span className="wd-drop-fine">
                  {dragKind === 'cancel'
                    ? 'the file stays where it was'
                    : tab === 'stems' ? 'adds to this project’s files' : `sends to ${headerTitle || 'this chat'}`}
                </span>
              </div>
            </div>
          )}
          {sel?.kind === 'me' ? (
            /* my calendar — the personal programme, fuller. The prompt
               lives on the home pane now. */
            <>
              <div className="wd-head plain">
                <div className="wd-title">{myName}</div>
                <div className="wd-sub">my calendar</div>
              </div>
              <div className="wd-me">
                <div className="wd-me-scroll">
                  <UpcomingRows events={allCalEvents} groupTitleById={groupTitleById} limit={30} nowTick={nowTick} />
                </div>
              </div>
            </>
          ) : sel ? (
            <>
              <div className="wd-head">
                <div className="wd-head-row">
                  {selectedGroup ? (
                    <span className="wd-hav grp"
                      style={{ background: groupColorByConv.get(selectedGroup.conversationId) ?? '#4A8FE7' }}>
                      {selectedGroup.avatarUrl
                        ? <img src={selectedGroup.avatarUrl} alt="" />
                        : (selectedGroup.title || 'G').slice(0, 1)}
                    </span>
                  ) : selectedProfile ? (
                    <span className="wd-hav" style={{ background: selectedProfile.avatar_color }}>
                      {selectedProfile.avatar_url
                        ? <img src={selectedProfile.avatar_url} alt="" />
                        : selectedProfile.initials.slice(0, 1)}
                    </span>
                  ) : null}
                  <div className="wd-head-col">
                    {titleEdit !== null && selectedGroup ? (
                      <input
                        className="wd-htitle-input"
                        value={titleEdit}
                        autoFocus
                        spellCheck={false}
                        onChange={e => setTitleEdit(e.target.value)}
                        onBlur={() => void commitTitle()}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void commitTitle() }
                          else if (e.key === 'Escape') setTitleEdit(null)
                        }}
                      />
                    ) : (
                      <div
                        className="wd-htitle"
                        onDoubleClick={selectedGroup ? () => setTitleEdit(headerTitle) : undefined}
                      >
                        {headerTitle}
                      </div>
                    )}
                    <div className="wd-hsub">{headerSub}</div>
                  </div>
                </div>
                <div className="wd-tabs">
                  <span className={`wd-tab${tab === 'chat' ? ' on' : ''}`} onClick={() => setTab('chat')}>chat</span>
                  <span className={`wd-tab${tab === 'stems' ? ' on' : ''}`} onClick={() => activeConvId && setTab('stems')}>files</span>
                  <span className={`wd-tab${tab === 'calendar' ? ' on' : ''}`} onClick={() => activeConvId && setTab('calendar')}>
                    calendar{convUpcomingCount > 0 && <i>{convUpcomingCount}</i>}
                  </span>
                  <span className={`wd-tab${tab === 'notes' ? ' on' : ''}`} onClick={() => activeConvId && setTab('notes')}>
                    notes{notes.length > 0 && <i>{notes.length}</i>}
                  </span>
                </div>
              </div>

              {tab === 'chat' && (
                <AudioEngineContext.Provider value={audioEngine}>
                  <div className="wd-chat" ref={chatScrollRef}>
                    {messagesLoading
                      ? <div className="wd-quiet">…</div>
                      : chatRows.length > 0
                        ? <div className="wd-chat-col">{chatRows}</div>
                        : <div className="wd-quiet">no messages yet — say hi</div>}
                  </div>
                  {uploads.length > 0 && (
                    <div className="wd-upcards">
                      {uploads.map(u => (
                        <div key={u.id} className="wd-upcard">
                          <div className="wd-upcard-name">{u.name}</div>
                          <div className="wd-upcard-row">
                            <div className="wd-upcard-track">
                              <div className="wd-upcard-fill" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                            </div>
                            <span className="wd-upcard-pct">{Math.round(u.progress * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {npTrack && (
                    <StudioNowBar
                      url={npTrack.url}
                      name={npTrack.name}
                      playing={npPlaying}
                      cur={npCur}
                      dur={npDur}
                      onToggle={npToggle}
                      onSeek={npSeekTo}
                      onClose={npClose}
                    />
                  )}
                  <div className="wd-input">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="audio/*,image/*,.wav,.aif,.aiff,.m4a,.ogg,.flac,.caf,.opus,.aac,.mp3"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => { void onFilesPicked(e.target.files); if (e.target) e.target.value = '' }}
                    />
                    <button className="wd-attach" onClick={() => fileRef.current?.click()} aria-label="attach a file">+</button>
                    <textarea
                      ref={taRef}
                      rows={1}
                      value={draft}
                      placeholder={`message ${headerTitle}…`}
                      onChange={e => { setDraft(e.target.value); growTa() }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault()
                          void handleSend()
                        }
                      }}
                    />
                    <button className="wd-send" disabled={!draft.trim()} onClick={() => void handleSend()}>→</button>
                  </div>
                </AudioEngineContext.Provider>
              )}

              {tab === 'stems' && (
                <div className="wd-pane">
                  {activeConvId ? (
                    <StemPanel
                      supabase={supabase}
                      conversationId={activeConvId}
                      currentUserId={user.id}
                      participants={stemParticipants}
                      pendingDrop={pendingStemDrop}
                      onDropConsumed={consumeStemDrop}
                    />
                  ) : <div className="wd-quiet">loading…</div>}
                </div>
              )}

              {tab === 'calendar' && (
                <div className="wd-pane">
                  {activeConvId ? (
                    <ChatCalendar
                      currentUserId={user.id}
                      events={convCalEvents}
                      categories={calCategories}
                      groupTitleById={groupTitleById}
                      onDelete={(id) => { calDeleteEvent(id).catch(() => {}) }}
                      onSetCategory={async (id, name) => {
                        const color = await calEnsureCategory(name)
                        calUpdateEvent(id, { category: name || null, category_color: color }).catch(() => {})
                      }}
                      onUpdate={(id, patch) => { calUpdateEvent(id, patch).catch(() => {}) }}
                      onAddCategory={(name) => { calEnsureCategory(name).catch(() => {}) }}
                      onRenameCategory={(id, name) => { calRenameCategory(id, name).catch(() => {}) }}
                      onDeleteCategory={(id) => { calDeleteCategory(id).catch(() => {}) }}
                      onSubmitPrompt={async (text) => {
                        const parsed = await parseSchedule(supabase, text)
                        return saveChatEvents(parsed)
                      }}
                    />
                  ) : <div className="wd-quiet">loading…</div>}
                </div>
              )}

              {tab === 'notes' && (
                activeConvId
                  ? (
                    <StudioNotes
                      supabase={supabase}
                      conversationId={activeConvId}
                      userId={user.id}
                      nameOf={nameOf}
                      notes={notes}
                      loaded={notesLoaded}
                      refresh={refreshNotes}
                      nowTick={nowTick}
                    />
                  )
                  : <div className="wd-quiet">loading…</div>
              )}
            </>
          ) : (
            /* home — a quiet page: serif greeting, the prompt, today's
               tasks, then my programme. */
            <div className="wd-home">
              <div className="wd-home-greet">{greeting}, {myName}</div>
              <div className="wd-home-date">
                {new Date(nowTick).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase()}
              </div>
              <div className="wd-home-prompt">
                <SchedulePrompt
                  targets={[]}
                  placeholder="add a schedule, or something to do today…"
                  onSubmit={(text) => saveHomePrompt(text)}
                />
              </div>
              {todos.length > 0 && (
                <div className="wd-todos">
                  <div className="wd-todos-head">
                    <span>today</span>
                    {todos.some(t => t.done) && (
                      <button className="wd-todos-clear" onClick={() => void clearDoneTodos()}>clear done</button>
                    )}
                  </div>
                  {todos.slice(0, 10).map(t => (
                    <div key={t.id} className={`wd-todo${t.done ? ' done' : ''}`} onClick={() => void toggleTodo(t)}>
                      <span className="wd-todo-box">
                        {t.done && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12.5l5 5L20 6.5" />
                          </svg>
                        )}
                      </span>
                      <span className="wd-todo-text">{t.content}</span>
                    </div>
                  ))}
                </div>
              )}
              <UpcomingRows events={allCalEvents} groupTitleById={groupTitleById} limit={8} nowTick={nowTick} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
