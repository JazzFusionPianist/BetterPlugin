'use client'
import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
interface LoginSession {id:string;current:boolean;started_at:string;last_seen_at:string;device:string}
export function SessionSecurity({client}:{client:SupabaseClient}) {
 const [sessions,setSessions]=useState<LoginSession[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null)
 async function refresh(){const {data,error}=await client.rpc('security_list_sessions');if(error){setError('로그인 기기를 확인하지 못했습니다.');return}setSessions(data??[])}
 useEffect(()=>{void refresh()},[client])
 return <section aria-label="로그인 기기"><h3>로그인 기기</h3>
 <p>모르는 로그인을 차단하면 해당 세션의 새 채팅·파일·방송 접근이 거부됩니다. 이미 저장된 파일이나 복구 키는 회수할 수 없습니다.</p>
 {sessions.map(s=><div key={s.id} style={{marginBottom:12}}><strong>{s.current?'현재 기기':'다른 로그인'}</strong><p style={{overflowWrap:'anywhere'}}>{s.device}</p><small>마지막 사용: {new Date(s.last_seen_at).toLocaleString()}</small>{!s.current&&<button disabled={busy!==null} onClick={async()=>{
 setBusy(s.id);setError('');try{const {error}=await client.rpc('security_revoke_session',{p_session:s.id});if(error)throw error;await refresh()}catch{setError('접근을 차단하지 못했습니다. 다시 시도해 주세요.')}finally{setBusy(null)}
 }}>{busy===s.id?'차단 중…':'이 로그인 차단'}</button>}</div>)}
 {error&&<p role="alert">{error}</p>}</section>
}
