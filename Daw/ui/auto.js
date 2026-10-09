/* ── automation: a line drawn along the song for one thing on a track ──
   A track keeps its lines by parameter: t.autos[k] = [{id, b, v}], b in bars from zero, sorted. The app plays them;
   here they are drawn, moved, and read back so the controls follow. */
const lin01 = { f: v => v / 100, inv: f => Math.round(f * 100), fmt: v => String(Math.round(v)), eng: v => v / 100 }
const sendAuto = k => ({ p: 5 + k, name: `send ${k + 1}`, f: volF, inv: fVol, fmt: v => fmtDb(v), eng: v => v, now: t => (t.sends[k] ? t.sends[k].db : -48), step: .5 })
const AUTO = {
  vol: { p: 0, name: 'volume', f: volF, inv: fVol, fmt: v => fmtDb(v), eng: v => v, now: t => t.vol, step: .5 },
  pan: { p: 1, name: 'pan', f: v => (v + 1) / 2, inv: f => { const v = f * 2 - 1; return Math.abs(v) < .04 ? 0 : Math.round(v * 64) / 64 }, fmt: v => panText(v), eng: v => v, now: t => t.pan || 0, step: 4 / 64 },
  tape: Object.assign({ p: 2, name: 'tape', now: t => patchNow(t).tape, step: 2 }, lin01),
  space: Object.assign({ p: 3, name: 'space', now: t => patchNow(t).space, step: 2 }, lin01),
  delay: Object.assign({ p: 4, name: 'delay', now: t => patchNow(t).delay, step: 2 }, lin01),
  send0: sendAuto(0), send1: sendAuto(1), send2: sendAuto(2),
}
let PID = 0
const autoPts = (t, k) => (t.autos && t.autos[k]) || []
const autoName = (t, k) => { if (/^send/.test(k)) { const b = t.sends[+k.slice(4)] && byId(t.sends[+k.slice(4)].to); return b ? `to ${b.name}` : 'send' } return AUTO[k].name }
const autoParams = t => ['vol', 'pan', 'tape', 'space', 'delay'].concat(t.sends.map((s, k) => 'send' + k))
function autoAt (t, k, pos) {
  const p = autoPts(t, k)
  if (!p.length) return null
  if (pos <= p[0].b) return p[0].v
  if (pos >= p[p.length - 1].b) return p[p.length - 1].v
  let i = 1
  while (p[i].b < pos) i++
  const a = p[i - 1], b = p[i], span = b.b - a.b
  return span > 1e-9 ? a.v + (b.v - a.v) * (pos - a.b) / span : b.v
}
/* what a control reads now: its line where there is one, else where the hand left it */
const shown = (t, k) => { const v = autoAt(t, k, curPos()); return v == null ? AUTO[k].now(t) : v }
/* the lines as the app wants them */
const autoMsg = t => Object.keys(t.autos || {}).filter(k => AUTO[k] && t.autos[k].length).map(k => ({ p: AUTO[k].p, pts: t.autos[k].map(q => [q.b, AUTO[k].eng(q.v)]) }))
/* a fader moved by hand: with a line drawn, the whole line moves with it */
function volSet (t, v) {
  const pts = autoPts(t, 'vol')
  if (!pts.length) { t.vol = v; t.ghost = null; pushTrack(t); return }
  const d = v - shown(t, 'vol')
  if (!d) return
  for (const q of pts) q.v = clamp(Math.round((q.v + d) * 10) / 10, -48, 6)
  resyncSoon(); uiDirty('lanes')
}

function toggleAuto () { S.auto = !S.auto; if (S.auto) S.flex = false; S.selP = []; S.marq = null; uiDirty('scenes', 'lanes', 'head', 'dock', 'info') }
function cycleAutoParam () {
  const t = S.tracks[S.sel], all = autoParams(t), used = all.filter(k => autoPts(t, k).length), list = used.length > 1 ? used : all
  t.ap = list[(list.indexOf(t.ap) + 1) % list.length]
  if (!S.auto) S.auto = true
  S.selP = []; uiDirty('scenes', 'lanes', 'head', 'info')
}
function openAutoMenu (t, x, y) {
  openMenu(x, y, autoParams(t).map(k => ({ t: autoName(t, k), k: autoPts(t, k).length ? String(autoPts(t, k).length) : '', v: k, on: t.ap === k })), it => { t.ap = it.v; S.selP = []; uiDirty('lanes', 'head') })
}

