// node "design/mixer panel draft 3/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the mixer as he
// showed it in bauhaus (2026-10-21, "이런 느낌으로 해봐"), in the room's own colours and the transport panel's shapes, with
// the plan for many tracks he passed on:
//   every track on one screen: the strips as narrow as their number needs; a narrow strip keeps its number large, its
//     level a bar of its colour, its handle, its name turned on its side
//   the chosen tracks (one or several, chosen in the arrangement or here) opened wide: the number large in the track's
//     colour and its name beside it, the pan a knob, its patch and sends as a list of names, its level a tall bar of its
//     colour with the fader's line beside it, the white square for a handle and the level beside the square, r i m s as
//     the panel's shapes, where it goes at its foot
//   past what one screen holds (60 tracks and more): a row of their numbers along the top, in their colours, pressed to
//     go to a track
// With the transport panel (ui/panel.js, as built). Nothing of this is in the app: the page is drawn over here, in this
// browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
setTimeout(() => { console.log('timed out'); process.exit(2) }, 300000)

const KIT = `
window.MP = { lv: new Map(), wide: new Set() }
const mpNum = ' style="font-variant-numeric: tabular-nums"'
const mpCaps = (x, y, w, o = {}) => T(x, y, String(w).toUpperCase(), Object.assign({ size: 6, w: 600, a: .45, x: ' letter-spacing="1.2"' }, o))
const mpShape = (k, cx, cy, z, on) => {
  if (k === 'r') return on ? Cc(cx, cy, z / 2, { fill: REC }) : Cc(cx, cy, z / 2 - .4, { stroke: REC, sa: .9, sw: 1 })
  if (k === 'i') { const d = 'M' + n(cx) + ' ' + n(cy - z / 2 - .6) + 'L' + n(cx + z / 2 + .6) + ' ' + n(cy) + 'L' + n(cx) + ' ' + n(cy + z / 2 + .6) + 'L' + n(cx - z / 2 - .6) + ' ' + n(cy) + 'Z'; return P(d, on ? { fill: MON } : { stroke: MON, sa: .9, sw: 1, x: ' stroke-linejoin="round"' }) }
  if (k === 's') { const d = 'M' + n(cx) + ' ' + n(cy - z / 2) + 'L' + n(cx + z / 2 + .5) + ' ' + n(cy + z / 2) + 'L' + n(cx - z / 2 - .5) + ' ' + n(cy + z / 2) + 'Z'; return P(d, on ? { fill: SOLO } : { stroke: INK, sa: .8, sw: 1, x: ' stroke-linejoin="round"' }) }
  return on ? R(cx - z / 2, cy - z / 2, z, z, { fill: INK }) : R(cx - z / 2 + .5, cy - z / 2 + .5, z - 1, z - 1, { stroke: INK, sa: .8, sw: 1 })
}
const mpKnob = (cx, cy, r, pan) => { const a = (pan * 135 - 90) * Math.PI / 180; return Cc(cx, cy, r - .5, { stroke: INK, sa: .85, sw: 1.1 }) + P('M' + n(cx) + ' ' + n(cy) + 'L' + n(cx + Math.cos(a) * (r - 2)) + ' ' + n(cy + Math.sin(a) * (r - 2)), { stroke: INK, sw: 1.2, cap: 'round' }) }
const mpPrintC = { tape: CREAM, space: SPACE, delay: MINT }
/* the whole mixer: strips as wide as there is room for, the chosen ones always wide */
SKINS.mixer.panel = (y, h) => {
  const list = rows().filter(i => S.tracks[i].kind !== 'stack'), N = list.length, OUTW = 120, A = RX - 12 - OUTW, WIDE = 150, NARROW_MIN = 17
  const chosenSet = new Set(list.filter(i => MP.wide.has(S.tracks[i].id) || isChosen(i)))
  let ww = Math.min(170, A / Math.max(1, N)), nw = ww, many = false
  if (ww < 118) { ww = WIDE; nw = (A - chosenSet.size * WIDE) / Math.max(1, N - chosenSet.size); if (nw < NARROW_MIN) { many = true; nw = NARROW_MIN } }
  const allWide = nw === ww
  let s = R(0, y, RX, h, { fill: K1 })
  /* past one screen: a row of numbers along the top */
  let top = y
  if (many) {
    const cw = Math.min(26, (A - 8) / N)
    list.forEach((i, k) => { const t = S.tracks[i], x = 8 + k * cw, on = chosenSet.has(i); s += (on ? R(x - 1, y + 5, cw - 1, 15, { fill: INK }) : '') + T(x + (cw - 2) / 2, y + 16, pad2(i + 1), { size: Math.min(10, cw * .52), w: 600, c: on ? K1 : t.c, anchor: 'middle', x: mpNum }) })
    s += R(0, y + 25, RX, .6, { fill: INK, fa: .08 })
    top = y + 26
  }
  /* which are on the screen: with many, the chosen ones and those around them */
  let shownL = list
  if (many) { const fitN = Math.floor((A - chosenSet.size * WIDE) / NARROW_MIN) + chosenSet.size, first = list.findIndex(i => chosenSet.has(i)); const a0 = clamp(first - Math.floor(fitN / 3), 0, Math.max(0, N - fitN)); shownL = list.slice(a0, a0 + fitN) }
  const H = y + h - top, fb = y + h - 50, ft = top + Math.min(150, H * .42), yOf = db => fb - (fb - ft) * volF(db)
  let x = 8
  for (const i of shownL) {
    const t = S.tracks[i], wide = allWide || chosenSet.has(i), w = wide ? ww : nw, sel = isChosen(i), lv = MP.lv.get(t.id) || [0, 0], vol = shown(t, 'vol'), fy = yOf(vol), heardT = heard(t)
    if (sel && !allWide) s += R(x, top, w, H, { fill: INK, fa: .045 })
    if (wide) {
      const L = x + 10
      /* the number large in its colour (chosen: on a block of ink), the name beside it, the pan a knob */
      const num = pad2(i + 1), nwid = tw(num, 30, 700)
      s += (sel ? R(L - 3, top + 12, nwid + 6, 31, { fill: INK }) : '') + T(L, top + 39, num, { size: 30, w: 700, c: sel ? K1 : t.c, x: mpNum })
      s += T(L + nwid + 7, top + 38, fit(asGiven(t.name), w - nwid - 46, 12.5, 600), { size: 12.5, w: 600, a: heardT ? .95 : .45 })
      s += mpKnob(x + w - 20, top + 30, 9, shown(t, 'pan'))
      /* its patch and its sends: a list of names */
      let ly = top + 64
      for (const it of fxItems(t).slice(0, 4)) { s += R(L, ly - 6.5, 7, 7, { fill: it.c || mpPrintC[it.k] || INK, fa: it.off ? .4 : 1 }) + T(L + 12, ly, fit(asGiven(it.t), w - 30, 9.5), { size: 9.5, a: it.off ? .4 : .85 }); ly += 15 }
      for (const sd of (t.sends || []).slice(0, 2)) { const b = byId(sd.to); s += T(L, ly, '↗', { size: 9, a: .5 }) + T(L + 12, ly, (b ? b.name : 'send') + '  ' + fmtDb(sd.db), { size: 9.5, a: .7, x: ' xml:space="preserve"' }); ly += 15 }
      s += Cc(L + 4, ly - 3.5, 5, { stroke: INK, sa: .55, sw: .9 }) + P('M' + n(L + 4) + ' ' + n(ly - 6.5) + 'V' + n(ly - .5) + 'M' + n(L + 1) + ' ' + n(ly - 3.5) + 'H' + n(L + 7), { stroke: INK, sa: .8, sw: 1 })
      /* its level: a tall bar of its colour, the fader's line beside it, the white square, the level beside it */
      const bw = 15, bx = L + 2, lx = bx + bw + 22, mh = (fb - ft) * Math.max(lv[0], lv[1])
      s += R(bx, ft, bw, fb - ft, { fill: INK, fa: .06 }) + R(bx, fb - mh, bw, mh, { fill: t.c, fa: heardT ? .95 : .4 })
      for (const db of DBS) s += R(lx - 4, yOf(db) - .3, db === 0 ? 3.5 : 2.5, .6, { fill: INK, fa: db === 0 ? .55 : .3 })
      s += R(lx - .6, ft, 1.2, fb - ft, { fill: INK, fa: .85 }) + R(lx - 6, fy - 6, 12, 12, { fill: INK, fa: heardT ? 1 : .5 }) + T(lx + 12, fy + 4.5, fmtDb(vol), { size: 13, w: 600, a: heardT ? .95 : .5, x: mpNum })
      /* r i m s; where it goes */
      cellsOf(t).forEach((it, k) => { s += mpShape(it.t, L + 5 + k * 17, fb + 20, 10, it.on) })
      s += T(L, fb + 40, '→ ' + (outName(t) === 'stereo out' ? 'stereo out' : outName(t)), { size: 8.5, a: .5 })
    } else {
      /* narrow: the number large, the name on its side, the level a bar of its colour, the handle */
      const cx = x + w / 2, num = pad2(i + 1), ns = Math.min(13, w * .62)
      s += T(cx, top + 22, num, { size: ns, w: 700, c: t.c, anchor: 'middle', x: mpNum })
      s += G(T(0, 0, fit(asGiven(t.name), ft - top - 40, 10, 500), { size: 10, w: 500, a: heardT ? .8 : .4 }), 'translate(' + n(cx + 3.5) + ' ' + n(ft - 8) + ') rotate(-90)')
      const bw = Math.max(4, Math.min(8, w * .35)), mh = (fb - ft) * Math.max(lv[0], lv[1])
      s += R(cx - bw / 2, ft, bw, fb - ft, { fill: INK, fa: .06 }) + R(cx - bw / 2, fb - mh, bw, mh, { fill: t.c, fa: heardT ? .95 : .4 })
      s += R(cx - 4.5, fy - 4.5, 9, 9, { fill: INK, fa: heardT ? 1 : .5 })
      if (t.mute || t.solo || t.arm) s += mpShape(t.arm ? 'r' : t.solo ? 's' : 'm', cx, fb + 20, 8, true)
    }
    x += w
    s += R(x - .5, top + 8, .6, H - 16, { fill: INK, fa: .06 })
  }
  /* the out: as a wide strip, its name the word */
  { const L = RX - OUTW + 6, bw = 15, bx = L, lx = bx + bw + 22, vol = S.master, fy = yOf(vol), lv = MP.lv.get('M') || [0, 0], mh = (fb - ft) * Math.max(lv[0], lv[1])
    s += R(RX - OUTW - 6, top, OUTW + 6, H, { fill: K2, fa: .6 })
    s += T(L, top + 39, 'out', { size: 30, w: 700, c: INK }) + mpCaps(L + tw('out', 30, 700) + 7, top + 37, 'stereo')
    s += R(bx, ft, bw, fb - ft, { fill: INK, fa: .06 }) + R(bx, fb - mh, bw, mh, { fill: LEVEL, fa: .9 })
    for (const db of DBS) s += R(lx - 4, yOf(db) - .3, 2.5, .6, { fill: INK, fa: .3 }) + T(lx - 7, yOf(db) + 2.4, db === -48 ? '∞' : (db > 0 ? '+' : db < 0 ? '−' : '') + Math.abs(db), { size: 6.5, a: .35, anchor: 'end', x: mpNum })
    s += R(lx - .6, ft, 1.2, fb - ft, { fill: INK, fa: .85 }) + R(lx - 6, fy - 6, 12, 12, { fill: INK }) + T(lx + 12, fy + 4.5, fmtDb(vol), { size: 15, w: 600, x: mpNum })
    s += T(L, fb + 40, '→ output 1-2', { size: 8.5, a: .5 }) }
  return s
}
{ const r0 = skinRead; skinRead = function () { r0(); if (SKIN.k.transport === 'panel' && SKIN.k.mixer === 'plain') SKIN.k.mixer = 'panel' } }
`
const NAMES = ['kick in', 'kick out', 'snare top', 'snare bot', 'hats', 'tom 1', 'tom 2', 'floor', 'oh l', 'oh r', 'room', 'bass di', 'bass amp', 'sub', 'gtr l', 'gtr r', 'gtr solo', 'keys', 'rhodes', 'organ', 'pad', 'strings', 'brass', 'lead vox', 'dbl', 'harm hi', 'harm lo', 'ad libs', 'bvs', 'claps', 'perc', 'shaker', 'fx rise', 'fx hit', 'verb', 'delay']
const demo = n => `const base = S.tracks.slice(), tr = k => S.tracks.find(x => x.name === k)
  tr('kick').inserts = [{ name: 'Pro-Q 4', uid: 1 }, { name: 'Pro-C 2', uid: 2 }]; tr('bass').inserts = [{ name: 'Pro-Q 4', uid: 3 }, { name: 'Decapitator', uid: 4 }]; tr('hum').inserts = [{ name: 'soothe3', uid: 5 }]
  tr('kick').arm = true; tr('keys').mon = true; tr('air').mute = true; tr('keys').pan = -.3; tr('hats').pan = .45
  if (${n} > base.length) { const names = ${JSON.stringify(NAMES)}; for (let k = 0; S.tracks.length < ${n}; k++) { const src = base[k % base.length], t = mkTrack(names[k % names.length] + (k >= names.length ? ' ' + (Math.floor(k / names.length) + 1) : ''), null, null, null, null, -6 - (k % 7), [], NO_PATCH()); t.c = src.c; t.kind = 'audio'; S.tracks.push(t) } }
  S.tracks.forEach((t, k) => MP.lv.set(t.id, [.35 + .4 * Math.abs(Math.sin(k * 1.7)), .35 + .4 * Math.abs(Math.sin(k * 1.7 + .3))]))
  MP.lv.set('M', [.8, .78])`
