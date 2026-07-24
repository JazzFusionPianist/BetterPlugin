-- Per-orientation wall layouts: phones arrange the portrait (2:3) page
-- via x/y/scale; wide screens (desktop / iPad landscape) get their own
-- slots for the landscape (3:2) page. Null = not arranged there yet →
-- clients fall back to the portrait values.
alter table public.canvas_items
  add column if not exists lx real,
  add column if not exists ly real,
  add column if not exists lscale real;
