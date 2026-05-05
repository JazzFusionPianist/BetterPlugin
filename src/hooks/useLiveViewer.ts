import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { SignalMessage } from '../types/live'
import { rtcConfig, liveSignalingChannel, ensureTurnLoaded } from '../lib/webrtc'

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
  const [debug, setDebug] = useState<ViewerDebug>({
    connection: 'new', ice: 'new', signaling: 'stable',
    trackCount: 0, audioTracks: 0, videoTracks: 0, lastError: '',
  })
  const pcRef      = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!sessionId || !hostId) return
    let cancelled = false
    let cleanup: (() => void) | null = null

    setStatus('connecting')

    // Ensure TURN credentials are loaded before creating the PC — without
    // them, symmetric NAT prevents the connection from establishing.
    ensureTurnLoaded().then(() => {
      if (cancelled || !sessionId || !hostId) return
      cleanup = setupConnection()
    })

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
      console.log('[viewer] ontrack:', ev.track.kind, 'id:', ev.track.id.slice(0, 8),
        'enabled:', ev.track.enabled, 'muted:', ev.track.muted)
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
        console.log('[viewer] track unmuted:', ev.track.kind)
        setRemoteStream(new MediaStream(remote.getTracks()))
      }
      ev.track.onmute = () => {
        console.log('[viewer] track muted:', ev.track.kind)
      }
    }
    pc.onconnectionstatechange = () => {
      console.log('[viewer] connectionState:', pc.connectionState)
      if (pc.connectionState === 'connected') setStatus('connected')
      if (pc.connectionState === 'closed') setStatus('ended')
      refreshDebug()
    }
    pc.oniceconnectionstatechange = () => {
      console.log('[viewer] iceConnectionState:', pc.iceConnectionState)
      refreshDebug()
    }
    pc.onicegatheringstatechange = () => {
      console.log('[viewer] iceGatheringState:', pc.iceGatheringState)
    }
    pc.onsignalingstatechange = () => {
      console.log('[viewer] signalingState:', pc.signalingState)
      refreshDebug()
    }

    const send = (msg: SignalMessage) => {
      channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg })
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        console.log('[viewer] local ICE candidate type=', ev.candidate.type, 'protocol=', ev.candidate.protocol)
        send({ type: 'ice', from: viewerId, to: hostId, candidate: ev.candidate.toJSON() })
      }
    }

    const channel = client.channel(liveSignalingChannel(sessionId), {
      config: { broadcast: { self: false, ack: false } },
    })

    let retryTimer: ReturnType<typeof setInterval> | null = null
    let connected = false

    console.log('[viewer] mounting, sessionId=', sessionId, 'hostId=', hostId, 'viewerId=', viewerId)

    channel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const msg = payload as SignalMessage
        // Defensive self-filter
        if (msg.from === viewerId) return
        console.log('[viewer] received signal:', msg.type, 'to=' in msg ? (msg as { to?: string }).to : '-', 'from=', msg.from)
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
          console.log('[viewer] host source update:', msg.has_video, msg.has_audio)
          setHostSource({ has_video: msg.has_video, has_audio: msg.has_audio })
        }
      })
      .subscribe((status) => {
        console.log('[viewer] channel sub status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('[viewer] sending join, from=', viewerId)
          send({ type: 'join', from: viewerId })
          retryTimer = setInterval(() => {
            if (connected) { if (retryTimer) clearInterval(retryTimer); return }
            console.log('[viewer] retry join')
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
      client.removeChannel(channel)
      channelRef.current = null
      setRemoteStream(null)
      setStatus('idle')
    }
    }  // end setupConnection
  }, [client, viewerId, sessionId, hostId])

  return { remoteStream, status, debug, hostSource }
}
