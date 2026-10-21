// node "design/transport strip draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the chosen
// track's strip in the transport panel (his ask, 2026-10-21: "inspector strip을 … 트랜스포트 바 하단이랑 중간에 마스터랑
// 사이 공간에 작게"), in the room between the out's ring and the foot:
//   its level short — two bars as loud as each side, the fader's line beside them, the white square for a handle;
//   its level large beside it, and the loudest peak under it (a light that fills red once it has clipped);
//   at the right, on the panel's second column: its plug-ins as a list of names (+ plug-in), then its sends as round
//     knobs, the bus each goes to under it, a + for one more.
// The groups above give up a little of the room between them for it; the strips beside the patch go (the patch has the
// whole width). Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
setTimeout(() => { console.log('timed out'); process.exit(2) }, 240000)

/* the panel as built (ui/panel.js, read here: the page has it wrapped by the quick help's ?) */
const PANEL_SRC = (() => { const all = readFileSync(join(here, '../../ui/panel.js'), 'utf8'), i = all.indexOf('SKINS.left.panel = () => {'), j = all.indexOf('\n}\n', i); return all.slice(i + 'SKINS.left.panel = '.length, j + 2) })()
const KIT = `
window.TS = { lv: [.62, .57], pk: -3.4, clip: false }
/* the panel as built, given room for the strip: the groups' gaps take a sixth share, the strip stands over the foot */
{ let src = ${JSON.stringify(PANEL_SRC)}
  const a = 'const gap = clamp((H - FOOT_H - 24 - foot - (playH + posH + timeH + cycH + outH)) / 5, 12, 40)'
  if (!src.includes(a)) throw new Error('panel changed: gap')
  src = src.replace(a, 'const room0 = H - FOOT_H - 24 - foot - 36 - (playH + posH + timeH + cycH + outH), stripH = room0 - 6 * 10 >= 92 ? Math.min(124, room0 - 6 * 10) : 50, gap = clamp((room0 - stripH) / 6, 6, 40), below = clamp(gap * .6, 8, 22)')
  const b = '  /* the foot, on the same two columns'
  if (!src.includes(b)) throw new Error('panel changed: foot')
  src = src.replace(b, '  s += tsStrip(f0 - 36 - below - stripH, stripH, GL, GR, RE)\\n' + b)
  const c = 'bottom = f0 - 16'
  if (!src.includes(c)) throw new Error('panel changed: bottom')
  src = src.replace(c, 'bottom = f0 - 36 - below - stripH - 10')
  const left0 = eval('(' + src + ')')
  SKINS.left.panel = function () {      // (the quick help's ?, as quickhelp.js draws it)
    const s = left0.apply(this, arguments), x = TPX.CW - 24, y = 24
    const q = Cc(x, y, 7.5, { stroke: INK, sa: .5, sw: 1 }) + T(x, y + 3.5, '?', { size: 10, w: 600, c: INK, a: .7, anchor: 'middle' })
    return s.endsWith('</g></g>') ? s.slice(0, -8) + q + '</g></g>' : s + G(q, 'translate(' + (-TPX.CW) + ' 0)')
  } }
function tsStrip (top, h, GL, GR, RE) {
  const t = S.tracks[S.sel]
  if (!t) return ''
  const ft = top + 4, fb = top + h - 4, vol = shown(t, 'vol'), yOf = db => fb - (fb - ft) * volF(db), fy = yOf(vol)
  let s = ''
  if (h < 80) {
    /* a short window: the strip on one line — its level two bars across with the fader's line under them, its level and
       peak under that; its plug-ins one line (the first named, how many more), its sends small knobs */
    const w = GR - GL - 16, y0 = top + 3
    for (let k = 0; k < 2; k++) s += R(GL, y0 + k * 6, w, 4, { fill: INK, fa: .06 }) + R(GL, y0 + k * 6, w * TS.lv[k], 4, { fill: t.c, fa: .95 })
    const ly = top + 20, hx = GL + w * volF(vol)
    s += R(GL, ly - .6, w, 1.2, { fill: INK, fa: .85 }) + R(hx - 5, ly - 5, 10, 10, { fill: '#FFFFFF' })
    s += T(GL, top + 45, fmtDb(vol), { size: 17, w: 500, x: tpNum }) + Cc(GL + 52, top + 40.5, 3.2, { stroke: REC, sa: .8, sw: 1, fill: TS.clip ? REC : 'none' }) + tpCap(GL + 59, top + 43, 'peak ' + fmtDb(TS.pk), { a: .5, x: tpNum })
    const items = fxItems(t), it = items[0]
    if (it) s += R(GR, top + 3, 6.5, 6.5, { fill: it.c || MP_PRINT_C()[it.k] || t.c }) + T(GR + 11, top + 9.5, fit(asGiven(it.t), 62, 8.5) + (items.length > 1 ? '  +' + (items.length - 1) : ''), { size: 8.5, a: .85, x: ' xml:space="preserve"' })
    s += mpPlus(RE - 5, top + 6)
    const r = 7, cy = top + 28, sends = (t.sends || []).slice(0, 3)
    sends.forEach((sd, k) => { const cx = GR + r + k * 24, b = byId(sd.to), bus = b ? asGiven(b.name) : 'send'
      s += mpSendKnob(cx, cy, r, volF(sd.db), t.c, bus) + T(cx, cy + r + 9, fit(bus, 22, 7, 500), { size: 7, w: 500, a: .6, anchor: 'middle' }) })
    { const cx = GR + r + sends.length * 24; s += Cc(cx, cy, r - .5, { stroke: INK, sa: .3, sw: .9, dash: '2 2' }) + P('M' + n(cx) + ' ' + n(cy - 2.5) + 'V' + n(cy + 2.5) + 'M' + n(cx - 2.5) + ' ' + n(cy) + 'H' + n(cx + 2.5), { stroke: INK, sa: .6, sw: 1 }) }
    return s
  }
  /* its level: two short bars of its colour, the fader's line, the white square */
  const bw = 5, bx0 = GL
  for (let k = 0; k < 2; k++) { const x = bx0 + k * (bw + 2), l = TS.lv[k]; s += R(x, ft, bw, fb - ft, { fill: INK, fa: .06 }) + R(x, fb - (fb - ft) * l, bw, (fb - ft) * l, { fill: t.c, fa: .95 }) }
  const lx = bx0 + 2 * bw + 2 + 14
  for (const db of DBS) s += R(lx - 5, yOf(db) - .3, db === 0 ? 3.5 : 2.5, .6, { fill: INK, fa: db === 0 ? .55 : .3 })
  s += R(lx - .6, ft, 1.2, fb - ft, { fill: INK, fa: .85 }) + R(lx - 5, fy - 5, 10, 10, { fill: '#FFFFFF' })
  /* its level large, the loudest peak under it */
  const vx = lx + 16
  s += T(vx, ft + 20, fmtDb(vol), { size: 24, w: 500, x: tpNum }) + tpCaps(vx + 1, ft + 33, 'level', { a: .4 })
  s += Cc(vx + 4, ft + 52, 3.6, { stroke: REC, sa: .8, sw: 1, fill: TS.clip ? REC : 'none' }) + tpCap(vx + 12, ft + 54.5, 'peak ' + fmtDb(TS.pk), { a: .5, x: tpNum })
  /* its plug-ins, a list of names; its sends, round knobs with the bus under each */
  let ly = ft + 8
  const items = fxItems(t), show = Math.min(items.length, 3)
  items.slice(0, show).forEach((it, k) => {
    if (k === show - 1 && items.length > show) s += T(GR, ly, '+' + (items.length - k) + ' more', { size: 8.5, a: .5 })
    else s += R(GR, ly - 6.5, 6.5, 6.5, { fill: it.c || MP_PRINT_C()[it.k] || t.c, fa: it.off ? .4 : 1 }) + T(GR + 11, ly, fit(asGiven(it.t), RE - GR - 11, 8.5), { size: 8.5, a: it.off ? .4 : .85 })
    ly += 13
  })
  s += mpPlus(GR + 3, ly - 3) + T(GR + 11, ly, 'plug-in', { size: 8, a: .4 })
  const r = 8, cy = ly + 14 + r, sends = (t.sends || []).slice(0, 3)
  sends.forEach((sd, k) => { const cx = GR + r + k * 26, b = byId(sd.to), bus = b ? asGiven(b.name) : 'send'
    s += mpSendKnob(cx, cy, r, volF(sd.db), t.c, bus) + T(cx, cy + r + 10, fit(bus, 24, 7.5, 500), { size: 7.5, w: 500, a: .6, anchor: 'middle' }) })
  { const k = sends.length, cx = GR + r + k * 26
    s += Cc(cx, cy, r - .5, { stroke: INK, sa: .3, sw: .9, dash: '2 2' }) + P('M' + n(cx) + ' ' + n(cy - 3) + 'V' + n(cy + 3) + 'M' + n(cx - 3) + ' ' + n(cy) + 'H' + n(cx + 3), { stroke: INK, sa: .6, sw: 1 }) + T(cx, cy + r + 10, 'send', { size: 7.5, a: .35, anchor: 'middle' }) }
  return s
}
`
const scene = `const tr = k => S.tracks.find(x => x.name === k)
  const bus = (name, c) => { const b = mkTrack(name, null, null, null, null, 0, [], NO_PATCH()); b.kind = 'bus'; S.tracks.push(b); return b }
  const verb = bus('verb'), dly = bus('delay')
  tr('keys').inserts = [{ name: 'Pro-Q 4', uid: 1 }, { name: 'Decapitator', uid: 2 }]
  tr('keys').sends = [{ to: verb.id, db: -11 }, { to: dly.id, db: -19 }]
  tr('keys').vol = -4.5
  if (typeof repaint === 'function') repaint()
  S.sel = S.tracks.findIndex(t => t.name === 'keys'); S.selT = []`
async function sheet (file, width, height, setup, clip) {
  const b = await open(PAGE, { width, height, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    jumpTo(18 + 2 / 4 + 1 / 16 + 37 / 3840)
    ${scene}
    ${setup}
    tpanelSet(true, false); setView(true); dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  await b.sleep(400)
  await b.ev(`dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  const r = await b.send('Page.captureScreenshot', clip ? { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: clip[4] || 2 } } : { format: 'png' })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
await sheet('1 the room, 1440 x 900.png', 1440, 900, '')
await sheet('2 the column, close.png', 1440, 900, '', [0, 0, 248, 900, 2])
await sheet('3 the strip, closer.png', 1440, 900, '', [0, 560, 248, 300, 3])
await sheet('4 a small window, 1100 x 700.png', 1100, 700, '', [0, 0, 248, 700, 2])
await sheet('5 a tall window, 1440 x 1100.png', 1440, 1100, '', [0, 0, 248, 1100, 2])
await sheet('6 a window between, 1280 x 780.png', 1280, 780, '', [0, 0, 248, 780, 2])
process.exit(0)
