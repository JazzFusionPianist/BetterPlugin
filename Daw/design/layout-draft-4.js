/* ── the drawing kit for draft 4: black paper, white ink. Everything is an SVG string ── */
const W = 1440, H = 900
/* the darks, from the deepest (the lanes) up to a thing under the hand; the ink */
let K0 = '#0E0E0E', K1 = '#151514', K2 = '#1B1B1A', K3 = '#262625', K4 = '#32322F', INK = '#ECEAE4', LIGHT = false
/* what a colour means: recording, solo and the cycle, listening to the input, slur */
let REC = '#DE4F3C', SOLO = '#D8B24A', MON = '#D68A3E', SLUR = '#5C80FF', LEVEL = '#ECEAE4'
/* the prints' own colours (never changed) */
const CREAM = '#ECE2C8', SPACE = '#7896FF', MINT = '#5CE0A8', AMBER = '#FFA848'
const FONT = "'Instrument Sans', 'Pretendard Variable', 'Apple SD Gothic Neo', system-ui, sans-serif"
let UID = 0

const cv = document.createElement('canvas').getContext('2d')
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const n = v => +(+v).toFixed(2)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
function tw (s, size = 10, w = 400, it = false) { cv.font = `${it ? 'italic ' : ''}${w} ${size}px ${FONT}`; return cv.measureText(s).width }
function T (x, y, s, o = {}) {
  const { size = 10, w = 400, c = INK, a = 1, anchor = 'start', it = false } = o
  const wd = anchor === 'start' ? 0 : tw(s, size, w, it)
  const xx = anchor === 'middle' ? x - wd / 2 : anchor === 'end' ? x - wd : x
  return `<text x="${n(xx)}" y="${n(y)}" font-family="${FONT}" font-size="${size}" font-weight="${w}"${it ? ' font-style="italic"' : ''} fill="${c}"${a < 1 ? ` fill-opacity="${a}"` : ''}>${esc(s)}</text>`
}
const fit = (s, maxW, size = 10, w = 400, it = false) => { if (tw(s, size, w, it) <= maxW) return s; let k = s.length; while (k > 1 && tw(s.slice(0, k).trimEnd() + '…', size, w, it) > maxW) k--; return s.slice(0, k).trimEnd() + '…' }
function run (x, y, parts, gap = 0) {
  let out = '', cx = x
  for (const [s, o] of parts) { out += T(cx, y, s, o); cx += tw(s, o.size, o.w, o.it) + gap }
  return [out, cx - gap]
}
const R = (x, y, w, h, o = {}) => {
  const { rx = 0, fill = 'none', fa = 1, stroke, sa = 1, sw = 1, dash, x: extra = '' } = o
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, w))}" height="${n(Math.max(0, h))}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"${fill !== 'none' && fa < 1 ? ` fill-opacity="${n(fa)}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${sw}"${sa < 1 ? ` stroke-opacity="${n(sa)}"` : ''}` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${extra}/>`
}
const P = (d, o = {}) => {
  const { fill = 'none', fa = 1, stroke, sa = 1, sw = 1, dash, cap, rule, x: extra = '' } = o
  return `<path d="${d}" fill="${fill}"${fill !== 'none' && fa < 1 ? ` fill-opacity="${n(fa)}"` : ''}${rule ? ` fill-rule="${rule}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${sw}"${sa < 1 ? ` stroke-opacity="${n(sa)}"` : ''}` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${cap ? ` stroke-linecap="${cap}" stroke-linejoin="${cap}"` : ''}${extra}/>`
}
const Cc = (cx, cy, r, o = {}) => {
  const { fill = 'none', fa = 1, stroke, sa = 1, sw = 1, dash, x: extra = '' } = o
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${fill !== 'none' && fa < 1 ? ` fill-opacity="${n(fa)}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${sw}"${sa < 1 ? ` stroke-opacity="${n(sa)}"` : ''}` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${extra}/>`
}
const G = (inner, tr, extra = '') => `<g${tr ? ` transform="${tr}"` : ''}${extra}>${inner}</g>`
const hit = (x, y, w, h, a) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#000" fill-opacity="0" data-a="${a}" style="cursor:pointer"/>`
const hline = (x0, x1, y, a = .08) => P(`M${n(x0)} ${n(y) + .5}H${n(x1)}`, { stroke: INK, sa: a })
const vline = (x, y0, y1, a = .08) => P(`M${n(x) + .5} ${n(y0)}V${n(y1)}`, { stroke: INK, sa: a })
const caret = (x, y, a = .5) => P(`M${n(x - 2.5)} ${n(y - 1.2)}L${n(x)} ${n(y + 1.6)}L${n(x + 2.5)} ${n(y - 1.2)}`, { stroke: INK, sa: a, sw: 1, cap: 'round' })

/* colour by lightness, strength and hue (oklch), so every track colour weighs the same */
function oklch (L, C, h) {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180)
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s]
  const f = v => { v = clamp(v, 0, 1); return v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - .055 }
  return '#' + lin.map(v => Math.round(f(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}

/* one outlined frame cut into cells; the chosen cell filled. An item: {t, k (a key's letter), on, c, w} */
function cells (x, y, h, items, o = {}) {
  const { size = 9.5, pad = 9, widths, frame = .24, a = .62 } = o
  let cx = x, out = '', div = ''
  const ws = items.map((it, i) => widths ? widths[i] : Math.round(tw(it.t || '', size, 500) + pad * 2 + (it.k ? tw(it.k, size - 1.5) + 7 : 0)))
  const total = ws.reduce((p, q) => p + q, 0), id = 'cl' + (++UID)
  items.forEach((it, i) => {
    const w = ws[i]
    if (it.on) out += R(cx, y, w, h, { fill: it.c || INK })
    const ty = y + h / 2 + size * .35
    if (it.t) {
      if (it.k) { out += T(cx + pad, ty, it.t, { size, w: it.on ? 500 : 400, c: it.on ? K1 : INK, a: it.on ? 1 : a }) + T(cx + w - pad, ty - .2, it.k, { size: size - 1.5, c: it.on ? K1 : INK, a: it.on ? .55 : .34, anchor: 'end' }) }
      else out += T(cx + w / 2, ty, it.t, { size, w: it.on ? 500 : 400, c: it.on ? K1 : INK, a: it.on ? 1 : (it.dim ? .22 : a), anchor: 'middle' })
    }
    if (it.g) out += it.g(cx + w / 2, y + h / 2, it.on ? K1 : (it.gc || INK), it.on ? 1 : (it.ga || .78))
    if (i) div += `M${n(cx) + .5} ${y + 1}V${y + h - 1}`
    if (it.hit && HITS) out += hit(cx, y, w, h, it.hit)
    cx += w
  })
  return [`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${total}" height="${h}" rx="2"/></clipPath>` + G(out, '', ` clip-path="url(#${id})"`) + P(div, { stroke: INK, sa: frame * .7 }) + R(x + .5, y + .5, total - 1, h - 1, { rx: 2, stroke: INK, sa: frame }), total]
}
/* a key by itself */
const keyW = (t, size = 9.5, pad = 9) => Math.round(tw(t, size) + pad * 2)
const key = (x, y, t, o = {}) => { const { h = 18, size = 9.5, pad = 9, a = .78 } = o, w = keyW(t, size, pad); return [R(x + .5, y + .5, w - 1, h - 1, { rx: 2, stroke: INK, sa: .24 }) + T(x + pad, y + h / 2 + size * .35, t, { size, a }), w] }
/* a key that opens a list: what is chosen, and a small mark that it opens */
function menuKey (x, y, word, o = {}) {
  const { h = 18, size = 9.5 } = o, w = Math.round(tw(word, size) + 26)
  return [R(x + .5, y + .5, w - 1, h - 1, { rx: 2, stroke: INK, sa: .2 }) + T(x + 8, y + h / 2 + size * .35, word, { size, a: .88 }) + caret(x + w - 9.5, y + h / 2, .45), w]
}
/* a word and its value, side by side */
function field (x, y, label, v, o = {}) {
  const { size = 9.5, a = .9 } = o
  const lw = tw(label, size)
  return [T(x, y, label, { size, a: .4 }) + T(x + lw + 5, y, v, { size, a }), lw + 5 + tw(v, size)]
}

/* the prints: Patch on Slur's plates, as the landing draws them (not to be redrawn) */
function plate (kind, cx, cy, r) {
  const K = r / 44
  let s = ''
  if (kind === 'tape') {
    s += R(-r, -r, 2 * r, 2 * r, { rx: 2, fill: '#786E5A', fa: .55 })
    let d = ''
    const rr = r * .78
    for (let y = -rr + 1.2; y < rr; y += 3.4 * K) { const hw = Math.sqrt(rr * rr - y * y); d += `M${n(-hw)} ${n(y)}H${n(hw)}` }
    s += P(d, { stroke: CREAM, sa: .95, sw: n(.9 * K) })
  } else if (kind === 'space') {
    s += Cc(0, 0, r, { fill: '#283278', fa: .85 })
    for (let i = 1; i <= 4; i++) s += Cc(0, 0, r * (.1 + i * .12), { stroke: SPACE, sa: n((1 - i * .15) * .95), sw: n(.9 * K) })
    s += Cc(0, 0, 2 * K, { fill: SPACE })
  } else if (kind === 'delay') {
    s += Cc(0, 0, r, { fill: '#284646', fa: .85 })
    for (let i = 0; i < 7; i++) s += R(-r * .55 + i * r * .17, -r * .35 + i * 2 * K, 1.6 * K, r * .7 - i * 4 * K, { fill: MINT, fa: n(1 - i * .12) })
  } else if (kind === 'mix') {
    s += Cc(0, 0, r, { fill: '#3C3228', fa: .7, stroke: SPACE, sa: .9, sw: n(1.4 * K), dash: `${n(r * 3.9)} ${n(r * 2.4)}` })
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .38; s += P(`M0 ${n(r * .35)}L${n(Math.cos(a) * r * .8)} ${n(r * .35 + Math.sin(a) * r * .9)}`, { stroke: AMBER, sa: .95, sw: n(.9 * K) }) }
    for (let i = 1; i <= 3; i++) s += Cc(0, r * .35, r * .22 * i, { stroke: AMBER, sa: .7, sw: n(.8 * K) })
  }
  return G(s, `translate(${n(cx)} ${n(cy)})`)
}
/* slur's mark: the word written in one breath, its arm coming back over it */
const BW = 'M 64 102 C 60 94, 44 92, 40 104 C 36 116, 52 119, 60 124 C 70 130, 70 146, 56 150 C 46 153, 38 149, 38 143 C 38 138, 46 138, 52 146 C 58 153, 74 150, 82 128 C 90 106, 96 66, 97 48 C 98 34, 90 30, 86 40 C 82 52, 84 100, 86 134 C 87 146, 92 151, 100 150 C 106 149, 110 140, 112 98 C 112 124, 113 151, 126 151 C 138 151, 141 132, 142 98 C 142 126, 142 144, 148 149 C 154 153, 162 152, 166 146 C 166 130, 166 112, 166 99 C 170 92, 180 90, 188 95'
const BA = 'M 188 95 C 204 94, 222 70, 216 44 C 210 20, 172 13, 130 16 C 84 19, 48 32, 30 66'
function mark (x, y, h, word = INK, arm = SLUR) {
  const k = h / 150, a = 32 * Math.PI / 180, vx = Math.cos(a) * 7.5, vy = -Math.sin(a) * 7.5, steps = 8
  let w = '', r = ''
  for (let i = 0; i <= steps; i++) {
    const t = i / steps - .5, tr = `translate(${n(t * vx)} ${n(t * vy)})`
    w += `<path d="${BW}" transform="${tr}"/>`; r += `<path d="${BA}" transform="${tr}"/>`
  }
  return G(G(w, '', ` fill="none" stroke="${word}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`) + G(r, '', ` fill="none" stroke="${arm}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`), `translate(${n(x - 16 * k)} ${n(y - 14 * k)}) scale(${n(k)})`)
}
const slurPath = (x0, y0, x1, y1, lift, thick) => {
  const c1 = x0 + (x1 - x0) * .22, c2 = x0 + (x1 - x0) * .78, top = Math.min(y0, y1) - lift
  return `M ${x0} ${y0} C ${n(c1)} ${n(top)}, ${n(c2)} ${n(top)}, ${x1} ${y1} C ${n(c2)} ${n(top + thick * 1.35)}, ${n(c1)} ${n(top + thick * 1.35)}, ${x0} ${y0} Z`
}
/* slur daw — layout draft 4: black paper, white ink.
   The room is quiet: neutral darks, hairlines, one family of type; colour is kept for what plays (a track's own pigment,
   drawn in its sound), for what a state means (recording, solo, listening), and for the prints. One function draws the
   window for any state: the bottom panel open (0..1) on 'patch' or 'mixer', slur open (0..1). */
let HITS = false, REG = 'solid', SLUR_PAPER = false, PL = .64, PC = .07, BL = .52, BC = .055
const TEMPO = 92, SPBAR = 240 / TEMPO
const fmtDb = v => v <= -47.5 ? '−∞' : (v > 0 ? '+' : '') + v.toFixed(1).replace('-', '−')
const volF = db => db <= -47.5 ? 0 : db <= -24 ? (db + 48) / 24 * .25 : .25 + (db + 24) / 30 * .75
const panText = p => Math.abs(p) < .005 ? 'c' : (p < 0 ? '−' : '+') + Math.round(Math.abs(p) * 64)

/* ── the session: a song of 120 bars, thirty rows ── */
const SCENES = [['intro', 1], ['verse 1', 9], ['pre', 25], ['chorus', 33], ['verse 2', 49], ['pre 2', 65], ['chorus 2', 73], ['bridge', 89], ['chorus 3', 97], ['outro', 113]].map(([name, a], i, all) => ({ i, name, a, b: i + 1 < all.length ? all[i + 1][1] : 121 }))
const END = 121
const HUES = { drums: 250, bass: 302, keys: 168, gtr: 80, vox: 27, fx: 212 }
const pig = (g, L = .74, C = .085) => HUES[g] == null ? oklch(L, .004, 90) : oklch(L, C, HUES[g])
const KICK = [[9, 25], [25, 33], [33, 49], [49, 65], [65, 73], [73, 89], [97, 113], [113, 117]]
const SNARE = [[17, 25], [25, 33], [33, 49], [49, 65], [65, 73], [73, 89], [97, 113], [113, 117]]
const FILLS = [[24, 25], [32, 33], [48, 49], [64, 65], [72, 73], [88, 89], [96, 97], [112, 113]]
const BASS = [[9, 25], [25, 33], [33, 49], [49, 65], [65, 73], [73, 89], [89, 97], [97, 113], [113, 121]]
const CH = [[33, 36.5], [37, 40.5], [41, 44.5], [45, 48.5]], shift = (list, d) => list.map(([a, b, nm]) => [a + d, b + d, nm])
const LEAD = [[9, 12.5], [13, 16.5], [17, 20.5], [21, 24.5], [25, 28.5], [29, 32.75]].concat(CH, shift([[9, 12.5], [13, 16.5], [17, 20.5], [21, 24.5], [25, 28.5], [29, 32.75]], 40), shift(CH, 40), [[89, 92.5], [93, 96.5]], shift(CH, 64), [[113, 116.5]])
const BGV = [[29, 32.75], [33, 40.5], [41, 48.5], [69, 72.75], [73, 80.5], [81, 88.5], [93, 96.5], [97, 104.5], [105, 112.5]]
const TRACKS = [
  { name: 'drums', kind: 'stack', g: 'drums', vol: -2, pan: 0, m: .74, out: 'stereo out', ins: ['compressor'], patch: ['tape'], sends: [['crush', -8]] },
  { name: 'kick in', g: 'drums', child: 1, w: 'kick', vol: -3.5, pan: 0, m: .7, regs: KICK, ins: ['channel eq', 'noise gate'] },
  { name: 'kick out', g: 'drums', child: 1, w: 'kick', vol: -6, pan: 0, m: .55, regs: KICK, ins: ['channel eq'] },
  { name: 'sn top', g: 'drums', child: 1, w: 'snare', vol: -4, pan: .05, m: .62, regs: SNARE, ins: ['channel eq', 'compressor'], sends: [['plate', -14]] },
  { name: 'sn btm', g: 'drums', child: 1, w: 'snare', vol: -9, pan: .05, m: .4, regs: SNARE, ins: ['channel eq'] },
  { name: 'hat', g: 'drums', child: 1, w: 'hat', vol: -11, pan: .3, m: .34, regs: [[5, 9], [9, 25], [25, 33], [33, 49], [49, 65], [65, 73], [73, 89], [89, 97], [97, 113]] },
  { name: 'tom 1', g: 'drums', child: 1, w: 'tom', vol: -7, pan: -.35, m: 0, regs: FILLS, ins: ['noise gate'] },
  { name: 'tom 2', g: 'drums', child: 1, w: 'tom', vol: -7, pan: .35, m: 0, regs: FILLS, ins: ['noise gate'] },
  { name: 'oh', g: 'drums', child: 1, w: 'oh', vol: -8.5, pan: 0, m: .46, regs: [[9, 33], [33, 49], [49, 73], [73, 89], [97, 117]], ins: ['channel eq'] },
  { name: 'room', g: 'drums', child: 1, w: 'room', vol: -12, pan: 0, m: 0, mute: true, regs: [[33, 49], [73, 89], [97, 113]], ins: ['compressor'] },
  { name: 'bass di', g: 'bass', who: 'jun', w: 'bass', vol: -5, pan: 0, m: .6, regs: BASS, ins: ['channel eq', 'compressor'], patch: ['tape'] },
  { name: 'bass amp', g: 'bass', who: 'jun', w: 'bass', vol: -8, pan: 0, m: .48, regs: BASS, ins: ['channel eq'] },
  { name: 'rhodes', g: 'keys', midi: 1, vol: -9.5, pan: -.2, m: 0, regs: [[1, 9], [9, 25], [49, 65], [89, 97], [113, 121]], patch: ['tape', 'space'], sends: [['plate', -16]] },
  { name: 'piano', g: 'keys', w: 'piano', vol: -8, pan: .15, m: .5, regs: [[25, 33], [33, 49], [65, 73], [73, 89], [97, 113]], ins: ['channel eq'], sends: [['plate', -18]] },
  { name: 'pad', g: 'keys', midi: 2, vol: -14, pan: 0, m: .3, regs: [[1, 9], [25, 33], [33, 49], [65, 73], [73, 89], [89, 97], [97, 113], [113, 121]], patch: ['space'] },
  { name: 'guitars', kind: 'stack', g: 'gtr', vol: -3, pan: 0, m: .6, out: 'stereo out', ins: ['compressor'] },
  { name: 'gtr l', g: 'gtr', child: 1, who: 'jun', w: 'gtr', vol: -7, pan: -.8, m: .5, regs: [[33, 49], [73, 89], [97, 113]], ins: ['amp'] },
  { name: 'gtr r', g: 'gtr', child: 1, who: 'jun', w: 'gtr', vol: -7, pan: .8, m: .52, regs: [[33, 49], [49, 65], [73, 89], [97, 113]], ins: ['amp'] },
  { name: 'gtr lead', g: 'gtr', child: 1, who: 'jun', w: 'lead', vol: -9, pan: .1, m: .44, regs: [[41, 49], [81, 89], [89, 97, 'take 3'], [105, 113]], ins: ['amp'], patch: ['space', 'delay'], sends: [['slap', -10]] },
  { name: 'vocals', kind: 'stack', g: 'vox', vol: -1.5, pan: 0, m: .66, out: 'stereo out', ins: ['compressor', 'de-esser'] },
  { name: 'lead vox', g: 'vox', child: 1, w: 'vox', vol: -4, pan: 0, m: .62, arm: true, mon: true, regs: LEAD, ins: ['channel eq', 'compressor'], patch: ['tape', 'space', 'delay'], sends: [['plate', -12]] },
  { name: 'vox dbl', g: 'vox', child: 1, w: 'vox', vol: -10, pan: 0, m: .4, regs: CH.concat(shift(CH, 40), shift(CH, 64)), ins: ['channel eq'] },
  { name: 'bgv hi', g: 'vox', child: 1, who: 'minseo', w: 'vox', vol: -11, pan: -.4, m: .36, regs: BGV, patch: ['space'], sends: [['plate', -9]] },
  { name: 'bgv lo', g: 'vox', child: 1, who: 'minseo', w: 'vox', vol: -11, pan: .4, m: .34, regs: BGV, patch: ['space'], sends: [['plate', -9]] },
  { name: 'ad libs', g: 'vox', child: 1, w: 'adlib', vol: -9, pan: .2, m: 0, regs: [[45, 48.5], [85, 88.5], [101, 104.5], [109, 112.5], [113, 120, 'outro ride']], sends: [['slap', -8]] },
  { name: 'riser', g: 'fx', w: 'riser', vol: -12, pan: 0, m: 0, regs: [[29, 33], [69, 73], [93, 97]] },
  { name: 'impacts', g: 'fx', w: 'impact', vol: -10, pan: 0, m: 0, regs: [[1, 2.5], [33, 34.5], [73, 74.5], [97, 98.5], [113, 114.5]], sends: [['plate', -6]] },
  { name: 'plate', kind: 'bus', g: 'bus', vol: -9, pan: 0, m: .38, out: 'stereo out', patch: ['space'], feeds: 6 },
  { name: 'slap', kind: 'bus', g: 'bus', vol: -12, pan: 0, m: .2, out: 'stereo out', patch: ['delay'], feeds: 2 },
  { name: 'crush', kind: 'bus', g: 'bus', vol: -14, pan: 0, m: .5, out: 'stereo out', ins: ['compressor'], feeds: 1 },
]
{ let parent = null
  TRACKS.forEach((t, k) => {
    t.k = k; t.regs = t.regs || []
    if (t.kind === 'stack') parent = t
    if (t.child) { t.parent = parent; t.out = parent.name; (parent.kids = parent.kids || []).push(t) }
    else if (!t.out) t.out = 'stereo out'
  }) }
const SHORT = { 'channel eq': 'eq', compressor: 'comp', 'noise gate': 'gate', 'de-esser': 'de-ess', 'stereo out': 'st out', drums: 'drums', guitars: 'gtrs', vocals: 'vox' }
const MASTER = { name: 'stereo out', g: 'bus', vol: -3.2, pan: 0, m: .72 }
const SEL = TRACKS.findIndex(t => t.name === 'lead vox'), POS = 40.3, CYC = [33, 49], SELREG = [SEL, 8]

/* ── how the window is cut ── */
const BAR_H = 44, TOOL_H = 26, SC_H = 18, RU_H = 20, ROW = 25, HEAD_W = 292, FOOT_H = 22, PANEL_H = 320, PH = 26, SLUR_W = 312, PXB = 9, TOP = BAR_H + TOOL_H + SC_H + RU_H
function layout (p, s) { const Rr = W - SLUR_W * s; return { p, s, R: Rr, B: H - FOOT_H - PANEL_H * p, toolY: BAR_H, scY: BAR_H + TOOL_H, ruY: BAR_H + TOOL_H + SC_H, lnY: TOP } }
const bx = bar => HEAD_W + (bar - 1) * PXB

/* ── sound drawn without sound: each kind of track has its own way of moving through a bar ── */
const frac = x => x - Math.floor(x)
const rnd = (i, seed) => { let h = Math.imul((i | 0) ^ (seed * 374761393), 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296 }
const vnoise = (x, seed) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return rnd(i, seed) * (1 - u) + rnd(i + 1, seed) * u }
const hits = (beat, list, decay, bar = 0, sd = 1) => { let v = 0; list.forEach(([t, amp], j) => { const d = beat >= t ? beat - t : beat + 4 - t; v = Math.max(v, amp * (.8 + .2 * rnd((beat >= t ? bar : bar - 1) * 8 + j, sd + 11)) * Math.exp(-d * decay)) }); return v }
const ENV = {
  kick: (p, sd) => hits(frac(p) * 4, [[0, 1], [2, .94], [2.5, rnd(Math.floor(p), sd) > .6 ? .66 : 0], [3.5, rnd(Math.floor(p), sd + 4) > .78 ? .6 : 0]], 2.6, Math.floor(p), sd),
  snare: (p, sd) => hits(frac(p) * 4, [[1, 1], [3, .94], [3.75, rnd(Math.floor(p), sd) > .8 ? .4 : 0]], 3, Math.floor(p), sd),
  hat: p => { const b = frac(p) * 8, k = Math.floor(b); return (k % 2 ? .3 : .56) * Math.exp(-(b - k) * 2.4) * (.7 + .3 * rnd(Math.floor(p) * 8 + k, 7)) },
  tom: p => { const b = frac(p) * 4; if (b < 2) return .03; const k = Math.floor(b * 2); return (.62 + .38 * rnd(k, 3)) * Math.exp(-(b * 2 - k) * 1.6) },
  oh: (p, sd) => .1 + .5 * Math.max(ENV.kick(p, sd) * .45, ENV.snare(p, sd) * .9, ENV.hat(p) * .8),
  room: (p, sd) => .14 + .5 * Math.pow(Math.max(ENV.kick(p, sd) * .8, ENV.snare(p, sd)), .7),
  bass: (p, sd) => { const i = Math.floor(p * 4); return rnd(i, sd) > .07 ? .44 + .24 * rnd(i, sd + 1) : .05 },
  piano: (p, sd) => { const b = frac(p) * 2, k = Math.floor(b); return (.4 + .4 * rnd(Math.floor(p) * 2 + k, sd)) * Math.exp(-(b - k) * 1.7) + .04 },
  gtr: (p, sd) => { const b = frac(p) * 4, k = Math.floor(b); return [1, .62, .86, .7][k] * (.6 + .4 * rnd(Math.floor(p) * 4 + k, sd)) * Math.exp(-(b - k) * .9) * .7 + .06 },
  lead: (p, sd) => { const i = Math.floor(p * 2); return rnd(i, sd + 5) > .22 ? (.3 + .5 * rnd(i, sd)) * (1 - .45 * frac(p * 2)) : .04 },
  vox: (p, sd) => { const i = Math.floor(p * 4); return rnd(i, sd + 9) > .26 ? (.26 + .62 * rnd(i, sd)) * (1 - .35 * frac(p * 4)) : .03 },
  adlib: (p, sd) => { const i = Math.floor(p * 4); return rnd(Math.floor(p * .9), sd + 2) > .45 && rnd(i, sd + 3) > .3 ? (.3 + .6 * rnd(i, sd)) * (1 - .4 * frac(p * 4)) : .02 },
  riser: (p, sd, a, b) => Math.pow((p - a) / (b - a), 1.7) * (.72 + .28 * vnoise(p * 40, sd)),
  impact: (p, sd, a) => Math.exp(-(p - a) * 3) * (.82 + .18 * vnoise(p * 50, sd)),
}
function wavePath (t, r, w, yc, hmax) {
  const a = r[0], b = r[1], steps = Math.max(2, Math.floor(w - 1)), f = ENV[t.w], sd = t.k + 3, voice = t.w === 'vox' || t.w === 'lead' || t.w === 'adlib', edge = voice ? .12 : 0, jit = voice ? .3 : t.w === 'bass' || t.w === 'gtr' || t.w === 'oh' || t.w === 'room' ? .34 : .12
  let up = '', dn = ''
  for (let i = 0; i < steps; i++) {
    let v = 0
    for (let q = 0; q < 5; q++) { const p = a + (b - a) * (i + (q + .5) / 5) / steps; v = Math.max(v, f(p, sd, a, b)) }
    if (edge) v *= Math.min(1, (i + 1) / steps * (b - a) / edge, (steps - i) / steps * (b - a) / edge)      // a phrase begins and ends on silence
    const h = Math.max(.4, Math.min(1, v * (1 - jit + jit * rnd(i, sd + Math.floor(a)))) * hmax)
    up += `${i ? 'L' : 'M'}${n(1 + i)} ${n(yc - h)}`; dn = `L${n(1 + i)} ${n(yc + h)}` + dn
  }
  return up + dn + 'Z'
}
const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 66]]
function midiPath (t, r, ly, lh) {
  let d = ''
  const a = r[0], b = r[1]
  for (let k = Math.floor(a); k < b; k++) {
    const ch = CHORDS[((k - 1) >> (t.midi === 2 ? 1 : 0)) & 3], x0 = (k - a) * PXB
    const parts = t.midi === 2 ? [[0, 1]] : [[0, .46], [.5, .96]]
    for (const [s0, s1] of parts) for (const m of ch) { const xa = Math.max(1, x0 + s0 * PXB + .6), xb = Math.min((b - a) * PXB - 1.5, x0 + s1 * PXB); if (xb - xa > 1) d += `M${n(xa)} ${n(ly + lh - 3.5 - (m - 46) * (lh - 7) / 22)}H${n(xb)}` }
  }
  return d
}

