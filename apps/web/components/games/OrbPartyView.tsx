'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/lib/games/types'
import { useOrbPartyRoom } from '@/lib/games/useOrbPartyRoom'
import {
  PARTY_BOARD, PARTY_W, PARTY_H, PARTY_ROUNDS, STAR_COST, PASS_START_PAY,
  MAX_ITEMS, ITEM_NAMES, pushLog, randomItem, randomEvent,
  nextStarNode, rollD6, partyWinner, botPickExit, stepsToStar,
} from '@/lib/games/orbParty'
import type { PartyState, PartyItem } from '@/lib/games/orbParty'
import { useT } from '@/lib/games/i18n'
import { computerPlayerIds, computerPlayerName, isComputerPlayerId } from '@/lib/games/computerPlayers'
import GameShell, { GameOverlayCard, GameReadyControl, GameResultMark } from './GameShell'
import { sfx } from '@/lib/games/sfx'
import GameChat from './GameChat'

const MAX_PLAYERS = 4
const STEP_MS = 560

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

// 3×3 pip grid per die face
const PIP_AT: Record<number, number[]> = {
  1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
}

function DieFace({ v }: { v: number }) {
  return (
    <span className="party-die">
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={PIP_AT[v]?.includes(i) ? 'on' : ''} />
      ))}
    </span>
  )
}

// Which cube rotation brings face v to the front (opposite faces sum to 7).
const FACE_ROT: Record<number, string> = {
  1: '', 2: 'rotateY(-90deg)', 3: 'rotateX(-90deg)',
  4: 'rotateX(90deg)', 5: 'rotateY(90deg)', 6: 'rotateY(180deg)',
}

const PAWN_BODY = 'M9 7.2 C10.7 9.6 11.7 12.7 12 16.1 L13.5 17.3 C14.3 18 14.8 19 14.8 20 L14.8 21 C14.8 21.7 14.2 22.3 13.5 22.3 L4.5 22.3 C3.8 22.3 3.2 21.7 3.2 21 L3.2 20 C3.2 19 3.7 18 4.5 17.3 L6 16.1 C6.3 12.7 7.3 9.6 9 7.2 Z'

/** Two crossed planes = a pawn with volume from any camera angle. */
function Pawn({ color, active }: { color: string; active?: boolean }) {
  const art = (cls: string) => (
    <svg className={`party-pawn ${cls}${active ? ' active' : ''}`} viewBox="0 0 18 24">
      <defs>
        <linearGradient id="pawnlite" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="1" stopColor="#101010" stopOpacity="0.24" />
        </linearGradient>
      </defs>
      <path d={PAWN_BODY} fill={color} />
      <circle cx="9" cy="4.9" r="3.7" fill={color} />
      <g fill="url(#pawnlite)">
        <path d={PAWN_BODY} />
        <circle cx="9" cy="4.9" r="3.7" />
      </g>
    </svg>
  )
  return <>{art('pp-front')}{art('pp-side')}</>
}

