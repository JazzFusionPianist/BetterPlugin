/* ── the rubato panel: one region of sound, close up — as it was recorded, as it is played, and how the one became the
   other (rubato panel draft 1, approved 2026-10-17 without the words under each way of stretching) ──
   A page of the bottom panel: W, or Window › Rubato Panel. At its left, how the region's track is stretched (the four
   ways), its two sensitivities and quantize. At its right the region, fitted to the page: above, as it is played — its sound as
   the pins have it, the pins, the marks, the lines of the quantize value and how far each hit stands from its line;
   below, as it was recorded — the file itself, each mark where it is in it; between them a line from every mark below to
   where it is played above: upright where nothing moved, leaning where it did, in the track's colour. Pins are made, moved
   and let go above as on the lanes (and the sound follows the hand); the wheel goes along the region, with ⌘ closer or
   further; fit shows all of it again.
   Read after flex.js, rubato.js, roll.js, prompt.js and groups.js. */
const RUBP = { rid: null, view: null, g: null }
const RP_LP = 196, RP_RU = 20, RP_MID = 30
const rubOn = () => S.panel.on && S.panel.tab === 'rubato'
/* the region shown: the chosen region of sound, else the one shown last while it is there */
function rubReg () {
  const rs = selRegs().filter(([r]) => !r.loop && !r.notes && r.key)
  if (rs.length) { RUBP.rid = rs[0][0].id; return rs[0] }
  const q = RUBP.rid != null ? regOf(RUBP.rid) : [null, null]
  return q[0] ? q : [null, null]
}
/* bars (from zero) of the song: where a moment of the file lies as it is played, and as it was recorded (no pins: the
   file at the region's own rate) */
const rpPlayed = (r, s) => barOfD(r, sToD(r, s))
const rpRecorded = (r, s) => barOfD(r, s / rateOf(r))
/* the file's outline over bars a…b as recorded: the loudest of each step */
function rpRecPeaks (r, steps, a, b) {
  const out = new Float32Array(steps), pk = r.peaksAll
  if (!pk) return out
  const N = pk.length, whole = srcSec(r), at = bar => (bar - (r.a - 1) + (r.off || 0)) * SPB() * rateOf(r) / whole * N
  for (let i = 0; i < steps; i++) {
    const i0 = Math.floor(at(a + (b - a) * i / steps)), i1 = Math.max(i0 + 1, Math.floor(at(a + (b - a) * (i + 1) / steps)))
    let m = 0
    for (let j = Math.max(0, i0); j < i1 && j < N; j += Math.max(1, Math.floor((i1 - i0) / 48))) { const v = Math.abs(pk[j]); if (v > m) m = v }
    out[i] = m
  }
  return out
}
/* … and as it is played: through the pins (what the app renders follows the same map) */
function rpPlayPeaks (r, steps, a, b) {
  const len = r.b - r.a
  return (r.peaksAll && r.sec > 0) ? livePeaks(r, steps, (a - (r.a - 1)) / len, (b - (r.a - 1)) / len) : new Float32Array(steps)
}
const rpShape = (pk, x0, w, cy, half, norm) => {
  let up = '', dn = ''
  for (let i = 0; i < pk.length; i++) { const x = x0 + (i + .5) * w / pk.length, hh = Math.max(.4, Math.min(1, pk[i] / norm) * half); up += `${i ? 'L' : 'M'}${n(x)} ${n(cy - hh)}`; dn = `L${n(x)} ${n(cy + hh)}` + dn }
  return up + dn + 'Z'
}

