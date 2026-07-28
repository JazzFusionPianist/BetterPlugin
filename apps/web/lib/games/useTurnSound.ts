import { useEffect, useRef } from 'react'

/**
 * Play a short two-note "your turn" chime whenever the rising edge of
 * `isMyTurn` (false → true) is observed.
 *
 * Works while the plugin window is closed because the host plugin keeps
 * the WKWebView running even after the editor is detached — JS, timers,
 * and WebAudio all keep ticking. The chime is emitted on the OS default
 * audio output (not the DAW's bus), so it reaches the user regardless
 * of whether the plugin window is visible.
 *
 * Honors the `gameTurn` flag in localStorage (`orb_notif_settings`)
 * so the user can mute this without code changes.
 */

type GameKind = 'chess' | 'poker'

/** Read the gameTurn flag without forcing a re-render. We re-check on
 *  every edge (cheap) instead of subscribing — settings changes are rare
 *  and we don't want to wire a context just for this. */
function isTurnSoundEnabled (): boolean {
  try {
    const raw = localStorage.getItem('orb_notif_settings') ?? localStorage.getItem('coop_notif_settings')
    if (!raw) return true                 // default ON
    const obj = JSON.parse(raw) as { gameTurn?: boolean }
    return obj.gameTurn !== false         // missing key → ON (back-compat)
  } catch {
    return true
  }
}

/** Singleton AudioContext (lazy). One context survives the whole session
 *  and is resumed on demand, which keeps Chrome/WebKit happy after the
 *  user has gestured at least once (they have — they clicked into the
 *  game room). */
let ctx: AudioContext | null = null
function getCtx (): AudioContext | null {
  if (ctx) return ctx
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

/** Two-tone chime — higher then lower note, ~280ms total. Soft attack +
 *  exponential release so it doesn't startle while the user is mixing. */
function playChime (kind: GameKind) {
  const ac = getCtx()
  if (!ac) return
  if (ac.state === 'suspended') ac.resume().catch(() => {})

  const now = ac.currentTime
  // Slightly different timbre per game so chess and poker are
  // distinguishable to a user who plays both at once.
  const baseFreq = kind === 'chess' ? 880 : 1046.5  // A5 vs C6
  const followFreq = kind === 'chess' ? 1318.5 : 1568 // E6 vs G6

  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
  gain.connect(ac.destination)

  const o1 = ac.createOscillator()
  o1.type = 'sine'
  o1.frequency.setValueAtTime(baseFreq, now)
  o1.connect(gain)
  o1.start(now)
  o1.stop(now + 0.30)

  const o2 = ac.createOscillator()
  o2.type = 'sine'
  o2.frequency.setValueAtTime(followFreq, now + 0.09)
  o2.connect(gain)
  o2.start(now + 0.09)
  o2.stop(now + 0.30)
}

/**
 * @param isMyTurn  derived flag from the game state ("am I the current player?")
 * @param kind      chess | poker — drives the chime pitch
 * @param active    whether the game is in a state where notifying makes
 *                  sense (e.g. room status === 'playing' / hand active).
 *                  When false we DON'T fire even on a rising edge — this
 *                  prevents a chime on initial game-start when the seat
 *                  is "you" before the user has even noticed the room.
 */
export function useTurnSound (
  isMyTurn: boolean,
  kind: GameKind,
  active: boolean = true,
) {
  const prev = useRef<boolean>(false)
  // Don't fire on the very first render (when the component mounts and
  // it's already your turn) — the user just opened the view, they don't
  // need to be alerted to what's already in front of them.
  const armed = useRef<boolean>(false)

  useEffect(() => {
    if (!armed.current) {
      armed.current = true
      prev.current = isMyTurn
      return
    }
    const rose = !prev.current && isMyTurn
    prev.current = isMyTurn
    if (!rose) return
    if (!active) return
    if (!isTurnSoundEnabled()) return
    playChime(kind)
  }, [isMyTurn, active, kind])
}
