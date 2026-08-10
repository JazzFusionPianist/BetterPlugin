'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/lib/games/types'
import { useOrbPartyRoom } from '@/lib/games/useOrbPartyRoom'
import {
  PARTY_BOARD, PARTY_W, PARTY_H, PARTY_ROUNDS, STAR_COST, PASS_START_PAY,
  MAX_ITEMS, ITEM_NAMES, pushLog, randomItem, randomEvent,
  nextStarNode, rollD6, partyWinner, botPickExit,
} from '@/lib/games/orbParty'
import type { PartyState, PartyItem } from '@/lib/games/orbParty'
import { useT } from '@/lib/games/i18n'
import { computerPlayerIds, computerPlayerName, isComputerPlayerId } from '@/lib/games/computerPlayers'
import GameShell, { GameOverlayCard, GameReadyControl, GameResultMark } from './GameShell'
import GameChat from './GameChat'

const MAX_PLAYERS = 4
const STEP_MS = 380

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  friendProfiles: Profile[]
  onlineIds: Set<string>
  onClose: () => void
}

const TILE_GLYPH: Record<string, string> = {
  event: '⚡', item: '✦', duel: '⚔',
}

export default function OrbPartyView({
  supabase,
  currentUserId,
  currentUserProfile,
  friendProfiles,
  onClose,
}: Props) {
  const { t } = useT()
  const {
    room, loading,
    createRoom, joinRoom, leaveRoom, deleteCurrentRoom, findActiveRoom,
    toggleReady, startGame, writeState, endGame, inviteFriend, cancelInvite,
  } = useOrbPartyRoom(supabase, currentUserId)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [computerOpponents, setComputerOpponents] = useState<1 | 2 | 3>(1)
  const [startPending, setStartPending] = useState(false)
  // Local render positions (animated). Keyed by uid → node id.
  const [drawPos, setDrawPos] = useState<Record<string, number>>({})
  const [walking, setWalking] = useState(false)
  const animRef = useRef<number | null>(null)
  const [diceFace, setDiceFace] = useState<number | null>(null)

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

  const st: PartyState | null =
    (isPlaying || isFinished) && room?.state && 'positions' in (room.state as object)
      ? room.state as PartyState
      : null

  const currentTurnId = st ? ids[st.turn] ?? null : null
  const myTurn = isPlaying && currentTurnId === currentUserId
  const curIsBot = !!currentTurnId && isComputerPlayerId(currentTurnId)
  const iDrive = myTurn || (isHost && curIsBot)     // this client executes the move

  const joinedCount = ids.length
  const readyCount = room ? room.ready_ids.filter(id => ids.includes(id)).length : 0
  const hasEnoughPlayers = joinedCount >= 2
  const myReady = !!(room && room.ready_ids.includes(currentUserId))
  const allReady = !!(room && hasEnoughPlayers && ids.every(id => room.ready_ids.includes(id)))
  const isComputerMatch = ids.some(isComputerPlayerId)

  const nameFor = useCallback((id: string): string => {
    if (id === currentUserId) return currentUserProfile?.display_name ?? 'me'
    if (isComputerPlayerId(id)) return computerPlayerName(id)
    return friendProfiles.find(p => p.id === id)?.display_name ?? 'player'
  }, [currentUserId, currentUserProfile, friendProfiles])

  const colorFor = useCallback((id: string): string => {
    if (id === currentUserId) return currentUserProfile?.avatar_color ?? '#2440FF'
    if (isComputerPlayerId(id)) return ['#8A8782', '#B08D57', '#7A9E9F'][ids.filter(isComputerPlayerId).indexOf(id) % 3]
    return friendProfiles.find(p => p.id === id)?.avatar_color ?? '#555'
  }, [currentUserId, currentUserProfile, friendProfiles, ids])

  // ── Remote animation: walk drawPos along st.trail on every new state ────
  const lastTrailRef = useRef<string>('')
  useEffect(() => {
    if (!st) { setDrawPos({}); return }
    const key = JSON.stringify([st.trail, st.positions])
    if (key === lastTrailRef.current) return
    lastTrailRef.current = key
    const mover = st.trail.length > 0 ? Object.keys(st.positions).find(
      id => st.positions[id] === st.trail[st.trail.length - 1]
    ) : null
    if (!st.trail.length || !mover) {
      setDrawPos({ ...st.positions })
      return
    }
    // animate the mover through the trail; everyone else snaps
    setWalking(true)
    let i = 0
    const base = { ...st.positions }
    const stepFn = () => {
      setDrawPos({ ...base, [mover]: st.trail[i] })
      i++
      if (i < st.trail.length) {
        animRef.current = window.setTimeout(stepFn, STEP_MS) as unknown as number
      } else {
        setWalking(false)
      }
    }
    stepFn()
    return () => {
      if (animRef.current) window.clearTimeout(animRef.current as unknown as number)
      setWalking(false)
    }
  }, [st])

  // ── The move executor (active client only) ──────────────────────────────
  // Walk one node at a time. Junction / star-buy pause and WRITE state so
  // everyone (including this client on refresh) resumes from the pause.
  const finishMove = useCallback((s: PartyState, landed: number): void => {
    const me = ids[s.turn]
    const node = PARTY_BOARD[landed]
    let next: PartyState = { ...s, positions: { ...s.positions, [me]: landed }, dice: null, stepsLeft: 0, pendingNode: null, phase: 'idle' }
    const name = nameFor(me)
    const coins = { ...next.coins }
    const stars = { ...next.stars }
    const items = { ...next.items }
    let log = next.log

    const give = (id: string, n: number) => { coins[id] = Math.max(0, (coins[id] ?? 0) + n) }

    switch (node.t) {
      case 'blue': give(me, 3); log = pushLog(log, `${name} +3`); break
      case 'red': give(me, -3); log = pushLog(log, `${name} −3`); break
      case 'item': {
        const it = randomItem()
        items[me] = [...(items[me] ?? []).slice(0, MAX_ITEMS - 1), it]
        log = pushLog(log, `${name} picked up ${ITEM_NAMES[it]}`)
        break
      }
      case 'duel': {
        const others = ids.filter(id => id !== me)
        if (others.length > 0) {
          const foe = others[Math.floor(Math.random() * others.length)]
          const a = rollD6(), b = rollD6()
          if (a !== b) {
            const [winner, loser] = a > b ? [me, foe] : [foe, me]
            const pot = Math.min(5, coins[loser] ?? 0)
            give(loser, -pot); give(winner, pot)
            log = pushLog(log, `duel ${a}:${b} — ${nameFor(winner)} takes ¢${pot}`)
          } else {
            log = pushLog(log, `duel ${a}:${b} — a draw`)
          }
        }
        break
      }
      case 'event': {
        const ev = randomEvent()
        switch (ev) {
          case 'windfall': give(me, 10); log = pushLog(log, `${name} found ¢10`); break
          case 'tax': give(me, -8); log = pushLog(log, `${name} taxed ¢8`); break
          case 'gift': {
            const it = randomItem()
            items[me] = [...(items[me] ?? []).slice(0, MAX_ITEMS - 1), it]
            log = pushLog(log, `${name} was gifted ${ITEM_NAMES[it]}`)
            break
          }
          case 'storm': {
            for (const id of ids) if (id !== me) give(id, -4)
            log = pushLog(log, `${name} called the storm — everyone else −4`)
            break
          }
          case 'warp': {
            const dest = Math.floor(Math.random() * PARTY_BOARD.length)
            next = { ...next, positions: { ...next.positions, [me]: dest } }
            log = pushLog(log, `${name} warped`)
            break
          }
          case 'starMoves': {
            next = { ...next, starNode: nextStarNode(next.starNode) }
            log = pushLog(log, 'the star moved')
            break
          }
          case 'swap': {
            const others = ids.filter(id => id !== me)
            if (others.length > 0) {
              const foe = others[Math.floor(Math.random() * others.length)]
              const p = { ...next.positions }
              const tmp = p[me]; p[me] = p[foe]; p[foe] = tmp
              next = { ...next, positions: p }
              log = pushLog(log, `${name} swapped places with ${nameFor(foe)}`)
            }
            break
          }
        }
        break
      }
      default: break
    }

    next = { ...next, coins, stars, items, log }

    // advance turn / round
    const nextTurn = (next.turn + 1) % ids.length
    const round = nextTurn === 0 ? next.round + 1 : next.round
    if (round > PARTY_ROUNDS) {
      endGame(partyWinner(next, ids), { ...next, phase: 'end' })
      return
    }
    writeState({ ...next, turn: nextTurn, round })
  }, [ids, nameFor, endGame, writeState])

  const walkFrom = useCallback((s: PartyState, from: number, steps: number, trail: number[]): void => {
    const me = ids[s.turn]
    let cur = from
    let left = steps
    let coins = { ...s.coins }
    let stars = { ...s.stars }
    let starNode = s.starNode
    let log = s.log
    const newTrail = trail.slice()
    while (left > 0) {
      const node = PARTY_BOARD[cur]
      if (node.next.length > 1) {
        // pause at the junction — the mover picks an exit
        writeState({
          ...s,
          coins, stars, starNode, log,
          positions: { ...s.positions, [me]: cur },
          stepsLeft: left,
          pendingNode: cur,
          phase: 'junction',
          trail: newTrail,
        })
        return
      }
      cur = node.next[0]
      newTrail.push(cur)
      left--
      // passing effects
      if (cur === 0 && left > 0) {
        coins = { ...coins, [me]: (coins[me] ?? 0) + PASS_START_PAY }
        log = pushLog(log, `${nameFor(me)} passed start +${PASS_START_PAY}`)
      }
      if (cur === starNode && (coins[me] ?? 0) >= STAR_COST && left > 0) {
        // pause on the star spot — buy or keep walking
        writeState({
          ...s,
          coins, stars, starNode, log,
          positions: { ...s.positions, [me]: cur },
          stepsLeft: left,
          pendingNode: cur,
          phase: 'buy',
          trail: newTrail,
        })
        return
      }
    }
    // landed — star spot landing also offers the buy
    if (cur === starNode && (coins[me] ?? 0) >= STAR_COST) {
      writeState({
        ...s,
        coins, stars, starNode, log,
        positions: { ...s.positions, [me]: cur },
        stepsLeft: 0,
        pendingNode: cur,
        phase: 'buy',
        trail: newTrail,
      })
      return
    }
    finishMove({ ...s, coins, stars, starNode, log, trail: newTrail }, cur)
  }, [ids, nameFor, writeState, finishMove])

  const doRoll = useCallback((item?: PartyItem) => {
    if (!st || !iDrive || st.phase !== 'idle' || walking) return
    const me = ids[st.turn]
    let s: PartyState = { ...st, trail: [] }
    let steps: number
    if (item === 'double') steps = rollD6() + rollD6()
    else if (item === 'pick') steps = 6
    else steps = rollD6()
    if (item) {
      s = { ...s, items: { ...s.items, [me]: (s.items[me] ?? []).filter((_, i, arr) => i !== arr.indexOf(item)) } }
      s = { ...s, log: pushLog(s.log, `${nameFor(me)} used ${ITEM_NAMES[item]}`) }
    }
    if (item === 'mirror') {
      const others = ids.filter(id => id !== me)
      if (others.length > 0) {
        const foe = others[Math.floor(Math.random() * others.length)]
        const p = { ...s.positions }
        const tmp = p[me]; p[me] = p[foe]; p[foe] = tmp
        s = { ...s, positions: p, log: pushLog(s.log, `${nameFor(me)} mirrored ${nameFor(foe)}`) }
      }
      steps = rollD6()
    }
    setDiceFace(steps)
    walkFrom({ ...s, dice: steps, stepsLeft: steps }, s.positions[me], steps, [])
  }, [st, iDrive, walking, ids, nameFor, walkFrom])

  const pickExit = useCallback((exit: number) => {
    if (!st || !iDrive || st.phase !== 'junction' || st.pendingNode == null) return
    const me = ids[st.turn]
    const s: PartyState = { ...st, phase: 'idle', pendingNode: null }
    const trail = [...st.trail, exit]
    let left = st.stepsLeft - 1
    let coins = s.coins
    let log = s.log
    if (exit === 0 && left > 0) {
      coins = { ...coins, [me]: (coins[me] ?? 0) + PASS_START_PAY }
      log = pushLog(log, `${nameFor(me)} passed start +${PASS_START_PAY}`)
    }
    const moved: PartyState = { ...s, coins, log, positions: { ...s.positions, [me]: exit } }
    if (left <= 0) {
      if (exit === s.starNode && (coins[me] ?? 0) >= STAR_COST) {
        writeState({ ...moved, stepsLeft: 0, pendingNode: exit, phase: 'buy', trail })
        return
      }
      finishMove({ ...moved, trail }, exit)
    } else {
      walkFrom({ ...moved, stepsLeft: left, trail }, exit, left, trail)
    }
  }, [st, iDrive, ids, nameFor, walkFrom, finishMove, writeState])

  const answerBuy = useCallback((buy: boolean) => {
    if (!st || !iDrive || st.phase !== 'buy' || st.pendingNode == null) return
    const me = ids[st.turn]
    let s: PartyState = { ...st, phase: 'idle', pendingNode: null }
    if (buy) {
      s = {
        ...s,
        coins: { ...s.coins, [me]: (s.coins[me] ?? 0) - STAR_COST },
        stars: { ...s.stars, [me]: (s.stars[me] ?? 0) + 1 },
        starNode: nextStarNode(s.starNode),
        log: pushLog(s.log, `★ ${nameFor(me)} bought a star`),
      }
    }
    if (s.stepsLeft > 0) {
      walkFrom(s, st.pendingNode, s.stepsLeft, s.trail)
    } else {
      finishMove(s, st.pendingNode)
    }
  }, [st, iDrive, ids, nameFor, walkFrom, finishMove])

  // ── Bot driver (host client) ─────────────────────────────────────────────
  useEffect(() => {
    if (!room || !isPlaying || !isHost || !st || walking) return
    const cur = ids[st.turn]
    if (!cur || !isComputerPlayerId(cur)) return
    const timer = window.setTimeout(() => {
      if (st.phase === 'idle') {
        const held = st.items[cur] ?? []
        const use = held.length >= MAX_ITEMS || (held.length > 0 && Math.random() < 0.35)
          ? held[0] : undefined
        doRoll(use)
      } else if (st.phase === 'junction' && st.pendingNode != null) {
        pickExit(botPickExit(st.pendingNode, st.starNode))
      } else if (st.phase === 'buy') {
        answerBuy(true)
      }
    }, 1100)
    return () => window.clearTimeout(timer)
  }, [room, isPlaying, isHost, st, walking, ids, doRoll, pickExit, answerBuy])

  // ── Lobby plumbing ───────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (room && (room.status === 'lobby' || room.status === 'finished')) deleteCurrentRoom()
    else leaveRoom()
    onClose()
  }, [room, deleteCurrentRoom, leaveRoom, onClose])

  const handleOpenInvite = useCallback(async () => {
    let target = room
    if (!target) target = await createRoom(MAX_PLAYERS as 2 | 3 | 4)
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
    if (!target) target = await createRoom(MAX_PLAYERS as 2 | 3 | 4)
    if (!target) return
    await inviteFriend(friendId, target.id)
    setInvitedIds(prev => new Set([...prev, friendId]))
  }, [room, invitedIds, createRoom, inviteFriend, cancelInvite])

  const handlePlayComputer = useCallback(async () => {
    setStartPending(true)
    try {
      const bots = computerPlayerIds(computerOpponents)
      const idsAll = [currentUserId, ...bots]
      let target = room
      if (!target) target = await createRoom(idsAll.length as 2 | 3 | 4)
      if (!target) { setStartPending(false); return }
      await startGame({
        ...target,
        player_count: idsAll.length as 2 | 3 | 4,
        player_ids: idsAll,
        ready_ids: idsAll,
        winner_id: null,
      })
    } catch (e) {
      console.error('[OrbPartyView.handlePlayComputer]', e)
      setStartPending(false)
    }
  }, [computerOpponents, currentUserId, room, createRoom, startGame])

  useEffect(() => { if (status === 'playing') setStartPending(false) }, [status])

  useEffect(() => {
    if (!room || !isHost) return
    if (room.status !== 'lobby' && room.status !== 'finished') return
    if (room.player_ids.length < 2) return
    if (!room.player_ids.every(id => room.ready_ids.includes(id))) return
    startGame()
  }, [room, isHost, startGame])

  const chatOpponentId = ids.length === 2 && !isComputerMatch
    ? ids.find(id => id !== currentUserId) ?? null : null

  const pendingInviteCount = [...invitedIds].filter(id => !ids.includes(id)).length
  const canInviteMore = (id: string) =>
    invitedIds.has(id) || ((ids.length || 1) + pendingInviteCount < MAX_PLAYERS)

  // ── Overlays ─────────────────────────────────────────────────────────────
  let overlay: React.ReactNode = null
  if (startPending) {
    overlay = null
  } else if (isFinished && room && st) {
    const rows = ids
      .map(id => ({ id, name: nameFor(id), stars: st.stars[id] ?? 0, coins: st.coins[id] ?? 0 }))
      .sort((a, b) => b.stars - a.stars || b.coins - a.coins)
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
              <span className="fb-final-score-value">★{row.stars}<span className="fb-final-score-diff">¢{row.coins}</span></span>
            </div>
          ))}
        </div>
        {isComputerMatch ? (
          <GameReadyControl ready={false} label={t('common.rematch')} onToggle={handlePlayComputer} />
        ) : (
          <GameReadyControl ready={myReady} count={`${readyCount} / ${joinedCount} ready`} onToggle={toggleReady} />
        )}
      </GameOverlayCard>
    )
  } else if (isLobby && room && !allReady) {
    overlay = (
      <GameOverlayCard emoji="🎲" title={t('game.readyToPlay')}>
        <GameReadyControl ready={myReady} count={`${readyCount} / ${joinedCount} ready`} onToggle={toggleReady} disabled={loading} />
        {isHost && (
          <button className="game-invite-btn" onClick={handleOpenInvite}
            disabled={loading || (ids.length + pendingInviteCount >= MAX_PLAYERS)}>
            {t('game.inviteFriends')}
          </button>
        )}
        {isHost && (
          <>
            <div className="game-computer-picker" aria-label={t('game.computerCount')}>
              {[1, 2, 3].map(n => (
                <button key={n} className={`game-computer-count${computerOpponents === n ? ' selected' : ''}`}
                  onClick={() => setComputerOpponents(n as 1 | 2 | 3)} type="button">1:{n}</button>
              ))}
            </div>
            <button className="game-invite-btn game-computer-btn" onClick={handlePlayComputer} disabled={loading}>
              {t('game.playComputer')}
            </button>
          </>
        )}
        {!hasEnoughPlayers && <div className="game-finish-readystate">{t('chess.waitingForFriend')}</div>}
        <div className="game-finish-readystate">{joinedCount} / {MAX_PLAYERS} joined</div>
      </GameOverlayCard>
    )
  } else if (!isPlaying && !isFinished && !room) {
    overlay = (
      <GameOverlayCard emoji="🎲" title={t('game.orbParty')}>
        <button className="game-invite-btn" onClick={handleOpenInvite} disabled={loading}>
          {t('game.inviteFriends')}
        </button>
        <div className="game-computer-picker" aria-label={t('game.computerCount')}>
          {[1, 2, 3].map(n => (
            <button key={n} className={`game-computer-count${computerOpponents === n ? ' selected' : ''}`}
              onClick={() => setComputerOpponents(n as 1 | 2 | 3)} type="button">1:{n}</button>
          ))}
        </div>
        <button className="game-invite-btn game-computer-btn" onClick={handlePlayComputer} disabled={loading}>
          {t('game.playComputer')}
        </button>
      </GameOverlayCard>
    )
  }

  // Buy prompt for ME (bots answer in the driver)
  const showBuy = !!st && st.phase === 'buy' && myTurn
  // Junction arrows for ME
  const junctionExits = st && st.phase === 'junction' && myTurn && st.pendingNode != null
    ? PARTY_BOARD[st.pendingNode].next
    : []

  const myItems = st?.items[currentUserId] ?? []

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <GameShell
      title={t('game.orbParty')}
      onBack={handleBack}
      className="party-shell"
      fillBoard
      board={
        <div className="party-layout">
          {st ? (
            <>
              {/* players HUD */}
              <div className="party-hud">
                {ids.map(id => (
                  <div key={id} className={`party-chip${id === currentTurnId ? ' turn' : ''}`}>
                    <span className="party-chip-orb" style={{ background: colorFor(id) }} />
                    <span className="party-chip-name">{nameFor(id).slice(0, 7).toLowerCase()}</span>
                    <span className="party-chip-stat">★{st.stars[id] ?? 0}</span>
                    <span className="party-chip-stat">¢{st.coins[id] ?? 0}</span>
                  </div>
                ))}
                <span className="party-round">{t('y.round')} {Math.min(st.round, PARTY_ROUNDS)}/{PARTY_ROUNDS}</span>
              </div>

              {/* board */}
              <div className="party-board-wrap">
                <svg className="party-board" viewBox={`0 0 ${PARTY_W} ${PARTY_H}`}>
                  {/* edges */}
                  {PARTY_BOARD.map((n, i) =>
                    n.next.map(j => (
                      <line key={`${i}-${j}`} x1={n.x} y1={n.y} x2={PARTY_BOARD[j].x} y2={PARTY_BOARD[j].y}
                        className="party-edge" />
                    ))
                  )}
                  {/* nodes */}
                  {PARTY_BOARD.map((n, i) => (
                    <g key={i} className={`party-node t-${n.t}${i === st.starNode ? ' star-here' : ''}`}>
                      <circle cx={n.x} cy={n.y} r={i === 0 ? 13 : 11} className="party-node-c" />
                      {i === 0 && <circle cx={n.x} cy={n.y} r={16.5} className="party-node-start-ring" />}
                      {i === st.starNode
                        ? <text x={n.x} y={n.y + 4.5} textAnchor="middle" className="party-node-star">★</text>
                        : TILE_GLYPH[n.t]
                          ? <text x={n.x} y={n.y + 4} textAnchor="middle" className="party-node-glyph">{TILE_GLYPH[n.t]}</text>
                          : null}
                    </g>
                  ))}
                  {/* junction arrows for me */}
                  {junctionExits.map(e => (
                    <g key={e} className="party-exit" onClick={() => pickExit(e)}>
                      <circle cx={PARTY_BOARD[e].x} cy={PARTY_BOARD[e].y} r={15} className="party-exit-halo" />
                      <text x={PARTY_BOARD[e].x} y={PARTY_BOARD[e].y - 18} textAnchor="middle" className="party-exit-mark">▾</text>
                    </g>
                  ))}
                  {/* player orbs */}
                  {ids.map((id, pi) => {
                    const node = PARTY_BOARD[drawPos[id] ?? st.positions[id] ?? 0]
                    const off = [[-7, -7], [7, -7], [-7, 7], [7, 7]][pi] ?? [0, 0]
                    return (
                      <g key={id} className="party-orb" style={{ transform: `translate(${node.x + off[0]}px, ${node.y + off[1]}px)` }}>
                        <circle r={6.5} fill={colorFor(id)} className={id === currentTurnId ? 'active' : ''} />
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* ticker */}
              <div className="party-ticker">
                {st.log.length > 0 ? st.log[st.log.length - 1] : ' '}
              </div>

              {/* controls */}
              <div className="party-controls">
                {myTurn && st.phase === 'idle' && !walking && (
                  <>
                    {myItems.map((it, i) => (
                      <button key={i} className="party-item-btn" onClick={() => doRoll(it)}>
                        {ITEM_NAMES[it]}
                      </button>
                    ))}
                    <button className="party-roll-btn" onClick={() => doRoll()}>
                      {t('y.roll')} {diceFace != null && st.dice == null ? '' : ''}
                    </button>
                  </>
                )}
                {myTurn && st.phase === 'junction' && (
                  <span className="party-hint">{t('op.pickPath')}</span>
                )}
                {showBuy && (
                  <div className="party-buy">
                    <span className="party-hint">★ ¢{STAR_COST}</span>
                    <button className="party-roll-btn" onClick={() => answerBuy(true)}>{t('op.buyStar')}</button>
                    <button className="party-item-btn" onClick={() => answerBuy(false)}>{t('op.pass')}</button>
                  </div>
                )}
                {!myTurn && isPlaying && (
                  <span className="party-hint">{t('y.turnOf', { name: nameFor(currentTurnId ?? '') })}</span>
                )}
              </div>
            </>
          ) : (
            <div className="game-transition-blank" />
          )}
        </div>
      }
      overlay={overlay}
      chat={!isComputerMatch ? (
        <GameChat
          supabase={supabase}
          currentUserId={currentUserId}
          roomId={room?.id ?? null}
          names={Object.fromEntries([[currentUserId, currentUserProfile?.display_name ?? 'me'], ...friendProfiles.map(p => [p.id, p.display_name])])}
          otherUserId={chatOpponentId}
          otherName={chatOpponentId ? nameFor(chatOpponentId) : undefined}
        />
      ) : undefined}
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
