// WebRTC ICE configuration.
//
// Base: Google's public STUN servers (sufficient for permissive networks).
// On top of that, we lazily merge in TURN credentials from two sources:
//
//   1. /api/turn-credentials — Vercel Edge Function that proxies Cloudflare
//      Calls' TURN credential API. Set CLOUDFLARE_CALLS_TURN_TOKEN_ID and
//      CLOUDFLARE_CALLS_TURN_API_TOKEN in Vercel env vars to enable.
//
//   2. VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL static
//      env vars (for metered.ca, twilio, self-hosted coturn, etc).
//
// The credentials are appended to `rtcConfig.iceServers` once fetched.
// Hooks should `await ensureTurnLoaded()` before creating an RTCPeerConnection
// so the very first connection on page load also has TURN.

const baseIceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export const rtcConfig: RTCConfiguration = {
  iceServers: [...baseIceServers],
}

let turnLoaded: Promise<void> | null = null

export function ensureTurnLoaded(): Promise<void> {
  if (turnLoaded) return turnLoaded
  turnLoaded = (async () => {
    // 1. Try Cloudflare Calls TURN proxy
    try {
      const res = await fetch('/api/turn-credentials')
      if (res.ok) {
        const data = await res.json() as { iceServers?: RTCIceServer | RTCIceServer[] }
        if (data.iceServers) {
          const list = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers]
          rtcConfig.iceServers!.push(...list)
        }
      }
    } catch (e) {
      console.warn('[webrtc] /api/turn-credentials fetch failed:', e)
    }

    // 2. Static env-var TURN (fallback / additional)
    const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined
    const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined
    const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined
    if (turnUrl && turnUser && turnCred) {
      rtcConfig.iceServers!.push({
        urls: turnUrl.split(',').map(s => s.trim()).filter(Boolean),
        username: turnUser,
        credential: turnCred,
      })
    }

    console.log('[webrtc] iceServers loaded:', rtcConfig.iceServers)
  })()
  return turnLoaded
}

// Kick off the fetch immediately at module import — most of the time it'll
// be done before the user clicks "Watch Live".
ensureTurnLoaded()

// Channel name helper — every session gets its own broadcast channel
export function liveSignalingChannel(sessionId: string) {
  return `live-signal:${sessionId}`
}
