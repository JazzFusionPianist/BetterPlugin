import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { SignalMessage } from '../types/live'
import { rtcConfig, liveSignalingChannel } from '../lib/webrtc'

export type ViewerStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'error'

/**
 * Viewer-side: connects to the host for `sessionId` and receives their
 * live MediaStream. Returns the remote stream to render in a <video>.
 */
export function useLiveViewer(
  client: SupabaseClient,
  viewerId: string,
  sessionId: string | null,
  hostId: string | null,
) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<ViewerStatus>('idle')
  const pcRef      = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!sessionId || !hostId) return
    setStatus('connecting')

    const pc = new RTCPeerConnection(rtcConfig)
    pcRef.current = pc

    const remote = new MediaStream()
    setRemoteStream(remote)

    pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach(t => remote.addTrack(t))
      // Trigger re-render with a fresh stream object so <video> updates
      setRemoteStream(new MediaStream(remote.getTracks()))
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('connected')
      if (['failed', 'closed'].includes(pc.connectionState)) setStatus('ended')
    }

    const send = (msg: SignalMessage) => {
      channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg })
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) send({ type: 'ice', from: viewerId, to: hostId, candidate: ev.candidate.toJSON() })
    }

    const channel = client.channel(liveSignalingChannel(sessionId), {
      config: { broadcast: { self: false, ack: false } },
    })

    channel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const msg = payload as SignalMessage
        if (msg.type === 'offer' && msg.to === viewerId) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            send({ type: 'answer', from: viewerId, to: hostId, sdp: answer })
          } catch (e) {
            console.warn('answer failed', e)
            setStatus('error')
          }
        } else if (msg.type === 'ice' && msg.to === viewerId) {
          try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)) }
          catch (e) { console.warn('addIceCandidate failed', e) }
        } else if (msg.type === 'bye') {
          setStatus('ended')
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Announce our presence so the host starts negotiation
          send({ type: 'join', from: viewerId })
        }
      })

    channelRef.current = channel

    return () => {
      send({ type: 'leave', from: viewerId })
      pc.close()
      pcRef.current = null
      client.removeChannel(channel)
      channelRef.current = null
      setRemoteStream(null)
      setStatus('idle')
    }
  }, [client, viewerId, sessionId, hostId])

  return { remoteStream, status }
}
