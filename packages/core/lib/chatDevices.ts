import type { SupabaseClient } from '@supabase/supabase-js'
import { b64, chatGeneration, deriveIdentity, messageId, type Identity } from './chatCrypto.ts'
import { loadRememberedRecoveryCode, rememberRecoveryCode } from './deviceKeyStore.ts'
import { prepareChat } from './prepareChat.ts'
import { approveDeviceLink, createLinkKey, receiveDeviceLink, type DeviceLink, type LinkResponse, type PasskeyVault } from './chatDeviceTransfer.ts'
import { createPasskeyBackup, restorePasskeyBackup } from './chatPasskeys.ts'
import sodium from 'libsodium-wrappers'

export async function ownChatIdentity(client:SupabaseClient,user:string):Promise<Identity>{
  const {data,error}=await client.rpc('my_chat_key')
  if(error || !data || data.user_id!==user)throw new Error('Could not connect this device.')
  return data
}
async function current(client:SupabaseClient,user:string,epoch:number){
  const {data,error}=await client.auth.getSession()
  if(error || data.session?.user.id!==user || epoch!==chatGeneration())throw new Error('Session changed.')
}
async function install(client:SupabaseClient,user:string,master:string,epoch:number){
  await current(client,user,epoch)
  const expected=await ownChatIdentity(client,user),local=await deriveIdentity(user,master)
  try{if(local.box_key!==expected.box_key || local.sign_key!==expected.sign_key)throw new Error('Account identity changed.')}
  finally{sodium.memzero(local.boxSecret);sodium.memzero(local.signSecret)}
  await current(client,user,epoch)
  await rememberRecoveryCode(user,master)
  await current(client,user,epoch)
  if(await prepareChat(client,user)!=='ready')throw new Error('Could not connect this device.')
}
export async function requestChatDevice(client:SupabaseClient,user:string){
  const epoch=chatGeneration(),keys=await createLinkKey()
  try{
    await current(client,user,epoch)
    const {data,error}=await client.from('chat_device_links').insert({id:await messageId(),user_id:user,public_key:b64(keys.publicKey)}).select('*').single()
    if(error)throw new Error('Could not request a connection. Try again shortly.')
    const link=data as DeviceLink
    return {link,dispose:()=>sodium.memzero(keys.privateKey),finish:async(response:LinkResponse)=>{
      await current(client,user,epoch)
      const master=await receiveDeviceLink(link,response,keys.privateKey,await ownChatIdentity(client,user))
      await install(client,user,master,epoch)
      await client.from('chat_device_links').delete().eq('id',link.id)
      sodium.memzero(keys.privateKey)
    }}
  }catch(error){sodium.memzero(keys.privateKey);throw error}
}
export async function approveChatDevice(client:SupabaseClient,user:string,link:DeviceLink,code:string){
  const epoch=chatGeneration(),master=await loadRememberedRecoveryCode(user)
  if(!master)throw new Error('Use a device that is already connected.')
  const response=await approveDeviceLink(link,code,master,await ownChatIdentity(client,user))
  await current(client,user,epoch)
  const {data,error}=await client.from('chat_device_links').update({response}).eq('id',link.id).eq('user_id',user).is('response',null).select('id')
  if(error || data?.length!==1)throw new Error('The connection request expired. Try again.')
}
export async function saveChatPasskey(client:SupabaseClient,user:string){
  const epoch=chatGeneration(),master=await loadRememberedRecoveryCode(user)
  if(!master)throw new Error('Connect this device first.')
  const vault=await createPasskeyBackup(await ownChatIdentity(client,user),master)
  await current(client,user,epoch)
  const {error}=await client.from('chat_passkey_vaults').insert({user_id:user,credential_id:vault.credentialId,vault})
  if(error)throw new Error('Could not save this sign-in method.')
}
export async function restoreChatPasskey(client:SupabaseClient,user:string,vault:PasskeyVault){
  const epoch=chatGeneration()
  const master=await restorePasskeyBackup(vault,await ownChatIdentity(client,user))
  await install(client,user,master,epoch)
}
