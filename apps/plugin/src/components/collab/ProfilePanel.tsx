import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile, Message } from '../../types/collab'
import type { LiveSession } from '../../hooks/useLive'
import { getInitials } from '../../types/collab'
import HoverTooltip from './HoverTooltip'
import SchedulePrompt from './SchedulePrompt'
import type { CalendarEvent } from '../../hooks/useCalendarEvents'
import { useT } from '../../i18n/LanguageContext'

/** A group conversation as the parent prepared it for orb rendering —
 *  member profiles already joined, plus a memberCount in case the
 *  profile list is shorter than the actual membership (profiles still
 *  loading). */
export interface GroupOrbData {
  conversationId: string
  title: string
  members: Profile[]
  memberCount: number
}

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
  /** Per-friend unread-message counts. Drives the orb pulse/halo/badge. */
  friendUnread?: Map<string, number>
  /** Latest unread message per friend — populates the floating preview. */
  friendLastMessages?: Map<string, Message>
  /** Optional override of the orb pool. Defaults to `followerProfiles`
   *  (members), but the parent may union in anyone with pending
   *  notifications so the alert visuals always have an orb to land
   *  on — even if the sender isn't a follower. */
  orbProfiles?: Profile[]
  /** Group constellations to render alongside DM orbs. Each renders
   *  as a cluster of member mini-orbs connected by faint lines. */
  groupOrbs?: GroupOrbData[]
  /** Per-group unread counts (keyed by conversation_id). */
  groupUnread?: Map<string, number>
  /** Per-group latest unread message — populates the group banner. */
  groupLastMessages?: Map<string, Message>
  /** Open a group chat. Click on a constellation fires this with the
   *  group's conversation_id. */
  onOpenGroupChat?: (conversationId: string) => void
  /** AI schedule prompt (home only). When provided, the bottom of the
   *  panel hosts the schedule input instead of just the name. */
  onSchedule?: (text: string, conversationId: string | null) => Promise<CalendarEvent[]>
  scheduleTargets?: { id: string | null; label: string }[]
}

type Orb = OrbBase & ({ kind: 'dm'; profile: Profile } | { kind: 'group'; group: GroupOrbData })

