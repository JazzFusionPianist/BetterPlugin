-- Platform authority must never come from a user-editable profile.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table private.platform_admins enable row level security;
revoke all on private.platform_admins from public, anon, authenticated;
grant all on private.platform_admins to service_role;
-- Preserve existing operators. Review this bootstrap list against account records.
insert into private.platform_admins(user_id)
select id from public.profiles where is_admin is true;

create table private.security_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  subject_id uuid,
  created_at timestamptz not null default now()
);
alter table private.security_events enable row level security;
revoke all on private.security_events from public, anon, authenticated;
grant select, insert, delete on private.security_events to service_role;
grant usage on sequence private.security_events_id_seq to service_role;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from private.platform_admins where user_id = auth.uid()
  );
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;

create or replace function private.require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() or coalesce(auth.jwt()->>'aal', '') <> 'aal2' then
    raise exception 'Administrator MFA required' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_admin() from public, anon, authenticated;

create or replace function private.guard_profile_authority()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') in ('authenticated','anon') then
    if new.is_admin is distinct from exists (
      select 1 from private.platform_admins where user_id = new.id
    ) then
      raise exception 'Platform role is server managed' using errcode = '42501';
    end if;
    if (tg_op = 'INSERT' and coalesce(new.is_verified, false))
       or (tg_op = 'UPDATE' and new.is_verified is distinct from old.is_verified) then
      perform private.require_admin();
      insert into private.security_events(actor_id, action, subject_id)
        values(auth.uid(), 'profile.verification_changed', new.id);
    end if;
    if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.member_no is distinct from old.member_no) then
      raise exception 'Profile identity is immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_profile_authority() from public, anon, authenticated;
create trigger guard_profile_authority before insert or update on public.profiles
for each row execute function private.guard_profile_authority();

revoke all on public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert(id, display_name, username, avatar_color, avatar_url, bio, updated_at)
  on public.profiles to authenticated;
grant update(display_name, username, avatar_color, avatar_url, bio, updated_at, is_verified)
  on public.profiles to authenticated;

drop policy if exists "admins can update any profile" on public.profiles;
create policy "admins can update any profile" on public.profiles
for update to authenticated
using (public.is_platform_admin() and auth.jwt()->>'aal' = 'aal2')
with check (public.is_platform_admin() and auth.jwt()->>'aal' = 'aal2');

create or replace function public.admin_get_user_details(target_user_id uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare result json;
begin
  perform private.require_admin();
  select json_build_object('id',u.id,'email',u.email,'created_at',u.created_at,
    'last_sign_in_at',u.last_sign_in_at,'display_name',p.display_name,
    'avatar_color',p.avatar_color,'is_verified',p.is_verified,
    'is_admin',exists(select 1 from private.platform_admins a where a.user_id=u.id),
    'updated_at',p.updated_at) into result
  from auth.users u left join public.profiles p on p.id=u.id where u.id=target_user_id;
  insert into private.security_events(actor_id,action,subject_id)
    values(auth.uid(),'admin.user_details_read',target_user_id);
  return result;
end;
$$;
create or replace function public.admin_delete_user(target_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if target_user_id = auth.uid() then
    raise exception 'Use account deletion for your own account' using errcode = '42501';
  end if;
  insert into private.security_events(actor_id,action,subject_id)
    values(auth.uid(),'admin.user_deleted',target_user_id);
  delete from auth.users where id=target_user_id;
end;
$$;
revoke all on function public.admin_get_user_details(uuid) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_get_user_details(uuid), public.admin_delete_user(uuid) to authenticated;

-- Replace all policy references to the old profile flag, including credits.
drop policy if exists "credits: read" on public.profile_credits;
create policy "credits: read" on public.profile_credits for select to authenticated
using(user_id=auth.uid() or status='approved' or (public.is_platform_admin() and auth.jwt()->>'aal'='aal2'));
drop policy if exists "credits: owner or admin update" on public.profile_credits;
create policy "credits: owner or admin update" on public.profile_credits for update to authenticated
using(user_id=auth.uid() or (public.is_platform_admin() and auth.jwt()->>'aal'='aal2'))
with check(user_id=auth.uid() or (public.is_platform_admin() and auth.jwt()->>'aal'='aal2'));
drop policy if exists "credits: owner or admin delete" on public.profile_credits;
create policy "credits: owner or admin delete" on public.profile_credits for delete to authenticated
using(user_id=auth.uid() or (public.is_platform_admin() and auth.jwt()->>'aal'='aal2'));

create or replace function public.profile_credits_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_platform_admin() and auth.jwt()->>'aal'='aal2' then
    if tg_op='UPDATE' and new.status is distinct from old.status then
      new.reviewed_at:=now(); new.reviewed_by:=auth.uid();
    end if;
    return new;
  end if;
  if tg_op='INSERT' then
    new.status:='pending'; new.reviewed_at:=null; new.reviewed_by:=null; new.note:=null;
  else
    new.status:=old.status; new.reviewed_at:=old.reviewed_at;
    new.reviewed_by:=old.reviewed_by; new.note:=old.note;
    if (new.work,new.artist,new.part,new.year,new.link) is distinct from
       (old.work,old.artist,old.part,old.year,old.link) then
      new.status:='pending'; new.reviewed_at:=null; new.reviewed_by:=null; new.note:=null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.profile_credits_guard() from public, anon, authenticated;
alter function public.handle_new_user() set search_path = public, pg_temp;
revoke all on function public.handle_new_user() from public, anon, authenticated;
