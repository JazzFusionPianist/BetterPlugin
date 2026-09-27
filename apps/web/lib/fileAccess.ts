'use client'
import { useEffect, useState } from 'react'
import { createFileResolver } from '@orb/core/lib/fileResolver.ts'
import { supabase } from './supabase'
const resolver=createFileResolver(supabase,process.env.NEXT_PUBLIC_UPLOAD_API_BASE || 'https://better-plugin.vercel.app',process.env.NEXT_PUBLIC_R2_PUBLIC_URL)
export const resolveUrl=(url:string)=>resolver.resolve(url)
export function useResolvedUrl(url:string):string {
  const [state,setState]=useState({source:'',url:''})
  useEffect(()=>{
    if(!url)return
    let alive=true
    const load=()=>void resolveUrl(url).then(value=>{if(alive)setState({source:url,url:value})}).catch(()=>{if(alive)setState({source:url,url:''})})
    load();const timer=setInterval(load,240000)
    const unsubscribe=resolver.subscribe(()=>{if(alive)setState({source:'',url:''})})
    return ()=>{alive=false;clearInterval(timer);unsubscribe()}
  },[url])
  return state.source===url?state.url:''
}