/* ── small parts ── */
/* a level laid along a line, and where the fader stands on it */
function levelBar (x, y, w, lvl, fader, muted) {
  const f6 = volF(-6)
  let s = R(x, y, w, 2, { fill: INK, fa: .12 })
  if (lvl > 0) { s += R(x, y, w * Math.min(lvl, f6), 2, { fill: LEVEL, fa: .86 }); if (lvl > f6) s += R(x + w * f6, y, w * (lvl - f6), 2, { fill: SOLO }) }
  s += R(x + w * volF(0), y - 1.5, 1, 5, { fill: INK, fa: .3 })
  if (fader != null) s += R(x + w * fader - 1, y - 4, 2, 10, { fill: INK, fa: muted ? .5 : 1 })
  return s
}
/* left or right of the middle: a line that fills from its centre */
function panBar (x, y, w, pan) {
  const cx = x + w / 2, px = cx + pan * w / 2
  return R(x, y, w, 2, { fill: INK, fa: .12 }) + R(Math.min(cx, px), y, Math.abs(px - cx), 2, { fill: INK, fa: .7 }) + R(cx - .5, y - 2, 1, 6, { fill: INK, fa: .3 }) + R(px - 1, y - 3, 2, 8, { fill: INK })
}
const tri = (x, y, open, a = .6) => P(open ? `M${x - 3} ${y - 1.5}H${x + 3}L${x} ${y + 2.5}Z` : `M${x - 1.5} ${y - 3}V${y + 3}L${x + 2.5} ${y}Z`, { fill: INK, fa: a })

