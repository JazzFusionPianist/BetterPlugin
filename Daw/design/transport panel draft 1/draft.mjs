// node "design/transport panel draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the room as it
// comes (its own type, its own colours), with the transport taken out of the bar at the top into a column down the left,
// as bauhaus has it — but drawn as an instrument's panel: numbered sections, each readout with its legend under it, the
// out on a measured scale. No name at its head, neither the song's nor the program's (his rule).
//   01 position   bar . beat . division . tick, large, in fixed places; under it the time as SMPTE, its rate beside it
//   02 transport  four keys; cycle, click and low latency as lamps; the song as a line, the cycle on it, the playhead
//   03 time       tempo, measure (the beats as squares, the one sounding filled), key — each a row with a leader
//   04 edit       nudge and grid, apart from the rest (his ask of 2026-10-20)
//   05 out        its level, the two sides as bars over a scale in db, where the fader stands marked
// His ask, 2026-10-20 ("transport bar를 왼쪽 패널에 배치한거 … 정말로 세련되고 공대 감성이 들게 (폰트는 그대로, 프로젝트
// 명과 제품명을 표기하지 않고)"). Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))

const KIT = `
SKIN_BANDS.panel = [0, 0, 236]
{ const read0 = skinRead; skinRead = function () { read0(); SKIN.k.transport = 'panel' } }
window.TP = {
  CW: 236, L: 20,
  lv: [.62, .55],                                                                   // (the two sides' levels as drawn: a still of the song playing)
  num: ' style="font-variant-numeric: tabular-nums"',
  /* a section's head: its number, its name, a rule to the edge with a mark at its end */
  head (y, k, name) {
    const { L, CW } = TP, x1 = L + 18 + tw(name, 9, 500) + 8
    return T(L, y, k, { size: 8, a: .3, x: TP.num }) + T(L + 18, y, name, { size: 9, w: 500, a: .62 }) + R(x1, y - 3, CW - L - x1, .6, { fill: INK, fa: .14 }) + R(CW - L - .3, y - 6, .6, 6, { fill: INK, fa: .3 })
  },
  /* figures in fixed places, as a counter shows them: every character in its own slot, the fields' leading zeros dim,
     each field's legend under it on a rule of its width */
  fields (x, y, size, parts, legend, o = {}) {
    const wt = o.w || 400, dw = tw('0', size, wt), sep = o.sep || '.', sw = tw(sep, size, wt) + (o.gap || 3)
    let s = '', cx = x, lead = true
    parts.forEach((v, i) => {
      v = String(v).padStart(o.widths ? o.widths[i] : String(v).length, '0')
      if (i) { s += T(cx + sw / 2, y, sep, { size, w: wt, a: lead ? .16 : .42, anchor: 'middle' }); cx += sw }
      const x0 = cx
      for (let k = 0; k < v.length; k++) {
        if (v[k] !== '0' || (i === parts.length - 1 && k === v.length - 1) || (o.keep && o.keep[i])) lead = false
        s += T(cx + dw / 2, y, v[k], { size, w: wt, a: lead ? .16 : 1, anchor: 'middle' }); cx += dw
      }
      if (o.notLead && o.notLead[i]) lead = false
      if (legend) s += R(x0, y + 6, cx - x0, .6, { fill: INK, fa: .2 }) + T((x0 + cx) / 2, y + 16, legend[i], { size: 7.5, a: .38, anchor: 'middle' })
    })
    return s
  },
  key (x, y, w, h, icon, on, c) { return R(x, y, w, h, { rx: 3, fill: on ? (c || INK) : K0 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 3, stroke: INK, sa: on ? 0 : .16 }) + icon(x + w / 2, y + h / 2, on ? K1 : INK, on ? 1 : .82) },
  lamp (x, y, w, h, word, on, c) { return R(x + .5, y + .5, w - 1, h - 1, { rx: 2.5, stroke: INK, sa: .16 }) + R(x + 9, y + h / 2 - 2.5, 5, 5, on ? { fill: c || INK } : { stroke: INK, sa: .5, sw: .8 }) + T(x + 20, y + h / 2 + 3.3, word, { size: 9.5, a: on ? .95 : .55 }) },
  row (y, label, value, o = {}) {
    const { L, CW } = TP, R0 = CW - L, vw = tw(value, o.size || 12.5, 400) + (o.unit ? tw(o.unit, 8) + 4 : 0) + (o.chev ? 16 : 0), lx = L + tw(label, 10) + 8
    let s = T(L, y, label, { size: 10, a: .55 }) + P('M' + n(lx) + ' ' + n(y - 3) + 'H' + n(R0 - vw - 8), { stroke: INK, sa: .22, sw: .8, x: ' stroke-dasharray="1 3"' })
    let x = R0 - (o.chev ? 16 : 0)
    if (o.unit) { s += T(x, y, o.unit, { size: 8, a: .4, anchor: 'end' }); x -= tw(o.unit, 8) + 4 }
    s += T(x, y, value, { size: o.size || 12.5, a: o.dimV ? .38 : .95, anchor: 'end', x: TP.num })
    if (o.chev) s += P('M' + n(R0 - 7) + ' ' + n(y - 6) + 'l3.5 3.5 3.5 -3.5', { stroke: INK, sa: .45, sw: 1, x: ' fill="none"' })
    return s
  },
}
const pIcon = (d, line) => (x, y, c, a) => G(P(d, line ? { stroke: c, sa: a, sw: 1.2, cap: 'round' } : { fill: c, fa: a }), 'translate(' + x + ' ' + y + ')')
SKINS.left.panel = () => {
  const { CW, L } = TP, R0 = CW - L, p = curPos(), up = 0
  let s = R(0, 0, CW, H, { fill: K2 }) + R(CW - 1, 0, 1, H, { fill: INK, fa: .1 })
  /* 01 position */
  s += TP.head(30, '01', 'position')
  const pl = place(p).split('.'), tc = smpte(p).split(/[:;]/)
  s += TP.fields(L, 78, 30, pl, ['bar', 'beat', 'div', 'tick'], { widths: [3, 1, 1, 3], gap: 4, keep: [0, 1, 1, 1] })
  s += TP.fields(L, 128, 16, tc, ['h', 'm', 's', 'f'], { sep: smpteRate().drop ? ';' : ':', gap: 3, keep: [0, 0, 1, 1] })
  const fps = smpteRate().t + ' fps', fw = tw(fps, 8) + 10
  s += R(R0 - fw + .5, 115.5, fw - 1, 15, { rx: 2, stroke: INK, sa: .22 }) + T(R0 - fw / 2, 126, fps, { size: 8, a: .55, anchor: 'middle' })
  /* 02 transport */
  s += TP.head(178, '02', 'transport')
  const kw = (R0 - L - 18) / 4, ky = 192
  s += TP.key(L, ky, kw, 36, pIcon('M-5 -4.5H-3.6V4.5H-5ZM4.6 -4.5L-2.6 0L4.6 4.5Z'))
  s += TP.key(L + (kw + 6), ky, kw, 36, pIcon('M-3.4 -4.8L5 0L-3.4 4.8Z'), S.playing)
  s += TP.key(L + 2 * (kw + 6), ky, kw, 36, pIcon('M-4 -4H4V4H-4Z'))
  s += TP.key(L + 3 * (kw + 6), ky, kw, 36, (x, y, c, a) => Cc(x, y, 4.6, { fill: REC }))
  const lw = (R0 - L - 12) / 3, ly = 236
  s += TP.lamp(L, ly, lw, 24, 'cycle', S.cycle.on, SOLO) + TP.lamp(L + lw + 6, ly, lw, 24, 'click', S.click) + TP.lamp(L + 2 * (lw + 6), ly, lw, 24, 'low lat', !!S.lowLat, MON)
  /* the song as a line: its parts as ticks, the cycle on it, where the playhead is */
  const my = 284, end = SONG_END, X = b => L + (R0 - L) * b / end
  s += R(L, my, R0 - L, .8, { fill: INK, fa: .3 })
  for (const sc of SCENES) s += R(X(sc.a - 1), my - 3, .7, 6.8, { fill: INK, fa: .38 })
  if (S.cycle.on) s += R(X(S.cycle.a), my - 2, X(S.cycle.b) - X(S.cycle.a), 4.8, { fill: SOLO, fa: .9 })
  s += P('M' + n(X(p)) + ' ' + (my - 8) + 'l-3.2 -5h6.4z', { fill: INK }) + R(X(p) - .4, my - 8, .8, 14, { fill: INK, fa: .9 })
  s += T(L, my + 17, '1', { size: 7.5, a: .38, x: TP.num }) + T(R0, my + 17, String(Math.round(end) + 1), { size: 7.5, a: .38, anchor: 'end', x: TP.num })
  if (S.cycle.on) s += T((X(S.cycle.a) + X(S.cycle.b)) / 2, my + 17, 'cycle ' + Math.round(S.cycle.a + 1) + ' – ' + Math.round(S.cycle.b + 1), { size: 7.5, a: .6, anchor: 'middle', x: TP.num })
  /* 03 time */
  s += TP.head(336, '03', 'time')
  s += TP.row(362, 'tempo', (+S.tempo).toFixed(3), { unit: 'bpm' })
  s += TP.row(386, 'measure', meterName())
  const nb = BEATS(), bi = Math.floor((p - Math.floor(p)) * nb + 1e-9), bx0 = L + tw('measure', 10) + 12
  for (let k = 0; k < nb; k++) s += k === bi ? R(bx0 + k * 9, 378.5, 6, 6, { fill: INK, fa: .85 }) : R(bx0 + k * 9 + .4, 378.9, 5.2, 5.2, { stroke: INK, sa: .35, sw: .8 })
  s += TP.row(410, 'key', S.key || '—', { dimV: !S.key })
  /* 04 edit */
  s += TP.head(458, '04', 'edit')
  s += TP.row(484, 'nudge', S.nudge, { chev: true }) + TP.row(508, 'grid', gridName(), { chev: true })
  /* 05 out: at the foot of the column */
  const oy = H - FOOT_H - 132
  s += TP.head(oy, '05', 'out')
  s += T(L, oy + 40, fmtDb(S.master), { size: 26, w: 400, x: TP.num }) + T(L + tw(fmtDb(S.master), 26) + 8, oy + 40, 'db', { size: 9, a: .45 })
  s += T(R0, oy + 40, 'peak ' + fmtDb(-3.1), { size: 8.5, a: .55, anchor: 'end' })
  const sx = L, sw = R0 - L, by = oy + 58, F = db => sx + sw * volF(db)
  TP.lv.forEach((f, c) => { const y = by + c * 7; s += R(sx, y, sw, 4, { fill: INK, fa: .08 }) + R(sx, y, sw * f, 4, { fill: LEVEL, fa: .9 }) + R(sx + sw * (f + .04), y, 1.2, 4, { fill: INK, fa: .7 }) + T(sx - 7, y + 4.2, c ? 'r' : 'l', { size: 7, a: .38 }) })
  const ty = by + 18
  for (const db of [-48, -36, -24, -18, -12, -9, -6, -3, 0, 3, 6]) s += R(F(db) - .3, ty, .6, [-48, -24, -12, -6, 0, 6].includes(db) ? 5 : 3, { fill: INK, fa: .4 })
  for (const db of [-48, -24, -12, -6, 0, 6]) s += T(F(db), ty + 15, db > 0 ? '+' + db : String(db).replace('-', '−'), { size: 7.5, a: .42, anchor: 'middle', x: TP.num })
  s += P('M' + n(F(S.master)) + ' ' + (by - 3) + 'l-3.5 -6h7z', { fill: INK }) + R(F(S.master) - .4, by - 3, .8, 17, { fill: INK, fa: .55 })
  return G(s, 'translate(' + (-CW) + ' 0)')
}
`
async function sheet (file, width, height, setup, clip) {
  const b = await open(PAGE, { width, height, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    S.nudge = '1/16'; S.cycle = { on: true, a: 16, b: 24 }; jumpTo(4 + 1 / 4 + 2 / 16 + 119 / 3840); S.playing = false
    ${setup}
    if (typeof skinLayout === 'function') skinLayout(); fitRoom(); setView(true); dirtyAll(); flush(); return 1`)
  await b.sleep(400)
  await b.ev(`dirtyAll(); flush(); return 1`)
  const r = await b.send('Page.captureScreenshot', clip ? { format: 'png', clip: { x: 0, y: 0, width: clip[0], height: clip[1], scale: 1.5 } } : { format: 'png' })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
await sheet('1 the room, 1440.png', 1440, 900, `S.panel.on = false`)
await sheet('2 with the mixer, 1440.png', 1440, 900, `S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 316`)
await sheet('3 a small window, 1100.png', 1100, 700, `S.panel.on = false`)
await sheet('4 the column, close.png', 1440, 900, `S.panel.on = false`, [236, 900])
process.exit(0)
