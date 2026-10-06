import type { SupabaseClient } from '@supabase/supabase-js'
import sodium from 'libsodium-wrappers'
import { chatUnlocked, createRecoveryCode, unlockChat, chatGeneration, deriveIdentity } from './chatCrypto.ts'
import { ensureRememberedRecoveryCode, loadRememberedRecoveryCode } from './deviceKeyStore.ts'
import { createChatBootstrap } from './chatBootstrap.ts'

const preparations=new WeakMap<SupabaseClient,{epoch:number;prepare:ReturnType<typeof createChatBootstrap>}>()

export function prepareChat(client:SupabaseClient,user:string){
  const epoch=chatGeneration()
  let entry=preparations.get(client)
  if(!entry || entry.epoch!==epoch){
    entry={epoch,prepare:createChatBootstrap({
      unlocked:chatUnlocked,
      assertCurrent:async user=>{
        const {data,error}=await client.auth.getSession()
        if(error || data.session?.user.id!==user || chatGeneration()!==epoch)throw new Error('Session changed.')
      },
      registered:async()=>{
        const {data,error}=await client.rpc('my_chat_key')
        if(error)throw new Error('Could not prepare conversations.')
        return !!data
      },
      load:loadRememberedRecoveryCode,
      matches:async(user,code)=>{
        const {data,error}=await client.rpc('my_chat_key')
        if(error)throw new Error('Could not connect this device.')
        const identity=await deriveIdentity(user,code)
        try{return identity.box_key===data?.box_key&&identity.sign_key===data?.sign_key}
        finally{sodium.memzero(identity.boxSecret);sodium.memzero(identity.signSecret)}
      },
      create:createRecoveryCode,
      ensure:ensureRememberedRecoveryCode,
      unlock:(user,code)=>unlockChat(client,user,code),
    })}
    preparations.set(client,entry)
  }
  return entry.prepare(user)
}