async function sheet (file, width, height, setup, clip) {
  const b = await open(PAGE, { width, height, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    S.nudge = '1/16'; S.cycle = { on: true, a: 16, b: 24 }; jumpTo(18 + 2 / 4 + 1 / 16 + 37 / 3840)
    S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 470
    ${setup}
    tpanelSet(true, false); setView(true); dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  await b.sleep(400)
  await b.ev(`dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  const r = await b.send('Page.captureScreenshot', clip ? { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: clip[4] || 2 } } : { format: 'png' })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
await sheet('1 eight tracks, all wide.png', 1440, 900, demo(8) + `; S.sel = S.tracks.findIndex(t => t.name === 'keys')`)
await sheet('2 thirty-two tracks, two chosen open.png', 1440, 900, demo(32) + `; S.sel = S.tracks.findIndex(t => t.name === 'keys'); S.selT = [S.tracks.find(t => t.name === 'keys').id, S.tracks.find(t => t.name === 'lead vox').id]`)
await sheet('3 sixty-four tracks, the row of numbers.png', 1440, 900, demo(64) + `; S.sel = S.tracks.findIndex(t => t.name === 'lead vox')`)
await sheet('4 the strips, close.png', 1440, 900, demo(32) + `; S.sel = S.tracks.findIndex(t => t.name === 'keys'); S.selT = [S.tracks.find(t => t.name === 'keys').id, S.tracks.find(t => t.name === 'lead vox').id]`, [248, 420, 700, 480, 2])
process.exit(0)
