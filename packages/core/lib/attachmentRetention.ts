import type {SupabaseClient} from '@supabase/supabase-js'
import {r2KeyFromUrl} from './r2Keys.ts'

export interface AttachmentStatus {key:string;expires_at:string|null;expired:boolean}
export function attachmentStatusKey(url:string){
  const key=r2KeyFromUrl(url)
  if(key)return key
  try{
    const parsed=new URL(url),prefix='/storage/v1/object/public/attachments/'
    if(parsed.hostname.endsWith('.supabase.co')&&parsed.pathname.startsWith(prefix))
      return 'legacy-storage:'+decodeURIComponent(parsed.pathname.slice(prefix.length))
  }catch{/* External attachments do not have a retention record. */}
  return null
}
export async function readAttachmentStatus(client:SupabaseClient,conversation:string):Promise<AttachmentStatus[]>{
  try{
  const {data,error}=await client.rpc('conversation_attachment_status',{p_conversation:conversation})
  if(error||!Array.isArray(data))return []
  return data.filter((r):r is AttachmentStatus=>r&&typeof r.key==='string'&&typeof r.expired==='boolean'
    &&(r.expires_at===null||(typeof r.expires_at==='string'&&Number.isFinite(Date.parse(r.expires_at)))))
  }catch{return []}
}
export function attachmentStatus(url:string,rows:AttachmentStatus[],now=Date.now()){
  const key=attachmentStatusKey(url),row=rows.find(r=>r.key===key)
  return row?{expires_at:row.expires_at,expired:row.expired||!!(row.expires_at&&Date.parse(row.expires_at)<=now)}:null
}
interface MessageAttachment {attachment_url?:string|null;attachment_type?:string|null;attachment_expires_at?:string|null;attachment_expired?:boolean}
export function withAttachmentRetention<T extends MessageAttachment>(message:T,rows:AttachmentStatus[]):T{
  if(!message.attachment_url||message.attachment_type==='game_invite')return message
  let urls=[message.attachment_url]
  if(message.attachment_type==='multi-audio'){
    try{urls=(JSON.parse(message.attachment_url) as {url:string}[]).map(r=>r.url)}catch{return message}
  }
  const statuses=urls.map(url=>attachmentStatus(url,rows))
  if(!statuses.length||statuses.some(s=>!s))return message
  const allDated=statuses.every(s=>s!.expires_at)
  return {...message,attachment_expired:statuses.every(s=>s!.expired),attachment_expires_at:allDated
    ?new Date(Math.max(...statuses.map(s=>Date.parse(s!.expires_at!)))).toISOString():null}
}
export function expireAttachments<T extends MessageAttachment>(messages:T[],now=Date.now()):T[]{
  return messages.map(m=>!m.attachment_expired&&m.attachment_expires_at&&Date.parse(m.attachment_expires_at)<=now
    ?{...m,attachment_expired:true}:m)
}
