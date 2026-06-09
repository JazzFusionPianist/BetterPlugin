-- Fix conversations SELECT policy.
--
-- The original policy required `is_conversation_member(id)` to SELECT —
-- which means an `INSERT … RETURNING id` call (used to grab the new
-- conversation_id before inserting member rows) returns *nothing*,
-- because we're not yet a member of the conversation we just created.
-- The client then sees `single()` fail and reports "failed to create
-- group" / "failed to create dm".
--
-- The fix: also allow the conversation's creator to SELECT it. The
-- creator is the one who needs to grab the new id immediately after
-- INSERT; afterwards, normal membership-based access takes over.

DROP POLICY IF EXISTS "conv_select" ON public.conversations;
CREATE POLICY "conv_select" ON public.conversations
  FOR SELECT USING (
    public.is_conversation_member(id)
    OR created_by = auth.uid()
  );
