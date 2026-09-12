-- ── R2 object-key columns for presigned reads ────────────────────────
--
-- APPLY BEFORE DEPLOYING THE APP: the deployed writers (useMessages
-- send(), StemPanel insert) start populating these columns on every new
-- row, and /api/r2-file-url switches its membership probe from
-- ilike-on-url to exact key matching. Order of operations:
--   1. this migration (columns + indexes + backfill of existing rows)
--   2. deploy the app (writers populate, endpoint probes by key)
--
-- The key is the R2 object key exactly as minted by r2-upload-url
-- (e.g. '<userId>/<ts>-<rand>.<ext>') — the stored public url minus
-- its origin.

alter table public.messages
  add column if not exists attachment_keys text[];

-- GIN index so the endpoint's `attachment_keys=cs.{<key>}` (array
-- contains) probe is an index scan, not a table walk.
create index if not exists messages_attachment_keys_gin
  on public.messages using gin (attachment_keys);

alter table public.conversation_stems
  add column if not exists file_key text;

create index if not exists conversation_stems_file_key_idx
  on public.conversation_stems (file_key);

-- ── backfill: derive keys from the stored public urls ────────────────

-- Stems always store a single plain url.
update public.conversation_stems
   set file_key = regexp_replace(file_url, '^https?://[^/]+/', '')
 where file_url like 'http%r2.dev/%'
   and file_key is null;

-- Messages: single-attachment rows only. Multi-audio messages store a
-- JSON array of tracks in attachment_url (starts with '['); there are
-- 0 such rows in prod today and the app's writers populate
-- attachment_keys for them from now on — so the backfill skips any
-- JSON payload on purpose. (The 'http%' prefix already excludes '['
-- rows; the not-like guard is belt and braces.)
update public.messages
   set attachment_keys = array[regexp_replace(attachment_url, '^https?://[^/]+/', '')]
 where attachment_url like 'http%r2.dev/%'
   and attachment_url not like '[%'
   and attachment_keys is null;
