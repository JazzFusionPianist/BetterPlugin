import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {securityFixture,act,as,A,B,C} from './fixture.mjs'
import {attachmentStatus,withAttachmentRetention,expireAttachments} from '../../packages/core/lib/attachmentRetention.ts'
const migration='supabase/migrations/20261005195136_attachment_retention.sql'
const room='10000000-0000-4000-8000-000000000001',message='20000000-0000-4000-8000-000000000001'
const oldKey=`private/${A}/existing.wav`,path=`${A}/old.wav`
async function setup(){
  const db=await securityFixture()
  await db.exec(`insert into conversations(id) values('${room}');insert into conversation_members values('${room}','${A}','member'),('${room}','${B}','member');
    insert into secure_files(object_key,owner_id,storage,status,size,mime,name,created_at) values('${oldKey}','${A}','private','ready',20,'audio/wav','existing',now()-interval '1 year');
    insert into messages(id,conversation_id,sender_id,content,attachment_url) values('${message}','${room}','${A}','old','https://svhjgiloekkjrcefclqs.supabase.co/storage/v1/object/public/attachments/${path}');
    insert into storage.objects values('attachments','${path}');
    create function delete_my_account() returns void language sql security definer as $$delete from auth.users where id=auth.uid()$$;`)
  for(const file of ['20260927184452_security_encrypted_chat.sql','20260927184456_security_membership_and_sessions.sql','20260927184459_security_history_upgrade.sql',
    '20260927184503_security_erasure_queue.sql','20260927184507_security_legacy_storage.sql','20261002193130_account_based_chat.sql',
    '20261003033724_automatic_private_chat.sql','20261003112523_private_chat_outbox_lifecycle.sql','20261005152712_account_chat_default.sql'])
    await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'))
  await db.exec(await readFile(migration,'utf8'))
  return db
}
async function upload(db,user=A,publicFile=false){
  const file=(await act(db,user,'select reserve_file($1,$2,$3,$4,$5) f',['wav','audio/wav',20,'region.wav',publicFile])).rows[0].f
  await db.query('select finalize_file($1,20,$2)',[file.object_key,'audio/wav'])
  return file.object_key
}
async function share(db,key,id=crypto.randomUUID()){
  await act(db,A,'insert into messages(id,conversation_id,sender_id,content,attachment_keys,attachment_url,attachment_type,attachment_name) values($1,$2,$3,$4,$5,$6,$7,$8)',
    [id,room,A,'',[key],`orb-file:${key}`,'audio','region.wav'])
  return id
}
async function setPaidUntil(db,user,until){
  await db.exec('begin')
  try{
    await db.exec('set local role service_role')
    await db.query('select set_attachment_retention_entitlement($1,$2)',[user,until])
    await db.exec('commit')
  }catch(error){await db.exec('rollback');throw error}
}
test('upload deadlines are free seven days and paid three calendar months; clients cannot grant paid access',async()=>{
  const db=await setup()
  try{
    const free=await upload(db)
    assert.equal((await db.query("select retention_expires_at=created_at+interval '7 days' correct from secure_files where object_key=$1",[free])).rows[0].correct,true)
    await assert.rejects(act(db,A,'insert into private.attachment_retention_entitlements values($1,now()+$2::interval)',[A,'1 year']),/permission denied/)
    await assert.rejects(act(db,A,'select set_attachment_retention_entitlement($1,now()+interval \'1 month\')',[A]),/permission denied/)
    await assert.rejects(as(db,'anon',null,'aal1',`select set_attachment_retention_entitlement('${A}',now()+interval '1 month')`),/permission denied/)
    await setPaidUntil(db,A,new Date(Date.now()+86400000*30).toISOString())
    const paid=await upload(db)
    assert.equal((await db.query("select retention_expires_at=(((created_at at time zone 'UTC')+interval '3 months') at time zone 'UTC') correct from secure_files where object_key=$1",[paid])).rows[0].correct,true)
    assert.equal((await db.query("select private.attachment_retention_deadline($1,'2027-01-31 12:00:00+00') deadline",[B])).rows[0].deadline.toISOString(),'2027-02-07T12:00:00.000Z')
    await db.query("update private.attachment_retention_entitlements set paid_until='2028-01-01' where user_id=$1",[A])
    assert.equal((await db.query("select private.attachment_retention_deadline($1,'2027-01-31 12:00:00+00') deadline",[A])).rows[0].deadline.toISOString(),'2027-04-30T12:00:00.000Z')
    await db.query('update private.attachment_retention_entitlements set paid_until=now()-interval \'1 day\'')
    const after=await upload(db)
    assert.equal((await db.query("select retention_expires_at=created_at+interval '7 days' correct from secure_files where object_key=$1",[after])).rows[0].correct,true)
    assert.equal((await db.query("select retention_expires_at>created_at+interval '2 months' paid from secure_files where object_key=$1",[paid])).rows[0].paid,true)
    const publicKey=await upload(db,A,true)
    assert.equal((await db.query('select retention_expires_at from secure_files where object_key=$1',[publicKey])).rows[0].retention_expires_at,null)
    await setPaidUntil(db,A,null)
    assert.equal((await db.query('select count(*)::int n from private.attachment_retention_entitlements where user_id=$1',[A])).rows[0].n,0)
  }finally{await db.close()}
})
test('expired attachments deny owner/member download and re-sharing, and referenced bytes are deleted with retries',async()=>{
  const db=await setup()
  try{
    const key=await upload(db),id=await share(db,key)
    assert.equal((await act(db,B,'select file_access($1) f',[key])).rows[0].f.object_key,key)
    await db.query("update secure_files set retention_expires_at=now()-interval '1 second' where object_key=$1",[key])
    for(const user of [A,B])await assert.rejects(act(db,user,'select file_access($1)',[key]),/Attachment expired/)
    await assert.rejects(act(db,C,'select file_access($1)',[key]),/Access denied/)
    await assert.rejects(share(db,key),/Invalid file reference/)
    const jobs=(await db.query('select * from claim_file_deletions()')).rows
    assert.ok(jobs.some(j=>j.object_key===key))
    assert.equal((await db.query('select count(*)::int n from messages where id=$1',[id])).rows[0].n,1)
    await db.query('select finish_file_deletion($1,false)',[key])
    await db.query("update private.file_delete_jobs set available_at=now()-interval '1 second' where object_key=$1",[key])
    assert.ok((await db.query('select * from claim_file_deletions()')).rows.some(j=>j.object_key===key))
    await db.query('select finish_file_deletion($1,true)',[key])
    const status=(await act(db,B,'select conversation_attachment_status($1) result',[room])).rows[0].result.find(r=>r.key===key)
    assert.equal(status.expired,true)
    assert.equal((await db.query('select status from secure_files where object_key=$1',[key])).rows[0].status,'deleted')
    assert.ok(!(await db.query('select * from claim_file_deletions()')).rows.some(j=>j.object_key===key))
  }finally{await db.close()}
})
test('retention status is member/session scoped and migration grants existing files a grace period',async()=>{
  const db=await setup()
  try{
    assert.equal((await db.query("select retention_expires_at>now()+interval '6 days' grace from secure_files where object_key=$1",[oldKey])).rows[0].grace,true)
    assert.equal((await db.query("select retention_expires_at>now()+interval '6 days' grace from private.legacy_storage_refs where path=$1",[path])).rows[0].grace,true)
    await assert.rejects(act(db,C,'select conversation_attachment_status($1)',[room]),/Access denied/)
    await assert.rejects(as(db,'anon',null,'aal1',`select conversation_attachment_status('${room}')`),/permission denied/)
    await db.query('delete from auth.sessions where user_id=$1',[B])
    await assert.rejects(act(db,B,'select conversation_attachment_status($1)',[room]),/Session revoked/)
  }finally{await db.close()}
})
test('old storage attachments expire and enter the same physical deletion worker without deleting messages',async()=>{
  const db=await setup()
  try{
    assert.equal((await act(db,B,'select can_read_legacy_attachment($1) allowed',[path])).rows[0].allowed,true)
    await db.query("update private.legacy_storage_refs set retention_expires_at=now()-interval '1 second' where path=$1",[path])
    assert.equal((await act(db,B,'select can_read_legacy_attachment($1) allowed',[path])).rows[0].allowed,false)
    await assert.rejects(act(db,B,'select legacy_attachment_expiry($1)',[path]),/Attachment expired/)
    await assert.rejects(act(db,C,'select legacy_attachment_expiry($1)',[path]),/Access denied/)
    await assert.rejects(act(db,A,'select queue_expired_legacy_attachments()'),/permission denied/)
    await db.query('select queue_expired_legacy_attachments()')
    const jobs=(await db.query('select * from claim_storage_erasures()')).rows
    assert.ok(jobs.some(j=>j.bucket==='attachments'&&j.name===path))
    assert.equal((await db.query('select count(*)::int n from messages where id=$1',[message])).rows[0].n,1)
  }finally{await db.close()}
})
test('retention presentation handles exact deadlines, mixed bundles, unlimited files and game invites',()=>{
  const past=new Date(Date.now()-1000).toISOString(),future=new Date(Date.now()+86400000).toISOString()
  const statuses=[{key:'private/a.wav',expires_at:past,expired:false},{key:'private/b.wav',expires_at:future,expired:false},{key:'public/c.wav',expires_at:null,expired:false}]
  const m={attachment_url:'orb-file:private/a.wav',attachment_type:'audio'}
  assert.equal(withAttachmentRetention(m,statuses).attachment_expired,true)
  assert.equal(attachmentStatus(m.attachment_url,statuses).expired,true)
  const mixed=withAttachmentRetention({attachment_type:'multi-audio',attachment_url:JSON.stringify([{url:m.attachment_url},{url:'orb-file:private/b.wav'}])},statuses)
  assert.equal(mixed.attachment_expired,false);assert.equal(mixed.attachment_expires_at,future)
  assert.equal(expireAttachments([mixed],Date.parse(future))[0].attachment_expired,true)
  const unlimited=withAttachmentRetention({attachment_url:'orb-file:public/c.wav',attachment_type:'audio'},statuses)
  assert.equal(unlimited.attachment_expires_at,null);assert.equal(unlimited.attachment_expired,false)
  const invite={...m,attachment_type:'game_invite'}
  assert.equal(withAttachmentRetention(invite,statuses),invite)
})
