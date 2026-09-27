-- Current membership, never historical authorship, grants access.
create function public.security_session_active() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
    where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
    and (u.banned_until is null or u.banned_until<now()));
$$;
revoke all on function public.security_session_active() from public,anon;
grant execute on function public.security_session_active() to authenticated;

-- Restrictive policies also cover old permissive policies. Public portfolio
-- reads as anon remain governed by their deliberate public policies.
do $$ declare t record; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity loop
    execute format('create policy active_session on public.%I as restrictive to authenticated using ((select public.security_session_active())) with check ((select public.security_session_active()))',t.relname);
  end loop;
end $$;

create function public.is_conversation_admin(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.conversation_members where conversation_id=p_id and user_id=auth.uid() and role='admin');
$$;
revoke all on function public.is_conversation_admin(uuid) from public,anon;
grant execute on function public.is_conversation_admin(uuid) to authenticated;

revoke insert,update on public.conversations from authenticated;
grant update(title,avatar_url) on public.conversations to authenticated;
revoke update on public.conversation_members from authenticated;
drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations for select to authenticated using(public.is_conversation_member(id));
drop policy if exists conv_update on public.conversations;
create policy conv_update on public.conversations for update to authenticated
using(public.is_conversation_admin(id)) with check(public.is_conversation_admin(id));
drop policy if exists cm_insert on public.conversation_members;
create policy cm_insert on public.conversation_members for insert to authenticated
with check(role='member' and public.is_conversation_admin(conversation_id));
drop policy if exists cm_delete on public.conversation_members;
create policy cm_delete on public.conversation_members for delete to authenticated
using(user_id=auth.uid() or public.is_conversation_admin(conversation_id));

create function public.create_secure_conversation(p_kind text,p_members uuid[],p_title text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); ids uuid[]; cid uuid;
begin
  perform public.security_rate_limit('conversation');
  if p_kind is null or p_kind not in ('dm','group') then raise exception 'Invalid conversation'; end if;
  select array_agg(distinct x order by x) into ids from unnest(array_append(p_members,uid)) x where x is not null;
  if cardinality(ids)<2 or cardinality(ids)>16 or (p_kind='dm' and cardinality(ids)<>2)
    or (p_kind='group' and (nullif(trim(p_title),'') is null or length(p_title)>120)) then raise exception 'Invalid participants or title'; end if;
  -- Sort the pair before locking so simultaneous DM opens converge.
  perform pg_advisory_xact_lock(hashtextextended(array_to_string(ids,','),7));
  if p_kind='dm' then
    select c.id into cid from public.conversations c where c.kind='dm'
      and (select array_agg(m.user_id order by m.user_id) from public.conversation_members m where m.conversation_id=c.id)=ids
      order by c.created_at desc limit 1;
    if cid is not null then return cid; end if;
  end if;
  if exists(select 1 from unnest(ids) x where not exists(select 1 from auth.users where id=x and (banned_until is null or banned_until<now()))) then raise exception 'Participant unavailable'; end if;
  cid:=gen_random_uuid();
  insert into public.conversations(id,kind,title,created_by) values(cid,p_kind,case when p_kind='group' then trim(p_title) end,uid);
  insert into public.conversation_members(conversation_id,user_id,role)
    select cid,x,case when p_kind='group' and x=uid then 'admin' else 'member' end from unnest(ids) x;
  return cid;
end $$;
revoke all on function public.create_secure_conversation(text,uuid[],text) from public,anon;
grant execute on function public.create_secure_conversation(text,uuid[],text) to authenticated;

-- Serialize membership expansion with encrypted sends, and cap the roster.
create function private.check_member_limit() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text; n int;
begin
  select kind into k from public.conversations where id=new.conversation_id for update;
  select count(*) into n from public.conversation_members where conversation_id=new.conversation_id;
  if n >= (case when k='dm' then 2 else 16 end) then raise exception 'Conversation full'; end if;
  return new;
end $$;
revoke all on function private.check_member_limit() from public,anon,authenticated;
create trigger member_count_guard before insert on public.conversation_members for each row execute function private.check_member_limit();

