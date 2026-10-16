/* Slur Studio, realtime bounce, draft 1 (2026-10-16): the room while a bounce plays in real time, for artists who film
   their screen. Laid over the room's own page (index.html) by draft.mjs, drawn from the song's own sound:
   a. no grid (and no bar lines in the bars); b. no regions: each track's sound as it goes in, a hairline outline in its
   colour; c. the sound as it comes out, drawn in behind the place the song has reached, glowing where it is being
   drawn; d. no playhead. RTB.head (bars) is where the song is; rtDraw() draws it all again. */
const RTB = { head: 13, from: 0, glowW: 110, k: 1 }
function rtDraw () {
  const room = svg, NS = 'http://www.w3.org/2000/svg'                        // (the room's own drawing: ui.js)
  let g = document.getElementById('rtb-layer')
  if (!g) { g = document.createElementNS(NS, 'g'); g.id = 'rtb-layer'; room.appendChild(g) }
  const hx = bx(RTB.head + 1), L = rowTops()
  let s = `<defs>
    <clipPath id="rt-lanes"><rect x="${X0}" y="${TY}" width="${X1 - X0}" height="${LANES_H}"/></clipPath>
    <clipPath id="rt-done"><rect x="${X0}" y="${TY}" width="${Math.max(0, hx - X0)}" height="${LANES_H}"/></clipPath>
    <clipPath id="rt-glow"><rect x="${hx - RTB.glowW}" y="${TY}" width="${RTB.glowW}" height="${LANES_H}"/></clipPath>
    <linearGradient id="rt-fade" x1="${hx - RTB.glowW}" x2="${hx}" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
    <mask id="rt-mask"><rect x="${hx - RTB.glowW}" y="${TY}" width="${RTB.glowW}" height="${LANES_H}" fill="url(#rt-fade)"/></mask>
    <filter id="rt-blur" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="4.5"/><feComponentTransfer><feFuncR type="linear" slope="1.9"/><feFuncG type="linear" slope="1.9"/><feFuncB type="linear" slope="1.9"/></feComponentTransfer></filter>
    <filter id="rt-lift"><feComponentTransfer><feFuncR type="linear" slope="1.5" intercept=".12"/><feFuncG type="linear" slope="1.5" intercept=".12"/><feFuncB type="linear" slope="1.5" intercept=".12"/></feComponentTransfer></filter>
  </defs>`
  // the lanes, bare: their ground, and nothing of the grid
  s += R(X0, TY, X1 - X0, LANES_H, { fill: K0 })
  // the bars: the numbers and their lines go; the markers stay
  s += R(X0, RU_Y, RX - X0, RU_H, { fill: K1 }) + hline(0, RX, RU_Y + RU_H - .5, .1)
  let ins = '', outs = '', glow = ''
  L.r.forEach((i, k) => {
    const t = S.tracks[i], y = TY + L.tops[k] - VY, rh = rowH(i)
    if (y + rh <= TY || y >= BY || t.kind === 'bus') return
    const ly = y + 3, lh = rh - 6, vol = dbLin(t.vol || 0)
    for (const r of t.regs) {
      if (r.mute) continue
      const xa = bx(r.a), xb = bx(r.b), w = xb - xa
      if (xb < X0 || xa > X1 || w < 4) continue
      const v0 = Math.max(1, Math.floor(X0 - xa)), v1 = Math.min(Math.floor(w - 1), Math.ceil(X1 - xa)), L2 = regLook(r, t)
      if (v1 <= v0) continue
      const at = `translate(${(xa + v0).toFixed(1)} 0)`
      if (r.notes || (t.midi && r.loop)) {
        const d = r.notes ? notesPath(r, ly, lh, v0, v1) : midiPath(r, ly, lh, v0, v1)
        ins += G(P(d, { stroke: t.c, sa: .38, sw: 1 }), at)
        const out = G(P(d, { stroke: t.c, sw: n(clamp(lh / 11, 1.6, 3.2)) }), at)
        outs += out; glow += out
      } else {
        const dIn = wavePath(r, w, ly + lh / 2, lh / 2 - 1, 'plain', lh, v0, v1, 'rtIn')
        ins += G(P(dIn, { stroke: t.c, sa: .42, sw: .7 }), at)
        const kk = Math.min(1, .55 + vol * .5), dOut = wavePath(r, w, ly + lh / 2, (lh / 2 - 1) * kk, 'plain', lh, v0, v1, 'rtOut')
        const out = G(P(dOut, { fill: t.c }), at)
        outs += out; glow += out
      }
    }
  })
  s += G(ins, '', ' clip-path="url(#rt-lanes)"')
  s += G(G(outs, '', ' clip-path="url(#rt-done)"'), '', ' clip-path="url(#rt-lanes)"')
  // where it is being drawn: the same sound, lit and blurred, fading out behind the place the song has reached
  s += G(G(G(glow, '', ' filter="url(#rt-blur)"') + G(glow, '', ' filter="url(#rt-lift)"'), '', ' mask="url(#rt-mask)" style="mix-blend-mode:screen"'), '', ' clip-path="url(#rt-done)"')
  // the tool row says what is under way, quietly (a picture of the screen stays clean)
  const y = BAR_H
  s += R(0, y, RX, TOOL_H, { fill: K1 }) + hline(0, RX, y + TOOL_H - .5, .08)
  const secs = (RTB.head - RTB.from) * SPB() + 41.7, mm = s2 => `${Math.floor(s2 / 60)}:${String(Math.floor(s2 % 60)).padStart(2, '0')}`
  s += Cc(18, y + TOOL_H / 2, 3.2, { fill: REC }) + run(30, y + TOOL_H / 2 + 3.4, [['realtime bounce', { size: 10, w: 500 }], ['the mix', { size: 10, a: .5 }], [`${mm(secs)} of 3:40`, { size: 10, a: .5 }]], 12)[0]
  s += T(RX - 16, y + TOOL_H / 2 + 3.4, 'esc stops it', { size: 9.5, a: .38, anchor: 'end' })
  g.innerHTML = s
}
