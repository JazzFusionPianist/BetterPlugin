import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,as,A,B,C} from './fixture.mjs'
import {b64,createRecoveryCode,deriveIdentity,sealMessage,openMessage} from '../../packages/core/lib/chatCrypto.ts'
import {createLinkKey,deviceLinkCode,approveDeviceLink,wrapPasskeyVault} from '../../packages/core/lib/chatDeviceTransfer.ts'

const room='10000000-0000-4000-8000-000000000001'
const id='20000000-0000-4000-8000-000000000001'
const pub=k=>({user_id:k.user_id,box_key:k.box_key,sign_key:k.sign_key})
async function setup(){
  const db=await securityFixture()
  for(const file of ['20260927184452_security_encrypted_chat.sql','20260927184456_security_membership_and_sessions.sql',
    '20260927184459_security_history_upgrade.sql','20261002193130_account_based_chat.sql','20261003033724_automatic_private_chat.sql'])
    await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'))
  await db.exec(`insert into conversations(id) values('${room}');insert into conversation_members(conversation_id,user_id) values('${room}','${A}'),('${room}','${B}');`)
  const master=await createRecoveryCode(),a=await deriveIdentity(A,master),b=await deriveIdentity(B,await createRecoveryCode())
  for(const k of [a,b])await act(db,k.user_id,'select register_chat_key($1,$2)',[k.box_key,k.sign_key])
  return {db,a,b,master}
}
const pending=(db,user,e,keys=[])=>act(db,user,'insert into chat_pending_sends(id,conversation_id,user_id,envelope,attachment_keys) values($1,$2,$3,$4,$5)',[e.id,room,user,e,keys])

test('additive rollout remains off, cutover rejects plaintext but does not rewrite old history',async()=>{
  const {db,a,b}=await setup()
  try{
    assert.equal((await act(db,A,'select chat_security_mode() m')).rows[0].m,0)
    await act(db,A,'insert into messages(id,conversation_id,sender_id,content) values($1,$2,$3,$4)',[id,room,A,'old history'])
    await db.exec('update private.chat_rollout set enabled=true')
    assert.equal((await act(db,A,'select chat_security_mode() m')).rows[0].m,1)
    await assert.rejects(act(db,A,'insert into messages(id,conversation_id,sender_id,content) values($1,$2,$3,$4)',[C,room,A,'must not leak']),/update Slur/)
    await assert.rejects(act(db,A,"insert into conversation_stems(id,conversation_id,uploader_id,file_url,file_name) values($1,$2,$3,'orb-file:private/leak','private.wav')",[C,room,A]),/update Slur/)
    assert.equal((await act(db,B,'select content from messages where id=$1',[id])).rows[0].content,'old history')
    const e=await sealMessage(a,C,room,{content:'new secret',attachment_url:'orb-file:private/audio#e2ee=SECRET'},[pub(a),pub(b)])
    await act(db,A,'insert into messages(id,conversation_id,sender_id,content,encrypted_payload) values($1,$2,$3,$4,$5)',[C,room,A,'\u{1f512} Encrypted message',e])
    const row=(await db.query('select * from messages where id=$1',[C])).rows[0]
    assert.equal(JSON.stringify(row).includes('new secret'),false)
    assert.equal(JSON.stringify(row).includes('SECRET'),false)
    assert.equal((await openMessage(b,row,row.encrypted_payload)).content,'new secret')
    await assert.rejects(act(db,A,'update private.chat_rollout set enabled=false'),/permission denied/)
    await assert.rejects(as(db,'anon',undefined,'aal1','select chat_security_mode()'),/permission denied/)
  }finally{await db.close()}
})

