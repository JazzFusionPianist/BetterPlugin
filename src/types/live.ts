// Video source kinds for live streaming
export type VideoSourceKind = 'daw' | 'screen' | 'camera' | 'none' | 'native-window' | 'native-display'

export interface VideoSource {
  kind: VideoSourceKind
  deviceId?: string    // camera device id, or (for native-*) the SCK id as string
  label: string
  /** Optional hint for native-* entries — the app name so UI can group. */
  app?: string
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
