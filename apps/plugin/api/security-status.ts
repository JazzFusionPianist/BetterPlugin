import { database, anonKey, env, objectUrl, r2, response, rpc } from '../server/security'

export const config = { runtime: 'edge' }

// Read-only operational check. Never returns bucket names, credentials or user data.
export default async function handler(req: Request) {
  if (req.method !== 'GET') return response(req, {error:'GET required'},405)
  try {
    const credential=req.headers.get('authorization')
    const healthToken=process.env.SECURITY_HEALTH_TOKEN
    if(credential!==`Bearer ${env('CRON_SECRET')}` && (!healthToken || credential!==`Bearer ${healthToken}`))
      return response(req,{error:'Unauthorized'},401)
    const bucket=objectUrl('readiness-probe','private').replace(/\/readiness-probe$/,'')
    const [storage,auth,operations]=await Promise.allSettled([
      r2().fetch(bucket,{method:'HEAD',signal:AbortSignal.timeout(10000)}),
      fetch(`${database()}/auth/v1/settings`,{headers:{apikey:anonKey()},signal:AbortSignal.timeout(10000)}),
      rpc<{cleanupFresh:boolean;deletionsHealthy:boolean}>('', 'security_health_snapshot',{},true),
    ])
    const checks={privateStorage:storage.status==='fulfilled'&&storage.value.ok,
      authentication:auth.status==='fulfilled'&&auth.value.ok,
      cleanupFresh:operations.status==='fulfilled' && operations.value.cleanupFresh===true,
      deletionsHealthy:operations.status==='fulfilled' && operations.value.deletionsHealthy===true}
    return response(req,checks,Object.values(checks).every(Boolean)?200:503)
  } catch { return response(req,{error:'Configuration incomplete'},503) }
}