test('device links and passkey vaults are owner-only, immutable, expiring, and session-revocation aware',async()=>{
  const {db,a,master}=await setup()
  try{
    const keys=await createLinkKey()
    const link=(await act(db,A,'insert into chat_device_links(id,public_key,expires_at) values($1,$2,$3) returning *',[id,b64(keys.publicKey),'2099-01-01'])).rows[0]
    assert.ok(Date.parse(link.expires_at)<Date.now()+301000)
    assert.equal((await act(db,B,'select * from chat_device_links')).rows.length,0)
    await assert.rejects(act(db,B,'insert into chat_device_links(id,user_id,public_key) values($1,$2,$3)',[C,A,b64(keys.publicKey)]),/row-level security/)
    await assert.rejects(act(db,A,'update chat_device_links set public_key=$1 where id=$2',[a.box_key,id]),/permission denied/)
    const response=await approveDeviceLink(link,await deviceLinkCode(link),master,pub(a))
    await act(db,A,'update chat_device_links set response=$1 where id=$2',[response,id])
    await assert.rejects(act(db,A,'update chat_device_links set response=$1 where id=$2',[response,id]),/Invalid connection response/)
    const random=()=>crypto.getRandomValues(new Uint8Array(32))
    const vault=await wrapPasskeyVault(master,pub(a),b64(random()),'slur.example',random(),random())
    await act(db,A,'insert into chat_passkey_vaults(credential_id,vault) values($1,$2)',[vault.credentialId,vault])
    assert.equal((await act(db,B,'select * from chat_passkey_vaults')).rows.length,0)
    assert.equal(JSON.stringify((await db.query('select vault from chat_passkey_vaults')).rows).includes(master),false)
    await assert.rejects(act(db,A,'insert into chat_passkey_vaults(credential_id,vault) values($1,$2)',[b64(random()),{...vault,ciphertext:null}]),/Invalid device backup/)
    await db.exec(`delete from auth.sessions where user_id='${A}'`)
    for(const table of ['chat_device_links','chat_passkey_vaults','chat_pending_sends'])assert.equal((await act(db,A,`select * from ${table}`)).rows.length,0)
    await assert.rejects(act(db,A,'select chat_security_mode()'),/Session revoked/)
  }finally{await db.close()}
})

test('encrypted outbox is not readable by recipient; audio is retained without early recipient access',async()=>{
  const {db,a,b}=await setup()
  try{
    const key=`private/${A}/queued.bin`
    await db.query("insert into secure_files(object_key,owner_id,storage,status,size,mime,name) values($1,$2,'private','ready',10,'application/octet-stream','encrypted-attachment')",[key,A])
    const e=await sealMessage(a,id,room,{kind:'message',content:'pending secret',url:`orb-file:${key}#e2ee=PRIVATE`},[pub(a)])
    await pending(db,A,e,[key])
    assert.equal((await act(db,B,'select * from chat_pending_sends')).rows.length,0)
    assert.equal((await act(db,C,'select * from chat_pending_sends')).rows.length,0)
    assert.equal(JSON.stringify((await db.query('select * from chat_pending_sends')).rows).includes('pending secret'),false)
    await assert.rejects(openMessage(b,{id,conversation_id:room,sender_id:A},e))
    await assert.rejects(act(db,B,'select file_access($1)',[key]),/Access denied/)
    await assert.rejects(act(db,B,"insert into messages(id,conversation_id,sender_id,content,attachment_keys,attachment_url,attachment_type,attachment_name) values($1,$2,$3,'',$4,$5,'audio','steal.wav')",[C,room,B,[key],`orb-file:${key}#e2ee=${'A'.repeat(43)}`]),/Invalid file reference/)
    assert.equal((await db.query('select count(*)::int n from private.file_references where pending_id=$1',[id])).rows[0].n,1)
    const sent=await sealMessage(a,id,room,{content:'delivered'},[pub(a),pub(b)])
    await act(db,A,'insert into messages(id,conversation_id,sender_id,content,attachment_keys,encrypted_payload) values($1,$2,$3,$4,$5,$6)',[id,room,A,'\u{1f512} Encrypted message',[key],sent])
    await act(db,A,'delete from chat_pending_sends where id=$1',[id])
    assert.equal((await act(db,B,'select file_access($1) f',[key])).rows[0].f.object_key,key)
    assert.equal((await db.query('select count(*)::int n from private.file_references where object_key=$1',[key])).rows[0].n,1)
  }finally{await db.close()}
})

test('pending envelope validates owner, membership and complete fields instead of accepting NULLs',async()=>{
  const {db,a,b}=await setup()
  try{
    const e=await sealMessage(a,id,room,{content:'queued'},[pub(a)])
    for(const field of ['body','nonce','signature']){
      const missing={...e};delete missing[field]
      await assert.rejects(pending(db,A,missing),/Invalid pending/)
      await assert.rejects(pending(db,A,{...e,[field]:null}),/Invalid pending/)
    }
    await assert.rejects(pending(db,A,await sealMessage(a,id,room,{},[pub(a),pub(b)])),/Invalid pending recipients/)
    await assert.rejects(pending(db,B,e),/Invalid pending message/)
    await db.exec(`delete from conversation_members where user_id='${A}'`)
    await assert.rejects(pending(db,A,e),/row-level security/)
  }finally{await db.close()}
})
