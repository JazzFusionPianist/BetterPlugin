/* ── a realtime print: the song played through as it is printed, and the room made into a picture of it ──
   His ask (2026-10-16): beside "offline" (printed ahead of the song, as fast as the machine goes) a "realtime" bounce
   (Logic's word), played as it is printed — and while it plays the room is something an artist can film: (a) no grid,
   (b) no regions — each track's sound as it goes in, a hairline outline in its colour, (c) the sound as it comes out,
   drawn in behind the place the song has reached and glowing where it is being drawn, (d) no playhead; the buttons of
   the tracks' heads go away (his word: "트랙 헤드가 없어지는 애니메이션"), row by row. Draft: design/realtime bounce
   draft 1, his OK. For the hand-off (the mix, the stems) and for a bounce in place (mix.js).
   The app plays and writes (Engine::liveStart); the sound coming out of each track is what the engine measures of it,
   thirty times a second (dawTick). Esc (or the space bar) stops it, and nothing of it is kept. */
const RTB = { on: false, k: 0, kFrom: 0, kTo: 0, kAt: 0, kind: '', a0: 0, a1: 0, only: null, out: new Map(), view: null, raf: 0, promise: null }
const RTB_GLOW = 110                                                                   // how far behind the place being drawn the glow reaches
/* how far a head's buttons have gone, row by row (each a little after the one above it) */
const rtbHideOf = k => !RTB.on || RTB.k <= 0 ? 0 : clamp(RTB.k * 1.6 - k * .05, 0, 1)

/* opts: what the app is asked to print ({kind, a0, a1, …}); only: the ids of the regions that sound (a bounce in place)
   — the rest of the song is silent then. -> the app's answer, once it has ended */
async function rtbRun (opts, only) {
  if (!NAT || RTB.on) return null
  RTB.on = true; RTB.kind = opts.kind; RTB.a0 = opts.a0; RTB.a1 = opts.a1; RTB.only = only || null; RTB.out = new Map()
  RTB.view = { pxb: PXB, vx: VX, vy: VY, sel: S.selR.slice(), rh: S.rh, hs: S.tracks.map(t => [t, t.h]) }
  S.selR = []
  const shown = rows().length
  for (const t of S.tracks) delete t.h
  S.rh = clamp(Math.floor(LANES_H / Math.max(1, shown)), S.rh, 160); VY = 0                // the tracks fill the window's height, for as long as it plays (a picture to film)
  relayout()
  if (typeof setZoom === 'function') setZoom((X1 - X0) / ((opts.a1 - opts.a0) * 1.06), (opts.a0 + opts.a1) / 2)      // the whole range in the window, for as long as it plays
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
  await new Promise(res => setTimeout(res, 520))
  RTB.on = false; RTB.k = RTB.kTo = 0; clearInterval(RTB.raf)                        // (all the way back, however the timer was kept)
  const v = RTB.view
  if (v) { S.rh = v.rh; for (const [t, h] of v.hs) if (h) t.h = h; relayout(); setZoom(v.pxb); VX = v.vx; VY = v.vy; S.selR = v.sel.filter(id => regOf(id)[0]) }
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
    if (RTB.k !== RTB.kTo) { const x = clamp((now - RTB.kAt) / 480, 0, 1), e = 1 - Math.pow(1 - x, 3); RTB.k = RTB.kFrom + (RTB.kTo - RTB.kFrom) * e; if (x >= 1) RTB.k = RTB.kTo; uiDirty('head') }
    uiDirty('lanes', 'info'); flush()
  }, 33)
}
/* what each track gives out, as the app measures it: [bar, peak] pairs as the song goes */
if (NAT) NAT.on('dawTick', d => {
  if (!RTB.on || !d || !d.m || !d.on) return
  const bar = d.p, t = d.m.t
  if (!(bar >= RTB.a0 - .01)) return
  for (let k = 0; k + 1 < t.length; k += 2) {
    let a = RTB.out.get(t[k])
    if (!a) { a = []; RTB.out.set(t[k], a) }
    a.push(bar, t[k + 1])
  }
})

