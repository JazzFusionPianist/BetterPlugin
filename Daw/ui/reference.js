/* ── the reference: a song to hold the mix against ──
   His design (reference draft 2, 2026-10-20, "그렇지 그렇지", twice a track's height): a row right above track 1, its song in
   a region drawn as the tracks' are, only its edge drawn thicker. It stays there while the tracks scroll under it. Made
   from the menu bar, Track > Create Reference Track (⌥⌘R): a file is picked and brought into the project's sounds.
   It is heard only while it is the one chosen: a press anywhere in its row and the reference is heard, the room stepping
   back; a press on the room (its heads, lanes, markers or bars) and the mix is heard again. The app crosses from one to
   the other in a fiftieth of a second, and plays the reference straight out — not through the stereo out's wall, its
   fader or its limiter (Engine::setRef). It lies on the song's time, from the bar its region begins on; its region is
   pulled along to line it up. `close` puts the row away (the reference is kept: ⌥⌘R brings it back).
   Read after inspector.js. */
const REF = { t: null, on: false, shown: true, drag: null, top: 4, gap: 6, told: '', sel: new Set() }      // (top: room between the bars and its edge; gap: between it and track 1; sel: its regions chosen)
const refH = () => 50                                                                    // (twice a row as the room begins: the rows zoomed taller or shorter, it stays — his ask, 2026-10-22)
const refShown = () => !!(REF.t && REF.shown) && !(typeof RTB !== 'undefined' && RTB.on)
const refY = () => TY - REF.gap - refH()
const refX0 = () => (typeof INSP === 'object' ? INSP.w || 0 : 0)                         // (where the heads begin: the inspector stands left of them)
function refTrack (name, vol) { return { id: -7, name, kind: 'ref', vol: vol == null ? 0 : vol, c: '#CFCBC2', deep: '#33312C', csel: '#E4E0D7', on: '#33312C', outline: S.tracks[0] ? S.tracks[0].outline : undefined, regs: [] } }
/* told to the engine whenever what it would play changes */
const refMsg = () => {
  const r = REF.t && REF.t.regs[0]
  return { key: refShown() && r && r.key ? r.key : '', start: r ? r.a - 1 : 0, vol: REF.t ? dbLin(REF.t.vol) : 1, on: REF.on && refShown() ? 1 : 0,
    pieces: REF.t ? REF.t.regs.map(q => [q.a - 1, q.b - 1, q.off || 0, dbLin(q.gain || 0), q.fi || 0, q.fo || 0, q.mute ? 1 : 0]) : [] }      // (its regions as they are edited: where each lies, where in the file it begins, its gain, fades, mute — Engine::setRef)
}
function refTell () {
  if (!NAT) return
  const m = refMsg(), sig = JSON.stringify(m)
  if (sig === REF.told) return
  REF.told = sig; NAT.call('ref', m)
}
function refHear (on) {
  on = !!on && refShown()
  if (REF.on === on) return
  REF.on = on; refTell(); uiDirty('ref')
}
/* ── its regions edited with the room's tools (his ask, 2026-10-22: "레퍼런스 트랙도 도구를 이용한 변형이 되어야만 함"):
   the pointer moves one along the song or, by an end, trims it (no further than its file goes, nor over its
   neighbours); scissors cut it where pressed; the eraser takes it away; mute mutes it; join makes it one with the next
   (or the one before) where they meet as the file runs; gain pulled up or down makes it louder or softer; the fade tool
   pulls a fade in or out from the end nearer the press. Each is one step of undo; control pulls finely, as anywhere. ── */
