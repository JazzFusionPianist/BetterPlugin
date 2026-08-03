-- Falling blocks world leaderboard — same shape as pinball_scores:
-- one row per user holding their personal best. Read: everyone. Write: own.
create table if not exists public.falling_blocks_scores (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  best_score integer not null default 0 check (best_score >= 0),
  plays integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.falling_blocks_scores enable row level security;

drop policy if exists "falling_blocks_scores_select" on public.falling_blocks_scores;
create policy "falling_blocks_scores_select"
  on public.falling_blocks_scores for select
  to authenticated
  using (true);

drop policy if exists "falling_blocks_scores_insert_own" on public.falling_blocks_scores;
create policy "falling_blocks_scores_insert_own"
  on public.falling_blocks_scores for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "falling_blocks_scores_update_own" on public.falling_blocks_scores;
create policy "falling_blocks_scores_update_own"
  on public.falling_blocks_scores for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists falling_blocks_scores_best_idx
  on public.falling_blocks_scores (best_score desc);
