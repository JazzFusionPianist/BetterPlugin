/* ── the start page, draft 1: what the program shows before a project is open. Drawn with draft 7's kit (black paper,
   white ink), so it has to be loaded after layout-draft-7.js. Three ways of laying it out, and the first of them once more
   as it is the very first time, when nothing has been saved yet ── */
(() => {
const TB = TITLE_H, FT = FOOT_H, HW = HEAD_W

/* a track's pigment, by its family and how far down its family it stands; buses are bone */
const pig = (g, f = .35) => { const e = PALS.pigment[g]; if (!e) return oklch(.8, .028, 88); const [a, b] = e; return oklch(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[0] + (b[0] - a[0]) * f) }

/* ── what a new project can begin as: its tracks [name, family, kind], its tempo, measure and key ── */
const TPL = [
  { name: 'empty', tempo: 120, meter: '4/4', key: '', tracks: [] },
  { name: 'voice and guitar', tempo: 96, meter: '4/4', key: '', tracks: [['vox', 'vox'], ['vox double', 'vox'], ['guitar', 'gtr'], ['guitar double', 'gtr'], ['plate', 'bus', 'bus'], ['slap', 'bus', 'bus']] },
  { name: 'band', tempo: 120, meter: '4/4', key: '', tracks: [['drums', 'drums'], ['bass', 'bass'], ['keys', 'keys'], ['guitar left', 'gtr'], ['guitar right', 'gtr'], ['lead vox', 'vox'], ['backing vox', 'vox'], ['plate', 'bus', 'bus']] },
  { name: 'beat', tempo: 140, meter: '4/4', key: '', tracks: [['kit', 'drums', 'midi'], ['bass', 'bass', 'midi'], ['keys', 'keys', 'midi'], ['pad', 'keys', 'midi'], ['lead vox', 'vox'], ['plate', 'bus', 'bus']] },
  { name: 'mixing', tempo: 120, meter: '4/4', key: '', tracks: [['drums', 'drums', 'bus'], ['bass', 'bass', 'bus'], ['music', 'keys', 'bus'], ['vocals', 'vox', 'bus'], ['plate', 'bus', 'bus'], ['slap', 'bus', 'bus'], ['print', 'bus', 'bus']] },
  { name: 'friday demos', tempo: 92, meter: '4/4', key: 'a min', tracks: [['vox', 'vox'], ['guitar di', 'gtr'], ['guitar mic', 'gtr'], ['room', 'fx'], ['plate', 'bus', 'bus']] },
  { name: 'church set', tempo: 100, meter: '4/4', key: '', tracks: [['kick', 'drums'], ['snare', 'drums'], ['overheads', 'drums'], ['bass', 'bass'], ['keys', 'keys'], ['guitar', 'gtr'], ['lead vox', 'vox'], ['choir', 'vox']] },
]
for (const t of TPL) t.tracks.forEach(q => { const mates = t.tracks.filter(m => m[1] === q[1]); q[3] = pig(q[1], mates.length > 1 ? mates.indexOf(q) / (mates.length - 1) : .35) })

/* ── the projects: name, when it was saved, tempo, measure, key, bars, what plays in it [family, tracks, how often, from
   which section on], its weight on disk, where it lives when that is not the projects folder ── */
const LIST = [
  ['night bus ep', '14:31', 102, [4, 4], 'a min', 120, 'demo', '1.9 gb'],
  ['snap', 'yesterday', 102, [4, 4], '', 42, [['gtr', 2, .92], ['vox', 1, .8, 1]], '212 mb'],
  ['paper boats', 'tue', 84, [4, 4], 'd maj', 72, [['drums', 4, .82, 1], ['bass', 1, .86, 1], ['keys', 2, .7], ['gtr', 3, .6, 1], ['vox', 4, .7, 1]], '640 mb'],
  ['paper boats, strings idea', 'tue', 84, [4, 4], 'd maj', 24, [['keys', 5, .8], ['vox', 1, .6]], '96 mb'],
  ['wedding song for hana', '3 oct', 72, [6, 8], 'g maj', 150, [['keys', 2, .92], ['gtr', 2, .7, 1], ['bass', 1, .6, 2], ['vox', 3, .75, 1], ['fx', 1, .5]], '410 mb'],
  ['bridge idea, late', '1 oct', 120, [4, 4], '', 22, [['gtr', 1, 1], ['vox', 1, .8]], '38 mb'],
  ['slow one in d', '28 sep', 66, [4, 4], 'd min', 83, [['drums', 3, .7, 2], ['bass', 1, .8, 1], ['keys', 3, .82], ['vox', 3, .7, 1], ['fx', 1, .5]], '780 mb'],
  ['veloso live, mix', '24 sep', 96, [4, 4], '', 152, [['drums', 10, .97], ['bass', 2, .97], ['keys', 4, .9], ['gtr', 6, .9], ['vox', 8, .85], ['fx', 2, .6]], '4.1 gb', 'sessions ssd'],
  ['church set sept', '21 sep', 100, [4, 4], '', 136, null, '', '', 'sessions two'],
  ['untitled 3', '19 sep', 120, [4, 4], '', 9, [['vox', 1, 1]], '6 mb'],
  ['minseo demo 2', '14 sep', 92, [4, 4], 'e min', 70, [['drums', 2, .8, 1], ['bass', 1, .8, 1], ['keys', 2, .8], ['vox', 3, .7, 1]], '350 mb'],
  ['blue in green, cover', '9 sep', 58, [4, 4], '', 70, [['drums', 2, .8, 1], ['bass', 1, .9, 1], ['keys', 2, .95]], '520 mb'],
  ['kick tests', '2 sep', 120, [4, 4], '', 26, [['drums', 4, 1]], '44 mb'],
  ['jun’s guitars', '30 aug', 110, [4, 4], 'a maj', 99, [['gtr', 7, .75]], '690 mb', 'desktop'],
  ['the long drive', '22 aug', 128, [4, 4], 'f# min', 125, [['drums', 6, .85, 1], ['bass', 2, .85, 1], ['keys', 5, .7], ['gtr', 3, .6, 2], ['vox', 5, .7, 1], ['fx', 1, .6]], '1.4 gb'],
  ['voice memos, sorted', '15 aug', 120, [4, 4], '', 181, [['vox', 12, .32]], '300 mb'],
  ['old piano thing', '3 aug', 76, [4, 4], 'c maj', 44, [['keys', 2, 1], ['vox', 1, .5, 1]], '120 mb'],
  ['the long drive, radio edit', '31 jul', 128, [4, 4], 'f# min', 104, [['drums', 6, .85, 1], ['bass', 2, .85, 1], ['keys', 5, .7], ['gtr', 3, .6, 2], ['vox', 5, .7, 1]], '1.1 gb'],
  ['summer set rehearsal', '27 jul', 100, [4, 4], '', 170, [['drums', 8, .95], ['bass', 1, .95], ['keys', 2, .9], ['gtr', 2, .9], ['vox', 3, .8]], '2.6 gb', 'sessions ssd'],
  ['strings for hana', '24 jul', 72, [6, 8], 'g maj', 96, [['keys', 6, .8]], '88 mb'],
  ['mic shootout', '20 jul', 120, [4, 4], '', 30, [['vox', 6, 1]], '140 mb'],
  ['paper boats, first take', '12 jul', 84, [4, 4], 'd maj', 70, [['gtr', 1, 1], ['vox', 1, .9]], '110 mb'],
  ['hum and a loop', '4 jul', 90, [4, 4], '', 16, [['vox', 1, 1], ['drums', 1, 1]], '14 mb'],
]
const fmtLen = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
/* what plays where: sections of four, eight or sixteen bars; a family comes in at one of them and then plays most of them */
function tracksOf (seed, bars, parts) {
  const secs = []
  for (let b = 1, i = 0; b < bars + 1; i++) { const len = [4, 8, 8, 16, 8][Math.floor(rnd(i, seed) * 5)]; secs.push([b, Math.min(bars + 1, b + len)]); b += len }
  const out = []
  parts.forEach(([g, cnt, dens, from = 0], pi) => { for (let k = 0; k < cnt; k++) {
    const regs = []
    secs.forEach(([a, e], si) => {
      if (si < from || rnd(si * 31 + (g === 'drums' || g === 'bass' ? 0 : k * 7) + pi * 101, seed + 3) > dens) return
      if (g === 'vox') { for (let p = a; p < e; p += 4) if (rnd(p * 3 + k, seed + 9) > .28) regs.push([p + (rnd(p, seed + k) > .5 ? 0 : .5), Math.min(e, p + 3.4)]) }
      else if (g === 'fx') regs.push([Math.max(1, a - 2), Math.min(e, a + 1.5)])
      else regs.push([a, e])
    })
    out.push({ col: pig(g, cnt > 1 ? k / (cnt - 1) : .35), regs })
  } })
  return out
}
const SONGS = LIST.map(([name, saved, tempo, meter, key, bars, parts, size, where, gone], i) => {
  const spb = meter[0] / (meter[1] === 8 ? 3 : 1) * 60 / tempo
  const tl = parts === 'demo' ? TRACKS.filter(t => t.regs.length).map(t => ({ col: paint(t).body, regs: t.regs })) : parts ? tracksOf(i * 13 + 5, bars, parts) : []
  const count = parts === 'demo' ? TRACKS.length : parts ? parts.reduce((p, q) => p + q[1], 0) + (tl.length > 6 ? 2 : tl.length > 2 ? 1 : 0) : 0
  return { name, saved, tempo, meter: meter.join('/'), key, spb, len: bars * spb, tl, count, size, where, gone }
})

/* ── parts every way shares ── */
const title = name => { let s = R(0, 0, W, TB, { fill: K2 }); ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { s += Cc(20 + i * 20, TB / 2, 6, { fill: c }) }); return s + T(W / 2, TB / 2 + 4.3, name, { size: 12, w: 500, a: .82, anchor: 'middle' }) }
/* the foot: what the app does when it is opened; the device it will record from and play to, and the room left on disk */
function foot (y = H - FT, x0 = 0, x1 = W, short = false) {
  const by = y + 14.6, lab = 'when the app opens'
  let s = R(x0, y, x1 - x0, FT, { fill: K2 }) + hline(x0, x1, y, .1) + T(x0 + 14, by, lab, { size: 9.5, a: .4 })
  const [c] = cells(0, 0, 16, [{ t: 'this page', on: true }, { t: 'the last project' }], { size: 9, pad: 8 })
  s += G(c, `translate(${Math.round(x0 + 14 + tw(lab, 9.5) + 10)} ${y + 3})`)
  let x = x1 - 10
  const [k, kw] = key(0, 0, 'audio settings', { h: 16, size: 9, pad: 8 }); x -= kw; s += G(k, `translate(${x} ${y + 3})`)
  const cell = (label, v) => { x -= 12; s += vline(x, y + 6, y + FT - 6, .1); x -= 12; x -= tw(v, 9.5); s += T(x, by, v, { size: 9.5, a: .8 }); x -= 5; x -= tw(label, 9.5); s += T(x, by, label, { size: 9.5, a: .4 }) }
  if (!short) { cell('disk', '8.0 gb free'); cell('buffer', '256'); cell('rate', '48k') }
  cell('out', 'macbook pro speakers'); cell('in', 'macbook pro microphone')
  return s
}
/* a new project's three numbers, in the box the control bar keeps them in */
function numbers (x, y, t) {
  const disp = [[t.tempo.toFixed(2), 62, .86], [t.meter, 44, .86], [t.key || 'key', 58, t.key ? .86 : .36]], dw = 164
  let s = R(x, y, dw, 24, { rx: 2, fill: K0 }) + R(x + .5, y + .5, dw - 1, 23, { rx: 2, stroke: INK, sa: .2 }), cx = x
  disp.forEach(([v, w, a], i) => { if (i) s += vline(cx - .5, y + 4, y + 20, .13); s += T(cx + w / 2, y + 16.2, v, { size: 11, a, anchor: 'middle' }); cx += w })
  return s
}
/* a key by itself with its letter; the return key is drawn, so that no font has to be asked for its arrow */
const inkKey = (xr, y, t, k, on, h = 24, size = 10) => {
  const ret = k === '↩', [c, cw] = cells(0, 0, h, [{ t, k: ret ? '\u2003' : k, on }], { size })
  const arrow = ret ? P(`M${cw - 9.5} ${h / 2 - 3}V${h / 2 + .5}H${cw - 16.5}M${cw - 14.5} ${h / 2 - 1.5}L${cw - 16.5} ${h / 2 + .5}L${cw - 14.5} ${h / 2 + 2.5}`, { stroke: on ? K1 : INK, sa: on ? .6 : .4, cap: 'round' }) : ''
  return G(c + arrow, `translate(${Math.round(xr - cw)} ${y})`)
}
/* a template's tracks, one under the other: its pigment, its name, its kind */
function trackLines (x, y, w, t, pitch, on, size = 9.5) {
  let s = ''
  t.tracks.forEach(([nm, , kind, col], i) => { const ly = y + i * pitch; s += R(x, ly - size * .84, 2.5, size * .96, { fill: col }) + T(x + 9, ly, nm, { size, a: on ? .88 : .54 }) + T(x + w, ly, kind || 'audio', { size: size - .5, a: on ? .4 : .24, anchor: 'end' }) })
  return s
}
/* a project seen from far away: every track a thin line, in its own pigment, where it sounds. One scale for all of them */
function overview (x0, y, h, s, pxm) {
  const cnt = s.tl.length; if (!cnt) return ''
  const pitch = Math.min(3, (h - 12) / cnt), bh = Math.max(.8, pitch - (pitch >= 2 ? .8 : pitch > 1.2 ? .4 : .12)), y0 = y + (h - cnt * pitch) / 2 + (pitch - bh) / 2, k = s.spb / 60 * pxm
  const by = new Map()
  s.tl.forEach((t, i) => { let d = by.get(t.col) || ''; for (const [ra, rb] of t.regs) { const xa = x0 + (ra - 1) * k, w = Math.max(1, (rb - ra) * k - .7); d += `M${n(xa)} ${n(y0 + i * pitch)}h${n(w)}v${n(bh)}h${n(-w)}z` } by.set(t.col, d) })
  let out = ''
  for (const [c, d] of by) out += P(d, { fill: c })
  return out
}
const toolBar = (x0, y, count, find = true) => {
  let s = R(x0, y, W - x0, TOOL_H, { fill: K1 }) + hline(x0, W, y + TOOL_H - .5, .08)
  const [f] = field(x0 + 14, y + 16.6, 'projects', count ? String(count) : '', { size: 10 }); s += f
  let x = W - 12
  const [c, cw] = cells(0, 0, 18, [{ t: 'open from disk', k: '⌘o' }], { size: 9.5 }); x -= cw; s += G(c, `translate(${x} ${y + 4})`)
  if (find) { const fw = 172; x -= 8 + fw; s += R(x + .5, y + 4.5, fw - 1, 17, { rx: 2, stroke: INK, sa: .2 }) + T(x + 9, y + 16.4, 'find', { size: 9.5, a: .34 }) + T(x + fw - 9, y + 16.2, '⌘f', { size: 8, a: .34, anchor: 'end' }) }
  return s
}

/* ══ a: the projects as lanes. A new project and what it can begin as across the top; under it every project is a row cut
   the way the room is cut: its name where a track's head would be, and in its lane the project itself seen from far away,
   all of them on one scale of minutes ══ */
const A_BAND = 158, A_ROW = 38, A_LX = 560, A_PXM = 120
function bandA (chosen, focus, list = TPL) {
  const y = TB, h = A_BAND, cw = (W - HW) / TPL.length
  let s = R(0, y, W, h, { fill: K1 })
  list.forEach((t, i) => {
    const x = HW + i * cw, on = i === chosen
    if (on) s += R(x, y, cw, h, { fill: K3 })
    s += T(x + 14, y + 24.4, t.name, { size: 11, w: on ? 500 : 400, a: on ? 1 : .7 }) + trackLines(x + 14, y + 47, cw - 28, t, 13, on)
    s += vline(x - .5, y, y + h, on || i === chosen + 1 ? .1 : .07)
  })
  if (list.length < TPL.length) s += vline(HW + list.length * cw - .5, y, y + h, .07)
  s += T(14, y + 24.4, 'new project', { size: 12, w: 500, a: .94 })
  s += numbers(14, y + h - 38, TPL[chosen]) + inkKey(HW - 14, y + h - 38, 'create', '⌘n', focus)
  return s + hline(0, W, y + h - .5, .1)
}
function headA (y, any) {
  let s = R(0, y, W, RU_H, { fill: K1 }), t1 = '', t2 = ''
  const lab = (x, t, anchor = 'start') => T(x, y + 13.3, t, { size: 9, a: .38, anchor })
  s += lab(14, 'name') + lab(HW - 14, 'saved', 'end') + lab(HW + 46, 'tempo', 'end') + lab(HW + 62, 'key') + lab(HW + 148, 'tracks', 'end') + lab(HW + 198, 'length', 'end') + lab(HW + 254, 'on disk', 'end')
  for (let q = 0; A_LX + q * A_PXM / 4 < W; q++) {
    const x = A_LX + q * A_PXM / 4
    if (q % 4 === 0) { t1 += `M${n(x) + .5} ${y + 4}V${y + RU_H}`; s += T(x + 4, y + 11.6, `${q / 4}:00`, { size: 8.5, a: .58 }) } else t2 += `M${n(x) + .5} ${y + (q % 2 ? 16 : 12)}V${y + RU_H}`
  }
  return s + P(t2, { stroke: INK, sa: .14 }) + P(t1, { stroke: INK, sa: .26 }) + hline(0, W, y + RU_H - .5, .1) + vline(HW - .5, y, y + RU_H, .08)
}
function rowA (y, s, on) {
  const h = A_ROW, by = y + h / 2 + 3.9, wt = on ? 500 : 400
  let o = R(0, y, A_LX, h, { fill: on ? K3 : K1 }) + R(A_LX, y, W - A_LX, h, { fill: on ? K1 : K0 })
  const nm = fit(s.name, HW - 28 - 60 - (s.where ? tw(s.where, 9.5) + 9 : 0), 11.5, wt)
  o += T(14, by, nm, { size: 11.5, w: wt, a: s.gone ? .34 : on ? 1 : .9 })
  if (s.where) o += T(14 + tw(nm, 11.5, wt) + 9, by, s.where, { size: 9.5, a: .36 })
  o += T(HW - 14, by, s.saved, { size: 9.5, a: s.gone ? .3 : on ? .8 : .5, anchor: 'end' })
  const fa = on ? .9 : .62
  if (s.gone) o += T(HW + 22, by, `on ${s.gone}, which is not connected`, { size: 9.5, a: .34 })
  else {
    o += T(HW + 46, by, String(s.tempo), { size: 9.5, a: fa, anchor: 'end' }) + T(HW + 62, by, s.key || '', { size: 9.5, a: fa }) + T(HW + 148, by, String(s.count), { size: 9.5, a: fa, anchor: 'end' }) + T(HW + 198, by, fmtLen(s.len), { size: 9.5, a: fa, anchor: 'end' }) + T(HW + 254, by, s.size, { size: 9.5, a: fa, anchor: 'end' })
    o += overview(A_LX, y, h, s, A_PXM)
  }
  if (on) o += inkKey(W - 14, y + 9, 'open', '↩', true, 20, 9.5)
  return o + hline(0, W, y + h - .5, .06)
}
function frameA (first) {
  const y0 = TB + A_BAND, y1 = y0 + TOOL_H, y2 = y1 + RU_H, list = first ? [] : SONGS.slice(0, 17)
  let s = R(0, 0, W, H, { fill: K0 }) + title('Slur DAW') + bandA(0, first, first ? TPL.slice(0, 5) : TPL) + toolBar(0, y0, first ? 0 : 23, !first) + headA(y1, !first)
  s += R(0, y2, A_LX, H - FT - y2, { fill: K1 })
  list.forEach((q, i) => { s += rowA(y2 + i * A_ROW, q, i === 0) })
  let g = ''
  for (let m = 1; A_LX + m * A_PXM < W; m++) g += `M${A_LX + m * A_PXM + .5} ${y2}V${H - FT}`
  return s + P(g, { stroke: INK, sa: .035 }) + vline(HW - .5, y2, H - FT, .08) + vline(A_LX - .5, y1, H - FT, .08) + foot()
}

/* ══ b: two columns. On the left wall a new project: what it can begin as, one under the other, and the chosen one's
   tracks; the rest of the window is the projects as a plain table, a row as tall as a track's ══ */
function frameB () {
  const chosen = 2, t = TPL[chosen], list = SONGS, yb = H - FT
  let s = R(0, 0, W, H, { fill: K0 }) + title('Slur DAW') + R(0, TB, HW, yb - TB, { fill: K1 })
  s += T(14, TB + 24.4, 'new project', { size: 12, w: 500, a: .94 })
  let y = TB + 42
  s += hline(0, HW, y - .5, .06)
  TPL.forEach((q, i) => { const on = i === chosen; if (on) s += R(0, y, HW, ROW, { fill: K3 }); s += T(14, y + 16.3, q.name, { size: 10.5, w: on ? 500 : 400, a: on ? 1 : .72 }) + T(HW - 14, y + 16.3, q.tracks.length ? String(q.tracks.length) : '', { size: 9.5, a: on ? .7 : .34, anchor: 'end' }) + hline(0, HW, y + ROW - .5, .06); y += ROW })
  s += trackLines(14, y + 26, HW - 28, t, 17, true, 10)
  s += hline(0, HW, yb - 53.5, .08) + numbers(14, yb - 39, t) + inkKey(HW - 14, yb - 39, 'create', '⌘n', false)
  /* the table */
  const x0 = HW, y1 = TB + TOOL_H, y2 = y1 + RU_H
  s += toolBar(x0, TB, 23) + R(x0, y1, W - x0, RU_H, { fill: K1 }) + hline(x0, W, y2 - .5, .1)
  const C = { name: x0 + 14, saved: x0 + 330, tempo: x0 + 468, meter: x0 + 500, key: x0 + 560, tracks: x0 + 672, len: x0 + 740, size: x0 + 820, where: x0 + 856 }
  const lab = (x, tx, anchor = 'start') => T(x, y1 + 13.3, tx, { size: 9, a: .38, anchor })
  s += lab(C.name, 'name') + lab(C.saved, 'saved') + lab(C.tempo, 'tempo', 'end') + lab(C.meter, 'measure') + lab(C.key, 'key') + lab(C.tracks, 'tracks', 'end') + lab(C.len, 'length', 'end') + lab(C.size, 'on disk', 'end') + lab(C.where, 'where')
  list.forEach((q, i) => {
    const ry = y2 + i * ROW, by = ry + 16.3, on = i === 0, fa = on ? .9 : .62
    if (on) s += R(x0, ry, W - x0, ROW, { fill: K3 })
    s += T(C.name, by, q.name, { size: 10.5, w: on ? 500 : 400, a: q.gone ? .34 : on ? 1 : .9 }) + T(C.saved, by, q.saved, { size: 9.5, a: q.gone ? .3 : fa })
    if (q.gone) s += T(C.where, by, `${q.gone}, which is not connected`, { size: 9.5, a: .34 })
    else s += T(C.tempo, by, String(q.tempo), { size: 9.5, a: fa, anchor: 'end' }) + T(C.meter, by, q.meter, { size: 9.5, a: fa }) + T(C.key, by, q.key || '', { size: 9.5, a: fa }) + T(C.tracks, by, String(q.count), { size: 9.5, a: fa, anchor: 'end' }) + T(C.len, by, fmtLen(q.len), { size: 9.5, a: fa, anchor: 'end' }) + T(C.size, by, q.size, { size: 9.5, a: fa, anchor: 'end' }) + T(C.where, by, q.where || '', { size: 9.5, a: on ? .7 : .44 })
    if (on) s += inkKey(W - 12, ry + 3.5, 'open', '↩', true, 18, 9.5)
    s += hline(x0, W, ry + ROW - .5, .06)
  })
  return s + vline(HW - .5, TB, yb, .1) + foot()
}

/* the room with no project in it: its control bar standing at the first bar, no tracks, the ruler, the foot */
function emptyRoom () {
  const g = (d, line) => (x, y, c, a) => G(P(d, line ? { stroke: c, sa: a, sw: 1.2, cap: 'round' } : { fill: c, fa: a }), `translate(${x} ${y})`)
  const tr = [{ g: g('M-5 -4.5H-3.6V4.5H-5ZM4.6 -4.5L-2.6 0L4.6 4.5Z') }, { g: g('M-3.4 -4.8L5 0L-3.4 4.8Z') }, { g: g('M-4 -4H4V4H-4Z') }, { g: (x, y) => Cc(x, y, 4.2, { fill: REC }) }, { g: g('M-5.5 .5V-1a3 3 0 0 1 3 -3H3.4M1.4 -6.2L3.8 -4L1.4 -1.8M5.5 -.5V1a3 3 0 0 1 -3 3H-3.4M-1.4 6.2L-3.8 4L-1.4 1.8', true) }, { g: g('M-4 5.2L-1.7 -5.2H1.7L4 5.2ZM0 2.2L3.8 -3.2', true) }]
  const disp = [['1.1.1', 78, 500], ['0:00.0', 66, 400], ['120.00', 62, 400], ['4/4', 44, 400], ['key', 58, 400]], dw = disp.reduce((a, q) => a + q[1], 0), hh = H - TB
  const tw0 = tr.length * 30, tx = Math.round((W - tw0 - 10 - dw) / 2), lx = tx + tw0 + 10
  let s = R(0, 0, W, hh, { fill: K0 }) + R(0, 0, W, BAR_H, { fill: K2 }) + cells(12, 10, 24, [{ t: 'patch', k: 'b' }, { t: 'mixer', k: 'x' }], { size: 10 })[0] + cells(tx, 10, 24, tr, { widths: tr.map(() => 30) })[0]
  s += R(lx, 10, dw, 24, { rx: 2, fill: K0 }) + R(lx + .5, 10.5, dw - 1, 23, { rx: 2, stroke: INK, sa: .2 })
  let cx = lx
  disp.forEach(([v, w, wt], i) => { if (i) s += vline(cx - .5, 14, 30, .13); s += T(cx + w / 2, 26.4, v, { size: i ? 11.5 : 12.5, w: wt, a: i === 4 ? .36 : i ? .86 : 1, anchor: 'middle' }); cx += w })
  { const [c1, w1] = cells(0, 0, 24, [{ t: 'slur', k: 'o' }], { size: 10 }); s += G(c1, `translate(${W - 12 - w1} 10)`) }
  s += hline(0, W, BAR_H - .5, .1)
  /* the tracks' own bar, the markers' lane, the ruler */
  let y = BAR_H
  s += R(0, y, W, TOOL_H, { fill: K1 }) + R(10.5, y + 4.5, 17, 17, { rx: 2, stroke: INK, sa: .24 }) + P(`M19 ${y + 9.5}V${y + 16.5}M15.5 ${y + 13}H22.5`, { stroke: INK, sa: .8 }) + field(38, y + 16.6, 'tracks', '0')[0] + hline(0, W, y + TOOL_H - .5, .08)
  y += TOOL_H; s += R(0, y, W, MK_H, { fill: K1 }) + hline(0, W, y + MK_H - .5, .06)
  y += MK_H; s += R(0, y, W, RU_H, { fill: K1 }) + T(12, y + 13.3, 'bars', { size: 9, a: .38 }) + T(HW - 10, y + 13.3, '4/4', { size: 9, a: .38, anchor: 'end' })
  let t1 = '', t4 = '', grid = ''
  for (let b = 0; bx(b + 1) <= W; b++) {
    const x = bx(b + 1)
    if (b % 4 === 0) t4 += `M${n(x) + .5} ${y + (b % 8 === 0 ? 4 : 12)}V${y + RU_H}`; else t1 += `M${n(x) + .5} ${y + 16}V${y + RU_H}`
    if (b % 8 === 0) { s += T(x + 3.5, y + 11.6, String(b + 1), { size: 8.5, a: .58 }); grid += `M${n(x) + .5} ${y + RU_H}V${hh - FT}` }
  }
  s += P(t1, { stroke: INK, sa: .14 }) + P(t4, { stroke: INK, sa: .26 }) + hline(0, W, y + RU_H - .5, .1)
  y += RU_H
  s += R(0, y, HW, hh - FT - y, { fill: K1 }) + P(grid, { stroke: INK, sa: .04 }) + vline(HW - .5, BAR_H, hh - FT, .08)
  /* the foot, with nothing done yet */
  const fy = hh - FT, by = fy + 14.6
  s += R(0, fy, W, FT, { fill: K2 }) + hline(0, W, fy, .1)
  let x = W - 10
  const [k, kw] = key(0, 0, 'keys', { h: 16, size: 9, pad: 8 }); x -= kw; s += G(k, `translate(${x} ${fy + 3})`)
  const cell = (label, v) => { x -= 12; s += vline(x, fy + 6, fy + FT - 6, .1); x -= 12; x -= tw(v, 9.5); s += T(x, by, v, { size: 9.5, a: .8 }); x -= 5; x -= tw(label, 9.5); s += T(x, by, label, { size: 9.5, a: .4 }) }
  cell('buffer', '256'); cell('rate', '48k 24 bit'); cell('cpu', '0%')
  return s
}

/* ══ c: a sheet. The room is already there, empty, and over it a sheet cut like the one for a new track: a new project and
   what it begins as in one line of cells, and under it the projects ══ */
function frameC () {
  const sw = 760, rows = 12, sh = 62 + 54 + 46 + RU_H + rows * ROW + 58, sx = Math.round((W - sw) / 2), sy = TB + Math.round((H - TB - sh) / 2) - 8, xr = sx + sw - 30, xl = sx + 30
  const room = G(emptyRoom(), `translate(0 ${TB})`)
  let s = `<clipPath id="stc"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>` + G(R(0, 0, W, H, { fill: K0 }) + room, '', ' clip-path="url(#stc)"') + title('Slur DAW') + R(0, TB, W, H - TB, { fill: '#000000', fa: .46 })
  s += R(sx, sy, sw, sh, { rx: 4, fill: K2 }) + R(sx + .5, sy + .5, sw - 1, sh - 1, { rx: 4, stroke: INK, sa: .16 })
  let y = sy
  s += T(xl, y + 37, 'new project', { size: 12.5, w: 500, a: .96 }) + inkKey(xr, y + 19, 'create', '⌘n', false, 26, 10.5)
  y += 62; s += hline(sx + 1, sx + sw - 1, y - .5, .08)
  s += T(xl, y + 31.6, 'begins as', { size: 10.5, a: .46 })
  { const items = TPL.slice(0, 5).map((t, i) => ({ t: t.name, on: i === 0 })).concat([{ t: 'yours', g: (x, cy, c, a) => caret(x + 20, cy, .5) }]); const [c, cw] = cells(0, 0, 26, items, { size: 10.5, pad: 12, widths: items.map((it, i) => Math.round(tw(it.t, 10.5, 500) + 24 + (i === 5 ? 12 : 0))) }); s += G(c, `translate(${xr - cw} ${y + 14})`) }
  y += 54; s += hline(sx + 1, sx + sw - 1, y - .5, .08)
  { const [f] = field(xl, y + 28.6, 'projects', '23', { size: 10.5 }); s += f; const fw = 172, fx = xr - fw; s += R(fx + .5, y + 13.5, fw - 1, 19, { rx: 2, stroke: INK, sa: .2 }) + T(fx + 9, y + 26.4, 'find', { size: 9.5, a: .34 }) + T(fx + fw - 9, y + 26.2, '⌘f', { size: 8, a: .34, anchor: 'end' }) }
  y += 46
  const C = { name: xl, saved: sx + 356, tempo: sx + 490, key: sx + 508, tracks: sx + 610, len: xr }
  const lab = (x, tx, anchor = 'start') => T(x, y + 13.3, tx, { size: 9, a: .38, anchor })
  s += R(sx + 1, y, sw - 2, RU_H, { fill: K1 }) + lab(C.name, 'name') + lab(C.saved, 'saved') + lab(C.tempo, 'tempo', 'end') + lab(C.key, 'key') + lab(C.tracks, 'tracks', 'end') + lab(C.len, 'length', 'end') + hline(sx + 1, sx + sw - 1, y - .5, .08) + hline(sx + 1, sx + sw - 1, y + RU_H - .5, .08)
  y += RU_H
  SONGS.slice(0, rows).forEach((q, i) => {
    const ry = y + i * ROW, by = ry + 16.3, on = i === 0, fa = on ? .9 : .62
    s += R(sx + 1, ry, sw - 2, ROW, { fill: on ? K4 : K1 })
    s += T(C.name, by, q.name, { size: 10.5, w: on ? 500 : 400, a: q.gone ? .34 : on ? 1 : .9 }) + (q.where ? T(C.name + tw(q.name, 10.5, on ? 500 : 400) + 9, by, q.where, { size: 9.5, a: .36 }) : '') + T(C.saved, by, q.saved, { size: 9.5, a: q.gone ? .3 : fa })
    if (q.gone) s += T(C.tempo - tw('102', 9.5), by, `on ${q.gone}, which is not connected`, { size: 9.5, a: .34 })
    else if (on) s += T(C.tempo, by, String(q.tempo), { size: 9.5, a: fa, anchor: 'end' }) + T(C.key, by, q.key || '', { size: 9.5, a: fa }) + T(C.tracks, by, String(q.count), { size: 9.5, a: fa, anchor: 'end' }) + inkKey(xr, ry + 3.5, 'open', '↩', true, 18, 9.5)
    else s += T(C.tempo, by, String(q.tempo), { size: 9.5, a: fa, anchor: 'end' }) + T(C.key, by, q.key || '', { size: 9.5, a: fa }) + T(C.tracks, by, String(q.count), { size: 9.5, a: fa, anchor: 'end' }) + T(C.len, by, fmtLen(q.len), { size: 9.5, a: fa, anchor: 'end' })
    s += hline(sx + 1, sx + sw - 1, ry + ROW - .5, .06)
  })
  y += rows * ROW
  { const [c, cw] = cells(0, 0, 22, [{ t: 'open from disk', k: '⌘o' }], { size: 10 }); s += G(c, `translate(${xl} ${y + 18})`)
    const lab2 = 'when the app opens', [c2, cw2] = cells(0, 0, 22, [{ t: 'this sheet', on: true }, { t: 'the last project' }], { size: 10 })
    s += G(c2, `translate(${xr - cw2} ${y + 18})`) + T(xr - cw2 - 10, y + 33, lab2, { size: 10, a: .44, anchor: 'end' }) }
  return s
}

const FRAMES = { a: () => frameA(false), first: () => frameA(true), b: frameB, c: frameC }
window.startNames = { a: 'start 1 a lanes', first: 'start 1 a the first time', b: 'start 1 b table', c: 'start 1 c sheet' }
window.startFrame = k => { UID = 0; return FRAMES[k]() }
window.startSvg = k => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none">${window.startFrame(k)}</svg>`
})()
