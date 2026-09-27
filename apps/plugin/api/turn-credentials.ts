import { authenticate, endpoint, env, HttpError, readBody, rpc, UUID } from '../server/security'
export const config = { runtime: 'edge' }
export default endpoint(async req => {
  const {token}=await authenticate(req,'live_join')
  const body=await readBody<{sessionId?:unknown}>(req)
  if(typeof body.sessionId!=='string' || !UUID.test(body.sessionId)) throw new HttpError(400,'Invalid session')
  await rpc(token,'live_check_access',{p_session:body.sessionId})
  const res=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env('CLOUDFLARE_CALLS_TURN_TOKEN_ID'))}/credentials/generate-ice-servers`,{
    method:'POST',headers:{Authorization:`Bearer ${env('CLOUDFLARE_CALLS_TURN_API_TOKEN')}`,'Content-Type':'application/json'},
    body:JSON.stringify({ttl:600}),signal:AbortSignal.timeout(10000),
  })
  if(!res.ok) throw new HttpError(502,'Media relay unavailable')
  const data=await res.json() as {iceServers:unknown}
  return {iceServers:data.iceServers,expiresAt:Date.now()+540000}
})
