-- Stream conversation_reads row changes over Realtime so the read-receipt
-- indicator in ChatView updates the moment the other side opens the chat
-- (their markSeen call writes a row, we react to the INSERT/UPDATE here).
--
-- Idempotent — the DO block swallows the "already in publication" error
-- so re-runs are harmless.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_reads;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
