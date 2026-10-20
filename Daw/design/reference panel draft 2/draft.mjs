// node "design/reference panel draft 2/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the reference as he
// placed it (2026-10-20, on draft 1): right above track 1, as tall as the other tracks, the song in a region drawn as theirs
// are — only its edge is thicker, so it reads as the reference. It stays there while the tracks scroll under it.
//   a  the mix heard: the reference row quiet, its edge half lit
//   b  the reference heard (a press anywhere in its row): its edge lit, the room under it steps back
// Made from the menu bar: Track > Create Reference Track, ⌥⌘R (free in the app and in every key set it imports).
// Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)

await b.ev(`if (typeof START !== 'undefined') START.on = false
  /* a session as full as one of his: twenty-odd tracks, made from the demo's own sounds */
  const more = [['kick sub', 0], ['clap', 1], ['perc', 2], ['shaker', 2], ['808', 3], ['rhodes', 4], ['pad', 4], ['strings', 7], ['gtr dbl', 5], ['vox lead', 6], ['vox dbl', 6], ['bv l', 6], ['bv r', 6], ['adlib', 6], ['riser', 7]]
  const base = S.tracks.slice()
  for (const [name, k] of more) { const src = base[k], t = mkTrack(name, null, null, null, src.buf0, src.vol - 2, [], copy(src.patch), { out: src.out }); t.regs = src.regs.filter((r, j) => (j + name.length) % 3 !== 0).map(r => cloneReg(r)); S.tracks.push(t) }
  S.rh = 25; S.sel = 1; S.pos = 18.5
  /* the room's rows begin one row lower: the reference stands where track 1 stood */
  window.REF = { gap: 6 }
  const r0 = relayout
  relayout = function () {
    r0()
    TY += S.rh + REF.gap; LANES_H = Math.max(0, BY - TY)
    const set = (id, x, y, w, h) => { const r = $(id).firstChild; r.setAttribute('x', n(x)); r.setAttribute('y', n(y)); r.setAttribute('width', n(Math.max(0, w))); r.setAttribute('height', n(Math.max(0, h))) }
    set('ln', X0, TY, X1 - X0, LANES_H); set('hdc', 0, TY, HEAD_W, LANES_H)
  }
  setView(true); dirtyAll(); flush()
  /* the reference: a track of its own, not one of the song's; its region the length of the song it holds */
  const src = base.find(t => t.name === 'keys')
  window.REFT = mkTrack('blinding lights', null, null, null, src.buf0, -3, [], copy(src.patch), { c: '#CFCBC2' })
  REFT.outline = src.outline; if (src.shape) REFT.shape = src.shape
  REFT.regs = [mkReg({ a: 1, b: 42.25, buf: src.buf0, loop: true, off: 0, tag: 'blinding lights' })]
  window.DR = {
    put (svg) { let g = document.getElementById('draft'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'draft'; document.getElementById('svg').appendChild(g) } g.innerHTML = svg },
    row (heard) {
      const rh = S.rh, y = TY - rh - REF.gap, xEnd = bx(SONG_END + 1)
      S.tracks.push(REFT); const i = S.tracks.length - 1
      const lane = laneRow(i, new Set(), xEnd)
      S.tracks.pop()
      let s = R(0, y, RX, rh, { fill: K0 }) + R(0, y, HEAD_W, rh, { fill: K1 })
      s += '<g clip-path="url(#ln0)">' + G(lane, 'translate(0 ' + n(y) + ')') + '</g>'
      s = '<clipPath id="ln0"><rect x="' + X0 + '" y="' + y + '" width="' + (X1 - X0) + '" height="' + rh + '"/></clipPath>' + s
      /* its head, as a track's: what it is in place of a number, its name, a key to put it away, its level */
      const by = y + rh / 2 + 3.9
      s += T(25, by - .4, 'ref', { size: 8.5, a: heard ? .95 : .55, anchor: 'end' })
      s += R(32, y + 5, 3, rh - 10, { fill: REFT.c })
      s += T(42, by, REFT.name, { size: lkN('heads.size'), w: 500, a: heard ? 1 : .88 })
      s += key(214 - keyW('close', { size: 8.5, pad: 6 }), y + rh / 2 - 7.5, 'close', { h: 15, size: 8.5, pad: 6 })[0]
      s += levelBar(HEAD_FX, y + rh / 2 - 1, HEAD_FW, REFT, REFT.vol) + T(HEAD_W - 8, by - .4, fmtDb(REFT.vol), { size: 9, a: .56, anchor: 'end' })
      s += vline(X0 - .5, y, y + rh, .1)
      /* the playhead goes on through it: it plays at the song's place */
      const px = Math.round(bx(curPos() + 1)); if (px >= X0 && px <= X1) s += P('M' + (px + .5) + ' ' + y + 'V' + (y + rh + REF.gap), { stroke: lkC('play.c', INK), sw: lkN('play.w') })
      /* the edge: thicker than any row's, lit while it is what is heard */
      s += R(1, y - 1, RX - 2, rh + 2, { rx: 3, stroke: INK, sa: heard ? 1 : .42, sw: 2 })
      /* while it is heard, the room under it steps back */
      if (heard) s += R(0, TY, RX, BY - TY, { fill: K0, fa: .5 })
      return s
    }
  }`)
await b.ev(`DR.put(DR.row(false))`); await b.sleep(150); await b.shot('ref2-a.png')
await b.ev(`DR.put(DR.row(true))`); await b.sleep(150); await b.shot('ref2-b.png')
await b.close()
for (const [f, name] of [['ref2-a.png', 'a the mix heard.png'], ['ref2-b.png', 'b the reference heard.png']]) { copyFileSync(join(here, '../../test/out', f), join(here, name)); rmSync(join(here, '../../test/out', f)) }
console.log('drawn')
