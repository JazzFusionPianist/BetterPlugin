/* slur daw — layout draft 2: the same room, set out like a working desk.
   One function draws the whole window for any state of the two panels (patch: 0..1, slur: 0..1),
   so the page can show the four resting states as frames and slide between them on B and O. */
const TEMPO = 92, SPBAR = 240 / TEMPO
let LOOPS = null
const lerp = (a, b, x) => a + (b - a) * x
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const fmtDb = v => v <= -47.5 ? '−∞' : (v > 0 ? '+' : '') + v.toFixed(1).replace('-', '−')
const volF = db => db <= -47.5 ? 0 : db <= -24 ? (db + 48) / 24 * .25 : .25 + (db + 24) / 30 * .75
const fitText = (s, maxW, f = 'm', size = 8) => { if (tw(s, f, size) <= maxW) return s; let k = s.length; while (k > 1 && tw(s.slice(0, k) + '…', f, size) > maxW) k-- ; return s.slice(0, k) + '…' }
function peakOf (chs) { let m = 0; for (const a of chs) for (let i = 0; i < a.length; i += 3) { const v = Math.abs(a[i]); if (v > m) m = v } return m || 1 }

/* the song on the desk */
const SCENES = [['intro', 1], ['verse', 5], ['pre', 13], ['chorus', 17], ['verse 2', 25], ['chorus', 33], ['out', 41]].map(([name, a], i, all) => ({ i, name, a, b: i + 1 < all.length ? all[i + 1][1] : 43 }))
const TRACKS = [
  { name: 'drums', kind: 'stack', c: INK, own: INK, vol: 0, regs: [] },
  { name: 'kick', c: BLUE, own: INK, vol: -1.5, buf: 'kick', child: true, regs: [[5, 13], [17, 25], [25, 33], [33, 41]], m: .78 },
  { name: 'snare', c: GREEN, own: INK, vol: -5, buf: 'snare', child: true, regs: [[5, 13], [17, 25], [25, 33], [33, 41]], m: .6 },
  { name: 'hats', c: INK, own: INK, vol: -6, buf: 'hats', child: true, regs: [[13, 17], [17, 25], [33, 41]], m: .46 },
  { name: 'bass', c: ROSE, own: ROSE, theirs: 'jun', vol: -6.5, buf: 'bass', regs: [[5, 13], [17, 33], [33, 41]], m: .52 },
  { name: 'keys', c: ORANGE, own: INK, vol: -4.5, buf: 'keys', midi: true, regs: [[1, 5], [5, 13], [13, 17], [17, 25], [33, 41]], m: .64, sends: [['room', -12]] },
  { name: 'guitar', c: ROSE, own: ROSE, theirs: 'jun', vol: -5, buf: 'guitar', regs: [[13, 17], [17, 25, 'take 3'], [33, 43]], m: .5 },
  { name: 'hum', c: YELLOW, own: YELLOW, theirs: 'minseo', vol: -6, buf: 'hum', regs: [[5, 13], [17, 25], [25, 33], [33, 41]], m: .44 },
  { name: 'air', c: BLUE, own: INK, vol: -12, buf: 'air', regs: [[1, 43]], m: .12 },
  { name: 'room', kind: 'bus', c: INK, own: INK, vol: -8, regs: [], m: .3 },
]
let HITS = false                                             // the live page adds unseen rectangles over the two switches
const SEL = 5, POS = 16.6                                   // the chosen track; the playhead, bars from zero

/* sizes that do not move */
const BAR_H = 56, STAT_H = 32, HEAD_W = 248, TOOL_H = 32, SC_H = 24, RU_H = 24, ROW = 48, PATCH_H = 300, SLUR_W = 340, PXB = 20
function layout (p, s) {
  const R = W - SLUR_W * s, B = H - STAT_H - PATCH_H * p
  return { p, s, R, B, toolY: BAR_H, scY: BAR_H + TOOL_H, ruY: BAR_H + TOOL_H + SC_H, lnY: BAR_H + TOOL_H + SC_H + RU_H, x0: HEAD_W, x1: R - 14 }
}
const bxOf = (Ly, bar) => Ly.x0 + (bar - 1) * PXB           // where bar (counted from one) sits

