import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, Message, AttachType } from '../../types/collab'

interface Attachment { url: string; type: AttachType; name: string }

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  otherProfile: Profile
  messages: Message[]
  loading: boolean
  onSend: (content: string, attachment?: Attachment) => Promise<boolean>
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

function formatDur(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── 이미지 첨부 ──────────────────────────────────────────────
function ImageAttachment({ url, name }: { url: string; name: string }) {
  return (
    <img
      src={url}
      alt={name}
      className="msg-att-img"
      onClick={() => window.open(url, '_blank')}
    />
  )
}

// ── 동영상 첨부 ──────────────────────────────────────────────
function VideoAttachment({ url }: { url: string }) {
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
          src={url}
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
        src={url}
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

// ── JUCE 네이티브 함수 타입 선언 ──────────────────────────────
// window.__JUCE__.backend is an event emitter, NOT an object with named methods.
// Use callJuceNative() to invoke registered C++ functions.
declare global {
  interface Window {
    __JUCE__?: {
      initialisationData: {
        __juce__functions: string[]
        __juce__platform: string[]
      }
      backend: {
        addEventListener:    (event: string, handler: (data: unknown) => void) => void
        removeEventListener: (event: string, handler: (data: unknown) => void) => void
        emitEvent:           (event: string, data: unknown) => void
      }
    }
  }
}

// ── JUCE native function bridge ───────────────────────────────
// Mirrors the promiseHandler pattern from JUCE's own index.js.
let _juceNextId = 0
function callJuceNative(name: string, params: unknown[]): Promise<string> {
  return new Promise<string>((resolve) => {
    const backend = window.__JUCE__?.backend
    if (!backend) { resolve('error:no-juce'); return }

    const promiseId = _juceNextId++

    const handler = (data: unknown) => {
      const d = data as { promiseId: number; result: string }
      if (d.promiseId === promiseId) {
        backend.removeEventListener('__juce__complete', handler)
        resolve(d.result)
      }
    }

    backend.addEventListener('__juce__complete', handler)
    backend.emitEvent('__juce__invoke', { name, params, resultId: promiseId })
  })
}

type DragState = 'idle' | 'fetching' | 'armed' | 'dragging' | 'fallback' | 'imported'

// ── 오디오 첨부 ──────────────────────────────────────────────
function AudioAttachment({ url, name }: { url: string; name: string }) {
  const [expanded, setExpanded]   = useState(false)
  const [playing, setPlaying]     = useState(false)
  const [current, setCurrent]     = useState(0)
  const [duration, setDuration]   = useState(0)
  const [dragState, setDragState] = useState<DragState>('idle')
  const [dlBytes, setDlBytes]     = useState(0)
  const armedResetTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cachedBase64     = useRef<string | null>(null)   // 다운로드된 base64 캐시 (재드래그용)
  const [totalBytes, setTotalBytes] = useState(-1)
  const audioRef = useRef<HTMLAudioElement>(null)

  const juceBackend = !!window.__JUCE__?.backend

  // C++에서 진행률 업데이트 수신 (CustomEvent → 여러 컴포넌트 동시 수신 가능)
  useEffect(() => {
    const onProgress = (e: Event) => {
      const { dl, tot } = (e as CustomEvent<{ dl: number; tot: number }>).detail
      setDlBytes(dl)
      setTotalBytes(tot)
    }
    window.addEventListener('__juceProgress', onProgress)
    return () => window.removeEventListener('__juceProgress', onProgress)
  }, [])

  // DAW 임포트 성공 → 'imported' 상태 유지 (재드래그 가능)
  // 드래그 취소 → 즉시 'idle' 복원 (바로 재드래그 가능)
  useEffect(() => {
    const onImported = (e: Event) => {
      const evUrl = (e as CustomEvent<{ url: string }>).detail?.url
      if (evUrl !== url) return
      // 15s 자동 리셋 타이머 취소 — imported 상태는 영구 유지
      if (armedResetTimer.current) { clearTimeout(armedResetTimer.current); armedResetTimer.current = null }
      setDragState('imported')
    }
    const onCancel = (e: Event) => {
      const evUrl = (e as CustomEvent<{ url: string }>).detail?.url
      if (evUrl !== url) return
      if (armedResetTimer.current) { clearTimeout(armedResetTimer.current); armedResetTimer.current = null }
      // 캐시가 있으면 imported 유지 (바로 재드래그 가능), 없으면 idle
      setDragState(cachedBase64.current ? 'imported' : 'idle')
    }
    window.addEventListener('__juceImported',      onImported)
    window.addEventListener('__juceOutDragCancel', onCancel)
    return () => {
      window.removeEventListener('__juceImported',      onImported)
      window.removeEventListener('__juceOutDragCancel', onCancel)
    }
  }, [url])

  // Prefetch disabled: causes a second simultaneous download that Supabase
  // CDN throttles to 0 bps, making startAudioDrag hang indefinitely.
  const handleMouseEnter = () => {}

  // 마우스 누르면 OS 레벨 드래그 시작
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (juceBackend) {
      // 이미 armed: C++가 준비돼있음 — 그냥 드래그하면 됨 (re-arm 불필요)
      if (dragState === 'armed') return
      if (dragState === 'fetching') return   // 이미 진행 중

      // 공통 arm 완료 처리
      const onArmed = () => {
        window.dispatchEvent(new CustomEvent('__localDragArmed', { detail: { url } }))
        setDragState('armed')
        if (armedResetTimer.current) clearTimeout(armedResetTimer.current)
        armedResetTimer.current = setTimeout(() => {
          armedResetTimer.current = null
          setDragState(s => s === 'armed' ? 'idle' : s)
        }, 15_000)
      }

      // ── 'imported': 이미 base64 캐시 있음 → 재다운로드 없이 바로 re-arm ──
      if (dragState === 'imported' && cachedBase64.current) {
        setDragState('fetching')
        ;(async () => {
          try {
            if (!window.__JUCE__?.backend) { setDragState('imported'); return }
            const result = await callJuceNative('writeAudioFile', [cachedBase64.current!, name])
            if (result === 'armed') onArmed()
            else setDragState('imported')   // 실패시 imported 상태 유지
          } catch {
            setDragState('imported')
          }
        })()
        return
      }

      // ── 최초 다운로드 + arm ───────────────────────────────────────────────
      setDlBytes(0)
      setTotalBytes(-1)
      setDragState('fetching')

      const controller = new AbortController()

      const finish = (result: string) => {
        clearTimeout(timer)
        delete (window as unknown as Record<string, unknown>).__juceStartDragComplete
        if (result === 'armed') {
          onArmed()
        } else {
          setDragState('idle')
        }
      }

      // 60s hard timeout
      const timer = setTimeout(() => { controller.abort(); finish('error') }, 60_000)

      // Direct JS callback so C++ can also signal completion
      ;(window as unknown as Record<string, unknown>).__juceStartDragComplete = finish

      ;(async () => {
        try {
          const res = await fetch(url, { signal: controller.signal })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)

          const contentLength = Number(res.headers.get('content-length') ?? -1)
          setTotalBytes(contentLength)

          const reader = res.body!.getReader()
          const chunks: Uint8Array[] = []
          let received = 0

          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            received += value.length
            setDlBytes(received)
          }

          // Merge chunks into one buffer
          const merged = new Uint8Array(received)
          let pos = 0
          for (const chunk of chunks) { merged.set(chunk, pos); pos += chunk.length }

          // Base64 encode in 32 KB slices to avoid call-stack overflow
          const CHUNK = 0x8000
          let b64 = ''
          for (let i = 0; i < merged.length; i += CHUNK)
            b64 += String.fromCharCode(...merged.subarray(i, i + CHUNK))
          const base64 = btoa(b64)

          // base64 캐시 저장 (이후 재드래그 시 재다운로드 없이 사용)
          cachedBase64.current = base64

          // Hand off to C++: decode + write to temp file + arm drag
          if (!window.__JUCE__?.backend) { finish('error:no-juce'); return }
          const result = await callJuceNative('writeAudioFile', [base64, name])
          finish(result)
        } catch (err) {
          finish('error:exception:' + String(err).slice(0, 60))
        }
      })()
      return
    }

    // JUCE 없는 환경 폴백: 클립보드 복사
    setDragState('fallback')
    navigator.clipboard.writeText(url)
      .catch(() => window.open(url, '_blank'))
    setTimeout(() => setDragState('idle'), 2000)
  }

  const fetchingLabel = dlBytes > 0
    ? (totalBytes > 0 ? `${Math.round(dlBytes * 100 / totalBytes)}%` : `${Math.round(dlBytes / 1024)} KB`)
    : 'Preparing…'
  const dragLabel: Record<DragState, string> = {
    idle:     'Import to DAW',
    fetching: fetchingLabel,
    armed:    'Drag to track ↗',
    dragging: 'Dragging…',
    fallback: 'Link copied!',
    imported: 'Drag to track ↗',
  }

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = ratio * duration
  }

  return (
    <div className="msg-att-audio">
      <div className="msg-att-audio-header" onClick={() => setExpanded(v => !v)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        <span className="msg-att-audio-name">{name}</span>

        {/* Import / Drag 버튼 */}
        <button
          className={`msg-att-import-btn${dragState === 'armed' || dragState === 'dragging' || dragState === 'imported' ? ' ready' : ''}`}
          onMouseEnter={handleMouseEnter}
          onMouseDown={handleMouseDown}
          onClick={e => e.stopPropagation()}
          title={dragLabel[dragState]}
        >
          {dragState === 'fetching' && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
            </svg>
          )}
          {(dragState === 'idle' || dragState === 'fallback') && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 21h14"/>
            </svg>
          )}
          {(dragState === 'armed' || dragState === 'dragging' || dragState === 'imported') && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 4h10M7 8h10M7 12h6"/><circle cx="17" cy="17" r="4"/><path d="M17 15v4M15 17h4"/>
            </svg>
          )}
          <span>{dragLabel[dragState]}</span>
        </button>

        <span className="msg-att-audio-chevron">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="msg-att-audio-player">
          <audio
            ref={audioRef}
            src={url}
            onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
            onEnded={() => setPlaying(false)}
          />
          <button className="msg-att-play-pause" onClick={toggle}>
            {playing
              ? <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>
            }
          </button>
          <div className="msg-att-progress-track" onClick={seek}>
            <div
              className="msg-att-progress-fill"
              style={{ width: duration ? `${(current / duration) * 100}%` : '0%' }}
            />
          </div>
          <span className="msg-att-time">{formatDur(current)} / {formatDur(duration)}</span>
        </div>
      )}
    </div>
  )
}

