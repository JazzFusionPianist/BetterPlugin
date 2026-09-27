import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LiveChannel } from '../lib/liveChannel'
import type { SignalMessage } from '../types/live'
import { rtcConfig, ensureTurnLoaded } from '../lib/webrtc'

export type ViewerStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'error'

/**
 * Viewer-side: connects to the host for `sessionId` and receives their
 * live MediaStream. Returns the remote stream to render in a <video>.
 */
export interface ViewerDebug {
  connection: RTCPeerConnectionState
  ice: RTCIceConnectionState
  signaling: RTCSignalingState
  trackCount: number
  audioTracks: number
  videoTracks: number
  lastError: string
}

export function useLiveViewer(
  client: SupabaseClient,
  viewerId: string,
  sessionId: string | null,
  hostId: string | null,
) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<ViewerStatus>('idle')
  // Source state announced by the host via the 'source' broadcast — true
  // source of truth for whether the host is currently sending video/audio.
  // null until the host announces (or the new-viewer-join handshake fires).
  const [hostSource, setHostSource] = useState<{ has_video: boolean; has_audio: boolean } | null>(null)
  // Current live viewer count, kept in sync with whatever the broadcaster
  // last announced via the 'viewer_count' signal. Falls back to 1 once
  // we're connected — at minimum the local viewer is watching.
  const [viewerCount, setViewerCount] = useState<number>(0)
  const [debug, setDebug] = useState<ViewerDebug>({
    connection: 'new', ice: 'new', signaling: 'stable',
    trackCount: 0, audioTracks: 0, videoTracks: 0, lastError: '',
  })
  const pcRef      = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<LiveChannel | null>(null)

  useEffect(() => {
    if (!sessionId || !hostId) return
    let cancelled = false
    let cleanup: (() => void) | null = null

    setStatus('connecting')

    // Ensure TURN credentials are loaded before creating the PC — without
    // them, symmetric NAT prevents the connection from establishing.
    ensureTurnLoaded(client, sessionId).then(() => {
      if (cancelled || !sessionId || !hostId) return
      cleanup = setupConnection()
    }).catch(() => { if (!cancelled) setStatus('error') })

    return () => {
      cancelled = true
      cleanup?.()
    }

    function setupConnection(): () => void {
      // Re-check inside the function so TS narrows the types
      if (!sessionId || !hostId) throw new Error('unreachable')

    const pc = new RTCPeerConnection(rtcConfig)
    pcRef.current = pc

    const remote = new MediaStream()
    setRemoteStream(remote)

    const refreshDebug = () => {
      const tracks = remote.getTracks()
      setDebug(d => ({
        ...d,
        connection: pc.connectionState,
        ice: pc.iceConnectionState,
        signaling: pc.signalingState,
        trackCount: tracks.length,
        audioTracks: tracks.filter(t => t.kind === 'audio').length,
        videoTracks: tracks.filter(t => t.kind === 'video').length,
      }))
    }

    pc.ontrack = (ev) => {

      // When the host cycles audio→video→audio→video, each video transition
      // creates a NEW video transceiver on the host (because replaceTrack(null)
      // leaves the sender with track=null and the next addTrack creates a fresh
      // sender). On the viewer that means multiple video tracks accumulate
      // in our remote stream, and the <video> element plays the FIRST one,
      // which is now muted/dead — giving a black frame even though a fresh
      // video track is also present. Drop any existing track of the same
      // kind before adding the new one.
      for (const existing of remote.getTracks()) {
        if (existing.kind === ev.track.kind && existing !== ev.track) {
          remote.removeTrack(existing)
        }
      }
      remote.addTrack(ev.track)
      setRemoteStream(new MediaStream(remote.getTracks()))
      refreshDebug()
      ev.track.onunmute = () => {

        setRemoteStream(new MediaStream(remote.getTracks()))
      }
      ev.track.onmute = () => {

      }
    }
    pc.onconnectionstatechange = () => {

      if (pc.connectionState === 'connected') setStatus('connected')
      if (pc.connectionState === 'closed') setStatus('ended')
      refreshDebug()
    }
    pc.oniceconnectionstatechange = () => {

      refreshDebug()
    }
    pc.onicegatheringstatechange = () => {

    }
    pc.onsignalingstatechange = () => {

      refreshDebug()
    }

    const send = (msg: SignalMessage) => {
      channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg })
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {

        send({ type: 'ice', from: viewerId, to: hostId, candidate: ev.candidate.toJSON() })
      }
    }

    const channel = new LiveChannel(client, sessionId)

    let retryTimer: ReturnType<typeof setInterval> | null = null
    let connected = false



    channel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const msg = payload as SignalMessage
        // Defensive self-filter
        if (msg.from !== hostId) return

        if (msg.type === 'offer' && msg.to === viewerId) {
          try {
            connected = true
            if (retryTimer) { clearInterval(retryTimer); retryTimer = null }
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            send({ type: 'answer', from: viewerId, to: hostId, sdp: answer })
          } catch (e) {
            const err = e instanceof Error ? e.message : String(e)
            console.warn('answer failed', e)
            setDebug(d => ({ ...d, lastError: `answer: ${err}` }))
            setStatus('error')
          }
        } else if (msg.type === 'ice' && msg.to === viewerId) {
          try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)) }
          catch (e) {
            const err = e instanceof Error ? e.message : String(e)
            console.warn('addIceCandidate failed', e)
            setDebug(d => ({ ...d, lastError: `ice: ${err}` }))
          }
        } else if (msg.type === 'bye') {
          setStatus('ended')
        } else if (msg.type === 'source') {

          setHostSource({ has_video: msg.has_video, has_audio: msg.has_audio })
        } else if (msg.type === 'viewer_count') {
          setViewerCount(msg.count)
        }
      })
      .subscribe((status) => {
        if (status === 'CLOSED') { pc.close(); setRemoteStream(null); setStatus('ended'); if (retryTimer) clearInterval(retryTimer) }

        if (status === 'SUBSCRIBED') {

          send({ type: 'join', from: viewerId })
          retryTimer = setInterval(() => {
            if (connected) { if (retryTimer) clearInterval(retryTimer); return }

            send({ type: 'join', from: viewerId })
          }, 2500)
        }
      })

    channelRef.current = channel

    return () => {
      if (retryTimer) clearInterval(retryTimer)
      send({ type: 'leave', from: viewerId })
      pc.close()
      pcRef.current = null
      channel.close()
      channelRef.current = null
      setRemoteStream(null)
      setStatus('idle')
    }
    }  // end setupConnection
  }, [client, viewerId, sessionId, hostId])

  return { remoteStream, status, debug, hostSource, viewerCount }
}