function rubHead (y) {
  const [r, t] = rubReg(), by = y + 16.6
  let s = R(0, y, RX, PH, { fill: K2 }) + hline(0, RX, y, .14) + hline(0, RX, y + PH - .5, .08)
  s += R(RX / 2 - 12, y + 2, 24, 2, { rx: 1, fill: INK, fa: .2 }) + hit(0, y - 3, RX, 8, 'pgrip', '', 'ns-resize')
  const [c, cw] = cells(10, y + 4, 18, panelTabs('rubato'), { size: 9.5 })
  s += c
  if (!t) return s
  const nx = 10 + cw + 22, nm = fit(asGiven(t.name), 160, 10.5, 500)
  s += R(nx, y + 10, 6, 6, { fill: t.c }) + T(nx + 12, by, nm, { size: 10.5, w: 500 })
  let ax = nx + 12 + tw(nm, 10.5, 500) + 7
  const nmR = fit(asGiven(r.tag || r.name || 'region'), 160, 9.5)
  s += T(ax, by, nmR, { size: 9.5, a: .7 }); ax += tw(nmR, 9.5) + 8
  s += T(ax, by, `bars ${+r.a.toFixed(2)} to ${+r.b.toFixed(2)}`, { size: 9.5, a: .4 })
  const [k, w] = key(RX - 14 - 30, y + 4, 'fit', { a: 'rp', more: ' data-k="fit"' })
  return s + k
}
/* the panel's tabs, as every page of it draws them */
const panelTabs = on => [{ t: 'patch', a: 'tab-patch' }, { t: 'mixer', a: 'tab-mixer' }].concat(typeof pRoll === 'function' ? [{ t: 'notes', a: 'tab-notes' }] : [], typeof pPrompt === 'function' ? [{ t: 'prompt', a: 'tab-prompt' }] : [], [{ t: 'rubato', a: 'tab-rubato' }]).map(x => Object.assign(x, { on: x.t === on }))

