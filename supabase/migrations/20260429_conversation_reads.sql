-- Per-conversation last-seen timestamp so unread-message tracking survives
-- across devices, browsers, and WebView storage resets. Replaces the
-- localStorage-only approach used by useNotifications previously.
--
-- Run in the Supabase SQL editor (or via `supabase db push`).

CREATE TABLE IF NOT EXISTS public.conversation_reads (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id   uuid        NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, partner_id)
);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_reads_select" ON public.conversation_reads;
CREATE POLICY "conv_reads_select" ON public.conversation_reads
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "conv_reads_insert" ON public.conversation_reads;
CREATE POLICY "conv_reads_insert" ON public.conversation_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conv_reads_update" ON public.conversation_reads;
CREATE POLICY "conv_reads_update" ON public.conversation_reads
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conv_reads_delete" ON public.conversation_reads;
CREATE POLICY "conv_reads_delete" ON public.conversation_reads
  FOR DELETE USING (auth.uid() = user_id);
