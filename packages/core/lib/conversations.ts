/**
 * Conversation lookup + creation helpers.
 *
 * The DM resolver is the most-touched function in this file: every time
 * a friend orb is clicked we need a conversation_id to attach messages
 * to. We cache by sorted (a,b) pair so repeated opens don't round-trip
 * the DB.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Atomic server-side creation; authorization comes from the current session. */
export async function getOrCreateDmConversation(client:SupabaseClient,_me:string,other:string):Promise<string>{
  const {data,error}=await client.rpc('create_secure_conversation',{p_kind:'dm',p_members:[other]})
  if(error || typeof data!=='string')throw error??new Error('Could not open conversation.')
  return data
}
export function clearDmCache(_me:string,_other:string):void {}

// `sendGameInviteMessage` lives in `./gameRooms.ts` alongside the
// rest of the game-room helpers — see that file. We re-export here
// would be redundant; callers import from gameRooms directly.

// ── Group-conversation administration ────────────────────────────────
// These all delegate enforcement to RLS (migration 20260606): renames
// and member inserts are host-only at the DB layer; leave/kick is
// either-self-or-admin. Callers don't need to pre-check role.

/** Rename a group. Host-only — DB will reject if caller isn't admin.
 *  Crucially we `.select('id')` after the update: an RLS denial returns
 *  zero rows with NO error, so without that we'd happily report
 *  success on a write the DB silently dropped. */
export async function renameGroupConversation(
  supabase: SupabaseClient,
  conversationId: string,
  newTitle: string,
): Promise<void> {
  const trimmed = newTitle.trim()
  if (!trimmed) throw new Error('group name is required')
  const { data, error } = await supabase
    .from('conversations')
    .update({ title: trimmed })
    .eq('id', conversationId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('rename rejected — you may not be the host of this group')
  }
}

/** Add new members to a group. Host-only at the DB layer. */
export async function addGroupMembers(
  supabase: SupabaseClient,
  conversationId: string,
  memberIds: string[],
): Promise<void> {
  if (memberIds.length === 0) return
  const rows = memberIds.map(uid => ({
    conversation_id: conversationId,
    user_id: uid,
    role: 'member' as const,
  }))
  const { error } = await supabase.from('conversation_members').insert(rows)
  if (error) throw error
}

/** Remove one member. Self-removal is "leave"; removing someone else
 *  is "kick" and requires admin role. RLS handles both gates. */
export async function removeGroupMember(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) throw error
}

/**
 * Create a new group conversation with the caller plus `memberIds`.
 * Caller becomes 'admin' and is implicitly seeded as a member. Throws
 * if the resulting size would exceed 16 — the DB trigger enforces the
 * same cap, this just gives a friendlier error before round-trip.
 */
export async function createGroupConversation(
  supabase: SupabaseClient,
  meId: string,
  title: string,
  memberIds: string[],
): Promise<string> {
  const others=[...new Set(memberIds.filter(id=>id!==meId))]
  if(!others.length || others.length>15)throw new Error('Choose between 1 and 15 participants.')
  const {data,error}=await supabase.rpc('create_secure_conversation',{p_kind:'group',p_members:others,p_title:title.trim()})
  if(error || typeof data!=='string')throw error??new Error('Could not create group.')
  return data
}
