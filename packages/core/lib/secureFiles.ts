import { decryptFile } from './fileCrypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { r2KeyFromUrl } from './r2Keys'

function defaultApiBase(){
  if(typeof location==='undefined')return ''
  return !['http:','https:'].includes(location.protocol) || location.hostname==='juce.backend' ? 'https://better-plugin.vercel.app' : ''
}

export async function authHeaders(client: SupabaseClient): Promise<Record<string,string>> {
  const { data, error } = await client.auth.getSession()
  if (error || !data.session) throw new Error('Sign in to access files.')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }
}

export async function uploadSecureFile(client: SupabaseClient, file: File, options: {
  apiBase?: string; public?: boolean; onProgress?: (ratio: number) => void
} = {}): Promise<{ url: string; key: string }> {
  if (!file.size || file.size > 1024*1024*1024) throw new Error('Files must be between 1 byte and 1 GB.')
  const base=options.apiBase ?? defaultApiBase()
  const upload=file
  const headers=await authHeaders(client)
  const mime=/^(audio\/[a-zA-Z0-9.+-]+|video\/(mp4|webm|quicktime)|image\/(png|jpeg|webp|gif)|application\/(octet-stream|zip))$/.test(file.type)?file.type:'application/octet-stream'
  const res=await fetch(`${base}/api/r2-upload-url`, { method:'POST',headers,
    body:JSON.stringify({ ext:file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8) || 'bin',
      contentType:mime,size:upload.size,name:file.name.slice(0,255),visibility:options.public?'public':'private' }) })
  if (!res.ok) throw new Error(res.status===429?'Too many uploads. Try again shortly.':'Could not authorize this upload.')
  const ticket=await res.json() as { uploadUrl: string; publicUrl: string; key: string }
  await new Promise<void>((resolve,reject)=>{
    const xhr=new XMLHttpRequest()
    xhr.open('PUT',ticket.uploadUrl)
    xhr.setRequestHeader('Content-Type',mime)
    xhr.setRequestHeader('If-None-Match','*')
    xhr.timeout=15*60*1000
    let last=0
    xhr.upload.onprogress=e=>{
      if(e.lengthComputable && performance.now()-last>100){last=performance.now();options.onProgress?.(Math.min(.95,e.loaded/e.total*.95))}
    }
    xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('Upload failed.'))
    xhr.onerror=xhr.ontimeout=()=>reject(new Error('Upload interrupted.'))
    xhr.send(upload)
  })
  const complete=await fetch(`${base}/api/r2-upload-complete`, {method:'POST',headers:await authHeaders(client),body:JSON.stringify({key:ticket.key})})
  if(!complete.ok) throw new Error('The uploaded file could not be verified.')
  options.onProgress?.(1)
  return {url:ticket.publicUrl,key:ticket.key}
}

/** No public fallback for private/legacy attachments, including 401 and 403. */
export async function resolveSecureFile(client: SupabaseClient, url: string, apiBase='', publicBase?: string): Promise<string> {
  const key=r2KeyFromUrl(url,publicBase)
  if(!key) {
    const parsed=new URL(url)
    const legacyPrefix='/storage/v1/object/public/attachments/'
    if(parsed.protocol==='https:' && parsed.hostname.endsWith('.supabase.co') && parsed.pathname.startsWith(legacyPrefix)){
      const path=decodeURIComponent(parsed.pathname.slice(legacyPrefix.length))
      if(!path || path.startsWith('/') || path.includes('..'))throw new Error('Invalid attachment path.')
      const {data,error}=await client.storage.from('attachments').createSignedUrl(path,300)
      if(error || !data?.signedUrl)throw new Error('This legacy attachment is unavailable or access was revoked.')
      return data.signedUrl
    }
    if(parsed.protocol!=='https:' && parsed.protocol!=='blob:') throw new Error('Unsupported file URL.')
    return url
  }
  const base=apiBase || defaultApiBase()
  const res=await fetch(`${base}/api/r2-file-url`, {method:'POST',headers:await authHeaders(client),body:JSON.stringify({key})})
  if(!res.ok) throw new Error('This file is unavailable or you no longer have access.')
  const data=await res.json() as {url?:string}
  if(!data.url?.startsWith('https://')) throw new Error('Invalid download response.')
  const secret=new URLSearchParams(url.split('#')[1]??'').get('e2ee')
  if(!secret)return data.url
  const file=await fetch(data.url,{referrerPolicy:'no-referrer',signal:AbortSignal.timeout(120000)})
  if(!file.ok)throw new Error('Download failed.')
  const blob=await file.blob()
  return URL.createObjectURL(await decryptFile(blob,secret))
}
