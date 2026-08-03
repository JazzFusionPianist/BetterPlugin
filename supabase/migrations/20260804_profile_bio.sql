-- Personal bio shown under the profile on the orb home.
alter table public.profiles add column if not exists bio text;
