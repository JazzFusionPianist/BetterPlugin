-- Additive preparation only. Cutover is a separate, reviewed operation after
-- every writing client has the device-link and encrypted-outbox release.
create table private.chat_rollout(singleton boolean primary key default true check(singleton), enabled boolean not null default false);
insert into private.chat_rollout default values;
revoke all on private.chat_rollout from public,anon,authenticated;

create function public.chat_security_mode() returns integer
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.security_check_session();
  return (select case when enabled then 1 else 0 end from private.chat_rollout where singleton);
end $$;
revoke all on function public.chat_security_mode() from public,anon;
grant execute on function public.chat_security_mode() to authenticated;

create table public.chat_device_links (
  id uuid primary key, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  public_key text not null check(public_key ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '5 minutes',
  response jsonb
);
create table public.chat_passkey_vaults (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  credential_id text not null check(length(credential_id) between 16 and 2048 and credential_id ~ '^[A-Za-z0-9_-]+$'),
  vault jsonb not null check(jsonb_typeof(vault)='object' and octet_length(vault::text)<8192),
  created_at timestamptz not null default now(), primary key(user_id,credential_id)
);
create table public.chat_pending_sends (
  id uuid primary key, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  envelope jsonb not null, attachment_keys text[] not null default '{}', created_at timestamptz not null default now()
);
alter table public.chat_device_links enable row level security;
alter table public.chat_passkey_vaults enable row level security;
alter table public.chat_pending_sends enable row level security;
create index chat_link_owner_expiry on public.chat_device_links(user_id,expires_at);
create index chat_pending_owner_created on public.chat_pending_sends(user_id,created_at);
create index chat_pending_conversation on public.chat_pending_sends(conversation_id);
revoke all on public.chat_device_links, public.chat_passkey_vaults, public.chat_pending_sends from public,anon,authenticated;
grant select,insert,delete on public.chat_device_links, public.chat_passkey_vaults, public.chat_pending_sends to authenticated;
grant update(response) on public.chat_device_links to authenticated;
create policy own_links on public.chat_device_links to authenticated
using(user_id=(select auth.uid()) and (select public.security_session_active()))
with check(user_id=(select auth.uid()) and (select public.security_session_active()));
create policy own_vaults on public.chat_passkey_vaults to authenticated
using(user_id=(select auth.uid()) and (select public.security_session_active()))
with check(user_id=(select auth.uid()) and (select public.security_session_active()));
create policy own_pending on public.chat_pending_sends to authenticated
using(user_id=(select auth.uid()) and (select public.security_session_active()) and public.is_conversation_member(conversation_id))
with check(user_id=(select auth.uid()) and (select public.security_session_active()) and public.is_conversation_member(conversation_id));

create function private.check_chat_link() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform public.security_rate_limit('keys');
  if tg_op='INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,53));
    if new.response is not null or (select count(*) from public.chat_device_links where user_id=auth.uid() and expires_at>now())>=5 then
      raise exception 'Connection request unavailable' using errcode='22023';
    end if;
    new.created_at:=now();new.expires_at:=now()+interval '5 minutes';
  else
    if old.response is not null or old.expires_at<=now() or new.response is null
      or jsonb_typeof(new.response)<>'object' or octet_length(new.response::text)>4096
      or new.response->>'id' is distinct from old.id::text or new.response->>'user' is distinct from old.user_id::text
      or new.response->>'recipient' is distinct from old.public_key
      or new.response->>'v' is distinct from '1'
      or jsonb_typeof(new.response->'expires') is distinct from 'string'
      or jsonb_typeof(new.response->'ciphertext') is distinct from 'string'
      or jsonb_typeof(new.response->'signature') is distinct from 'string'
      or length(new.response->>'ciphertext') not between 100 and 2048
      or new.response->>'ciphertext' !~ '^[A-Za-z0-9_-]+$'
      or new.response->>'signature' !~ '^[A-Za-z0-9_-]{86}$'
      or not(new.response ?& array['ciphertext','signature']) then
      raise exception 'Invalid connection response' using errcode='22023';
    end if;
  end if;
  return new;
end $$;
create trigger check_chat_link before insert or update on public.chat_device_links for each row execute function private.check_chat_link();

create function private.check_chat_vault() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform public.security_rate_limit('keys');
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,54));
  if (select count(*) from public.chat_passkey_vaults where user_id=auth.uid())>=5
    or new.vault->>'v' is distinct from '1' or new.vault->>'user' is distinct from auth.uid()::text
    or new.vault->>'credentialId' is distinct from new.credential_id
    or not(new.vault ?& array['salt','nonce','ciphertext','rpId','boxKey','signKey'])
    or jsonb_typeof(new.vault->'salt') is distinct from 'string'
    or jsonb_typeof(new.vault->'nonce') is distinct from 'string'
    or jsonb_typeof(new.vault->'ciphertext') is distinct from 'string'
    or jsonb_typeof(new.vault->'rpId') is distinct from 'string'
    or length(new.vault->>'rpId') not between 1 and 253
    or new.vault->>'salt' !~ '^[A-Za-z0-9_-]{43}$' or new.vault->>'nonce' !~ '^[A-Za-z0-9_-]{16}$'
    or new.vault->>'ciphertext' !~ '^[A-Za-z0-9_-]{64}$'
    or not exists(select 1 from public.chat_identity_keys where user_id=auth.uid()
      and box_key=new.vault->>'boxKey' and sign_key=new.vault->>'signKey') then
    raise exception 'Invalid device backup' using errcode='22023';
  end if;
  new.created_at:=now();return new;
