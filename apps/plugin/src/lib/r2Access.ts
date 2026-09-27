import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createFileResolver } from '@orb/core/lib/fileResolver.ts'
import { supabase as defaultSupabase } from './supabase'
const resolvers=new WeakMap<SupabaseClient,ReturnType<typeof createFileResolver>>()
function resolver(client:SupabaseClient){
  let r=resolvers.get(client)
  if(!r){r=createFileResolver(client,'',import.meta.env.VITE_R2_PUBLIC_URL);resolvers.set(client,r)}
  return r
}
export function invalidateResolved(url:string){if(defaultSupabase)resolver(defaultSupabase).invalidate(url)}
export function resolveFileUrl(client:SupabaseClient|null,url:string):Promise<string>{
  if(!client)return Promise.reject(new Error('Sign in to access attachments.'))
  return resolver(client).resolve(url)
}
export function resolveUrl(url:string){return resolveFileUrl(defaultSupabase,url)}
export function useResolvedUrl(url:string):string{
  const [state,setState]=useState({source:'',url:''})
  useEffect(()=>{
    if(!defaultSupabase || !url)return
    let alive=true
    const r=resolver(defaultSupabase)
    const load=()=>void r.resolve(url).then(value=>{if(alive)setState({source:url,url:value})}).catch(()=>{if(alive)setState({source:url,url:''})})
    load();const timer=setInterval(load,240000)
    const unsubscribe=r.subscribe(()=>{if(alive)setState({source:'',url:''})})
    return ()=>{alive=false;clearInterval(timer);unsubscribe()}
  },[url])
  return state.source===url?state.url:''
}
