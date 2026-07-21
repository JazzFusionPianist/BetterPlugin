-- Usernames: a unique handle alongside the free-form display name.
-- display_name stays whatever the user likes; username is lowercase,
-- 3-20 chars of [a-z0-9._], and can never collide (case-insensitive).

-- 1) Column
alter table public.profiles add column if not exists username text;

-- 2) Backfill existing rows: slug of display_name, else a generated
--    handle, suffixed past collisions.
do $$
declare
  r record;
  base text;
  candidate text;
  n int;
begin
  for r in select id, display_name from public.profiles where username is null loop
    base := left(regexp_replace(lower(coalesce(r.display_name, '')), '[^a-z0-9_.]', '', 'g'), 15);
    if base is null or length(base) < 3 then
      base := 'user' || substr(replace(r.id::text, '-', ''), 1, 4);
    end if;
    candidate := base;
    n := 1;
    while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
      candidate := base || n::text;
      n := n + 1;
    end loop;
    update public.profiles set username = candidate where id = r.id;
  end loop;
end $$;

-- 3) Constraints: case-insensitive uniqueness + format.
create unique index if not exists profiles_username_unique on public.profiles (lower(username));
alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9_.]{3,20}$');

-- 4) New signups: username arrives in auth metadata. Fall back to a
--    generated handle and suffix past collisions so signup never dies
--    (the plugin's signup doesn't send a username yet).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  base text;
  candidate text;
  n int;
begin
  base := left(regexp_replace(lower(coalesce(new.raw_user_meta_data->>'username', '')), '[^a-z0-9_.]', '', 'g'), 20);
  if base is null or length(base) < 3 then
    base := left(regexp_replace(lower(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))), '[^a-z0-9_.]', '', 'g'), 15);
  end if;
  if base is null or length(base) < 3 then
    base := 'user' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;
  candidate := base;
  n := 1;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    candidate := left(base, 15) || n::text;
    n := n + 1;
  end loop;
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    candidate
  );
  return new;
end;
$$;

-- 5) Anonymous availability check for the signup form (RLS keeps
--    profiles reads authenticated-only, so the form needs this RPC).
create or replace function public.username_available(u text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from profiles where lower(username) = lower(trim(u)));
$$;
grant execute on function public.username_available(text) to anon, authenticated;
