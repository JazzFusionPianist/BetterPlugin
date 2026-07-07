import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/translations'

export type GameId = 'chess' | 'falling_blocks' | 'poker' | 'ear_training'

interface Props {
  onSelectGame: (game: GameId) => void
  onClose: () => void
  /** When set, the list is being browsed specifically to invite the
   *  current chat. Currently only used to swap the centred CD's
   *  hover-label CTA from "Play" to "Invite" — actual room creation
   *  + chat-bubble send happens in the parent's onSelectGame handler. */
  inviteContext?: { conversationId: string } | null
}

interface GameCard {
  id: GameId
  icon: React.ReactNode
  /** Translation key for the user-visible card title. */
  nameKey: TKey
  /** Translation key for the user-visible card description. */
  descKey: TKey
  /** CSS background applied to the CD body — mirrors the genre / mood. */
  coverBg: string
}

const GAMES: GameCard[] = [
  {
    id: 'chess',
    coverBg: 'radial-gradient(circle at 30% 30%, #4a5680 0%, #1f2740 55%, #0d1024 100%)',
    icon: (
      <svg width="56" height="56" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="13" y="2" width="6" height="3" rx="1" fill="currentColor" />
        <rect x="15" y="1" width="2" height="5" rx="1" fill="currentColor" />
        <rect x="14" y="5" width="4" height="2" rx="0.5" fill="currentColor" />
        <path d="M10 8 Q11 7 16 7 Q21 7 22 8 L24 20 H8 Z" fill="currentColor" />
        <rect x="7" y="20" width="18" height="3" rx="1" fill="currentColor" />
        <rect x="5" y="23" width="22" height="3" rx="1.5" fill="currentColor" />
      </svg>
    ),
    nameKey: 'game.chess',
    descKey: 'game.chessDesc',
  },
  {
    id: 'falling_blocks',
    coverBg: 'radial-gradient(circle at 30% 30%, #6fb6ff 0%, #4a8fe7 50%, #5a3fd0 100%)',
    icon: (
      <svg width="56" height="56" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="4"  y="20" width="6" height="6" rx="1" fill="currentColor" opacity="0.92" />
        <rect x="10" y="20" width="6" height="6" rx="1" fill="currentColor" opacity="0.7" />
        <rect x="16" y="20" width="6" height="6" rx="1" fill="currentColor" opacity="0.92" />
        <rect x="22" y="20" width="6" height="6" rx="1" fill="currentColor" opacity="0.7" />
        <rect x="10" y="14" width="6" height="6" rx="1" fill="currentColor" opacity="0.92" />
        <rect x="16" y="14" width="6" height="6" rx="1" fill="currentColor" opacity="0.7" />
        <rect x="16" y="8"  width="6" height="6" rx="1" fill="currentColor" opacity="0.92" />
      </svg>
    ),
    nameKey: 'game.fallingBlocks',
    descKey: 'game.fallingBlocksDesc',
  },
  {
    id: 'poker',
    coverBg: 'radial-gradient(circle at 30% 30%, #2f8f5a 0%, #185c39 55%, #4a1018 100%)',
    icon: (
      <svg width="56" height="56" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="6" y="6" width="14" height="20" rx="2" fill="currentColor" opacity="0.55" transform="rotate(-12 13 16)" />
        <rect x="12" y="6" width="14" height="20" rx="2" fill="currentColor" opacity="0.95" />
        <text x="14" y="14" fontSize="6" fontFamily="serif" fontWeight="700" fill="#1a1a1a">A</text>
        <path d="M19 18 L21 22 L17 22 Z" fill="#1a1a1a" />
        <circle cx="19" cy="20" r="1.6" fill="#1a1a1a" />
      </svg>
    ),
    nameKey: 'game.poker',
    descKey: 'game.pokerDesc',
  },
  {
    id: 'ear_training',
    coverBg: 'radial-gradient(circle at 30% 30%, #ffb56b 0%, #d96a3a 55%, #4a1e3a 100%)',
    icon: (
      <svg width="56" height="56" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M6 18a8 8 0 0116 0v3a4 4 0 01-4 4h-1v-7h1a2 2 0 002-2" />
        <path d="M6 18v3a4 4 0 004 4h1v-7h-1a2 2 0 00-2-2" />
        <path d="M12 12l3-3M20 12l-3-3M16 7v3" strokeLinecap="round" />
      </svg>
    ),
    nameKey: 'game.earTraining',
    descKey: 'game.earTrainingDesc',
  },
]

