import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'

interface Props {
  supabase: SupabaseClient
  profile: Profile
  x: number
  y: number
  arrowX?: number
  arrowUp?: boolean
  /** Anchor offset within the card. Defaults to top-left of `(x, y)`. */
  below?: boolean
  isMutual: boolean
  isFollowing: boolean
  isFollower: boolean
  /** Optional: render a favourite-star toggle next to the name. */
  isFavorite?: boolean
  onToggleFavorite?: () => void
  /** Optional: render a "Join Live!" button at the bottom. */
  liveSessionId?: string | null
  onJoinLive?: () => void
  onMessage: () => void
  onViewProfile: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

function VerifiedBadge() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
      <path d="M6.5 12.5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Friend hover card shown when the user mouses over an orbit avatar.
 *
 * Layout:
 *   [avatar + online dot]    Name ✓
 *                            [status pill]
 *   X followers · Y following
 *   [Message icon]  [Profile icon]
 *
 * Follower / following counts are fetched lazily on mount and cached for
 * the lifetime of the tooltip. The whole card uses the shared frosted-glass
 * recipe and theme-aware overrides.
 */
export default function HoverTooltip({
  supabase, profile, x, y, arrowX, arrowUp, below,
  isMutual, isFollowing, isFollower,
  isFavorite, onToggleFavorite,
  liveSessionId, onJoinLive,
  onMessage, onViewProfile,
  onMouseEnter, onMouseLeave,
}: Props) {
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [followers, following] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
      ])
      if (!alive) return
      setCounts({
        followers: followers.count ?? 0,
        following: following.count ?? 0,
      })
    })()
    return () => { alive = false }
  }, [supabase, profile.id])

  const status = isMutual
    ? 'mutual'
    : isFollowing
      ? 'following'
      : isFollower
        ? 'follows you'
        : profile.isOnline ? 'online' : 'offline'

  const showStar = onToggleFavorite !== undefined

  return (
    <div
      className={`tt2 visible${below ? ' below' : ''}`}
      style={{ left: x, top: y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="tt2-top">
        <div className="tt2-av" style={{ background: profile.avatar_color }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" />
            : <span>{profile.initials}</span>}
          {profile.isOnline && <div className="tt2-online-dot" />}
        </div>
        <div className="tt2-meta">
          <div className="tt2-name">
            <span className="tt2-name-text">{profile.display_name}</span>
            {profile.is_verified && <VerifiedBadge />}
            {showStar && (
              <button
                className={`tt2-star${isFavorite ? ' on' : ''}`}
                onClick={onToggleFavorite}
                title={isFavorite ? 'Unfavorite' : 'Favorite'}
                aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
              >★</button>
            )}
          </div>
          <span className={`tt2-status${isMutual ? ' tt2-status-mutual' : ''}`}>{status}</span>
        </div>
      </div>

      <div className="tt2-counts">
        <span className="tt2-count"><b>{counts?.followers ?? '–'}</b> followers</span>
        <span className="tt2-count"><b>{counts?.following ?? '–'}</b> following</span>
      </div>

      <div className="tt2-actions">
        <button className="tt2-action-btn" onClick={onMessage} title="Message">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
        <button className="tt2-action-btn" onClick={onViewProfile} title="View profile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
      </div>

      {liveSessionId && onJoinLive && (
        <button className="tt2-live-btn" onClick={onJoinLive}>
          <span className="tt2-live-dot" /> Join Live!
        </button>
      )}

      {arrowX !== undefined && (
        <div className={`tt-arrow ${arrowUp ? 'up' : 'down'}`} style={{ left: arrowX }} />
      )}
    </div>
  )
}
