-- Tasks join the wall: a 'task' canvas item is a memo note with a title
-- (what), taken_at (when it's due) and caption (the details), plus a
-- checked-off state. The kind list keeps the widened prod set (the
-- gallery-plates kinds stayed in the constraint after the revert).
alter table public.canvas_items drop constraint if exists canvas_items_kind_check;
alter table public.canvas_items add constraint canvas_items_kind_check
  check (kind = any (array['photo'::text, 'video'::text, 'drawing'::text,
                           'track'::text, 'caption'::text, 'plaque'::text,
                           'task'::text]));
alter table public.canvas_items add column if not exists done boolean not null default false;
