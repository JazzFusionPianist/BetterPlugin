/* Slur Studio, realtime bounce, draft 2 (2026-10-16): five ways to make the scene of a realtime print, after his "뭔가
   디자인이 어설프다". Laid over the room's own page (index.html) by shots.mjs, drawn from the song's own sound. In every
   one the sound is drawn as finely behind the place being printed as ahead of it (the engine can measure what comes out
   that finely: it now does it thirty times a second, and would do it two hundred); the control bar stays at the top.
   rtdDraw(way, head) draws way 1…5 with the song at `head` (bars from zero). */
function rtdDraw (way, head) {
  const NS = 'http://www.w3.org/2000/svg'
  let g = document.getElementById('rtd-layer')
  if (!g) { g = document.createElementNS(NS, 'g'); g.id = 'rtd-layer'; svg.appendChild(g) }
  const top = BAR_H, span = 8                                                // eight bars across, the place being drawn a little right of the middle
  X0 = 0; X1 = W; PXB = W / span; VX = head - span * .55
  const hx = bx(head + 1), tracks = S.tracks.filter(t => t.kind !== 'bus')
  const ink = '#ECEAE4', K = '#0B0B0A'
  const id = 'rtd' + way
  /* a region's sound, a point to a pixel, and nothing where it is silent (so no line runs along a lane's middle) */
  const waveOf = (r, w, v0, v1, yc, hmax, half) => {
    const len = r.b - r.a, steps = Math.max(1, v1 - v0), gk = dbLin(r.gain || 0)
    let pk, norm
    if (r.loop) { const lp = LOOPS[r.buf], o = r.off || 0; norm = lp.peak || (lp.peak = peakOf(lp.ch)); pk = loopPeaks(lp, o + len * v0 / w, o + len * v1 / w, steps) } else { pk = bufPeaks(r, steps, v0 / w, v1 / w); norm = r.peak || 1 }
    let d = '', up = '', dn = '', run = 0
    const end = () => { if (run > 1) d += up + dn + 'Z'; up = ''; dn = ''; run = 0 }
    for (let i = 0; i < steps; i++) {
      const h = Math.min(1, pk[i] / norm * gk) * hmax
      if (h < .7) { end(); continue }
      const x = i + .5
      up += `${run ? 'L' : 'M'}${n(x)} ${n(yc - h)}`; dn = `L${n(x)} ${n(half ? yc : yc + h)}` + dn; run++
    }
    end()
    return d
  }
  /* the sound of a track between y and y + h: as an outline for regions, notes as strokes. f: 'full' | 'half' (on the foot) */
  const sound = (t, y, h, f = 'full', k = 1) => {
    let d = '', notes = ''
    for (const r of t.regs) {
      if (r.mute) continue
      const xa = bx(r.a), w = bx(r.b) - xa
      if (xa > W || xa + w < 0 || w < 3) continue
      const v0 = Math.max(1, Math.floor(-xa)), v1 = Math.min(Math.floor(w - 1), Math.ceil(W - xa))
      if (v1 <= v0) continue
      if (r.notes || t.midi) { notes += G(P(r.notes ? notesPath(r, y, h, v0, v1) : midiPath(r, y, h, v0, v1), { stroke: '#fff', sw: n(clamp(h / 12, 1.6, 3.4)), cap: 'round' }), `translate(${n(xa + v0)} 0)`); continue }
      d += G(P(waveOf(r, w, v0, v1, f === 'half' ? y + h : y + h / 2, (f === 'half' ? h - 1 : h / 2 - 1) * k, f === 'half'), { fill: '#fff' }), `translate(${n(xa + v0)} 0)`)
    }
    return d + notes
  }
  /* one track's sound in a colour: ahead (not yet printed) and behind, and lit where it is being drawn */
  const paint = (body, c, ahead, behind, glowC) => {
    const u = id + '-' + Math.random().toString(36).slice(2, 7)
    return `<defs><mask id="${u}-m"><g style="filter: none">${body.replace(/#fff/g, '#fff')}</g></mask></defs>`
      + R(0, top, W, H - top, { fill: c, fa: ahead, x: ` mask="url(#${u}-m)" clip-path="url(#${id}-ahead)"` })
      + R(0, top, W, H - top, { fill: c, fa: behind, x: ` mask="url(#${u}-m)" clip-path="url(#${id}-done)"` })
      + (glowC ? G(G(R(0, top, W, H - top, { fill: glowC, x: ` mask="url(#${u}-m)"` }), '', ` filter="url(#${id}-soft)" opacity=".75"`), '', ` mask="url(#${id}-fade)" clip-path="url(#${id}-done)" style="mix-blend-mode:screen"`) + R(hx - 90, top, 90, H - top, { fill: `url(#${id}-lit)`, x: ` mask="url(#${u}-m)" clip-path="url(#${id}-done)"` }) : '')
  }
  let s = `<defs>
    <clipPath id="${id}-done"><rect x="0" y="0" width="${n(hx)}" height="${H}"/></clipPath>
    <clipPath id="${id}-ahead"><rect x="${n(hx)}" y="0" width="${n(W - hx)}" height="${H}"/></clipPath>
    <clipPath id="${id}-glow"><rect x="${n(hx - 120)}" y="0" width="120" height="${H}"/></clipPath>
    <filter id="${id}-soft" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
    <linearGradient id="${id}-lit" x1="${n(hx - 90)}" x2="${n(hx)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity=".85"/></linearGradient>
    <linearGradient id="${id}-fadeg" x1="${n(hx - 150)}" x2="${n(hx)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
    <mask id="${id}-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect x="${n(hx - 150)}" y="0" width="170" height="${H}" fill="url(#${id}-fadeg)"/></mask>
    <linearGradient id="${id}-seam" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".9" stop-color="#fff" stop-opacity=".07"/><stop offset=".985" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>`
  const clock = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
  const scenes = SCENES.filter(sc => bx(sc.b) > 0 && bx(sc.a) < W), now = sceneAt(head)
  const name = 'low tide ep'

  if (way === 1) {                                                          // 1 one ink: no colour but a dot; the sound ahead faint, behind bright; a soft seam of light
    s += R(0, top, W, H - top, { fill: K })
    s += R(hx - 160, top, 160, H - top, { fill: `url(#${id}-seam)` })
    for (const sc of scenes) { const x = Math.max(16, bx(sc.a) + 10); s += T(x, top + 30, asGiven(sc.name), { size: 11, w: 500, a: sc === now ? .95 : .32 }) + P(`M${n(bx(sc.a)) + .5} ${top + 16}V${top + 40}`, { stroke: ink, sa: .18 }) }
    const y0 = top + 64, y1 = H - 40, rh = (y1 - y0) / tracks.length
    tracks.forEach((t, i) => {
      const y = y0 + i * rh
      s += Cc(18, y + rh / 2, 3, { fill: t.c })
      s += paint(sound(t, y + rh * .18, rh * .64), ink, .11, .9, '#fff')
    })
  }
  if (way === 2) {                                                          // 2 colour fields: each track a field of its colour, ahead a shadow of it, behind the colour itself, lit where drawn
    s += R(0, top, W, H - top, { fill: K })
    const y0 = top + 46, y1 = H - 24, rh = (y1 - y0) / tracks.length
    for (const sc of scenes) { const x = bx(sc.a); s += T(Math.max(14, x + 8), top + 26, asGiven(sc.name), { size: 10.5, w: 500, a: sc === now ? .92 : .3 }) }
    tracks.forEach((t, i) => {
      const y = y0 + i * rh
      s += paint(sound(t, y + 4, rh - 8), t.c, .16, 1, '#fff')
    })
  }
  if (way === 3) {                                                          // 3 skyline: each sound stands on its own line, the lines close together; a landscape that grows to the right
    s += R(0, top, W, H - top, { fill: K })
    for (const sc of scenes) { const x = bx(sc.a); s += P(`M${n(x) + .5} ${top + 18}V${H - 30}`, { stroke: ink, sa: sc === now ? .16 : .06 }) + T(Math.max(14, x + 8), top + 32, asGiven(sc.name), { size: 10.5, w: 500, a: sc === now ? .92 : .3 }) }
    const y0 = top + 70, y1 = H - 60, rh = (y1 - y0) / tracks.length
    tracks.forEach((t, i) => {
      const y = y0 + i * rh
      s += hline(0, W, y + rh - .5, .07)
      s += paint(sound(t, y + rh * .08, rh * .9, 'half'), t.c, .14, 1, '#fff')
    })
  }
  if (way === 4) {                                                          // 4 the title: the tracks close together in the middle, the part of the song large above them, the time large below
    s += R(0, top, W, H - top, { fill: K })
    const y0 = top + 210, rh = 46, y1 = y0 + rh * tracks.length
    s += T(48, top + 120, asGiven(now.name || ''), { size: 54, w: 500, a: .95 }) + T(48, top + 152, asGiven(name), { size: 15, a: .45 })
    for (const sc of scenes) { const x = bx(sc.a); if (sc !== now && x > 0) s += P(`M${n(x) + .5} ${y0 - 26}V${y1 + 10}`, { stroke: ink, sa: .1 }) + T(x + 8, y0 - 14, asGiven(sc.name), { size: 10.5, a: .32 }) }
    tracks.forEach((t, i) => {
      const y = y0 + i * rh
      s += paint(sound(t, y + 4, rh - 8), t.c, .14, 1, '#fff')
    })
    const sec = head * SPB()
    s += T(48, H - 64, clock(sec), { size: 64, w: 400, a: .95 }) + T(48 + tw(clock(sec), 64) + 18, H - 64, `of ${clock(SONG_END * SPB())}`, { size: 18, a: .4 })
    s += Cc(W - 60, H - 84, 5, { fill: REC }) + T(W - 74, H - 79, 'realtime bounce', { size: 13, a: .6, anchor: 'end' })
  }
  if (way === 5) {                                                          // 5 paper: a light ground, the sound ahead in pencil, behind in the tracks' pigments, a marker-pen of light where it is drawn
    const P0 = '#F1EDE3'
    s += R(0, top, W, H - top, { fill: P0 })
    for (const sc of scenes) { const x = bx(sc.a); s += P(`M${n(x) + .5} ${top}V${H}`, { stroke: '#1E1C18', sa: .07 }) + T(Math.max(14, x + 8), top + 26, asGiven(sc.name), { size: 10.5, w: 500, c: '#1E1C18', a: sc === now ? .9 : .35 }) }
    s += `<defs><linearGradient id="${id}-pen" x1="0" x2="1"><stop offset="0" stop-color="#FFE39A" stop-opacity="0"/><stop offset=".8" stop-color="#FFE39A" stop-opacity=".55"/><stop offset=".97" stop-color="#FFE39A" stop-opacity=".7"/><stop offset="1" stop-color="#FFE39A" stop-opacity="0"/></linearGradient></defs>` + R(hx - 110, top, 112, H - top, { fill: `url(#${id}-pen)` })
    const y0 = top + 50, y1 = H - 28, rh = (y1 - y0) / tracks.length
    tracks.forEach((t, i) => {
      const y = y0 + i * rh
      s += paint(sound(t, y + 6, rh - 12), '#1E1C18', .13, 0, null)
      s += paint(sound(t, y + 6, rh - 12), t.c, 0, 1, null)
    })
  }
  g.innerHTML = s
}
