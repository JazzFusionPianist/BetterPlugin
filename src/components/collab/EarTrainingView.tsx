import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import { useEarTrainingRoom } from '../../hooks/useEarTrainingRoom'
import {
  generateQuestion, playQuestion, isCorrect,
  INTERVAL_LABELS, CHORD_LABELS,
  ROUND_DURATION_MS, REVEAL_DURATION_MS, MAX_PLAYS,
  type Question, type RoomConfig, type Mode, type Difficulty,
} from '../../lib/earTraining'
import { useT } from '../../i18n/LanguageContext'

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

function Avatar ({ profile, size = 28 }: { profile: Profile; size?: number }) {
  return (
    <div className="av" style={{ background: profile.avatar_color, width: size, height: size, fontSize: size * 0.42 }}>
      {profile.avatar_url
        ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
        : profile.initials}
    </div>
  )
}

// ─── Invite modal — same shape as ChessView's ─────────────────────────────────

interface InviteModalProps {
  friends: Profile[]
  invitedIds: Set<string>
  onInvite: (friendId: string) => void
  onClose: () => void
}

function InviteModal ({ friends, invitedIds, onInvite, onClose }: InviteModalProps) {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? friends.filter(f => f.display_name.toLowerCase().includes(q))
      : friends
    return [...list].sort((a, b) => {
      const aOn = a.isOnline ? 0 : 1
      const bOn = b.isOnline ? 0 : 1
      if (aOn !== bOn) return aOn - bOn
      return a.display_name.localeCompare(b.display_name)
    })
  }, [friends, query])

  return (
    <div
      className="chess-invite-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="chess-invite-modal" role="dialog" aria-label={t('game.inviteFriend')}>
        <div className="chess-invite-modal-header">
          <span className="chess-invite-modal-title">{t('game.inviteFriend')}</span>
          <button className="chess-invite-modal-close" onClick={onClose}>×</button>
        </div>
        {friends.length > 0 && (
          <div className="chess-invite-search-wrap">
            <input
              className="chess-invite-search-input"
              type="text"
              placeholder={t('game.searchFriends')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        )}
        {friends.length === 0 ? (
          <p className="chess-invite-empty">{t('game.noFriendsToInvite')}</p>
        ) : filtered.length === 0 ? (
          <p className="chess-invite-empty">{t('game.noMatch', { q: query })}</p>
        ) : (
          <div className="chess-invite-list">
            {filtered.map(friend => (
              <div key={friend.id} className="chess-invite-row">
                <div className="chess-invite-av-wrap">
                  <Avatar profile={friend} size={36} />
                  {friend.isOnline && <span className="chess-invite-online-dot" />}
                </div>
                <span className="chess-invite-name">{friend.display_name}</span>
                <button
                  className={`chess-invite-do-btn${invitedIds.has(friend.id) ? ' invited' : ''}`}
                  onClick={() => onInvite(friend.id)}
                  title={invitedIds.has(friend.id) ? t('game.invited') : t('game.invite')}
                >
                  {invitedIds.has(friend.id) ? t('game.invited') : t('game.invite')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
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
    inviteFriend, cancelInvite,
  } = useEarTrainingRoom(supabase, currentUserId)

  const [showInvite, setShowInvite] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [playsLeft, setPlaysLeft] = useState(MAX_PLAYS)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

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

  const config: RoomConfig | null = room?.config ?? null
  const round = room?.current_round ?? 0
  const question: Question | null = useMemo(() => {
    if (!room || !isPlaying || round < 1 || !config) return null
    return generateQuestion(room.id, round, config)
  }, [room, isPlaying, round, config])

  const myAnswer       = seat === 'player1' ? room?.player1_answer : room?.player2_answer
  const opponentAnswer = seat === 'player1' ? room?.player2_answer : room?.player1_answer
  const bothAnswered   = !!(room?.player1_answer && room?.player2_answer)

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

  const handleForfeit = useCallback(async () => {
    if (!isPlaying) return
    if (!confirm(t('et.forfeitConfirm'))) return
    await forfeitGame()
  }, [isPlaying, forfeitGame, t])

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
    () => !room?.player2_id ? null
      : room.player2_id === currentUserId ? currentUserProfile
      : friendProfiles.find(p => p.id === room.player2_id) ?? null,
    [room?.player2_id, currentUserId, currentUserProfile, friendProfiles]
  )

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

  return (
    <div className="chess-view">
      <div className="chess-header">
        <button className="chess-back-btn" onClick={handleBack} aria-label={t('common.goBack')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="chess-title">{t('game.earTraining')}</span>
        {isPlaying && (
          <div className="chess-controls">
            <span className="et-scorebar">
              <span className="et-score-mine">{myScore}</span>
              <span className="et-score-sep">–</span>
              <span className="et-score-theirs">{opponentScore}</span>
            </span>
            <button
              className="chess-btn chess-btn-resign"
              onClick={handleForfeit}
              title={t('et.forfeitConfirm')}
            >
              {t('et.forfeit')}
            </button>
          </div>
        )}
      </div>

      <div className="chess-game-area">
        {/* Opponent row */}
        <div className="chess-player-row chess-player-row--opponent">
          {player2Profile && player1Profile ? (
            seat === 'player1' && player2Profile
              ? <><Avatar profile={player2Profile} size={28} /><span className="chess-player-name">{player2Profile.display_name}</span></>
              : seat === 'player2' && player1Profile
                ? <><Avatar profile={player1Profile} size={28} /><span className="chess-player-name">{player1Profile.display_name}</span></>
                : null
          ) : (
            <span className="chess-player-name chess-player-name--unknown">
              {hasOpponent ? t('common.opponent') : t('et.waitingOpponent')}
            </span>
          )}
          {isPlaying && !opponentAnswer && (
            <span className="chess-player-turn">● {t('common.thinking')}</span>
          )}
          {isLobby && hasOpponent && (
            <span className={`chess-ready-badge${opponentReady ? ' ready' : ''}`}>
              {opponentReady ? t('common.readyCheck') : t('common.notReady')}
            </span>
          )}
        </div>

        {/* Centre area */}
        <div className="et-arena">
          {isLobby && !hasOpponent && (
            <div className="chess-finish-card et-lobby-card">
              <div className="chess-finish-emoji">🎧</div>
              <div className="chess-finish-title">{t('game.earTraining')}</div>
              <button className="chess-invite-btn" onClick={() => setShowInvite(true)}>
                {t('chess.inviteCta')}
              </button>
              {room && <div className="chess-finish-readystate">{t('chess.waitingForFriend')}</div>}
            </div>
          )}

          {isLobby && hasOpponent && config && (
            <div className="chess-finish-card et-lobby-card">
              <div className="chess-finish-emoji">🎧</div>
              <div className="chess-finish-title">{t('game.readyToPlay')}</div>

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

              <button
                className={`chess-ready-btn${myReady ? ' ready' : ''}`}
                onClick={toggleReady}
              >
                {myReady ? t('common.readyCheck') : t('common.ready')}
              </button>
              <div className="chess-finish-readystate">
                {(room!.player1_ready ? 1 : 0) + (room!.player2_ready ? 1 : 0)} / 2
              </div>
            </div>
          )}

          {isPlaying && question && (
            <div className="et-round">
              <div className="et-round-label">
                {t('et.round', { n: round, total: room!.total_rounds })}
              </div>

              {/* Twin-bulb readout — each lights up when its player has
                  locked in an answer. Reveal happens once both lights
                  are on. Left bulb = me, right bulb = opponent so the
                  user always knows which is which without a label. */}
              <div className="et-bulbs">
                <Bulb lit={myLocked} mine />
                <Bulb lit={opponentLocked} />
              </div>

              <button
                className="et-play-btn"
                onClick={handlePlay}
                disabled={playsLeft <= 0 || !!myAnswer}
                aria-label={t('et.play')}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <div className="et-replays">{t('et.replaysLeft', { n: playsLeft })}</div>

              <div className="et-prompt">
                {question.type === 'interval' ? t('et.whatInterval') : t('et.whatChord')}
              </div>

              {/* Shared cell for both question variants — keeps the
                  reveal-vs-locked styling DRY. */}
              <div className="et-options">
                {question.options.map(opt => {
                  const labels = question.type === 'interval' ? INTERVAL_LABELS : CHORD_LABELS
                  const isAns    = opt === question.answer
                  const isMyPick = selectedAnswer === opt || myAnswer === opt
                  // The answer is hidden until BOTH players have locked
                  // in. Until then we only show that I picked an option
                  // (et-option picked), not whether it was correct.
                  const cls = !reveal ? '' : isAns ? ' correct' : isMyPick ? ' wrong' : ''
                  return (
                    <button
                      key={opt}
                      className={`et-option${cls}${isMyPick ? ' picked' : ''}`}
                      onClick={() => handleAnswer(opt)}
                      disabled={!!myAnswer}
                    >{labels[opt as keyof typeof labels]}</button>
                  )
                })}
              </div>

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
                <div className={`et-feedback${myCorrect ? ' ok' : ' bad'}`}>
                  {myAnswer === '__timeout__'
                    ? t('et.timeUp', { ans: question.type === 'interval'
                        ? INTERVAL_LABELS[question.answer]
                        : CHORD_LABELS[question.answer] })
                    : myCorrect
                      ? t('et.correct')
                      : t('et.wrong', { ans: question.type === 'interval'
                          ? INTERVAL_LABELS[question.answer]
                          : CHORD_LABELS[question.answer] })}
                </div>
              )}
            </div>
          )}

          {isFinished && room && (
            <div className="chess-finish-card et-lobby-card">
              <div className="chess-finish-emoji">
                {room.winner_id === currentUserId ? '🏆' : room.winner_id ? '😔' : '🤝'}
              </div>
              <div className="chess-finish-title">
                {room.winner_id === currentUserId
                  ? t('chess.youWon')
                  : room.winner_id
                    ? t('chess.youLost')
                    : t('chess.drawResult')}
              </div>
              <div className="et-final-score">
                <span>{myScore}</span><span className="et-score-sep">–</span><span>{opponentScore}</span>
              </div>
            </div>
          )}
        </div>

        {/* My player row */}
        <div className="chess-player-row chess-player-row--me">
          {currentUserProfile
            ? <><Avatar profile={currentUserProfile} size={28} /><span className="chess-player-name">{currentUserProfile.display_name}</span></>
            : <span className="chess-player-name">{t('common.me')}</span>}
          {isPlaying && myAnswer && !opponentAnswer && (
            <span className="chess-player-turn">● {t('common.waiting')}</span>
          )}
          {isLobby && hasOpponent && (
            <span className={`chess-ready-badge${myReady ? ' ready' : ''}`}>
              {myReady ? t('common.readyCheck') : t('common.notReady')}
            </span>
          )}
        </div>
      </div>

      {showInvite && (
        <InviteModal
          friends={friendProfiles}
          invitedIds={invitedIds}
          onInvite={handleCreateAndInvite}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  )
}
