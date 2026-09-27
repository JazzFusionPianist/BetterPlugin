create table private.storage_erasure_jobs(
  id bigint generated always as identity primary key,bucket text not null,name text not null,
  attempts int not null default 0,available_at timestamptz not null default now(),lease_until timestamptz,completed_at timestamptz,
  unique(bucket,name)
);
alter table private.storage_erasure_jobs enable row level security;
revoke all on private.storage_erasure_jobs from public,anon,authenticated;
create function private.queue_deleted_user_storage() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into private.storage_erasure_jobs(bucket,name)
  select bucket_id,name from storage.objects o where to_jsonb(o)->>'owner_id'=old.id::text
    or (bucket_id='avatars' and split_part(name,'/',1)=old.id::text)
  on conflict(bucket,name) do update set available_at=now(),completed_at=null;
  return old;
end $$;
revoke all on function private.queue_deleted_user_storage() from public,anon,authenticated;
create trigger queue_deleted_user_storage before delete on auth.users for each row execute function private.queue_deleted_user_storage();
create function public.claim_storage_erasures() returns table(id bigint,bucket text,name text)
language sql security definer set search_path='' as $$
  with jobs as (select j.id from private.storage_erasure_jobs j where completed_at is null and available_at<=now()
    and (lease_until is null or lease_until<now()) order by j.id for update skip locked limit 25)
  update private.storage_erasure_jobs j set lease_until=now()+interval '5 minutes',attempts=attempts+1
    from jobs where j.id=jobs.id returning j.id,j.bucket,j.name;
$$;
create function public.finish_storage_erasure(p_id bigint,p_success boolean) returns void
language sql security definer set search_path='' as $$
  update private.storage_erasure_jobs set lease_until=null,completed_at=case when p_success then now() end,
    available_at=now()+interval '5 minutes'*least(attempts,288) where id=p_id;
$$;
revoke all on function public.claim_storage_erasures(),public.finish_storage_erasure(bigint,boolean) from public,anon,authenticated;
grant execute on function public.claim_storage_erasures(),public.finish_storage_erasure(bigint,boolean) to service_role;

-- A stolen token from an already revoked session cannot request account deletion.
-- Keep the previous implementation and its existing FK cleanup in a private wrapper.
alter function public.delete_my_account() rename to delete_my_account_internal;
alter function public.delete_my_account_internal() set schema private;
revoke all on function private.delete_my_account_internal() from public,anon,authenticated;
create function public.delete_my_account() returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.security_check_session();
  perform private.delete_my_account_internal();
end $$;
revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;
