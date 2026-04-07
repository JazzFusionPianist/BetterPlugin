import { useState } from 'react'
import type { Profile } from '../../types/collab'

interface Props {
  allProfiles: Profile[]
  friendIds: Set<string>
  pendingOutgoing: Set<string>
  pendingIncoming: string[]
  onAdd: (id: string) => Promise<void>
  onAccept: (id: string) => Promise<void>
  onDecline: (id: string) => Promise<void>
  onCancel: (id: string) => Promise<void>
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
  friendIds,
  pendingOutgoing,
  pendingIncoming,
  onAdd,
  onAccept,
  onDecline,
  onCancel,
  onClose: _onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Set<string>>(new Set())

  const withPending = async (id: string, fn: () => Promise<void>) => {
    setPending(prev => new Set([...prev, id]))
    await fn()
    setPending(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  // Incoming request profiles
  const incomingProfiles = allProfiles.filter(p => pendingIncoming.includes(p.id))

  // Search results (exclude users who sent me requests — shown above)
  const searchResults = query.trim()
    ? allProfiles.filter(
        p => p.display_name.toLowerCase().includes(query.toLowerCase())
          && !pendingIncoming.includes(p.id)
      )
    : allProfiles.filter(p => !pendingIncoming.includes(p.id))

  return (
    <>
      {/* Incoming requests */}
      {incomingProfiles.length > 0 && (
        <div className="af-requests">
          <div className="af-section-label">Friend Requests</div>
          {incomingProfiles.map(p => (
            <div key={p.id} className="af-row">
              <Avatar profile={p} />
              <div className="f-info">
                <div className="f-name" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {p.display_name}
                  {p.is_verified && <VerifiedBadge />}
                </div>
                <div className="f-sub">wants to be friends</div>
              </div>
              <div className="af-req-actions">
                <button
                  className="af-btn af-btn-accept"
                  disabled={pending.has(p.id)}
                  onClick={() => withPending(p.id, () => onAccept(p.id))}
                >
                  {pending.has(p.id) ? '...' : 'Accept'}
                </button>
                <button
                  className="af-btn af-btn-decline"
                  disabled={pending.has(p.id)}
                  onClick={() => withPending(p.id, () => onDecline(p.id))}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <div className="af-divider" />
        </div>
      )}

      {/* Search */}
      <div className="af-search">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
          <circle cx="6.5" cy="6.5" r="4" />
          <path d="M10 10l3 3" strokeLinecap="round" />
        </svg>
        <input
          className="af-search-input"
          type="text"
          placeholder="search by name..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button className="search-clear visible" onClick={() => setQuery('')}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--t3)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l8 8M9 1L1 9" />
            </svg>
          </button>
        )}
      </div>

      {/* Search results */}
      <div className="af-list">
        {searchResults.length === 0 && (
          <div className="collab-loading" style={{ flex: 'unset', marginTop: 32 }}>
            {query ? 'No results' : 'No users found'}
          </div>
        )}
        {searchResults.map(p => {
          const isFriend = friendIds.has(p.id)
          const isRequested = pendingOutgoing.has(p.id)
          const isLoading = pending.has(p.id)

          return (
            <div key={p.id} className="af-row">
              <Avatar profile={p} />
              <div className="f-info">
                <div className="f-name" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {p.display_name}
                  {p.is_verified && <VerifiedBadge />}
                </div>
                <div className="f-sub">{p.isOnline ? 'online' : 'offline'}</div>
              </div>

              {isFriend ? (
                <button
                  className="af-btn af-btn-added"
                  disabled={isLoading}
                  title="Remove friend"
                  onClick={() => {/* remove is not exposed here, just show status */}}
                >
                  Friends ✓
                </button>
              ) : isRequested ? (
                <button
                  className="af-btn af-btn-requested"
                  disabled={isLoading}
                  title="Cancel request"
                  onClick={() => withPending(p.id, () => onCancel(p.id))}
                >
                  {isLoading ? '...' : 'Requested'}
                </button>
              ) : (
                <button
                  className="af-btn"
                  disabled={isLoading}
                  onClick={() => withPending(p.id, () => onAdd(p.id))}
                >
                  {isLoading ? '...' : '+ Add'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
