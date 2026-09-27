import { authenticate, endpoint, HttpError, objectUrl, r2, readBody, rpc, safeKey, type FileRecord } from '../server/security'
export const config = { runtime: 'edge' }
export default endpoint(async req => {
  const { token } = await authenticate(req, 'download')
  const { key } = await readBody<{ key: string }>(req)
  if (!safeKey(key)) throw new HttpError(400, 'Invalid file key')
  const file = await rpc<FileRecord>(token, 'file_access', { p_key: key })
  const url = new URL(objectUrl(file.object_key, file.storage))
  url.searchParams.set('X-Amz-Expires', '300')
  url.searchParams.set('response-content-disposition', 'attachment')
  const signed = await r2().sign(new Request(url), { aws: { signQuery: true } })
  return { url: signed.url, expiresIn: 300 }
})
