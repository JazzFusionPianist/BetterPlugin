/* ── automation: a line drawn along the song for one thing on a track ──
   A track keeps its lines by parameter: t.autos[k] = [{id, b, v}], b in bars from zero, sorted. The app plays them;
   here they are drawn, moved, and read back so the controls follow. */
const lin01 = { f: v => v / 100, inv: f => Math.round(f * 100), fmt: v => String(Math.round(v)), eng: v => v / 100 }
const sendAuto = k => ({ p: 5 + k, name: `send ${k + 1}`, f: volF, inv: fVol, fmt: v => fmtDb(v), eng: v => v, now: t => (t.sends[k] ? t.sends[k].db : -48), step: .5 })
const AUTO_OWN = {
  vol: { p: 0, name: 'volume', f: volF, inv: fVol, fmt: v => fmtDb(v), eng: v => v, now: t => t.vol, step: .5 },
  pan: { p: 1, name: 'pan', f: v => (v + 1) / 2, inv: f => { const v = f * 2 - 1; return Math.abs(v) < .04 ? 0 : Math.round(v * 64) / 64 }, fmt: v => panText(v), eng: v => v, now: t => t.pan || 0, step: 4 / 64 },
  tape: Object.assign({ p: 2, name: 'tape', now: t => patchNow(t).tape, step: 2 }, lin01),
  space: Object.assign({ p: 3, name: 'space', now: t => patchNow(t).space, step: 2 }, lin01),
  delay: Object.assign({ p: 4, name: 'delay', now: t => patchNow(t).delay, step: 2 }, lin01),
  send0: sendAuto(0), send1: sendAuto(1), send2: sendAuto(2),
}
/* a line for one of a plug-in's own controls is kept as fx<n>.<i>: the plug-in by the number it keeps on its track
   (ins.n, written into the project), the control by its place among the plug-in's controls. It counts from 0 to 1, as
   the plug-in does, and reads in hundredths. (What kind of line a key stands for is asked of AUTO, as for the others.) */
const FX_KEY = /^fx(\d+)\.(\d+)$/
const fxIns = (t, k) => { const m = FX_KEY.exec(k); return m ? (t.inserts || []).find(x => x.n === +m[1] && !x.out) || null : null }
const fxIndex = k => +FX_KEY.exec(k)[2]
const fxAuto = k => ({ p: 100, fx: true, name: 'control', f: v => clamp(v, 0, 1), inv: f => Math.round(clamp(f, 0, 1) * 1000) / 1000, fmt: v => String(Math.round(v * 100)), eng: v => v, now: t => { const ins = fxIns(t, k), v = ins && ins.pv ? ins.pv[fxIndex(k)] : null; return v == null ? .5 : v }, step: .01 })
/* a macro's line is kept as mac<id> (ui/macro.js): the line is the macro's, and goes to whatever control of a plug-in on the
   track the macro is wired to (it is told to the engine as that control's line); a macro not wired keeps its line and
   moves nothing */