function pRubato (y, h) {
  const [r, t] = rubReg()
  let s = R(0, y, RX, h, { fill: K0 })
  /* at the left: how it is stretched, how sure a mark must be, quantize */
  s += R(0, y, RP_LP, h, { fill: K1 }) + vline(RP_LP - .5, y, y + h, .08)
  if (!r) return s + T(RP_LP + (RX - RP_LP) / 2, y + h / 2, 'choose a region of sound to see it here, close up', { size: 10.5, a: .45, anchor: 'middle' })
  let ly = y + 20
  s += T(14, ly, 'stretch', { size: 9, a: .4 }); ly += 10
  for (const [v] of STRETCH) {
    const on = stretchOf(t) === v
    s += Cc(20, ly + 8, 4.5, { stroke: INK, sa: on ? .9 : .35 }) + (on ? Cc(20, ly + 8, 2.4, { fill: INK }) : '')
    s += T(32, ly + 11.5, '\u2063' + v, { size: 10.5, w: on ? 500 : 400, a: on ? 1 : .8 })
    s += hit(8, ly - 2, RP_LP - 16, 22, 'rp', ` data-k="mode" data-v="${v}"`)
    ly += 22
  }
  ly += 8; s += hline(14, RP_LP - 14, ly, .08); ly += 18
  for (const [w, k] of [['hits', 0], ['notes', 1]]) {
    const v = sensOf(t, k), rx = 58, rw = RP_LP - rx - 42, at = (rw - 2) * v / 100
    s += T(14, ly + 4, w, { size: 9.5, a: .6 }) + R(rx, ly, rw, 2, { fill: INK, fa: .14 }) + R(rx, ly, at, 2, { fill: INK, fa: .5 }) + R(rx + at, ly - 4, 2, 10, { fill: INK }) + T(RP_LP - 14, ly + 4, String(Math.round(v)), { size: 9.5, a: .72, anchor: 'end' })
    s += hit(rx - 6, ly - 9, rw + 12, 20, 'rp', ` data-k="sens" data-v="${k}" data-x="${rx}" data-w="${rw}"`, 'ew-resize')
    ly += 24
  }
  ly += 2; s += hline(14, RP_LP - 14, ly, .08); ly += 10
  { const [k1, w1] = key(14, ly, 'quantize', { a: 'qgo' }); s += k1 + menuKey(14 + w1 + 6, ly, qName(S.q), { a: 'qval' })[0] }
  ly += 26
  s += key(14, ly, 'let go of every pin', { a: 'rp', more: ' data-k="unpin"', dim: !(r.flex || []).length })[0]
  /* the region: its view in bars (fitted to it at first) */
  const x0 = RP_LP + 14, x1 = RX - 14
  if (!RUBP.view || RUBP.view.rid !== r.id) { const pad = (r.b - r.a) * .02; RUBP.view = { rid: r.id, a: r.a - 1 - pad, b: r.b - 1 + pad } }
  const V = RUBP.view, pxb = (x1 - x0) / (V.b - V.a), X = bar => x0 + (bar - V.a) * pxb
  const top = y + RP_RU, room = h - RP_RU - 10, playH = Math.round((room - RP_MID) * .56), recH = room - RP_MID - playH
  const pT = top + 14, pB = top + playH, rT = pB + RP_MID, rB = rT + recH - 14
  const L = regLook(r, t), cid = 'rp' + (++UID)
  RUBP.g = { y, h, x0, x1, pT, pB, rT, rB, pxb, V }
  s += `<clipPath id="${cid}"><rect x="${x0}" y="${n(y)}" width="${n(x1 - x0)}" height="${n(h)}"/></clipPath>`
  let g = ''
  /* the ruler: bars and beats */
  { let d = '', lab = ''
    for (let b = Math.floor(V.a); b <= V.b + 1e-9; b++) { const x = X(b); d += `M${n(x) + .5} ${y + 2}V${y + RP_RU - 2}`; lab += T(x + 3, y + 12, String(b + 1), { size: 8.5, a: .5 }); for (let k = 1; k < BEATS(); k++) { const xb = X(b + k / BEATS()); if (xb - x > 14) d += `M${n(xb) + .5} ${y + RP_RU - 6}V${y + RP_RU - 2}` } }
    s += R(x0, y, x1 - x0, RP_RU, { fill: K1 }) + G(P(d, { stroke: INK, sa: .25 }) + lab, '', ` clip-path="url(#${cid})"`) }
  /* the lines of the quantize value over what is played */
  { let d = '', bars = '', step = S.q
    while (step * pxb < 5) step *= 2
    for (let k = Math.ceil(V.a / step); k * step <= V.b; k++) { const p = k * step, x = n(X(p)) + .5; if (Math.abs(p - Math.round(p)) < 1e-6) bars += `M${x} ${pT - 6}V${pB}`; else d += `M${x} ${pT - 6}V${pB}` }
    g += P(d, { stroke: INK, sa: .07 }) + P(bars, { stroke: INK, sa: .16 }) }
  /* the two sounds */
  const xa = Math.max(x0, X(r.a - 1)), xb = Math.min(x1, X(r.b - 1)), steps = Math.max(1, Math.round(xb - xa)), norm = r.peak || (r.peak = peakOf([r.peaksAll || new Float32Array(1)]))
  const ga = V.a + (xa - x0) / pxb, gb = V.a + (xb - x0) / pxb
  g += R(xa, pT, xb - xa, pB - pT, { rx: 2, fill: L.c, fa: .16 }) + P(rpShape(rpPlayPeaks(r, steps, ga, gb), xa, xb - xa, (pT + pB) / 2, (pB - pT) / 2 - 3, norm), { fill: L.c, fa: .85 })
  const ra = Math.max(x0, X(rpRecorded(r, 0))), rb = Math.min(x1, X(rpRecorded(r, srcSec(r)))), rsteps = Math.max(1, Math.round(rb - ra))
  if (rb > ra) g += R(ra, rT, rb - ra, rB - rT, { rx: 2, fill: INK, fa: .05 }) + P(rpShape(rpRecPeaks(r, rsteps, V.a + (ra - x0) / pxb, V.a + (rb - x0) / pxb), ra, rb - ra, (rT + rB) / 2, (rB - rT) / 2 - 3, norm), { fill: INK, fa: .42 })
  /* the marks, the pins, and the lines between */
  const pins = r.flex || [], held = new Set(pins.map(m => m.s.toFixed(4)))
  let solid = '', dots = '', recSolid = '', recDots = '', still = '', moved = '', heads = '', offs = ''
  const marks = marksOf(r)
  let lastLab = -1e9
  for (const m of marks) {
    const xr = X(rpRecorded(r, m.s)), xp = X(rpPlayed(r, m.s))
    if (Math.max(xr, xp) < x0 - 40 || Math.min(xr, xp) > x1 + 40) continue
    const up = `M${n(xp)} ${pT}V${pB}`, down = `M${n(xr)} ${rT}V${rB}`
    if (!held.has(m.s.toFixed(4))) { if (m.k) { dots += up; recDots += down } else { solid += up; recSolid += down } } else recSolid += down
    const link = `M${n(xr)} ${rT - 2}L${n(xp)} ${pB + 2}`
    if (Math.abs(xp - xr) < .75) still += link; else moved += link
    /* how far a hit stands from the line of the quantize value nearest it, when it is not on it */
    if (!m.k) { const p = rpPlayed(r, m.s), q = Math.round(p / S.q) * S.q, ms = (p - q) * SPB() * 1000
      if (Math.abs(ms) >= 3 && xp - lastLab > 30 && xp > x0 && xp < x1) { offs += T(xp + 3, pB - 4, (ms > 0 ? '+' : '−') + Math.round(Math.abs(ms)), { size: 8, a: .55 }); lastLab = xp } }
  }
  for (const m of pins) { const x = X(rpPlayed(r, m.s)); heads += `M${n(x)} ${pT - 6}V${pB}M${n(x - 3.5)} ${pT - 6}H${n(x + 3.5)}L${n(x)} ${pT - 1.5}Z` }
  g += P(solid, { stroke: INK, sa: .5, sw: .9 }) + P(dots, { stroke: INK, sa: .75, sw: 1, dash: '2.5 2' }) + P(recSolid, { stroke: INK, sa: .4, sw: .9 }) + P(recDots, { stroke: INK, sa: .6, sw: 1, dash: '2.5 2' })
  g += P(still, { stroke: INK, sa: .12 }) + P(moved, { stroke: t.c, sw: 1.3 }) + P(heads, { stroke: INK, fill: INK, sw: 1.2 }) + offs
  s += G(g, '', ` clip-path="url(#${cid})"`)
  s += T(x0 + 4, pT - 8 + 2, 'as played', { size: 8.5, a: .45 }) + T(x0 + 4, rT + 11, 'as recorded', { size: 8.5, a: .45 })
  return s + hit(x0, pT - 8, x1 - x0, pB - pT + 8, 'rpl', '', S.tool === 'flex' ? 'crosshair' : 'col-resize') + hit(x0, y, x1 - x0, RP_RU, 'rpl', '', 'default') + hit(x0, rT, x1 - x0, rB - rT, 'rpl', '', 'default')
}

