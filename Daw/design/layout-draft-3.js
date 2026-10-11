/* slur daw — layout draft 3: the same room built like a working console.
   Tones separate the areas (lanes below the wall, bars above it); every switch sits in a framed cell; every level has
   its scale. One function draws the window for any state: bottom panel open (0..1) on 'patch' or 'mixer', slur open (0..1). */
const TEMPO = 92, SPBAR = 240 / TEMPO
let LOOPS = null, HITS = false
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const fmtDb = v => v <= -47.5 ? '−∞' : (v > 0 ? '+' : '') + v.toFixed(1).replace('-', '−')
const volF = db => db <= -47.5 ? 0 : db <= -24 ? (db + 48) / 24 * .25 : .25 + (db + 24) / 30 * .75
const fitText = (s, maxW, f = 'g', size = 10, w = 400) => { if (tw(s, f, size, w) <= maxW) return s; let k = s.length; while (k > 1 && tw(s.slice(0, k) + '…', f, size, w) > maxW) k--; return s.slice(0, k) + '…' }
function peakOf (chs) { let m = 0; for (const a of chs) for (let i = 0; i < a.length; i += 3) { const v = Math.abs(a[i]); if (v > m) m = v } return m || 1 }

/* tones: the lanes lie a step below the wall, the bars a step above it, a control at rest a step above that */
const LANE = '#110F0C', BARC = '#1C1915', CELL = '#24211B', DEEP = '#0C0B09'

const SCENES = [['intro', 1], ['verse', 5], ['pre', 13], ['chorus', 17], ['verse 2', 25], ['chorus', 33], ['out', 41]].map(([name, a], i, all) => ({ i, name, a, b: i + 1 < all.length ? all[i + 1][1] : 43 }))
const TRACKS = [
  { name: 'drums', kind: 'stack', c: INK, own: INK, vol: 0, pan: 0, regs: [], m: .7, out: 'stereo out' },
  { name: 'kick', c: BLUE, own: INK, vol: -1.5, pan: 0, buf: 'kick', child: true, regs: [[5, 13], [17, 25], [25, 33], [33, 41]], m: .72, out: 'drums', patch: ['tape'], ins: ['compressor'] },
  { name: 'snare', c: GREEN, own: INK, vol: -5, pan: .08, buf: 'snare', child: true, regs: [[5, 13], [17, 25], [25, 33], [33, 41]], m: .58, out: 'drums', sends: [['room', -14]], patch: ['tape', 'space'] },
  { name: 'hats', c: LILAC, own: INK, vol: -6, pan: -.22, buf: 'hats', child: true, regs: [[13, 17], [17, 25], [33, 41]], m: .44, out: 'drums' },
  { name: 'bass', c: ROSE, own: ROSE, theirs: 'jun', vol: -6.5, pan: 0, buf: 'bass', regs: [[5, 13], [17, 33], [33, 41]], m: .55, out: 'stereo out', patch: ['tape'], ins: ['compressor', 'channel eq'] },
  { name: 'keys', c: ORANGE, own: INK, vol: -4.5, pan: -.12, buf: 'keys', midi: true, regs: [[1, 5], [5, 13], [13, 17], [17, 25], [33, 41]], m: .62, out: 'stereo out', sends: [['room', -12]], ins: ['channel eq'], patch: ['tape', 'space', 'delay'], arm: true },
  { name: 'guitar', c: ROSE, own: ROSE, theirs: 'jun', vol: -5, pan: .3, buf: 'guitar', regs: [[13, 17], [17, 25, 'take 3'], [33, 43]], m: .5, out: 'stereo out', sends: [['room', -9]], patch: ['space', 'delay'] },
  { name: 'hum', c: YELLOW, own: YELLOW, theirs: 'minseo', vol: -6, pan: 0, buf: 'hum', regs: [[5, 13], [17, 25], [25, 33], [33, 41]], m: .46, out: 'stereo out', sends: [['room', -6]], patch: ['space'], ins: ['de-esser'] },
  { name: 'air', c: BLUE, own: INK, vol: -12, pan: 0, buf: 'air', regs: [[1, 43]], m: 0, out: 'stereo out', mute: true },
  { name: 'room', kind: 'bus', c: MINT, own: INK, vol: -8, pan: 0, regs: [], m: .34, out: 'stereo out', patch: ['space'] },
]
const SEL = 5, POS = 16.6, SELREG = [6, 1]                   // the chosen track; the playhead (bars from zero); the chosen region [track, index]

const BAR_H = 48, STAT_H = 24, HEAD_W = 244, TOOL_H = 28, SC_H = 20, RU_H = 24, ROW = 42, PANEL_H = 336, PH = 28, SLUR_W = 332, PXB = 20, SIDE = 232, GUT = 34, SLOT_P = 17, SLOT_H = 15
function layout (p, s) {
  const R = W - SLUR_W * s, B = H - STAT_H - PANEL_H * p
  return { p, s, R, B, toolY: BAR_H, scY: BAR_H + TOOL_H, ruY: BAR_H + TOOL_H + SC_H, lnY: BAR_H + TOOL_H + SC_H + RU_H, x0: HEAD_W, x1: R - 10 }
}
const bxOf = (Ly, bar) => Ly.x0 + (bar - 1) * PXB
const hline = (x0, x1, y, a = .1) => P(`M${n(x0)} ${n(y) + .5}H${n(x1)}`, { stroke: INK, sa: a })
const vline = (x, y0, y1, a = .1) => P(`M${n(x) + .5} ${n(y0)}V${n(y1)}`, { stroke: INK, sa: a })
const caret = (x, y, a = .5) => P(`M${n(x - 3)} ${n(y - 1.5)}H${n(x + 3)}L${n(x)} ${n(y + 2)}Z`, { fill: INK, fa: a })

