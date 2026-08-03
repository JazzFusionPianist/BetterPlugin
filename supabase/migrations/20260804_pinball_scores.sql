-- Pinball world leaderboard: one row per user holding their personal best.
-- Read: everyone (it's a world ranking). Write: own row only.
create table if not exists public.pinball_scores (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  best_score integer not null default 0 check (best_score >= 0),
  plays integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.pinball_scores enable row level security;

drop policy if exists "pinball_scores_select" on public.pinball_scores;
create policy "pinball_scores_select"
  on public.pinball_scores for select
  to authenticated
  using (true);

drop policy if exists "pinball_scores_insert_own" on public.pinball_scores;
create policy "pinball_scores_insert_own"
  on public.pinball_scores for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pinball_scores_update_own" on public.pinball_scores;
create policy "pinball_scores_update_own"
  on public.pinball_scores for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists pinball_scores_best_idx
  on public.pinball_scores (best_score desc);
