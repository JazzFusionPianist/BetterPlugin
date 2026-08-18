-- Account deletion (App Store 5.1.1(v) + PIPA right to erasure).
--
-- The plugin's InformationPanel has called rpc('delete_my_account')
-- since it shipped, but the function never existed — this creates it,
-- and repairs the FK graph so deleting an auth.users row can succeed.

-- 1. conversations.created_by was NOT NULL + ON DELETE SET NULL — a
--    contradiction that would abort every deletion by a conversation
--    creator. Keep the SET NULL, drop the NOT NULL.
alter table if exists public.conversations alter column created_by drop not null;

-- 2. winner_id columns (yacht/orb_merge/ear_training/…) reference
--    auth.users with default NO ACTION and would block deletion.
--    Rewrite every such constraint to ON DELETE SET NULL.
do $$
declare r record;
begin
  for r in
    select distinct c.conname, c.conrelid::regclass::text as tbl
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
      and a.attname = 'winner_id' and c.confdeltype = 'a'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (winner_id) references auth.users(id) on delete set null',
      r.tbl, r.conname);
  end loop;
end $$;

-- 3. The RPC. SECURITY DEFINER so it may delete the auth.users row;
--    scoped strictly to the calling user. Tables created outside the
--    migration folder (messages, follows, …) are cleaned explicitly
--    with per-statement guards so a missing table/column never bricks
--    the whole deletion.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stmt text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  foreach stmt in array array[
    'delete from public.messages where sender_id = $1',
    'delete from public.follows where follower_id = $1 or following_id = $1',
    'delete from public.friendships where user_id = $1 or friend_id = $1',
    'delete from public.game_rooms where host_id = $1 or guest_id = $1',
    'delete from public.live_sessions where host_id = $1',
    'update public.conversations set created_by = null where created_by = $1',
    'delete from public.profiles where id = $1'
  ] loop
    begin
      execute stmt using uid;
    exception when others then
      -- best-effort cleanup: a missing table/column, or a guard trigger
      -- (e.g. storage tables reject direct SQL deletes), must never
      -- brick the deletion — the final auth.users delete below is the
      -- unguarded one that surfaces real blockers.
      null;
    end;
  end loop;
  -- NOTE: avatar files in the storage 'avatars' bucket cannot be
  -- deleted from SQL (Supabase guards direct deletes). They become
  -- orphaned objects; the profile row (and its URL) is gone.

  -- Everything else cascades (or set-nulls) from here.
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
