import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,A,B,C} from './fixture.mjs'
test('account erasure clears profiles and game references without bypassing direct room authorization',async()=>{
 const db=await securityFixture()
 try{
  await db.exec(`create table game_rooms(id uuid primary key,host_id uuid references profiles(id) on delete cascade,guest_id uuid references profiles(id) on delete set null,winner_id uuid references profiles(id),status text,updated_at timestamptz);grant all on game_rooms to authenticated;`)
  for(const name of ['20260927184448_security_live_permissions','20260927184452_security_encrypted_chat','20260927184456_security_membership_and_sessions','20260927185538_security_profile_erasure'])await db.exec(await readFile('supabase/migrations/'+name+'.sql','utf8'))
  const game='30000000-0000-4000-8000-000000000005'
  await db.exec(`insert into game_rooms values('${game}','${A}','${B}','${B}','lobby',now())`)
  await assert.rejects(act(db,C,'update game_rooms set guest_id=null where id=$1',[game]),/Invalid seat/)
  await db.exec(`delete from auth.users where id='${B}'`)
  assert.equal((await db.query(`select count(*) from profiles where id='${B}'`)).rows[0].count,0)
  const row=(await db.query('select * from game_rooms')).rows[0]
  assert.equal(row.guest_id,null);assert.equal(row.winner_id,null);assert.equal(row.host_id,A)
 }finally{await db.close()}
})