const MAC_KEY = /^mac(\d+)$/
const macroOf = (t, k) => { const m = MAC_KEY.exec(k); return m ? (t.macros || []).find(x => x.id === +m[1]) || null : null }
const macroIns = (t, m) => m && m.to && m.to.n != null ? (t.inserts || []).find(x => x.n === m.to.n && !x.out) || null : null      // (a macro wired to a print has no plug-in: macro.js macroNode)
const macAuto = k => ({ p: 100, mac: true, name: 'macro', f: v => clamp(v, 0, 1), inv: f => Math.round(clamp(f, 0, 1) * 1000) / 1000, fmt: v => String(Math.round(v * 100)), eng: v => v, now: t => { const m = macroOf(t, k); return m ? m.v : .5 }, step: .01 })
const AUTO = new Proxy(AUTO_OWN, { get: (own, k) => own[k] || (typeof k === 'string' && FX_KEY.test(k) ? (own[k] = fxAuto(k)) : typeof k === 'string' && MAC_KEY.test(k) ? (own[k] = macAuto(k)) : undefined) })
/* the line a track shows: the one asked for, while what it is a line for is still there (a send, a plug-in); else its volume */
const apOf = t => AUTO[t.ap] && (!/^send/.test(t.ap) || t.sends[+t.ap.slice(4)]) && (!FX_KEY.test(t.ap) || fxIns(t, t.ap)) && (!MAC_KEY.test(t.ap) || macroOf(t, t.ap)) ? t.ap : 'vol'
let PID = 0
const autoPts = (t, k) => (t.autos && t.autos[k]) || []
const autoName = (t, k) => { if (MAC_KEY.test(k)) { const m = macroOf(t, k); return m ? m.name : 'macro' } if (FX_KEY.test(k)) { const ins = fxIns(t, k), i = fxIndex(k); return ins ? `${ins.name.toLowerCase()} ${(ins.pn && ins.pn[i]) || 'control ' + (i + 1)}` : 'plug-in' } if (/^send/.test(k)) { const b = t.sends[+k.slice(4)] && byId(t.sends[+k.slice(4)].to); return b ? `to ${b.name}` : 'send' } return AUTO[k].name }
const autoParams = t => ['vol', 'pan', 'tape', 'space', 'delay'].concat((t.macros || []).map(m => 'mac' + m.id), t.sends.map((s, k) => 'send' + k), Object.keys(t.autos || {}).filter(k => FX_KEY.test(k) && t.autos[k].length && fxIns(t, k)))
/* the way from one point to the next may bend (the command line can ask for it: "exponentially"): a point's c is how the
   stretch that begins at it goes — none straight, 'exp' slow then fast, 'log' fast then slow, 's' slow at both ends.
   Drawn and played as it bends: the app is told the bent stretch as a run of points. */
const AUTO_CURVES = { exp: x => (Math.exp(4 * x) - 1) / (Math.exp(4) - 1), log: x => 1 - (Math.exp(4 * (1 - x)) - 1) / (Math.exp(4) - 1), s: x => x * x * (3 - 2 * x) }
const curveAt = (c, x) => (AUTO_CURVES[c] || (y => y))(clamp(x, 0, 1))
/* a line as straight pieces: a bent stretch is laid out in small steps (for the app, and to be drawn) */
function autoBent (pts) {
  const out = []
  pts.forEach((q, i) => {
    out.push([q.b, q.v])
    const nx = pts[i + 1]
    if (!q.c || !AUTO_CURVES[q.c] || !nx || nx.b - q.b < 1e-6) return
    const steps = clamp(Math.round((nx.b - q.b) * 16), 8, 96)
    for (let k = 1; k < steps; k++) { const x = k / steps; out.push([q.b + (nx.b - q.b) * x, q.v + (nx.v - q.v) * curveAt(q.c, x)]) }
  })
  return out
}
function autoAt (t, k, pos) {
  const p = autoPts(t, k)
  if (!p.length) return null
  if (pos <= p[0].b) return p[0].v
  if (pos >= p[p.length - 1].b) return p[p.length - 1].v
  let i = 1
  while (p[i].b < pos) i++
  const a = p[i - 1], b = p[i], span = b.b - a.b
  return span > 1e-9 ? a.v + (b.v - a.v) * curveAt(a.c, (pos - a.b) / span) : b.v
}
/* what a control reads now: its line where there is one, else where the hand left it */
const shown = (t, k) => { const v = autoAt(t, k, curPos()); return v == null ? AUTO[k].now(t) : v }
/* the lines as the app wants them */
const autoMsg = t => Object.keys(t.autos || {}).filter(k => AUTO[k] && t.autos[k].length && (!FX_KEY.test(k) || (fxIns(t, k) || {}).uid) && (!MAC_KEY.test(k) || (macroIns(t, macroOf(t, k)) || {}).uid || (typeof macTable === 'function' && macTable(t, macroOf(t, k))))).map(k => Object.assign({ p: AUTO[k].p, pts: autoBent(t.autos[k]).map(([b, v]) => [b, AUTO[k].eng(v)]) }, FX_KEY.test(k) ? { uid: fxIns(t, k).uid, i: fxIndex(k) } : MAC_KEY.test(k) ? (macroIns(t, macroOf(t, k)) ? { uid: macroIns(t, macroOf(t, k)).uid, i: macroOf(t, k).to.i } : Object.assign({ p: 101, node: macroOf(t, k).to.node }, macTable(t, macroOf(t, k)))) : {}))      // (a macro wired to a print: its hand's line, as a table along the macro — Engine kAutoPrint)
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
/* the list of what a track's line can be for. Each plug-in on it offers the control last moved in its own window: a line
   is asked for by moving the thing itself, and then choosing it here */
