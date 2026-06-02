import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import type { LiveSession } from '../../hooks/useLive'
import { getInitials } from '../../types/collab'
import HoverTooltip from './HoverTooltip'
import { useT } from '../../i18n/LanguageContext'

interface Props {
  supabase: SupabaseClient
  user: User
  me: Profile | null
  followingProfiles: Profile[]
  followerProfiles: Profile[]
  onClose: () => void
  onUpdated: () => void
  onOpenChat: (id: string) => void
  onRemoveFriend: (id: string) => Promise<void>
  favorites: Set<string>
  onToggleFav: (id: string) => void
  onViewProfile?: (id: string) => void
  onAvatarUpdated?: (url: string) => void
  viewOnly?: boolean
  liveHostIds?: Set<string>
  liveSessions?: LiveSession[]
  onWatchLive?: (sessionId: string) => void
}

interface Orb {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  frozen: boolean
  el: HTMLDivElement | null
}

const SELF_RADIUS = 38

/**
 * Single-panel profile view. The legacy main↔party toggle and the music
 * panel were retired; this is now the only profile surface. The
 * friend-orb backdrop, the members/following chips, and the avatar all
 * live together on this one screen.
 */
export default function ProfilePanel ({
  supabase, user, me,
  followingProfiles, followerProfiles,
  onClose, onUpdated, onOpenChat, onRemoveFriend,
  favorites, onToggleFav, onViewProfile, onAvatarUpdated,
  viewOnly,
  liveHostIds, liveSessions, onWatchLive,
}: Props) {
  const { t } = useT()
  void onRemoveFriend // retained on the props contract for future use
  const fileRef       = useRef<HTMLInputElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const orbsRef       = useRef<Orb[]>([])
  const sizeRef       = useRef({ w: 300, h: 480 })
  const [, forceRender]      = useState(0)
  const [uploading, setUploading]    = useState(false)
  const [msg, setMsg]                = useState<string | null>(null)
  const [hoveredIdx, setHoveredIdx]  = useState<number | null>(null)
  const [tooltipPos, setTooltipPos]  = useState<{ x: number; y: number; below: boolean } | null>(null)
  const hoverTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speedFactorRef               = useRef(1)
  const exclusionPadRef              = useRef(6)
  const [statList, setStatList]      = useState<'members' | 'following' | null>(null)
  const lastListRef                  = useRef<'members' | 'following'>('members')

  useEffect(() => { if (statList) lastListRef.current = statList }, [statList])

  // The orb backdrop mirrors the *members* count — the followers of
  // whoever this profile belongs to (you on your own panel, the
  // friend on their panel). Mirrors the deleted party-panel
  // backdrop. Sets are derived once for HoverTooltip's status pill
  // (mutual / following / follows-you).
  const renderProfiles = followerProfiles
  const followingSet = useMemo(() => new Set(followingProfiles.map(p => p.id)), [followingProfiles])
  const followerSet  = useMemo(() => new Set(followerProfiles.map(p => p.id)), [followerProfiles])

  const showMsg = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2400)
  }

  const handlePickFile = () => fileRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showMsg('max 5MB'); return }
    setUploading(true)
    const ext  = file.name.split('.').pop() || 'png'
    const path = `${user.id}/avatar-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setUploading(false); showMsg('upload failed: ' + upErr.message); return }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: dbErr } = await supabase
      .from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id)
    setUploading(false)
    if (dbErr) showMsg('db update failed: ' + dbErr.message)
    else { onAvatarUpdated?.(pub.publicUrl); showMsg('photo updated'); onUpdated() }
    if (fileRef.current) fileRef.current.value = ''
  }

  const displayName = me?.display_name ?? ''
  const initials    = me?.initials ?? getInitials(displayName || 'Unknown')
  const color       = me?.avatar_color ?? '#4A8FE7'
  const photo       = me?.avatar_url

  // ── Orb seeding ──────────────────────────────────────────────────────────
  // Re-seed whenever the membership list or favourites change. Orbs spawn
  // anywhere in the panel below the top-bar; the centre is open at first
  // (random distribution may put an orb there) but the runtime exclusion
  // pushes it back out within a few frames so the avatar stays uncovered.
  useLayoutEffect(() => {
    const c = containerRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const W = rect.width
    const H = rect.height
    sizeRef.current = { w: W, h: H }

    const N = renderProfiles.length
    if (N === 0) {
      orbsRef.current = []
      forceRender(v => v + 1)
      return
    }

    const reservedBottom = 4
    const usable      = Math.max(1, (W * (H - reservedBottom) - Math.PI * SELF_RADIUS * SELF_RADIUS) * 0.22)
    const rRaw        = Math.sqrt(usable / (N * Math.PI))
    const baseR       = Math.max(4, Math.min(14, rRaw))
    const favR        = Math.max(baseR * 1.4, baseR + 5)
    const exclusionPad = Math.max(18, 48 - Math.sqrt(N) * 1.5)
    const speedFactor  = Math.max(0.15, 1 - Math.log10(Math.max(1, N)) * 0.35)
    speedFactorRef.current  = speedFactor
    exclusionPadRef.current = exclusionPad

    const orbs: Orb[] = []
    for (let i = 0; i < N; i++) {
      const r = favorites.has(renderProfiles[i]!.id) ? favR : baseR
      const x = r + Math.random() * (W - 2 * r)
      const y = r + Math.random() * (H - reservedBottom - 2 * r)
      const angle = Math.random() * Math.PI * 2
      const speed = (0.06 + Math.random() * 0.08) * speedFactor
      orbs.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, frozen: false, el: null })
    }
    orbsRef.current = orbs
    setHoveredIdx(null)
    setTooltipPos(null)
    forceRender(v => v + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderProfiles.map(p => p.id).join('|'), Array.from(favorites).sort().join('|')])

  // ── Animation loop ───────────────────────────────────────────────────────
  // Brownian drift + wall bounce + circular exclusion around the avatar.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const orbs = orbsRef.current
      const { w: W, h: H } = sizeRef.current
      const cx = W / 2, cy = H / 2
      const reservedBottom = 4
      const sf = speedFactorRef.current

      for (const o of orbs) {
        if (o.frozen) continue
        o.vx += (Math.random() - 0.5) * 0.012 * sf
        o.vy += (Math.random() - 0.5) * 0.012 * sf
        const sp = Math.hypot(o.vx, o.vy)
        const maxSp = 0.18 * sf
        const minSp = 0.06 * sf
        if (sp > maxSp) { o.vx = o.vx / sp * maxSp; o.vy = o.vy / sp * maxSp }
        else if (sp < minSp && sp > 0) { o.vx = o.vx / sp * minSp; o.vy = o.vy / sp * minSp }
        o.x += o.vx
        o.y += o.vy
      }

      // Walls — orbs stay inside the panel area (top-bar is owned by the
      // app's icon row; we don't paint into it).
      for (const o of orbs) {
        if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) }
        if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx) }
        if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy) }
        if (o.y > H - reservedBottom - o.r) { o.y = H - reservedBottom - o.r; o.vy = -Math.abs(o.vy) }
      }

      // Centre exclusion — push orbs out of the avatar's circle so the
      // photo stays unobscured.
      for (const o of orbs) {
        const dx = o.x - cx, dy = o.y - cy
        const d  = Math.hypot(dx, dy) || 0.001
        const min = SELF_RADIUS + o.r + exclusionPadRef.current
        if (d < min) {
          const nx = dx / d, ny = dy / d
          o.x = cx + nx * min
          o.y = cy + ny * min
          const dot = o.vx * nx + o.vy * ny
          if (dot < 0) {
            o.vx -= 2 * dot * nx
            o.vy -= 2 * dot * ny
          }
        }
      }

      for (const o of orbs)
        if (o.el) o.el.style.transform = `translate(${o.x - o.r}px, ${o.y - o.r}px)`

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleOrbEnter = (idx: number) => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    const orb = orbsRef.current[idx]
    if (!orb) return
    orb.frozen = true
    setHoveredIdx(idx)
    const W = sizeRef.current.w
    const halfTT = 70
    const clampedX = Math.max(halfTT + 4, Math.min(W - halfTT - 4, orb.x))
    const tooltipH = 80
    const below = orb.y - orb.r < tooltipH
    setTooltipPos({ x: clampedX, y: below ? orb.y + orb.r : orb.y - orb.r, below })
  }

  const handleOrbLeave = (idx: number) => {
    hoverTimerRef.current = setTimeout(() => {
      const orb = orbsRef.current[idx]
      if (orb) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.3
        orb.vx = Math.cos(angle) * speed
        orb.vy = Math.sin(angle) * speed
        orb.frozen = false
      }
      setHoveredIdx(null)
      setTooltipPos(null)
    }, 200)
  }

  const handleTooltipEnter = () => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
  }

  const hoveredProfile = hoveredIdx !== null ? renderProfiles[hoveredIdx] : null

  // The list shown when a stat chip is open. Falls back to the last
  // selected list while collapsing so the rows stay rendered (no flash
  // of empty content) until the fade-out finishes.
  const listProfiles = (statList === 'members' ? followerProfiles
    : statList === 'following' ? followingProfiles
    : lastListRef.current === 'members' ? followerProfiles
    : followingProfiles)

  return (
    <div className="s-body profile-orbit-body">
      <div className="profile-orbit" ref={containerRef}>
        {viewOnly && (
          <button className="orbit-back-btn" onClick={onClose} title="Back">← back</button>
        )}

        {/* Friend-orb backdrop. Always-on ambient style — translucent and
            slightly bright so the foreground glass UI reads cleanly on
            top while the orbs still register motion. */}
        <div className="orbit-orbs-layer">
          {renderProfiles.map((p, i) => {
            const orb = orbsRef.current[i]
            const r = orb?.r ?? 14
            return (
              <div
                key={p.id}
                className={`orbit-orb${p.isOnline ? '' : ' offline'}`}
                ref={(el) => { if (orbsRef.current[i]) orbsRef.current[i]!.el = el }}
                style={{
                  width: r * 2,
                  height: r * 2,
                  background: p.avatar_color,
                  fontSize: Math.max(8, r * 0.55),
                  cursor: 'pointer',
                }}
                onMouseEnter={() => handleOrbEnter(i)}
                onMouseLeave={() => handleOrbLeave(i)}
                onClick={() => onOpenChat(p.id)}
              >
                {p.avatar_url && <img src={p.avatar_url} alt="" />}
                {liveHostIds?.has(p.id)
                  ? <div className="orbit-orb-livedot" />
                  : p.isOnline && <div className="orbit-orb-dot" />}
                {favorites.has(p.id) && <div className="orbit-orb-fav">★</div>}
              </div>
            )
          })}
        </div>

        {/* Members / Following stats — always visible at the top. */}
        <div className="orbit-stats">
          <div
            className={`orbit-stat${statList === 'members' ? ' active' : ''}`}
            onClick={() => setStatList(s => s === 'members' ? null : 'members')}
          >
            <span className="orbit-stat-count">{followerProfiles.length}</span>
            <span className="orbit-stat-label">{t('profile.members')}</span>
          </div>
          <div
            className={`orbit-stat${statList === 'following' ? ' active' : ''}`}
            onClick={() => setStatList(s => s === 'following' ? null : 'following')}
          >
            <span className="orbit-stat-count">{followingProfiles.length}</span>
            <span className="orbit-stat-label">{t('profile.following')}</span>
          </div>
        </div>

        {/* Friend list — opens when a stat chip is selected. Each row is
            a glass capsule that opens that user's profile. */}
        <div className={`orbit-stat-list${statList ? ' open' : ''}`}>
          {listProfiles.map(p => (
            <div
              key={p.id}
              className="orbit-stat-row"
              onClick={() => onViewProfile?.(p.id)}
            >
              <div className="orbit-stat-av" style={{ background: p.avatar_color }}>
                {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{p.initials}</span>}
                {p.isOnline && <div className="orbit-stat-online" />}
              </div>
              <span className="orbit-stat-row-name">{p.display_name}</span>
            </div>
          ))}
        </div>

        {/* Avatar — always centred. */}
        <button
          className="profile-av-btn orbit-self"
          onClick={viewOnly ? undefined : handlePickFile}
          disabled={uploading || viewOnly}
          title={viewOnly ? displayName : t('profile.changePhoto')}
          style={{ width: SELF_RADIUS * 2, height: SELF_RADIUS * 2, cursor: viewOnly ? 'default' : undefined }}
        >
          <div className="av profile-av" style={{ background: color, width: SELF_RADIUS * 2, height: SELF_RADIUS * 2 }}>
            {photo ? <img src={photo} alt="avatar" /> : <span>{initials}</span>}
          </div>
          {viewOnly ? null : (
            <div className="profile-av-overlay">
              {uploading ? '...' : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
          )}
        </button>

        {/* Friend hover card — pops above/below the hovered orb. */}
        {hoveredProfile && tooltipPos && (() => {
          const liveSession = liveHostIds?.has(hoveredProfile.id)
            ? liveSessions?.find(s => s.host_id === hoveredProfile.id) ?? null
            : null
          return (
            <HoverTooltip
              supabase={supabase}
              profile={hoveredProfile}
              x={tooltipPos.x}
              y={tooltipPos.y}
              below={tooltipPos.below}
              isMutual={followingSet.has(hoveredProfile.id) && followerSet.has(hoveredProfile.id)}
              isFollowing={followingSet.has(hoveredProfile.id)}
              isFollower={followerSet.has(hoveredProfile.id)}
              isFavorite={favorites.has(hoveredProfile.id)}
              onToggleFavorite={() => onToggleFav(hoveredProfile.id)}
              liveSessionId={liveSession?.id ?? null}
              onJoinLive={liveSession && onWatchLive ? () => onWatchLive(liveSession.id) : undefined}
              onMessage={() => onOpenChat(hoveredProfile.id)}
              onViewProfile={() => onViewProfile?.(hoveredProfile.id)}
              onMouseEnter={handleTooltipEnter}
              onMouseLeave={() => hoveredIdx !== null && handleOrbLeave(hoveredIdx)}
            />
          )
        })()}

        {/* Display name — bottom of the panel. */}
        <div className="orbit-bottom">
          <div className="orbit-name">{displayName}</div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {msg && <div className="profile-msg">{msg}</div>}
    </div>
  )
}