// ── 첨부 렌더러 ──────────────────────────────────────────────
// ── 멀티 트랙 그룹 첨부 ──────────────────────────────────────
interface TrackInfo { url: string; name: string }
type GroupDragState = 'idle' | 'fetching' | 'armed' | 'imported'

function AudioGroupAttachment({ tracks, groupUrl }: { tracks: TrackInfo[]; groupUrl: string }) {
  const [expanded, setExpanded]     = useState(false)
  const [dragState, setDragState]   = useState<GroupDragState>('idle')
  const [fetchedCount, setFetchedCount] = useState(0)
  const cachedBase64s   = useRef<string[]>([])
  const armedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const juceBackend     = !!window.__JUCE__?.backend

  // import 성공 / 취소 이벤트 수신
  useEffect(() => {
    const onImported = (e: Event) => {
      if ((e as CustomEvent<{url:string}>).detail?.url !== groupUrl) return
      if (armedResetTimer.current) { clearTimeout(armedResetTimer.current); armedResetTimer.current = null }
      setDragState('imported')
    }
    const onCancel = (e: Event) => {
      if ((e as CustomEvent<{url:string}>).detail?.url !== groupUrl) return
      if (armedResetTimer.current) { clearTimeout(armedResetTimer.current); armedResetTimer.current = null }
      setDragState(cachedBase64s.current.length === tracks.length ? 'imported' : 'idle')
    }
    window.addEventListener('__juceImported',      onImported)
    window.addEventListener('__juceOutDragCancel', onCancel)
    return () => {
      window.removeEventListener('__juceImported',      onImported)
      window.removeEventListener('__juceOutDragCancel', onCancel)
    }
  }, [groupUrl, tracks.length])

  const armDone = () => {
    window.dispatchEvent(new CustomEvent('__localDragArmed', { detail: { url: groupUrl } }))
    setDragState('armed')
    if (armedResetTimer.current) clearTimeout(armedResetTimer.current)
    armedResetTimer.current = setTimeout(() => {
      armedResetTimer.current = null
      setDragState(s => s === 'armed' ? 'imported' : s)
    }, 15_000)
  }

  const handleGroupMouseDown = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    if (!juceBackend || dragState === 'armed' || dragState === 'fetching') return

    setDragState('fetching')

    // 캐시가 있으면 재다운로드 없이 바로 re-arm
    if (dragState === 'imported' && cachedBase64s.current.length === tracks.length) {
      const args = tracks.flatMap((t, i) => [cachedBase64s.current[i], t.name])
      try {
        const r = await callJuceNative('writeAudioFiles', args)
        if (r === 'armed') armDone()
        else setDragState('imported')
      } catch { setDragState('imported') }
      return
    }

    // 처음: 순차 다운로드
    const CHUNK = 0x8000
    const b64s: string[] = []
    setFetchedCount(0)

    for (let i = 0; i < tracks.length; i++) {
      try {
        const res = await fetch(tracks[i].url)
        if (!res.ok) { setDragState('idle'); return }
        const chunks: Uint8Array[] = []
        let received = 0
        const reader = res.body!.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value); received += value.length
        }
        const merged = new Uint8Array(received)
        let pos = 0
        for (const c of chunks) { merged.set(c, pos); pos += c.length }
        let b64 = ''
        for (let j = 0; j < merged.length; j += CHUNK)
          b64 += String.fromCharCode(...merged.subarray(j, j + CHUNK))
        b64s.push(btoa(b64))
        setFetchedCount(i + 1)
      } catch { setDragState('idle'); return }
    }

    cachedBase64s.current = b64s
    const args = tracks.flatMap((t, i) => [b64s[i], t.name])
    try {
      const r = await callJuceNative('writeAudioFiles', args)
      if (r === 'armed') armDone()
      else setDragState('idle')
    } catch { setDragState('idle') }
  }

  const isReady    = dragState === 'armed' || dragState === 'imported'
  const isFetching = dragState === 'fetching'
  const btnLabel   = isFetching
    ? (fetchedCount > 0 ? `${fetchedCount}/${tracks.length}…` : 'Preparing…')
    : (isReady ? 'Drag to track ↗' : 'Import to DAW')

  return (
    <div className="msg-att-audio-group">
      <div className="msg-att-audio-group-header">
        {/* 음표 아이콘 */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        <span className="msg-att-audio-name">{tracks.length} Tracks</span>

        {juceBackend && (
          <button
            className={`msg-att-import-btn${isReady ? ' ready' : ''}`}
            onMouseDown={handleGroupMouseDown}
            onClick={e => e.stopPropagation()}
          >
            {isFetching && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="spin">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
              </svg>
            )}
            {!isFetching && !isReady && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 21h14"/>
              </svg>
            )}
            {isReady && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4h10M7 8h10M7 12h6"/><circle cx="17" cy="17" r="4"/><path d="M17 15v4M15 17h4"/>
              </svg>
            )}
            <span>{btnLabel}</span>
          </button>
        )}

        <button
          className="msg-att-group-chevron"
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="msg-att-group-tracks">
          {tracks.map(t => (
            <AudioAttachment key={t.url} url={t.url} name={t.name} />
          ))}
        </div>
      )}
    </div>
  )
}

