-- Canvas / scrapbook: things pinned to your home page (photos now,
-- video & drawings later). Each item is owned, positioned as a fraction
-- of the canvas, and visible to your mutual-follow friends unless private.

-- Mutual-follow check against the current user (SECURITY DEFINER so RLS
-- on `follows` never blocks the visibility test).
create or replace function public.is_mutual_follow(other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from follows where follower_id = auth.uid() and following_id = other)
     and exists (select 1 from follows where follower_id = other and following_id = auth.uid());
$$;

create table if not exists public.canvas_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'photo' check (kind in ('photo', 'video', 'drawing')),
  media_url text,                       -- R2 url (photo/video)
  poster_url text,                      -- still frame for video thumbnails
  title text,
  caption text,
  taken_at timestamptz,                 -- when the moment happened
  x real not null default 0.5,          -- position as a fraction of width (0..1)
  y real not null default 0.32,         -- position as a fraction of height (0..1)
  rotation real not null default 0,     -- tilt in degrees
  z int not null default 0,             -- stacking order
  visibility text not null default 'friends' check (visibility in ('friends', 'private')),
  created_at timestamptz not null default now()
);

alter table public.canvas_items enable row level security;

create policy "canvas: read own or friends' friends-visible"
  on public.canvas_items for select
  using (user_id = auth.uid() or (visibility = 'friends' and public.is_mutual_follow(user_id)));
create policy "canvas: insert own"
  on public.canvas_items for insert with check (user_id = auth.uid());
create policy "canvas: update own"
  on public.canvas_items for update using (user_id = auth.uid());
create policy "canvas: delete own"
  on public.canvas_items for delete using (user_id = auth.uid());

create index if not exists canvas_items_user_idx on public.canvas_items (user_id);

-- Live updates so a pinned photo appears without a refetch.
alter publication supabase_realtime add table public.canvas_items;
