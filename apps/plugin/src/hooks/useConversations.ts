/**
 * Returns the user's conversations — DMs (one per partner) and groups,
 * each with the latest message attached.
 *
 * Implementation: pull every conversation I belong to in one round trip
 * with kind+title+created_at joined, then split into DM vs group lanes
 * and gather the per-conversation extras each lane needs.
 *
 * Refetch on any realtime message INSERT — RLS gates this to convs
 * I'm in, so no client-side filter is needed.
 */

import { useEffect, useState, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message } from '../types/collab'

export interface Conversation {
  /** The other DM member's user id. Kept as `partnerId` so the
   *  existing friend-keyed UI (ConversationsPanel) stays unchanged. */
  partnerId: string
  conversationId: string
  lastMessage: Message
}

/** Group conversation summary — feeds the orb constellation pool and
 *  the (forthcoming) groups-in-chat-list rendering. memberIds is
 *  joined to Profile objects in CollabPage. */
export interface GroupConversation {
  conversationId: string
  title: string
  avatarUrl?: string | null
  memberIds: string[]            // includes the current user
  lastMessage: Message | null    // null for brand-new groups
  createdAt: string
}

export function useConversations(supabase: SupabaseClient, userId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [groupConversations, setGroupConversations] = useState<GroupConversation[]>([])

  const fetch = useCallback(async () => {
    // 0. Every conversation I'm a member of (kind + title + created_at).
    const { data: allMine, error: e0 } = await supabase
      .from('conversation_members')
      .select('conversation_id, conversations!inner(id, kind, title, created_at, avatar_url)')
      .eq('user_id', userId)
    if (e0) { console.error('[useConversations] step 0', e0); return }

    type Row = {
      conversation_id: string
      conversations: { id: string; kind: 'dm' | 'group'; title: string | null; created_at: string; avatar_url?: string | null }
    }
    const rows = (allMine ?? []) as unknown as Row[]
    const dmConvIds    = rows.filter(r => r.conversations.kind === 'dm').map(r => r.conversation_id)
    const groupRows    = rows.filter(r => r.conversations.kind === 'group')
    const groupConvIds = groupRows.map(r => r.conversation_id)

    // ── DMs ──────────────────────────────────────────────────────────────
    if (dmConvIds.length === 0) {
      setConversations([])
    } else {
      // The other member of each DM — everyone except me.
      const { data: others, error: e2 } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id')
        .in('conversation_id', dmConvIds)
        .neq('user_id', userId)
      if (e2) { console.error('[useConversations] dm partner', e2); return }

      const partnerByConv = new Map<string, string>()
      for (const r of (others ?? []) as Array<{ conversation_id: string; user_id: string }>)
        partnerByConv.set(r.conversation_id, r.user_id)

      const { data: dmMsgs, error: e3 } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', dmConvIds)
        .order('created_at', { ascending: false })
        .limit(500)
      if (e3) { console.error('[useConversations] dm messages', e3); return }

      const latestByConv = new Map<string, Message>()
      for (const m of (dmMsgs as Message[] | null) ?? [])
        if (!latestByConv.has(m.conversation_id)) latestByConv.set(m.conversation_id, m)

      const out: Conversation[] = []
      for (const [cid, partnerId] of partnerByConv) {
        const last = latestByConv.get(cid)
        if (!last) continue   // brand-new DM with no messages — skip
        out.push({ partnerId, conversationId: cid, lastMessage: last })
      }
      out.sort((a, b) =>
        new Date(b.lastMessage.created_at).getTime() -
        new Date(a.lastMessage.created_at).getTime()
      )
      setConversations(out)
    }

    // ── Groups ───────────────────────────────────────────────────────────
    if (groupConvIds.length === 0) {
      setGroupConversations([])
    } else {
      const { data: mems, error: eM } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id')
        .in('conversation_id', groupConvIds)
      if (eM) { console.error('[useConversations] group members', eM); return }

      const membersByConv = new Map<string, string[]>()
      for (const r of (mems ?? []) as Array<{ conversation_id: string; user_id: string }>) {
        const arr = membersByConv.get(r.conversation_id) ?? []
        arr.push(r.user_id)
        membersByConv.set(r.conversation_id, arr)
      }

      const { data: gMsgs, error: eMsg } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', groupConvIds)
        .order('created_at', { ascending: false })
        .limit(500)
      if (eMsg) { console.error('[useConversations] group messages', eMsg); return }

      const latestByGroup = new Map<string, Message>()
      for (const m of (gMsgs as Message[] | null) ?? [])
        if (!latestByGroup.has(m.conversation_id)) latestByGroup.set(m.conversation_id, m)

      const out: GroupConversation[] = groupRows.map(r => ({
        conversationId: r.conversation_id,
        title:          r.conversations.title ?? 'Unnamed group',
        avatarUrl:      r.conversations.avatar_url ?? null,
        memberIds:      membersByConv.get(r.conversation_id) ?? [userId],
        lastMessage:    latestByGroup.get(r.conversation_id) ?? null,
        createdAt:      r.conversations.created_at,
      }))
      out.sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : new Date(a.createdAt).getTime()
        const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : new Date(b.createdAt).getTime()
        return tb - ta
      })
      setGroupConversations(out)
    }
  }, [supabase, userId])

  useEffect(() => {
    fetch()
    // Two subscriptions:
    //  • messages INSERT — refetch to bump last-message + ordering
    //  • conversations INSERT — refetch so newly-created groups appear
    //    immediately (otherwise we'd only catch them on the next message)
    const ch = supabase
      .channel(`convs:${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        fetch)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${userId}` },
        fetch)
      // Rename / metadata edits on a group I'm in. RLS scopes this to
      // my conversations server-side, so a no-op filter is fine.
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        fetch)
      // Member roster changes (someone added, someone removed, role
      // change) — refetch so the chat header member count + roster
      // stay in sync without requiring the user to back out and back in.
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_members' },
        fetch)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetch, supabase, userId])

  return { conversations, groupConversations }
}
