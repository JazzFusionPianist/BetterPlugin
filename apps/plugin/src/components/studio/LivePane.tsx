/**
 * Live, inside the studio. The broadcaster room (LivePanel) and the
 * viewer (LiveViewer) run unchanged inside a `.plugin`-classed host set
 * into the main pane, the way games are — collab.css's live rules and
 * the paper register apply as they do in the full plug-in.
 *
 * The media / WebRTC machinery LIVES HERE and the pane stays mounted
 * (hidden) for the whole session: unmounting the broadcaster hook sends
 * `bye` and ends the stream for every viewer, and the viewer hook sends
 * `leave`. The shell only owns `useLive` (it needs liveHostIds for the
 * rail) and hands the session list + start/end/update down.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import type { VideoSource } from '../../types/live'
import type { LiveSession, useLive } from '../../hooks/useLive'
import { useMediaSource } from '../../hooks/useMediaSource'
import { useLiveBroadcaster } from '../../hooks/useLiveBroadcaster'
import { useLiveChat } from '../../hooks/useLiveChat'
import LivePanel from '../collab/LivePanel'
import LiveViewer from '../collab/LiveViewer'
import '../../pages/collab.css'

interface Props {
  supabase: SupabaseClient
  userId: string
  me: Profile | null
  profiles: Profile[]
  liveSessions: LiveSession[]
  mySession: LiveSession | null
  startLive: ReturnType<typeof useLive>['startLive']
  endLive: ReturnType<typeof useLive>['endLive']
  updateLive: ReturnType<typeof useLive>['updateLive']
  /** "watch this session" from the rail / chat header — nonce so the
   *  same session can be re-requested after backing out. */
  watchRequest: { sessionId: string; nonce: number } | null
  /** Shown or parked (a live stream must not drop while chatting). */
  hidden?: boolean
  onClose: () => void
  /** Reports whether we're broadcasting or watching, for the rail. */
  onState?: (s: { broadcasting: boolean; watching: LiveSession | null; viewers: number }) => void
}

