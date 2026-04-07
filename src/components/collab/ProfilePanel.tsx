import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import { getInitials } from '../../types/collab'

interface Props {
  supabase: SupabaseClient
  user: User
  me: Profile | null
  friendProfiles: Profile[]
  onClose: () => void
  onUpdated: () => void
  onOpenChat: (id: string) => void
  onRemoveFriend: (id: string) => Promise<void>
}

interface Orb {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  el: HTMLDivElement | null
}

const SELF_RADIUS = 38

export default function ProfilePanel({ supabase, user, me, friendProfiles, onClose: _onClose, onUpdated, onOpenChat, onRemoveFriend }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const orbsRef = useRef<Orb[]>([])
  const sizeRef = useRef({ w: 300, h: 480 })
  const [, forceRender] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [partyOpen, setPartyOpen] = useState(false)

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

  // Initialize orbs whenever friend list or container size changes
  useLayoutEffect(() => {
    const c = containerRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const W = rect.width
    const H = rect.height
    sizeRef.current = { w: W, h: H }

    const N = friendProfiles.length
    if (N === 0) {
      orbsRef.current = []
      forceRender(v => v + 1)
      return
    }

    const cx = W / 2
    const cy = H / 2
    const reservedBottom = 36 // space for the name
    const usable = Math.max(1, (W * (H - reservedBottom) - Math.PI * SELF_RADIUS * SELF_RADIUS) * 0.22)
    const rRaw = Math.sqrt(usable / (N * Math.PI))
    const r = Math.max(8, Math.min(26, rRaw))

    const orbs: Orb[] = []
    for (let i = 0; i < N; i++) {
      let placed = false
      for (let attempt = 0; attempt < 300 && !placed; attempt++) {
        const x = r + Math.random() * (W - 2 * r)
        const y = r + Math.random() * (H - reservedBottom - 2 * r)
        if (Math.hypot(x - cx, y - cy) < SELF_RADIUS + r + 6) continue
        let ok = true
        for (const o of orbs) {
          if (Math.hypot(x - o.x, y - o.y) < r + o.r + 4) { ok = false; break }
        }
        if (!ok) continue
        const angle = Math.random() * Math.PI * 2
        const speed = 0.2 + Math.random() * 0.2
        orbs.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, el: null })
        placed = true
      }
      if (!placed) {
        // Fallback ring placement
        const angle = (i / N) * Math.PI * 2
        const ringR = SELF_RADIUS + r + 8
        orbs.push({
          x: cx + Math.cos(angle) * ringR,
          y: cy + Math.sin(angle) * ringR,
          vx: 0.1, vy: 0.1, r, el: null,
        })
      }
    }
    orbsRef.current = orbs
    forceRender(v => v + 1)
  }, [friendProfiles])

  // Animation loop
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const orbs = orbsRef.current
      const { w: W, h: H } = sizeRef.current
      const cx = W / 2, cy = H / 2
      const reservedBottom = 36

      // Move + small random drift
      for (const o of orbs) {
        o.vx += (Math.random() - 0.5) * 0.04
        o.vy += (Math.random() - 0.5) * 0.04
        // clamp speed
        const sp = Math.hypot(o.vx, o.vy)
        const maxSp = 0.55
        const minSp = 0.22
        if (sp > maxSp) { o.vx = o.vx / sp * maxSp; o.vy = o.vy / sp * maxSp }
        else if (sp < minSp && sp > 0) { o.vx = o.vx / sp * minSp; o.vy = o.vy / sp * minSp }
        o.x += o.vx
        o.y += o.vy
      }

      // Wall bounce
      for (const o of orbs) {
        if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) }
        if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx) }
        if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy) }
        if (o.y > H - reservedBottom - o.r) { o.y = H - reservedBottom - o.r; o.vy = -Math.abs(o.vy) }
      }

      // Self-avatar collision
      for (const o of orbs) {
        const dx = o.x - cx, dy = o.y - cy
        const d = Math.hypot(dx, dy) || 0.001
        const min = SELF_RADIUS + o.r + 2
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

      // Pairwise collision
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

      // Apply
      for (const o of orbs) {
        if (o.el) o.el.style.transform = `translate(${o.x - o.r}px, ${o.y - o.r}px)`
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      <div className="s-body profile-orbit-body">
        <div className="profile-orbit" ref={containerRef}>
          {friendProfiles.map((p, i) => {
            const orb = orbsRef.current[i]
            const r = orb?.r ?? 14
            return (
              <div
                key={p.id}
                className="orbit-orb"
                ref={(el) => { if (orbsRef.current[i]) orbsRef.current[i]!.el = el }}
                style={{
                  width: r * 2,
                  height: r * 2,
                  background: p.avatar_color,
                  fontSize: Math.max(8, r * 0.55),
                  cursor: 'pointer',
                }}
                title={p.display_name}
                onClick={() => onOpenChat(p.id)}
              >
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" />
                  : <span>{p.initials}</span>}
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
              {photo ? (
                <img src={photo} alt="avatar" />
              ) : (
                <span>{initials}</span>
              )}
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

          <div className="orbit-bottom">
            <div className="orbit-name">{displayName}</div>
            <div className="orbit-party" onClick={() => setPartyOpen(true)} style={{ cursor: 'pointer' }}>
              <div className="orbit-party-label">party<br />member</div>
              <div className="orbit-party-count">{friendProfiles.length}</div>
            </div>
          </div>

          {partyOpen && (
            <div className="party-list-overlay" onClick={() => setPartyOpen(false)}>
              <div className="party-list" onClick={e => e.stopPropagation()}>
                <div className="party-list-header">
                  <span>Party Members</span>
                  <span className="party-list-close" onClick={() => setPartyOpen(false)}>&times;</span>
                </div>
                <div className="party-list-body">
                  {friendProfiles.length === 0 && <div className="party-list-empty">No party members yet.</div>}
                  {friendProfiles.map(p => (
                    <div
                      key={p.id}
                      className="party-list-row"
                      onClick={() => { setPartyOpen(false); onOpenChat(p.id) }}
                    >
                      <div className="av sz32" style={{ background: p.avatar_color, width: 28, height: 28, fontSize: 11, overflow: 'hidden' }}>
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : p.initials}
                      </div>
                      <span className="party-list-name">{p.display_name}</span>
                      <button
                        className="party-list-remove"
                        onClick={(e) => { e.stopPropagation(); onRemoveFriend(p.id) }}
                        title="Remove friend"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
