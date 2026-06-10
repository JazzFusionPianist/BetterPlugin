-- Rename the Tetris room tables to match the Falling Blocks code.
--
-- The app-side Tetris → Falling Blocks rename (component / hook / table
-- references) shipped earlier, but the database tables were never
-- renamed — they stayed `tetris_rooms` / `tetris_player_states`. So
-- every Falling Blocks query (createRoom, joinRoom, state writes) hit a
-- non-existent relation and failed silently: "Create Room" did nothing.
--
-- ALTER ... RENAME preserves all data, indexes, RLS policies, triggers,
-- and realtime-publication membership (the publication follows the table
-- through a rename), so no other objects need touching.
--
-- Applied live via the Supabase SQL editor on 2026-06-10; committed here
-- so the schema history stays reproducible. Guarded so re-running (or
-- running against a DB that was already renamed) is a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tetris_rooms'
  ) THEN
    ALTER TABLE public.tetris_rooms RENAME TO falling_blocks_rooms;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tetris_player_states'
  ) THEN
    ALTER TABLE public.tetris_player_states RENAME TO falling_blocks_player_states;
  END IF;
END $$;

-- Nudge PostgREST to drop its cached schema so the new table names are
-- resolvable immediately instead of after the next reload.
NOTIFY pgrst, 'reload schema';
