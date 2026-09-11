-- Personal todos — the studio home prompt accepts plain tasks as well
-- as schedule text ("오늘 할 일"). Own rows only; no sharing.
create table if not exists public.todos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists todos_user_idx on public.todos (user_id, done, created_at desc);
alter table public.todos enable row level security;
drop policy if exists "todos_own" on public.todos;
create policy "todos_own" on public.todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
