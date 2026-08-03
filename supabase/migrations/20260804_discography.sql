-- Artist portfolio: releases (cover + description + ordered tracks) and
-- a gallery of captioned photos. Owner writes; mutual friends read —
-- the same visibility rule as the canvas wall.

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  cover_url text,
  description text check (char_length(description) <= 2000),
  released_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.release_tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  idx int not null default 0,
  title text not null check (char_length(title) <= 120),
  media_url text not null
);

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_url text not null,
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now()
);

alter table public.releases enable row level security;
alter table public.release_tracks enable row level security;
alter table public.gallery_photos enable row level security;

drop policy if exists "releases_select" on public.releases;
create policy "releases_select" on public.releases for select
  using (user_id = auth.uid() or public.is_mutual_follow(user_id));
drop policy if exists "releases_write" on public.releases;
create policy "releases_write" on public.releases for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "release_tracks_select" on public.release_tracks;
create policy "release_tracks_select" on public.release_tracks for select
  using (exists (select 1 from public.releases r where r.id = release_id
                 and (r.user_id = auth.uid() or public.is_mutual_follow(r.user_id))));
drop policy if exists "release_tracks_write" on public.release_tracks;
create policy "release_tracks_write" on public.release_tracks for all
  using (exists (select 1 from public.releases r where r.id = release_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.releases r where r.id = release_id and r.user_id = auth.uid()));

drop policy if exists "gallery_select" on public.gallery_photos;
create policy "gallery_select" on public.gallery_photos for select
  using (user_id = auth.uid() or public.is_mutual_follow(user_id));
drop policy if exists "gallery_write" on public.gallery_photos;
create policy "gallery_write" on public.gallery_photos for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists releases_user_idx on public.releases (user_id, released_on desc);
create index if not exists release_tracks_release_idx on public.release_tracks (release_id, idx);
create index if not exists gallery_photos_user_idx on public.gallery_photos (user_id, created_at desc);
