import type { AttachType, AttachmentTimelineMetadata } from '../types/collab'
import { r2KeyFromUrl } from './r2Keys.ts'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AccountAttachment {
  url:string; type:AttachType; name:string; metadata?:AttachmentTimelineMetadata
}

/** Access is enforced by membership policies, not by a device identity. */
export function accountMessage(id:string,user:string,conversation:string,content:string,attachment?:AccountAttachment){
  const urls:string[]=!attachment || attachment.type==='game_invite' ? [] : attachment.type==='multi-audio'
    ? (JSON.parse(attachment.url) as {url:string}[]).map(track=>track.url) : [attachment.url]
  const keys=[...new Set(urls.map(url=>r2KeyFromUrl(url)).filter((key):key is string=>key!==null))]
  return {id,conversation_id:conversation,sender_id:user,content:content.trim(),encrypted_payload:null,
    attachment_url:attachment?.url??null,attachment_type:attachment?.type??null,
    attachment_name:attachment?.name??null,attachment_metadata:attachment?.metadata??null,
    attachment_keys:keys.length?keys:null}
}

async function requireAccount(client:SupabaseClient,user:string){
  const {data,error}=await client.auth.getSession()
  if(error || data.session?.user.id!==user)throw new Error('Sign in to send messages.')
}

export async function sendAccountMessage(client:SupabaseClient,user:string,id:string,conversation:string,content:string,attachment?:AccountAttachment){
  await requireAccount(client,user)
  const {error}=await client.from('messages').insert(accountMessage(id,user,conversation,content,attachment))
  if(error)throw error
}

export interface AccountStem {id:string;conversation_id:string;uploader_id:string;file_key:string;file_url:string;file_name:string;mime_type:string;timeline_metadata:unknown;file_size?:number}
export async function sendAccountStems(client:SupabaseClient,user:string,rows:AccountStem[]){
  if(!rows.length)return
  await requireAccount(client,user)
  if(rows.length>64 || rows.some(r=>r.uploader_id!==user || r.conversation_id!==rows[0].conversation_id))throw new Error('Invalid files.')
  const {error}=await client.from('conversation_stems').insert(rows.map(r=>({
    id:r.id,conversation_id:r.conversation_id,uploader_id:user,file_key:r.file_key,file_url:r.file_url,
    file_name:r.file_name,mime_type:r.mime_type,timeline_metadata:r.timeline_metadata,file_size:r.file_size,encrypted_payload:null,
  })))
  if(error)throw error
}