-- Rate counters only retain short operational windows; never message contents.
create function public.security_prune_metadata() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Access denied'; end if;
  delete from private.request_windows where window_start<now()-interval '1 day';
  delete from private.live_signals where created_at<now()-interval '2 minutes';
  delete from private.live_chat_messages where created_at<now()-interval '1 hour';
  delete from public.live_sessions where heartbeat_at<now()-interval '1 hour';
end $$;
revoke all on function public.security_prune_metadata() from public,anon,authenticated;
grant execute on function public.security_prune_metadata() to service_role;

-- Game chat is scoped to seated players. Knowing a room UUID grants no read.
create function public.is_game_participant(p_room uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare t text; r jsonb; uid text:=auth.uid()::text;
begin
  if uid is null then return false; end if;
  foreach t in array array['game_rooms','board_rooms','ear_training_rooms','poker_rooms','falling_blocks_rooms','orb_party_rooms','yacht_rooms','sketch_rooms'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('select to_jsonb(x) from public.%I x where id=$1',t) into r using p_room;
    if r is not null and (uid in (r->>'host_id',r->>'guest_id',r->>'player1_id',r->>'player2_id') or coalesce(r->'player_ids','[]') ? uid) then return true; end if;
  end loop;
  return false;
end $$;
revoke all on function public.is_game_participant(uuid) from public,anon;
grant execute on function public.is_game_participant(uuid) to authenticated;

do $$ begin
  if to_regclass('public.game_chats') is not null then
    execute 'drop policy if exists game_chats_select on public.game_chats';
    execute 'create policy game_chats_select on public.game_chats for select to authenticated using(public.is_game_participant(room_id))';
    execute 'drop policy if exists game_chats_insert on public.game_chats';
    execute 'create policy game_chats_insert on public.game_chats for insert to authenticated with check(sender_id=auth.uid() and public.is_game_participant(room_id))';
    execute 'revoke update,delete on public.game_chats from authenticated';
  end if;
end $$;

-- Existing game clients join through UPDATE. Permit only taking one's own
-- empty lobby seat; outsiders cannot alter game state or an existing seat.
create function private.guard_game_room() returns trigger
language plpgsql security definer set search_path='' as $$
declare o jsonb:=to_jsonb(old); n jsonb:=to_jsonb(new); uid text:=auth.uid()::text;
  host text:=coalesce(o->>'host_id',o->>'player1_id'); seat text; member boolean;
begin
  perform public.security_check_session();
  if (n->>'id') is distinct from (o->>'id') or coalesce(n->>'host_id',n->>'player1_id') is distinct from host then raise exception 'Room owner is immutable'; end if;
  member:=uid=host or uid in (o->>'guest_id',o->>'player2_id') or coalesce(o->'player_ids','[]') ? uid;
  if member is true then return new; end if;
  if o->>'status' is distinct from 'lobby' then raise exception 'Access denied' using errcode='42501'; end if;
  seat:=case when o ? 'guest_id' then 'guest_id' when o ? 'player2_id' then 'player2_id' else 'player_ids' end;
  if seat='player_ids' then
    if jsonb_array_length(coalesce(o->seat,'[]'))>=coalesce((o->>'player_count')::int,4)
      or n->seat is distinct from (coalesce(o->seat,'[]') || jsonb_build_array(uid)) then raise exception 'Invalid seat'; end if;
  elsif o->>seat is not null or n->>seat is distinct from uid then raise exception 'Invalid seat';
  end if;
  if (n-array[seat,'updated_at']) is distinct from (o-array[seat,'updated_at']) then raise exception 'Only your own seat can be changed'; end if;
  return new;
end $$;
revoke all on function private.guard_game_room() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['game_rooms','board_rooms','ear_training_rooms','poker_rooms','falling_blocks_rooms','orb_party_rooms','yacht_rooms','sketch_rooms'] loop
    if to_regclass('public.'||t) is not null then
      execute format('create trigger guard_room_security before update on public.%I for each row execute function private.guard_game_room()',t);
    end if;
  end loop;
end $$;
