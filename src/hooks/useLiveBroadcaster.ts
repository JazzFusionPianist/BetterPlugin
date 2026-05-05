import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { SignalMessage } from '../types/live'
import { rtcConfig, liveSignalingChannel, ensureTurnLoaded } from '../lib/webrtc'

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
    let cancelled = false
    let cleanup: (() => void) | null = null

    // Make sure TURN credentials are loaded before we accept any joins.
    // Without this the very first viewer gets a STUN-only PC and can't
    // traverse symmetric NATs.
    ensureTurnLoaded().then(() => {
      if (cancelled) return
      cleanup = setupChannel()
    })

    return () => {
      cancelled = true
      cleanup?.()
    }

    function setupChannel(): () => void {
    if (!sessionId) throw new Error('unreachable')

    const send = (msg: SignalMessage) => {
      channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg })
    }

    const handleJoin = (viewerId: string) => {
      if (peersRef.current.has(viewerId)) return
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
        if (ev.candidate) {
          console.log('[broadcaster] local ICE candidate type=', ev.candidate.type, 'protocol=', ev.candidate.protocol)
          send({ type: 'ice', from: hostId, to: viewerId, candidate: ev.candidate.toJSON() })
        }
      }
      pc.onconnectionstatechange = () => {
        console.log('[broadcaster] pc(', viewerId, ') connectionState:', pc.connectionState)
        refreshPeerStates()
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          removeViewer(viewerId)
        }
      }
      pc.oniceconnectionstatechange = () => {
        console.log('[broadcaster] pc(', viewerId, ') iceConnectionState:', pc.iceConnectionState)
        refreshPeerStates()
      }
      pc.onicegatheringstatechange = () => {
        console.log('[broadcaster] pc(', viewerId, ') iceGatheringState:', pc.iceGatheringState)
      }

      // Auto-renegotiate whenever tracks are added/removed (e.g. switching
      // from audio-only to video mid-stream). Guard against concurrent offers.
      let makingOffer = false
      pc.onnegotiationneeded = async () => {
        console.log('[broadcaster] onnegotiationneeded for', viewerId, 'signalingState=', pc.signalingState)
        if (makingOffer || pc.signalingState !== 'stable') return
        makingOffer = true
        try {
          const offer = await pc.createOffer()
          if (pc.signalingState !== 'stable') return
          await pc.setLocalDescription(offer)
          console.log('[broadcaster] sending offer to', viewerId)
          send({ type: 'offer', from: hostId, to: viewerId, sdp: pc.localDescription! })
        } catch (e) {
          console.warn('[broadcaster] renegotiation failed', e)
        } finally {
          makingOffer = false
        }
      }

      // Adding tracks triggers onnegotiationneeded → offer sent automatically.
      // If localStream isn't ready yet, the track-replacement effect below will
      // addTrack on this peer when the stream arrives.
      const stream = localStreamRef.current
      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream))
        // Also broadcast current source state so the new viewer's UI knows
        // whether to show video element or audio-only avatar — independent
        // of whether the live_sessions metadata has reached them yet.
        const tracks = stream.getTracks()
        send({
          type: 'source',
          from: hostId,
          has_video: tracks.some(t => t.kind === 'video'),
          has_audio: tracks.some(t => t.kind === 'audio'),
        })
      } else {
        console.warn('[broadcaster] viewer joined before localStream ready — peer queued')
      }
    }

    const handleAnswer = async (viewerId: string, sdp: RTCSessionDescriptionInit) => {
      const pc = peersRef.current.get(viewerId)
      if (!pc) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      } catch (e) {
        console.error('[broadcaster] setRemoteDescription failed for', viewerId, e)
        pc.close()
        peersRef.current.delete(viewerId)
        setViewerIds(prev => { const n = new Set(prev); n.delete(viewerId); return n })
      }
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

    console.log('[broadcaster] mounting, sessionId=', sessionId, 'hostId=', hostId)

    const channel = client.channel(liveSignalingChannel(sessionId), {
      config: { broadcast: { self: false, ack: false } },
    })

    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        const msg = payload as SignalMessage
        // Filter self-broadcasts defensively (Supabase config { self: false }
        // doesn't always filter — and even if it does, we don't want our own
        // offer/ice echoing into the answer flow).
        if (msg.from === hostId) return
        console.log('[broadcaster] received signal:', msg.type, 'from=', msg.from)
        if (msg.type === 'join') {
          console.log('[broadcaster] handling join for viewer', msg.from, 'localStream?', !!localStreamRef.current)
          handleJoin(msg.from)
        } else if (msg.type === 'answer' && msg.to === hostId) {
          handleAnswer(msg.from, msg.sdp)
        } else if (msg.type === 'ice' && msg.to === hostId) {
          handleIce(msg.from, msg.candidate)
        } else if (msg.type === 'leave') {
          removeViewer(msg.from)
        }
      })
      .subscribe(status => {
        console.log('[broadcaster] channel sub status:', status)
      })

    channelRef.current = channel

    return () => {
      send({ type: 'bye', from: hostId })
      peersRef.current.forEach(pc => pc.close())
      peersRef.current.clear()
      setViewerIds(new Set())
      client.removeChannel(channel)
      channelRef.current = null
    }
    }  // end setupChannel
  }, [client, hostId, sessionId])

  // ── Track replacement — when localStream tracks change, swap them on the
  // existing senders instead of renegotiating. Also adds NEW kinds (e.g.
  // audio added for the first time) by calling addTrack — but only when the
  // peer is in 'stable' signalingState. Adding tracks while an offer is
  // in flight would change the local SDP and the incoming answer would have
  // a mismatched m-line order ("Failed to set remote answer sdp" error).
  useEffect(() => {
    if (!localStream) return
    const tracks = localStream.getTracks()
    const hasVideo = tracks.some(t => t.kind === 'video')
    const hasAudio = tracks.some(t => t.kind === 'audio')
    console.log('[broadcaster] localStream changed, peers:', peersRef.current.size,
      'tracks:', tracks.map(t => `${t.kind}:${t.id.slice(0, 8)}`))
    peersRef.current.forEach((pc, viewerId) => {
      const senders = pc.getSenders()
      for (const track of tracks) {
        const existing = senders.find(s => s.track && s.track.kind === track.kind)
        if (existing) {
          if (existing.track !== track) {
            console.log('[broadcaster] replaceTrack on', viewerId, 'kind=', track.kind)
            existing.replaceTrack(track).catch(e => console.warn('replaceTrack failed', e))
          }
        } else if (pc.signalingState !== 'stable') {
          console.warn('[broadcaster] deferring addTrack — signalingState:', pc.signalingState)
        } else {
          console.log('[broadcaster] addTrack on', viewerId, 'kind=', track.kind)
          try { pc.addTrack(track, localStream) }
          catch (e) { console.warn('addTrack during replacement failed', e) }
        }
      }
      senders.forEach(s => {
        if (s.track && !tracks.find(t => t.kind === s.track!.kind)) {
          console.log('[broadcaster] dropping sender on', viewerId, 'kind=', s.track.kind)
          s.replaceTrack(null).catch(() => {})
        }
      })
    })

    // Tell viewers explicitly whether the stream has video/audio right now.
    // Don't rely on the live_sessions metadata realtime sync — this signal
    // travels on the same broadcast channel as offers/ICE so it's reliable
    // and immediate. Also covers the new-viewer-joining case (channel
    // ref might not be ready yet — guard for that).
    channelRef.current?.send({
      type: 'broadcast',
      event: 'signal',
      payload: { type: 'source', from: hostId, has_video: hasVideo, has_audio: hasAudio },
    })
  }, [localStream, hostId])

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
