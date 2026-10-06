import sodium from 'libsodium-wrappers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message } from '../types/collab'
import { loadRememberedRecoveryCode } from './deviceKeyStore.ts'

export interface Identity { user_id:string; box_key:string; sign_key:string }
export interface LocalIdentity extends Identity { boxSecret:Uint8Array; signSecret:Uint8Array }
export interface Envelope { v:1; id:string; conversation:string; sender:string; nonce:string; body:string; recipients:Array<Identity & {key:string}>; signature:string }
export class ParticipantsPending extends Error { constructor(){super('Waiting to deliver.');this.name='ParticipantsPending'} }
const PREFIX='orb-chat-v1'
let generation=0
const sessions=new Map<string,LocalIdentity>()
const pins=new Map<string,string>()
const legacyUnlocks=new WeakMap<SupabaseClient,Map<string,{epoch:number;task:Promise<void>}>>()
export const b64=(bytes:Uint8Array)=>sodium.to_base64(bytes,sodium.base64_variants.URLSAFE_NO_PADDING)
export const unb64=(value:string)=>sodium.from_base64(value,sodium.base64_variants.URLSAFE_NO_PADDING)
export async function cryptoReady(){await sodium.ready}
export function lockChat(){generation++;for(const k of sessions.values()){sodium.memzero(k.boxSecret);sodium.memzero(k.signSecret)}sessions.clear();pins.clear();if(typeof window!=='undefined')window.dispatchEvent(new Event('orb-chat-locked'))}
export function chatUnlocked(user:string){return sessions.has(user)}
export function chatGeneration(){return generation}
export async function createRecoveryCode(){await sodium.ready;return b64(sodium.randombytes_buf(32))}
export async function deriveIdentity(user:string,code:string):Promise<LocalIdentity>{
  await sodium.ready
  const master=unb64(code.trim())
  if(master.length!==32)throw new Error('Invalid recovery key.')
  const boxSeed=sodium.crypto_kdf_derive_from_key(32,1,'ORBCHAT1',master)
  const signSeed=sodium.crypto_kdf_derive_from_key(32,2,'ORBCHAT1',master)
  const box=sodium.crypto_box_seed_keypair(boxSeed),sign=sodium.crypto_sign_seed_keypair(signSeed)
  sodium.memzero(master);sodium.memzero(boxSeed);sodium.memzero(signSeed)
  return {user_id:user,box_key:b64(box.publicKey),sign_key:b64(sign.publicKey),boxSecret:box.privateKey,signSecret:sign.privateKey}
}
export async function unlockChat(client:SupabaseClient,user:string,code:string){
  const epoch=generation
  const keys=await deriveIdentity(user,code)
  let retained=false
  try{
    const before=await client.auth.getSession()
    if(epoch!==generation || before.error || before.data.session?.user.id!==user)throw new Error('Session changed.')
    const {error}=await client.rpc('register_chat_key',{p_box:keys.box_key,p_sign:keys.sign_key})
    const session=await client.auth.getSession()
    if(error || epoch!==generation || session.data.session?.user.id!==user)throw new Error('Could not unlock chat. Check your recovery key and connection.')
    const previous=sessions.get(user)
    if(previous){sodium.memzero(previous.boxSecret);sodium.memzero(previous.signSecret)}
    sessions.set(user,keys);retained=true
  }finally{if(!retained){sodium.memzero(keys.boxSecret);sodium.memzero(keys.signSecret)}}
}

