/* ── a region stretched by its end: with option held, the right end pulled ──
   Sound: what is in the region plays slower or faster to fill its new length, at the pitch it had (the app renders it:
   r.fx, as when a file is fitted to the tempo — and it follows the tempo from then on). Notes: each begins and lasts so
   much later and longer; what was turned along them goes with them. Where the region begins stays where it is. On a track
   of an edit group the same is done to its companions. A song's own loop is not stretched (it is pulled out as before).
   (Read after the lanes' own hands are made, before they are put to work: see the end.) */
const STRETCH_SLOW = .25, STRETCH_FAST = 4                                               // how far from its file's own speed a sound may go (what the app's stretch takes)
const canStretch = r => !!r && (r.notes ? true : !r.loop && !!r.key && (r.sec || 0) > 0)
/* the end a press with option would take hold of: [region, track, row] — or nothing */
function stretchAt (e, p) {
  if (!e.altKey || e.shiftKey || (p.y - TY + VY) >= rowTops().all) return null
  const tool = S.tool
  if (!(tool === 'pointer' || tool === 'smart' || tool === 'flex') || S.auto) return null
  const ti = laneAt(p.y), t = S.tracks[ti]
  if (!t || t.kind !== 'audio') return null
  if (tool === 'smart') { const z = smartZone(ti, p).z; if (z === 'fi' || z === 'fo' || z === 'x') return null }      // (the corner along the top is the fade's, the foot of a join the crossfade's)
  const end = endAt(ti, p)
  if (!end || end[1] !== 'r' || !canStretch(end[0])) return null
  if (S.flex && rubatoOn(end[0]) && flexNear(end[0], p.x)) return null                      // (a pin standing there is the pin's)
  return [end[0], t, ti]
}
const stretchWas = x => ({ id: x.id, a: x.a, b: x.b, off: x.off || 0, fi: x.fi || 0, fo: x.fo || 0, rate: rateOf(x), sec: x.sec || 0, srcBars: x.srcBars || 0, fx: !!x.fx, flex: x.flex ? x.flex.map(m => Object.assign({}, m)) : null, notes: x.notes || null, ctl: x.ctl || null, rep: x.rep || 0 })
function stretchPress (e, p) {
  const at = stretchAt(e, p)
  if (!at) return false
  const [r, t, ti] = at, before = editState()
  if (S.focus !== 'lanes') { S.focus = 'lanes'; S.selM = null; uiDirty('scenes') }
  S.marq = null; S.selX = null
  if (!S.selR.includes(r.id)) S.selR = withTheirs([r.id])
  if (!isChosen(ti)) leadTrack(ti); else S.sel = ti
  drag = { a: 'stretch', id: r.id, ids: [r.id].concat(companions(r, t).map(([x]) => x).filter(canStretch).map(x => x.id)), before, was: null, g: 1, moved: false }
  uiDirty('lanes', 'head', 'dock')
  return true
}
function stretchMove (e, p) {
  const d = drag
  if (!d.out) { if (d.px != null && Math.hypot(p.x - d.px, p.y - d.py) < 3) return; d.out = true }
  if (!d.was) {                                                                          // at the first pull: an end that crossfades is taken out of its crossfade (what it shared would no longer be the same sound), then each is noted as it is
    for (const id of d.ids) { const [x, t] = regOf(id); if (!x) continue; const qb = crossBefore(x, t), qa = crossAfter(x, t); if (qb) uncross(qb, x); if (qa) uncross(x, qa) }
    d.was = d.ids.map(id => regOf(id)[0]).filter(Boolean).map(stretchWas)
  }
  const lead = d.was[0], s = snapPos(barAt(p.x), e, new Set(d.ids))
  let lo = 0, hi = Infinity
  for (const w of d.was) { const len = w.b - w.a; lo = Math.max(lo, MIN_LEN / len, w.notes ? 1 / 8 : w.rate / STRETCH_FAST); hi = Math.min(hi, w.notes ? 8 : w.rate / STRETCH_SLOW, (SONG_END + 1 - w.a) / len) }
  const g = clamp((s - (lead.a - 1)) / (lead.b - lead.a), lo, Math.max(lo, hi)), same = Math.abs(g - 1) < 1e-9
  for (const w of d.was) {
    const [x] = regOf(w.id)
    if (!x) continue
    x.b = w.a + (w.b - w.a) * g; x.off = w.off * g; x.fi = w.fi * g; x.fo = w.fo * g
    if (w.notes) {
      x.notes = same ? w.notes : w.notes.map(q => Object.assign({}, q, { t: q.t * g, d: q.d * g }, q.o == null ? {} : { o: q.o * g })); delete x._ns
      if (w.ctl) x.ctl = same ? w.ctl : w.ctl.map(c => Object.assign({}, c, { t: c.t * g }))
      if (w.rep) x.rep = w.rep * g
    } else {
      x.rate = w.rate / g; x.sec = w.sec * g; x.fx = same ? w.fx : true
      if (w.srcBars) x.srcBars = w.srcBars * g
      if (w.flex) x.flex = w.flex.map(m => Object.assign({}, m, { d: m.d * g }))
    }
    dirtyReg(x)
  }
  d.g = g; d.moved = true
  say(`stretch ${Math.round(g * 100)}%`)
  uiDirty('lanes', 'dock')                                                               // the region is seen growing and shrinking under the hand, with what is in it
}
function stretchUp () {
  const d = drag
  if (!d.moved) { uiDirty('lanes', 'dock'); return }
  if (Math.abs(d.g - 1) < 1e-9) {                                                        // pulled out and let go where it was: as before, nothing to undo
    const sel = S.selR.slice(), lead = S.sel, selT = S.selT.slice()
    restoreEdit(d.before); S.selR = sel.filter(id => regOf(id)[0]); S.sel = lead; S.selT = selT
    uiDirty(...EVERY); return
  }
  const sound = []
  for (const w of d.was) {
    const [x, t] = regOf(w.id)
    if (!x) continue
    fitFades(x, t)
    if (x.b > w.b) settle([[x, t, w.b - 1, x.b - 1]])                                    // made longer, it covers only the stretch it gained
    if (!x.notes) sound.push(x)
  }
  commit(d.before)
  if (sound.length) rewarp(sound.map(x => regOf(x.id)[0]).filter(Boolean))
}

/* ── joined to the lanes ── */
{
  const press0 = lanesPress, move0 = lanesMove, up0 = lanesUp, hover0 = lanesHover
  LANE_DRAGS.add('stretch'); EDGE_DRAGS.add('stretch')                                 // (EDGE_DRAGS: pulled to the edge of the lanes, the song goes along)
  lanesPress = function (e, p) { if (!stretchPress(e, p)) press0(e, p) }
  lanesMove = function (e, p) { if (drag && drag.a === 'stretch') { stretchMove(e, p); return } move0(e, p) }
  lanesUp = function () { if (drag && drag.a === 'stretch') { stretchUp(); return } up0() }
  lanesHover = function (e, p, el) { if (stretchAt(e, p)) { if (el.style.cursor !== 'e-resize') el.style.cursor = 'e-resize'; return } hover0(e, p, el) }
}
