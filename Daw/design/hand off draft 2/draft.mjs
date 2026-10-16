// node "design/hand off draft 2/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the hand-off panel as he
// chose it (way b of draft 1: centred, the stems at the left), its right side drawn again so that it is not everything at
// once. Nothing is taken away: what, print, range, file, rate, depth and name are all still there.
//   a  one after another: each question is a line; the one being answered is open with its choices, the ones answered
//      say their answer and open again when pressed, the ones to come stand dim with what they would be
//   b  what it is for, first: four kinds of hand-off as large keys, each setting all of it; under them one line says what
//      that is, and "change" opens every choice
//   c  one sentence: what is handed off said in words, each changeable word underlined; pressed, it lists its choices
// Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)

/* the room behind, and the panel's frame, its head, its stems and its foot: as in draft 1 way b */
await b.ev(`if (typeof START !== 'undefined') START.on = false; S.ho.open = false; setView(true); dirtyAll(); flush()
  window.DR = {
    put (svg) { let g = document.getElementById('draft'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'draft' } document.getElementById('svg').appendChild(g); g.innerHTML = svg },
    frame (sub) {
      const w = 720, h = 470, x = Math.round((W - w) / 2), y = Math.round((H - h) / 2), L = x + 24, mid = x + 340, Rr = x + w - 24
      let s = R(0, 0, W, H, { fill: '#000', fa: .5 })
      s += R(x - 1, y - 1, w + 2, h + 2, { rx: 6, fill: '#000', fa: .4 }) + R(x, y, w, h, { rx: 5, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 5, stroke: INK, sa: .26 })
      s += T(L, y + 32, 'hand off', { size: 13, w: 500 }) + T(L + tw('hand off', 13, 500) + 9, y + 32, sub, { size: 13, a: .45 })
      s += T(Rr, y + 32, asGiven('2:41\u00a0\u00a0\u00a0212.4 mb'), { size: 10.5, a: .62, anchor: 'end' }) + hline(x + 1, x + w - 1, y + 48, .08)
      s += T(L, y + 74, 'stems', { size: 9.5, a: .4 })
      S.tracks.forEach((t, i) => {
        const ry = y + 100 + i * 26, out = i === 6
        let g = (out ? P('M' + L + ' ' + (ry - 4) + 'H' + (L + 7), { stroke: INK, sa: .7 }) : R(L + .5, ry - 7.5, 6, 6, { stroke: t.c, sa: .9 })) + T(L + 18, ry, asGiven(t.name), { size: 11, w: 500, a: .92 })
        g += T(mid - 40, ry, out ? 'left out' : (20 + i * 3.1).toFixed(1) + ' mb', { size: 10, a: .5, anchor: 'end' })
        s += out ? G(g, '', ' opacity=".45"') : g
      })
      s += vline(mid - 16, y + 62, y + h - 64, .08)
      const fy = y + h - 44
      s += hline(x + 1, x + w - 1, fy - 8, .08)
      const so = { armed: true, h: 24, size: 10.5, pad: 14 }, co = { h: 24, size: 10.5, pad: 14 }, cw = keyW('cancel', co), sw = keyW('send', so)
      s += key(Rr - sw, fy + 2, 'send', so)[0] + key(Rr - sw - 10 - cw, fy + 2, 'cancel', co)[0]
      s += T(L, fy + 18, 'to', { size: 10, a: .45 }) + T(L + 18, fy + 18, asGiven('~/Music/Slur Studio/Bounces/night bus ep, stems'), { size: 10, a: .8 })
      return { s, x, y, w, h, L, mid, Rr }
    },
    cellsAt (x, y, h, opts, on, size) { const items = opts.map((v, k) => ({ t: v, on: k === on })); return cells(x, y, h, items, { size, pad: 12 }) },
  }`)

