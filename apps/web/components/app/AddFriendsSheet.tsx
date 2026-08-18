'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Profile } from '@orb/core'

interface Props {
  open: boolean
  /** Everyone except me (from useProfiles), with presence merged in. */
  profiles: (Profile & { isOnline?: boolean })[]
  followingIds: Set<string>
  followerIds: Set<string>
  mutualIds: Set<string>
  onFollow: (id: string) => void
  onUnfollow: (id: string) => void
  onClose: () => void
}

/** Search people and follow them — mutual follows become friends (orbs). */
export default function AddFriendsSheet({
  open, profiles, followingIds, followerIds, mutualIds, onFollow, onUnfollow, onClose,
}: Props) {
  const [q, setQ] = useState('')
  // Two-tap unfollow: first tap arms the button ('unfollow?'), second confirms.
  const [armedUnfollow, setArmedUnfollow] = useState<string | null>(null)
  useEffect(() => { if (open) { setQ(''); setArmedUnfollow(null) } }, [open])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? profiles.filter(p => p.display_name.toLowerCase().includes(needle))
      : profiles
    // Friends first, then people who follow you, then the rest — the
    // "actionable" rows float to the top.
    return [...list].sort((a, b) => {
      const rank = (p: Profile) =>
        mutualIds.has(p.id) ? 0 : followerIds.has(p.id) && !followingIds.has(p.id) ? 1 : 2
      return rank(a) - rank(b) || a.display_name.localeCompare(b.display_name)
    })
  }, [profiles, q, mutualIds, followerIds, followingIds])

  return (
    <div className={`afr${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="afr-sheet">
        <header className="afr-head">
          <h2>find people</h2>
          <button className="convs-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </header>

        <div className="afr-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            value={q}
            placeholder="search by name…"
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button className="afr-clear" onClick={() => setQ('')} aria-label="Clear">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg>
            </button>
          )}
        </div>

        <div className="afr-list">
          {rows.length === 0 && <div className="convs-empty">no one found{q ? ` for “${q}”` : ''}.</div>}
          {rows.map((p) => {
            const friend = mutualIds.has(p.id)
            const following = followingIds.has(p.id)
            const followsYou = followerIds.has(p.id)
            return (
              <div key={p.id} className="afr-row">
                <div className="convs-av" style={{ background: p.avatar_color }}>
                  {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{p.initials}</span>}
                  {p.isOnline && <span className="convs-dot" />}
                </div>
                <div className="afr-info">
                  <span className="convs-name">{p.display_name}</span>
                  {friend
                    ? <span className="afr-sub">friends</span>
                    : followsYou
                      ? <span className="afr-sub afr-sub-hot">follows you</span>
                      : following ? <span className="afr-sub">following</span> : null}
                </div>
                {friend || following ? (
                  <button
                    className="afr-btn afr-btn-off"
                    onClick={() => {
                      if (armedUnfollow === p.id) { onUnfollow(p.id); setArmedUnfollow(null) }
                      else setArmedUnfollow(p.id)
                    }}
                  >
                    {armedUnfollow === p.id ? 'unfollow?' : friend ? 'friends' : 'following'}
                  </button>
                ) : (
                  <button className="afr-btn" onClick={() => onFollow(p.id)}>
                    {followsYou ? 'follow back' : 'follow'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
