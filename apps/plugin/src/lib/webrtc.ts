import type { SupabaseClient } from '@supabase/supabase-js'
import { authHeaders } from '@orb/core/lib/secureFiles.ts'

// Relay-only prevents participants from learning each other's network address.
export const rtcConfig: RTCConfiguration = { iceServers: [], iceTransportPolicy: 'relay' }
export async function ensureTurnLoaded(client: SupabaseClient, session: string): Promise<void> {
  const {error}=await client.rpc('live_join',{p_session:session})
  if(error) throw new Error('This broadcast is unavailable or full.')
  const base=location.protocol==='https:' || location.hostname==='localhost' ? '' : 'https://better-plugin.vercel.app'
  const res=await fetch(`${base}/api/turn-credentials`,{method:'POST',headers:await authHeaders(client),body:JSON.stringify({sessionId:session}),signal:AbortSignal.timeout(10000)})
  if(!res.ok) throw new Error('Could not authorize the media connection.')
  const data=await res.json() as {iceServers:RTCIceServer|RTCIceServer[]}
  const servers=Array.isArray(data.iceServers)?data.iceServers:[data.iceServers]
  const relays=servers.filter(s=>s?.username && s?.credential).map(s=>({...s,urls:(Array.isArray(s.urls)?s.urls:[s.urls]).filter(u=>typeof u==='string' && /^turns?:/.test(u))})).filter(s=>s.urls.length)
  if(!relays.length)throw new Error('Media relay unavailable.')
  rtcConfig.iceServers=relays
}
