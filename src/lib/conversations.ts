/**
 * Conversation lookup + creation helpers.
 *
 * The DM resolver is the most-touched function in this file: every time
 * a friend orb is clicked we need a conversation_id to attach messages
 * to. We cache by sorted (a,b) pair so repeated opens don't round-trip
 * the DB.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Module-level cache keyed by `${minId}|${maxId}`. Survives component
 *  unmount; cleared only on hard reload. Fine for our small user base
 *  — worst case a stale cache entry resolves to a deleted conversation
 *  and we fall through to re-create on the next miss. */
const dmCache = new Map<string, string>()

const dmKey = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`

/**
 * Resolve (or create) the DM conversation between `me` and `other`.
 * Idempotent — concurrent first-opens on both sides converge to one
 * conversation because the membership lookup precedes the insert. There
 * is a benign race where both sides briefly create *separate* conversations;
 * we accept that as a pre-launch trade-off rather than serialize through
 * an RPC. Post-launch the right fix is a server-side `find_or_create_dm`
 * SECURITY DEFINER function.
 */
export async function getOrCreateDmConversation(
  supabase: SupabaseClient,
  meId: string,
  otherId: string,
): Promise<string> {
  const key = dmKey(meId, otherId)
  const cached = dmCache.get(key)
  if (cached) return cached

  // 1. Look for an existing DM both of us belong to. We pull every
  //    conv I'm in (small set), then intersect against convs the
  //    other user is in. PostgREST can't express this in one round
  //    trip without a custom RPC, so two queries it is.
  const { data: mine } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations!inner(kind)')
    .eq('user_id', meId)
    .eq('conversations.kind', 'dm')

  const myConvIds = (mine ?? []).map(r => r.conversation_id as string)

  if (myConvIds.length > 0) {
    const { data: theirs } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', otherId)
      .in('conversation_id', myConvIds)

    const hit = theirs?.[0]?.conversation_id as string | undefined
    if (hit) { dmCache.set(key, hit); return hit }
  }

  // 2. None exists — create one. created_by must be me (RLS) and we
  //    insert both membership rows in the same call.
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ kind: 'dm', created_by: meId })
    .select('id')
    .single()
  if (convErr || !conv) throw convErr ?? new Error('conversation create failed')

  const { error: memErr } = await supabase
    .from('conversation_members')
    .insert([
      { conversation_id: conv.id, user_id: meId,    role: 'member' },
      { conversation_id: conv.id, user_id: otherId, role: 'member' },
    ])
  if (memErr) throw memErr

  dmCache.set(key, conv.id)
  return conv.id
}

/** Drop the cached DM mapping for a pair — call after deleting a DM. */
export function clearDmCache(meId: string, otherId: string): void {
  dmCache.delete(dmKey(meId, otherId))
}

// `sendGameInviteMessage` lives in `./gameRooms.ts` alongside the
// rest of the game-room helpers — see that file. We re-export here
// would be redundant; callers import from gameRooms directly.

// ── Group-conversation administration ────────────────────────────────
// These all delegate enforcement to RLS (migration 20260606): renames
// and member inserts are host-only at the DB layer; leave/kick is
// either-self-or-admin. Callers don't need to pre-check role.

/** Rename a group. Host-only — DB will reject if caller isn't admin. */
export async function renameGroupConversation(
  supabase: SupabaseClient,
  conversationId: string,
  newTitle: string,
): Promise<void> {
  const trimmed = newTitle.trim()
  if (!trimmed) throw new Error('group name is required')
  const { error } = await supabase
    .from('conversations')
    .update({ title: trimmed })
    .eq('id', conversationId)
  if (error) throw error
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
  // Dedupe + drop self from the input — we always add ourselves below.
  const others = Array.from(new Set(memberIds.filter(id => id !== meId)))
  if (others.length === 0) throw new Error('group needs at least one other member')
  if (others.length + 1 > 16) throw new Error('group is capped at 16 members')

  const trimmed = title.trim()
  if (!trimmed) throw new Error('group name is required')

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ kind: 'group', title: trimmed, created_by: meId })
    .select('id')
    .single()
  if (convErr || !conv) throw convErr ?? new Error('group create failed')

  // Creator joins as admin; everyone else as member.
  const memberRows = [
    { conversation_id: conv.id, user_id: meId, role: 'admin' as const },
    ...others.map(uid => ({
      conversation_id: conv.id, user_id: uid, role: 'member' as const,
    })),
  ]
  const { error: memErr } = await supabase
    .from('conversation_members')
    .insert(memberRows)
  if (memErr) throw memErr

  return conv.id
}
