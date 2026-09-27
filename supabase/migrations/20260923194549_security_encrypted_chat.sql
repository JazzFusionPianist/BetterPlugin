create table public.chat_identity_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  box_key text not null check(box_key ~ '^[A-Za-z0-9_-]{43}$'),
  sign_key text not null check(sign_key ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz not null default now()
);
alter table public.chat_identity_keys enable row level security;
revoke all on public.chat_identity_keys from public,anon,authenticated;

create function public.register_chat_key(p_box text,p_sign text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.security_rate_limit('keys');
  insert into public.chat_identity_keys(user_id,box_key,sign_key) values(auth.uid(),p_box,p_sign) on conflict do nothing;
  if not exists(select 1 from public.chat_identity_keys where user_id=auth.uid() and box_key=p_box and sign_key=p_sign) then
    raise exception 'Key mismatch' using errcode='42501';
  end if;
end;
$$;
create function public.my_chat_key() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform public.security_check_session();
  return (select to_jsonb(k) from public.chat_identity_keys k where user_id=auth.uid());
end;
$$;
create function public.conversation_chat_keys(p_conversation uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.security_check_session();
  if not public.is_conversation_member(p_conversation) then raise exception 'Access denied' using errcode='42501'; end if;
  return (select jsonb_agg(jsonb_build_object('user_id',m.user_id,'box_key',k.box_key,'sign_key',k.sign_key) order by m.user_id)
    from public.conversation_members m left join public.chat_identity_keys k on k.user_id=m.user_id where m.conversation_id=p_conversation);
end;
$$;
revoke all on function public.register_chat_key(text,text),public.my_chat_key(),public.conversation_chat_keys(uuid) from public,anon;
grant execute on function public.register_chat_key(text,text),public.my_chat_key(),public.conversation_chat_keys(uuid) to authenticated;

alter table public.messages add column encrypted_payload jsonb;
create function private.require_encrypted_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare e jsonb:=new.encrypted_payload; recipients jsonb; n int;
begin
  perform public.security_rate_limit('message');
  if new.sender_id is distinct from auth.uid() or not public.is_conversation_member(new.conversation_id) then raise exception 'Access denied' using errcode='42501'; end if;
  -- Lock the conversation against concurrent membership changes during validation.
  perform 1 from public.conversations where id=new.conversation_id for update;
  if e is null or jsonb_typeof(e)<>'object' or e->>'v' is distinct from '1' or e->>'id' is distinct from new.id::text
    or e->>'conversation' is distinct from new.conversation_id::text or e->>'sender' is distinct from auth.uid()::text
    or octet_length(e::text)>262144 or coalesce(length(e->>'body'),0)<24 or coalesce(length(e->>'signature'),0)<>86
    or coalesce(length(e->>'nonce'),0)<>32 or jsonb_typeof(e->'recipients') is distinct from 'array'
    or new.attachment_url is not null or new.attachment_name is not null or new.attachment_type is not null or new.attachment_metadata is not null
    or new.content is distinct from '🔒 Encrypted message' then raise exception 'Encrypted messages required' using errcode='22023'; end if;
  recipients:=e->'recipients';n:=jsonb_array_length(recipients);
  if n<1 or n>16 or n<>(select count(*) from public.conversation_members where conversation_id=new.conversation_id)
    or n<>(select count(distinct r->>'user_id') from jsonb_array_elements(recipients) r)
    or exists(select 1 from jsonb_array_elements(recipients) r where not exists(
      select 1 from public.conversation_members m join public.chat_identity_keys k on k.user_id=m.user_id
      where m.conversation_id=new.conversation_id and m.user_id::text=r->>'user_id' and k.box_key=r->>'box_key' and k.sign_key=r->>'sign_key')
      or length(r->>'key') is distinct from 107) then raise exception 'Participant keys changed' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function private.require_encrypted_message() from public,anon,authenticated;
create trigger require_encrypted_message before insert on public.messages for each row execute function private.require_encrypted_message();
-- Existing rows are not falsely labelled encrypted. They require a separate,
-- authenticated migration by their authors after recipients register keys.

create function public.sender_chat_key(p_conversation uuid,p_sender uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.security_check_session();
  if not public.is_conversation_member(p_conversation) then raise exception 'Access denied' using errcode='42501'; end if;
  if not exists(select 1 from public.messages where conversation_id=p_conversation and sender_id=p_sender)
    and not exists(select 1 from public.conversation_stems where conversation_id=p_conversation and uploader_id=p_sender) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  return (select to_jsonb(k) from public.chat_identity_keys k where user_id=p_sender);
end;
$$;
revoke all on function public.sender_chat_key(uuid,uuid) from public,anon;
grant execute on function public.sender_chat_key(uuid,uuid) to authenticated;

-- Every membership mutation takes the same lock as message submission. This
-- prevents a send using a stale member set from racing a removal/addition.
create function private.lock_chat_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.conversations where id=case when tg_op='DELETE' then old.conversation_id else new.conversation_id end for update;
  if tg_op='UPDATE' and (new.conversation_id<>old.conversation_id or new.user_id<>old.user_id) then raise exception 'Membership identity is immutable' using errcode='42501';end if;
  if tg_op='DELETE' then return old;end if;return new;
end;
$$;
revoke all on function private.lock_chat_membership() from public,anon,authenticated;
create trigger lock_chat_membership before insert or update or delete on public.conversation_members
for each row execute function private.lock_chat_membership();

alter table public.conversation_stems add column encrypted_payload jsonb;
create function private.require_encrypted_stem() returns trigger
language plpgsql security definer set search_path='' as $$
declare e jsonb:=new.encrypted_payload; recipients jsonb; n int;
begin
  perform public.security_rate_limit('message');
  if new.uploader_id is distinct from auth.uid() or not public.is_conversation_member(new.conversation_id) then raise exception 'Access denied' using errcode='42501'; end if;
  -- Lock the conversation against concurrent membership changes during validation.
  perform 1 from public.conversations where id=new.conversation_id for update;
  if e is null or jsonb_typeof(e)<>'object' or e->>'v' is distinct from '1' or e->>'id' is distinct from new.id::text
    or e->>'conversation' is distinct from new.conversation_id::text or e->>'sender' is distinct from auth.uid()::text
    or octet_length(e::text)>262144 or coalesce(length(e->>'body'),0)<24 or coalesce(length(e->>'signature'),0)<>86
    or coalesce(length(e->>'nonce'),0)<>32 or jsonb_typeof(e->'recipients') is distinct from 'array'
    or new.file_url is distinct from 'orb-encrypted:' or new.file_name is distinct from 'Encrypted file' or new.timeline_metadata is not null then raise exception 'Encrypted messages required' using errcode='22023'; end if;
  recipients:=e->'recipients';n:=jsonb_array_length(recipients);
  if n<1 or n>16 or n<>(select count(*) from public.conversation_members where conversation_id=new.conversation_id)
    or n<>(select count(distinct r->>'user_id') from jsonb_array_elements(recipients) r)
    or exists(select 1 from jsonb_array_elements(recipients) r where not exists(
      select 1 from public.conversation_members m join public.chat_identity_keys k on k.user_id=m.user_id
      where m.conversation_id=new.conversation_id and m.user_id::text=r->>'user_id' and k.box_key=r->>'box_key' and k.sign_key=r->>'sign_key')
      or length(r->>'key') is distinct from 107) then raise exception 'Participant keys changed' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function private.require_encrypted_stem() from public,anon,authenticated;
create trigger require_encrypted_stem before insert on public.conversation_stems for each row execute function private.require_encrypted_stem();
