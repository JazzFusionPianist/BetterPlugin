-- Group conversations migration.
--
-- Promotes the prior 1:1-only chat model to a generalised "conversation"
-- with two kinds:
--   • dm    — exactly two members, can never gain a third (DM→group is
--             implemented in app code by *creating a new* group
--             conversation, NOT by mutating the DM)
--   • group — 2..16 members, mutable membership, has a title
--
-- Big-bang migration: schema + backfill + drops happen in one file. After
-- this runs, `messages.receiver_id` and `conversation_reads.partner_id`
-- are GONE. The app code that ships alongside this migration uses only
-- `conversation_id` — old binaries will break, which is fine for our
-- pre-launch stage.
--
-- Run via `supabase db push` (or paste into the SQL editor).

BEGIN;

-- ── 1. Conversation tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text        NOT NULL CHECK (kind IN ('dm','group')),
  title       text        NULL,   -- group display name; NULL for DMs
  created_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_members_user_idx
  ON public.conversation_members (user_id);

-- ── 2. Add conversation_id to messages + conversation_reads ───────────────

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;

-- conversation_reads may not exist yet (the prior standalone migration
-- for it might not have been applied on this database). Create it fresh
-- with the final schema if absent; otherwise just bolt on conversation_id
-- so the backfill step below can populate it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'conversation_reads'
  ) THEN
    ALTER TABLE public.conversation_reads
      ADD COLUMN IF NOT EXISTS conversation_id uuid
      REFERENCES public.conversations(id) ON DELETE CASCADE;
  ELSE
    CREATE TABLE public.conversation_reads (
      conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
      user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      last_seen_at    timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (conversation_id, user_id)
    );
  END IF;
END $$;

-- ── 3. Backfill DMs ───────────────────────────────────────────────────────
-- For every unordered (user_a, user_b) pair that has any messages between
-- them, create one DM conversation, two membership rows, and stamp every
-- message + read row with the new conversation_id. We collapse direction
-- by `LEAST/GREATEST` so (a→b) and (b→a) end up in the same conversation.

DO $$
DECLARE
  pair RECORD;
  conv_id uuid;
  has_partner_id boolean;
BEGIN
  -- Whether legacy reads-rows need to be re-stamped this run.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'conversation_reads'
       AND column_name = 'partner_id'
  ) INTO has_partner_id;

  FOR pair IN
    SELECT DISTINCT
      LEAST(sender_id, receiver_id)    AS user_a,
      GREATEST(sender_id, receiver_id) AS user_b
    FROM public.messages
    WHERE conversation_id IS NULL
      AND sender_id IS NOT NULL
      AND receiver_id IS NOT NULL
  LOOP
    -- Use the earlier user as `created_by` — arbitrary but deterministic.
    INSERT INTO public.conversations (kind, created_by)
    VALUES ('dm', pair.user_a)
    RETURNING id INTO conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES (conv_id, pair.user_a, 'member'),
           (conv_id, pair.user_b, 'member');

    UPDATE public.messages
       SET conversation_id = conv_id
     WHERE conversation_id IS NULL
       AND ((sender_id = pair.user_a AND receiver_id = pair.user_b)
         OR (sender_id = pair.user_b AND receiver_id = pair.user_a));

    -- Dynamic SQL so we don't reference `partner_id` from static code
    -- on installs where the column never existed.
    IF has_partner_id THEN
      EXECUTE format(
        'UPDATE public.conversation_reads
            SET conversation_id = %L
          WHERE conversation_id IS NULL
            AND ((user_id = %L AND partner_id = %L)
              OR (user_id = %L AND partner_id = %L))',
        conv_id, pair.user_a, pair.user_b, pair.user_b, pair.user_a);
    END IF;
  END LOOP;
END $$;

-- Any reads-row left orphaned (partner had no messages either way) — drop.
DELETE FROM public.conversation_reads WHERE conversation_id IS NULL;

-- ── 4. Lock down the new columns ──────────────────────────────────────────

ALTER TABLE public.messages
  ALTER COLUMN conversation_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS messages_conv_created_idx
  ON public.messages (conversation_id, created_at DESC);

-- Drop ALL existing RLS policies on messages + conversation_reads BEFORE
-- removing the legacy columns. Any leftover policy that references
-- `receiver_id` / `partner_id` would block the column drops below.
-- (We recreate the policies properly in step 6.)
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('messages','conversation_reads')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Drop the legacy 1:1 columns.
ALTER TABLE public.messages           DROP COLUMN IF EXISTS receiver_id;
ALTER TABLE public.conversation_reads DROP COLUMN IF EXISTS partner_id;

-- conversation_reads PK was (user_id, partner_id) on legacy installs;
-- on fresh installs we already created it as (conversation_id, user_id).
-- Either way, ensure conversation_id is NOT NULL and the PK is the new
-- shape — but only rebuild the PK if it's not already correct.
ALTER TABLE public.conversation_reads
  ALTER COLUMN conversation_id SET NOT NULL;

DO $$
DECLARE
  pk_cols text;
BEGIN
  SELECT string_agg(a.attname, ',' ORDER BY array_position(i.indkey, a.attnum))
    INTO pk_cols
    FROM pg_index i
    JOIN pg_class c     ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
   WHERE n.nspname = 'public'
     AND c.relname = 'conversation_reads'
     AND i.indisprimary;

  IF pk_cols IS DISTINCT FROM 'conversation_id,user_id' THEN
    ALTER TABLE public.conversation_reads DROP CONSTRAINT IF EXISTS conversation_reads_pkey;
    ALTER TABLE public.conversation_reads ADD PRIMARY KEY (conversation_id, user_id);
  END IF;
