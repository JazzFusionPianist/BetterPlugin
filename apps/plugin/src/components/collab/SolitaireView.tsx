import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import { useT } from '../../i18n/LanguageContext'
import { useWorldScores, type WorldStanding } from '../../hooks/useWorldScores'
import { SolitaireGame, isRed, rankLabel, SUIT_GLYPH, type Card, type SolSource, type SolTarget } from '../../lib/solitaire'
import { formatClock } from '../../lib/sudoku'
import GameShell, { GameOverlayCard } from './GameShell'
import WorldRanking from './WorldRanking'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  onClose: () => void
}

type Phase = 'ready' | 'live' | 'over'

function sameSource(a: SolSource | null, b: SolSource): boolean {
  if (!a || a.kind !== b.kind) return false
  if (a.kind === 'waste') return true
  if (a.kind === 'foundation' && b.kind === 'foundation') return a.index === b.index
  if (a.kind === 'tableau' && b.kind === 'tableau') return a.pile === b.pile && a.index === b.index
  return false
}

function CardFace({ card, className, style, onClick, onDoubleClick }: {
  card: Card | null
  className?: string
  style?: CSSProperties
  onClick?: (e: React.MouseEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
}) {
  if (!card) return <div className={`sol-card sol-slot${className ? ' ' + className : ''}`} style={style} onClick={onClick} />
  if (!card.faceUp) return <div className={`sol-card sol-back${className ? ' ' + className : ''}`} style={style} onClick={onClick} />
  return (
    <div className={`sol-card sol-face${isRed(card.suit) ? ' red' : ''}${className ? ' ' + className : ''}`} style={style} onClick={onClick} onDoubleClick={onDoubleClick}>
      <span className="sol-rank">{rankLabel(card.rank)}</span>
      <span className="sol-suit">{SUIT_GLYPH[card.suit]}</span>
    </div>
  )
}

/** Klondike — tap a card, then tap where it goes; double-tap sends it
 *  to a foundation. Draw 1 or 3 is picked on the start card. */
export default function SolitaireView({ supabase, currentUserId, onClose }: Props) {
  const { t } = useT()
  const { submitScore, loadStanding } = useWorldScores(supabase, currentUserId, 'solitaire_scores')

  const [drawCount, setDrawCount] = useState<1 | 3>(() => (localStorage.getItem('orb_sol_draw') === '3' ? 3 : 1))
  const gameRef = useRef<SolitaireGame>(new SolitaireGame(drawCount))
  const [, bump] = useState(0)
  const rerender = useCallback(() => bump(n => n + 1), [])
  const [phase, setPhase] = useState<Phase>('ready')
  const [seconds, setSeconds] = useState(0)
  const [selected, setSelected] = useState<SolSource | null>(null)
  const [standing, setStanding] = useState<WorldStanding | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [won, setWon] = useState(false)
  const [confirmKind, setConfirmKind] = useState<'end' | 'reset' | null>(null)

  useEffect(() => {
    let cancelled = false
    loadStanding().then(s => { if (!cancelled && s) setStanding(s) })
    return () => { cancelled = true }
  }, [loadStanding])

  useEffect(() => {
    if (phase !== 'live') return
    const id = window.setInterval(() => setSeconds(s => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [phase])

  const handleStart = useCallback((d: 1 | 3 = drawCount) => {
    localStorage.setItem('orb_sol_draw', String(d))
    gameRef.current = new SolitaireGame(d)
    setSeconds(0)
    setSelected(null)
    setWon(false)
    setPhase('live')
    rerender()
  }, [drawCount, rerender])

  const finish = useCallback((didWin: boolean) => {
    const g = gameRef.current
    const score = g.finalScore(Math.max(1, seconds))
    setFinalScore(score)
    setWon(didWin)
    setPhase('over')
    setSubmitting(true)
    submitScore(score).then(s => { if (s) setStanding(s); setSubmitting(false) })
  }, [seconds, submitScore])

  const afterMove = useCallback(() => {
    rerender()
    if (gameRef.current.won) finish(true)
  }, [rerender, finish])

  const tryMove = useCallback((src: SolSource, dst: SolTarget): boolean => {
    const ok = gameRef.current.move(src, dst)
    if (ok) afterMove()
    return ok
  }, [afterMove])

  /** Tap grammar: nothing selected → select; something selected → try
   *  to move it here, else re-select the tapped card. */
  const tapSource = useCallback((src: SolSource) => {
    if (phase !== 'live') return
    const g = gameRef.current
    if (selected) {
      const dst: SolTarget | null =
        src.kind === 'foundation' ? { kind: 'foundation', index: src.index }
        : src.kind === 'tableau' ? { kind: 'tableau', pile: src.pile }
        : null
      if (dst && !sameSource(selected, src) && tryMove(selected, dst)) { setSelected(null); return }
      if (sameSource(selected, src)) { setSelected(null); return }
    }
    if (g.cardsAt(src).length > 0) setSelected(src)
    else setSelected(null)
  }, [phase, selected, tryMove])

  const tapTarget = useCallback((dst: SolTarget) => {
    if (phase !== 'live' || !selected) return
    if (tryMove(selected, dst)) setSelected(null)
  }, [phase, selected, tryMove])

  const sendUp = useCallback((src: SolSource) => {
    if (phase !== 'live') return
    if (gameRef.current.autoFoundation(src)) { setSelected(null); afterMove() }
  }, [phase, afterMove])

  const handleDraw = useCallback(() => {
    if (phase !== 'live') return
    setSelected(null)
    if (gameRef.current.draw()) rerender()
  }, [phase, rerender])

  const handleConfirm = useCallback(() => {
    const kind = confirmKind
    setConfirmKind(null)
    if (kind === 'end') finish(false)
    else if (kind === 'reset') handleStart()
  }, [confirmKind, finish, handleStart])

  const g = gameRef.current
  const isSel = (src: SolSource) => sameSource(selected, src)

  let overlay: React.ReactNode = null
  if (phase !== 'live') {
    const over = phase === 'over'
    overlay = (
      <GameOverlayCard title={over ? (won ? t('sol.won') : t('pb.gameOver')) : t('game.solitaire')} className="pb-overlay-card">
        {over && <div className="pb-final-score">{finalScore.toLocaleString()}</div>}
        {over && <div className="game-finish-readystate">{formatClock(seconds)} · {g.moves} {t('sol.moves')}</div>}
        {over && standing?.isNewBest && <div className="pb-newbest">{t('pb.newBest')}</div>}
        <div className="game-computer-picker" role="radiogroup">
          {([1, 3] as const).map(d => (
            <button key={d} className={`game-computer-count${drawCount === d ? ' selected' : ''}`} onClick={() => setDrawCount(d)} role="radio" aria-checked={drawCount === d}>
              {d === 1 ? t('sol.draw1') : t('sol.draw3')}
            </button>
          ))}
        </div>
        <WorldRanking standing={standing} loading={submitting} currentUserId={currentUserId} />
        <button className="game-invite-btn pb-start-btn" onClick={() => handleStart(drawCount)}>
          {over ? t('pb.playAgain') : t('pb.start')}
        </button>
        <div className="pb-hint">{t('sol.hint')}</div>
      </GameOverlayCard>
    )
  }

  const wasteTop = g.waste.length ? g.waste[g.waste.length - 1] : null
  const wasteFan = g.waste.slice(-3)

  return (
    <GameShell
      title={t('game.solitaire')}
      onBack={onClose}
      className="pinball-shell sol-shell"
      actionStatus={phase === 'live' ? <>{formatClock(seconds)} · {g.score.toLocaleString()}</> : undefined}
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
        <div className={`sol-layout${phase !== 'live' ? ' idle' : ''}`}>
          <div className="sol-top">
            <div className="sol-stock" onClick={handleDraw} title={t('sol.draw')}>
              {g.stock.length > 0 ? <div className="sol-card sol-back" /> : <div className="sol-card sol-slot sol-recycle">↻</div>}
              <span className="sol-count">{g.stock.length}</span>
            </div>
            <div className="sol-waste">
              {wasteFan.length === 0 && <div className="sol-card sol-slot" />}
              {wasteFan.map((c, i) => (
                <CardFace
                  key={c.id}
                  card={c}
                  className={`sol-fan${i === wasteFan.length - 1 ? (isSel({ kind: 'waste' }) ? ' selected' : '') : ' under'}`}
                  style={{ left: `${i * 22}%` }}
                  onClick={i === wasteFan.length - 1 ? () => tapSource({ kind: 'waste' }) : undefined}
                  onDoubleClick={i === wasteFan.length - 1 ? () => sendUp({ kind: 'waste' }) : undefined}
                />
              ))}
              {wasteTop === null && null}
            </div>
            <div className="sol-spacer" />
            {g.foundations.map((f, i) => (
              <div key={i} className="sol-foundation" onClick={() => (f.length ? tapSource({ kind: 'foundation', index: i }) : tapTarget({ kind: 'foundation', index: i }))}>
                <CardFace card={f.length ? f[f.length - 1] : null} className={isSel({ kind: 'foundation', index: i }) ? 'selected' : ''} />
              </div>
            ))}
          </div>
          <div className="sol-tableau">
            {g.tableau.map((pile, p) => (
              <div key={p} className="sol-pile" onClick={() => pile.length === 0 && tapTarget({ kind: 'tableau', pile: p })}>
                {pile.length === 0 && <div className="sol-card sol-slot" />}
                {pile.map((c, i) => {
                  const src: SolSource = { kind: 'tableau', pile: p, index: i }
                  const downs = pile.slice(0, i).filter(x => !x.faceUp).length
                  const ups = i - downs
                  const selFrom = selected && selected.kind === 'tableau' && selected.pile === p && i >= selected.index
                  return (
                    <CardFace
                      key={c.id}
                      card={c}
                      className={`sol-stacked${selFrom ? ' selected' : ''}`}
                      style={{ top: `calc(${downs} * var(--sol-step-down) + ${ups} * var(--sol-step-up))`, zIndex: i + 1 }}
                      onClick={e => {
                        e.stopPropagation()
                        if (!c.faceUp) {
                          // tapping the face-down run is a no-op; the top card flips on its own
                          if (selected) tapTarget({ kind: 'tableau', pile: p })
                          return
                        }
                        if (selected && !(selected.kind === 'tableau' && selected.pile === p)) { tapTarget({ kind: 'tableau', pile: p }); return }
                        tapSource(src)
                      }}
                      onDoubleClick={e => { e.stopPropagation(); if (c.faceUp && i === pile.length - 1) sendUp(src) }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      }
      overlay={overlay}
    />
  )
}
