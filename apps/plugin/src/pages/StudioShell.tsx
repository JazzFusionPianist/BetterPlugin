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
import { extractAudioTimeline, getDawTimelineSnapshot, getDropIngestionReports, initAudioTimelineTracking, refreshDawTimelineSnapshot, timelinePositionLabel } from '../lib/audioTimeline'
import { mergeDroppedRegions, mergeFailureText, resolveDawDrop } from '../lib/audioMerge'
import { buildZip } from '../lib/zipStore'
import { DAW_FILE_LIMIT, UPLOAD_FILE_LIMIT, ZIP_TOTAL_LIMIT, fmtBytes } from '../lib/limits'
import { resolveUrl, useResolvedUrl, invalidateResolved } from '../lib/r2Access'
import StemPanel from '../components/collab/StemPanel'
import SchedulePrompt from '../components/collab/SchedulePrompt'
import LinkPreviewCard from '../components/collab/LinkPreviewCard'
import { AudioAttachment, AudioEngineContext, ImportAllWord, ScheduleChip, looksLikeSchedule, type ExternalAudioEngine } from '../components/collab/ChatView'
import { LanguageProvider } from '../i18n/LanguageContext'
import type { AttachmentTimelineMetadata, ChatTarget, Message, Profile } from '../types/collab'
import type { StemDropRequest } from '../types/stems'
import ProfilePage from '../components/studio/ProfilePage'
import StudioCalendar from '../components/studio/StudioCalendar'
import SettingsPage, { APP_VERSION } from '../components/studio/SettingsPage'
import GamesPane, { SOLO_GAMES, useGameName, type GameScreen } from '../components/studio/GamesPane'
import type { GameId } from '../components/collab/GameListView'
import type { GameType, JoinResult } from '../lib/gameRooms'
import './studio.css'
import ExportTracksButton from '../components/collab/ExportTracksButton'
import { prepareTrackExport } from '../lib/dawTrackExport'

interface Props { supabase: SupabaseClient; user: User }

type Sel =
  | { kind: 'dm'; userId: string }
  | { kind: 'group'; conversationId: string }
  | { kind: 'me' }
  | { kind: 'profile'; userId: string }
  | { kind: 'settings' }

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

/** A multi-track drop (native DAW batch or Finder) held while the small
 *  chooser card asks how it should land — separately, merged, or (chat
 *  only) as one zip. Single files never wait here. */
interface PendingDropChoice {
  files: File[]                                    // the audio files (≥2)
  target: 'chat' | 'stems'
  fallback: AttachmentTimelineMetadata | null
}

/** "stems-250914-1732.zip" — the zip option's archive name. */
function zipName(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `stems-${p(d.getFullYear() % 100)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.zip`
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

/** Min gap between presigned-url recovery attempts for the same track —
 *  a real expiry recurs roughly hourly; anything faster is a loop. */
const NP_RETRY_WINDOW_MS = 60_000

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
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
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
  // Cache stays keyed on the stored PUBLIC url (stable identity); only the
  // actual fetch/probe uses the presigned url — works once R2 public
  // access is off. Pseudo-peaks seed from the public url for stability.
  // A 403 means the cached presigned url expired mid-session: invalidate,
  // re-resolve, retry the decode ONCE before falling to pseudo-peaks.
  const p = resolveUrl(url)
    .then(async resolved => {
      try {
        return await decodePeaks(resolved)
      } catch (e) {
        if ((e as { status?: number }).status === 403 && resolved !== url) {
          invalidateResolved(url)
          const fresh = await resolveUrl(url)
          if (fresh !== resolved) {
            try { return await decodePeaks(fresh) } catch { /* fall through */ }
          }
        }
        return { peaks: pseudoPeaks(url), duration: await probeDuration(resolved) }
      }
    })
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

/** The waveform IS the scrubber — and the plate's artwork: FINE print
 *  texture, 1.5px ink bars / 1px gap, min-height 2px, vertically
 *  centered on a DPR-aware canvas; the ~90 cached buckets are linearly
 *  resampled to however many bars the width holds. Unplayed bars
 *  rgba-ink .22, played .85; the boundary carries a 1.5px stage-green
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
    const BAR = 1.5, GAP = 1
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

/** Own-bubble delete — the house two-tap word ("delete" → "sure?"),
 *  riding the row's outer gutter. Reverts on its own after 2.6 s
 *  (OpenCallPanel's DeleteWord timing). */
function MsgDeleteWord({ onConfirm }: { onConfirm: () => void }) {
  const [arming, setArming] = useState(false)
  useEffect(() => {
    if (!arming) return
    const t = setTimeout(() => setArming(false), 2600)
    return () => clearTimeout(t)
  }, [arming])
  return (
    <button
      className={`wd-mdel${arming ? ' sure' : ''}`}
      onClick={() => { if (arming) { setArming(false); onConfirm() } else setArming(true) }}
    >
      {arming ? 'sure?' : 'delete'}
    </button>
  )
}

function PlayGlyph({ playing, size = 16 }: { playing: boolean; size?: number }) {
  return playing
    ? <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
    : <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}><path d="M8 5v14l11-7z" /></svg>
}

/* ── studio audio = printed plates ───────────────────────────────────
   An audio attachment renders as a PLATE from the exhibition
   catalogue — a framed figure (the waveform as the artwork) above an
   interior hairline rule and a caption row. The studio's OWN
   component replaces AudioAttachment's chrome, but the real
   AudioAttachment still mounts inside each plate (hidden by
   .wd-ac-import CSS, import button excepted), so the whole
   import-to-DAW machinery — prefetch → writeAudioFile → drag-out
   arming, __juceImported / cooldown handling — runs byte-for-byte
   unchanged. Playback is a remote control on the shared engine. */

interface StudioTrack { url: string; name: string; metadata?: AttachmentTimelineMetadata; from?: string }

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

/** One track = the full plate. The 52px fine-print waveform is the
 *  framed figure; under the full-width caption rule sits ONE baseline
 *  row — bare ink glyph · name (wraps) · elapsed/total · the
 *  underlined import word. All geometry lives in CSS. */
function StudioAudioPlate({ track }: { track: StudioTrack }) {
  const { peaks, active, playing, cur, total, toggle, seek } = useStudioTrack(track.url, track.name)
  const position = timelinePositionLabel(track.metadata)
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
          <span className="wd-plate-time" title={position?.tooltip}>
            {fmtDur(cur)} / {fmtDur(total)}{position != null ? ` / ${position.text}` : ''}
          </span>
          <span className="wd-ac-import">
            <AudioAttachment url={track.url} name={track.name} metadata={track.metadata} from={track.from} />
          </span>
        </span>
      </div>
    </div>
  )
}

/** One track inside a multi-audio plate: a caption-style row (glyph ·
 *  name · time · import word) over its own 24px fine waveform. */
