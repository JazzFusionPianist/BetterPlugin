-- Lock down group-conversation mutation to the host (admin) role.
--
-- The model so far let any member rename the group or invite anyone.
-- Tighten both to the conversation creator / admin:
--   • UPDATE on conversations.title → admin only
--   • INSERT on conversation_members (invite path) → admin only
--   • DELETE on conversation_members → admin can remove anyone,
--     OR a member can remove themselves (leave)
--
-- DM conversations are unaffected: they have no admin, and the
-- 2-member cap trigger keeps them from gaining members anyway.

-- conversations UPDATE — only admins (and the original creator) can edit.
DROP POLICY IF EXISTS "conv_update"       ON public.conversations;
DROP POLICY IF EXISTS "conv_update_title" ON public.conversations;
CREATE POLICY "conv_update" ON public.conversations
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members m
       WHERE m.conversation_id = conversations.id
         AND m.user_id         = auth.uid()
         AND m.role            = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members m
       WHERE m.conversation_id = conversations.id
         AND m.user_id         = auth.uid()
         AND m.role            = 'admin'
    )
  );

-- conversation_members INSERT — initial seed by creator OR an admin
-- can invite anyone.
DROP POLICY IF EXISTS "cm_insert" ON public.conversation_members;
CREATE POLICY "cm_insert" ON public.conversation_members
  FOR INSERT WITH CHECK (
    -- Path A: I created this conversation — the initial seed insert
    EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = conversation_id
         AND c.created_by = auth.uid()
    )
    -- Path B: I'm already an admin of this conversation — the
    --         invite-someone-else path. Plain members no longer
    --         have invite power.
    OR EXISTS (
      SELECT 1 FROM public.conversation_members admin
       WHERE admin.conversation_id = conversation_members.conversation_id
         AND admin.user_id         = auth.uid()
         AND admin.role            = 'admin'
    )
  );

-- DELETE policy stays as-is: a member can leave themselves; an admin
-- can remove anyone. (Restated here so the migration is self-contained
-- in case the prior version was different.)
DROP POLICY IF EXISTS "cm_delete" ON public.conversation_members;
CREATE POLICY "cm_delete" ON public.conversation_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members admin
       WHERE admin.conversation_id = conversation_members.conversation_id
         AND admin.user_id         = auth.uid()
         AND admin.role            = 'admin'
    )
  );
