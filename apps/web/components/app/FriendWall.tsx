'use client'

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
 * A friend's wall — their pinned photos, look-only. Loads their canvas
 * via the same hook (RLS returns only their friends-visible items), and
 * reuses CanvasLayer with isMine=false so nothing can be moved or edited.
 */
export default function FriendWall({ supabase, currentUserId, friend, onClose }: Props) {
  const { items, loading } = useCanvasItems(supabase, currentUserId, friend.id)

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
          <div className="chatt-status">{friend.username ? `@${friend.username} · wall` : 'wall'}</div>
        </div>
      </header>

      <div className="fwall-canvas">
        {!loading && items.length === 0 && (
          <div className="fwall-empty">Nothing pinned here yet.</div>
        )}
        <CanvasLayer items={items} isMine={false} onUpdate={() => {}} onDelete={() => {}} />
      </div>
    </div>
  )
}
