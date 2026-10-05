import { uploadSecureFile } from '@orb/core/lib/secureFiles.ts'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, Message, AttachType, AttachmentTimelineMetadata } from '../../types/collab'
import type { StemDropRequest } from '../../types/stems'
import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'
import { linkify, firstUrl } from '../../lib/linkify'
import LinkPreviewCard from './LinkPreviewCard'
import ChatCalendar from './ChatCalendar'
import { useCalendarEvents, type CalendarEvent, type NewCalendarEvent } from '../../hooks/useCalendarEvents'
import { useEventCategories } from '../../hooks/useEventCategories'
import { parseSchedule } from '../../lib/parseSchedule'
import { regionToFile } from '../../lib/audioMerge'
import { createRegionBundleAttachment, isRegionArchive } from '../../lib/regionBundleIO'
import { useLogicDropCapture } from '../../lib/logicDropCapture'
import RegionBundleAttachment from './RegionBundleAttachment'
import CaptureRegionsButton from './CaptureRegionsButton'
import ExportTracksButton from './ExportTracksButton'
import { DAW_FILE_LIMIT, fmtBytes } from '../../lib/limits'
import { getDawTimelineSnapshot, initAudioTimelineTracking, refreshDawTimelineSnapshot, timelinePositionLabel } from '../../lib/audioTimeline'
import { buildListenUrl, copyText } from '../../lib/shareLink'
import { useResolvedUrl } from '../../lib/r2Access'
import AudioTransferActions from './AudioTransferActions'

interface Attachment {
  url: string
  type: AttachType
  name: string
  metadata?: AttachmentTimelineMetadata
}
type GameInviteJoinResult = 'joined' | 'already-in' | 'full' | 'missing'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  /** DM partner — present iff this is a 1:1 chat. */
  otherProfile?: Profile
  /** Group-chat header info — present iff this is a group chat. */
  groupHeader?: {
    title: string
    color: string
    memberCount: number
  }
  messages: Message[]
  loading: boolean
  /** True when otherProfile is currently broadcasting a live stream —
   * we paint the status dot red instead of the online/offline colour. */
  otherIsLive?: boolean
  /** Title of the other user's active live stream, if any. Drives the
   *  sub-line text and the Join button in the chat header. */
  otherLiveTitle?: string
  /** Callback to jump straight into the other user's broadcast. The
   *  parent already knows the session id, so this is a parameterless
   *  trigger from ChatView's perspective. */
  onJoinLive?: () => void
  /** Group members excluding the current user — drives the per-message
   *  sender chip on `theirs` bubbles and supplies the avatar/name
   *  lookup for the read-receipt row. */
  groupMembers?: Profile[]
  /** Per-user last-seen timestamps (ms) in this conversation, excluding
   *  the current user. The "read by" row below my last sent message
   *  shows whichever members have ts ≥ that message's `created_at`. */
  reads?: Map<string, number>
  /** Tap on the chat header (avatar + name area) fires this. For DMs
   *  the parent usually wires this to open the partner's profile; for
   *  groups it opens ChatSettingsPanel. */
  onOpenSettings?: () => void
  onOpenStems?: () => void
  onOpenCalendar?: () => void
  onCloseCalendar?: (options?: { restoreSize?: boolean; preserveRestore?: boolean }) => void
  stemsActive?: boolean
  sidePanelCloseNonce?: number
  onStemDrop?: (request: StemDropRequest) => void
  onSend: (content: string, attachment?: Attachment) => Promise<boolean>
  onBack: () => void
  /** Called when the user taps "Join Game" on a chat invite bubble.
   *  Parent handles the room-capacity check + routing into the lobby;
   *  ChatView itself only renders the bubble and reports the click.
   *  Resolves with the join outcome so the bubble can surface a
   *  "Room is full" / "Already in" banner. */
  onJoinGameInvite?: (gameType: string, roomId: string) => Promise<GameInviteJoinResult>
  /** Conversation row id — unlocks the in-chat calendar (header glyph +
   *  slide-over + schedule-detection chips). Events created here are
   *  shared with the conversation via conversation_id. */
  conversationId?: string | null
  /** Group-conversation titles for the calendar's shared-event tags —
   *  the in-chat calendar shows the user's WHOLE schedule, so events
   *  from other groups need their names. */
  groupTitleById?: Map<string, string>
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string, todayLabel: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return todayLabel
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDur(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── 이미지 첨부 ──────────────────────────────────────────────
function ImageAttachment({ url, name }: { url: string; name: string }) {
  const resolved=useResolvedUrl(url)
  return (
    <img
      src={resolved || undefined}
      alt={name}
      className="msg-att-img"
      onClick={() => resolved && window.open(resolved, '_blank', 'noopener,noreferrer')}
    />
  )
}

// ── 동영상 첨부 ──────────────────────────────────────────────
function VideoAttachment({ url }: { url: string }) {
  const resolved=useResolvedUrl(url)
  const [playing, setPlaying] = useState(false)
  const thumbRef = useRef<HTMLVideoElement>(null)
  const playRef  = useRef<HTMLVideoElement>(null)

  // WKWebView에서 첫 프레임 썸네일 강제 표시
  const handleMetadata = () => {
    if (thumbRef.current) thumbRef.current.currentTime = 0.1
  }

  const start = () => {
    setPlaying(true)
    setTimeout(() => playRef.current?.play(), 50)
  }

  if (playing) {
    return (
      <div className="msg-att-video-wrap">
        <video
          ref={playRef}
          src={resolved || undefined}
          className="msg-att-video"
          controls
          autoPlay
          playsInline
        />
      </div>
    )
  }

  return (
    <div className="msg-att-video-wrap" onClick={start}>
      <video
        ref={thumbRef}
        src={resolved || undefined}
        className="msg-att-video"
        preload="metadata"
        muted
        playsInline
        onLoadedMetadata={handleMetadata}
      />
      <div className="msg-att-video-overlay">
        <div className="msg-att-play-btn">
          <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  )
}


// ── 오디오 첨부 ──────────────────────────────────────────────
interface TimelineDisplay {
  position?: string
  timecode?: string
  tempo?: string
  meter?: string
  sampleRate?: string
  bitDepth?: string
}

function compactNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function formatTimelineTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = (seconds % 60).toFixed(3).padStart(6, '0')
  return `${String(minutes).padStart(2, '0')}:${remainder}`
}

function formatSampleRate(sampleRate: number): string {
  const khz = sampleRate / 1000
  return `${Number.isInteger(khz) ? khz : Number(khz.toFixed(1))}k`
}

function timelineDisplay(metadata?: AttachmentTimelineMetadata): TimelineDisplay | null {
  if (!metadata) return null
  if (metadata.position.meaning === 'recording_timestamp') return null
  const { position } = metadata
  const tempoPoints = metadata.tempo_map?.slice().sort((a, b) => a.ppq - b.ppq) ?? []
  const signaturePoints = metadata.time_signature_map?.slice().sort((a, b) => a.ppq - b.ppq) ?? []
  const lastTempo = tempoPoints[tempoPoints.length - 1]
  const lastSignature = signaturePoints[signaturePoints.length - 1]
  const inferredPpq = position.ppq ?? lastTempo?.ppq ?? lastSignature?.ppq
  const matchingTempos = inferredPpq == null ? [] : tempoPoints.filter(point => point.ppq <= inferredPpq)
  const matchingSignatures = inferredPpq == null ? [] : signaturePoints.filter(point => point.ppq <= inferredPpq)
  const tempo = inferredPpq == null
    ? lastTempo
    : matchingTempos[matchingTempos.length - 1] ?? tempoPoints[0]
  const signature = inferredPpq == null
    ? lastSignature
    : matchingSignatures[matchingSignatures.length - 1] ?? signaturePoints[0]

  let bar = position.bar
  let beat = position.beat
  if (bar == null && inferredPpq != null && signature) {
    const beatPpq = 4 / signature.denominator
    const barPpq = signature.numerator * beatPpq
    bar = Math.floor(Math.max(0, inferredPpq) / barPpq) + 1
    beat = (Math.max(0, inferredPpq) % barPpq) / beatPpq + 1
  }

  const rawSeconds = position.seconds
  const projectSeconds = rawSeconds == null
    ? undefined
    : Math.max(0, rawSeconds - ((position.source === 'bwf' || position.source === 'ixml') && rawSeconds >= 3600 ? 3600 : 0))
  const display: TimelineDisplay = {
    position: bar != null && beat != null ? `${bar} | ${compactNumber(beat)}` : undefined,
    timecode: projectSeconds != null ? formatTimelineTime(projectSeconds) : undefined,
    tempo: tempo
      ? `${compactNumber(tempo.bpm)} bpm`
      : metadata.bpm ? `${compactNumber(metadata.bpm)} bpm` : undefined,
    meter: signature
      ? `${signature.numerator}/${signature.denominator}`
      : metadata.time_sig_num && metadata.time_sig_den
        ? `${metadata.time_sig_num}/${metadata.time_sig_den}`
        : undefined,
    sampleRate: position.sample_rate ? formatSampleRate(position.sample_rate) : undefined,
    bitDepth: position.bit_depth ? `${position.bit_depth}-bit` : undefined,
  }
  return Object.values(display).some(Boolean) ? display : null
}

