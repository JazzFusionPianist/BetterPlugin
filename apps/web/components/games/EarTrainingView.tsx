'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EarTrainingRoom, Profile } from '@/lib/games/types'
import { useEarTrainingRoom } from '@/lib/games/useEarTrainingRoom'
import {
  generateQuestion, playQuestion, isCorrect,
  INTERVAL_LABELS, CHORD_LABELS,
  ROUND_DURATION_MS, REVEAL_DURATION_MS, MAX_PLAYS,
  type Question, type RoomConfig, type Mode, type Difficulty,
} from '@/lib/games/earTraining'
import { useT } from '@/lib/games/i18n'
import { computerPlayerId, computerPlayerName, isComputerPlayerId } from '@/lib/games/computerPlayers'
import GameShell, { GameOverlayCard, GameReadyControl, GameResultMark } from './GameShell'
import { sfx } from '@/lib/games/sfx'
import GameChat from './GameChat'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  friendProfiles: Profile[]
  onClose: () => void
  pendingInviteRoomId?: string | null
}

/** Light-bulb readout — lit when its player has locked in an answer.
 *  Two of these live side-by-side above the round's options so each
 *  player can see at a glance whether the round is waiting on them or
 *  on their opponent. `mine` swaps the lit colour to the player's own
 *  blue accent so the user can tell which bulb is theirs without
 *  reading a label. */
