// node "design/reference panel draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: a reference song
// in a panel of its own, between the transport and the room. It is heard only while it is the one chosen: a press inside
// it and the song is heard; a press in the room and the mix is heard again. It goes straight out — the stereo out's
// plug-ins are not on it. Three ways:
//   a  a strip across the window, flush under the bar (shown both ways: the mix heard, the reference heard)
//   b  a card that floats over its own place, several songs in it, their loudness against the mix's
//   c  one line, low, with the switch itself in it
// Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)

await b.ev(`if (typeof START !== 'undefined') START.on = false
  /* the room pushed down by the panel's height: the bar stays, everything under it moves */
  const r0 = relayout
  window.REF_H = 0
  relayout = function () {
    r0()
    if (!REF_H) return
    TOOL_Y += REF_H; MK_Y += REF_H; RU_Y += REF_H; TY += REF_H; LANES_H = Math.max(0, BY - TY)
    const set = (id, x, y, w, h) => { const r = $(id).firstChild; r.setAttribute('x', n(x)); r.setAttribute('y', n(y)); r.setAttribute('width', n(Math.max(0, w))); r.setAttribute('height', n(Math.max(0, h))) }
    set('tl', X0, MK_Y, X1 - X0, BY - MK_Y); set('ln', X0, TY, X1 - X0, LANES_H); set('hdc', 0, TY, HEAD_W, LANES_H)
  }
  /* a song's sound, as a reference is: quiet intro, verse, a loud chorus, a break, the last chorus louder still */
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const LEN = 600, shape = [], parts = [[0, .18], [.07, .45], [.24, .78], [.36, .5], [.52, .82], [.66, .3], [.74, .92], [.94, .25], [1, .05]]
  for (let i = 0; i < LEN; i++) { const f = i / LEN; let k = 0; while (parts[k + 1][0] < f) k++; const [a0, v0] = parts[k], [a1, v1] = parts[k + 1], v = v0 + (v1 - v0) * Math.pow((f - a0) / (a1 - a0), 6); shape.push(clamp(v * (.62 + .38 * rnd()) + (rnd() < .06 ? .12 : 0), .02, 1)) }
  window.DR = {
    wave (x, y, w, h, o = {}) {                                                      // the song's sound across w, filled, both ways from its middle
      const cy = y + h / 2, step = 1.5, top = [], bot = []
      for (let px = 0; px <= w; px += step) { const v = shape[Math.min(LEN - 1, Math.floor(px / w * LEN))]; top.push(n(x + px) + ' ' + n(cy - v * h / 2)); bot.push(n(x + px) + ' ' + n(cy + v * h / 2)) }
      return P('M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z', { fill: o.c || INK, fa: o.a == null ? .5 : o.a })
    },
    ruler (x, y, w, secs, a = .4) {                                                  // its own time: minutes and seconds, not bars (its tempo is not the song's)
      let s = ''
      for (let t = 0; t <= secs; t += 15) { const px = x + t / secs * w; const big = t % 60 === 0; s += vline(px, y, y + (big ? 6 : 3), big ? .3 : .16); if (t % 30 === 0 && px < x + w - 30) s += T(px + 3, y + 7.5, Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'), { size: 8.5, a }) }
      return s
    },
    head (x, y0, y1, c, a = 1) { return P('M' + (n(x) + .5) + ' ' + y0 + 'V' + y1, { stroke: c, sa: a, sw: 1 }) + P('M' + (x - 4) + ' ' + y0 + 'H' + (x + 5) + 'V' + (y0 + 5) + 'L' + (x + .5) + ' ' + (y0 + 9.5) + 'L' + (x - 4) + ' ' + (y0 + 5) + 'Z', { fill: c, fa: a }) },
    put (svg) { let g = document.getElementById('draft'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'draft'; document.getElementById('svg').appendChild(g) } g.innerHTML = svg },
    room (h, dim) { REF_H = h; S.sel = 1; S.pos = 18.5; setView(true); dirtyAll(); flush() }
  }
  window.SONG = { name: 'blinding lights', who: 'the weeknd', secs: 200, at: 72 }
  /* a session as full as one of his: twenty-odd tracks, made from the demo's own sounds */
  const more = [['kick sub', 0], ['clap', 1], ['perc', 2], ['shaker', 2], ['808', 3], ['rhodes', 4], ['pad', 4], ['strings', 7], ['gtr dbl', 5], ['vox lead', 6], ['vox dbl', 6], ['bv l', 6], ['bv r', 6], ['adlib', 6], ['riser', 7]]
  const base = S.tracks.slice()
  for (const [name, k] of more) { const src = base[k], t = mkTrack(name, null, null, null, src.buf0, src.vol - 2, [], copy(src.patch), { pan: src.pan, out: src.out }); t.regs = src.regs.filter((r, j) => (j + name.length) % 3 !== 0).map(r => cloneReg(r)); S.tracks.push(t) }
  S.tracks.forEach((t, i) => { if (t.pan == null) t.pan = 0 })
  S.rh = 25; setView(true); dirtyAll(); flush()`)

