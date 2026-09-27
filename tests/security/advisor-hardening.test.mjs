import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,as,A,B} from './fixture.mjs'

const migration=await readFile('supabase/migrations/20260927193905_release_advisor_hardening.sql','utf8')

test('public helper surface validates handles and play counts require a rate-limited active session',async()=>{
 const db=await securityFixture()
 try{
  await db.exec(`
   update profiles set username='member' where id='${B}';
   create table demo_tracks(id uuid primary key,user_id uuid,plays integer not null default 0);
   insert into demo_tracks(id,user_id) values('${B}','${B}');
   create function username_available(text) returns boolean language sql security definer as $$select true$$;
   create function bump_plays(uuid) returns void language sql security definer as $$select null::void$$;
   grant execute on function username_available(text),bump_plays(uuid) to anon,authenticated;
  `)
  await db.exec(migration)
  assert.equal((await as(db,'anon',undefined,'aal1',"select username_available('member') ok")).rows[0].ok,false)
  assert.equal((await as(db,'anon',undefined,'aal1',"select username_available('free.name') ok")).rows[0].ok,true)
  assert.equal((await as(db,'anon',undefined,'aal1',"select username_available('INVALID!') ok")).rows[0].ok,false)
  await assert.rejects(as(db,'anon',undefined,'aal1',`select bump_plays('${B}')`),/permission denied/)
  await act(db,A,'select bump_plays($1)',[B])
  assert.equal((await db.query('select plays from demo_tracks where id=$1',[B])).rows[0].plays,1)
 }finally{await db.close()}
})