/* ── the lanes while it plays (pLanes hands them over): bare ground, the sound going in, the sound coming out ── */
function rtbLanes () {
  const root = $('g-lanes')
  let g = $('ln-rtb')
  if (!g) { g = document.createElementNS(SVG_NS, 'g'); g.id = 'ln-rtb'; $('ln-clip').appendChild(g) }
  for (const id of ['ln-grid', 'ln-rows', 'ln-over']) { const el = $(id); if (el) el.style.display = 'none' }
  const head = curPos(), hx = bx(head + 1), L = rowTops(), uid = 'rtb'
  let s = `<defs>
    <clipPath id="${uid}-done"><rect x="${X0}" y="${TY}" width="${Math.max(0, hx - X0)}" height="${LANES_H}"/></clipPath>
    <linearGradient id="${uid}-fade" x1="${hx - RTB_GLOW}" x2="${hx}" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
    <mask id="${uid}-mask"><rect x="${hx - RTB_GLOW}" y="${TY}" width="${RTB_GLOW}" height="${LANES_H}" fill="url(#${uid}-fade)"/></mask>
    <filter id="${uid}-blur" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="4.5"/><feComponentTransfer><feFuncR type="linear" slope="1.9"/><feFuncG type="linear" slope="1.9"/><feFuncB type="linear" slope="1.9"/></feComponentTransfer></filter>
    <filter id="${uid}-lift"><feComponentTransfer><feFuncR type="linear" slope="1.5" intercept=".12"/><feFuncG type="linear" slope="1.5" intercept=".12"/><feFuncB type="linear" slope="1.5" intercept=".12"/></feComponentTransfer></filter>
  </defs>`
  let ins = '', outs = ''
  L.r.forEach((i, k) => {
    const t = S.tracks[i], y = TY + L.tops[k] - VY, rh = rowH(i)
    if (y + rh <= TY || y >= BY) return
    const ly = y + 3, lh = rh - 6, yc = ly + lh / 2
    // in: its regions' sound, as an outline (a bounce in place: only the regions that are printed)
    if (t.kind !== 'bus') for (const r of t.regs) {
      if (r.mute || (RTB.only && !RTB.only.has(r.id))) continue
      const xa = bx(r.a), xb = bx(r.b), w = xb - xa
      if (xb < X0 || xa > X1 || w < 3) continue
      const v0 = Math.max(1, Math.floor(X0 - xa)), v1 = Math.min(Math.floor(w - 1), Math.ceil(X1 - xa))
      if (v1 <= v0) continue
      const at = `translate(${n(xa + v0)} 0)`
      if (r.notes || (t.midi && r.loop)) ins += G(P(r.notes ? notesPath(r, ly, lh, v0, v1) : midiPath(r, ly, lh, v0, v1), { stroke: t.c, sa: .38, sw: 1 }), at)
      else ins += G(P(wavePath(r, w, yc, lh / 2 - 1, 'plain', lh, v0, v1, 'rtb'), { stroke: t.c, sa: .42, sw: .7 }), at)
    }
    // out: what the engine measured of it, a column a point, mirrored about the lane's middle
    const a = RTB.out.get(t.id)
    if (a && a.length) {
      const cols = new Map()
      for (let j = 0; j + 1 < a.length; j += 2) { const x = Math.round(bx(a[j] + 1)); if (x < X0 - 2 || x > X1 + 2) continue; const v = a[j + 1]; if (!(cols.get(x) >= v)) cols.set(x, v) }
      const xs = [...cols.keys()].sort((p, q) => p - q)
      if (xs.length > 1) {
        const hOf = v => Math.max(.4, Math.min(1, Math.pow(v, .7)) * (lh / 2 - 1))
        let up = '', dn = ''
        xs.forEach((x, j) => { const h = hOf(cols.get(x)); up += `${j ? 'L' : 'M'}${x} ${n(yc - h)}`; dn = `L${x} ${n(yc + h)}` + dn })
        outs += P(up + dn + 'Z', { fill: t.c })
      }
    }
  })
  s += ins + G(outs, '', ` clip-path="url(#${uid}-done)"`)
  // where it is being drawn: the same sound, lit and blurred, fading out behind the place the song has reached
  s += G(G(outs, '', ` filter="url(#${uid}-blur)"`) + G(outs, '', ` filter="url(#${uid}-lift)"`), '', ` mask="url(#${uid}-mask)" style="mix-blend-mode:screen"`)
  g.innerHTML = s
  return null
}
/* the lanes as they were: what pLanes does when no realtime print is up */
function rtbLanesOff () {
  const g = $('ln-rtb')
  if (g) g.remove()
  for (const id of ['ln-grid', 'ln-rows', 'ln-over']) { const el = $(id); if (el) el.style.display = '' }
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
