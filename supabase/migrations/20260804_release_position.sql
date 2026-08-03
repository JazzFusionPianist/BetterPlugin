-- Releases are hand-ordered: position is the artist's own sequencing,
-- backfilled from the previous date ordering.
alter table public.releases add column if not exists position int not null default 0;
with ordered as (
  select id, row_number() over (
    partition by user_id
    order by released_on desc nulls last, created_at desc
  ) - 1 as rn
  from public.releases
)
update public.releases r set position = o.rn from ordered o where r.id = o.id;
