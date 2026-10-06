import {createRoot} from 'react-dom/client'
import type {SupabaseClient} from '@supabase/supabase-js'
import DeviceConnection from '@orb/core/components/DeviceConnection'
import {ChatSession} from '@orb/core/components/ChatSession'
import PendingDelivery from '@orb/core/components/PendingDelivery'
import type {DeliveryReason,DeliveryState} from '@orb/core/lib/privateChat'
import {b64,createRecoveryCode,deriveIdentity,unlockChat} from '@orb/core/lib/chatCrypto'
import {createLinkKey,deviceLinkCode} from '@orb/core/lib/chatDeviceTransfer'
import {createPasskeyBackup,restorePasskeyBackup} from '@orb/core/lib/chatPasskeys'

const user='00000000-0000-4000-8000-000000000001'
const keys=await createLinkKey(),master=await createRecoveryCode(),identity=await deriveIdentity(user,master)
const link={id:'20000000-0000-4000-8000-000000000001',user_id:user,public_key:b64(keys.publicKey),expires_at:new Date(Date.now()+300000).toISOString()}
const params=new URLSearchParams(location.search)
let cancelCalls=0
const accountCalls:string[]=[]
Object.assign(window,{testCancelCalls:()=>cancelCalls,testAccountCalls:accountCalls})
const client={
  auth:{getSession:async()=>({data:{session:{user:{id:user}}}}),signOut:async()=>{},onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  rpc:(name:string)=>{
    accountCalls.push(name)
    if(name==='cancel_private_chat'){
      cancelCalls++
      return new Promise(resolve=>setTimeout(()=>resolve(params.get('result')==='error'?{error:{code:'NETWORK'}}:{data:params.get('result')||'cancelled',error:null}),300))
    }
    const result={data:name==='chat_security_mode'?1:null,error:null}
    return Object.assign(Promise.resolve(result),{abortSignal:()=>Promise.resolve(result)})
  },
  from(table:string){
    accountCalls.push(table)
    let inserting=false
    const query={select:()=>query,eq:()=>query,in:()=>query,is:()=>query,gt:()=>query,limit:()=>query,order:()=>query,single:()=>query,
      insert:()=>{inserting=true;return query},delete:()=>query,
      then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:inserting?link:table==='chat_device_links'&&mode!=='ready'?[link]:[],error:null}).then(resolve)}
    return query
  },
} as unknown as SupabaseClient
const mode=params.get('mode')
if(mode==='ready')await unlockChat(client,user,master)
Object.assign(window,{testDeviceCode:await deviceLinkCode(link),testMaster:master,testPublicKey:identity.box_key})
Object.assign(window,{testPasskey:async()=>{
  const vault=await createPasskeyBackup(identity,master)
  const restored=await restorePasskeyBackup(vault,identity)
  return {restored:restored===master,leaked:JSON.stringify(vault).includes(master)}
}})
createRoot(document.getElementById('root')!).render(mode==='pending'
  ?<main style={{padding:16}}><PendingDelivery client={client} userId={user} id={link.id} conversationId="10000000-0000-4000-8000-000000000001" state={(params.get('state')||'waiting') as DeliveryState} reason={params.get('reason') as DeliveryReason|null}/></main>
  :mode==='ready'||mode==='account'
  ?<ChatSession client={client} userId={user}><main>Conversations</main></ChatSession>
  :<DeviceConnection client={client} userId={user} restoring={mode!=='approve'} onConnected={()=>{}} onClose={mode==='approve'?()=>{}:undefined}/>)