function timelineLabel(metadata?: AttachmentTimelineMetadata): string | null {
  const display = timelineDisplay(metadata)
  if (!display) return null
  const parts = ['original position']
  if (display.position) parts.push(`position ${display.position}`)
  if (display.timecode) parts.push(`timecode ${display.timecode}`)
  if (display.tempo) parts.push(display.tempo)
  if (display.meter) parts.push(display.meter)
  if (display.sampleRate) parts.push(display.sampleRate)
  if (display.bitDepth) parts.push(display.bitDepth)
  return parts.join(' · ')
}

function StemPlacement({ metadata }: { metadata?: AttachmentTimelineMetadata }) {
  const display = timelineDisplay(metadata)
  if (!display) return null
  const fields = [
    { label: 'position', value: display.position },
    { label: 'timecode', value: display.timecode },
    { label: 'tempo', value: display.tempo },
    { label: 'meter', value: display.meter },
    { label: 'sample rate', value: display.sampleRate },
    { label: 'bit depth', value: display.bitDepth },
  ].filter((field): field is { label: string; value: string } => !!field.value)

  return (
    <section className={`stem-placement-card ${metadata?.position.confidence ?? 'estimated'}`}>
      <div className="stem-placement-title">
        <span className="stem-placement-pin" />
        <span>original position</span>
      </div>
      <div className="stem-placement-grid">
        {fields.map(field => (
          <div className={`stem-placement-field ${field.label.toLowerCase().replace(' ', '-')}`} key={field.label}>
            <small>{field.label}</small>
            <strong>{field.value}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Optional shared-playback engine ─────────────────────────────────
   A host surface (the studio shell) can provide this context so every
   AudioAttachment's play/seek controls drive ONE shared engine — the
   card becomes a remote control and a docked now-playing bar owns the
   actual <audio>. Default is null: AudioAttachment keeps its own
   per-card <audio> and ChatView's behavior is byte-for-byte unchanged.
   The import-to-DAW / drag-out machinery is independent of playback
   and is untouched in either mode. */
export interface ExternalAudioEngine {
  activeUrl: string | null
  playing: boolean
  current: number
  duration: number
  start: (track: { url: string; name: string }, at?: number) => void
  toggle: () => void
  seekTo: (sec: number) => void
}
export const AudioEngineContext = createContext<ExternalAudioEngine | null>(null)

/** "link" — copies a /listen URL that plays this audio in any browser,
 *  no account, no plug-in. The word becomes "copied" for a beat. */
export function ShareLinkWord({ url, name, from, metadata, square = false }: {
  url: string; name: string; from?: string | null; metadata?: AttachmentTimelineMetadata | null; square?: boolean
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    const ok = await copyText(buildListenUrl({ url, name, from, metadata }))
    setState(ok ? 'copied' : 'failed')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1600)
  }
  const label = state === 'copied' ? 'copied' : state === 'failed' ? 'couldn\'t copy' : 'copy link'
  const title = 'copy a listen link — plays in any browser, no plug-in needed'
  if (square) {
    return (
      <button className={`stem-link-square${state === 'copied' ? ' done' : ''}`} onClick={copy}
        onMouseDown={e => e.stopPropagation()} title={title} aria-label={title}>
        {state === 'copied'
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>}
      </button>
    )
  }
  return (
    <button className={`msg-att-link${state === 'copied' ? ' done' : ''}`} onClick={copy}
      onMouseDown={e => e.stopPropagation()} title={title}>{label}</button>
  )
}

export function AudioAttachment({ url, name, metadata, compact = false, from, previewOnly = false }: { url: string; name: string; metadata?: AttachmentTimelineMetadata; compact?: boolean; from?: string | null; previewOnly?: boolean }) {
  const resolved=useResolvedUrl(url)
  const [playing, setPlaying]     = useState(false)
  const [current, setCurrent]     = useState(0)
  const [duration, setDuration]   = useState(0)
  const [compactExpanded, setCompactExpanded] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  // External shared engine (studio shell). null everywhere else —
  // the card then plays through its own <audio> exactly as before.
  const engine = useContext(AudioEngineContext)
  const engineActive = engine !== null && engine.activeUrl === url
  const shownPlaying = engine ? engineActive && engine.playing : playing
  const shownCurrent = engine ? (engineActive ? engine.current : 0) : current
  // The card's own <audio> still loads metadata, so an inactive card can
  // show its duration before it has ever been played.
  const shownDuration = engine ? ((engineActive && engine.duration) || duration) : duration

  // A detached row must not keep playing its private audio element.
  useEffect(() => () => { audioRef.current?.pause() }, [])

  const toggle = () => {
    if (engine) {
      if (engineActive) engine.toggle()
      else engine.start({ url, name })
      return
    }
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    if (engine) {
      if (!shownDuration) return
      const t = ratio * shownDuration
      if (engineActive) engine.seekTo(t)
      else engine.start({ url, name }, t)
      return
    }
    if (!audioRef.current || !duration) return
    audioRef.current.currentTime = ratio * duration
  }

  const player = (
    <div className="msg-att-audio-player">
      <audio
        ref={audioRef}
        src={resolved || undefined}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
      />
      <button className="msg-att-play-pause" onClick={toggle} aria-label={shownPlaying ? 'Pause' : 'Play'}>
        {shownPlaying
          ? <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          : <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>
        }
      </button>
      <div className="msg-att-progress-track" onClick={seek}>
        <div className="msg-att-progress-fill" style={{ width: shownDuration ? `${(shownCurrent / shownDuration) * 100}%` : '0%' }} />
      </div>
      <span className="msg-att-time">{formatDur(shownCurrent)} / {formatDur(shownDuration)}</span>
    </div>
  )

  if (compact) {
    // Sample-exact stems announce where they belong — the receiver
    // shouldn't have to ask which bar to drop a session take at.
    const position = timelinePositionLabel(metadata)
    return (
      <div className={`msg-att-audio stem-audio-compact${compactExpanded ? ' expanded' : ''}`}>
        <div className="stem-audio-main">
          <span className="stem-audio-name" title={name}>{name}</span>
          {position != null && (
            <span className="stem-audio-bar" title={position.tooltip}>
              {position.text}
            </span>
          )}
          {!previewOnly && <ShareLinkWord url={url} name={name} from={from} metadata={metadata} square />}
          {!previewOnly && <AudioTransferActions tracks={[{ url, name }]} groupKey={url} />}
        </div>
        {compactExpanded && (
          <div className="stem-audio-details">
            {player}
            <StemPlacement metadata={metadata} />
          </div>
        )}
        <button
          className="stem-expand"
          onClick={() => setCompactExpanded(value => !value)}
          aria-expanded={compactExpanded}
          aria-label={compactExpanded ? 'Hide stem details' : 'Show stem details'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 9l5 5 5-5" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="msg-att-audio">
      <div className="msg-att-audio-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        <span className="msg-att-audio-name">{name}</span>
      </div>

      {timelineLabel(metadata) && (
        <div className={`msg-att-timeline ${metadata?.position.confidence ?? 'estimated'}`}>
          <span className="msg-att-timeline-dot" />
          <span>
            {timelineLabel(metadata)}
          </span>
        </div>
      )}

      {player}

      {!previewOnly && <div className="msg-att-row">
      <AudioTransferActions tracks={[{ url, name }]} groupKey={url} />
      <ShareLinkWord url={url} name={name} from={from} metadata={metadata} />
      </div>}
    </div>
  )
}

// ── 첨부 렌더러 ──────────────────────────────────────────────
// ── 멀티 트랙 그룹 첨부 ──────────────────────────────────────
interface TrackInfo { url: string; name: string; metadata?: AttachmentTimelineMetadata }
function AudioGroupAttachment({ tracks, groupUrl }: { tracks: TrackInfo[]; groupUrl: string }) {
  const [expanded, setExpanded] = useState(false)
  return <div className="msg-att-audio-group">
    <div className="msg-att-audio-group-header">
      <span className="msg-att-audio-name">{tracks.length} Tracks</span>
      <ImportAllWord tracks={tracks} groupKey={groupUrl} />
      <button type="button" className="msg-att-group-chevron" aria-expanded={expanded}
        aria-label={expanded ? 'Hide tracks' : 'Show tracks'} onClick={() => setExpanded(value => !value)}>
        {expanded ? '▲' : '▼'}
      </button>
    </div>
    {expanded && <div className="msg-att-group-tracks">
      {tracks.map((track, index) => <AudioAttachment key={`${track.url}:${index}`} {...track} />)}
    </div>}
  </div>
}

/** Single and batch controls share the same downloaded bytes and readiness. */
export function ImportAllWord({ tracks, groupKey, className }: {
  tracks: { url: string; name: string }[]
  groupKey: string
  className?: string
}) {
  return <AudioTransferActions tracks={tracks} groupKey={groupKey} batch className={className} />
}

function ExpiredAttachment({ type, name }: { type: AttachType; name?: string | null }) {
  const { t } = useT()
  const icon = type === 'image' ? '🖼️' : type === 'video' ? '🎬' : type === 'audio' || type === 'multi-audio' ? '🎵' : '📎'
  return (
    <div className="att-expired">
      <span className="att-expired-icon">{icon}</span>
      {name && <span className="att-expired-name">{name}</span>}
      <span className="att-expired-text">{t('chat.fileExpired')}</span>
    </div>
  )
}

// ── Schedule detection — "add to calendar" chips under bubbles ──────────────
// A cheap client-side token sniff decides which messages LOOK like plans;
// Claude (the parse-schedule edge function) is only called when the user
// taps the chip. Keeps the AI out of the hot path — zero cost per message.
const SCHEDULE_HINT = new RegExp(
  [
    '오늘', '내일', '모레', '글피', '(?:이번|다음|다다음|담)\\s*주', '[월화수목금토일]요일',
    '\\d{1,2}\\s*시(?:\\s*반)?', '오전', '오후', '\\d{1,2}월\\s*\\d{1,2}일',
    '\\d{1,2}:\\d{2}', '\\d{1,2}\\s*(?:am|pm)\\b', '\\d{1,2}/\\d{1,2}',
    '\\btoday\\b', '\\btomorrow\\b', '\\btonight\\b', '\\bnext\\s+week\\b',
    '\\b(?:mon|tues?|wednes|thurs?|fri|satur|sun)day\\b',
  ].join('|'),
  'i',
)
export function looksLikeSchedule(text: string): boolean {
  return text.length <= 300 && SCHEDULE_HINT.test(text)
}

const fmtChipWhen = (e: NewCalendarEvent | CalendarEvent) => {
  const d = new Date(e.starts_at)
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  if (e.all_day || !e.starts_at.includes('T')) return day
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return e.all_day ? day : `${day} · ${time}`
}

export function ScheduleChip({
  text, onParse, onSave, onDone,
}: {
  text: string
  onParse: (text: string) => Promise<NewCalendarEvent[]>
  onSave: (events: NewCalendarEvent[]) => Promise<void>
  onDone: () => void
}) {
  const { t } = useT()
  const [state, setState] = useState<'idle' | 'busy' | 'confirm' | 'none' | 'saving' | 'saved'>('idle')
  const [found, setFound] = useState<NewCalendarEvent[]>([])

  const analyze = async () => {
    if (state !== 'idle') return
    setState('busy')
    try {
      const events = await onParse(text)
      if (events.length === 0) { setState('none'); return }
      setFound(events)
      setState('confirm')
    } catch (err) {
      console.error('[ScheduleChip]', err)
      setState('none')
    }
  }

  const save = async () => {
    if (state !== 'confirm') return
    setState('saving')
    try {
      await onSave(found)
      setState('saved')
      setTimeout(onDone, 1400)
    } catch (err) {
      console.error('[ScheduleChip save]', err)
      setState('confirm')
    }
  }

  if (state === 'confirm' || state === 'saving') {
    return (
      <div className="schip-card">
        {found.slice(0, 3).map((e, i) => (
          <div className="schip-ev" key={i}>
            <span className="schip-ev-t">{e.title}</span>
            <span className="schip-ev-w">{fmtChipWhen(e)}{e.location ? ` · ${e.location}` : ''}</span>
          </div>
        ))}
        <div className="schip-actions">
          <button className="schip-save" disabled={state === 'saving'} onClick={save}>
            {t('chatcal.save')}
          </button>
          <button className="schip-x" onClick={onDone} aria-label={t('common.close')}>
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9" /></svg>
          </button>
        </div>
      </div>
    )
  }
  if (state === 'saved') return <div className="schip muted">{t('chatcal.saved')}</div>
  if (state === 'none') return <div className="schip muted">{t('chatcal.noEvents')}</div>
  return (
    <button className="schip" onClick={analyze} disabled={state === 'busy'}>
      <svg viewBox="0 0 16 16" width="10" height="10" fill="none" strokeWidth="1.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="12" height="11" rx="2" />
        <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
      </svg>
      {state === 'busy' ? t('chatcal.reading') : t('chatcal.addChip')}
    </button>
  )
}

// ── Game invite bubble — in-chat invite card ────────────────────────────────
// `url` is the room id, `name` is the game type. Tapping Join asks the
// parent to handle capacity check + room navigation; we just render the
// outcome banner here so users see "Room is full" inline.
function GameInviteBubble ({
  roomId, gameType, isMine, senderName,
  onJoin,
}: {
  roomId: string
  gameType: string
  isMine: boolean
  senderName: string
  onJoin?: (gameType: string, roomId: string) => Promise<GameInviteJoinResult>
}) {
  const { t } = useT()
  const [banner, setBanner] = useState<null | Exclude<GameInviteJoinResult, 'joined'>>(null)
  const [busy, setBusy] = useState(false)

  // Map our internal game type → the user-visible game name via the
  // existing per-game translation key.
  const gameNameKey =
    gameType === 'chess'          ? 'game.chess'
    : gameType === 'falling_blocks' ? 'game.fallingBlocks'
    : gameType === 'poker'        ? 'game.poker'
    : gameType === 'ear_training' ? 'game.earTraining'
    : gameType === 'yacht'        ? 'game.yacht'
    : 'game.chess'
  const gameName = t(gameNameKey as 'game.chess')

  const headline = isMine
    ? t('game.youInvitedToPlay', { game: gameName })
    : `${senderName} ${t('game.invitedYouToPlay', { game: gameName })}`

  const handleJoin = async () => {
    if (!onJoin || busy) return
    setBusy(true)
    const r = await onJoin(gameType, roomId)
    setBusy(false)
    if (r === 'joined') return
    setBanner(r)
  }

  const bannerText =
    banner === 'full'       ? t('game.roomFull')
    : banner === 'already-in' ? t('game.alreadyJoined')
    : banner === 'missing'  ? t('game.roomExpired')
    : null

  return (
    <div className="game-invite-bubble">
      <div className="game-invite-row">
        <div className={`game-invite-icon game-invite-icon-${gameType}`}>
          {gameType === 'chess' ? '♟' : gameType === 'poker' ? '🃏' : gameType === 'falling_blocks' ? '🎮' : '🎧'}
        </div>
        <div className="game-invite-text">{headline}</div>
      </div>
      <button
        className="game-invite-join"
        onClick={handleJoin}
        disabled={busy || banner === 'full' || banner === 'missing'}
      >
        {t('game.joinGame')}
      </button>
      {bannerText && (
        <div className="game-invite-banner">{bannerText}</div>
      )}
    </div>
  )
}

export function ResolvedBundleAudio({ url, name }: { url: string; name: string }) {
  const resolved = useResolvedUrl(url)
  return <AudioAttachment compact previewOnly url={resolved} name={name} />
}

function AttachmentView({ url, type, name, metadata }: { url: string; type: AttachType; name: string; metadata?: AttachmentTimelineMetadata }) {
  if (type === 'image') return <ImageAttachment url={url} name={name} />
  if (type === 'video') return <VideoAttachment url={url} />
  if (type === 'audio') return <AudioAttachment url={url} name={name} metadata={metadata} />
  if (type === 'multi-audio') {
    let tracks: TrackInfo[] = []
    try { tracks = JSON.parse(url) } catch {}
    if (Array.isArray(tracks) && (tracks[0] as { regionBundle?: unknown })?.regionBundle)
      return <RegionBundleAttachment value={tracks} renderAudio={entry =>
        <ResolvedBundleAudio url={entry.url} name={entry.name} />} />
    if (Array.isArray(tracks) && tracks.length > 0) return <AudioGroupAttachment tracks={tracks} groupUrl={url} />
  }
  return null
}

// ── 메인 ChatView ─────────────────────────────────────────────
export default function ChatView({ supabase, currentUserId, otherProfile, groupHeader, messages, loading, otherIsLive, otherLiveTitle, onJoinLive, groupMembers, reads, onOpenSettings, onOpenStems, onOpenCalendar, onCloseCalendar, stemsActive, sidePanelCloseNonce, onStemDrop, onSend, onBack, onJoinGameInvite, conversationId, groupTitleById }: Props) {
  const { t } = useT()
  const [input, setInput]         = useState('')

  // ── In-chat calendar ──────────────────────────────────────────────────
  // Plans live next to the conversation that made them: the header glyph
  // opens a slide-over scoped to this conversation's shared events, and
  // schedule-looking messages grow an "add to calendar" chip.
  const [chatCalOpen, setChatCalOpen] = useState(false)
  const openingCalendarFromStemsRef = useRef(false)
  const closeChatCalendar = useCallback((options?: { restoreSize?: boolean; preserveRestore?: boolean }) => {
    setChatCalOpen(false)
    onCloseCalendar?.(options)
  }, [onCloseCalendar])
  useEffect(() => {
    if (!stemsActive || !chatCalOpen) return
    if (openingCalendarFromStemsRef.current) {
      openingCalendarFromStemsRef.current = false
      return
    }
    closeChatCalendar({ restoreSize: false })
  }, [chatCalOpen, closeChatCalendar, stemsActive])
  useEffect(() => {
    openingCalendarFromStemsRef.current = false
    setChatCalOpen(false)
  }, [sidePanelCloseNonce])
  const { events: allCalEvents, addEvents: calAddEvents, deleteEvent: calDeleteEvent, updateEvent: calUpdateEvent } = useCalendarEvents(supabase, currentUserId)
  const { categories: calCategories, ensureCategory: calEnsureCategory, renameCategory: calRenameCategory, deleteCategory: calDeleteCategory } = useEventCategories(supabase, currentUserId)
  const chatTitle = groupHeader?.title ?? otherProfile?.display_name ?? ''
  // The panel shows the user's WHOLE schedule (same pool as the app) —
  // Steven: any chat's calendar is MY calendar; only writes are scoped
  // to this conversation.
  // Header badge = plans from today onward; past ones stay in the panel.
  const upcomingCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return allCalEvents.filter(e => new Date(e.starts_at) >= today).length
  }, [allCalEvents])
  const chatGroupTitleById = useMemo(() => {
    const m = new Map<string, string>(groupTitleById ?? [])
    if (conversationId && !m.has(conversationId)) m.set(conversationId, chatTitle)
    return m
  }, [groupTitleById, conversationId, chatTitle])
  // Chip verdicts survive reloads so an already-saved (or waved-off)
  // message doesn't re-offer itself forever.
  const [chipDone, setChipDone] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('orb_cal_chip_done') ?? '[]') as string[]) }
    catch { return new Set() }
  })
  const markChipDone = (msgId: string) => {
    setChipDone(prev => {
      const next = new Set(prev)
      next.add(msgId)
      try { localStorage.setItem('orb_cal_chip_done', JSON.stringify([...next].slice(-200))) } catch { /* full/blocked */ }
      return next
    })
  }
  const parseChatSchedule = (text: string) => parseSchedule(supabase, text)
  const saveChatEvents = async (list: NewCalendarEvent[]): Promise<CalendarEvent[]> => {
    const withMeta = await Promise.all(list.map(async e => ({
      ...e,
      category_color: await calEnsureCategory(e.category),
      conversation_id: conversationId ?? null,
    })))
    return calAddEvents(withMeta)
  }
  const [sendError, setSendError] = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadErrMsg, setUploadErrMsg] = useState('')

  useEffect(() => { initAudioTimelineTracking() }, [])

  // In-flight uploads — rendered as optimistic ghost bubbles in the chat with
  // their own progress bar so the user can see the file is actually moving.
  interface PendingUpload {
    id: string
    name: string
    type: AttachType
    size: number
    progress: number     // 0–1
  }
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])

  // iMessage-style pop animation: any message ID we haven't seen
  // before during this mount gets `.mg-pop` for its first paint.
  // Initial-load messages are marked seen WITHOUT animating so the
  // first chat opening doesn't scale-in every history bubble.
  const seenMsgIdsRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)
  useEffect(() => {
    for (const m of messages) seenMsgIdsRef.current.add(m.id)
    initializedRef.current = true
  }, [messages])

  const updatePendingProgress = (id: string, progress: number) => {
    setPendingUploads(prev => prev.map(p => p.id === id ? { ...p, progress } : p))
  }
  const removePending = (id: string) => {
    setPendingUploads(prev => prev.filter(p => p.id !== id))
  }
  const [, setDragOver]   = useState(false)
  const [, setDragType]   = useState<'attach' | 'cancel'>('attach')
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const imgRef  = useRef<HTMLInputElement>(null)
  const vidRef  = useRef<HTMLInputElement>(null)
  const audRef  = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dragCounter          = useRef(0)
  const outDragActive        = useRef(false)  // true while our own drag is "out"
  const outDragArmedUrl      = useRef<string | null>(null)  // URL of the currently armed drag
  const isCancelDrag         = useRef(false)  // set by C++ __juceDragEnterCancel
  const juceDragIsActive     = useRef(false)  // true while C++ is managing the overlay
  const outDragCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropTimelineRef      = useRef<AttachmentTimelineMetadata | null>(null)
  const dropTimelinePromiseRef = useRef<Promise<AttachmentTimelineMetadata | null> | null>(null)

  // ── C++ drop-in: Logic region → chat attachment ───────────────────────────
  // C++ resolves the NSFilePromise (Logic's async export), then fires
  // '__juceFileDrop' with base64-encoded audio data.

  // Buffer for grouping multiple __juceFileDrop events from a single Logic drag.
  // C++ fires __juceDropGroupStart{count} first so we know how many to expect.
  // Promises resolve on a concurrent queue, so events arrive in COMPLETION
  // order; newer binaries stamp each detail with `seq` (drag order at drop
  // registration) and the flush sorts by it. Old binaries keep arrival order.
  const dropBuffer        = useRef<{ name: string; data: string; seq?: number }[]>([])
  const dropGroupCount    = useRef(1)
  const dropLogicCapture = useRef<string | null>(null)
  const captureLogicDrop = useLogicDropCapture()
  const captureLogicDropRef = useRef(captureLogicDrop); captureLogicDropRef.current = captureLogicDrop
  const attachAudioRef = useRef<(files: File[]) => Promise<void>>(async () => {})
  const dropRejected = useRef(false)
  const conversationKey = JSON.stringify([conversationId, otherProfile?.id])
  const conversationRef = useRef(conversationKey); conversationRef.current = conversationKey
  const dropConversation = useRef(conversationKey)
  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  const processMultiDropRef = useRef<(files: { name: string; data: string }[]) => Promise<void>>(async () => {})

  // __juceDragComplete: fired by C++ the instant performDragOperation: is
  // called, before the async file export finishes.  Dismisses the overlay
  // immediately so the UI doesn't stay frozen while Logic exports the region.
  useEffect(() => {
    const handler = () => {
      juceDragIsActive.current = false
      isCancelDrag.current = false
      dragCounter.current = 0
      setDragOver(false)
    }
    window.addEventListener('__juceDragComplete', handler)
    return () => window.removeEventListener('__juceDragComplete', handler)
  }, [])

  // __juceDropGroupStart: C++ announces the total file count before delivering
  // individual __juceFileDrop events, so JS can batch them into one message.
  useEffect(() => {
    const handler = (e: Event) => {
      dropGroupCount.current = (e as CustomEvent<{ count: number }>).detail?.count ?? 1
      dropLogicCapture.current = (e as CustomEvent).detail?.logicCaptureId ?? null
      dropBuffer.current = []
      dropRejected.current = false
      dropConversation.current = conversationRef.current
      // Freeze the host context at the actual drop, before async file promises
      // and uploads introduce seconds of delay.
      dropTimelineRef.current = getDawTimelineSnapshot()
      dropTimelinePromiseRef.current = refreshDawTimelineSnapshot()
    }
    window.addEventListener('__juceDropGroupStart', handler)
    return () => window.removeEventListener('__juceDropGroupStart', handler)
  }, [])

  // __juceFileDrop: C++ delivers one resolved file per event.
  // When all expected files have arrived, upload and send as one message.
  useEffect(() => {
    const flush = async () => {
      // Wait until all files from this drag are collected
      if (dropBuffer.current.length < dropGroupCount.current) return

      const all = dropBuffer.current
      const logicCaptureId = dropLogicCapture.current
      dropLogicCapture.current = null
      const destinationAtDrop = dropConversation.current
      dropBuffer.current = []
      dropGroupCount.current = 1
      if (all.every(f => Number.isFinite(f.seq)))
        all.sort((a, b) => a.seq! - b.seq!)
      if (dropRejected.current || dropConversation.current !== conversationRef.current) return

      // A region over the drag limit stops here, out loud (base64 size
      // ≈ 1.33× the file; newer plug-in builds reject it natively).
      const batch = all.filter(f => {
        const bytes = Math.floor(f.data.length * 3 / 4)
        if (bytes <= DAW_FILE_LIMIT) return true
        showErrRef.current(`${f.name} (${fmtBytes(bytes)}) is over ${fmtBytes(DAW_FILE_LIMIT)}, the limit for regions dragged from the daw — export it and drop the file instead`)
        return false
      })
      if (batch.length === 0 || batch.length !== all.length) return

      if (logicCaptureId) {
        try {
          const files = await captureLogicDropRef.current(batch.map(r => regionToFile(r.name, r.data)), logicCaptureId)
          if (!mountedRef.current || destinationAtDrop !== conversationRef.current) return
          if (onStemDrop) onStemDrop({ id: `logic-${crypto.randomUUID()}`, files, fallbackMetadata: null })
          else await attachAudioRef.current(files)
        } catch (error) { showErrRef.current(error instanceof Error ? error.message : 'Could not read Logic region positions.') }
        return
      }

      if (onStemDrop) {
        const destination = conversationRef.current
        const freshTimeline = await (dropTimelinePromiseRef.current ?? refreshDawTimelineSnapshot())
        if (destination !== conversationRef.current) return
        onStemDrop({
          id: `native-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          nativeFiles: batch,
          fallbackMetadata: freshTimeline ?? dropTimelineRef.current,
        })
        dropTimelineRef.current = null
        dropTimelinePromiseRef.current = null
        return
      }

      await processMultiDropRef.current(batch)
    }
    const onFile = (e: Event) => {
      if (outDragActive.current) return
      const { name, data, seq } = (e as CustomEvent<{ name: string; data: string; seq?: number }>).detail
      dropBuffer.current.push({ name, data, seq })
      void flush()
    }
    // The native side skipped a file over the drag limit; it still
    // counts toward the group so the rest of the drop isn't left waiting.
    const onRejected = (e: Event) => {
      dropRejected.current = true
      const { name, size, limit } = (e as CustomEvent<{ name: string; size: number; limit: number }>).detail
      showErrRef.current(`${name} (${fmtBytes(size)}) is over ${fmtBytes(limit)}, the limit for regions dragged from the daw — export it and drop the file instead`)
      dropGroupCount.current = Math.max(0, dropGroupCount.current - 1)
      void flush()
    }
    window.addEventListener('__juceFileDrop', onFile)
    window.addEventListener('__juceFileDropRejected', onRejected)
    return () => {
      window.removeEventListener('__juceFileDrop', onFile)
      window.removeEventListener('__juceFileDropRejected', onRejected)
    }
  }, [onStemDrop])

  // __localDragArmed: AudioAttachment dispatches this (in JS) the moment a
  // drag-out file is ready to drag.  More reliable than __juceOutDragStart
  // (which fires via evaluateJavaScript: during a drag run-loop mode and may
  // be deferred).  Sets outDragActive immediately in JS context.
  useEffect(() => {
    const handler = (e: Event) => {
      outDragActive.current = true
      outDragArmedUrl.current = (e as CustomEvent<{ url: string }>).detail?.url ?? null
    }
    window.addEventListener('__localDragArmed', handler)
    return () => window.removeEventListener('__localDragArmed', handler)
  }, [])

  // __juceDragEnterCancel: C++ fires this when our OWN audio drag-out re-enters
  // the chat view (NSDraggingSession still active, gDragHelper.isDragging=YES).
  // Also fired every 100 ms from draggingUpdated: as a keep-alive heartbeat.
  useEffect(() => {
    const handler = () => {
      juceDragIsActive.current = true
      isCancelDrag.current = true
      setDragType('cancel')
      dragCounter.current = 1
      setDragOver(true)
    }
    window.addEventListener('__juceDragEnterCancel', handler)
    return () => window.removeEventListener('__juceDragEnterCancel', handler)
  }, [])

  // __juceDragEnter: C++ fires this for Logic region drags (or when our drag
  // was taken over by Logic — isDragging=NO but outDragActive still true).
  // Also fired every 100 ms from draggingUpdated: as a keep-alive heartbeat.
  useEffect(() => {
    const handler = () => {
      juceDragIsActive.current = true
      // If we recently dragged something out (Logic took it and started its
      // own session), treat the returning drag as a cancel.
      if (outDragActive.current) {
        isCancelDrag.current = true
        setDragType('cancel')
      } else {
        isCancelDrag.current = false
        setDragType('attach')
      }
      dragCounter.current = 1
      setDragOver(true)
    }
    window.addEventListener('__juceDragEnter', handler)
    return () => window.removeEventListener('__juceDragEnter', handler)
  }, [])

  // __juceDragExit: C++ fires this after a 250 ms dispatch_after delay.
  // The delay is cancelled at the C++ level by draggingEntered:/draggingUpdated:
  // so spurious sub-view crossings never reach JS.  When this event arrives
  // in JS, the drag has truly left — hide the overlay immediately.
  useEffect(() => {
    const handler = () => {
      juceDragIsActive.current = false
      isCancelDrag.current = false
      dragCounter.current = 0
      setDragOver(false)
    }
    window.addEventListener('__juceDragExit', handler)
    return () => window.removeEventListener('__juceDragExit', handler)
  }, [])

  // __juceOutDragStart: our own audio drag-out has begun (mousedown → NSDraggingSession)
  useEffect(() => {
    const handler = () => { outDragActive.current = true }
    window.addEventListener('__juceOutDragStart', handler)
    return () => window.removeEventListener('__juceOutDragStart', handler)
  }, [])

  // __juceOutDragEnd: NSDraggingSession ended.
  //  op='none'  → user released without a target → clear outDragActive immediately
  //  op='copy'  → Logic (or other target) accepted the file.  Logic may immediately
  //               start its own NSDraggingSession with our audio, so keep
  //               outDragActive=true for 30 s to catch it coming back.
  useEffect(() => {
    const handler = (e: Event) => {
      const op  = (e as CustomEvent<{ op: string }>).detail?.op ?? 'none'
      const armedUrl = outDragArmedUrl.current
      isCancelDrag.current = false
      dragCounter.current  = 0
      setDragOver(false)

      if (op === 'none') {
        // 취소: outDragActive 즉시 해제, 해당 AudioAttachment를 idle로 복원
        outDragActive.current    = false
        outDragArmedUrl.current  = null
        if (outDragCooldownTimer.current) { clearTimeout(outDragCooldownTimer.current); outDragCooldownTimer.current = null }
        if (armedUrl)
          window.dispatchEvent(new CustomEvent('__juceOutDragCancel', { detail: { url: armedUrl } }))
      } else {
        // 성공: outDragActive를 30s 유지(Logic이 바로 drag를 시작할 수 있음)
        // 해당 AudioAttachment를 'imported' 상태로 전환 (버튼 유지)
        if (armedUrl)
          window.dispatchEvent(new CustomEvent('__juceImported', { detail: { url: armedUrl } }))
        if (outDragCooldownTimer.current) clearTimeout(outDragCooldownTimer.current)
        outDragCooldownTimer.current = setTimeout(() => {
          outDragActive.current   = false
          outDragArmedUrl.current = null
          outDragCooldownTimer.current = null
        }, 30_000)   // 30 s: Logic may start its own drag and the user can take time
      }
    }
    window.addEventListener('__juceOutDragEnd', handler)
    return () => window.removeEventListener('__juceOutDragEnd', handler)
  }, [])
  // ─────────────────────────────────────────────────────────────────────────

  // Are we (roughly) pinned to the bottom right now? Used to decide
  // whether async content growth should re-pin. Generous threshold so a
  // few px of rounding doesn't count as "scrolled up".
  const NEAR_BOTTOM_PX = 120
  const isNearBottom = (el: HTMLElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX

  // Tracks whether the user has deliberately scrolled up to read older
  // messages — while true we DON'T yank them back to the bottom when
  // late content (images, link previews) grows the list.
  const stickToBottomRef = useRef(true)

  // On message-list change, jump to the bottom and re-arm sticking.
  // New messages / opening a chat both land here.
  useEffect(() => {
    const el = chatAreaRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    stickToBottomRef.current = true
  }, [messages, pendingUploads])

  // Keep the view pinned to the bottom while late-loading content
  // (async images, link-preview cards that fetch OG data, game-invite
  // bubbles) grows the scroll height AFTER the initial scroll fired.
  // Without this, opening a chat whose newest messages contain a link
  // or attachment leaves you stranded just above the real bottom —
  // most visible when entering from a notification (incoming messages
  // are exactly the ones with that kind of content).
  useEffect(() => {
    const el = chatAreaRef.current
    if (!el) return
    // Note when the user scrolls away from / back to the bottom.
    const onScroll = () => { stickToBottomRef.current = isNearBottom(el) }
    el.addEventListener('scroll', onScroll, { passive: true })
    // Re-pin on any content resize, but only if we were at the bottom.
    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    // Observe direct children too — the container's own box may not
    // change when an inner card expands, but a child's will.
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect() }
  }, [messages])

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Cap raised after migrating to Cloudflare R2 (which has 5TB per-object limit
  // and free egress) — most audio sessions/stems are well under 1GB.
  const MAX_SIZE_MB = 1000
  const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024

  const showErrRef = useRef<(msg: string) => void>(() => {})
  const showErr = (msg: string) => {
    setUploadErrMsg(msg)
    setSendError(true)
    setTimeout(() => { setSendError(false); setUploadErrMsg('') }, 3000)
  }
  showErrRef.current = showErr


  // Upload via Cloudflare R2 with progress tracking:
  //   1. Push a 0% pending-upload row so a ghost bubble appears immediately.
  //   2. Ask our Edge Function for a presigned PUT URL.
  //   3. XHR PUT to R2 — XMLHttpRequest exposes upload.onprogress, fetch doesn't.
  //   4. Tick the progress in state; remove the row on success/failure.
  const uploadFile = async (file: File, type: AttachType): Promise<Attachment | null> => {
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setPendingUploads(prev => [...prev, {
      id: pendingId, name: file.name, type, size: file.size, progress: 0,
    }])

    try {
      const { url: publicUrl } = await uploadSecureFile(supabase, file, { onProgress: p => updatePendingProgress(pendingId, p) })
      removePending(pendingId)
      return { url: publicUrl, type, name: file.name }
    } catch (e) {
      console.error('[upload] error:', e)
      removePending(pendingId)
      return null
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, type: AttachType) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setMenuOpen(false)

    if (type === 'audio' && (files.length > 1 || files.some(isRegionArchive))) {
      await attachAudioFiles(files)
      if (e.target) e.target.value = ''
      return
    }

    // 단일 파일
    const file = files[0]
    if (file.size > MAX_SIZE) {
      showErr(`File too large (max ${MAX_SIZE_MB}MB)`)
      if (e.target) e.target.value = ''
      return
    }

    setUploading(true)
    const att = await uploadFile(file, type)
    setUploading(false)
    if (!att) {
      showErr('upload failed — check the file size or your connection.')
    } else {
      await onSend('', att)
    }
    if (e.target) e.target.value = ''
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const val = input
    setInput('')
    const ok = await onSend(val)
    if (!ok) {
      setSendError(true)
      setTimeout(() => setSendError(false), 2500)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const processDroppedFile = async (file: File, metadata?: AttachmentTimelineMetadata) => {
    if (isRegionArchive(file)) { await attachAudioFiles([file]); return }
    const mime = file.type
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? ''
    const AUDIO_EXTS = new Set(['mp3','wav','aif','aiff','m4a','ogg','flac','caf','opus','aac'])
    let type: AttachType
    if      (mime.startsWith('image/'))                            type = 'image'
    else if (mime.startsWith('video/'))                            type = 'video'
    else if (mime.startsWith('audio/') || AUDIO_EXTS.has(ext))    type = 'audio'
    else { showErr('only image, video, or audio files can be sent.'); return }

    if (file.size > MAX_SIZE) { showErr(`File too large (max ${MAX_SIZE_MB}MB)`); return }

    setUploading(true)
    const att = await uploadFile(file, type)
    setUploading(false)
    if (!att) showErr('upload failed — check the file size or your connection.')
    else await onSend('', { ...att, metadata })
  }

  // Upload the complete drop without merging or inferring source tracks.
  const attachAudioFiles = async (files: File[]) => {
    const destination = conversationRef.current
    setUploading(true)
    try {
      if (files.some(f => f.size > MAX_SIZE)) throw new Error(`File too large (max ${MAX_SIZE_MB}MB). The bundle was not sent.`)
      const attachment = await createRegionBundleAttachment(files, file => uploadFile(file, 'audio'))
      if (!mountedRef.current || destination !== conversationRef.current) throw new Error('Conversation changed. The bundle was not sent.')
      if (!await onSend('', attachment)) showErr('The region bundle was not sent. Please try again.')
    } catch (error) { showErr(error instanceof Error ? error.message : 'Could not send the region bundle.') }
    finally { setUploading(false); dropTimelineRef.current = null }
  }

  const attachDroppedBatch = async (batch: { name: string; data: string }[]) => {
    try { await attachAudioFiles(batch.map(r => regionToFile(r.name, r.data))) }
    catch { showErr('Could not read the region bundle.') }
  }
  useEffect(() => { attachAudioRef.current = attachAudioFiles })
  useEffect(() => { processMultiDropRef.current = attachDroppedBatch })

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    // If C++ is already managing the overlay type, don't override it.
    // Otherwise: if our own drag is "out" (Logic returned it as plain URL),
    // show the cancel overlay; for all other cases show attach.
    if (!juceDragIsActive.current) {
      if (outDragActive.current) {
        setDragType('cancel')
      } else {
        setDragType('attach')
      }
    }
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // When C++ is managing the overlay (Logic or own drag), JS dragleave events
    // are unreliable (relatedTarget=null for NSFilePromise drags) and must be
    // ignored.  C++ dispatch_after(250ms) handles the actual exit timing.
    if (juceDragIsActive.current) return
    // For regular file drags (Finder etc.): ignore if still inside the zone
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    dragCounter.current = 0
    setDragOver(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    const wasCancel = isCancelDrag.current
    isCancelDrag.current = false
    setDragOver(false)

    if (wasCancel || outDragActive.current) return

    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length === 0) return
    if (files.some(isRegionArchive)) { await attachAudioFiles(files); return }

    // macOS Finder 드래그 시 MIME type이 비어있거나 잘못 올 수 있어서 확장자도 함께 체크
    const AUDIO_EXTS = new Set(['mp3','wav','aif','aiff','m4a','ogg','flac','caf','opus','aac'])
    const isAudioFile = (f: File) =>
      f.type.startsWith('audio/') ||
      AUDIO_EXTS.has(f.name.split('.').pop()?.toLowerCase() ?? '')

    const audioFiles = files.filter(isAudioFile)
    const otherFiles = files.filter(f => !isAudioFile(f))

    if (audioFiles.length > 0 && onStemDrop) {
      const destination = conversationRef.current
      const freshTimeline = await refreshDawTimelineSnapshot()
      if (destination !== conversationRef.current) return
      onStemDrop({
        id: `files-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        files: audioFiles,
        fallbackMetadata: freshTimeline ?? getDawTimelineSnapshot(),
      })
    } else if (audioFiles.length > 0) await attachAudioFiles(audioFiles)

    // Images and video remain regular chat attachments.
    for (const file of otherFiles) await processDroppedFile(file)
  }

  // 날짜별 그룹 구분선
  const groups: Array<{ type: 'ts'; label: string } | { type: 'msg'; msg: Message }> = []
  let lastDate = ''
  for (const msg of messages) {
    const dateLabel = formatDate(msg.created_at, t('chat.dateToday'))
    if (dateLabel !== lastDate) {
      groups.push({ type: 'ts', label: dateLabel })
      lastDate = dateLabel
    }
    groups.push({ type: 'msg', msg })
  }

  return (
    <div
      className={`chat-drop-zone${chatCalOpen ? ' cal-open' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <FloatingOrbs count={28} />
      {/* Sub-bar */}
      <div className="csub">
        <div className="back" onClick={() => { if (chatCalOpen) closeChatCalendar(); onBack() }}>&#8249;</div>
        {groupHeader ? (
          <div
            className="chdr-tap"
            onClick={onOpenSettings}
            role={onOpenSettings ? 'button' : undefined}
            tabIndex={onOpenSettings ? 0 : undefined}
          >
            <div
              className="chdr-av chdr-av-group"
              style={{ background: groupHeader.color }}
              aria-label="Group"
            >
              {/* Simple cluster glyph — a small constellation, mirroring
                  the orb visual. Stand-in until Phase-5 polish swaps in
                  member-avatar mini-stack. */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="9" r="2.2" fill="#fff" stroke="none" />
                <circle cx="18" cy="9" r="2.2" fill="#fff" stroke="none" />
                <circle cx="12" cy="17" r="2.2" fill="#fff" stroke="none" />
                <path d="M6 9 L18 9 M6 9 L12 17 M18 9 L12 17" opacity="0.55" />
              </svg>
            </div>
            <div className="chdr-info">
              <div className="chdr-name">{groupHeader.title}</div>
              <div className="chdr-sub">{groupHeader.memberCount} members</div>
            </div>
          </div>
        ) : otherProfile ? (
          <>
            <div
              className="chdr-tap"
              onClick={onOpenSettings}
              role={onOpenSettings ? 'button' : undefined}
              tabIndex={onOpenSettings ? 0 : undefined}
            >
              <div className="chdr-av" style={{ background: otherProfile.avatar_color }}>
                {otherProfile.avatar_url
                  ? <img src={otherProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : otherProfile.initials}
                <div className={`chdr-dot ${otherIsLive ? 'dlive' : otherProfile.isOnline ? 'don' : 'doff'}`} />
              </div>
              <div className="chdr-info">
                <div className="chdr-name" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {otherProfile.display_name}
                  {otherProfile.is_verified && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
                      <path d="M6.5 12.5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="chdr-sub">
                  {otherIsLive
                    ? <>
                        <span className="chdr-live-tag">{t('chat.headerOnLive')}</span>
                        {otherLiveTitle && (
                          <span className="chdr-live-title" title={otherLiveTitle}>{otherLiveTitle}</span>
                        )}
                      </>
                    : otherProfile.isOnline ? t('common.online') : t('common.offline')}
                </div>
              </div>
            </div>
            {otherIsLive && onJoinLive && (
              <button
                type="button"
                className="chdr-join-btn"
                onClick={e => { e.stopPropagation(); onJoinLive() }}
              >
                {t('chat.joinLive')}
              </button>
            )}
          </>
        ) : null}
        {conversationId && (
          <div
            className={`chdr-cal${chatCalOpen ? ' active' : ''}`}
            onClick={() => {
              setChatCalOpen(open => {
                const next = !open
                if (next) {
                  if (stemsActive) openingCalendarFromStemsRef.current = true
                  onOpenCalendar?.()
                }
                else onCloseCalendar?.()
                return next
              })
            }}
            title={t('chatcal.title')}
            role="button"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" strokeWidth="1.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="12" height="11" rx="2" />
              <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
            </svg>
            {upcomingCount > 0 && <span className="chdr-cal-count">{upcomingCount}</span>}
          </div>
        )}
        {(groupHeader || otherProfile) && onOpenStems && (
          <button
            type="button"
            className={`chdr-stems-btn${stemsActive ? ' active' : ''}`}
            onClick={event => {
              event.stopPropagation()
              if (chatCalOpen) closeChatCalendar({ restoreSize: false, preserveRestore: true })
              onOpenStems()
            }}
          >
            Stems ››
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="chat-area" ref={chatAreaRef}>
        {loading && <div className="collab-loading" style={{ flex: 'unset' }}>Loading...</div>}
        {(() => {
          // Profile pool for sender-chip + read-by avatar lookups.
          const readerCandidates: Profile[] = groupMembers
            ?? (otherProfile ? [otherProfile] : [])
          // Per-message read receipts, iMessage-style: each reader's
          // avatar appears once, anchored to the LATEST of my messages
          // their last_seen_at covers. As they read further the avatar
          // moves forward to the next message. Quiet and informative —
          // beats clumping every reader under the last bubble.
          const readersByMsgId = new Map<string, Profile[]>()
          if (reads) {
            // `messages` arrives chronological (asc). Walk my messages in
            // that order so the last assignment per reader is naturally
            // their latest-read.
            const mineMsgs = messages.filter(m => m.sender_id === currentUserId)
            for (const reader of readerCandidates) {
              const readerTs = reads.get(reader.id) ?? 0
              if (readerTs <= 0) continue
              let lastReadId: string | null = null
              for (const m of mineMsgs) {
                if (new Date(m.created_at).getTime() <= readerTs) lastReadId = m.id
                else break
              }
              if (lastReadId) {
                const arr = readersByMsgId.get(lastReadId) ?? []
                arr.push(reader)
                readersByMsgId.set(lastReadId, arr)
              }
            }
          }
          return groups.map((g, i) => {
            if (g.type === 'ts') return <div key={i} className="ts">{g.label}</div>
            const isMine = g.msg.sender_id === currentUserId
            // First-in-burst: previous group is a timestamp OR a different
            // sender. Drives the sender chip on group `theirs` messages.
            const prev = i > 0 ? groups[i - 1] : null
            const isFirstFromSender = !prev || prev.type === 'ts' || prev.msg.sender_id !== g.msg.sender_id
            const senderProfile = (!isMine && groupHeader)
              ? (groupMembers?.find(m => m.id === g.msg.sender_id) ?? null)
              : null
            const showSenderChip = !!senderProfile && isFirstFromSender
            const readers = isMine ? (readersByMsgId.get(g.msg.id) ?? []) : []
            return (
              <div
                key={g.msg.id}
                className={`mg ${isMine ? 'mine' : 'theirs'}${
                  initializedRef.current && !seenMsgIdsRef.current.has(g.msg.id) ? ' mg-pop' : ''
                }${showSenderChip ? ' mg-with-sender' : ''}`}
              >
                {showSenderChip && senderProfile && (
                  <div className="mg-sender">
                    <div className="mg-sender-av" style={{ background: senderProfile.avatar_color }}>
                      {senderProfile.avatar_url
                        ? <img src={senderProfile.avatar_url} alt="" />
                        : <span>{senderProfile.initials.slice(0, 1)}</span>}
                    </div>
                    <span className="mg-sender-name">{senderProfile.display_name}</span>
                  </div>
                )}
                {g.msg.attachment_type === 'game_invite' && g.msg.attachment_url && g.msg.attachment_name && (
                  <GameInviteBubble
                    roomId={g.msg.attachment_url}
                    gameType={g.msg.attachment_name}
                    isMine={isMine}
                    senderName={senderProfile?.display_name ?? otherProfile?.display_name ?? ''}
                    onJoin={onJoinGameInvite}
                  />
                )}
                {g.msg.attachment_type && g.msg.attachment_type !== 'game_invite' && (
                  g.msg.attachment_expired
                    ? <ExpiredAttachment type={g.msg.attachment_type} name={g.msg.attachment_name} />
                    : g.msg.attachment_url
                      ? <AttachmentView
                          url={g.msg.attachment_url}
                          type={g.msg.attachment_type}
                          name={g.msg.attachment_name ?? ''}
                          metadata={g.msg.attachment_metadata ?? undefined}
                        />
                      : null
                )}
                {g.msg.content && <div className="mb">{linkify(g.msg.content)}</div>}
                {!g.msg.private && g.msg.content && firstUrl(g.msg.content) && (
                  <LinkPreviewCard url={firstUrl(g.msg.content)!} />
                )}
                {!g.msg.private && g.msg.content && conversationId && !chipDone.has(g.msg.id) && looksLikeSchedule(g.msg.content) && (
                  <ScheduleChip
                    text={g.msg.content}
                    onParse={parseChatSchedule}
                    onSave={async evs => { await saveChatEvents(evs) }}
                    onDone={() => markChipDone(g.msg.id)}
                  />
                )}
                <div className="mtime">
                  <span>{formatTime(g.msg.created_at)}</span>
                  {g.msg.pending && <span role="status">Sending...</span>}
                  {isMine && !g.msg.pending && readers.length > 0 && (
                    groupHeader ? (
                      <span
                        className="mg-readby"
                        title={`read by ${readers.map(r => r.display_name).join(', ')}`}
                      >
                        {readers.slice(0, 4).map(r => (
                          <span
                            key={r.id}
                            className="mg-readby-av"
                            style={{ background: r.avatar_color }}
                          >
                            {r.avatar_url
                              ? <img src={r.avatar_url} alt="" />
                              : <span>{r.initials.slice(0, 1)}</span>}
                          </span>
                        ))}
                        {readers.length > 4 && (
                          <span className="mg-readby-more">+{readers.length - 4}</span>
                        )}
                      </span>
                    ) : (
                      <span className="mg-read" title={`Read by ${readers[0].display_name}`}>
                        read
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>
                      </span>
                    )
                  )}
                </div>
              </div>
            )
          })
        })()}

        {/* Ghost bubbles for in-flight uploads — always shown as 'mine'.
            Animated in so the attachment bubble has the same "sent" beat
            as a text message. */}
        {pendingUploads.map(p => (
          <div key={p.id} className="mg mine mg-pop">
            <div className="msg-att-pending">
              <div className="msg-att-pending-row">
                <svg className="msg-att-pending-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {p.type === 'image'
                    ? <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>
                    : p.type === 'video'
                      ? <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></>
                      : <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>}
                </svg>
                <span className="msg-att-pending-name">{p.name}</span>
                <span className="msg-att-pending-pct">{Math.round(p.progress * 100)}%</span>
              </div>
              <div className="msg-att-pending-bar">
                <div className="msg-att-pending-bar-fill" style={{ width: `${Math.round(p.progress * 100)}%` }} />
              </div>
              <div className="msg-att-pending-size">
                {formatBytes(Math.round(p.progress * p.size))} / {formatBytes(p.size)}
              </div>
            </div>
          </div>
        ))}

        {messages.length === 0 && !loading && pendingUploads.length === 0 && (
          <div className="collab-loading" style={{ flex: 'unset', marginTop: 40 }}>
            {t('chat.noMessages')}
          </div>
        )}
      </div>

      {/* 전송/업로드 실패 토스트 */}
      {sendError && (
        <div className="send-error-toast">
          {uploadErrMsg || t('chat.sendFailed')}
        </div>
      )}

      {/* + 메뉴 팝업 */}
      {menuOpen && (
        <div className="attach-menu" ref={menuRef}>
          <button className="attach-menu-item" onClick={() => { imgRef.current?.click() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            {t('chat.attachPhoto')}
          </button>
          <button className="attach-menu-item" onClick={() => { vidRef.current?.click() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9l5-3v12l-5-3V9z"/>
            </svg>
            {t('chat.attachVideo')}
          </button>
          <button className="attach-menu-item" onClick={() => { audRef.current?.click() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            {t('chat.attachAudio')}
          </button>
        </div>
      )}


      {/* Input bar */}
      <div className="input-bar">
        <CaptureRegionsButton key={conversationId} className="attach-btn"
          onCapture={file => attachAudioFiles([file])} onError={showErr} />
        <ExportTracksButton key={`tracks-${conversationId}`} className="attach-btn"
          onCapture={file => attachAudioFiles([file])} />
        {/* 숨겨진 파일 입력들 */}
        <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e, 'image')} />
        <input ref={vidRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleFile(e, 'video')} />
        <input ref={audRef} type="file" accept="audio/*,.orb-regions.zip" multiple style={{ display: 'none' }} onChange={e => handleFile(e, 'audio')} />

        {/* + 버튼 */}
        <button
          className={`attach-btn${menuOpen ? ' active' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          disabled={uploading}
          title={t('chat.attachFile')}
        >
          {uploading
            ? <span style={{ fontSize: 10, color: 'var(--t3)' }}>...</span>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="16" height="16">
                <path d="M12 5v14M5 12h14"/>
              </svg>
          }
        </button>

        <div className="mi-wrap">
          <input
            className="mi"
            type="text"
            placeholder={
              groupHeader
                ? t('chat.messageWith', { name: groupHeader.title.split(' ')[0] })
                : t('chat.messageWith', { name: otherProfile?.display_name.split(' ')[0] ?? '' })
            }
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

      {/* In-chat calendar — slides over the thread, scoped to this
          conversation's shared events. */}
      {chatCalOpen && conversationId && (
        <ChatCalendar
          currentUserId={currentUserId}
          events={allCalEvents}
          categories={calCategories}
          groupTitleById={chatGroupTitleById}
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
            const parsed = await parseChatSchedule(text)
            return saveChatEvents(parsed)
          }}
        />
      )}
    </div>
  )
}
