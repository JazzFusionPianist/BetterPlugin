import { useState, useEffect, useRef, useMemo } from 'react'
import type { LiveSession } from '../../hooks/useLive'
import type { Profile } from '../../types/collab'
import type { VideoSource } from '../../types/live'
import type { LiveChatMessage } from '../../hooks/useLiveChat'
import LiveChat from './LiveChat'
import FloatingOrbs from '../FloatingOrbs'

interface MicOption { deviceId: string; label: string }

interface Props {
  isOpen: boolean
  mySession: LiveSession | null
  liveSessions: LiveSession[]
  profiles: Profile[]
  myProfile: Profile | null
  sources: VideoSource[]
  microphones: MicOption[]
  localStream: MediaStream | null
  viewerCount: number
  totalViewers: number
  peakViewers: number
  mediaError: string | null
  screenCaptureSupported: boolean
  currentUserId: string
  chatMessages: LiveChatMessage[]
  onSendChat: (text: string) => void
  onStartLive: (title: string, source: VideoSource, micDeviceId: string | null) => void
  onEndLive: () => void
  onReplaceSource: (source: VideoSource, micDeviceId: string | null) => Promise<VideoSource | null>
  onWatchLive: (sessionId: string, hostId: string) => void
  onClose: () => void
}

interface EndedStats {
  durationSecs: number
  totalViewers: number
  peakViewers: number
}