/** Restore locally remembered identity without a recovery-key prompt. */
async function loadLegacyIdentity(client:SupabaseClient,user:string){
  if(chatUnlocked(user))return
  let pending=legacyUnlocks.get(client)
  if(!pending){pending=new Map();legacyUnlocks.set(client,pending)}
  const epoch=generation,previous=pending.get(user)
  if(previous?.epoch===epoch)return previous.task
  const task=(async()=>{
    try{
      const code=await loadRememberedRecoveryCode(user)
      if(code && generation===epoch)await unlockChat(client,user,code)
    }catch{/* A missing legacy key must not block account-based chat. */}
  })()
  pending.set(user,{epoch,task})
  return task
}
export async function fingerprint(identity:Identity){await sodium.ready;return sodium.to_hex(sodium.crypto_generichash(32,JSON.stringify([identity.user_id,identity.box_key,identity.sign_key]),null)).match(/.{1,4}/g)!.join(' ')}
async function pin(viewer:string,key:Identity){
  const id=`orb-chat-pin:${viewer}:${key.user_id}`
  const value=await fingerprint(key)
  const previous=pins.get(id)??localStorage.getItem(id)
  if(previous && previous!==value)throw new Error('A participant’s security key changed. Verify their identity before continuing.')
  localStorage.setItem(id,value);pins.set(id,value)
}
export async function conversationKeys(client:SupabaseClient,viewer:string,conversation:string):Promise<Identity[]>{
  const {data,error}=await client.rpc('conversation_chat_keys',{p_conversation:conversation})
  if(error || !Array.isArray(data) || !data.length || data.length>16)throw new Error('Could not verify conversation participants.')
  const keys=data as Identity[]
  if(keys.some(k=>!k.box_key || !k.sign_key))throw new ParticipantsPending()
  for(const key of keys)await pin(viewer,key)
  return keys.sort((a,b)=>a.user_id.localeCompare(b.user_id))
}
function signed(e:Envelope){return JSON.stringify([PREFIX,e.v,e.id,e.conversation,e.sender,e.nonce,e.body,e.recipients.map(k=>[k.user_id,k.box_key,k.sign_key,k.key])])}
export async function sealMessage(identity:LocalIdentity,id:string,conversation:string,payload:unknown,recipients:Identity[]):Promise<Envelope>{
  await sodium.ready
  if(!recipients.some(k=>k.user_id===identity.user_id))throw new Error('Sender is not a participant.')
  const key=sodium.crypto_secretbox_keygen(),nonce=sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  try {
    const e:Envelope={v:1,id,conversation,sender:identity.user_id,nonce:b64(nonce),body:b64(sodium.crypto_secretbox_easy(JSON.stringify(payload),nonce,key)),
      recipients:[...recipients].sort((a,b)=>a.user_id.localeCompare(b.user_id)).map(k=>({user_id:k.user_id,box_key:k.box_key,sign_key:k.sign_key,key:b64(sodium.crypto_box_seal(key,unb64(k.box_key)))})),signature:''}
    e.signature=b64(sodium.crypto_sign_detached(signed(e),identity.signSecret));return e
  } finally{sodium.memzero(key)}
}
export async function openMessage(identity:LocalIdentity,row:Pick<Message,'id'|'conversation_id'|'sender_id'>,e:Envelope){
  await sodium.ready
  if(e.v!==1 || e.id!==row.id || e.conversation!==row.conversation_id || e.sender!==row.sender_id || !Array.isArray(e.recipients) || e.recipients.length>16)throw new Error('Invalid encrypted message.')
  const sender=e.recipients.find(k=>k.user_id===e.sender),recipient=e.recipients.find(k=>k.user_id===identity.user_id)
  if(!sender || !recipient || recipient.box_key!==identity.box_key || !sodium.crypto_sign_verify_detached(unb64(e.signature),signed(e),unb64(sender.sign_key)))throw new Error('Message signature could not be verified.')
  const key=sodium.crypto_box_seal_open(unb64(recipient.key),unb64(identity.box_key),identity.boxSecret)
  try{return JSON.parse(sodium.to_string(sodium.crypto_secretbox_open_easy(unb64(e.body),unb64(e.nonce),key)))}finally{sodium.memzero(key)}
}
export async function encryptChatMessage(client:SupabaseClient,user:string,id:string,conversation:string,payload:unknown){
  const identity=sessions.get(user)
  if(!identity)throw new Error('Connect this device to continue.')
  return sealMessage(identity,id,conversation,payload,await conversationKeys(client,user,conversation))
}
export async function sealPendingMessage(user:string,id:string,conversation:string,payload:unknown){
  const identity=sessions.get(user);if(!identity)throw new Error('Connect this device to continue.')
  return sealMessage(identity,id,conversation,payload,[{user_id:user,box_key:identity.box_key,sign_key:identity.sign_key}])
}
export async function openPendingMessage(user:string,id:string,conversation:string,envelope:Envelope){
  const identity=sessions.get(user);if(!identity)throw new Error('Connect this device to continue.')
  const sender=envelope.recipients?.find(k=>k.user_id===user)
  if(sender?.box_key!==identity.box_key || sender.sign_key!==identity.sign_key)throw new Error('Could not verify pending message.')
  return openMessage(identity,{id,conversation_id:conversation,sender_id:user},envelope)
}
export async function decryptChatMessage(client:SupabaseClient,user:string,row:Message & {encrypted_payload?:Envelope|null}):Promise<Message>{
  if(!row.encrypted_payload)return row
  const hidden={...row,content:'This older message is unavailable on this device.',attachment_url:null,attachment_type:null,attachment_name:null,attachment_metadata:null}
  const epoch=generation
  await loadLegacyIdentity(client,user)
  if(epoch!==generation)return hidden
  const identity=sessions.get(user);if(!identity)return hidden
  try{
    const e=row.encrypted_payload
    const {data:sender,error}=await client.rpc('sender_chat_key',{p_conversation:row.conversation_id,p_sender:row.sender_id})
    if(error || !sender)throw new Error('Unverified sender')
    await pin(user,sender)
    const claimed=e.recipients.find(k=>k.user_id===row.sender_id)
    if(sender.sign_key!==claimed?.sign_key || sender.box_key!==claimed?.box_key)throw new Error('Unverified sender')
    const data=await openMessage(identity,row,e)
    if(epoch!==generation)throw new Error('Chat locked')
    if(typeof data.content!=='string')throw new Error('Invalid message')
    return {...row,content:data.content,attachment_url:data.attachment_url??null,attachment_type:data.attachment_type??null,
      attachment_name:data.attachment_name??null,attachment_metadata:data.attachment_metadata??null}
  }catch{return {...hidden,content:'This message is unavailable on this device.'}}
}

