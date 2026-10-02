import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,A,B} from './fixture.mjs'
const migration=await readFile('supabase/migrations/20260927193702_release_session_and_health.sql','utf8')
async function setup(){const db=await securityFixture();await db.exec(`
 alter table auth.sessions add created_at timestamptz default now(),add updated_at timestamptz default now(),add refreshed_at timestamp,add not_after timestamptz,add user_agent text;
 create function is_mutual_follow(uuid) returns boolean language sql as $$select false$$;
 create table private.storage_erasure_jobs(completed_at timestamptz,available_at timestamptz,attempts int default 0);
`);await db.exec(migration);return db}
test('session inventory is owner-only; selective revocation and expiry deny old tokens',async()=>{
 const db=await setup(),second='10000000-0000-4000-8000-000000000001'
 try{
  await db.query('insert into auth.sessions(id,user_id,user_agent) values($1,$2,$3)',[second,A,'Test device'])
  const list=(await act(db,A,'select security_list_sessions() as s')).rows[0].s
  assert.equal(list.length,2);assert.equal(list.some(x=>x.id===B),false);assert.equal(list.find(x=>x.id===A).current,true)
  await assert.rejects(act(db,B,'select security_revoke_session($1)',[second]),/Access denied/)
  await act(db,A,'select security_revoke_session($1)',[second])
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'authenticated',sub:A,session_id:second})])
  assert.equal((await db.query('select security_session_active() as ok')).rows[0].ok,false)
  await assert.rejects(db.query('select security_check_session()'),/revoked/)
  assert.equal((await act(db,A,'select security_session_active() as ok')).rows[0].ok,true)
  await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[A])
  assert.equal((await act(db,A,'select security_session_active() as ok')).rows[0].ok,false)
 }finally{await db.close()}
})
test('health fails closed on stale workers or stuck deletions; normal users cannot forge health',async()=>{
 const db=await setup()
 try{
  await assert.rejects(act(db,A,'select security_record_cleanup(0)'),/permission denied|Access denied/)
  await db.exec(`select set_config('request.jwt.claims','{"role":"service_role"}',false)`)
  assert.equal((await db.query('select security_health_snapshot() as h')).rows[0].h.cleanupFresh,false)
  await db.exec('select security_record_cleanup(0)')
  assert.deepEqual((await db.query('select security_health_snapshot() as h')).rows[0].h,{cleanupFresh:true,deletionsHealthy:true})
  await db.exec("insert into private.storage_erasure_jobs(completed_at,available_at) values(null,now()-interval '31 minutes')")
  assert.equal((await db.query('select security_health_snapshot() as h')).rows[0].h.deletionsHealthy,false)
  await db.exec("update private.security_worker_health set last_success_at=now()-interval '21 minutes'")
  assert.equal((await db.query('select security_health_snapshot() as h')).rows[0].h.cleanupFresh,false)
 }finally{await db.close()}
})
