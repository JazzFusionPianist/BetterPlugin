-- Discography categories: each shelf is a named, ordered section of the
-- artist's discography ("mixed and mastered", "arranged", …). Releases
-- point at a shelf; null = the unnamed default shelf.

create table if not exists public.shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 60),
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.releases
  add column if not exists shelf_id uuid references public.shelves(id) on delete set null;

alter table public.shelves enable row level security;

drop policy if exists "shelves_select" on public.shelves;
create policy "shelves_select" on public.shelves for select
  using (user_id = auth.uid() or public.is_mutual_follow(user_id));
drop policy if exists "shelves_write" on public.shelves;
create policy "shelves_write" on public.shelves for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists shelves_user_idx on public.shelves (user_id, position);
create index if not exists releases_shelf_idx on public.releases (shelf_id);
