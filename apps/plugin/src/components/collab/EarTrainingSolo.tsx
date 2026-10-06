import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  generateQuestion, playQuestion, isCorrect, answerLabel,
  ROUND_DURATION_MS, MAX_PLAYS,
  type Difficulty, type Mode,
} from '../../lib/earTraining'
import { useT } from '../../i18n/LanguageContext'
import GameShell, { GameOverlayCard } from './GameShell'

export const SOLO_DIFFICULTIES: Difficulty[] = ['basic', 'intermediate', 'advanced']
export const SOLO_MODES: Mode[] = ['interval', 'chord', 'frequency']
const MODE_KEYS = { interval: 'et.modeInterval', chord: 'et.modeChord', frequency: 'et.modeFrequency' } as const
const MISSES_ALLOWED = 3
/** How long the answer stays up before the next question. */
const REVEAL_RIGHT_MS = 1100
const REVEAL_WRONG_MS = 2400

// A best belongs to what was practised: the difficulty and the kinds of question.
const bestKey = (d: Difficulty, modes: Mode[]) => `orb_et_solo_best_${d}_${[...modes].sort().join('+')}`
function readBest (d: Difficulty, modes: Mode[]): number {
  try { return Number(localStorage.getItem(bestKey(d, modes))) || 0 } catch { return 0 }
}
function writeBest (d: Difficulty, modes: Mode[], n: number) {
  try { localStorage.setItem(bestKey(d, modes), String(n)) } catch { /* private window: the best just isn't kept */ }
}

/** A label that shrinks to fit the button it sits in (a long chord name in
 *  a narrow column), and never grows past the button's own type size. */
export function FitLabel ({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const box = el?.parentElement
    if (!el || !box) return
    const fit = () => {
      el.style.fontSize = ''
      const cs = getComputedStyle(box)
      const room = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4
      const w = el.offsetWidth
      if (w > room) el.style.fontSize = `${Math.max(0.5, room / w)}em`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    // the webfont arriving changes the width without resizing the button
    document.fonts?.ready.then(fit).catch(() => {})
    return () => ro.disconnect()
  }, [children])
  return <span ref={ref} className="et-fit">{children}</span>
}

/** What to practise: any of intervals, chords and frequencies (at least
 *  one), and how hard. Shown on the first card and again after a run. */
export function SoloSetup ({ modes, onModes, difficulty, onDifficulty }: {
  modes: Mode[]
  onModes: (m: Mode[]) => void
  difficulty: Difficulty
  onDifficulty: (d: Difficulty) => void
}) {
  const { t } = useT()
  const toggle = (m: Mode) => {
    const next = modes.includes(m) ? modes.filter(x => x !== m) : SOLO_MODES.filter(x => x === m || modes.includes(x))
    if (next.length > 0) onModes(next)
  }
  return (
    <>
      <div className="game-computer-picker" role="group" aria-label={t('et.modes')}>
        {SOLO_MODES.map(m => (
          <button key={m} type="button" aria-pressed={modes.includes(m)}
            className={`game-computer-count${modes.includes(m) ? ' selected' : ''}`}
            onClick={() => toggle(m)}>
            {t(MODE_KEYS[m])}
          </button>
        ))}
      </div>
      <div className="game-computer-picker" role="radiogroup" aria-label={t('et.difficulty')}>
        {SOLO_DIFFICULTIES.map(d => (
          <button key={d} type="button" role="radio" aria-checked={difficulty === d}
            className={`game-computer-count${difficulty === d ? ' selected' : ''}`}
            onClick={() => onDifficulty(d)}>
            {t(`et.${d}`)}
          </button>
        ))}
      </div>
    </>
  )
}

interface Props {
  modes: Mode[]
  onModes: (m: Mode[]) => void
  difficulty: Difficulty
  onDifficulty: (d: Difficulty) => void
  /** Back to the game's first card (friends, computer, solo). */
  onExit: () => void
}

/** Solo practice — question after question, no opponent and no room. The
 *  run ends on the third miss (a question that times out is a miss); the
 *  count of right answers is the score, and the best per difficulty is
 *  kept on this device. Nothing here touches the database. */
export default function EarTrainingSolo ({ modes, onModes, difficulty, onDifficulty, onExit }: Props) {
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
  const [best, setBest] = useState(() => readBest(difficulty, modes))
  const [newBest, setNewBest] = useState(false)

  const question = useMemo(
    () => generateQuestion(seed, n, { modes, difficulty }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, n, difficulty, modes.join(',')],
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
        if (final > readBest(difficulty, modes)) { writeBest(difficulty, modes, final); setBest(final); setNewBest(true) }
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

  const restart = useCallback(() => {
    setSeed(`solo-${Date.now()}`)
    setN(1)
    setScore(0)
    setMisses(0)
    setPicked(null)
    setPlaysLeft(MAX_PLAYS)
    setStartedAt(Date.now())
    setNow(Date.now())
    setBest(readBest(difficulty, modes))
    setNewBest(false)
    setOver(false)
  }, [difficulty, modes])

  const endNow = useCallback(() => {
    if (over) return
    if (score > readBest(difficulty, modes)) { writeBest(difficulty, modes, score); setBest(score); setNewBest(true) }
    setOver(true)
  }, [over, score, difficulty, modes])

  const handlePlay = () => {
    if (playsLeft <= 0 || picked || over) return
    playQuestion(question)
    setPlaysLeft(k => k - 1)
  }

  const label = (raw: string | null) => (raw && raw !== '__timeout__' ? answerLabel(question, raw) : null)
  const timeRatio = Math.max(0, Math.min(1, (ROUND_DURATION_MS - elapsed) / ROUND_DURATION_MS))

  const overlay = over ? (
    <GameOverlayCard emoji="🎧" title={t('pb.gameOver')} className="et-lobby-card">
      <div className="et-final-score">{score}</div>
      {newBest && <div className="pb-newbest">{t('pb.newBest')}</div>}
      <SoloSetup modes={modes} onModes={onModes} difficulty={difficulty} onDifficulty={onDifficulty} />
      <button className="game-invite-btn" onClick={restart}>{t('pb.playAgain')}</button>
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
                {t(question.type === 'interval' ? 'et.whatInterval' : question.type === 'chord' ? 'et.whatChord' : 'et.whatFrequency')}
              </div>

              {!picked && (
                <div className="et-options">
                  {question.options.map(opt => (
                    <button key={opt} className="et-option" onClick={() => answer(opt)}>
                      <FitLabel>{answerLabel(question, opt)}</FitLabel>
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
