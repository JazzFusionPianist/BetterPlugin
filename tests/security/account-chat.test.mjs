import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,as,A,B,C} from './fixture.mjs'
import {accountMessage,sendAccountMessage,sendAccountStems} from '../../packages/core/lib/accountChat.ts'
import {decryptChatMessage,deriveIdentity,createRecoveryCode,sealMessage} from '../../packages/core/lib/chatCrypto.ts'
import {encryptFile,decryptFile} from '../../packages/core/lib/fileCrypto.ts'

const room='10000000-0000-4000-8000-000000000001'
const id='20000000-0000-4000-8000-000000000001'
const migration='supabase/migrations/20261002193130_account_based_chat.sql'
async function setup(){
  const db=await securityFixture()
  for(const file of ['20260927184452_security_encrypted_chat.sql','20260927184456_security_membership_and_sessions.sql','20260927184459_security_history_upgrade.sql'])
    await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'))
  await db.exec(await readFile(migration,'utf8'))
  await db.exec(`insert into conversations(id) values('${room}');insert into conversation_members(conversation_id,user_id) values('${room}','${A}'),('${room}','${B}');
    create policy ss on conversation_stems for select to authenticated using(is_conversation_member(conversation_id));`)
  return db
}
function insertMessage(db,user,row){
  return act(db,user,`insert into messages(id,conversation_id,sender_id,content,attachment_url,attachment_type,attachment_name,attachment_metadata,attachment_keys,encrypted_payload)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[row.id,row.conversation_id,row.sender_id,row.content,row.attachment_url,row.attachment_type,row.attachment_name,row.attachment_metadata,row.attachment_keys,row.encrypted_payload])
}

test('accounts with no device keys exchange chat and read it after a new login',async()=>{
  const db=await setup()
  try{
    assert.equal((await db.query('select count(*)::int n from chat_identity_keys')).rows[0].n,0)
    await insertMessage(db,A,accountMessage(id,A,room,' hello '))
    const read=await act(db,B,'select * from messages where id=$1',[id])
    assert.equal(read.rows[0].content,'hello')
    assert.equal(read.rows[0].encrypted_payload,null)
    const noKeys={rpc:()=>{throw new Error('Must not fetch participant keys')}}
    assert.equal((await decryptChatMessage(noKeys,B,read.rows[0])).content,'hello')
    assert.equal((await act(db,B,'select content from messages where id=$1',[id])).rows[0].content,'hello')
    assert.equal((await act(db,C,'select * from messages')).rows.length,0)
    await assert.rejects(insertMessage(db,C,accountMessage(C,C,room,'intruder')),/Access denied/)
    await assert.rejects(insertMessage(db,A,accountMessage(C,B,room,'forged')),/Access denied/)
    await db.exec(`delete from auth.sessions where user_id='${B}'`)
    assert.equal((await act(db,B,'select * from messages')).rows.length,0)
    await assert.rejects(insertMessage(db,B,accountMessage(B,B,room,'revoked')),/Session revoked/)
  }finally{await db.close()}
})

test('account send path uses no identity, enrollment, rollout lookup or encrypted outbox',async()=>{
 const writes=[]
 const client={auth:{getSession:async()=>({data:{session:{user:{id:A}}}})},
   rpc:()=>{throw new Error('No key or rollout RPC is needed')},
   from:table=>({insert:async data=>{writes.push({table,data});return {error:null}}})}
 await sendAccountMessage(client,A,id,room,' normal message ')
 const stems=[id,B].map((id,i)=>({id,conversation_id:room,uploader_id:A,file_key:`private/${A}/${i}.wav`,file_url:`orb-file:private/${A}/${i}.wav`,file_name:`region ${i}.wav`,mime_type:'audio/wav',timeline_metadata:{samples:i*48000,track:`track ${i}`}}))
 await sendAccountStems(client,A,stems)
 assert.deepEqual(writes.map(w=>w.table),['messages','conversation_stems'])
 assert.equal(writes[0].data.content,'normal message');assert.equal(writes[0].data.encrypted_payload,null)
 assert.equal(writes[1].data.length,2)
 assert.deepEqual(writes[1].data.map(r=>r.timeline_metadata),stems.map(r=>r.timeline_metadata))
 assert.ok(writes[1].data.every(r=>r.encrypted_payload===null&&!r.file_url.includes('#e2ee=')))
 await assert.rejects(sendAccountMessage(client,B,id,room,'wrong account'),/Sign in/)
 await assert.rejects(sendAccountStems(client,A,[{...stems[0],uploader_id:B}]),/Invalid files/)
 assert.equal(writes.length,2)
})

test('unencrypted private audio remains member-only before and after sharing',async()=>{
 const db=await setup()
 try{
   const key=`private/${A}/plain.wav`,url=`orb-file:${key}`
   await db.query("insert into secure_files(object_key,owner_id,storage,status,size,mime,name) values($1,$2,'private','ready',16,'audio/wav','region.wav')",[key,A])
   await assert.rejects(act(db,B,'select file_access($1)',[key]),/Access denied/)
   await insertMessage(db,A,accountMessage(id,A,room,'',{url,type:'audio',name:'region.wav',metadata:{position:{samples:48000}}}))
   const row=(await act(db,B,'select * from messages where id=$1',[id])).rows[0]
   assert.equal(row.attachment_url,url);assert.equal(row.encrypted_payload,null)
   assert.equal(row.attachment_metadata.position.samples,48000)
   assert.equal((await act(db,B,'select file_access($1) f',[key])).rows[0].f.storage,'private')
   await assert.rejects(act(db,C,'select file_access($1)',[key]),/Access denied/)
 }finally{await db.close()}
})

test('private encrypted audio works on another device using only member-authorized record data',async()=>{
  const db=await setup()
  try{
    const original=new File(['test-audio'],'region.wav',{type:'audio/wav'})
    const encrypted=await encryptFile(original)
    const key=`private/${A}/region.bin`,url=`orb-file:${key}#e2ee=${encrypted.key}`
    await db.query(`insert into secure_files(object_key,owner_id,storage,status,size,mime,name) values($1,$2,'private','ready',$3,'application/octet-stream','encrypted-attachment')`,[key,A,encrypted.blob.size])
    const tracks=[{url,name:'region.wav',assetId:'asset',regionBundle:{tracks:[{id:'track',name:'Voice'}],regions:[{start:{samples:96000,sampleRate:48000}}]}}]
    await insertMessage(db,A,accountMessage(id,A,room,'',{url:JSON.stringify(tracks),type:'multi-audio',name:'1 region'}))
    const received=JSON.parse((await act(db,B,'select attachment_url from messages where id=$1',[id])).rows[0].attachment_url)
    assert.deepEqual(received,tracks)
    assert.equal((await act(db,B,'select file_access($1) f',[key])).rows[0].f.object_key,key)
    const secret=new URLSearchParams(received[0].url.split('#')[1]).get('e2ee')
    assert.equal(await (await decryptFile(encrypted.blob,secret)).text(),'test-audio')
    await act(db,A,`insert into conversation_stems(id,conversation_id,uploader_id,file_key,file_url,file_name,timeline_metadata) values($1,$2,$3,$4,$5,'region.wav',$6)`,[B,room,A,key,url,tracks[0].regionBundle])
    const stem=(await act(db,B,'select * from conversation_stems where id=$1',[B])).rows[0]
    assert.equal(stem.file_url,url)
    assert.deepEqual(stem.timeline_metadata,tracks[0].regionBundle)
    await assert.rejects(act(db,C,'select file_access($1)',[key]),/Access denied/)
    await db.exec(`delete from conversation_members where user_id='${B}'`)
    assert.equal((await act(db,B,'select * from conversation_stems')).rows.length,0)
    await assert.rejects(act(db,B,'select file_access($1)',[key]),/Access denied/)
  }finally{await db.close()}
})

