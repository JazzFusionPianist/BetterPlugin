'use client'
import { useEffect, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lockChat } from '../lib/chatCrypto'

/** Account chat needs no key enrollment. Keep session checks and legacy-key cleanup. */
export function ChatSession({client,userId,children}:{client:SupabaseClient;userId:string;children:ReactNode}){
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true
    setError('')
    const {data}=client.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT' || (session && session.user.id!==userId))lockChat()
    })
    const timer=setInterval(()=>{
      void Promise.resolve(client.rpc('security_check_session').abortSignal(AbortSignal.timeout(10000))).then(({error})=>{
        if(active && error?.code==='42501'){
          lockChat()
          void client.auth.signOut({scope:'local'})
        }
      }).catch(()=>{/* Temporary connectivity loss must not erase a session. */})
    },30000)
    const onError=(event:Event)=>setError(String((event as CustomEvent).detail))
    const onHide=()=>lockChat()
    window.addEventListener('orb-chat-error',onError)
    window.addEventListener('pagehide',onHide)
    return ()=>{
      active=false;clearInterval(timer);data.subscription.unsubscribe()
      window.removeEventListener('orb-chat-error',onError);window.removeEventListener('pagehide',onHide)
      lockChat()
    }
  },[client,userId])
  return <>
    {error&&<div role="alert" style={{position:'fixed',top:12,left:'10%',right:'10%',zIndex:10000,background:'#fff4e5',color:'#4c2800',padding:16}}>
      {error}<button onClick={()=>setError('')} aria-label="Close">×</button>
    </div>}
    {children}
  </>
}
