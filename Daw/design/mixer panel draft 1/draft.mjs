// node "design/mixer panel draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the mixer in the
// transport panel's hand (his ask, 2026-10-21: "이게 디자인이 너무 좋아서 … 믹서 창도 이런식으로 디자인해보고 싶은데"),
// with the panel (ui/panel.js, as built) beside it. Each strip, by how much each thing matters:
//   large    what it reads (its level, in figures); its fader — a hairline rail on a scale, a small white square for a
//            handle, its two meters as thin bars beside it
//   middle   its name, at the foot; its pan, a small ring of ticks with a white square where it stands, its value in it
//   small    r i m s as the panel's shapes — record a ring, monitor a diamond, mute a square, solo a triangle — filled
//            when on; its patch as names with a dot of their colour, its sends as hairlines with a small square, its out;
//            its colour a hairline along its head
// the gutter's words in small capitals; no boxes. The out (stereo out) the same, larger. Nothing of this is in the app:
// the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))

const KIT = `
window.MP = { lv: new Map() }
const mpNum = ' style="font-variant-numeric: tabular-nums"'
const mpCaps = (x, y, w, o = {}) => T(x, y, String(w).toUpperCase(), Object.assign({ size: 5.8, w: 600, a: .42, x: ' letter-spacing="1.1"' }, o))
/* a shape at rest in a hairline, filled when on (the panel's) */
const mpShape = (k, cx, cy, z, on) => {
  if (k === 'r') return on ? Cc(cx, cy, z / 2, { fill: REC }) : Cc(cx, cy, z / 2 - .4, { stroke: REC, sa: .9, sw: .9 })
  if (k === 'i') { const d = 'M' + n(cx) + ' ' + n(cy - z / 2 - .6) + 'L' + n(cx + z / 2 + .6) + ' ' + n(cy) + 'L' + n(cx) + ' ' + n(cy + z / 2 + .6) + 'L' + n(cx - z / 2 - .6) + ' ' + n(cy) + 'Z'; return P(d, on ? { fill: MON } : { stroke: MON, sa: .9, sw: .9, x: ' stroke-linejoin="round"' }) }
  if (k === 's') { const d = 'M' + n(cx) + ' ' + n(cy - z / 2) + 'L' + n(cx + z / 2 + .4) + ' ' + n(cy + z / 2) + 'L' + n(cx - z / 2 - .4) + ' ' + n(cy + z / 2) + 'Z'; return P(d, on ? { fill: SOLO } : { stroke: INK, sa: .75, sw: .9, x: ' stroke-linejoin="round"' }) }
  return on ? R(cx - z / 2, cy - z / 2, z, z, { fill: INK }) : R(cx - z / 2 + .4, cy - z / 2 + .4, z - .8, z - .8, { stroke: INK, sa: .75, sw: .9 })
}
/* the pan: a small ring of ticks, the way it can go 135 degrees either side of the top, a white square where it stands */
const mpPan = (cx, cy, r, pan) => {
  let s = ''
  for (let k = 0; k <= 12; k++) { const a = (-135 + k * 22.5 - 90) * Math.PI / 180, l = k === 6 ? 3 : 1.6; s += P('M' + n(cx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r) + 'L' + n(cx + Math.cos(a) * (r - l)) + ' ' + n(cy + Math.sin(a) * (r - l)), { stroke: INK, sa: k === 6 ? .6 : .3, sw: .7 }) }
  const a = (pan * 135 - 90) * Math.PI / 180
  return s + R(cx + Math.cos(a) * (r - .8) - 2.3, cy + Math.sin(a) * (r - .8) - 2.3, 4.6, 4.6, { fill: INK })
}
stripGutter = function (x, w, y, h, wide, knob) {
  const q = stripGeom(y, h, wide, knob)
  let s = ''
  q.rows.forEach((l, i) => { const said = l === 'fx0' ? 'fx' : /^fx\\d/.test(l) ? '' : l; if (said) s += mpCaps(x + w - 6, q.y0 + i * q.sp + q.sh / 2 + 2.2, said, { anchor: 'end' }) })
  s += mpCaps(x + w - 6, q.panY + 6, 'pan', { anchor: 'end' })
  for (const db of DBS) s += T(x + w - 6, q.yOf(db) + 2.5, db === -48 ? '∞' : (db > 0 ? '+' : db < 0 ? '−' : '') + Math.abs(db), { size: 7, a: db === 0 ? .6 : .35, anchor: 'end', x: mpNum })
  return s
}
strip = function (x, y, w, h, t, i, o = {}) {
  const wide = !!o.wide || w > 70, q = stripGeom(y, h, !!o.wide, !!o.knob), pad = wide ? 6 : 5, sx = x + pad, sw = w - 2 * pad, sel = !!o.sel, master = !!o.master
  let s = ''
  /* its colour, a hairline along its head */
  s += R(sx, y + 2, sw, 1.4, { fill: master ? INK : t.c, fa: !master && t.mute ? .4 : .95 })
  /* the rows: its patch, its sends, where it goes */
  let yy = q.y0, si = 0
  const row = (txt, a = .78, size = 8) => T(sx, yy + q.sh / 2 + 2.8, fit(txt, sw, size), { size, a })
  for (const r of q.rows) {
    if (master) { if (r === 'out') s += mpCaps(sx, yy + q.sh / 2 + 2.2, 'out 1-2', { a: .5 }) }
    else if (r === 'in') s += row(t.theirs || (t.inst ? 'keyboard' : inputName(t.inp || 0)), .6)
    else if (/^fx\\d+$/.test(r)) {
      const k = +r.slice(2), items = fxItems(t), it = items[k]
      if (it) s += Cc(sx + 2, yy + q.sh / 2, 1.8, { fill: it.c || t.c, fa: it.off ? .4 : 1 }) + T(sx + 7, yy + q.sh / 2 + 2.8, fit(asGiven(it.t), sw - 7, 8), { size: 8, a: it.off ? .38 : .8 })
      else if (k === items.length && !t.theirs) s += T(sx, yy + q.sh / 2 + 3, '+', { size: 9, a: .3 })
    } else if (r === 'send' || r === '') {
      const k = si++, sd = (t.sends || [])[k]
      if (sd) { const f = volF(shown(t, 'send' + k)), lx = sx + 8, lw = sw - 8; s += T(sx, yy + q.sh / 2 + 2.6, String.fromCharCode(97 + k), { size: 7.5, a: .45 }) + R(lx, yy + q.sh / 2, lw, .6, { fill: INK, fa: .3 }) + R(lx + lw * f - 2, yy + q.sh / 2 - 1.7, 4, 4, { fill: INK }) }
      else if (k === (t.sends || []).length) s += T(sx, yy + q.sh / 2 + 3, '+', { size: 9, a: .3 })
    } else if (r === 'out') s += T(sx, yy + q.sh / 2 + 2.8, fit(outName(t) === 'stereo out' ? 'st out' : outName(t), sw, 8), { size: 8, a: .55 })
    yy += q.sp
  }
  /* the pan: a small ring, its value in it */
  if (!master) { const pan = shown(t, 'pan'), r = 10.5, cx = sx + sw / 2, cy = q.panY + 8; s += mpPan(cx, cy, r, pan) + T(cx, cy + 2.6, panText(pan), { size: 6.5, a: .55, anchor: 'middle' }) }
  /* the fader: a hairline rail on its scale, the white square; the meters beside it */
  const vol = master ? S.master : shown(t, 'vol'), muted = !master && !heard(t), fx = sx + (wide ? 14 : 10), fy = q.yOf(vol)
  for (const db of DBS) s += R(fx - 5, q.yOf(db) - .3, db === 0 ? 4 : 2.5, .6, { fill: INK, fa: db === 0 ? .55 : .3 })
  s += R(fx - .4, q.ft, .8, q.fh, { fill: INK, fa: .3 })
  if (!master && t.ghost != null) s += R(fx - 6, q.yOf(t.ghost) - .3, 12, .6, { fill: INK, fa: .4 })
  s += R(fx - 5, fy - 5, 10, 10, { fill: INK, fa: muted ? .45 : 1 })
  const lv = MP.lv.get(master ? 'M' : t.id) || [0, 0], mx = fx + (wide ? 14 : 11)
  for (let c = 0; c < 2; c++) { const x2 = mx + c * 5, hh = q.fh * lv[c]; s += R(x2, q.ft, 3, q.fh, { fill: INK, fa: .07 }) + R(x2, q.fb - hh, 3, hh, { fill: master ? INK : t.c, fa: .85 }) }
  /* what it reads, large; r i m s as shapes; its name */
  s += T(sx, y + h - 46, fmtDb(vol), { size: wide ? 17 : 15, w: 500, a: sel || master ? 1 : .88, x: mpNum })
  if (!master) { const its = cellsOf(t), z = 8, step = Math.min(13, (sw - z) / Math.max(1, its.length - 1)); its.forEach((it, k) => { s += mpShape(it.t, sx + z / 2 + k * step, y + h - 30, z, it.on) }) }
  s += T(x + w / 2, y + h - 10, fit(master ? 'stereo out' : asGiven(t.name), sw, 10.5, sel ? 600 : 500), { size: 10.5, w: sel ? 600 : 500, a: !master && t.mute ? .42 : sel ? 1 : .85, anchor: 'middle' })
  return s
}
`
const demo = `const tr = n => S.tracks.find(x => x.name === n)
  tr('kick').inserts = [{ name: 'FabFilter Pro-Q 4', uid: 1 }, { name: 'FabFilter Pro-C 2', uid: 2 }]; tr('bass').inserts = [{ name: 'Pro-Q 4', uid: 3 }, { name: 'Decapitator', uid: 4 }]; tr('hum').inserts = [{ name: 'soothe3', uid: 5 }]
  newTracks({ kind: 'bus', n: 1, out: 0 }); const bus = S.tracks.find(x => x.kind === 'bus'); bus.name = 'verb'; MP.lv.set(bus.id, [.36, .4])
  tr('keys').sends = [{ to: bus.id, db: -10 }]; tr('hum').sends = [{ to: bus.id, db: -14 }]; tr('snare').sends = [{ to: bus.id, db: -18 }]
  tr('kick').arm = true; tr('keys').mon = true; tr('air').mute = true; tr('keys').pan = -.3; tr('hats').pan = .45; S.sel = S.tracks.indexOf(tr('keys'))`