function DieCube({ v, phase }: { v: number; phase: 'tumble' | 'settle' }) {
  const shown = Math.min(6, Math.max(1, v))
  return (
    <span
      className={`party-die3d ${phase}`}
      style={phase === 'settle'
        ? { transform: `rotateX(-16deg) rotateY(12deg) ${FACE_ROT[shown]}` }
        : undefined}
    >
      {[1, 2, 3, 4, 5, 6].map(f => (
        <span key={f} className={`pd3f pd3-${f}`}><DieFace v={f} /></span>
      ))}
    </span>
  )
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
  const [walkInfo, setWalkInfo] = useState<{ id: string; left: number } | null>(null)
  const animRef = useRef<number | null>(null)
  const drawPosRef = useRef<Record<string, number>>({})
  useEffect(() => { drawPosRef.current = drawPos }, [drawPos])
  // ── presentation: dice tumble, floating text, event cards ──
  const [dieShow, setDieShow] = useState<{ value: number; phase: 'tumble' | 'settle'; seq: number } | null>(null)
  const [floats, setFloats] = useState<{ x: number; y: number; text: string; tone: string; key: number }[]>([])
  const [card, setCard] = useState<{ title: string; sub: string; key: number } | null>(null)
  const seqRef = useRef({ primed: false, roll: 0, fx: 0, card: 0 })
  // Delayed fx timers survive state re-writes; cleared only on unmount.
  const fxTimersRef = useRef<number[]>([])
  useEffect(() => () => { fxTimersRef.current.forEach(id => window.clearTimeout(id)) }, [])

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

  const partyFinishRef = useRef(false)
  useEffect(() => {
    if (room?.status !== 'finished') { partyFinishRef.current = false; return }
    if (partyFinishRef.current) return
    partyFinishRef.current = true
    sfx(room.winner_id === currentUserId ? 'win' : room.winner_id ? 'loss' : 'draw')
  }, [room?.status, room?.winner_id, currentUserId])
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

  // ── Presentation watchers ────────────────────────────────────────────────
  // Prime seq counters on (re)entry so a resumed game doesn't replay stale fx.
  useEffect(() => {
    if (!st) { seqRef.current.primed = false; return }
    if (!seqRef.current.primed) {
      seqRef.current = {
        primed: true,
        roll: st.lastRoll?.seq ?? 0,
        fx: st.lastFx?.seq ?? 0,
        card: st.lastCard?.seq ?? 0,
      }
    }
  }, [st])

  // Dice tumble — same path for local and remote rolls.
  useEffect(() => {
    const r = st?.lastRoll
    if (!r || !r.value || r.seq === seqRef.current.roll) return
    seqRef.current.roll = r.seq
    sfx('diceRoll')
    const seq = r.seq
    setDieShow({ value: r.value, phase: 'tumble', seq })
    fxTimersRef.current.push(window.setTimeout(
      () => setDieShow(s => (s && s.seq === seq ? { ...s, phase: 'settle' } : s)), 700))
    fxTimersRef.current.push(window.setTimeout(
      () => setDieShow(s => (s && s.seq === seq ? null : s)), 2000))
  }, [st?.lastRoll])

  // Floating text at the landing node — held back until the walk lands.
  useEffect(() => {
    const f = st?.lastFx
    if (!f || !f.text || f.seq === seqRef.current.fx) return
    seqRef.current.fx = f.seq
    const delay = Math.max(0, (st?.trail?.length ?? 0) - 1) * STEP_MS
    const n = PARTY_BOARD[f.node] ?? PARTY_BOARD[0]
    const item = { x: n.x, y: n.y, text: f.text, tone: f.tone, key: f.seq }
    fxTimersRef.current.push(window.setTimeout(() => {
      setFloats(cur => [...cur.slice(-2), item])
      fxTimersRef.current.push(window.setTimeout(
        () => setFloats(cur => cur.filter(i => i.key !== item.key)), 1500))
    }, delay))
  }, [st?.lastFx, st?.trail])

  // Event / duel / star card — flips over the board after the walk lands.
  useEffect(() => {
    const c = st?.lastCard
    if (!c || !c.title || c.seq === seqRef.current.card) return
    seqRef.current.card = c.seq
    const delay = Math.max(0, (st?.trail?.length ?? 0) - 1) * STEP_MS + 180
    fxTimersRef.current.push(window.setTimeout(() => {
      setCard({ title: c.title, sub: c.sub, key: c.seq })
      fxTimersRef.current.push(window.setTimeout(
        () => setCard(cur => (cur?.key === c.seq ? null : cur)), 2400))
    }, delay))
  }, [st?.lastCard, st?.trail])

  // ── Remote animation: walk drawPos along st.trail on every new state ────
  const lastTrailRef = useRef<string>('')
  useEffect(() => {
    if (!st) { setDrawPos({}); return }
    const key = JSON.stringify([st.trail, st.positions])
    if (key === lastTrailRef.current) return
    lastTrailRef.current = key
    const mover = st.trail.length > 0
      ? (st.trailBy || Object.keys(st.positions).find(
          id => st.positions[id] === st.trail[st.trail.length - 1]
        ) || null)
      : null
    if (!st.trail.length || !mover) {
      setDrawPos({ ...st.positions })
      setWalkInfo(null)
      return
    }
    // Resume from wherever the pawn is drawn — a junction pick extends the
    // trail and must NOT replay the walk from the beginning.
    const drawnAt = drawPosRef.current[mover]
    const resumeAt = drawnAt != null ? st.trail.indexOf(drawnAt) : -1
    let i = resumeAt >= 0 ? resumeAt + 1 : 0
    if (i >= st.trail.length) {
      setDrawPos({ ...st.positions })
      return
    }
    // animate the mover through the trail; everyone else snaps
    setWalking(true)
    const base = { ...st.positions }
    const pending = st.stepsLeft ?? 0
    const stepFn = () => {
      setDrawPos({ ...base, [mover]: st.trail[i] })
      setWalkInfo({ id: mover, left: (st.trail.length - 1 - i) + pending })
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
    let fx: NonNullable<PartyState['lastFx']> | undefined
    let card: NonNullable<PartyState['lastCard']> | undefined
    const fxSeq = (s.lastFx?.seq ?? 0) + 1
    const cardSeq = (s.lastCard?.seq ?? 0) + 1

    const give = (id: string, n: number) => { coins[id] = Math.max(0, (coins[id] ?? 0) + n) }

    switch (node.t) {
      case 'blue':
        give(me, 3); log = pushLog(log, `${name} +3`)
        fx = { node: landed, text: '+3', tone: 'good', seq: fxSeq }
        break
      case 'red':
        give(me, -3); log = pushLog(log, `${name} −3`)
        fx = { node: landed, text: '−3', tone: 'bad', seq: fxSeq }
        break
      case 'item': {
        const it = randomItem()
        items[me] = [...(items[me] ?? []).slice(0, MAX_ITEMS - 1), it]
        log = pushLog(log, `${name} picked up ${ITEM_NAMES[it]}`)
        fx = { node: landed, text: `✦ ${ITEM_NAMES[it]}`, tone: 'good', seq: fxSeq }
        card = { title: '✦ an item', sub: `${name} pockets the ${ITEM_NAMES[it]}`, seq: cardSeq }
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
            card = { title: `⚔ duel ${a} : ${b}`, sub: `${nameFor(winner)} takes ¢${pot} from ${nameFor(loser)}`, seq: cardSeq }
          } else {
            log = pushLog(log, `duel ${a}:${b} — a draw`)
            card = { title: `⚔ duel ${a} : ${b}`, sub: 'dead even — nobody pays', seq: cardSeq }
          }
        }
        break
      }
      case 'event': {
        const ev = randomEvent()
        fx = { node: landed, text: '⚡', tone: 'info', seq: fxSeq }
        switch (ev) {
          case 'windfall':
            give(me, 10); log = pushLog(log, `${name} found ¢10`)
            card = { title: '⚡ windfall', sub: `${name} finds ¢10 on the road`, seq: cardSeq }
            break
          case 'tax':
            give(me, -8); log = pushLog(log, `${name} taxed ¢8`)
            card = { title: '⚡ the tax man', sub: `${name} pays ¢8, no receipts`, seq: cardSeq }
            break
          case 'gift': {
            const it = randomItem()
            items[me] = [...(items[me] ?? []).slice(0, MAX_ITEMS - 1), it]
            log = pushLog(log, `${name} was gifted ${ITEM_NAMES[it]}`)
            card = { title: '⚡ a gift', sub: `${name} receives the ${ITEM_NAMES[it]}`, seq: cardSeq }
            break
          }
          case 'storm': {
            for (const id of ids) if (id !== me) give(id, -4)
            log = pushLog(log, `${name} called the storm — everyone else −4`)
            card = { title: '⚡ the storm', sub: 'everyone else loses ¢4', seq: cardSeq }
            break
          }
          case 'warp': {
            const dest = Math.floor(Math.random() * PARTY_BOARD.length)
            next = { ...next, positions: { ...next.positions, [me]: dest } }
            log = pushLog(log, `${name} warped`)
            card = { title: '⚡ warp', sub: `${name} is somewhere else entirely`, seq: cardSeq }
            break
          }
          case 'starMoves': {
            next = { ...next, starNode: nextStarNode(next.starNode) }
            log = pushLog(log, 'the star moved')
            card = { title: '⚡ the star moves', sub: 'look at the board again', seq: cardSeq }
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
              card = { title: '⚡ trading places', sub: `${name} ⇄ ${nameFor(foe)}`, seq: cardSeq }
            }
            break
          }
        }
        break
      }
      default: break
    }

    next = { ...next, coins, stars, items, log }
    if (fx) next = { ...next, lastFx: fx }
    if (card) next = { ...next, lastCard: card }

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
    let s: PartyState = { ...st, trail: [], trailBy: me }
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
    s = { ...s, lastRoll: { by: me, value: steps, seq: (st.lastRoll?.seq ?? 0) + 1 } }
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
        lastFx: { node: st.pendingNode, text: '★', tone: 'good', seq: (s.lastFx?.seq ?? 0) + 1 },
        lastCard: { title: '★ a star', sub: `${nameFor(me)} — and the star moves on`, seq: (s.lastCard?.seq ?? 0) + 1 },
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
    }, 2200)
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

  // ── 3D camera: the view follows whoever is moving ────────────────────────
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const [sceneDims, setSceneDims] = useState({ w: 360, h: 420 })
  const hasBoard = !!st
  useEffect(() => {
    const el = sceneRef.current
    if (!el) return
    const measure = () => setSceneDims({ w: el.clientWidth || 360, h: el.clientHeight || 420 })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [hasBoard])

  const [overview, setOverview] = useState(false)
  const camPaused = st?.phase === 'junction' || st?.phase === 'buy'
  const focusAt = st && currentTurnId ? (drawPos[currentTurnId] ?? st.positions[currentTurnId] ?? 0) : 0
  const camT = !st || overview
    ? { x: PARTY_W / 2, y: PARTY_H / 2 }
    : { x: PARTY_BOARD[focusAt].x, y: PARTY_BOARD[focusAt].y }
  const fitZ = Math.min(sceneDims.w / (PARTY_W + 28), sceneDims.h / (PARTY_H + 28))
  const followZ = Math.max(fitZ * 1.7, Math.min(sceneDims.w, sceneDims.h) / 235)
  const camZ = !st || overview ? fitZ : camPaused ? Math.max(fitZ * 1.2, followZ * 0.6) : followZ
  const tilt = overview ? 16 : 52
  const worldTransform = `translate3d(${sceneDims.w / 2 - camT.x * camZ}px, ${sceneDims.h * (overview ? 0.5 : 0.58) - camT.y * camZ}px, 0) scale(${camZ})`

  // ── How-to-play card: auto-opens once per fresh game, ? chip reopens ─────
  const [rulesOpen, setRulesOpen] = useState(false)
  const rulesShownRef = useRef<string | null>(null)
  useEffect(() => {
    if (!room || !isPlaying || !st) return
    if (rulesShownRef.current === room.id) return
    const fresh = st.round === 1 && st.dice == null && st.trail.length === 0
      && ids.every(id => (st.positions[id] ?? 0) === 0)
    if (fresh) { rulesShownRef.current = room.id; setRulesOpen(true) }
  }, [room, isPlaying, st, ids])

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
        <div className="party-rules">{t('op.rules')}</div>
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
        <div className="party-rules">{t('op.rules')}</div>
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
      className={`party-shell${isComputerMatch ? ' no-chat-shell' : ''}`}
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
                <button type="button" className="party-help-chip" onClick={() => setRulesOpen(true)} aria-label={t('op.howto')}>?</button>
              </div>

              {/* board — 3D scene, the camera follows whoever is moving */}
              <div className="party-board-wrap">
                <div
                  ref={sceneRef}
                  className="party-scene"
                  style={{ '--pt-stand': `${-tilt}deg` } as CSSProperties}
                >
                  <div className="party-tilt" style={{ transform: `rotateX(${tilt}deg)` }}>
                    <div
                      className="party-world"
                      style={{
                        transform: worldTransform,
                        transitionDuration: walking ? '0.58s' : '0.9s',
                        transitionTimingFunction: walking ? 'linear' : 'cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    >
                      <div className="party-table" />
                      <svg className="party-floor-svg" width={PARTY_W} height={PARTY_H} viewBox={`0 0 ${PARTY_W} ${PARTY_H}`}>
                        {/* edges */}
                        {PARTY_BOARD.map((n, i) =>
                          n.next.map(j => (
                            <line key={`${i}-${j}`} x1={n.x} y1={n.y} x2={PARTY_BOARD[j].x} y2={PARTY_BOARD[j].y}
                              className="party-edge" />
                          ))
                        )}
                        {/* tiles */}
                        {PARTY_BOARD.map((n, i) => {
                          const tip = i === st.starNode ? `★ ¢${STAR_COST}`
                            : n.t === 'blue' ? '+¢3' : n.t === 'red' ? '−¢3'
                            : n.t === 'event' ? `⚡ ${t('op.lgEvent')}` : n.t === 'item' ? `✦ ${t('op.lgItem')}`
                            : n.t === 'duel' ? `⚔ ${t('op.lgDuel')}` : t('op.lgStart')
                          return (
                            <g key={i} className={`party-node t-${n.t}${i === st.starNode ? ' star-here' : ''}`}>
                              <title>{tip}</title>
                              <circle cx={n.x} cy={n.y} r={i === 0 ? 13 : 11} className="party-node-c" />
                              {i === 0 && <circle cx={n.x} cy={n.y} r={16.5} className="party-node-start-ring" />}
                              {i === st.starNode && <circle cx={n.x} cy={n.y} r={16} className="party-star-ring" />}
                              {i !== st.starNode && TILE_GLYPH[n.t]
                                ? <text x={n.x} y={n.y + 4} textAnchor="middle" className="party-node-glyph">{TILE_GLYPH[n.t]}</text>
                                : null}
                            </g>
                          )
                        })}
                        {/* flat halos under pickable exits */}
                        {junctionExits.map(e => (
                          <circle key={e} cx={PARTY_BOARD[e].x} cy={PARTY_BOARD[e].y} r={15} className="party-exit-halo" />
                        ))}
                        {/* whose-turn ring */}
                        {currentTurnId && (() => {
                          const n = PARTY_BOARD[drawPos[currentTurnId] ?? st.positions[currentTurnId] ?? 0]
                          return <circle cx={n.x} cy={n.y} r={17.5} className="party-here" />
                        })()}
                      </svg>

                      {/* the star, standing on its tile */}
                      <div className="party-star3d" style={{ left: PARTY_BOARD[st.starNode].x, top: PARTY_BOARD[st.starNode].y - 8 }}>★</div>

                      {/* junction choices — standing signposts with tiles-to-star */}
                      {junctionExits.map(e => {
                        const dists = junctionExits.map(x => stepsToStar(x, st.starNode))
                        const d = stepsToStar(e, st.starNode)
                        return (
                          <button
                            key={e} type="button"
                            className={`party-exit3d${d === Math.min(...dists) ? ' best' : ''}`}
                            style={{ left: PARTY_BOARD[e].x, top: PARTY_BOARD[e].y }}
                            onClick={() => pickExit(e)}
                          >
                            <span className="party-exit3d-arrow">▾</span>
                            <small>★ {d}</small>
                          </button>
                        )
                      })}

                      {/* piece ground shadows (flat on the board) */}
                      {ids.map((id, pi) => {
                        const at = drawPos[id] ?? st.positions[id] ?? 0
                        const node = PARTY_BOARD[at]
                        const off = [[-7, -7], [7, -7], [-7, 7], [7, 7]][pi] ?? [0, 0]
                        return <span key={id} className="party-piece-shadow" style={{ left: node.x + off[0], top: node.y + off[1] }} />
                      })}
                      {/* player pieces — standing pawns; inner div remounts per node to replay the hop */}
                      {ids.map((id, pi) => {
                        const at = drawPos[id] ?? st.positions[id] ?? 0
                        const node = PARTY_BOARD[at]
                        const off = [[-7, -7], [7, -7], [-7, 7], [7, 7]][pi] ?? [0, 0]
                        return (
                          <div key={id} className="party-piece" style={{ left: node.x + off[0], top: node.y + off[1] }}>
                            <div key={`hop-${at}`} className="party-piece-hop">
                              <Pawn color={colorFor(id)} active={id === currentTurnId} />
                            </div>
                          </div>
                        )
                      })}
                      {/* steps-left counter above the walking pawn */}
                      {walkInfo && walkInfo.left > 0 && (() => {
                        const n = PARTY_BOARD[drawPos[walkInfo.id] ?? 0]
                        return <div className="party-steps3d" style={{ left: n.x, top: n.y - 18 }}>{walkInfo.left}</div>
                      })()}

                      {/* floating landing text (standing) */}
                      {floats.map(f => (
                        <div key={f.key} className={`party-float3d ${f.tone}`} style={{ left: f.x, top: f.y - 4 }}>
                          <span>{f.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button type="button" className="party-view-toggle" onClick={() => setOverview(o => !o)}>
                    {overview ? t('op.follow') : t('op.map')}
                  </button>
                </div>

                {dieShow && (
                  <div className={`party-dice-fx ${dieShow.phase}`}>
                    {dieShow.value > 6
                      ? <><DieCube v={Math.ceil(dieShow.value / 2)} phase={dieShow.phase} /><DieCube v={Math.floor(dieShow.value / 2)} phase={dieShow.phase} /></>
                      : <DieCube v={dieShow.value} phase={dieShow.phase} />}
                  </div>
                )}

                {card && (
                  <div key={card.key} className="party-card">
                    <div className="party-card-title">{card.title}</div>
                    <div className="party-card-sub">{card.sub}</div>
                  </div>
                )}

                {rulesOpen && (
                  <div className="party-rules-card" onClick={() => setRulesOpen(false)}>
                    <div className="party-rules-inner" onClick={e => e.stopPropagation()}>
                      <div className="party-rules-title">🎲 {t('op.howto')}</div>
                      <div className="party-rules-row"><span className="prr-g">★</span>{t('op.goal')}</div>
                      <div className="party-rules-row"><span className="prr-g">¢</span>{t('op.coinsRule')}</div>
                      <div className="party-rules-row"><span className="prr-g">✦</span>{t('op.itemsRule')}</div>
                      <div className="party-rules-row"><span className="prr-g">⚡</span>{t('op.tilesRule')}</div>
                      <button type="button" className="party-roll-btn" onClick={() => setRulesOpen(false)}>{t('op.gotIt')}</button>
                    </div>
                  </div>
                )}
              </div>

              {/* ticker */}
              <div className="party-ticker">
                {st.log.length > 0 ? st.log[st.log.length - 1] : ' '}
              </div>

              {/* tile legend */}
              <div className="party-legend">
                <span><i className="pl-dot blue" />+¢3</span>
                <span><i className="pl-dot red" />−¢3</span>
                <span className="pl-g event">⚡ {t('op.lgEvent')}</span>
                <span className="pl-g item">✦ {t('op.lgItem')}</span>
                <span className="pl-g duel">⚔ {t('op.lgDuel')}</span>
                <span className="pl-g star">★ ¢{STAR_COST}</span>
                <span className="pl-g start">◎ {t('op.lgStart')}</span>
              </div>

              {/* controls */}
              <div className="party-controls">
                {myTurn && st.phase === 'idle' && !walking && (
                  <>
                    {myItems.map((it, i) => (
                      <button key={i} className="party-item-btn" onClick={() => doRoll(it)}>
                        <span>{ITEM_NAMES[it]}</span>
                        <small>{t(it === 'double' ? 'op.itDouble' : it === 'pick' ? 'op.itPick' : 'op.itMirror')}</small>
                      </button>
                    ))}
                    <button className="party-roll-btn" onClick={() => doRoll()}>
                      {t('y.roll')}
                    </button>
                  </>
                )}
                {myTurn && st.phase === 'junction' && (
                  <span className="party-hint">{t('op.pathHint')}</span>
                )}
                {showBuy && (
                  <div className="party-buy">
                    <span className="party-hint">★ ¢{STAR_COST} — {t('op.buyWhy')}</span>
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
