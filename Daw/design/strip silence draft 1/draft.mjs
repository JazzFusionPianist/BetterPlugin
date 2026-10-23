/* strip silence draft 1: ⌃X opens strip silence in the foot's black band (where the chosen region's gain and fades are),
   and the lanes show what would stay before anything is cut — the file's whole length a dashed frame in its track's
   colour, the pieces that stay filled inside it. Return strips, esc leaves. Two ways: Logic's (each silence) and whole
   bars. Drawn with the room's own page in bauhaus; the band and the frame are this script's, nothing in ui/ is changed.
   node "design/strip silence draft 1/draft.mjs" (from Daw; GUIDE_UI=tree for the working tree) */
import { room } from '../../guide/shots.mjs'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const b = await room({ w: 1440, h: 900, dsf: 2 })
await b.sleep(900)
await b.ev(`for (const t of S.tracks) { if (t.theirs === 'jun') t.theirs = 'theo'; if (t.theirs === 'minseo') t.theirs = 'mina' } applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); setView(true); dirtyAll(); return 1`)
await b.sleep(1000)

/* a shaker on every beat from bar 5 to bar 12, four bars of nothing, then bars 17 to 20, the first of them played a
   little early */
await b.ev(`
  const spb = SPB(), sec = 24 * spb, N = Math.round(sec * 100), pk = new Array(N).fill(0), beat = 1 / BEATS()
  const hit = (bar, v) => { const i0 = Math.round(bar * spb * 100); for (let i = 0; i < 30; i++) if (i0 + i < N) pk[i0 + i] = Math.max(pk[i0 + i], (v || .55) * Math.exp(-i / 8) + .012) }
  for (let x = 4; x < 12 - 1e-9; x += beat) hit(x, (x * 4) % 2 < 1e-6 ? .6 : .38)
  hit(16 - .03 / spb, .5); for (let x = 16 + beat; x < 20 - 1e-9; x += beat) hit(x, (x * 4) % 2 < 1e-6 ? .6 : .38)
  const t = addTrack('audio', 'shaker', 2); normalizeOrder()
  t.regs.push(mkReg({ a: 1, b: 25, key: 'shaker', peaksAll: pk, loop: false, rate: 1, sec, srcBars: 24, name: 'shaker' }))
  leadTrack(S.tracks.indexOf(t)); S.selR = [t.regs[0].id]; S.focus = 'regions'; VX = 0; PXB = (W - X0 - 24) / 25; setView(true); dirtyAll(); return 1`)
await b.sleep(400)

/* the band: strip silence's values in the foot, as the region's are */
await b.ev(`
  const foot0 = SKINS.foot.poster
  SKINS.foot.poster = y0 => {
    const D = window.SD
    if (!D) return foot0(y0)
    let s = R(0, y0, W, DECK_H, { fill: BH.black }), x = 16
    const yb = y0 + DECK_H / 2 + 4
    const key = k => { s += T(x, yb - .5, k, { size: 7, w: 600, c: BH.yellow }); x += tw(k, 7, 600) + 9 }
    const val = (v, o = {}) => { s += T(x, yb, v, { size: 11, c: o.c || BH.paper, a: o.a }); x += tw(v, 11) }
    const item = (k, v) => { key(k); val(v); x += 26 }
    item('STRIP SILENCE', D.name)
    key('WAY')
    for (const [w, on] of [['each silence', !D.whole], ['whole bars', D.whole]]) {
      if (on) { s += R(x - 6, y0 + 8, tw(w, 11) + 12, DECK_H - 16, { fill: BH.yellow }); val(w, { c: BH.black }) } else val(w, { a: .42 })
      x += 14
    }
    x += 12
    item('THRESHOLD', '−40 dB')
    if (D.whole) item('EMPTY BARS', 'at least 1')
    else { item('SHORTEST', '0.30 s'); item('BEFORE', '10 ms') }
    item('AFTER', '60 ms')
    if (!D.whole) item('ZERO CROSSINGS', 'on')
    /* at the right: how many pieces, and the two ways out */
    const sw = tw('strip', 11) + 24, cw = tw('cancel', 11), rx = W - 16 - cw - 22 - sw
    s += T(rx - 22 - tw(String(D.pieces), 11), yb, String(D.pieces), { size: 11, c: BH.paper })
    s += T(rx - 22 - tw(String(D.pieces), 11) - 9 - tw('PIECES', 7, 600), yb - .5, 'PIECES', { size: 7, w: 600, c: BH.yellow })
    s += R(rx, y0 + 8, sw, DECK_H - 16, { fill: BH.red }) + T(rx + 12, yb, 'strip', { size: 11, c: BH.paper })
    s += T(W - 16 - cw, yb, 'cancel', { size: 11, c: BH.paper, a: .42 })
    return s
  }
  /* on the lanes: the file's whole length a dashed frame in its track's colour, over what stays */
  window.SDframe = (on) => {
    const svg = document.getElementById('svg'); let g = document.getElementById('sd-frame')
    if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'sd-frame'; g.setAttribute('pointer-events', 'none'); svg.appendChild(g) }
    if (!on) { g.innerHTML = ''; return }
    const i = S.tracks.findIndex(x => x.name === 'shaker'), t = S.tracks[i], c = regLook(t.regs[0], t).c, y = rowY(i) + 2, h = S.rh - 4
    g.innerHTML = '<rect x="' + (bx(1) + 1) + '" y="' + y + '" width="' + (bx(25) - bx(1) - 2) + '" height="' + h + '" fill="none" stroke="' + c + '" stroke-width="1.2" stroke-dasharray="4 3"/>'
  }
  return 1`)

const shot = async (name, clip) => { await b.ev(`flush(); return 1`); await b.sleep(350); const r = await b.send('Page.captureScreenshot', { format: 'png', clip: Object.assign({ x: 0, y: 0, width: 1440, height: 900, scale: 1 }, clip || {}) }); writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64')) }
const band = await b.ev(`const k = document.getElementById('board').getBoundingClientRect(), z = k.width / W; return { x: k.left, y: k.top + skinDeckY() * z, w: k.width, h: DECK_H * z }`)

/* 1: ⌃X, Logic's way: a piece a hit */
await b.ev(`await stripSilence({ whole: false }); window.SD = { name: 'shaker', whole: false, pieces: S.selR.length }; S.last = null; S.selR = []; SDframe(true); uiDirty('foot', 'lanes'); dirtyAll(); return 1`)
await shot('1 each silence, before return')
// (1b and 2b, the band close up, are cut from 1 and 2 afterwards)
/* 2: the way pressed to whole bars */
await b.ev(`undoEdit(); const t = S.tracks.find(x => x.name === 'shaker'); S.selR = [t.regs[0].id]; S.focus = 'regions'; await stripSilence({ whole: true }); window.SD = { name: 'shaker', whole: true, pieces: S.selR.length }; S.last = null; S.selR = []; SDframe(true); dirtyAll(); return 1`)
await shot('2 whole bars, before return')

/* 3: return: the band is the regions' again */
await b.ev(`window.SD = null; SDframe(false); const t = S.tracks.find(x => x.name === 'shaker'); S.selR = t.regs.map(r => r.id); S.last = { say: '2 pieces in whole bars' }; dirtyAll(); return 1`)
await shot('3 after return')
console.log('errors', b.errors.slice(0, 4))
await b.close()
