import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,as,A,B,C} from './fixture.mjs'
test('live admission, trusted sender, recipient isolation, host-only controls and revocation',async()=>{
 const db=await securityFixture()
 try{
  await db.exec(await readFile('supabase/migrations/20260927184448_security_live_permissions.sql','utf8'))
  const sid=(await act(db,A,"select (live_start('Private',true,true,'screen','invited',array[$1::uuid])).id as id",[B])).rows[0].id
  await assert.rejects(act(db,C,'select live_join($1)',[sid]),/Access denied/)
  await act(db,B,'select live_join($1)',[sid])
  await assert.rejects(as(db,'anon',undefined,'aal1',`select live_join('${sid}')`),/permission denied/)
  await assert.rejects(act(db,B,'select live_send_signal($1,$2)',[sid,{type:'offer',from:A,to:B,sdp:{}}]),/Access denied/)
  await act(db,B,'select live_send_signal($1,$2)',[sid,{type:'join',from:C}])
  const polled=(await act(db,A,'select live_poll($1) as p',[sid])).rows[0].p
  assert.equal(polled.signals[0].from,B)
  assert.equal((await act(db,B,'select live_poll($1) as p',[sid])).rows[0].p.signals.length,0)
  await act(db,B,'select live_chat($1,$2)',[sid,'Hello'])
  const chat=(await act(db,A,'select live_chat($1) as p',[sid])).rows[0].p
  assert.equal(chat[0].senderId,B)
  await assert.rejects(act(db,B,"select live_manage($1,'end')",[sid]),/Access denied/)
  await act(db,A,"select live_manage($1,'ban',$2)",[sid,B])
  await assert.rejects(act(db,B,'select live_poll($1)',[sid]),/Access denied/)
  await assert.rejects(act(db,B,'select live_join($1)',[sid]),/Access denied/)
  await act(db,A,"select live_manage($1,'end')",[sid])
  assert.equal((await db.query('select count(*) from private.live_signals')).rows[0].count,0)
 }finally{await db.close()}
})