/* a switch for a whole panel: a lamp, the word, the letter that does the same on the keys */
function switchKey (x, y, word, on, colour, letter, h = 24) {
  const ww = tw(word, 'g', 10.5, on ? 500 : 400), lw = letter ? tw(letter, 'm', 9) + 12 : 0, w = Math.round(9 + 6 + 7 + ww + lw + 9)
  let s = R(x + .5, y + .5, w - 1, h - 1, { rx: 2, fill: on ? CELL : 'none', stroke: INK, sa: on ? .42 : .22 })
  s += on ? R(x + 9, y + h / 2 - 3, 6, 6, { fill: colour }) : R(x + 9.5, y + h / 2 - 2.5, 5, 5, { stroke: INK, sa: .4 })
  s += T(x + 22, y + h / 2 + 3.7, word, { size: 10.5, w: on ? 500 : 400, a: on ? 1 : .62 })
  if (letter) s += T(x + w - 9, y + h / 2 + 3.3, letter, { f: 'm', size: 9, a: .4, anchor: 'end' })
  return [s, w]
}
/* a key that opens a list: the word and a small triangle */
function dropKey (x, y, word, h = 20) {
  const w = Math.round(tw(word, 'g', 10) + 28)
  return [R(x + .5, y + .5, w - 1, h - 1, { rx: 2, fill: CELL, stroke: INK, sa: .2 }) + T(x + 9, y + h / 2 + 3.5, word, { size: 10, a: .88 }) + caret(x + w - 10, y + h / 2, .45), w]
}
/* a framed row of equal cells: letters or words, the chosen ones filled */
function cellRow (x, y, items, cw, h = 16, size = 9) {
  let s = '', div = ''
  const total = cw * items.length, id = 'cr' + (++UID)
  items.forEach((it, i) => {
    const cx = x + i * cw
    if (it.on) s += R(cx, y, cw, h, { fill: it.c || INK })
    s += T(cx + cw / 2, y + h / 2 + size * .36, it.t, { size, w: it.on ? 500 : 400, c: it.on ? WALL : INK, a: it.on ? 1 : (it.dim ? .22 : .5), anchor: 'middle' })
    if (i) div += `M${n(cx) + .5} ${y + 1}V${y + h - 1}`
  })
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${total}" height="${h}" rx="2"/></clipPath>` + G(s, '', ` clip-path="url(#${id})"`) + P(div, { stroke: INK, sa: .2 }) + R(x + .5, y + .5, total - 1, h - 1, { rx: 2, stroke: INK, sa: .24 })
}
/* a level laid along a track, with where the fader stands */
function meterH (x, y, w, lvl, fader) {
  const f0 = volF(-6), cut = Math.min(lvl, f0)
  let s = R(x, y, w, 4, { rx: 1, fill: INK, fa: .09 }) + R(x, y, w * cut, 4, { rx: 1, fill: GREEN, fa: .85 })
  if (lvl > f0) s += R(x + w * f0, y, w * (lvl - f0), 4, { fill: YELLOW, fa: .9 })
  s += R(x + w * volF(0) - .5, y - 2, 1, 8, { fill: INK, fa: .25 })
  if (fader != null) s += R(x + w * fader - 1.5, y - 4, 3, 12, { rx: 1, fill: INK })
  return s
}
function panKnob (cx, cy, r, pan) {
  const a = (-90 + pan * 135) * Math.PI / 180
  return Cc(cx, cy, r, { fill: CELL, stroke: INK, sa: .38 }) + P(`M${n(cx + Math.cos(a) * r * .25)} ${n(cy + Math.sin(a) * r * .25)}L${n(cx + Math.cos(a) * (r - 1))} ${n(cy + Math.sin(a) * (r - 1))}`, { stroke: INK, sw: 1.4, cap: 'round' })
}
const panText = p => Math.abs(p) < .005 ? 'c' : (p < 0 ? '−' : '+') + Math.round(Math.abs(p) * 64)

/* ── the control bar ── */
function pBar (Ly, tab) {
  let s = R(0, 0, W, BAR_H, { fill: BARC })
  const pn = 'night bus ep', nx = 66
  s += mark(22, 12, 24) + T(nx, 28.5, pn, { size: 12.5, w: 500 }) + caret(nx + tw(pn, 'g', 12.5, 500) + 9, 25, .45)
  let x = nx + tw(pn, 'g', 12.5, 500) + 30
  s += vline(x - 8, 12, 36, .1)
  const [k1, w1] = switchKey(x + 4, 12, 'patch', Ly.p > .5 && tab === 'patch', AMBER, 'b')
  s += k1 + (HITS ? hit(x + 4, 12, w1, 24, 'patch') : '')
  const [k1b, w1b] = switchKey(x + 4 + w1 + 6, 12, 'mixer', Ly.p > .5 && tab === 'mixer', GREEN, 'x')
  s += k1b + (HITS ? hit(x + 4 + w1 + 6, 12, w1b, 24, 'mixer') : '')
  /* transport */
  const ic = (d, o) => (x2, y2, c, a) => G(P(d, Object.assign({ stroke: o && o.line ? c : undefined, fill: o && o.line ? 'none' : c, fa: a, sa: a, sw: 1.3, cap: 'round' }, {})), `translate(${x2} ${y2})`)
  const cellsT = [
    { g: ic('M-5.5 -5.5H-3.8V5.5H-5.5ZM5 -5.5L-3 0L5 5.5Z') },
    { g: ic('M-4 -5.5L5.5 0L-4 5.5Z'), on: true, c: GREEN },
    { g: ic('M-4.5 -4.5H4.5V4.5H-4.5Z') },
    { g: (x2, y2, c) => Cc(x2, y2, 5, { fill: c === WALL ? WALL : ROSE }) },
    { g: ic('M-6 1V-1.5a3 3 0 0 1 3 -3H3a3 3 0 0 1 3 3V1.5a3 3 0 0 1 -3 3H-1M1.5 2L-1.5 4.5L1.5 7', { line: true }) },
    { g: ic('M-5 6L-2 -6.5H2L5 6ZM0 3.5L4.5 -4', { line: true }) },
  ]
  const tx = 392
  const [trans, trw] = cells(tx, 10, 28, cellsT, { widths: cellsT.map(() => 36) })
  s += R(tx, 10, trw, 28, { rx: 2, fill: CELL }) + trans
  /* the display */
  const lx = tx + trw + 12, ly = 7, lh = 34, f = [['17.3.2', 'position', 104, 16], ['0:43.3', 'time', 76, 12.5], ['92.00', 'tempo', 76, 12.5], ['4/4', 'signature', 68, 12.5], ['a min', 'key', 64, 12.5]], lw = f.reduce((a, q) => a + q[2], 0)
  s += R(lx, ly, lw, lh, { rx: 3, fill: DEEP }) + R(lx + .5, ly + .5, lw - 1, lh - 1, { rx: 3, stroke: INK, sa: .22 })
  let cx = lx
  f.forEach(([v, cap, w, size], i) => {
    if (i) s += vline(cx - .5, ly + 5, ly + lh - 5, .14)
    s += T(cx + w / 2, ly + (i ? 16.5 : 18), v, { f: 'm', size, a: i ? .92 : 1, anchor: 'middle' }) + T(cx + w / 2, ly + 28.5, cap, { size: 8, a: .4, anchor: 'middle' })
    cx += w
  })
  /* the way out */
  const ox = lx + lw + 18
  s += T(ox, 21, 'out', { size: 8.5, a: .45 }) + T(ox, 34, '−4.2', { f: 'm', size: 10.5, a: .85 })
  const mx = ox + 34, mw = 92
  ;[[.66, .7], [.69, .74]].forEach(([lv, pk], i) => {
    const y = 17 + i * 6, f0 = volF(-6)
    s += R(mx, y, mw, 3.5, { fill: INK, fa: .1 }) + R(mx, y, mw * Math.min(lv, f0), 3.5, { fill: GREEN, fa: .9 }) + (lv > f0 ? R(mx + mw * f0, y, mw * (lv - f0), 3.5, { fill: YELLOW, fa: .9 }) : '') + R(mx + mw * pk, y, 1.5, 3.5, { fill: INK, fa: .8 })
  })
  let tk = ''
  for (const db of [-36, -24, -12, -6, 0, 6]) tk += `M${n(mx + mw * volF(db))} 31V${db === 0 ? 35 : 33.5}`
  s += P(tk, { stroke: INK, sa: .35 }) + T(mx + mw * volF(0), 41, '0', { f: 'm', size: 7, a: .4, anchor: 'middle' }) + T(mx + mw * volF(-24), 41, '24', { f: 'm', size: 7, a: .3, anchor: 'middle' }) + T(mx + mw * volF(-12), 41, '12', { f: 'm', size: 7, a: .3, anchor: 'middle' })
  /* the right end: who is in the room, hand off, the switch for the paper window */
  const [k2, w2] = switchKey(0, 0, 'slur', Ly.s > .5, BLUE, 'o'), sx = W - 14 - w2
  s += G(k2, `translate(${sx} 12)`) + (HITS ? hit(sx, 12, w2, 24, 'slur') : '')
  const hw = Math.round(tw('hand off', 'g', 10.5) + 22), hx = sx - 8 - hw
  s += R(hx + .5, 12.5, hw - 1, 23, { rx: 2, fill: CELL, stroke: INK, sa: .26 }) + T(hx + 11, 27.7, 'hand off', { size: 10.5, a: .9 }) + vline(hx - 12, 12, 36, .1)
  ;[[INK, false], [ROSE, false], [YELLOW, true], [LILAC, true]].forEach(([c, hollow], i) => { s += P(wholeNote(hx - 96 + i * 20, 24, 6.5, hollow), { fill: c, rule: 'evenodd', fa: hollow ? .8 : 1 }) })
  return s + hline(0, W, BAR_H - .5, .14)
}

/* ── the tracks' own bar ── */
function pTool (Ly) {
  const y = Ly.toolY, cy = y + TOOL_H / 2 + 3.5, lab = { size: 9.5, a: .45 }
  let s = R(0, y, Ly.R, TOOL_H, { fill: BARC })
  s += R(12.5, y + 4.5, 19, 19, { rx: 2, fill: CELL, stroke: INK, sa: .22 }) + P(`M22 ${y + 10}V${y + 18}M18 ${y + 14}H26`, { stroke: INK, sa: .85, sw: 1.2 })
  s += T(42, cy, 'tracks', lab) + T(42 + tw('tracks', 'g', 9.5) + 6, cy, String(TRACKS.length), { f: 'm', size: 9.5, a: .75 })
  let x = HEAD_W + 12
  s += cellRow(x, y + 4, [{ t: 'auto' }, { t: 'flex' }], 40, 20, 9.5); x += 80 + 16
  const put = (label, word) => { s += T(x, cy, label, lab); x += tw(label, 'g', 9.5) + 6; const [k, w] = dropKey(x, y + 4, word); s += k; x += w + 14 }
  put('tool', 'pointer'); put('⌘', 'marquee'); put('snap', 'smart')
  /* what is chosen on the lanes: its name and its numbers */
  s += vline(x, y + 6, y + TOOL_H - 6, .12); x += 14
  const fld = (label, v) => { s += T(x, cy, label, lab); x += tw(label, 'g', 9.5) + 6; s += T(x, cy, v, { f: 'm', size: 10, a: .9 }); x += tw(v, 'm', 10) + 14 }
  const zx0 = Ly.x1 - 150 - 34
  for (const [l, v] of [['region', 'take 3'], ['gain', '0.0'], ['transpose', '0'], ['fade', '0 0']]) { if (x + tw(l, 'g', 9.5) + 6 + tw(v, 'm', 10) > zx0) break; fld(l, v) }
  /* zoom, both ways, at the far end */
  const zx = Ly.x1 - 150
  if (zx > x) {
    const zy = y + TOOL_H / 2
    s += P(`M${zx - 14} ${zy}H${zx - 6}M${zx - 12} ${zy - 2}L${zx - 14} ${zy}L${zx - 12} ${zy + 2}M${zx - 8} ${zy - 2}L${zx - 6} ${zy}L${zx - 8} ${zy + 2}`, { stroke: INK, sa: .5, cap: 'round' }) + R(zx, zy - 1.5, 60, 3, { rx: 1, fill: INK, fa: .12 }) + R(zx + 17, zy - 5.5, 3, 11, { rx: 1, fill: INK })
    const vx = zx + 86
    s += P(`M${vx - 10} ${zy - 4}V${zy + 4}M${vx - 12} ${zy - 2}L${vx - 10} ${zy - 4}L${vx - 8} ${zy - 2}M${vx - 12} ${zy + 2}L${vx - 10} ${zy + 4}L${vx - 8} ${zy + 2}`, { stroke: INK, sa: .5, cap: 'round' }) + R(vx, zy - 1.5, 60, 3, { rx: 1, fill: INK, fa: .12 }) + R(vx + 22, zy - 5.5, 3, 11, { rx: 1, fill: INK })
  }
  return s + hline(0, Ly.R, y + TOOL_H - .5, .1) + vline(HEAD_W - .5, y, y + TOOL_H, .1)
}

/* ── scenes, and the bars ── */
function pRuler (Ly, cid) {
  const y = Ly.scY, y2 = Ly.ruY, cur = SCENES.findIndex(sc => POS + 1 >= sc.a && POS + 1 < sc.b)
  let s = R(0, y, Ly.R, SC_H + RU_H, { fill: WALL })
  s += T(14, y + 13.5, 'scenes', { size: 9.5, a: .45 }) + T(14, y2 + 15.5, 'bars', { size: 9.5, a: .45 }) + T(HEAD_W - 12, y2 + 15.5, '4/4', { f: 'm', size: 9, a: .4, anchor: 'end' })
  let g = ''
  SCENES.forEach((sc, i) => {
    const xa = bxOf(Ly, sc.a), w = (sc.b - sc.a) * PXB, on = i === cur
    g += R(xa + .5, y + 2, w - 1, SC_H - 4, { rx: 2, fill: on ? ORANGE : INK, fa: on ? 1 : .07 })
    g += T(xa + 7, y + 13.5, sc.name, { size: 9.5, w: on ? 500 : 400, c: on ? WALL : INK, a: on ? 1 : .7 })
  })
  let t = '', lab = ''
  for (let b = 0; b <= 90; b++) {
    const x = bxOf(Ly, b + 1)
    if (x > Ly.x1 + 1) break
    t += `M${n(x) + .5} ${b % 4 === 0 ? y2 + 12 : y2 + 18}V${y2 + RU_H}`
    if (b % 4 === 0) lab += T(x + 4, y2 + 17, String(b + 1), { f: 'm', size: 9, a: b < 42 ? .62 : .25 })
  }
  /* the cycle: its stretch of the upper half of the ruler, with an end to take hold of at each side */
  const ca = bxOf(Ly, 17), cb = bxOf(Ly, 25)
  g += R(ca, y2 + 2, cb - ca, 6, { rx: 1, fill: YELLOW, fa: .85 }) + R(ca, y2 + 2, 2, 6, { fill: WALL, fa: .5 }) + R(cb - 2, y2 + 2, 2, 6, { fill: WALL, fa: .5 })
  g += P(t, { stroke: INK, sa: .28 }) + lab
  s += G(g, '', ` clip-path="url(#${cid})"`)
  return s + hline(0, Ly.R, y + SC_H - .5, .06) + hline(0, Ly.R, y2 + RU_H - .5, .12) + vline(HEAD_W - .5, y, y2 + RU_H, .1)
}

/* ── one track's head ── */
function headRow (t, k, y) {
  const sel = k === SEL, bus = !!t.kind, x0 = t.child ? 52 : 42, l1 = y + 16, fy = y + 29
  let s = ''
  if (sel) s += R(0, y, HEAD_W, ROW, { fill: INK, fa: .065 })
  s += R(0, y + .5, 3, ROW - 1, { fill: t.c, fa: sel ? 1 : .7 })
  s += T(11, l1 - .5, String(k + 1).padStart(2, '0'), { f: 'm', size: 8.5, a: sel ? .75 : .38 })
  if (t.kind === 'stack') s += P(`M${x0 - 15} ${l1 - 6.5}H${x0 - 7}L${x0 - 11} ${l1 - 1}Z`, { fill: INK, fa: .7 })
  else s += P(wholeNote(x0 - 11, l1 - 4, 4.2, bus), { fill: bus ? INK : t.own, rule: 'evenodd', fa: bus ? .8 : 1 })
  const own = !bus && !t.theirs, bx0 = own ? 164 : 198
  const nm = fitText(t.name, bx0 - x0 - 8 - (t.theirs ? tw(t.theirs, 'g', 9.5) + 6 : t.kind ? tw(t.kind, 'g', 9.5) + 6 : 0), 'g', 11.5, 500)
  s += T(x0, l1, nm, { size: 11.5, w: 500, a: t.mute ? .5 : sel ? 1 : .92 })
  const tag = t.theirs || t.kind
  if (tag) s += T(x0 + tw(nm, 'g', 11.5, 500) + 6, l1, tag, { size: 9.5, a: .42 })
  s += cellRow(bx0, y + 5, (own ? [{ t: 'r', on: !!t.arm, c: ROSE }, { t: 'i' }] : []).concat([{ t: 'm', on: !!t.mute }, { t: 's', on: false, c: YELLOW }]), 17, 15, 9)
  /* line two: the level (the fader stands on its meter), where it sits, what it reads */
  const fw = 150 - x0
  s += meterH(x0, fy - 2, fw, t.m || 0, volF(t.vol))
  s += panKnob(170, fy, 6, t.pan || 0)
  s += T(232, fy + 3.5, fmtDb(t.vol), { f: 'm', size: 9.5, a: .68, anchor: 'end' })
  return s + hline(0, HEAD_W, y + ROW - .5, .07)
}
function midi (r, w, ly, lh) {
  let d = ''
  const len = r[1] - r[0], off = r[0] - 1
  for (let k = Math.floor(off); k < off + len; k++) {
    const ch = KEY_CHORDS[((k % 4) + 4) % 4], x0 = (k - off) * PXB
    for (const [st, ln] of KEY_HITS) if (ln > 3) for (const m of ch) { const a = Math.max(x0 + (st / 16) * PXB + 1.5, 1), b = Math.min(x0 + (st / 16) * PXB + (ln / 16) * PXB + .5, len * PXB - 1); if (b - a > 1) d += `M${n(a)} ${n(ly + lh - 4 - (m - 53) * (lh - 8) / 18)}H${n(b)}` }
  }
  return d
}
/* a region's sound as one filled shape: the peaks above the line, mirrored below it */
function wave (t, r, w, yc, hmax) {
  const lp = LOOPS[t.buf], len = r[1] - r[0], steps = Math.max(2, Math.floor(w - 2)), pk = loopPeaks(lp, r[0] - 1, r[0] - 1 + len, steps), norm = lp.peak || (lp.peak = peakOf(lp.ch))
  let up = '', dn = ''
  for (let i = 0; i < steps; i++) { const h = Math.max(.5, Math.min(1, pk[i] / norm) * hmax); up += `${i ? 'L' : 'M'}${1 + i} ${n(yc - h)}`; dn = `L${1 + i} ${n(yc + h)}` + dn }
  return up + dn + 'Z'
}
function laneRow (Ly, t, k, y) {
  const ly = y + 2, lh = ROW - 4, HS = 11
  let s = ''
  if (t.kind === 'stack') {
    const kids = TRACKS.filter(c => c.child)
    kids.forEach((c, j) => { const yy = ly + 9 + j * (lh - 20) / (kids.length - 1); for (const r of c.regs) s += R(bxOf(Ly, r[0]) + .75, yy, (r[1] - r[0]) * PXB - 1.5, 2.5, { rx: 1, fill: c.c, fa: .85 }) })
  } else if (t.kind === 'bus') s += P(`M${Ly.x0} ${n(y + ROW / 2)}H${bxOf(Ly, 43)}`, { stroke: INK, sa: .12, dash: '2 5' })
  t.regs.forEach((r, ri) => {
    const x = n(bxOf(Ly, r[0]) + .5), w = n((r[1] - r[0]) * PXB - 1), chosen = SELREG[0] === k && SELREG[1] === ri, name = r[2] || t.name
    let q = ''
    if (t.theirs) {
      /* someone else's: drawn in outline, their colour */
      q += R(x + .5, ly + .5, w - 1, lh - 1, { rx: 2, fill: t.c, fa: .07, stroke: t.c, sa: .8 }) + P(`M${x + 1} ${ly + HS + .5}H${x + w - 1}`, { stroke: t.c, sa: .45 })
      q += T(x + 5, ly + 8.5, fitText(name, w - 10, 'g', 8.5, 500), { size: 8.5, w: 500, c: t.c })
      q += G(P(wave(t, r, w, ly + HS + (lh - HS) / 2, (lh - HS) / 2 - 2.5), { fill: t.c, fa: .8 }), `translate(${x} 0)`)
    } else {
      /* one's own: a filled body under a full strip of the track's colour that carries the name */
      q += R(x, ly, w, lh, { rx: 2, fill: t.c, fa: .2 }) + R(x, ly, w, HS, { rx: 2, fill: t.c }) + R(x, ly + HS - 3, w, 3, { fill: t.c })
      q += T(x + 5, ly + 8.5, fitText(name, w - 10, 'g', 8.5, 500), { size: 8.5, w: 500, c: WALL })
      q += G(t.midi ? P(midi(r, w, ly + HS, lh - HS), { stroke: t.c, sw: 2 }) : P(wave(t, r, w, ly + HS + (lh - HS) / 2, (lh - HS) / 2 - 2.5), { fill: t.c, fa: .95 }), `translate(${x} 0)`)
    }
    if (chosen) q += R(x + .5, ly + .5, w - 1, lh - 1, { rx: 2, stroke: INK, sw: 1.4 })
    s += t.mute ? G(q, '', ' opacity=".32"') : q
  })
  return s
}
function pTracks (Ly, cidH, cidL, cidT) {
  const y0 = Ly.lnY, visH = Ly.B - y0, all = TRACKS.length * ROW
  let s = R(Ly.x0, y0, Ly.R - Ly.x0, Math.max(0, visH), { fill: LANE }) + R(0, y0, HEAD_W, Math.max(0, visH), { fill: WALL })
  let heads = '', lanes = '', bands = '', l1 = '', l4 = ''
  for (let b = 0; b <= 90; b++) {
    const x = bxOf(Ly, b + 1)
    if (x > Ly.x1 + PXB) break
    if (b % 8 === 4) bands += R(x, y0, 4 * PXB, visH, { fill: INK, fa: .014 })
    if (b % 4 === 0) l4 += `M${n(x) + .5} ${y0}V${Ly.B}`; else l1 += `M${n(x) + .5} ${y0}V${Ly.B}`
  }
  TRACKS.forEach((t, k) => {
    const y = y0 + k * ROW
    if (y >= Ly.B) return
    heads += headRow(t, k, y)
    if (k === SEL) lanes += R(Ly.x0, y, Ly.R - Ly.x0, ROW, { fill: INK, fa: .028 })
    lanes += laneRow(Ly, t, k, y) + hline(Ly.x0, Ly.R, y + ROW - .5, .055)
  })
  s += G(bands + P(l1, { stroke: INK, sa: .035 }) + P(l4, { stroke: INK, sa: .085 }) + P(`M${n(bxOf(Ly, 43)) + .5} ${y0}V${Ly.B}`, { stroke: INK, sa: .22 }) + lanes, '', ` clip-path="url(#${cidL})"`) + G(heads, '', ` clip-path="url(#${cidH})"`)
  s += vline(HEAD_W - .5, y0, Ly.B, .12)
  /* where the window sits: along the song, and among the rows */
  if (visH > 30) {
    const sw = Ly.x1 - Ly.x0 - 4, span = Math.max(43, sw / PXB)
    s += R(Ly.x0 + 2, Ly.B - 7, sw, 4, { rx: 2, fill: INK, fa: .05 }) + R(Ly.x0 + 2, Ly.B - 7, sw * Math.min(1, (sw / PXB) / (span + 12)), 4, { rx: 2, fill: INK, fa: .26 })
    if (all > visH + 1) s += R(Ly.R - 7, y0 + 2, 4, visH - 12, { rx: 2, fill: INK, fa: .05 }) + R(Ly.R - 7, y0 + 2, 4, (visH - 12) * visH / all, { rx: 2, fill: INK, fa: .26 })
  }
  const px = bxOf(Ly, POS + 1)
  s += G(P(`M${n(px) + .5} ${Ly.ruY + 6}V${Ly.B}`, { stroke: INK, sa: .95 }) + P(`M${n(px - 4.5)} ${Ly.ruY + 3}H${n(px + 5.5)}V${Ly.ruY + 8}L${n(px + .5)} ${Ly.ruY + 13}L${n(px - 4.5)} ${Ly.ruY + 8}Z`, { fill: INK }), '', ` clip-path="url(#${cidT})"`)
  return s
}

/* ── a channel strip, from the top: what comes in, its patch, what it borrows, what it sends, where it goes; where it sits;
   its fader on a scale beside its meter; what it reads; its four cells; its name. The words for the rows stand once, in a gutter at the left ── */
const PRINTS = [['tape', CREAM], ['space', SPACE], ['delay', MINT]]
function stripGutter (x, y) {
  let s = ''
  ;['in', 'patch', 'ins', '', 'send', 'out'].forEach((l, i) => { if (l) s += T(x + GUT - 5, y + 6 + i * SLOT_P + 10.6, l, { size: 8, a: .4, anchor: 'end' }) })
  return s + T(x + GUT - 5, y + 6 + 6 * SLOT_P + 16, 'pan', { size: 8, a: .4, anchor: 'end' })
}
function strip (x, y, w, h, t, o = {}) {
  const cx = x + w / 2, sw = w - 10, sx = x + 5, fx = cx - 9
  let s = '', yy = y + 6
  const full = (txt, c, lvl) => {
    s += R(sx + .5, yy + .5, sw - 1, SLOT_H - 1, { rx: 2, fill: CELL, stroke: INK, sa: .2 })
    s += T(sx + 6, yy + 10.7, fitText(txt, sw - 12 - (lvl != null ? 22 : 0), 'g', 9), { size: 9, a: .9, c: c || INK })
    if (lvl != null) s += T(sx + sw - 5, yy + 10.5, lvl, { f: 'm', size: 7.5, a: .55, anchor: 'end' })
  }
  const well = () => { s += R(sx, yy, sw, SLOT_H, { rx: 2, fill: DEEP, fa: .6 }) }
  const row = f => { f(); yy += SLOT_P }
  if (o.master) { yy += 5 * SLOT_P; row(() => full('output 1-2')) }
  else {
    row(() => full(t.kind === 'stack' ? '3 tracks' : t.kind === 'bus' ? '4 sends' : t.theirs ? t.theirs : 'input 1', t.theirs ? t.c : null))
    row(() => {
      const pr = t.patch || []
      if (!pr.length) return well()
      s += R(sx + .5, yy + .5, sw - 1, SLOT_H - 1, { rx: 2, fill: CELL, stroke: INK, sa: .2 })
      PRINTS.forEach(([k, c], i) => { const lx = sx + 7 + i * 11; s += pr.includes(k) ? R(lx, yy + 4.5, 6, 6, { fill: c }) : R(lx + .5, yy + 5, 5, 5, { stroke: INK, sa: .22 }) })
    })
    const ins = t.ins || [], sd = (t.sends || [])[0]
    row(() => ins[0] ? full(ins[0]) : well())
    row(() => ins[1] ? full(ins[1]) : well())
    row(() => sd ? full(sd[0], null, String(sd[1]).replace('-', '−')) : well())
    row(() => full(t.out))
  }
  /* where it sits: the knob stands over the fader, its number over the meter */
  const py = yy + 13
  if (!o.master) s += panKnob(fx, py, 8, t.pan || 0) + T(fx + 15, py + 3, panText(t.pan || 0), { f: 'm', size: 8, a: .62 })
  yy = py + 14
  /* the fader on its scale, the meter beside it */
  const fb = y + h - 44, ft = yy + 4, fh = fb - ft, yOf = db => fb - fh * volF(db)
  let tk = ''
  for (const db of [6, 0, -6, -12, -24, -48]) { tk += `M${fx - 9} ${n(yOf(db)) + .5}H${fx - 5}`; s += T(fx - 12, yOf(db) + 2.8, db === -48 ? '∞' : String(Math.abs(db)), { f: 'm', size: 7, a: db === 0 ? .7 : .32, anchor: 'end' }) }
  s += P(tk, { stroke: INK, sa: .3 }) + R(fx - 1.5, ft, 3, fh, { rx: 1.5, fill: DEEP, stroke: INK, sa: .14 })
  const fy = yOf(t.vol)
  s += R(fx - 8, fy - 5, 16, 10, { rx: 2, fill: INK }) + P(`M${fx - 5} ${n(fy) + .5}H${fx + 5}`, { stroke: WALL, sa: .8 })
  const lv = t.m || 0, mxx = fx + 16, f6 = volF(-6), bw = o.master ? 5 : 3.5
  ;[lv, lv * .94].forEach((v, i) => {
    const x2 = mxx + i * (bw + 1.5)
    s += R(x2, ft, bw, fh, { fill: INK, fa: .09 })
    if (v > 0) {
      s += R(x2, fb - fh * Math.min(v, f6), bw, fh * Math.min(v, f6), { fill: GREEN, fa: .9 })
      if (v > f6) s += R(x2, fb - fh * v, bw, fh * (v - f6), { fill: YELLOW, fa: .9 })
      s += R(x2, fb - fh * Math.min(1, v + .06) - 1, bw, 1.2, { fill: INK, fa: .7 })
    }
  })
  /* what it reads; its cells */
  s += R(sx + .5, fb + 6.5, sw - 1, 13, { rx: 2, fill: DEEP, stroke: INK, sa: .16 }) + T(cx, fb + 16, fmtDb(t.vol), { f: 'm', size: 8.5, a: .9, anchor: 'middle' })
  if (!o.master) {
    const own = !t.kind && !t.theirs, its = (own ? [{ t: 'r', on: !!t.arm, c: ROSE }, { t: 'i' }] : []).concat([{ t: 'm', on: !!t.mute }, { t: 's', c: YELLOW }]), cwid = Math.floor(sw / its.length)
    s += cellRow(sx + (sw - cwid * its.length) / 2, fb + 23, its, cwid, 13, 8.5)
  }
  return s
}
function stripName (x, y, w, t, sel) {
  const c = t.c === INK ? '#C9C4B8' : t.c
  return R(x + 5, y, w - 10, 15, { rx: 2, fill: c, fa: t.mute ? .4 : sel ? 1 : .88 }) + T(x + w / 2, y + 10.8, fitText(t.name, w - 18, 'g', 9, 500), { size: 9, w: 500, c: WALL, anchor: 'middle' })
}
const MASTER = { name: 'stereo out', c: INK, vol: -4.2, pan: 0, m: .7 }

/* ── the bottom panel ── */
function pPanelHead (Ly, tab) {
  const y = Ly.B, t = TRACKS[SEL]
  let s = R(0, y, Ly.R, PH, { fill: BARC }) + hline(0, Ly.R, y, .16) + hline(0, Ly.R, y + PH - .5, .1)
  /* the edge that is dragged to give the panel more of the window, or less */
  s += R(Ly.R / 2 - 13, y + 2, 26, 2, { rx: 1, fill: INK, fa: .22 })
  s += cellRow(12, y + 4, [{ t: 'patch', on: tab === 'patch' }, { t: 'mixer', on: tab === 'mixer' }], 52, 20, 10)
  if (HITS) s += hit(12, y + 4, 52, 20, 'tab-patch') + hit(64, y + 4, 52, 20, 'tab-mixer')
  if (tab === 'patch') {
    s += R(132, y + 10.5, 7, 7, { fill: t.c }) + T(146, y + 18, t.name, { size: 11.5, w: 500 }) + T(146 + tw(t.name, 'g', 11.5, 500) + 8, y + 18, 'track 06', { size: 9.5, a: .42 })
    const rx = Ly.R - SIDE
    let x = rx - 14
    const kw = keyW('plug-ins'); x -= kw; s += key(x, y + 4, 'plug-ins', { h: 20 })[0]
    x -= 150
    s += T(x, y + 17.5, 'scene', { size: 9.5, a: .45 }) + T(x + 38, y + 17.5, 'a', { f: 'm', size: 10, c: ORANGE }) + R(x + 50, y + 12.5, 70, 3, { rx: 1, fill: INK, fa: .14 }) + R(x + 49, y + 8.5, 3, 11, { rx: 1, fill: INK }) + T(x + 127, y + 17.5, 'b', { f: 'm', size: 10, a: .55 })
    s += vline(rx - .5, y + 6, y + PH - 6, .1) + T(rx + 12, y + 17.5, 'strip', { size: 9.5, a: .45 })
  } else s += T(132, y + 17.5, 'strips', { size: 9.5, a: .45 }) + T(132 + tw('strips', 'g', 9.5) + 6, y + 17.5, String(TRACKS.length), { f: 'm', size: 9.5, a: .75 })
  return s
}
function loan (cx, cy, r, name) {
  let s = R(cx - r + .5, cy - r + .5, 2 * r - 1, 2 * r - 1, { rx: 2, fill: CELL, stroke: INK, sa: .6 }) + R(cx - r + 6.5, cy - r + 6.5, 2 * r - 13, 2 * r - 13, { fill: WALL, fa: .7, stroke: INK, sa: .2 })
  const words = name.split(' ')
  words.forEach((ln, i) => { s += T(cx, cy + 3.3 + (i - (words.length - 1) / 2) * 12, ln, { size: 9.5, w: 500, anchor: 'middle' }) })
  return s + R(cx + r - 9, cy - r + 4, 5, 5, { fill: GREEN })
}
function pPatch (Ly, cid) {
  const y = Ly.B + PH, h = PANEL_H - PH, t = TRACKS[SEL], MID = y + 140, NR = 32, e = NR + 6, rx = Ly.R - SIDE
  let s = R(0, y, Ly.R, h, { fill: WALL })
  /* the wall the prints hang on: a field of points, as on a patch bay */
  let dots = ''
  for (let gx = 20; gx < rx - 8; gx += 20) for (let gy = y + 14; gy < y + h - 6; gy += 20) dots += `M${gx} ${gy}h.01`
  const nodes = [
    { k: 'tape', x: 176, y: MID, c: CREAM, amt: 24, cap: ['tape', '24'] },
    { k: 'space', x: 322, y: MID - 58, c: SPACE, amt: 46, cap: ['space', 'hall 46 3.70s'] },
    { k: 'delay', x: 322, y: MID + 54, c: MINT, amt: 30, cap: ['delay', '1/8 30 fb 35'] },
    { k: 'mix', x: 468, y: MID, c: AMBER, amt: 100, cap: ['mix', 'space 62 delay 38'] },
  ]
  let lamps = '', defs = ''
  for (const q of nodes) { const id = 'lg' + (++UID), o = q.k === 'mix' ? .16 : .03 + .24 * q.amt / 100; defs += `<radialGradient id="${id}"><stop offset="0" stop-color="${q.c}" stop-opacity="${n(o)}"/><stop offset="1" stop-color="${q.c}" stop-opacity="0"/></radialGradient>`; lamps += `<ellipse cx="${q.x}" cy="${q.y + 20}" rx="96" ry="128" fill="url(#${id})"/>` }
  const wire = (ax, ay, bx2, by, c) => { const dx = Math.max(24, (bx2 - ax) * .5); return P(`M${ax} ${ay}C${n(ax + dx)} ${ay} ${n(bx2 - dx)} ${by} ${bx2} ${by}`, { stroke: c, sa: .8, sw: 1.2 }) + Cc(ax, ay, 2.4, { fill: SL.white }) + Cc(bx2, by, 2.4, { fill: SL.white }) }
  const [tp, sp, dl, mx] = nodes, inX = 48, lx = 598, addX = 692, outX = 786
  let g = defs + lamps
  g += Cc(inX, MID, 5, { fill: SL.white }) + T(inX, MID + 21, 'in', { size: 9.5, a: .6, anchor: 'middle' }) + P(`M${inX + 8} ${MID}H${tp.x - e}`, { stroke: INK, sa: .75, sw: 1.2 }) + Cc(tp.x - e, MID, 2.4, { fill: SL.white })
  g += wire(tp.x + e, tp.y, sp.x - e, sp.y, SPACE) + wire(tp.x + e, tp.y, dl.x - e, dl.y, MINT) + wire(sp.x + e, sp.y, mx.x - e, mx.y, SPACE) + wire(dl.x + e, dl.y, mx.x - e, mx.y, MINT)
  g += P(`M${mx.x + e} ${MID}H${lx - e}`, { stroke: AMBER, sa: .8, sw: 1.2 }) + Cc(mx.x + e, MID, 2.4, { fill: SL.white }) + Cc(lx - e, MID, 2.4, { fill: SL.white })
  g += loan(lx, MID, NR, 'channel eq') + caption(lx, MID + NR + 18, 'channel eq', 'au')
  /* a free place for the next thing borrowed */
  g += P(`M${lx + e} ${MID}H${addX - e}`, { stroke: INK, sa: .75, sw: 1.2 }) + Cc(lx + e, MID, 2.4, { fill: SL.white }) + Cc(addX - e, MID, 2.4, { fill: SL.white })
  g += R(addX - NR + .5, MID - NR + .5, 2 * NR - 1, 2 * NR - 1, { rx: 2, stroke: INK, sa: .3, dash: '3 3' }) + P(`M${addX} ${MID - 6}V${MID + 6}M${addX - 6} ${MID}H${addX + 6}`, { stroke: INK, sa: .6, sw: 1.2 })
  g += P(`M${addX + e} ${MID}H${outX - 8}`, { stroke: INK, sa: .75, sw: 1.2 }) + Cc(addX + e, MID, 2.4, { fill: SL.white }) + Cc(outX, MID, 5, { fill: SL.white }) + T(outX, MID + 21, 'out', { size: 9.5, a: .6, anchor: 'middle' })
  for (const q of nodes) g += plate(q.k, q.x, q.y, NR) + caption(q.x, q.y + NR + 18, q.cap[0], q.cap[1])
  /* the chain stands in the middle of the room it is given */
  const shift = Math.max(0, Math.round(rx / 2 - 417))
  s += G(P(dots, { stroke: INK, sa: .13, sw: 1.4, cap: 'round' }) + G(g, `translate(${shift} 0)`), '', ` clip-path="url(#${cid})"`)
  /* at the right: the chosen track's strip, and the strip of where it plays */
  s += R(rx, y, Ly.R - rx, h, { fill: BARC, fa: .55 }) + vline(rx - .5, y, y + h, .1)
  const sw2 = 90, sy = y + 4, sh = h - 28, x1 = rx + GUT + 4, x2 = x1 + sw2 + 6
  s += stripGutter(rx + 4, sy)
  s += R(x1, y, sw2, h, { fill: INK, fa: .05 }) + strip(x1, sy, sw2, sh, t) + stripName(x1, y + h - 21, sw2, t, true)
  s += vline(x1 + sw2 + 2.5, y + 8, y + h - 8, .08)
  s += strip(x2, sy, sw2, sh, MASTER, { master: true }) + stripName(x2, y + h - 21, sw2, MASTER, false)
  return s
}
function pMixer (Ly) {
  const y = Ly.B + PH, h = PANEL_H - PH, sw2 = 88, sh = h - 28, gx = 8
  let s = R(0, y, Ly.R, h, { fill: WALL })
  const mx = Ly.R - 10 - sw2, room = mx - 12 - (gx + GUT), nShow = Math.min(TRACKS.length, Math.floor(room / sw2))
  s += stripGutter(gx, y + 4) + vline(gx + GUT - .5, y + 8, y + h - 8, .07)
  TRACKS.slice(0, nShow).forEach((t, k) => {
    const x = gx + GUT + k * sw2
    if (k === SEL) s += R(x, y, sw2, h, { fill: INK, fa: .05 })
    s += strip(x, y + 4, sw2, sh, t) + stripName(x, y + h - 21, sw2, t, k === SEL) + vline(x + sw2 - .5, y + 8, y + h - 8, .07)
  })
  s += R(mx - 6, y, Ly.R - mx + 6, h, { fill: BARC, fa: .55 }) + vline(mx - 6.5, y, y + h, .1)
  s += strip(mx, y + 4, sw2, sh, MASTER, { master: true }) + stripName(mx, y + h - 21, sw2, MASTER, false)
  return s
}

/* ── slur, a paper window at the right ── */
function stemWave (x0, yc, seed, shape, wpx) {
  const r = srand(seed)
  let d = ''
  for (let i = 0; i < 100; i++) { const env = shape === 'arch' ? Math.sin(Math.PI * i / 100) * .7 + .3 : Math.abs(Math.sin(Math.PI * i / 33)) * .75 + .2, hh = Math.max(1.4, (r() * .8 + .2) * 18 * env); d += `M${n(x0 + i * wpx / 100)} ${n(yc - hh / 2)}v${n(hh)}` }
  return d
}
function pSlur (Ly) {
  const x = Ly.R + 10, y = BAR_H + 10, w = SLUR_W - 20, h = H - STAT_H - BAR_H - 20, px = x + 18
  const I = (xx, yy, t, oo) => T(xx, yy, t, Object.assign({ f: 'i', c: SL.ink, size: 12 }, oo || {}))
  let s = R(Ly.R, BAR_H, W - Ly.R, H - BAR_H - STAT_H, { fill: WALL }) + vline(Ly.R - .5, BAR_H, H - STAT_H, .12) + R(x, y, w, h, { rx: 14, fill: SL.white })
  s += I(px, y + 34, 'night bus ep', { size: 17, w: 600 })
  s += run(px, y + 52, [['4 members', { f: 'i', size: 10.5, c: SL.t3 }], ['2 in the studio now', { f: 'i', size: 10.5, c: SL.green }]], 6)[0]
  ;[[SL.ink, false], [ROSE, false], [YELLOW, false], [LILAC, false]].forEach(([c], i) => { s += Cc(x + w - 26 - i * 15, y + 34, 9, { fill: c, stroke: SL.white, sw: 2 }) })
  s += P(`M${x + 1} ${y + 68.5}H${x + w - 1}`, { stroke: SL.ink, sa: .08 })
  let my = y + 92
  s += I(x + w / 2, my, 'today', { size: 10, c: SL.t3, anchor: 'middle' })
  my += 20
  const cw = w - 36 - 28
  const stem = c => {
    s += I(px + 32, my, c.who, { size: 10, c: SL.t3 }); my += 8
    s += R(px + 28, my, cw, 86, { rx: 12, fill: SL.bub }) + I(px + 40, my + 22, c.title, { w: 600, size: 11.5 }) + I(px + 28 + cw - 12, my + 22, c.len, { c: SL.t3, anchor: 'end', size: 11 })
    s += P(stemWave(px + 40, my + 43, c.seed, c.shape, cw - 24), { stroke: SL.ink, sw: 1.3, cap: 'round' })
    s += run(px + 40, my + 71, [[`bar ${c.bar}`, { f: 'i', size: 10, c: SL.t3 }], ['48k', { f: 'i', size: 10, c: SL.t3 }], [`place at bar ${c.bar}`, { f: 'i', size: 10, c: SL.green, w: 500 }]], 9)[0]
    s += Cc(px + 11, my + 75, 11, { fill: c.av })
    my += 96
  }
  const bubble = (t, mine, av) => {
    const bw = tw(t, 'i', 12) + 24, bh = 32, bx0 = mine ? x + w - 18 - bw : px + 28
    s += R(bx0, my, bw, bh, { rx: 13, fill: mine ? SL.ink : SL.bub }) + R(mine ? bx0 + bw - 13 : bx0, my + bh - 13, 13, 13, { rx: 4, fill: mine ? SL.ink : SL.bub }) + I(bx0 + 12, my + 20.5, t, { size: 12, c: mine ? SL.white : SL.ink })
    if (av) s += Cc(px + 11, my + bh - 11, 11, { fill: av })
    my += bh + 9
  }
  stem({ who: 'jun', av: ROSE, title: 'guitar verse 2', len: '0:21', bar: 25, seed: 7, shape: 'arch' })
  bubble('try it under verse 2', false, ROSE); bubble('placing it now', true)
  my += 12
  stem({ who: 'minseo', av: YELLOW, title: 'hum double', len: '0:21', bar: 33, seed: 23, shape: 'phr' })
  bubble('doubled the last chorus', false, YELLOW); bubble('rehearsal fri 7pm?', false, YELLOW); bubble('yes. bringing the stage set', true)
  /* where a word is written back */
  const cy = y + h - 50
  s += P(`M${x + 1} ${cy - 10.5}H${x + w - 1}`, { stroke: SL.ink, sa: .08 }) + R(px, cy, w - 36 - 44, 34, { rx: 17, fill: SL.bub }) + Cc(x + w - 18 - 17, cy + 17, 17, { fill: SL.ink }) + P(`M${x + w - 35} ${cy + 23}V${cy + 11}M${x + w - 40} ${cy + 16}L${x + w - 35} ${cy + 11}L${x + w - 30} ${cy + 16}`, { stroke: SL.white, sw: 1.6, cap: 'round' })
  return s
}

/* ── the foot: say it; and how the machine stands ── */
function pFoot () {
  const y = H - STAT_H, cy = y + 15.5
  let s = R(0, y, W, STAT_H, { fill: BARC }) + hline(0, W, y, .14) + P(slurPath(16, y + 16, 34, y + 16, 6.5, 2), { fill: BLUE }) + T(46, cy, 'kick -3 db', { f: 'm', size: 11, a: .92 })
  const said = [['kick', { size: 10, w: 500 }], ['−1.5', { f: 'm', size: 10, a: .5 }], ['to', { size: 9, a: .42 }], ['−4.5', { f: 'm', size: 10, c: BLUE }], ['db', { size: 8.5, a: .42 }]]
  s += run(150, cy, said, 5)[0]
  let x = W - 14
  const kw = keyW('keys', { size: 9.5 }); x -= kw; s += key(x, y + 3, 'keys', { h: 18, size: 9.5 })[0]
  const cell = (label, v, extra) => { const wv = v ? tw(v, 'm', 9.5) : 0, wl = tw(label, 'g', 9); x -= 14; s += vline(x, y + 6, y + STAT_H - 6, .12); x -= 12 + wv; if (v) s += T(x, cy, v, { f: 'm', size: 9.5, a: .8 }); if (extra) { x -= extra.w + 6; s += extra.draw(x) } x -= wl + (v || extra ? 6 : 0); s += T(x, cy, label, { size: 9, a: .45 }) }
  cell('saved', '')
  cell('buffer', '512')
  cell('rate', '48k 24 bit')
  cell('cpu', '12%', { w: 36, draw: xx => R(xx, y + 10.5, 36, 3, { rx: 1, fill: INK, fa: .12 }) + R(xx, y + 10.5, 5, 3, { rx: 1, fill: GREEN }) })
  return s
}

/* the whole window */
function render (p, s, tab = 'patch') {
  const Ly = layout(p, s), a = 'c' + (++UID), b = 'c' + (++UID), c = 'c' + (++UID), d = 'c' + (++UID)
  const lanesH = Math.max(0, Ly.B - Ly.lnY), laneW = Math.max(0, Ly.R - Ly.x0)
  let out = `<defs><clipPath id="${a}"><rect x="0" y="${Ly.lnY}" width="${HEAD_W}" height="${n(lanesH)}"/></clipPath><clipPath id="${b}"><rect x="${Ly.x0}" y="${Ly.lnY}" width="${n(laneW)}" height="${n(lanesH)}"/></clipPath><clipPath id="${c}"><rect x="${Ly.x0}" y="${Ly.scY}" width="${n(laneW)}" height="${n(Math.max(0, Ly.B - Ly.scY))}"/></clipPath><clipPath id="${d}"><rect x="0" y="${n(Ly.B + PH)}" width="${n(Math.max(0, Ly.R - SIDE))}" height="${PANEL_H - PH}"/></clipPath></defs>`
  out += R(0, 0, W, H, { fill: WALL })
  out += pTracks(Ly, a, b, c) + pRuler(Ly, c) + pTool(Ly)
  if (p > .001) out += (tab === 'mixer' ? pMixer(Ly) : pPatch(Ly, d)) + pPanelHead(Ly, tab)
  if (s > .001) out += pSlur(Ly)
  out += pBar(Ly, tab) + pFoot()
  return out
}
