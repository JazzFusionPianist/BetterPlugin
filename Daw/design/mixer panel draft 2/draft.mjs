// node "design/mixer panel draft 2/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the mixer freed of
// its rows (his word, 2026-10-21: "위아래로 인서트와 샌드를 거는 이 정형화된 레이아웃이 뭔가 별로 … 조금 더 자유롭게 가되,
// 기능은 해치지 않는 느낌"). Each strip is one line, the way its sound goes, top to bottom:
//   where it comes in, small, at the head of the line;
//   its patch as marks on the line — a plug-in a small square, a print a dot of its colour — its name beside each, as
//     many as it has (none: the line runs on), a + after them;
//   its sends as arms off the line to the right, each as long as it sends, a small white square at its end, the bus
//     named over it; a + for another;
//   the line through its pan — a small ring of ticks, a white square where it stands;
//   the line becomes its fader: a scale along it, the white square for a handle, its two meters beside it — the faders
//     of every strip on one line across, so their levels can be read against each other;
//   where it goes, small, at the line's foot; what it reads, large; r i m s as the panel's shapes; its name.
// So a strip is as long above its fader as its patch and sends are; nothing stands in rows across the strips. The gutter
// keeps only the scale. With the transport panel (ui/panel.js, as built) beside it. Nothing of this is in the app: the
// page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
setTimeout(() => { console.log('timed out'); process.exit(2) }, 240000)

