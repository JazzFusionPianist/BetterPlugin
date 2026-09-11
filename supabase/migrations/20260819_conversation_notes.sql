-- Shared per-conversation notepad — the greenroom "notes" tab.
-- One row per conversation (the page IS the conversation's note);
-- last write wins, Realtime fans the edit out to everyone in the room.

BEGIN;

create table if not exists public.conversation_notes (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  content         text not null default '',
  updated_by      uuid,
  updated_at      timestamptz default now()
);

alter table public.conversation_notes enable row level security;

-- Members read and write their room's page. is_conversation_member() is
-- the existing SECURITY DEFINER helper, so no policy recursion.
drop policy if exists "conversation_notes_select" on public.conversation_notes;
create policy "conversation_notes_select" on public.conversation_notes
  for select using (public.is_conversation_member(conversation_id));

drop policy if exists "conversation_notes_insert" on public.conversation_notes;
create policy "conversation_notes_insert" on public.conversation_notes
  for insert with check (public.is_conversation_member(conversation_id));

drop policy if exists "conversation_notes_update" on public.conversation_notes;
create policy "conversation_notes_update" on public.conversation_notes
  for update using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));

COMMIT;

-- Realtime: stream note edits so open notes tabs update live.
-- Idempotent — the DO block swallows "already in publication" on re-run.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_notes;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
