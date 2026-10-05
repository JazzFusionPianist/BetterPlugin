-- Unreleased follow-on to automatic_private_chat. Does not enable cutover.
alter table public.chat_pending_sends
  add column state text not null default 'waiting' check(state in ('waiting','blocked','expired','delivered','cancelled')),
  add column reason text check(reason in ('recipient_pending','retry','membership_changed','invalid')),
  add column kind text not null default 'message' check(kind in ('message','stems')),
  add column item_ids uuid[],
  add column expires_at timestamptz not null default now()+interval '7 days';
update public.chat_pending_sends set item_ids=array[id];
alter table public.chat_pending_sends alter column item_ids set not null;
alter table public.chat_pending_sends alter column envelope drop not null;
create index chat_pending_items on public.chat_pending_sends using gin(item_ids);
revoke delete on public.chat_pending_sends from authenticated;
drop policy own_pending on public.chat_pending_sends;
-- Owners must be able to cancel their unsent drafts even after leaving a room.
create policy pending_read on public.chat_pending_sends for select to authenticated
using(user_id=(select auth.uid()) and (select public.security_session_active()));
create policy pending_insert on public.chat_pending_sends for insert to authenticated
with check(user_id=(select auth.uid()) and (select public.security_session_active()) and public.is_conversation_member(conversation_id));

create or replace function private.check_chat_pending() returns trigger
language plpgsql security definer set search_path='' as $$
declare e jsonb:=new.envelope; r jsonb;
begin
  perform public.security_rate_limit('message');
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,55));
  if (select count(*) from public.chat_pending_sends where user_id=auth.uid() and state in ('waiting','blocked','expired'))>=100
    or e is null or jsonb_typeof(e)<>'object' or octet_length(e::text)>1048576
    or e->>'v' is distinct from '1' or e->>'id' is distinct from new.id::text
    or e->>'conversation' is distinct from new.conversation_id::text or e->>'sender' is distinct from auth.uid()::text
    or jsonb_typeof(e->'recipients') is distinct from 'array' then raise exception 'Invalid pending message' using errcode='22023'; end if;
  if jsonb_array_length(e->'recipients')<>1 then raise exception 'Invalid pending recipients' using errcode='22023'; end if;
  r:=e->'recipients'->0;
  if jsonb_typeof(e->'body') is distinct from 'string' or jsonb_typeof(e->'signature') is distinct from 'string'
    or jsonb_typeof(e->'nonce') is distinct from 'string' or jsonb_typeof(r->'key') is distinct from 'string'
    or e->>'body' !~ '^[A-Za-z0-9_-]{24,}$' or e->>'signature' !~ '^[A-Za-z0-9_-]{86}$' or e->>'nonce' !~ '^[A-Za-z0-9_-]{32}$'
    or r->>'key' !~ '^[A-Za-z0-9_-]{107}$'
    or not exists(select 1 from public.chat_identity_keys where user_id=auth.uid() and user_id::text=r->>'user_id'
      and box_key=r->>'box_key' and sign_key=r->>'sign_key') then raise exception 'Invalid pending envelope' using errcode='22023'; end if;
  new.item_ids:=coalesce(new.item_ids,array[new.id]);
  if new.item_ids[1] is distinct from new.id or cardinality(new.item_ids) not between 1 and 64
    or cardinality(new.item_ids)<>(select count(distinct i) from unnest(new.item_ids) i)
    or (new.kind='message' and cardinality(new.item_ids)<>1) then raise exception 'Invalid pending items' using errcode='22023'; end if;
  new.state:='waiting';new.reason:=null;
  new.created_at:=clock_timestamp();new.expires_at:=new.created_at+interval '7 days';
  return new;
end $$;

-- Ciphertext receipts serialize cancellation and delivery across every device.
-- These helpers are private; public RPCs authenticate and check ownership first.
create function private.finish_pending_chat(p_id uuid,p_state text) returns text
language plpgsql security definer set search_path='' as $$
begin
  update public.chat_pending_sends set state=p_state,reason=null,
    envelope=case when p_state in ('delivered','cancelled') then null else envelope end,
    attachment_keys='{}' where id=p_id;
  delete from private.file_references where pending_id=p_id;
  return p_state;
end $$;
revoke all on function private.finish_pending_chat(uuid,text) from public,anon,authenticated;

