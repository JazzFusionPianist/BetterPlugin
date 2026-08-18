'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Profile } from '@orb/core'

export interface GroupOrbMember {
  color: string
  initials: string
  avatarUrl: string | null
}

export interface GroupOrbInfo {
  conversationId: string
  title: string
  memberCount: number
  /** Up to five resolved member profiles for the constellation nodes. */
  members: GroupOrbMember[]
}

interface Props {
  friends: Profile[]
  groups: GroupOrbInfo[]
  unreadByFriend: Map<string, number>
  unreadByGroup: Map<string, number>
  onSelect: (friend: Profile) => void
  onSelectGroup: (g: GroupOrbInfo) => void
}

/**
 * The centre block — your avatar, name, @username, counts. Rendered by
 * AppShell OUTSIDE the zoomable stage and outside the booklet pages, so
 * it holds its place while the canvas zooms and while pages turn.
 */
export function OrbHomeCenter({ me, friendCount, groupCount, onOpenSettings, onOpenDiscography }: {
  me: Profile | null
  friendCount: number
  groupCount: number
  onOpenSettings: () => void
  onOpenDiscography?: () => void
}) {
  const initials = me?.initials ?? '··'
  const color = me?.avatar_color ?? '#4A8FE7'
  return (
    <div className="orbhome-center">
      {/* Edition stamp — the membership number sits above the print */}
      {me?.member_no != null && (
        <div className="orbhome-member" title={`member #${me.member_no}`}>
          #{String(me.member_no).padStart(6, '0')}
        </div>
      )}
      <div className="orbhome-me" style={{ background: color }} onClick={onOpenSettings} role="button" aria-label="Profile & settings">
        {me?.avatar_url ? <img src={me.avatar_url} alt="" /> : <span>{initials}</span>}
      </div>
      <div className="orbhome-name">{me?.display_name ?? '…'}</div>
      {me?.username && <div className="orbhome-user">@{me.username}</div>}
      <div className="orbhome-count">
        {friendCount} friends{groupCount > 0 ? ` · ${groupCount} ${groupCount === 1 ? 'group' : 'groups'}` : ''}
      </div>
      {me?.bio && <div className="orbhome-bio">{me.bio}</div>}
      {onOpenDiscography && (
        <button className="orbhome-disco" onClick={onOpenDiscography}>discography</button>
      )}
    </div>
  )
}

interface Orb { x: number; y: number; vx: number; vy: number; r: number; el: HTMLDivElement | null }

/** A group drifts as one body — a small constellation of member orbs
 *  joined by hairlines, slowly rotating (faces stay upright). */
interface GroupBody {
  x: number; y: number; vx: number; vy: number
  rot: number; vr: number
  R: number; nodeR: number; spread: number
  el: HTMLDivElement | null
  spinEl: HTMLDivElement | null
  nodeEls: (HTMLDivElement | null)[]
}

const CENTER_R = 64   // radius of the central avatar's keep-out zone

/**
 * Immersive orb home — your avatar at the centre with your friends
 * drifting around it as orbs and your groups as constellations.
 * Gentle brownian motion, wall bounce, and a soft keep-out ring
 * around the centre so nothing covers your face.
 */
