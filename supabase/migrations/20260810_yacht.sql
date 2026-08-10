-- Yacht Dice — turn-based dice game (2-4 players) + solo world leaderboard.
--
-- Room model follows poker_rooms: player_ids array (host first), ready
-- flags, and one jsonb `state` blob that the active player's client
-- advances (dice, holds, rolls left, per-player scorecards). Bots are
-- driven by the host's client, same as falling blocks.

CREATE TABLE IF NOT EXISTS public.yacht_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_count  int  NOT NULL DEFAULT 4 CHECK (player_count BETWEEN 2 AND 4),
  status        text NOT NULL DEFAULT 'lobby'
                 CHECK (status IN ('lobby', 'playing', 'finished')),
  player_ids    uuid[] NOT NULL DEFAULT '{}',
  ready_ids     uuid[] NOT NULL DEFAULT '{}',
  state         jsonb NOT NULL DEFAULT '{}'::jsonb,
  winner_id     uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS yacht_rooms_status_idx ON public.yacht_rooms(status);
CREATE INDEX IF NOT EXISTS yacht_rooms_players_idx ON public.yacht_rooms USING gin(player_ids);

CREATE OR REPLACE FUNCTION public.yacht_rooms_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS yacht_rooms_touch ON public.yacht_rooms;
CREATE TRIGGER yacht_rooms_touch
  BEFORE UPDATE ON public.yacht_rooms
  FOR EACH ROW EXECUTE FUNCTION public.yacht_rooms_touch_updated_at();

ALTER TABLE public.yacht_rooms ENABLE ROW LEVEL SECURITY;

-- Same open semantics as the other game rooms: any signed-in user can
-- read (invites resolve rooms by id) and update (join fills player_ids;
-- the host's client writes bot turns).
DROP POLICY IF EXISTS "yacht_rooms_select" ON public.yacht_rooms;
CREATE POLICY "yacht_rooms_select" ON public.yacht_rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "yacht_rooms_insert" ON public.yacht_rooms;
CREATE POLICY "yacht_rooms_insert" ON public.yacht_rooms
  FOR INSERT WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "yacht_rooms_update" ON public.yacht_rooms;
CREATE POLICY "yacht_rooms_update" ON public.yacht_rooms
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "yacht_rooms_delete" ON public.yacht_rooms;
CREATE POLICY "yacht_rooms_delete" ON public.yacht_rooms
  FOR DELETE USING (host_id = auth.uid() OR auth.uid() = ANY(player_ids));

ALTER PUBLICATION supabase_realtime ADD TABLE public.yacht_rooms;

-- Solo world leaderboard — one personal-best row per user, same shape as
-- pinball_scores / falling_blocks_scores.
CREATE TABLE IF NOT EXISTS public.yacht_scores (
  user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  best_score  integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  plays       integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.yacht_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yacht_scores_select" ON public.yacht_scores;
CREATE POLICY "yacht_scores_select" ON public.yacht_scores
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "yacht_scores_insert_own" ON public.yacht_scores;
CREATE POLICY "yacht_scores_insert_own" ON public.yacht_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "yacht_scores_update_own" ON public.yacht_scores;
CREATE POLICY "yacht_scores_update_own" ON public.yacht_scores
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS yacht_scores_best_idx ON public.yacht_scores (best_score DESC);
