'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Profile } from '@orb/core'

interface Props {
  me: Profile | null
  friends: Profile[]
  unreadByFriend: Map<string, number>
  onSelect: (friend: Profile) => void
}

interface Orb { x: number; y: number; vx: number; vy: number; r: number; el: HTMLDivElement | null }

const CENTER_R = 64   // radius of the central avatar's keep-out zone

/**
 * Immersive orb home — your avatar at the centre with your friends
 * drifting around it as orbs. Desktop-scale port of the plugin's
 * friend-orb backdrop: gentle brownian motion, wall bounce, and a
 * soft keep-out ring around the centre so orbs never cover your face.
 */
export default function OrbHome({ me, friends, unreadByFriend, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const orbsRef = useRef<Orb[]>([])
  const sizeRef = useRef({ w: 1000, h: 700 })
  const [, force] = useState(0)
  const [hovered, setHovered] = useState<{ name: string; x: number; y: number } | null>(null)

  // Seed orb positions whenever the friend set changes.
  useLayoutEffect(() => {
    const c = containerRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const W = rect.width, H = rect.height
    sizeRef.current = { w: W, h: H }
    const N = friends.length
    const baseR = Math.max(18, Math.min(34, Math.sqrt((W * H * 0.16) / (Math.max(1, N) * Math.PI))))
    const orbs: Orb[] = []
    for (let i = 0; i < N; i++) {
      // Spawn outside the centre keep-out ring.
      let x = 0, y = 0
      for (let tries = 0; tries < 20; tries++) {
        x = baseR + Math.random() * (W - 2 * baseR)
        y = baseR + Math.random() * (H - 2 * baseR)
        const dx = x - W / 2, dy = y - H / 2
        if (Math.hypot(dx, dy) > CENTER_R + baseR + 20) break
      }
      const a = Math.random() * Math.PI * 2
      const sp = 0.18 + Math.random() * 0.22
      orbs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: baseR, el: null })
    }
    orbsRef.current = orbs
    force(v => v + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends.map(f => f.id).join('|')])

  // Animation loop.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const orbs = orbsRef.current
      const { w: W, h: H } = sizeRef.current
      const cx = W / 2, cy = H / 2
      for (const o of orbs) {
        o.vx += (Math.random() - 0.5) * 0.03
        o.vy += (Math.random() - 0.5) * 0.03
        const sp = Math.hypot(o.vx, o.vy)
        const max = 0.5, min = 0.12
        if (sp > max) { o.vx = o.vx / sp * max; o.vy = o.vy / sp * max }
        else if (sp < min && sp > 0) { o.vx = o.vx / sp * min; o.vy = o.vy / sp * min }
        o.x += o.vx; o.y += o.vy
        // Walls
        if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) }
        if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx) }
        if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy) }
        if (o.y > H - o.r) { o.y = H - o.r; o.vy = -Math.abs(o.vy) }
        // Centre keep-out — push out gently
        const dx = o.x - cx, dy = o.y - cy
        const dist = Math.hypot(dx, dy)
        const minDist = CENTER_R + o.r
        if (dist < minDist && dist > 0) {
          const push = (minDist - dist) / minDist
          o.vx += (dx / dist) * push * 0.6
          o.vy += (dy / dist) * push * 0.6
        }
        if (o.el) o.el.style.transform = `translate(${o.x - o.r}px, ${o.y - o.r}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const initials = me?.initials ?? '··'
  const color = me?.avatar_color ?? '#4A8FE7'

  return (
    <div className="orbhome" ref={containerRef}>
      {/* Friend orbs */}
      {friends.map((f, i) => {
        const orb = orbsRef.current[i]
        const r = orb?.r ?? 24
        const unread = unreadByFriend.get(f.id) ?? 0
        return (
          <div
            key={f.id}
            ref={(el) => { if (orbsRef.current[i]) orbsRef.current[i]!.el = el }}
            className={`orbhome-orb${f.isOnline ? '' : ' offline'}${unread > 0 ? ' has-notif' : ''}`}
            style={{ width: r * 2, height: r * 2, background: f.avatar_color, fontSize: Math.max(11, r * 0.5) }}
            onClick={() => onSelect(f)}
            onMouseEnter={(e) => {
              const rect = containerRef.current!.getBoundingClientRect()
              setHovered({ name: f.display_name, x: e.clientX - rect.left, y: e.clientY - rect.top })
            }}
            onMouseLeave={() => setHovered(null)}
          >
            {f.avatar_url ? <img src={f.avatar_url} alt="" /> : <span>{f.initials}</span>}
            {f.isOnline && <span className="orbhome-dot" />}
            {unread > 0 && <span className="orbhome-badge">{unread > 9 ? '9+' : unread}</span>}
          </div>
        )
      })}

      {/* Centre — me */}
      <div className="orbhome-center">
        <div className="orbhome-me" style={{ background: color }}>
          {me?.avatar_url ? <img src={me.avatar_url} alt="" /> : <span>{initials}</span>}
        </div>
        <div className="orbhome-name">{me?.display_name ?? '…'}</div>
        <div className="orbhome-count">{friends.length} friends</div>
      </div>

      {hovered && (
        <div className="orbhome-tip" style={{ left: hovered.x, top: hovered.y }}>{hovered.name}</div>
      )}
    </div>
  )
}
