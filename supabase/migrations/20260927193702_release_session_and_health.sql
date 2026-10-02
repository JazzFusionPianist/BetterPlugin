-- Revoke an application session without modifying Supabase-managed auth tables.
create table private.revoked_sessions (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 revoked_at timestamptz not null default now()
);
alter table private.revoked_sessions enable row level security;
revoke all on private.revoked_sessions from public,anon,authenticated;
create index revoked_sessions_user on private.revoked_sessions(user_id);

create or replace function public.security_session_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
 where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
 and (u.banned_until is null or u.banned_until<now())
 and (s.not_after is null or s.not_after>now())
 and not exists(select 1 from private.revoked_sessions r where r.session_id=s.id));
$$;
create or replace function public.security_check_session() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.security_session_active() then raise exception 'Session revoked or expired' using errcode='42501'; end if;
 return jsonb_build_object('id',auth.uid());
end $$;

revoke all on function public.security_session_active(),public.security_check_session() from public,anon;
grant execute on function public.security_session_active(),public.security_check_session() to authenticated;

create function public.security_list_sessions() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.security_check_session();
 return (select coalesce(jsonb_agg(x order by x.started_at desc),'[]') from (
   select s.id,s.id::text=auth.jwt()->>'session_id' as current,
     s.created_at as started_at,coalesce(s.refreshed_at at time zone 'UTC',s.updated_at,s.created_at) as last_seen_at,
     left(coalesce(s.user_agent,'Unknown device'),160) as device
   from auth.sessions s where s.user_id=auth.uid() and (s.not_after is null or s.not_after>now())
     and not exists(select 1 from private.revoked_sessions r where r.session_id=s.id)
   order by s.created_at desc limit 100
 ) x);
end $$;
create function public.security_revoke_session(p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.security_rate_limit('keys');
 if not exists(select 1 from auth.sessions where id=p_session and user_id=auth.uid()) then
   raise exception 'Access denied' using errcode='42501';
 end if;
 insert into private.revoked_sessions(session_id,user_id) values(p_session,auth.uid()) on conflict do nothing;
 insert into private.security_events(actor_id,action,subject_id) values(auth.uid(),'session.revoked',p_session);
end $$;
revoke all on function public.security_list_sessions(),public.security_revoke_session(uuid) from public,anon;
grant execute on function public.security_list_sessions(),public.security_revoke_session(uuid) to authenticated;

create table private.security_worker_health (
 worker text primary key check(worker='cleanup'),
 last_run_at timestamptz not null,last_success_at timestamptz,
 failed_jobs integer not null check(failed_jobs>=0)
);
alter table private.security_worker_health enable row level security;
revoke all on private.security_worker_health from public,anon,authenticated;
create function public.security_record_cleanup(p_failed integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_failed is null or p_failed<0 then raise exception 'Access denied' using errcode='42501'; end if;
 insert into private.security_worker_health values('cleanup',now(),case when p_failed=0 then now() end,p_failed)
 on conflict(worker) do update set last_run_at=now(),failed_jobs=p_failed,
 last_success_at=case when p_failed=0 then now() else private.security_worker_health.last_success_at end;
end $$;
create function public.security_health_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare stale boolean; stuck bigint; failed int;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
 select last_success_at is null or last_success_at<now()-interval '20 minutes',failed_jobs into stale,failed
 from private.security_worker_health where worker='cleanup';
 select count(*) into stuck from (
  select 1 from private.file_delete_jobs where completed_at is null and (available_at<now()-interval '30 minutes' or attempts>=3)
  union all select 1 from private.storage_erasure_jobs where completed_at is null and (available_at<now()-interval '30 minutes' or attempts>=3)
 ) j;
 return jsonb_build_object('cleanupFresh',not coalesce(stale,true),'deletionsHealthy',stuck=0 and coalesce(failed,0)=0);
end $$;
revoke all on function public.security_record_cleanup(integer),public.security_health_snapshot() from public,anon,authenticated;
grant execute on function public.security_record_cleanup(integer),public.security_health_snapshot() to service_role;
-- These membership helpers have no useful anonymous caller.
revoke execute on function public.is_conversation_member(uuid),public.is_mutual_follow(uuid) from public,anon;
grant execute on function public.is_conversation_member(uuid),public.is_mutual_follow(uuid) to authenticated;
;
