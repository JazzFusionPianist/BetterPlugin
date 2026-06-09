-- Fix conversation_reads SELECT policy.
--
-- The previous policy was `auth.uid() = user_id` — i.e. "you can only
-- read your OWN row." That breaks the read-receipt UI: ChatView needs
-- to see when the *other* members of a conversation last opened it,
-- and the old policy hid those rows from the live subscription.
--
-- New rule: members of a conversation can see every read row for that
-- conversation. RLS on INSERT/UPDATE/DELETE still pins each row to its
-- owner, so this only widens visibility — nobody can fake a read on
-- someone else's behalf.

DROP POLICY IF EXISTS "conv_reads_select" ON public.conversation_reads;
CREATE POLICY "conv_reads_select" ON public.conversation_reads
  FOR SELECT USING (
    public.is_conversation_member(conversation_id)
  );
