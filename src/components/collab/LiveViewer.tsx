import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useLiveViewer } from '../../hooks/useLiveViewer'
import type { LiveSession } from '../../hooks/useLive'
import type { Profile } from '../../types/collab'
import type { LiveChatMessage } from '../../hooks/useLiveChat'
import LiveChat from './LiveChat'

interface Props {
  supabase: SupabaseClient
  viewerId: string
  session: LiveSession
  host: Profile | null
  currentUserId: string
  chatMessages: LiveChatMessage[]
  /** Parent passes true once the session disappears from live_sessions —
   * a more reliable end-of-stream signal than waiting for our WebRTC peer
   * to see `closed`/`failed` (which can take 30s of ICE timeout). */
  sessionEnded: boolean
  onSendChat: (text: string) => void
  onClose: () => void
}

export default function LiveViewer({ supabase, viewerId, session, host, currentUserId, chatMessages, sessionEnded, onSendChat, onClose }: Props) {
  const { remoteStream, status } = useLiveViewer(supabase, viewerId, session.id, session.host_id)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Use the stream's actual video tracks as the source of truth for whether
  // to render the video element vs the audio-only avatar. This stays in sync
  // automatically when the host adds/removes video via WebRTC renegotiation,
  // even if the live_sessions metadata hasn't propagated yet.
  const [streamHasVideo, setStreamHasVideo] = useState(false)
  useEffect(() => {
    if (!remoteStream) { setStreamHasVideo(false); return }
    const update = () => {
      const live = remoteStream.getVideoTracks().some(t => t.readyState === 'live' && !t.muted)
      setStreamHasVideo(live)
    }
    update()
    remoteStream.addEventListener('addtrack', update)
    remoteStream.addEventListener('removetrack', update)
    // Watch each video track's mute state too — replaceTrack(null) on host's
    // sender flips this to muted=true on the receiver.
    const trackListeners: Array<{ track: MediaStreamTrack; mute: () => void; unmute: () => void; ended: () => void }> = []
    for (const t of remoteStream.getVideoTracks()) {
      const mute = update, unmute = update, ended = update
      t.addEventListener('mute', mute)
      t.addEventListener('unmute', unmute)
      t.addEventListener('ended', ended)
      trackListeners.push({ track: t, mute, unmute, ended })
    }
    return () => {
      remoteStream.removeEventListener('addtrack', update)
      remoteStream.removeEventListener('removetrack', update)
      for (const { track, mute, unmute, ended } of trackListeners) {
        track.removeEventListener('mute', mute)
        track.removeEventListener('unmute', unmute)
        track.removeEventListener('ended', ended)
      }
    }
  }, [remoteStream])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !remoteStream) return
    v.srcObject = remoteStream
    v.play().catch(e => console.warn('video.play() failed', e))
  }, [remoteStream])

  const ended = sessionEnded || status === 'ended'

  // When the stream ends we show a thank-you screen instead of auto-closing
  // — the viewer dismisses it manually via the Back button.
  if (ended) {
    return (
      <>
        <div className="s-header live-viewer-header">
          <div className="s-close" onClick={onClose}>&#8249;</div>
          <div className="live-viewer-titlebar">
            <span className="live-viewer-host">{host?.display_name ?? 'Unknown'}</span>
          </div>
        </div>
        <div className="live-viewer-body">
          <div className="live-ended">
            <div className="live-ended-icon">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <div className="live-ended-title">Thank you for watching!</div>
            <div className="live-ended-sub">The stream has ended.</div>
            <button className="live-go-btn" onClick={onClose}>Back</button>
          </div>
        </div>
      </>
    )
  }

  const statusLabel =
    status === 'connecting' ? 'Connecting…'
    : status === 'error'     ? 'Connection error'
    : ''

  return (
    <>
      <div className="s-header live-viewer-header">
        <div className="s-close" onClick={onClose}>&#8249;</div>
        <div className="live-viewer-titlebar">
          <span className="live-title-badge">● LIVE</span>
          <span className="live-viewer-host">{host?.display_name ?? 'Unknown'}</span>
        </div>
      </div>

      <div className="live-viewer-body">
        {/* Wrapper around the video so the fullscreen button can be anchored
            to the actual video area (not the whole body). When in audio-only
            mode the wrapper collapses (display: none on .has-video=false). */}
        <div className={`live-viewer-video-wrap${streamHasVideo ? '' : ' is-audio-only'}`}>
          <video
            ref={videoRef}
            className="live-viewer-video"
            autoPlay playsInline
          />
          {streamHasVideo && (
            <button
              className="live-viewer-fullscreen-btn"
              onClick={() => {
                const v = videoRef.current
                if (!v) return
                const anyV = v as HTMLVideoElement & {
                  webkitEnterFullscreen?: () => void
                  webkitRequestFullscreen?: () => Promise<void>
                }
                if (anyV.webkitEnterFullscreen) {
                  anyV.webkitEnterFullscreen()
                } else if (anyV.webkitRequestFullscreen) {
                  anyV.webkitRequestFullscreen().catch(e => console.warn('fullscreen failed', e))
                } else if (v.requestFullscreen) {
                  v.requestFullscreen().catch(e => console.warn('fullscreen failed', e))
                }
              }}
              title="Fullscreen"
              aria-label="Enter fullscreen"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6V2.5h3.5" />
                <path d="M14 6V2.5H10.5" />
                <path d="M2 10v3.5h3.5" />
                <path d="M14 10v3.5H10.5" />
              </svg>
            </button>
          )}
        </div>
        {!streamHasVideo && (
          <div className="live-viewer-audio-only">
            <div className="live-pulse-wrap live-pulse-lg">
              <div className="live-pulse-ring" />
              <div className="live-pulse-ring live-pulse-ring2" />
              {host ? (
                <div className="av live-pulse-avatar live-pulse-avatar-lg" style={{ background: host.avatar_color }}>
                  {host.avatar_url
                    ? <img src={host.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : host.initials}
                </div>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5a7 7 0 0114 0" /><path d="M1 9a11 11 0 0122 0" />
                  <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              )}
            </div>
            <div className="live-viewer-audio-label">Audio only</div>
          </div>
        )}

        {statusLabel && (
          <div className="live-viewer-status">{statusLabel}</div>
        )}

        <LiveChat
          messages={chatMessages}
          currentUserId={currentUserId}
          onSend={onSendChat}
        />
      </div>
    </>
  )
}