/* a: one after another */
await b.ev(`const F = DR.frame('7 stems'), x0 = F.mid, x1 = F.Rr
  let s = F.s, y = F.y + 66
  const done = (label, value, n) => { let g = T(x0, y + 15, label, { size: 10, a: .45 }) + T(x1, y + 15, value, { size: 11, w: 500, a: .92, anchor: 'end' }) + hline(x0, x1, y + 28, .07); y += 34; return g }
  const later = (label, value) => { let g = T(x0, y + 15, label, { size: 10, a: .28 }) + T(x1, y + 15, value, { size: 11, a: .3, anchor: 'end' }) + hline(x0, x1, y + 28, .05); y += 34; return g }
  s += done('what', 'stems') + done('print', 'with patch') + done('range', 'the song')
  /* the open one: its question large, its choices as large keys, one line under each */
  s += R(x0 - 12, y - 4, x1 - x0 + 24, 118, { rx: 4, fill: INK, fa: .05 })
  s += T(x0, y + 18, 'file', { size: 12, w: 500 })
  const opts = [['wav', 'as it is'], ['aiff', 'as it is'], ['flac', 'smaller'], ['mp3', 'small'], ['m4a', 'small']], kw = Math.floor((x1 - x0 - 4 * 8) / 5)
  opts.forEach(([v, d], k) => {
    const kx = x0 + k * (kw + 8), ky = y + 32, on = k === 0
    s += on ? R(kx, ky, kw, 52, { rx: 3, fill: INK }) : R(kx + .5, ky + .5, kw - 1, 51, { rx: 3, stroke: INK, sa: .28 })
    s += T(kx + kw / 2, ky + 23, v, { size: 12.5, w: 500, c: on ? K1 : INK, anchor: 'middle' }) + T(kx + kw / 2, ky + 40, d, { size: 9, c: on ? K1 : INK, a: on ? .7 : .45, anchor: 'middle' })
  })
  y += 124
  s += later('quality', '48k   24 bit') + later('name', 'night bus ep, stems')
  DR.put(s)`)
await b.sleep(120); await b.shot('a.png')

/* b: what it is for, first */
await b.ev(`const F = DR.frame('7 stems'), x0 = F.mid, x1 = F.Rr
  let s = F.s, y = F.y + 66
  s += T(x0, y + 10, 'for', { size: 9.5, a: .4 })
  const kinds = [['mixing elsewhere', 'stems with their patch'], ['mixing from scratch', 'stems, dry'], ['listening', 'the mix, small'], ['mastering', 'the mix, as it is']], kw = Math.floor((x1 - x0 - 10) / 2), kh = 62
  kinds.forEach(([v, d], k) => {
    const kx = x0 + (k % 2) * (kw + 10), ky = y + 22 + Math.floor(k / 2) * (kh + 10), on = k === 0
    s += on ? R(kx, ky, kw, kh, { rx: 4, fill: INK }) : R(kx + .5, ky + .5, kw - 1, kh - 1, { rx: 4, stroke: INK, sa: .28 })
    s += T(kx + 14, ky + 26, v, { size: 12.5, w: 500, c: on ? K1 : INK }) + T(kx + 14, ky + 45, d, { size: 10, c: on ? K1 : INK, a: on ? .72 : .5 })
  })
  y += 22 + 2 * (kh + 10) + 10
  /* what that is, in one line, and the way to every choice */
  s += hline(x0, x1, y, .08)
  { let sx = x0; for (const w of ['stems', 'with patch', 'the song', 'wav', '48k', '24 bit']) { s += T(sx, y + 26, w, { size: 10.5, a: .84 }); sx += tw(w, 10.5) + 16 } }
  const ck = { h: 20, size: 9.5, pad: 9 }; s += key(x1 - keyW('change', ck), y + 12, 'change', ck)[0]
  y += 44
  s += T(x0, y + 22, 'name', { size: 10, a: .45 }) + R(x0 + 60.5, y + 8.5, x1 - x0 - 61, 21, { rx: 2, fill: K0, stroke: INK, sa: .26 }) + T(x0 + 68, y + 23, asGiven('night bus ep, stems'), { size: 10.5, a: .9 })
  DR.put(s)`)
await b.sleep(120); await b.shot('b.png')

