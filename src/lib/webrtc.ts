// WebRTC configuration. STUN is sufficient when both peers are on
// permissive networks, but symmetric NATs (mobile carriers, corporate
// firewalls) require TURN to relay packets through a public server.
// Open Relay Project (metered.ca) provides free public TURN servers.
export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  // Bundle policy + ice transport tuning for faster, more reliable
  // candidate gathering on flaky networks.
  bundlePolicy: 'max-bundle',
  iceCandidatePoolSize: 4,
}

// Channel name helper — every session gets its own broadcast channel
export function liveSignalingChannel(sessionId: string) {
  return `live-signal:${sessionId}`
}
