// node "design/pan draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: pan made easy to see and to
// take hold of. His words: the pan in the mixer is so small the mouse has to be steered just so; and could it be in the
// main room's inspector too.
//   in the room   i-a  a dial in every track's head, beside its level
//                 i-b  the chosen track's pan in the tool row, wide, beside its colour and its outline
//                 i-c  an inspector at the left, as Logic's: the chosen track's strip and the stereo out's, full height
//   the mixer     m-a  a knob: an arc from the top, the value under it
//                 m-b  a wide bar: the whole strip wide, filled from its middle
//                 m-c  the value itself, large, with a scale of ticks under it
// Each mixer way: the panel as it would be, and the control drawn larger at the top right, at the middle and either side.
// Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)

await b.ev(`if (typeof START !== 'undefined') START.on = false
  /* a session as full as one of his, its tracks panned as a mix is */
  const more = [['kick sub', 0], ['clap', 1], ['perc', 2], ['shaker', 2], ['808', 3], ['rhodes', 4], ['pad', 4], ['strings', 7], ['gtr dbl', 5], ['vox lead', 6], ['vox dbl', 6], ['bv l', 6], ['bv r', 6], ['adlib', 6], ['riser', 7]]
  const base = S.tracks.slice()
  for (const [name, k] of more) { const src = base[k], t = mkTrack(name, null, null, null, src.buf0, src.vol - 2, [], copy(src.patch), { out: src.out }); t.regs = src.regs.filter((r, j) => (j + name.length) % 3 !== 0).map(r => cloneReg(r)); S.tracks.push(t) }
  const pans = { hats: 18, keys: -22, guitar: 34, hum: -10, perc: -40, shaker: 46, rhodes: -30, pad: 12, 'gtr dbl': -34, 'vox dbl': 8, 'bv l': -52, 'bv r': 52, adlib: 26, clap: -6 }
  for (const t of S.tracks) t.pan = (pans[t.name] || 0) / 64
  S.rh = 25; S.sel = 1; S.pos = 18.5; setView(true); dirtyAll(); flush()
  /* the parts */
  const pt = (cx, cy, r, deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] }
  const arc = (cx, cy, r, d0, d1) => { if (Math.abs(d1 - d0) < .01) return ''; const [x0, y0] = pt(cx, cy, r, d0), [x1, y1] = pt(cx, cy, r, d1); return 'M' + n(x0) + ' ' + n(y0) + 'A' + r + ' ' + r + ' 0 ' + (Math.abs(d1 - d0) > 180 ? 1 : 0) + ' ' + (d1 > d0 ? 1 : 0) + ' ' + n(x1) + ' ' + n(y1) }
  window.DR = {
    /* a dial: the way it can go, 135 degrees either side of the top; how far it went, from the top; a tick where it points */
    dial (cx, cy, r, pan, o = {}) {
      const sw = o.sw || 2, d = pan * 135, [tx, ty] = pt(cx, cy, r - sw - 1.5, d), [ex, ey] = pt(cx, cy, r + .5, d)
      return P(arc(cx, cy, r, -135, 135), { stroke: INK, sa: .16, sw, cap: 'round' }) + P(arc(cx, cy, r, 0, d), { stroke: o.c || INK, sa: .95, sw, cap: 'round' })
        + R(cx - .5, cy - r - sw / 2 - 2.5, 1, 2.5, { fill: INK, fa: .4 }) + P('M' + n(cx) + ' ' + n(cy) + 'L' + n(tx) + ' ' + n(ty), { stroke: INK, sa: .9, sw: Math.max(1, sw * .6), cap: 'round' })
    },
    /* a bar the width of the strip: a groove, filled from the middle, a handle where it stands */
    bar (x, y, w, h, pan) {
      const cx = x + w / 2, px = cx + pan * (w / 2 - 1.5)
      return R(x, y, w, h, { rx: 1.5, fill: K0, fa: .9 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 1.5, stroke: INK, sa: .16 }) + R(Math.min(cx, px), y + 2, Math.abs(px - cx), h - 4, { fill: INK, fa: .42 })
        + R(cx - .5, y - 2, 1, h + 4, { fill: INK, fa: .3 }) + R(px - 1.5, y - 2, 3, h + 4, { rx: 1, fill: INK })
    },
    /* the value, large, and eleven ticks from left to right under it, the one it is nearest lit */
    num (cx, y, w, pan, size = 12) {
      let s = T(cx, y + size, panText(pan), { size, w: 500, a: .95, anchor: 'middle' })
      const n0 = 11, step = (w - 4) / (n0 - 1), on = Math.round((pan + 1) / 2 * (n0 - 1))
      for (let k = 0; k < n0; k++) { const tx = cx - (w - 4) / 2 + k * step, mid = k === 5; s += R(tx - .5, y + size + 5 + (mid ? 0 : 2), 1, mid ? 6 : 4, { fill: INK, fa: k === on ? 1 : mid ? .4 : .2 }) }
      if (on !== 5) s += R(cx - (w - 4) / 2 + on * step - 1, y + size + 4, 2, 8, { fill: INK })
      return s
    },
    put (svg) { let g = document.getElementById('draft'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'draft'; document.getElementById('svg').appendChild(g) } g.innerHTML = svg }
  }
  /* the strips' pan made over: the way is chosen by DR.way; the pan's place grows by DR.grow, taken from the fader */
  DR.way = null; DR.grow = 0
  const g0 = stripGeom
  stripGeom = function (y, h, wide) { const q = g0(y, h, wide); if (!DR.way) return q; q.ft += DR.grow; q.fh = q.fb - q.ft; q.yOf = db => q.fb - (q.fb - q.ft) * volF(db); return q }
  const s0 = strip
  strip = function (x, y, w, h, t, i, o = {}) {
    let s = s0(x, y, w, h, t, i, o)
    if (!DR.way || o.master) return s
    const q = stripGeom(y, h, !!o.wide), pad = o.wide ? 5 : 4, sx = x + pad, sw = w - pad * 2, pan = shown(t, 'pan'), top = q.panY - 8, bot = q.ft - 3
    s += R(x + .5, top, w - 1, bot - top, { fill: o.inspector ? K1 : K1 }) + (o.sel && !o.inspector ? R(x, top, w, bot - top, { fill: INK, fa: .07 }) : o.inspector ? R(x, top, w, bot - top, { fill: INK, fa: .05 }) : '')
    if (DR.way === 'a') { const r = o.inspector ? 21 : o.wide ? 14 : 11; s += DR.dial(sx + sw / 2, top + 7 + r, r, pan, { sw: o.inspector ? 3 : o.wide ? 2.6 : 2.2 }) + T(sx + sw / 2, top + 7 + 2 * r + 15, panText(pan), { size: o.inspector ? 11.5 : o.wide ? 10 : 9, w: o.inspector ? 500 : 400, a: .9, anchor: 'middle' }) }
    if (DR.way === 'b') s += T(sx + sw / 2, top + 12, panText(pan), { size: 9.5, w: 500, a: .9, anchor: 'middle' }) + DR.bar(sx, top + 18, sw, 9, pan)
    if (DR.way === 'c') s += DR.num(sx + sw / 2, top + 4, sw - 4, pan, o.wide ? 14 : 12.5)
    return s
  }
  /* the head's level: with a dial before it, in the room's way i-a */
  const l0 = levelBar
  levelBar = function (x, y, w, t, vol) { if (DR.way !== 'heads') return l0(x, y, w, t, vol); return DR.dial(x + 6, y + 1, 6, t.pan || 0, { sw: 1.6 }) + l0(x + 17, y, w - 17, t, vol) }`)

