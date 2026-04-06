import { useState } from 'react'
import type { Profile } from '../../types/collab'

interface Props {
  allProfiles: Profile[]
  friendIds: Set<string>
  onAdd: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onClose: () => void
}

export default function AddFriendPanel({ allProfiles, friendIds, onAdd, onRemove, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Set<string>>(new Set())

  const filtered = query.trim()
    ? allProfiles.filter(p => p.display_name.toLowerCase().includes(query.toLowerCase()))
    : allProfiles

  const handleToggle = async (id: string, isFriend: boolean) => {
    setPending(prev => new Set([...prev, id]))
    if (isFriend) {
      await onRemove(id)
    } else {
      await onAdd(id)
    }
    setPending(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  return (
    <>
      {/* Sub-bar */}
      <div className="s-header">
        <div className="s-close" onClick={onClose}>&#8249;</div>
        <span className="s-title">Add Friend</span>
      </div>

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

      {/* Results */}
      <div className="af-list">
        {filtered.length === 0 && (
          <div className="collab-loading" style={{ flex: 'unset', marginTop: 32 }}>
            {query ? 'No results' : 'No users found'}
          </div>
        )}
        {filtered.map(p => {
          const isFriend = friendIds.has(p.id)
          const isLoading = pending.has(p.id)
          return (
            <div key={p.id} className="af-row">
              <div className="av-wrap">
                <div className="av sz32" style={{ background: p.avatar_color }}>
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : p.initials}
                </div>
                <div className={`av-dot sm ${p.isOnline ? 'don' : 'doff'}`} />
              </div>

              <div className="f-info">
                <div className="f-name" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {p.display_name}
                  {p.is_verified && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
                      <path d="M6.5 12.5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="f-sub">{p.isOnline ? 'online' : 'offline'}</div>
              </div>

              <button
                className={`af-btn ${isFriend ? 'af-btn-added' : ''}`}
                onClick={() => handleToggle(p.id, isFriend)}
                disabled={isLoading}
              >
                {isLoading ? '...' : isFriend ? 'Added' : '+ Add'}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
