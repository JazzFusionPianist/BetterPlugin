/* ── a realtime print: the song played through as it is printed, and the room made into a picture of it ──
   His ask (2026-10-16): beside "offline" (printed ahead of the song, as fast as the machine goes) a "realtime" bounce
   (Logic's word), played as it is printed — and while it plays the room is something an artist can film. His pick of
   five (design/realtime bounce draft 2, way 1, "one ink"): no grid, no regions, no playhead; one ink and no colour but a
   dot for each track; each track's sound ahead of the place being printed faint (what goes in), behind it bright (what
   comes out, as the engine measures it two hundred times a second), lit where it is being drawn, a soft seam of light
   behind that place; the markers as words along the top. The buttons of
   the tracks' heads go away (his word: "트랙 헤드가 없어지는 애니메이션"), row by row; then the heads themselves, the tool
   row, the bars and the foot fold away — "진짜 메인 화면에 transport bar, marker랑 파형만 보이게" — and the panels close
   for as long as it plays. Draft: design/realtime bounce
   draft 1, his OK. For the hand-off (the mix, the stems) and for a bounce in place (mix.js).
   The app plays and writes (Engine::liveStart); the sound coming out of each track is what the engine measures of it
   (dawTick: m.f, two hundred peaks a second for each track, with their places). Esc (or the space bar) stops it, and
   nothing of it is kept. */
const RTB = { on: false, k: 0, kFrom: 0, kTo: 0, kAt: 0, kind: '', a0: 0, a1: 0, only: null, out: new Map(), view: null, raf: 0, promise: null }
const RTB_GLOW = 110                                                                   // how far behind the place being drawn the glow reaches
const RTB_AT = .55                                                                     // where in the window the place being drawn stays, once the window goes with it
/* how far a head's buttons have gone, row by row (each a little after the one above it) */
const rtbHideOf = k => !RTB.on || RTB.k <= 0 ? 0 : clamp(RTB.k * 2.4 - k * .05, 0, 1)
/* how far the heads, the tool row, the bars and the foot have folded away: after the buttons have gone */
const rtbFold = () => { const x = clamp((RTB.k - .3) / .7, 0, 1); return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2 }

/* opts: what the app is asked to print ({kind, a0, a1, …}); only: the ids of the regions that sound (a bounce in place)
   — the rest of the song is silent then. -> the app's answer, once it has ended */
async function rtbRun (opts, only) {
  if (!NAT || RTB.on) return null
  RTB.on = true; RTB.kind = opts.kind; RTB.a0 = opts.a0; RTB.a1 = opts.a1; RTB.only = only || null; RTB.out = new Map(); RTB.fine = false
  RTB.view = { pxb: PXB, vx: VX, vy: VY, sel: S.selR.slice(), rh: S.rh, hs: S.tracks.map(t => [t, t.h]), panel: S.panel.on, slur: !!S.slur }
  S.selR = []
  if (S.panel.on || S.slur) { S.panel.on = false; S.slur = false; setView(true) }     // the panels close for as long as it plays
  relayout()
  const span = clamp(opts.a1 - opts.a0, 2, 8)                                           // eight bars across the window once the heads have folded away (fewer for a shorter range); the window goes with the song (rtbLoop)
  if (typeof setZoom === 'function') setZoom(X1 / span)
  VX = clamp(opts.a0 - span * .04, 0, maxVX())
  rtbAnimate(1)
  const veil = document.createElement('div'); veil.id = 'rtb-veil'
  Object.assign(veil.style, { position: 'absolute', inset: '0', zIndex: 20, cursor: 'default' })
  $('room').appendChild(veil)
  addEventListener('keydown', rtbKey, true)
  RTB.promise = NAT.call('bounceLive', opts)
  natRolling(Math.max(0, opts.a0 - .25 / SPB()))                                      // (the app begins a quarter of a second before the range)
  uiDirty(...EVERY, 'play')
  rtbLoop()
  const r = await RTB.promise
  removeEventListener('keydown', rtbKey, true)
  veil.remove()
  natStopped(opts.a0)
  rtbAnimate(0)
  await new Promise(res => setTimeout(res, 950))
  RTB.on = false; RTB.k = RTB.kTo = 0; clearInterval(RTB.raf)                        // (all the way back, however the timer was kept)
  relayout()
  const v = RTB.view
  if (v) { S.rh = v.rh; for (const [t, h] of v.hs) if (h) t.h = h; if (v.panel || v.slur) { S.panel.on = v.panel; S.slur = v.slur; setView(true) } relayout(); setZoom(v.pxb); VX = v.vx; VY = v.vy; S.selR = v.sel.filter(id => regOf(id)[0]) }
  relayout(); dirtyAll(); flush()
  return r
}
const rtbStop = () => { if (RTB.on) { NAT.call('bounceLiveStop'); say('realtime bounce stopped: nothing was kept') } }
/* while it plays, the keys are its own: esc or the space bar stops it; nothing else is done to the song meanwhile */
function rtbKey (e) {
  if (!RTB.on) return
  if (e.metaKey && (e.code === 'KeyQ' || e.code === 'KeyH' || e.code === 'KeyM')) return       // (the Mac's own: quit, hide, minimize)
  e.preventDefault(); e.stopImmediatePropagation()
  if (e.code === 'Escape' || e.code === 'Space') rtbStop()
}
function rtbAnimate (to) { RTB.kFrom = RTB.k; RTB.kTo = to; RTB.kAt = performance.now() }
/* about thirty times a second while it runs: the buttons going (or coming back), and the lanes drawn again (a timer, not the
   browser's frames: a window that is covered, or not in front, still draws — and still films) */
