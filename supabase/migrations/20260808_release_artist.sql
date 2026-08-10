-- A release carries its own artist credit ("steven & jazzfusionpianist")
-- separate from the account that owns it.
alter table public.releases
  add column if not exists artist text check (char_length(artist) <= 120);