/* a switch: an outlined key, a lamp beside the word (lit when on), the letter that does the same on the keys */
function switchKey (x, y, word, on, colour, letter, h = 24) {
  const ww = tw(word, 'g', 10.5, on ? 500 : 400), lw = letter ? tw(letter, 'm', 9.5) + 12 : 0, w = Math.round(10 + 7 + 7 + ww + lw + 10)
  let s = R(x + .5, y + .5, w - 1, h - 1, { rx: 2, stroke: INK, sa: on ? .5 : .3 })
  s += on ? R(x + 10, y + h / 2 - 3.5, 7, 7, { fill: colour }) : R(x + 10.5, y + h / 2 - 3, 6, 6, { stroke: INK, sa: .45 })
  s += T(x + 24, y + h / 2 + 3.8, word, { size: 10.5, w: on ? 500 : 400, a: on ? 1 : .7 })
  if (letter) s += T(x + w - 10, y + h / 2 + 3.5, letter, { f: 'm', size: 9.5, a: .42, anchor: 'end' })
  return [s, w]
}
const hline = (x0, x1, y, a = .1) => P(`M${n(x0)} ${n(y) + .5}H${n(x1)}`, { stroke: INK, sa: a })
const vline = (x, y0, y1, a = .1) => P(`M${n(x) + .5} ${n(y0)}V${n(y1)}`, { stroke: INK, sa: a })

/* ── the control bar ── */
function pBar (Ly) {
  let s = ''
  const pn = 'night bus ep'
  s += mark(26, 15, 27) + T(84, 32.5, pn, { size: 13, w: 500 })
  const kx = 84 + tw(pn, 'g', 13, 500) + 26, [k1, w1] = switchKey(kx, 16, 'patch', Ly.p > .5, AMBER, 'b')
  s += k1 + (HITS ? hit(kx, 16, w1, 24, 'patch') : '')
  /* transport */
  const tri = (x, y, c, a) => P(`M${x - 4} ${y - 5.5}L${x + 5.5} ${y}L${x - 4} ${y + 5.5}Z`, { fill: c, fa: a })
  const sq = (x, y, c, a) => R(x - 4.5, y - 4.5, 9, 9, { fill: c, fa: a })
  const dot = (x, y, c) => Cc(x, y, 5, { fill: c === WALL ? WALL : ROSE })
  const lp = (x, y, c, a) => P(`M${x - 6} ${y + 1}V${y - 1.5}a3 3 0 0 1 3 -3H${x + 3}a3 3 0 0 1 3 3V${y + 1.5}a3 3 0 0 1 -3 3H${x - 1}`, { stroke: c, sa: a, sw: 1.3, cap: 'round' }) + P(`M${x + 1.5} ${y + 2}L${x - 1.5} ${y + 4.5}L${x + 1.5} ${y + 7}`, { stroke: c, sa: a, sw: 1.3, cap: 'round' })
  const ck = (x, y, c, a) => P(`M${x - 5} ${y + 6}L${x - 2} ${y - 6.5}H${x + 2}L${x + 5} ${y + 6}Z`, { stroke: c, sa: a, sw: 1.2, cap: 'round' }) + P(`M${x} ${y + 3.5}L${x + 4.5} ${y - 4}`, { stroke: c, sa: a, sw: 1.2, cap: 'round' })
  const tx = 392
  const [trans, trw] = cells(tx, 12, 32, [{ g: tri, on: true, c: GREEN }, { g: sq }, { g: dot }, { g: lp }, { g: ck }], { widths: [40, 40, 40, 40, 40] })
  s += trans
  /* the display: where the song is, in bars and in time; how fast; in what */
  const lx = tx + trw + 16, ly = 12, lh = 32, cw = [112, 74, 104, 52], lw = cw.reduce((a, b) => a + b, 0)
  s += R(lx + .5, ly + .5, lw - 1, lh - 1, { rx: 2, stroke: INK, sa: .3 })
  let cx = lx
  cw.forEach((w, i) => { if (i) s += vline(cx - .5, ly + 1, ly + lh - 1, .3); cx += w })
  const pos = `${Math.floor(POS) + 1}.${Math.floor((POS % 1) * 4) + 1}.${Math.floor((POS % 1) * 16) % 4 + 1}`, secs = POS * SPBAR
  s += T(lx + cw[0] / 2, ly + 23, pos, { f: 'm', size: 19, anchor: 'middle' })
  s += T(lx + cw[0] + cw[1] / 2, ly + 20.5, `${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, '0')}`, { f: 'm', size: 12, a: .7, anchor: 'middle' })
  { const v = '92.00', u = 'bpm', vw = tw(v, 'm', 12), uw = tw(u, 'g', 9), x = lx + cw[0] + cw[1] + (cw[2] - vw - 5 - uw) / 2; s += T(x, ly + 20.5, v, { f: 'm', size: 12, a: .9 }) + T(x + vw + 5, ly + 20.5, u, { size: 9, a: .45 }) }
  s += T(lx + cw[0] + cw[1] + cw[2] + cw[3] / 2, ly + 20.5, '4/4', { f: 'm', size: 12, a: .9, anchor: 'middle' })
  /* the way out */
  const ox = lx + lw + 22
  s += T(ox, 32, 'out', { size: 9, a: .45 }) + R(ox + 22, 24.5, 60, 2, { fill: INK, fa: .12 }) + R(ox + 22, 29.5, 60, 2, { fill: INK, fa: .12 }) + R(ox + 22, 24.5, 41, 2, { fill: GREEN }) + R(ox + 22, 29.5, 44, 2, { fill: GREEN }) + T(ox + 90, 32, '−4.2', { f: 'm', size: 11, a: .8 })
  /* the right end: who is in the room, hand off, and the switch for the paper window */
  const [k2, w2] = switchKey(0, 0, 'slur', Ly.s > .5, BLUE, 'o'), sx = W - 20 - w2
  s += G(k2, `translate(${sx} 16)`) + (HITS ? hit(sx, 16, w2, 24, 'slur') : '')
  const ho = { h: 24, size: 10.5, lamp: GREEN }, hw = keyW('hand off', ho), hx = sx - 10 - hw
  s += key(hx, 16, 'hand off', ho)[0]
  ;[[INK, false], [ROSE, false], [YELLOW, true], [LILAC, true]].forEach(([c, hollow], i) => { s += P(wholeNote(hx - 100 + i * 22, 28, 7, hollow), { fill: c, rule: 'evenodd', fa: hollow ? .8 : 1 }) })
  return s + hline(0, W, BAR_H - .5, .12)
}

