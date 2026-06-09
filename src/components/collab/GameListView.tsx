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
  // Pixel offset applied on top of `viewIndex * SPACING` while a
  // trackpad swipe is in progress, so the gallery tracks the gesture
  // 1:1. Reset to 0 (with viewIndex bumped to the nearest CD) when the
  // gesture ends — that's the "snap" animation that the CSS transition
  // smooths in.
  const [wheelOffset, setWheelOffset] = useState(0)
  // True while a wheel gesture is in flight. Drives a no-transition
  // class on the cd-list so it stays glued to the finger; clearing it
  // re-enables the transition for the snap.
  const [swiping, setSwiping] = useState(false)
  // The mutable offset lives in a ref too because the rAF / timeout
  // handlers below need the current value without triggering a closure
  // capture on every render.
  const wheelOffsetRef = useRef(0)
  const wheelEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Largest |delta| seen during the current gesture — used to spot the
  // transition from active swiping (deltas climbing/holding) into the
  // macOS inertial-decay phase (deltas shrinking towards zero) so we
  // can snap the gallery the instant the user lifts their fingers.
  const peakDeltaRef = useRef(0)
  // True while we're absorbing the macOS inertial tail. Wheel events
  // that arrive after a snap fired do nothing visually — we just
  // preventDefault them — so the gallery doesn't drift through the
  // 1-2 s of decaying-delta events the OS continues to emit.
  const inCooldownRef = useRef(false)
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const N = GAMES.length

  // Wheel handler — bound natively (not via React's onWheel) so we can
  // call preventDefault: React listeners on root containers default to
  // passive, which silently drops the call.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    // Snap NOW — used by both the "deltas are decaying" detector and
    // the regular idle timer. After firing we enter a cooldown that
    // absorbs the inertial wheel tail so the gallery doesn't keep
    // drifting through the OS-driven decay.
    const snapNow = () => {
      if (wheelEndTimerRef.current) {
        clearTimeout(wheelEndTimerRef.current)
        wheelEndTimerRef.current = null
      }
      const step = Math.round(wheelOffsetRef.current / SPACING)
      const target = Math.max(0, Math.min(N - 1, viewIndex + step))
      wheelOffsetRef.current = 0
      setWheelOffset(0)
      setViewIndex(target)
      setSwiping(false)
      peakDeltaRef.current = 0
      inCooldownRef.current = true
    }
    const armCooldownEnd = () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current)
      cooldownTimerRef.current = setTimeout(() => {
        inCooldownRef.current = false
      }, 250)
    }

    // Threshold magnitudes for the peak-decay detector. Tuned so:
    //   PEAK_MIN          — guards against the first 1-2 tiny start-of-
    //                       gesture events triggering the snap branch
    //                       before any real swipe has happened.
    //   DECAY_RATIO       — once the absolute delta drops below this
    //                       fraction of the peak we treat the gesture
    //                       as in macOS inertial decay and snap.
    const PEAK_MIN    = 25
    const DECAY_RATIO = 0.4

    // Hard clamp at integer boundaries — no rubber-band. macOS
    // inertial scroll keeps firing wheel events for up to ~2 s after
    // the user lifts their fingers; rubber-banding lets the gallery
    // sit floppy in that zone, which the user reads as "stuck".
    const onWheel = (ev: WheelEvent) => {
      if (N <= 1) return
      // Prefer the horizontal axis (two-finger left/right). If the user
      // happens to scroll vertically on this surface, treat it as a
      // mapping to horizontal — there's nothing else to scroll here.
      const dx = Math.abs(ev.deltaX) >= Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY
      if (dx === 0) return
      ev.preventDefault()

      // Already snapped on this gesture — swallow the inertial tail
      // events so the gallery doesn't drift past the snap target.
      // Keep resetting the cooldown end-timer while events still come;
      // once they stop for ~250 ms we treat the next event as the
      // start of a fresh gesture.
      if (inCooldownRef.current) { armCooldownEnd(); return }

      const adx = Math.abs(dx)
      peakDeltaRef.current = Math.max(peakDeltaRef.current, adx)

      // translateX = viewIndex*SPACING + wheelOffset; viewIndex+1 →
      // translateX += SPACING. Positive offset → moves toward the
      // last CD; negative → first. Clamp tight so reaching either end
      // produces an instant hard stop.
      const maxOffset =  ((N - 1) - viewIndex) * SPACING
      const minOffset = -viewIndex * SPACING
      const next = Math.max(minOffset, Math.min(maxOffset, wheelOffsetRef.current + dx))
      wheelOffsetRef.current = next
      setWheelOffset(next)
      if (!swiping) setSwiping(true)

      // Decay detection — if the user has clearly stopped pushing and
      // we're now riding the macOS inertia tail (deltas a fraction of
      // what they were at peak), snap immediately. Beats waiting the
      // full inertial decay (up to ~2 s) before the idle timer fires.
      if (peakDeltaRef.current >= PEAK_MIN && adx < peakDeltaRef.current * DECAY_RATIO) {
        snapNow()
        armCooldownEnd()
        return
      }

      // Otherwise keep deferring the snap until the wheel goes quiet.
      if (wheelEndTimerRef.current) clearTimeout(wheelEndTimerRef.current)
      wheelEndTimerRef.current = setTimeout(() => { snapNow(); armCooldownEnd() }, 60)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (wheelEndTimerRef.current) clearTimeout(wheelEndTimerRef.current)
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current)
    }
  }, [N, viewIndex, swiping])

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
          className={`game-cd-list${swiping ? ' game-cd-list-swiping' : ''}`}
          style={{ transform: `translate3d(${viewIndex * SPACING + wheelOffset}px, 0, 0)` }}
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
