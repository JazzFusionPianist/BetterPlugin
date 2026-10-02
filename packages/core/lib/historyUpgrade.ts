import type { SupabaseClient } from '@supabase/supabase-js'
import { conversationKeys, encryptChatMessage } from './chatCrypto'
import { resolveSecureFile, uploadSecureFile } from './secureFiles'

// Continue past unavailable participants/files on subsequent batches. The
// cursor wraps so skipped records are retried once their prerequisites exist.
const cursors=new WeakMap<SupabaseClient,Map<string,{message:string;stem:string}>>()

/** One bounded batch, authored by the signed-in user. No plaintext sent back. */
export async function upgradeHistory(client:SupabaseClient,user:string,apiBase:string){
  let upgraded=0,skipped=0
  let users=cursors.get(client)
  if(!users){users=new Map();cursors.set(client,users)}
  let cursor=users.get(user)
  if(!cursor){cursor={message:'',stem:''};users.set(user,cursor)}
  const files=new Map<string,{url:string;key:string}>()
  const migrateFile=async(url:string,name:string)=>{
    const cached=files.get(url);if(cached)return cached
    const resolved=await resolveSecureFile(client,url,apiBase)
    try{
      const response=await fetch(resolved,{referrerPolicy:'no-referrer',signal:AbortSignal.timeout(120000)})
      if(!response.ok)throw new Error('Original file unavailable.')
      const blob=await response.blob()
      const file=await uploadSecureFile(client,new File([blob],name,{type:blob.type}),{apiBase})
      files.set(url,file);return file
    }finally{if(resolved.startsWith('blob:'))URL.revokeObjectURL(resolved)}
  }
  for(const kind of ['message','stem'] as const){
    const table=kind==='message'?'messages':'conversation_stems',author=kind==='message'?'sender_id':'uploader_id'
    let query=client.from(table).select('*').eq(author,user).is('encrypted_payload',null).order('id',{ascending:true}).limit(10)
    if(cursor[kind])query=query.gt('id',cursor[kind])
    const {data,error}=await query
    if(error)throw new Error('Could not read legacy history.')
    cursor[kind]=data?.length===10?data[data.length-1].id:''
    for(const row of data??[]){
      try{
        // Check all participants before spending upload bandwidth.
        await conversationKeys(client,user,row.conversation_id)
        const keys:string[]=[]
        let payload:Record<string,unknown>
        if(kind==='stem'){
          const f=await migrateFile(row.file_url,row.file_name);keys.push(f.key)
          payload={file_url:f.url,file_name:row.file_name,mime_type:row.mime_type,timeline_metadata:row.timeline_metadata}
        }else{
          let url=row.attachment_url
          if(url && row.attachment_type==='multi-audio'){
            const tracks=JSON.parse(url)
            if(!Array.isArray(tracks) || tracks.length>64)throw new Error('Invalid attachment list.')
            const migrated=[]
            for(const track of tracks){const f=await migrateFile(track.url,track.name);keys.push(f.key);migrated.push({...track,url:f.url})}
            url=JSON.stringify(migrated)
          }else if(url && row.attachment_type!=='game_invite'){
            const f=await migrateFile(url,row.attachment_name || 'attachment');keys.push(f.key);url=f.url
          }
          payload={content:row.content,attachment_url:url,attachment_name:row.attachment_name,attachment_type:row.attachment_type,attachment_metadata:row.attachment_metadata}
        }
        const envelope=await encryptChatMessage(client,user,row.id,row.conversation_id,payload)
        const {error}=await client.rpc('upgrade_encrypted_history',{p_kind:kind,p_id:row.id,p_payload:envelope,p_keys:keys})
        if(error)throw new Error('History upgrade rejected.')
        upgraded++
      }catch{skipped++}
    }
  }
  return {upgraded,skipped}
}
