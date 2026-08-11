-- Open call — the public demo stream. Anyone signed in can hear every
-- track (this is the first genuinely public surface in the app; wall &
-- discography stay mutual-follow gated). Owners write their own rows.

create table if not exists public.demo_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  caption text check (caption is null or char_length(caption) <= 500),
  audio_url text not null,
  duration real,
  -- ~160 normalized 0..1 amplitude buckets, computed client-side at
  -- upload so the feed can print waveforms without decoding audio.
  peaks jsonb,
  plays integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists demo_tracks_fresh_idx
  on public.demo_tracks (created_at desc);

alter table public.demo_tracks enable row level security;

drop policy if exists demo_tracks_select on public.demo_tracks;
create policy demo_tracks_select on public.demo_tracks
  for select to authenticated using (true);

drop policy if exists demo_tracks_insert on public.demo_tracks;
create policy demo_tracks_insert on public.demo_tracks
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists demo_tracks_update on public.demo_tracks;
create policy demo_tracks_update on public.demo_tracks
  for update to authenticated using (auth.uid() = user_id);

drop policy if exists demo_tracks_delete on public.demo_tracks;
create policy demo_tracks_delete on public.demo_tracks
  for delete to authenticated using (auth.uid() = user_id);

-- Timestamped comments — "1:24 this part". at_seconds null = a plain
-- comment on the whole track.
create table if not exists public.track_comments (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.demo_tracks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  at_seconds real check (at_seconds is null or at_seconds >= 0),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists track_comments_track_idx
  on public.track_comments (track_id, created_at);

alter table public.track_comments enable row level security;

drop policy if exists track_comments_select on public.track_comments;
create policy track_comments_select on public.track_comments
  for select to authenticated using (true);

drop policy if exists track_comments_insert on public.track_comments;
create policy track_comments_insert on public.track_comments
  for insert to authenticated with check (auth.uid() = user_id);

-- Commenters delete their own; the track owner can also sweep theirs.
drop policy if exists track_comments_delete on public.track_comments;
create policy track_comments_delete on public.track_comments
  for delete to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.demo_tracks t
      where t.id = track_id and t.user_id = auth.uid()
    )
  );

-- Play counter — definer fn so listeners can bump rows they don't own.
create or replace function public.bump_plays(track uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.demo_tracks set plays = plays + 1 where id = track;
$$;

revoke all on function public.bump_plays(uuid) from public;
grant execute on function public.bump_plays(uuid) to authenticated;

-- Live feed — new tracks appear without a refresh.
do $$
begin
  alter publication supabase_realtime add table public.demo_tracks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.track_comments;
exception when duplicate_object then null;
end $$;
