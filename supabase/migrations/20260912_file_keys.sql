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
--
-- The origin-stripping below must stay EQUIVALENT to the app's
-- canonical key extraction, r2KeyFromUrl in packages/core/lib/r2Keys.ts
-- (and its byte-identical app copies) — the presign endpoint matches
-- these exact keys against what the writers store.

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

-- ── verify: no r2.dev row left without its key ───────────────────────
--
-- Self-check so a silently-incomplete backfill aborts the migration
-- (and the transaction) instead of shipping rows the presign endpoint
-- can never match. The multi-audio count asserts the "0 such rows in
-- prod today" claim above — if JSON-array rows exist without keys, the
-- assumption is stale and the backfill needs a JSON-aware pass.
do $$
declare
  n_stems bigint;
  n_msgs  bigint;
  n_multi bigint;
begin
  select count(*) into n_stems
    from public.conversation_stems
   where file_url like 'http%r2.dev/%'
     and file_key is null;
  if n_stems > 0 then
    raise exception 'file_keys backfill incomplete: % conversation_stems r2.dev row(s) with null file_key', n_stems;
  end if;

  select count(*) into n_msgs
    from public.messages
   where attachment_url like 'http%r2.dev/%'
     and attachment_url not like '[%'
     and attachment_keys is null;
  if n_msgs > 0 then
    raise exception 'file_keys backfill incomplete: % messages r2.dev row(s) with null attachment_keys', n_msgs;
  end if;

  select count(*) into n_multi
    from public.messages
   where attachment_url like '[%'
     and attachment_keys is null;
  if n_multi > 0 then
    raise exception 'file_keys backfill: % multi-audio (JSON) message row(s) with null attachment_keys — expected 0 in prod; backfill them before applying', n_multi;
  end if;
end $$;
