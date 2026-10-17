/* Slur Studio, settings > plug-ins, draft 2 (2026-10-17): his "ㅇㅇ바꿀 수 있게 하자" — the kind the room reads from a
   plug-in's name can be changed by hand. Laid over the settings page itself (ui/plugpage.js, the plug-ins of a Mac like
   his) by shots.mjs. Two ways to change it, both in the picture: the kind pressed on a row opens the list of kinds
   (frame 1), or the row is dragged onto a kind down the left (frame 2). A kind set by hand has a dot before the row
   (as a quality changed in display does); pressed, the dot gives the kind back to what the room reads (frame 3).
   kdDraw(frame) draws frame 1…3. */
const KD_SET = {}                                                          // name → the kind set by hand
const kdRoom = plugCat
plugCat = p => KD_SET[p.name] || kdRoom(p)
function kdRowAt (name) {                                                  // where a row of the chosen group stands (body units)
  const PR = DISP_W - SIDE - 28, colW = (PR - PX0 - 24) / 2, i = PG.rows.findIndex(p => p.name === name)
  if (i < 0) return null
  const line = Math.floor(i / (PG_PER * 2)) * PG_PER + i % PG_PER - PG.rs
  return { x: PX0 + (i % (PG_PER * 2) >= PG_PER ? colW + 24 : 0), y: 108 + line * 22, w: colW, p: PG.rows[i] }
}
function kdGroupAt (g) { const lines = pgGroups(pgPool()); const i = lines.indexOf(g); return i < 0 ? null : { x: PTX, y: 130 + (i - PG.gs) * 21 } }
function kdDraw (frame) {
  const svg = document.getElementById('svg')
  let s = ''
  /* every row whose kind was set by hand: a dot before it */
  const dots = () => { let d = ''; for (const p of PG.rows) if (KD_SET[p.name]) { const r = kdRowAt(p.name); if (r && r.y >= 108) d += Cc(r.x - 10, r.y + 9, 2.5, { fill: INK, fa: .8 }) } return d }
  if (frame === 1) {                                                       // the kind on a row, pressed: the list of kinds
    const r = kdRowAt('Serum 2 FX')
    s += R(r.x - 6, r.y - 1, r.w + 12, 22, { rx: 2, fill: INK, fa: .06 })
    const [mk, mw] = menuKey(0, 0, 'other', { h: 18, size: 9.5 }), kx = r.x + r.w - 34 - mw
    s += R(kx - 6, r.y, mw + 12, 20, { fill: K1 }) + G(menuKey(kx, r.y + 1, 'other', { h: 18, size: 9.5 })[0], '')
    const items = PLUG_CATS, rowH = 20, w = 168, h = items.length * rowH + 12, x = kx + mw - w, y = r.y + 24
    s += R(x, y, w, h, { rx: 3, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 3, stroke: INK, sa: .28 })
    items.forEach((t, i) => {
      const on = t === 'other', ry = y + 6 + i * rowH, hover = t === 'modulation'
      if (on) s += R(x + 5, ry, w - 10, rowH, { rx: 2, fill: INK })
      else if (hover) s += R(x + 5, ry, w - 10, rowH, { rx: 2, fill: INK, fa: .1 })
      s += T(x + 13, ry + 13.6, t, { size: 10.5, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .84 })
      if (on) s += T(x + w - 13, ry + 13.6, 'as the room reads it', { size: 9, c: K1, a: .55, anchor: 'end' })
    })
  }
  if (frame === 2) {                                                       // a row dragged onto a kind down the left
    const r = kdRowAt('UAD Sphere Mic Collection'), g = kdGroupAt('channel')
    s += R(r.x - 6, r.y - 1, r.w + 12, 22, { rx: 2, fill: K1, fa: .62 })      // (where it was: faint while it is carried)
    s += R(g.x + .5, g.y + .5, PTW - 1, 19, { rx: 2, stroke: INK, sa: .7 }) + R(g.x, g.y, PTW, 20, { rx: 2, fill: INK, fa: .08 })
    const px = g.x + 136, py = g.y + 11, gx = px + 12, gy = py + 14, nm = 'Sphere Mic Collection', gw = tw(nm, 10.5) + 40      // the pointer over the kind, the row carried under it
    s += R(gx + 2, gy + 3, gw, 22, { rx: 3, fill: '#000', fa: .35 }) + R(gx, gy, gw, 22, { rx: 3, fill: K2 }) + R(gx + .5, gy + .5, gw - 1, 21, { rx: 3, stroke: INK, sa: .3 })
    s += pgTick(gx + 8, gy + 5, true) + T(gx + 28, gy + 15, nm, { size: 10.5, a: .92 })
    s += P(`M${px} ${py}l0 12l3.2 -3l2.4 5.2l2 -.9l-2.4 -5.1l4.3 -.3z`, { fill: INK, stroke: K1, sw: .8 })
  }
  svg.insertAdjacentHTML('beforeend', G(dots() + s, `translate(${SIDE} 0)`))
}
