-- Follow alerts: the notifications table becomes user-visible.
--
-- The table already exists in prod (created outside the migration
-- history; useFollows.follow() and the game-invite flow have been
-- writing to it all along), so everything here is idempotent
-- hardening for its first reader — the follow-alert cards:
--   • ensure the columns the apps rely on exist
--   • RLS covering every existing write path + the new read/mark-read
--   • realtime publication membership so live alerts arrive

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete cascade,
  type       text not null,
  read       boolean not null default false,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists read boolean not null default false;
alter table public.notifications add column if not exists metadata jsonb;
alter table public.notifications add column if not exists created_at timestamptz not null default now();

-- The alert stack always queries "my unread rows".
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read = false;

alter table public.notifications enable row level security;

do $$ begin
  -- Recipient reads their inbox; actor sees rows they sent (the
  -- follow() duplicate-check and cancelInvite both select as actor).
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'notifications' and policyname = 'notif_select_own_or_sent') then
    create policy notif_select_own_or_sent on public.notifications
      for select to authenticated
      using (user_id = auth.uid() or actor_id = auth.uid());
  end if;

  -- Notifications are always written BY the actor FOR someone else.
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'notifications' and policyname = 'notif_insert_as_actor') then
    create policy notif_insert_as_actor on public.notifications
      for insert to authenticated
      with check (actor_id = auth.uid());
  end if;

  -- Recipient marks their own rows read.
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'notifications' and policyname = 'notif_update_own') then
    create policy notif_update_own on public.notifications
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  -- Actor withdraws a pending invite (cancelInvite); recipient may
  -- clear their own inbox.
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'notifications' and policyname = 'notif_delete_own_or_sent') then
    create policy notif_delete_own_or_sent on public.notifications
      for delete to authenticated
      using (user_id = auth.uid() or actor_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                 and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