/* one track's line, over its lane */
const autoGeom = (t, y, rh) => { const k = AUTO[t.ap] && (!/^send/.test(t.ap) || t.sends[+t.ap.slice(4)]) ? t.ap : 'vol', A = AUTO[k], m = Math.min(6, Math.max(3, rh * .16)), ly = y + m, lh = rh - 2 * m; return { k, A, ly, lh, yOf: v => ly + lh - A.f(v) * lh, vOf: yy => A.inv(clamp((ly + lh - yy) / lh, 0, 1)) } }
function autoLane (t, y, rh) {
  const { k, A, yOf } = autoGeom(t, y, rh), pts = autoPts(t, k)
  if (!pts.length) return P(`M${X0} ${n(yOf(A.now(t)))}H${X1}`, { stroke: INK, sa: .5, dash: '5 4' })
  let d = `M${X0 - 2} ${n(yOf(pts[0].v))}`, dots = ''
  for (const q of pts) d += `L${n(bx(q.b + 1))} ${n(yOf(q.v))}`
  d += `L${n(Math.max(X1, bx(pts[pts.length - 1].b + 1)) + 2)} ${n(yOf(pts[pts.length - 1].v))}`
  for (const q of pts) {
    const x = bx(q.b + 1)
    if (x < X0 - 5 || x > X1 + 5) continue
    const on = S.selP.includes(q.id)
    dots += Cc(x, yOf(q.v), on ? 3.6 : 2.8, { fill: on ? INK : K0, stroke: INK, sw: 1.3 })
  }
  return P(d, { stroke: K0, sa: .55, sw: 3 }) + P(d, { stroke: INK, sw: 1.2 }) + dots
}
const sortPts = pts => pts.sort((a, b) => a.b - b.b)
function autoHit (t, g, p) { let best = null, bd = 7; for (const q of autoPts(t, g.k)) { const d = Math.hypot(bx(q.b + 1) - p.x, g.yOf(q.v) - p.y); if (d < bd) { bd = d; best = q } } return best }
function addPoint (t, k, b, v) {
  const pts = t.autos[k] || (t.autos[k] = [])
  const same = pts.find(q => Math.abs(q.b - b) < 1e-6)
  if (same) { same.v = v; return same }
  const q = { id: ++PID, b, v }
  pts.push(q); sortPts(pts)
  return q
}
function autoDown (e, p, tool) {
  const ti = laneAt(p.y), t = S.tracks[ti], g = autoGeom(t, rowY(ti), S.rh), before = editState(), q = autoHit(t, g, p)
  if (!isChosen(ti)) leadTrack(ti); else S.sel = ti
  t.ap = g.k
  if (tool === 'eraser') { if (q) { t.autos[g.k] = autoPts(t, g.k).filter(x => x !== q); S.selP = S.selP.filter(id => id !== q.id); commit(before) } uiDirty('head', 'dock'); return }
  const startDrag = lead => { drag = { a: 'apt', ti, k: g.k, x0: p.x, y0: p.y, lead: lead.id, before, orig: new Map(autoPts(t, g.k).filter(x => S.selP.includes(x.id)).map(x => [x.id, { b: x.b, v: x.v }])) } }
  if (q) {
    if (e.shiftKey) S.selP = S.selP.includes(q.id) ? S.selP.filter(id => id !== q.id) : S.selP.concat(q.id); else if (!S.selP.includes(q.id)) S.selP = [q.id]
    if (S.selP.includes(q.id)) startDrag(q)
  } else {
    const pts = autoPts(t, g.k), pos = clamp(barAt(p.x), 0, SONG_END), lineV = pts.length ? autoAt(t, g.k, pos) : g.A.now(t)
    if (tool === 'pencil' || Math.abs(p.y - g.yOf(lineV)) <= 7) {                        // on the line: a new point, already in the hand
      const nq = addPoint(t, g.k, clamp(snapPos(pos, e), 0, SONG_END), tool === 'pencil' ? g.vOf(p.y) : lineV)
      S.selP = [nq.id]; startDrag(nq); drag.moved = true
    } else { if (!e.shiftKey) S.selP = []; drag = { a: 'aband', x0: p.x, y0: p.y, base: S.selP.slice() }; S.band = null }
  }
  uiDirty('lanes', 'head', 'dock')
}
function autoMove (e, p) {
  const d = drag
  if (d.a === 'aband') {
    const x0 = Math.min(d.x0, p.x), x1 = Math.max(d.x0, p.x), y0 = Math.min(d.y0, p.y), y1 = Math.max(d.y0, p.y), vis = rows(), got = []
    S.band = { x0, x1, y0, y1 }
    vis.forEach((i, k) => {
      const t = S.tracks[i], y = TY + k * S.rh - VY
      if (y + S.rh < y0 || y > y1) return
      const g = autoGeom(t, y, S.rh)
      for (const q of autoPts(t, g.k)) { const x = bx(q.b + 1), yy = g.yOf(q.v); if (x >= x0 && x <= x1 && yy >= y0 - 3 && yy <= y1 + 3) got.push(q.id) }
    })
    S.selP = [...new Set(d.base.concat(got))]
    uiDirty('lanes')
    return
  }
  const t = S.tracks[d.ti], g = autoGeom(t, rowY(d.ti), S.rh), pts = autoPts(t, d.k), lead = d.orig.get(d.lead)
  const db = clamp(snapPos(lead.b + (barAt(p.x) - barAt(d.x0)), e), 0, SONG_END) - lead.b, df = -(p.y - d.y0) / g.lh
  for (const q of pts) { const o = d.orig.get(q.id); if (!o) continue; q.b = clamp(o.b + db, 0, SONG_END); q.v = g.A.inv(clamp(g.A.f(o.v) + df, 0, 1)); delete q.e }      // (a point an edit of the song's time made is whoever moves it's from then on)
  sortPts(pts)
  d.moved = true
  uiDirty('lanes', 'head', 'dock')
}
function autoDbl (e, p) {                                                                // twice anywhere on a lane: a point there
  if ((p.y - TY + VY) >= rows().length * S.rh) return
  const ti = laneAt(p.y), t = S.tracks[ti], g = autoGeom(t, rowY(ti), S.rh)
  if (autoHit(t, g, p)) return
  edit(() => { const q = addPoint(t, g.k, clamp(snapPos(barAt(p.x), e), 0, SONG_END), g.vOf(p.y)); S.selP = [q.id] })
}
/* delete: the chosen points, or every shown point under the marquee */
function autoDelete () {
  let any = false
  if (S.selP.length) { const s = new Set(S.selP); for (const t of S.tracks) for (const k in t.autos) { const n0 = t.autos[k].length; t.autos[k] = t.autos[k].filter(q => !s.has(q.id)); any = any || t.autos[k].length !== n0 } S.selP = [] }
  else if (S.marq) { const m = S.marq; for (const t of marqTracks()) { const k = t.ap, n0 = autoPts(t, k).length; if (n0) { t.autos[k] = t.autos[k].filter(q => q.b < m.a - 1e-9 || q.b > m.b + 1e-9); any = any || t.autos[k].length !== n0 } } S.marq = null }
  return any
}
function autoNudge (dir) {
  const s = new Set(S.selP)
  for (const t of S.tracks) for (const k in t.autos) { const A = AUTO[k]; if (!A) continue; for (const q of t.autos[k]) if (s.has(q.id)) q.v = A.inv(clamp(A.f(q.v + dir * A.step * (Math.abs(dir) > 1 ? 10 / 12 : 1)), 0, 1)) }
}