/* ── the control bar ── */
function pBar (Ly, tab) {
  let s = R(0, 0, W, BAR_H, { fill: K2 })
  const pn = 'night bus ep'
  s += T(14, 26.3, pn, { size: 12, w: 500 }) + caret(14 + tw(pn, 12, 500) + 9, 22.5, .45)
  /* the transport and the display stand in the middle of the window */
  const g = (d, line) => (x, y, c, a) => G(P(d, line ? { stroke: c, sa: a, sw: 1.2, cap: 'round' } : { fill: c, fa: a }), `translate(${x} ${y})`)
  const tr = [
    { g: g('M-5 -4.5H-3.6V4.5H-5ZM4.6 -4.5L-2.6 0L4.6 4.5Z') },
    { g: g('M-3.4 -4.8L5 0L-3.4 4.8Z'), on: true },
    { g: g('M-4 -4H4V4H-4Z') },
    { g: (x, y) => Cc(x, y, 4.2, { fill: REC }) },
    { g: g('M-5.5 .5V-1a3 3 0 0 1 3 -3H3.4M1.4 -6.2L3.8 -4L1.4 -1.8M5.5 -.5V1a3 3 0 0 1 -3 3H-3.4M-1.4 6.2L-3.8 4L-1.4 1.8', true), gc: SOLO, ga: 1 },
    { g: g('M-4 5.2L-1.7 -5.2H1.7L4 5.2ZM0 2.2L3.8 -3.2', true) },
  ]
  const disp = [['41.2.1', 78, 500], ['1:45.1', 66, 400], ['92.00', 62, 400], ['4/4', 44, 400], ['a min', 58, 400]], dw = disp.reduce((a, q) => a + q[1], 0)
  const tw0 = tr.length * 30, tx = Math.round((W - tw0 - 10 - dw) / 2), lx = tx + tw0 + 10
  s += cells(tx, 10, 24, tr, { widths: tr.map(() => 30) })[0]
  s += R(lx, 10, dw, 24, { rx: 2, fill: K0 }) + R(lx + .5, 10.5, dw - 1, 23, { rx: 2, stroke: INK, sa: .2 })
  let cx = lx
  disp.forEach(([v, w, wt], i) => { if (i) s += vline(cx - .5, 14, 30, .13); s += T(cx + w / 2, 26.4, v, { size: i ? 11.5 : 12.5, w: wt, a: i ? .86 : 1, anchor: 'middle' }); cx += w })
  /* the right end: the way out, hand off, the switches for what opens and closes */
  let x = W - 12
  const [c1, w1] = cells(0, 0, 24, [{ t: 'slur', k: 'o', on: Ly.s > .5, hit: 'slur' }], { size: 10 }); x -= w1; s += G(c1, `translate(${x} 10)`)
  const [c2, w2] = cells(0, 0, 24, [{ t: 'patch', k: 'b', on: Ly.p > .5 && tab === 'patch', hit: 'patch' }, { t: 'mixer', k: 'x', on: Ly.p > .5 && tab === 'mixer', hit: 'mixer' }], { size: 10 }); x -= w2 + 6; s += G(c2, `translate(${x} 10)`)
  x -= 13; s += vline(x, 12, 32, .1); x -= 13
  const [k1, kw1] = key(0, 0, 'hand off', { h: 24, size: 10 }); x -= kw1; s += G(k1, `translate(${x} 10)`)
  x -= 18
  const mw = 76, mx = x - 30 - mw
  s += T(x, 25.6, fmtDb(MASTER.vol), { size: 10, a: .82, anchor: 'end' })
  ;[[.7, .76], [.68, .73]].forEach(([lv, pk], i) => { const y = 18 + i * 5, f6 = volF(-6); s += R(mx, y, mw, 2.5, { fill: INK, fa: .12 }) + R(mx, y, mw * Math.min(lv, f6), 2.5, { fill: LEVEL, fa: .86 }) + (lv > f6 ? R(mx + mw * f6, y, mw * (lv - f6), 2.5, { fill: SOLO }) : '') + R(mx + mw * pk, y, 1, 2.5, { fill: INK }) })
  s += R(mx + mw * volF(0), 15, 1, 13.5, { fill: INK, fa: .28 }) + T(mx - 8, 25.6, 'out', { size: 9.5, a: .4, anchor: 'end' })
  return s + hline(0, W, BAR_H - .5, .1)
}

