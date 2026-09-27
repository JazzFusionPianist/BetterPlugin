import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fixture, as, A, B, C } from './fixture.mjs'
const migration=await readFile(new URL('../../supabase/migrations/20260927184436_security_files_and_access.sql',import.meta.url),'utf8')
const ROOM='10000000-0000-4000-8000-000000000001'
const OTHER='10000000-0000-4000-8000-000000000002'
test('file authorization, forged references, quotas, revoked sessions and durable cleanup',async()=>{
  const db=await fixture()
  try {
    await db.exec(`
      create table conversations(id uuid primary key);
      create table conversation_members(conversation_id uuid,user_id uuid);
      create table messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references conversations(id),sender_id uuid,attachment_keys text[]);
      create table conversation_stems(id uuid primary key default gen_random_uuid(),conversation_id uuid references conversations(id),uploader_id uuid,file_key text);
      create function is_conversation_member(cid uuid) returns boolean language sql security definer set search_path=public as $$ select exists(select 1 from conversation_members where conversation_id=cid and user_id=auth.uid()); $$;
      alter table messages enable row level security;
      create policy mi on messages for insert to authenticated with check(sender_id=auth.uid() and is_conversation_member(conversation_id));
      create policy ms on messages for select to authenticated using(is_conversation_member(conversation_id));
      create policy md on messages for delete to authenticated using(sender_id=auth.uid());
      grant all on messages,conversation_stems,conversations to authenticated,anon;
      create schema storage;
      create table storage.objects(bucket_id text,name text);
      create table storage.buckets(id text,file_size_limit bigint,allowed_mime_types text[]);
      insert into storage.buckets(id) values('avatars');
      insert into conversations values('${ROOM}'),('${OTHER}');
      insert into conversation_members values('${ROOM}','${A}'),('${ROOM}','${B}'),('${OTHER}','${C}');
    `)
    await db.exec(migration)
    await assert.rejects(as(db,'anon',undefined,'aal1',"select reserve_file('wav','audio/wav',100,'x',false)"),/permission denied/)
    const reservation=(await as(db,'authenticated',A,'aal1',"select reserve_file('wav','audio/wav',100,'x',false) as f")).rows[0].f
    assert.ok(reservation.object_key.startsWith(`private/${A}/`))
    await assert.rejects(as(db,'authenticated',A,'aal1',"select reserve_file('html','text/html',100,'x',true)"),/Invalid upload/)
    await assert.rejects(as(db,'authenticated',A,'aal1',"select reserve_file('wav','audio/wav',1073741825,'x',false)"),/Invalid upload/)
    const key=`private/${A}/example.wav`
    await db.exec(`insert into secure_files(object_key,owner_id,storage,status,size,mime,name) values('${key}','${A}','private','ready',100,'audio/wav','attachment');`)
    await assert.rejects(as(db,'authenticated',C,'aal1',`select file_access('${key}')`),/Access denied/)
    await assert.rejects(as(db,'authenticated',C,'aal1',`insert into messages(conversation_id,sender_id,attachment_keys) values('${OTHER}','${C}',array['${key}'])`),/Invalid file reference/)
    await db.exec(`select set_config('request.jwt.claims','{"role":"authenticated","sub":"${A}"}',false); insert into messages(id,conversation_id,sender_id,attachment_keys) values('${A}','${ROOM}','${A}',array['${key}']); select set_config('request.jwt.claims','{}',false);`)
    assert.equal((await as(db,'authenticated',B,'aal1',`select file_access('${key}') as f`)).rows[0].f.size,100)
    await as(db,'authenticated',B,'aal1',`insert into messages(conversation_id,sender_id,attachment_keys) values('${ROOM}','${B}',array['${key}'])`)
    await db.exec(`delete from conversation_members where user_id='${B}';`)
    await assert.rejects(as(db,'authenticated',B,'aal1',`select file_access('${key}')`),/Access denied/)
    await assert.rejects(as(db,'authenticated',A,'aal1',`select finalize_file('${key}',100,'audio/wav')`),/permission denied/)
    await db.exec(`delete from messages; update private.file_delete_jobs set available_at=now()-interval '1 hour';`)
    assert.equal((await db.query('select * from claim_file_deletions()')).rows.length,1)
    await db.query('select finish_file_deletion($1,false)',[key])
    assert.equal((await db.query('select status from secure_files')).rows[0].status,'deleting')
    await db.query('select finish_file_deletion($1,true)',[key])
    assert.equal((await db.query('select status from secure_files')).rows[0].status,'deleted')
    await db.exec(`delete from auth.sessions where user_id='${A}'`)
    await assert.rejects(as(db,'authenticated',A,'aal1','select security_check_session()'),/Session revoked/)
  } finally {await db.close()}
})
