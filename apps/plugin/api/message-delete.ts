import { anonKey, authenticate, database, endpoint, HttpError, readBody, UUID } from '../server/security'
export const config = { runtime: 'edge' }
export default endpoint(async req => {
  const { token } = await authenticate(req, 'delete')
  const { messageId, stemId } = await readBody<{ messageId?: string; stemId?: string }>(req)
  const id = messageId || stemId
  if (!id || !UUID.test(id) || (!!messageId === !!stemId)) throw new HttpError(400, 'One message or stem id required')
  const table = messageId ? 'messages' : 'conversation_stems'
  const res = await fetch(`${database()}/rest/v1/${table}?id=eq.${id}&select=id`, {
    method: 'DELETE', headers: { apikey: anonKey(), Authorization: `Bearer ${token}`, Prefer: 'return=representation' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new HttpError(res.status === 401 ? 401 : 502, 'Delete failed')
  const rows: unknown = await res.json()
  if (!Array.isArray(rows) || rows.length !== 1) throw new HttpError(403, 'Message is unavailable or not yours')
  // FK cascade queues physical deletion; client-authored keys never reach S3.
  return { ok: true, storageCleanup: 'queued' }
})