export default function LivePane({
  supabase, userId, me, profiles, liveSessions, mySession, startLive, endLive, updateLive,
  watchRequest, hidden, onClose, onState,
}: Props) {
  const { stream: localStream, error: mediaError, startStream, stopStream, replaceSource, listSources, listMicrophones, screenCaptureSupported } = useMediaSource()
  const sources = useMemo(() => listSources(), [listSources])
  const microphones = useMemo(() => listMicrophones(), [listMicrophones])
  const { viewerCount, totalViewers, peakViewers } = useLiveBroadcaster(supabase, userId, mySession?.id ?? null, localStream)

  // The viewer keeps its own snapshot so the ended screen can still show
  // the host after the row has dropped out of liveSessions.
  const [watchingSession, setWatchingSession] = useState<LiveSession | null>(null)
  useEffect(() => {
    if (!watchRequest) return
    const s = liveSessions.find(x => x.id === watchRequest.sessionId)
    if (s) setWatchingSession(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchRequest])
  useEffect(() => {
    if (!watchingSession) return
    const fresh = liveSessions.find(s => s.id === watchingSession.id)
    if (!fresh) return
    if (fresh.has_video === watchingSession.has_video && fresh.has_audio === watchingSession.has_audio
      && fresh.video_source === watchingSession.video_source && fresh.title === watchingSession.title) return
    setWatchingSession(fresh)
  }, [liveSessions, watchingSession])
  const watchingHost = watchingSession ? profiles.find(p => p.id === watchingSession.host_id) ?? null : null

  // One chat channel — my broadcast, or the one I'm watching.
  const chatSessionId = mySession?.id ?? watchingSession?.id ?? null
  const chatMe = useMemo(() => me ? {
    id: userId, name: me.display_name || 'user', color: me.avatar_color || '#4A8FE7',
  } : null, [me, userId])
  const { messages: chatMessages, sendMessage: sendChat } = useLiveChat(supabase, chatSessionId, chatMe)

  const [liveError, setLiveError] = useState<string | null>(null)
  const handleStartLive = useCallback(async (title: string, source: VideoSource, micDeviceId: string | null) => {
    setLiveError(null)
    const ms = await startStream(source, micDeviceId)
    if (!ms) return
    const hasVideo = source.kind !== 'none'
    const hasAudio = ms.getAudioTracks().length > 0
    try {
      const videoSource: LiveSession['video_source'] =
        source.kind === 'native-window' ? 'daw'
        : source.kind === 'native-display' ? 'screen'
        : source.kind === 'native-picker' ? 'daw'
        : source.kind
      await startLive(title, { has_video: hasVideo, has_audio: hasAudio, video_source: videoSource })
    } catch (e) {
      setLiveError(`couldn’t go live — ${e instanceof Error ? e.message : String(e)}`)
      stopStream()
    }
  }, [startStream, stopStream, startLive])
  const handleEndLive = useCallback(async () => { stopStream(); await endLive() }, [stopStream, endLive])
  const handleReplaceSource = useCallback(async (source: VideoSource, micDeviceId: string | null): Promise<VideoSource | null> => {
    const actual = await replaceSource(source, micDeviceId)
    if (!actual) return null
    const videoSource: LiveSession['video_source'] =
      actual.kind === 'native-window' ? 'daw'
      : actual.kind === 'native-display' ? 'screen'
      : actual.kind === 'native-picker' ? 'daw'
      : (actual.kind as LiveSession['video_source'])
    await updateLive({ has_video: actual.kind !== 'none', video_source: videoSource })
    return actual
  }, [replaceSource, updateLive])

  useEffect(() => {
    onState?.({ broadcasting: !!mySession, watching: watchingSession, viewers: viewerCount })
  }, [mySession, watchingSession, viewerCount, onState])

  const sessionEnded = !!watchingSession && !liveSessions.find(s => s.id === watchingSession.id)
  const title = watchingSession
    ? (watchingHost?.display_name ?? 'live')
    : mySession ? 'you’re live' : 'live'

  return (
    <div className="wd-live plugin live-open screen-wide" hidden={hidden}>
      <div className="top-bar wd-games-bar">
        <button className="wd-games-back" onClick={watchingSession ? () => setWatchingSession(null) : onClose}>
          ‹ {watchingSession ? 'live' : 'studio'}
        </button>
        <span className="wd-games-title">{title}</span>
        {mySession && viewerCount > 0 && (
          <span className="wd-live-count">{viewerCount} {viewerCount === 1 ? 'person' : 'people'} watching</span>
        )}
      </div>
      <div className="content">
        <div className="view lvview">
          {watchingSession ? (
            <LiveViewer
              supabase={supabase}
              viewerId={userId}
              session={watchingSession}
              host={watchingHost}
              currentUserId={userId}
              chatMessages={chatMessages}
              sessionEnded={sessionEnded}
              onSendChat={sendChat}
              onClose={() => setWatchingSession(null)}
            />
          ) : (
            <LivePanel
              isOpen={!hidden}
              mySession={mySession}
              liveSessions={liveSessions}
              profiles={profiles}
              myProfile={me}
              sources={sources}
              microphones={microphones}
              localStream={localStream}
              viewerCount={viewerCount}
              totalViewers={totalViewers}
              peakViewers={peakViewers}
              onReplaceSource={handleReplaceSource}
              mediaError={mediaError || liveError}
              screenCaptureSupported={screenCaptureSupported}
              currentUserId={userId}
              chatMessages={chatMessages}
              onSendChat={sendChat}
              onStartLive={handleStartLive}
              onEndLive={handleEndLive}
              onWatchLive={(sessionId) => { const s = liveSessions.find(x => x.id === sessionId); if (s) setWatchingSession(s) }}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