/* a: a strip across the window, flush under the bar. The left part lines up with the heads: what it is and how loud;
   the right part is the song's sound across the lanes' width, with its own time and its own playhead. */
const stripA = heard => `
  const h = 64, y = BAR_H
  DR.room(h)
  let s = R(0, y, RX, h, { fill: ${heard} ? K2 : K1 }) + hline(0, RX, y + h - 1, .14)
  if (${heard}) s += R(0, y, 3, h - 1, { fill: INK })
  /* the left: its word, the song, how loud it is against the mix */
  const a = ${heard} ? 1 : .5
  s += T(14, y + 18, 'reference', { size: 9.5, a: .42 * (${heard} ? 1.6 : 1) })
  s += T(14, y + 36, SONG.name, { size: 12.5, w: 500, a: .95 * a }) + T(14 + tw(SONG.name, 12.5, 500) + 7, y + 36, SONG.who, { size: 10, a: .5 * a })
  s += T(14, y + 53, '-8.9 lufs', { size: 9.5, a: .62 * a }) + T(78, y + 53, 'mix -11.4', { size: 9.5, a: .38 * a })
  s += key(HEAD_W - 54, y + 8, 'close', { h: 16, size: 9, pad: 7 })[0]
  s += vline(X0, y + 6, y + h - 7, .1)
  /* the right: its own time across the top, its sound, its playhead */
  const wx = X0 + 8, ww = RX - X0 - 16
  s += DR.ruler(wx, y + 4, ww, SONG.secs, ${heard} ? .5 : .3)
  s += DR.wave(wx, y + 15, ww, h - 22, { a: ${heard} ? .62 : .22 })
  const px = wx + SONG.at / SONG.secs * ww
  s += DR.head(px, y + 4, y + h - 4, INK, ${heard} ? 1 : .35)
  /* while the reference is heard, the room under it steps back: the mix plays on, unheard */
  if (${heard}) s += R(0, y + h, RX, H - FOOT_H - y - h, { fill: K0, fa: .52 })
  DR.put(s)`
await b.ev(stripA(false)); await b.sleep(150); await b.shot('ref-a1.png')
await b.ev(stripA(true)); await b.sleep(150); await b.shot('ref-a2.png')

/* b: a card that floats over a place of its own (the room moved down by it), inset, with several songs in it and their
   loudness against the mix's; the one heard is outlined in the reference's own colour, the room's playhead goes grey */
