-- Credits — the "played bass on <song>" lines under a profile. A user
-- writes their own; each line waits for an admin to approve it before
-- anyone else can see it (a discography you can trust). Editing an
-- approved line sends it back to the queue.

create table if not exists public.profile_credits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  work        text not null check (char_length(work) between 1 and 120),   -- song / release
  artist      text check (char_length(artist) <= 120),
  part        text not null check (char_length(part) between 1 and 80),    -- bass, mix, lyrics…
  year        int check (year between 1900 and 2100),
  link        text check (char_length(link) <= 500),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note        text check (char_length(note) <= 300),                       -- reviewer's word, on reject
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists profile_credits_user_idx on public.profile_credits (user_id, status, position);
create index if not exists profile_credits_pending_idx on public.profile_credits (created_at) where status = 'pending';

alter table public.profile_credits enable row level security;

-- Owners see every line of their own; everyone signed in sees approved
-- lines; admins see the whole queue.
drop policy if exists "credits: read" on public.profile_credits;
create policy "credits: read" on public.profile_credits
  for select to authenticated
  using (
    user_id = auth.uid()
    or status = 'approved'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "credits: owner insert" on public.profile_credits;
create policy "credits: owner insert" on public.profile_credits
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "credits: owner or admin update" on public.profile_credits;
create policy "credits: owner or admin update" on public.profile_credits
  for update to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "credits: owner or admin delete" on public.profile_credits;
create policy "credits: owner or admin delete" on public.profile_credits
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- The verdict is the admin's alone. An owner's insert is always pending;
-- an owner's update can't touch status, and changing the credit itself
-- (work / artist / part / year / link) puts it back in the queue.
create or replace function public.profile_credits_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin boolean;
begin
  select coalesce(p.is_admin, false) into admin
  from public.profiles p where p.id = auth.uid();

  if coalesce(admin, false) then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.note := null;
    return new;
  end if;

  new.status := old.status;
  new.reviewed_at := old.reviewed_at;
  new.reviewed_by := old.reviewed_by;
  new.note := old.note;
  if (new.work, new.artist, new.part, new.year, new.link)
     is distinct from (old.work, old.artist, old.part, old.year, old.link) then
    new.status := 'pending';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.note := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_credits_guard on public.profile_credits;
create trigger profile_credits_guard
  before insert or update on public.profile_credits
  for each row execute function public.profile_credits_guard();

grant select, insert, update, delete on public.profile_credits to authenticated;
