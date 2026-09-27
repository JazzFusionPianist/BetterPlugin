import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveSecureFile } from './secureFiles'

/** One owner for decrypted object URLs, including imperative download callers. */
export function createFileResolver(client:SupabaseClient,apiBase='',publicBase?:string){
  const cache=new Map<string,{url:string;expires:number}>()
  const listeners=new Set<()=>void>()
  let epoch=0
  const revoke=(url:string)=>{if(url.startsWith('blob:'))URL.revokeObjectURL(url)}
  const clear=()=>{epoch++;for(const entry of cache.values())revoke(entry.url);cache.clear();listeners.forEach(f=>f())}
  if(typeof window!=='undefined')window.addEventListener('orb-chat-locked',clear)
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT' || event==='SIGNED_IN')clear()})
  return {
    clear,
    subscribe(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn)}},
    invalidate(url:string){for(const [key,value] of cache)if(key.endsWith(':'+url)){revoke(value.url);cache.delete(key)}},
    async resolve(url:string){
      const {data,error}=await client.auth.getSession()
      if(error || !data.session)throw new Error('Sign in to access attachments.')
      if(url.startsWith('blob:'))return url
      const generation=epoch,uid=data.session.user.id,key=uid+':'+url
      const hit=cache.get(key)
      if(hit && hit.expires>Date.now())return hit.url
      const resolved=await resolveSecureFile(client,url,apiBase,publicBase)
      const current=await client.auth.getSession()
      if(epoch!==generation || current.data.session?.user.id!==uid){revoke(resolved);throw new Error('Session changed.')}
      // A concurrent resolver may have completed the same download.
      const existing=cache.get(key)
      if(existing && existing.expires>Date.now()){if(resolved!==existing.url)revoke(resolved);return existing.url}
      if(existing)revoke(existing.url)
      for(const [k,v] of cache)if(v.expires<Date.now()){revoke(v.url);cache.delete(k)}
      if(cache.size>=64){const first=cache.entries().next().value;if(first){revoke(first[1].url);cache.delete(first[0])}}
      cache.set(key,{url:resolved,expires:Date.now()+240000});return resolved
    },
  }
}
