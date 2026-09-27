import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {fixture,act,A,B,C} from './fixture.mjs'

test('avatar cutover rejects cross-user writes and preserves current group-admin uploads',async()=>{
 const db=await fixture()
 const room='10000000-0000-4000-8000-000000000001'
 try {
  await db.exec(`create schema storage;
   create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
   create table storage.buckets(id text,file_size_limit bigint,allowed_mime_types text[]);
   insert into storage.buckets(id) values('avatars');
   create table conversation_members(conversation_id uuid,user_id uuid,role text);
   insert into conversation_members values('${room}','${A}','admin'),('${room}','${B}','member');
   alter table conversation_members enable row level security;
   create policy own_membership on conversation_members for select to authenticated using(user_id=auth.uid());
   grant select on conversation_members to authenticated;
   grant usage on schema storage to authenticated,anon;
   grant all on storage.objects to authenticated,anon;
   alter table storage.objects enable row level security;
   create policy "Anyone can view avatars" on storage.objects for select using(bucket_id='avatars');
   create policy "Users can upload own avatar" on storage.objects for insert to authenticated with check(bucket_id='avatars');
   create policy "Users can update own avatar" on storage.objects for update to authenticated using(bucket_id='avatars');`)
  await db.exec(await readFile('supabase/migrations/20260927181510_security_avatar_ownership.sql','utf8'))
  await act(db,A,"insert into storage.objects values('avatars',$1)",[A+'/avatar.png'])
  await assert.rejects(act(db,B,"insert into storage.objects values('avatars',$1)",[A+'/forged.png']),/row-level security/)
  assert.equal((await act(db,B,"update storage.objects set name=$1 where name=$2 returning *",[B+'/stolen.png',A+'/avatar.png'])).rows.length,0)
  await assert.rejects(act(db,A,"update storage.objects set name=$1 where name=$2",[B+'/stolen.png',A+'/avatar.png']),/row-level security/)
  assert.equal((await act(db,B,"delete from storage.objects where name=$1 returning *",[A+'/avatar.png'])).rows.length,0)
  await act(db,A,"insert into storage.objects values('avatars',$1)",['groups/'+room+'/photo.png'])
  for(const id of [B,C])await assert.rejects(act(db,id,"insert into storage.objects values('avatars',$1)",['groups/'+room+'/'+id+'.png']),/row-level security/)
  await db.query('delete from conversation_members where user_id=$1',[A])
  assert.equal((await act(db,A,"delete from storage.objects where name=$1 returning *",['groups/'+room+'/photo.png'])).rows.length,0)
  await assert.rejects(act(db,A,"insert into storage.objects values('avatars',$1)",['groups/'+room+'/new.png']),/row-level security/)
 }finally{await db.close()}
})
