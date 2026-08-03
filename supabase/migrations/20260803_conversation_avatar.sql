-- Group chats can carry a photo, shown in the rails and the thread header.
alter table public.conversations
  add column if not exists avatar_url text;
