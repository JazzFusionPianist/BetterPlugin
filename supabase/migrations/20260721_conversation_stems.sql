CREATE TABLE IF NOT EXISTS public.conversation_stems (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  uploader_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url           text NOT NULL,
  file_name          text NOT NULL,
  file_size          bigint NOT NULL DEFAULT 0,
  mime_type          text,
  timeline_metadata  jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_stems_conversation_created_idx
  ON public.conversation_stems (conversation_id, created_at DESC);

ALTER TABLE public.conversation_stems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation members can read stems" ON public.conversation_stems;
CREATE POLICY "conversation members can read stems"
  ON public.conversation_stems FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_stems.conversation_id
      AND cm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "conversation members can upload stems" ON public.conversation_stems;
CREATE POLICY "conversation members can upload stems"
  ON public.conversation_stems FOR INSERT
  WITH CHECK (
    uploader_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_stems.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "uploaders can delete stems" ON public.conversation_stems;
CREATE POLICY "uploaders can delete stems"
  ON public.conversation_stems FOR DELETE
  USING (uploader_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversation_stems'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_stems;
  END IF;
END $$;
