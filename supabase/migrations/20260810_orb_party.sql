-- Orb Party — dice board game rooms (2-4 players).
--
-- Room model follows poker_rooms: player_ids array (host first), ready
-- flags, and one jsonb `state` blob that the active player's client
-- advances (dice, holds, rolls left, per-player scorecards). Bots are
-- driven by the host's client, same as falling blocks.

CREATE TABLE IF NOT EXISTS public.orb_party_rooms (
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

CREATE INDEX IF NOT EXISTS orb_party_rooms_status_idx ON public.orb_party_rooms(status);
CREATE INDEX IF NOT EXISTS orb_party_rooms_players_idx ON public.orb_party_rooms USING gin(player_ids);

CREATE OR REPLACE FUNCTION public.orb_party_rooms_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orb_party_rooms_touch ON public.orb_party_rooms;
CREATE TRIGGER orb_party_rooms_touch
  BEFORE UPDATE ON public.orb_party_rooms
  FOR EACH ROW EXECUTE FUNCTION public.orb_party_rooms_touch_updated_at();

ALTER TABLE public.orb_party_rooms ENABLE ROW LEVEL SECURITY;

-- Same open semantics as the other game rooms: any signed-in user can
-- read (invites resolve rooms by id) and update (join fills player_ids;
-- the host's client writes bot turns).
DROP POLICY IF EXISTS "orb_party_rooms_select" ON public.orb_party_rooms;
CREATE POLICY "orb_party_rooms_select" ON public.orb_party_rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "orb_party_rooms_insert" ON public.orb_party_rooms;
CREATE POLICY "orb_party_rooms_insert" ON public.orb_party_rooms
  FOR INSERT WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "orb_party_rooms_update" ON public.orb_party_rooms;
CREATE POLICY "orb_party_rooms_update" ON public.orb_party_rooms
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "orb_party_rooms_delete" ON public.orb_party_rooms;
CREATE POLICY "orb_party_rooms_delete" ON public.orb_party_rooms
  FOR DELETE USING (host_id = auth.uid() OR auth.uid() = ANY(player_ids));

ALTER PUBLICATION supabase_realtime ADD TABLE public.orb_party_rooms;

