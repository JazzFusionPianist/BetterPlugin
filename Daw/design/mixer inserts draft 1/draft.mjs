// node "design/mixer inserts draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the mixer showing
// each strip's patch as a column of slots (as Logic's audio fx), so plug-ins can be put on many tracks at once.
//   1  four strips chosen (kick, snare, hats, bass); an empty slot of one of them pressed: the list of plug-ins, and what
//      is picked goes on all four ("on 4 tracks")
//   2  a slot pulled with option to other strips: the plug-in, with its settings, copied to each strip it is let go on —
//      and onto one of several chosen strips, to all of them
// His ask, 2026-10-19 ("여러개의 트랙에 같은 플러그인들을 동시에 걸고 싶은데 … logic pro x 처럼"). Nothing of this is in the
// app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))

const KIT = `
window.MI = {
  plugs: { kick: ['pro-q 4', 'pro-c 2'], snare: ['pro-q 4'], hats: [], bass: ['pro-q 4', 'pro-c 2', 'decapitator'], keys: ['valhallavintageverb'], guitar: ['pro-q 4'], hum: ['soothe3', 'pro-q 4'], air: [] },
  prints: { kick: [], snare: ['space'], hats: [], bass: ['tape'], keys: [], guitar: ['space'], hum: ['space'], air: [] },
  SLOTS: 5,
  /* the strips as drawn: x and width of each, from the press that names it */
  strips () { const out = []; document.querySelectorAll('#g-dock [data-a="msel"]').forEach(el => out.push({ i: +el.dataset.i, x: +el.getAttribute('x'), w: +el.getAttribute('width') })); return out },
  /* one slot: a plug-in's name in a cell (a print of the room's in its own colour), or an empty one */
  slot (x, y, w, h, word, o = {}) {
    let s = ''
    if (word) {
      s += R(x, y, w, h, { rx: 1.5, fill: o.ghost ? K0 : K3, fa: o.ghost ? .9 : 1 }) + (o.ghost ? R(x + .5, y + .5, w - 1, h - 1, { rx: 1.5, stroke: INK, sa: .7, dash: '2 2' }) : '')
      if (o.c) s += R(x + 3, y + h / 2 - 2, 4, 4, { fill: o.c })
      s += T(x + (o.c ? 10 : 5), y + h / 2 + 3, fit(word, w - (o.c ? 14 : 9), 8.5), { size: 8.5, a: o.off ? .4 : .9 })
    } else s += R(x, y, w, h, { rx: 1.5, fill: K0, fa: .55 }) + (o.plus ? T(x + w / 2, y + h / 2 + 3, '+', { size: 9, a: .4, anchor: 'middle' }) : '')
    return s
  },
  put (svg) { let g = document.getElementById('draft'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'draft'; document.getElementById('svg').appendChild(g) } g.innerHTML = svg },
}
/* the strip's rows: in place of the patch's one row of dots, as many slots as there is room for; the sends and the out as before */
const geom0 = stripGeom
stripGeom = function (y, h, wide) { const q = geom0(y, h, wide); if (wide) return q
  const rws = ['fx'].concat(Array(MI.SLOTS - 1).fill('\u2060'), ['send', '', 'out']), sp = q.sp, y0 = q.y0, panY = y0 + rws.length * sp + 9, ft = panY + 14, fb = Math.max(ft + 24, y + h - 67)      // (the gutter names the slots once)
  return Object.assign({}, q, { rows: rws, panY, ft, fb, fh: fb - ft, yOf: db => fb - (fb - ft) * volF(db) }) }
/* each strip's slots, drawn where the rows stand */
window.miSlots = function (extra) {
  let s = ''
  const q = stripGeom(BY + PH, S.panel.h - PH, false), PRINT_C = { tape: '#B4823C', space: '#5A6EC8', delay: '#3C9682' }
  for (const st of MI.strips()) {
    const t = S.tracks[st.i]; if (!t) continue
    const list = (MI.prints[t.name] || []).map(p => ({ t: p, c: PRINT_C[p] })).concat((MI.plugs[t.name] || []).map(p => ({ t: p })))
    const sx = st.x + 4, sw = st.w - 8
    for (let k = 0; k < MI.SLOTS; k++) {
      const y = q.y0 + k * q.sp, it = list[k], ex = extra && extra(t, k, list)
      s += ex != null ? ex(sx, y, sw, q.sh) : it ? MI.slot(sx, y, sw, q.sh, it.t, { c: it.c }) : MI.slot(sx, y, sw, q.sh, '', { plus: k === list.length })
    }
  }
  return s
}
`

