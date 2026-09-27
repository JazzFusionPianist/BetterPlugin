create table private.request_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null, window_start timestamptz not null, requests int not null,
  primary key(user_id,action,window_start)
);
alter table private.request_windows enable row level security;
revoke all on private.request_windows from public, anon, authenticated;

create or replace function public.security_check_session()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and (banned_until is null or banned_until<now())) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  sid:=nullif(auth.jwt()->>'session_id','')::uuid;
  if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=uid) then
    raise exception 'Session revoked' using errcode='42501';
  end if;
  return jsonb_build_object('id',uid);
end;
$$;
revoke all on function public.security_check_session() from public,anon;
grant execute on function public.security_check_session() to authenticated;

create or replace function public.security_rate_limit(p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare cap int; used int;
begin
  perform public.security_check_session();
  cap:=case p_action when 'upload' then 30 when 'download' then 120 when 'delete' then 60
    when 'share' then 20 when 'live_join' then 10 when 'live_signal' then 180
    when 'live_chat' then 20 when 'live_manage' then 20 when 'unfurl' then 20
    when 'schedule' then 10 when 'keys' then 20 when 'message' then 60 when 'conversation' then 10 else null end;
  if cap is null then raise exception 'Invalid action' using errcode='22023'; end if;
  insert into private.request_windows values(auth.uid(),p_action,date_trunc('minute',now()),1)
    on conflict(user_id,action,window_start) do update set requests=private.request_windows.requests+1
    returning requests into used;
  if used>cap then raise exception 'Rate limit exceeded'; end if;
end;
$$;
revoke all on function public.security_rate_limit(text) from public,anon;
grant execute on function public.security_rate_limit(text) to authenticated;

create table public.secure_files (
  object_key text primary key check(length(object_key)<=512 and object_key !~ '\.\.' and object_key ~ '^[a-zA-Z0-9/_\.-]+$'),
  owner_id uuid references auth.users(id) on delete set null,
  storage text not null check(storage in ('private','public','legacy')),
  status text not null default 'pending' check(status in ('pending','ready','quarantined','deleting','deleted')),
  size bigint not null check(size between 0 and 1073741824),
  mime text not null, name text not null check(length(name)<=255),
  created_at timestamptz not null default now(), upload_expires_at timestamptz,
  verified_at timestamptz, owner_deleted_at timestamptz
);
alter table public.secure_files enable row level security;
revoke all on public.secure_files from public,anon,authenticated;
grant all on public.secure_files to service_role;
create index secure_files_owner on public.secure_files(owner_id,status);

-- Unknown legacy ownership is not evidence of an account deletion.
create function private.mark_deleted_file_owner() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.secure_files set owner_deleted_at=now() where owner_id=old.id;
  return old;
end;
$$;
revoke all on function private.mark_deleted_file_owner() from public,anon,authenticated;
create trigger mark_deleted_file_owner before delete on auth.users
for each row execute function private.mark_deleted_file_owner();

create table private.file_references (
  object_key text not null references public.secure_files(object_key),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  stem_id uuid references public.conversation_stems(id) on delete cascade,
  check((message_id is null)<>(stem_id is null))
);
create unique index file_message_reference on private.file_references(object_key,message_id) where message_id is not null;
create unique index file_stem_reference on private.file_references(object_key,stem_id) where stem_id is not null;
create index file_reference_conversation on private.file_references(conversation_id);
alter table private.file_references enable row level security;
revoke all on private.file_references from public,anon,authenticated;

create table private.file_delete_jobs (
  object_key text primary key references public.secure_files(object_key),
  storage text not null,
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz, completed_at timestamptz
);
alter table private.file_delete_jobs enable row level security;
revoke all on private.file_delete_jobs from public,anon,authenticated;
grant all on private.file_delete_jobs to service_role;

-- Baseline existing referenced R2 objects. Derive owner from the minted key,
-- never from whichever user happened to paste it into a message.
with keys as (
  select unnest(attachment_keys) k from public.messages
  union select file_key from public.conversation_stems where file_key is not null
), owners as (
  select k, (regexp_match(k,'^(?:temp/)?([0-9a-fA-F-]{36})/'))[1] owner from keys
)
insert into public.secure_files(object_key,owner_id,storage,status,size,mime,name,verified_at)
select o.k,u.id,'legacy','ready',0,'application/octet-stream','attachment',now()
from owners o left join auth.users u on u.id::text=lower(o.owner)
where o.k ~ '^[a-zA-Z0-9/_\.-]+$' and o.k !~ '\.\.' and length(o.k)<=512
on conflict do nothing;
insert into private.file_references(object_key,conversation_id,message_id)
select distinct k,m.conversation_id,m.id from public.messages m cross join lateral unnest(m.attachment_keys) k
join public.secure_files f on f.object_key=k;
insert into private.file_references(object_key,conversation_id,stem_id)
select s.file_key,s.conversation_id,s.id from public.conversation_stems s join public.secure_files f on f.object_key=s.file_key;

create or replace function public.reserve_file(p_ext text,p_mime text,p_size bigint,p_name text,p_public boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; used bigint;
begin
  perform public.security_rate_limit('upload');
  if p_ext is null or p_ext !~ '^[a-z0-9]{1,8}$' or p_size is null or p_size<1 or p_size>1073741824
    or p_name is null or length(p_name)>255 or p_mime is null or length(p_mime)>100
    or p_mime !~ '^(audio/[a-zA-Z0-9.+-]+|video/(mp4|webm|quicktime)|image/(png|jpeg|webp|gif)|application/(octet-stream|zip))$'
    or (p_public and p_mime not like 'image/%' and p_mime not like 'audio/%') then
    raise exception 'Invalid upload' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select coalesce(sum(size),0) into used from public.secure_files where owner_id=auth.uid() and status in ('pending','ready','quarantined','deleting');
  if used+p_size>10737418240 then raise exception 'Storage quota exceeded' using errcode='42501'; end if;
  k:=(case when p_public then 'public/' else 'private/' end)||auth.uid()::text||'/'||gen_random_uuid()::text||'.'||p_ext;
  insert into public.secure_files(object_key,owner_id,storage,size,mime,name,upload_expires_at)
    values(k,auth.uid(),case when p_public then 'public' else 'private' end,p_size,p_mime,
      case when p_public then p_name else 'encrypted-attachment' end,now()+interval '15 minutes');
  return jsonb_build_object('object_key',k,'storage',case when p_public then 'public' else 'private' end,'size',p_size,'mime',p_mime);
end;
$$;
revoke all on function public.reserve_file(text,text,bigint,text,boolean) from public,anon;
grant execute on function public.reserve_file(text,text,bigint,text,boolean) to authenticated;

create or replace function public.file_access(p_key text,p_upload boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.secure_files;
begin
  perform public.security_check_session();
  select * into f from public.secure_files where object_key=p_key;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if p_upload then
    if f.owner_id is distinct from auth.uid() or f.status<>'pending' or f.upload_expires_at<now() then
      raise exception 'Access denied' using errcode='42501';
    end if;
  elsif f.status<>'ready' or not coalesce((f.owner_id=auth.uid() or f.storage='public' or exists(
    select 1 from private.file_references r where r.object_key=p_key and public.is_conversation_member(r.conversation_id))),false) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  return to_jsonb(f)-'owner_id';
end;
$$;
revoke all on function public.file_access(text,boolean) from public,anon;
grant execute on function public.file_access(text,boolean) to authenticated;

create or replace function public.finalize_file(p_key text,p_size bigint,p_mime text)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.secure_files set status='ready',verified_at=now()
  where object_key=p_key and status='pending' and upload_expires_at>now() and size=p_size and mime=p_mime;
  if not found then raise exception 'Upload verification failed' using errcode='22023'; end if;
end;
$$;
revoke all on function public.finalize_file(text,bigint,text) from public,anon,authenticated;
grant execute on function public.finalize_file(text,bigint,text) to service_role;

create or replace function private.register_file_references()
returns trigger language plpgsql security definer set search_path='' as $$
declare keys text[]; k text; f public.secure_files;
begin
  if tg_table_name='messages' then keys:=new.attachment_keys;
  else keys:=array[new.file_key]; end if;
  if coalesce(array_length(keys,1),0)>64 then raise exception 'Too many attachments' using errcode='22023'; end if;
  foreach k in array coalesce(keys,array[]::text[]) loop
    if k is null then continue; end if;
    select * into f from public.secure_files where object_key=k for update;
    if not found or f.status<>'ready' or not coalesce((f.owner_id=auth.uid() or exists(
      select 1 from private.file_references r where r.object_key=k and r.conversation_id=new.conversation_id
        and public.is_conversation_member(r.conversation_id))),false) then
      raise exception 'Invalid file reference' using errcode='42501';
    end if;
    insert into private.file_references(object_key,conversation_id,message_id,stem_id)
    values(k,new.conversation_id,case when tg_table_name='messages' then new.id end,
      case when tg_table_name='conversation_stems' then new.id end) on conflict do nothing;
  end loop;
  return new;
end;
$$;
revoke all on function private.register_file_references() from public,anon,authenticated;
create trigger messages_file_references after insert on public.messages for each row execute function private.register_file_references();
create trigger stems_file_references after insert on public.conversation_stems for each row execute function private.register_file_references();

create or replace function private.queue_unreferenced_file()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.secure_files where object_key=old.object_key for update;
  if not exists(select 1 from private.file_references where object_key=old.object_key) then
    insert into private.file_delete_jobs(object_key,storage,available_at)
    select object_key,storage,now()+interval '16 minutes' from public.secure_files
      where object_key=old.object_key and storage<>'public' and status<>'deleted'
    on conflict(object_key) do update set available_at=excluded.available_at,completed_at=null;
  end if;
  return old;
end;
$$;
revoke all on function private.queue_unreferenced_file() from public,anon,authenticated;
create trigger queue_file_deletion after delete on private.file_references for each row execute function private.queue_unreferenced_file();

create or replace function public.claim_file_deletions()
returns table(object_key text,storage text) language plpgsql security definer set search_path='' as $$
begin
  -- Unfinished uploads are reclaimed even when the browser disappeared.
  insert into private.file_delete_jobs(object_key,storage)
  select f.object_key,f.storage from public.secure_files f where
    (f.status='pending' and f.upload_expires_at<now()-interval '1 hour') or
    (f.owner_deleted_at is not null and f.status<>'deleted') or
    (f.storage='private' and f.status='ready' and f.created_at<now()-interval '1 day' and not exists(select 1 from private.file_references r where r.object_key=f.object_key))
  on conflict do nothing;
  return query
  with claimed as (
    select j.object_key from private.file_delete_jobs j join public.secure_files f using(object_key)
    where j.completed_at is null and j.available_at<=now() and (j.lease_until is null or j.lease_until<now())
      and (f.owner_deleted_at is not null or not exists(select 1 from private.file_references r where r.object_key=j.object_key))
    order by j.available_at for update of j,f skip locked limit 25
  ), marked as (
    update public.secure_files f set status='deleting' from claimed c where f.object_key=c.object_key returning f.object_key
  )
  update private.file_delete_jobs j set lease_until=now()+interval '5 minutes',attempts=attempts+1
  from marked m where j.object_key=m.object_key returning j.object_key,j.storage;
  delete from private.request_windows where window_start<now()-interval '1 day';
end;
$$;
create or replace function public.finish_file_deletion(p_key text,p_success boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  update private.file_delete_jobs set lease_until=null,
    completed_at=case when p_success then now() end,
    available_at=now()+interval '5 minutes'*least(attempts,288)
    where object_key=p_key;
  if p_success then update public.secure_files set status='deleted' where object_key=p_key; end if;
end;
$$;
revoke all on function public.claim_file_deletions(),public.finish_file_deletion(text,boolean) from public,anon,authenticated;
grant execute on function public.claim_file_deletions(),public.finish_file_deletion(text,boolean) to service_role;

-- Avatar updates must be scoped to the authenticated owner's path.
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar" on storage.objects for insert to authenticated
with check(bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text);
create policy "Users can update own avatar" on storage.objects for update to authenticated
using(bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text)
with check(bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text);
drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar" on storage.objects for delete to authenticated
using(bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text);
update storage.buckets set file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'] where id='avatars';

-- An attachment's identity and conversation are immutable after insertion.
revoke update on public.messages,public.conversation_stems from authenticated,anon;
revoke truncate,references,trigger on public.messages,public.conversation_stems,public.conversations from authenticated,anon;
