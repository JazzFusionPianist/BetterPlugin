// node "design/transport draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the control bar with
// the place to the tick (bar . beat . sixteenth . tick, 240 ticks a sixteenth, 960 a beat, as Logic counts them), the time
// as SMPTE (hours:minutes:seconds:frames, 30 frames a second unless the project says otherwise), and the nudge and the grid
// taken out of the strip of the place, the tempo, the measure and the key into a box of their own, to the right:
//   now   the bar as it is
//   A     the two boxes side by side, a gap between them, together in the middle
//   B     the place's box in the middle as now; the nudge and the grid at the right end, beside the out
// each at a big window (1440) and a small one (1100). His ask, 2026-10-20 ("tick 까지", "SMPTE 표준에 맞게", "nudge랑 grid는
// 따로 오른쪽에 떼서"). Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))

const KIT = `
window.TD = {
  fps: 30,
  /* the place to the tick: bar . beat . sixteenth . tick (1 to 240, three figures so it does not jump) */
  place (p) { const b = Math.floor(p + 1e-6), bt = Math.max(0, p - b) * BEATS(), bi = Math.floor(bt + 1e-9), f = (bt - bi) * BEAT_16(), si = Math.floor(f + 1e-9), tk = Math.floor((f - si) * 240 + 1e-6)
    return b + 1 + '.' + Math.min(BEATS(), bi + 1) + '.' + (si + 1) + '.' + String(tk + 1).padStart(3, '0') },
  /* the time as SMPTE: hh:mm:ss:ff */
  smpte (p) { const fr = Math.floor(Math.max(0, p) * SPB() * TD.fps + 1e-6), ff = fr % TD.fps, s = Math.floor(fr / TD.fps), p2 = k => String(k).padStart(2, '0')
    return p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s / 60) % 60) + ':' + p2(s % 60) + ':' + p2(ff) },
}
window.tdBar = function (way) {
  let s = R(0, 0, W, 44, { fill: K2 })
  const g = (d, line) => (x, y, c, a) => G(P(d, line ? { stroke: c, sa: a, sw: 1.2, cap: 'round' } : { fill: c, fa: a }), 'translate(' + x + ' ' + y + ')')
  const tr = [
    { g: g('M-5 -4.5H-3.6V4.5H-5ZM4.6 -4.5L-2.6 0L4.6 4.5Z'), a: 'tostart' },
    { g: g('M-3.4 -4.8L5 0L-3.4 4.8Z'), on: S.playing && !S.rec, a: 'play' },
    { g: g('M-4 -4H4V4H-4Z'), a: 'stop' },
    { g: (x, y, c) => Cc(x, y, 4.2, { fill: c === K1 ? K1 : REC }), on: !!S.rec, c: REC, a: 'rec' },
    { g: g('M-5.5 .5V-1a3 3 0 0 1 3 -3H3.4M1.4 -6.2L3.8 -4L1.4 -1.8M5.5 -.5V1a3 3 0 0 1 -3 3H-3.4M-1.4 6.2L-3.8 4L-1.4 1.8', true), gc: S.cycle.on ? SOLO : INK, ga: S.cycle.on ? 1 : .78, a: 'loop' },
    { g: g('M-4 5.2L-1.7 -5.2H1.7L4 5.2ZM0 2.2L3.8 -3.2', true), on: S.click, a: 'click' },
    { g: g('M1.3 -5.8L-3.8 .7H-.2L-1.3 5.8L3.8 -.7H.2Z'), on: !!S.lowLat, c: MON, a: 'lowlat' },
  ]
  const x = W - 12 - 18, tempo = (+S.tempo).toFixed(2), keyName = S.key || 'key'
  const main = [[TD.place(curPos()), 100, 500, 'pos'], [TD.smpte(curPos()), 94, 400, null], [tempo, 62, 400, 'tempo'], [meterName(), 44, 400, 'meter'], [fit(keyName, 50, 11.5), 58, 400, 'key']]
  const side = [['nudge', S.nudge, NUDGE_W], ['grid', gridName(), GRID_W]]
  const mw = main.reduce((a, q) => a + q[1], 0), sw = side.reduce((a, q) => a + q[2], 0), tw0 = tr.length * 30, GAP = 12
  const METER = 60, outW = 26 + METER + 30                                                                  // ('out', its meter, its db)
  let tx, sx
  if (way === 'A') { const all = tw0 + 10 + mw + GAP + sw; tx = Math.min(Math.round((W - all) / 2), Math.floor(x - outW - 24 - all)); sx = tx + tw0 + 10 + mw + GAP }
  else { sx = Math.floor(x - outW - 24 - sw); const all = tw0 + 10 + mw; tx = Math.min(Math.round((W - all) / 2), sx - 24 - all) }
  const lx = tx + tw0 + 10
  s += cells(tx, 10, 24, tr, { widths: tr.map(() => 30) })[0]
  const box = (bx, w) => R(bx, 10, w, 24, { rx: 2, fill: K0 }) + R(bx + .5, 10.5, w - 1, 23, { rx: 2, stroke: INK, sa: .2 })
  s += box(lx, mw)
  let cx = lx
  main.forEach(([v, w, wt], i) => { if (i) s += vline(cx - .5, 14, 30, .13); s += T(cx + w / 2, 26.4, v, { size: i ? 11.5 : 12.5, w: wt, a: i === 4 && !S.key ? .36 : i ? .86 : 1, anchor: 'middle' }); cx += w })
  s += box(sx, sw); cx = sx
  side.forEach(([a, v, w], i) => { if (i) s += vline(cx - .5, 14, 30, .13); const lw = tw(a, 9.5), x0 = cx + (w - lw - 5 - tw(v, 11.5)) / 2; s += T(x0, 26.2, a, { size: 9.5, a: .4 }) + T(x0 + lw + 5, 26.4, v, { size: 11.5, a: .86 }); cx += w })
  const mx = x - 30 - METER
  s += T(x, 25.6, fmtDb(S.master), { size: 10, a: .82, anchor: 'end' })
  for (let c = 0; c < 2; c++) { const y = 18 + c * 5; s += R(mx, y, METER, 2.5, { fill: INK, fa: .12 }) + R(mx, y, 0, 2.5, { fill: LEVEL, fa: .86 }) }
  s += R(mx + METER * volF(0), 15, 1, 13.5, { fill: INK, fa: .28 }) + T(mx - 8, 25.6, 'out', { size: 9.5, a: .4, anchor: 'end' })
  return s + hline(0, W, 44 - .5, .1)
}
`
const shots = []
async function bar (label, width, way) {
  const b = await open(PAGE, { width, height: 760, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    S.nudge = '1/16'; jumpTo(4 + 1 / 4 + 2 / 16 + 119 / 3840); S.panel.on = false; setView(true)
    ${way ? `pBar = () => tdBar('${way}')` : ''}
    dirtyAll(); flush()`)
  await b.sleep(250)
  const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height: 120, scale: 1 } })
  shots.push({ label, width, png: r.data })
  console.log(label, JSON.stringify(b.errors))
  await b.close()
}
await bar('now', 1440, null)
await bar('A, 1440', 1440, 'A'); await bar('A, 1100', 1100, 'A')
await bar('B, 1440', 1440, 'B'); await bar('B, 1100', 1100, 'B')
/* the sheets: each way at both sizes, under the bar as it is now */
async function sheet (file, picks) {
  const html = picks.map(k => shots.find(x => x.label === k)).map(x => `<div style="margin:22px 20px 0"><div style="font:500 13px -apple-system;color:#555;margin-bottom:6px">${x.label}</div><img src="data:image/png;base64,${x.png}" style="width:${x.width}px;height:120px;display:block;border:1px solid #ddd"></div>`).join('')
  const tmp = join(tmpdir(), 'transport-draft-sheet.html')
  writeFileSync(tmp, `<!doctype html><html data-ready="1"><body style="margin:0;background:#f4f3ef">${html}</body></html>`)
  const b = await open(tmp, { width: 1480, height: 20 + picks.length * 150, dsf: 2 })
  await b.sleep(300)
  const r = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  await b.close(); rmSync(tmp)
}
await sheet('A side by side in the middle.png', ['now', 'A, 1440', 'A, 1100'])
await sheet('B nudge and grid at the right end.png', ['now', 'B, 1440', 'B, 1100'])
process.exit(0)
