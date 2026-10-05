import {createRoot} from 'react-dom/client'
import {useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import DeviceConnection from '@orb/core/components/DeviceConnection'
import {prepareChat} from '@orb/core/lib/prepareChat'
import {loadRememberedRecoveryCode} from '@orb/core/lib/deviceKeyStore'
import {deriveIdentity,sealMessage,openMessage,type Envelope} from '@orb/core/lib/chatCrypto'

const user='00000000-0000-4000-8000-000000000001'
const relay=(window as unknown as {testRelay:(request:unknown)=>Promise<unknown>}).testRelay
const client={
  auth:{getSession:async()=>({data:{session:{user:{id:user}}}})},
  rpc:(name:string,args:unknown)=>relay({rpc:name,args}),
  from(table:string){
    let action='select',values:unknown,single=false
    const filters:unknown[]=[]
    const query={
      select:()=>query,limit:()=>query,single:()=>{single=true;return query},
      eq:(key:string,value:unknown)=>{filters.push({op:'eq',key,value});return query},
      is:(key:string,value:unknown)=>{filters.push({op:'eq',key,value});return query},
      gt:(key:string,value:unknown)=>{filters.push({op:'gt',key,value});return query},
      insert:(value:unknown)=>{action='insert';values=value;return query},
      update:(value:unknown)=>{action='update';values=value;return query},
      delete:()=>{action='delete';return query},
      then:(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown)=>relay({table,action,values,filters,single}).then(resolve,reject),
    }
    return query
  },
} as unknown as SupabaseClient
const ready=await prepareChat(client,user)
const row={id:'20000000-0000-4000-8000-000000000001',conversation_id:'10000000-0000-4000-8000-000000000001',sender_id:user}
const localIdentity=async()=>{
  const master=await loadRememberedRecoveryCode(user)
  if(!master)throw new Error('Device not connected')
  return deriveIdentity(user,master)
}
Object.assign(window,{
  testDeviceState:ready,
  testSeal:async()=>{
    const identity=await localIdentity()
    return sealMessage(identity,row.id,row.conversation_id,{content:'Private fixture history'},[identity])
  },
  testOpen:async(envelope:Envelope)=>openMessage(await localIdentity(),row,envelope),
  testLeaks:async(serialized:string)=>{
    const master=await loadRememberedRecoveryCode(user)
    return !!master&&(serialized.includes(master)||document.body.innerText.includes(master))
  },
})
function Harness(){
  const [connected,setConnected]=useState(false)
  return connected?<main>Connected</main>:<DeviceConnection client={client} userId={user} restoring={ready==='restore'} onConnected={()=>setConnected(true)}/>
}
createRoot(document.getElementById('root')!).render(<Harness/> )
