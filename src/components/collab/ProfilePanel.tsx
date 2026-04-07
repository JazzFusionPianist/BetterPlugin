import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import { getInitials } from '../../types/collab'

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

export default function ProfilePanel({ supabase, user, me, followingProfiles, followerProfiles, onClose: _onClose, onUpdated, onOpenChat, onRemoveFriend, favorites, onToggleFav }: Props) {
  const [mode, setMode] = useState<'main' | 'party'>('main')
  const fileRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const orbsRef = useRef<Orb[]>([])
  const sizeRef = useRef({ w: 300, h: 480 })
  const [, forceRender] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; below: boolean } | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wallBounceRef = useRef(true)
  const enterFromOutsideRef = useRef(false)
  const prevModeRef = useRef(mode)
  const speedFactorRef = useRef(1)
  const exclusionPadRef = useRef(6)

  const displayProfiles = useMemo(
    () => mode === 'main' ? followingProfiles.filter(p => p.isOnline) : followerProfiles,
    [mode, followingProfiles, followerProfiles]
  )
  const [renderProfiles, setRenderProfiles] = useState<Profile[]>(displayProfiles)
  const [transitionTick, setTransitionTick] = useState(0)

  useEffect(() => {
    if (prevModeRef.current === mode) {
      setRenderProfiles(displayProfiles)
      return
    }
    prevModeRef.current = mode
    // Phase 1: send existing orbs flying outward
    const c = containerRef.current
    if (!c) { setRenderProfiles(displayProfiles); return }
    const rect = c.getBoundingClientRect()
    const cx = rect.width / 2, cy = rect.height / 2
    for (const o of orbsRef.current) {
      const dx = o.x - cx, dy = o.y - cy
      const d = Math.hypot(dx, dy) || 0.001
      o.vx = dx / d * 6
      o.vy = dy / d * 6
      o.frozen = false
    }
    wallBounceRef.current = false
    const t = setTimeout(() => {
      enterFromOutsideRef.current = true
      setRenderProfiles(displayProfiles)
      setTransitionTick(v => v + 1)
    }, 380)
    return () => clearTimeout(t)
  }, [mode, displayProfiles])

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
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/avatar-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setUploading(false); showMsg('upload failed: ' + upErr.message); return }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: dbErr } = await supabase
      .from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id)
    setUploading(false)
    if (dbErr) showMsg('db update failed: ' + dbErr.message)
    else { showMsg('photo updated'); onUpdated() }
    if (fileRef.current) fileRef.current.value = ''
  }

  const displayName = me?.display_name ?? ''
  const initials = me?.initials ?? getInitials(displayName || 'U')
  const color = me?.avatar_color ?? '#4A8FE7'
  const photo = me?.avatar_url

  // Initialize orbs whenever display list changes
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
      wallBounceRef.current = true
      enterFromOutsideRef.current = false
      forceRender(v => v + 1)
      return
    }

    const cx = W / 2
    const cy = H / 2
    const reservedBottom = 36
    const usable = Math.max(1, (W * (H - reservedBottom) - Math.PI * SELF_RADIUS * SELF_RADIUS) * 0.22)
    const rRaw = Math.sqrt(usable / (N * Math.PI))
    const baseR = Math.max(6, Math.min(14, rRaw))
    const favR = Math.max(baseR * 1.4, baseR + 5)
    const exclusionPad = Math.max(10, 40 - Math.sqrt(N) * 1.5)
    const speedFactor = Math.max(0.15, 1 - Math.log10(Math.max(1, N)) * 0.35)
    speedFactorRef.current = speedFactor
    exclusionPadRef.current = exclusionPad

    const orbs: Orb[] = []
    for (let i = 0; i < N; i++) {
      const r = favorites.has(renderProfiles[i]!.id) ? favR : baseR
      let placed = false
      for (let attempt = 0; attempt < 300 && !placed; attempt++) {
        const x = r + Math.random() * (W - 2 * r)
        const y = r + Math.random() * (H - reservedBottom - 2 * r)
        if (Math.hypot(x - cx, y - cy) < SELF_RADIUS + r + exclusionPad) continue
        let ok = true
        for (const o of orbs) {
          if (Math.hypot(x - o.x, y - o.y) < r + o.r + 4) { ok = false; break }
        }
        if (!ok) continue
        const angle = Math.random() * Math.PI * 2
        const speed = (0.2 + Math.random() * 0.2) * speedFactor
        orbs.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, frozen: false, el: null })
        placed = true
      }
      if (!placed) {
        const angle = (i / N) * Math.PI * 2
        const ringR = SELF_RADIUS + r + 8
        orbs.push({ x: cx + Math.cos(angle) * ringR, y: cy + Math.sin(angle) * ringR, vx: 0.1, vy: 0.1, r, frozen: false, el: null })
      }
    }
    if (enterFromOutsideRef.current) {
      // Place each new orb just outside the container along its angle from center,
      // moving inward toward the computed final position
      for (const orb of orbs) {
        const dx = orb.x - cx, dy = orb.y - cy
        const d = Math.hypot(dx, dy) || 0.001
        const nx = dx / d, ny = dy / d
        const startDist = Math.max(W, H) * 0.65
        orb.x = cx + nx * startDist
        orb.y = cy + ny * startDist
        orb.vx = -nx * 0.7
        orb.vy = -ny * 0.7
      }
      setTimeout(() => { wallBounceRef.current = true }, 120)
      enterFromOutsideRef.current = false
    } else {
      wallBounceRef.current = true
    }
    orbsRef.current = orbs
    setHoveredIdx(null)
    setTooltipPos(null)
    forceRender(v => v + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderProfiles.map(p => p.id).join('|'), Array.from(favorites).sort().join('|'), transitionTick])

  // Animation loop
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const orbs = orbsRef.current
      const { w: W, h: H } = sizeRef.current
      const cx = W / 2, cy = H / 2
      const reservedBottom = 36

      const transitioning = !wallBounceRef.current
      const sf = speedFactorRef.current
      for (const o of orbs) {
        if (o.frozen) continue
        if (!transitioning) {
          o.vx += (Math.random() - 0.5) * 0.04 * sf
          o.vy += (Math.random() - 0.5) * 0.04 * sf
        }
        const sp = Math.hypot(o.vx, o.vy)
        const maxSp = transitioning ? 8 : 0.55 * sf
        const minSp = transitioning ? 0 : 0.22 * sf
        if (sp > maxSp) { o.vx = o.vx / sp * maxSp; o.vy = o.vy / sp * maxSp }
        else if (sp < minSp && sp > 0) { o.vx = o.vx / sp * minSp; o.vy = o.vy / sp * minSp }
        o.x += o.vx
        o.y += o.vy
      }

      if (wallBounceRef.current) {
        for (const o of orbs) {
          if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) }
          if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx) }
          if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy) }
          if (o.y > H - reservedBottom - o.r) { o.y = H - reservedBottom - o.r; o.vy = -Math.abs(o.vy) }
        }
      }

      for (const o of orbs) {
        const dx = o.x - cx, dy = o.y - cy
        const d = Math.hypot(dx, dy) || 0.001
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

      for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
          const a = orbs[i]!, b = orbs[j]!
          const dx = b.x - a.x, dy = b.y - a.y
          const d = Math.hypot(dx, dy) || 0.001
          const min = a.r + b.r + 2
          if (d < min) {
            const nx = dx / d, ny = dy / d
            const overlap = (min - d) / 2
            a.x -= nx * overlap; a.y -= ny * overlap
            b.x += nx * overlap; b.y += ny * overlap
            const va = a.vx * nx + a.vy * ny
            const vb = b.vx * nx + b.vy * ny
            const diff = vb - va
            a.vx += diff * nx; a.vy += diff * ny
            b.vx -= diff * nx; b.vy -= diff * ny
          }
        }
      }

      for (const o of orbs) {
        if (o.el) o.el.style.transform = `translate(${o.x - o.r}px, ${o.y - o.r}px)`
      }

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
    const below = orb.y - orb.r < 90
    const W = sizeRef.current.w
    const halfTT = 70
    const clampedX = Math.max(halfTT + 4, Math.min(W - halfTT - 4, orb.x))
    setTooltipPos({ x: clampedX, y: orb.y - orb.r, below: false })
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

  const handleUnfollow = async (id: string) => {
    await onRemoveFriend(id)
    setHoveredIdx(null)
    setTooltipPos(null)
  }

  const hoveredProfile = hoveredIdx !== null ? renderProfiles[hoveredIdx] : null

  return (
    <>
      <div className="s-body profile-orbit-body">
        <div className="profile-orbit" ref={containerRef}>
          <button
            className="orbit-mode-toggle-btn"
            onClick={() => setMode(m => m === 'main' ? 'party' : 'main')}
          >
            {mode}
          </button>
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
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" />
                  : <span>{p.initials}</span>}
                {p.isOnline && <div className="orbit-orb-dot" />}
                {favorites.has(p.id) && <div className="orbit-orb-fav">★</div>}
              </div>
            )
          })}

          <button
            className="profile-av-btn orbit-self"
            onClick={handlePickFile}
            disabled={uploading}
            title="Change photo"
            style={{ width: SELF_RADIUS * 2, height: SELF_RADIUS * 2 }}
          >
            <div className="av profile-av" style={{ background: color, width: SELF_RADIUS * 2, height: SELF_RADIUS * 2 }}>
              {photo ? <img src={photo} alt="avatar" /> : <span>{initials}</span>}
            </div>
            <div className="profile-av-overlay">
              {uploading ? '...' : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
          </button>

          {hoveredProfile && tooltipPos && (
            <div
              className={`orbit-tooltip${tooltipPos.below ? ' below' : ''}`}
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
              onMouseEnter={handleTooltipEnter}
              onMouseLeave={() => hoveredIdx !== null && handleOrbLeave(hoveredIdx)}
            >
              <div className="orbit-tt-name-row">
                <div className="orbit-tt-name">{hoveredProfile.display_name}</div>
                <button
                  className={`orbit-tt-star${favorites.has(hoveredProfile.id) ? ' on' : ''}`}
                  onClick={() => onToggleFav(hoveredProfile.id)}
                  title={favorites.has(hoveredProfile.id) ? 'Unfavorite' : 'Favorite'}
                >
                  ★
                </button>
              </div>
              <button className="orbit-tt-btn" onClick={() => handleUnfollow(hoveredProfile.id)}>following</button>
            </div>
          )}

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
    </>
  )
}
