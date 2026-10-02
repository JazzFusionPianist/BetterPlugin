import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,as,A,B,C} from './fixture.mjs'
import {deriveIdentity,createRecoveryCode,sealMessage,openMessage} from '../../packages/core/lib/chatCrypto.ts'
const room='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001'
test('legacy author upgrades once, plaintext columns disappear; erasure queue survives user deletion and retries',async()=>{
 const db=await securityFixture()
 try{
  await db.exec(`insert into conversations(id) values('${room}');insert into conversation_members(conversation_id,user_id) values('${room}','${A}'),('${room}','${B}');insert into messages(id,conversation_id,sender_id,content) values('${id}','${room}','${A}','old plaintext');
    create function delete_my_account() returns void language sql security definer as $$delete from auth.users where id=auth.uid()$$;
    insert into storage.objects values('avatars','${C}/pic.png'),('avatars','${B}/keep.png');`)
  for(const file of ['20260923194549_security_encrypted_chat','20260923200855_security_history_upgrade','20260923201050_security_erasure_queue'])await db.exec(await readFile('supabase/migrations/'+file+'.sql','utf8'))
  const a=await deriveIdentity(A,await createRecoveryCode()),b=await deriveIdentity(B,await createRecoveryCode())
  for(const k of [a,b])await act(db,k.user_id,'select register_chat_key($1,$2)',[k.box_key,k.sign_key])
  const pub=k=>({user_id:k.user_id,box_key:k.box_key,sign_key:k.sign_key})
  const e=await sealMessage(a,id,room,{content:'old plaintext'},[pub(a),pub(b)])
  await assert.rejects(act(db,B,`select upgrade_encrypted_history('message',$1,$2)`,[id,e]),/Access denied/)
  await act(db,A,`select upgrade_encrypted_history('message',$1,$2)`,[id,e])
  const row=(await db.query('select * from messages where id=$1',[id])).rows[0]
  assert.equal(row.content,'🔒 Encrypted message');assert.equal(row.attachment_url,null)
  assert.equal((await openMessage(b,row,row.encrypted_payload)).content,'old plaintext')
  await assert.rejects(act(db,A,`select upgrade_encrypted_history('message',$1,$2)`,[id,e]),/Access denied/)
  await assert.rejects(as(db,'anon',undefined,'aal1',`select claim_storage_erasures()`),/permission denied/)
  await act(db,C,'select delete_my_account()')
  const jobs=(await db.query('select * from claim_storage_erasures()')).rows
  assert.equal(jobs.length,1);assert.equal(jobs[0].name,C+'/pic.png')
  assert.equal((await db.query('select * from claim_storage_erasures()')).rows.length,0)
  await db.query('select finish_storage_erasure($1,false)',[jobs[0].id])
  assert.equal((await db.query('select completed_at from private.storage_erasure_jobs')).rows[0].completed_at,null)
  await db.query('select finish_storage_erasure($1,true)',[jobs[0].id])
  assert.ok((await db.query('select completed_at from private.storage_erasure_jobs')).rows[0].completed_at)
 }finally{await db.close()}
})
