// node "design/choices draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: what the prompt's page
// shows when a line asks for something by its sound ("kick and bass sound apart") instead of by its knobs.
//   1  three ways offered: what was heard (where the two meet), and three ways that are different ways of doing it —
//      each a few lines in cells, with what it would put on and how far — heard one against another at matched levels
//   2  a plug-in's cell pressed: the others of its kind that are on this Mac, and the room's own print of that kind
//   3  a way changed in place: an amount typed over (−3 → −1.5), the eq swapped (pro-q 4 → hitsville eq mastering: its
//      nearest step to 55 hz is said)
//   4  one way used: the others step back, and it is one step of undo
// Nothing of this is in the app: the page is drawn over here, in this browser only. (His words, 2026-10-16: ways that
// differ in how, not in how much — how much is a cell; one way at a time, never two together.)
import { open, PAGE } from '../../test/cdp.mjs'
import { copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(600)

await b.ev(`if (typeof START !== 'undefined') START.on = false
  $('cmd').style.display = 'none'
  S.sel = 0; S.panel.on = true; S.panel.tab = 'prompt'; S.panel.h = 360; setView(true); dirtyAll(); flush()
  const kick = S.tracks.find(t => t.name === 'kick'), bass = S.tracks.find(t => t.name === 'bass')
  window.DR = {
    kc: kick.csel || kick.c, bc: bass.csel || bass.c,
    /* a line of a way, in cells: {t, k: plain | who | plug | much | act, c} — a plug-in's cell opens a list (the caret),
       an amount's cell is typed over (its frame a little brighter) */
    line (x, y, parts, o = {}) {
      const h = o.h || 20, size = o.size || 10.5
      let s = '', cx = x
      for (const p of parts) {
        const extra = p.k === 'plug' ? 14 : 0, w = Math.round(tw(p.t, size, p.k === 'act' ? 500 : 400) + size * 1.4 + extra)
        if (p.k === 'act') s += R(cx, y, w, h, { rx: 2, fill: INK, fa: o.dim ? .4 : 1 })
        else s += R(cx + .5, y + .5, w - 1, h - 1, { rx: 2, stroke: p.c || INK, sa: p.edit ? .95 : p.k === 'much' ? .5 : p.c ? .8 : .26, fill: p.edit ? K0 : 'none' })
        s += T(cx + size * .7, y + h / 2 + size * .36, p.t, { size, w: p.k === 'act' ? 500 : 400, c: p.k === 'act' ? K1 : p.c || INK, a: o.dim ? .35 : p.k === 'plain' ? .55 : .95 })
        if (p.k === 'plug') s += caret(cx + w - 9, y + h / 2, o.dim ? .2 : .55)
        if (p.edit) s += R(cx + size * .7 + tw(p.t, size) + 2, y + 4, 1.2, h - 8, { fill: INK })
        cx += w + 4
      }
      return s
    },
    put (svg) { let g = document.getElementById('draft'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'draft'; document.getElementById('svg').appendChild(g) } g.innerHTML = svg },
    /* the page: head, the field with what was said, and the foot */
    page (said) {
      const top = H - FOOT_H - S.panel.h
      let s = R(0, top, W, S.panel.h, { fill: K1 }) + R(0, top, W, PH, { fill: K2 }) + hline(0, W, top, .14) + hline(0, W, top + PH - .5, .08)
      s += cells(10, top + 4, 18, [{ t: 'patch' }, { t: 'mixer' }, { t: 'notes' }, { t: 'prompt', on: true }], { size: 9.5, widths: [48, 48, 48, 52] })[0]
      const fx = 20, fy = top + PH + 16, fw = W - 40
      s += R(fx + .5, fy + .5, fw, 37, { rx: 3, fill: K0, stroke: INK, sa: .38 })
      s += P('M' + (fx + 14) + ' ' + (fy + 13) + 'L' + (fx + 20) + ' ' + (fy + 19) + 'L' + (fx + 14) + ' ' + (fy + 25), { stroke: INK, sa: .9, sw: 1.5, cap: 'round' })
      s += T(fx + 32, fy + 23.5, said, { size: 13, a: .96 })
      s += R(0, H - FOOT_H, W, FOOT_H, { fill: K2 }) + hline(0, W, H - FOOT_H, .1)
      let x = W - 10
      const ko = { h: 16, size: 9, pad: 8 }, kw = keyW('keys', ko); x -= kw; s += key(x, H - FOOT_H + 3, 'keys', ko)[0]
      for (const [l, v] of [['saved', '1:31'], ['buffer', '512'], ['rate', '48k 32 bit'], ['cpu', '1%']]) { x -= 12; s += vline(x, H - FOOT_H + 6, H - 6, .1); x -= 12; x -= tw(v, 9.5); s += T(x, H - 7.4, v, { size: 9.5, a: .8 }); x -= 5 + tw(l, 9.5); s += T(x, H - 7.4, l, { size: 9.5, a: .4 }) }
      return [s, fx, fy + 37]
    },
    /* what was heard: where the two meet, drawn as their lows (log frequency, 30 to 400 hz), the meeting shaded */
    heard (x, y, w) {
      let s = T(x, y + 10, 'heard', { size: 9.5, a: .4 })
      const gy = y + 26, gh = 96, f0 = Math.log(30), f1 = Math.log(400), X = f => x + (Math.log(f) - f0) / (f1 - f0) * w, Y = v => gy + gh - v * gh
      const curve = (peak, width, lift, c) => { let d = ''; for (let f = 30; f <= 400; f *= 1.03) { const v = lift + (1 - lift) * Math.exp(-Math.pow(Math.log(f / peak) / width, 2)); d += (d ? 'L' : 'M') + X(f).toFixed(1) + ' ' + Y(v * .9).toFixed(1) } return P(d, { stroke: c, sw: 1.6, sa: .95 }) }
      s += R(X(45), gy, X(70) - X(45), gh, { fill: '#D8B24A', fa: .12 }) + P('M' + X(45) + ' ' + gy + 'V' + (gy + gh) + 'M' + X(70) + ' ' + gy + 'V' + (gy + gh), { stroke: '#D8B24A', sa: .5, dash: '2 3' })
      s += hline(x, x + w, gy + gh, .14)
      for (const f of [50, 100, 200]) s += T(X(f), gy + gh + 13, f + ' hz', { size: 8.5, a: .4, anchor: 'middle' })
      s += curve(55, .32, .05, DR.kc) + curve(70, .55, .1, DR.bc)
      s += T(x + w, gy + 10, 'kick', { size: 9.5, c: DR.kc, anchor: 'end' }) + T(x + w, gy + 24, 'bass', { size: 9.5, c: DR.bc, anchor: 'end' })
      let ty = gy + gh + 36
      for (const [a, bb] of [['they meet at', '45 – 70 hz'], ['kick low', '52 hz'], ['bass low', '58 hz, longer'], ['bass over the kick', '78% of its hits']]) { s += T(x, ty, a, { size: 10, a: .45 }) + T(x + 118, ty, bb, { size: 10, a: .9 }); ty += 18 }
      return s
    },
    /* a way: its letter and name, what it does in a few words, its lines, and its keys */
    way (x, y, w, h, o) {
      let s = R(x + .5, y + .5, w - 1, h - 1, { rx: 4, stroke: INK, sa: o.used ? .9 : o.hear ? .5 : .16, fill: o.used ? K0 : 'none' })
      s += T(x + 16, y + 26, o.letter, { size: 15, w: 500, a: o.dim ? .3 : .95 }) + T(x + 38, y + 25, o.name, { size: 12.5, w: 500, a: o.dim ? .3 : .95 })
      /* what it does, in a few words, kept inside the way (two lines at most) */
      const words = o.says.split(' '), lines = ['']; for (const wd of words) { const tr = (lines[lines.length - 1] + ' ' + wd).trim(); if (tw(tr, 10) > w - 54 && lines[lines.length - 1]) lines.push(wd); else lines[lines.length - 1] = tr }
      lines.slice(0, 2).forEach((l, i) => { s += T(x + 38, y + 43 + i * 14, l, { size: 10, a: o.dim ? .22 : .5 }) })
      let ly = y + 74
      for (const l of o.lines) { s += DR.line(x + 16, ly, l, { dim: o.dim }); ly += 27 }
      if (o.note) s += T(x + 16, ly + 8, o.note, { size: 9.5, c: '#D8B24A', a: o.dim ? .3 : .9 })
      const ky = y + h - 32
      if (o.used) s += T(x + 16, ky + 13, 'used — one step back', { size: 10, a: .7 })
      else { const lk = key(x + 16, ky, o.hear ? 'hearing' : 'hear', { h: 20, size: 10, armed: o.hear, dim: o.dim }); s += lk[0] + key(x + w - 16 - keyW('use this', { size: 10 }), ky, 'use this', { h: 20, size: 10, dim: o.dim })[0] }
      return s
    }
  }
  window.DR.WAYS = (edit) => [
    { letter: 'A', name: 'carve the lows', says: 'each keeps a low of its own: the bass dips under the kick, the kick under the bass', lines: [
      [{ t: 'put', k: 'act' }, { t: edit ? 'hitsville eq mastering' : 'pro-q 4', k: 'plug' }, { t: 'on', k: 'plain' }, { t: 'bass', c: DR.bc }],
      [{ t: 'bass', c: DR.bc }, { t: 'bell' }, { t: edit ? '56 hz' : '55 hz', k: 'much' }, { t: edit ? '−1.5' : '−3 db', k: 'much', edit: !!edit }, { t: 'q 1.4', k: 'much' }],
      [{ t: 'kick', c: DR.kc }, { t: 'bell' }, { t: '100 hz', k: 'much' }, { t: '−2 db', k: 'much' }]], note: edit ? '56 hz: hitsville’s nearest step to 55' : '' },
    { letter: 'B', name: 'duck the bass', says: 'the bass steps aside for as long as the kick sounds', lines: [
      [{ t: 'put', k: 'act' }, { t: 'pro-c 2', k: 'plug' }, { t: 'on', k: 'plain' }, { t: 'bass', c: DR.bc }],
      [{ t: 'key', k: 'plain' }, { t: 'kick', c: DR.kc }, { t: 'ratio 4:1', k: 'much' }, { t: '−4 db', k: 'much' }],
      [{ t: 'attack 1 ms', k: 'much' }, { t: 'release 80 ms', k: 'much' }]] },
    { letter: 'C', name: 'only where they meet', says: 'the bass gives way between 45 and 70 hz, and only on the kick’s hits', lines: [
      [{ t: 'put', k: 'act' }, { t: 'pro-q 4', k: 'plug' }, { t: 'on', k: 'plain' }, { t: 'bass', c: DR.bc }],
      [{ t: 'bass', c: DR.bc }, { t: 'dynamic bell' }, { t: '55 hz', k: 'much' }, { t: 'up to −4 db', k: 'much' }],
      [{ t: 'key', k: 'plain' }, { t: 'kick', c: DR.kc }, { t: 'q 1.0', k: 'much' }]] }]
  window.DR.frame = (o) => {
    let [s, fx, fy] = DR.page(o.said)
    const cy = fy + 18, lw = 300
    s += DR.heard(fx, cy, lw) + vline(fx + lw + 24, cy, H - FOOT_H - 16, .08)
    const wx = fx + lw + 48, ww = Math.floor((W - 20 - wx - 2 * 14) / 3), wh = H - FOOT_H - 16 - (cy + 36)
    /* hear: as it is, or one of the ways, at matched levels */
    s += T(wx, cy + 10, 'hear', { size: 9.5, a: .4 })
    s += cells(wx + 34, cy - 3, 18, [{ t: 'as it is', on: o.hear === 0 }, { t: 'A', on: o.hear === 1 }, { t: 'B', on: o.hear === 2 }, { t: 'C', on: o.hear === 3 }], { size: 9.5, widths: [64, 34, 34, 34] })[0]
    s += T(wx + 34 + 166 + 12, cy + 10, 'levels matched', { size: 9.5, a: .4 })
    s += T(W - 20, cy + 10, o.right || 'three ways — one is used', { size: 9.5, a: .4, anchor: 'end' })
    DR.WAYS(o.edit).forEach((w, i) => { s += DR.way(wx + i * (ww + 14), cy + 26, ww, wh, Object.assign({}, w, { hear: o.hear === i + 1, used: o.used === i + 1, dim: o.used && o.used !== i + 1 })) })
    if (o.list) {                                                                         /* the plug-in's cell pressed: the others of its kind on this Mac */
      const lx = wx + 16 + 44, ly = cy + 26 + 62 + 24, rows = [['pro-q 4', 'fabfilter'], ['hitsville eq mastering', 'uad'], ['pultec eqp-1a', 'uad'], ['channel eq', 'apple'], ['eq', 'the room’s own print']], lw2 = 250
      s += R(lx, ly, lw2, rows.length * 24 + 10, { rx: 3, fill: K2, stroke: INK, sa: .28 })
      rows.forEach((r, i) => { const ry = ly + 5 + i * 24; if (i === 1) s += R(lx + 5, ry, lw2 - 10, 24, { rx: 2, fill: INK }); s += T(lx + 14, ry + 16, r[0], { size: 10.5, w: i === 1 ? 500 : 400, c: i === 1 ? K1 : INK, a: i === 1 ? 1 : .85 }) + T(lx + lw2 - 14, ry + 16, r[1], { size: 9.5, c: i === 1 ? K1 : INK, a: i === 1 ? .7 : .42, anchor: 'end' }) })
    }
    DR.put(s)
  }
  flush()`)

const frames = [
  ['1 three ways offered.png', `DR.frame({ said: 'kick and bass sound apart', hear: 2 })`],
  ['2 a plug-in swapped for another of its kind.png', `DR.frame({ said: 'kick and bass sound apart', hear: 1, list: true, right: 'its plug-in pressed: the other eqs on this mac, and the room’s own' })`],
  ['3 a way changed in place.png', `DR.frame({ said: 'kick and bass sound apart', hear: 1, edit: true, right: 'an amount typed over; the swapped eq’s nearest step said' })`],
  ['4 one way used.png', `DR.frame({ said: 'kick and bass sound apart', hear: 2, used: 2, right: 'B used — the others step back' })`],
]
for (const [name, js] of frames) { await b.ev(js); await b.sleep(150); await b.shot('choices.png'); copyFileSync(join(here, '../../test/out/choices.png'), join(here, name)) }
await b.close()
console.log('drawn')
