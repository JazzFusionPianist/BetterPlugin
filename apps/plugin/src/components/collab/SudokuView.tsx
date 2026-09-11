import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import { useT } from '../../i18n/LanguageContext'
import { useWorldScores, type WorldStanding } from '../../hooks/useWorldScores'
import { holdKeyboard } from '../../lib/keyboardCapture'
import { generateSudoku, sudokuScore, formatClock, boxOf, SUDOKU_DIFFICULTIES, type SudokuPuzzle, type SudokuDifficulty } from '../../lib/sudoku'
import GameShell, { GameOverlayCard } from './GameShell'
import WorldRanking from './WorldRanking'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  onClose: () => void
}

type Phase = 'ready' | 'live' | 'won'

/** Sudoku — solo, three difficulties, pencil marks, world ranking. */
export default function SudokuView({ supabase, currentUserId, onClose }: Props) {
  const { t } = useT()
  const { submitScore, loadStanding } = useWorldScores(supabase, currentUserId, 'sudoku_scores')

  const [difficulty, setDifficulty] = useState<SudokuDifficulty>(() => (localStorage.getItem('orb_sudoku_diff') as SudokuDifficulty) || 'easy')
  const [puzzle, setPuzzle] = useState<SudokuPuzzle | null>(null)
  const [values, setValues] = useState<number[]>(() => Array(81).fill(0))
  const [notes, setNotes] = useState<number[]>(() => Array(81).fill(0))   // bitmask 1<<v
  const [selected, setSelected] = useState<number | null>(null)
  const [pencil, setPencil] = useState(false)
  const [mistakes, setMistakes] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [standing, setStanding] = useState<WorldStanding | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [confirmKind, setConfirmKind] = useState<'end' | 'reset' | null>(null)
  const generating = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadStanding().then(s => { if (!cancelled && s) setStanding(s) })
    return () => { cancelled = true }
  }, [loadStanding])

  // Digits and arrows belong to the board while it's up.
  useEffect(() => holdKeyboard(), [])

  useEffect(() => {
    if (phase !== 'live') return
    const id = window.setInterval(() => setSeconds(s => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [phase])

  const handleStart = useCallback((d: SudokuDifficulty = difficulty) => {
    if (generating.current) return
    generating.current = true
    localStorage.setItem('orb_sudoku_diff', d)
    // generation is synchronous but can take a beat on 'hard' — yield a frame first
    window.setTimeout(() => {
      const p = generateSudoku(d)
      setPuzzle(p)
      setValues(p.givens.slice())
      setNotes(Array(81).fill(0))
      setSelected(null)
      setMistakes(0)
      setSeconds(0)
      setPencil(false)
      setPhase('live')
      generating.current = false
    }, 16)
  }, [difficulty])

  // Solved?
  useEffect(() => {
    if (phase !== 'live' || !puzzle) return
    if (values.every((v, i) => v === puzzle.solution[i])) {
      setPhase('won')
      const score = sudokuScore(puzzle.difficulty, seconds, mistakes)
      setFinalScore(score)
      setSubmitting(true)
      submitScore(score).then(s => { if (s) setStanding(s); setSubmitting(false) })
    }
  }, [values, puzzle, phase, seconds, mistakes, submitScore])

  const isGiven = useCallback((i: number) => !!puzzle && puzzle.givens[i] !== 0, [puzzle])

  const enter = useCallback((v: number) => {
    if (phase !== 'live' || selected === null || !puzzle || isGiven(selected)) return
    if (v === 0) {
      setValues(prev => { const n = prev.slice(); n[selected] = 0; return n })
      setNotes(prev => { const n = prev.slice(); n[selected] = 0; return n })
      return
    }
    if (pencil) {
      if (values[selected] !== 0) return
      setNotes(prev => { const n = prev.slice(); n[selected] ^= 1 << v; return n })
      return
    }
    if (values[selected] === v) return
    if (puzzle.solution[selected] !== v) setMistakes(m => m + 1)
    setValues(prev => { const n = prev.slice(); n[selected] = v; return n })
    setNotes(prev => {
      // clear this digit from the peers' pencil marks
      const n = prev.slice()
      const r = Math.floor(selected / 9), c = selected % 9, b = boxOf(selected)
      for (let i = 0; i < 81; i++) {
        if (Math.floor(i / 9) === r || i % 9 === c || boxOf(i) === b) n[i] &= ~(1 << v)
      }
      n[selected] = 0
      return n
    })
  }, [phase, selected, puzzle, isGiven, pencil, values])

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      if (phase !== 'live') return
      if (e.key >= '1' && e.key <= '9') { e.preventDefault(); enter(Number(e.key)); return }
      if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); enter(0); return }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setPencil(p => !p); return }
      const d: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }
      if (e.key in d) {
        e.preventDefault()
        setSelected(s => {
          const cur = s ?? 0
          const next = cur + d[e.key]
          if (next < 0 || next > 80) return cur
          if ((e.key === 'ArrowLeft' && cur % 9 === 0) || (e.key === 'ArrowRight' && cur % 9 === 8)) return cur
          return next
        })
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [phase, enter])

  // Conflicts: a value that clashes with a peer.
  const conflicts = useMemo(() => {
    const out = new Set<number>()
    for (let i = 0; i < 81; i++) {
      const v = values[i]
      if (!v) continue
      const r = Math.floor(i / 9), c = i % 9, b = boxOf(i)
      for (let j = 0; j < 81; j++) {
        if (j === i || values[j] !== v) continue
        if (Math.floor(j / 9) === r || j % 9 === c || boxOf(j) === b) { out.add(i); break }
      }
    }
    return out
  }, [values])

  const remaining = useMemo(() => {
    const counts = Array(10).fill(0) as number[]
    for (const v of values) if (v) counts[v]++
    return counts
  }, [values])

  const handleConfirm = useCallback(() => {
    const kind = confirmKind
    setConfirmKind(null)
    if (kind === 'end') { setPhase('ready'); setPuzzle(null) }
    else if (kind === 'reset') handleStart()
  }, [confirmKind, handleStart])

  // ── Overlay ────────────────────────────────────────────────────────────
  let overlay: React.ReactNode = null
  if (phase === 'ready' || phase === 'won') {
    const won = phase === 'won'
    overlay = (
      <GameOverlayCard title={won ? t('sd.solved') : t('game.sudoku')} className="pb-overlay-card">
        {won && <div className="pb-final-score">{finalScore.toLocaleString()}</div>}
        {won && <div className="game-finish-readystate">{formatClock(seconds)} · {t('sd.mistakes')} {mistakes}</div>}
        {won && standing?.isNewBest && <div className="pb-newbest">{t('pb.newBest')}</div>}
        <div className="game-computer-picker" role="radiogroup" aria-label={t('diff.label')}>
          {SUDOKU_DIFFICULTIES.map(d => (
            <button key={d} className={`game-computer-count${difficulty === d ? ' selected' : ''}`} onClick={() => setDifficulty(d)} role="radio" aria-checked={difficulty === d}>
              {t(`diff.${d}` as const)}
            </button>
          ))}
        </div>
        <WorldRanking standing={standing} loading={submitting} currentUserId={currentUserId} />
        <button className="game-invite-btn pb-start-btn" onClick={() => handleStart(difficulty)}>
          {won ? t('pb.playAgain') : t('pb.start')}
        </button>
        <div className="pb-hint">{t('sd.hint')}</div>
      </GameOverlayCard>
    )
  }

  const selR = selected === null ? -1 : Math.floor(selected / 9)
  const selC = selected === null ? -1 : selected % 9
  const selB = selected === null ? -1 : boxOf(selected)
  const selV = selected === null ? 0 : values[selected]

  return (
    <GameShell
      title={t('game.sudoku')}
      onBack={onClose}
      className="pinball-shell sd-shell"
      actionStatus={phase === 'live' ? <>{formatClock(seconds)} · {t('sd.mistakes')} {mistakes}</> : undefined}
      controls={phase === 'live' ? (
        <>
          <button className="game-btn game-btn-danger" onClick={() => setConfirmKind('end')}>{t('pb.end')}</button>
          <button className="game-btn" onClick={() => setConfirmKind('reset')}>{t('pb.reset')}</button>
        </>
      ) : undefined}
      confirm={{
        open: confirmKind != null,
        message: confirmKind === 'end' ? t('sd.endConfirm') : t('pb.resetConfirm'),
        confirmLabel: confirmKind === 'end' ? t('pb.end') : t('pb.reset'),
        onConfirm: handleConfirm,
        onCancel: () => setConfirmKind(null),
      }}
      fillBoard
      board={
        <div className="sd-layout">
          <div className="sd-board" role="grid">
            {values.map((v, i) => {
              const r = Math.floor(i / 9), c = i % 9
              const peer = selected !== null && (r === selR || c === selC || boxOf(i) === selB)
              const same = selV !== 0 && v === selV
              const cls = ['sd-cell',
                isGiven(i) ? 'given' : '',
                selected === i ? 'selected' : peer ? 'peer' : '',
                same ? 'same' : '',
                conflicts.has(i) ? 'wrong' : '',
                c % 3 === 2 && c !== 8 ? 'br' : '', r % 3 === 2 && r !== 8 ? 'bb' : '',
              ].filter(Boolean).join(' ')
              return (
                <div key={i} className={cls} onClick={() => phase === 'live' && setSelected(i)} role="gridcell" aria-selected={selected === i}>
                  {v !== 0 ? v : notes[i] ? (
                    <span className="sd-notes">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <i key={n}>{notes[i] & (1 << n) ? n : ''}</i>)}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div className="sd-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button key={n} className={`sd-key${remaining[n] >= 9 ? ' done' : ''}`} onClick={() => enter(n)} disabled={phase !== 'live'}>
                {n}<small>{Math.max(0, 9 - remaining[n])}</small>
              </button>
            ))}
            <button className={`sd-key sd-key-tool${pencil ? ' on' : ''}`} onClick={() => setPencil(p => !p)} disabled={phase !== 'live'} title="N">
              {t('sd.pencil')}
            </button>
            <button className="sd-key sd-key-tool" onClick={() => enter(0)} disabled={phase !== 'live'}>{t('sd.erase')}</button>
          </div>
        </div>
      }
      overlay={overlay}
    />
  )
}
