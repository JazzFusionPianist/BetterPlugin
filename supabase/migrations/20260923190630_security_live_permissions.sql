-- Small-room WebRTC admission and server-authenticated signaling. This is not
-- an SFU: cap at eight viewers until a server-enforced media tier is deployed.
alter table public.live_sessions add column audience text not null default 'authenticated'
  check(audience in ('authenticated','invited'));
alter table public.live_sessions add column heartbeat_at timestamptz not null default now();
revoke insert,update,delete,truncate,references,trigger on public.live_sessions from anon,authenticated;

create table private.live_admissions (
  session_id uuid references public.live_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  heartbeat_at timestamptz not null default now(), primary key(session_id,user_id)
);
create table private.live_invitations (
  session_id uuid references public.live_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, primary key(session_id,user_id)
);
create table private.live_bans (
  session_id uuid references public.live_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, primary key(session_id,user_id)
);
create table private.live_signals (
  id bigint generated always as identity primary key,
  session_id uuid references public.live_sessions(id) on delete cascade,
  recipient uuid not null, payload jsonb not null, created_at timestamptz not null default now()
);
create index live_signals_recipient on private.live_signals(session_id,recipient);
create table private.live_chat_messages (
  id uuid primary key default gen_random_uuid(), session_id uuid references public.live_sessions(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  content text not null check(length(content) between 1 and 2000), created_at timestamptz not null default now()
);
create index live_chat_session on private.live_chat_messages(session_id,created_at);
alter table private.live_admissions enable row level security;
alter table private.live_invitations enable row level security;
alter table private.live_bans enable row level security;
alter table private.live_signals enable row level security;
alter table private.live_chat_messages enable row level security;
revoke all on private.live_admissions,private.live_invitations,private.live_bans,private.live_signals,private.live_chat_messages from public,anon,authenticated;

create function private.can_view_live(sid uuid,uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.live_sessions s where s.id=sid
    and s.heartbeat_at>now()-interval '45 seconds'
    and not exists(select 1 from private.live_bans b where b.session_id=sid and b.user_id=uid)
    and (s.host_id=uid or s.audience='authenticated' or exists(
      select 1 from private.live_invitations i where i.session_id=sid and i.user_id=uid)));
$$;
revoke all on function private.can_view_live(uuid,uuid) from public,anon;
grant execute on function private.can_view_live(uuid,uuid) to authenticated;
drop policy if exists "live_sessions: read all" on public.live_sessions;
create policy live_visible on public.live_sessions for select to authenticated
using(private.can_view_live(id,auth.uid()));

create function public.live_start(p_title text,p_video boolean,p_audio boolean,p_source text,p_audience text,p_invited uuid[] default '{}')
returns public.live_sessions language plpgsql security definer set search_path='' as $$
declare s public.live_sessions;
begin
  perform public.security_rate_limit('live_manage');
  if p_title is null or length(p_title)>120 or p_source is null or p_source not in ('daw','screen','camera','none')
    or p_audience is null or p_audience not in ('authenticated','invited') or coalesce(cardinality(p_invited),0)>8 then
    raise exception 'Invalid broadcast' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,12));
  delete from public.live_sessions where host_id=auth.uid() or heartbeat_at<now()-interval '1 hour';
  insert into public.live_sessions(host_id,title,has_video,has_audio,video_source,audience)
    values(auth.uid(),p_title,p_video,p_audio,p_source,p_audience) returning * into s;
  insert into private.live_invitations select s.id,uid from unnest(p_invited) uid where uid<>auth.uid() on conflict do nothing;
  insert into private.live_admissions(session_id,user_id) values(s.id,auth.uid());
  return s;
end;
$$;