/* ── what the panel takes ── */
/* where things stand in it, for flex.js: a moment of what is played to a pixel, a pixel to a bar */
const RUBP_AT = { xOf: (r, d) => { const g = RUBP.g; return g ? g.x0 + (barOfD(r, d) - g.V.a) * g.pxb : 0 }, barAt: x => { const g = RUBP.g; return g ? g.V.a + (x - g.x0) / g.pxb : 0 } }
function rubToggle () { if (rubOn()) togglePanel('rubato'); else { S.panel.on = true; S.panel.tab = 'rubato'; closePicker(); setView() } uiDirty('dock') }
function rubFit () { RUBP.view = null; uiDirty('dock') }
let RP_LAST = null                                                                        // (a pin pressed twice lets go)
function rubDown (e, el, p) {
  const k = el.dataset.k, [r, t] = rubReg()
  if (!r) return
  if (el.dataset.a === 'rpl') {
    const g = RUBP.g
    if (!g || p.y > g.pB + 2 || p.y < g.pT - 8) return
    const near = (r.flex || []).find(m => Math.abs(RUBP_AT.xOf(r, m.d) - p.x) < 5), now = performance.now()
    if (near && RP_LAST && RP_LAST.rid === r.id && Math.abs(RP_LAST.s - near.s) < 1e-6 && now - RP_LAST.at < 420) { RP_LAST = null; unpin(r, near); return }
    RP_LAST = near ? { rid: r.id, s: near.s, at: now } : null                              // (by where it is: a press that moves nothing gives the pins back as copies)
    const before = editState()
    if (flexDown(e, p, r, t, S.tool === 'flex' ? 'flex' : 'pointer', before, RUBP_AT)) uiDirty('dock', 'lanes')
    return
  }
  if (k === 'mode') { const v = el.dataset.v; if (stretchOf(t) !== v) { const ts = [...new Set([t].concat(groupMates(t, 'rubato')))]; edit(() => { for (const x of ts) { if (v === 'chords') delete x.stretch; else x.stretch = v } }); rewarp(ts.flatMap(x => x.regs)) } uiDirty('dock', 'info', 'lanes') }
  else if (k === 'sens') {
    const kk = +el.dataset.v
    if (e.altKey) { edit(() => { delete t[kk ? 'ns' : 'hs'] }); sensDone(t); uiDirty('dock'); return }
    drag = { a: 'rsens', k: kk, t, x0: +el.dataset.x, w: +el.dataset.w, before: editState(), panel: true }
    rubSens(p)
  }
  else if (k === 'unpin') { if ((r.flex || []).length) { const was = r.flex; let ms = []; edit(() => { r.flex = []; ms = flexShare(r, was) }); rewarp([r].concat(ms)) } }
  else if (k === 'fit') rubFit()
}
function rubSens (p) {
  const d = drag, v = Math.round(clamp((p.x - d.x0) / (d.w - 2), 0, 1) * 100)
  if (sensOf(d.t, d.k) !== v) { d.t[d.k ? 'ns' : 'hs'] = v; d.moved = true; uiDirty('info', 'lanes', 'dock') }
}
/* the wheel over the region: along it; with ⌘ (or pinched) closer or further, about where the pointer is */
function rubWheel (e) {
  const g = RUBP.g, p = pt(e)
  if (!rubOn() || !g || p.y < g.y || p.x < g.x0 || p.x > g.x1) return false
  e.preventDefault()
  const V = RUBP.view, span = V.b - V.a
  if (e.metaKey || e.ctrlKey) { const k = Math.exp(clamp(e.deltaY, -60, 60) * .01), at = g.V.a + (p.x - g.x0) / g.pxb, ns = clamp(span * k, .05, 400); V.a = at - (at - V.a) * ns / span; V.b = V.a + ns }
  else { const dx = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / g.pxb; V.a += dx; V.b += dx }
  uiDirty('dock')
  return true
}
{
  const dock0 = PARTS.dock, down0 = onDown, wheel0 = onWheel, flush0 = flush, flexMove0 = flexMove, sensMove0 = sensMove
  PARTS.dock = function () {
    if (!rubOn() || VIEW.p <= .001) return dock0()
    const y = BY, h = S.panel.h
    MGEOM = null
    return R(0, y, RX, h + 2, { fill: K1 }) + pRubato(y + PH, h - PH) + rubHead(y)
  }
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null, a = el ? el.dataset.a : ''
    if (a === 'tab-rubato') { e.preventDefault(); if (!rubOn()) rubToggle(); return }
    if (a === 'rp' || a === 'rpl') { e.preventDefault(); rubDown(e, el, pt(e)); if (drag) { try { svg.setPointerCapture(e.pointerId) } catch (err) {} } return }
    down0(e)
  }
  /* the panel's own rail goes by its own width */
  sensMove = function (p) { if (drag && drag.panel) rubSens(p); else sensMove0(p) }
  onWheel = function (e) { if (!rubWheel(e)) wheel0(e) }
  /* a pin pulled anywhere: the panel follows it too */
  flexMove = function () { const r = flexMove0.apply(this, arguments); if (rubOn()) uiDirty('dock'); return r }
  /* whatever changes the lanes changes what the panel shows */
  flush = function () { if (rubOn() && (dirty.has('lanes') || dirty.has('info'))) dirty.add('dock'); flush0() }
  KEYS.KeyW = rubToggle
}
