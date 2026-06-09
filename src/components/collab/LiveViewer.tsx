import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useLiveViewer } from '../../hooks/useLiveViewer'
import type { LiveSession } from '../../hooks/useLive'
import type { Profile } from '../../types/collab'
import type { LiveChatMessage } from '../../hooks/useLiveChat'
import LiveChat from './LiveChat'
import { expandPluginWindow, compactPluginWindow, isExpandSupported } from '../../lib/pluginWindow'
import { useT } from '../../i18n/LanguageContext'

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
  const { t } = useT()
  const { remoteStream, status, hostSource, viewerCount } = useLiveViewer(supabase, viewerId, session.id, session.host_id)
  const videoRef = useRef<HTMLVideoElement>(null)

  // To decide whether to render the video element vs the audio-only avatar,
  // we combine TWO signals because each is reliable in only one direction:
  //   - streamHasVideo (WebRTC):       fast on audio → video (ontrack fires
  //                                    immediately) but unreliable on
  //                                    video → audio (replaceTrack(null) on
  //                                    the sender doesn't always fire mute
  //                                    on the receiver, leaving a frozen
  //                                    last frame).
  //   - session.has_video (metadata):  flips fast in BOTH directions when
  //                                    the host calls updateLive.
  // We show video only when BOTH agree, so a stop signal from either side
  // collapses the UI to audio-only.
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

  // Expand-view (wide landscape) — viewer can toggle the plugin window to
  // a wider layout. Auto-collapse on unmount or session end so the user
  // doesn't end up with a giant empty window after the stream stops.
  const [expanded, setExpanded] = useState(false)
  const canExpand = isExpandSupported()
  // The .plugin shell root is hardcoded to 300x500, so growing the host
  // window alone leaves the inner UI clipped to the corner. Toggle a class
  // on it so the layout follows the window size while expanded.
  const setShellExpanded = (on: boolean) => {
    const root = document.querySelector('.plugin')
    if (!root) return
    root.classList.toggle('plugin-expanded', on)
  }
  useEffect(() => {
    return () => {
      // Always restore on unmount, regardless of last `expanded` value
      // (closures can capture a stale value).
      setShellExpanded(false)
      compactPluginWindow()
    }
  }, [])
  const toggleExpanded = async () => {
    const next = !expanded
    // Resize the shell class FIRST so the new layout is ready when the
    // host window finishes growing — otherwise you get a one-frame flash
    // of the 300x500 shell sitting in the corner of the big window.
    if (next) setShellExpanded(true)
    const ok = next ? await expandPluginWindow() : await compactPluginWindow()
    if (ok) {
      if (!next) setShellExpanded(false)
      setExpanded(next)
    } else {
      // Roll back the class if the native resize was rejected.
      setShellExpanded(expanded)
    }
  }

  // Source-of-truth priority:
  //   1. hostSource (signaled directly by the broadcaster on every change)
  //   2. session.has_video (live_sessions metadata via realtime)
  //   3. streamHasVideo (WebRTC track liveness)
  // hostSource is most reliable and immediate. Until it arrives we fall back
  // to the metadata + stream signal (this only matters for the very first
  // milliseconds of a session before the broadcast handshake completes).
  const showVideo = hostSource
    ? hostSource.has_video && streamHasVideo
    : streamHasVideo && session.has_video

  const ended = sessionEnded || status === 'ended'

  // Auto-restore compact size when the stream ends — the wide layout makes
  // no sense for the thank-you screen.
  useEffect(() => {
    if (ended && expanded) {
      setShellExpanded(false)
      compactPluginWindow()
      setExpanded(false)
    }
  }, [ended, expanded])

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
            <div className="live-ended-title">{t('live.thankYou')}</div>
            <div className="live-ended-sub">{t('live.streamEnded')}</div>
            <button className="live-go-btn" onClick={onClose}>Back</button>
          </div>
        </div>
      </>
    )
  }

  const statusLabel =
    status === 'connecting' ? t('live.connecting')
    : status === 'error'     ? t('live.connectionError')
    : ''

  return (
    <>
      <div className="s-header live-viewer-header">
        <div className="s-close" onClick={onClose}>&#8249;</div>
        <div className="live-viewer-titlebar">
          <div className="live-viewer-titlebar-row">
            <span className="live-title-badge">● LIVE</span>
            <span className="live-viewer-host">{host?.display_name ?? 'Unknown'}</span>
          </div>
          {session.title && (
            <div className="live-viewer-subtitle" title={session.title}>
              {session.title}
            </div>
          )}
        </div>
        {viewerCount > 0 && (
          <span className="live-viewer-count" title={`${viewerCount} watching`}>
            <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 3C4 3 1.5 8 1.5 8S4 13 8 13s6.5-5 6.5-5S12 3 8 3zm0 8a3 3 0 110-6 3 3 0 010 6z"/>
            </svg>
            {viewerCount}
          </span>
        )}
        {canExpand && (
          <button
            className="live-viewer-expand-btn"
            onClick={toggleExpanded}
            title={expanded ? 'Collapse view' : 'Expand view'}
            aria-label={expanded ? 'Collapse view' : 'Expand view'}
          >
            {/* Double-chevron arrows: » to expand wider, « to collapse
                back. Strokes drawn as SVG so they pick up currentColor
                from the button + scale crisply at any DPI. */}
            {expanded ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 4l-4 4 4 4" />
                <path d="M13 4l-4 4 4 4" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 4l4 4-4 4" />
                <path d="M7 4l4 4-4 4" />
              </svg>
            )}
          </button>
        )}
      </div>

      <div className={`live-viewer-body${expanded ? ' live-viewer-body-expanded' : ''}`}>
        {/* Wrapper around the video so the fullscreen button can be anchored
            to the actual video area (not the whole body). When in audio-only
            mode the wrapper collapses (display: none on .has-video=false). */}
        <div className={`live-viewer-video-wrap${showVideo ? '' : ' is-audio-only'}`}>
          <video
            ref={videoRef}
            className="live-viewer-video"
            autoPlay playsInline
          />
          {showVideo && (
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
        {!showVideo && (
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
            <div className="live-viewer-audio-label">{t('live.audioOnly')}</div>
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
