import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { SignalMessage } from '../types/live'
import { rtcConfig, liveSignalingChannel } from '../lib/webrtc'

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
  const [debug, setDebug] = useState<ViewerDebug>({
    connection: 'new', ice: 'new', signaling: 'stable',
    trackCount: 0, audioTracks: 0, videoTracks: 0, lastError: '',
  })
  const pcRef      = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!sessionId || !hostId) return
    setStatus('connecting')

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
      ev.streams[0]?.getTracks().forEach(t => remote.addTrack(t))
      // Trigger re-render with a fresh stream object so <video> updates
      setRemoteStream(new MediaStream(remote.getTracks()))
      refreshDebug()
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('connected')
      // Don't go to 'ended' on transient ICE failures — wait for explicit
      // 'closed' (peer torn down). Failed connections often recover when
      // the host re-sends an offer after re-creating the peer connection.
      if (pc.connectionState === 'closed') setStatus('ended')
      refreshDebug()
    }
    pc.oniceconnectionstatechange = refreshDebug
    pc.onsignalingstatechange = refreshDebug

    const send = (msg: SignalMessage) => {
      channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg })
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) send({ type: 'ice', from: viewerId, to: hostId, candidate: ev.candidate.toJSON() })
    }

    const channel = client.channel(liveSignalingChannel(sessionId), {
      config: { broadcast: { self: false, ack: false } },
    })

    let retryTimer: ReturnType<typeof setInterval> | null = null
    let connected = false
    // Queue ICE candidates that arrive before remoteDescription is set,
    // then drain after setRemoteDescription. Without this, early ICE
    // candidates throw and are lost — leaving the connection unable
    // to traverse NAT.
    const iceQueue: RTCIceCandidateInit[] = []
    let remoteDescSet = false

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
            remoteDescSet = true
            // Drain queued ICE
            for (const c of iceQueue) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)) }
              catch (e) { console.warn('queued ICE add failed', e) }
            }
            iceQueue.length = 0
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
          if (!remoteDescSet) {
            iceQueue.push(msg.candidate)
            return
          }
          try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)) }
          catch (e) {
            const err = e instanceof Error ? e.message : String(e)
            console.warn('addIceCandidate failed', e)
            setDebug(d => ({ ...d, lastError: `ice: ${err}` }))
          }
        } else if (msg.type === 'bye') {
          setStatus('ended')
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
  }, [client, viewerId, sessionId, hostId])

  return { remoteStream, status, debug }
}
