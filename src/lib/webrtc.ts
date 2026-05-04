// WebRTC configuration. Google's public STUN servers — sufficient for most
// home networks. TURN was tried briefly but the public Open Relay credentials
// are deprecated and the relay candidates were causing ICE disconnection
// rather than helping. Reverted to STUN-only (the version that worked before).
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