END $$;

-- ── 5. Group size cap (16) — enforced by trigger ──────────────────────────
-- DMs are exactly 2 members and never grow, so the cap only matters for
-- groups. We reject the 17th insert.

CREATE OR REPLACE FUNCTION public.enforce_group_member_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  n int;
BEGIN
  SELECT kind INTO k FROM public.conversations WHERE id = NEW.conversation_id;
  IF k = 'group' THEN
    SELECT count(*) INTO n FROM public.conversation_members
      WHERE conversation_id = NEW.conversation_id;
    IF n >= 16 THEN
      RAISE EXCEPTION 'group conversation is full (max 16 members)';
    END IF;
  ELSIF k = 'dm' THEN
    SELECT count(*) INTO n FROM public.conversation_members
      WHERE conversation_id = NEW.conversation_id;
    IF n >= 2 THEN
      RAISE EXCEPTION 'dm conversation already has two members';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS conversation_member_cap ON public.conversation_members;
CREATE TRIGGER conversation_member_cap
  BEFORE INSERT ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_member_cap();

-- ── 6. RLS ────────────────────────────────────────────────────────────────
-- Membership-driven visibility: you can see/insert into a conversation iff
-- you are a member of it.

ALTER TABLE public.conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members  ENABLE ROW LEVEL SECURITY;
-- messages + conversation_reads already had RLS; we redefine the policies.
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reads    ENABLE ROW LEVEL SECURITY;

-- Helper: is auth.uid() a member of the given conversation?
-- SECURITY DEFINER lets the function bypass conversation_members RLS for
-- the membership check, avoiding circular policy dependencies.
CREATE OR REPLACE FUNCTION public.is_conversation_member(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
     WHERE conversation_id = cid AND user_id = auth.uid()
  );
$$;

-- conversations: members see; anyone authenticated can create (members
-- are inserted in the same transaction).
DROP POLICY IF EXISTS "conv_select"  ON public.conversations;
DROP POLICY IF EXISTS "conv_insert"  ON public.conversations;
DROP POLICY IF EXISTS "conv_update"  ON public.conversations;
CREATE POLICY "conv_select" ON public.conversations
  FOR SELECT USING (public.is_conversation_member(id));
CREATE POLICY "conv_insert" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "conv_update" ON public.conversations
  FOR UPDATE USING (public.is_conversation_member(id))
  WITH CHECK     (public.is_conversation_member(id));

-- conversation_members:
--   • SELECT: members can list co-members of their own conversations
--   • INSERT: caller must already be a member of the target conversation
--             OR be inserting themselves into a brand-new conversation
--             that they just created (we allow self-insert by creator)
--   • DELETE: members can remove themselves; admins can remove anyone
DROP POLICY IF EXISTS "cm_select"  ON public.conversation_members;
DROP POLICY IF EXISTS "cm_insert"  ON public.conversation_members;
DROP POLICY IF EXISTS "cm_delete"  ON public.conversation_members;
CREATE POLICY "cm_select" ON public.conversation_members
  FOR SELECT USING (public.is_conversation_member(conversation_id));
CREATE POLICY "cm_insert" ON public.conversation_members
  FOR INSERT WITH CHECK (
    -- Adding yourself to a conversation you created (initial seed)
    (user_id = auth.uid()
       AND EXISTS (SELECT 1 FROM public.conversations c
                    WHERE c.id = conversation_id AND c.created_by = auth.uid()))
    -- Or you're already a member adding someone else (or yourself)
    OR public.is_conversation_member(conversation_id)
  );
CREATE POLICY "cm_delete" ON public.conversation_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members admin
       WHERE admin.conversation_id = conversation_members.conversation_id
         AND admin.user_id = auth.uid()
         AND admin.role = 'admin'
    )
  );

-- messages: members can read & post to conversations they belong to.
-- Defensive sweep: drop EVERY existing policy on public.messages before
-- redefining. The old policies referenced `receiver_id` (now gone), so
-- leaving any of them in place would crash every query — RLS policies
-- are OR'd, and an erroring policy poisons the whole evaluation.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "msg_select" ON public.messages
  FOR SELECT USING (public.is_conversation_member(conversation_id));
CREATE POLICY "msg_insert" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_member(conversation_id)
  );

-- conversation_reads: only your own row, only for conversations you're in.
DROP POLICY IF EXISTS "conv_reads_select" ON public.conversation_reads;
DROP POLICY IF EXISTS "conv_reads_insert" ON public.conversation_reads;
DROP POLICY IF EXISTS "conv_reads_update" ON public.conversation_reads;
DROP POLICY IF EXISTS "conv_reads_delete" ON public.conversation_reads;
CREATE POLICY "conv_reads_select" ON public.conversation_reads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conv_reads_insert" ON public.conversation_reads
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.is_conversation_member(conversation_id)
  );
CREATE POLICY "conv_reads_update" ON public.conversation_reads
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK     (auth.uid() = user_id);
CREATE POLICY "conv_reads_delete" ON public.conversation_reads
  FOR DELETE USING (auth.uid() = user_id);

-- ── 7. Realtime publication ───────────────────────────────────────────────
-- Make sure the new tables stream over Realtime so the app can subscribe
-- to INSERTs on `messages` filtered by conversation_id, and react to
-- membership changes.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

COMMIT;