/* ── the tracks' own bar ── */
function pTool (Ly) {
  const y = Ly.toolY, by = y + 16.6
  let s = R(0, y, Ly.R, TOOL_H, { fill: K1 })
  s += R(10.5, y + 4.5, 17, 17, { rx: 2, stroke: INK, sa: .24 }) + P(`M19 ${y + 9.5}V${y + 16.5}M15.5 ${y + 13}H22.5`, { stroke: INK, sa: .8 })
  let x = 38
  for (const [l, v] of [['tracks', '24'], ['stacks', '3'], ['buses', '3']]) { const [f, fw] = field(x, by, l, v); s += f; x += fw + 12 }
  x = HEAD_W + 10
  const [c, cw] = cells(x, y + 4, 18, [{ t: 'auto' }, { t: 'flex' }], { size: 9.5 }); s += c; x += cw + 16
  const put = (label, word) => { s += T(x, by, label, { size: 9.5, a: .4 }); x += tw(label, 9.5) + 6; const [k, w] = menuKey(x, y + 4, word); s += k; x += w + 14 }
  put('tool', 'pointer'); put('cmd', 'marquee'); put('snap', 'smart')
  s += vline(x, y + 6, y + TOOL_H - 6, .1); x += 14
  const zx = Ly.R - 156
  for (const [l, v] of [['region', 'chorus comp'], ['gain', '0.0'], ['transpose', '0'], ['fade', '0 0']]) { if (x + tw(l, 9.5) + 5 + tw(v, 9.5) > zx - 28) break; const [f, fw] = field(x, by, l, v); s += f; x += fw + 14 }
  if (zx > x) {
    const zy = y + TOOL_H / 2
    s += P(`M${zx - 14} ${zy}H${zx - 6}M${zx - 12} ${zy - 2}L${zx - 14} ${zy}L${zx - 12} ${zy + 2}M${zx - 8} ${zy - 2}L${zx - 6} ${zy}L${zx - 8} ${zy + 2}`, { stroke: INK, sa: .45, cap: 'round' }) + R(zx, zy - 1, 54, 2, { fill: INK, fa: .14 }) + R(zx + 12, zy - 5, 2, 10, { fill: INK })
    const vx = zx + 82
    s += P(`M${vx - 10} ${zy - 4}V${zy + 4}M${vx - 12} ${zy - 2}L${vx - 10} ${zy - 4}L${vx - 8} ${zy - 2}M${vx - 12} ${zy + 2}L${vx - 10} ${zy + 4}L${vx - 8} ${zy + 2}`, { stroke: INK, sa: .45, cap: 'round' }) + R(vx, zy - 1, 54, 2, { fill: INK, fa: .14 }) + R(vx + 16, zy - 5, 2, 10, { fill: INK })
  }
  return s + hline(0, Ly.R, y + TOOL_H - .5, .08) + vline(HEAD_W - .5, y, y + TOOL_H, .08)
}