export async function decryptPrivatePayload(client:SupabaseClient,user:string,id:string,conversation:string,senderId:string,e:Envelope){
  const epoch=generation
  await loadLegacyIdentity(client,user)
  if(epoch!==generation)throw new Error('Session changed.')
  const identity=sessions.get(user);if(!identity)throw new Error('Connect this device to continue.')
  const {data:sender,error}=await client.rpc('sender_chat_key',{p_conversation:conversation,p_sender:senderId})
  if(error || !sender)throw new Error('Could not verify sender.')
  await pin(user,sender)
  const claimed=e.recipients.find(k=>k.user_id===senderId)
  if(sender.sign_key!==claimed?.sign_key || sender.box_key!==claimed?.box_key)throw new Error('Sender key mismatch.')
  const result=await openMessage(identity,{id,conversation_id:conversation,sender_id:senderId},e)
  if(epoch!==generation)throw new Error('Chat locked')
  return result
}

/** Works in native custom-scheme WebViews without crypto.randomUUID. */
export async function messageId(){
  await sodium.ready
  const bytes=sodium.randombytes_buf(16);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128
  const hex=sodium.to_hex(bytes)
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}

export async function securityFingerprints(user:string){
  const identity=sessions.get(user)
  if(!identity)throw new Error('Unlock chat first.')
  const result=[{user_id:user,fingerprint:await fingerprint(identity)}]
  const prefix=`orb-chat-pin:${user}:`
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i)
    if(key?.startsWith(prefix) && key.slice(prefix.length)!==user)result.push({user_id:key.slice(prefix.length),fingerprint:localStorage.getItem(key)!})
  }
  return result
}
