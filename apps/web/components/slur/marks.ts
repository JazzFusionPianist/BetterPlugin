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
/* "studio" in the same hand, for Slur Studio (the daw): the s, t and u in one
   line, the d and i in a second, the o, the t's bar and the i's dot. Drawn in
   the word's own box; set 200 to the right of "slur" the two make one name
   (viewBox 16 14 506 150). Draft: Daw/design/logo draft 1. */
export const BREATH_STUDIO = [
  'M 64 102 C 60 94, 44 92, 40 104 C 36 116, 52 119, 60 124 C 70 130, 70 146, 56 150 C 46 153, 38 149, 38 143 C 38 138, 46 138, 52 146 ' +
  'C 58 153, 74 150, 82 130 C 88 112, 92 84, 93 68 C 91 92, 91 120, 92 136 C 93 147, 98 151, 106 150 C 112 149, 116 140, 118 98 ' +
  'C 118 124, 119 151, 132 151 C 144 151, 147 132, 148 98 C 148 126, 148 144, 154 149 C 160 153, 170 150, 176 138',
  'M 203 106 C 198 95, 180 96, 177 120 C 175 142, 188 154, 198 142 C 204 132, 206 80, 206 44 C 206 80, 205 120, 206 136 C 207 147, 212 151, 219 150 C 225 149, 229 140, 231 98 C 231 120, 231 140, 235 148 C 239 153, 249 150, 256 134',
  'M 276 101 C 263 95, 255 112, 257 130 C 259 148, 277 154, 287 140 C 295 128, 291 104, 276 101 C 284 107, 296 105, 303 97',
  'M 79 99 L 108 96',
  'M 232 73 L 232 80',
]
export const BREATH_STUDIO_VIEWBOX = '16 14 506 150'

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

/* Patch on Slur's families, each by its plate's silhouette (drawn in a
   48 x 48 box around 0,0) — shared by the downloads page and the gallery. */
export const FAMILIES: { name: string; members: string; c: string; shape: string }[] = [
  { name: 'tone', members: 'cut amp tone tape glue comp air', c: '#ECE2C8', shape: 'M -18 -18 H 18 V 18 H -18 Z' },
  { name: 'grit', members: 'crush radio ring', c: '#F27BA6', shape: 'M -10 -18 H 18 V 10 L 10 18 H -18 V -10 Z' },
  { name: 'space', members: 'delay space shimmer doubler stereo', c: '#7896FF', shape: 'M -18 0 A 18 18 0 1 0 18 0 A 18 18 0 1 0 -18 0 Z' },
  { name: 'motion', members: 'mod tremolo swell stutter gate wow', c: '#DC78C8', shape: 'M -12 -18 H 22 L 12 18 H -22 Z' },
  { name: 'pitch', members: 'pitch formant harmony arp grain', c: '#5CE0A8', shape: 'M 0 -21 L 21 0 L 0 21 L -21 0 Z' },
  { name: 'utility', members: 'gain mix l/r m/s bands side', c: '#FBFAF7', shape: 'M -18 -2 H 18 V 2 H -18 Z M -2 -18 H 2 V 18 H -2 Z' },
  { name: 'control', members: 'lfo macro follow', c: '#F89C38', shape: 'M -18 0 A 18 18 0 1 0 18 0 A 18 18 0 1 0 -18 0 Z M -9 0 A 9 9 0 1 1 9 0 A 9 9 0 1 1 -9 0 Z' },
  { name: 'spectral', members: 'carve match vocode', c: '#B79CFF', shape: 'M -18 -18 H -12 V 18 H -18 Z M -7 -10 H -1 V 18 H -7 Z M 4 -18 H 10 V 18 H 4 Z M 14 -4 H 20 V 18 H 14 Z' },
]

/* Slur Studio's regions, each cut by what plays in it (drawn in a 120 x 44
   box) and in its instrument's pigment, as the program draws them; the
   words are some of the track names it reads the instrument from. */
export const OUTLINES: { name: string; members: string; c: string; deep: string; shape: string }[] = [
  { name: 'drums', members: 'kick snare hat tom room', c: '#2C62AC', deep: '#000326', shape: 'M0 0H120V44H0Z' },
  { name: 'bass', members: 'bass sub 808', c: '#744898', deep: '#10001E', shape: 'M0 0H120V37A7 7 0 0 1 113 44H7A7 7 0 0 1 0 37Z' },
  { name: 'keys', members: 'piano rhodes synth pad', c: '#2B8767', deep: '#001004', shape: 'M0 0H114V7H120V44H0Z' },
  { name: 'guitar', members: 'gtr acoustic strat', c: '#BD7929', deep: '#2F0F00', shape: 'M0 0H111L120 9V44H0Z' },
  { name: 'voice', members: 'vox bgv ad libs', c: '#DD6C63', deep: '#400707', shape: 'M0 7A7 7 0 0 1 7 0H113A7 7 0 0 1 120 7V44H0Z' },
  { name: 'effects', members: 'riser impact air', c: '#D2C8B1', deep: '#322D22', shape: 'M0 5A5 5 0 0 0 5 0H115A5 5 0 0 0 120 5V39A5 5 0 0 0 115 44H5A5 5 0 0 0 0 39Z' },
]
