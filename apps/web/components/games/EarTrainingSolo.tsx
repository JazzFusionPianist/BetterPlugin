'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  generateQuestion, playQuestion, isCorrect,
  INTERVAL_LABELS, CHORD_LABELS,
  ROUND_DURATION_MS, MAX_PLAYS,
  type Difficulty,
} from '@/lib/games/earTraining'
import { useT } from '@/lib/games/i18n'
import GameShell, { GameOverlayCard } from './GameShell'

export const SOLO_DIFFICULTIES: Difficulty[] = ['basic', 'intermediate', 'advanced']
const MISSES_ALLOWED = 3
/** How long the answer stays up before the next question. */
const REVEAL_RIGHT_MS = 1100
const REVEAL_WRONG_MS = 2400

function readBest (d: Difficulty): number {
  try { return Number(localStorage.getItem(`orb_et_solo_best_${d}`)) || 0 } catch { return 0 }
}
function writeBest (d: Difficulty, n: number) {
  try { localStorage.setItem(`orb_et_solo_best_${d}`, String(n)) } catch { /* private window: the best just isn't kept */ }
}

interface Props {
  difficulty: Difficulty
  onDifficulty: (d: Difficulty) => void
  /** Back to the game's first card (friends, computer, solo). */
  onExit: () => void
}

/** Solo practice — question after question, no opponent and no room. The
 *  run ends on the third miss (a question that times out is a miss); the
 *  count of right answers is the score, and the best per difficulty is
 *  kept on this device. Nothing here touches the database. */
