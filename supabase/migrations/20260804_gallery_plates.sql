-- The wall becomes a curated gallery: three new plate kinds join
-- photo/video/drawing. track = audio player plate (media_url + title),
-- caption = text plate (caption), plaque = auto card (system-rendered).
alter table public.canvas_items drop constraint if exists canvas_items_kind_check;
alter table public.canvas_items add constraint canvas_items_kind_check
  check (kind = any (array['photo'::text, 'video'::text, 'drawing'::text,
                           'track'::text, 'caption'::text, 'plaque'::text]));
