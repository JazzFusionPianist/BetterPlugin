-- Fix conversation_members INSERT policy.
--
-- The original policy required the inserter to ALREADY be a member of the
-- target conversation when adding anyone other than themselves. That
-- breaks the very first member-insert pair when creating a brand-new
-- DM: my own row is fine (self-insert + I'm creator), but the partner's
-- row sees "is_conversation_member" → false because the same statement
-- hasn't committed my row yet.
--
-- New rule: if I created the conversation, I can insert ANY member rows
-- (the initial seed). Otherwise I must already be a member (the invite
-- path, used when adding people to a group I'm in).

DROP POLICY IF EXISTS "cm_insert" ON public.conversation_members;
CREATE POLICY "cm_insert" ON public.conversation_members
  FOR INSERT WITH CHECK (
    -- Path A: I created this conversation — I can seed any member row
    EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = conversation_id
         AND c.created_by = auth.uid()
    )
    -- Path B: I'm already a member — I can add more people (invite flow)
    OR public.is_conversation_member(conversation_id)
  );
