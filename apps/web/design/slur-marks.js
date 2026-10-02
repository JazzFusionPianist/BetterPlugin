/* Slur Studio drafts: the drawing kit shared by the landing, downloads and
   logo sheet. Whole notes, an engraved slur, the mark, and a small voice so
   a note sounds when you touch it. */
const NS = 'http://www.w3.org/2000/svg'
const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent && parent.appendChild(n); return n }
const C = { blue: '#5C80FF', green: '#3FB872', orange: '#F89C38', lilac: '#B79CFF', rose: '#F27BA6', yellow: '#E9C46A', ink: '#1A1917', paper: '#F3F0E8', white: '#FBFAF7' }

/* A tilted ellipse as a path, so a whole note's hole can be cut with evenodd. */
function ellipsePath (cx, cy, rx, ry, deg) {
  const t = deg * Math.PI / 180, dx = rx * Math.cos(t), dy = rx * Math.sin(t)
  return `M ${cx - dx} ${cy - dy} A ${rx} ${ry} ${deg} 1 0 ${cx + dx} ${cy + dy} A ${rx} ${ry} ${deg} 1 0 ${cx - dx} ${cy - dy} Z`
}
/* A whole note: the head leans one way, the hole the other. */
function wholeNote (g, cx, cy, s, fill, hollow = true) {
  const d = ellipsePath(cx, cy, 1.0 * s, .7 * s, -22) + (hollow ? ' ' + ellipsePath(cx, cy, .42 * s, .52 * s, 38) : '')
  return el('path', { d, fill, 'fill-rule': 'evenodd' }, g)
}
/* An engraved slur: a lens, thick in the middle, a hair at the ends. */
function slur (g, x0, y0, x1, y1, lift, thick, fill) {
  const c1x = x0 + (x1 - x0) * .22, c2x = x0 + (x1 - x0) * .78
  const top = Math.min(y0, y1) - lift
  return el('path', { d: `M ${x0} ${y0} C ${c1x} ${top}, ${c2x} ${top}, ${x1} ${y1} C ${c2x} ${top + thick * 1.35}, ${c1x} ${top + thick * 1.35}, ${x0} ${y0} Z`, fill }, g)
}

/* The mark: two notes a third apart, tied. 40 x 26. */
function mark (svg, headA = C.blue, headB = C.orange, tie = C.ink) {
  svg.innerHTML = ''
  slur(svg, 5, 13, 33, 7, 7, 2.6, tie)
  wholeNote(svg, 9, 20, 6.2, headA, false)
  wholeNote(svg, 31, 14, 6.2, headB, false)
}
document.querySelectorAll('svg.mark').forEach(s => mark(s, s.dataset.a || C.blue, s.dataset.b || C.orange, s.dataset.tie || C.ink))

/* a soft pluck */
let ac
function play (freq, when = 0, len = 1.6) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)()
    const t = ac.currentTime + when
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain(), f = ac.createBiquadFilter()
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 2.001
    f.type = 'lowpass'; f.frequency.value = 2400; g2.gain.value = .25
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + .012); g.gain.exponentialRampToValueAtTime(.0008, t + len)
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(ac.destination)
    o.start(t); o2.start(t); o.stop(t + len); o2.stop(t + len)
  } catch (e) {}
}
/* treble staff: bottom line E4 is step 0, one step per line or space */
const STEPS = [293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99]
const hz = step => STEPS[step + 1] || 440

/* A bar: five hairlines, the notes, one slur over all of them.
   The slur draws in from the left; touching it plays the phrase. */
function bar (svg, W, H, { y0, gap, notes, s, lineOp = .28, animate = true, tie = C.ink }) {
  const lines = el('g', {}, svg)
  for (let i = 0; i < 5; i++) el('line', { x1: 0, x2: W, y1: y0 + i * gap, y2: y0 + i * gap, stroke: `rgba(26,25,23,${lineOp})`, 'stroke-width': 1 }, lines)
  const yOf = step => y0 + 4 * gap - step * gap / 2
  const pts = notes.map(n => ({ ...n, y: yOf(n.step) }))
  const first = pts[0], last = pts[pts.length - 1], hi = Math.min(...pts.map(p => p.y))
  const sg = el('g', { class: animate ? 'tie-in' : '', style: 'cursor:pointer' }, svg)
  slur(sg, first.x - s * .2, first.y - s * 1.05, last.x + s * .2, last.y - s * 1.05, (Math.max(first.y, last.y) - hi) + s * 1.1, s * .22, tie)
  sg.addEventListener('click', () => pts.forEach((p, i) => play(hz(p.step), i * .16, 1.4)))
  pts.forEach((p, i) => {
    const g = el('g', { class: 'note' + (animate ? ' note-in' : ''), style: animate ? `animation-delay:${.15 + i * .12}s` : '' }, svg)
    wholeNote(g, p.x, p.y, s, p.c, p.hollow !== false)
    g.addEventListener('click', () => { play(hz(p.step)); g.classList.remove('ring'); void g.getBBox(); g.classList.add('ring') })
  })
  return pts
}

