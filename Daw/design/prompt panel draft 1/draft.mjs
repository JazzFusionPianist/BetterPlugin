// node "design/prompt panel draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: three ways for the
// prompt (the command line) to be seen better, now that it is a thin line at the very foot of the window and easy to miss.
//   a  the foot made a prompt: twice as tall, a field with a frame, the words larger
//   b  a page of its own in the panel: prompt beside patch, mixer and notes — the field at its top, what was said under it
//   c  over the room: / brings a field up in the middle of the window, what can follow under it; esc or a done line puts it away
// Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)

/* the drawing kit of the draft: the line in cells as the app draws it (who, what, how much, the act lit), a caret, a list */
await b.ev(`if (typeof START !== 'undefined') START.on = false
  window.DR = {
    line (x, y, h, size, parts, typed) {
      let s = '', cx = x
      for (const p of parts) {
        const w = Math.round(tw(p.t, size, p.on ? 500 : 400) + size * 1.6)
        s += R(cx + .5, y + .5, w - 1, h - 1, { rx: 2, stroke: p.c || INK, sa: p.c ? .9 : .3, fill: p.on ? INK : 'none' }) + T(cx + w / 2, y + h / 2 + size * .36, p.t, { size, w: p.on ? 500 : 400, c: p.on ? K0 : p.c || INK, a: p.on ? 1 : .9, anchor: 'middle' })
        cx += w + 5
      }
      if (typed != null) { s += T(cx + 3, y + h / 2 + size * .36, asGiven(typed), { size, a: .96 }); cx += 3 + (typed ? tw(asGiven(typed), size) + 2 : 0) }
      s += R(cx + 1, y + 4, 1.2, h - 8, { fill: INK })
      return s
    },
    list (x, y, w, rows, size) {
      let s = ''
      rows.forEach((r, i) => {
        const ry = y + i * (size + 13)
        if (i === 0) s += R(x, ry, w, size + 13, { fill: INK, fa: .07 })
        s += T(x + 12, ry + size + 2.5, r[0], { size, w: i === 0 ? 500 : 400, a: i === 0 ? 1 : .82 }) + T(x + w - 12, ry + size + 2.5, r[1], { size: size - 1.5, a: .42, anchor: 'end' })
      })
      return s
    },
    put (svg) { let g = document.getElementById('draft'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'draft'; document.getElementById('svg').appendChild(g) } g.innerHTML = svg }
  }
  const LINE = [{ t: 'kick' }, { t: 'volume' }, { t: '5 ~ 7', c: '#D8B24A' }]
  window.DR.LINE = LINE
  window.DR.NEXT = [['-3 db', 'how much'], ['to -12 db', 'to a level'], ['lower gradually', 'along the stretch'], ['raise gradually', 'along the stretch'], ['mute', 'silent there']]
  S.sel = 0; setView(true); dirtyAll(); flush()`)

/* a: the foot is the prompt — 44 tall, a framed field at the left, the machine's state at the right as before */
await b.ev(`$('cmd').style.display = 'none'
  const y = H - 46, fy = y + 8, fw = 760
  let s = R(0, y, W, 46, { fill: K2 }) + hline(0, W, y, .16)
  s += R(12.5, fy + .5, fw, 29, { rx: 3, fill: K0, stroke: INK, sa: .34 })
  s += P('M26 ' + (fy + 9.5) + 'L31 ' + (fy + 15) + 'L26 ' + (fy + 20.5), { stroke: INK, sa: .9, sw: 1.4, cap: 'round' })
  s += DR.line(42, fy + 5, 20, 11.5, DR.LINE, '')
  let x = W - 10
  const ko = { h: 20, size: 9.5, pad: 9 }, kw = keyW('keys', ko); x -= kw; s += key(x, y + 13, 'keys', ko)[0]
  for (const [l, v] of [['saved', '1:31'], ['buffer', '512'], ['rate', '48k 32 bit'], ['cpu', '1%']]) { x -= 14; s += vline(x, y + 14, y + 32, .1); x -= 14; x -= tw(v, 10.5); s += T(x, y + 27, v, { size: 10.5, a: .8 }); x -= 6 + tw(l, 9.5); s += T(x, y + 27, l, { size: 9.5, a: .42 }) }
  /* what can follow, over the room, from where the typing is */
  const lx = 40, lw = 260, rows = DR.NEXT, lh = rows.length * 24 + 10, ly = y - lh - 6
  s += R(lx, ly, lw, lh, { rx: 3, fill: K1, stroke: INK, sa: .2 }) + DR.list(lx, ly + 5, lw, rows, 11)
  DR.put(s)`)
await b.sleep(150); await b.shot('prompt-a.png')