/* ── the tracks' own bar: what is in the hand, the grid, the two views, the zoom ── */
function pTool (Ly) {
  const y = Ly.toolY, cy = y + TOOL_H / 2 + 3.6, lab = { size: 10, a: .45 }
  let s = T(20, cy, 'tracks', lab) + T(20 + tw('tracks', 'g', 10) + 7, cy, String(TRACKS.length), { f: 'm', size: 10, a: .7 })
  s += R(HEAD_W - 12 - 20 + .5, y + 6.5, 19, 19, { rx: 2, stroke: INK, sa: .3 }) + P(`M${HEAD_W - 22} ${y + 12}V${y + 20}M${HEAD_W - 26} ${y + 16}H${HEAD_W - 18}`, { stroke: INK, sa: .8, sw: 1.2 })
  let x = HEAD_W + 14
  const put = (label, word, more) => { s += T(x, cy, label, lab); x += tw(label, 'g', 10) + 7; const [k, w] = key(x, y + 6, word, Object.assign({ h: 20 }, more || {})); s += k; x += w + 16 }
  put('tool', 'pointer'); put('⌘', 'marquee'); put('snap', 'smart')
  x += 4
  for (const word of ['auto', 'flex']) { const [k, w] = key(x, y + 6, word, { h: 20 }); s += k; x += w + 6 }
  /* zoom, at the far end */
  const zx = Ly.x1 - 96
  if (zx > x + 60) s += T(zx - 12, cy, 'zoom', Object.assign({ anchor: 'end' }, lab)) + R(zx, y + TOOL_H / 2 - 1.5, 96, 3, { fill: INK, fa: .14 }) + R(zx, y + TOOL_H / 2 - 1.5, 30, 3, { fill: INK, fa: .5 }) + R(zx + 29, y + TOOL_H / 2 - 6, 2, 12, { fill: INK })
  return s + hline(0, Ly.R, y + TOOL_H - .5, .07)
}

