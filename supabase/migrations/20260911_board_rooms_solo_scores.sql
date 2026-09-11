-- Six new mini-games (2026-09-11).
--   solo:   sudoku / minesweeper / solitaire  → one <game>_scores table each
--           (personal best + world ranking, mirrors orb_merge_scores)
--   2-player: connect4 / gomoku / reversi     → ONE shared board_rooms table
--           (host/guest seats like chess's game_rooms, but the board is a
--           plain grid so the three games share every column).

-- ── solo world rankings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sudoku_scores (
  user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  best_score  integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  plays       integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.minesweeper_scores (
  user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  best_score  integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  plays       integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.solitaire_scores (
  user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  best_score  integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  plays       integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sudoku_scores', 'minesweeper_scores', 'solitaire_scores'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t || '_insert_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t || '_update_own', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (best_score DESC)', t || '_best_idx', t);
  END LOOP;
END $$;

-- ── board_rooms — connect4 / gomoku / reversi ───────────────────────────────
-- Two seats (host / guest) like chess. `turn` and `first_player` are seat
-- names, not colours; the rematch flips first_player. `computer` marks a
-- solo game against the built-in opponent (guest_id stays NULL, so those
-- rooms leave no head-to-head record). winner_id carries no FK on purpose:
-- a computer win stores the synthetic computer-player id.
CREATE TABLE IF NOT EXISTS public.board_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type     text NOT NULL CHECK (game_type IN ('connect4', 'gomoku', 'reversi')),
  host_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'lobby'
                 CHECK (status IN ('lobby', 'playing', 'finished')),
  board         jsonb,
  turn          text NOT NULL DEFAULT 'host' CHECK (turn IN ('host', 'guest')),
  first_player  text NOT NULL DEFAULT 'host' CHECK (first_player IN ('host', 'guest')),
  computer      boolean NOT NULL DEFAULT false,
  winner_id     uuid,
  last_move     jsonb,
  move_count    integer NOT NULL DEFAULT 0,
  host_ready    boolean NOT NULL DEFAULT false,
  guest_ready   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_rooms_host_idx  ON public.board_rooms(host_id, status);
CREATE INDEX IF NOT EXISTS board_rooms_guest_idx ON public.board_rooms(guest_id, status);

CREATE OR REPLACE FUNCTION public.board_rooms_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS board_rooms_touch ON public.board_rooms;
CREATE TRIGGER board_rooms_touch
  BEFORE UPDATE ON public.board_rooms
  FOR EACH ROW EXECUTE FUNCTION public.board_rooms_touch_updated_at();

ALTER TABLE public.board_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_rooms_select" ON public.board_rooms;
CREATE POLICY "board_rooms_select" ON public.board_rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "board_rooms_insert" ON public.board_rooms;
CREATE POLICY "board_rooms_insert" ON public.board_rooms
  FOR INSERT WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "board_rooms_update" ON public.board_rooms;
CREATE POLICY "board_rooms_update" ON public.board_rooms
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "board_rooms_delete" ON public.board_rooms;
CREATE POLICY "board_rooms_delete" ON public.board_rooms
  FOR DELETE USING (host_id = auth.uid() OR guest_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.board_rooms;
