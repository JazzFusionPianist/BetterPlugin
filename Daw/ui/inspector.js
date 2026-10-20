/* ── the inspector: the chosen track's channel strip, at the left of the heads ──
   His pick of pan draft 1 (i-c), 2026-10-20, with his changes: only the track's strip (not the stereo out's), its pan a
   knob, its fader and meters drawn heavier. It stands from the markers down to the panel, and the heads and lanes move
   over by its width. View > Inspector shows or hides it; the app remembers which (a browser page without the app begins
   without it). Read after ui.js, mix.js and project.js. */
const INSP = { on: (() => { try { const v = localStorage.getItem('slur.inspector'); return v == null ? !!NAT : v === '1' } catch (e) { return !!NAT } })(), w: 0, geom: null, hold: new Map() }
const INSP_W = GUT + WSTRIP + 12
const inspShown = () => INSP.on && !(typeof SKIN === 'object' && SKIN.right) && !(typeof RTB !== 'undefined' && RTB.on)
function toggleInspector () {
  INSP.on = !INSP.on
  try { localStorage.setItem('slur.inspector', INSP.on ? '1' : '0') } catch (e) {}
  setView(true); dirtyAll()
  if (typeof menusTick === 'function') menusTick()
}
function pInsp () {
  if (!INSP.w) { INSP.geom = null; return '' }
  const t = S.tracks[S.sel], y = MK_Y, h = BY - MK_Y
  let s = R(0, y, INSP.w, h, { fill: K1 }) + vline(INSP.w - .5, y, BY, .12)
  if (!t) return s
  const sy = y + 6, sh = h - 10, x1 = GUT
  INSP.geom = stripGeom(sy, sh, true, true)
  s += stripGutter(0, GUT, sy, sh, true, true)
  /* the strip as the mixer draws it, its pan a knob; its meters and fader are the inspector's own (another strip of the
     same track may be on the screen at once) */
  const own = strip(x1, sy, WSTRIP, sh, t, S.sel, { wide: true, sel: true, knob: true }).replace(/id="m([shk])-/g, 'id="im$1-').replace(/data-a="mvol"/g, 'data-a="ivol"')
  return s + R(x1, sy, WSTRIP, sh, { fill: INK, fa: .05 }) + own
}
PARTS.insp = pInsp
{
  /* the heads and lanes move over by its width */
  const relayout0 = relayout
  relayout = function () {
    relayout0()
    INSP.w = inspShown() ? INSP_W : 0
    if (!INSP.w) return
    X0 += INSP.w
    const set = (id, x, y, w, h) => { const r = $(id).firstChild; r.setAttribute('x', n(x)); r.setAttribute('y', n(y)); r.setAttribute('width', n(Math.max(0, w))); r.setAttribute('height', n(Math.max(0, h))) }
    set('tl', X0, MK_Y, X1 - X0, BY - MK_Y); set('ln', X0, TY, X1 - X0, LANES_H)
    $('g-head').setAttribute('transform', `translate(${INSP.w} 0)`)
    PXB = Math.max(PXB, fitPXB()); VX = clamp(VX, 0, maxVX())
  }
  /* what the heads draw is redrawn here too: the chosen track, its level, its pan, its name */
  const dirty0 = uiDirty
  uiDirty = function () { dirty0.apply(null, arguments); if (INSP.w) for (const p of arguments) if (p === 'head' || p === 'dock' || p === 'info') { dirty0('insp'); break } }
  /* a head's level is read from where the pointer is: the heads stand further right */
  const vol0 = setVolX
  setVolX = function (i, x, e) { return vol0(i, x - INSP.w, e) }
  /* a track's name typed over its head */
  const rename0 = startRename
  startRename = function (what, i, at) { const r = rename0(what, i, at); if (what === 'track' && INSP.w) { const el = $('rename'); el.style.left = (parseFloat(el.style.left) + INSP.w) + 'px' } return r }
  /* its fader pulled: as a mixer's, on its own scale */
  const down0 = onDown
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null
    if (el && el.dataset.a === 'ivol' && INSP.geom) {
      e.preventDefault()
      const i = +el.dataset.i, tr = S.tracks[i], p = pt(e)
      if (e.altKey) { for (const x of groupOf(i, 'volume')) if (!autoPts(x, 'vol').length) { x.vol = 0; x.ghost = null } applyAll(); uiDirty('head', 'dock'); return }
      tr.ghost = null
      drag = { a: 'mvol', i, ly: p.y, f0: volF(shown(tr, 'vol')), acc: 0, v0: tr.vol, others: others(i, 'vol'), g: INSP.geom, before: autoPts(tr, 'vol').length ? editState() : null }
      try { svg.setPointerCapture(e.pointerId) } catch (err) {}
      return
    }
    const r = down0(e)
    if (drag && drag.a === 'vol' && drag.lx != null && INSP.w) drag.lx -= INSP.w      // (a level moved from where it stands, with shift or as a theme's knob: its start read as setVolX reads the pointer)
    return r
  }
  /* its meters, thirty times a second */
  const meters0 = drawMeters
  drawMeters = function () {
    const r = meters0.apply(null, arguments), G0 = INSP.geom, t = S.tracks[S.sel]
    if (!G0 || !t || !INSP.w) return r
    const v = METERS.now.get(t.id) || 0, f = volF(Math.min(6, linDb(v))), f6 = volF(-6), hold = Math.max(f, (INSP.hold.get(t.id) || 0) - .008)
    INSP.hold.set(t.id, hold)
    for (let c = 0; c < 2; c++) {
      const b = $(`ims-${t.id}-${c}`), hh = $(`imh-${t.id}-${c}`), k = $(`imk-${t.id}-${c}`)
      if (!b) break
      const lo = Math.min(f, f6)
      b.setAttribute('y', n(G0.fb - G0.fh * lo)); b.setAttribute('height', n(G0.fh * lo))
      hh.setAttribute('y', n(G0.fb - G0.fh * f)); hh.setAttribute('height', n(Math.max(0, G0.fh * (f - f6)))); hh.setAttribute('fill', v > 1 ? REC : SOLO)
      k.setAttribute('y', n(G0.fb - G0.fh * hold - 1)); k.setAttribute('fill-opacity', hold > .005 ? .75 : 0)
    }
    return r
  }
}
