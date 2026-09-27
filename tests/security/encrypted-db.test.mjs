import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,as,A,B,C} from './fixture.mjs'
import {deriveIdentity,createRecoveryCode,sealMessage} from '../../packages/core/lib/chatCrypto.ts'
const room='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001'
const pub=k=>({user_id:k.user_id,box_key:k.box_key,sign_key:k.sign_key})
test('encrypted chat rejects plaintext, key replacement, stale membership and leaked metadata',async()=>{
 const db=await securityFixture()
 try{
  await db.exec(await readFile('supabase/migrations/20260927184452_security_encrypted_chat.sql','utf8'))
  await db.exec(`insert into conversations(id) values('${room}');insert into conversation_members(conversation_id,user_id) values('${room}','${A}'),('${room}','${B}')`)
  const a=await deriveIdentity(A,await createRecoveryCode()),b=await deriveIdentity(B,await createRecoveryCode())
  for(const k of [a,b])await act(db,k.user_id,'select register_chat_key($1,$2)',[k.box_key,k.sign_key])
  await assert.rejects(act(db,A,'select register_chat_key($1,$2)',[b.box_key,b.sign_key]),/Key mismatch/)
  await assert.rejects(as(db,'anon',undefined,'aal1','select my_chat_key()'),/permission denied/)
  await assert.rejects(act(db,C,'select conversation_chat_keys($1)',[room]),/Access denied/)
  await assert.rejects(act(db,A,'insert into messages(conversation_id,sender_id,content) values($1,$2,$3)',[room,A,'secret plaintext']),/Encrypted messages required/)
  const e=await sealMessage(a,id,room,{content:'secret'},[pub(a),pub(b)])
  await act(db,A,'insert into messages(id,conversation_id,sender_id,content,encrypted_payload) values($1,$2,$3,$4,$5)',[id,room,A,'🔒 Encrypted message',e])
  await assert.rejects(act(db,A,'insert into messages(id,conversation_id,sender_id,content,encrypted_payload,attachment_url) values($1,$2,$3,$4,$5,$6)',[C,room,A,'🔒 Encrypted message',{...e,id:C},'orb-file:key#e2ee=secret']),/Encrypted messages required/)
  await db.exec(`delete from conversation_members where user_id='${B}'`)
  await assert.rejects(act(db,A,'insert into messages(id,conversation_id,sender_id,content,encrypted_payload) values($1,$2,$3,$4,$5)',[C,room,A,'🔒 Encrypted message',{...e,id:C}]),/Participant keys changed/)
 }finally{await db.close()}
})