/* ── scenes, and the bars ── */
function pRuler (Ly, cid) {
  const y = Ly.scY, y2 = Ly.ruY, cur = SCENES.findIndex(sc => POS + 1 >= sc.a && POS + 1 < sc.b)
  let s = R(0, y, Ly.R, SC_H + RU_H, { fill: K1 })
  s += T(12, y + 12.3, 'scenes', { size: 9, a: .38 }) + T(12, y2 + 13.3, 'bars', { size: 9, a: .38 }) + T(HEAD_W - 10, y2 + 13.3, '4/4', { size: 9, a: .38, anchor: 'end' })
  let g = '', t1 = '', t4 = ''
  SCENES.forEach((sc, i) => {
    const xa = bx(sc.a), w = (sc.b - sc.a) * PXB, on = i === cur
    if (on) g += R(xa, y, w, SC_H, { fill: INK, fa: .08 })
    g += P(`M${n(xa) + .5} ${y + 3}V${y + SC_H}`, { stroke: INK, sa: on ? .5 : .2 }) + T(xa + 5, y + 12.3, sc.name, { size: 9.5, it: true, w: on ? 500 : 400, a: on ? 1 : .56 })
  })
  for (let b = 0; b <= 170; b++) {
    const x = bx(b + 1)
    if (x > Ly.R + 1) break
    if (b % 4 === 0) t4 += `M${n(x) + .5} ${y2 + (b % 8 === 0 ? 4 : 12)}V${y2 + RU_H}`; else t1 += `M${n(x) + .5} ${y2 + 16}V${y2 + RU_H}`
    if (b % 8 === 0) g += T(x + 3.5, y2 + 11.6, String(b + 1), { size: 8.5, a: b < END - 1 ? .58 : .24 })
  }
  g += P(t1, { stroke: INK, sa: .14 }) + P(t4, { stroke: INK, sa: .26 })
  /* the cycle: a stretch of the ruler's top edge, with an end to take hold of at each side */
  const ca = bx(CYC[0]), cb = bx(CYC[1])
  g += R(ca, y2, cb - ca, 3, { fill: SOLO }) + R(ca, y2, 1.5, 7, { fill: SOLO }) + R(cb - 1.5, y2, 1.5, 7, { fill: SOLO })
  s += G(g, '', ` clip-path="url(#${cid})"`)
  return s + hline(0, Ly.R, y + SC_H - .5, .06) + hline(0, Ly.R, y2 + RU_H - .5, .1) + vline(HEAD_W - .5, y, y2 + RU_H, .08)
}

/* ── one track's head: its number, its name, whose it is; its four cells; its level under its fader; what the fader reads ── */
function miniCells (x, y, items, cw, h, size) {
  let s = '', div = ''
  const total = cw * items.length
  items.forEach((it, i) => {
    const cx = x + i * cw
    if (it.on) s += R(cx + (i ? 0 : .5), y + .5, cw - (i && i < items.length - 1 ? 0 : .5), h - 1, { fill: it.c || INK })
    s += T(cx + cw / 2, y + h / 2 + size * .34, it.t, { size, w: it.on ? 500 : 400, c: it.on ? K0 : INK, a: it.on ? 1 : .42, anchor: 'middle' })
    if (i) div += `M${n(cx) + .5} ${y + 1}V${y + h - 1}`
  })
  return s + P(div, { stroke: INK, sa: .15 }) + R(x + .5, y + .5, total - 1, h - 1, { rx: 1.5, stroke: INK, sa: .2 })
}
const cellsOf = t => ((t.kind || t.who) ? [] : [{ t: 'r', on: !!t.arm, c: REC }, { t: 'i', on: !!t.mon, c: MON }]).concat([{ t: 'm', on: !!t.mute }, { t: 's', on: !!t.solo, c: SOLO }])
function headRow (t, k, y) {
  const sel = k === SEL, stack = t.kind === 'stack', x0 = t.child ? 54 : 42, by = y + 16.4
  let s = ''
  if (sel) s += R(0, y, HEAD_W, ROW, { fill: INK, fa: .075 })
  s += R(0, y, 3, ROW - 1, { fill: t.col, fa: t.mute ? .4 : 1 })
  s += T(25, by - .4, String(k + 1).padStart(2, '0'), { size: 8.5, a: sel ? .8 : .32, anchor: 'end' })
  if (stack) s += tri(34, by - 4, true, .62)
  const its = cellsOf(t), cw = 15, cx = 214 - its.length * cw
  const tag = t.who || (t.kind === 'bus' ? 'bus' : ''), tagW = tag ? tw(tag, 9, 400, !!t.who) + 6 : 0
  const nm = fit(t.name, cx - 8 - x0 - tagW, 10.5, stack ? 500 : 400)
  s += T(x0, by, nm, { size: 10.5, w: stack || sel ? 500 : 400, a: t.mute ? .42 : sel ? 1 : .88 })
  if (tag) s += T(x0 + tw(nm, 10.5, stack || sel ? 500 : 400) + 6, by, tag, { size: 9, it: !!t.who, a: .4 })
  s += miniCells(cx, y + 5.5, its, cw, 14, 8.5)
  s += levelBar(224, y + 11.5, 40, t.mute ? 0 : t.m || 0, volF(t.vol), t.mute)
  s += T(HEAD_W - 8, by - .4, fmtDb(t.vol), { size: 9, a: sel ? .9 : .56, anchor: 'end' })
  return s + hline(0, HEAD_W, y + ROW - .5, stack ? .09 : .05)
}