/* b: a page of its own in the panel */
await b.ev(`$('cmd').style.display = 'none'; DR.put('')
  S.panel.on = true; S.panel.tab = 'patch'; S.panel.h = 300; setView(true); dirtyAll(); flush()
  const top = H - FOOT_H - S.panel.h, y = top + PH, h = S.panel.h - PH
  let s = R(0, top, W, S.panel.h, { fill: K1 }) + R(0, top, W, PH, { fill: K2 }) + hline(0, W, top, .14) + hline(0, W, top + PH - .5, .08)
  s += cells(10, top + 4, 18, [{ t: 'patch' }, { t: 'mixer' }, { t: 'notes' }, { t: 'prompt', on: true }], { size: 9.5, widths: [48, 48, 48, 52] })[0]
  /* the field across the top of the page */
  const fx = 20, fy = y + 18, fw = W - 40
  s += R(fx + .5, fy + .5, fw, 37, { rx: 3, fill: K0, stroke: INK, sa: .38 })
  s += P('M' + (fx + 14) + ' ' + (fy + 13) + 'L' + (fx + 20) + ' ' + (fy + 19) + 'L' + (fx + 14) + ' ' + (fy + 25), { stroke: INK, sa: .9, sw: 1.5, cap: 'round' })
  s += DR.line(fx + 32, fy + 8, 22, 12.5, DR.LINE, '')
  /* under it at the left: what can follow; at the right: what was said, and what came of it */
  const cy = fy + 52, lw = 300
  s += T(fx, cy + 10, 'what can follow', { size: 9.5, a: .4 }) + DR.list(fx - 12, cy + 18, lw, DR.NEXT, 11)
  s += vline(fx + lw + 20, cy, y + h - 14, .08)
  const hx = fx + lw + 44
  s += T(hx, cy + 10, 'said', { size: 9.5, a: .4 })
  const said = [['1:29', 'snare -2 db', 'snare at -7.0 db'], ['1:27', 'bars 17 ~ 24 cycle', 'the cycle is 17 to 25'], ['1:22', 'hum: tape 40', 'tape on hum, 40'], ['1:18', 'keys mute 9 ~ 12', '4 regions muted'], ['1:15', 'drums punchier', 'kick +1.5 db, snare tape 20, hats -1 db']]
  said.forEach((r, i) => { const ry = cy + 34 + i * 26; s += T(hx, ry, r[0], { size: 9.5, a: .36 }) + T(hx + 48, ry, asGiven(r[1]), { size: 11, w: 500, a: .9 }) + T(hx + 260, ry, asGiven(r[2]), { size: 10, a: .55 }) })
  /* the foot keeps the machine's state only */
  s += R(0, H - FOOT_H, W, FOOT_H, { fill: K2 }) + hline(0, W, H - FOOT_H, .1)
  let x = W - 10
  const ko = { h: 16, size: 9, pad: 8 }, kw = keyW('keys', ko); x -= kw; s += key(x, H - FOOT_H + 3, 'keys', ko)[0]
  for (const [l, v] of [['saved', '1:31'], ['buffer', '512'], ['rate', '48k 32 bit'], ['cpu', '1%']]) { x -= 12; s += vline(x, H - FOOT_H + 6, H - 6, .1); x -= 12; x -= tw(v, 9.5); s += T(x, H - 7.4, v, { size: 9.5, a: .8 }); x -= 5 + tw(l, 9.5); s += T(x, H - 7.4, l, { size: 9.5, a: .42 }) }
  DR.put(s)`)
await b.sleep(150); await b.shot('prompt-b.png')

/* c: over the room, brought up by / */
await b.ev(`S.panel.on = false; setView(true); dirtyAll(); flush(); $('cmd').style.display = 'none'
  const bw = 640, bx0 = Math.round((RX - bw) / 2), by0 = 250, fh = 46, rows = DR.NEXT, bh = fh + rows.length * 26 + 22
  let s = R(0, BAR_H, W, H - BAR_H, { fill: '#000', fa: .36 })
  s += R(bx0 - 1, by0 - 1, bw + 2, bh + 2, { rx: 6, fill: '#000', fa: .4 }) + R(bx0 + .5, by0 + .5, bw, bh, { rx: 5, fill: K1, stroke: INK, sa: .26 })
  s += P('M' + (bx0 + 18) + ' ' + (by0 + 17) + 'L' + (bx0 + 25) + ' ' + (by0 + 23) + 'L' + (bx0 + 18) + ' ' + (by0 + 29), { stroke: INK, sa: .9, sw: 1.6, cap: 'round' })
  s += DR.line(bx0 + 38, by0 + 11, 24, 13, DR.LINE, '') + hline(bx0, bx0 + bw, by0 + fh, .1)
  s += DR.list(bx0 + 6, by0 + fh + 8, bw - 12, rows.map(r => r), 11.5)
  /* the foot keeps the machine's state only */
  s += R(0, H - FOOT_H, 300, FOOT_H, { fill: K2 }) + P('M13 ' + (H - FOOT_H + 7.5) + 'L17 ' + (H - FOOT_H + 11) + 'L13 ' + (H - FOOT_H + 14.5), { stroke: INK, sa: .5, sw: 1.2, cap: 'round' }) + T(26, H - 7.4, '/', { size: 9.5, a: .4 })
  DR.put(s)`)
await b.sleep(150); await b.shot('prompt-c.png')
await b.close()
for (const [f, name] of [['prompt-a.png', 'a the foot made a prompt.png'], ['prompt-b.png', 'b a page of its own in the panel.png'], ['prompt-c.png', 'c over the room, brought up by slash.png']]) { copyFileSync(join(here, '../../test/out', f), join(here, name)); rmSync(join(here, '../../test/out', f)) }
console.log('drawn')
