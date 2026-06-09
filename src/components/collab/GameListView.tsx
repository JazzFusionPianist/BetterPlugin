import React, { useEffect, useMemo, useRef, useState } from 'react'
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

const SPACING = 150
// Treat anything under this many px of horizontal motion as a click,
// not a drag.
const DRAG_CLICK_THRESHOLD = 5
// Drag this many pixels in a direction to advance one CD. Subsequent
// steps within the same drag require another `STEP_PX` of motion in
// the same direction. Cross back over the line and the gallery walks
// the other way — one CD per `STEP_PX` of finger travel.
const STEP_PX = 70

/**
 * Game picker styled as a horizontal album-cover gallery. Drag left or
 * right to step one CD at a time (each `STEP_PX` of finger travel = one
 * step, smoothly animated by the CSS transition). Click a side CD to
 * snap to it; click the centred CD to enter that game.
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
  const dragStartRef = useRef<{ startX: number; startViewIndex: number } | null>(null)
  const draggedRef = useRef(false)
  const areaRef = useRef<HTMLDivElement>(null)
  // Wheel accumulator — macOS trackpad two-finger swipes fire a stream
  // of small-delta wheel events. We collect them and step the gallery
  // once enough horizontal travel has piled up. Reset on quiet so a
  // later gesture starts from zero, not from the residual of the last.
  const wheelAccRef = useRef(0)
  const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const N = GAMES.length

  // Wheel handler — bound natively (not via React's onWheel) so we can
  // call preventDefault: React listeners on root containers default to
  // passive, which silently drops the call.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    /** Trackpad swipes give us small delta values per event (~5-20 px);
     *  takes ~5-15 events to traverse one CD width at a comfortable
     *  swipe speed. */
    const WHEEL_STEP = 90
    const onWheel = (ev: WheelEvent) => {
      if (N <= 1) return
      // Prefer the horizontal axis (two-finger left/right). If the user
      // happens to scroll vertically on this surface, treat it as a
      // mapping to horizontal — there's nothing else to scroll here.
      const dx = Math.abs(ev.deltaX) >= Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY
      if (dx === 0) return
      ev.preventDefault()
      wheelAccRef.current += dx
      if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current)
      wheelResetTimerRef.current = setTimeout(() => { wheelAccRef.current = 0 }, 180)
      // Step (possibly multiple) CDs if the accumulator crossed the threshold.
      while (Math.abs(wheelAccRef.current) >= WHEEL_STEP) {
        const dir = wheelAccRef.current > 0 ? 1 : -1
        wheelAccRef.current -= dir * WHEEL_STEP
        setViewIndex(prev => Math.max(0, Math.min(N - 1, prev + dir)))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current)
    }
  }, [N])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (N <= 1) return
    if (e.button !== undefined && e.button !== 0) return
    const startIdx = viewIndex
    dragStartRef.current = { startX: e.clientX, startViewIndex: startIdx }
    draggedRef.current = false
    // Track the most recently set index so we don't call setViewIndex
    // on every pixel of motion — only when the step changes.
    let lastIdx = startIdx

    const onMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return
      const dx = ev.clientX - dragStartRef.current.startX
      if (Math.abs(dx) > DRAG_CLICK_THRESHOLD) draggedRef.current = true
      // Follow-finger: dragging right slides the gallery right, so the
      // CD that was peeking in from the LEFT edge becomes centred —
      // i.e. viewIndex increases. Dragging left = previous CD.
      const step = Math.round(dx / STEP_PX)
      const target = Math.max(0, Math.min(N - 1, startIdx + step))
      if (target !== lastIdx) {
        lastIdx = target
        setViewIndex(target)
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      dragStartRef.current = null
      // Defer the click-suppress flag reset so the synthetic click
      // that fires right after pointerup sees the correct value.
      setTimeout(() => { draggedRef.current = false }, 0)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div className="game-cd-view">
      <FloatingOrbs count={28} />
      <div className="game-cd-area" ref={areaRef} onPointerDown={handlePointerDown}>
        <div
          className="game-cd-list"
          style={{ transform: `translate3d(${viewIndex * SPACING}px, 0, 0)` }}
        >
          {cards.map((g, i) => (
            <div
              key={g.id}
              className={`game-cd-item${i === viewIndex ? ' centred' : ''}`}
              style={{ ['--game-offset' as any]: `${-i * SPACING}px` }}
              onClick={() => {
                if (draggedRef.current) return
                if (i !== viewIndex) {
                  setViewIndex(i)
                  return
                }
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
        </div>
      </div>
    </div>
  )
}
