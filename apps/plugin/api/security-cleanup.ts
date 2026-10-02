import { database, env, HttpError, objectUrl, r2, response, rpc } from '../server/security'
export const config = { runtime: 'edge' }
export default async function handler(req: Request) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    if (req.headers.get('authorization') !== `Bearer ${env('CRON_SECRET')}`) throw new HttpError(401, 'Unauthorized')
    await rpc('', 'security_prune_metadata', {}, true)
    const jobs = await rpc<Array<{ object_key: string; storage: 'private'|'public'|'legacy' }>>('', 'claim_file_deletions', {}, true)
    let completed = 0
    for (const job of jobs) {
      let success = false
      try { const result = await r2().fetch(objectUrl(job.object_key,job.storage), { method: 'DELETE' }); success = result.ok || result.status === 404 } catch { /* durable retry */ }
      await rpc('', 'finish_file_deletion', { p_key: job.object_key, p_success: success }, true)
      if (success) completed++
    }
    const storageJobs=await rpc<Array<{id:number;bucket:string;name:string}>>('', 'claim_storage_erasures', {}, true)
    let storageCompleted=0
    for(const job of storageJobs){
      let success=false
      try{
        const key=env('SUPABASE_SERVICE_ROLE_KEY')
        const result=await fetch(`${database()}/storage/v1/object/${encodeURIComponent(job.bucket)}`,{method:'DELETE',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[job.name]}),signal:AbortSignal.timeout(10000)})
        success=result.ok || result.status===404
      }catch{ /* retry durable job */ }
      await rpc('', 'finish_storage_erasure', {p_id:job.id,p_success:success},true)
      if(success)storageCompleted++
    }
    return response(req, { completed, pending: jobs.length-completed, storageCompleted, storagePending:storageJobs.length-storageCompleted })
  } catch (e) { return response(req, { error: e instanceof HttpError ? e.message : 'Cleanup failed' }, e instanceof HttpError ? e.status : 500) }
}
