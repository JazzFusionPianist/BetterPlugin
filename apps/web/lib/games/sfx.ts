'use client'

/**
 * Game sound effects — synthesized on a shared WebAudio context, no
 * assets. Every sound is a tiny recipe (tones, noise bursts, sweeps,
 * arpeggios) tuned quiet enough to live under studio monitoring.
 *
 * Honors the `gameSfx` flag in `orb_notif_settings` (default ON), the
 * same store the turn chime uses.
 */

let ctx: AudioContext | null = null
function getCtx(): AudioContext | null {
  if (ctx) return ctx
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    return ctx
  } catch { return null }
}

// ── Gesture unlock ──────────────────────────────────────────────────
// Autoplay policy: an AudioContext only runs after being created or
// resumed INSIDE a user gesture (iOS is strict about this). Our sounds
// fire from state effects — never gestures — so a one-time global
// listener wakes the context on the first tap/keypress and plays the
// canonical silent tick that unmutes iOS WebAudio for the session.
let unlocked = false
function tryUnlock() {
  if (unlocked) return
  const ac = getCtx()
  if (!ac) return
  ac.resume().catch(() => {})
  try {
    const b = ac.createBuffer(1, 1, 22050)
    const src = ac.createBufferSource()
    src.buffer = b
    src.connect(ac.destination)
    src.start(0)
  } catch { /* ignore */ }
  if (ac.state === 'running') {
    unlocked = true
    ;['pointerdown', 'touchend', 'keydown'].forEach((ev) =>
      window.removeEventListener(ev, tryUnlock))
  }
}
if (typeof window !== 'undefined') {
  ;['pointerdown', 'touchend', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, tryUnlock, { passive: true }))
}

function enabled(): boolean {
  try {
    const raw = localStorage.getItem('orb_notif_settings') ?? localStorage.getItem('coop_notif_settings')
    if (!raw) return true
    const obj = JSON.parse(raw) as { gameSfx?: boolean }
    return obj.gameSfx !== false
  } catch { return true }
}

/** One tone: sine/square/triangle with exponential decay. */
function tone(ac: AudioContext, at: number, freq: number, dur: number, vol: number,
  type: OscillatorType = 'sine', sweepTo?: number) {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), at + dur)
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(vol, at + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(ac.destination)
  o.start(at)
  o.stop(at + dur + 0.02)
}

/** Filtered noise burst — ticks, swishes, thumps' skin. */
function noise(ac: AudioContext, at: number, dur: number, vol: number,
  filterFreq = 2000, type: BiquadFilterType = 'bandpass') {
  const len = Math.max(1, Math.floor(ac.sampleRate * dur))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ac.createBufferSource()
  src.buffer = buf
  const f = ac.createBiquadFilter()
  f.type = type
  f.frequency.value = filterFreq
  const g = ac.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(ac.destination)
  src.start(at)
}

const RECIPES: Record<string, (ac: AudioContext, t: number) => void> = {
  // ── shared ──
  click:  (ac, t) => { tone(ac, t, 820, 0.05, 0.08); noise(ac, t, 0.02, 0.05, 3000) },
  win:    (ac, t) => [523, 659, 784, 1047].forEach((f, i) => tone(ac, t + i * 0.09, f, 0.22, 0.11)),
  loss:   (ac, t) => [440, 349, 294].forEach((f, i) => tone(ac, t + i * 0.11, f, 0.26, 0.1, 'triangle')),
  draw:   (ac, t) => { tone(ac, t, 494, 0.18, 0.09); tone(ac, t + 0.12, 494, 0.24, 0.08) },

  // ── chess ──
  chessMove:    (ac, t) => { noise(ac, t, 0.035, 0.14, 1100); tone(ac, t, 190, 0.06, 0.1, 'sine') },
  chessCapture: (ac, t) => { noise(ac, t, 0.05, 0.16, 700); tone(ac, t, 120, 0.1, 0.14) },
  chessCheck:   (ac, t) => { tone(ac, t, 880, 0.09, 0.09); tone(ac, t + 0.1, 988, 0.12, 0.09) },
  premove:      (ac, t) => tone(ac, t, 660, 0.05, 0.06),

  // ── poker ──
  cardDeal: (ac, t) => noise(ac, t, 0.07, 0.1, 4500, 'highpass'),
  chipBet:  (ac, t) => [0, 0.04, 0.09].forEach((d) =>
    tone(ac, t + d, 2200 + Math.random() * 700, 0.04, 0.07, 'triangle')),
  fold:     (ac, t) => noise(ac, t, 0.12, 0.07, 900, 'lowpass'),

  // ── falling blocks ──
  fbRotate: (ac, t) => tone(ac, t, 330, 0.04, 0.05, 'square'),
  fbHold:   (ac, t) => tone(ac, t, 520, 0.06, 0.06, 'triangle'),
  fbHard:   (ac, t) => { tone(ac, t, 95, 0.09, 0.16); noise(ac, t, 0.05, 0.1, 500, 'lowpass') },
  fbLine:   (ac, t) => [660, 880, 1100].forEach((f, i) => tone(ac, t + i * 0.05, f, 0.12, 0.09)),
  fbTetris: (ac, t) => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(ac, t + i * 0.05, f, 0.16, 0.1))
    noise(ac, t + 0.2, 0.2, 0.05, 6000, 'highpass')
  },
  fbOver:   (ac, t) => [392, 311, 233].forEach((f, i) => tone(ac, t + i * 0.12, f, 0.3, 0.1, 'triangle')),

  // ── pinball ──
  pinFlipper: (ac, t) => { noise(ac, t, 0.02, 0.09, 2500); tone(ac, t, 240, 0.03, 0.07) },
  pinBumper:  (ac, t) => tone(ac, t, 620 + Math.random() * 320, 0.09, 0.1, 'triangle'),
  pinLaunch:  (ac, t) => tone(ac, t, 180, 0.24, 0.11, 'sawtooth', 760),
  pinDrain:   (ac, t) => tone(ac, t, 420, 0.4, 0.1, 'sine', 70),

  // ── dice (yacht / party) ──
  diceRoll: (ac, t) => {
    for (let i = 0; i < 6; i++)
      noise(ac, t + i * 0.05 + Math.random() * 0.02, 0.03, 0.09, 1500 + Math.random() * 1500)
  },
  diceLock:   (ac, t) => tone(ac, t, 700, 0.05, 0.07),
  scoreWrite: (ac, t) => { noise(ac, t, 0.05, 0.08, 2600, 'highpass'); tone(ac, t + 0.05, 880, 0.06, 0.05) },

  // ── ear training ──
  etCorrect: (ac, t) => { tone(ac, t, 660, 0.12, 0.1); tone(ac, t + 0.1, 831, 0.2, 0.1) },
  etWrong:   (ac, t) => tone(ac, t, 110, 0.22, 0.1, 'square'),
}

export type SfxName = keyof typeof RECIPES

/** Fire a named effect. Safe everywhere: silently no-ops without audio,
 *  when muted, or on unknown names. */
export function sfx(name: SfxName) {
  if (!enabled()) return
  const ac = getCtx()
  if (!ac) return
  if (ac.state === 'suspended') ac.resume().catch(() => {})
  try { RECIPES[name]?.(ac, ac.currentTime) } catch { /* never break a game over a sound */ }
}
