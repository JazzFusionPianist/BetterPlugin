-- Orb Merge (solo suika-style, world leaderboard) + Sketch (draw & guess
-- rooms, 2-6 players). Room model mirrors yacht_rooms; scores mirror
-- pinball_scores.

-- ── orb_merge_scores ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orb_merge_scores (
  user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  best_score  integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  plays       integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orb_merge_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orb_merge_scores_select" ON public.orb_merge_scores;
CREATE POLICY "orb_merge_scores_select" ON public.orb_merge_scores
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "orb_merge_scores_insert_own" ON public.orb_merge_scores;
CREATE POLICY "orb_merge_scores_insert_own" ON public.orb_merge_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "orb_merge_scores_update_own" ON public.orb_merge_scores;
CREATE POLICY "orb_merge_scores_update_own" ON public.orb_merge_scores
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS orb_merge_scores_best_idx ON public.orb_merge_scores (best_score DESC);

-- ── sketch_rooms ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sketch_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_count  int  NOT NULL DEFAULT 6 CHECK (player_count BETWEEN 2 AND 6),
  status        text NOT NULL DEFAULT 'lobby'
                 CHECK (status IN ('lobby', 'playing', 'finished')),
  player_ids    uuid[] NOT NULL DEFAULT '{}',
  ready_ids     uuid[] NOT NULL DEFAULT '{}',
  state         jsonb NOT NULL DEFAULT '{}'::jsonb,
  winner_id     uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sketch_rooms_status_idx ON public.sketch_rooms(status);
CREATE INDEX IF NOT EXISTS sketch_rooms_players_idx ON public.sketch_rooms USING gin(player_ids);

CREATE OR REPLACE FUNCTION public.sketch_rooms_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sketch_rooms_touch ON public.sketch_rooms;
CREATE TRIGGER sketch_rooms_touch
  BEFORE UPDATE ON public.sketch_rooms
  FOR EACH ROW EXECUTE FUNCTION public.sketch_rooms_touch_updated_at();

ALTER TABLE public.sketch_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sketch_rooms_select" ON public.sketch_rooms;
CREATE POLICY "sketch_rooms_select" ON public.sketch_rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sketch_rooms_insert" ON public.sketch_rooms;
CREATE POLICY "sketch_rooms_insert" ON public.sketch_rooms
  FOR INSERT WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "sketch_rooms_update" ON public.sketch_rooms;
CREATE POLICY "sketch_rooms_update" ON public.sketch_rooms
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sketch_rooms_delete" ON public.sketch_rooms;
CREATE POLICY "sketch_rooms_delete" ON public.sketch_rooms
  FOR DELETE USING (host_id = auth.uid() OR auth.uid() = ANY(player_ids));

ALTER PUBLICATION supabase_realtime ADD TABLE public.sketch_rooms;
