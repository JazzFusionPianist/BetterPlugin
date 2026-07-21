-- Drawing support for the home canvas. A kind='drawing' item stores its
-- coloured-pencil strokes as vector data (jsonb) instead of an R2 media
-- file — a few KB per doodle, re-editable, and effectively free to store.
-- Shape: [{ c: "#hex", w: number, p: [x0,y0, x1,y1, ...] }, ...]
-- where every coordinate is a 0..1 fraction of the canvas, matching how
-- photo x/y are stored.
alter table public.canvas_items add column if not exists strokes jsonb;
