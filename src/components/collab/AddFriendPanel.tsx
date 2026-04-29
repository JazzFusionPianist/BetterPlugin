import { useState } from 'react'
import type { Profile } from '../../types/collab'
import FloatingOrbs from '../FloatingOrbs'

interface Props {
  allProfiles: Profile[]
  followingIds: Set<string>
  followerIds: Set<string>
  mutualIds: Set<string>
  onFollow: (id: string) => Promise<void>
  onUnfollow: (id: string) => Promise<void>
  onClose: () => void
}

function Avatar({ profile }: { profile: Profile }) {
  return (
    <div className="av-wrap">
      <div className="av sz32" style={{ background: profile.avatar_color }}>
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          : profile.initials}
      </div>
      <div className={`av-dot sm ${profile.isOnline ? 'don' : 'doff'}`} />
    </div>
  )
}

function VerifiedBadge() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
      <path d="M6.5 12.5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AddFriendPanel({
  allProfiles,
  followingIds,
  followerIds,
  mutualIds,
  onFollow,
  onUnfollow,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(7)
  const [pending, setPending] = useState<Set<string>>(new Set())

  const withPending = async (id: string, fn: () => Promise<void>) => {
    setPending(prev => new Set([...prev, id]))
    await fn()
    setPending(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const filtered = query.trim()
    ? allProfiles.filter(p => p.display_name.toLowerCase().includes(query.toLowerCase()))
    : []
  const results = filtered.slice(0, limit)
  const hasMore = filtered.length > limit

  return (
    <div className="settings-panel">
      <FloatingOrbs count={28} />

      <div className="settings-card settings-header-card" onClick={onClose} role="button" tabIndex={0}>
        <span className="settings-header-back">‹</span>
        <span className="settings-header-title">Find people</span>
      </div>

      <div className="af-stack">
        <div className="settings-card af-search-card">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
            <circle cx="6.5" cy="6.5" r="4" />
            <path d="M10 10l3 3" strokeLinecap="round" />
          </svg>
          <input
            className="af-search-input"
            type="text"
            placeholder="search by name..."
            value={query}
            onChange={e => { setQuery(e.target.value); setLimit(7) }}
          />
          {query && (
            <button className="af-search-clear" onClick={() => setQuery('')}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--t3)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M1 1l8 8M9 1L1 9" />
              </svg>
            </button>
          )}
        </div>

        <div className="af-results">
          {results.length === 0 && (
            <div className="settings-card af-empty">
              {query.trim() ? 'No results' : 'Search for someone to follow'}
            </div>
          )}
          {results.map(p => {
            const isMutual    = mutualIds.has(p.id)
            const isFollowing = followingIds.has(p.id)
            const isFollower  = followerIds.has(p.id)
            const isLoading   = pending.has(p.id)

            return (
              <div key={p.id} className="settings-card af-result-card">
                <Avatar profile={p} />
                <div className="f-info">
                  <div className="f-name" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {p.display_name}
                    {p.is_verified && <VerifiedBadge />}
                  </div>
                  <div className="f-sub">
                    {isMutual ? 'mutual' : isFollower ? 'follows you' : p.isOnline ? 'online' : 'offline'}
                  </div>
                </div>

                {isMutual ? (
                  <button
                    className="af-btn af-btn-added"
                    disabled={isLoading}
                    onClick={() => withPending(p.id, () => onUnfollow(p.id))}
                    title="Unfollow"
                  >
                    {isLoading ? '...' : 'Mutual ✓'}
                  </button>
                ) : isFollowing ? (
                  <button
                    className="af-btn af-btn-requested"
                    disabled={isLoading}
                    onClick={() => withPending(p.id, () => onUnfollow(p.id))}
                    title="Unfollow"
                  >
                    {isLoading ? '...' : 'Following'}
                  </button>
                ) : (
                  <button
                    className="af-btn"
                    disabled={isLoading}
                    onClick={() => withPending(p.id, () => onFollow(p.id))}
                  >
                    {isLoading ? '...' : isFollower ? '+ Follow back' : '+ Follow'}
                  </button>
                )}
              </div>
            )
          })}
          {hasMore && (
            <button className="af-load-more" onClick={() => setLimit(l => l + 7)}>
              Load More
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