const REF_MIN = 1 / 64                                                                    // (the shortest a region of it may be: a 64th of a bar)
const refKeep = () => REF.t ? keepRegs(REF.t.regs) : null
function refBack (regs) { if (REF.t && Array.isArray(regs)) { REF.t.regs = keepRegs(regs); REF.sel.clear(); refTell(); uiDirty('ref') } }
const refRegCopy = (r, o) => mkReg(Object.assign({ a: r.a, b: r.b, key: r.key, file: r.file, peaksAll: r.peaksAll, loop: false, rate: 1, sec: r.sec, srcBars: r.srcBars, name: r.name, off: r.off || 0, gain: r.gain || 0, fi: r.fi || 0, fo: r.fo || 0, mute: !!r.mute }, o))
function refPress (e, p, i, end) {
  const t = REF.t, r = t.regs[i], tool = S.tool, before = editState(), pos = clamp(barAt(p.x), 0, SONG_END) + 1, regs = t.regs
  if (e.shiftKey) { if (REF.sel.has(r.id)) REF.sel.delete(r.id); else REF.sel.add(r.id) } else if (!REF.sel.has(r.id)) REF.sel = new Set([r.id])
  S.focus = 'ref'; S.selR = []; S.selP = []; S.marq = null; S.selX = null; uiDirty('lanes', 'dock')
  const step = fn => { if (fn() !== false) { commit(before); refTell() } uiDirty('ref') }
  const hold = d => { REF.drag = Object.assign({ x0: p.x, y0: p.y, i, before, moved: false }, d); try { svg.setPointerCapture(e.pointerId) } catch (err) {} uiDirty('ref') }
  if (tool === 'scissors') return step(() => { const at = clamp(snapPos(pos - 1, e) + 1, r.a + REF_MIN, r.b - REF_MIN); if (at <= r.a || at >= r.b) return false; const nr = refRegCopy(r, { a: at, off: (r.off || 0) + (at - r.a), fi: 0 }); r.b = at; r.fo = 0; regs.splice(i + 1, 0, nr); REF.sel = new Set([nr.id]) })
  if (tool === 'eraser') return step(() => { regs.splice(i, 1); REF.sel.delete(r.id) })
  if (tool === 'mute') return step(() => { r.mute = !r.mute })
  if (tool === 'join') return step(() => {
    const meets = (x, y) => Math.abs(y.a - x.b) < 1e-6 && Math.abs((y.off || 0) - ((x.off || 0) + (x.b - x.a))) < 1e-6
    const nx = regs[i + 1], pv = regs[i - 1]
    if (nx && meets(r, nx)) { r.b = nx.b; r.fo = nx.fo || 0; regs.splice(i + 1, 1); return }
    if (pv && meets(pv, r)) { pv.b = r.b; pv.fo = r.fo || 0; regs.splice(i, 1); REF.sel = new Set([pv.id]); return }
    return false
  })
  if (tool === 'gain') return hold({ k: 'gain', g0: r.gain || 0 })
  if (tool === 'fade') { const d = { k: 'fade', end: pos - r.a < r.b - pos ? 'in' : 'out' }; hold(d); refPull(REF.drag, p, e); return }
  if (end && (tool === 'pointer' || tool === 'smart' || tool === 'pencil')) return hold({ k: 'trim', end, a0: r.a, b0: r.b, off0: r.off || 0, fi0: r.fi || 0, fo0: r.fo || 0 })
  if (tool === 'zoom' || tool === 'marquee') return uiDirty('ref')
  hold({ k: 'move', a0: r.a, len: r.b - r.a })
}
function refPull (d, p, e) {
  const t = REF.t, r = t && t.regs[d.i]
  if (!r) return
  if (!d.moved && Math.abs(p.x - d.x0) <= 3 && Math.abs(p.y - d.y0) <= 3 && d.k !== 'fade') return
  d.moved = true
  const regs = t.regs, pv = regs[d.i - 1], nx = regs[d.i + 1], pos = clamp(barAt(p.x), 0, SONG_END) + 1
  if (d.k === 'move') { const lo = pv ? pv.b : 1, hi = nx ? nx.a - d.len : Infinity, a = clamp(snapPos(d.a0 - 1 + (p.x - d.x0) / PXB, e) + 1, lo, Math.max(lo, hi)); r.a = a; r.b = a + d.len }
  else if (d.k === 'trim' && d.end === 'l') { const f0 = d.a0 - d.off0, a = clamp(snapPos(pos - 1, e) + 1, Math.max(f0, pv ? pv.b : 1), d.b0 - REF_MIN); r.a = a; r.off = d.off0 + (a - d.a0); r.fi = Math.min(d.fi0, r.b - r.a) }
  else if (d.k === 'trim') { const f1 = d.a0 - d.off0 + (r.srcBars || (d.b0 - d.a0)), b = clamp(snapPos(pos - 1, e) + 1, d.a0 + REF_MIN, Math.min(f1, nx ? nx.a : Infinity)); r.b = b; r.fo = Math.min(d.fo0, r.b - r.a) }
  else if (d.k === 'gain') r.gain = clamp(Math.round((d.g0 - (p.y - d.y0) * .1) * 10) / 10, -30, 12)
  else if (d.k === 'fade') { const at = clamp(snapPos(pos - 1, e) + 1, r.a, r.b); if (d.end === 'in') r.fi = clamp(at - r.a, 0, r.b - r.a - (r.fo || 0)); else r.fo = clamp(r.b - at, 0, r.b - r.a - (r.fi || 0)) }
  refTell(); uiDirty('ref')
}
/* ── made, written, read ── */
async function refCreate () {
  if (REF.t && !REF.shown) { REF.shown = true; setView(true); dirtyAll(); refTell(); return }      // (put away: it comes back as it was)
  if (!NAT) { say('the reference needs the app'); return }
  const paths = await NAT.call('importPick')
  if (!Array.isArray(paths) || !paths.length) return
  const project = projKey(), got = await NAT.call('audioBring', { project, paths: [paths[0]] }), d = Array.isArray(got) ? got[0] : null
  if (!d || !d.ok) { say(`couldn’t open ${fit(String((d && d.name) || 'the file'), 160, 9.5)}`); return }
  const f = await NAT.call('audioLoad', { project, file: d.file })
  if (!f || !f.ok) { say(`couldn’t open ${fit(String(d.name || 'the file'), 160, 9.5)}`); return }
  const name = String(d.name || 'reference').replace(/\.[^.]+$/, ''), len = f.sec / SPB()
  REF.t = refTrack(name, REF.t ? REF.t.vol : 0)
  REF.t.regs = [mkReg({ a: 1, b: 1 + len, key: f.key, file: d.file, peaksAll: f.peaks, loop: false, rate: 1, sec: f.sec, srcBars: len, name: name.toLowerCase() })]
  REF.shown = true; REF.on = false; REF.told = ''
  setView(true); dirtyAll(); refTell()
}
function refSaved () {
  const t = REF.t, r = t && t.regs[0]
  if (!r || !r.file) return undefined
  return { name: t.name, vol: t.vol, shown: REF.shown, a: r.a, b: r.b, file: r.file, sec: r.sec, srcBars: r.srcBars, regs: t.regs.map(q => ({ a: q.a, b: q.b, off: q.off || 0, gain: q.gain || 0, fi: q.fi || 0, fo: q.fo || 0, mute: !!q.mute })) }
}
function refLoad (d) {
  REF.t = null; REF.on = false; REF.shown = true; REF.told = ''
  if (d && d.file && d.sec > 0) {
    REF.t = refTrack(String(d.name || 'reference'), +d.vol || 0); REF.shown = d.shown !== false
    const one = q => mkReg({ a: +q.a || 1, b: +q.b || ((+q.a || 1) + d.sec / SPB()), off: +q.off || 0, gain: +q.gain || 0, fi: +q.fi || 0, fo: +q.fo || 0, mute: !!q.mute, file: d.file, loop: false, rate: 1, sec: d.sec, srcBars: d.srcBars, name: String(d.name || '').toLowerCase(), wait: true, missing: true })
    REF.t.regs = (Array.isArray(d.regs) && d.regs.length ? d.regs : [d]).map(one)                // (a project from before its regions could be edited: one, the file whole)
    /* its file is as many bars as its seconds are at the song's tempo: one kept before the tempo moved it along with the
       tracks (it did not, till 2026-10-22: drawn too long) is measured again here */
    { const r0 = REF.t.regs[0], k = r0 && r0.srcBars > 0 && d.sec > 0 ? d.sec / SPB() / r0.srcBars : 1; if (Math.abs(k - 1) > 1e-6) for (const r of REF.t.regs) retimeReg(r, k) }
    if (NAT) NAT.call('audioLoad', { project: projKey(), file: d.file }).then(f => { if (REF.t && f && f.ok) { for (const r of REF.t.regs) { r.key = f.key; r.peaksAll = f.peaks; delete r.wait; delete r.missing; dirtyReg(r) } refTell(); uiDirty('ref') } })
  }
  setView(true); dirtyAll(); refTell()
}
/* ── drawn ── */
function pRef () {
  if (!refShown()) return ''
  const t = REF.t, r = t.regs[0], rh = refH(), y = refY(), hx = refX0(), heard = REF.on
  let s = R(0, y, RX, rh, { fill: K0 }) + R(hx, y, HEAD_W, rh, { fill: K1 })
  /* its regions, as a track's (the outline, the sound, the name; its fades, its gain; muted, paler; chosen, framed): cut,
     trimmed, faded, made louder or softer, muted, joined and taken away with the room's tools (his ask, 2026-10-22) */
  const tool = S.tool, edges = tool === 'pointer' || tool === 'smart' || tool === 'pencil', cur = { scissors: 'crosshair', fade: 'crosshair', gain: 'ns-resize', eraser: 'default', mute: 'default', join: 'default' }[tool] || 'grab'
  t.regs.forEach((r, k) => {
    const L = regLook(r, t), sh = SHAPES[L.outline], gap = Math.min(lkN('reg.gap'), rh / 2 - 4), ly = y + gap, lh = rh - 2 * gap
    const xa = bx(r.a), xb = bx(r.b), x = n(xa + .5), w = n(xb - xa - 1), dim = r.mute ? .4 : 1
    if (!(w >= 1.5 && xb > X0 - 2 && xa < X1 + 2)) return
    const cx = Math.max(x, X0 - 256), cw = n(Math.min(x + w, X1 + 256) - cx), cid = 'rf' + (++UID)
    let q = P(shapePath(cx, ly, cw, lh, sh), { fill: L.c, fa: (r.missing ? .35 : lkA('reg.fill')) * dim })
    const v0 = Math.max(1, Math.floor(X0 - 4 - x)), v1 = Math.min(Math.floor(w - 1), Math.ceil(X1 + 4 - x))
    if (!r.missing && v1 > v0) q += G(P(wavePath(r, w, ly + lh / 2, lh / 2 - 1.5, L.outline, lh, v0, v1, 'ref'), { fill: L.deep, fa: lkA('snd.c') * dim }), `translate(${n(x + v0)} 0)`)
    /* its fades: the stretch shaded, a line from silence to full */
    if ((r.fi || 0) > 0) { const fx = n(bx(r.a + r.fi)); q += P(`M${x} ${n(ly)}H${fx}L${x} ${n(ly + lh)}Z`, { fill: K0, fa: .45 }) + P(`M${x} ${n(ly + lh)}L${fx} ${n(ly)}`, { stroke: INK, sa: .75, sw: 1 }) }
    if ((r.fo || 0) > 0) { const fx = n(bx(r.b - r.fo)), xe = n(xb - .5); q += P(`M${fx} ${n(ly)}H${xe}V${n(ly + lh)}Z`, { fill: K0, fa: .45 }) + P(`M${fx} ${n(ly)}L${xe} ${n(ly + lh)}`, { stroke: INK, sa: .75, sw: 1 }) }
    const ns = lkN('name.size'), tg = fit(asGiven(r.name || t.name), Math.max(0, Math.min(w, X1 - Math.max(x, X0)) - 12), ns, +lk('name.w'))
    if (tg && lh >= ns * 2 + 1) q += R(Math.max(x, X0) + 1, ly + 1, tw(tg, ns, +lk('name.w')) + 6, ns + 2, { fill: L.c }) + T(Math.max(x, X0) + 4, ly + .5 + ns, tg, { size: ns, w: +lk('name.w'), c: L.name, a: lkA('name.c') })
    if (r.gain) { const gw = fmtDb(r.gain) + ' db'; if (xb - 8 - tw(gw, 8.5) > Math.max(x, X0) + 4) q += T(Math.min(xb, X1) - 6, ly + lh - 5, gw, { size: 8.5, c: L.name, a: .8, anchor: 'end' }) }      // (its gain, at its foot)
    if (REF.sel.has(r.id)) q += R(x, n(ly + .5), w, n(lh - 1), { rx: 2, stroke: INK, sa: .95, sw: 1.4 })
    s += `<clipPath id="${cid}"><rect x="${n(X0)}" y="${n(y)}" width="${n(X1 - X0)}" height="${n(rh)}"/></clipPath>` + G(q, '', ` clip-path="url(#${cid})"`)
    s += hit(Math.max(xa, X0), ly, Math.min(xb, X1) - Math.max(xa, X0), lh, 'ref', ` data-k="reg" data-i="${k}"`, cur)
    if (edges) { const ew = Math.min(7, (xb - xa) / 4); if (xa >= X0 - ew) s += hit(xa, ly, ew, lh, 'ref', ` data-k="edge" data-e="l" data-i="${k}"`, 'ew-resize'); if (xb <= X1 + ew) s += hit(xb - ew, ly, ew, lh, 'ref', ` data-k="edge" data-e="r" data-i="${k}"`, 'ew-resize') }      // (its two ends taken: trimmed)
  })
  /* its head, as a track's: what it is in place of a number, its name, a key to put it away, its level */
  const by = y + rh / 2 + 3.9
  s += T(hx + 25, by - .4, 'ref', { size: 8.5, a: heard ? .95 : .55, anchor: 'end' }) + R(hx + 32, y + 6, 3, rh - 12, { fill: t.c })
  s += T(hx + 42, by, fit(asGiven(t.name), 214 - 50 - keyW('close', { size: 8.5, pad: 6 }), lkN('heads.size'), 500), { size: lkN('heads.size'), w: 500, a: heard ? 1 : .88 })
  s += key(hx + 214 - keyW('close', { size: 8.5, pad: 6 }), y + rh / 2 - 7.5, 'close', { h: 15, size: 8.5, pad: 6, a: 'ref', more: ' data-k="close"' })[0]
  s += levelBar(hx + HEAD_FX, y + rh / 2 - 1, HEAD_FW, t, t.vol).replace(/ id="mt-[^"]*"/, ' id="mt-ref"') + T(hx + HEAD_W - 8, by - .4, fmtDb(t.vol), { size: 9, a: .56, anchor: 'end' })
  s += hit(hx + HEAD_FX - 6, y + 1, HEAD_FW + 12, rh - 2, 'ref', ' data-k="vol"', 'ew-resize')
  s += vline(X0 - .5, y, y + rh, .1)
  /* the playhead goes on through it (it plays at the song's place) */
  const px = Math.round(bx(curPos() + 1)); if (px >= X0 && px <= X1) s += P(`M${px + .5} ${n(y - REF.top)}V${n(y + rh + REF.gap)}`, { stroke: lkC('play.c', INK), sw: lkN('play.w') })
  /* the edge: thicker than any row's, lit while it is what is heard */
  s += R(hx + 1, y + 1, RX - hx - 2, rh - 2, { rx: 3, stroke: INK, sa: heard ? 1 : .42, sw: 2 })      // (inside its own row: all four sides are seen)
  s = hit(hx, y, RX - hx, rh, 'ref', ' data-k="row"', 'default') + s
  /* while it is heard, the room under it steps back */
  if (heard) s += `<rect x="0" y="${n(TY)}" width="${n(RX)}" height="${n(Math.max(0, BY - TY))}" fill="${K0}" fill-opacity=".5" pointer-events="none"/>`
  return s
}
PARTS.ref = pRef
/* ── joined to the room ── */
{
  /* the rows begin under it */
  const relayout0 = relayout
  relayout = function () {
    relayout0()
    if (!refShown()) return
    TY += REF.top + refH() + REF.gap; LANES_H = Math.max(0, BY - TY)
    const set = (id, x, y, w, h) => { const r = $(id).firstChild; r.setAttribute('x', n(x)); r.setAttribute('y', n(y)); r.setAttribute('width', n(Math.max(0, w))); r.setAttribute('height', n(Math.max(0, h))) }
    set('ln', X0, TY, X1 - X0, LANES_H); set('hdc', 0, TY, HEAD_W, LANES_H)
    VY = clamp(VY, 0, maxVY())
  }
  /* drawn again with the lanes (the zoom, the scroll, the playhead going by) */
  const dirty0 = uiDirty
  uiDirty = function () { dirty0.apply(null, arguments); if (refShown()) for (const p of arguments) if (p === 'lanes' || p === 'ruler' || p === 'scenes') { dirty0('ref'); break } }
  const down0 = onDown, move0 = onMove, up0 = onUp
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null, a = el ? el.dataset.a : ''
    if (a === 'ref' && refShown()) {
      e.preventDefault()
      const k = el.dataset.k, p = pt(e), r = REF.t.regs[0]
      if (S.menu) { S.menu = null; uiDirty('menu') }
      if (k === 'close') { REF.shown = false; REF.on = false; setView(true); dirtyAll(); refTell(); return }
      refHear(true)
      if ((k === 'reg' || k === 'edge') && REF.t.regs[+el.dataset.i]) { refPress(e, p, +el.dataset.i, k === 'edge' ? el.dataset.e : null); return }
      else if (k === 'vol') { if (e.altKey) { REF.t.vol = 0; refTell() } else { REF.drag = { k: 'vol' }; refVolX(p.x); try { svg.setPointerCapture(e.pointerId) } catch (err) {} } }
      uiDirty('ref'); return
    }
    /* a press on the room: the mix is heard again */
    if (REF.on && el) { const p = pt(e); if (p.y >= MK_Y && p.y < BY && p.x >= refX0() && p.x < RX) refHear(false) }
    return down0(e)
  }
  onMove = function (e) {
    const d = REF.drag
    if (!d) return move0(e)
    const p = pt(e)
    if (d.k === 'vol') refVolX(p.x)
    else refPull(d, p, e)
  }
  onUp = function (e) { const d = REF.drag; if (!d) return up0(e); REF.drag = null; if (d.before && d.moved) commit(d.before); refTell(); uiDirty('ref') }
  /* a press elsewhere lets go of its chosen regions */
  { const down1 = onDown
    onDown = function (e) { const el = e.target && e.target.closest ? e.target.closest('[data-a]') : null; if (REF.sel.size && !(el && el.dataset.a === 'ref')) { REF.sel.clear(); if (S.focus === 'ref') S.focus = 'lanes'; uiDirty('ref') } return down1(e) } }
  /* delete: its chosen regions go (one step) */
  { const del0 = act.del
    act.del = function () { if (S.focus === 'ref' && REF.t && REF.sel.size) { const before = editState(); REF.t.regs = REF.t.regs.filter(r => !REF.sel.has(r.id)); REF.sel.clear(); commit(before); refTell(); uiDirty('ref'); return } return del0.apply(this, arguments) }
    /* the delete keys go on to whoever had them before (the patch's wall takes them for its chosen wire or thing: wall.js,
       wallorg.js) — only a reference region chosen is this one's */
    for (const code of ['Backspace', 'Delete']) { const k0 = KEYS[code]; KEYS[code] = function () { if (S.focus === 'ref' && REF.t && REF.sel.size) return act.del(); return k0.apply(this, arguments) } } }
  function refVolX (x) { const f = clamp((x - refX0() - HEAD_FX) / HEAD_FW, 0, 1); REF.t.vol = fVol(f); refTell(); uiDirty('ref') }
  /* the tempo (or the measure) moved: its file keeps its seconds, as a track's does — so its bars change (his word,
     2026-10-22: it was drawn on at the old length while the tracks beside it, and its sound, ended together) */
  const retime0 = retimeBy
  retimeBy = function (k) { const r = retime0.apply(this, arguments); if (REF.t) { for (const q of REF.t.regs) retimeReg(q, k); refTell(); uiDirty('ref') } return r }
  /* a new song: no reference */
  const reset0 = resetSession
  resetSession = function () { const r = reset0.apply(null, arguments); REF.t = null; REF.on = false; REF.shown = true; REF.drag = null; refTell(); return r }
  /* the engine told again whenever the room is (a project opened, the device changed) */
  if (typeof natSession === 'function') { const ns0 = natSession; natSession = async function (...a) { const r = await ns0(...a); REF.told = ''; refTell(); return r } }
  KEYS['⌥⌘KeyR'] = () => refCreate()
}
