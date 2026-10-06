
import { useCallback, useEffect, useRef, useState } from 'react'
import { holdKeyboard } from '../../lib/keyboardCapture'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import { useT } from '../../i18n/LanguageContext'
import { PinballGame, drawPinball, TABLE_W, TABLE_H, MISSIONS } from '../../lib/pinball'
import type { PinballTheme, PinballPhase, PinballHud } from '../../lib/pinball'
import { useWorldScores } from '../../hooks/useWorldScores'
import type { WorldStanding } from '../../hooks/useWorldScores'
import GameShell, { GameOverlayCard } from './GameShell'
import { useArcade, commas } from './ArcadeLobby'

const MISSION_KEYS = {
  lanes: 'pb.mLanes', banks: 'pb.mBanks', ramps: 'pb.mRamps', spinner: 'pb.mSpinner', bumpers: 'pb.mBumpers',
} as const

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  onClose: () => void
}

/** Reads the catalogue ink/paper tokens off the live DOM so the canvas
 *  print matches whatever theme (web light / plugin dark) is active. */
function readTheme(el: HTMLElement): PinballTheme {
  const cs = getComputedStyle(el)
  const v = (name: string, fallback: string) => {
    const val = cs.getPropertyValue(name).trim()
    return val || fallback
  }
  return {
    // --pb-* let a room restate the table's inks (the arcade's blue room
    // can't light its targets in blue); unset, the catalogue tokens stand.
    paper: v('--pb-paper', v('--bg', '#FBFAF7')),
    ink: v('--t1', '#1A1917'),
    blue: v('--pb-accent', '#2440FF'),
    t3: v('--t3', '#8A8782'),
    // the arcade's room draws the table flat, straight on its wall
    flat: v('--pb-flat', '') === '1',
  }
}

