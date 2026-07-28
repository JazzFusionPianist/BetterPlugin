-- In-game chat, separate from DM threads: one row per message, keyed by
-- the game room id (uuid across any of the four room tables — no FK on
-- purpose; rows are throwaway banter and rooms live in several tables).
create table if not exists public.game_chats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists game_chats_room_idx on public.game_chats (room_id, created_at);

alter table public.game_chats enable row level security;

-- Room ids are unguessable uuids shared only with invited players, and
-- the content is match banter — authenticated read, own-name write.
drop policy if exists game_chats_select on public.game_chats;
create policy game_chats_select on public.game_chats
  for select to authenticated using (true);
drop policy if exists game_chats_insert on public.game_chats;
create policy game_chats_insert on public.game_chats
  for insert to authenticated with check (sender_id = auth.uid());

alter publication supabase_realtime add table public.game_chats;

-- Chess: persist the last move's squares so BOTH players see the
-- highlight (it used to be local state — only your own move lit up).
alter table public.game_rooms
  add column if not exists last_from jsonb,
  add column if not exists last_to jsonb;
