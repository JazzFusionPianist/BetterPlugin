import { useState, useEffect, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import { useT } from '../../i18n/LanguageContext'
import { useWorldScores, type WorldStanding } from '../../hooks/useWorldScores'
import { MinesweeperGame, minesweeperScore, MS_DIFFICULTIES, MS_PRESETS, type MsDifficulty } from '../../lib/minesweeper'
import { formatClock } from '../../lib/sudoku'
import GameShell, { GameOverlayCard } from './GameShell'
import WorldRanking from './WorldRanking'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  onClose: () => void
}

type Phase = 'ready' | 'live' | 'won' | 'lost'

/** Minesweeper — solo, three sizes, first click always safe. Left click
 *  reveals (or chords an open number), right click / flag mode flags. */
export default function MinesweeperView({ supabase, currentUserId, onClose }: Props) {
  const { t } = useT()
  const { submitScore, loadStanding } = useWorldScores(supabase, currentUserId, 'minesweeper_scores')

  const [difficulty, setDifficulty] = useState<MsDifficulty>(() => (localStorage.getItem('orb_ms_diff') as MsDifficulty) || 'easy')
  const gameRef = useRef<MinesweeperGame>(new MinesweeperGame(difficulty))
  const [, bump] = useState(0)
  const rerender = useCallback(() => bump(n => n + 1), [])
  const [phase, setPhase] = useState<Phase>('ready')
  const [seconds, setSeconds] = useState(0)
  const [flagMode, setFlagMode] = useState(false)
  const [standing, setStanding] = useState<WorldStanding | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [confirmKind, setConfirmKind] = useState<'end' | 'reset' | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [cellPx, setCellPx] = useState(24)

  useEffect(() => {
    let cancelled = false
    loadStanding().then(s => { if (!cancelled && s) setStanding(s) })
    return () => { cancelled = true }
  }, [loadStanding])

  // Timer runs from the first reveal.
  useEffect(() => {
    if (phase !== 'live') return
    const id = window.setInterval(() => { if (gameRef.current.started) setSeconds(s => s + 1) }, 1000)
    return () => window.clearInterval(id)
  }, [phase])

  // Cell size follows the space the board gets — the wide plugin window
  // shows 'hard' at full size, the compact tower shrinks it.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const compute = () => {
      const g = gameRef.current
      const w = wrap.clientWidth, h = wrap.clientHeight
      if (w === 0 || h === 0) return
      const px = Math.floor(Math.min((w - 2) / g.cols, (h - 2) / g.rows))
      setCellPx(Math.max(14, Math.min(34, px)))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [phase, difficulty])

  const handleStart = useCallback((d: MsDifficulty = difficulty) => {
    localStorage.setItem('orb_ms_diff', d)
    gameRef.current = new MinesweeperGame(d)
    setSeconds(0)
    setFlagMode(false)
    setPhase('live')
    rerender()
  }, [difficulty, rerender])

  const finish = useCallback(() => {
    const g = gameRef.current
    if (g.won) {
      const score = minesweeperScore(g.difficulty, Math.max(1, seconds))
      setFinalScore(score)
      setPhase('won')
      setSubmitting(true)
      submitScore(score).then(s => { if (s) setStanding(s); setSubmitting(false) })
    } else {
      setPhase('lost')
    }
  }, [seconds, submitScore])

  const onCell = useCallback((r: number, c: number, flag: boolean) => {
    if (phase !== 'live') return
    const g = gameRef.current
    const changed = flag ? g.toggleFlag(r, c) : g.reveal(r, c)
    if (!changed) return
    rerender()
    if (g.over) finish()
  }, [phase, rerender, finish])

  // 'f' toggles flag mode (trackpad users).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'f' || e.key === 'F') setFlagMode(f => !f)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  const handleConfirm = useCallback(() => {
    const kind = confirmKind
    setConfirmKind(null)
    if (kind === 'end') setPhase('ready')
    else if (kind === 'reset') handleStart()
  }, [confirmKind, handleStart])

  const g = gameRef.current
  const minesLeft = g.mines - g.flags

  let overlay: React.ReactNode = null
  if (phase !== 'live') {
    const won = phase === 'won', lost = phase === 'lost'
    overlay = (
      <GameOverlayCard title={won ? t('ms.cleared') : lost ? t('ms.boom') : t('game.minesweeper')} className="pb-overlay-card">
        {won && <div className="pb-final-score">{finalScore.toLocaleString()}</div>}
        {won && <div className="game-finish-readystate">{formatClock(seconds)}</div>}
        {won && standing?.isNewBest && <div className="pb-newbest">{t('pb.newBest')}</div>}
        <div className="game-computer-picker" role="radiogroup" aria-label={t('diff.label')}>
          {MS_DIFFICULTIES.map(d => (
            <button key={d} className={`game-computer-count${difficulty === d ? ' selected' : ''}`} onClick={() => setDifficulty(d)} role="radio" aria-checked={difficulty === d}
              title={`${MS_PRESETS[d].cols}×${MS_PRESETS[d].rows} · ${MS_PRESETS[d].mines}`}>
              {t(`diff.${d}` as const)}
            </button>
          ))}
        </div>
        <WorldRanking standing={standing} loading={submitting} currentUserId={currentUserId} />
        <button className="game-invite-btn pb-start-btn" onClick={() => handleStart(difficulty)}>
          {won || lost ? t('pb.playAgain') : t('pb.start')}
        </button>
        <div className="pb-hint">{t('ms.hint')}</div>
      </GameOverlayCard>
    )
  }

  return (
    <GameShell
      title={t('game.minesweeper')}
      onBack={onClose}
      className="pinball-shell ms-shell"
      actionStatus={phase === 'live' ? <>{formatClock(seconds)} · {t('ms.mines')} {minesLeft}</> : undefined}
      controls={phase === 'live' ? (
        <>
          <button className={`game-btn${flagMode ? ' ms-flag-on' : ''}`} onClick={() => setFlagMode(f => !f)} title="F">⚑ {t('ms.flagMode')}</button>
          <button className="game-btn game-btn-danger" onClick={() => setConfirmKind('end')}>{t('pb.end')}</button>
          <button className="game-btn" onClick={() => setConfirmKind('reset')}>{t('pb.reset')}</button>
        </>
      ) : undefined}
      confirm={{
        open: confirmKind != null,
        message: confirmKind === 'end' ? t('ms.endConfirm') : t('pb.resetConfirm'),
        confirmLabel: confirmKind === 'end' ? t('pb.end') : t('pb.reset'),
        onConfirm: handleConfirm,
        onCancel: () => setConfirmKind(null),
      }}
      fillBoard
      board={
        <div className="ms-layout" ref={wrapRef}>
          <div
            className={`ms-board${flagMode ? ' flag-mode' : ''}${phase !== 'live' ? ' idle' : ''}`}
            style={{ gridTemplateColumns: `repeat(${g.cols}, ${cellPx}px)`, gridAutoRows: `${cellPx}px`, fontSize: Math.round(cellPx * 0.55) }}
            onContextMenu={e => e.preventDefault()}
          >
            {g.cells.map((row, r) => row.map((cell, c) => {
              const cls = ['ms-cell',
                cell.state === 'revealed' ? (cell.mine ? (cell.blown ? 'mine blown' : 'mine') : `open n${cell.adj}`) : 'hidden',
                cell.state === 'flagged' ? 'flag' : '',
                phase === 'lost' && cell.state === 'flagged' && !cell.mine ? 'wrongflag' : '',
              ].filter(Boolean).join(' ')
              return (
                <div
                  key={`${r}-${c}`}
                  className={cls}
                  onClick={() => onCell(r, c, flagMode)}
                  onContextMenu={e => { e.preventDefault(); onCell(r, c, true) }}
                >
                  {cell.state === 'flagged' ? '⚑' : cell.state === 'revealed' ? (cell.mine ? '✹' : cell.adj || '') : ''}
                </div>
              )
            }))}
          </div>
        </div>
      }
      overlay={overlay}
    />
  )
}
