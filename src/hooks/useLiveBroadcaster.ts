import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { SignalMessage } from '../types/live'
import { rtcConfig, liveSignalingChannel } from '../lib/webrtc'

/**
 * Host-side: accepts viewer join requests, creates a per-viewer
 * RTCPeerConnection, and streams `localStream` to each of them.
 *
 * Activates only when both `sessionId` and `localStream` are non-null.
 */
export interface PeerState {
  id: string
  connection: RTCPeerConnectionState
  ice: RTCIceConnectionState
}

export function useLiveBroadcaster(
  client: SupabaseClient,
  hostId: string,
  sessionId: string | null,
  localStream: MediaStream | null,
) {
  const [viewerIds, setViewerIds] = useState<Set<string>>(new Set())
  const [peerStates, setPeerStates] = useState<PeerState[]>([])
  const peersRef    = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef  = useRef<RealtimeChannel | null>(null)

  const refreshPeerStates = () => {
    setPeerStates(Array.from(peersRef.current.entries()).map(([id, pc]) => ({
      id, connection: pc.connectionState, ice: pc.iceConnectionState,
    })))
  }

  useEffect(() => {
    if (!sessionId || !localStream) return

    const send = (msg: SignalMessage) => {
      channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg })
    }

    const handleJoin = async (viewerId: string) => {
      if (peersRef.current.has(viewerId)) return
      const pc = new RTCPeerConnection(rtcConfig)
      peersRef.current.set(viewerId, pc)
      setViewerIds(prev => new Set(prev).add(viewerId))

      localStream.getTracks().forEach(track => pc.addTrack(track, localStream))

      pc.onicecandidate = (ev) => {
        if (ev.candidate) send({ type: 'ice', from: hostId, to: viewerId, candidate: ev.candidate.toJSON() })
      }
      pc.onconnectionstatechange = () => {
        refreshPeerStates()
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          removeViewer(viewerId)
        }
      }
      pc.oniceconnectionstatechange = refreshPeerStates

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      send({ type: 'offer', from: hostId, to: viewerId, sdp: offer })
    }

    const handleAnswer = async (viewerId: string, sdp: RTCSessionDescriptionInit) => {
      const pc = peersRef.current.get(viewerId)
      if (!pc) return
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    }

    const handleIce = async (viewerId: string, candidate: RTCIceCandidateInit) => {
      const pc = peersRef.current.get(viewerId)
      if (!pc) return
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) }
      catch (e) { console.warn('addIceCandidate failed', e) }
    }

    const removeViewer = (viewerId: string) => {
      const pc = peersRef.current.get(viewerId)
      pc?.close()
      peersRef.current.delete(viewerId)
      setViewerIds(prev => { const n = new Set(prev); n.delete(viewerId); return n })
    }

    const channel = client.channel(liveSignalingChannel(sessionId), {
      config: { broadcast: { self: false, ack: false } },
    })

    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        const msg = payload as SignalMessage
        if (msg.type === 'join') {
          handleJoin(msg.from)
        } else if (msg.type === 'answer' && msg.to === hostId) {
          handleAnswer(msg.from, msg.sdp)
        } else if (msg.type === 'ice' && msg.to === hostId) {
          handleIce(msg.from, msg.candidate)
        } else if (msg.type === 'leave') {
          removeViewer(msg.from)
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      // Notify viewers we're going away, then tear everything down
      send({ type: 'bye', from: hostId })
      peersRef.current.forEach(pc => pc.close())
      peersRef.current.clear()
      setViewerIds(new Set())
      client.removeChannel(channel)
      channelRef.current = null
    }
  }, [client, hostId, sessionId, localStream])

  return { viewerCount: viewerIds.size, peerStates }
}