async function openAutoMenu (t, x, y) {
  const items = autoParams(t).map(k => ({ t: MAC_KEY.test(k) ? asGiven(autoName(t, k)) : autoName(t, k), k: MAC_KEY.test(k) ? (macroIns(t, macroOf(t, k)) ? asGiven(macroOf(t, k).to.plug) : 'not wired') : autoPts(t, k).length ? String(autoPts(t, k).length) : '', v: k, on: apOf(t) === k }))
  { const m = items.findIndex(it => MAC_KEY.test(it.v)); if (m > 0) items[m].sep = true }       // (the macros, by their names, under the track's own lines)
  if (NAT) for (const ins of t.inserts || []) {
    if (ins.out || !ins.uid) continue
    const r = await NAT.call('touched', { track: t.id, uid: ins.uid })
    if (!r || !(r.index >= 0)) continue
    if (!ins.n) ins.n = 1 + Math.max(0, ...t.inserts.map(q => q.n || 0))
    const k = `fx${ins.n}.${r.index}`
    ins.pn = ins.pn || {}; ins.pv = ins.pv || {}
    ins.pn[r.index] = String(r.name || '').toLowerCase().slice(0, 40); ins.pv[r.index] = clamp(+r.value || 0, 0, 1)
    if (!items.some(it => it.v === k)) items.push({ t: autoName(t, k), v: k, on: apOf(t) === k })
  }
  const first = items.findIndex(it => FX_KEY.test(it.v))
  if (first > 0) items[first].sep = true
  openMenu(x, y, items, it => { t.ap = it.v; S.selP = []; uiDirty('lanes', 'head') })
}

/* a bus and a stack hold no regions of their own, and their line is their lane: it is always up, in their own colour, and
   it can be taken hold of without the lines being shown. Then it is their volume (what the head beside it shows); with
   the lines shown it is the one asked for, as on any track. */
