-- Track privacy: public/private + per-track allow-list of follower user_ids.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS allowed_user_ids uuid[] NOT NULL DEFAULT '{}';

-- GIN index so the array `contains` lookup in the SELECT policy stays fast.
CREATE INDEX IF NOT EXISTS tracks_allowed_user_ids_gin
  ON public.tracks USING gin (allowed_user_ids);

-- SELECT policy: owner sees everything, otherwise public-only OR explicit allow-list.
-- (Adjust the policy name if your existing one uses a different identifier.)
DROP POLICY IF EXISTS "tracks_select" ON public.tracks;
CREATE POLICY "tracks_select" ON public.tracks
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_private = false
    OR auth.uid() = ANY (allowed_user_ids)
  );

-- Owner-only INSERT / UPDATE / DELETE policies (idempotent).
DROP POLICY IF EXISTS "tracks_insert" ON public.tracks;
CREATE POLICY "tracks_insert" ON public.tracks
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "tracks_update" ON public.tracks;
CREATE POLICY "tracks_update" ON public.tracks
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "tracks_delete" ON public.tracks;
CREATE POLICY "tracks_delete" ON public.tracks
  FOR DELETE USING (user_id = auth.uid());

-- Make sure RLS is on (no-op if already enabled).
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