async function sheet (file, width, height, setup, clip) {
  const b = await open(PAGE, { width, height, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    S.nudge = '1/16'; S.cycle = { on: true, a: 16, b: 24 }; jumpTo(18 + 2 / 4 + 1 / 16 + 37 / 3840)
    S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 380
    /* levels as of a still of the song playing */
    for (const [k, v] of [['kick', [.72, .7]], ['snare', [.64, .66]], ['hats', [.48, .5]], ['bass', [.68, .67]], ['keys', [.55, .58]], ['guitar', [.5, .44]], ['hum', [.6, .57]], ['air', [.3, .34]]]) { const t = S.tracks.find(x => x.name === k); if (t) MP.lv.set(t.id, v) }
    MP.lv.set('M', [.8, .78])
    ${setup}
    tpanelSet(true, false); setView(true); dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  await b.sleep(400)
  await b.ev(`dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  const r = await b.send('Page.captureScreenshot', clip ? { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: clip[4] || 2 } } : { format: 'png' })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
await sheet('1 the room with the mixer, 1440.png', 1440, 900, demo)
await sheet('2 the strips, close.png', 1440, 900, demo, [248, 520, 760, 380, 2])
await sheet('3 a small window, 1100 x 700.png', 1100, 700, demo + '; S.panel.h = 330')
process.exit(0)