function StudioPlateSection({ track }: { track: StudioTrack }) {
  const { peaks, active, playing, cur, total, toggle, seek } = useStudioTrack(track.url, track.name)
  const position = timelinePositionLabel(track.metadata)
  return (
    <div className="wd-plate-sec">
      <div className="wd-plate-secrow">
        <button className="wd-ac-play" onClick={toggle} aria-label={playing ? 'pause' : 'play'}>
          <PlayGlyph playing={playing} size={12} />
        </button>
        <span className="wd-plate-secname" title={track.name}>{track.name}</span>
        <span className="wd-plate-right">
          <span className="wd-plate-time" title={position?.tooltip}>
            {fmtDur(cur)} / {fmtDur(total)}{position != null ? ` / ${position.text}` : ''}
          </span>
          <span className="wd-ac-import">
            <AudioAttachment url={track.url} name={track.name} metadata={track.metadata} from={track.from} />
          </span>
        </span>
      </div>
      <div className="wd-plate-secwave">
        <StudioWaveform peaks={peaks} frac={total ? cur / total : 0} height={24} head={active} onSeek={seek} />
      </div>
    </div>
  )
}

/** Hidden drop-ingestion diagnostics — double-click the 'orb' wordmark.
 *  A plain paper sheet listing the last 10 ingestion reports (raw bext,
 *  every iXML tag, the drop-frozen snapshot, the computed absolute
 *  position + label) as pretty JSON, with copy-all, Esc to close.
 *  Exists so cycle-on/off × project-start scenarios can be RUN and the
 *  data pasted back — the export-reference rule gets codified from
 *  measurements, not more correction heuristics. */
function DropDiagnosticsOverlay({ onClose }: { onClose: () => void }) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const reports = useMemo(() => getDropIngestionReports(), [])
  const text = useMemo(
    () => reports.length === 0
      ? 'no drop ingestions recorded yet — drag audio in, then reopen.'
      : JSON.stringify(reports, null, 2),
    [reports],
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Fallback: select the text in a throwaway textarea.
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.focus()
      area.select()
      let ok = false
      try { ok = document.execCommand('copy') } catch { /* stay quiet */ }
      document.body.removeChild(area)
      if (ok) setCopied(true)
      else {
        // Last resort: leave the report selected for a manual ⌘C.
        const pre = preRef.current
        if (pre) {
          const range = document.createRange()
          range.selectNodeContents(pre)
          const sel = window.getSelection()
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      }
    }
  }, [text])
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,20,20,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(760px, calc(100vw - 64px))', height: 'min(560px, calc(100vh - 64px))',
          background: '#fbfaf7', color: '#1c1c1c', border: '1px solid #d8d4cc',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12,
          padding: '10px 14px', borderBottom: '1px solid #e4e0d8' }}>
          <span style={{ fontSize: 12, letterSpacing: '0.04em' }}>drop diagnostics — last {reports.length} ingestion{reports.length === 1 ? '' : 's'}</span>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => void copyAll()}
            style={{ font: 'inherit', fontSize: 12, background: 'none', border: 'none',
              cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, color: '#1c1c1c', padding: 0 }}
          >
            {copied ? 'copied' : 'copy all'}
          </button>
          <button
            onClick={onClose}
            style={{ font: 'inherit', fontSize: 12, background: 'none', border: 'none',
              cursor: 'pointer', color: '#1c1c1c', padding: 0 }}
            aria-label="close"
          >
            ✕
          </button>
        </div>
        <pre
          ref={preRef}
          style={{ flex: 1, margin: 0, padding: '12px 14px', overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
            lineHeight: 1.5, whiteSpace: 'pre', userSelect: 'text' }}
        >
          {text}
        </pre>
      </div>
    </div>
  )
}

/** Multi-plate top row — "N tracks", the summed duration, and the
 *  batched import-all word (every track fetched, one writeAudioFiles
 *  call, ONE armed multi-file drag — the group drag-out machinery).
 *  Durations come from the same per-url wave-meta cache the sections
 *  read, so the total costs nothing extra. */
function StudioPlateHead({ tracks }: { tracks: StudioTrack[] }) {
  // tracks is re-parsed JSON each render — key the effect on the urls.
  const key = tracks.map(t => t.url).join('\n')
  const tracksRef = useRef(tracks); tracksRef.current = tracks
  const [total, setTotal] = useState<number | null>(null)
  useEffect(() => {
    let dead = false
    setTotal(null)
    void Promise.all(tracksRef.current.map(t => getWaveMeta(t.url)))
      .then(ms => { if (!dead) setTotal(ms.reduce((s, m) => s + (m.duration || 0), 0)) })
    return () => { dead = true }
  }, [key])
  return (
    <>
      <div className="wd-plate-caphead">
        <span className="wd-plate-secname">{tracks.length} tracks</span>
        <span className="wd-plate-right">
          {total != null && total > 0 && <span className="wd-plate-time">{fmtDur(total)} total</span>}
          <ImportAllWord tracks={tracks} groupKey={`import-all:${key}`} />
        </span>
      </div>
      <div className="wd-plate-rule" />
    </>
  )
}

/** Single track → the full plate; several → ONE plate whose sections
 *  stack behind interior hairlines (a numbered figure list). */
function StudioAudioCard({ tracks }: { tracks: StudioTrack[] }) {
  if (tracks.length === 0) return null
  if (tracks.length === 1) return <StudioAudioPlate track={tracks[0]!} />
  return (
    <div className="wd-plate">
      <StudioPlateHead tracks={tracks} />
      {tracks.map(t => <StudioPlateSection key={t.url} track={t} />)}
    </div>
  )
}

/** Image bubble — resolves the stored public url to a presigned GET
 *  before it hits the <img> (and the external-open click). */
function StudioImageBubble({ url, name, tail }: { url: string; name: string; tail: boolean }) {
  const resolved = useResolvedUrl(url)
  return (
    <img className={`wd-img${tail ? ' tail' : ''}`} src={resolved} alt={name}
      onClick={() => { void openExternalUrl(resolved) }} />
  )
}

/** Video bubble — same presigned-url resolution as images. */
function StudioVideoBubble({ url, tail }: { url: string; tail: boolean }) {
  const resolved = useResolvedUrl(url)
  return (
    <video className={`wd-vid${tail ? ' tail' : ''}`} src={resolved} controls preload="metadata" />
  )
}

/** Floating now-playing bar — a paper plate riding above the input:
 *  white ground, hairline frame, the approved floating geometry.
 *  Fixed left cluster (ink glyph · name · elapsed/total); the REST of
 *  the width is the playing track's fine ink waveform (28px, green
 *  needle, same seek-drag) — the waveform IS the scrubber. Quiet
 *  grey ✕ far right. */
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
    : m.attachment_type === 'file' ? (m.attachment_name ?? 'file')
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

/** Four dots — the die face that stands for the games room. */
function DiceGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="3.5" r="1.45" /><circle cx="8.5" cy="3.5" r="1.45" />
      <circle cx="3.5" cy="8.5" r="1.45" /><circle cx="8.5" cy="8.5" r="1.45" />
    </svg>
  )
}

function SearchGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="6.8" cy="6.8" r="4.3" />
      <path d="M10.2 10.2L14 14" strokeLinecap="round" />
    </svg>
  )
}

function GearGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="8" cy="8" r="2.6" />
      <path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2M3.4 3.4l1.6 1.6M11 11l1.6 1.6M3.4 12.6L5 11M11 5l1.6-1.6" strokeLinecap="round" />
    </svg>
  )
}

/** In-chat game invite — an admission ticket, not a bubble: the game
 *  on the stub, the line on the body, one word to go. Joining hands the
 *  room to the shell, which opens the wall. */
function StudioInviteTicket({ roomId, gameType, isMine, senderName, onJoin }: {
  roomId: string
  gameType: string
  isMine: boolean
  senderName: string
  onJoin: (gameType: string, roomId: string) => Promise<JoinResult>
}) {
  const gameName = useGameName()
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<null | 'full' | 'missing'>(null)
  const go = async () => {
    if (busy) return
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
        {state && (
          <span className="wd-ticket-state">{state === 'full' ? 'the room is full' : 'the room has closed'}</span>
        )}
      </span>
      {!state && (
        <button className="wd-word acc wd-ticket-act" disabled={busy} onClick={() => void go()}>
          {busy ? '…' : isMine ? 'open' : 'join'}
        </button>
      )}
    </div>
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

  // ── games — the wall sets into the main pane; a live room stays
  // mounted (hidden) while the player answers a chat ──────────────────
  const [gameScreen, setGameScreen] = useState<GameScreen | null>(null)
  const [gameShown, setGameShown] = useState(false)
  const [gameJoinNonce, setGameJoinNonce] = useState(0)
  const [gameInviteConv, setGameInviteConv] = useState<string | null>(null)
  const gameName = useGameName()

  // people search in the rail — null = closed
  const [peopleQuery, setPeopleQuery] = useState<string | null>(null)

  // Minute tick — re-splits the upcoming lists and advances the
  // "in the studio / 2h" elapsed labels while the plugin sits open.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { profiles, me, loading: profilesLoading, refetch: refetchProfiles, updateMe } = useProfiles(supabase, user.id)
  const onlineIds = usePresence(supabase, user.id)
  const studioAt = useStudioPresence(supabase, user.id)
  const { mutualIds, followingIds, followerIds, follow, unfollow } = useFollows(supabase, user.id)
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
    if (!sel || (sel.kind !== 'dm' && sel.kind !== 'group')) return null
    return sel.kind === 'dm'
      ? { kind: 'dm', otherUserId: sel.userId }
      : { kind: 'group', conversationId: sel.conversationId }
  }, [sel])
  const { messages, loading: messagesLoading, send, deleteMessage, conversationId: activeConvId } = useMessages(supabase, user.id, chatTarget)
  const trackExportContext = useRef({ selection: sel, mounted: true })
  trackExportContext.current.selection = sel
  useEffect(() => {
    trackExportContext.current.mounted = true
    return () => { trackExportContext.current.mounted = false }
  }, [])
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
  const { categories: calCategories, ensureCategory: calEnsureCategory } = useEventCategories(supabase, user.id)

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
  // 403 recovery guard: last recovery attempt per track (public url) —
  // one retry per expiry window, so a genuinely broken source can't
  // spin invalidate→re-resolve→error forever.
  const npRetryAtRef = useRef(new Map<string, number>())
  const [npTrack, setNpTrack] = useState<{ url: string; name: string } | null>(null)
  const [npPlaying, setNpPlaying] = useState(false)
  const [npCur, setNpCur] = useState(0)
  const [npDur, setNpDur] = useState(0)

  const npStart = useCallback((t: { url: string; name: string }, at = 0) => {
    const a = npAudioRef.current
    if (!a) return
    if (npTrackRef.current?.url !== t.url) {
      // Track identity (activeUrl, cache keys) stays the stored public
      // url; the <audio> src gets the presigned url. Resolution is async
      // — guard against the track changing under the await.
      npTrackRef.current = t
      setNpTrack(t); setNpCur(at); setNpDur(0)
      npPendingSeekRef.current = at > 0 ? at : null
      void resolveUrl(t.url).then(resolved => {
        if (npTrackRef.current?.url !== t.url) return
        a.src = resolved
        a.play().then(() => setNpPlaying(true)).catch(() => {})
      })
    } else {
      a.currentTime = at
      setNpCur(at)
      a.play().then(() => setNpPlaying(true)).catch(() => {})
    }
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
  // A presigned src expires after ~an hour: playback (or a late seek)
  // then surfaces as a media 'error'. Recover in place — save position +
  // paused state, drop the stale cache entry, re-resolve, swap the src,
  // seek back via the pending-seek path, resume if it was playing.
  const npRecoverExpired = useCallback(() => {
    const a = npAudioRef.current
    const t = npTrackRef.current
    if (!a || !t) return
    const src = a.currentSrc || a.src
    // Only presigned urls expire; anything else erroring is a real fault.
    if (!src || !/[?&]X-Amz-/.test(src)) return
    const now = Date.now()
    const last = npRetryAtRef.current.get(t.url) ?? 0
    if (now - last < NP_RETRY_WINDOW_MS) return // one retry per window
    npRetryAtRef.current.set(t.url, now)
    const at = a.currentTime > 0 ? a.currentTime : npCur
    const wasPlaying = npPlaying
    invalidateResolved(t.url)
    void resolveUrl(t.url).then(fresh => {
      if (npTrackRef.current?.url !== t.url) return // track changed under us
      if (fresh === src) return // re-resolve got nothing newer — give up
      npPendingSeekRef.current = at > 0 ? at : null
      a.src = fresh
      if (wasPlaying) a.play().then(() => setNpPlaying(true)).catch(() => {})
    })
  }, [npCur, npPlaying])

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
  // One-line notes that stack with the upload cards — the only place a
  // file that did NOT go out gets to say so. A file-transfer tool must
  // never lose a file silently.
  const [notices, setNotices] = useState<{ id: string; text: string }[]>([])
  const notify = useCallback((text: string) => {
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setNotices(prev => [...prev, { id, text }])
    setTimeout(() => setNotices(prev => prev.filter(n => n.id !== id)), 7000)
  }, [])
  const notifyRef = useRef(notify); notifyRef.current = notify

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
  const MAX_SIZE = UPLOAD_FILE_LIMIT
  const uploadFile = useCallback(async (file: File, type: 'audio' | 'image' | 'file'):
    Promise<{ url: string; type: 'audio' | 'image' | 'file'; name: string } | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const contentType = file.type || 'application/octet-stream'
    const pid = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setUploads(prev => [...prev, { id: pid, name: file.name, progress: 0 }])
    const drop = () => setUploads(prev => prev.filter(u => u.id !== pid))
    try {
      const presignRes = await fetch('/api/r2-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No scope → permanent key. Chat attachments used to be temp
        // (7-day expiry); files now persist and reads go presigned.
        body: JSON.stringify({ ext, contentType, userId: user.id }),
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
      .filter((x): x is { f: File; type: 'audio' | 'image' } => x.type !== null)
    for (const t of typed.filter(t => t.f.size > MAX_SIZE))
      notify(`${t.f.name} (${fmtBytes(t.f.size)}) is over ${fmtBytes(MAX_SIZE)} — not sent`)
    const kept = typed.filter(t => t.f.size <= MAX_SIZE)
    if (kept.length === 0) return

    // Several audio files at once → one multi-track message (ChatView parity).
    const audios = kept.filter(t => t.type === 'audio')
    if (audios.length > 1 && audios.length === kept.length) {
      const uploaded: { url: string; name: string }[] = []
      for (const t of audios) {
        const a = await uploadFile(t.f, 'audio')
        if (a) uploaded.push({ url: a.url, name: a.name })
      }
      if (uploaded.length === 1) await send('', { url: uploaded[0].url, type: 'audio', name: uploaded[0].name })
      else if (uploaded.length > 1) await send('', { url: JSON.stringify(uploaded), type: 'multi-audio', name: `${uploaded.length} Tracks` })
      return
    }
    for (const t of kept) {
      const a = await uploadFile(t.f, t.type)
      if (a) await send('', a)
    }
  }, [uploadFile, send, MAX_SIZE, notify])

  // Upload audio files (each stamped with its own timeline, `fallback`
  // filling the gaps) and send them as ONE chat message — a single
  // audio bubble or a multi-track card.
  const sendAudioListToChat = useCallback(async (list: File[], fallback: AttachmentTimelineMetadata | null) => {
    const uploaded: { url: string; name: string; metadata?: AttachmentTimelineMetadata }[] = []
    for (const f of list) {
      if (f.size > MAX_SIZE) { notify(`${f.name} (${fmtBytes(f.size)}) is over ${fmtBytes(MAX_SIZE)} — not sent`); continue }
      const metadata = await extractAudioTimeline(f, fallback)
      const a = await uploadFile(f, 'audio')
      if (a) uploaded.push({ url: a.url, name: a.name, metadata: metadata ?? undefined })
    }
    if (uploaded.length === 1) {
      await send('', { url: uploaded[0]!.url, type: 'audio', name: uploaded[0]!.name, metadata: uploaded[0]!.metadata })
    } else if (uploaded.length > 1) {
      await send('', { url: JSON.stringify(uploaded), type: 'multi-audio', name: `${uploaded.length} Tracks`, metadata: fallback ?? undefined })
    }
  }, [uploadFile, send, MAX_SIZE])

  // A DAW drop lands here (not the picker) — by now the multi-track
  // chooser has already intercepted batches of ≥2 audio files, so this
  // is the single-audio (plus stray non-audio) path. Regions that
  // prove, by their BWF stamps, to sit side by side on one track merge
  // into a single clip at their original positions; anything else goes
  // as separate tracks.
  const sendDawFiles = useCallback(async (files: File[], fallback: AttachmentTimelineMetadata | null) => {
    const audio = files.filter(isAudioFile)
    const rest = files.filter(f => !isAudioFile(f))
    if (rest.length > 0) await onFilesPicked(rest)
    if (audio.length === 0) return
    const resolved = await resolveDawDrop(audio)
    await sendAudioListToChat(resolved.kind === 'merged' ? [resolved.file] : resolved.files, fallback)
  }, [onFilesPicked, sendAudioListToChat])

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
  // Hidden drop-ingestion diagnostics (double-click the 'orb' wordmark).
  const [diagOpen, setDiagOpen] = useState(false)
  const [pendingStemDrop, setPendingStemDrop] = useState<StemDropRequest | null>(null)
  // ≥2 audio files in one drop → the chooser card (separately / merge
  // keep-timing / merge join / zip). Opened AFTER the batch finishes
  // collecting; the drop overlay lifecycle above it is untouched.
  const [dropChoice, setDropChoice] = useState<PendingDropChoice | null>(null)
  // "send as zip" is a MODIFIER, not a third action: it applies to
  // whichever action row is pressed (separately -> zip of the files;
  // merge -> zip of the single merged clip). Chat only.
  const [dropZip, setDropZip] = useState(false)
  const [dropBusy, setDropBusy] = useState<'placed' | 'joined' | 'zip' | null>(null)
  // mergeDroppedRegions refused for that mode — the row greys out with
  // the refusal, in the user's words (mergeFailureText), instead of
  // failing silently. 'placed' means missing stamps or mixed rates
  // (overlaps are mixed now, never refused); 'joined' means the size
  // cap or nothing decoded.
  const [mergeFailed, setMergeFailed] = useState<{ placed: string | null; joined: string | null }>({ placed: null, joined: null })
  const dragCounter = useRef(0)
  const juceDragActive = useRef(false)      // C++ owns the overlay while true
  const isCancelDrag = useRef(false)        // own drag-out returning → don't attach
  const outDragActive = useRef(false)       // an AudioAttachment drag-out is live
  const outDragArmedUrl = useRef<string | null>(null)
  const outDragCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropBuffer = useRef<{ name: string; data: string; seq?: number }[]>([])
  const dropGroupCount = useRef(1)
  const dropTimelineRef = useRef<ReturnType<typeof getDawTimelineSnapshot>>(null)
  const dropTimelinePromiseRef = useRef<Promise<ReturnType<typeof getDawTimelineSnapshot>> | null>(null)

  // Keep the DAW playhead/tempo snapshot warm (ChatView does the same).
  useEffect(() => { initAudioTimelineTracking() }, [])

  // Live values for the mount-once native listeners.
  const tabRef = useRef(tab); tabRef.current = tab
  const activeConvIdRef = useRef(activeConvId); activeConvIdRef.current = activeConvId
  const onFilesPickedRef = useRef(onFilesPicked); onFilesPickedRef.current = onFilesPicked
  const sendDawFilesRef = useRef(sendDawFiles); sendDawFilesRef.current = sendDawFiles

  // A new conversation invalidates a stale routed drop — and a chooser
  // still waiting on the old room's batch.
  useEffect(() => {
    setPendingStemDrop(null)
    setDropChoice(null); setDropBusy(null); setMergeFailed({ placed: null, joined: null })
  }, [activeConvId])

  const consumeStemDrop = useCallback((id: string) => {
    setPendingStemDrop(current => current?.id === id ? null : current)
  }, [])

  /* ── multi-track drop chooser ─────────────────────────────────────
     Every route with ≥2 audio files parks the batch here instead of
     proceeding; the card offers "send separately" / "merge / keep
     timing" / "merge / join end-to-end" (both tabs) and "send as zip"
     (chat only). Esc, the veil, or the cancel row discards the drop. */
  const openDropChoice = useCallback((choice: PendingDropChoice) => {
    setDropZip(false)
    setDropBusy(null); setMergeFailed({ placed: null, joined: null })
    setDropChoice(choice)
  }, [])
  const openDropChoiceRef = useRef(openDropChoice); openDropChoiceRef.current = openDropChoice

  useEffect(() => {
    if (!dropChoice) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dropBusy) setDropChoice(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dropChoice, dropBusy])

  // "send separately" — chat: today's one multi-audio message; files
  // tab: plain File[] through pendingStemDrop, which StemPanel uploads
  // as individual rows WITHOUT its native-batch auto-merge (that path
  // only runs for nativeFiles).
  // Zip modifier — STORE-method archive (wav doesn't compress; speed
  // matters) through the generic attachment path. Called by either
  // action row when the toggle is on (chat only).
  const sendAsZip = useCallback(async (files: File[]) => {
    // The archive is built in memory (every file's bytes + the Blob's
    // copy), so the sum is capped low; "send separately" streams each
    // file and has no such ceiling.
    const total = files.reduce((s, f) => s + f.size, 0)
    if (total > ZIP_TOTAL_LIMIT) {
      notify(`a zip of these would be ${fmtBytes(total)} — over ${fmtBytes(ZIP_TOTAL_LIMIT)}. send them separately instead`)
      return
    }
    try {
      const entries = await Promise.all(
        files.map(async f => ({ name: f.name, data: await f.arrayBuffer() })))
      const zip = new File([buildZip(entries)], zipName(), { type: 'application/zip' })
      if (zip.size > MAX_SIZE) { notify(`the zip (${fmtBytes(zip.size)}) is over ${fmtBytes(MAX_SIZE)} — not sent`); return }
      const a = await uploadFile(zip, 'file')
      if (a) await send('', { url: a.url, type: 'file', name: a.name })
      else notify('the zip didn\'t upload — check your connection and try again')
    } catch (e) {
      console.error('[studio zip] failed', e)
      notify('couldn\'t build the zip — send the files separately instead')
    }
  }, [uploadFile, send, MAX_SIZE, notify])

  const choiceSeparate = useCallback(() => {
    const c = dropChoice
    if (!c || dropBusy) return
    setDropChoice(null)
    if (c.target === 'stems') {
      setPendingStemDrop({
        id: `choice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        files: c.files,
        fallbackMetadata: c.fallback,
      })
    } else if (dropZip) {
      void sendAsZip(c.files)
    } else {
      void sendAudioListToChat(c.files, c.fallback)
    }
  }, [dropChoice, dropBusy, dropZip, sendAsZip, sendAudioListToChat])

  // The two merge rows — 'placed' lays regions at their BWF-stamped
  // positions, mixing any overlaps in place (refused only for missing
  // stamps or mixed rates); 'joined' butt-joins, stamps setting only
  // the ORDER (timeline order when every region is stamped, the batch's
  // own order otherwise — never filename order, which Logic derives
  // from the take, not the timeline) — the one for comped/moved regions
  // whose stamped POSITIONS would scatter them. The single merged WAV
  // then rides the same route a lone file would.
  const choiceMerge = useCallback((mode: 'placed' | 'joined') => {
    const c = dropChoice
    if (!c || dropBusy || mergeFailed[mode]) return
    setDropBusy(mode)
    void (async () => {
      const result = await mergeDroppedRegions(c.files, mode)
      setDropBusy(null)
      if (!result.ok) { setMergeFailed(f => ({ ...f, [mode]: mergeFailureText(result.reason) })); return }   // chooser stays up, row greys
      const merged = result.file
      setDropChoice(null)
      if (c.target === 'stems') {
        setPendingStemDrop({
          id: `choice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          files: [merged],
          fallbackMetadata: c.fallback,
        })
      } else if (dropZip) {
        void sendAsZip([merged])
      } else {
        void sendAudioListToChat([merged], c.fallback)
      }
    })()
  }, [dropChoice, dropBusy, mergeFailed, dropZip, sendAsZip, sendAudioListToChat])


  // One HTML5 drop aimed at the files tab — from the shell's own stems
  // branch OR handed up by StemPanel's drop zone (onMultiFileDrop).
  // ≥2 audio → the chooser; one audio → straight to StemPanel; images
  // and other strays still go to chat.
  const routeStemsDrop = useCallback((files: File[]) => {
    const audio = files.filter(isAudioFile)
    const rest = files.filter(f => !isAudioFile(f))
    if (rest.length > 0) void onFilesPicked(rest)
    if (audio.length === 0) return
    void (async () => {
      const fresh = await refreshDawTimelineSnapshot()
      const fallback = fresh ?? getDawTimelineSnapshot()
      if (audio.length >= 2) {
        openDropChoice({ files: audio, target: 'stems', fallback })
      } else {
        setPendingStemDrop({
          id: `files-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          files: audio,
          fallbackMetadata: fallback,
        })
      }
    })()
  }, [onFilesPicked, openDropChoice])

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
  // __juceFileDropRejected — the native side skipped a file over the
  // drag limit (newer builds); it still counts toward the group so the
  // rest of the drop isn't left waiting for it.
  //
  // ORDER — the buffer below fills in ARRIVAL order, which for the
  // native bridge is COMPLETION order, not drag order: DragMonitor.mm
  // resolves Logic's file promises (and reads plain file URLs) on a
  // concurrent queue, so a large region can land after a smaller one
  // that was dragged behind it. Newer plug-in binaries stamp each
  // __juceFileDrop detail with `seq` — the promise's index at drop
  // registration — and the flush sorts by it; old binaries send no
  // seq and keep arrival order (the join path in audioMerge still
  // orders stamped batches by their BWF timestamps).
  useEffect(() => {
    const flush = () => {
      if (dropBuffer.current.length < dropGroupCount.current) return
      const batch = dropBuffer.current
      dropBuffer.current = []
      dropGroupCount.current = 1
      if (batch.every(f => Number.isFinite(f.seq)))
        batch.sort((a, b) => a.seq! - b.seq!)
      if (batch.length === 0 || !activeConvIdRef.current) return

      void (async () => {
        const fresh = await (dropTimelinePromiseRef.current ?? refreshDawTimelineSnapshot())
        const fallback = fresh ?? dropTimelineRef.current
        dropTimelineRef.current = null
        dropTimelinePromiseRef.current = null
        // A region over the drag limit stops here, out loud. (Older
        // plug-in builds hand it over regardless; newer ones reject it
        // natively before the base64 round trip.)
        const all = batch.map(f => nativeToFile(f.name, f.data))
        for (const f of all.filter(f => f.size > DAW_FILE_LIMIT))
          notifyRef.current(`${f.name} (${fmtBytes(f.size)}) is over ${fmtBytes(DAW_FILE_LIMIT)}, the limit for regions dragged from the daw — export it and drop the file instead`)
        const dropped = all.filter(f => f.size <= DAW_FILE_LIMIT)
        const keptBatch = batch.filter((_, i) => all[i]!.size <= DAW_FILE_LIMIT)
        if (dropped.length === 0) return
        // ≥2 audio files → the chooser card decides (separately /
        // merge / zip) instead of any automatic policy. Non-audio
        // strays still ride the chat attachment path directly.
        const audio = dropped.filter(isAudioFile)
        if (audio.length >= 2) {
          const rest = dropped.filter(f => !isAudioFile(f))
          if (rest.length > 0) void onFilesPickedRef.current(rest)
          openDropChoiceRef.current({
            files: audio,
            target: tabRef.current === 'stems' ? 'stems' : 'chat',
            fallback,
          })
          return
        }
        if (tabRef.current === 'stems') {
          setPendingStemDrop({
            id: `native-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            nativeFiles: keptBatch,
            fallbackMetadata: fallback,
          })
          return
        }
        await sendDawFilesRef.current(dropped, fallback)
      })()
    }
    const onFile = (e: Event) => {
      if (outDragActive.current) return
      const { name, data, seq } = (e as CustomEvent<{ name: string; data: string; seq?: number }>).detail
      dropBuffer.current.push({ name, data, seq })
      flush()
    }
    const onRejected = (e: Event) => {
      const { name, size, limit } = (e as CustomEvent<{ name: string; size: number; limit: number }>).detail
      notifyRef.current(`${name} (${fmtBytes(size)}) is over ${fmtBytes(limit)}, the limit for regions dragged from the daw — export it and drop the file instead`)
      dropGroupCount.current = Math.max(0, dropGroupCount.current - 1)
      flush()
    }
    window.addEventListener('__juceFileDrop', onFile)
    window.addEventListener('__juceFileDropRejected', onRejected)
    return () => {
      window.removeEventListener('__juceFileDrop', onFile)
      window.removeEventListener('__juceFileDropRejected', onRejected)
    }
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
      routeStemsDrop(files)
      return
    }

    const audio = files.filter(isAudioFile)
    if (audio.length >= 2) {
      const rest = files.filter(f => !isAudioFile(f))
      if (rest.length > 0) void onFilesPicked(rest)
      void (async () => {
        const fresh = await refreshDawTimelineSnapshot()
        openDropChoice({ files: audio, target: 'chat', fallback: fresh ?? getDawTimelineSnapshot() })
      })()
      return
    }
    void onFilesPicked(files)
  }, [activeConvId, tab, onFilesPicked, routeStemsDrop, openDropChoice])

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
    setGameShown(false)
    if (next.kind !== 'dm' && next.kind !== 'group') return
    const cid = next.kind === 'group'
      ? next.conversationId
      : dmConvByPartner.get(next.userId)?.conversationId
    if (cid) markSeen(cid)
  }, [dmConvByPartner, markSeen])

  const isSel = (s: Sel) => !!sel && (
    (sel.kind === 'dm' && s.kind === 'dm' && sel.userId === s.userId)
    || (sel.kind === 'group' && s.kind === 'group' && sel.conversationId === s.conversationId)
    || (sel.kind === 'me' && s.kind === 'me')
    || (sel.kind === 'profile' && s.kind === 'profile' && sel.userId === s.userId)
    || (sel.kind === 'settings' && s.kind === 'settings')
  )

  // ── games wiring — CollabPage's block, verbatim in spirit ───────────
  const openGames = useCallback((invite: string | null = null) => {
    setGameInviteConv(invite)
    setGameScreen(prev => (invite ? 'list' : (prev ?? 'list')))
    setGameShown(true)
  }, [])
  const closeGames = useCallback(() => { setGameShown(false); setGameInviteConv(null) }, [])
  const selectGame = useCallback(async (g: GameId) => {
    // Everything async runs BEFORE the screen switch; the finally
    // guarantees the game opens no matter what.
    try {
      if (SOLO_GAMES.has(g)) return
      if (!gameInviteConv) {
        const { findActiveGame } = await import('../lib/gameRooms')
        const active = await findActiveGame(supabase, user.id)
        if (active?.gameType === g) sessionStorage.setItem('join_room_id', active.roomId)
      } else {
        // Invite path — make the room, drop the ticket into the chat,
        // walk into the lobby.
        const { createGameRoom } = await import('../lib/gameRooms')
        const roomId = await createGameRoom(supabase, g as GameType, user.id)
        if (roomId) {
          await send('', { url: roomId, type: 'game_invite', name: g })
          sessionStorage.setItem('join_room_id', roomId)
        }
      }
    } catch (err) {
      console.error('[selectGame]', err)
    } finally {
      setGameInviteConv(null)
      setGameJoinNonce(n => n + 1)
      setGameScreen(g)
    }
  }, [gameInviteConv, supabase, user.id, send])
  const joinGameInvite = useCallback(async (gameType: string, roomId: string): Promise<JoinResult> => {
    const { joinGameRoom } = await import('../lib/gameRooms')
    const type = gameType as GameType
    const result = await joinGameRoom(supabase, type, roomId, user.id, { onlineIds })
    if (result === 'joined' || result === 'already-in') {
      sessionStorage.setItem('join_room_id', roomId)
      // Views read join_room_id on MOUNT — a fresh key makes sure of it.
      setGameJoinNonce(n => n + 1)
      setGameInviteConv(null)
      setGameScreen(type as GameScreen)
      setGameShown(true)
    }
    return result
  }, [supabase, user.id, onlineIds])

  // rail search — @handle first, then names; anyone on orb, not just friends
  const searchResults = useMemo(() => {
    const q = (peopleQuery ?? '').trim().toLowerCase().replace(/^@/, '')
    if (!q) return []
    return profilesWithStatus
      .filter(p => (p.username ?? '').includes(q) || p.display_name.toLowerCase().includes(q))
      .sort((a, b) => {
        const au = (a.username ?? '').startsWith(q) ? 0 : 1
        const bu = (b.username ?? '').startsWith(q) ? 0 : 1
        return au - bu || a.display_name.localeCompare(b.display_name)
      })
      .slice(0, 12)
  }, [peopleQuery, profilesWithStatus])

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

  // ── delete my message (the two-tap word beside the bubble) ──────────
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set())
  const handleDeleteMessage = useCallback(async (m: Message) => {
    // If the doomed message's audio sits in the shared player, stop it
    // first — no orphaned playback outliving its bubble.
    if (npTrackRef.current) {
      const activeUrl = npTrackRef.current.url
      let dying = m.attachment_type === 'audio' && m.attachment_url === activeUrl
      if (!dying && m.attachment_type === 'multi-audio' && m.attachment_url) {
        try {
          dying = (JSON.parse(m.attachment_url) as { url?: string }[])
            .some(t => t?.url === activeUrl)
        } catch { /* not a track list — nothing of ours is playing */ }
      }
      if (dying) npClose()
    }
    setDeletingIds(prev => new Set(prev).add(m.id))
    const ok = await deleteMessage(m.id)
    setDeletingIds(prev => { const next = new Set(prev); next.delete(m.id); return next })
    if (!ok) notify('message didn’t delete — try again')
  }, [deleteMessage, npClose, notify])

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
        if (m.attachment_url && m.attachment_name) {
          pieces.push(
            <StudioInviteTicket key="att" roomId={m.attachment_url} gameType={m.attachment_name}
              isMine={isMine} senderName={senderP?.display_name ?? '…'} onJoin={joinGameInvite} />,
          )
        }
      } else if (m.attachment_type) {
        if (m.attachment_expired) {
          pieces.push(<div key="att" className="wd-expired">file expired (7 days)</div>)
        } else if (m.attachment_url) {
          const url = m.attachment_url
          const name = m.attachment_name ?? 'file'
          if (m.attachment_type === 'image') {
            pieces.push(
              <StudioImageBubble key="att" url={url} name={name} tail={tailCls() !== ''} />,
            )
          } else if (m.attachment_type === 'video') {
            pieces.push(
              <StudioVideoBubble key="att" url={url} tail={tailCls() !== ''} />,
            )
          } else if (m.attachment_type === 'audio') {
            const from = profileById.get(m.sender_id)?.display_name
            pieces.push(
              <StudioAudioCard key="att"
                tracks={[{ url, name, metadata: m.attachment_metadata ?? undefined, from }]} />,
            )
          } else if (m.attachment_type === 'multi-audio') {
            const from = profileById.get(m.sender_id)?.display_name
            let tracks: StudioTrack[] = []
            try { tracks = (JSON.parse(url) as StudioTrack[]).map(t => ({ ...t, from })) } catch { /* fall through to chip */ }
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
        <div key={m.id} className={`wd-mrow${isMine ? ' mine' : ' theirs'}${first ? ' first' : ''}${deletingIds.has(m.id) ? ' deleting' : ''}`}>
          {/* Optimistic rows ('opt-') have no server row to delete yet. */}
          {isMine && !m.id.startsWith('opt-') && (
            <MsgDeleteWord onConfirm={() => { void handleDeleteMessage(m) }} />
          )}
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
    activeConvId, supabase, saveChatEvents, markChipDone, joinGameInvite,
    deletingIds, handleDeleteMessage])

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
          <div className="wd-brand" onClick={() => { setSel(null); setGameShown(false) }} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') { setSel(null); setGameShown(false) } }}
            onDoubleClick={() => setDiagOpen(true)}>
            <BrandMark />slur
          </div>
          <div className="wd-rail-scroll">
            <div className={`wd-row${gameShown ? ' on' : ''}`} onClick={() => openGames()}>
              <span className="wd-av tile"><DiceGlyph /></span>
              <span className="wd-rname">
                <b>games</b>
                {gameScreen && gameScreen !== 'list' && !gameShown && (
                  <span className="play">{gameName(gameScreen)} in play</span>
                )}
              </span>
            </div>
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
            {peopleQuery === null ? (
              <div className="wd-sec people">
                <span>people</span>
                <button className="wd-sec-search" onClick={() => setPeopleQuery('')} aria-label="find people" title="find people">
                  <SearchGlyph />
                </button>
              </div>
            ) : (
              <div className="wd-search">
                <span className="wd-search-at">@</span>
                <input className="wd-search-in" value={peopleQuery} autoFocus spellCheck={false}
                  placeholder="username"
                  onChange={e => setPeopleQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setPeopleQuery(null) }} />
                <button className="wd-search-x" onClick={() => setPeopleQuery(null)} aria-label="close search">✕</button>
              </div>
            )}
            {peopleQuery !== null && (
              peopleQuery.trim() === ''
                ? <div className="wd-search-none">type a username</div>
                : searchResults.length === 0
                  ? <div className="wd-search-none">no one by that name</div>
                  : searchResults.map(p => {
                    const s: Sel = { kind: 'profile', userId: p.id }
                    return (
                      <div key={p.id} className={`wd-row${isSel(s) ? ' on' : ''}`} onClick={() => openSel(s)}>
                        <Avatar color={p.avatar_color} label={p.initials.slice(0, 1)} avatarUrl={p.avatar_url}
                          dot={p.isOnline ? 'on' : undefined} />
                        <span className="wd-rname">
                          <b>{p.display_name}</b>
                          <span className="handle">
                            {p.username ? `@${p.username}` : ''}
                            {mutualIds.has(p.id) ? '  friends' : followerIds.has(p.id) ? '  follows you' : followingIds.has(p.id) ? '  following' : ''}
                          </span>
                        </span>
                      </div>
                    )
                  })
            )}
            {peopleQuery === null && friendProfiles.map(p => {
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
            {peopleQuery === null && friendProfiles.length === 0 && !profilesLoading && (
              <div className="wd-row" style={{ cursor: 'default' }}>
                <span className="wd-rname"><span>follow someone to start</span></span>
              </div>
            )}
          </div>
          <div className={`wd-rail-foot${sel?.kind === 'profile' && sel.userId === user.id ? ' on' : ''}`}>
            <span className="wd-foot-me" onClick={() => openSel({ kind: 'profile', userId: user.id })} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') openSel({ kind: 'profile', userId: user.id }) }}>
              <Avatar color={me?.avatar_color ?? '#1A1917'} label={(me?.initials ?? myName).slice(0, 1)}
                avatarUrl={me?.avatar_url} dot="studio" />
              <span>{myName}</span>
            </span>
            <button className={`wd-foot-gear${sel?.kind === 'settings' ? ' on' : ''}`}
              onClick={() => openSel({ kind: 'settings' })} aria-label="settings" title="settings">
              <GearGlyph />
            </button>
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
            onError={npRecoverExpired}
          />
          {gameScreen !== null && (
            <GamesPane
              hidden={!gameShown}
              supabase={supabase}
              userId={user.id}
              me={me}
              friendProfiles={friendProfiles}
              onlineIds={onlineIds}
              screen={gameScreen}
              joinNonce={gameJoinNonce}
              inviteConversationId={gameInviteConv}
              onSelectGame={g => { void selectGame(g) }}
              onBackToList={() => { setGameScreen('list'); setGameInviteConv(null) }}
              onClose={closeGames}
              headline={gameInviteConv ? (headerTitle || 'this chat') : undefined}
            />
          )}
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
          {dropChoice && (
            <div className="wd-dropask" role="dialog" aria-modal="true">
              <div className="wd-dropask-veil" onClick={() => { if (!dropBusy) setDropChoice(null) }} />
              <div className="wd-dropask-card">
                <div className="wd-dropask-title">{dropChoice.files.length} tracks</div>
                <div className="wd-dropask-fine">
                  {dropChoice.target === 'stems'
                    ? 'dropped on files — how should they land?'
                    : `how should they reach ${headerTitle || 'this chat'}?`}
                </div>
                {dropChoice.target === 'chat' && (
                  <button
                    className={`wd-dropask-zip${dropZip ? ' on' : ''}`}
                    disabled={!!dropBusy}
                    onClick={() => setDropZip(z => !z)}
                    aria-pressed={dropZip}
                  >
                    <span className="wd-dropask-zipbox" aria-hidden="true" />
                    <span>as zip</span>
                    <small>bundle the result into one .zip</small>
                  </button>
                )}
                <button className="wd-dropask-row" disabled={!!dropBusy} onClick={choiceSeparate}>
                  <span>send separately{dropChoice.target === 'chat' && dropZip ? ' / zipped' : ''}</span>
                  <small>{dropChoice.target === 'stems' ? 'one row per file' : dropZip ? 'every file, inside one archive' : 'one message, every track listed'}</small>
                </button>
                <button
                  className={`wd-dropask-row${mergeFailed.placed ? ' off' : ''}`}
                  disabled={!!dropBusy || !!mergeFailed.placed}
                  onClick={() => choiceMerge('placed')}
                >
                  <span>{dropBusy === 'placed' ? 'merging…' : `merge / keep timing${dropChoice.target === 'chat' && dropZip ? ' / zipped' : ''}`}</span>
                  <small>{mergeFailed.placed ? mergeFailed.placed : dropZip && dropChoice.target === 'chat' ? 'one merged clip, inside an archive' : 'as placed on the timeline — overlaps are mixed'}</small>
                </button>
                <button
                  className={`wd-dropask-row${mergeFailed.joined ? ' off' : ''}`}
                  disabled={!!dropBusy || !!mergeFailed.joined}
                  onClick={() => choiceMerge('joined')}
                >
                  <span>{dropBusy === 'joined' ? 'merging…' : `merge / join end-to-end${dropChoice.target === 'chat' && dropZip ? ' / zipped' : ''}`}</span>
                  <small>{mergeFailed.joined ? mergeFailed.joined : dropZip && dropChoice.target === 'chat' ? 'one merged clip, inside an archive' : 'gaps removed, one continuous take'}</small>
                </button>
                <button
                  className="wd-dropask-cancel"
                  disabled={!!dropBusy}
                  onClick={() => setDropChoice(null)}
                >
                  cancel
                </button>
              </div>
            </div>
          )}
          {sel?.kind === 'settings' ? (
            <>
              <div className="wd-head plain">
                <div className="wd-title">settings</div>
                <div className="wd-sub">slur chat {APP_VERSION}</div>
              </div>
              <SettingsPage supabase={supabase} user={user} />
            </>
          ) : sel?.kind === 'profile' ? (
            (() => {
              const isMine = sel.userId === user.id
              const p = isMine ? (me ? { ...me, isOnline: true } : null) : (profileById.get(sel.userId) ?? null)
              if (!p) return <div className="wd-quiet">…</div>
              return (
                <ProfilePage
                  key={p.id}
                  supabase={supabase}
                  user={user}
                  profile={p}
                  isMine={isMine}
                  following={followingIds.has(p.id)}
                  follower={followerIds.has(p.id)}
                  onFollow={() => follow(p.id)}
                  onUnfollow={() => unfollow(p.id)}
                  onMessage={() => openSel({ kind: 'dm', userId: p.id })}
                  onUpdated={() => { void refetchProfiles() }}
                  updateMe={isMine ? updateMe : undefined}
                />
              )
            })()
          ) : sel?.kind === 'me' ? (
            /* my calendar — the personal programme, fuller. The prompt
               lives on the home pane now. */
            <>
              <div className="wd-head plain">
                <div className="wd-title">{myName}</div>
                <div className="wd-sub">my calendar</div>
              </div>
              {/* The real month page — everything RLS lets me see, from
                  any room; events added here are personal (no room). */}
              <StudioCalendar
                currentUserId={user.id}
                events={allCalEvents}
                categories={calCategories}
                groupTitleById={groupTitleById}
                onDelete={(id) => { calDeleteEvent(id).catch(() => {}) }}
                onUpdate={(id, patch) => { calUpdateEvent(id, patch).catch(() => {}) }}
                onAdd={(text, day) => saveMyEvents(`on ${day}: ${text}`)}
              />
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
                    <span className="wd-hav click" style={{ background: selectedProfile.avatar_color }}
                      onClick={() => openSel({ kind: 'profile', userId: selectedProfile.id })} role="button" title="profile">
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
                  {(uploads.length > 0 || notices.length > 0) && (
                    <div className="wd-upcards">
                      {notices.map(n => (
                        <button key={n.id} className="wd-upnote" onClick={() => setNotices(prev => prev.filter(x => x.id !== n.id))}>
                          {n.text}
                        </button>
                      ))}
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
                    <ExportTracksButton key={activeConvId} className="wd-gameinv" onCapture={async archive => {
                      const destination = activeConvId
                      const selection = sel
                      const current = () => trackExportContext.current.mounted && activeConvIdRef.current === destination && trackExportContext.current.selection === selection
                      const tracks = await prepareTrackExport(archive)
                      const uploaded = []
                      for (const track of tracks) {
                        if (!current()) throw new Error('Conversation changed. Exported tracks were not sent.')
                        const audio = await uploadFile(track.file, 'audio')
                        if (!audio) throw new Error('Track upload failed. Nothing was sent; you can retry.')
                        uploaded.push({ url: audio.url, name: track.file.name, metadata: track.metadata,
                          assetId: track.assetId, regionBundle: track.bundle })
                      }
                      if (!current()) throw new Error('Conversation changed. Exported tracks were not sent.')
                      if (!await send('', { type: 'multi-audio', url: JSON.stringify(uploaded), name: `${tracks.length} Tracks` }))
                        throw new Error('The exported tracks could not be sent. Please retry.')
                    }} />
                    <button className="wd-gameinv" onClick={() => { if (activeConvId) openGames(activeConvId) }}
                      aria-label="invite to a game" title="invite to a game"><DiceGlyph size={11} /></button>
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
                      onMultiFileDrop={routeStemsDrop}
                      alignToBarOne
                    />
                  ) : <div className="wd-quiet">loading…</div>}
                </div>
              )}

              {tab === 'calendar' && (
                activeConvId ? (
                  <StudioCalendar
                    currentUserId={user.id}
                    events={convCalEvents}
                    categories={calCategories}
                    groupTitleById={groupTitleById}
                    onDelete={(id) => { calDeleteEvent(id).catch(() => {}) }}
                    onUpdate={(id, patch) => { calUpdateEvent(id, patch).catch(() => {}) }}
                    onAdd={async (text, day) => saveChatEvents(await parseSchedule(supabase, `on ${day}: ${text}`))}
                  />
                ) : <div className="wd-quiet">loading…</div>
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
              <button className="wd-word sm wd-home-more" onClick={() => openSel({ kind: 'me' })}>my calendar</button>
            </div>
          )}
        </div>
      </div>
      {diagOpen && <DropDiagnosticsOverlay onClose={() => setDiagOpen(false)} />}
    </div>
  )
}
