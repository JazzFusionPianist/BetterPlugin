'use client'
import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { approveChatDevice, requestChatDevice, restoreChatPasskey, saveChatPasskey } from '../lib/chatDevices'
import { deviceLinkCode, type DeviceLink, type PasskeyVault } from '../lib/chatDeviceTransfer'

export default function DeviceConnection({client,userId,restoring=false,onClose,onConnected}:{
  client:SupabaseClient;userId:string;restoring?:boolean;onClose?:()=>void;onConnected:()=>void
}){
  const [requests,setRequests]=useState<DeviceLink[]>([]),[vaults,setVaults]=useState<PasskeyVault[]>([])
  const [number,setNumber]=useState(''),[entered,setEntered]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [credential,setCredential]=useState('')
  const pending=useRef<Awaited<ReturnType<typeof requestChatDevice>>|null>(null)
  const alive=useRef(true)
  useEffect(()=>{
    alive.current=true
    let polling=false
    const poll=async()=>{
      if(polling)return;polling=true
      try{
        if(restoring){
          const {data}=await client.from('chat_passkey_vaults').select('vault').eq('user_id',userId).limit(5)
          if(alive.current)setVaults((data??[]).map(r=>r.vault).filter(v=>v.rpId===location.hostname))
          const job=pending.current
          if(job){
            if(Date.parse(job.link.expires_at)<=Date.now()){job.dispose();pending.current=null;if(alive.current){setNumber('');setError('Connection expired. Try again.')}return}
            const {data,error}=await client.from('chat_device_links').select('response').eq('id',job.link.id).single()
            if(error)throw error
            if(data?.response){await job.finish(data.response);pending.current=null;if(alive.current)onConnected()}
          }
        }else{
          const {data,error}=await client.from('chat_device_links').select('*').eq('user_id',userId).is('response',null).gt('expires_at',new Date().toISOString()).limit(5)
          if(error)throw error
          if(alive.current)setRequests(data??[])
        }
      }catch{if(alive.current)setError('Could not connect. Try again.')}finally{polling=false}
    }
    void poll();const timer=setInterval(()=>void poll(),3000)
    return()=>{alive.current=false;clearInterval(timer);pending.current?.dispose();pending.current=null}
  },[client,userId,restoring])
  const run=async(action:()=>Promise<void>)=>{
    if(busy)return;setBusy(true);setError('')
    try{await action()}catch{if(alive.current)setError('Could not connect. Check the other device and try again.')}
    finally{if(alive.current)setBusy(false)}
  }
  return <div className="slur-device-connection" style={{position:'fixed',inset:0,zIndex:10001,background:'var(--bg, #faf9f6)',color:'var(--text, #222)',overflow:'auto'}}>
    <style>{`.slur-device-connection{font-family:system-ui,sans-serif;line-height:1.5;letter-spacing:0}.slur-device-connection section{box-sizing:border-box}.slur-device-connection button,.slur-device-connection input,.slur-device-connection select{box-sizing:border-box;max-width:100%;font:inherit;font-size:14px;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;padding:9px 12px}.slur-device-connection button{cursor:pointer;margin:4px 8px 4px 0}.slur-device-connection button:disabled{opacity:.45;cursor:default}.slur-device-connection input,.slur-device-connection select{display:block;width:100%;margin:12px 0}.slur-device-connection output{display:block;padding:12px 0;font-family:monospace}.slur-device-connection [role=alert]{color:#bd3434}`}</style>
    <section aria-label="Device sign-in" style={{maxWidth:440,margin:'48px auto',padding:24}}>
      <h2 style={{fontSize:22}}> {restoring?'Continue on this device':'Device sign-in'} </h2>
      {restoring?<>
        {vaults.length>1&&<select aria-label="Passkey" value={credential||vaults[0]!.credentialId} onChange={e=>setCredential(e.target.value)}>
          {vaults.map((v,i)=><option key={v.credentialId} value={v.credentialId}>Passkey {i+1}</option>)}
        </select>}
        {!!vaults.length&&<button disabled={busy} onClick={()=>void run(async()=>{await restoreChatPasskey(client,userId,vaults.find(v=>v.credentialId===credential)??vaults[0]!);if(alive.current)onConnected()})}>Use a passkey</button>}
        <p>Open Slur on a device where you are already signed in.</p>
        {number?<><output style={{fontSize:18,overflowWrap:'anywhere',userSelect:'all'}}>{number}</output><p>Enter this one-time connection code on that device to continue.</p></>
          :<button disabled={busy} onClick={()=>void run(async()=>{
            const job=await requestChatDevice(client,userId)
            if(!alive.current){job.dispose();return}
            pending.current?.dispose();pending.current=job;setNumber(await deviceLinkCode(job.link))
          })}>Use another device</button>}
        <p>Your previous conversations stay on your connected devices until this device is connected.</p>
      </>:<>
        {requests.length?<><p>A new device wants to connect. Enter the connection code shown on that device.</p>
          <input aria-label="Connection code from your new device" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={22} value={entered} onChange={e=>setEntered(e.target.value.trim())}/>
          <button disabled={busy||entered.length!==22} onClick={()=>void run(async()=>{
            const codes=await Promise.all(requests.map(deviceLinkCode)),index=codes.indexOf(entered)
            if(index<0||codes.filter(c=>c===entered).length!==1)throw new Error('Numbers do not match.')
            await approveChatDevice(client,userId,requests[index]!,entered);setEntered('');onConnected()
          })}>Connect</button></>:<p>No new device requests.</p>}
        {typeof location!=='undefined'&&location.protocol==='https:'&&<button disabled={busy} onClick={()=>void run(async()=>{await saveChatPasskey(client,userId);onConnected()})}>Set up a passkey</button>}
      </>}
      {error&&<p role="alert">{error}</p>}
      {onClose&&<button onClick={onClose}>Close</button>}
      {restoring&&<button onClick={()=>void client.auth.signOut({scope:'local'})}>Sign out</button>}
    </section>
  </div>
}
