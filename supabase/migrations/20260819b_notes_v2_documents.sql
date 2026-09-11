-- Notes v2: from one shared notepad per conversation to a document
-- list — bands accumulate one note per show/broadcast/flight sheet
-- (Steven's 썸머소닉 use case). The v1 single-row table shipped hours
-- earlier and holds no data worth keeping — drop and rebuild.
drop table if exists public.conversation_notes;

create table public.conversation_notes (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  title           text not null default '',
  content         text not null default '',
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index conversation_notes_conv_idx
  on public.conversation_notes (conversation_id, updated_at desc);

alter table public.conversation_notes enable row level security;

drop policy if exists "conv_notes_select" on public.conversation_notes;
create policy "conv_notes_select" on public.conversation_notes
  for select using (public.is_conversation_member(conversation_id));

drop policy if exists "conv_notes_insert" on public.conversation_notes;
create policy "conv_notes_insert" on public.conversation_notes
  for insert with check (public.is_conversation_member(conversation_id));

drop policy if exists "conv_notes_update" on public.conversation_notes;
create policy "conv_notes_update" on public.conversation_notes
  for update using (public.is_conversation_member(conversation_id));

drop policy if exists "conv_notes_delete" on public.conversation_notes;
create policy "conv_notes_delete" on public.conversation_notes
  for delete using (public.is_conversation_member(conversation_id));

do $$
begin
  alter publication supabase_realtime add table public.conversation_notes;
exception when duplicate_object then null;
end $$;
