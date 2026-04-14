import { useState, useEffect, useRef } from 'react'
import type { LiveSession } from '../../hooks/useLive'
import type { Profile } from '../../types/collab'

interface Props {
  mySession: LiveSession | null
  liveSessions: LiveSession[]
  profiles: Profile[]
  onStartLive: (title: string) => void
  onEndLive: () => void
  onWatchLive: (hostId: string) => void
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

export default function LivePanel({ mySession, liveSessions, profiles, onStartLive, onEndLive, onWatchLive, onClose }: Props) {
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const duration = useDuration(mySession?.started_at ?? null)

  useEffect(() => {
    if (!mySession) setTimeout(() => inputRef.current?.focus(), 200)
  }, [mySession])

  const othersLive = liveSessions.filter(s => !mySession || s.host_id !== mySession.host_id)

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
            <div className="live-pulse-wrap">
              <div className="live-pulse-ring" />
              <div className="live-pulse-ring live-pulse-ring2" />
              <svg className="live-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5a7 7 0 0114 0" /><path d="M1 9a11 11 0 0122 0" />
                <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="live-stream-title">{mySession.title || 'Live Session'}</div>
            <div className="live-timer">{duration}</div>
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
            <p className="live-setup-hint">Start a live session so your friends<br />can see when you're working.</p>
            <input
              ref={inputRef}
              className="live-title-input"
              type="text"
              placeholder="Stream title (optional)"
              maxLength={60}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onStartLive(title.trim()) }}
            />
            <button
              className="live-go-btn"
              onClick={() => onStartLive(title.trim())}
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
                <div key={s.id} className="live-others-row" onClick={() => onWatchLive(s.host_id)}>
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