create function public.live_join(p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
declare host uuid;
begin
  perform public.security_rate_limit('live_join');
  select host_id into host from public.live_sessions where id=p_session for update;
  if host is null or not private.can_view_live(p_session,auth.uid()) then raise exception 'Access denied' using errcode='42501'; end if;
  delete from private.live_admissions where session_id=p_session and heartbeat_at<now()-interval '45 seconds';
  if auth.uid()<>host and not exists(select 1 from private.live_admissions where session_id=p_session and user_id=auth.uid())
    and (select count(*) from private.live_admissions where session_id=p_session and user_id<>host)>=8 then
    raise exception 'Broadcast is full' using errcode='42501';
  end if;
  insert into private.live_admissions(session_id,user_id) values(p_session,auth.uid())
    on conflict(session_id,user_id) do update set heartbeat_at=now();
end;
$$;

create function public.live_check_access(p_session uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.security_check_session();
  if not private.can_view_live(p_session,auth.uid()) or not exists(select 1 from private.live_admissions
    where session_id=p_session and user_id=auth.uid() and heartbeat_at>now()-interval '45 seconds') then
    raise exception 'Access denied' using errcode='42501';
  end if;
end;
$$;

create function public.live_send_signal(p_session uuid,p_payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare host uuid; dest uuid; kind text:=p_payload->>'type'; payload jsonb;
begin
  perform public.security_rate_limit('live_signal');
  perform public.live_check_access(p_session);
  select host_id into host from public.live_sessions where id=p_session;
  if kind is null or kind not in ('join','offer','answer','ice','leave','bye','source','viewer_count') or octet_length(p_payload::text)>65536 then
    raise exception 'Invalid signal' using errcode='22023';
  end if;
  if (kind in ('offer','bye','source','viewer_count') and auth.uid()<>host)
    or (kind in ('answer','join','leave') and auth.uid()=host) then raise exception 'Access denied' using errcode='42501'; end if;
  payload:=(p_payload-'from'-'to')||jsonb_build_object('from',auth.uid());
  if kind in ('join','leave','answer') or (kind='ice' and auth.uid()<>host) then dest:=host;
  elsif kind in ('offer','ice') then dest:=(p_payload->>'to')::uuid;
    if dest is null or dest=host or not exists(select 1 from private.live_admissions a where a.session_id=p_session
      and a.user_id=dest and a.heartbeat_at>now()-interval '45 seconds' and private.can_view_live(p_session,dest)) then
      raise exception 'Access denied' using errcode='42501';
    end if;
  end if;
  if dest is not null then
    insert into private.live_signals(session_id,recipient,payload) values(p_session,dest,payload||jsonb_build_object('to',dest));
  else
    insert into private.live_signals(session_id,recipient,payload)
      select p_session,a.user_id,payload from private.live_admissions a where a.session_id=p_session and a.user_id<>host
        and a.heartbeat_at>now()-interval '45 seconds' and private.can_view_live(p_session,a.user_id);
  end if;
end;
$$;

create function public.live_poll(p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare signals jsonb; members jsonb;
begin
  perform public.live_check_access(p_session);
  update public.live_sessions set heartbeat_at=now() where id=p_session and host_id=auth.uid();
  update private.live_admissions set heartbeat_at=now() where session_id=p_session and user_id=auth.uid();
  delete from private.live_signals where session_id=p_session and created_at<now()-interval '2 minutes';
  with consumed as (delete from private.live_signals where session_id=p_session and recipient=auth.uid() returning id,payload)
    select coalesce(jsonb_agg(payload order by id),'[]') into signals from consumed;
  select coalesce(jsonb_agg(user_id),'[]') into members from private.live_admissions a where session_id=p_session
    and heartbeat_at>now()-interval '45 seconds' and private.can_view_live(p_session,user_id);
  return jsonb_build_object('signals',signals,'members',members);
end;
$$;

create function public.live_manage(p_session uuid,p_action text,p_user uuid default null,p_video boolean default null,p_audio boolean default null,p_source text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.security_rate_limit('live_manage');
  if not exists(select 1 from public.live_sessions where id=p_session and host_id=auth.uid()) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_action='end' then delete from public.live_sessions where id=p_session;
  elsif p_action='ban' and p_user is not null and p_user<>auth.uid() then
    insert into private.live_bans values(p_session,p_user) on conflict do nothing;
    delete from private.live_admissions where session_id=p_session and user_id=p_user;
    delete from private.live_signals where session_id=p_session and recipient=p_user;
  elsif p_action='update' and (p_source is null or p_source in ('daw','screen','camera','none')) then
    update public.live_sessions set has_video=coalesce(p_video,has_video),has_audio=coalesce(p_audio,has_audio),video_source=coalesce(p_source,video_source) where id=p_session;
  else raise exception 'Invalid action' using errcode='22023'; end if;
end;
$$;

create function public.live_chat(p_session uuid,p_content text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.live_check_access(p_session);
  if p_content is not null then
    perform public.security_rate_limit('live_chat');
    if length(btrim(p_content)) not between 1 and 2000 then raise exception 'Invalid message' using errcode='22023'; end if;
    insert into private.live_chat_messages(session_id,sender_id,content) values(p_session,auth.uid(),btrim(p_content));
  end if;
  delete from private.live_chat_messages where session_id=p_session and created_at<now()-interval '1 hour';
  select coalesce(jsonb_agg(m order by m.ts),'[]') into result from (
    select c.id,c.sender_id as "senderId",coalesce(p.display_name,'User') as "senderName",coalesce(p.avatar_color,'#4A8FE7') as "senderColor",
      c.content,extract(epoch from c.created_at)*1000 as ts
    from private.live_chat_messages c left join public.profiles p on p.id=c.sender_id where c.session_id=p_session order by c.created_at desc limit 100
  ) m;
  return result;
end;
$$;

revoke all on function public.live_start(text,boolean,boolean,text,text,uuid[]),public.live_join(uuid),public.live_check_access(uuid),
  public.live_send_signal(uuid,jsonb),public.live_poll(uuid),public.live_manage(uuid,text,uuid,boolean,boolean,text),public.live_chat(uuid,text) from public,anon;
grant execute on function public.live_start(text,boolean,boolean,text,text,uuid[]),public.live_join(uuid),public.live_check_access(uuid),
  public.live_send_signal(uuid,jsonb),public.live_poll(uuid),public.live_manage(uuid,text,uuid,boolean,boolean,text),public.live_chat(uuid,text) to authenticated;
