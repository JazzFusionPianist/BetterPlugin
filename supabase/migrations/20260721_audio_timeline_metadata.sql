-- Musical/source position metadata for audio attachments. Kept separate from
-- the object itself so AIFF/CAF/compressed files can carry the same manifest.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_metadata jsonb;

COMMENT ON COLUMN public.messages.attachment_metadata IS
  'Versioned attachment metadata; audio timeline position, observed tempo map, and time signatures.';
