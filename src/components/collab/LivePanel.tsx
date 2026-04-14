import { useState, useEffect, useRef, useMemo } from 'react'
import type { LiveSession } from '../../hooks/useLive'
import type { Profile } from '../../types/collab'
import type { VideoSource } from '../../types/live'
import type { LiveChatMessage } from '../../hooks/useLiveChat'
import LiveChat from './LiveChat'

interface MicOption { deviceId: string; label: string }

interface Props {
  isOpen: boolean
  mySession: LiveSession | null
  liveSessions: LiveSession[]
  profiles: Profile[]
  sources: VideoSource[]
  microphones: MicOption[]
  localStream: MediaStream | null
  viewerCount: number
  mediaError: string | null
  screenCaptureSupported: boolean
  currentUserId: string
  chatMessages: LiveChatMessage[]
  onSendChat: (text: string) => void
  onStartLive: (title: string, source: VideoSource, micDeviceId: string | null) => void
  onEndLive: () => void
  onWatchLive: (sessionId: string, hostId: string) => void
  onClose: () => void
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

export default function LivePanel({
  isOpen, mySession, liveSessions, profiles, sources, microphones, localStream, viewerCount,
  mediaError, screenCaptureSupported,
  currentUserId, chatMessages, onSendChat,
  onStartLive, onEndLive, onWatchLive, onClose,
}: Props) {
  const [title, setTitle]         = useState('')
  const [micDeviceId, setMicDeviceId] = useState<string>('') // '' = (None)
  const [selectedKey, setSelectedKey] = useState<string>(() => {
    const first = sources.find(s => s.kind === 'daw') ?? sources[0]
    return first ? sourceKey(first) : 'daw:'
  })
  const titleRef   = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const duration   = useDuration(mySession?.started_at ?? null)

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
      <div className="s-header">
        <div className="s-close" onClick={onClose}>&#8249;</div>
        <span className="s-title">
          {mySession ? <span className="live-title-badge">● LIVE</span> : 'LIVE'}
        </span>
      </div>

      <div className="s-body live-body">
        {mySession ? (
          /* ── Broadcasting mode ── */
          <div className="live-broadcasting">
            {localStream && mySession.has_video
              ? <video
                  ref={previewRef}
                  className="live-preview"
                  autoPlay muted playsInline
                />
              : (
                <div className="live-pulse-wrap">
                  <div className="live-pulse-ring" />
                  <div className="live-pulse-ring live-pulse-ring2" />
                  <svg className="live-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5a7 7 0 0114 0" /><path d="M1 9a11 11 0 0122 0" />
                    <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                </div>
              )}
            <div className="live-meta-row">
              <span className="live-timer">{duration}</span>
              <span className="live-viewer-count">
                <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3C4 3 1.5 8 1.5 8S4 13 8 13s6.5-5 6.5-5S12 3 8 3zm0 8a3 3 0 110-6 3 3 0 010 6z"/></svg>
                {viewerCount}
              </span>
            </div>
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
            <div className="live-setup-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5a7 7 0 0114 0" /><path d="M1 9a11 11 0 0122 0" />
                <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
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
                      {s.kind === 'daw' ? '🖥  ' : s.kind === 'screen' ? '🖵  ' : '📷 '}
                      {s.label}{disabled ? ' (unsupported)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="live-field">
              <label className="live-field-label">Microphone</label>
              <select
                className="live-select"
                value={micDeviceId}
                onChange={e => setMicDeviceId(e.target.value)}
              >
                <option value="">None (DAW Only)</option>
                {microphones.map(m => (
                  <option key={m.deviceId} value={m.deviceId}>🎙 {m.label}</option>
                ))}
              </select>
            </div>

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