/* b, with change pressed: every choice, in the order of draft 1, under the four */
await b.ev(`const F = DR.frame('7 stems'), x0 = F.mid, x1 = F.Rr
  let s = F.s, y = F.y + 66
  s += T(x0, y + 10, 'for', { size: 9.5, a: .4 })
  const kinds = ['elsewhere', 'from scratch', 'listening', 'mastering'], kw = Math.floor((x1 - x0 - 30) / 4)
  kinds.forEach((v, k) => { const kx = x0 + k * (kw + 10), ky = y + 20, on = false; s += R(kx + .5, ky + .5, kw - 1, 23, { rx: 3, stroke: INK, sa: .22 }) + T(kx + kw / 2, ky + 16, fit(v, kw - 8, 9.5), { size: 9.5, a: .7, anchor: 'middle' }) })
  s += T(x1, y + 10, 'your own', { size: 9.5, a: .9, anchor: 'end' })
  y += 56
  const rows = [['what', ['stems', 'mix'], 0], ['print', ['with patch', 'dry', 'both'], 1], ['range', ['verse', 'cycle', 'song'], 2], ['file', ['wav', 'aiff', 'flac', 'mp3', 'm4a'], 0], ['rate', ['44.1', '48', '88.2', '96'], 1], ['depth', ['16', '24', '32 float'], 1]]
  rows.forEach(([name, opts, on], i) => {
    const ry = y + i * 34
    s += T(x0, ry + 15, name, { size: 10, a: .45 })
    const items = opts.map((v, k) => ({ t: v, on: k === on })), wsum = items.reduce((a, it) => a + Math.round(tw(it.t, 10, 500) + 22), 0)
    s += cells(x1 - wsum, ry + 1, 22, items, { size: 10, pad: 11 })[0]
  })
  DR.put(s)`)
await b.sleep(120); await b.shot('b2.png')

/* c: one sentence */
await b.ev(`const F = DR.frame('7 stems'), x0 = F.mid, x1 = F.Rr
  let s = F.s, y = F.y + 96
  const lines = [[['hand off ', 0], ['stems', 1], [' of every track,', 0]], [['', 0], ['with their patch', 1], [', of ', 0], ['the song', 1], [',', 0]], [['as ', 0], ['wav', 1], [' files, ', 0], ['48k', 1], [', ', 0], ['24 bit', 1], [',', 0]], [['named ', 0], ['night bus ep, stems', 1], ['.', 0]]]
  lines.forEach((parts, i) => {
    let x = x0
    const ly = y + i * 44
    parts.forEach(([t, on]) => {
      if (!t) return
      const tt = t.replace(/ /g, '\u00a0'), w = tw(asGiven(tt), 17, on ? 500 : 400)
      s += T(x, ly, asGiven(tt), { size: 17, w: on ? 500 : 400, a: on ? 1 : .55 })
      if (on) s += R(x, ly + 6, w, 1.4, { fill: INK, fa: i === 2 && t === 'wav' ? 1 : .45 })
      x += w
    })
  })
  /* one word pressed: its choices, just under it */
  const wx = x0 + tw(asGiven('as\u00a0'), 17), wy = y + 2 * 44 + 16, opts = ['wav', 'aiff', 'flac', 'mp3', 'm4a'], lw = 150
  s += R(wx - 8, wy, lw, opts.length * 24 + 10, { rx: 3, fill: K1 }) + R(wx - 7.5, wy + .5, lw - 1, opts.length * 24 + 9, { rx: 3, stroke: INK, sa: .3 })
  opts.forEach((v, k) => { const ry = wy + 5 + k * 24, on = k === 0; if (on) s += R(wx - 3, ry, lw - 10, 24, { rx: 2, fill: INK }); s += T(wx + 6, ry + 16, v, { size: 11, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .84 }) + T(wx + lw - 22, ry + 16, ['as it is', 'as it is', 'smaller', 'small', 'small'][k], { size: 9.5, c: on ? K1 : INK, a: on ? .7 : .42, anchor: 'end' }) })
  DR.put(s)`)
await b.sleep(120); await b.shot('c.png')
await b.close()
for (const [f, name] of [['a.png', 'a one after another.png'], ['b.png', 'b what it is for, first.png'], ['b2.png', 'b what it is for, change pressed.png'], ['c.png', 'c one sentence.png']]) { copyFileSync(join(here, '../../test/out', f), join(here, name)); rmSync(join(here, '../../test/out', f)) }
console.log('drawn')
