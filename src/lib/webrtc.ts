// WebRTC configuration. Google's public STUN servers are fine for MVP;
// TURN would be needed if viewers are behind restrictive NATs.
export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

// Channel name helper — every session gets its own broadcast channel
export function liveSignalingChannel(sessionId: string) {
  return `live-signal:${sessionId}`
}
