import type { Profile } from '../../types/collab'

function VerifiedBadge() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginLeft: 2 }}>
      <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
      <path d="M6.5 12.5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface Props {
  profiles: Profile[]
  favorites: Set<string>
  loading: boolean
  viewMode: 'gallery' | 'list'
  searchQuery: string
  onSelect: (id: string) => void
  onToggleFav: (id: string) => void
  onCellHover: (profile: Profile, el: HTMLDivElement) => void
  onCellLeave: () => void
}

function FriendRow({
  profile,
  isFav,
  onSelect,
  onToggleFav,
}: {
  profile: Profile
  isFav: boolean
  onSelect: () => void
  onToggleFav: () => void
}) {
  return (
    <div className="f-row" onClick={onSelect}>
      <div className="av-wrap">
        <div className="av sz32" style={{ background: profile.avatar_color }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : profile.initials}
        </div>
        <div className={`av-dot sm ${profile.isOnline ? 'don' : 'doff'}`} />
      </div>

      <div className="f-info">
        <div className={`f-name ${profile.isOnline ? 'bold' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {profile.display_name}
          {profile.is_verified && <VerifiedBadge />}
        </div>
        <div className="f-sub">
          {profile.isOnline ? 'online' : 'offline'}
        </div>
      </div>

      <div className="badges">
        <span
          className="star"
          style={{ opacity: isFav ? 1 : 0.2 }}
          onClick={e => { e.stopPropagation(); onToggleFav() }}
        >
          ★
        </span>
        {profile.isOnline && <span className="ob">online</span>}
      </div>
    </div>
  )
}

function GalleryCell({
  profile,
  isFav,
  onSelect,
  onHover,
  onLeave,
}: {
  profile: Profile
  isFav: boolean
  onSelect: () => void
  onHover: (el: HTMLDivElement) => void
  onLeave: () => void
}) {
  return (
    <div
      className="gcell"
      onClick={onSelect}
      onMouseEnter={e => onHover(e.currentTarget)}
      onMouseLeave={onLeave}
    >
      <div className="av-wrap">
        <div className="av sz48" style={{ background: profile.avatar_color }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : profile.initials}
        </div>
        <div className={`av-dot md ${profile.isOnline ? 'don' : 'doff'}`} />
        {isFav && <div className="star-badge">★</div>}
      </div>
      <div className={`gcell-name ${profile.isOnline ? 'on' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {profile.display_name.split(' ')[0]}
        {profile.is_verified && <VerifiedBadge />}
      </div>
    </div>
  )
}

export default function FriendsList({
  profiles,
  favorites,
  loading,
  viewMode,
  searchQuery,
  onSelect,
  onToggleFav,
  onCellHover,
  onCellLeave,
}: Props) {
  if (loading) {
    return <div className="collab-loading">Loading...</div>
  }

  const filtered = searchQuery
    ? profiles.filter(p => p.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : profiles

  if (filtered.length === 0) {
    return <div className="collab-loading">{searchQuery ? 'No results' : 'No users yet'}</div>
  }

  const favOnline   = filtered.filter(p =>  favorites.has(p.id) &&  p.isOnline)
  const otherOnline = filtered.filter(p => !favorites.has(p.id) &&  p.isOnline)
  const offline     = filtered.filter(p => !p.isOnline)

  if (viewMode === 'gallery') {
    const sorted = [...favOnline, ...otherOnline, ...offline]
    return (
      <div className="fgallery gallery-mode">
        {sorted.map(p => (
          <GalleryCell
            key={p.id}
            profile={p}
            isFav={favorites.has(p.id)}
            onSelect={() => onSelect(p.id)}
            onHover={el => onCellHover(p, el)}
            onLeave={onCellLeave}
          />
        ))}
      </div>
    )
  }

  // List mode
  const rows = (list: Profile[]) =>
    list.map(p => (
      <FriendRow
        key={p.id}
        profile={p}
        isFav={favorites.has(p.id)}
        onSelect={() => onSelect(p.id)}
        onToggleFav={() => onToggleFav(p.id)}
      />
    ))

  return (
    <div className="fscroll list-mode">
      {rows(favOnline)}
      {favOnline.length > 0 && otherOnline.length > 0 && <div className="sep" />}
      {rows(otherOnline)}
      {(favOnline.length > 0 || otherOnline.length > 0) && offline.length > 0 && <div className="sep" />}
      {rows(offline)}
    </div>
  )
}