const lineOwn = t => !!t && (t.kind === 'bus' || t.kind === 'stack')
const shownKey = t => S.auto ? apOf(t) : 'vol'
/* one track's line, over its lane */
const autoGeom = (t, y, rh) => { const k = shownKey(t), A = AUTO[k], m = Math.min(6, Math.max(3, rh * .16)), ly = y + m, lh = rh - 2 * m; return { k, A, ly, lh, yOf: v => ly + lh - A.f(v) * lh, vOf: yy => A.inv(clamp((ly + lh - yy) / lh, 0, 1)) } }
function autoLane (t, y, rh, xEnd = X1) {
  const { k, A, yOf } = autoGeom(t, y, rh), pts = autoPts(t, k), own = lineOwn(t), ink = own ? t.c : INK, pale = own && !heard(t) ? .45 : 1, xe = Math.min(xEnd, X1)
  if (!pts.length) return own ? (xe > X0 ? P(`M${X0} ${n(yOf(A.now(t))) + .5}H${n(xe)}`, { stroke: ink, sa: OWN_LINE * pale }) : '') : ''      // (no line until one is made: his ask, 2026-10-19 — the dashed one is gone)
  let d = `M${X0 - 2} ${n(yOf(pts[0].v))}`, dots = ''
  for (const [b, v] of autoBent(pts)) d += `L${n(bx(b + 1))} ${n(yOf(v))}`
  d += `L${n(own ? Math.max(xe, bx(pts[pts.length - 1].b + 1)) : Math.max(X1, bx(pts[pts.length - 1].b + 1)) + 2)} ${n(yOf(pts[pts.length - 1].v))}`
  /* each point, small, and its value beside it (his ask, 2026-10-19: how far a point takes it could not be seen) — said
     where there is room for it: a word that would run into the last one is left out */
  let words = '', free = -Infinity
  const top = y + 2, bottom = y + rh - 2
  for (const q of pts) {
    const x = bx(q.b + 1)
    if (x < X0 - 5 || x > X1 + 5) continue
    const on = S.selP.includes(q.id), py = yOf(q.v)
    dots += Cc(x, py, on ? 2.6 : 2, { fill: on ? ink : K0, stroke: ink, sw: 1 })
    const said = A.fmt(q.v), w = tw(said, 8.5)
    if (rh >= 18 && x + 5 >= free && x + 5 + w < X1) { words += T(x + 5, clamp(py + 3, top + 7, bottom), said, { size: 8.5, c: ink, a: on ? .95 : .62 }); free = x + 5 + w + 6 }      // (right of it, at its height)
  }
  return P(d, { stroke: K0, sa: .55, sw: 2.2 }) + P(d, { stroke: ink, sa: pale, sw: .9 }) + dots + words
}
const OWN_LINE = .75
/* is the pointer on such a row's own line, or on one of its points (the lines not shown) */
function onOwnLine (ti, p) {
  const t = S.tracks[ti]
  if (!lineOwn(t)) return false
  const g = autoGeom(t, rowY(ti), rowH(ti)), pts = autoPts(t, g.k)
  return !!autoHit(t, g, p) || Math.abs(p.y - g.yOf(pts.length ? autoAt(t, g.k, clamp(barAt(p.x), 0, SONG_END)) : g.A.now(t))) <= 7
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
  const ti = laneAt(p.y), t = S.tracks[ti], g = autoGeom(t, rowY(ti), rowH(ti)), before = editState(), q = autoHit(t, g, p)
  if (!isChosen(ti)) leadTrack(ti); else S.sel = ti
  if (S.auto) t.ap = g.k
  if (tool === 'eraser') { if (q) { t.autos[g.k] = autoPts(t, g.k).filter(x => x !== q); S.selP = S.selP.filter(id => id !== q.id); commit(before) } uiDirty('head', 'dock'); return }
  const startDrag = lead => { drag = { a: 'apt', ti, k: g.k, x0: p.x, y0: p.y, lead: lead.id, before, orig: new Map(autoPts(t, g.k).filter(x => S.selP.includes(x.id)).map(x => [x.id, { b: x.b, v: x.v }])) } }
  if (q) {
    if (e.shiftKey) S.selP = S.selP.includes(q.id) ? S.selP.filter(id => id !== q.id) : S.selP.concat(q.id); else if (!S.selP.includes(q.id)) S.selP = [q.id]
    if (S.selP.includes(q.id)) startDrag(q)
  } else {
    const pts = autoPts(t, g.k), pos = clamp(barAt(p.x), 0, SONG_END), lineV = pts.length ? autoAt(t, g.k, pos) : g.A.now(t)
    if (tool === 'pencil') {                                                             // the pencil: a new point, already in the hand
      const nq = addPoint(t, g.k, clamp(snapPos(pos, e), 0, SONG_END), g.vOf(p.y))
      S.selP = [nq.id]; startDrag(nq); drag.moved = true
    } else if (Math.abs(p.y - g.yOf(lineV)) <= 7) {
      /* on the line, away from its points. Let go where it was pressed: a point there. Pulled: that stretch of the line
         goes up or down whole (autoSeg says which stretch), and nothing of it moves along the song. */
      drag = { a: 'apt', seg: true, ti, k: g.k, x0: p.x, y0: p.y, pos, at: clamp(snapPos(pos, e), 0, SONG_END), lineV, before, lead: null, orig: new Map() }
    } else if (!pts.length) {                                                            // a lane with no line yet: pressed, a point there, at the height pressed (the line begins with it)
      const nq = addPoint(t, g.k, clamp(snapPos(pos, e), 0, SONG_END), g.vOf(p.y))
      S.selP = [nq.id]; S.marq = null; startDrag(nq); drag.moved = true
    } else { if (!e.shiftKey) S.selP = []; S.marq = null; drag = { a: 'aband', x0: p.x, y0: p.y, base: S.selP.slice() }; S.band = null }      // (a band of points: the marquee that was up is let go — a delete is the points', not its sound)
  }
  uiDirty('lanes', 'head', 'dock')
}
function autoMove (e, p) {
  const d = drag
  if (d.a === 'aband') {
    const x0 = Math.min(d.x0, p.x), x1 = Math.max(d.x0, p.x), y0 = Math.min(d.y0, p.y), y1 = Math.max(d.y0, p.y), vis = rows(), got = []
    S.band = { x0, x1, y0, y1 }
    vis.forEach((i, k) => {
      const t = S.tracks[i], y = rowY(i), rh = rowH(i)
      if (y + rh < y0 || y > y1) return
      const g = autoGeom(t, y, rh)
      for (const q of autoPts(t, g.k)) { const x = bx(q.b + 1), yy = g.yOf(q.v); if (x >= x0 && x <= x1 && yy >= y0 - 3 && yy <= y1 + 3) got.push(q.id) }
    })
    S.selP = [...new Set(d.base.concat(got))]
    uiDirty('lanes')
    return
  }
  const t = S.tracks[d.ti], g = autoGeom(t, rowY(d.ti), rowH(d.ti))
  if (d.seg && d.lead == null) { if (Math.hypot(p.x - d.x0, p.y - d.y0) < 3) return; autoSeg(d, t) }      // a stretch of the line taken hold of: it is pulled only once the hand has moved
  const pts = autoPts(t, d.k), lead = d.orig.get(d.lead)
  const db = d.seg ? 0 : clamp(snapPos(lead.b + (barAt(p.x) - barAt(d.x0)), e), 0, SONG_END) - lead.b, df = -(p.y - d.y0) / g.lh
  const lv = g.A.inv(clamp(g.A.f(lead.v) + df, 0, 1)), dv = lv - lead.v                   // (the hand moves the first by so much of the lane; all the others go by as much of their own unit — a stretch of a volume line goes down by the same db all along)
  for (const q of pts) { const o = d.orig.get(q.id); if (!o) continue; q.b = clamp(o.b + db, 0, SONG_END); q.v = o === lead ? lv : g.A.inv(clamp(g.A.f(o.v + dv), 0, 1)); delete q.e }      // (a point an edit of the song's time made is whoever moves it's from then on)
  sortPts(pts)
  d.moved = true
  uiDirty('lanes', 'head', 'dock')
}
/* The stretch of a line that is pulled when the line itself is taken hold of.
   Inside a marquee that lies on that track: the stretch under the marquee — a point is set at each of its two ends to hold
   the line where it was outside, and one just inside each end that goes with the pull (so the line steps at the marquee's
   edges, as in Logic), and every point between them goes too.
   Otherwise: from the point before the press to the point after it — those two move (one alone, where the press is before
   the first point or after the last). A line with no point yet is level along the whole song: it gets one point, at the
   beginning, and the whole of it moves. */