/* ── one track's lane ── */
function laneRow (Ly, t, k, y) {
  const ly = y + 1.5, lh = ROW - 3
  let s = ''
  if (t.kind === 'stack') {
    /* a stack shows what its tracks hold: a block wherever any of them sounds, a line inside for each */
    const kids = t.kids || [], spans = []
    for (const r of kids.flatMap(c => c.regs).map(r => [r[0], r[1]]).sort((p, q) => p[0] - q[0])) { const last = spans[spans.length - 1]; if (last && r[0] <= last[1] + .01) last[1] = Math.max(last[1], r[1]); else spans.push(r) }
    for (const r of spans) s += R(bx(r[0]) + .5, ly, (r[1] - r[0]) * PXB - 1, lh, { rx: 1.5, fill: K3, fa: .7 })
    kids.forEach((c, j) => { const yy = ly + 4 + j * (lh - 9) / Math.max(1, kids.length - 1); let d = ''; for (const r of c.regs) d += `M${n(bx(r[0]) + 2)} ${n(yy) + .5}H${n(bx(r[1]) - 2)}`; s += P(d, { stroke: t.col, sa: c.mute ? .2 : .62 }) })
    return s
  }
  if (t.kind === 'bus') return s
  t.regs.forEach((r, ri) => {
    const x = n(bx(r[0]) + .5), w = n((r[1] - r[0]) * PXB - 1), chosen = SELREG[0] === k && SELREG[1] === ri, name = r[2] || (chosen ? 'chorus comp' : ''), lab = name && tw(name, 7.5) + 9 <= w ? name : ''
    const solid = REG === 'solid', body = solid ? (chosen ? t.sel : t.body) : REG === 'tint' ? t.tint : K3, mark = solid ? t.deep : t.col
    let q = R(x, ly, w, lh, { rx: 1.5, fill: body })
    if (chosen && !solid) q += R(x, ly, w, lh, { rx: 1.5, fill: INK, fa: .1 })
    q += G(t.midi ? P(midiPath(t, r, ly, lh), { stroke: mark, sw: 1.4 }) : P(wavePath(t, r, w, ly + lh / 2, lh / 2 - 1.5), { fill: mark }), `translate(${x} 0)`)
    if (lab) q += R(x + 1, ly + 1, tw(lab, 7.5) + 6, 9.5, { rx: 1, fill: solid ? body : chosen ? '#3B3B39' : body }) + T(x + 4, ly + 8, lab, { size: 7.5, c: solid ? t.deep : chosen ? INK : t.light, a: solid || chosen ? 1 : .86 })
    if (chosen) q += R(x + .5, ly + .5, w - 1, lh - 1, { rx: 1.5, stroke: INK, sw: 1 })
    s += t.mute ? G(q, '', ' opacity=".34"') : q
  })
  return s
}
function pTracks (Ly, cidH, cidL, cidT) {
  const y0 = Ly.lnY, visH = Math.max(0, Ly.B - y0), all = TRACKS.length * ROW
  let s = R(HEAD_W, y0, Ly.R - HEAD_W, visH, { fill: K0 }) + R(0, y0, HEAD_W, visH, { fill: K1 })
  let heads = '', lanes = '', l4 = '', l8 = ''
  for (let b = 0; b <= 170; b += 4) { const x = bx(b + 1); if (x > Ly.R + 1) break; if (b % 8 === 0) l8 += `M${n(x) + .5} ${y0}V${Ly.B}`; else l4 += `M${n(x) + .5} ${y0}V${Ly.B}` }
  TRACKS.forEach((t, k) => {
    const y = y0 + k * ROW
    if (y >= Ly.B) return
    heads += headRow(t, k, y)
    if (k === SEL) lanes += R(HEAD_W, y, Ly.R - HEAD_W, ROW, { fill: INK, fa: .035 })
    lanes += laneRow(Ly, t, k, y) + hline(HEAD_W, Ly.R, y + ROW - .5, .045)
  })
  s += G(P(l4, { stroke: INK, sa: .03 }) + P(l8, { stroke: INK, sa: .06 }) + P(`M${n(bx(END)) + .5} ${y0}V${Ly.B}`, { stroke: INK, sa: .2 }) + lanes, '', ` clip-path="url(#${cidL})"`) + G(heads, '', ` clip-path="url(#${cidH})"`)
  s += vline(HEAD_W - .5, y0, Ly.B, .1)
  if (visH > 30) {
    /* where the window sits: along the song, and among the rows */
    const sw = Ly.R - HEAD_W - 10, span = END + 6
    s += R(HEAD_W + 4, Ly.B - 6, sw * Math.min(1, (sw / PXB) / span), 3, { rx: 1.5, fill: INK, fa: .22 })
    if (all > visH + 1) s += R(Ly.R - 5, y0 + 3, 3, (visH - 12) * visH / all, { rx: 1.5, fill: INK, fa: .22 })
  }
  const px = bx(POS + 1)
  s += G(P(`M${n(px) + .5} ${Ly.ruY + 8}V${Ly.B}`, { stroke: INK }) + P(`M${n(px - 3.5)} ${Ly.ruY + 4}H${n(px + 4.5)}V${Ly.ruY + 8}L${n(px + .5)} ${Ly.ruY + 12}L${n(px - 3.5)} ${Ly.ruY + 8}Z`, { fill: INK }), '', ` clip-path="url(#${cidT})"`)
  return s
}

/* ── a channel strip, from the top: its patch, what it borrows, what it sends, where it goes; where it sits; its fader on a
   scale beside its meter; what it reads; its four cells; its colour and its name. Wide, it also says what comes in. ── */
const PRINTS = [['tape', CREAM], ['space', SPACE], ['delay', MINT]]
const DBS = [6, 0, -6, -12, -24, -48]
function stripGeom (y, h, wide) {
  const sp = wide ? 16 : 13, sh = wide ? 14 : 12, rows = wide ? ['in', 'patch', 'ins', '', 'send', 'out'] : ['patch', 'ins', '', 'send', 'out']
  const y0 = y + 7, panY = y0 + rows.length * sp + 9, ft = panY + 14, fb = y + h - 62
  return { sp, sh, rows, y0, panY, ft, fb, fh: fb - ft, yOf: db => fb - (fb - ft) * volF(db) }
}
function stripGutter (x, w, y, h, wide) {
  const q = stripGeom(y, h, wide)
  let s = ''
  q.rows.forEach((l, i) => { if (l) s += T(x + w - 6, q.y0 + i * q.sp + q.sh / 2 + 2.8, l, { size: 8, a: .36, anchor: 'end' }) })
  s += T(x + w - 6, q.panY + 3.6, 'pan', { size: 8, a: .36, anchor: 'end' })
  for (const db of DBS) s += T(x + w - 6, q.yOf(db) + 2.8, db === -48 ? '∞' : String(Math.abs(db)), { size: 7.5, a: db === 0 ? .62 : .3, anchor: 'end' })
  return s
}
function strip (x, y, w, h, t, o = {}) {
  const wide = !!o.wide, q = stripGeom(y, h, wide), pad = wide ? 5 : 4, sx = x + pad, sw = w - pad * 2, fs = wide ? 9 : 7.5, sel = !!o.sel
  let s = '', yy = q.y0
  const name = v => wide ? v : (SHORT[v] || v)
  const full = (txt, lvl, it) => {
    s += R(sx, yy, sw, q.sh, { rx: 1.5, fill: K3 })
    s += T(sx + (wide ? 6 : 3.5), yy + q.sh / 2 + fs * .35, fit(txt, sw - (wide ? 12 : 4.5) - (lvl != null ? (wide ? 20 : 10) : 0), fs, 400, !!it), { size: fs, a: .86, it: !!it })
    if (lvl != null && wide) s += T(sx + sw - 5, yy + q.sh / 2 + fs * .35, String(lvl).replace('-', '−'), { size: 8, a: .46, anchor: 'end' })
    if (lvl != null && !wide) s += R(sx + sw - 10, yy + q.sh / 2 - 1, 7, 2, { fill: INK, fa: .16 }) + R(sx + sw - 10, yy + q.sh / 2 - 1, 7 * volF(lvl), 2, { fill: INK, fa: .78 })
  }
  const well = () => { s += R(sx, yy, sw, q.sh, { rx: 1.5, fill: K0, fa: LIGHT ? .05 : .55 }) }
  for (const r of q.rows) {
    if (o.master) { if (r === 'out') full(wide ? 'output 1-2' : 'out 1-2') }
    else if (r === 'in') full(t.kind === 'stack' ? `${t.kids.length} tracks` : t.kind === 'bus' ? `${t.feeds} sends` : t.who ? t.who : 'input 1', null, !!t.who)
    else if (r === 'patch') { const pr = t.patch || []; PRINTS.forEach(([k, c], i) => { const lx = sx + (wide ? 6 : 3) + i * (wide ? 10 : 8), ly = yy + q.sh / 2 - 2.5; s += pr.includes(k) ? R(lx, ly, 5, 5, { fill: c }) : R(lx + .5, ly + .5, 4, 4, { stroke: INK, sa: .16 }) }) }
    else if (r === 'ins') (t.ins || [])[0] ? full(name(t.ins[0])) : well()
    else if (r === '') (t.ins || [])[1] ? full(name(t.ins[1])) : well()
    else if (r === 'send') { const sd = (t.sends || [])[0]; sd ? full(sd[0], sd[1]) : well() }
    else if (r === 'out') full(name(t.out))
    yy += q.sp
  }
  const fx = x + (wide ? 34 : o.master ? 24 : 17)
  if (!o.master) { s += panBar(sx + (wide ? 4 : 2), q.panY, sw - (wide ? 34 : 4), t.pan || 0); if (wide) s += T(sx + sw - 2, q.panY + 3.4, panText(t.pan || 0), { size: 8.5, a: .6, anchor: 'end' }) }
  /* the fader on its scale, the meter beside it */
  let tk = ''
  for (const db of DBS) tk += `M${fx - 10} ${n(q.yOf(db)) + .5}H${fx - (db === 0 ? 6 : 7.5)}`
  s += P(tk, { stroke: INK, sa: .26 }) + R(fx - .5, q.ft, 1, q.fh, { fill: INK, fa: .2 })
  const fy = q.yOf(t.vol)
  s += R(fx - 6, fy - 3, 12, 6, { rx: 1, fill: INK, fa: t.mute ? .5 : 1 }) + P(`M${fx - 4} ${n(fy)}H${fx + 4}`, { stroke: K0, sa: .7 })
  const lv = t.mute ? 0 : t.m || 0, bw = wide || o.master ? 3.5 : 2.5, mx = fx + (wide || o.master ? 13 : 10), f6 = volF(-6)
  ;[lv, lv * .93].forEach((v, i) => {
    const x2 = mx + i * (bw + 1)
    s += R(x2, q.ft, bw, q.fh, { fill: INK, fa: .1 })
    if (v > 0) {
      s += R(x2, q.fb - q.fh * Math.min(v, f6), bw, q.fh * Math.min(v, f6), { fill: LEVEL, fa: .86 })
      if (v > f6) s += R(x2, q.fb - q.fh * v, bw, q.fh * (v - f6), { fill: SOLO })
      s += R(x2, q.fb - q.fh * Math.min(1, v + .05) - 1, bw, 1, { fill: INK, fa: .75 })
    }
  })
  /* what it reads; its cells; its colour and its name */
  s += T(x + w / 2, y + h - 49.5, fmtDb(t.vol), { size: wide ? 9 : 8, a: sel ? 1 : .68, anchor: 'middle' })
  if (!o.master) { const its = cellsOf(t), cw = Math.floor(sw / its.length); s += miniCells(sx + (sw - cw * its.length) / 2, y + h - 43, its, cw, wide ? 13 : 12, wide ? 8.5 : 7.5) }
  s += R(sx, y + h - 24, sw, 2, { fill: t.col || oklch(.7, .004, 90), fa: t.mute ? .4 : 1 })
  s += T(x + w / 2, y + h - 9.5, fit(t.name, sw, wide ? 9.5 : 8, sel ? 500 : 400), { size: wide ? 9.5 : 8, w: sel ? 500 : 400, a: t.mute ? .42 : sel ? 1 : .8, anchor: 'middle' })
  return s
}