function Bulb ({ lit, mine = false }: { lit: boolean; mine?: boolean }) {
  return (
    <div className={`et-bulb${lit ? ' lit' : ''}${mine ? ' mine' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6" />
        <path d="M10 21h4" />
        <path d="M12 3a6 6 0 00-4 10.5c.7.8 1 1.7 1 2.5h6c0-.8.3-1.7 1-2.5A6 6 0 0012 3z" />
      </svg>
    </div>
  )
}

/** One row in the reveal scoreboard — "You: m3 ✓" / "Opponent: M3 ✗".
 *  `mine` paints the side label blue so the user can match it to
 *  their own blue bulb up top without reading the label twice. */
function RevealRow ({ label, pick, correct, mine = false }: {
  label: string
  pick: string
  correct: boolean
  mine?: boolean
}) {
  return (
    <div className={`et-reveal-row${correct ? ' ok' : ' bad'}${mine ? ' mine' : ''}`}>
      <span className="et-reveal-row-label">{label}</span>
      <span className="et-reveal-row-pick">{pick}</span>
      <span className="et-reveal-row-mark">{correct ? '✓' : '✗'}</span>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function EarTrainingView ({
  supabase, currentUserId, currentUserProfile, friendProfiles, onClose, pendingInviteRoomId,
}: Props) {
  const { t } = useT()
  void currentUserProfile

  const {
    room, seat,
    createRoom, joinRoom, updateConfig, toggleReady, startGame,
    submitAnswer, advanceRound, forfeitGame,
    deleteCurrentRoom, findActiveRoom,
    inviteFriend, cancelInvite, setRoom,
  } = useEarTrainingRoom(supabase, currentUserId)

  const [showInvite, setShowInvite] = useState(false)
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [playsLeft, setPlaysLeft] = useState(MAX_PLAYS)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [computerStartPending, setComputerStartPending] = useState(false)

  // Auto-resume any in-progress game on mount, or auto-accept a pending
  // invite that landed us on this screen.
  useEffect(() => {
    (async () => {
      if (pendingInviteRoomId) { await joinRoom(pendingInviteRoomId); return }
      await findActiveRoom()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tick clock so the round timer counts down visibly.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  // ─── Round state ─────────────────────────────────────────────────────────

  const isLobby     = !room || room.status === 'lobby'
  const isPlaying   = room?.status === 'playing'
  const isFinished  = room?.status === 'finished'
  const hasOpponent = !!(room && room.player2_id)
  const opponentId = room
    ? seat === 'player1'
      ? room.player2_id
      : room.player1_id
    : null

  const config: RoomConfig | null = room?.config ?? null
  const round = room?.current_round ?? 0
  const question: Question | null = useMemo(() => {
    if (!room || !isPlaying || round < 1 || !config) return null
    return generateQuestion(room.id, round, config)
  }, [room, isPlaying, round, config])

  const myAnswer       = seat === 'player1' ? room?.player1_answer : room?.player2_answer
  const opponentAnswer = seat === 'player1' ? room?.player2_answer : room?.player1_answer
  const bothAnswered   = !!(room?.player1_answer && room?.player2_answer)

  const etFinishRef = useRef(false)
  useEffect(() => {
    if (room?.status !== 'finished') { etFinishRef.current = false; return }
    if (etFinishRef.current) return
    etFinishRef.current = true
    sfx(room.winner_id === currentUserId ? 'win' : room.winner_id ? 'loss' : 'draw')
  }, [room?.status, room?.winner_id, currentUserId])

  const roundStarted = room?.round_started_at ? new Date(room.round_started_at).getTime() : 0
  const elapsed = roundStarted ? now - roundStarted : 0
  const remainingMs = Math.max(0, ROUND_DURATION_MS - elapsed)
  const timedOut = !!isPlaying && elapsed > ROUND_DURATION_MS && !myAnswer

  // Reset local round state when the round number changes.
  const lastRoundRef = useRef<number>(0)
  useEffect(() => {
    if (!room) return
    if (room.current_round !== lastRoundRef.current) {
      lastRoundRef.current = room.current_round
      setPlaysLeft(MAX_PLAYS)
      setSelectedAnswer(null)
    }
  }, [room?.current_round, room])

  // Auto-play the first time we see a new round (small delay so the
  // user's eyes catch up to the new screen state first).
  useEffect(() => {
    if (!question) return
    const t = setTimeout(() => {
      playQuestion(question)
      setPlaysLeft(MAX_PLAYS - 1)
    }, 350)
    return () => clearTimeout(t)
    // Re-fire only when the round number changes — question identity is
    // stable for a given (roomId, round, config) tuple.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, !!question])

  // ─── Auto-submit on timeout ──────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || !room || myAnswer) return
    if (elapsed > ROUND_DURATION_MS) {
      submitAnswer('__timeout__')
    }
  }, [elapsed, isPlaying, myAnswer, room, submitAnswer])

  // ─── Round advance (either client) ───────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || !room || !question || !bothAnswered) return
    const sinceReveal = elapsed - ROUND_DURATION_MS // negative if reveal triggered by both-answered before timer
    // We allow round close once both have answered + REVEAL_DURATION_MS
    // has passed since the LATER of (round start + answer time)
    // approximation: roundStarted + REVEAL after timer or both-answered.
    // Simplest correct rule: wait REVEAL_DURATION_MS after the round
    // visibly ended (myAnswer + opponentAnswer both set).
    const bothAnsweredAt = Math.max(
      // round_started_at + REVEAL only if timer is the trigger
      // Otherwise we don't have a server timestamp for "second answer
      // came in", so we just gate by elapsed > ROUND_DURATION_MS + 0
      // → reveal feedback for REVEAL_DURATION_MS via local effect.
      roundStarted,
      roundStarted, // placeholder, kept for clarity above
    )
    void bothAnsweredAt
    void sinceReveal
    // Trigger advance after REVEAL_DURATION_MS of holding the result.
    const id = setTimeout(() => {
      const p1Correct = !!question && room.player1_answer ? isCorrect(question, room.player1_answer) : false
      const p2Correct = !!question && room.player2_answer ? isCorrect(question, room.player2_answer) : false
      advanceRound({ round: room.current_round, player1Correct: p1Correct, player2Correct: p2Correct })
    }, REVEAL_DURATION_MS)
    return () => clearTimeout(id)
  }, [bothAnswered, room?.current_round, question?.answer])

  // ── Sound on the reveal: my answer chimes or buzzes, once per round.
  const revealSfxRef = useRef(-1)
  useEffect(() => {
    if (!bothAnswered || !question || !room) return
    if (revealSfxRef.current === room.current_round) return
    revealSfxRef.current = room.current_round
    if (myAnswer) sfx(isCorrect(question, myAnswer) ? 'etCorrect' : 'etWrong')
  }, [bothAnswered, room?.current_round, question, myAnswer, room])

  // Once both ready, either client kicks off the game (idempotent).
  useEffect(() => {
    if (room?.status === 'lobby' && room.player1_ready && room.player2_ready) {
      startGame()
    }
  }, [room?.status, room?.player1_ready, room?.player2_ready, startGame])

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleCreateAndInvite = useCallback(async (friendId: string) => {
    let target = room
    if (target && invitedIds.has(friendId)) {
      await cancelInvite(friendId, target.id)
      setInvitedIds(s => { const n = new Set(s); n.delete(friendId); return n })
      return
    }
    if (!target) {
      target = await createRoom({ modes: ['interval', 'chord'], difficulty: 'basic' })
    }
    if (!target) return
    await inviteFriend(friendId, target.id)
    setInvitedIds(s => new Set([...s, friendId]))
  }, [room, invitedIds, createRoom, inviteFriend, cancelInvite])

  const handlePlayComputer = useCallback(async () => {
    setComputerStartPending(true)
    try {
      let target = room
      if (!target) {
        target = await createRoom({ modes: ['interval', 'chord'], difficulty: 'basic' })
      }
      if (!target) {
        setComputerStartPending(false)
        return
      }
      const { data, error } = await supabase
        .from('ear_training_rooms')
        .update({
          player2_id: computerPlayerId(0),
          player1_ready: false,
          player2_ready: false,
          status: 'playing',
          current_round: 1,
          round_started_at: new Date().toISOString(),
          player1_answer: null,
          player2_answer: null,
          player1_score: 0,
          player2_score: 0,
          winner_id: null,
        })
        .eq('id', target.id)
        .select()
        .single()
      if (error || !data) {
        console.error('[EarTrainingView.handlePlayComputer]', error)
        setComputerStartPending(false)
        return
      }
      setRoom(data as EarTrainingRoom)
    } catch (error) {
      console.error('[EarTrainingView.handlePlayComputer]', error)
      setComputerStartPending(false)
    }
  }, [room, createRoom, supabase, setRoom])

  useEffect(() => {
    if (isPlaying) setComputerStartPending(false)
  }, [isPlaying])

  const handlePlay = () => {
    if (!question || playsLeft <= 0 || myAnswer) return
    playQuestion(question)
    setPlaysLeft(n => n - 1)
  }

  const handleAnswer = (ans: string) => {
    if (!question || myAnswer || selectedAnswer) return
    setSelectedAnswer(ans)
    submitAnswer(ans)
  }

  const computerAnswerKeyRef = useRef('')
  useEffect(() => {
    if (!isPlaying || !room || !question) return
    const botSeat =
      isComputerPlayerId(room.player1_id) ? 'player1'
      : isComputerPlayerId(room.player2_id) ? 'player2'
      : null
    if (!botSeat) return
    const field = botSeat === 'player1' ? 'player1_answer' : 'player2_answer'
    if (room[field]) return
    const key = `${room.id}:${room.current_round}:${field}`
    if (computerAnswerKeyRef.current === key) return
    computerAnswerKeyRef.current = key
    const timer = window.setTimeout(async () => {
      const options = question.options
      const wrong = options.filter(o => o !== question.answer)
      const pick = Math.random() < 0.72 ? question.answer : (wrong[Math.floor(Math.random() * wrong.length)] ?? question.answer)
      await supabase.from('ear_training_rooms').update({ [field]: pick }).eq('id', room.id)
    }, 900 + Math.floor(Math.random() * 1400))
    return () => window.clearTimeout(timer)
  }, [isPlaying, room, question, supabase])

  // Open the in-app confirm modal rather than calling window.confirm —
  // JUCE's WKWebView blocks native confirm/alert dialogs, so the
  // plugin-side click just silently no-op'd. The modal works in both
  // the regular browser AND the plugin.
  const handleForfeit = useCallback(() => {
    if (!isPlaying) return
    setShowForfeitConfirm(true)
  }, [isPlaying])
  const confirmForfeit = useCallback(async () => {
    setShowForfeitConfirm(false)
    await forfeitGame()
  }, [forfeitGame])

  const handleBack = useCallback(async () => {
    if (room && (room.status === 'lobby' || room.status === 'finished')) {
      await deleteCurrentRoom()
    }
    onClose()
  }, [room, deleteCurrentRoom, onClose])

  const setMode = async (mode: Mode, on: boolean) => {
    if (!room || !config) return
    if (seat !== 'player1') return
    const next = on
      ? Array.from(new Set([...config.modes, mode]))
      : config.modes.filter(m => m !== mode)
    if (next.length === 0) return  // never zero modes
    await updateConfig({ ...config, modes: next })
  }

  const setDifficulty = async (d: Difficulty) => {
    if (!room || !config) return
    if (seat !== 'player1') return
    await updateConfig({ ...config, difficulty: d })
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  const player1Profile = useMemo(
    () => room?.player1_id === currentUserId
      ? currentUserProfile
      : friendProfiles.find(p => p.id === room?.player1_id) ?? null,
    [room?.player1_id, currentUserId, currentUserProfile, friendProfiles]
  )
  const player2Profile = useMemo(
    () => !room?.player2_id || isComputerPlayerId(room.player2_id) ? null
      : room.player2_id === currentUserId ? currentUserProfile
      : friendProfiles.find(p => p.id === room.player2_id) ?? null,
    [room?.player2_id, currentUserId, currentUserProfile, friendProfiles]
  )

  // The opponent profile from MY perspective (player2 if I'm player1, else player1).
  const opponentProfile = seat === 'player1' ? player2Profile : player1Profile
  const isComputerOpponent = isComputerPlayerId(opponentId)

  const myScore       = seat === 'player1' ? (room?.player1_score ?? 0) : (room?.player2_score ?? 0)
  const opponentScore = seat === 'player1' ? (room?.player2_score ?? 0) : (room?.player1_score ?? 0)

  const myReady       = seat === 'player1' ? !!room?.player1_ready : !!room?.player2_ready
  const opponentReady = seat === 'player1' ? !!room?.player2_ready : !!room?.player1_ready

  const myCorrect = question && myAnswer && myAnswer !== '__timeout__' ? isCorrect(question, myAnswer) : false
  // Reveal the correct answer ONLY once BOTH players have locked in.
  // Picking solo just lights up your bulb; you can't peek at the
  // answer by submitting first.
  const reveal = bothAnswered
  // Countdown bar — 1 → empty, 0 → full progress. We render it as a
  // shrinking fill via style.width so the CSS doesn't need a JS-driven
  // animation per frame.
  const timeRatio = ROUND_DURATION_MS > 0
    ? Math.max(0, Math.min(1, remainingMs / ROUND_DURATION_MS))
    : 0
  // Has each player locked in an answer? Drives the bulb indicators.
  const p1Locked = !!room?.player1_answer
  const p2Locked = !!room?.player2_answer
  // Render the bulbs from MY perspective: my bulb on the left, opponent
  // on the right, so the user always sees their own state first.
  const myLocked       = seat === 'player1' ? p1Locked : p2Locked
  const opponentLocked = seat === 'player1' ? p2Locked : p1Locked

  // Reveal-time data — both raw answers and their correctness, so the
  // detailed scoreboard can show "me ✓ — opponent ✗ — +1 for me".
  const opponentAnswerRaw = seat === 'player1' ? room?.player2_answer : room?.player1_answer
  const opponentCorrect = question && opponentAnswerRaw && opponentAnswerRaw !== '__timeout__'
    ? isCorrect(question, opponentAnswerRaw) : false
  // Pretty-print an answer code (e.g. 'M3' → 'M3') via the right label
  // table. Returns null for missing / timeout picks so the caller can
  // render a "no pick" badge instead.
  const answerLabel = (raw: string | null | undefined): string | null => {
    if (!raw || raw === '__timeout__' || !question) return null
    const table = question.type === 'interval' ? INTERVAL_LABELS : CHORD_LABELS
    return table[raw as keyof typeof table] ?? raw
  }
  const correctAnswerLabel = question
    ? (question.type === 'interval' ? INTERVAL_LABELS[question.answer] : CHORD_LABELS[question.answer])
    : ''

  // ─── Overlay (lobby → ready → finished); null while a round is active ──────
  let overlay: React.ReactNode = null
  if (computerStartPending) {
    overlay = null
  } else if (isFinished && room) {
    // NO REMATCH — show the final score and exit chrome only.
    const resultMark = room.winner_id === currentUserId ? 'win' : room.winner_id ? 'loss' : 'draw'
    overlay = (
      <GameOverlayCard
        emoji={<GameResultMark result={resultMark} />}
        title={
          room.winner_id === currentUserId
            ? t('chess.youWon')
            : room.winner_id
              ? t('chess.youLost')
              : t('chess.drawResult')
        }
      >
        <div className="et-final-score">
          <span>{myScore}</span><span className="et-score-sep">–</span><span>{opponentScore}</span>
        </div>
      </GameOverlayCard>
    )
  } else if (isLobby && hasOpponent && config) {
    // Ready-to-play card with the host-controlled config UI inside.
    overlay = (
      <GameOverlayCard emoji="🎧" title={t('game.readyToPlay')} className="et-lobby-card">
        <div className="et-setup">
          <div className="et-setup-label">{t('et.modes')}</div>
          <div className="et-setup-row">
            <button
              className={`et-chip${config.modes.includes('interval') ? ' on' : ''}`}
              disabled={seat !== 'player1'}
              onClick={() => setMode('interval', !config.modes.includes('interval'))}
            >{t('et.modeInterval')}</button>
            <button
              className={`et-chip${config.modes.includes('chord') ? ' on' : ''}`}
              disabled={seat !== 'player1'}
              onClick={() => setMode('chord', !config.modes.includes('chord'))}
            >{t('et.modeChord')}</button>
          </div>
          <div className="et-setup-label">{t('et.difficulty')}</div>
          <div className="et-setup-row">
            {(['basic', 'intermediate', 'advanced'] as const).map(d => (
              <button
                key={d}
                className={`et-chip${config.difficulty === d ? ' on' : ''}`}
                disabled={seat !== 'player1'}
                onClick={() => setDifficulty(d)}
              >{t(`et.${d}`)}</button>
            ))}
          </div>
        </div>

        <GameReadyControl
          ready={myReady}
          count={`${(room!.player1_ready ? 1 : 0) + (room!.player2_ready ? 1 : 0)} / 2`}
          onToggle={toggleReady}
        />
      </GameOverlayCard>
    )
  } else if (isLobby && !hasOpponent) {
    overlay = (
      <GameOverlayCard emoji="🎧" title={t('game.earTraining')} className="et-lobby-card">
        <button className="game-invite-btn" onClick={() => setShowInvite(true)}>
          {t('chess.inviteCta')}
        </button>
        <button className="game-invite-btn game-computer-btn" onClick={handlePlayComputer}>
          {t('game.playComputer')}
        </button>
        {room && <div className="game-finish-readystate">{t('chess.waitingForFriend')}</div>}
      </GameOverlayCard>
    )
  }

  return (
    <GameShell
      title={t('game.earTraining')}
      onBack={handleBack}
      actionStatus={isPlaying ? (
        <span className="et-scorebar">
          <span className="et-score-mine">{myScore}</span>
          <span className="et-score-sep">–</span>
          <span className="et-score-theirs">{opponentScore}</span>
        </span>
      ) : undefined}
      controls={isPlaying ? (
        <button
          className="game-btn game-btn-danger"
          onClick={handleForfeit}
          title={t('et.forfeitConfirm')}
        >
          {t('et.forfeit')}
        </button>
      ) : undefined}
      aboveBoard={
        <div className="game-player-row">
          {opponentProfile ? (
            <span className="game-player-name">{opponentProfile.display_name}</span>
          ) : isComputerOpponent ? (
            <span className="game-player-name">{computerPlayerName(opponentId)}</span>
          ) : (
            <span className="game-player-name game-player-name--unknown">
              {hasOpponent ? t('common.opponent') : t('et.waitingOpponent')}
            </span>
          )}
          {isPlaying && !opponentAnswer && (
            <span className="game-player-turn">● {t('common.thinking')}</span>
          )}
          {isLobby && hasOpponent && (
            <span className={`game-ready-badge${opponentReady ? ' ready' : ''}`}>
              {opponentReady ? t('common.readyCheck') : t('common.notReady')}
            </span>
          )}
        </div>
      }
      fillBoard
      board={computerStartPending ? (
        <div className="game-transition-blank" />
      ) : (
        <div className="et-arena">
          {isPlaying && question && (
            <div className="et-round">
              <div className="et-round-label">
                {t('et.round', { n: round, total: room!.total_rounds })}
              </div>

              {/* Hero — the sound source (play button) flanked by the two
                  players' bulbs. My bulb on the left (blue), opponent on
                  the right (amber); each lights when that player locks in
                  an answer. Reveal happens once both are lit. */}
              <div className="et-hero">
                <Bulb lit={myLocked} mine />
                <div className="et-hero-center">
                  <button
                    className="et-play-btn"
                    onClick={handlePlay}
                    disabled={playsLeft <= 0 || !!myAnswer}
                    aria-label={t('et.play')}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <div className="et-replays">{t('et.replaysLeft', { n: playsLeft })}</div>
                </div>
                <Bulb lit={opponentLocked} />
              </div>

              <div className="et-prompt">
                {question.type === 'interval' ? t('et.whatInterval') : t('et.whatChord')}
              </div>

              {/* Options grid — hidden once both answer (reveal) so the
                  reveal card has room to sit on one screen. The grid's
                  green/red feedback would otherwise duplicate what the
                  card already states, and stacking both overflowed. */}
              {!reveal && (
                <div className="et-options">
                  {question.options.map(opt => {
                    const labels = question.type === 'interval' ? INTERVAL_LABELS : CHORD_LABELS
                    const isMyPick = selectedAnswer === opt || myAnswer === opt
                    return (
                      <button
                        key={opt}
                        className={`et-option${isMyPick ? ' picked' : ''}`}
                        onClick={() => handleAnswer(opt)}
                        disabled={!!myAnswer}
                      >{labels[opt as keyof typeof labels]}</button>
                    )
                  })}
                </div>
              )}

              {/* Status line — three states:
                  • not answered yet → countdown progress bar
                  • I've answered but opponent hasn't → "waiting for both"
                  • both answered → reveal feedback */}
              {!myAnswer && (
                <div className={`et-progress${timedOut ? ' out' : ''}`}>
                  <div
                    className="et-progress-fill"
                    style={{ width: `${timeRatio * 100}%` }}
                  />
                </div>
              )}
              {myAnswer && !reveal && (
                <div className="et-pending">{t('et.bothPicking')}</div>
              )}
              {reveal && (
                <div className="et-reveal">
                  {/* Correct answer banner — large, centred, with a
                      check icon so it reads at a glance. */}
                  <div className="et-reveal-answer">
                    {t('et.answerWas', { ans: correctAnswerLabel })}
                  </div>
                  {/* Two scoreboard rows: me + opponent. Each shows the
                      player's pick and a ✓ / ✗ glyph that drove the
                      score delta this round. */}
                  <div className="et-reveal-rows">
                    <RevealRow
                      label={t('common.you')}
                      pick={answerLabel(myAnswer) ?? t('et.skipped')}
                      correct={myCorrect}
                      mine
                    />
                    <RevealRow
                      label={t('common.opponent')}
                      pick={answerLabel(opponentAnswerRaw) ?? t('et.skipped')}
                      correct={opponentCorrect}
                    />
                  </div>
                  {/* Projected running total for the round we're about
                      to close. The header scorebar still reads the
                      OLD total during reveal (advanceRound hasn't run
                      yet); show the post-round version here so the
                      user understands the delta this round produced. */}
                  <div className="et-reveal-score">
                    <span className="et-score-mine">{myScore + (myCorrect ? 1 : 0)}</span>
                    <span className="et-score-sep">–</span>
                    <span className="et-score-theirs">{opponentScore + (opponentCorrect ? 1 : 0)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      belowBoard={
        <div className="game-player-row">
          {currentUserProfile
            ? <span className="game-player-name">{currentUserProfile.display_name}</span>
            : <span className="game-player-name">{t('common.me')}</span>}
          {isPlaying && myAnswer && !opponentAnswer && (
            <span className="game-player-turn">● {t('common.waiting')}</span>
          )}
          {isLobby && hasOpponent && (
            <span className={`game-ready-badge${myReady ? ' ready' : ''}`}>
              {myReady ? t('common.readyCheck') : t('common.notReady')}
            </span>
          )}
        </div>
      }
      overlay={overlay}
      chat={!computerStartPending ? (
        <GameChat
          supabase={supabase}
          currentUserId={currentUserId}
          roomId={room?.id ?? null}
          names={Object.fromEntries([[currentUserId, currentUserProfile?.display_name ?? 'me'], ...friendProfiles.map((p) => [p.id, p.display_name])])}
          otherUserId={isComputerOpponent ? null : opponentId}
          otherName={isComputerOpponent ? computerPlayerName(opponentId) : opponentProfile?.display_name}
        />
      ) : undefined}
      invite={{
        open: showInvite,
        onClose: () => setShowInvite(false),
        friends: friendProfiles,
        invitedIds,
        onInvite: handleCreateAndInvite,
        // ET is strictly 2-player: once an opponent is present, no further invites.
        canInvite: () => !hasOpponent,
      }}
      confirm={{
        open: showForfeitConfirm,
        message: t('et.forfeitConfirm'),
        confirmLabel: t('et.forfeit'),
        onConfirm: confirmForfeit,
        onCancel: () => setShowForfeitConfirm(false),
      }}
    />
  )
}