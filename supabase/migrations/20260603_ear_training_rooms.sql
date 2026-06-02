-- Ear Training Duel — symmetric 2-player ear training game.
--
-- Design notes:
--   * No host/guest asymmetry. The first player to sit down is
--     player1, the next is player2. Both have identical capabilities.
--   * Questions are NOT stored — both clients deterministically
--     generate the same question from (id, current_round, config)
--     using a shared seeded RNG. Saves a write per round and rules out
--     question tampering.
--   * `config` (jsonb) is the only thing locked in at room creation
--     and feeds the question generator, so both players see the same
--     pool. Changing it requires both Ready flags to clear.
--   * `round_started_at` is the ground-truth timestamp for the per-
--     round timer — set when both players have arrived at the round.
--
-- Run via: supabase db push  (or paste into the Supabase SQL editor.)

CREATE TABLE IF NOT EXISTS public.ear_training_rooms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  status              text NOT NULL DEFAULT 'lobby'
                       CHECK (status IN ('lobby', 'playing', 'finished')),

  player1_ready       boolean NOT NULL DEFAULT false,
  player2_ready       boolean NOT NULL DEFAULT false,

  player1_score       int NOT NULL DEFAULT 0,
  player2_score       int NOT NULL DEFAULT 0,

  -- 0 during lobby, 1..total_rounds while playing. Both clients
  -- regenerate the question from (id, current_round, config) so we
  -- never have to store the question itself.
  current_round       int NOT NULL DEFAULT 0,
  total_rounds        int NOT NULL DEFAULT 10,

  -- Answers for the round currently in flight. NULL == hasn't answered.
  -- Cleared by whoever advances the round.
  player1_answer      text,
  player2_answer      text,

  -- Anchor for the round timer. Set when round increments.
  round_started_at    timestamptz,

  -- { modes: ['interval','chord'], difficulty: 'basic' | 'intermediate' | 'advanced' }
  config              jsonb NOT NULL DEFAULT '{
    "modes": ["interval", "chord"],
    "difficulty": "basic"
  }'::jsonb,

  winner_id           uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ear_training_rooms_player1_idx ON public.ear_training_rooms(player1_id);
CREATE INDEX IF NOT EXISTS ear_training_rooms_player2_idx ON public.ear_training_rooms(player2_id);
CREATE INDEX IF NOT EXISTS ear_training_rooms_status_idx  ON public.ear_training_rooms(status);

-- Touch updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION public.ear_training_rooms_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ear_training_rooms_touch ON public.ear_training_rooms;
CREATE TRIGGER ear_training_rooms_touch
  BEFORE UPDATE ON public.ear_training_rooms
  FOR EACH ROW EXECUTE FUNCTION public.ear_training_rooms_touch_updated_at();

ALTER TABLE public.ear_training_rooms ENABLE ROW LEVEL SECURITY;

-- SELECT: any participant (or any signed-in user if they're trying to
-- accept an invite — invite handler looks up by id). For simplicity and
-- to match game_rooms semantics, allow any authenticated user to read.
DROP POLICY IF EXISTS "ear_training_rooms_select" ON public.ear_training_rooms;
CREATE POLICY "ear_training_rooms_select" ON public.ear_training_rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: creator becomes player1.
DROP POLICY IF EXISTS "ear_training_rooms_insert" ON public.ear_training_rooms;
CREATE POLICY "ear_training_rooms_insert" ON public.ear_training_rooms
  FOR INSERT WITH CHECK (player1_id = auth.uid());

-- UPDATE: either participant. Includes the "join as player2" case
-- where player2_id is currently NULL and we're filling it in.
DROP POLICY IF EXISTS "ear_training_rooms_update" ON public.ear_training_rooms;
CREATE POLICY "ear_training_rooms_update" ON public.ear_training_rooms
  FOR UPDATE USING (
    player1_id = auth.uid()
    OR player2_id = auth.uid()
    OR (player2_id IS NULL AND auth.uid() IS NOT NULL)
  );

-- DELETE: either participant (used to clean up cancelled lobbies).
DROP POLICY IF EXISTS "ear_training_rooms_delete" ON public.ear_training_rooms;
CREATE POLICY "ear_training_rooms_delete" ON public.ear_training_rooms
  FOR DELETE USING (
    player1_id = auth.uid() OR player2_id = auth.uid()
  );

-- Realtime: include in the supabase_realtime publication so both
-- clients receive row updates as they happen.
ALTER PUBLICATION supabase_realtime ADD TABLE public.ear_training_rooms;