/* ── the bottom panel ── */
const SIDE = 222, GUT = 34, WSTRIP = 86
function pPanelHead (Ly, tab) {
  const y = Ly.B, t = TRACKS[SEL], by = y + 16.6
  let s = R(0, y, Ly.R, PH, { fill: K2 }) + hline(0, Ly.R, y, .14) + hline(0, Ly.R, y + PH - .5, .08)
  s += R(Ly.R / 2 - 12, y + 2, 24, 2, { rx: 1, fill: INK, fa: .2 })      // the edge that is dragged to give the panel more of the window
  s += cells(10, y + 4, 18, [{ t: 'patch', on: tab === 'patch', hit: 'tab-patch' }, { t: 'mixer', on: tab === 'mixer', hit: 'tab-mixer' }], { size: 9.5, widths: [48, 48] })[0]
  if (tab === 'patch') {
    s += R(120, y + 10, 6, 6, { fill: t.col }) + T(132, by, t.name, { size: 10.5, w: 500 }) + T(132 + tw(t.name, 10.5, 500) + 7, by, `track ${SEL + 1}`, { size: 9.5, a: .4 })
    const rx = Ly.R - SIDE
    let x = rx - 12
    const [k, kw] = key(0, 0, 'plug-ins'); x -= kw; s += G(k, `translate(${x} ${y + 4})`)
    x -= 140
    s += T(x, by, 'scene', { size: 9.5, a: .4 }) + T(x + 36, by, 'a', { size: 10, w: 500 }) + R(x + 48, y + 12, 64, 2, { fill: INK, fa: .14 }) + R(x + 48, y + 8, 2, 10, { fill: INK }) + T(x + 119, by, 'b', { size: 10, a: .45 })
    s += vline(rx - .5, y, y + PH, .08) + T(rx + 12, by, 'strip', { size: 9.5, a: .4 })
  } else s += field(120, by, 'strips', String(TRACKS.length))[0]
  return s
}
function pPatch (Ly, cid) {
  const y = Ly.B + PH, h = PANEL_H - PH, t = TRACKS[SEL], MID = y + 130, NR = 34, e = NR + 7, rx = Ly.R - SIDE
  let s = R(0, y, Ly.R, h, { fill: K1 })
  const nodes = [
    { k: 'tape', x: 160, y: MID, cap: ['tape', '24'] },
    { k: 'space', x: 314, y: MID - 58, cap: ['space', 'hall 46 3.70s'] },
    { k: 'delay', x: 314, y: MID + 58, cap: ['delay', '1/8 30 fb 35'] },
    { k: 'mix', x: 468, y: MID, cap: ['mix', 'space 62 delay 38'] },
  ]
  const end = (x, yy) => Cc(x, yy, 2, { fill: INK })
  const wire = (ax, ay, bx2, by) => { const dx = Math.max(22, (bx2 - ax) * .5); return P(`M${ax} ${ay}C${n(ax + dx)} ${ay} ${n(bx2 - dx)} ${by} ${bx2} ${by}`, { stroke: INK, sa: .46 }) + end(ax, ay) + end(bx2, by) }
  const label = (cx, yy, name, rest) => T(cx, yy, name, { size: 10, w: 500, anchor: 'middle' }) + (rest ? T(cx, yy + 12.5, rest, { size: 9, a: .46, anchor: 'middle' }) : '')
  const [tp, sp, dl, mx] = nodes, inX = 40, lx = 606, addX = 704, outX = 800
  let g = Cc(inX, MID, 4, { stroke: INK, sa: .8, sw: 1.2 }) + T(inX, MID + 20, 'in', { size: 9.5, a: .46, anchor: 'middle' }) + wire(inX + 7, MID, tp.x - e, MID)
  g += wire(tp.x + e, tp.y, sp.x - e, sp.y) + wire(tp.x + e, tp.y, dl.x - e, dl.y) + wire(sp.x + e, sp.y, mx.x - e, mx.y) + wire(dl.x + e, dl.y, mx.x - e, mx.y) + wire(mx.x + e, MID, lx - e, MID)
  /* what is borrowed: a frame of the same size as a print, its name set inside */
  g += R(lx - NR + .5, MID - NR + .5, 2 * NR - 1, 2 * NR - 1, { rx: 2, fill: K3, stroke: INK, sa: .34 }) + T(lx, MID - 2, 'channel', { size: 10, anchor: 'middle' }) + T(lx, MID + 10, 'eq', { size: 10, anchor: 'middle' }) + R(lx + NR - 9, MID - NR + 5, 4, 4, { fill: INK })
  g += label(lx, MID + NR + 17, 'channel eq', 'au') + wire(lx + e, MID, addX - e, MID)
  g += R(addX - NR + .5, MID - NR + .5, 2 * NR - 1, 2 * NR - 1, { rx: 2, stroke: INK, sa: .26, dash: '2 3' }) + P(`M${addX} ${MID - 5}V${MID + 5}M${addX - 5} ${MID}H${addX + 5}`, { stroke: INK, sa: .55 })
  g += wire(addX + e, MID, outX - 7, MID) + Cc(outX, MID, 4, { stroke: INK, sa: .8, sw: 1.2 }) + T(outX, MID + 20, 'out', { size: 9.5, a: .46, anchor: 'middle' })
  for (const q of nodes) g += plate(q.k, q.x, q.y, NR) + label(q.x, q.y + NR + 17, q.cap[0], q.cap[1])
  const shiftX = Math.max(0, Math.round(rx / 2 - 420))
  s += G(G(g, `translate(${shiftX} 0)`), '', ` clip-path="url(#${cid})"`)
  /* at the right: the chosen track's strip, and the strip of where it plays */
  s += R(rx, y, Ly.R - rx, h, { fill: K2, fa: .6 }) + vline(rx - .5, y, y + h, .08)
  const x1 = rx + GUT, x2 = x1 + WSTRIP + 6
  s += stripGutter(rx, GUT, y, h, true)
  s += R(x1, y, WSTRIP, h, { fill: INK, fa: .05 }) + strip(x1, y, WSTRIP, h, t, { wide: true, sel: true }) + vline(x1 + WSTRIP + 2.5, y + 8, y + h - 8, .07)
  s += strip(x2, y, WSTRIP, h, MASTER, { wide: true, master: true })
  return s
}
const NSTRIP = 44, NGUT = 34, MSTRIP = 56
function pMixer (Ly) {
  const y = Ly.B + PH, h = PANEL_H - PH
  let s = R(0, y, Ly.R, h, { fill: K1 })
  const mx = Ly.R - 8 - MSTRIP, room = mx - 8 - NGUT, nShow = Math.min(TRACKS.length, Math.floor(room / NSTRIP))
  s += stripGutter(0, NGUT, y, h, false) + vline(NGUT - .5, y, y + h, .06)
  TRACKS.slice(0, nShow).forEach((t, k) => {
    const x = NGUT + k * NSTRIP
    if (k === SEL) s += R(x, y, NSTRIP, h, { fill: INK, fa: .07 })
    s += strip(x, y, NSTRIP, h, t, { sel: k === SEL }) + vline(x + NSTRIP - .5, y, y + h, t.kind === 'stack' || (TRACKS[k + 1] && !TRACKS[k + 1].child && t.child) ? .1 : .05)
  })
  if (nShow < TRACKS.length) s += R(NGUT + 4, y + h - 5, (room - 8) * nShow / TRACKS.length, 3, { rx: 1.5, fill: INK, fa: .22 })
  s += R(mx - 8, y, Ly.R - mx + 8, h, { fill: K2, fa: .7 }) + vline(mx - 8.5, y, y + h, .1)
  s += strip(mx, y, MSTRIP, h, MASTER, { master: true })
  const q = stripGeom(y, h, false)
  for (const db of DBS) s += T(mx + 9, q.yOf(db) + 2.8, db === -48 ? '∞' : String(Math.abs(db)), { size: 7.5, a: db === 0 ? .62 : .3, anchor: 'end' })
  return s
}

