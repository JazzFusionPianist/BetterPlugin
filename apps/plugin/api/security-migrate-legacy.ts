import { env, HttpError, objectUrl, r2, readBody, response, rpc, safeKey, type FileRecord } from '../server/security'
export const config = { runtime: 'edge' }

// Operator-only migration. Credentials and object contents never leave the server.
// Rechecks public reuse in the database before copying and before removal.
export default async function handler(req: Request) {
  try {
    if (req.headers.get('authorization') !== `Bearer ${env('CRON_SECRET')}`) throw new HttpError(401, 'Unauthorized')
    if (req.method !== 'POST') throw new HttpError(405, 'POST required')
    const { key } = await readBody<{ key: string }>(req)
    if (!safeKey(key)) throw new HttpError(400, 'Invalid file key')
    const record = () => rpc<FileRecord>('', 'legacy_file_migration_candidate', {p_key:key}, true)
    const file = await record()
    const aws = r2(), oldUrl = objectUrl(key, 'legacy'), newUrl = objectUrl(key, 'private')
    if (oldUrl === newUrl) throw new HttpError(503, 'Private bucket must be separate')
    const before = await aws.fetch(oldUrl, {method:'HEAD'})
    if (before.status === 404) {
      if (file.storage === 'private' && (await aws.fetch(newUrl,{method:'HEAD'})).ok)
        return response(req,{migrated:true,alreadyRemoved:true})
      return response(req,{migrated:false,missingOriginal:true},409)
    }
    if (!before.ok || !before.headers.get('etag')) throw new HttpError(502, 'Original verification failed')
    const etag = before.headers.get('etag')!, size = before.headers.get('content-length')
    if (file.storage === 'legacy') {
      const copied = await aws.fetch(newUrl,{method:'PUT',headers:{
        'x-amz-copy-source':new URL(oldUrl).pathname,'x-amz-copy-source-if-match':etag,
      }})
      if (!copied.ok) throw new HttpError(502, 'Private copy failed')
    }
    const after = await aws.fetch(newUrl,{method:'HEAD'})
    if (!after.ok || after.headers.get('etag') !== etag || after.headers.get('content-length') !== size)
      throw new HttpError(502, 'Copy mismatch; original retained')
    await record()
    await rpc('', 'switch_legacy_file_storage', {p_key:key}, true)
    const removed = await aws.fetch(oldUrl,{method:'DELETE',headers:{'If-Match':etag}})
    if (!removed.ok && removed.status !== 404) throw new HttpError(502, 'Private copy ready; original removal must retry')
    return response(req,{migrated:true})
  } catch (error) {
    return response(req,{error:error instanceof HttpError?error.message:'Migration failed'},error instanceof HttpError?error.status:500)
  }
}
