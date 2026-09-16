-- Senders can delete their own messages (files no longer expire, so
-- deletion is how storage gets reclaimed). RLS: own rows only.
drop policy if exists "msg_delete" on public.messages;
create policy "msg_delete" on public.messages
  for delete using (sender_id = auth.uid());

-- Realtime DELETE events only carry the primary key by default, so
-- conversation-filtered subscriptions never see them. FULL replica
-- identity puts the whole old row in the event.
alter table public.messages replica identity full;

-- Same treatment for stems so a deleted stem vanishes live in other
-- clients' filtered subscriptions, not on next load.
alter table public.conversation_stems replica identity full;
