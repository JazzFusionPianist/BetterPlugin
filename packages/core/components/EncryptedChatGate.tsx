'use client'
import { upgradeHistory } from '../lib/historyUpgrade'
import { useEffect, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { chatUnlocked, createRecoveryCode, lockChat, unlockChat, securityFingerprints } from '../lib/chatCrypto'

/** Recovery secrets stay on the device and are never sent to an API. */
export function EncryptedChatGate({client,userId,children}:{client:SupabaseClient;userId:string;children:ReactNode}) {
  const [migrationStatus,setMigrationStatus]=useState('')
  const [migrating,setMigrating]=useState(false)
  const [fingerprints,setFingerprints]=useState<Array<{user_id:string;fingerprint:string}>|null>(null)
  const [state,setState]=useState<'loading'|'new'|'unlock'|'ready'|'error'>('loading')
  const [code,setCode]=useState(''),[saved,setSaved]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{
    let alive=true
    setCode('');setSaved(false);setState('loading')
    const check=async()=>{
      if(chatUnlocked(userId)){if(alive)setState('ready');return}
      const {data,error}=await client.rpc('my_chat_key')
      if(!alive)return
      if(error){setState('error');return}
      if(data)setState('unlock')
      else {const key=await createRecoveryCode();if(alive){setCode(key);setState('new')}}
    }
    void check().catch(()=>{if(alive)setState('error')})
    const {data}=client.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT' || (session && session.user.id!==userId)){lockChat();if(alive){setState('loading');setCode('')}}
    })
    return ()=>{alive=false;data.subscription.unsubscribe()}
  },[client,userId])
  useEffect(()=>{const onError=(e:Event)=>setError(String((e as CustomEvent).detail));window.addEventListener('orb-chat-error',onError);return()=>window.removeEventListener('orb-chat-error',onError)},[])
  if(state==='ready')return <>
    <button style={{position:'fixed',bottom:8,right:8,zIndex:9998,fontSize:11}} onClick={()=>void securityFingerprints(userId).then(setFingerprints)}>채팅 보안</button>
    {fingerprints&&<section role="dialog" aria-modal="true" aria-label="채팅 보안 번호" style={{position:'fixed',inset:'12%',overflowY:'auto',zIndex:10001,background:'#fff',color:'#191919',padding:24,borderRadius:12}}>
      <h2>보안 번호 확인</h2><p>상대방과 별도의 신뢰할 수 있는 통화 등으로 아래 번호가 같은지 비교해 주세요. 처음 연결할 때 서버가 제공한 공개 키를 기억하며, 이후 바뀌면 전송을 차단합니다.</p>
      {fingerprints.map(k=><div key={k.user_id} style={{marginBottom:16}}><strong>{k.user_id===userId?'내 보안 번호':k.user_id}</strong><p style={{fontFamily:'monospace',overflowWrap:'anywhere'}}>{k.fingerprint}</p></div>)}
      <p>새 메시지와 첨부파일에 적용됩니다. 이전 평문 기록과 라이브 채팅은 이 암호화에 포함되지 않습니다.</p>
      <p>이전 기록 전환은 내가 쓴 메시지와 올린 파일을 한 번에 최대 20개 처리합니다. 모든 참여자가 암호화 설정을 완료해야 합니다. 원본 파일이 없거나 권한이 없는 기록은 건너뜁니다. 서버 백업의 평문은 별도 보존 기간이 끝나야 제거됩니다.</p>
      <button disabled={migrating} onClick={async()=>{
        setMigrating(true);setMigrationStatus('기기에서 이전 기록을 암호화하고 있습니다…')
        try{const result=await upgradeHistory(client,userId,'https://better-plugin.vercel.app');setMigrationStatus(`${result.upgraded}개 전환, ${result.skipped}개 건너뜀. 남은 기록은 다시 실행해 주세요.`)}
        catch{setMigrationStatus('이전 기록을 확인하지 못했습니다. 연결을 확인해 주세요.')}
        finally{setMigrating(false)}
      }}>내 이전 기록 암호화</button>
      <p role="status">{migrationStatus}</p>
      <button onClick={()=>setFingerprints(null)}>닫기</button>
    </section>}
    {error&&<div role="alert" style={{position:'fixed',top:12,left:'10%',right:'10%',zIndex:10000,background:'#fff4e5',color:'#4c2800',padding:16}}>{error}<button onClick={()=>setError('')} aria-label="Close">×</button></div>}{children}</>
  const submit=async()=>{
    setBusy(true);setError('')
    try{await unlockChat(client,userId,code);setCode('');setState('ready')}
    catch(e){setError(e instanceof Error?e.message:'Could not unlock chat.')}
    finally{setBusy(false)}
  }
  return <section aria-label="Encrypted chat" style={{maxWidth:520,margin:'48px auto',padding:24,lineHeight:1.6,color:'inherit'}}>
    <h2>종단간 암호화 채팅</h2>
    {state==='loading'?<p>암호화 설정을 확인하고 있습니다…</p>:state==='error'?<p role="alert">암호화 서비스를 확인할 수 없습니다. 잠시 후 새로고침해 주세요.</p>:<form onSubmit={e=>{e.preventDefault();void submit()}}>
      <p>{state==='new'?'대화는 참여자의 기기에서만 열 수 있습니다. 아래 복구 키를 비밀번호 관리자 등 안전한 곳에 보관해 주세요.':'이 기기에서 대화를 열려면 보관한 복구 키를 입력해 주세요.'}</p>
      <p>복구 키는 서버에 전송되지 않습니다. 앱을 다시 열거나 새 기기로 옮길 때 필요하며, 분실하면 운영자도 대화를 복원할 수 없습니다.</p>
      <label>복구 키<input style={{width:'100%',fontFamily:'monospace',padding:10}} type={state==='new'?'text':'password'} autoComplete="off" spellCheck={false} readOnly={state==='new'} value={code} onChange={e=>setCode(e.target.value)} required /></label>
      {state==='new'&&<label style={{display:'block',marginTop:16}}><input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)}/> 복구 키를 안전한 곳에 저장했습니다.</label>}
      <button style={{marginTop:16,padding:12}} disabled={busy || !code || (state==='new'&&!saved)}>{busy?'확인 중…':state==='new'?'암호화 채팅 시작':'대화 열기'}</button>
      {error&&<p role="alert">{error}</p>}
    </form>}
  </section>
}
