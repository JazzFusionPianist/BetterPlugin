import { database, anonKey, env, objectUrl, r2, response } from '../server/security'

export const config = { runtime: 'edge' }

// Read-only operational check. Never returns bucket names, credentials or user data.
export default async function handler(req: Request) {
  if (req.method !== 'GET') return response(req, {error:'GET required'},405)
  try {
    if(req.headers.get('authorization')!==`Bearer ${env('CRON_SECRET')}`)
      return response(req,{error:'Unauthorized'},401)
    const bucket=objectUrl('readiness-probe','private').replace(/\/readiness-probe$/,'')
    const [storage,auth]=await Promise.allSettled([
      r2().fetch(bucket,{method:'HEAD',signal:AbortSignal.timeout(10000)}),
      fetch(`${database()}/auth/v1/settings`,{headers:{apikey:anonKey()},signal:AbortSignal.timeout(10000)}),
    ])
    const checks={privateStorage:storage.status==='fulfilled'&&storage.value.ok,
      authentication:auth.status==='fulfilled'&&auth.value.ok}
    return response(req,checks,Object.values(checks).every(Boolean)?200:503)
  } catch { return response(req,{error:'Configuration incomplete'},503) }
}