/* a callout at the top right of the lanes: the control larger, at the middle and either side */
const callout = (fn, h, k = 3, gap = 150) => `const bw = 160 + 2 * ${gap}, bh = ${h}, bx0 = RX - bw - 16, by0 = TY + 14
  let s = R(bx0 - 1, by0 + 1, bw + 2, bh + 3, { rx: 6, fill: '#000', fa: .5 }) + R(bx0 + .5, by0 + .5, bw - 1, bh - 1, { rx: 5, fill: K1, stroke: INK, sa: .22 })
  ;[0, -24 / 64, 1].forEach((pan, k) => { const cx = bx0 + 80 + k * ${gap}; s += G(${fn}, 'translate(' + (cx) + ' ' + (by0 + 18) + ') scale(${k})') })
  return s`

/* m-a, m-b, m-c: the mixer, each way */
const mixer = (way, grow, fn, h, k, gap) => `DR.way = '${way}'; DR.grow = ${grow}; S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 380; setView(true); dirtyAll(); flush()
  DR.put((() => { ${callout(fn, h, k, gap)} })())`
await b.ev(mixer('a', 30, `DR.dial(0, 11, 11, pan, { sw: 2.2 }) + T(0, 35, panText(pan), { size: 9, a: .85, anchor: 'middle' })`, 150)); await b.sleep(150); await b.shot('pan-ma.png')
await b.ev(mixer('b', 16, `T(0, 12, panText(pan), { size: 9.5, w: 500, a: .9, anchor: 'middle' }) + DR.bar(-24, 18, 48, 9, pan)`, 120, 3, 180)); await b.sleep(150); await b.shot('pan-mb.png')
await b.ev(mixer('c', 14, `DR.num(0, 4, 44, pan, 12.5)`, 110)); await b.sleep(150); await b.shot('pan-mc.png')

