-- Tasks — "하로 2절 보컬 다시 금요일까지": one line per thing a room has
-- to do, with a person and a day read from the sentence. A task belongs
-- to a room (conversation) or, with no room, to the person who wrote
-- it. Finishing one is marked here and told in the room's chat by the
-- client.

create table if not exists public.room_tasks (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  created_by      uuid not null references auth.users(id) on delete cascade,
  assignee_id     uuid references auth.users(id) on delete set null,
  title           text not null check (char_length(title) between 1 and 200),
  note            text check (char_length(note) <= 500),
  due_on          date,
  done_at         timestamptz,
  done_by         uuid references auth.users(id) on delete set null,
  position        int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists room_tasks_conv_idx on public.room_tasks (conversation_id, done_at, due_on);
create index if not exists room_tasks_assignee_idx on public.room_tasks (assignee_id, done_at, due_on);
create index if not exists room_tasks_creator_idx on public.room_tasks (created_by, done_at, due_on);

alter table public.room_tasks enable row level security;

-- A room's members share its tasks; a task with no room is its writer's.
drop policy if exists "tasks: read" on public.room_tasks;
create policy "tasks: read" on public.room_tasks
  for select to authenticated
  using (
    (conversation_id is not null and public.is_conversation_member(conversation_id))
    or (conversation_id is null and created_by = auth.uid())
    or assignee_id = auth.uid()
  );

drop policy if exists "tasks: insert" on public.room_tasks;
create policy "tasks: insert" on public.room_tasks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (conversation_id is null or public.is_conversation_member(conversation_id))
  );

drop policy if exists "tasks: update" on public.room_tasks;
create policy "tasks: update" on public.room_tasks
  for update to authenticated
  using (
    (conversation_id is not null and public.is_conversation_member(conversation_id))
    or (conversation_id is null and created_by = auth.uid())
  )
  with check (
    (conversation_id is not null and public.is_conversation_member(conversation_id))
    or (conversation_id is null and created_by = auth.uid())
  );

drop policy if exists "tasks: delete" on public.room_tasks;
create policy "tasks: delete" on public.room_tasks
  for delete to authenticated
  using (
    created_by = auth.uid()
    or (conversation_id is not null and public.is_conversation_member(conversation_id))
  );

grant select, insert, update, delete on public.room_tasks to authenticated;

-- Realtime: the room sees a task land or finish as it happens.
do $$ begin
  alter publication supabase_realtime add table public.room_tasks;
exception when duplicate_object then null; end $$;
