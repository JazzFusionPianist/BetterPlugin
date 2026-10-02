import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
export interface LiveChatMessage { id:string; senderId:string; senderName:string; senderColor:string; content:string; ts:number }
export function useLiveChat(client:SupabaseClient,sessionId:string|null,me:{id:string;name:string;color:string}|null) {
  const active=useRef(sessionId);active.current=sessionId
  const [messages,setMessages]=useState<LiveChatMessage[]>([])
  useEffect(()=>{
    setMessages([])
    if(!sessionId)return
    let stopped=false
    let timer:ReturnType<typeof setTimeout>
    const poll=async()=>{
      try {
      const {data,error}=await client.rpc('live_chat',{p_session:sessionId}).abortSignal(AbortSignal.timeout(10000))
      if(stopped)return
      if(!error && Array.isArray(data))setMessages(data)
      } catch {if(!stopped)setMessages([])}
      if(!stopped)timer=setTimeout(()=>void poll(),2500)
    }
    void poll()
    return ()=>{stopped=true;clearTimeout(timer)}
  },[client,sessionId])
  const sendMessage=useCallback((content:string)=>{
    if(!sessionId || !me || !content.trim())return
    void client.rpc('live_chat',{p_session:sessionId,p_content:content.trim().slice(0,2000)})
      .then(({data,error})=>{if(active.current!==sessionId)return;if(!error && Array.isArray(data))setMessages(data);else window.dispatchEvent(new CustomEvent('orb-chat-error',{detail:'Live chat was not sent. Check access or try again shortly.'}))})
  },[client,sessionId,me])
  return {messages,sendMessage}
}