/* ── scenes and the ruler ── */
function pScenes (Ly, cid) {
  const y = Ly.scY, h = SC_H, cur = SCENES.findIndex(sc => POS + 1 >= sc.a && POS + 1 < sc.b)
  let fill = '', div = '', txt = ''
  SCENES.forEach((sc, i) => {
    const xa = bxOf(Ly, sc.a), w = (sc.b - sc.a) * PXB, on = i === cur
    if (on) fill += R(xa, y + 2, w, h - 4, { fill: ORANGE })
    txt += T(xa + 8, y + 15.5, sc.name, { size: 10, w: on ? 500 : 400, c: on ? WALL : INK, a: on ? 1 : .6 })
    if (i) div += `M${n(xa)} ${y + 2}V${y + h - 2}`
  })
  const xe = bxOf(Ly, 43)
  let s = T(20, y + 15.5, 'scenes', { size: 10, a: .45 })
  s += G(fill + P(div, { stroke: INK, sa: .3 }) + txt + R(Ly.x0 + .5, y + 2.5, xe - Ly.x0 - 1, h - 5, { rx: 2, stroke: INK, sa: .3 }), '', ` clip-path="url(#${cid})"`)
  return s
}
function pRuler (Ly, cid) {
  const y = Ly.ruY
  let t = '', lab = ''
  for (let b = 0; b <= 80; b++) {
    const x = bxOf(Ly, b + 1)
    if (x > Ly.x1 + 1) break
    t += `M${n(x)} ${b % 4 === 0 ? y + 14 : y + 18}V${y + RU_H - 1}`
    if (b % 4 === 0 && x < Ly.x1 - 14) lab += T(x + 4, y + 16, String(b + 1), { f: 'm', size: 9, a: b < 42 ? .45 : .22 })
  }
  let s = G(R(bxOf(Ly, 17), y + 3, 8 * PXB, 4, { rx: 1, fill: INK, fa: .22 }) + P(t, { stroke: INK, sa: .22 }) + lab, '', ` clip-path="url(#${cid})"`)
  return s + hline(0, Ly.R, y + RU_H - .5, .1)
}

