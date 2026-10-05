import type { SupabaseClient } from '@supabase/supabase-js'
import { accountMessage, type AccountAttachment } from './accountChat.ts'
import { chatGeneration, encryptChatMessage, openPendingMessage, sealPendingMessage, ParticipantsPending, type Envelope } from './chatCrypto.ts'
import { prepareChat } from './prepareChat.ts'

export async function privateChatEnabled(client:SupabaseClient,user:string){
  const {data,error}=await client.rpc('chat_security_mode')
  if(error || ![0,1].includes(data))throw new Error('Could not connect to Slur. Try again.')
  const key=`slur-private-chat:${user}`
  if(data===1)localStorage.setItem(key,'1')
  else if(localStorage.getItem(key)==='1')throw new Error('Please update Slur to continue.')
  return data===1
}
export async function requirePrivateChat(client:SupabaseClient,user:string){
  if(await prepareChat(client,user)!=='ready')throw new Error('Connect this device to continue.')
}
type ClearMessage=ReturnType<typeof accountMessage>
export interface ClearStem {id:string;conversation_id:string;uploader_id:string;file_key:string;file_url:string;file_name:string;mime_type:string;timeline_metadata:unknown;file_size?:number}
export type DeliveryState='waiting'|'blocked'|'expired'|'delivered'|'cancelled'
export type DeliveryReason='recipient_pending'|'retry'|'membership_changed'|'invalid'
export interface PendingRow {id:string;user_id:string;conversation_id:string;envelope:Envelope;created_at:string;state:DeliveryState;reason:DeliveryReason|null;expires_at:string}
type Draft={kind:'message';audience:string[];message:ClearMessage}|{kind:'stems';audience:string[];stems:ClearStem[]}
async function current(client:SupabaseClient,user:string,epoch:number){
  const {data,error}=await client.auth.getSession()
  if(error || data.session?.user.id!==user || epoch!==chatGeneration())throw new Error('Session changed.')
}
async function audience(client:SupabaseClient,user:string,conversation:string){
  const {data,error}=await client.rpc('conversation_chat_keys',{p_conversation:conversation})
  if(error || !Array.isArray(data) || data.length<1 || data.length>16 || !data.some(k=>k.user_id===user)
    || data.some(k=>typeof k.user_id!=='string') || new Set(data.map(k=>k.user_id)).size!==data.length)throw new Error('Conversation unavailable.')
  return data.map(k=>k.user_id as string).sort()
}
function payload(m:ClearMessage){return {content:m.content,attachment_url:m.attachment_url,attachment_type:m.attachment_type,attachment_name:m.attachment_name,attachment_metadata:m.attachment_metadata}}
async function encryptedMessage(client:SupabaseClient,user:string,m:ClearMessage){
  return {...m,content:'\u{1f512} Encrypted message',attachment_url:null,attachment_type:null,attachment_name:null,attachment_metadata:null,
    encrypted_payload:await encryptChatMessage(client,user,m.id,m.conversation_id,payload(m))}
}
async function encryptedStems(client:SupabaseClient,user:string,rows:ClearStem[]){
  return Promise.all(rows.map(async r=>({id:r.id,conversation_id:r.conversation_id,uploader_id:user,file_key:r.file_key,
    file_url:'orb-encrypted:',file_name:'Encrypted file',mime_type:'application/octet-stream',file_size:r.file_size,timeline_metadata:null,
    encrypted_payload:await encryptChatMessage(client,user,r.id,r.conversation_id,{file_url:r.file_url,file_name:r.file_name,mime_type:r.mime_type,timeline_metadata:r.timeline_metadata})})))
}
const drains=new WeakMap<SupabaseClient,Map<string,Promise<void>>>()
const pendingSnapshots=new WeakMap<SupabaseClient,Map<string,Map<string,{conversation:string;version:string}>>>()
export async function readPendingChat(client:SupabaseClient,user:string,conversation?:string){
  const epoch=chatGeneration()
  const expired=await client.rpc('expire_private_chat')
  if(expired.error)throw new Error('Could not refresh pending messages.')
  let query=client.from('chat_pending_sends').select('*').eq('user_id',user).in('state',['waiting','blocked','expired']).order('created_at',{ascending:true}).limit(100)
  if(conversation)query=query.eq('conversation_id',conversation)
  const {data,error}=await query
  if(error)throw new Error('Could not load pending messages.')
  await current(client,user,epoch)
  const rows=(data??[]) as PendingRow[]
  let users=pendingSnapshots.get(client)
  if(!users){users=new Map();pendingSnapshots.set(client,users)}
  let previous=users.get(user)
  if(!previous){previous=new Map();users.set(user,previous)}
  const changed=new Set<string>(),ids=new Set(rows.map(row=>row.id))
  for(const [id,old] of previous){
    if((!conversation||old.conversation===conversation)&&!ids.has(id)){previous.delete(id);changed.add(old.conversation)}
  }
  for(const row of rows){
    const version=JSON.stringify([row.state,row.reason,row.expires_at])
    if(previous.get(row.id)?.version!==version)changed.add(row.conversation_id)
    previous.set(row.id,{conversation:row.conversation_id,version})
  }
  for(const cid of changed)deliveryChanged(cid)
  return rows
}
export async function decodePendingChat(user:string,row:PendingRow):Promise<Draft>{
  const value=await openPendingMessage(user,row.id,row.conversation_id,row.envelope) as Draft
  if(!value || !['message','stems'].includes(value.kind) || !Array.isArray(value.audience))throw new Error('Invalid pending message.')
  if(value.kind==='message' && (value.message.id!==row.id || value.message.sender_id!==user || value.message.conversation_id!==row.conversation_id))throw new Error('Invalid pending message.')
  if(value.kind==='stems' && (!Array.isArray(value.stems) || !value.stems.length || value.stems.length>64
    || value.stems.some(s=>s.uploader_id!==user || s.conversation_id!==row.conversation_id)))throw new Error('Invalid pending files.')
  return value
}
function deliveryChanged(conversation:string){window.dispatchEvent(new CustomEvent('slur-chat-delivered',{detail:{conversation}}))}
function deliveryState(value:unknown):DeliveryState{
  if(typeof value!=='string'||!['waiting','blocked','expired','delivered','cancelled'].includes(value))throw new Error('Could not confirm delivery status.')
  return value as DeliveryState
}
async function note(client:SupabaseClient,row:PendingRow,reason:DeliveryReason){
  const {data,error}=await client.rpc('note_private_chat',{p_id:row.id,p_reason:reason})
  if(error)throw error
  if(row.reason!==reason||data!==row.state)deliveryChanged(row.conversation_id)
  return deliveryState(data)
}
export async function cancelPendingChat(client:SupabaseClient,user:string,id:string,conversation:string){
  const epoch=chatGeneration()
  await current(client,user,epoch)
  const {data,error}=await client.rpc('cancel_private_chat',{p_id:id})
  if(error)throw new Error('Could not cancel this send. Try again.')
  await current(client,user,epoch)
  const state=deliveryState(data)
  deliveryChanged(conversation)
  return state
}
async function deliver(client:SupabaseClient,user:string,row:PendingRow):Promise<DeliveryState>{
  if(row.state!=='waiting')return row.state
  const epoch=chatGeneration(),draft=await decodePendingChat(user,row)
  if(JSON.stringify(await audience(client,user,row.conversation_id))!==JSON.stringify(draft.audience))return note(client,row,'membership_changed')
  const records:Record<string,unknown>[]=draft.kind==='message'?[await encryptedMessage(client,user,draft.message)]:await encryptedStems(client,user,draft.stems)
  await current(client,user,epoch)
  if(records.some(r=>new TextEncoder().encode(JSON.stringify(r.encrypted_payload)).length>262144))throw new Error('Message is too large.')
  const {data,error}=await client.rpc('deliver_private_chat',{p_id:row.id,p_audience:draft.audience,p_records:records})
  if(error)throw error
  await current(client,user,epoch)
  deliveryChanged(row.conversation_id)
  return deliveryState(data)
}
async function attempt(client:SupabaseClient,user:string,row:PendingRow):Promise<DeliveryState>{
  const epoch=chatGeneration()
  try{return await deliver(client,user,row)}catch(error){
    await current(client,user,epoch)
    const code=(error as {code?:string})?.code
    const reason=error instanceof ParticipantsPending?'recipient_pending':code==='22023'||code==='23505'?'invalid':'retry'
    try{return await note(client,row,reason)}catch{return 'waiting'}
  }
}
export function drainPrivateChat(client:SupabaseClient,user:string){
  let users=drains.get(client);if(!users){users=new Map();drains.set(client,users)}
  const existing=users.get(user);if(existing)return existing
  const task=(async()=>{
    if(!await privateChatEnabled(client,user))return
    await requirePrivateChat(client,user)
    for(const row of await readPendingChat(client,user)){
      if(row.state==='waiting')await attempt(client,user,row)
    }
  })().finally(()=>users!.delete(user))
  users.set(user,task);return task
}
async function enqueue(client:SupabaseClient,user:string,id:string,conversation:string,draft:Draft,keys:string[]){
  const payloads=draft.kind==='message'?[payload(draft.message)]:draft.stems.map(s=>({file_url:s.file_url,file_name:s.file_name,mime_type:s.mime_type,timeline_metadata:s.timeline_metadata}))
  // Leave room for base64 expansion, JSON escaping and sixteen sealed keys.
  if(payloads.some(p=>new TextEncoder().encode(JSON.stringify(p)).length>180000))throw new Error('Message is too large. Send fewer files at once.')
  const epoch=chatGeneration(),envelope=await sealPendingMessage(user,id,conversation,draft)
  await current(client,user,epoch)
  const item_ids=draft.kind==='message'?[draft.message.id]:draft.stems.map(s=>s.id)
  let {data,error}=await client.from('chat_pending_sends').insert({id,user_id:user,conversation_id:conversation,envelope,attachment_keys:keys,kind:draft.kind,item_ids}).select('*').single()
  if(error){
    // A committed insert can lose its response. Recover only this exact signed draft.
    const recovered=await client.from('chat_pending_sends').select('*').eq('user_id',user).eq('id',id).single()
    await current(client,user,epoch)
    if(recovered.error || recovered.data?.conversation_id!==conversation || recovered.data?.envelope?.signature!==envelope.signature)throw error
    data=recovered.data
  }
  await current(client,user,epoch)
  const state=await attempt(client,user,data as PendingRow)
  return state==='cancelled'?{pending:false,cancelled:true}:{pending:state!=='delivered',cancelled:false}
}
export async function sendPrivateMessage(client:SupabaseClient,user:string,id:string,conversation:string,content:string,attachment?:AccountAttachment){
  const message=accountMessage(id,user,conversation,content,attachment)
  if(!await privateChatEnabled(client,user))throw new Error('Slur is updating. Try again shortly.')
  await requirePrivateChat(client,user)
  return enqueue(client,user,id,conversation,{kind:'message',message,audience:await audience(client,user,conversation)},message.attachment_keys??[])
}
export async function sendPrivateStems(client:SupabaseClient,user:string,rows:ClearStem[]){
  if(!rows.length)return {pending:false}
  if(rows.some(r=>r.uploader_id!==user || r.conversation_id!==rows[0]!.conversation_id))throw new Error('Invalid files.')
  if(!await privateChatEnabled(client,user))throw new Error('Slur is updating. Try again shortly.')
  await requirePrivateChat(client,user)
  return enqueue(client,user,rows[0]!.id,rows[0]!.conversation_id,{kind:'stems',stems:rows,audience:await audience(client,user,rows[0]!.conversation_id)},[...new Set(rows.map(r=>r.file_key))])
}