test('account messaging still rejects foreign files, forged references and invalid payloads',async()=>{
  const db=await setup()
  try{
    const key=`private/${C}/foreign.bin`,url=`orb-file:${key}#e2ee=${'A'.repeat(43)}`
    await db.query(`insert into secure_files(object_key,owner_id,storage,status,size,mime,name) values($1,$2,'private','ready',10,'application/octet-stream','encrypted-attachment')`,[key,C])
    const row=accountMessage(id,A,room,'',{url,type:'audio',name:'audio.wav'})
    await assert.rejects(insertMessage(db,A,row),/Invalid file reference/)
    await assert.rejects(insertMessage(db,A,{...row,attachment_keys:null}),/Missing file reference/)
    await assert.rejects(insertMessage(db,A,{...row,attachment_url:'orb-file:a/../b'}),/Invalid private attachment/)
    await assert.rejects(insertMessage(db,A,{...row,attachment_url:'file:///tmp/private.wav'}),/Invalid attachment URL/)
    await assert.rejects(insertMessage(db,A,accountMessage(id,A,room,'')),/Empty message/)
    await assert.rejects(insertMessage(db,A,accountMessage(id,A,room,'x'.repeat(65537))),/Invalid message/)
    await assert.rejects(act(db,A,'select upgrade_encrypted_history($1,$2,$3,$4)',['message',id,{},[]]),/permission denied/)
    await assert.rejects(as(db,'anon',undefined,'aal1',`insert into messages(conversation_id,sender_id,content) values('${room}','${A}','forged')`),/permission denied|Access denied/)
    assert.equal((await db.query('select count(*)::int n from messages')).rows[0].n,0)
    assert.equal((await db.query('select count(*)::int n from private.file_references')).rows[0].n,0)
  }finally{await db.close()}
})

test('older encrypted writers keep strict validation and data is not rewritten',async()=>{
  const db=await setup()
  try{
    const a=await deriveIdentity(A,await createRecoveryCode()),b=await deriveIdentity(B,await createRecoveryCode())
    for(const k of [a,b])await act(db,k.user_id,'select register_chat_key($1,$2)',[k.box_key,k.sign_key])
    const pub=k=>({user_id:k.user_id,box_key:k.box_key,sign_key:k.sign_key})
    const envelope=await sealMessage(a,id,room,{content:'old message'},[pub(a),pub(b)])
    await insertMessage(db,A,{...accountMessage(id,A,room,'🔒 Encrypted message'),encrypted_payload:envelope})
    assert.deepEqual((await act(db,B,'select encrypted_payload from messages where id=$1',[id])).rows[0].encrypted_payload,envelope)
    await assert.rejects(insertMessage(db,A,{...accountMessage(C,A,room,'leaked'),encrypted_payload:{...envelope,id:C}}),/Encrypted messages required/)
  }finally{await db.close()}
})

test('game invitations do not depend on participant keys',async()=>{
  const row=accountMessage(id,A,room,'',{type:'game_invite',url:C,name:'chess'})
  assert.equal(row.attachment_keys,null)
  const db=await setup()
  try{await insertMessage(db,A,row);assert.equal((await act(db,B,'select attachment_url from messages where id=$1',[id])).rows[0].attachment_url,C)}
  finally{await db.close()}
})
