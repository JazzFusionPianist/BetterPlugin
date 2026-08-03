'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useCanvasItems, type Profile } from '@orb/core'
import CanvasLayer from './CanvasLayer'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  friend: Profile & { isOnline?: boolean }
  onClose: () => void
}

/**
 * A friend's gallery — the portfolio page. Their curated wall (plates,
 * polaroids, doodles) rendered look-only under a catalogue header:
 * name, @handle, membership number, and the visitor-relative record.
 */
export default function FriendWall({ supabase, currentUserId, friend, onClose }: Props) {
  const { items, loading } = useCanvasItems(supabase, currentUserId, friend.id)

  // Head-to-head chess record vs this friend — printed in the header
  // and on their plaque plate, always from the visitor's side.
  const [record, setRecord] = useState<{ w: number; d: number; l: number } | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('winner_id')
        .eq('game_type', 'chess')
        .eq('status', 'finished')
        .or(`and(host_id.eq.${currentUserId},guest_id.eq.${friend.id}),and(host_id.eq.${friend.id},guest_id.eq.${currentUserId})`)
      if (cancelled || error || !data) return
      let w = 0; let d = 0; let l = 0
      for (const r of data as { winner_id: string | null }[]) {
        if (r.winner_id === currentUserId) w++
        else if (r.winner_id) l++
        else d++
      }
      if (w + d + l > 0) setRecord({ w, d, l })
    })()
    return () => { cancelled = true }
  }, [supabase, currentUserId, friend.id])

  const recordLine = record ? `chess vs you · ${record.w}–${record.d}–${record.l}` : null

  return (
    <div className="fwall">
      <header className="fwall-head">
        <button className="chatt-back" onClick={onClose} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="chatt-av" style={{ background: friend.avatar_color }}>
          {friend.avatar_url ? <img src={friend.avatar_url} alt="" /> : <span>{friend.initials}</span>}
          {friend.isOnline && <span className="chatt-dot" />}
        </div>
        <div className="chatt-who">
          <div className="chatt-name">{friend.display_name}</div>
          <div className="chatt-status">
            {friend.username ? `@${friend.username}` : ''}
            {friend.member_no != null ? ` · #${String(friend.member_no).padStart(6, '0')}` : ''}
          </div>
        </div>
        {recordLine && <div className="fwall-record">{recordLine}</div>}
      </header>

      <div className="fwall-canvas">
        {!loading && items.length === 0 && (
          <div className="fwall-empty">Nothing on this wall yet.</div>
        )}
        <CanvasLayer
          items={items}
          isMine={false}
          plaque={{
            name: friend.display_name,
            username: friend.username || null,
            memberNo: friend.member_no ?? null,
            line: recordLine,
          }}
          onUpdate={() => {}}
          onDelete={() => {}}
        />
      </div>

      {friend.username && (
        <div className="fwall-colophon" aria-hidden="true">curated by @{friend.username}</div>
      )}
    </div>
  )
}