create function public.cancel_private_chat(p_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare p public.chat_pending_sends;
begin
  perform public.security_check_session();
  select * into p from public.chat_pending_sends where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if p.state in ('delivered','cancelled') then return p.state; end if;
  return private.finish_pending_chat(p_id,'cancelled');
end $$;

create function public.expire_private_chat() returns void
language plpgsql security definer set search_path='' as $$
declare p record;
begin
  perform public.security_check_session();
  for p in select id from public.chat_pending_sends where user_id=auth.uid()
    and state in ('waiting','blocked') and expires_at<=clock_timestamp() order by id for update loop
    perform private.finish_pending_chat(p.id,'expired');
  end loop;
end $$;

create function public.note_private_chat(p_id uuid,p_reason text) returns text
language plpgsql security definer set search_path='' as $$
declare p public.chat_pending_sends;
begin
  perform public.security_check_session();
  if p_reason is null or p_reason not in ('recipient_pending','retry','membership_changed','invalid') then
    raise exception 'Invalid delivery status' using errcode='22023'; end if;
  select * into p from public.chat_pending_sends where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if p.state<>'waiting' then return p.state; end if;
  if p.expires_at<=clock_timestamp() then return private.finish_pending_chat(p.id,'expired'); end if;
  update public.chat_pending_sends set reason=p_reason,
    state=case when p_reason in ('membership_changed','invalid') then 'blocked' else 'waiting' end where id=p.id returning state into p.state;
  return p.state;
end $$;

create function public.deliver_private_chat(p_id uuid,p_audience uuid[],p_records jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare p public.chat_pending_sends; r jsonb; cid uuid; members uuid[]; supplied uuid[];
begin
  perform public.security_check_session();
  if not(select enabled from private.chat_rollout where singleton) then raise exception 'Slur is updating' using errcode='55000'; end if;
  select conversation_id into cid from public.chat_pending_sends where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  -- Same lock order as membership changes: conversation, then pending item.
  perform 1 from public.conversations where id=cid for update;
  select * into p from public.chat_pending_sends where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if p.state<>'waiting' then return p.state; end if;
  if p.expires_at<=clock_timestamp() then return private.finish_pending_chat(p.id,'expired'); end if;
  select array_agg(user_id order by user_id) into members from public.conversation_members where conversation_id=cid;
  if not coalesce(auth.uid()=any(members),false) or members is distinct from p_audience then
    update public.chat_pending_sends set state='blocked',reason='membership_changed' where id=p.id;
    return 'blocked';
  end if;
  if jsonb_typeof(p_records) is distinct from 'array' or octet_length(p_records::text)>2097152 then
    raise exception 'Invalid delivery' using errcode='22023'; end if;
  if jsonb_array_length(p_records) not between 1 and 64 then raise exception 'Invalid delivery' using errcode='22023'; end if;
  select array_agg((v->>'id')::uuid order by ordinal) into supplied from jsonb_array_elements(p_records) with ordinality as x(v,ordinal);
  if supplied is distinct from p.item_ids then raise exception 'Invalid delivery items' using errcode='22023'; end if;
  for r in select value from jsonb_array_elements(p_records) loop
    if r->>'conversation_id' is distinct from p.conversation_id::text or jsonb_typeof(r->'encrypted_payload') is distinct from 'object' then
      raise exception 'Invalid delivery' using errcode='22023'; end if;
    if p.kind='message' then
      if r->>'sender_id' is distinct from auth.uid()::text or r->>'content' is distinct from '🔒 Encrypted message'
        or r->>'attachment_url' is not null or r->>'attachment_name' is not null or r->>'attachment_type' is not null or r->>'attachment_metadata' is not null then
        raise exception 'Encrypted delivery required' using errcode='22023'; end if;
      insert into public.messages(id,conversation_id,sender_id,content,encrypted_payload,attachment_keys)
      values((r->>'id')::uuid,cid,auth.uid(),'🔒 Encrypted message',r->'encrypted_payload',p.attachment_keys);
    else
      if r->>'uploader_id' is distinct from auth.uid()::text or r->>'file_url' is distinct from 'orb-encrypted:'
        or r->>'file_name' is distinct from 'Encrypted file' or r->>'timeline_metadata' is not null
        or not coalesce((r->>'file_key')=any(p.attachment_keys),false) then raise exception 'Encrypted delivery required' using errcode='22023'; end if;
      insert into public.conversation_stems(id,conversation_id,uploader_id,file_key,file_url,file_name,mime_type,file_size,encrypted_payload)
      values((r->>'id')::uuid,cid,auth.uid(),r->>'file_key','orb-encrypted:','Encrypted file','application/octet-stream',(r->>'file_size')::bigint,r->'encrypted_payload');
    end if;
  end loop;
  -- Any row/attachment validation failure rolls back the entire bundle and receipt.
  return private.finish_pending_chat(p.id,'delivered');
end $$;

-- Old direct writers must not resurrect an ID reserved by an outbox receipt.
-- INVOKER is intentional: RPC insertion runs as its trusted function owner;
-- direct Data API insertion runs as authenticated and is blocked for these IDs.
create function private.guard_pending_delivery() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and exists(select 1 from public.chat_pending_sends where item_ids @> array[new.id]) then
    raise exception 'Use atomic delivery for pending messages' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function private.guard_pending_delivery() from public,anon,authenticated;
create trigger aab_pending_delivery before insert on public.messages for each row execute function private.guard_pending_delivery();
create trigger aab_pending_delivery before insert on public.conversation_stems for each row execute function private.guard_pending_delivery();
revoke all on function public.cancel_private_chat(uuid),public.expire_private_chat(),public.note_private_chat(uuid,text),public.deliver_private_chat(uuid,uuid[],jsonb) from public,anon;
grant execute on function public.cancel_private_chat(uuid),public.expire_private_chat(),public.note_private_chat(uuid,text),public.deliver_private_chat(uuid,uuid[],jsonb) to authenticated;
