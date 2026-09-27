-- Authors can replace their own legacy plaintext in place. No direct UPDATE
-- grant is restored; immutable message identity and timestamps are preserved.
create trigger encrypted_message_upgrade before update on public.messages for each row execute function private.require_encrypted_message();
create trigger encrypted_stem_upgrade before update on public.conversation_stems for each row execute function private.require_encrypted_stem();
create trigger upgraded_message_references after update on public.messages for each row execute function private.register_file_references();
create trigger upgraded_stem_references after update on public.conversation_stems for each row execute function private.register_file_references();

create function public.upgrade_encrypted_history(p_kind text,p_id uuid,p_payload jsonb,p_keys text[] default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare cid uuid; k text;
begin
  perform public.security_check_session();
  if p_kind='message' then
    select conversation_id into cid from public.messages where id=p_id and sender_id=auth.uid() and encrypted_payload is null for update;
  elsif p_kind='stem' then
    select conversation_id into cid from public.conversation_stems where id=p_id and uploader_id=auth.uid() and encrypted_payload is null for update;
  else raise exception 'Invalid kind' using errcode='22023'; end if;
  if cid is null or not public.is_conversation_member(cid) then raise exception 'Access denied' using errcode='42501'; end if;
  -- Migrated attachments must be newly encrypted private uploads by this user.
  foreach k in array coalesce(p_keys,'{}') loop
    if not exists(select 1 from public.secure_files where object_key=k and owner_id=auth.uid() and storage='private' and status='ready' and mime='application/octet-stream') then
      raise exception 'Encrypted upload required' using errcode='42501';
    end if;
  end loop;
  if p_kind='message' then
    delete from private.file_references where message_id=p_id;
    update public.messages set content='🔒 Encrypted message',attachment_url=null,attachment_name=null,attachment_type=null,attachment_metadata=null,
      attachment_keys=p_keys,encrypted_payload=p_payload where id=p_id;
  else
    if cardinality(p_keys)<>1 then raise exception 'One file required' using errcode='22023'; end if;
    delete from private.file_references where stem_id=p_id;
    update public.conversation_stems set file_url='orb-encrypted:',file_name='Encrypted file',mime_type='application/octet-stream',timeline_metadata=null,
      file_key=p_keys[1],encrypted_payload=p_payload where id=p_id;
  end if;
end $$;
revoke all on function public.upgrade_encrypted_history(text,uuid,jsonb,text[]) from public,anon;
grant execute on function public.upgrade_encrypted_history(text,uuid,jsonb,text[]) to authenticated;
