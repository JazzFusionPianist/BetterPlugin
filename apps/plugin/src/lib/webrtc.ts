import type { SupabaseClient } from '@supabase/supabase-js'
import { authHeaders } from '@orb/core/lib/secureFiles.ts'
import type { RelayGrant } from './relayLease'

export async function loadRelayGrant(client:SupabaseClient,session:string):Promise<RelayGrant>{
 const base=location.protocol==='https:' || location.hostname==='localhost' ? '' : 'https://better-plugin.vercel.app'
 const res=await fetch(`${base}/api/turn-credentials`,{method:'POST',headers:await authHeaders(client),body:JSON.stringify({sessionId:session}),signal:AbortSignal.timeout(10000)})
 if(!res.ok)throw new Error('Could not authorize the media connection.')
 const data=await res.json() as {iceServers:RTCIceServer|RTCIceServer[];expiresAt:number}
 const servers=Array.isArray(data.iceServers)?data.iceServers:[data.iceServers]
 const relays=servers.filter(s=>typeof s?.username==='string' && typeof s?.credential==='string').map(s=>({...s,urls:(Array.isArray(s.urls)?s.urls:[s.urls]).filter(u=>typeof u==='string' && /^turns?:/.test(u))})).filter(s=>s.urls.length)
 if(!relays.length || !Number.isFinite(data.expiresAt) || data.expiresAt<Date.now()+120000 || data.expiresAt>Date.now()+660000)throw new Error('Media relay unavailable.')
 return {config:{iceServers:relays,iceTransportPolicy:'relay'},expiresAt:data.expiresAt}
}
export async function joinRelay(client:SupabaseClient,session:string):Promise<RelayGrant>{
 const {error}=await client.rpc('live_join',{p_session:session}).abortSignal(AbortSignal.timeout(10000))
 if(error)throw new Error('This broadcast is unavailable or full.')
 return loadRelayGrant(client,session)
}
