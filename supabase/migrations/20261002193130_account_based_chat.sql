-- Account-authenticated messaging replaces mandatory per-device identities.
-- Legacy encrypted rows and their validators remain intact during rollout.
create function private.account_file_key(p_url text) returns text
language plpgsql immutable set search_path='' as $$
declare k text;
begin
  if p_url is null or length(p_url)>8192 then raise exception 'Invalid attachment URL' using errcode='22023'; end if;
  if p_url like 'orb-file:%' then
    if p_url !~ '^orb-file:[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*(#e2ee=[A-Za-z0-9_-]{43})?$' then
      raise exception 'Invalid private attachment' using errcode='22023';
    end if;
    k:=split_part(substr(p_url,10),'#',1);
    if length(k)>512 or k like '%..%' or k ~ '(^|/)\.(/|$)' then
      raise exception 'Invalid private attachment' using errcode='22023';
    end if;
    return k;
  end if;
  -- Older public attachments still resolve through the authenticated resolver.
  if p_url !~ '^https://[^/@[:space:]]+\.[^/@[:space:]]+/[^[:space:]]*$' then
    raise exception 'Invalid attachment URL' using errcode='22023';
  end if;
  if p_url ~ '^https://pub-[a-z0-9]+\.r2\.dev/' then
    return split_part(regexp_replace(p_url,'^https://[^/]+/',''),'#',1);
  end if;
  return null;
end $$;
revoke all on function private.account_file_key(text) from public,anon,authenticated;

create function private.validate_account_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare tracks jsonb; item jsonb; k text;
begin
  perform public.security_rate_limit('message');
  perform 1 from public.conversations where id=new.conversation_id for update;
  if new.sender_id is distinct from auth.uid() or not public.is_conversation_member(new.conversation_id) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if tg_op='UPDATE' then
    if old.encrypted_payload is not null or new.id<>old.id or new.sender_id<>old.sender_id or new.conversation_id<>old.conversation_id then
      raise exception 'Message identity is immutable' using errcode='42501';
    end if;
  end if;
  if new.content is null or octet_length(new.content)>65536 or octet_length(to_jsonb(new)::text)>1048576
    or coalesce(cardinality(new.attachment_keys),0)>64 then
    raise exception 'Invalid message' using errcode='22023';
  end if;
  if new.attachment_url is null then
    if nullif(trim(new.content),'') is null or new.attachment_type is not null or coalesce(cardinality(new.attachment_keys),0)<>0 then
      raise exception 'Empty message or invalid attachment' using errcode='22023';
    end if;
  elsif new.attachment_type='game_invite' then
    if new.attachment_url !~ '^[0-9a-fA-F-]{36}$' or coalesce(cardinality(new.attachment_keys),0)<>0 then
      raise exception 'Invalid game invite' using errcode='22023';
    end if;
  else
    if new.attachment_type is null or new.attachment_type not in ('audio','multi-audio','image','video','file') then
      raise exception 'Invalid attachment type' using errcode='22023';
    end if;
    if new.attachment_type='multi-audio' then
      tracks:=new.attachment_url::jsonb;
      if jsonb_typeof(tracks) is distinct from 'array' then raise exception 'Invalid audio list' using errcode='22023'; end if;
      if jsonb_array_length(tracks)<1 or jsonb_array_length(tracks)>64 then raise exception 'Invalid audio list' using errcode='22023'; end if;
      for item in select value from jsonb_array_elements(tracks) loop
        if jsonb_typeof(item->'url') is distinct from 'string' or jsonb_typeof(item->'name') is distinct from 'string' then
          raise exception 'Invalid audio entry' using errcode='22023';
        end if;
        k:=private.account_file_key(item->>'url');
        if k is not null and not coalesce(k=any(new.attachment_keys),false) then raise exception 'Missing file reference' using errcode='42501'; end if;
      end loop;
    else
      k:=private.account_file_key(new.attachment_url);
      if k is not null and not coalesce(k=any(new.attachment_keys),false) then raise exception 'Missing file reference' using errcode='42501'; end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.validate_account_message() from public,anon,authenticated;

create function private.validate_account_stem() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text;
begin
  perform public.security_rate_limit('message');
  perform 1 from public.conversations where id=new.conversation_id for update;
  if new.uploader_id is distinct from auth.uid() or not public.is_conversation_member(new.conversation_id) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if tg_op='UPDATE' then
    if old.encrypted_payload is not null or new.id<>old.id or new.uploader_id<>old.uploader_id or new.conversation_id<>old.conversation_id then
      raise exception 'Stem identity is immutable' using errcode='42501';
    end if;
  end if;
  if nullif(trim(new.file_name),'') is null or length(new.file_name)>512 or octet_length(to_jsonb(new)::text)>1048576 then
    raise exception 'Invalid stem' using errcode='22023';
  end if;
  k:=private.account_file_key(new.file_url);
  if k is null or k is distinct from new.file_key then raise exception 'Invalid file reference' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function private.validate_account_stem() from public,anon,authenticated;

drop trigger require_encrypted_message on public.messages;
create trigger require_encrypted_message before insert on public.messages
for each row when (new.encrypted_payload is not null) execute function private.require_encrypted_message();
drop trigger encrypted_message_upgrade on public.messages;
create trigger encrypted_message_upgrade before update on public.messages
for each row when (new.encrypted_payload is not null) execute function private.require_encrypted_message();
drop trigger require_encrypted_stem on public.conversation_stems;
create trigger require_encrypted_stem before insert on public.conversation_stems
for each row when (new.encrypted_payload is not null) execute function private.require_encrypted_stem();
drop trigger encrypted_stem_upgrade on public.conversation_stems;
create trigger encrypted_stem_upgrade before update on public.conversation_stems
for each row when (new.encrypted_payload is not null) execute function private.require_encrypted_stem();

create trigger account_message_guard before insert or update on public.messages
for each row when (new.encrypted_payload is null) execute function private.validate_account_message();
create trigger account_stem_guard before insert or update on public.conversation_stems
for each row when (new.encrypted_payload is null) execute function private.validate_account_stem();

-- Do not let an old settings button convert shared account history back into
-- records tied to a device key. Existing ciphertext is preserved, not rewritten.
revoke execute on function public.upgrade_encrypted_history(text,uuid,jsonb,text[]) from authenticated;
