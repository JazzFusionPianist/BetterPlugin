import { useEffect, useRef } from 'react'
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
  onSendChat: (text: string) => void
  onClose: () => void
}

export default function LiveViewer({ supabase, viewerId, session, host, currentUserId, chatMessages, onSendChat, onClose }: Props) {
  const { remoteStream, status } = useLiveViewer(supabase, viewerId, session.id, session.host_id)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v || !remoteStream) return
    v.srcObject = remoteStream
    v.play().catch(e => console.warn('video.play() failed', e))
  }, [remoteStream])

  // When the stream ends we show a thank-you screen instead of auto-closing
  // — the viewer dismisses it manually via the Back button.
  if (status === 'ended') {
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
        {session.has_video ? (
          <video
            ref={videoRef}
            className="live-viewer-video"
            autoPlay playsInline
          />
        ) : (
          <div className="live-viewer-audio-only">
            <div className="live-pulse-wrap live-pulse-lg">
              <div className="live-pulse-ring" />
              <div className="live-pulse-ring live-pulse-ring2" />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5a7 7 0 0114 0" /><path d="M1 9a11 11 0 0122 0" />
                <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
              </svg>
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