/* ── one track's head: its stripe and number, its name, its four cells, its fader with the level under it ── */
function headRow (Ly, t, k, y) {
  const l1 = y + 20, fy = y + 32, sel = k === SEL, bus = !!t.kind, x0 = t.child ? 62 : 52, fw = 150 - x0
  let s = ''
  if (sel) s += R(0, y, HEAD_W, ROW, { fill: INK, fa: .06 })
  s += R(0, y + 1, 3, ROW - 2, { fill: t.c, fa: sel ? 1 : .55 })
  s += T(12, l1, String(k + 1).padStart(2, '0'), { f: 'm', size: 9, a: sel ? .7 : .36 })
  /* its mark: a stack opens and closes on a small triangle; a bus is an open note; a track of one's own or someone's is a full note in their colour */
  if (t.kind === 'stack') s += P(`M${x0 - 16} ${l1 - 6.5}H${x0 - 8}L${x0 - 12} ${l1 - 1}Z`, { fill: INK, fa: .7 })
  else s += P(wholeNote(x0 - 12, l1 - 4, 4.5, bus), { fill: bus ? INK : t.own, rule: 'evenodd', fa: bus ? .8 : 1 })
  s += T(x0, l1, t.name, { size: 12, w: 500, a: sel ? 1 : .9 })
  const nx = x0 + tw(t.name, 'g', 12, 500) + 8
  if (t.theirs) s += T(nx, l1, t.theirs, { size: 10, a: .42 })
  else if (t.kind) s += T(nx, l1, t.kind, { size: 10, a: .42 })
  const cell = (i, ch, lit, col) => { const cx = 172 + 16 * i; return (lit ? R(cx, l1 - 10.5, 14, 14, { rx: 2, fill: col }) : '') + T(cx + 7, l1, ch, { size: 10, c: lit ? WALL : INK, a: lit ? 1 : .38, w: lit ? 500 : 400, anchor: 'middle' }) }
  if (!bus && !t.theirs) s += cell(0, 'r', false, ROSE) + cell(1, 'i', false, ORANGE)
  s += cell(2, 'm', false, INK) + cell(3, 's', false, YELLOW)
  const pos = v => x0 + fw * volF(v)
  s += R(x0, fy, fw, 3, { fill: INK, fa: .12 }) + R(x0, fy, pos(t.vol) - x0, 3, { fill: t.c, fa: .9 }) + R(pos(0) - .5, fy - 2, 1, 7, { fill: INK, fa: .3 }) + R(pos(t.vol) - 1, fy - 4, 2, 11, { fill: INK })
  if (t.m) s += R(x0, fy + 6, fw * t.m, 2, { fill: t.c, fa: .85 })
  s += T(236, fy + 6, fmtDb(t.vol), { f: 'm', size: 10, a: .6, anchor: 'end' })
  return s + hline(0, HEAD_W, y + ROW - .5, .06)
}
function midi (r, w, ly, lh) {
  let d = ''
  const len = r[1] - r[0], off = r[0] - 1
  for (let k = Math.floor(off); k < off + len; k++) {
    const ch = KEY_CHORDS[((k % 4) + 4) % 4], x0 = (k - off) * PXB
    for (const [st, ln] of KEY_HITS) if (ln > 3) for (const m of ch) { const a = Math.max(x0 + (st / 16) * PXB + 1.5, 1), b = Math.min(x0 + (st / 16) * PXB + (ln / 16) * PXB + .5, len * PXB - 1); if (b - a > 1) d += `M${n(a)} ${n(ly + lh - 7 - (m - 53) * (lh - 14) / 18)}H${n(b)}` }
  }
  return d
}
function wave (t, r, w, yc, hmax) {
  const lp = LOOPS[t.buf], len = r[1] - r[0], steps = Math.max(1, Math.floor((w - 4) / 2)), pk = loopPeaks(lp, r[0] - 1, r[0] - 1 + len, steps), norm = lp.peak || (lp.peak = peakOf(lp.ch))
  let d = ''
  for (let i = 0; i < steps; i++) { const h = Math.max(.6, Math.min(1, pk[i] / norm) * hmax); d += `M${n(3 + i * 2)} ${n(yc - h)}V${n(yc + h)}` }
  return d
}
function laneRow (Ly, t, k, y) {
  const ly = y + 4, lh = ROW - 8
  let s = ''
  if (t.kind === 'stack') {
    const kids = TRACKS.filter(c => c.child)
    kids.forEach((c, j) => { const yy = ly + 5 + j * (lh - 12) / (kids.length - 1); for (const r of c.regs) s += R(bxOf(Ly, r[0]) + .75, yy, (r[1] - r[0]) * PXB - 1.5, 2, { fill: c.c, fa: .8 }) })
  } else if (t.kind === 'bus') s += P(`M${Ly.x0} ${n(y + ROW / 2)}H${bxOf(Ly, 43)}`, { stroke: INK, sa: .1, dash: '2 5' })
  for (const r of t.regs) {
    const x = n(bxOf(Ly, r[0]) + .75), w = n((r[1] - r[0]) * PXB - 1.5)
    let q = t.theirs ? R(x + .25, ly + .5, w - .5, lh - 1, { rx: 2, stroke: t.c, sa: .75 }) : R(x, ly, w, lh, { rx: 2, fill: t.c, fa: t.c === INK ? .14 : .2 })
    q += G(t.midi ? P(midi(r, w, ly, lh), { stroke: t.c, sw: 2 }) : P(wave(t, r, w, ly + lh / 2, lh / 2 - 5), { stroke: t.c, sa: t.theirs ? .7 : .95 }), `translate(${x} 0)`)
    if (r[2]) q += R(x + 4, ly + 4, tw(r[2], 'm', 8) + 8, 12, { rx: 2, fill: WALL, fa: .85 }) + T(x + 8, ly + 13, r[2], { f: 'm', size: 8, c: t.c })
    s += q
  }
  return s
}
function pTracks (Ly, cidH, cidL, cidT) {
  const y0 = Ly.lnY, visH = Ly.B - y0, all = TRACKS.length * ROW
  let heads = '', lanes = '', grid = ''
  for (const sc of SCENES) grid += `M${n(bxOf(Ly, sc.a))} ${Ly.ruY + RU_H}V${Ly.B}`
  grid += `M${n(bxOf(Ly, 43))} ${Ly.ruY + RU_H}V${Ly.B}`
  TRACKS.forEach((t, k) => {
    const y = y0 + k * ROW
    if (y >= Ly.B) return
    heads += headRow(Ly, t, k, y)
    lanes += laneRow(Ly, t, k, y) + hline(Ly.x0, Ly.x1, y + ROW - .5, .05)
  })
  let s = G(P(grid, { stroke: INK, sa: .08 }) + lanes, '', ` clip-path="url(#${cidL})"`) + G(heads, '', ` clip-path="url(#${cidH})"`)
  s += vline(HEAD_W - .5, Ly.toolY, Ly.B, .1)
  if (all > visH + 1) s += R(Ly.R - 8, y0 + 2, 3, (visH - 4) * visH / all, { rx: 1.5, fill: INK, fa: .28 })       // more rows than fit: where the window sits among them
  /* the playhead */
  const px = bxOf(Ly, POS + 1)
  s += G(P(`M${n(px)} ${Ly.ruY + 4}V${Ly.B}`, { stroke: INK, sa: .95 }) + P(`M${n(px - 5)} ${Ly.ruY + 1}H${n(px + 5)}L${n(px)} ${Ly.ruY + 8}Z`, { fill: INK }), '', ` clip-path="url(#${cidT})"`)
  return s
}

