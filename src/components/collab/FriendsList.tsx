import type { Profile } from '../../types/collab'

interface Props {
  profiles: Profile[]
  favorites: Set<string>
  loading: boolean
  onSelect: (id: string) => void
  onToggleFav: (id: string) => void
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
        <div className="av" style={{ background: profile.avatar_color }}>
          {profile.initials}
        </div>
        <div className={`av-dot ${profile.isOnline ? 'don' : 'doff'}`} />
      </div>

      <div className="f-info">
        <div className={`f-name ${profile.isOnline ? 'bold' : ''}`}>
          {profile.display_name}
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

export default function FriendsList({ profiles, favorites, loading, onSelect, onToggleFav }: Props) {
  if (loading) {
    return <div className="collab-loading">Loading...</div>
  }

  if (profiles.length === 0) {
    return <div className="collab-loading">No users yet</div>
  }

  const favOnline  = profiles.filter(p => favorites.has(p.id) && p.isOnline)
  const otherOnline = profiles.filter(p => !favorites.has(p.id) && p.isOnline)
  const offline    = profiles.filter(p => !p.isOnline)

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
    <div className="fscroll">
      {rows(favOnline)}
      {favOnline.length > 0 && otherOnline.length > 0 && <div className="sep" />}
      {rows(otherOnline)}
      {(favOnline.length > 0 || otherOnline.length > 0) && offline.length > 0 && <div className="sep" />}
      {rows(offline)}
    </div>
  )
}