function ExpiredAttachment({ type }: { type: AttachType }) {
  const icon = type === 'image' ? '🖼️' : type === 'video' ? '🎬' : '🎵'
  return (
    <div className="att-expired">
      <span className="att-expired-icon">{icon}</span>
      <span className="att-expired-text">파일이 만료되었습니다 (7일)</span>
    </div>
  )
}

function AttachmentView({ url, type, name }: { url: string; type: AttachType; name: string }) {
  if (type === 'image') return <ImageAttachment url={url} name={name} />
  if (type === 'video') return <VideoAttachment url={url} />
  if (type === 'audio') return <AudioAttachment url={url} name={name} />
  if (type === 'multi-audio') {
    let tracks: TrackInfo[] = []
    try { tracks = JSON.parse(url) } catch {}
    if (tracks.length > 0) return <AudioGroupAttachment tracks={tracks} groupUrl={url} />
  }
  return null
}

// ── 메인 ChatView ─────────────────────────────────────────────
export default function ChatView({ supabase, currentUserId, otherProfile, messages, loading, onSend, onBack }: Props) {
  const [input, setInput]         = useState('')
  const [sendError, setSendError] = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadErrMsg, setUploadErrMsg] = useState('')
  const [dragOver, setDragOver]   = useState(false)
  const [dragType, setDragType]   = useState<'attach' | 'cancel'>('attach')
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

  // ── C++ drop-in: Logic region → chat attachment ───────────────────────────
  // C++ resolves the NSFilePromise (Logic's async export), then fires
  // '__juceFileDrop' with base64-encoded audio data.
  const processDroppedFileRef = useRef<(file: File) => Promise<void>>(async () => {})
  useEffect(() => { processDroppedFileRef.current = processDroppedFile })
  useEffect(() => {
    processMultiDropRef.current = async (batch: { name: string; data: string }[]) => {
      const toFile = (n: string, d: string) => {
        const binary = atob(d)
        const bytes  = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const ext = n.split('.').pop()?.toLowerCase() ?? ''
        const mimeMap: Record<string, string> = {
          wav: 'audio/wav', aif: 'audio/aiff', aiff: 'audio/aiff',
          mp3: 'audio/mpeg', m4a: 'audio/mp4', caf: 'audio/x-caf',
          ogg: 'audio/ogg', flac: 'audio/flac',
        }
        return new File([bytes], n, { type: mimeMap[ext] ?? 'audio/aiff' })
      }

      setUploading(true)
      const uploaded: TrackInfo[] = []
      for (const { name: n, data: d } of batch) {
        const file = toFile(n, d)
        if (file.size > MAX_SIZE) { showErr(`${n}: too large (max ${MAX_SIZE_MB}MB)`); continue }
        const att = await uploadFile(file, 'audio')
        if (att) uploaded.push({ url: att.url, name: att.name })
      }
      setUploading(false)

      if (uploaded.length === 1) {
        await onSend('', { url: uploaded[0].url, type: 'audio', name: uploaded[0].name })
      } else if (uploaded.length > 1) {
        await onSend('', {
          url:  JSON.stringify(uploaded),
          type: 'multi-audio',
          name: `${uploaded.length} Tracks`,
        })
      }
    }
  })

  // Buffer for grouping multiple __juceFileDrop events from a single Logic drag.
  // C++ fires __juceDropGroupStart{count} first so we know how many to expect.
  const dropBuffer        = useRef<{ name: string; data: string }[]>([])
  const dropGroupCount    = useRef(1)
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
      dropBuffer.current = []
    }
    window.addEventListener('__juceDropGroupStart', handler)
    return () => window.removeEventListener('__juceDropGroupStart', handler)
  }, [])

  // __juceFileDrop: C++ delivers one resolved file per event.
  // When all expected files have arrived, upload and send as one message.
  useEffect(() => {
    const handler = async (e: Event) => {
      if (outDragActive.current) return

      const { name, data } = (e as CustomEvent<{ name: string; data: string }>).detail
      dropBuffer.current.push({ name, data })

      // Wait until all files from this drag are collected
      if (dropBuffer.current.length < dropGroupCount.current) return

      const batch = dropBuffer.current
      dropBuffer.current = []
      dropGroupCount.current = 1

      // Helper: base64 string → File object
      const toFile = (n: string, d: string) => {
        const binary = atob(d)
        const bytes  = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const ext  = n.split('.').pop()?.toLowerCase() ?? ''
        const mimeMap: Record<string, string> = {
          wav: 'audio/wav', aif: 'audio/aiff', aiff: 'audio/aiff',
          mp3: 'audio/mpeg', m4a: 'audio/mp4', caf: 'audio/x-caf',
          ogg: 'audio/ogg', flac: 'audio/flac',
        }
        return new File([bytes], n, { type: mimeMap[ext] ?? 'audio/aiff' })
      }

      if (batch.length === 1) {
        // Single file — existing path
        await processDroppedFileRef.current(toFile(batch[0].name, batch[0].data))
        return
      }

      // Multiple files — delegate to ref so closures stay fresh
      await processMultiDropRef.current(batch)
    }
    window.addEventListener('__juceFileDrop', handler)
    return () => window.removeEventListener('__juceFileDrop', handler)
  }, [])

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

  useEffect(() => {
    const el = chatAreaRef.current
    if (el) el.scrollTop = el.scrollHeight
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

  const MAX_SIZE_MB = 50
  const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024

  const showErr = (msg: string) => {
    setUploadErrMsg(msg)
    setSendError(true)
    setTimeout(() => { setSendError(false); setUploadErrMsg('') }, 3000)
  }

  const uploadFile = async (file: File, type: AttachType): Promise<Attachment | null> => {
    const ext  = file.name.split('.').pop() ?? 'bin'
    const path = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage
      .from('attachments')
      .upload(path, file, { contentType: file.type })
    if (error) {
      console.error('[upload error]', error.message, error)
      return null
    }
    const { data } = supabase.storage.from('attachments').getPublicUrl(path)
    return { url: data.publicUrl, type, name: file.name }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, type: AttachType) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setMenuOpen(false)

    // 오디오 여러 개 선택 → 멀티 트랙 메시지
    if (type === 'audio' && files.length > 1) {
      setUploading(true)
      const uploaded: TrackInfo[] = []
      for (const file of files) {
        if (file.size > MAX_SIZE) { showErr(`${file.name}: too large (max ${MAX_SIZE_MB}MB)`); continue }
        const att = await uploadFile(file, 'audio')
        if (att) uploaded.push({ url: att.url, name: att.name })
      }
      setUploading(false)
      if (uploaded.length === 1) {
        await onSend('', { url: uploaded[0].url, type: 'audio', name: uploaded[0].name })
      } else if (uploaded.length > 1) {
        await onSend('', {
          url:  JSON.stringify(uploaded),
          type: 'multi-audio',
          name: `${uploaded.length} Tracks`,
        })
      }
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
      showErr('Upload failed. Check file size or connection.')
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

  const processDroppedFile = async (file: File) => {
    const mime = file.type
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? ''
    const AUDIO_EXTS = new Set(['mp3','wav','aif','aiff','m4a','ogg','flac','caf','opus','aac'])
    let type: AttachType
    if      (mime.startsWith('image/'))                            type = 'image'
    else if (mime.startsWith('video/'))                            type = 'video'
    else if (mime.startsWith('audio/') || AUDIO_EXTS.has(ext))    type = 'audio'
    else { showErr('Only image, video, or audio files supported.'); return }

    if (file.size > MAX_SIZE) { showErr(`File too large (max ${MAX_SIZE_MB}MB)`); return }

    setUploading(true)
    const att = await uploadFile(file, type)
    setUploading(false)
    if (!att) showErr('Upload failed. Check file size or connection.')
    else await onSend('', att)
  }

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

    // macOS Finder 드래그 시 MIME type이 비어있거나 잘못 올 수 있어서 확장자도 함께 체크
    const AUDIO_EXTS = new Set(['mp3','wav','aif','aiff','m4a','ogg','flac','caf','opus','aac'])
    const isAudioFile = (f: File) =>
      f.type.startsWith('audio/') ||
      AUDIO_EXTS.has(f.name.split('.').pop()?.toLowerCase() ?? '')

    const audioFiles = files.filter(isAudioFile)
    const otherFiles = files.filter(f => !isAudioFile(f))

    // 오디오 여러 개 → 멀티 트랙 메시지 하나로
    if (audioFiles.length > 1) {
      setUploading(true)
      const uploaded: TrackInfo[] = []
      for (const file of audioFiles) {
        if (file.size > MAX_SIZE) { showErr(`${file.name}: too large (max ${MAX_SIZE_MB}MB)`); continue }
        const att = await uploadFile(file, 'audio')
        if (att) uploaded.push({ url: att.url, name: att.name })
      }
      setUploading(false)
      if (uploaded.length === 1) {
        await onSend('', { url: uploaded[0].url, type: 'audio', name: uploaded[0].name })
      } else if (uploaded.length > 1) {
        await onSend('', {
          url:  JSON.stringify(uploaded),
          type: 'multi-audio',
          name: `${uploaded.length} Tracks`,
        })
      }
      // 오디오 외 파일이 섞여 있으면 각각 처리
      for (const f of otherFiles) await processDroppedFile(f)
      return
    }

    // 단일 파일 (기존 동작)
    const file = files[0]
    if (file) await processDroppedFile(file)
  }

  // 날짜별 그룹 구분선
  const groups: Array<{ type: 'ts'; label: string } | { type: 'msg'; msg: Message }> = []
  let lastDate = ''
  for (const msg of messages) {
    const dateLabel = formatDate(msg.created_at)
    if (dateLabel !== lastDate) {
      groups.push({ type: 'ts', label: dateLabel })
      lastDate = dateLabel
    }
    groups.push({ type: 'msg', msg })
  }

  return (
    <div
      className="chat-drop-zone"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className={`drop-overlay${dragType === 'cancel' ? ' cancel' : ''}`}>
          <div className="drop-overlay-inner">
            {dragType === 'cancel' ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M15 9l-6 6M9 9l6 6"/>
                </svg>
                <span>Release to cancel</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Drop to attach</span>
              </>
            )}
          </div>
        </div>
      )}
      {/* Sub-bar */}
      <div className="csub">
        <div className="back" onClick={onBack}>&#8249;</div>
        <div className="chdr-av" style={{ background: otherProfile.avatar_color }}>
          {otherProfile.avatar_url
            ? <img src={otherProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : otherProfile.initials}
          <div className={`chdr-dot ${otherProfile.isOnline ? 'don' : 'doff'}`} />
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
              {g.msg.attachment_type && (
                g.msg.attachment_expired
                  ? <ExpiredAttachment type={g.msg.attachment_type} />
                  : g.msg.attachment_url
                    ? <AttachmentView
                        url={g.msg.attachment_url}
                        type={g.msg.attachment_type}
                        name={g.msg.attachment_name ?? ''}
                      />
                    : null
              )}
              {g.msg.content && <div className="mb">{g.msg.content}</div>}
              <div className="mtime">{formatTime(g.msg.created_at)}</div>
            </div>
          )
        )}
        {messages.length === 0 && !loading && (
          <div className="collab-loading" style={{ flex: 'unset', marginTop: 40 }}>
            No messages yet
          </div>
        )}
      </div>

      {/* 전송/업로드 실패 토스트 */}
      {sendError && (
        <div className="send-error-toast">
          {uploadErrMsg || 'Failed to send. Please try again.'}
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
            Photo
          </button>
          <button className="attach-menu-item" onClick={() => { vidRef.current?.click() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9l5-3v12l-5-3V9z"/>
            </svg>
            Video
          </button>
          <button className="attach-menu-item" onClick={() => { audRef.current?.click() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            Audio
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="input-bar">
        {/* 숨겨진 파일 입력들 */}
        <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e, 'image')} />
        <input ref={vidRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleFile(e, 'video')} />
        <input ref={audRef} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={e => handleFile(e, 'audio')} />

        {/* + 버튼 */}
        <button
          className={`attach-btn${menuOpen ? ' active' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          disabled={uploading}
          title="Attach file"
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
    </div>
  )
}
