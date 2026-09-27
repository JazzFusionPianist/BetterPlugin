import { matchesFileType } from '../server/fileType'
import { authenticate, endpoint, HttpError, objectUrl, r2, readBody, rpc, safeKey, type FileRecord } from '../server/security'
export const config = { runtime: 'edge' }
export default endpoint(async req => {
  const { token } = await authenticate(req, 'upload')
  const { key } = await readBody<{ key: string }>(req)
  if (!safeKey(key)) throw new HttpError(400, 'Invalid file key')
  const file = await rpc<FileRecord>(token, 'file_access', { p_key: key, p_upload: true })
  const head = await r2().fetch(objectUrl(key, file.storage), { method: 'HEAD' })
  if (!head.ok) throw new HttpError(400, 'Upload not found')
  const size = Number(head.headers.get('content-length'))
  const mime = head.headers.get('content-type')?.split(';')[0]
  if (size !== Number(file.size) || mime !== file.mime) throw new HttpError(400, 'Uploaded file does not match its reservation')
  const probe=await r2().fetch(objectUrl(key,file.storage),{headers:{Range:'bytes=0-31'}})
  if(!probe.ok || !probe.body)throw new HttpError(400,'Could not inspect upload')
  const reader=probe.body.getReader(),prefix=new Uint8Array(32)
  let offset=0
  try{while(offset<32){const {done,value}=await reader.read();if(done)break;const take=Math.min(value.length,32-offset);prefix.set(value.slice(0,take),offset);offset+=take}}finally{await reader.cancel()}
  if(!matchesFileType(prefix.slice(0,offset),file.mime,file.storage==='private'))throw new HttpError(400,'File format does not match its declared type')
  await rpc(token, 'finalize_file', { p_key: key, p_size: size, p_mime: mime }, true)
  return { ok: true }
})
