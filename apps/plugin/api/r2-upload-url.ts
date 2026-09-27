import { authenticate, endpoint, env, HttpError, objectUrl, r2, readBody, rpc, type FileRecord } from '../server/security'
export const config = { runtime: 'edge' }
export default endpoint(async req => {
  const { token } = await authenticate(req, 'upload')
  const body = await readBody<{ ext: string; contentType: string; size: number; name: string; visibility?: string }>(req)
  if (!Number.isSafeInteger(body.size) || body.size < 1) throw new HttpError(400, 'File size required')
  const isPublic = body.visibility === 'public'
  env(isPublic ? 'CLOUDFLARE_R2_BUCKET' : 'CLOUDFLARE_R2_PRIVATE_BUCKET')
  env('SUPABASE_SERVICE_ROLE_KEY')
  const file = await rpc<FileRecord>(token, 'reserve_file', {
    p_ext: body.ext, p_mime: body.contentType, p_size: body.size, p_name: body.name, p_public: isPublic,
  })
  const signed = await r2().sign(new Request(`${objectUrl(file.object_key, file.storage)}?X-Amz-Expires=900`, {
    method: 'PUT', headers: { 'Content-Type': file.mime, 'Content-Length': String(file.size), 'If-None-Match': '*' },
  }), { aws: { signQuery: true, allHeaders: true } })
  return { uploadUrl: signed.url, key: file.object_key,
    publicUrl: isPublic ? `${env('R2_PUBLIC_URL', 'VITE_R2_PUBLIC_URL').replace(/\/$/,'')}/${file.object_key}` : `orb-file:${file.object_key}` }
})
