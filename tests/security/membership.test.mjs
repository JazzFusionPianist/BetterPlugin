import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,A,B,C} from './fixture.mjs'
test('atomic conversations deny former creators, role escalation and revoked sessions; game chats require seats',async()=>{
 const db=await securityFixture()
 try{
  await db.exec(`
   alter table conversations enable row level security;alter table conversation_members enable row level security;
   create policy cm_select on conversation_members for select to authenticated using(is_conversation_member(conversation_id));
   create table game_rooms(id uuid primary key,host_id uuid,guest_id uuid,status text,board text,updated_at timestamptz);
   create table game_chats(id uuid primary key default gen_random_uuid(),room_id uuid,sender_id uuid,content text);
   alter table game_chats enable row level security;grant all on game_chats,game_rooms to authenticated;
  `)
  await db.exec(await readFile('supabase/migrations/20260927184448_security_live_permissions.sql','utf8'))
  await db.exec(await readFile('supabase/migrations/20260927184452_security_encrypted_chat.sql','utf8'))
  await db.exec(await readFile('supabase/migrations/20260927184456_security_membership_and_sessions.sql','utf8'))
  const created=await act(db,A,`select create_secure_conversation('group',$1,'Private room') id`,[[B]])
  const room=created.rows[0].id
  assert.equal((await act(db,A,'select * from conversation_members where conversation_id=$1',[room])).rows.length,2)
  await assert.rejects(act(db,B,`insert into conversation_members values($1,$2,'admin')`,[room,C]),/row-level security/)
  await act(db,A,'delete from conversation_members where conversation_id=$1 and user_id=$2',[room,A])
  assert.equal((await act(db,A,'select * from conversations where id=$1',[room])).rows.length,0)
  await assert.rejects(act(db,A,`insert into conversation_members values($1,$2,'admin')`,[room,A]),/row-level security/)
  assert.equal((await act(db,A,"update conversations set title='taken over' where id=$1 returning id",[room])).rows.length,0)
  const dm=(await act(db,B,`select create_secure_conversation('dm',$1) id`,[[C]])).rows[0].id
  assert.equal((await act(db,C,`select create_secure_conversation('dm',$1) id`,[[B]])).rows[0].id,dm)
  const game='30000000-0000-4000-8000-000000000001'
  await db.exec(`insert into game_rooms values('${game}','${A}',null,'lobby','initial',now())`)
  await act(db,A,'insert into game_chats(room_id,sender_id,content) values($1,$2,$3)',[game,A,'room secret'])
  assert.equal((await act(db,C,'select * from game_chats')).rows.length,0)
  await assert.rejects(act(db,C,"update game_rooms set board='corrupt' where id=$1",[game]),/Invalid seat/)
  await act(db,B,'update game_rooms set guest_id=$1 where id=$2',[B,game])
  assert.equal((await act(db,B,'select * from game_chats')).rows.length,1)
  await assert.rejects(act(db,C,'update game_rooms set guest_id=$1 where id=$2',[C,game]),/Invalid seat/)
  await db.exec(`delete from auth.sessions where user_id='${B}'`)
  assert.equal((await act(db,B,'select * from game_chats')).rows.length,0)
  await assert.rejects(act(db,B,`select create_secure_conversation('dm',$1)`,[[A]]),/Session revoked/)
 }finally{await db.close()}
})
