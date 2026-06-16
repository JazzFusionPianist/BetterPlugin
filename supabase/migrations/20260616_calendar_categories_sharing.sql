-- Calendar v2: categories + shared (group) events.

BEGIN;

-- ── 1. Per-user category registry (palette) ───────────────────────────────
create table if not exists public.event_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  color       text not null,
  created_at  timestamptz not null default now()
);
-- One category name per user (case-insensitive).
create unique index if not exists event_categories_user_name_idx
  on public.event_categories (user_id, lower(name));

alter table public.event_categories enable row level security;

drop policy if exists "event_categories_select_own" on public.event_categories;
create policy "event_categories_select_own" on public.event_categories
  for select using (auth.uid() = user_id);
drop policy if exists "event_categories_insert_own" on public.event_categories;
create policy "event_categories_insert_own" on public.event_categories
  for insert with check (auth.uid() = user_id);
drop policy if exists "event_categories_update_own" on public.event_categories;
create policy "event_categories_update_own" on public.event_categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "event_categories_delete_own" on public.event_categories;
create policy "event_categories_delete_own" on public.event_categories
  for delete using (auth.uid() = user_id);

-- ── 2. Event columns: category (denormalised) + sharing link ──────────────
alter table public.calendar_events
  add column if not exists category        text,
  add column if not exists category_color  text,
  add column if not exists conversation_id uuid references public.conversations (id) on delete cascade;

create index if not exists calendar_events_conversation_idx
  on public.calendar_events (conversation_id);

-- ── 3. Sharing-aware RLS ──────────────────────────────────────────────────
-- Visible if I own it, OR it's attached to a conversation I'm a member of.
-- is_conversation_member() is the existing SECURITY DEFINER helper, so no
-- policy recursion.
drop policy if exists "calendar_events_select_own" on public.calendar_events;
drop policy if exists "calendar_events_select"     on public.calendar_events;
create policy "calendar_events_select" on public.calendar_events
  for select using (
    user_id = auth.uid()
    or (conversation_id is not null and public.is_conversation_member(conversation_id))
  );

-- Insert: I'm the author; a group event requires me to be in that group.
drop policy if exists "calendar_events_insert_own" on public.calendar_events;
drop policy if exists "calendar_events_insert"     on public.calendar_events;
create policy "calendar_events_insert" on public.calendar_events
  for insert with check (
    user_id = auth.uid()
    and (conversation_id is null or public.is_conversation_member(conversation_id))
  );

-- Update/delete stay author-only (members can view but not mutate others').
-- (calendar_events_update_own / _delete_own from the first migration remain.)

COMMIT;

-- Make the category registry live too.
alter publication supabase_realtime add table public.event_categories;
