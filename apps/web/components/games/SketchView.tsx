'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/lib/games/types'
import { useSketchRoom } from '@/lib/games/useSketchRoom'
import {
  SK_W, SK_H, SK_TURN_MS, SK_REVEAL_MS, SK_COLORS, GUESS_POINTS, DRAWER_POINTS,
  pickChoices, normalizeGuess, maskWord, sketchWinner,
} from '@/lib/games/sketch'
import type { SketchState, SketchStroke } from '@/lib/games/sketch'
import { useT } from '@/lib/games/i18n'
import { sfx } from '@/lib/games/sfx'
import GameShell, { GameOverlayCard, GameReadyControl, GameResultMark } from './GameShell'
import GameChat from './GameChat'

const MAX_PLAYERS = 6
const SOLVED_MARK = '✓'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  friendProfiles: Profile[]
  onlineIds: Set<string>
  onClose: () => void
}

function strokePath(p: number[]): string {
  if (p.length < 4) {
    const x = p[0] ?? 0, y = p[1] ?? 0
    return `M ${x} ${y} l 0.01 0`
  }
  let d = `M ${p[0]} ${p[1]}`
  for (let i = 2; i + 1 < p.length; i += 2) {
    const mx = (p[i - 2] + p[i]) / 2
    const my = (p[i - 1] + p[i + 1]) / 2
    d += ` Q ${p[i - 2]} ${p[i - 1]} ${mx} ${my}`
  }
  return d
}

