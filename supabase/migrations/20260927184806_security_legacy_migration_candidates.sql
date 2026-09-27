-- A server-only inventory gate. Public/draft portfolio reuse is never purged.
create function public.legacy_file_migration_candidate(p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f public.secure_files;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
  select * into f from public.secure_files where object_key=p_key;
  if not found or f.status<>'ready' or f.storage not in ('legacy','private')
    or p_key like 'private/%' or p_key like 'public/%' then
    raise exception 'Not a legacy migration candidate' using errcode='42501';
  end if;
  if exists(with urls as (
    select media_url u from public.canvas_items union select poster_url from public.canvas_items
    union select audio_url from public.demo_tracks union select media_url from public.gallery_photos
    union select media_url from public.release_tracks union select cover_url from public.releases
    union select audio_url from public.tracks union select cover_url from public.tracks
    union select avatar_url from public.profiles union select avatar_url from public.conversations
  ) select 1 from urls where split_part(split_part(u,'?',1),'#',1) like '%/'||p_key) then
    raise exception 'Publicly referenced file; retain original' using errcode='42501';
  end if;
  return to_jsonb(f)-'owner_id';
end $$;
revoke all on function public.legacy_file_migration_candidate(text) from public,anon,authenticated;
grant execute on function public.legacy_file_migration_candidate(text) to service_role;
