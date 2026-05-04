// WebRTC configuration. STUN is enough for permissive NATs; symmetric
// NATs (mobile carriers, restrictive firewalls) require TURN.
//
// To enable TURN, set these env vars in Vercel (Project → Settings →
// Environment Variables) — values come from your TURN provider
// (metered.ca free tier gives 50GB/month after signup):
//   VITE_TURN_URL       e.g. "turn:standard.relay.metered.ca:80"
//   VITE_TURN_USERNAME  e.g. "your-username"
//   VITE_TURN_CREDENTIAL e.g. "your-credential"
// Multiple URLs (UDP/TCP/TLS) can be passed as a comma-separated list
// in VITE_TURN_URL.

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined
  const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined
  if (turnUrl && turnUser && turnCred) {
    const urls = turnUrl.split(',').map(s => s.trim()).filter(Boolean)
    servers.push({ urls, username: turnUser, credential: turnCred })
  }
  return servers
}

export const rtcConfig: RTCConfiguration = {
  iceServers: buildIceServers(),
}

// Channel name helper — every session gets its own broadcast channel
export function liveSignalingChannel(sessionId: string) {
  return `live-signal:${sessionId}`
}