end $$;
create trigger check_chat_vault before insert on public.chat_passkey_vaults for each row execute function private.check_chat_vault();

create function private.check_chat_pending() returns trigger
language plpgsql security definer set search_path='' as $$
declare e jsonb:=new.envelope; r jsonb;
begin
  perform public.security_rate_limit('message');
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,55));
  if (select count(*) from public.chat_pending_sends where user_id=auth.uid())>=100
    or jsonb_typeof(e)<>'object' or octet_length(e::text)>1048576
    or e->>'v' is distinct from '1' or e->>'id' is distinct from new.id::text
    or e->>'conversation' is distinct from new.conversation_id::text or e->>'sender' is distinct from auth.uid()::text
    or jsonb_typeof(e->'recipients') is distinct from 'array' then raise exception 'Invalid pending message' using errcode='22023'; end if;
  if jsonb_array_length(e->'recipients')<>1 then raise exception 'Invalid pending recipients' using errcode='22023'; end if;
  r:=e->'recipients'->0;
  if not(e ?& array['body','signature','nonce']) or not(r ? 'key')
    or jsonb_typeof(e->'body') is distinct from 'string' or jsonb_typeof(e->'signature') is distinct from 'string'
    or jsonb_typeof(e->'nonce') is distinct from 'string' or jsonb_typeof(r->'key') is distinct from 'string'
    or e->>'body' !~ '^[A-Za-z0-9_-]{24,}$' or e->>'signature' !~ '^[A-Za-z0-9_-]{86}$' or e->>'nonce' !~ '^[A-Za-z0-9_-]{32}$'
    or r->>'key' !~ '^[A-Za-z0-9_-]{107}$'
    or not exists(select 1 from public.chat_identity_keys where user_id=auth.uid() and user_id::text=r->>'user_id'
      and box_key=r->>'box_key' and sign_key=r->>'sign_key') then raise exception 'Invalid pending envelope' using errcode='22023'; end if;
  new.created_at:=now();return new;
end $$;
create trigger check_chat_pending before insert on public.chat_pending_sends for each row execute function private.check_chat_pending();
revoke all on function private.check_chat_link(),private.check_chat_vault(),private.check_chat_pending() from public,anon,authenticated;

create function private.enforce_chat_cutover() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (select enabled from private.chat_rollout where singleton) and new.encrypted_payload is null then
    raise exception 'Please update Slur to send messages.' using errcode='22023';
  end if;
  return new;
end $$;
revoke all on function private.enforce_chat_cutover() from public,anon,authenticated;
create trigger aaa_chat_cutover before insert or update on public.messages for each row execute function private.enforce_chat_cutover();
create trigger aaa_chat_cutover before insert or update on public.conversation_stems for each row execute function private.enforce_chat_cutover();
create trigger validate_private_message_update before update on public.messages for each row when(new.encrypted_payload is not null) execute function private.require_encrypted_message();
create trigger validate_private_stem_update before update on public.conversation_stems for each row when(new.encrypted_payload is not null) execute function private.require_encrypted_stem();

-- Pending audio must survive garbage collection without granting the recipient
-- access before delivery. Promotion inserts final references before deleting pending ones.
alter table private.file_references add column pending_id uuid references public.chat_pending_sends(id) on delete cascade;
alter table private.file_references drop constraint file_references_check;
alter table private.file_references add check(num_nonnulls(message_id,stem_id,pending_id)=1);
create unique index file_pending_reference on private.file_references(object_key,pending_id) where pending_id is not null;
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
        and r.pending_id is null and public.is_conversation_member(r.conversation_id))),false) then
      raise exception 'Invalid file reference' using errcode='42501';
    end if;
    insert into private.file_references(object_key,conversation_id,message_id,stem_id)
    values(k,new.conversation_id,case when tg_table_name='messages' then new.id end,
      case when tg_table_name='conversation_stems' then new.id end) on conflict do nothing;
  end loop;
  return new;
end $$;
create function private.register_pending_files() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text;
begin
  if cardinality(new.attachment_keys)>64 then raise exception 'Too many attachments' using errcode='22023'; end if;
  foreach k in array new.attachment_keys loop
    perform 1 from public.secure_files where object_key=k and status='ready' and owner_id=auth.uid() for update;
    if not found then raise exception 'Invalid pending file' using errcode='42501'; end if;
    insert into private.file_references(object_key,conversation_id,pending_id) values(k,new.conversation_id,new.id) on conflict do nothing;
  end loop;
  return new;
end $$;
revoke all on function private.register_pending_files() from public,anon,authenticated;
create trigger register_pending_files after insert on public.chat_pending_sends for each row execute function private.register_pending_files();
create or replace function public.file_access(p_key text,p_upload boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.secure_files;
begin
  perform public.security_check_session();
  select * into f from public.secure_files where object_key=p_key;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if p_upload then
    if f.owner_id is distinct from auth.uid() or f.status<>'pending' or f.upload_expires_at<now() then raise exception 'Access denied' using errcode='42501'; end if;
  elsif f.status<>'ready' or not coalesce((f.owner_id=auth.uid() or f.storage='public' or exists(
    select 1 from private.file_references r where r.object_key=p_key and r.pending_id is null and public.is_conversation_member(r.conversation_id))),false) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  return to_jsonb(f)-'owner_id';
end $$;