function rtbLoop () {
  clearInterval(RTB.raf)
  RTB.raf = setInterval(() => {
    if (!RTB.on) { clearInterval(RTB.raf); return }
    const now = performance.now()
    if (RTB.k !== RTB.kTo) { const x = clamp((now - RTB.kAt) / 900, 0, 1); RTB.k = RTB.kFrom + (RTB.kTo - RTB.kFrom) * x; if (x >= 1) RTB.k = RTB.kTo; relayout(); uiDirty('head', 'scenes', 'lanes', 'info', 'cmd', 'ruler') }
    const room = (X1 - X0) / PXB, want = clamp(curPos() - room * RTB_AT, 0, maxVX())      // the place being drawn stays a little right of the middle once it gets there; the song moves under it
    if (want > VX) { VX = want; uiDirty('scenes') }
    uiDirty('lanes', 'info'); flush()
  }, 33)
}
/* what each track gives out, as the app measures it: [bar, peak] pairs as the song goes — two hundred a second (m.f),
   or thirty (m.t) from an app that does not yet keep them finely */
if (NAT) NAT.on('dawTick', d => {
  if (!RTB.on || !d || !d.m || !d.on) return
  const add = (id, bar, pk) => { if (!(bar >= RTB.a0 - .01)) return; let a = RTB.out.get(id); if (!a) { a = []; RTB.out.set(id, a) } a.push(bar, pk) }
  if (Array.isArray(d.m.f)) { for (const one of d.m.f) for (let k = 1; k + 1 < one.length; k += 2) add(one[0], one[k], one[k + 1]); RTB.fine = true }
  else if (!RTB.fine) { const t = d.m.t; for (let k = 0; k + 1 < t.length; k += 2) add(t[k], d.p, t[k + 1]) }
})

/* ── the picture while it plays (pLanes hands the lanes over): one ink on the dark ──
   Drawn in the song's own place (x: bars from the song's start times the zoom), and moved along as a whole as the window
   goes with the song; only what comes out is drawn anew, about thirty times a second. */
