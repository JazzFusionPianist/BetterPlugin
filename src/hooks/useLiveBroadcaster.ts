import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { SignalMessage } from '../types/live'
import { rtcConfig, liveSignalingChannel } from '../lib/webrtc'

/**
 * Host-side: accepts viewer join requests, creates a per-viewer
 * RTCPeerConnection, and streams `localStream` to each of them.
 *
 * Peer connections are only torn down when the session ends. When the
 * localStream's tracks change (e.g. user switches video source mid-stream),
 * we call RTCRtpSender.replaceTrack on each peer instead of renegotiating,
 * so viewers experience a seamless source swap.
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
  const [totalViewers, setTotalViewers] = useState(0)
  const [peakViewers,  setPeakViewers]  = useState(0)
  const peersRef       = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef     = useRef<RealtimeChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(localStream)
  const seenViewersRef = useRef<Set<string>>(new Set())

  // Keep the latest stream in a ref so handleJoin / replacement effects can
  // read the current set of tracks without becoming an effect dependency.
  useEffect(() => { localStreamRef.current = localStream }, [localStream])

  const refreshPeerStates = () => {
    setPeerStates(Array.from(peersRef.current.entries()).map(([id, pc]) => ({
      id, connection: pc.connectionState, ice: pc.iceConnectionState,
    })))
  }

  // ── Peer setup effect — depends ONLY on sessionId ─────────────────────────
  useEffect(() => {
    if (!sessionId) return

    const send = (msg: SignalMessage) => {
      channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg })
    }

    const handleJoin = (viewerId: string) => {
      if (peersRef.current.has(viewerId)) return
      const stream = localStreamRef.current
      if (!stream) return   // wait until local stream is ready
      const pc = new RTCPeerConnection(rtcConfig)
      peersRef.current.set(viewerId, pc)
      setViewerIds(prev => {
        const n = new Set(prev).add(viewerId)
        setPeakViewers(pk => Math.max(pk, n.size))
        return n
      })
      if (!seenViewersRef.current.has(viewerId)) {
        seenViewersRef.current.add(viewerId)
        setTotalViewers(seenViewersRef.current.size)
      }

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

      // Auto-renegotiate whenever tracks are added/removed (e.g. switching
      // from audio-only to video mid-stream). Guard against concurrent offers.
      let makingOffer = false
      pc.onnegotiationneeded = async () => {
        if (makingOffer || pc.signalingState !== 'stable') return
        makingOffer = true
        try {
          const offer = await pc.createOffer()
          if (pc.signalingState !== 'stable') return   // bail if state changed
          await pc.setLocalDescription(offer)
          send({ type: 'offer', from: hostId, to: viewerId, sdp: pc.localDescription! })
        } catch (e) {
          console.warn('[broadcaster] renegotiation failed', e)
        } finally {
          makingOffer = false
        }
      }

      // Adding tracks triggers onnegotiationneeded → offer sent automatically
      stream.getTracks().forEach(track => pc.addTrack(track, stream))
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
      send({ type: 'bye', from: hostId })
      peersRef.current.forEach(pc => pc.close())
      peersRef.current.clear()
      setViewerIds(new Set())
      client.removeChannel(channel)
      channelRef.current = null
    }
  }, [client, hostId, sessionId])

  // ── Track replacement — when localStream tracks change, swap them on the
  // existing senders instead of renegotiating. Also adds NEW kinds (e.g.
  // audio added for the first time) by calling addTrack.
  useEffect(() => {
    if (!localStream) return
    const tracks = localStream.getTracks()
    peersRef.current.forEach(pc => {
      const senders = pc.getSenders()
      for (const track of tracks) {
        const existing = senders.find(s => s.track && s.track.kind === track.kind)
        if (existing) {
          if (existing.track !== track) existing.replaceTrack(track).catch(e => console.warn('replaceTrack failed', e))
        } else {
          // New kind (e.g., mic added after start-with-DAW-only)
          try { pc.addTrack(track, localStream) }
          catch (e) { console.warn('addTrack during replacement failed', e) }
        }
      }
      // If the new stream dropped a kind, null the sender so viewers stop receiving it
      senders.forEach(s => {
        if (s.track && !tracks.find(t => t.kind === s.track!.kind && t.id === s.track!.id)) {
          // check: is there any track of this kind in the new list?
          if (!tracks.find(t => t.kind === s.track!.kind)) {
            s.replaceTrack(null).catch(() => {})
          }
        }
      })
    })
  }, [localStream])

  // Reset stats when a new session starts
  useEffect(() => {
    if (sessionId) {
      seenViewersRef.current = new Set()
      setTotalViewers(0)
      setPeakViewers(0)
    }
  }, [sessionId])

  return { viewerCount: viewerIds.size, peerStates, totalViewers, peakViewers }
}
