-- Membership number: the order you joined orb. Stamped once from the
-- auth signup timestamp, then issued by sequence for every new profile —
-- the number never changes and is never recycled.

create sequence if not exists public.profiles_member_no_seq;

alter table public.profiles
  add column if not exists member_no bigint unique;

-- Backfill existing users in auth-signup order (id as tiebreak).
with ordered as (
  select p.id, row_number() over (order by u.created_at, u.id) as rn
  from public.profiles p
  join auth.users u on u.id = p.id
)
update public.profiles p
set member_no = o.rn
from ordered o
where p.id = o.id and p.member_no is null;

select setval(
  'public.profiles_member_no_seq',
  coalesce((select max(member_no) from public.profiles), 0) + 1,
  false
);

alter table public.profiles
  alter column member_no set default nextval('public.profiles_member_no_seq');