/* ── the patch, under the tracks: the chosen track's prints and what it borrows, and its strip at the right ── */
function loan (cx, cy, r, name) {
  let s = R(cx - r + .5, cy - r + .5, 2 * r - 1, 2 * r - 1, { rx: 2, fill: INK, fa: .05, stroke: INK, sa: .62 }) + R(cx - r + 7.5, cy - r + 7.5, 2 * r - 15, 2 * r - 15, { fill: WALL, fa: .6, stroke: INK, sa: .2 })
  const words = name.split(' ')
  words.forEach((ln, i) => { s += T(cx, cy + 3.5 + (i - (words.length - 1) / 2) * 13, ln, { size: 10, w: 500, anchor: 'middle' }) })
  return s
}
function pPatch (Ly, cid) {
  const y = Ly.B, t = TRACKS[SEL], MID = y + 32 + 126, NR = 34, e = NR + 6
  let s = R(0, y, Ly.R, PATCH_H, { fill: WALL }) + hline(0, Ly.R, y, .14)
  /* its head: whose patch this is; what can be borrowed; the scene hand */
  s += run(20, y + 21, [[t.name, { size: 13, w: 500 }], ['patch', { size: 13, a: .45 }]], 7)[0]
  const sx = Ly.R - 24 - 164
  s += key(sx - 28 - keyW('plug-ins'), y + 6, 'plug-ins', { h: 20 })[0]
  s += hline(0, Ly.R, y + 32, .07) + vline(sx - 20, y + 32, y + PATCH_H, .07)
  /* the prints */
  const nodes = [
    { k: 'tape', x: 196, y: MID, c: CREAM, amt: 24, cap: ['tape', '24'] },
    { k: 'space', x: 352, y: MID - 62, c: SPACE, amt: 46, cap: ['space', 'hall 46 3.70s'] },
    { k: 'delay', x: 352, y: MID + 58, c: MINT, amt: 30, cap: ['delay', '1/8 30 fb 35'] },
    { k: 'mix', x: 508, y: MID, c: AMBER, amt: 100, cap: ['mix', 'space 62 delay 38'] },
  ]
  let lamps = '', defs = ''
  for (const q of nodes) { const id = 'lg' + (++UID), o = q.k === 'mix' ? .2 : .04 + .3 * q.amt / 100; defs += `<radialGradient id="${id}"><stop offset="0" stop-color="${q.c}" stop-opacity="${n(o)}"/><stop offset="1" stop-color="${q.c}" stop-opacity="0"/></radialGradient>`; lamps += `<ellipse cx="${q.x}" cy="${q.y + 26}" rx="108" ry="150" fill="url(#${id})"/>` }
  const outX = 760
  let sig = `M0 ${MID}`
  for (let x = 0; x <= outX; x += 3) { const k = x / outX, amp = k < .25 ? 5 : k < .6 ? 10 : 17; sig += `L${x} ${n(MID + Math.sin(x * .09) * amp * (.6 + .4 * Math.sin(x * .013)) + Math.sin(x * .31) * 2)}` }
  const wire = (ax, ay, bx2, by, c) => { const dx = Math.max(26, (bx2 - ax) * .5); return P(`M${ax} ${ay}C${n(ax + dx)} ${ay} ${n(bx2 - dx)} ${by} ${bx2} ${by}`, { stroke: c, sa: .75, sw: 1.2 }) + Cc(ax, ay, 2.4, { fill: SL.white }) + Cc(bx2, by, 2.4, { fill: SL.white }) }
  const [tp, sp, dl, mx] = nodes
  let g = defs + lamps + P(sig, { stroke: INK, sa: .24 })
  g += Cc(58, MID, 5, { fill: SL.white }) + T(58, MID + 23, 'in', { size: 10, a: .6, anchor: 'middle' }) + P(`M66 ${MID}H${tp.x - e}`, { stroke: INK, sa: .75, sw: 1.2 }) + Cc(tp.x - e, MID, 2.4, { fill: SL.white })
  g += wire(tp.x + e, tp.y, sp.x - e, sp.y, SPACE) + wire(tp.x + e, tp.y, dl.x - e, dl.y, MINT) + wire(sp.x + e, sp.y, mx.x - e, mx.y, SPACE) + wire(dl.x + e, dl.y, mx.x - e, mx.y, MINT)
  const lx = 640
  g += P(`M${mx.x + e} ${MID}H${lx - e}`, { stroke: AMBER, sa: .75, sw: 1.2 }) + Cc(mx.x + e, MID, 2.4, { fill: SL.white }) + Cc(lx - e, MID, 2.4, { fill: SL.white })
  g += loan(lx, MID, NR, 'channel eq') + caption(lx, MID + NR + 19, 'channel eq', 'au')
  g += P(`M${lx + e} ${MID}H${outX - 8}`, { stroke: INK, sa: .75, sw: 1.2 }) + Cc(lx + e, MID, 2.4, { fill: SL.white }) + Cc(outX, MID, 5, { fill: SL.white }) + T(outX, MID + 23, 'out', { size: 10, a: .6, anchor: 'middle' })
  for (const q of nodes) g += plate(q.k, q.x, q.y, NR) + caption(q.x, q.y + NR + 19, q.cap[0], q.cap[1])
  s += G(g, '', ` clip-path="url(#${cid})"`)
  /* the strip: one column, every hand ending on the same edge */
  const lab = { size: 10, a: .45 }, num = { f: 'm', size: 10, a: .7, anchor: 'end' }, fx = sx + 46, fw = 84, vx = Ly.R - 24
  let yy = y + 56
  const fader = (label, f, text, c) => { const px = fx + fw * f; s += T(sx, yy + 3.5, label, lab) + R(fx, yy - 1.5, fw, 3, { fill: INK, fa: .12 }) + R(fx, yy - 1.5, px - fx, 3, { fill: c, fa: .9 }) + R(px - 1, yy - 5.5, 2, 11, { fill: INK }) + T(vx, yy + 3.5, text, num); yy += 27 }
  s += T(sx, yy + 3.5, 'scene', lab) + T(fx - 2, yy + 3.5, 'a', { f: 'm', size: 10.5, c: ORANGE }) + R(fx + 10, yy - 1.5, fw - 22, 3, { fill: INK, fa: .14 }) + R(fx + 9, yy - 5.5, 2, 11, { fill: INK }) + T(fx + fw - 6, yy + 3.5, 'b', { f: 'm', size: 10.5, a: .6 })
  yy += 30
  fader('level', volF(t.vol), fmtDb(t.vol), t.c)
  { const pc = fx + fw / 2; s += T(sx, yy + 3.5, 'pan', lab) + R(fx, yy - 1.5, fw, 3, { fill: INK, fa: .12 }) + R(pc - .5, yy - 4, 1, 8, { fill: INK, fa: .35 }) + R(pc - 1, yy - 5.5, 2, 11, { fill: INK }) + T(vx, yy + 3.5, 'c', num); yy += 27 }
  s += T(sx, yy + 3.5, 'out', lab) + key(fx - 4, yy - 9, 'stereo out', { h: 18 })[0]; yy += 27
  fader('room', volF(-12), fmtDb(-12), t.c)
  s += T(sx, yy + 3.5, 'send', lab) + key(fx - 4, yy - 9, 'none', { h: 18, dim: true })[0]; yy += 27
  s += T(sx, yy + 3.5, 'in', lab) + key(fx - 4, yy - 9, 'input 1', { h: 18 })[0]
  return s
}