await b.ev(`const h = 84, y = BAR_H, gap = 8, cx = 10, cw = RX - 20, ch = h - gap * 2, cy = y + gap, C = '#7FA7D9'
  DR.room(h)
  let s = R(0, y, RX, h, { fill: K0 })
  s += R(cx - 1, cy + 1, cw + 2, ch + 3, { rx: 7, fill: '#000', fa: .5 })
  s += R(cx + .5, cy + .5, cw - 1, ch - 1, { rx: 6, fill: K2, stroke: C, sa: .95, sw: 1.2 })
  /* the songs in it, one chosen; and one more can be put in */
  const songs = [['blinding lights', true], ['levitating', false], ['as it was', false]]
  let x = cx + 12
  s += T(x, cy + 17, 'reference', { size: 9.5, c: C, a: .95 })
  songs.forEach(([t, on], k) => { const ty = cy + 32 + k * 0; })
  const [cl, clw] = cells(x, cy + 26, 18, songs.map(([t, on]) => ({ t, on, c: C })).concat([{ t: '+' }]), { size: 9.5 }); s += cl
  /* how loud: the song, the mix, and a key that brings the song down to the mix (only what is heard is changed) */
  s += T(x, cy + 59, '-8.9', { size: 11, w: 500, a: .95 }) + T(x + 30, cy + 59, 'lufs', { size: 9, a: .45 }) + T(x + 58, cy + 59, 'mix -11.4', { size: 9.5, a: .5 })
  s += key(x + 122, cy + 48, 'match', { h: 16, size: 9, pad: 7 })[0]
  s += key(cx + cw - 12 - keyW('close', { size: 9, pad: 7 }), cy + 8, 'close', { h: 16, size: 9, pad: 7 })[0]
  /* its sound and its time, from the heads' edge on */
  const wx = X0 - 2, ww = cx + cw - 14 - wx - 50
  s += DR.ruler(wx, cy + 6, ww, SONG.secs, .45)
  s += DR.wave(wx, cy + 18, ww, ch - 26, { c: C, a: .7 })
  const px = wx + SONG.at / SONG.secs * ww
  s += DR.head(px, cy + 6, cy + ch - 6, INK, 1)
  s += T(cx + cw - 12, cy + ch - 9, '1:12', { size: 9.5, a: .8, anchor: 'end' })
  /* the room plays on, unheard: its playhead goes grey */
  s += R(bx(S.pos + 1) - 6, RU_Y, 13, BY - RU_Y, { fill: K0, fa: 0 })
  DR.put(s)
  const ph = document.getElementById('ph'); if (ph) ph.setAttribute('opacity', '.3')`)
await b.sleep(150); await b.shot('ref-b.png')

/* c: one line, low. The switch is in it — mix | reference — so which is heard can be read at a glance; a press anywhere
   in the line, or on the room, turns it over as well */
await b.ev(`const ph = document.getElementById('ph'); if (ph) ph.removeAttribute('opacity')
  const h = 34, y = BAR_H
  DR.room(h)
  let s = R(0, y, RX, h, { fill: K1 }) + hline(0, RX, y + h - 1, .14)
  const [sw] = cells(12, y + 8, 18, [{ t: 'mix' }, { t: 'reference', on: true }], { size: 9.5, widths: [40, 72] }); s += sw
  s += T(136, y + 21, SONG.name, { size: 11, w: 500, a: .95 }) + T(136 + tw(SONG.name, 11, 500) + 6, y + 21, '-8.9 lufs', { size: 9.5, a: .45 })
  const wx = X0 + 8, ww = RX - X0 - 16 - 96
  s += DR.wave(wx, y + 6, ww, h - 12, { a: .55 })
  const px = wx + SONG.at / SONG.secs * ww
  s += P('M' + (n(px) + .5) + ' ' + (y + 3) + 'V' + (y + h - 3), { stroke: INK, sw: 1.2 })
  s += T(RX - 66, y + 21, '1:12', { size: 9.5, a: .8, anchor: 'end' }) + key(RX - 58, y + 8, 'close', { h: 18, size: 9, pad: 7 })[0]
  s += vline(X0, y + 6, y + h - 7, .1)
  s += R(0, y + h, RX, H - FOOT_H - y - h, { fill: K0, fa: .52 })
  DR.put(s)`)
await b.sleep(150); await b.shot('ref-c.png')
await b.close()
for (const [f, name] of [['ref-a1.png', 'a1 a strip, the mix heard.png'], ['ref-a2.png', 'a2 a strip, the reference heard.png'], ['ref-b.png', 'b a card, several songs, loudness.png'], ['ref-c.png', 'c one line, the switch in it.png']]) { copyFileSync(join(here, '../../test/out', f), join(here, name)); rmSync(join(here, '../../test/out', f)) }
console.log('drawn')