/* ── slur: who is in the room, what they sent, what was said. A sheet at the right, set like a page of a catalogue ── */
function stemWave (x0, yc, seed, shape, wpx, hh0, c, a) {
  let d = ''
  const nb = Math.floor(wpx / 2.5)
  for (let i = 0; i < nb; i++) { const env = shape === 'arch' ? Math.sin(Math.PI * i / nb) * .7 + .3 : Math.abs(Math.sin(Math.PI * i / (nb / 3))) * .75 + .2, hh = Math.max(1, (rnd(i, seed) * .8 + .2) * hh0 * env); d += `M${n(x0 + i * 2.5) + .5} ${n(yc - hh / 2)}v${n(hh)}` }
  return P(d, { stroke: c, sa: a })
}
function pSlur (Ly) {
  const x = Ly.R, y = BAR_H, w = SLUR_W, h = H - FOOT_H - BAR_H, px = x + 16, pw = w - 32
  const bg = SLUR_PAPER ? '#F3F1EB' : K1, ink = SLUR_PAPER ? '#1A1917' : INK, well = SLUR_PAPER ? '#1A1917' : INK
  const t = (xx, yy, str, o) => T(xx, yy, str, Object.assign({ c: ink }, o || {}))
  const rule = (yy, a = .1) => P(`M${px} ${n(yy) + .5}H${px + pw}`, { stroke: ink, sa: a })
  let s = R(x, y, w, h, { fill: bg }) + P(`M${x + .5} ${y}V${y + h}`, { stroke: SLUR_PAPER ? '#000000' : INK, sa: SLUR_PAPER ? .4 : .1 })
  s += t(px, y + 23.5, 'slur', { size: 9.5, a: .42 }) + t(px + tw('slur', 9.5) + 8, y + 23.5, 'night bus ep', { size: 11.5, w: 500 })
  /* who is here: a cell for each, filled if they are in the room now */
  const who = [['jn', true], ['ms', true], ['hr', false], ['st', false]]
  let wx = px + pw - who.length * 20
  who.forEach(([nm, here], i) => { const cx = wx + i * 20; s += here ? R(cx, y + 11, 18, 18, { rx: 2, fill: ink }) : R(cx + .5, y + 11.5, 17, 17, { rx: 2, stroke: ink, sa: .3 }); s += t(cx + 9, y + 23.3, nm, { size: 8.5, w: here ? 500 : 400, c: here ? bg : ink, a: here ? 1 : .5, anchor: 'middle' }) })
  s += rule(y + 40)
  let my = y + 58
  s += t(px, my, 'stems', { size: 9, a: .42 }) + t(px + pw, my, '3 new', { size: 9, a: .42, anchor: 'end' })
  my += 10
  const stem = c => {
    s += rule(my, .08)
    s += stemWave(px, my + 21, c.seed, c.shape, 64, 20, ink, .8)
    s += t(px + 76, my + 17, c.title, { size: 10.5, w: 500 })
    s += run(px + 76, my + 30, [[c.who, { size: 9, it: true, c: ink, a: .56 }], [c.len, { size: 9, c: ink, a: .42 }], [`bar ${c.bar}`, { size: 9, c: ink, a: .42 }], ['48k', { size: 9, c: ink, a: .42 }]], 7)[0]
    const kw = keyW('place', 9, 8)
    s += c.placed ? t(px + pw, my + 23.5, 'placed', { size: 9, a: .36, anchor: 'end' }) : R(px + pw - kw + .5, my + 12.5, kw - 1, 17, { rx: 2, stroke: ink, sa: .3 }) + t(px + pw - kw + 8, my + 24.3, 'place', { size: 9, a: .86 })
    my += 42
  }
  stem({ who: 'jun', title: 'gtr lead bridge', len: '0:21', bar: 89, seed: 7, shape: 'arch' })
  stem({ who: 'minseo', title: 'bgv high dbl', len: '0:41', bar: 97, seed: 23, shape: 'phr' })
  stem({ who: 'minseo', title: 'bgv low dbl', len: '0:41', bar: 97, seed: 31, shape: 'phr' })
  stem({ who: 'jun', title: 'bass di verse 2', len: '0:42', bar: 49, seed: 11, shape: 'arch', placed: true })
  s += rule(my, .08)
  my += 24
  s += t(px, my, 'notes', { size: 9, a: .42 })
  my += 10
  const note = (nm, at, lines) => {
    s += rule(my, .08)
    s += t(px, my + 16, nm, { size: 9.5, it: true, a: .62 }) + t(px + pw, my + 16, at, { size: 8.5, a: .36, anchor: 'end' })
    lines.forEach((ln, i) => { s += t(px, my + 30 + i * 13.5, ln, { size: 10.5, a: .9 }) })
    my += 30 + lines.length * 13.5 - 2
  }
  note('jun', '14:02', ['bridge lead is up, take 3. di and amp', 'are in the same file'])
  note('you', '14:05', ['placing it at 89'])
  note('minseo', '14:21', ['doubled both bgv for the last chorus.', 'bar 101 high is flat, retake tonight'])
  note('you', '14:30', ['printing stems friday'])
  s += rule(my + 6, .08)
  /* where a word is written back */
  const cy = y + h - 38, kw = keyW('send', 9.5, 9)
  s += rule(cy - 10, .1) + R(px + .5, cy + .5, pw - kw - 7, 23, { rx: 2, stroke: ink, sa: .26 }) + R(px + 8, cy + 6, 1, 12, { fill: ink, fa: .7 })
  s += R(px + pw - kw + .5, cy + .5, kw - 1, 23, { rx: 2, stroke: ink, sa: .3 }) + t(px + pw - kw + 9, cy + 15.6, 'send', { size: 9.5, a: .86 })
  return s
}

/* ── the foot: say it; and how the machine stands ── */
function pFoot () {
  const y = H - FOOT_H, by = y + 14.6
  let s = R(0, y, W, FOOT_H, { fill: K2 }) + hline(0, W, y, .1) + P(`M13 ${y + 7.5}L17 ${y + 11}L13 ${y + 14.5}`, { stroke: INK, sa: .5, sw: 1.2, cap: 'round' }) + T(26, by, 'lead vox -3 db', { size: 10.5, a: .94 })
  s += run(26 + tw('lead vox -3 db', 10.5) + 22, by, [['lead vox', { size: 9.5, a: .5 }], ['−4.0', { size: 9.5, a: .5 }], ['to', { size: 9.5, a: .36 }], ['−7.0 db', { size: 9.5, a: .9 }]], 5)[0]
  let x = W - 10
  const [k, kw] = key(0, 0, 'keys', { h: 16, size: 9, pad: 8 }); x -= kw; s += G(k, `translate(${x} ${y + 3})`)
  const cell = (label, v, bar) => { x -= 12; s += vline(x, y + 6, y + FOOT_H - 6, .1); x -= 12; if (v) { x -= tw(v, 9.5); s += T(x, by, v, { size: 9.5, a: .8 }); x -= 5 } if (bar != null) { x -= 36; s += R(x, y + 10, 30, 2, { fill: INK, fa: .14 }) + R(x, y + 10, 30 * bar, 2, { fill: INK, fa: .8 }); x -= 6 } x -= tw(label, 9.5); s += T(x, by, label, { size: 9.5, a: .4 }) }
  cell('saved', '14:31'); cell('buffer', '512'); cell('rate', '48k 24 bit'); cell('cpu', '12%', .12)
  return s
}

/* the whole window */
function render (p, s, tab = 'patch') {
  for (const t of TRACKS) { t.col = pig(t.g, PL, PC); t.light = pig(t.g, .86, .04); t.tint = pig(t.g, .26, .028); t.body = pig(t.g, BL, BC); t.deep = pig(t.g, .2, .03); t.sel = pig(t.g, .86, .05) }
  MASTER.col = oklch(LIGHT ? .45 : .8, .004, 90)
  const Ly = layout(p, s), a = 'c' + (++UID), b = 'c' + (++UID), c = 'c' + (++UID), d = 'c' + (++UID)
  const lanesH = Math.max(0, Ly.B - Ly.lnY), laneW = Math.max(0, Ly.R - HEAD_W)
  let out = `<defs><clipPath id="${a}"><rect x="0" y="${Ly.lnY}" width="${HEAD_W}" height="${n(lanesH)}"/></clipPath><clipPath id="${b}"><rect x="${HEAD_W}" y="${Ly.lnY}" width="${n(laneW)}" height="${n(lanesH)}"/></clipPath><clipPath id="${c}"><rect x="${HEAD_W}" y="${Ly.scY}" width="${n(laneW)}" height="${n(Math.max(0, Ly.B - Ly.scY))}"/></clipPath><clipPath id="${d}"><rect x="0" y="${n(Ly.B + PH)}" width="${n(Math.max(0, Ly.R - SIDE))}" height="${PANEL_H - PH}"/></clipPath></defs>`
  out += R(0, 0, W, H, { fill: K1 })
  out += pTracks(Ly, a, b, c) + pRuler(Ly, c) + pTool(Ly)
  if (p > .001) out += (tab === 'mixer' ? pMixer(Ly) : pPatch(Ly, d)) + pPanelHead(Ly, tab)
  if (s > .001) out += pSlur(Ly)
  out += pBar(Ly, tab) + pFoot()
  return out
}
