import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,A,B,C} from './fixture.mjs'
const room='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001'
test('legacy public attachments become private; only owner-backed conversation references authorize signed reads',async()=>{
 const db=await securityFixture()
 try{
  await db.exec(`insert into conversations(id) values('${room}');insert into conversation_members(conversation_id,user_id) values('${room}','${A}'),('${room}','${B}');
   insert into messages(id,conversation_id,sender_id,content,attachment_url) values('${id}','${room}','${A}','old','https://svhjgiloekkjrcefclqs.supabase.co/storage/v1/object/public/attachments/${A}/old%20file.wav');
   insert into storage.objects values('attachments','${A}/old file.wav');insert into storage.buckets(id,public) values('attachments',true),('avatars',true);
   create function delete_my_account() returns void language sql security definer as $$delete from auth.users where id=auth.uid()$$;`)
  for(const file of ['20260923190630_security_live_permissions','20260923194549_security_encrypted_chat','20260923200122_security_membership_and_sessions','20260923200855_security_history_upgrade','20260923201050_security_erasure_queue','20260923201942_security_legacy_storage'])await db.exec(await readFile('supabase/migrations/'+file+'.sql','utf8'))
  assert.equal((await db.query("select public from storage.buckets where id='attachments'")).rows[0].public,false)
  const path=A+'/old file.wav'
  assert.equal((await act(db,B,'select can_read_legacy_attachment($1) allowed',[path])).rows[0].allowed,true)
  assert.equal((await act(db,C,'select can_read_legacy_attachment($1) allowed',[path])).rows[0].allowed,false)
  await act(db,B,'delete from conversation_members where conversation_id=$1 and user_id=$2',[room,B])
  assert.equal((await act(db,B,'select can_read_legacy_attachment($1) allowed',[path])).rows[0].allowed,false)
  await db.exec(`delete from messages where id='${id}'`)
  const job=(await db.query('select * from private.storage_erasure_jobs')).rows[0]
  assert.equal(job.name,path);assert.equal(job.bucket,'attachments')
 }finally{await db.close()}
})
