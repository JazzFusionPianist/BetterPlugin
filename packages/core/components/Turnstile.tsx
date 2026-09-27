'use client'
import {useEffect,useRef} from 'react'

export const SLUR_TURNSTILE_SITE_KEY='0x4AAAAAAFFgtGyuOo0oeU2k'

interface TurnstileApi {
 render(container:HTMLElement,options:Record<string,unknown>):string
 reset(widget:string):void
 remove(widget:string):void
}
declare global {interface Window {turnstile?:TurnstileApi}}

/** Cloudflare challenge token used by Supabase Auth. The public site key is safe to ship. */
export function Turnstile({onToken,onError,resetKey=0}:{onToken:(token:string)=>void;onError:()=>void;resetKey?:number}){
 const container=useRef<HTMLDivElement>(null),widget=useRef<string|undefined>(undefined),tokenCallback=useRef(onToken),errorCallback=useRef(onError)
 tokenCallback.current=onToken;errorCallback.current=onError
 useEffect(()=>{
  let cancelled=false
  const render=()=>{
   if(cancelled||widget.current||!container.current||!window.turnstile)return
   widget.current=window.turnstile.render(container.current,{
    sitekey:SLUR_TURNSTILE_SITE_KEY,action:'authentication',theme:'light',size:'normal',
    callback:(token:string)=>tokenCallback.current(token),
    'expired-callback':()=>tokenCallback.current(''),
    'timeout-callback':()=>tokenCallback.current(''),
    'error-callback':()=>{tokenCallback.current('');errorCallback.current()},
   })
  }
  let script=document.querySelector<HTMLScriptElement>('script[data-slur-turnstile]')
  if(window.turnstile)render()
  else {
   if(!script){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.slurTurnstile='true';document.head.appendChild(script)}
   script.addEventListener('load',render)
  }
  return()=>{cancelled=true;script?.removeEventListener('load',render);if(widget.current&&window.turnstile){window.turnstile.remove(widget.current);widget.current=undefined}}
 },[])
 useEffect(()=>{if(widget.current&&window.turnstile){window.turnstile.reset(widget.current);tokenCallback.current('')}},[resetKey])
 return <div className="sl-turnstile" ref={container} aria-label="Bot protection"/>
}