/* i-a: a dial in every head */
await b.ev(`DR.way = 'heads'; DR.grow = 0; S.panel.on = false; setView(true); dirtyAll(); flush()
  DR.put((() => { const bw = 330, bh = 120, bx0 = RX - bw - 16, by0 = TY + 14
    let s = R(bx0 - 1, by0 + 1, bw + 2, bh + 3, { rx: 6, fill: '#000', fa: .5 }) + R(bx0 + .5, by0 + .5, bw - 1, bh - 1, { rx: 5, fill: K1, stroke: INK, sa: .22 })
    /* the head's right end, larger: the dial, the level, the value */
    const t = S.tracks.find(x => x.name === 'bv l')
    s += G(R(-6, -12, 92, 24, { fill: K1 }) + levelBar(4, 0, 40, t, t.vol) + T(84, 3.5, fmtDb(t.vol), { size: 9, a: .9, anchor: 'end' }), 'translate(' + (bx0 + 18) + ' ' + (by0 + bh / 2) + ') scale(3.4)')
    return s })())`)
await b.sleep(150); await b.shot('pan-ia.png')

/* i-b: the chosen track's pan in the tool row */
await b.ev(`DR.way = null; S.sel = S.tracks.findIndex(t => t.name === 'bv l'); S.panel.on = false; setView(true); dirtyAll(); flush()
  DR.put((() => {
    const y = TOOL_Y, t = S.tracks[S.sel], x0 = LOOK_X + 37 + 43 + 10
    let s = vline(x0, y + 6, y + TOOL_H - 6, .1)
    let x = x0 + 14
    s += T(x, y + 16.6, 'pan', { size: 9.5, a: .4 }); x += tw('pan', 9.5) + 8
    s += DR.bar(x, y + 8.5, 132, 9, t.pan) + T(x + 132 + 8, y + 16.6, panText(t.pan), { size: 9.5, w: 500, a: .9 })
    x += 132 + 36
    s += T(x, y + 16.6, 'vol', { size: 9.5, a: .4 }) + T(x + tw('vol', 9.5) + 6, y + 16.6, fmtDb(t.vol), { size: 9.5, w: 500, a: .9 })
    return s })())`)
await b.sleep(150); await b.shot('pan-ib.png')

/* i-c: an inspector at the left, as Logic's: the chosen track's strip and the stereo out's, as tall as the room */
await b.ev(`DR.way = 'a'; DR.grow = 64; S.sel = S.tracks.findIndex(t => t.name === 'bv l')
  const INSW = GUT + WSTRIP + 6 + WSTRIP + 10
  const r0 = relayout
  relayout = function () {
    r0()
    X0 += INSW
    const set = (id, x, y, w, h) => { const r = $(id).firstChild; r.setAttribute('x', n(x)); r.setAttribute('y', n(y)); r.setAttribute('width', n(Math.max(0, w))); r.setAttribute('height', n(Math.max(0, h))) }
    set('tl', X0, MK_Y, X1 - X0, BY - MK_Y); set('ln', X0, TY, X1 - X0, LANES_H)
    $('g-head').setAttribute('transform', 'translate(' + INSW + ' 0)')
  }
  S.panel.on = false; setView(true); dirtyAll(); flush()
  DR.put((() => {
    const y = MK_Y, h = BY - MK_Y, t = S.tracks[S.sel]
    let s = R(0, y, INSW, h, { fill: K1 }) + vline(INSW - .5, y, BY, .12)
    s += T(INSW + 16, MK_Y + 14.5, 'markers', { size: 9.5, a: .42 }) + T(INSW + 16, RU_Y + 16, 'bars', { size: 9.5, a: .42 })
    const x1 = GUT, x2 = x1 + WSTRIP + 6, sy = y + 6, sh = h - 10
    s += stripGutter(0, GUT, sy, sh, true)
    s += R(x1, sy, WSTRIP, sh, { fill: INK, fa: .05 }) + strip(x1, sy, WSTRIP, sh, t, S.sel, { wide: true, sel: true, inspector: true }) + vline(x1 + WSTRIP + 2.5, sy + 8, sy + sh - 8, .07)
    s += strip(x2, sy, WSTRIP, sh, MASTER(), -1, { wide: true, master: true })
    return s })())`)
await b.sleep(150); await b.shot('pan-ic.png')
await b.close()
for (const [f, name] of [['pan-ia.png', 'i-a a dial in every head.png'], ['pan-ib.png', 'i-b the chosen track in the tool row.png'], ['pan-ic.png', 'i-c an inspector at the left.png'], ['pan-ma.png', 'm-a the mixer, a knob.png'], ['pan-mb.png', 'm-b the mixer, a wide bar.png'], ['pan-mc.png', 'm-c the mixer, the value and a scale.png']]) { copyFileSync(join(here, '../../test/out', f), join(here, name)); rmSync(join(here, '../../test/out', f)) }
console.log('drawn')