/* ── slur, a paper window at the right ── */
function stemWave (x0, yc, seed, shape, wpx) {
  const r = srand(seed)
  let d = ''
  for (let i = 0; i < 100; i++) { const env = shape === 'arch' ? Math.sin(Math.PI * i / 100) * .7 + .3 : Math.abs(Math.sin(Math.PI * i / 33)) * .75 + .2, hh = Math.max(1.4, (r() * .8 + .2) * 20 * env); d += `M${n(x0 + i * wpx / 100)} ${n(yc - hh / 2)}v${n(hh)}` }
  return d
}
function pSlur (Ly) {
  const x = Ly.R + 12, y = BAR_H + 12, w = SLUR_W - 24, h = H - STAT_H - BAR_H - 24, px = x + 20
  const I = (xx, yy, t, oo) => T(xx, yy, t, Object.assign({ f: 'i', c: SL.ink, size: 12 }, oo || {}))
  let s = R(x, y, w, h, { rx: 16, fill: SL.white })
  s += I(px, y + 40, 'night bus ep', { size: 19, w: 600 })
  s += run(px, y + 60, [['4 members', { f: 'i', size: 11, c: SL.t3 }], ['2 in the studio now', { f: 'i', size: 11, c: SL.green }]], 6)[0]
  s += P(`M${x + 1} ${y + 78.5}H${x + w - 1}`, { stroke: SL.ink, sa: .08 })
  let my = y + 104
  s += I(x + w / 2, my, 'today', { size: 10, c: SL.t3, anchor: 'middle' })
  my += 22
  const cw = w - 40 - 28
  const stem = c => {
    s += I(px + 32, my, c.who, { size: 10, c: SL.t3 }); my += 8
    s += R(px + 28, my, cw, 92, { rx: 14, fill: SL.bub }) + I(px + 42, my + 24, c.title, { w: 600 }) + I(px + 28 + cw - 14, my + 24, c.len, { c: SL.t3, anchor: 'end' })
    s += P(stemWave(px + 42, my + 46, c.seed, c.shape, cw - 28), { stroke: SL.ink, sw: 1.3, cap: 'round' })
    s += run(px + 42, my + 76, [[`bar ${c.bar}`, { f: 'i', size: 10.5, c: SL.t3 }], ['48k', { f: 'i', size: 10.5, c: SL.t3 }], [`place at bar ${c.bar}`, { f: 'i', size: 10.5, c: SL.green, w: 500 }]], 10)[0]
    s += Cc(px + 11, my + 81, 11, { fill: c.av })
    my += 104
  }
  const bubble = (t, mine, av) => {
    const bw = tw(t, 'i', 12.5) + 26, bh = 34, bx0 = mine ? x + w - 20 - bw : px + 28
    s += R(bx0, my, bw, bh, { rx: 14, fill: mine ? SL.ink : SL.bub }) + R(mine ? bx0 + bw - 14 : bx0, my + bh - 14, 14, 14, { rx: 4, fill: mine ? SL.ink : SL.bub }) + I(bx0 + 13, my + 21.5, t, { size: 12.5, c: mine ? SL.white : SL.ink })
    if (av) s += Cc(px + 11, my + bh - 11, 11, { fill: av })
    my += bh + 10
  }
  stem({ who: 'jun', av: ROSE, title: 'guitar verse 2', len: '0:21', bar: 25, seed: 7, shape: 'arch' })
  bubble('try it under verse 2', false, ROSE); bubble('placing it now', true)
  my += 14
  stem({ who: 'minseo', av: YELLOW, title: 'hum double', len: '0:21', bar: 33, seed: 23, shape: 'phr' })
  bubble('doubled the last chorus', false, YELLOW); bubble('rehearsal fri 7pm?', false, YELLOW); bubble('yes. bringing the stage set', true)
  return s
}