/**
 * Game picker styled as a horizontal album-cover gallery.
 *
 * Native CSS scroll-snap drives the actual physics:
 *   - The area is a horizontal overflow:auto scroll container.
 *   - Each item is scroll-snap-align: center.
 *   - The browser handles trackpad swipe, momentum, and the snap at
 *     end-of-gesture — including detecting when the user actually
 *     lifts their fingers, which is information not reachable from
 *     wheel-event JS.
 *
 * We listen to the scroll event only to know which item is currently
 * centred, so we can mark it `.centred` for the scale-up animation
 * and route Enter / click to the right card.
 */
export default function GameListView({ onSelectGame, inviteContext }: Props) {
  void inviteContext // reserved for the optional CTA swap later — parent owns invite logic
  const { t } = useT()
  const [viewIndex, setViewIndex] = useState(0)
  // Memoise so card title/desc lookups don't churn on every render —
  // useT() re-evaluates t() on language change, which is the only time
  // we actually need to recompute.
  const cards = useMemo(
    () => GAMES.map(g => ({ ...g, name: t(g.nameKey), description: t(g.descKey) })),
    [t]
  )
  const areaRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  })
  const suppressClickRef = useRef(false)
  // Half the scroll-container width minus half the item width — the
  // exact value the leading/trailing spacers need so the first and
  // last cards can scroll into the centre. Computed in JS because
  // percentage-on-flex-child against a `max-content` flex parent is
  // a circular-dependency case browsers resolve inconsistently (it
  // worked in the plugin's WKWebView but evaluated to 0 in some
  // desktop browsers, which broke the snap points at the edges).
  const [spacerPx, setSpacerPx] = useState(0)

  /** Find whichever item's centre is closest to the scroll-container's
   *  centre and reflect it as viewIndex. Idempotent — bails if the
   *  result hasn't changed. Pulled out so the spacer-resize and the
   *  scroll-listener can both call it. */
  const closestIndex = useCallback(() => {
    const area = areaRef.current
    if (!area) return 0
    const center = area.scrollLeft + area.clientWidth / 2
    let closestIdx = 0
    let closestDist = Infinity
    for (let i = 0; i < itemRefs.current.length; i++) {
      const node = itemRefs.current[i]
      if (!node) continue
      const itemCenter = node.offsetLeft + node.clientWidth / 2
      const d = Math.abs(itemCenter - center)
      if (d < closestDist) { closestDist = d; closestIdx = i }
    }
    return closestIdx
  }, [])

  const syncCentred = useCallback(() => {
    const closestIdx = closestIndex()
    setViewIndex(prev => (prev === closestIdx ? prev : closestIdx))
  }, [closestIndex])

  // Listen to scroll. rAF-throttled so a fast swipe doesn't fight
  // React's reconciliation.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    let rafId = 0
    const fire = () => { rafId = 0; syncCentred() }
    const onScroll = () => { if (!rafId) rafId = requestAnimationFrame(fire) }
    area.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      area.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [syncCentred])

  // Translate mouse-wheel deltaY into horizontal scroll for users
  // without a trackpad. Desktop browsers won't auto-map vertical
  // wheel input onto an `overflow-x: auto` container, so a regular
  // mouse user couldn't budge the gallery at all. We only intervene
  // when there's no deltaX — trackpad horizontal swipes already work
  // natively and shouldn't be doubled-up.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) return                    // trackpad horizontal — let the browser handle
      if (e.deltaY === 0) return
      e.preventDefault()
      area.scrollLeft += e.deltaY
    }
    area.addEventListener('wheel', onWheel, { passive: false })
    return () => area.removeEventListener('wheel', onWheel)
  }, [])

  // Measure spacer widths BEFORE paint so the first render already has
  // the correct layout — otherwise the items shift to the right after
  // the initial useEffect runs and viewIndex points at whoever was at
  // the centre during the spacer-less first frame, not the visually
  // centred card. ResizeObserver picks up later changes (Expand View,
  // host window resize) and re-runs the sync so the centred class
  // tracks the new layout.
  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area) return
    const ITEM_HALF = 70
    const compute = () => {
      const w = area.clientWidth
      setSpacerPx(Math.max(0, Math.floor(w / 2 - ITEM_HALF)))
    }
    compute()
    const ro = new ResizeObserver(() => { compute() })
    ro.observe(area)
    return () => ro.disconnect()
  }, [])

  // Re-sync whenever the spacer width changes (i.e. the layout just
  // shifted under the same scrollLeft) so the .centred class tracks
  // the new visual centre.
  useLayoutEffect(() => {
    syncCentred()
  }, [spacerPx, syncCentred])

  /** Smooth-scroll the chosen card to centre. Used by the side-card
   *  click handler (and could power keyboard nav later). */
  const scrollToIndex = (i: number) => {
    const node = itemRefs.current[i]
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const area = areaRef.current
    if (!area) return
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: area.scrollLeft,
      moved: false,
    }
    area.classList.add('dragging')
    area.setPointerCapture(event.pointerId)
  }

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const area = areaRef.current
    const drag = dragRef.current
    if (!area || !drag.active || drag.pointerId !== event.pointerId) return
    dragRef.current.active = false
    area.classList.remove('dragging')
    if (area.hasPointerCapture(event.pointerId)) area.releasePointerCapture(event.pointerId)
    if (drag.moved) {
      suppressClickRef.current = true
      const targetIndex = closestIndex()
      requestAnimationFrame(() => scrollToIndex(targetIndex))
      window.setTimeout(() => { suppressClickRef.current = false }, 180)
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const area = areaRef.current
    const drag = dragRef.current
    if (!area || !drag.active || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    if (Math.abs(dx) > 4) drag.moved = true
    area.scrollLeft = drag.startScrollLeft - dx
    event.preventDefault()
  }

  return (
    <div className="game-cd-view">
      <FloatingOrbs count={28} />
      <div
        className="game-cd-area"
        ref={areaRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className="game-cd-list">
          {/* Leading spacer so the first card can centre via scroll-snap. */}
          <div className="game-cd-spacer" aria-hidden="true" style={{ width: spacerPx }} />
          {cards.map((g, i) => (
            <div
              key={g.id}
              ref={el => { itemRefs.current[i] = el }}
              className={`game-cd-item${i === viewIndex ? ' centred' : ''}`}
              onClick={(event) => {
                if (suppressClickRef.current) {
                  event.preventDefault()
                  return
                }
                if (i !== viewIndex) { scrollToIndex(i); return }
                onSelectGame(g.id)
              }}
              role="button"
              tabIndex={0}
            >
              <div className="game-cd-cover" style={{ background: g.coverBg }}>
                <div className="game-cd-icon">{g.icon}</div>
              </div>
              <div className="game-cd-hover-label">
                <div className="game-cd-hover-title">{g.name}</div>
                <div className="game-cd-hover-desc">{g.description}</div>
              </div>
            </div>
          ))}
          {/* Trailing spacer so the last card can centre via scroll-snap. */}
          <div className="game-cd-spacer" aria-hidden="true" style={{ width: spacerPx }} />
        </div>
      </div>
    </div>
  )
}
