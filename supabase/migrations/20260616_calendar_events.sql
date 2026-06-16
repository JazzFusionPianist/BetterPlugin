-- Calendar events — personal schedule items, one row per event.
-- Populated either by the AI schedule prompt (source='prompt') or by
-- manual entry (source='manual'). Strictly per-user via RLS.

create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  location    text,
  notes       text,
  source      text not null default 'manual',   -- 'prompt' | 'manual'
  created_at  timestamptz not null default now()
);

create index if not exists calendar_events_user_start_idx
  on public.calendar_events (user_id, starts_at);

alter table public.calendar_events enable row level security;

-- Owners can do everything with their own rows; nobody else sees them.
drop policy if exists "calendar_events_select_own" on public.calendar_events;
create policy "calendar_events_select_own" on public.calendar_events
  for select using (auth.uid() = user_id);

drop policy if exists "calendar_events_insert_own" on public.calendar_events;
create policy "calendar_events_insert_own" on public.calendar_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "calendar_events_update_own" on public.calendar_events;
create policy "calendar_events_update_own" on public.calendar_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "calendar_events_delete_own" on public.calendar_events;
create policy "calendar_events_delete_own" on public.calendar_events
  for delete using (auth.uid() = user_id);

-- Live updates in the calendar view.
alter publication supabase_realtime add table public.calendar_events;