const KIT = `
window.MP = { lv: new Map() }
const mpNum = ' style="font-variant-numeric: tabular-nums"'
const mpCaps = (x, y, w, o = {}) => T(x, y, String(w).toUpperCase(), Object.assign({ size: 5.8, w: 600, a: .42, x: ' letter-spacing="1.1"' }, o))
const mpShape = (k, cx, cy, z, on) => {
  if (k === 'r') return on ? Cc(cx, cy, z / 2, { fill: REC }) : Cc(cx, cy, z / 2 - .4, { stroke: REC, sa: .9, sw: .9 })
  if (k === 'i') { const d = 'M' + n(cx) + ' ' + n(cy - z / 2 - .6) + 'L' + n(cx + z / 2 + .6) + ' ' + n(cy) + 'L' + n(cx) + ' ' + n(cy + z / 2 + .6) + 'L' + n(cx - z / 2 - .6) + ' ' + n(cy) + 'Z'; return P(d, on ? { fill: MON } : { stroke: MON, sa: .9, sw: .9, x: ' stroke-linejoin="round"' }) }
  if (k === 's') { const d = 'M' + n(cx) + ' ' + n(cy - z / 2) + 'L' + n(cx + z / 2 + .4) + ' ' + n(cy + z / 2) + 'L' + n(cx - z / 2 - .4) + ' ' + n(cy + z / 2) + 'Z'; return P(d, on ? { fill: SOLO } : { stroke: INK, sa: .75, sw: .9, x: ' stroke-linejoin="round"' }) }
  return on ? R(cx - z / 2, cy - z / 2, z, z, { fill: INK }) : R(cx - z / 2 + .4, cy - z / 2 + .4, z - .8, z - .8, { stroke: INK, sa: .75, sw: .9 })
}
const mpPan = (cx, cy, r, pan) => {
  let s = Cc(cx, cy, r + 3, { fill: K1 })
  for (let k = 0; k <= 12; k++) { const a = (-135 + k * 22.5 - 90) * Math.PI / 180, l = k === 6 ? 3 : 1.6; s += P('M' + n(cx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r) + 'L' + n(cx + Math.cos(a) * (r - l)) + ' ' + n(cy + Math.sin(a) * (r - l)), { stroke: INK, sa: k === 6 ? .6 : .3, sw: .7 }) }
  const a = (pan * 135 - 90) * Math.PI / 180
  return s + R(cx + Math.cos(a) * (r - .8) - 2.3, cy + Math.sin(a) * (r - .8) - 2.3, 4.6, 4.6, { fill: INK })
}
/* the gutter: only the scale, where the faders stand */
const mpNeed = t => 38 + (t.theirs ? 0 : (fxItems(t).length + 1) * 15) + (t.sends || []).length * 20 + 10 + 30
const mpGeom = (y, h, wide, knob) => { const q = stripGeom(y, h, wide, knob), ft = Math.min(q.fb - 60, y + Math.max(...S.tracks.map(mpNeed)) + 6); return Object.assign({}, q, { ft, fh: q.fb - ft, yOf: db => q.fb - (q.fb - ft) * volF(db) }) }      // (the faders begin under the longest strip's patch and sends, all on one line)
stripGutter = function (x, w, y, h, wide, knob) {
  const q = mpGeom(y, h, wide, knob)
  let s = ''
  for (const db of DBS) s += T(x + w - 6, q.yOf(db) + 2.5, db === -48 ? '∞' : (db > 0 ? '+' : db < 0 ? '−' : '') + Math.abs(db), { size: 7, a: db === 0 ? .6 : .35, anchor: 'end', x: mpNum })
  return s
}
strip = function (x, y, w, h, t, i, o = {}) {
  const q = mpGeom(y, h, !!o.wide, !!o.knob), master = !!o.master, sel = !!o.sel, pad = 5, sx = x + pad, sw = w - 2 * pad, lx = x + 13, c = master ? INK : t.c
  let s = ''
  const line = (y0, y1, a = .4) => y1 > y0 ? R(lx - .4, y0, .8, y1 - y0, { fill: INK, fa: a }) : ''
  /* where it comes in */
  const inw = master ? 'mix' : t.kind === 'bus' ? feedsOf(t) + ' sends' : t.theirs ? t.theirs : t.inst ? 'keys' : inputName(t.inp || 0)
  s += mpCaps(lx - 3, y + 12, fit(inw, sw, 6), { a: .4 })
  let yy = y + 22
  s += Cc(lx, yy, 2.4, { stroke: c, sw: 1, sa: .9 })
  let top = yy + 2.4
  /* its patch: marks on the line, names beside */
  yy += 16
  if (!master) {
    const items = fxItems(t)
    for (const it of items) {
      s += line(top, yy - 3) + (it.kind === 'print' ? Cc(lx, yy, 2.6, { fill: it.c, fa: it.off ? .4 : 1 }) : (it.off ? R(lx - 2.6, yy - 2.6, 5.2, 5.2, { stroke: INK, sa: .5, sw: .8 }) : R(lx - 2.6, yy - 2.6, 5.2, 5.2, { fill: INK })))
      s += T(lx + 7, yy + 2.8, fit(asGiven(it.t), x + w - lx - 10, 8), { size: 8, a: it.off ? .38 : .82 })
      top = yy + 3; yy += 15
    }
    if (!t.theirs) { s += line(top, yy - 4) + T(lx - 2.6, yy + 2.6, '+', { size: 8.5, a: .32 }); top = yy + 4; yy += 15 }
    /* its sends: arms off the line, each as long as it sends */
    const sends = t.sends || []
    sends.forEach((sd, k) => {
      yy += 4
      const b = byId(sd.to), f = volF(shown(t, 'send' + k)), aw = (x + w - 8 - lx) * f
      s += line(top, yy + 1) + T(lx + 5, yy - 3.5, fit(b ? b.name : 'send', x + w - lx - 8, 7), { size: 7, a: .5 })
      s += R(lx, yy - .3, aw, .6, { fill: INK, fa: .55 }) + R(lx + aw - 2.3, yy - 2.3, 4.6, 4.6, { fill: INK })
      top = yy; yy += 16
    })
    if (t.kind !== 'bus' || true) { s += line(top, yy - 6) + T(lx + 5, yy - 2.5, '+ send', { size: 6.5, a: .28 }); top = yy - 6; yy += 10 }
  }
  /* the pan: on the line, a small ring */
  const panY = Math.min(yy + 12, q.ft - 22)
  if (!master) { s += line(top, panY - 11) + mpPan(lx, panY, 9, shown(t, 'pan')) + T(lx + 13, panY + 3, panText(shown(t, 'pan')), { size: 7.5, a: .55 }); top = panY + 11 }
  /* the line becomes its fader: the scale along it, the white square, the meters beside */
  const vol = master ? S.master : shown(t, 'vol'), muted = !master && !heard(t), fy = q.yOf(vol)
  s += line(top, q.ft, .25) + line(q.ft, q.fb, .45)
  for (const db of DBS) s += R(lx - (db === 0 ? 5.5 : 4), q.yOf(db) - .3, db === 0 ? 4 : 2.5, .6, { fill: INK, fa: db === 0 ? .6 : .32 })
  if (!master && t.ghost != null) s += R(lx - 6, q.yOf(t.ghost) - .3, 12, .6, { fill: INK, fa: .4 })
  s += R(lx - 5, fy - 5, 10, 10, { fill: INK, fa: muted ? .45 : 1 })
  const lv = MP.lv.get(master ? 'M' : t.id) || [0, 0], mx = lx + 11
  for (let k = 0; k < 2; k++) { const x2 = mx + k * 5, hh = q.fh * lv[k]; s += R(x2, q.ft, 3, q.fh, { fill: INK, fa: .07 }) + R(x2, q.fb - hh, 3, hh, { fill: c, fa: .85 }) }
  /* where it goes, at the line's foot */
  s += P('M' + n(lx - 2.4) + ' ' + n(q.fb + 3) + 'L' + n(lx) + ' ' + n(q.fb + 6.5) + 'L' + n(lx + 2.4) + ' ' + n(q.fb + 3), { stroke: INK, sa: .5, sw: .8 }) + mpCaps(lx + 6, q.fb + 7, master ? 'out 1-2' : fit(outName(t) === 'stereo out' ? 'st out' : outName(t), sw - 10, 6), { a: .4 })
  /* what it reads; r i m s; its name, its colour under it */
  s += T(sx, y + h - 42, fmtDb(vol), { size: 15, w: 500, a: sel || master ? 1 : .88, x: mpNum })
  if (!master) { const its = cellsOf(t), z = 8, step = Math.min(13, (sw - z) / Math.max(1, its.length - 1)); its.forEach((it, k) => { s += mpShape(it.t, sx + z / 2 + k * step, y + h - 27, z, it.on) }) }
  s += T(x + w / 2, y + h - 9, fit(master ? 'stereo out' : asGiven(t.name), sw, 10.5, sel ? 600 : 500), { size: 10.5, w: sel ? 600 : 500, a: !master && t.mute ? .42 : sel ? 1 : .85, anchor: 'middle' })
  s += R(x + w / 2 - 8, y + h - 4, 16, 1.4, { fill: c, fa: !master && t.mute ? .4 : .95 })
  return s
}
`
const demo = `const tr = n => S.tracks.find(x => x.name === n)
  const bus = mkTrack('verb', null, null, null, null, -6, [], NO_PATCH()); bus.kind = 'bus'; bus.c = '#8E8A84'; S.tracks.push(bus); MP.lv.set(bus.id, [.36, .4])
  tr('kick').inserts = [{ name: 'FabFilter Pro-Q 4', uid: 1 }, { name: 'FabFilter Pro-C 2', uid: 2 }]; tr('bass').inserts = [{ name: 'Pro-Q 4', uid: 3 }, { name: 'Decapitator', uid: 4 }, { name: 'Pro-L 2', uid: 6, off: true }]; tr('hum').inserts = [{ name: 'soothe3', uid: 5 }]
  tr('keys').sends = [{ to: bus.id, db: -10 }]; tr('hum').sends = [{ to: bus.id, db: -4 }]; tr('snare').sends = [{ to: bus.id, db: -18 }]
  tr('kick').arm = true; tr('keys').mon = true; tr('air').mute = true; tr('keys').pan = -.3; tr('hats').pan = .45; tr('guitar').pan = -.6; S.sel = S.tracks.indexOf(tr('keys'))
  for (const [k, v] of [['kick', [.72, .7]], ['snare', [.64, .66]], ['hats', [.48, .5]], ['bass', [.68, .67]], ['keys', [.55, .58]], ['guitar', [.5, .44]], ['hum', [.6, .57]], ['air', [.3, .34]]]) MP.lv.set(tr(k).id, v)
  MP.lv.set('M', [.8, .78])`
async function sheet (file, width, height, setup, clip) {
  const b = await open(PAGE, { width, height, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    S.nudge = '1/16'; S.cycle = { on: true, a: 16, b: 24 }; jumpTo(18 + 2 / 4 + 1 / 16 + 37 / 3840)
    S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 400
    ${demo}
    ${setup}
    tpanelSet(true, false); setView(true); dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  await b.sleep(400)
  await b.ev(`dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  const r = await b.send('Page.captureScreenshot', clip ? { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: clip[4] || 2 } } : { format: 'png' })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
await sheet('1 the room with the mixer, 1440.png', 1440, 900, '')
await sheet('2 the strips, close.png', 1440, 900, '', [248, 490, 820, 410, 2])
await sheet('3 a small window, 1100 x 700.png', 1100, 700, 'S.panel.h = 340')
process.exit(0)
