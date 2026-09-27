-- Apply with the new client: public URLs for this private bucket stop working.
-- Public portfolios use tracks/avatars and are unaffected.
create function private.legacy_attachment_paths(value text) returns text[]
language plpgsql immutable set search_path='' as $$
declare items jsonb; item jsonb; raw text; path text; bytes bytea; i int; result text[]:='{}';
begin
  if value is null or length(value)>262144 then return result; end if;
  if left(value,1)='[' then items:=value::jsonb;else items:=jsonb_build_array(jsonb_build_object('url',value));end if;
  if jsonb_typeof(items)<>'array' or jsonb_array_length(items)>64 then return result; end if;
  for item in select * from jsonb_array_elements(items) loop
    raw:=item->>'url';
    if raw !~ '^https://svhjgiloekkjrcefclqs\.supabase\.co/storage/v1/object/public/attachments/' then continue; end if;
    raw:=regexp_replace(raw,'^https://[^/]+/storage/v1/object/public/attachments/','');
    bytes:=''::bytea;i:=1;
    while i<=length(raw) loop
      if substr(raw,i,1)='%' then bytes:=bytes||decode(substr(raw,i+1,2),'hex');i:=i+3;
      else bytes:=bytes||convert_to(substr(raw,i,1),'UTF8');i:=i+1;end if;
    end loop;
    path:=convert_from(bytes,'UTF8');
    if path<>'' and length(path)<=1024 and path !~ '(^/|\.\.)' then result:=array_append(result,path); end if;
  end loop;
  return result;
exception when others then return '{}';
end $$;
revoke all on function private.legacy_attachment_paths(text) from public,anon,authenticated;
create table private.legacy_storage_refs(
  path text not null,conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  primary key(path,message_id)
);
alter table private.legacy_storage_refs enable row level security;
revoke all on private.legacy_storage_refs from public,anon,authenticated;
insert into private.legacy_storage_refs
select distinct p,m.conversation_id,m.id from public.messages m cross join lateral unnest(private.legacy_attachment_paths(m.attachment_url)) p
join storage.objects o on o.bucket_id='attachments' and o.name=p
where coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner',split_part(o.name,'/',1))=m.sender_id::text;

create function public.can_read_legacy_attachment(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select public.security_session_active() and exists(select 1 from private.legacy_storage_refs r
    where r.path=p_path and public.is_conversation_member(r.conversation_id));
$$;
revoke all on function public.can_read_legacy_attachment(text) from public,anon;
grant execute on function public.can_read_legacy_attachment(text) to authenticated;
drop policy if exists "public read" on storage.objects;
drop policy if exists "auth upload" on storage.objects;
create policy legacy_attachment_read on storage.objects for select to authenticated
using(bucket_id='attachments' and public.can_read_legacy_attachment(name));
update storage.buckets set public=false where id='attachments';

create function private.remove_upgraded_storage_refs() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.encrypted_payload is not null then delete from private.legacy_storage_refs where message_id=new.id;end if;
  return new;
end $$;
revoke all on function private.remove_upgraded_storage_refs() from public,anon,authenticated;
create trigger remove_upgraded_storage_refs after update on public.messages for each row execute function private.remove_upgraded_storage_refs();
create function private.queue_legacy_storage_erasure() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from private.legacy_storage_refs where path=old.path) then
    insert into private.storage_erasure_jobs(bucket,name,available_at) values('attachments',old.path,now()+interval '10 minutes')
      on conflict(bucket,name) do update set available_at=excluded.available_at,completed_at=null;
  end if;
  return old;
end $$;
revoke all on function private.queue_legacy_storage_erasure() from public,anon,authenticated;
create trigger queue_legacy_storage_erasure after delete on private.legacy_storage_refs for each row execute function private.queue_legacy_storage_erasure();

-- Called by the operator's migration script after verifying the private copy.
-- Moving a record and its queued deletion destination is one transaction.
create function public.switch_legacy_file_storage(p_key text) returns void
language plpgsql security definer set search_path='' as $$
declare f public.secure_files;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Access denied'; end if;
  select * into f from public.secure_files where object_key=p_key for update;
  if not found or f.status<>'ready' or f.storage not in ('legacy','private') then raise exception 'File changed during migration'; end if;
  update public.secure_files set storage='private' where object_key=p_key;
  update private.file_delete_jobs set storage='private' where object_key=p_key and completed_at is null;
end $$;
revoke all on function public.switch_legacy_file_storage(text) from public,anon,authenticated;
grant execute on function public.switch_legacy_file_storage(text) to service_role;