export default function EarTrainingSolo ({ difficulty, onDifficulty, onExit }: Props) {
  const { t } = useT()
  const [seed, setSeed] = useState(() => `solo-${Date.now()}`)
  const [n, setN] = useState(1)
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [playsLeft, setPlaysLeft] = useState(MAX_PLAYS)
  const [over, setOver] = useState(false)
  const [best, setBest] = useState(() => readBest(difficulty))
  const [newBest, setNewBest] = useState(false)

  const question = useMemo(
    () => generateQuestion(seed, n, { modes: ['interval', 'chord'], difficulty }),
    [seed, n, difficulty],
  )

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  // Each new question plays itself once (a beat late, so the eye is there first).
  useEffect(() => {
    if (over) return
    const id = setTimeout(() => { playQuestion(question); setPlaysLeft(MAX_PLAYS - 1) }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, n, over])

  const answer = useCallback((ans: string) => {
    if (picked || over) return
    setPicked(ans)
    if (ans !== '__timeout__' && isCorrect(question, ans)) setScore(s => s + 1)
    else setMisses(m => m + 1)
  }, [picked, over, question])

  const elapsed = now - startedAt
  useEffect(() => {
    if (!picked && !over && elapsed > ROUND_DURATION_MS) answer('__timeout__')
  }, [elapsed, picked, over, answer])

  const right = !!picked && picked !== '__timeout__' && isCorrect(question, picked)

  // The answer shows for a moment, then the next question — or the end.
  const scoreRef = useRef(0)
  scoreRef.current = score
  useEffect(() => {
    if (!picked || over) return
    const id = setTimeout(() => {
      if (misses >= MISSES_ALLOWED) {
        const final = scoreRef.current
        if (final > readBest(difficulty)) { writeBest(difficulty, final); setBest(final); setNewBest(true) }
        setOver(true)
        return
      }
      setPicked(null)
      setPlaysLeft(MAX_PLAYS)
      setStartedAt(Date.now())
      setNow(Date.now())
      setN(k => k + 1)
    }, right ? REVEAL_RIGHT_MS : REVEAL_WRONG_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, over])

  const restart = useCallback((d: Difficulty = difficulty) => {
    onDifficulty(d)
    setSeed(`solo-${Date.now()}`)
    setN(1)
    setScore(0)
    setMisses(0)
    setPicked(null)
    setPlaysLeft(MAX_PLAYS)
    setStartedAt(Date.now())
    setNow(Date.now())
    setBest(readBest(d))
    setNewBest(false)
    setOver(false)
  }, [difficulty, onDifficulty])

  const endNow = useCallback(() => {
    if (over) return
    if (score > readBest(difficulty)) { writeBest(difficulty, score); setBest(score); setNewBest(true) }
    setOver(true)
  }, [over, score, difficulty])

  const handlePlay = () => {
    if (playsLeft <= 0 || picked || over) return
    playQuestion(question)
    setPlaysLeft(k => k - 1)
  }

  const labels = question.type === 'interval' ? INTERVAL_LABELS : CHORD_LABELS
  const label = (raw: string | null) => (raw && raw !== '__timeout__' ? labels[raw as keyof typeof labels] ?? raw : null)
  const timeRatio = Math.max(0, Math.min(1, (ROUND_DURATION_MS - elapsed) / ROUND_DURATION_MS))

  const overlay = over ? (
    <GameOverlayCard emoji="🎧" title={t('pb.gameOver')} className="et-lobby-card">
      <div className="et-final-score">{score}</div>
      {newBest && <div className="pb-newbest">{t('pb.newBest')}</div>}
      <div className="game-computer-picker" role="radiogroup" aria-label={t('et.difficulty')}>
        {SOLO_DIFFICULTIES.map(d => (
          <button key={d} type="button" role="radio" aria-checked={difficulty === d}
            className={`game-computer-count${difficulty === d ? ' selected' : ''}`}
            onClick={() => { onDifficulty(d); setBest(readBest(d)) }}>
            {t(`et.${d}`)}
          </button>
        ))}
      </div>
      <button className="game-invite-btn" onClick={() => restart(difficulty)}>{t('pb.playAgain')}</button>
    </GameOverlayCard>
  ) : null

  return (
    <GameShell
      title={t('game.earTraining')}
      onBack={onExit}
      actionStatus={!over ? (
        // the same two numerals as a duel: mine, and the one to beat — here my own best
        <span className="et-scorebar et-solo">
          <span className="et-score-mine">{score}</span>
          <span className="et-score-sep">–</span>
          <span className="et-score-theirs">{best}</span>
        </span>
      ) : undefined}
      controls={!over ? (
        <button className="game-btn game-btn-danger" onClick={endNow}>{t('pb.end')}</button>
      ) : undefined}
      aboveBoard={
        <div className="game-player-row">
          <span className="game-player-name">{t('et.best')}<span className="et-solo-bestnum"> {best}</span></span>
        </div>
      }
      fillBoard
      board={
        <div className="et-arena">
          {!over && (
            <div className="et-round">
              <div className="et-round-label">{t('et.solo')}</div>
              <div className="et-hero">
                <div className="et-hero-center">
                  <button className="et-play-btn" onClick={handlePlay} disabled={playsLeft <= 0 || !!picked} aria-label={t('et.play')}>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                  <div className="et-replays">{t('et.replaysLeft', { n: playsLeft })}</div>
                </div>
              </div>

              <div className="et-prompt">
                {question.type === 'interval' ? t('et.whatInterval') : t('et.whatChord')}
              </div>

              {!picked && (
                <div className="et-options">
                  {question.options.map(opt => (
                    <button key={opt} className="et-option" onClick={() => answer(opt)}>
                      {labels[opt as keyof typeof labels]}
                    </button>
                  ))}
                </div>
              )}

              {!picked && (
                <div className="et-progress">
                  <div className="et-progress-fill" style={{ width: `${timeRatio * 100}%` }} />
                </div>
              )}
              {picked && (
                <div className="et-reveal">
                  <div className="et-reveal-answer">{t('et.answerWas', { ans: label(question.answer) ?? '' })}</div>
                  <div className="et-reveal-rows">
                    <div className={`et-reveal-row${right ? ' ok' : ' bad'} mine`}>
                      <span className="et-reveal-row-label">{t('common.you')}</span>
                      <span className="et-reveal-row-pick">{label(picked) ?? t('et.skipped')}</span>
                      <span className="et-reveal-row-mark">{right ? '✓' : '✗'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      }
      belowBoard={
        <div className="game-player-row">
          <span className="game-player-name et-solo-misses">
            {t('et.misses')}
            {Array.from({ length: MISSES_ALLOWED }, (_, i) => <i key={i} className={`et-miss${i < misses ? ' on' : ''}`} />)}
          </span>
          <span className="game-player-name">{t(`et.${difficulty}`)}</span>
        </div>
      }
      overlay={overlay}
    />
  )
}
