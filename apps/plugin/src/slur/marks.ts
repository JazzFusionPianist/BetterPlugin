/* The Slur drawing kit — the house colours, the whole note, the engraved
   slur, the one-breath lettering and a small voice so a note sounds when
   it is touched. Shared by the landing, the door and the downloads page.
   Draft source: apps/web/design/ (and the Figma file "Slur Studio
   lettering + web drafts"). */

export const C = {
  blue: '#5C80FF', green: '#3FB872', orange: '#F89C38', lilac: '#B79CFF',
  rose: '#F27BA6', yellow: '#E9C46A', ink: '#1A1917', paper: '#F3F0E8', white: '#FBFAF7',
}

/* ── house colours for people and rooms ──
   Everyone signed up with the same default blue, so the colour comes
   from the id: six house colours, spread so neighbours differ. */
export const HOUSE = [C.blue, C.orange, C.lilac, C.green, C.rose, C.yellow]
export function houseColor (id: string): string {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  return HOUSE[(h >>> 0) % HOUSE.length]!
}

/** A tilted ellipse as a path, so a whole note's hole can be cut with evenodd. */
export function ellipsePath (cx: number, cy: number, rx: number, ry: number, deg: number) {
  const t = deg * Math.PI / 180, dx = rx * Math.cos(t), dy = rx * Math.sin(t)
  return `M ${cx - dx} ${cy - dy} A ${rx} ${ry} ${deg} 1 0 ${cx + dx} ${cy + dy} A ${rx} ${ry} ${deg} 1 0 ${cx - dx} ${cy - dy} Z`
}

/** A whole note: the head leans one way, the hole the other. */
export function wholeNotePath (cx: number, cy: number, s: number, hollow = true) {
  return ellipsePath(cx, cy, s, .7 * s, -22) + (hollow ? ' ' + ellipsePath(cx, cy, .42 * s, .52 * s, 38) : '')
}

/** An engraved slur: a lens, thick in the middle, a hair at the ends. */
export function slurPath (x0: number, y0: number, x1: number, y1: number, lift: number, thick: number) {
  const c1 = x0 + (x1 - x0) * .22, c2 = x0 + (x1 - x0) * .78
  const top = Math.min(y0, y1) - lift
  return `M ${x0} ${y0} C ${c1} ${top}, ${c2} ${top}, ${x1} ${y1} C ${c2} ${top + thick * 1.35}, ${c1} ${top + thick * 1.35}, ${x0} ${y0} Z`
}

/* ── the lettering ──
   "slur" in one line, no pen lift; the r's arm keeps going and comes back
   over the word as its own slur. Drawn in a 210 x 150 box (viewBox
   16 14 210 150). */
export const BREATH_WORD =
  'M 64 102 C 60 94, 44 92, 40 104 C 36 116, 52 119, 60 124 C 70 130, 70 146, 56 150 C 46 153, 38 149, 38 143 ' +
  'C 38 138, 46 138, 52 146 C 58 153, 74 150, 82 128 C 90 106, 96 66, 97 48 C 98 34, 90 30, 86 40 ' +
  'C 82 52, 84 100, 86 134 C 87 146, 92 151, 100 150 C 106 149, 110 140, 112 98 ' +
  'C 112 124, 113 151, 126 151 C 138 151, 141 132, 142 98 C 142 126, 142 144, 148 149 C 154 153, 162 152, 166 146 ' +
  'C 166 130, 166 112, 166 99 C 170 92, 180 90, 188 95'
export const BREATH_ARM = 'M 188 95 C 204 94, 222 70, 216 44 C 210 20, 172 13, 130 16 C 84 19, 48 32, 30 66'
export const BREATH_VIEWBOX = '16 14 210 150'

/** A broad nib held at 32°: the stroke is the path drawn again at every
    point along the nib's edge, so downstrokes swell and joins go to a hair. */
export function nibOffsets (width = 7.5, angle = 32, steps = 14): [number, number][] {
  const a = angle * Math.PI / 180, vx = Math.cos(a) * width, vy = -Math.sin(a) * width
  return Array.from({ length: steps + 1 }, (_, i) => { const t = i / steps - .5; return [t * vx, t * vy] })
}

/* ── the voice ── */
let ac: AudioContext | null = null
export function play (freq: number, when = 0, len = 1.6) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ac = ac || new Ctx()
    const t = ac.currentTime + when
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain(), f = ac.createBiquadFilter()
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 2.001
    f.type = 'lowpass'; f.frequency.value = 2400; g2.gain.value = .25
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + .012); g.gain.exponentialRampToValueAtTime(.0008, t + len)
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(ac.destination)
    o.start(t); o2.start(t); o.stop(t + len); o2.stop(t + len)
  } catch { /* no audio: the notes still move */ }
}

/** Treble staff: the bottom line (E4) is step 0, one step per line or space. */
const STEPS = [293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99]
export const hz = (step: number) => STEPS[step + 1] ?? 440
