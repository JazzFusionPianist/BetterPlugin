import {test} from 'node:test'
import assert from 'node:assert/strict'
import {act,as,A,B,C} from './fixture.mjs'
import {outboxFixture,room,id,pub} from './outbox-fixture.mjs'
import {sealMessage} from '../../packages/core/lib/chatCrypto.ts'

test('cancellation wins: delayed delivery, legacy direct writes and repeated requests cannot resurrect a message',async()=>{
  const {db,queue,message,deliver,cancel}=await outboxFixture()
  try{
    await queue();const row=await message()
    assert.equal(await cancel(),'cancelled')
    assert.equal(await deliver([row]),'cancelled')
    assert.equal(await cancel(),'cancelled')
    assert.equal((await db.query('select count(*)::int n from messages')).rows[0].n,0)
    await assert.rejects(act(db,A,'insert into messages(id,conversation_id,sender_id,content,encrypted_payload) values($1,$2,$3,$4,$5)',[id,room,A,row.content,row.encrypted_payload]),/atomic delivery/)
    await assert.rejects(act(db,A,'delete from chat_pending_sends where id=$1',[id]),/permission denied/)
    await assert.rejects(act(db,A,"update chat_pending_sends set state='waiting' where id=$1",[id]),/permission denied/)
    const receipt=(await act(db,A,'select * from chat_pending_sends where id=$1',[id])).rows[0]
    assert.equal(receipt.envelope,null);assert.equal(receipt.state,'cancelled')
    await assert.rejects(queue(),/duplicate key/)
  }finally{await db.close()}
})

test('delivery wins: receipt and message commit together, retries and late cancellation report delivered',async()=>{
  const {db,queue,message,deliver,cancel}=await outboxFixture()
  try{
    await queue()
    assert.equal(await deliver([await message()]),'delivered')
    assert.equal(await deliver([await message()]),'delivered')
    assert.equal(await cancel(),'delivered')
    const rows=(await act(db,B,'select * from messages')).rows
    assert.equal(rows.length,1);assert.equal(JSON.stringify(rows).includes('private message'),false)
    assert.equal((await db.query('select envelope from chat_pending_sends')).rows[0].envelope,null)
  }finally{await db.close()}
})

test('a bad second stem rolls back the first stem, its references and delivery receipt',async()=>{
  const {db,a,b,queue,deliver}=await outboxFixture()
  try{
    const ids=[id,C],keys=ids.map((_,i)=>`private/${A}/${i}.bin`)
    for(const key of keys)await db.query("insert into secure_files(object_key,owner_id,storage,status,size,mime,name) values($1,$2,'private','ready',20,'application/octet-stream','encrypted-attachment')",[key,A])
    await queue({kind:'stems',itemIds:ids,keys})
    const rows=await Promise.all(ids.map(async(id,i)=>({id,conversation_id:room,uploader_id:A,file_key:keys[i],file_size:20,file_url:'orb-encrypted:',file_name:'Encrypted file',
      encrypted_payload:await sealMessage(a,id,room,{file_name:`private-${i}.wav`,timeline_metadata:{samples:i*96000}},[pub(a),pub(b)])})))
    const bad=structuredClone(rows);bad[1].encrypted_payload.sender=B
    await assert.rejects(deliver(bad),/Encrypted messages required/)
    assert.equal((await db.query('select count(*)::int n from conversation_stems')).rows[0].n,0)
    assert.equal((await db.query('select state from chat_pending_sends')).rows[0].state,'waiting')
    assert.equal((await db.query('select count(*)::int n from private.file_references where pending_id=$1',[id])).rows[0].n,2)
    assert.equal(await deliver(rows),'delivered')
    assert.equal((await db.query('select count(*)::int n from conversation_stems')).rows[0].n,2)
    assert.equal((await db.query('select count(*)::int n from private.file_references where pending_id is not null')).rows[0].n,0)
    for(const key of keys)assert.equal((await act(db,B,'select file_access($1) f',[key])).rows[0].f.object_key,key)
  }finally{await db.close()}
})

test('membership is checked under the server lock and cancellation works after leaving',async()=>{
  const {db,queue,message,deliver,cancel}=await outboxFixture()
  try{
    await queue();const rows=[await message()]
    await db.exec(`insert into conversation_members(conversation_id,user_id) values('${room}','${C}')`)
    assert.equal(await deliver(rows),'blocked')
    assert.equal((await db.query('select reason from chat_pending_sends')).rows[0].reason,'membership_changed')
    await db.exec(`delete from conversation_members where user_id='${A}'`)
    assert.equal(await cancel(),'cancelled')
    assert.equal((await db.query('select count(*)::int n from messages')).rows[0].n,0)
  }finally{await db.close()}
})

test('expiry releases retained files, preserves owner draft and cannot be bypassed by a stale client',async()=>{
  const {db,queue,message,deliver,cancel}=await outboxFixture()
  try{
    const key=`private/${A}/expired.bin`
    await db.query("insert into secure_files(object_key,owner_id,storage,status,size,mime,name) values($1,$2,'private','ready',20,'application/octet-stream','encrypted-attachment')",[key,A])
    await queue({keys:[key]})
    await db.exec("update chat_pending_sends set expires_at=now()-interval '1 second'")
    assert.equal(await deliver([await message()]),'expired')
    await act(db,A,'select expire_private_chat()')
    assert.equal((await db.query('select count(*)::int n from private.file_references where pending_id is not null')).rows[0].n,0)
    assert.ok((await act(db,A,'select envelope from chat_pending_sends')).rows[0].envelope)
    await assert.rejects(act(db,B,'select file_access($1)',[key]),/Access denied/)
    assert.equal(await cancel(),'cancelled')
  }finally{await db.close()}
})

test('RPCs reject cross-account access, plaintext, mismatched IDs, anonymous and revoked sessions',async()=>{
  const {db,queue,message,deliver,cancel}=await outboxFixture()
  try{
    await queue();const rows=[await message()]
    await assert.rejects(cancel(B),/Access denied/)
    await assert.rejects(deliver(rows,{user:B}),/Access denied/)
    await assert.rejects(act(db,B,'select note_private_chat($1,$2)',[id,'retry']),/Access denied/)
    await assert.rejects(act(db,A,'select note_private_chat($1,$2)',[id,'anything']),/Invalid delivery status/)
    await assert.rejects(deliver([{...rows[0],content:'plain leak'}]),/Encrypted delivery required/)
    await assert.rejects(deliver([{...rows[0],id:C}]),/Invalid delivery items/)
    await assert.rejects(as(db,'anon',undefined,'aal1',`select cancel_private_chat('${id}')`),/permission denied/)
    await assert.rejects(act(db,A,'select private.finish_pending_chat($1,$2)',[id,'delivered']),/permission denied/)
    await db.exec(`delete from auth.sessions where user_id='${A}'`)
    await assert.rejects(cancel(),/Session revoked/)
    await assert.rejects(deliver(rows),/Session revoked/)
  }finally{await db.close()}
})
