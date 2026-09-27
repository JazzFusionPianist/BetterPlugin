create or replace function private.guard_game_room() returns trigger
language plpgsql security definer set search_path='' as $$
declare o jsonb:=to_jsonb(old); n jsonb:=to_jsonb(new); uid text:=auth.uid()::text;
  host text:=coalesce(o->>'host_id',o->>'player1_id'); seat text; member boolean;
begin
  -- Referential SET NULL during account erasure may run after its session is gone.
  -- Only nested FK-like nulling is allowed; direct requests still need membership.
  if pg_trigger_depth()>1
    and (n-array['guest_id','player2_id','winner_id','draw_offered_by','updated_at'])
      is not distinct from (o-array['guest_id','player2_id','winner_id','draw_offered_by','updated_at'])
    and exists(select 1 from unnest(array['guest_id','player2_id','winner_id','draw_offered_by']) k where n->k is distinct from o->k)
    and not exists(select 1 from unnest(array['guest_id','player2_id','winner_id','draw_offered_by']) k
      where n->k is distinct from o->k and n->k is distinct from 'null'::jsonb) then
    return new;
  end if;
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

-- Game outcome references must not prevent deletion of personal profiles.
do $$ declare c record; begin
  for c in select con.conname,con.conrelid::regclass as tbl,a.attname as col
    from pg_constraint con join pg_attribute a on a.attrelid=con.conrelid and a.attnum=con.conkey[1]
    where con.contype='f' and con.confrelid='public.profiles'::regclass and con.confdeltype='a'
      and array_length(con.conkey,1)=1 and a.attname in ('winner_id','draw_offered_by') loop
    execute format('alter table %s drop constraint %I',c.tbl,c.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete set null',c.tbl,c.conname,c.col);
  end loop;
  if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and confrelid='auth.users'::regclass and contype='f') then
    -- Do not silently delete historical orphans. New accounts and future
    -- deletions are constrained; historical cleanup is a separate decision.
    alter table public.profiles add constraint profiles_auth_user_security_fk
      foreign key(id) references auth.users(id) on delete cascade not valid;
  end if;
end $$;