export default function OrbHome({ friends, groups, unreadByFriend, unreadByGroup, onSelect, onSelectGroup }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const orbsRef = useRef<Orb[]>([])
  const groupsRef = useRef<GroupBody[]>([])
  const sizeRef = useRef({ w: 1000, h: 700 })
  const [, force] = useState(0)
  const [hovered, setHovered] = useState<{ name: string; x: number; y: number } | null>(null)

  // Seed positions whenever the friend/group set changes.
  useLayoutEffect(() => {
    const c = containerRef.current
    if (!c) return
    // Layout size, not getBoundingClientRect — the home zoom scales this
    // container and visual measurements would double-scale the drift.
    const W = c.offsetWidth, H = c.offsetHeight
    sizeRef.current = { w: W, h: H }
    // Constellations take roughly the room of two orbs in the density budget.
    const N = friends.length + groups.length * 2
    const baseR = Math.max(18, Math.min(34, Math.sqrt((W * H * 0.16) / (Math.max(1, N) * Math.PI))))

    const spawn = (r: number) => {
      let x = 0, y = 0
      for (let tries = 0; tries < 20; tries++) {
        x = r + Math.random() * (W - 2 * r)
        y = r + Math.random() * (H - 2 * r)
        const dx = x - W / 2, dy = y - H / 2
        if (Math.hypot(dx, dy) > CENTER_R + r + 20) break
      }
      return { x, y }
    }

    orbsRef.current = friends.map(() => {
      const { x, y } = spawn(baseR)
      const a = Math.random() * Math.PI * 2
      const sp = 0.18 + Math.random() * 0.22
      return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: baseR, el: null }
    })

    groupsRef.current = groups.map((g) => {
      const k = Math.max(1, g.members.length)
      const nodeR = baseR * 0.62
      const spread = k === 1 ? 0 : nodeR * (k === 2 ? 1.5 : 1.15 + 0.28 * k)
      const R = spread + nodeR + 2
      const { x, y } = spawn(R)
      const a = Math.random() * Math.PI * 2
      const sp = 0.1 + Math.random() * 0.14
      return {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() < 0.5 ? -1 : 1) * (0.0012 + Math.random() * 0.0014),
        R, nodeR, spread, el: null, spinEl: null, nodeEls: [],
      }
    })
    force(v => v + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [[...friends.map(f => f.id), ...groups.map(g => g.conversationId)].join('|')])

  // Animation loop.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { w: W, h: H } = sizeRef.current
      const cx = W / 2, cy = H / 2

      const drift = (o: { x: number; y: number; vx: number; vy: number }, r: number, wobble: number, max: number, min: number) => {
        o.vx += (Math.random() - 0.5) * wobble
        o.vy += (Math.random() - 0.5) * wobble
        const sp = Math.hypot(o.vx, o.vy)
        if (sp > max) { o.vx = o.vx / sp * max; o.vy = o.vy / sp * max }
        else if (sp < min && sp > 0) { o.vx = o.vx / sp * min; o.vy = o.vy / sp * min }
        o.x += o.vx; o.y += o.vy
        if (o.x < r) { o.x = r; o.vx = Math.abs(o.vx) }
        if (o.x > W - r) { o.x = W - r; o.vx = -Math.abs(o.vx) }
        if (o.y < r) { o.y = r; o.vy = Math.abs(o.vy) }
        if (o.y > H - r) { o.y = H - r; o.vy = -Math.abs(o.vy) }
        const dx = o.x - cx, dy = o.y - cy
        const dist = Math.hypot(dx, dy)
        const minDist = CENTER_R + r
        if (dist < minDist && dist > 0) {
          const push = (minDist - dist) / minDist
          o.vx += (dx / dist) * push * 0.6
          o.vy += (dy / dist) * push * 0.6
        }
      }

      for (const o of orbsRef.current) {
        drift(o, o.r, 0.03, 0.5, 0.12)
        if (o.el) o.el.style.transform = `translate(${o.x - o.r}px, ${o.y - o.r}px)`
      }
      for (const b of groupsRef.current) {
        drift(b, b.R, 0.02, 0.32, 0.07)
        b.rot += b.vr
        if (b.el) b.el.style.transform = `translate(${b.x - b.R}px, ${b.y - b.R}px)`
        if (b.spinEl) b.spinEl.style.transform = `rotate(${b.rot}rad)`
        for (const n of b.nodeEls) if (n) n.style.transform = `rotate(${-b.rot}rad)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

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
              const c = containerRef.current!
              const rect = c.getBoundingClientRect()
              const k = rect.width / (c.offsetWidth || 1) // home-zoom scale
              setHovered({ name: f.display_name, x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k })
            }}
            onMouseLeave={() => setHovered(null)}
          >
            {f.avatar_url ? <img src={f.avatar_url} alt="" /> : <span>{f.initials}</span>}
            {f.isOnline && <span className="orbhome-dot" />}
            {unread > 0 && <span className="orbhome-badge">{unread > 9 ? '9+' : unread}</span>}
          </div>
        )
      })}

      {/* Group constellations — members joined by hairlines, one drifting body */}
      {groups.map((g, j) => {
        const body = groupsRef.current[j]
        if (!body) return null
        const size = body.R * 2
        const k = Math.max(1, g.members.length)
        const pts = g.members.map((_, idx) => {
          const a = (idx / k) * Math.PI * 2 - Math.PI / 2
          return { x: body.R + Math.cos(a) * body.spread, y: body.R + Math.sin(a) * body.spread }
        })
        const unread = unreadByGroup.get(g.conversationId) ?? 0
        return (
          <div
            key={g.conversationId}
            ref={(el) => { if (groupsRef.current[j]) groupsRef.current[j]!.el = el }}
            className="orbhome-const"
            style={{ width: size, height: size }}
            onClick={() => onSelectGroup(g)}
            onMouseEnter={(e) => {
              const c = containerRef.current!
              const rect = c.getBoundingClientRect()
              const k = rect.width / (c.offsetWidth || 1) // home-zoom scale
              setHovered({ name: g.title, x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k })
            }}
            onMouseLeave={() => setHovered(null)}
            role="button"
            aria-label={`Open ${g.title}`}
          >
            <div className="orbhome-const-spin" ref={(el) => { if (groupsRef.current[j]) groupsRef.current[j]!.spinEl = el }}>
              {k >= 2 && (
                <svg width={size} height={size}>
                  {pts.map((p, idx) => {
                    if (k === 2 && idx === 1) return null
                    const q = pts[(idx + 1) % k]!
                    return <line key={idx} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
                  })}
                </svg>
              )}
              {g.members.map((m, idx) => {
                const p = pts[idx]!
                return (
                  <div
                    key={idx}
                    ref={(el) => { if (groupsRef.current[j]) groupsRef.current[j]!.nodeEls[idx] = el }}
                    className="orbhome-const-node"
                    style={{
                      left: p.x - body.nodeR, top: p.y - body.nodeR,
                      width: body.nodeR * 2, height: body.nodeR * 2,
                      background: m.color,
                      fontSize: Math.max(9, body.nodeR * 0.55),
                    }}
                  >
                    {m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : <span>{m.initials}</span>}
                  </div>
                )
              })}
            </div>
            <span className="orbhome-const-label">{g.title}</span>
            {unread > 0 && <span className="orbhome-badge">{unread > 9 ? '9+' : unread}</span>}
          </div>
        )
      })}

      {/* Centre — me */}
      {hovered && (
        <div className="orbhome-tip" style={{ left: hovered.x, top: hovered.y }}>{hovered.name}</div>
      )}
    </div>
  )
}
