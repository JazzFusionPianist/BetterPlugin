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
  const { remoteStream, status, debug } = useLiveViewer(supabase, viewerId, session.id, session.host_id)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v || !remoteStream) return
    v.srcObject = remoteStream
    // Kick off playback — WKWebView / Safari can be finicky about autoplay
    // even with the autoPlay attribute, especially when audio is present.
    v.play().catch(e => console.warn('video.play() failed', e))
  }, [remoteStream])

  // Auto-close once the stream ends
  useEffect(() => {
    if (status === 'ended') {
      const t = setTimeout(onClose, 1500)
      return () => clearTimeout(t)
    }
  }, [status, onClose])

  const statusLabel =
    status === 'connecting' ? 'Connecting…'
    : status === 'ended'     ? 'Stream ended'
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

        {/* Diagnostic — shown always so we can see what's going on */}
        <div style={{ fontSize: 9, color: '#666', padding: '4px 8px', background: 'rgba(0,0,0,.04)', borderRadius: 6, margin: '4px 8px', fontFamily: 'monospace', lineHeight: 1.5 }}>
          <div><strong>RTC:</strong> conn={debug.connection} ice={debug.ice} sig={debug.signaling}</div>
          <div>tracks: total={debug.trackCount} audio={debug.audioTracks} video={debug.videoTracks}</div>
          {debug.lastError && <div style={{ color: '#ef4444' }}>err: {debug.lastError}</div>}
        </div>

        <LiveChat
          messages={chatMessages}
          currentUserId={currentUserId}
          onSend={onSendChat}
        />
      </div>
    </>
  )
}
