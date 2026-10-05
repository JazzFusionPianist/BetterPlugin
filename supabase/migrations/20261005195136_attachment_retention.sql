-- Upload-time retention, set only by trusted server data. Billing integration is future work.
create table private.attachment_retention_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paid_until timestamptz not null
);
alter table private.attachment_retention_entitlements enable row level security;
revoke all on private.attachment_retention_entitlements from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.attachment_retention_entitlements to service_role;

-- A verified billing backend can update entitlements without exposing the private schema.
create function public.set_attachment_retention_entitlement(p_user uuid,p_paid_until timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_paid_until is null then
    delete from private.attachment_retention_entitlements where user_id=p_user;
  else
    insert into private.attachment_retention_entitlements(user_id,paid_until) values(p_user,p_paid_until)
    on conflict(user_id) do update set paid_until=excluded.paid_until;
  end if;
end $$;
revoke all on function public.set_attachment_retention_entitlement(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.set_attachment_retention_entitlement(uuid,timestamptz) to service_role;

create function private.attachment_retention_deadline(p_owner uuid,p_uploaded timestamptz) returns timestamptz
language sql stable security definer set search_path='' set timezone='UTC' as $$
  select p_uploaded+case when exists(select 1 from private.attachment_retention_entitlements
    where user_id=p_owner and paid_until>p_uploaded) then interval '3 months' else interval '7 days' end;
$$;
revoke all on function private.attachment_retention_deadline(uuid,timestamptz) from public,anon,authenticated;

alter table public.secure_files add column retention_expires_at timestamptz;
-- Existing attachments get a rollout grace period; do not delete old uploads immediately.
update public.secure_files set retention_expires_at=private.attachment_retention_deadline(owner_id,now())
where storage<>'public' and status<>'deleted';
create index secure_files_retention_due on public.secure_files(retention_expires_at)
where retention_expires_at is not null and status<>'deleted';

create function private.set_attachment_retention() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.retention_expires_at:=case when new.storage='public' then null
    else private.attachment_retention_deadline(new.owner_id,now()) end;
  return new;
end $$;
revoke all on function private.set_attachment_retention() from public,anon,authenticated;
create trigger set_attachment_retention before insert on public.secure_files
for each row execute function private.set_attachment_retention();

create or replace function public.file_access(p_key text,p_upload boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.secure_files; allowed boolean;
begin
  perform public.security_check_session();
  select * into f from public.secure_files where object_key=p_key;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if p_upload then
    if f.owner_id is distinct from auth.uid() or f.status<>'pending' or f.upload_expires_at<now() then
      raise exception 'Access denied' using errcode='42501'; end if;
  else
    allowed:=coalesce(f.owner_id=auth.uid() or f.storage='public' or exists(
      select 1 from private.file_references r where r.object_key=p_key and r.pending_id is null
        and public.is_conversation_member(r.conversation_id)),false);
    if not allowed then raise exception 'Access denied' using errcode='42501'; end if;
    if f.retention_expires_at<=now() then raise exception 'Attachment expired' using errcode='P0002'; end if;
    if f.status<>'ready' then raise exception 'Access denied' using errcode='42501'; end if;
  end if;
  return to_jsonb(f)-'owner_id';
end $$;

-- The same file cannot be forwarded or attached again to restart its retention clock.
create or replace function private.register_file_references()
returns trigger language plpgsql security definer set search_path='' as $$
declare keys text[]; k text; f public.secure_files;
begin
  if tg_table_name='messages' then keys:=new.attachment_keys;else keys:=array[new.file_key];end if;
  if coalesce(array_length(keys,1),0)>64 then raise exception 'Too many attachments' using errcode='22023'; end if;
  foreach k in array coalesce(keys,array[]::text[]) loop
    if k is null then continue;end if;
    select * into f from public.secure_files where object_key=k for update;
    if not found or f.status<>'ready' or f.retention_expires_at<=now() or not coalesce(f.owner_id=auth.uid() or exists(
      select 1 from private.file_references r where r.object_key=k and r.conversation_id=new.conversation_id
        and r.pending_id is null and public.is_conversation_member(r.conversation_id)),false) then
      raise exception 'Invalid file reference' using errcode='42501';end if;
    insert into private.file_references(object_key,conversation_id,message_id,stem_id)
    values(k,new.conversation_id,case when tg_table_name='messages' then new.id end,
      case when tg_table_name='conversation_stems' then new.id end) on conflict do nothing;
  end loop;
  return new;
end $$;

create or replace function public.claim_file_deletions()
returns table(object_key text,storage text) language plpgsql security definer set search_path='' as $$
begin
  insert into private.file_delete_jobs(object_key,storage)
  select f.object_key,f.storage from public.secure_files f where f.status<>'deleted' and (
    (f.status='pending' and f.upload_expires_at<now()-interval '1 hour') or
    f.owner_deleted_at is not null or f.retention_expires_at<=now() or
    (f.storage='private' and f.status='ready' and f.created_at<now()-interval '1 day'
      and not exists(select 1 from private.file_references r where r.object_key=f.object_key)))
  on conflict do nothing;
  return query
  with claimed as (
    select j.object_key from private.file_delete_jobs j join public.secure_files f using(object_key)
    where j.completed_at is null and j.available_at<=now() and (j.lease_until is null or j.lease_until<now())
      and (f.owner_deleted_at is not null or f.retention_expires_at<=now()
        or not exists(select 1 from private.file_references r where r.object_key=j.object_key))
    order by j.available_at for update of j,f skip locked limit 25
  ), marked as (
    update public.secure_files f set status='deleting' from claimed c where f.object_key=c.object_key returning f.object_key
  )
  update private.file_delete_jobs j set lease_until=now()+interval '5 minutes',attempts=attempts+1
  from marked m where j.object_key=m.object_key returning j.object_key,j.storage;
  delete from private.request_windows where window_start<now()-interval '1 day';
end $$;

-- Older Supabase Storage attachments use the same deadlines and existing erasure worker.
alter table private.legacy_storage_refs add column retention_expires_at timestamptz;
update private.legacy_storage_refs r set retention_expires_at=private.attachment_retention_deadline(m.sender_id,now())
from public.messages m where m.id=r.message_id;
alter table private.legacy_storage_refs alter column retention_expires_at set not null;
create function private.set_legacy_attachment_retention() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner uuid; existing timestamptz;
begin
  select max(retention_expires_at) into existing from private.legacy_storage_refs where path=new.path;
  select sender_id into owner from public.messages where id=new.message_id;
  new.retention_expires_at:=coalesce(existing,private.attachment_retention_deadline(owner,now()));
  return new;
end $$;
revoke all on function private.set_legacy_attachment_retention() from public,anon,authenticated;
create trigger set_legacy_attachment_retention before insert on private.legacy_storage_refs
for each row execute function private.set_legacy_attachment_retention();
create or replace function public.can_read_legacy_attachment(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select public.security_session_active() and exists(select 1 from private.legacy_storage_refs r
    where r.path=p_path and r.retention_expires_at>now() and public.is_conversation_member(r.conversation_id));
$$;
create function public.legacy_attachment_expiry(p_path text) returns timestamptz
language plpgsql stable security definer set search_path='' as $$
declare deadline timestamptz;
begin
  perform public.security_check_session();
  select max(retention_expires_at) into deadline from private.legacy_storage_refs
    where path=p_path and public.is_conversation_member(conversation_id);
  if deadline is null then raise exception 'Access denied' using errcode='42501';end if;
  if deadline<=now() then raise exception 'Attachment expired' using errcode='P0002';end if;
  return deadline;
end $$;
revoke all on function public.legacy_attachment_expiry(text) from public,anon;
grant execute on function public.legacy_attachment_expiry(text) to authenticated;
create function public.queue_expired_legacy_attachments() returns void
language sql security definer set search_path='' as $$
  insert into private.storage_erasure_jobs(bucket,name)
  select 'attachments',path from private.legacy_storage_refs group by path having max(retention_expires_at)<=now()
  on conflict do nothing;
$$;
revoke all on function public.queue_expired_legacy_attachments() from public,anon,authenticated;
grant execute on function public.queue_expired_legacy_attachments() to service_role;

-- Expose deadlines only for files already referenced by the caller's conversation.
create function public.conversation_attachment_status(p_conversation uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.security_check_session();
  if not public.is_conversation_member(p_conversation) then raise exception 'Access denied' using errcode='42501';end if;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) into result from (
    select distinct f.object_key as key,f.retention_expires_at as expires_at,
      (f.status in ('deleting','deleted') or coalesce(f.retention_expires_at<=now(),false)) as expired
    from public.secure_files f join private.file_references r using(object_key)
    where r.conversation_id=p_conversation and r.pending_id is null
    union all
    select 'legacy-storage:'||path,max(retention_expires_at),max(retention_expires_at)<=now()
    from private.legacy_storage_refs where conversation_id=p_conversation group by path
  ) s;
  return result;
end $$;
revoke all on function public.conversation_attachment_status(uuid) from public,anon;
grant execute on function public.conversation_attachment_status(uuid) to authenticated;
