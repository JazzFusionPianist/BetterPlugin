import { useState, useEffect, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import { OrbMergeGame, drawOrbMerge, OM_W, OM_H, OM_RADII, OM_COLORS, OM_TIERS } from '../../lib/orbMerge'
import { useT } from '../../i18n/LanguageContext'
import { useWorldScores } from '../../hooks/useWorldScores'
import type { WorldStanding } from '../../hooks/useWorldScores'
import GameShell, { GameOverlayCard } from './GameShell'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  onClose: () => void
}

export default function OrbMergeView({ supabase, currentUserId, onClose }: Props) {
  const { t } = useT()
  const { submitScore, loadStanding } = useWorldScores(supabase, currentUserId, 'orb_merge_scores')

  const gameRef = useRef<OrbMergeGame | null>(null)
  if (!gameRef.current) gameRef.current = new OrbMergeGame()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const [phase, setPhase] = useState<'ready' | 'live' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [nextTier, setNextTier] = useState(gameRef.current.nextTier)
  const [standing, setStanding] = useState<WorldStanding | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmKind, setConfirmKind] = useState<'end' | 'reset' | null>(null)
  const scoreRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    loadStanding().then(s => { if (!cancelled && s) setStanding(s) })
    return () => { cancelled = true }
  }, [loadStanding])

  // ── rAF loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'live') return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const g = gameRef.current!
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const prevScore = g.score
      g.step(dt)
      if (g.score !== prevScore) void 0
      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (canvas && wrap) {
        const dpr = window.devicePixelRatio || 1
        const w = wrap.clientWidth
        const px = Math.round(w * dpr)
        if (canvas.width !== px) {
          canvas.width = px
          canvas.height = Math.round((w * OM_H / OM_W) * dpr)
          canvas.style.width = '100%'
        }
        const cs = getComputedStyle(wrap)
        const ctx = canvas.getContext('2d')!
        drawOrbMerge(ctx, g, (w * dpr) / OM_W, {
          paper: cs.getPropertyValue('--bg0') || '#FCFBF9',
          ink: cs.getPropertyValue('--t1').trim() || '#1A1917',
          faint: 'rgba(127, 127, 127, 0.45)',
        })
      }
      if (g.score !== scoreRef.current) { scoreRef.current = g.score; setScore(g.score) }
      setNextTier(g.nextTier)
      if (g.over) { setPhase('over'); return }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // ── submit on game over ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'over') return
    setSubmitting(true)
    submitScore(gameRef.current!.score).then(s => {
      setStanding(s)
      setSubmitting(false)
    })
  }, [phase, submitScore])

  const toGame = useCallback((clientX: number): number => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return ((clientX - rect.left) / rect.width) * OM_W
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (phase !== 'live') return
    gameRef.current!.aim(toGame(e.clientX))
  }, [phase, toGame])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (phase !== 'live') return
    const g = gameRef.current!
    g.aim(toGame(e.clientX))
    if (g.drop()) void 0
  }, [phase, toGame])

  const handleStart = useCallback(() => {
    gameRef.current!.reset()
    scoreRef.current = 0
    setScore(0)
    setPhase('live')
  }, [])

  const handleConfirm = useCallback(() => {
    if (confirmKind === 'end') {
      gameRef.current!.over = true
      setPhase('over')
    } else if (confirmKind === 'reset') {
      handleStart()
    }
    setConfirmKind(null)
  }, [confirmKind, handleStart])

  // ── Overlay ──────────────────────────────────────────────────────────────
  let overlay: React.ReactNode = null
  if (phase === 'ready' || phase === 'over') {
    const isOver = phase === 'over'
    overlay = (
      <GameOverlayCard title={isOver ? t('pb.gameOver') : t('game.orbMerge')} className="pb-overlay-card">
        {isOver && <div className="pb-final-score">{score.toLocaleString()}</div>}
        {isOver && standing?.isNewBest && <div className="pb-newbest">{t('pb.newBest')}</div>}
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
                <> · {t('pb.rank')} {standing.myRank}/{standing.totalPlayers}</>
              )}
            </div>
          )}
        </div>
        <button className="game-invite-btn pb-start-btn" onClick={handleStart}>
          {isOver ? t('pb.playAgain') : t('pb.start')}
        </button>
        <div className="pb-hint">{t('om.hint')}</div>
      </GameOverlayCard>
    )
  }

  return (
    <GameShell
      title={t('game.orbMerge')}
      onBack={onClose}
      className="pinball-shell om-shell"
      controls={phase === 'live' ? (
        <>
          <button className="game-btn game-btn-danger" onClick={() => setConfirmKind('end')}>{t('pb.end')}</button>
          <button className="game-btn" onClick={() => setConfirmKind('reset')}>{t('pb.reset')}</button>
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
            <span className="pinball-score">{score.toLocaleString()}</span>
            <span className="om-next" aria-label="next">
              <i style={{
                background: OM_COLORS[Math.min(nextTier, OM_TIERS - 1)],
                width: Math.max(10, OM_RADII[nextTier] * 0.55),
                height: Math.max(10, OM_RADII[nextTier] * 0.55),
              }} />
            </span>
          </div>
          <div
            className="pinball-canvas-wrap om-canvas-wrap"
            ref={wrapRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ aspectRatio: `${OM_W} / ${OM_H}` }}
          >
            <canvas ref={canvasRef} className="pinball-canvas" />
          </div>
        </div>
      }
      overlay={overlay}
    />
  )
}
