// Video source kinds for live streaming
export type VideoSourceKind = 'daw' | 'screen' | 'camera' | 'none'

export interface VideoSource {
  kind: VideoSourceKind
  deviceId?: string    // for camera / virtual camera
  label: string
}

// ── Signaling messages exchanged via Supabase Realtime broadcast ──
// Host = broadcaster, Viewer = watcher. Every message carries from/to
// so the broadcast channel can be shared by all participants.
export type SignalMessage =
  | { type: 'join';   from: string }                                          // viewer → host
  | { type: 'offer';  from: string; to: string; sdp: RTCSessionDescriptionInit } // host → viewer
  | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit } // viewer → host
  | { type: 'ice';    from: string; to: string; candidate: RTCIceCandidateInit } // both directions
  | { type: 'leave';  from: string }                                          // viewer → host
  | { type: 'bye';    from: string }                                          // host → all viewers