interface OrbBase {
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
  friendUnread, friendLastMessages, orbProfiles,
  groupOrbs, groupUnread, groupLastMessages, onOpenGroupChat,
  onSchedule, scheduleTargets,
}: Props) {
  const { t } = useT()
  void onRemoveFriend // retained on the props contract for future use
  const fileRef       = useRef<HTMLInputElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const statsRef      = useRef<HTMLDivElement>(null)
  const avatarRef     = useRef<HTMLButtonElement>(null)
  const nameRef       = useRef<HTMLDivElement>(null)
  const orbsRef       = useRef<Orb[]>([])
  const sizeRef       = useRef({ w: 300, h: 480 })
  // Solid obstacles the orbs bounce off, in container-local coords.
  // `rects` are AABB boxes (stats panel, name chip); `circles` are
  // round obstacles (the centre avatar). Recomputed on resize /
  // list-open. Top of the container already acts as the toolbar wall
  // via the y < r clamp, so the toolbar needs no entry here.
  const obstaclesRef  = useRef<{
    rects: { x: number; y: number; w: number; h: number }[]
    circles: { x: number; y: number; r: number }[]
  }>({ rects: [], circles: [] })
  const [, forceRender]      = useState(0)
  const [uploading, setUploading]    = useState(false)
  const [msg, setMsg]                = useState<string | null>(null)
  const [hoveredIdx, setHoveredIdx]  = useState<number | null>(null)
  const [tooltipPos, setTooltipPos]  = useState<{ x: number; y: number; below: boolean } | null>(null)
  const hoverTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speedFactorRef               = useRef(1)
  const [statList, setStatList]      = useState<'members' | 'following' | null>(null)
  const lastListRef                  = useRef<'members' | 'following'>('members')

  // ── Live message preview state ───────────────────────────────────────────
  // Each new message gets a banner that **persists** until the user
  // either (a) opens the chat (mark-seen clears it via the second
  // effect) or (b) clicks the per-banner ✕ to drop it without marking
  // the message read. The orb pulse / halo / count keep going in
  // case (b) so the user still has a cue to follow up.
  //
  // DMs and groups have separate states so neither effect needs to
  // know about the other; they render into the same banner stack.
  const [dmPreviews,    setDmPreviews]    = useState<Map<string, Message>>(new Map())  // friend id → msg
  const [groupPreviews, setGroupPreviews] = useState<Map<string, Message>>(new Map())  // conv id → msg
  const prevDmUnreadRef    = useRef<Map<string, number>>(new Map())
  const prevGroupUnreadRef = useRef<Map<string, number>>(new Map())

  // DM — detect new arrivals, surface as banners.
  useEffect(() => {
    if (!friendUnread) { prevDmUnreadRef.current = new Map(); return }
    const prev = prevDmUnreadRef.current
    const incoming: Array<[string, Message]> = []
    for (const [fid, count] of friendUnread) {
      if (count > (prev.get(fid) ?? 0)) {
        const msg = friendLastMessages?.get(fid)
        if (msg) incoming.push([fid, msg])
      }
    }
    prevDmUnreadRef.current = new Map(friendUnread)
    if (incoming.length === 0) return
    setDmPreviews(p => {
      const next = new Map(p)
      for (const [fid, msg] of incoming) next.set(fid, msg)
      return next
    })
  }, [friendUnread, friendLastMessages])

  // Group — same shape, keyed by conversation_id.
  useEffect(() => {
    if (!groupUnread) { prevGroupUnreadRef.current = new Map(); return }
    const prev = prevGroupUnreadRef.current
    const incoming: Array<[string, Message]> = []
    for (const [cid, count] of groupUnread) {
      if (count > (prev.get(cid) ?? 0)) {
        const msg = groupLastMessages?.get(cid)
        if (msg) incoming.push([cid, msg])
      }
    }
    prevGroupUnreadRef.current = new Map(groupUnread)
    if (incoming.length === 0) return
    setGroupPreviews(p => {
      const next = new Map(p)
      for (const [cid, msg] of incoming) next.set(cid, msg)
      return next
    })
  }, [groupUnread, groupLastMessages])

  // Drop banners as their unread clears (user opened the chat).
  useEffect(() => {
    if (!friendUnread) return
    let changed = false
    const next = new Map(dmPreviews)
    for (const fid of dmPreviews.keys()) {
      if (!friendUnread.has(fid)) { next.delete(fid); changed = true }
    }
    if (changed) setDmPreviews(next)
  }, [friendUnread, dmPreviews])

  useEffect(() => {
    if (!groupUnread) return
    let changed = false
    const next = new Map(groupPreviews)
    for (const cid of groupPreviews.keys()) {
      if (!groupUnread.has(cid)) { next.delete(cid); changed = true }
    }
    if (changed) setGroupPreviews(next)
  }, [groupUnread, groupPreviews])

  // Total banner count — used for hover-tooltip suppression below.
  const totalPreviews = dmPreviews.size + groupPreviews.size

  // Close any open hover tooltip the moment a banner appears.
  useEffect(() => {
    if (totalPreviews === 0) return
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    for (const o of orbsRef.current) o.frozen = false
    setHoveredIdx(null)
    setTooltipPos(null)
  }, [totalPreviews])

  // Manual ✕ dismiss — drop the banner without touching `unread`, so
  // the orb keeps pulsing and the count badge stays.
  const dismissDmPreview = (fid: string) => {
    setDmPreviews(p => {
      if (!p.has(fid)) return p
      const next = new Map(p); next.delete(fid); return next
    })
  }
  const dismissGroupPreview = (cid: string) => {
    setGroupPreviews(p => {
      if (!p.has(cid)) return p
      const next = new Map(p); next.delete(cid); return next
    })
  }

  useEffect(() => { if (statList) lastListRef.current = statList }, [statList])

  // Close the members/following list when the user clicks outside it.
  // Clicks on the stat chips themselves are excluded so their own
  // toggle handler stays in charge (clicking the active chip closes it,
  // clicking the other switches lists).
  useEffect(() => {
    if (!statList) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest('.orbit-stat-list') || target.closest('.orbit-stats')) return
      setStatList(null)
    }
    // Defer attach to the next tick so the click that opened the list
    // doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener('mousedown', onPointerDown), 0)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onPointerDown) }
  }, [statList])

  // The orb backdrop mirrors the *members* count — the followers of
  // whoever this profile belongs to (you on your own panel, the
  // friend on their panel). Mirrors the deleted party-panel
  // backdrop. Sets are derived once for HoverTooltip's status pill
  // (mutual / following / follows-you).
  // Parent may pass `orbProfiles` to include people-with-notifications
  // that aren't followers (so their pulse/preview has something to
  // attach to). Falls back to followers-only if unset.
  const renderProfiles = orbProfiles ?? followerProfiles
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
  // Re-seed whenever the membership list, group set, or favourites
  // change. Orbs spawn anywhere in the panel below the top-bar. DM
  // orbs and group constellations share the same brownian-motion
  // physics — only the rendered representation differs.
  const safeGroupOrbs = groupOrbs ?? []
  useLayoutEffect(() => {
    const c = containerRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const W = rect.width
    const H = rect.height
    sizeRef.current = { w: W, h: H }

    const N = renderProfiles.length + safeGroupOrbs.length
    if (N === 0) {
      orbsRef.current = []
      forceRender(v => v + 1)
      return
    }

    const reservedBottom = 4
    const usable      = Math.max(1, W * (H - reservedBottom) * 0.22)
    const rRaw        = Math.sqrt(usable / (N * Math.PI))
    const baseR       = Math.max(4, Math.min(14, rRaw))
    const favR        = Math.max(baseR * 1.4, baseR + 5)
    // Constellation size is *intentionally* decoupled from the DM-orb
    // sizing above — DM orbs shrink as the backdrop gets crowded (the
    // `rRaw` formula divides usable area by N), but a group orb has
    // to stay legible regardless. The size only scales with member
    // count, never with how many DM orbs share the panel.
    const groupR = (n: number) => Math.max(22, Math.min(40, 24 + n * 0.9))
    const speedFactor  = Math.max(0.15, 1 - Math.log10(Math.max(1, N)) * 0.35)
    speedFactorRef.current = speedFactor

    const orbs: Orb[] = []
    for (const p of renderProfiles) {
      const r = favorites.has(p.id) ? favR : baseR
      const x = r + Math.random() * (W - 2 * r)
      const y = r + Math.random() * (H - reservedBottom - 2 * r)
      const angle = Math.random() * Math.PI * 2
      const speed = (0.06 + Math.random() * 0.08) * speedFactor
      orbs.push({ kind: 'dm', profile: p, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, frozen: false, el: null })
    }
    for (const g of safeGroupOrbs) {
      const r = groupR(Math.max(2, g.memberCount))
      const x = r + Math.random() * (W - 2 * r)
      const y = r + Math.random() * (H - reservedBottom - 2 * r)
      const angle = Math.random() * Math.PI * 2
      const speed = (0.05 + Math.random() * 0.06) * speedFactor   // groups drift a hair slower
      orbs.push({ kind: 'group', group: g, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, frozen: false, el: null })
    }
    orbsRef.current = orbs
    setHoveredIdx(null)
    setTooltipPos(null)
    forceRender(v => v + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    renderProfiles.map(p => p.id).join('|'),
    safeGroupOrbs.map(g => g.conversationId).join('|'),
    Array.from(favorites).sort().join('|'),
  ])

  // Measure every solid obstacle (in container-local coords) so the
  // orb physics can bounce off them. Re-runs whenever the selected
  // list toggles (the stats panel grows when a list opens) and on
  // window resize; a ResizeObserver keeps it fresh for any other
  // layout shift.
  useLayoutEffect(() => {
    const measure = () => {
      const c = containerRef.current
      if (!c) { obstaclesRef.current = { rects: [], circles: [] }; return }
      const cr = c.getBoundingClientRect()
      const toLocalRect = (el: Element | null) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height }
      }
      const rects = [toLocalRect(statsRef.current), toLocalRect(nameRef.current)]
        .filter(Boolean) as { x: number; y: number; w: number; h: number }[]
      // Avatar is round — model it as a circle for a natural bounce.
      const circles: { x: number; y: number; r: number }[] = []
      const ab = avatarRef.current
      if (ab) {
        const r = ab.getBoundingClientRect()
        circles.push({
          x: r.left - cr.left + r.width / 2,
          y: r.top  - cr.top  + r.height / 2,
          r: r.width / 2,
        })
      }
      obstaclesRef.current = { rects, circles }
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (statsRef.current)     ro.observe(statsRef.current)
    if (nameRef.current)      ro.observe(nameRef.current)
    if (avatarRef.current)    ro.observe(avatarRef.current)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [statList])

  // ── Animation loop ───────────────────────────────────────────────────────
  // Brownian drift + wall bounce. Orbs can drift through the avatar
  // freely — the prior centre-exclusion ring was producing a visible
  // clump on first paint because every orb that initialised inside it
  // got snapped to the boundary at once. Letting them pass through
  // looks calmer and reads as a genuinely even distribution.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const orbs = orbsRef.current
      const { w: W, h: H } = sizeRef.current
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

      // Solid obstacles — stats panel, name chip (AABB) and the centre
      // avatar (circle). Orbs bounce off them like the panel walls.
      const { rects, circles } = obstaclesRef.current
      for (const o of orbs) {
        if (o.frozen) continue

        // Circle-vs-AABB for each rectangular obstacle.
        for (const box of rects) {
          const bx0 = box.x, by0 = box.y
          const bx1 = box.x + box.w, by1 = box.y + box.h
          const nx = Math.max(bx0, Math.min(o.x, bx1))
          const ny = Math.max(by0, Math.min(o.y, by1))
          const dx = o.x - nx
          const dy = o.y - ny
          const distSq = dx * dx + dy * dy
          if (distSq >= o.r * o.r) continue

          if (o.x > bx0 && o.x < bx1 && o.y > by0 && o.y < by1) {
            const toLeft   = o.x - bx0
            const toRight  = bx1 - o.x
            const toTop    = o.y - by0
            const toBottom = by1 - o.y
            const m = Math.min(toLeft, toRight, toTop, toBottom)
            if (m === toLeft)        { o.x = bx0 - o.r; o.vx = -Math.abs(o.vx) }
            else if (m === toRight)  { o.x = bx1 + o.r; o.vx =  Math.abs(o.vx) }
            else if (m === toTop)    { o.y = by0 - o.r; o.vy = -Math.abs(o.vy) }
            else                     { o.y = by1 + o.r; o.vy =  Math.abs(o.vy) }
          } else {
            const dist = Math.sqrt(distSq) || 0.0001
            const ux = dx / dist, uy = dy / dist
            o.x = nx + ux * o.r
            o.y = ny + uy * o.r
            const vDot = o.vx * ux + o.vy * uy
            if (vDot < 0) { o.vx -= 2 * vDot * ux; o.vy -= 2 * vDot * uy }
          }
        }

        // Circle-vs-circle for the avatar — push the orb out to the
        // combined-radius distance and reflect its velocity onto the
        // contact normal.
        for (const cc of circles) {
          const dx = o.x - cc.x
          const dy = o.y - cc.y
          const minDist = cc.r + o.r
          const distSq = dx * dx + dy * dy
          if (distSq >= minDist * minDist) continue
          const dist = Math.sqrt(distSq) || 0.0001
          const ux = dx / dist, uy = dy / dist
          o.x = cc.x + ux * minDist
          o.y = cc.y + uy * minDist
          const vDot = o.vx * ux + o.vy * uy
          if (vDot < 0) { o.vx -= 2 * vDot * ux; o.vy -= 2 * vDot * uy }
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
    // Notification banners live at the top of the panel; the hover
    // tooltip would draw right over them. While any preview is
    // showing we suppress the tooltip entirely — the orb still
    // clicks through to its chat, which is what the user wants
    // anyway when an orb is pulsing.
    if (totalPreviews > 0) return
    orb.frozen = true
    setHoveredIdx(idx)
    const W = sizeRef.current.w
    const halfTT = 70
    const clampedX = Math.max(halfTT + 4, Math.min(W - halfTT - 4, orb.x))
    // Group tooltips carry title + members + button → taller than DM
    // tooltips. Use a per-kind height so the "flip below the orb"
    // decision actually reflects whether the card fits above without
    // getting clipped by .profile-orbit's overflow:hidden.
    const tooltipH = orb.kind === 'group' ? 130 : 80
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

  const hoveredOrb     = hoveredIdx !== null ? orbsRef.current[hoveredIdx] : null
  const hoveredProfile = hoveredOrb?.kind === 'dm'    ? hoveredOrb.profile : null
  const hoveredGroup   = hoveredOrb?.kind === 'group' ? hoveredOrb.group   : null

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
          {orbsRef.current.map((orb, i) => {
            if (orb.kind === 'dm') {
              const p = orb.profile
              const r = orb.r
              const unread = friendUnread?.get(p.id) ?? 0
              const hasNotif = unread > 0
              return (
                <div
                  key={`dm:${p.id}`}
                  className={`orbit-orb${p.isOnline ? '' : ' offline'}${hasNotif ? ' has-notif' : ''}`}
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
                  {hasNotif && <div className="orbit-orb-notif-halo" />}
                  {hasNotif && unread > 1 && (
                    <div className="orbit-orb-notif-count">{unread > 9 ? '9+' : unread}</div>
                  )}
                </div>
              )
            }

            // ── Group constellation ──────────────────────────────────────
            // Read the LATEST group data from the prop, falling back to
            // the cached orb.group only when the prop hasn't caught up
            // yet. The cached version is what got seeded into the
            // physics ref at mount time — useLayoutEffect re-seeds only
            // when conversationIds change, NOT when a group's title,
            // member count, or member list mutates. Without this
            // lookup, renames/member-edits never reach the label.
            const g = safeGroupOrbs.find(gg => gg.conversationId === orb.group.conversationId) ?? orb.group
            const r = orb.r
            const unread = groupUnread?.get(g.conversationId) ?? 0
            const hasNotif = unread > 0
            // Show up to 6 member mini-orbs; group is capped at 16 in DB
            // but the constellation reads as cluttered past 6. Beyond
            // that we just stop adding — the count badge already cues
            // "this is a big one".
            const shown = g.members.slice(0, 6)
            const innerR = r * 0.62   // radius of the ring the mini-orbs sit on
            const miniR  = Math.max(3, r * 0.28)
            // Pre-compute positions so we can draw both the mini-orbs
            // AND the connecting SVG lines from the same data.
            const positions = shown.map((m, idx) => {
              const angle = (idx / shown.length) * Math.PI * 2 - Math.PI / 2  // start at 12 o'clock
              return {
                profile: m,
                cx: r + Math.cos(angle) * innerR,
                cy: r + Math.sin(angle) * innerR,
              }
            })
            return (
              <div
                key={`grp:${g.conversationId}`}
                className={`orbit-orb orbit-constellation${hasNotif ? ' has-notif' : ''}`}
                ref={(el) => { if (orbsRef.current[i]) orbsRef.current[i]!.el = el }}
                style={{
                  width: r * 2,
                  height: r * 2,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => handleOrbEnter(i)}
                onMouseLeave={() => handleOrbLeave(i)}
                onClick={() => onOpenGroupChat?.(g.conversationId)}
                title={g.title}
              >
                {/* Connecting lines — sit behind the mini-orbs. */}
                <svg
                  className="orbit-constellation-lines"
                  width={r * 2}
                  height={r * 2}
                  viewBox={`0 0 ${r * 2} ${r * 2}`}
                >
                  {positions.map((p, j) => {
                    const next = positions[(j + 1) % positions.length]!
                    return (
                      <line
                        key={j}
                        x1={p.cx} y1={p.cy}
                        x2={next.cx} y2={next.cy}
                      />
                    )
                  })}
                </svg>
                {positions.map((pos, j) => (
                  <div
                    key={`mini-${j}`}
                    className="orbit-constellation-mini"
                    style={{
                      left: pos.cx - miniR,
                      top:  pos.cy - miniR,
                      width: miniR * 2,
                      height: miniR * 2,
                      background: pos.profile.avatar_color,
                      fontSize: Math.max(6, miniR * 0.95),
                    }}
                  >
                    {pos.profile.avatar_url
                      ? <img src={pos.profile.avatar_url} alt="" />
                      : <span>{pos.profile.initials.slice(0, 1)}</span>}
                  </div>
                ))}
                {hasNotif && <div className="orbit-orb-notif-halo" />}
                {hasNotif && unread > 1 && (
                  <div className="orbit-orb-notif-count">{unread > 9 ? '9+' : unread}</div>
                )}
                {/* Member-count badge for groups bigger than what we can
                    show as mini-orbs. Sits opposite the notif count. */}
                {g.memberCount > shown.length && (
                  <div className="orbit-constellation-overflow">+{g.memberCount - shown.length}</div>
                )}
                {/* Always-on title tag below the cluster so the user can
                    spot which group is which without hovering. Pointer
                    events stay off — clicks still hit the constellation. */}
                <div className="orbit-constellation-label">{g.title}</div>
              </div>
            )
          })}
        </div>

        {/* Live message preview banners — DM and group entries share
            the same stack. Banner persists until the user opens that
            chat (mark-seen clears it) or hits the ✕ button. */}
        {totalPreviews > 0 && (
          <div className="orbit-msg-preview-stack">
            {Array.from(dmPreviews.entries()).map(([fid, msg]) => {
              const friend = renderProfiles.find(p => p.id === fid)
              if (!friend) return null
              const text = (msg.content ?? '').trim()
              const isAttach = !text && !!msg.attachment_type
              const label = isAttach
                ? (msg.attachment_type === 'image'       ? '📷 Photo'
                  : msg.attachment_type === 'video'      ? '🎬 Video'
                  : msg.attachment_type === 'game_invite' ? '🎮 Game invite'
                  : '🎵 Audio')
                : text
              return (
                <div
                  className="orbit-msg-preview-banner"
                  key={`dm:${fid}-${msg.id}`}
                  onClick={() => onOpenChat(fid)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="orbit-msg-preview-av" style={{ background: friend.avatar_color }}>
                    {friend.avatar_url
                      ? <img src={friend.avatar_url} alt="" />
                      : <span>{friend.initials}</span>}
                  </div>
                  <div className="orbit-msg-preview-body">
                    <div className="orbit-msg-preview-name">{friend.display_name}</div>
                    <div className="orbit-msg-preview-text">{label}</div>
                  </div>
                  <button
                    type="button"
                    className="orbit-msg-preview-close"
                    aria-label="Dismiss"
                    onClick={(e) => { e.stopPropagation(); dismissDmPreview(fid) }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M2 2l6 6M8 2l-6 6" />
                    </svg>
                  </button>
                </div>
              )
            })}

            {/* Group banner: [Group] sender: text — sender name is
                resolved from `renderProfiles` (DM peers may overlap
                with group members so the join works most of the time).
                Falls back to "someone" if the sender profile isn't
                loaded yet — rare and self-healing. */}
            {Array.from(groupPreviews.entries()).map(([cid, msg]) => {
              const group = safeGroupOrbs.find(g => g.conversationId === cid)
              if (!group) return null
              const sender = group.members.find(m => m.id === msg.sender_id)
                ?? renderProfiles.find(p => p.id === msg.sender_id)
                ?? null
              const text = (msg.content ?? '').trim()
              const isAttach = !text && !!msg.attachment_type
              const label = isAttach
                ? (msg.attachment_type === 'image'       ? '📷 Photo'
                  : msg.attachment_type === 'video'      ? '🎬 Video'
                  : msg.attachment_type === 'game_invite' ? '🎮 Game invite'
                  : '🎵 Audio')
                : text
              const senderName = sender?.display_name ?? 'someone'
              return (
                <div
                  className="orbit-msg-preview-banner orbit-msg-preview-group"
                  key={`grp:${cid}-${msg.id}`}
                  onClick={() => onOpenGroupChat?.(cid)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="orbit-msg-preview-av orbit-msg-preview-av-group">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                      <circle cx="6"  cy="9"  r="2.2" fill="#fff" stroke="none" />
                      <circle cx="18" cy="9"  r="2.2" fill="#fff" stroke="none" />
                      <circle cx="12" cy="17" r="2.2" fill="#fff" stroke="none" />
                      <path d="M6 9 L18 9 M6 9 L12 17 M18 9 L12 17" opacity="0.55" />
                    </svg>
                  </div>
                  <div className="orbit-msg-preview-body">
                    <div className="orbit-msg-preview-name">
                      <span className="orbit-msg-preview-grouptag">{group.title}</span>
                      {' · '}
                      {senderName}
                    </div>
                    <div className="orbit-msg-preview-text">{label}</div>
                  </div>
                  <button
                    type="button"
                    className="orbit-msg-preview-close"
                    aria-label="Dismiss"
                    onClick={(e) => { e.stopPropagation(); dismissGroupPreview(cid) }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M2 2l6 6M8 2l-6 6" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Members / Following stats — always visible at the top. */}
        <div className="orbit-stats" ref={statsRef}>
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
          ref={avatarRef}
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

        {/* Display name + @handle — stacked beneath the avatar, exactly
            like the app's home centre block. */}
        <div className="orbit-namewrap" ref={nameRef}>
          <div className="orbit-name-under">{displayName}</div>
          {me?.username && <div className="orbit-handle">@{me.username}</div>}
        </div>

        {/* Group hover card — pops above/below the hovered constellation.
            Minimal Phase-3 surface: title + member chips + Open. */}
        {hoveredGroup && tooltipPos && (
          <div
            className={`orbit-group-tt${tooltipPos.below ? ' below' : ''}`}
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={() => hoveredIdx !== null && handleOrbLeave(hoveredIdx)}
          >
            <div className="orbit-group-tt-title">{hoveredGroup.title}</div>
            <div className="orbit-group-tt-members">
              {hoveredGroup.members.slice(0, 5).map(m => (
                <div key={m.id} className="orbit-group-tt-mem" title={m.display_name}>
                  <div className="orbit-group-tt-av" style={{ background: m.avatar_color }}>
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt="" />
                      : <span>{m.initials.slice(0, 1)}</span>}
                  </div>
                </div>
              ))}
              {hoveredGroup.memberCount > 5 && (
                <span className="orbit-group-tt-more">+{hoveredGroup.memberCount - 5}</span>
              )}
            </div>
            <button
              className="orbit-group-tt-btn"
              onClick={() => onOpenGroupChat?.(hoveredGroup.conversationId)}
            >
              Open chat
            </button>
          </div>
        )}

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

        {/* Schedule prompt — bottom of the home panel (self only). */}
        {onSchedule && scheduleTargets && (
          <div className="orbit-prompt">
            <SchedulePrompt onSubmit={onSchedule} targets={scheduleTargets} />
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
  )
}
