-- Wall items can be pinch-resized: per-item scale factor (1 = original).
alter table public.canvas_items
  add column if not exists scale real not null default 1;