export default function SketchView({
  supabase,
  currentUserId,
  currentUserProfile,
  friendProfiles,
  onClose,
}: Props) {
  const { t, lang } = useT()
  const {
    room, loading,
    createRoom, joinRoom, leaveRoom, deleteCurrentRoom, findActiveRoom,
    toggleReady, startGame, writeState, endGame, inviteFriend, cancelInvite,
  } = useSketchRoom(supabase, currentUserId)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [guess, setGuess] = useState('')
  const [penColor, setPenColor] = useState(SK_COLORS[0])
  const [liveStroke, setLiveStroke] = useState<SketchStroke | null>(null)
  const [tick, setTick] = useState(0)          // 1s heartbeat for the timer
  const liveRef = useRef<SketchStroke | null>(null)
  const boardRef = useRef<SVGSVGElement | null>(null)
  const stateRef = useRef<SketchState | null>(null)

  // ── Mount: resume ────────────────────────────────────────────────────────
  useEffect(() => {
    const pendingRoomId = sessionStorage.getItem('join_room_id')
    if (pendingRoomId && !room) {
      sessionStorage.removeItem('join_room_id')
      joinRoom(pendingRoomId)
      return
    }
    if (!room) findActiveRoom()
  }, [joinRoom, findActiveRoom, room])

  const status = room?.status ?? 'lobby'
  const isLobby = status === 'lobby'
  const isPlaying = status === 'playing'
  const isFinished = status === 'finished'
  const isHost = !!(room && room.host_id === currentUserId)
  const ids = useMemo(() => room?.player_ids ?? [], [room])

  const st: SketchState | null =
    (isPlaying || isFinished) && room?.state && 'strokes' in (room.state as object)
      ? room.state as SketchState
      : null
  useEffect(() => { stateRef.current = st }, [st])

  const drawerId = st ? ids[st.turnIdx] ?? null : null
  const meDrawer = isPlaying && drawerId === currentUserId
  const solvedMe = !!st && st.solved[currentUserId] != null

  const nameFor = useCallback((id: string): string => {
    if (id === currentUserId) return currentUserProfile?.display_name ?? 'me'
    return friendProfiles.find(p => p.id === id)?.display_name ?? 'player'
  }, [currentUserId, currentUserProfile, friendProfiles])

  useEffect(() => {
    const iv = window.setInterval(() => setTick(x => x + 1), 1000)
    return () => window.clearInterval(iv)
  }, [])

  // ── Turn advancing (drawer's client is the single writer) ────────────────
  const advanceTurn = useCallback((s: SketchState): void => {
    let turnIdx = s.turnIdx + 1
    let round = s.round
    if (turnIdx >= ids.length) { turnIdx = 0; round += 1 }
    if (round > s.rounds) {
      const done: SketchState = { ...s, phase: 'end', word: null, deadline: null, seq: s.seq + 1 }
      endGame(sketchWinner(done, ids), done)
      return
    }
    writeState({
      ...s,
      turnIdx, round,
      phase: 'choosing',
      word: null,
      choices: pickChoices(lang),
      strokes: [],
      solved: {},
      deadline: null,
      seq: s.seq + 1,
    })
  }, [ids, lang, writeState, endGame])

  const endTurn = useCallback((s: SketchState): void => {
    writeState({ ...s, phase: 'reveal', deadline: Date.now() + SK_REVEAL_MS, seq: s.seq + 1 })
  }, [writeState])

  // drawer's clock: end drawing at deadline; leave reveal after its hold
  useEffect(() => {
    if (!st || !meDrawer) return
    if (st.phase === 'drawing' && st.deadline != null) {
      const ms = st.deadline - Date.now()
      const to = window.setTimeout(() => {
        const cur = stateRef.current
        if (cur && cur.phase === 'drawing') endTurn(cur)
      }, Math.max(0, ms))
      return () => window.clearTimeout(to)
    }
    if (st.phase === 'reveal' && st.deadline != null) {
      const ms = st.deadline - Date.now()
      const to = window.setTimeout(() => {
        const cur = stateRef.current
        if (cur && cur.phase === 'reveal') advanceTurn(cur)
      }, Math.max(0, ms))
      return () => window.clearTimeout(to)
    }
  }, [st, meDrawer, endTurn, advanceTurn])

  // stuck-turn rescue: host may skip a vanished drawer
  const stuck = !!st && isPlaying && !meDrawer && isHost
    && ((st.phase === 'drawing' && st.deadline != null && Date.now() - st.deadline > 15_000)
      || (st.phase === 'reveal' && st.deadline != null && Date.now() - st.deadline > 15_000))

  // ── Solve side-channel: guessers post ✓ to chat, drawer scores it ────────
  useEffect(() => {
    if (!room || !isPlaying || !meDrawer) return
    const ch = supabase
      .channel(`sketch_solves:${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'game_chats', filter: `room_id=eq.${room.id}`,
      }, payload => {
        const row = payload.new as { sender_id: string; content: string }
        const cur = stateRef.current
        if (!cur || cur.phase !== 'drawing') return
        if (row.content !== SOLVED_MARK) return
        if (row.sender_id === currentUserId || cur.solved[row.sender_id] != null) return
        const order = Object.keys(cur.solved).length + 1
        const scores = { ...cur.scores }
        scores[row.sender_id] = (scores[row.sender_id] ?? 0) + (GUESS_POINTS[order - 1] ?? 80)
        scores[currentUserId] = (scores[currentUserId] ?? 0) + DRAWER_POINTS
        const next: SketchState = {
          ...cur,
          solved: { ...cur.solved, [row.sender_id]: order },
          scores,
          seq: cur.seq + 1,
        }
        const guessers = ids.filter(id => id !== currentUserId)
        if (guessers.every(id => next.solved[id] != null)) endTurn(next)
        else writeState(next)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [room, isPlaying, meDrawer, supabase, currentUserId, ids, writeState, endTurn])

  // ── Drawing input (drawer only) ──────────────────────────────────────────
  const toBoard = useCallback((e: React.PointerEvent): [number, number] => {
    const rect = boardRef.current!.getBoundingClientRect()
    return [
      Math.max(0, Math.min(SK_W, ((e.clientX - rect.left) / rect.width) * SK_W)),
      Math.max(0, Math.min(SK_H, ((e.clientY - rect.top) / rect.height) * SK_H)),
    ]
  }, [])

  const onDown = useCallback((e: React.PointerEvent) => {
    if (!meDrawer || st?.phase !== 'drawing') return
    e.preventDefault()
    const [x, y] = toBoard(e)
    const s: SketchStroke = { c: penColor, w: 2.4, p: [x, y] }
    liveRef.current = s
    setLiveStroke({ ...s })
  }, [meDrawer, st?.phase, penColor, toBoard])

  const onMove = useCallback((e: React.PointerEvent) => {
    const s = liveRef.current
    if (!s) return
    const [x, y] = toBoard(e)
    const n = s.p.length
    if (n >= 2 && Math.abs(x - s.p[n - 2]) < 1.6 && Math.abs(y - s.p[n - 1]) < 1.6) return
    s.p.push(x, y)
    setLiveStroke({ ...s, p: [...s.p] })
  }, [toBoard])

  const onUp = useCallback(() => {
    const s = liveRef.current
    liveRef.current = null
    setLiveStroke(null)
    const cur = stateRef.current
    if (!s || !cur || cur.phase !== 'drawing') return
    writeState({ ...cur, strokes: [...cur.strokes, s], seq: cur.seq + 1 })
  }, [writeState])

  const undoStroke = useCallback(() => {
    const cur = stateRef.current
    if (!cur || cur.strokes.length === 0) return
    writeState({ ...cur, strokes: cur.strokes.slice(0, -1), seq: cur.seq + 1 })
  }, [writeState])

  const clearStrokes = useCallback(() => {
    const cur = stateRef.current
    if (!cur) return
    writeState({ ...cur, strokes: [], seq: cur.seq + 1 })
  }, [writeState])

  // ── Word pick / guessing ─────────────────────────────────────────────────
  const pickWord = useCallback((w: string) => {
    const cur = stateRef.current
    if (!cur || cur.phase !== 'choosing') return
    writeState({ ...cur, word: w, phase: 'drawing', deadline: Date.now() + SK_TURN_MS, strokes: [], solved: {}, seq: cur.seq + 1 })
  }, [writeState])

  const sendGuess = useCallback(async () => {
    const cur = stateRef.current
    const text = guess.trim()
    if (!room || !cur || cur.phase !== 'drawing' || meDrawer || solvedMe || !text) return
    setGuess('')
    if (cur.word && normalizeGuess(text) === normalizeGuess(cur.word)) {
      sfx('etCorrect')
      await supabase.from('game_chats').insert({ room_id: room.id, sender_id: currentUserId, content: SOLVED_MARK })
    } else {
      await supabase.from('game_chats').insert({ room_id: room.id, sender_id: currentUserId, content: text })
    }
  }, [guess, room, meDrawer, solvedMe, supabase, currentUserId])

  // ── Lobby plumbing ───────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (room && (room.status === 'lobby' || room.status === 'finished')) deleteCurrentRoom()
    else leaveRoom()
    onClose()
  }, [room, deleteCurrentRoom, leaveRoom, onClose])

  const handleOpenInvite = useCallback(async () => {
    let target = room
    if (!target) target = await createRoom(MAX_PLAYERS)
    if (!target) return
    setShowInviteModal(true)
  }, [room, createRoom])

  const handleCreateAndInvite = useCallback(async (friendId: string) => {
    if (room && invitedIds.has(friendId)) {
      await cancelInvite(friendId, room.id)
      setInvitedIds(prev => { const n = new Set(prev); n.delete(friendId); return n })
      return
    }
    let target = room
    if (!target) target = await createRoom(MAX_PLAYERS)
    if (!target) return
    await inviteFriend(friendId, target.id)
    setInvitedIds(prev => new Set([...prev, friendId]))
  }, [room, invitedIds, createRoom, inviteFriend, cancelInvite])

  useEffect(() => {
    if (!room || !isHost) return
    if (room.status !== 'lobby' && room.status !== 'finished') return
    if (room.player_ids.length < 2) return
    if (!room.player_ids.every(id => room.ready_ids.includes(id))) return
    startGame(lang)
  }, [room, isHost, startGame, lang])

  const joinedCount = ids.length
  const readyCount = room ? room.ready_ids.filter(id => ids.includes(id)).length : 0
  const myReady = !!(room && room.ready_ids.includes(currentUserId))
  const pendingInviteCount = [...invitedIds].filter(id => !ids.includes(id)).length
  const canInviteMore = (id: string) =>
    invitedIds.has(id) || ((ids.length || 1) + pendingInviteCount < MAX_PLAYERS)

  const finishRef = useRef(false)
  useEffect(() => {
    if (room?.status !== 'finished') { finishRef.current = false; return }
    if (finishRef.current) return
    finishRef.current = true
    sfx(room.winner_id === currentUserId ? 'win' : room.winner_id ? 'loss' : 'draw')
  }, [room?.status, room?.winner_id, currentUserId])

  // ── Overlays ─────────────────────────────────────────────────────────────
  let overlay: React.ReactNode = null
  if (isFinished && room && st) {
    const rows = ids
      .map(id => ({ id, name: nameFor(id), score: st.scores[id] ?? 0 }))
      .sort((a, b) => b.score - a.score)
    const mark: 'win' | 'loss' | 'draw' = room.winner_id === currentUserId ? 'win' : room.winner_id ? 'loss' : 'draw'
    overlay = (
      <GameOverlayCard
        emoji={<GameResultMark result={mark} />}
        title={room.winner_id === currentUserId ? t('chess.youWon')
          : room.winner_id ? t('fb.playerWon', { name: nameFor(room.winner_id) })
          : t('chess.drawResult')}
      >
        <div className="fb-final-scores">
          {rows.map(row => (
            <div key={row.id} className={`fb-final-score-row${row.id === currentUserId ? ' me' : ''}`}>
              <span className="fb-final-score-name">{row.name}</span>
              <span className="fb-final-score-value">{row.score}</span>
            </div>
          ))}
        </div>
        <GameReadyControl ready={myReady} count={`${readyCount} / ${joinedCount} ready`} onToggle={toggleReady} />
      </GameOverlayCard>
    )
  } else if (isLobby && room) {
    overlay = (
      <GameOverlayCard emoji="✎" title={t('game.readyToPlay')}>
        <div className="sk-rules">{t('sk.rules')}</div>
        <GameReadyControl ready={myReady} count={`${readyCount} / ${joinedCount} ready`} onToggle={toggleReady} disabled={loading} />
        {isHost && (
          <button className="game-invite-btn" onClick={handleOpenInvite}
            disabled={loading || (ids.length + pendingInviteCount >= MAX_PLAYERS)}>
            {t('game.inviteFriends')}
          </button>
        )}
        {joinedCount < 2 && <div className="game-finish-readystate">{t('chess.waitingForFriend')}</div>}
        <div className="game-finish-readystate">{joinedCount} / {MAX_PLAYERS} joined</div>
      </GameOverlayCard>
    )
  } else if (!isPlaying && !isFinished && !room) {
    overlay = (
      <GameOverlayCard emoji="✎" title={t('game.sketch')}>
        <div className="sk-rules">{t('sk.rules')}</div>
        <button className="game-invite-btn" onClick={handleOpenInvite} disabled={loading}>
          {t('game.inviteFriends')}
        </button>
      </GameOverlayCard>
    )
  }

  const secsLeft = st?.deadline != null ? Math.max(0, Math.ceil((st.deadline - Date.now()) / 1000)) : null
  void tick

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <GameShell
      title={t('game.sketch')}
      onBack={handleBack}
      className="sketch-shell"
      fillBoard
      board={
        <div className="sk-layout">
          {st ? (
            <>
              <div className="sk-hud">
                {ids.map(id => (
                  <div key={id} className={`sk-chip${id === drawerId ? ' turn' : ''}`}>
                    <span className="sk-chip-name">{nameFor(id).slice(0, 8).toLowerCase()}</span>
                    <span className="sk-chip-stat">{st.scores[id] ?? 0}</span>
                    {st.solved[id] != null && <span className="sk-solved-mark">✓</span>}
                  </div>
                ))}
                <span className="sk-round">{t('y.round')} {Math.min(st.round, st.rounds)}/{st.rounds}</span>
              </div>

              <div className="sk-word-row">
                {st.phase === 'drawing' && st.word ? (
                  meDrawer
                    ? <span className="sk-word">{t('sk.yourWord')}: <b>{st.word}</b></span>
                    : solvedMe
                      ? <span className="sk-word solved"><b>{st.word}</b> ✓</span>
                      : <span className="sk-word blanks">{maskWord(st.word)} <i>({st.word.replace(/ /g, '').length})</i></span>
                ) : st.phase === 'choosing' ? (
                  <span className="sk-word">{meDrawer ? t('sk.choose') : t('sk.choosing', { name: nameFor(drawerId ?? '') })}</span>
                ) : st.phase === 'reveal' && st.word ? (
                  <span className="sk-word reveal">{t('sk.reveal')} <b>{st.word}</b></span>
                ) : <span className="sk-word" /> }
                {st.phase === 'drawing' && secsLeft != null && (
                  <span className={`sk-timer${secsLeft <= 10 ? ' low' : ''}`}>{secsLeft}</span>
                )}
              </div>

              <div className="sk-board-wrap">
                <svg
                  ref={boardRef}
                  className={`sk-board${meDrawer && st.phase === 'drawing' ? ' drawing' : ''}`}
                  viewBox={`0 0 ${SK_W} ${SK_H}`}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerLeave={onUp}
                >
                  {st.strokes.map((s, i) => (
                    <path key={i} d={strokePath(s.p)} stroke={s.c} strokeWidth={s.w}
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                  {liveStroke && (
                    <path d={strokePath(liveStroke.p)} stroke={liveStroke.c} strokeWidth={liveStroke.w}
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>

                {meDrawer && st.phase === 'choosing' && (
                  <div className="sk-choices">
                    {st.choices.map(w => (
                      <button key={w} className="game-invite-btn sk-choice" onClick={() => pickWord(w)}>{w}</button>
                    ))}
                  </div>
                )}
              </div>

              {meDrawer && st.phase === 'drawing' && (
                <div className="sk-tools">
                  {SK_COLORS.map(c => (
                    <button key={c} className={`sk-pen${penColor === c ? ' on' : ''}`}
                      style={{ background: c }} onClick={() => setPenColor(c)} aria-label={c} />
                  ))}
                  <button className="game-btn sk-tool-btn" onClick={undoStroke}>↺</button>
                  <button className="game-btn sk-tool-btn" onClick={clearStrokes}>✕</button>
                </div>
              )}

              {!meDrawer && st.phase === 'drawing' && (
                <div className="sk-guess-row">
                  <input
                    className="sk-guess-input"
                    value={guess}
                    disabled={solvedMe}
                    placeholder={solvedMe ? t('sk.gotIt') : t('sk.guessPh')}
                    onChange={e => setGuess(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendGuess() }}
                  />
                  <button className="game-invite-btn sk-guess-btn" onClick={sendGuess} disabled={solvedMe}>
                    {t('sk.guess')}
                  </button>
                </div>
              )}

              {stuck && (
                <button className="game-btn" onClick={() => advanceTurn(st)}>{t('sk.skip')}</button>
              )}
            </>
          ) : (
            <div className="game-transition-blank" />
          )}
        </div>
      }
      overlay={overlay}
      chat={
        <GameChat
          supabase={supabase}
          currentUserId={currentUserId}
          roomId={room?.id ?? null}
          names={Object.fromEntries([[currentUserId, currentUserProfile?.display_name ?? 'me'], ...friendProfiles.map(p => [p.id, p.display_name])])}
        />
      }
      invite={{
        open: showInviteModal,
        onClose: () => setShowInviteModal(false),
        friends: friendProfiles,
        invitedIds,
        onInvite: id => { handleCreateAndInvite(id) },
        canInvite: canInviteMore,
      }}
    />
  )
}
