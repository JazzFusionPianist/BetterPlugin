'use client'
import {useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {cancelPendingChat,drainPrivateChat,type DeliveryReason,type DeliveryState} from '../lib/privateChat'

export default function PendingDelivery({client,userId,id,conversationId,state='waiting',reason=null}:{
  client:SupabaseClient;userId:string;id:string;conversationId:string;state?:DeliveryState;reason?:DeliveryReason|null
}){
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[finished,setFinished]=useState(false)
  const inFlight=useRef(false)
  const buttonStyle={font:'inherit',color:'inherit',background:'transparent',border:0,padding:'4px 2px',textDecoration:'underline',cursor:busy?'default':'pointer',opacity:busy?0.5:1}
  const text=state==='expired'?'Not sent. Please send again.':reason==='membership_changed'?'Conversation changed. Please send again.'
    :state==='blocked'?'Could not send. Please send again.':reason==='retry'?'Waiting for connection.':'Waiting to send'
  const run=async(cancel:boolean)=>{
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setNotice('')
    try{
      if(cancel){
        const result=await cancelPendingChat(client,userId,id,conversationId)
        if(result==='delivered'||result==='cancelled'){
          setNotice(result==='delivered'?'Already sent.':'Send cancelled.')
          setFinished(true)
        }
      }else await drainPrivateChat(client,userId)
    }catch{setNotice(cancel?'Could not confirm cancellation. Try again.':'Could not retry. Try again.')}
    finally{inFlight.current=false;setBusy(false)}
  }
  return <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',fontSize:12,lineHeight:1.5}}>
    <span role="status">{notice||text}</span>
    {!finished&&state==='waiting'&&<button type="button" style={buttonStyle} disabled={busy} onClick={()=>void run(false)}>Retry</button>}
    {!finished&&<button type="button" style={buttonStyle} disabled={busy} onClick={()=>void run(true)}>Cancel send</button>}
  </div>
}
