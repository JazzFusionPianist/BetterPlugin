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
const REF = { t: null, on: false, shown: true, drag: null, top: 4, gap: 6, told: '' }      // (top: room between the bars and its edge; gap: between it and track 1)
const refH = () => 2 * S.rh
const refShown = () => !!(REF.t && REF.shown) && !(typeof RTB !== 'undefined' && RTB.on)
const refY = () => TY - REF.gap - refH()
const refX0 = () => (typeof INSP === 'object' ? INSP.w || 0 : 0)                         // (where the heads begin: the inspector stands left of them)
function refTrack (name, vol) { return { id: -7, name, kind: 'ref', vol: vol == null ? 0 : vol, c: '#CFCBC2', deep: '#33312C', csel: '#E4E0D7', on: '#33312C', outline: S.tracks[0] ? S.tracks[0].outline : undefined, regs: [] } }
/* told to the engine whenever what it would play changes */
function refTell () {
  if (!NAT) return
  const r = REF.t && REF.t.regs[0], m = { key: refShown() && r && r.key ? r.key : '', start: r ? r.a - 1 : 0, vol: REF.t ? dbLin(REF.t.vol) : 1, on: REF.on && refShown() ? 1 : 0 }, sig = JSON.stringify(m)
  if (sig === REF.told) return
  REF.told = sig; NAT.call('ref', m)
}
function refHear (on) {
  on = !!on && refShown()
  if (REF.on === on) return
  REF.on = on; refTell(); uiDirty('ref')
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
  return { name: t.name, vol: t.vol, shown: REF.shown, a: r.a, b: r.b, file: r.file, sec: r.sec, srcBars: r.srcBars }
}
function refLoad (d) {
  REF.t = null; REF.on = false; REF.shown = true; REF.told = ''
  if (d && d.file && d.sec > 0) {
    REF.t = refTrack(String(d.name || 'reference'), +d.vol || 0); REF.shown = d.shown !== false
    const r = mkReg({ a: +d.a || 1, b: +d.b || ((+d.a || 1) + d.sec / SPB()), file: d.file, loop: false, rate: 1, sec: d.sec, srcBars: d.srcBars, name: String(d.name || '').toLowerCase(), wait: true, missing: true })
    REF.t.regs = [r]
    if (NAT) NAT.call('audioLoad', { project: projKey(), file: d.file }).then(f => { if (REF.t && REF.t.regs[0] === r && f && f.ok) { r.key = f.key; r.peaksAll = f.peaks; delete r.wait; delete r.missing; dirtyReg(r); refTell(); uiDirty('ref') } })
  }
  setView(true); dirtyAll(); refTell()
}
/* ── drawn ── */
function pRef () {
  if (!refShown()) return ''
  const t = REF.t, r = t.regs[0], rh = refH(), y = refY(), hx = refX0(), heard = REF.on
  let s = R(0, y, RX, rh, { fill: K0 }) + R(hx, y, HEAD_W, rh, { fill: K1 })
  /* its region, as a track's (the outline, the sound, the name) */
  if (r) {
    const L = regLook(r, t), sh = SHAPES[L.outline], gap = Math.min(lkN('reg.gap'), rh / 2 - 4), ly = y + gap, lh = rh - 2 * gap
    const xa = bx(r.a), xb = bx(r.b), x = n(xa + .5), w = n(xb - xa - 1)
    if (w >= 1.5 && xb > X0 - 2 && xa < X1 + 2) {
      const cx = Math.max(x, X0 - 256), cw = n(Math.min(x + w, X1 + 256) - cx), cid = 'rf' + (++UID)
      let q = P(shapePath(cx, ly, cw, lh, sh), { fill: L.c, fa: r.missing ? .35 : lkA('reg.fill') })
      const v0 = Math.max(1, Math.floor(X0 - 4 - x)), v1 = Math.min(Math.floor(w - 1), Math.ceil(X1 + 4 - x))
      if (!r.missing && v1 > v0) q += G(P(wavePath(r, w, ly + lh / 2, lh / 2 - 1.5, L.outline, lh, v0, v1, 'ref'), { fill: L.deep, fa: lkA('snd.c') }), `translate(${n(x + v0)} 0)`)
      const ns = lkN('name.size'), tg = fit(asGiven(r.name || t.name), Math.max(0, Math.min(w, X1 - Math.max(x, X0)) - 12), ns, +lk('name.w'))
      if (tg && lh >= ns * 2 + 1) q += R(Math.max(x, X0) + 1, ly + 1, tw(tg, ns, +lk('name.w')) + 6, ns + 2, { fill: L.c }) + T(Math.max(x, X0) + 4, ly + .5 + ns, tg, { size: ns, w: +lk('name.w'), c: L.name, a: lkA('name.c') })
      s += `<clipPath id="${cid}"><rect x="${n(X0)}" y="${n(y)}" width="${n(X1 - X0)}" height="${n(rh)}"/></clipPath>` + G(q, '', ` clip-path="url(#${cid})"`)
      s += hit(Math.max(xa, X0), ly, Math.min(xb, X1) - Math.max(xa, X0), lh, 'ref', ' data-k="reg"', 'grab')
    }
  }
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
      if (k === 'reg' && r) { REF.drag = { k: 'move', x0: p.x, a0: r.a, len: r.b - r.a, moved: false }; try { svg.setPointerCapture(e.pointerId) } catch (err) {} }
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
    const p = pt(e), r = REF.t && REF.t.regs[0]
    if (d.k === 'vol') refVolX(p.x)
    else if (d.k === 'move' && r) { if (Math.abs(p.x - d.x0) > 3) d.moved = true; if (d.moved) { const a = Math.max(1, snapPos(d.a0 - 1 + (p.x - d.x0) / PXB, e) + 1); r.a = a; r.b = a + d.len; refTell(); uiDirty('ref') } }
  }
  onUp = function (e) { if (!REF.drag) return up0(e); REF.drag = null; refTell(); uiDirty('ref') }
  function refVolX (x) { const f = clamp((x - refX0() - HEAD_FX) / HEAD_FW, 0, 1); REF.t.vol = fVol(f); refTell(); uiDirty('ref') }
  /* a new song: no reference */
  const reset0 = resetSession
  resetSession = function () { const r = reset0.apply(null, arguments); REF.t = null; REF.on = false; REF.shown = true; REF.drag = null; refTell(); return r }
  /* the engine told again whenever the room is (a project opened, the device changed) */
  if (typeof natSession === 'function') { const ns0 = natSession; natSession = async function (...a) { const r = await ns0(...a); REF.told = ''; refTell(); return r } }
  KEYS['⌥⌘KeyR'] = () => refCreate()
}