async function sheet (file, setup, draw) {
  const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 470; setView(true)
    ${setup}
    dirtyAll(); flush()`)
  await b.ev(`flush(); const q = stripGeom(BY + PH, S.panel.h - PH, false); let s = R(0, 0, 0, 0)
    ${draw}
    MI.put(s)`)
  await b.sleep(250)
  await b.shot('mi.png')
  copyFileSync(join(here, '../../test/out/mi.png'), join(here, file))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}

/* 1: four strips chosen, an empty slot pressed: what is picked goes on all four */
await sheet('1 four strips chosen, a plug-in put on all of them.png',
  `const ids = ['kick', 'snare', 'hats', 'bass'].map(n => S.tracks.find(t => t.name === n).id); S.sel = S.tracks.findIndex(t => t.name === 'bass'); S.selT = ids`,
  `s += miSlots()
   const st = MI.strips().find(x => S.tracks[x.i].name === 'hats'), y = q.y0 + 0 * q.sp, x = st.x + 4
   s += R(x - .5, y - .5, st.w - 7, q.sh + 1, { rx: 1.5, stroke: INK, sa: .9 })      // (the slot pressed)
   /* the list: on how many tracks it goes, a field that finds, the kinds' first choices first */
   const lx = x, ly = y + q.sh + 6, lw = 236, rows = [['pro-q 4', 'eq', 1], ['pro-c 2', 'dynamics'], ['soothe3', 'eq'], ['decapitator', 'saturation'], ['valhallavintageverb', 'reverb'], ['pro-l 2', 'dynamics'], ['timeless 3', 'delay']]
   const lh = 58 + rows.length * 21
   s += R(lx, ly, lw, lh, { rx: 3, fill: K2 }) + R(lx + .5, ly + .5, lw - 1, lh - 1, { rx: 3, stroke: INK, sa: .28 })
   s += T(lx + 13, ly + 19, 'on 4 tracks', { size: 10, w: 500, a: .95 }) + T(lx + lw - 13, ly + 19, 'kick snare hats bass', { size: 9, a: .42, anchor: 'end' })
   s += R(lx + 6.5, ly + 28.5, lw - 13, 19, { rx: 2, stroke: INK, sa: .2 }) + T(lx + 14, ly + 41.5, 'find a plug-in', { size: 9.5, a: .34 })
   rows.forEach(([nm, kind, on], j) => { const ry = ly + 54 + j * 21; if (on) s += R(lx + 5, ry, lw - 10, 20, { rx: 2, fill: INK }); s += T(lx + 13, ry + 13.6, nm, { size: 10, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .86 }) + T(lx + lw - 13, ry + 13.6, kind, { size: 9, c: on ? K1 : INK, a: on ? .6 : .34, anchor: 'end' }) })`)

/* 2: a slot pulled with option onto other strips: copied there, with its settings */
await sheet('2 a plug-in pulled with option, copied to other strips.png',
  `S.sel = S.tracks.findIndex(t => t.name === 'bass'); S.selT = []`,
  `const from = MI.strips().find(x => S.tracks[x.i].name === 'bass'), targets = ['guitar', 'hum']
   s += miSlots((t, k, list) => targets.includes(t.name) && k === list.length ? (x, y, w, h) => MI.slot(x, y, w, h, 'pro-c 2', { ghost: true }) : null)
   const y1 = q.y0 + 2 * q.sp
   s += R(from.x + 3.5, y1 - .5, from.w - 7, q.sh + 1, { rx: 1.5, stroke: INK, sa: .9 })      // (the slot taken hold of, where it stays)
   for (const nm of targets) { const st = MI.strips().find(x => S.tracks[x.i].name === nm); s += R(st.x + 1.5, BY + PH + 2, st.w - 3, S.panel.h - PH - 4, { rx: 3, stroke: INK, sa: .3 }) }
   /* in the hand, beside the pointer: the plug-in and a plus (option: a copy) */
   const hum = MI.strips().find(x => S.tracks[x.i].name === 'hum'), px = hum.x + hum.w * .6, py = q.y0 + 2 * q.sp + 6
   s += R(px + 8, py - 2, 76, 16, { rx: 2, fill: K3 }) + R(px + 8.5, py - 1.5, 75, 15, { rx: 2, stroke: INK, sa: .5 }) + T(px + 14, py + 9.5, 'pro-c 2', { size: 9, a: .95 }) + T(px + 78, py + 9.5, '+', { size: 10, w: 500, a: .9, anchor: 'end' })
   s += P('M' + px + ' ' + py + 'l0 11 3 -3 2.2 4.4 1.6 -.8 -2.2 -4.3 4.2 0z', { fill: INK, stroke: K0, sw: .8 })`)
process.exit(0)