function autoSeg (d, t) {
  const k = d.k, m = S.marq, E = 1 / 512
  const under = !!m && m.b - m.a >= 4 * E && marqTracks().includes(t) && d.pos >= m.a - 1e-9 && d.pos <= m.b + 1e-9
  const at = pos => { const v = autoAt(t, k, pos); return v == null ? d.lineV : v }
  let got = []
  if (under) {
    const a = clamp(m.a, 0, SONG_END), b = clamp(m.b, 0, SONG_END), va = at(a), vb = at(b)
    const inside = autoPts(t, k).filter(q => q.b > a + E && q.b < b - E)
    if (a > 0) addPoint(t, k, a, va)
    const qa = addPoint(t, k, a > 0 ? a + E : 0, va)
    if (b < SONG_END) addPoint(t, k, b, vb)
    const qb = addPoint(t, k, b < SONG_END ? b - E : SONG_END, vb)
    got = [qa].concat(inside, [qb])
  } else {
    const pts = autoPts(t, k)
    if (!pts.length) got = [addPoint(t, k, 0, d.lineV)]
    else { const before = pts.filter(q => q.b <= d.pos).pop(), after = pts.find(q => q.b > d.pos); got = [before, after].filter(Boolean) }
  }
  d.orig = new Map(got.map(q => [q.id, { b: q.b, v: q.v }])); d.lead = got[0].id
  S.selP = got.map(q => q.id)
}
function autoDbl (e, p) {                                                                // twice anywhere on a lane: a point there
  if ((p.y - TY + VY) >= rowTops().all) return
  const ti = laneAt(p.y), t = S.tracks[ti], g = autoGeom(t, rowY(ti), rowH(ti))
  if (autoHit(t, g, p)) return
  if (!S.auto) { S.selR = []; S.selX = null }
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

/* ── chosen points nudged (option and the left or right arrow) ──
   The points go one nudge earlier or later — they alone: a region that is chosen besides stays where it is. Each line keeps
   its order: chosen points stop at the next point of their line that is not chosen (and at the song's two ends). */
function nudgePoints (dir) {
  const d0 = nudgeBars() * dir, ids = new Set(S.selP)
  let any = false
  edit(() => {
    for (const t of S.tracks) for (const k of Object.keys(t.autos || {})) {
      const pts = t.autos[k]
      if (!Array.isArray(pts) || !pts.some(q => ids.has(q.id))) continue
      let d = d0
      pts.forEach((q, i) => {
        if (!ids.has(q.id)) return
        if (d > 0) { let j = i + 1; while (j < pts.length && ids.has(pts[j].id)) j++; d = Math.min(d, (j < pts.length ? pts[j].b : SONG_END) - q.b) }
        else { let j = i - 1; while (j >= 0 && ids.has(pts[j].id)) j--; d = Math.max(d, (j >= 0 ? pts[j].b : 0) - q.b) }
      })
      if (Math.abs(d) < 1e-9) continue
      t.autos[k] = pts.map(q => ids.has(q.id) ? Object.assign({}, q, { b: q.b + d }) : q)
      any = true
    }
    return any
  })
  uiDirty('lanes', 'head', 'dock')
  return any
}
/* the line pressed and let go where it was pressed: a point there, chosen */
{ const up0 = lanesUp
  lanesUp = function () {
    const d = drag
    if (d && d.a === 'apt' && d.seg && d.lead == null) { const t = S.tracks[d.ti], q = addPoint(t, d.k, d.at, d.lineV); S.selP = [q.id]; d.moved = true; uiDirty('lanes', 'head', 'dock') }
    return up0()
  } }
{ const nudge0 = act.nudge
  act.nudgeRegs = nudge0                                                                   // (the regions' own, for what names regions — the command line)
  act.nudge = function (dir) {
    if (S.selP.length) { nudgePoints(dir); return }                                       // (as up and down already are the points' while any is chosen — a marquee up or not)
    if (S.auto) { if (S.marq) return nudge0.call(act, dir); jumpTo(clamp(curPos() + nudgeBars() * dir, 0, SONG_END)); uiDirty('scenes'); return }      // (the lines up: no region moves — the marquee, else the playhead)
    return nudge0.call(act, dir)
  }
  const len0 = act.nudgeLen
  act.nudgeLenRegs = len0
  act.nudgeLen = function (dir) { if (S.auto && !S.marq) return; return len0.call(act, dir) } }      // (the lines up: no region is made longer or shorter)
