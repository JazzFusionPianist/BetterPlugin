// node "design/bar and hand off draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser:
//   1  the control bar without patch, mixer (left) and slur (right): they are opened from the Mac's Window menu instead
//      (Window > Patch, Mixer, Slur, with b, x, o as now); hand off stays at the right end, and its panel comes up in the
//      middle of the window, the room dimmed behind it — a  the panel as it is now, only centred
//   2  b  centred and given room: the stems at the left, how they are printed at the right, send at its foot
// Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)

/* the bar as it would be: the two page keys and slur's key left out (the rest of pTop as it is) */
await b.ev(`if (typeof START !== 'undefined') START.on = false
  let src = pTop.toString()
  src = src.replace(/  s \\+= cells\\(12, 10, 24, \\[\\{ t: 'patch'[^\\n]*\\n/, '')
  src = src.replace(/  const \\[c1, w1\\] = cells\\(0, 0, 24, \\[\\{ t: 'slur'[^\\n]*\\n  x -= 13; s \\+= vline\\(x, 12, 32, \\.1\\); x -= 13\\n/, '')
  ;(0, eval)('pTop = ' + src); PARTS.top = pTop
  window.DRAFT_SRC_OK = !/t: 'patch'|t: 'slur'/.test(src)
  window.DRAFT_PUT = svg => { let g = document.getElementById('draft'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'draft'; document.getElementById('svg').appendChild(g) } g.innerHTML = svg }
  setView(true); dirtyAll(); flush()`)

/* a: the hand off panel as it is, centred, the room dimmed */
await b.ev(`S.ho.open = true; S.ho.what = 'stems'; dirtyAll(); flush()
  const g = document.getElementById('g-hand'), bb = g.getBBox(), panes = [...g.querySelectorAll('rect')].filter(r => r.getAttribute('rx') === '3'), p = panes[0].getBBox()
  const dx = Math.round((W - p.width) / 2 - p.x), dy = Math.round((H - p.height) / 2 - p.y)
  g.setAttribute('transform', 'translate(' + dx + ' ' + dy + ')')
  const dim = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); dim.setAttribute('x', 0); dim.setAttribute('y', 0); dim.setAttribute('width', W); dim.setAttribute('height', H); dim.setAttribute('fill', '#000'); dim.setAttribute('fill-opacity', '.45'); dim.id = 'draft-dim'
  const top = document.getElementById('svg'); top.appendChild(dim); top.appendChild(g)`)
console.log('bar keys gone:', await b.ev(`return DRAFT_SRC_OK`))
await b.sleep(150); await b.shot('ho-a.png')

/* b: centred and given room */
await b.ev(`const g0 = document.getElementById('g-hand'); g0.removeAttribute('transform'); g0.innerHTML = ''
  const dimEl = document.getElementById('draft-dim'); if (dimEl) dimEl.remove()
  S.ho.open = false; dirtyAll(); flush()
  const w = 720, h = 470, x = Math.round((W - w) / 2), y = Math.round((H - h) / 2), L = x + 24, mid = x + 340, Rr = x + w - 24
  let s = R(0, 0, W, H, { fill: '#000', fa: .45 })
  s += R(x - 1, y - 1, w + 2, h + 2, { rx: 6, fill: '#000', fa: .4 }) + R(x, y, w, h, { rx: 5, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 5, stroke: INK, sa: .26 })
  s += T(L, y + 32, 'hand off', { size: 13, w: 500 }) + T(L + tw('hand off', 13, 500) + 9, y + 32, '7 stems', { size: 13, a: .45 })
  s += T(Rr, y + 32, '2:41   48k   24 bit   212.4 mb', { size: 10.5, a: .62, anchor: 'end' }) + hline(x + 1, x + w - 1, y + 48, .08)
  /* the stems: each track, its colour, how big; a row pressed is left out */
  s += T(L, y + 74, 'stems', { size: 9.5, a: .4 })
  S.tracks.forEach((t, i) => {
    const ry = y + 100 + i * 26, out = i === 6
    let g = (out ? P('M' + L + ' ' + (ry - 4) + 'H' + (L + 7), { stroke: INK, sa: .7 }) : R(L + .5, ry - 7.5, 6, 6, { stroke: t.c, sa: .9 })) + T(L + 18, ry, asGiven(t.name), { size: 11, w: 500, a: .92 })
    g += T(mid - 40, ry, out ? 'left out' : (20 + i * 3.1).toFixed(1) + ' mb', { size: 10, a: .5, anchor: 'end' })
    s += out ? G(g, '', ' opacity=".45"') : g
  })
  s += vline(mid - 16, y + 62, y + h - 64, .08)
  /* how they are printed */
  const rows = [['what', ['stems', 'mix'], 0], ['print', ['with patch', 'dry', 'both'], 0], ['range', ['verse', 'cycle', 'song'], 2], ['file', ['wav', 'aiff', 'flac', 'mp3', 'm4a'], 0], ['rate', ['44.1', '48', '88.2', '96'], 1], ['depth', ['16', '24', '32 float'], 1]]
  rows.forEach(([name, opts, on], i) => {
    const ry = y + 66 + i * 40
    s += T(mid, ry + 21, name, { size: 10, a: .45 })
    const items = opts.map((v, k) => ({ t: v, on: k === on })), wsum = items.reduce((a, it) => a + Math.round(tw(it.t, 10, 500) + 22), 0)
    s += cells(Rr - wsum, ry + 7, 22, items, { size: 10, pad: 11 })[0]
  })
  s += T(mid, y + 66 + 6 * 40 + 20, 'name', { size: 10, a: .45 }) + R(mid + 90.5, y + 66 + 6 * 40 + 6.5, Rr - mid - 91, 21, { rx: 2, fill: K0, stroke: INK, sa: .26 }) + T(mid + 98, y + 66 + 6 * 40 + 21, asGiven('night bus ep, stems'), { size: 10.5, a: .9 })
  /* its foot */
  const fy = y + h - 44
  s += hline(x + 1, x + w - 1, fy - 8, .08)
  const so = { armed: true, h: 24, size: 10.5, pad: 14 }, cw = keyW('cancel', { h: 24, size: 10.5, pad: 14 }), sw = keyW('send', so)
  s += key(Rr - sw, fy + 2, 'send', so)[0] + key(Rr - sw - 10 - cw, fy + 2, 'cancel', { h: 24, size: 10.5, pad: 14 })[0]
  DRAFT_PUT(s); const d = document.getElementById('draft'); d.parentNode.appendChild(d)`)
await b.sleep(150); await b.shot('ho-b.png')
await b.close()
for (const [f, name] of [['ho-a.png', '1 a the bar without its page keys, hand off centred.png'], ['ho-b.png', '2 b hand off centred and given room.png']]) { copyFileSync(join(here, '../../test/out', f), join(here, name)); rmSync(join(here, '../../test/out', f)) }
console.log('drawn')