const RTB_TOP = 64, RTB_FOOT = 40                                                       // room above the first track (the markers) and under the last
const rtbTracks = () => rows().map(i => S.tracks[i]).filter(t => t.kind !== 'bus')
/* a region's sound in the song's place, a point to a pixel, nothing where it is silent */
function rtbWave (r, yc, hmax) {
  const xa = (r.a - 1) * PXB, w = (r.b - r.a) * PXB, steps = Math.max(1, Math.floor(w)), len = r.b - r.a, gk = dbLin(r.gain || 0)
  let pk, norm
  if (r.loop) { const lp = LOOPS && LOOPS[r.buf]; if (!lp) return ''; const o = r.off || 0; norm = lp.peak || (lp.peak = peakOf(lp.ch)); pk = loopPeaks(lp, o, o + len, steps) } else { pk = bufPeaks(r, steps, 0, 1); norm = r.peak || 1 }
  let d = '', up = '', dn = '', run = 0
  const end = () => { if (run > 1) d += up + dn + 'Z'; up = ''; dn = ''; run = 0 }
  for (let i = 0; i < steps; i++) {
    const h = Math.min(1, pk[i] / norm * gk) * hmax
    if (h < .7) { end(); continue }
    const x = n(xa + i + .5)
    up += `${run ? 'L' : 'M'}${x} ${n(yc - h)}`; dn = `L${x} ${n(yc + h)}` + dn; run++
  }
  end()
  return d
}
/* what comes out of a track, from its measured peaks, between bars b0 and b1 (song's place) */
function rtbOut (a, yc, hmax, b0, b1) {
  let d = '', up = '', dn = '', run = 0, lastX = -1e9, lastH = 0
  const end = () => { if (run > 1) d += up + dn + 'Z'; up = ''; dn = ''; run = 0 }
  for (let j = 0; j + 1 < a.length; j += 2) {
    const bar = a[j]
    if (bar < b0 || bar > b1) continue
    const x = bar * PXB, h = Math.min(1, Math.pow(a[j + 1], .6)) * hmax
    if (Math.abs(x - lastX) < .5) { if (h > lastH) lastH = h; continue }      // (several to a pixel: the highest)
    lastX = x; lastH = h
    if (h < .7) { end(); continue }
    up += `${run ? 'L' : 'M'}${n(x)} ${n(yc - h)}`; dn = `L${n(x)} ${n(yc + h)}` + dn; run++
  }
  end()
  return d
}
function rtbLanes () {
  const root = $('g-lanes')
  let g = $('ln-rtb')
  if (!g) { g = document.createElementNS(SVG_NS, 'g'); g.id = 'ln-rtb'; root.appendChild(g); RTB.built = '' }
  for (const id of ['ln-back', 'ln-clip', 'ln-edge']) { const el = $(id); if (el) el.style.display = 'none' }
  const list = rtbTracks(), top = BAR_H, y0 = top + RTB_TOP, y1 = H - RTB_FOOT, rh = (y1 - y0) / Math.max(1, list.length), hmax = rh * .32
  const head = curPos(), wx = X0 - VX * PXB, hw = (head) * PXB, hx = wx + hw              // the world's shift, the place being drawn (world), and on screen
  const key = [PXB, H, W, list.map(t => t.id + ':' + t.regs.length).join(','), RTB.only ? [...RTB.only].join(',') : ''].join('|')
  if (RTB.built !== key) {                                                              // the sound ahead, and the markers, drawn once for this zoom
    RTB.built = key
    const ink = INK
    let ahead = '', marks = ''
    list.forEach((t, k) => {
      const yc = y0 + k * rh + rh / 2
      for (const r of t.regs) {
        if (r.mute || (RTB.only && !RTB.only.has(r.id))) continue
        if (r.notes || t.midi) { ahead += P(r.notes ? notesPath(r, yc - rh * .32, rh * .64, 0, (r.b - r.a) * PXB) : midiPath(r, yc - rh * .32, rh * .64, 0, (r.b - r.a) * PXB), { stroke: ink, sw: n(clamp(rh / 12, 1.6, 3.4)), cap: 'round', x: ` transform="translate(${n((r.a - 1) * PXB)} 0)"` }); continue }
        ahead += P(rtbWave(r, yc, hmax), { fill: ink })
      }
    })
    for (const sc of SCENES) { const x = (sc.a - 1) * PXB; marks += `<g data-sc="${sc.i}">` + P(`M${n(x) + .5} ${top + 16}V${top + 40}`, { stroke: ink, sa: .18 }) + T(x + 10, top + 30, asGiven(sc.name || ''), { size: 11, w: 500 }) + '</g>' }
    g.innerHTML = `<defs>
        <clipPath id="rtb-ahead"><rect id="rtb-ahead-r" x="0" y="0" width="60000" height="${H}"/></clipPath>
        <clipPath id="rtb-done"><rect id="rtb-done-r" x="0" y="0" width="0" height="${H}"/></clipPath>
        <linearGradient id="rtb-fadeg" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
        <mask id="rtb-fade" maskUnits="userSpaceOnUse" x="-1000" y="0" width="60000" height="${H}"><rect id="rtb-fade-r" x="0" y="0" width="170" height="${H}" fill="url(#rtb-fadeg)"/></mask>
        <linearGradient id="rtb-seamg" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".9" stop-color="#fff" stop-opacity=".07"/><stop offset=".985" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <filter id="rtb-soft" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="5"/><feComponentTransfer><feFuncR type="linear" slope="1.6"/><feFuncG type="linear" slope="1.6"/><feFuncB type="linear" slope="1.6"/></feComponentTransfer></filter>
        <filter id="rtb-lift"><feComponentTransfer><feFuncR type="linear" slope="1.6"/><feFuncG type="linear" slope="1.6"/><feFuncB type="linear" slope="1.6"/><feFuncA type="linear" slope="1.15"/></feComponentTransfer></filter>
      </defs>
      <rect x="0" y="${top}" width="${W}" height="${H - top}" fill="${K0}"/>
      <rect id="rtb-seam" x="0" y="${top}" width="160" height="${H - top}" fill="url(#rtb-seamg)"/>
      <g id="rtb-world">
        <g id="rtb-marks">${marks}</g>
        <g clip-path="url(#rtb-ahead)" opacity=".11">${ahead}</g>
        <g clip-path="url(#rtb-done)"><g id="rtb-out"></g></g>
        <g clip-path="url(#rtb-done)" style="mix-blend-mode:screen"><g mask="url(#rtb-fade)"><use href="#rtb-out" filter="url(#rtb-soft)" opacity=".75"/><use href="#rtb-out" filter="url(#rtb-lift)"/></g></g>
      </g>
      <g id="rtb-dots"></g>`
  }
  // each frame: the world moved along; where it has been drawn; the sound that came out
  const set = (id, a, v) => { const el = $(id); if (el && el.getAttribute(a) !== String(v)) el.setAttribute(a, v) }
  set('rtb-world', 'transform', `translate(${n(wx)} 0)`)
  set('rtb-ahead-r', 'x', n(hw)); set('rtb-done-r', 'x', n(Math.max(0, VX - 1) * PXB)); set('rtb-done-r', 'width', n(Math.max(0, hw - Math.max(0, VX - 1) * PXB)))
  set('rtb-fade-r', 'x', n(hw - 150)); const fg = $('rtb-fadeg'); if (fg) { fg.setAttribute('x1', n(hw - 150)); fg.setAttribute('x2', n(hw)) }
  set('rtb-seam', 'x', n(hx - 160))
  const now = sceneAt(head).i
  for (const el of $('rtb-marks').children) { const on = +el.dataset.sc === now; el.style.opacity = on ? '1' : '.34' }
  const b0 = VX - .5, b1 = head + .05
  let out = '', dots = ''
  list.forEach((t, k) => {
    const yc = y0 + k * rh + rh / 2, a = RTB.out.get(t.id)
    if (a && a.length) out += P(rtbOut(a, yc, hmax, b0, b1), { fill: INK, fa: .9 })
    dots += Cc(X0 + 18, yc, 3, { fill: t.c })
  })
  $('rtb-out').innerHTML = out
  $('rtb-dots').innerHTML = dots
  return null
}
/* the lanes as they were: what pLanes does when no realtime print is up */
function rtbLanesOff () {
  const g = $('ln-rtb')
  if (g) g.remove()
  for (const id of ['ln-back', 'ln-clip', 'ln-edge', 'ln-grid', 'ln-rows', 'ln-over']) { const el = $(id); if (el) el.style.display = '' }
}
/* the tool row says what is under way, quietly (a picture of the screen stays clean) */
function rtbTool (y) {
  const secs = Math.max(0, (curPos() - RTB.a0) * SPB()), all = (RTB.a1 - RTB.a0) * SPB(), mm = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`
  const what = RTB.kind === 'mix' ? 'the mix' : RTB.kind === 'place' ? 'in place' : 'stems'
  let s = R(0, y, RX, TOOL_H, { fill: K1 }) + hline(0, RX, y + TOOL_H - .5, .08)
  s += Cc(18, y + TOOL_H / 2, 3.2, { fill: REC }) + run(30, y + TOOL_H / 2 + 3.4, [['realtime bounce', { size: 10, w: 500 }], [what, { size: 10, a: .5 }], [`${mm(Math.min(secs, all))} of ${mm(all)}`, { size: 10, a: .5 }]], 12)[0]
  s += T(RX - 16, y + TOOL_H / 2 + 3.4, 'esc stops it', { size: 9.5, a: .38, anchor: 'end' })
  return s
}