export default function PinballView({ supabase, currentUserId, onClose }: Props) {
  const { t } = useT()
  const arcade = useArcade()
  const { submitScore, loadStanding } = useWorldScores(supabase, currentUserId, 'pinball_scores')

  const gameRef = useRef<PinballGame | null>(null)
  if (!gameRef.current) gameRef.current = new PinballGame()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const themeRef = useRef<PinballTheme>({ paper: '#FBFAF7', ink: '#1A1917', blue: '#2440FF', t3: '#8A8782' })

  // Coarse UI mirror of the engine — updated only when a value changes so
  // React renders a few times per second, not per frame.
  const [ui, setUi] = useState<{ phase: PinballPhase; score: number; ball: number; ballsTotal: number; bonusMult: number; hudKey: string; hud: PinballHud }>(() => ({
    phase: 'ready', score: 0, ball: 1, ballsTotal: 3, bonusMult: 1,
    hudKey: gameRef.current!.hudKey(), hud: gameRef.current!.hud(),
  }))
  const [standing, setStanding] = useState<WorldStanding | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmKind, setConfirmKind] = useState<null | 'reset' | 'end'>(null)
  const submittedRef = useRef(false)

  // Start-screen leaderboard
  useEffect(() => {
    let cancelled = false
    loadStanding().then(s => { if (!cancelled && s) setStanding(s) })
    return () => { cancelled = true }
  }, [loadStanding])

  // ── Main loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const g = gameRef.current!
      const dt = now - last
      last = now
      g.tick(dt)

      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (canvas && wrap) {
        const dpr = window.devicePixelRatio || 1
        const w = wrap.clientWidth
        const h = wrap.clientHeight
        if (w > 0 && h > 0) {
          const pw = Math.round(w * dpr), ph = Math.round(h * dpr)
          if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw
            canvas.height = ph
            canvas.style.width = `${w}px`
            canvas.style.height = `${h}px`
          }
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.save()
            ctx.scale(dpr, dpr)
            drawPinball(ctx, g, themeRef.current, w, h)
            ctx.restore()
          }
        }
      }

      const hudKey = g.hudKey()
      setUi(prev => {
        if (
          prev.phase === g.phase && prev.score === g.score &&
          prev.ball === g.ballNumber && prev.ballsTotal === g.ballsTotal &&
          prev.bonusMult === g.bonusMult && prev.hudKey === hudKey
        ) return prev
        return {
          phase: g.phase, score: g.score, ball: g.ballNumber, ballsTotal: g.ballsTotal, bonusMult: g.bonusMult,
          hudKey, hud: prev.hudKey === hudKey ? prev.hud : g.hud(),
        }
      })
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Theme read on mount + when the wrap resizes (also catches theme flips
  // that coincide with layout changes; cheap to re-read).
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const read = () => { themeRef.current = readTheme(wrap) }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // ── Game over → record the score, show the world ranking ────────────────
  useEffect(() => {
    if (ui.phase !== 'over' || submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    submitScore(gameRef.current!.score).then(s => {
      if (s) setStanding(s)
      setSubmitting(false)
    })
  }, [ui.phase, submitScore])

  const handleStart = useCallback(() => {
    submittedRef.current = false
    gameRef.current!.start()
  }, [])

  const handleConfirm = useCallback(() => {
    const kind = confirmKind
    setConfirmKind(null)
    if (kind === 'reset') {
      submittedRef.current = false
      gameRef.current!.reset()
    } else if (kind === 'end') {
      gameRef.current!.endNow()   // phase → over; the submit effect records it
    }
  }, [confirmKind])

  // ── Keyboard ─────────────────────────────────────────────────────────────
  // Flippers/plunger ride arrows + space — keep them away from the DAW
  // transport for as long as the table is on screen.
  useEffect(() => holdKeyboard(), [])
  useEffect(() => {
    const g = gameRef.current!
    const isTyping = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      switch (e.key) {
        case 'ArrowLeft': case 'z': case 'Z':
          e.preventDefault(); g.setFlipper('left', true); break
        case 'ArrowRight': case 'm': case 'M': case '/':
          e.preventDefault(); g.setFlipper('right', true); break
        case 'ArrowDown': case ' ':
          e.preventDefault()
          if (g.phase === 'captive') g.setPlungerDown(true)
          break
        case 'ArrowUp':
          e.preventDefault()
          if (!e.repeat) g.nudge()
          break
        case 'Enter':
          if (g.phase === 'ready' || g.phase === 'over') { e.preventDefault(); handleStart() }
          break
      }
    }
    const up = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      switch (e.key) {
        case 'ArrowLeft': case 'z': case 'Z':
          g.setFlipper('left', false); break
        case 'ArrowRight': case 'm': case 'M': case '/':
          g.setFlipper('right', false); break
        case 'ArrowDown': case ' ':
          g.setPlungerDown(false); break
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [handleStart])

  // ── Touch: halves are flippers; while captive, drag = plunger pull ──────
  const touchesRef = useRef<Map<number, 'left' | 'right' | 'plunger'>>(new Map())
  const plungerStartYRef = useRef(0)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const g = gameRef.current!
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (g.phase === 'captive') {
      touchesRef.current.set(e.pointerId, 'plunger')
      plungerStartYRef.current = e.clientY
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
      return
    }
    const side = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
    touchesRef.current.set(e.pointerId, side)
    g.setFlipper(side, true)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const kind = touchesRef.current.get(e.pointerId)
    if (kind !== 'plunger') return
    const g = gameRef.current!
    g.setPlungerPull((e.clientY - plungerStartYRef.current) / 110)
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const kind = touchesRef.current.get(e.pointerId)
    touchesRef.current.delete(e.pointerId)
    const g = gameRef.current!
    if (kind === 'plunger') {
      g.releasePlunger()
      return
    }
    if (kind) g.setFlipper(kind, false)
  }, [])

  // ── Overlays ─────────────────────────────────────────────────────────────
  let overlay: React.ReactNode = null
  if (ui.phase === 'ready' || ui.phase === 'over') {
    const isOver = ui.phase === 'over'
    overlay = (
      <GameOverlayCard
        title={isOver ? t('pb.gameOver') : t('game.pinball')}
        className="pb-overlay-card"
      >
        {isOver && (
          <div className="pb-final-score">{ui.score.toLocaleString()}</div>
        )}
        {isOver && standing?.isNewBest && (
          <div className="pb-newbest">{t('pb.newBest')}</div>
        )}

        <div className="pb-lb">
          <div className="pb-lb-title">{t('pb.leaderboard')}</div>
          {submitting && <div className="pb-lb-loading">…</div>}
          {!submitting && standing && standing.top.length > 0 && (
            <div className="pb-lb-rows">
              {standing.top.map((row, i) => (
                <div key={row.user_id} className={`pb-lb-row${row.user_id === currentUserId ? ' me' : ''}`}>
                  <span className="pb-lb-rank">{i + 1}</span>
                  <span className="pb-lb-name">{row.display_name}</span>
                  <span className="pb-lb-score">{row.best_score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          {!submitting && standing && (
            <div className="pb-lb-mine">
              {t('pb.yourBest')} {standing.myBest.toLocaleString()}
              {standing.myRank != null && standing.totalPlayers > 0 && (
                <><span className="pb-sep"> · </span>{t('pb.rank')} {standing.myRank}/{standing.totalPlayers}</>
              )}
            </div>
          )}
        </div>

        <button className="game-invite-btn pb-start-btn" onClick={handleStart}>
          {isOver ? t('pb.playAgain') : t('pb.start')}
        </button>
        <div className="pb-hint">{arcade ? commas(t('pb.hintKeys')) : t('pb.hintKeys')}</div>
        <div className="pb-hint pb-hint-touch">{t('pb.hintTouch')}</div>
      </GameOverlayCard>
    )
  }

  const hud = ui.hud
  const live = ui.phase === 'captive' || ui.phase === 'live'

  const ballDots: React.ReactNode[] = []
  for (let i = 1; i <= ui.ballsTotal; i++) {
    ballDots.push(
      <span key={i} className={`pb-ball-dot${i < ui.ball ? ' spent' : ''}${i === ui.ball && ui.phase !== 'over' ? ' current' : ''}`} />
    )
  }

  return (
    <GameShell
      title={t('game.pinball')}
      onBack={onClose}
      className="pinball-shell"
      controls={(ui.phase === 'captive' || ui.phase === 'live') ? (
        <>
          <button className="game-btn game-btn-danger" onClick={() => setConfirmKind('end')}>
            {t('pb.end')}
          </button>
          <button className="game-btn" onClick={() => setConfirmKind('reset')}>
            {t('pb.reset')}
          </button>
        </>
      ) : undefined}
      confirm={{
        open: confirmKind != null,
        message: confirmKind === 'end' ? t('pb.endConfirm') : t('pb.resetConfirm'),
        confirmLabel: confirmKind === 'end' ? t('pb.end') : t('pb.reset'),
        onConfirm: handleConfirm,
        onCancel: () => setConfirmKind(null),
      }}
      fillBoard
      board={
        <div className="pinball-layout">
          <div className="pinball-head">
            <span className="pinball-ballline">
              {hud.tilted ? t('pb.tilt') : hud.multiball ? t('pb.multiball') : t('pb.ballOf', { n: ui.ball, m: ui.ballsTotal })}
            </span>
            <span
              className="pinball-score"
              style={{ '--pb-score-chars': ui.score.toLocaleString().length } as React.CSSProperties}
            >
              {ui.score.toLocaleString()}
            </span>
            <span className="pinball-balls" aria-label={t('pb.ball')}>{ballDots}</span>
            {ui.bonusMult > 1 && <span className="pinball-mult"><span className="pinball-mult-word">bonus </span>×{ui.bonusMult}</span>}
            {/* what the table is asking for right now */}
            {live && hud.multiball && (
              <span className="pinball-mission">
                <span className="pinball-mission-name">{t('pb.jackpot')}</span>
                <span className="pinball-mission-time">25,000</span>
              </span>
            )}
            {live && !hud.multiball && hud.mission && (
              <span className="pinball-mission">
                <span className="pinball-mission-name">{t(MISSION_KEYS[hud.mission])}</span>
                <span className="pinball-mission-time">{t('pb.seconds', { n: hud.missionSeconds })}</span>
              </span>
            )}
          </div>
          <div
            className="pinball-canvas-wrap"
            ref={wrapRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ aspectRatio: `${TABLE_W} / ${TABLE_H}` }}
          >
            <canvas ref={canvasRef} className="pinball-canvas" />
          </div>
          {live && (
            <div className="pinball-side">
              <div className="pinball-side-title">{t('pb.missions')}</div>
              {MISSIONS.map((id, i) => {
                const now = hud.mission === id
                const done = hud.missionsDone[i]
                return (
                  <div key={id} className={`pinball-side-row${now ? ' now' : done ? ' done' : ''}`}>
                    <span className={`pb-lamp${now ? ' now' : done ? ' on' : ''}`} />
                    <span className="pinball-side-name">{t(MISSION_KEYS[id])}</span>
                    {now && <span className="pinball-side-val">{t('pb.of', { n: hud.missionProgress, m: hud.missionGoal })}</span>}
                  </div>
                )
              })}
              <div className="pinball-side-title">{t('pb.multiball')}</div>
              <div className="pinball-side-row pinball-orb">
                {['o', 'r', 'b'].map((ch, i) => (
                  <span key={ch} className={hud.orb[i] || hud.lockLit ? 'on' : ''}>{ch}</span>
                ))}
              </div>
              <div className="pinball-side-row">
                <span className="pinball-side-name">{t('pb.locked')}</span>
                <span className="pinball-side-val pinball-side-lamps">
                  {[0, 1].map(i => <span key={i} className={`pb-lamp${i < hud.locked ? ' on' : hud.lockLit && i === hud.locked ? ' now' : ''}`} />)}
                </span>
              </div>
              <div className="pinball-side-row">
                <span className="pinball-side-name">{t('pb.jackpots')}</span>
                <span className="pinball-side-val">{hud.jackpots}</span>
              </div>
              <div className={`pinball-side-title pinball-kickback${hud.kickback ? '' : ' off'}`}>
                {t('pb.kickback')}
                <span className={`pb-lamp${hud.kickback ? ' now' : ''}`} />
              </div>
            </div>
          )}
          {live && (
            <div className="pinball-nudge">
              <button type="button" className="pinball-nudge-btn" onClick={() => gameRef.current!.nudge()} disabled={hud.tilted}>
                {t('pb.nudge')}
              </button>
              <span className="pinball-tilt">
                {t('pb.tilt')}
                {[0, 1].map(i => <span key={i} className={`pb-lamp${i < hud.tiltWarnings ? ' on' : ''}`} />)}
              </span>
            </div>
          )}
        </div>
      }
      overlay={overlay}
    />
  )
}