/* the slur draws in from the left */
;(() => { const st = document.createElement('style'); st.textContent = '.tie-in { animation: tie-in 1.6s cubic-bezier(.5,0,.2,1) .35s both; } @keyframes tie-in { from { clip-path: inset(-20% 100% -20% 0); } to { clip-path: inset(-20% 0 -20% 0); } }'; document.head.appendChild(st) })()

/* The logo: a word tied by an engraved slur that starts on the s and lands
   on the last letter, clearing the l. Each product ties its name in its own
   colour. Returns the drawn width. */
function tieWord (svg, x, y, text, size, { tie = C.ink, ink = C.ink, weight = 600, span = null } = {}) {
  const t = el('text', { x, y, fill: ink, 'font-family': 'Instrument Sans', 'font-weight': weight, 'font-size': size, 'letter-spacing': -size * .045 }, svg)
  t.textContent = text
  const bb = t.getBBox()
  // span: tie only the first n letters (so "slur studio" ties just "slur")
  let x0 = bb.x + size * .1, x1 = bb.x + bb.width - size * .06
  if (span != null) {
    const probe = el('text', { x, y, 'font-family': 'Instrument Sans', 'font-weight': weight, 'font-size': size, 'letter-spacing': -size * .045, opacity: 0 }, svg)
    probe.textContent = text.slice(0, span)
    x1 = probe.getBBox().x + probe.getBBox().width - size * .06
    probe.remove()
  }
  // ends just above the x-height; the arc must clear every ascender, so it rises with the span
  slur(svg, x0, y - size * .6, x1, y - size * .6, Math.max(size * .62, (x1 - x0) * .13), size * .075, tie)
  return bb.width
}
/* A logo-mark svg sizes itself to its word. Draw again once a hidden one shows. */
function logoMark (s) {
  s.innerHTML = ''
  const size = +s.dataset.size || 20
  const w = tieWord(s, 1, size * 1.18, s.dataset.text || 'slur studio', size, { tie: s.dataset.tie || C.blue, ink: s.dataset.ink || C.ink, span: s.dataset.span ? +s.dataset.span : null })
  s.setAttribute('width', Math.ceil(w + 4)); s.setAttribute('viewBox', `0 0 ${Math.ceil(w + 4)} ${Math.ceil(size * 1.45)}`); s.setAttribute('height', Math.ceil(size * 1.45))
}
document.querySelectorAll('svg.logo-mark').forEach(logoMark)

/* A · one breath. The word in one line, no pen lift, drawn with a broad
   nib held at 32 degrees so the downstrokes swell and the joins go to a
   hair. The r's arm keeps going and comes back over the word as its slur. */
const BREATH = 'M 64 102 C 60 94, 44 92, 40 104 C 36 116, 52 119, 60 124 C 70 130, 70 146, 56 150 C 46 153, 38 149, 38 143 ' +
  'C 38 138, 46 138, 52 146 C 58 153, 74 150, 82 128 C 90 106, 96 66, 97 48 C 98 34, 90 30, 86 40 ' +
  'C 82 52, 84 100, 86 134 C 87 146, 92 151, 100 150 C 106 149, 110 140, 112 98 ' +
  'C 112 124, 113 151, 126 151 C 138 151, 141 132, 142 98 C 142 126, 142 144, 148 149 C 154 153, 162 152, 166 146 ' +
  'C 166 130, 166 112, 166 99 C 170 92, 180 90, 188 95 C 204 94, 222 70, 216 44 ' +
  'C 210 20, 172 13, 130 16 C 84 19, 48 32, 30 66'
function nib (g, d, color, width, angle = 32, steps = 14, hair = 1.3) {
  const a = angle * Math.PI / 180, vx = Math.cos(a) * width, vy = -Math.sin(a) * width
  const grp = el('g', { fill: 'none', stroke: color, 'stroke-width': hair, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g)
  for (let i = 0; i <= steps; i++) { const t = i / steps - .5; el('path', { d, transform: `translate(${t * vx} ${t * vy})` }, grp) }
  return grp
}
function letterA (g, { ink = C.ink, tie = null, width = 7.5 } = {}) {
  if (!tie) { nib(g, BREATH, ink, width); return }
  // the word in ink, the returning arm in the tie colour: split where the arm leaves the r
  const cut = BREATH.indexOf('C 204 94')
  nib(g, BREATH.slice(0, cut), ink, width)
  nib(g, 'M 188 95 ' + BREATH.slice(cut), tie, width)
}

/* The house mark: "slur" in one breath; with studio beside it when asked.
   <svg class="breath" data-h="30" data-tie="#5C80FF" data-ink="#1A1917"> */
function breathMark (s) {
  s.innerHTML = ''
  const h = +s.dataset.h || 30, ink = s.dataset.ink || C.ink, tie = s.dataset.tie || null
  // the drawing spans x 22..224, y 12..156 in its own box
  s.setAttribute('viewBox', '20 10 206 148'); s.setAttribute('height', h); s.setAttribute('width', Math.round(h * 206 / 148))
  letterA(el('g', {}, s), { ink, tie, width: +s.dataset.nib || 7.5 })
}
document.querySelectorAll('svg.breath').forEach(breathMark)
