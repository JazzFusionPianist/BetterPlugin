import { authenticate, endpoint, HttpError, objectUrl, r2, readBody, rpc, safeKey, type FileRecord } from '../server/security'
export const config = { runtime: 'edge' }
export default endpoint(async req => {
  const { token } = await authenticate(req, 'download')
  const { key } = await readBody<{ key: string }>(req)
  if (!safeKey(key)) throw new HttpError(400, 'Invalid file key')
  const file = await rpc<FileRecord>(token, 'file_access', { p_key: key })
  const expiresIn=file.retention_expires_at?Math.min(300,Math.floor((Date.parse(file.retention_expires_at)-Date.now())/1000)):300
  if(!Number.isFinite(expiresIn)||expiresIn<1)throw new HttpError(410,'Attachment expired')
  const url = new URL(objectUrl(file.object_key, file.storage))
  url.searchParams.set('X-Amz-Expires', String(expiresIn))
  url.searchParams.set('response-content-disposition', 'attachment')
  const signed = await r2().sign(new Request(url), { aws: { signQuery: true } })
  return { url: signed.url, expiresIn }
})
