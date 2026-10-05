import sodium from 'libsodium-wrappers'
import { b64, unb64, cryptoReady, deriveIdentity, type Identity } from './chatCrypto.ts'

export interface DeviceLink { id:string; user_id:string; public_key:string; expires_at:string }
export interface LinkResponse { v:1; id:string; user:string; recipient:string; expires:string; ciphertext:string; signature:string }
const publicIdentity=(identity:Identity)=>[identity.user_id,identity.box_key,identity.sign_key]
const signed=(r:Omit<LinkResponse,'signature'>)=>JSON.stringify(['slur-device-link-v1',r.v,r.id,r.user,r.recipient,r.expires,r.ciphertext])
function validLink(link:DeviceLink,user:string){
  if(link.user_id!==user || !/^[a-f0-9-]{36}$/i.test(link.id) || !/^[A-Za-z0-9_-]{43}$/.test(link.public_key)
    || !Number.isFinite(Date.parse(link.expires_at)) || Date.parse(link.expires_at)<=Date.now()
    || Date.parse(link.expires_at)>Date.now()+6*60_000)throw new Error('This connection request expired. Try again.')
}
export async function createLinkKey(){await cryptoReady();return sodium.crypto_box_keypair()}
export async function deviceLinkCode(link:DeviceLink){
  await cryptoReady();validLink(link,link.user_id)
  // Full 128-bit comparison: a short public checksum allows the relay to
  // grind a substitute key with the same displayed digits offline.
  return b64(sodium.crypto_generichash(16,JSON.stringify(['slur-device-code-v1',link.id,link.user_id,link.public_key]),null))
}
export async function approveDeviceLink(link:DeviceLink,enteredCode:string,master:string,expected:Identity):Promise<LinkResponse>{
  await cryptoReady();validLink(link,expected.user_id)
  if(enteredCode!==await deviceLinkCode(link))throw new Error('The numbers do not match.')
  const identity=await deriveIdentity(expected.user_id,master)
  try{
    if(JSON.stringify(publicIdentity(identity))!==JSON.stringify(publicIdentity(expected)))throw new Error('This device is not connected to this account.')
    const response:LinkResponse={v:1,id:link.id,user:link.user_id,recipient:link.public_key,expires:link.expires_at,
      ciphertext:b64(sodium.crypto_box_seal(JSON.stringify({master,id:link.id,user:link.user_id}),unb64(link.public_key))),signature:''}
    response.signature=b64(sodium.crypto_sign_detached(signed(response),identity.signSecret))
    return response
  }finally{sodium.memzero(identity.boxSecret);sodium.memzero(identity.signSecret)}
}
export async function receiveDeviceLink(link:DeviceLink,response:LinkResponse,secret:Uint8Array,expected:Identity):Promise<string>{
  await cryptoReady();validLink(link,expected.user_id)
  if(response.v!==1 || response.id!==link.id || response.user!==link.user_id || response.recipient!==link.public_key
    || response.expires!==link.expires_at || !sodium.crypto_sign_verify_detached(unb64(response.signature),signed(response),unb64(expected.sign_key)))
    throw new Error('Could not verify this connection.')
  const clear=sodium.crypto_box_seal_open(unb64(response.ciphertext),unb64(link.public_key),secret)
  try{
    const data=JSON.parse(sodium.to_string(clear))
    if(data.id!==link.id || data.user!==link.user_id || typeof data.master!=='string')throw new Error('Invalid connection.')
    const identity=await deriveIdentity(link.user_id,data.master)
    try{
      if(JSON.stringify(publicIdentity(identity))!==JSON.stringify(publicIdentity(expected)))throw new Error('Account identity changed.')
      return data.master
    }finally{sodium.memzero(identity.boxSecret);sodium.memzero(identity.signSecret)}
  }finally{sodium.memzero(clear)}
}

export interface PasskeyVault { v:1; user:string; credentialId:string; rpId:string; salt:string; nonce:string; ciphertext:string; boxKey:string; signKey:string }
function aad(v:Omit<PasskeyVault,'ciphertext'>){return new TextEncoder().encode(JSON.stringify(['slur-passkey-v1',v.v,v.user,v.credentialId,v.rpId,v.salt,v.nonce,v.boxKey,v.signKey]))}
async function wrappingKey(prf:Uint8Array){
  if(prf.length!==32)throw new Error('This device does not support this sign-in method.')
  return crypto.subtle.importKey('raw',Uint8Array.from(prf),{name:'AES-GCM'},false,['encrypt','decrypt'])
}
export async function wrapPasskeyVault(master:string,identity:Identity,credentialId:string,rpId:string,salt:Uint8Array,prf:Uint8Array):Promise<PasskeyVault>{
  await cryptoReady()
  const local=await deriveIdentity(identity.user_id,master)
  try{if(JSON.stringify(publicIdentity(local))!==JSON.stringify(publicIdentity(identity)))throw new Error('Account identity changed.')}
  finally{sodium.memzero(local.boxSecret);sodium.memzero(local.signSecret)}
  const base={v:1 as const,user:identity.user_id,credentialId,rpId,salt:b64(salt),nonce:b64(crypto.getRandomValues(new Uint8Array(12))),boxKey:identity.box_key,signKey:identity.sign_key}
  const raw=unb64(master)
  try{return {...base,ciphertext:b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:Uint8Array.from(unb64(base.nonce)),additionalData:aad(base)},await wrappingKey(prf),Uint8Array.from(raw))))}}
  finally{sodium.memzero(raw)}
}
export async function unwrapPasskeyVault(v:PasskeyVault,identity:Identity,rpId:string,prf:Uint8Array){
  await cryptoReady()
  if(v.v!==1 || v.user!==identity.user_id || v.rpId!==rpId || v.boxKey!==identity.box_key || v.signKey!==identity.sign_key
    || !/^[A-Za-z0-9_-]{16,2048}$/.test(v.credentialId) || !/^[A-Za-z0-9_-]{43}$/.test(v.salt)
    || !/^[A-Za-z0-9_-]{16}$/.test(v.nonce) || !/^[A-Za-z0-9_-]{64}$/.test(v.ciphertext))throw new Error('Invalid device backup.')
  const raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(unb64(v.nonce)),additionalData:aad(v)},await wrappingKey(prf),Uint8Array.from(unb64(v.ciphertext))))
  try{
    const master=b64(raw),identityCheck=await deriveIdentity(v.user,master)
    try{if(JSON.stringify(publicIdentity(identityCheck))!==JSON.stringify(publicIdentity(identity)))throw new Error('Account identity changed.')}
    finally{sodium.memzero(identityCheck.boxSecret);sodium.memzero(identityCheck.signSecret)}
    return master
  }finally{sodium.memzero(raw)}
}