function useDuration(startedAt: string | null) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!startedAt) { setSecs(0); return }
    const tick = () => setSecs(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Build a key string for comparing VideoSource instances
const sourceKey = (s: VideoSource) => `${s.kind}:${s.deviceId ?? ''}`

// Disclosure panel that lets the host change video/mic source while live
// without ending the session. Applies via RTCRtpSender.replaceTrack.
function InStreamSourceSwitcher({
  sources, microphones, currentVideoKey, currentMicId, screenCaptureSupported, onApply,
}: {
  sources: VideoSource[]
  microphones: MicOption[]
  currentVideoKey: string
  currentMicId: string
  screenCaptureSupported: boolean
  onApply: (videoKey: string, micDeviceId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [videoKey, setVideoKey] = useState(currentVideoKey)
  const [micId, setMicId]       = useState(currentMicId)
  const [busy, setBusy]         = useState(false)

  useEffect(() => { if (!open) { setVideoKey(currentVideoKey); setMicId(currentMicId) } }, [open, currentVideoKey, currentMicId])

  if (!open) {
    return (
      <button className="live-switch-toggle" onClick={() => setOpen(true)}>
        Change source
      </button>
    )
  }

  const dirty = videoKey !== currentVideoKey || micId !== currentMicId

  return (
    <div className="live-switch-panel">
      <div className="live-field">
        <label className="live-field-label">Video source</label>
        <select className="live-select" value={videoKey} onChange={e => setVideoKey(e.target.value)}>
          {sources.map(s => {
            const disabled = (s.kind === 'daw' || s.kind === 'screen') && !screenCaptureSupported
            return (
              <option key={sourceKey(s)} value={sourceKey(s)} disabled={disabled}>
                {s.label}{disabled ? ' (unsupported)' : ''}
              </option>
            )
          })}
        </select>
      </div>
      {microphones.length > 0 && (
        <div className="live-field">
          <label className="live-field-label">Microphone</label>
          <select className="live-select" value={micId} onChange={e => setMicId(e.target.value)}>
            <option value="">None (DAW Only)</option>
            {microphones.map(m => (
              <option key={m.deviceId} value={m.deviceId}>{m.label}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="live-switch-cancel" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
        <button
          className="live-go-btn"
          style={{ flex: 1 }}
          disabled={busy || !dirty}
          onClick={async () => {
            setBusy(true)
            try { await onApply(videoKey, micId); setOpen(false) }
            finally { setBusy(false) }
          }}
        >
          {busy ? 'Applying…' : 'Apply'}
        </button>
      </div>
    </div>
  )
}


function formatDuration(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Measure RMS audio level (0–1) from the audio tracks in a MediaStream. */
function useAudioLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    const tracks = stream?.getAudioTracks() ?? []
    if (!stream || tracks.length === 0) { setLevel(0); return }
    let ctx: AudioContext | null = null
    let rafId = 0
    // AudioContext must be created after a user gesture — if it fails, bail.
    try {
      ctx = new AudioContext()
    } catch { return }
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6
    const src = ctx.createMediaStreamSource(stream)
    src.connect(analyser)
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      // Scale: RMS ~0.05–0.3 for typical speech → map to 0–1
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 8))
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      src.disconnect()
      ctx?.close()
    }
  }, [stream])
  return level
}

/** Vertical audio level meter (green → yellow → red). */
function AudioLevelMeter({ level }: { level: number }) {
  // level: 0–1. The fill grows from the bottom.
  const pct = Math.round(level * 100)
  return (
    <div className="live-audio-meter" title={`Audio level: ${pct}%`}>
      <div className="live-audio-meter-fill" style={{ height: `${pct}%` }} />
    </div>
  )
}

export default function LivePanel({
  isOpen, mySession, liveSessions, profiles, myProfile, sources, microphones, localStream, viewerCount,
  totalViewers, peakViewers,
  mediaError, screenCaptureSupported,
  currentUserId, chatMessages, onSendChat,
  onStartLive, onEndLive, onReplaceSource, onWatchLive, onClose,
}: Props) {
  const [title, setTitle]         = useState('')
  const [micDeviceId, setMicDeviceId] = useState<string>('') // '' = (None)
  // Default to (None) — user picks a video source when they want one
  const [selectedKey, setSelectedKey] = useState<string>('none:')
  const titleRef   = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const duration   = useDuration(mySession?.started_at ?? null)
  const audioLevel = useAudioLevel(mySession ? localStream : null)
  // Derive video visibility from the actual stream tracks, not the DB has_video
  // flag (which lags behind by a network round-trip). An empty MediaStream is
  // truthy but has no video tracks → would show a black <video> without this.
  const hasLiveVideoTrack = useMemo(
    () => (localStream?.getVideoTracks().filter(t => t.readyState === 'live').length ?? 0) > 0,
    [localStream],
  )

  // Capture stats snapshot when the host's session ends, so we can show a
  // summary screen that persists after mySession becomes null.
  const [endedStats, setEndedStats] = useState<EndedStats | null>(null)
  const wasLiveRef = useRef(false)
  const statsRef = useRef({ totalViewers: 0, peakViewers: 0, startedAt: null as string | null })
  useEffect(() => {
    if (mySession) {
      wasLiveRef.current = true
      statsRef.current = {
        totalViewers,
        peakViewers,
        startedAt: mySession.started_at ?? null,
      }
      // clear any previous summary
      if (endedStats) setEndedStats(null)
    } else if (wasLiveRef.current) {
      // Just transitioned from live → ended: freeze a snapshot
      wasLiveRef.current = false
      const { startedAt } = statsRef.current
      setEndedStats({
        durationSecs: startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0,
        totalViewers: statsRef.current.totalViewers,
        peakViewers:  statsRef.current.peakViewers,
      })
    }
  }, [mySession, totalViewers, peakViewers, endedStats])

  // Keep selected source valid even as `sources` list changes (cameras plug in/out)
  useEffect(() => {
    if (!sources.find(s => sourceKey(s) === selectedKey) && sources.length > 0) {
      setSelectedKey(sourceKey(sources[0]))
    }
  }, [sources, selectedKey])

  const selectedSource = useMemo(
    () => sources.find(s => sourceKey(s) === selectedKey) ?? sources[0],
    [sources, selectedKey],
  )

  useEffect(() => {
    if (isOpen && !mySession) setTimeout(() => titleRef.current?.focus(), 200)
  }, [isOpen, mySession])

  // Bind local stream to the preview video element
  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = localStream
  }, [localStream, mySession])

  const othersLive = liveSessions.filter(s => !mySession || s.host_id !== mySession.host_id)

  const handleGoLive = () => {
    if (!selectedSource) return
    onStartLive(title.trim(), selectedSource, micDeviceId || null)
  }

  return (
    <>
      <div className="s-body live-body">
        {endedStats ? (
          /* ── Host summary: shown after End Stream ── */
          <div className="live-ended">
            <div className="live-ended-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5a7 7 0 0114 0" /><path d="M1 9a11 11 0 0122 0" />
                <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
            <div className="live-ended-title">Stream ended</div>
            <div className="live-ended-stats">
              <div className="live-ended-stat"><div className="live-ended-stat-val">{formatDuration(endedStats.durationSecs)}</div><div className="live-ended-stat-lbl">Duration</div></div>
              <div className="live-ended-stat"><div className="live-ended-stat-val">{endedStats.totalViewers}</div><div className="live-ended-stat-lbl">Total viewers</div></div>
              <div className="live-ended-stat"><div className="live-ended-stat-val">{endedStats.peakViewers}</div><div className="live-ended-stat-lbl">Peak viewers</div></div>
            </div>
            <button className="live-go-btn" onClick={() => { setEndedStats(null); onClose() }}>Done</button>
          </div>
        ) : mySession ? (
          /* ── Broadcasting mode ── */
          <div className="live-broadcasting">
            <div className="live-preview-row">
              {hasLiveVideoTrack
                ? <video
                    ref={previewRef}
                    className="live-preview"
                    autoPlay muted playsInline
                  />
                : (
                  /* 16:9 box keeps the pulse rings circular */
                  <div className="live-preview live-preview-audio">
                    <div className="live-pulse-wrap">
                      <div className="live-pulse-ring" />
                      <div className="live-pulse-ring live-pulse-ring2" />
                      {myProfile
                        ? (
                          <div className="av live-pulse-avatar live-pulse-avatar-host" style={{ background: myProfile.avatar_color }}>
                            {myProfile.avatar_url
                              ? <img src={myProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                              : myProfile.initials}
                          </div>
                        )
                        : (
                          <svg className="live-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12.5a7 7 0 0114 0" /><path d="M1 9a11 11 0 0122 0" />
                            <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
                          </svg>
                        )
                      }
                    </div>
                  </div>
                )}
              <AudioLevelMeter level={audioLevel} />
            </div>
            <div className="live-meta-row">
              <span className="live-timer">{duration}</span>
              <span className="live-viewer-count">
                <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3C4 3 1.5 8 1.5 8S4 13 8 13s6.5-5 6.5-5S12 3 8 3zm0 8a3 3 0 110-6 3 3 0 010 6z"/></svg>
                {viewerCount}
              </span>
            </div>

            <InStreamSourceSwitcher
              sources={sources}
              microphones={microphones}
              currentVideoKey={selectedKey}
              currentMicId={micDeviceId}
              screenCaptureSupported={screenCaptureSupported}
              onApply={async (key, mic) => {
                const src = sources.find(s => sourceKey(s) === key)
                if (!src) return
                const actual = await onReplaceSource(src, mic || null)
                // Use the ACTUAL source applied (may differ if picker was cancelled)
                const actualKey = actual ? sourceKey(actual) : selectedKey
                setSelectedKey(actualKey)
                setMicDeviceId(mic)
              }}
            />

            <LiveChat
              messages={chatMessages}
              currentUserId={currentUserId}
              onSend={onSendChat}
            />
            <button className="live-end-btn" onClick={onEndLive}>End Stream</button>
          </div>
        ) : (
          /* ── Pre-live setup ── */
          <div className="live-setup">
            <FloatingOrbs count={28} />
            <div className="live-setup-icon">
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 11a7 7 0 000 10" />
                <path d="M21 11a7 7 0 010 10" />
                <path d="M6.5 6.5a13 13 0 000 19" />
                <path d="M25.5 6.5a13 13 0 010 19" />
                <circle cx="16" cy="16" r="2.4" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <p className="live-setup-hint">Pick a video source and start<br />streaming to your friends.</p>

            <input
              ref={titleRef}
              className="live-title-input"
              type="text"
              placeholder="Stream title (optional)"
              maxLength={60}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />

            <div className="live-field">
              <label className="live-field-label">Video source</label>
              <select
                className="live-select"
                value={selectedKey}
                onChange={e => setSelectedKey(e.target.value)}
              >
                {sources.map(s => {
                  const disabled = (s.kind === 'daw' || s.kind === 'screen') && !screenCaptureSupported
                  return (
                    <option key={sourceKey(s)} value={sourceKey(s)} disabled={disabled}>
                      {s.label}{disabled ? ' (unsupported)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {microphones.length > 0 && (
              <div className="live-field">
                <label className="live-field-label">Microphone</label>
                <select
                  className="live-select"
                  value={micDeviceId}
                  onChange={e => setMicDeviceId(e.target.value)}
                >
                  <option value="">None (DAW Only)</option>
                  {microphones.map(m => (
                    <option key={m.deviceId} value={m.deviceId}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {mediaError && <div className="live-error">{mediaError}</div>}

            <button
              className="live-go-btn"
              onClick={handleGoLive}
              disabled={!selectedSource}
            >
              Go Live
            </button>
          </div>
        )}

        {/* ── Friends live now ── */}
        {othersLive.length > 0 && (
          <div className="live-others">
            <div className="s-section-label" style={{ padding: '0 14px', marginBottom: 4 }}>Live Now</div>
            {othersLive.map(s => {
              const p = profiles.find(pr => pr.id === s.host_id)
              if (!p) return null
              return (
                <div key={s.id} className="live-others-row" onClick={() => onWatchLive(s.id, s.host_id)}>
                  <div className="av-wrap" style={{ flexShrink: 0 }}>
                    <div className="av sz32" style={{ background: p.avatar_color }}>
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        : p.initials}
                    </div>
                    <div className="live-av-dot" />
                  </div>
                  <div className="live-others-info">
                    <div className="live-others-name">{p.display_name}</div>
                    {s.title && <div className="live-others-sub">{s.title}</div>}
                  </div>
                  <button className="live-watch-btn">Watch</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