/* ── the foot: say it, and what was last said back ── */
function pFoot () {
  const y = H - STAT_H
  let s = R(0, y, W, STAT_H, { fill: WALL }) + hline(0, W, y, .12) + P(slurPath(22, y + 21, 44, y + 21, 8, 2.4), { fill: BLUE }) + T(58, y + 20, 'kick -3 db', { f: 'm', size: 12, a: .9 })
  const kw = keyW('keys'), parts = [['kick', { size: 11, w: 500 }], ['−1.5', { f: 'm', size: 11, a: .5 }], ['to', { size: 10, a: .42 }], ['−4.5', { f: 'm', size: 11, c: BLUE }], ['db', { size: 9, a: .42 }]]
  s += key(W - 20 - kw, y + 6, 'keys', { h: 20 })[0]
  return s + run(W - 20 - kw - 18 - runW(parts, 6), y + 20, parts, 6)[0]
}

/* the whole window, for any state of the two panels */
function render (p, s) {
  const Ly = layout(p, s), a = 'c' + (++UID), b = 'c' + (++UID), c = 'c' + (++UID), d = 'c' + (++UID)
  const lanesH = Math.max(0, Ly.B - Ly.lnY), laneW = Math.max(0, Ly.x1 - Ly.x0)
  let out = `<defs><clipPath id="${a}"><rect x="0" y="${Ly.lnY}" width="${HEAD_W}" height="${n(lanesH)}"/></clipPath><clipPath id="${b}"><rect x="${Ly.x0}" y="${Ly.lnY}" width="${n(laneW)}" height="${n(lanesH)}"/></clipPath><clipPath id="${c}"><rect x="${Ly.x0}" y="${Ly.scY}" width="${n(laneW)}" height="${n(Ly.B - Ly.scY)}"/></clipPath><clipPath id="${d}"><rect x="0" y="${n(Ly.B + 32)}" width="${n(Math.max(0, Ly.R - 24 - 164 - 20))}" height="${PATCH_H - 32}"/></clipPath></defs>`
  out += R(0, 0, W, H, { fill: WALL })
  out += pTool(Ly) + pScenes(Ly, c) + pRuler(Ly, c) + pTracks(Ly, a, b, c)
  if (p > .001) out += pPatch(Ly, d)
  if (s > .001) out += R(Ly.R, BAR_H, W - Ly.R, H - BAR_H - STAT_H, { fill: WALL }) + vline(Ly.R - .5, BAR_H, H - STAT_H, .1) + pSlur(Ly)
  out += R(0, 0, W, BAR_H, { fill: WALL }) + pBar(Ly) + pFoot()
  return out
}
