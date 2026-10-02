-- Keep the anonymous signup helper deliberately narrow. It exposes only a
-- boolean for syntactically valid public handles and never profile rows.
create or replace function public.username_available(u text)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if u is null or length(u) not between 3 and 20 or u !~ '^[a-z0-9_.]+$' then
    return false;
  end if;
  return not exists (
    select 1 from public.profiles where lower(username) = lower(u)
  );
end;
$$;
revoke all on function public.username_available(text) from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- Count plays only for active signed-in sessions and rate-limit artificial
-- inflation. The function remains a definer because listeners do not own the
-- track row they are incrementing.
create or replace function public.security_rate_limit(p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare cap int; used int;
begin
  perform public.security_check_session();
  cap:=case p_action when 'upload' then 30 when 'download' then 120 when 'delete' then 60
    when 'share' then 20 when 'play' then 120 when 'live_join' then 10 when 'live_signal' then 180
    when 'live_chat' then 20 when 'live_manage' then 20 when 'unfurl' then 20
    when 'schedule' then 10 when 'keys' then 20 when 'message' then 60 when 'conversation' then 10 else null end;
  if cap is null then raise exception 'Invalid action' using errcode='22023'; end if;
  insert into private.request_windows values(auth.uid(),p_action,date_trunc('minute',now()),1)
    on conflict(user_id,action,window_start) do update set requests=private.request_windows.requests+1
    returning requests into used;
  if used>cap then raise exception 'Rate limit exceeded'; end if;
end;
$$;
revoke all on function public.security_rate_limit(text) from public,anon;
grant execute on function public.security_rate_limit(text) to authenticated;

create or replace function public.bump_plays(track uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.security_rate_limit('play');
  update public.demo_tracks set plays = plays + 1 where id = track;
end;
$$;
revoke all on function public.bump_plays(uuid) from public, anon;
grant execute on function public.bump_plays(uuid) to authenticated;
;
