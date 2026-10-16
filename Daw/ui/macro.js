/* ── macros: a track's own handles on the knobs of its plug-ins ──
   A plug-in from outside shows the automation view only its name; its knobs are its own. A macro is made in the patch
   panel (the column at the left of the wall, + in its head), wired from the dot at its right to a plug-in on the wall like
   any wire, and a small panel lists that plug-in's controls with what each reads now; the one picked is what the macro
   turns from then on, and the macro takes that control's name. Turned by hand, the plug-in's knob moves with it; in the
   automation view a track's lines are its macros by those names (auto.js: mac<id>), and a line drawn for one moves the
   knob as the song plays. Draft: design/macro draft 1.
     t.macros = [{ id, name, v, to: { n, i, plug } | null }]   v from 0 to 1, as the plug-in counts; n the plug-in's number on
                                                                 the track (ins.n), i the control's place among its controls
   Wired again it forgets what it turned; a plug-in taken off leaves its macro not wired, its line kept. Twice on a macro's
   name: it is named by hand. Chosen, delete takes it away with its line. The macros are the track's: written with the
   project and with a preset. The stereo out has none. This script is read after wall.js, preset.js and meternode.js.
   A macro wires to a print of the wall as well (to: { node, hand, print }): its list is the print's big hand and the hands
   of its study, and the macro carries the one picked along its range (a wide one along a log), a choice from its first word
   to its last, a switch at the middle. A line drawn for it is told to the engine as a table of what each place along the
   macro sets that hand to (Engine kAutoPrint). */
const MAC = { sel: null, drag: null, list: null, top: 0, keys: false, last: 0, lastId: '', geo: null }
const MAC_W = 96, MAC_ROW = 72
if (typeof KEEP_T !== 'undefined' && !KEEP_T.includes('macros')) KEEP_T.push('macros')
const macTrack = () => (WALL.out ? null : wallTrack())
const macKey = m => 'mac' + m.id
const macShown = (t, m) => shown(t, macKey(m))
/* a macro wired to a print's hand: the print, while it stands on the wall as that print */
const macroNode = (t, m) => { if (!m || !m.to || m.to.node == null || !t || !t.wall) return null; const node = wallNode(wallOf(t), m.to.node); return node && node.k === m.to.print ? node : null }
const macroWired = (t, m) => !!(macroIns(t, m) || macroNode(t, m))
/* the part of a print a hand writes (0 the amount, 1 the flavour, 2 its decay, 3 the division, 4 the feedback, 10 + k aux k) */
const macField = h => h.h === 'variant' ? 1 : h.h === 'decay' ? 2 : h.h === 'div' ? 3 : h.h === 'fb' ? 4 : /^aux\d$/.test(h.h) ? 10 + +h.h.slice(3) : -1
const MAC_PART = { 1: 'variant', 2: 'decay', 3: 'delayDiv', 4: 'delayFb' }
/* a hand a macro can carry: one that writes its own part only (an lfo's shape, a tremolo's drawn cycle write more) */
function macCarries (node, h) {
  const f = macField(h)
  if (f < 0) return false
  const n0 = wallAsNode(node), one = h.c.kind === 'gauge' ? h.c.set(h.hi, n0) : h.c.kind === 'switch' ? h.c.set(!h.c.get(n0), n0) : h.c.set(Math.min(1, (h.opts || []).length - 1), n0)
  return Object.keys(one || {}).every(k => k === (f >= 10 ? 'aux' : MAC_PART[f]))
}
/* the macro's 0..1 along a hand, and back */
const macToHand = (h, v) => h.opts ? h.vals[Math.round(clamp(v, 0, 1) * (h.opts.length - 1))] : studyLog(h) ? h.lo * Math.pow(h.hi / h.lo, clamp(v, 0, 1)) : h.lo + clamp(v, 0, 1) * (h.hi - h.lo)
const macOfHand = (h, x) => h.opts ? Math.max(0, h.vals.indexOf(x)) / Math.max(1, h.opts.length - 1) : clamp(studyFrac(h, x), 0, 1)
/* what can be wired on a print: its big hand, then each hand of its study a macro can carry */
function macHands (t, node) {
  if (!node || node.k === 'plug' || node.k === 'meter' || node.k === 'side') return []
  const rows = []
  if (wallHasAmount(node) && !WALL_LEGACY[node.k]) rows.push({ k: 0, key: 'amount', name: wallMain(node.k), text: wallValue(t, Object.assign({}, node, { bare: true })).trim(), v: wallAmount(t, node) })
  wallHands(node.k, node).forEach(h => { if (macCarries(node, h)) rows.push({ k: rows.length, key: h.c.key, name: h.label, text: wallHandText(node, h), v: macOfHand(h, wallHandNow(node, h)) }) })
  return rows
}
const macHand = (node, key) => key === 'amount' ? null : wallHands(node.k, node).find(h => h.c.key === key) || null
/* turned: the print's hand goes with it */
function macPrintSet (t, m, v, live) {
  const node = macroNode(t, m)
  if (!node) return
  if (m.to.hand === 'amount') { wallSetAmount(t, node, clamp(v, 0, 1), live); return }
  const h = macHand(node, m.to.hand)
  if (!h) return
  wallHandSet(node, h, macToHand(h, v)); wallPush(t)
}
/* a line drawn for it: what each place along the macro sets the hand to, as the engine takes it (65 places) */
function macTable (t, m) {
  const node = macroNode(t, m)
  if (!node) return null
  if (m.to.hand === 'amount') return { field: 0, table: [0, 1] }
  const h = macHand(node, m.to.hand), f = h ? macField(h) : -1
  if (f < 0) return null
  const table = []
  for (let i = 0; i <= 64; i++) {
    const c = JSON.parse(JSON.stringify(node)), hc = macHand(c, m.to.hand)
    if (hc) wallHandSet(c, hc, macToHand(hc, i / 64))
    table.push(f === 1 ? c.variant || 0 : f === 2 ? (c.decay || [.5, .5, .5])[clamp(c.variant || 0, 0, 2)] : f === 3 ? (c.div == null ? 2 : c.div) : f === 4 ? (c.fb == null ? .35 : c.fb) : (c.aux || [])[f - 10] || 0)
  }
  return { field: f, table }
}
function macroNew (t) {
  t.macros = t.macros || []
  const used = new Set(t.macros.map(m => m.name)), id = 1 + Math.max(0, ...t.macros.map(m => m.id))
  let k = 1
  while (used.has('macro ' + k)) k++
  const m = { id, name: 'macro ' + k, v: .5, to: null }
  t.macros.push(m); MAC.sel = id; MAC.top = Math.max(0, t.macros.length - 1)
  return m
}
function macroDrop (t, m) {
  t.macros = (t.macros || []).filter(x => x !== m)
  if (t.autos) delete t.autos[macKey(m)]
  if (t.ap === macKey(m)) t.ap = 'vol'
  MAC.sel = null; resyncSoon(); uiDirty('dock', 'lanes', 'head')
}
/* turned by hand: the control with it; with a line drawn, the whole line moves (as a fader's does) */
function macroSet (t, m, v) {
  v = clamp(v, 0, 1)
  const k = macKey(m), pts = autoPts(t, k)
  if (pts.length) { const d = v - macShown(t, m); if (!d) return; for (const q of pts) q.v = clamp(Math.round((q.v + d) * 1000) / 1000, 0, 1); resyncSoon() } else m.v = v
  const ins = macroIns(t, m), now = macShown(t, m)
  if (ins) { ins.pv = ins.pv || {}; ins.pv[m.to.i] = now; if (NAT && ins.uid) NAT.call('paramSet', { track: t.id, uid: ins.uid, index: m.to.i, v: now }) }
  else if (macroNode(t, m)) { macPrintSet(t, m, now, true); if (pts.length) resyncSoon() }
  uiDirty('dock', 'lanes', 'head')
}
/* wired to one control of a plug-in on the wall: it takes the control's name and where the control stands now */
function macroWire (t, m, ins, row) {
  if (!ins.n) ins.n = 1 + Math.max(0, ...t.inserts.map(q => q.n || 0))
  ins.pn = ins.pn || {}; ins.pv = ins.pv || {}
  const name = String(row.name || `control ${row.k + 1}`).toLowerCase().slice(0, 40)
  ins.pn[row.k] = name; ins.pv[row.k] = clamp(+row.v || 0, 0, 1)
  m.to = { n: ins.n, i: row.k, plug: String(ins.name || 'plug-in').toLowerCase() }
  m.name = name
  if (!autoPts(t, macKey(m)).length) m.v = ins.pv[row.k]
  else if (NAT && ins.uid) NAT.call('paramSet', { track: t.id, uid: ins.uid, index: row.k, v: macShown(t, m) })      // (its line says where the knob is from now on)
  if (typeof fxScale === 'function') fxScale(t, ins, row.k).then(() => uiDirty('dock')).catch(() => {})
  MAC.sel = m.id; resyncSoon(); uiDirty('dock', 'head', 'lanes')
}
/* wired to a hand of a print on the wall: it takes the hand's name and where the hand stands now */
function macroWirePrint (t, m, node, row) {
  m.to = { node: node.id, hand: row.key, print: node.k }
  m.name = row.name
  if (!autoPts(t, macKey(m)).length) m.v = clamp(+row.v || 0, 0, 1)
  else macPrintSet(t, m, macShown(t, m), false)                                             // (its line says where the hand is from now on)
  MAC.sel = m.id; resyncSoon(); uiDirty('dock', 'head', 'lanes')
}
/* a plug-in's controls: [{ k, name, v, text }] (in a browser, with no app, whatever stands in for one) */
async function macroControls (t, ins) {
  const rows = NAT && ins.uid ? await NAT.call('params', { track: t.id, uid: ins.uid }) : typeof window.MACRO_STAND_IN === 'function' ? window.MACRO_STAND_IN(ins) : []
  return (Array.isArray(rows) ? rows : []).map(r => ({ k: +r[0], name: String(r[1] || '').toLowerCase(), v: +r[2], text: String(r[3] || '') }))
}
/* what a macro reads: in the plug-in's own words when they are known, else in hundredths */
function macroText (t, m) {
  const v = macShown(t, m), ins = macroIns(t, m), sc = ins && ins.ps && ins.ps[m.to.i], node = macroNode(t, m)
  if (node) { if (m.to.hand === 'amount') return wallValue(t, Object.assign({}, node, { bare: true })).trim(); const h = macHand(node, m.to.hand); return h ? wallHandText(node, h) : String(Math.round(v * 100)) }      // (a print says it in its own units)
  return sc && Array.isArray(sc.texts) && sc.texts.length > 1 ? String(sc.texts[Math.round(v * (sc.texts.length - 1))]).toLowerCase() : String(Math.round(v * 100))
}

/* ── drawn: the column at the left of the wall, a wire being drawn, and the list of a plug-in's controls ── */
const macScreen = (v, node) => ({ x: v.tx + node.x * v.z, y: v.ty + node.y * v.z })
function macroPlugAt (t, p) {
  const g = WALL.g, w = wallOf(t)
  if (!g || !w) return null
  const v = wallView(w, g)
  let best = null, bd = 1e9
  for (const node of w.nodes) { if (node.k === 'plug' ? !node.ins : !macHands(t, node).length) continue; const s = macScreen(v, node), d = Math.hypot(s.x - p.x, s.y - p.y); if (d < 34 * v.z + 8 && d < bd) { bd = d; best = node } }      // (a plug-in, or a print with a hand to turn)
  return best
}
function macroKnob (cx, cy, t, m, sel, turning) {
  const r = 15, v = macShown(t, m), a0 = Math.PI * .75, a1 = a0 + Math.PI * 1.5 * v, wired = macroWired(t, m)
  const arc = (from, to, rr) => `M${n(cx + Math.cos(from) * rr)} ${n(cy + Math.sin(from) * rr)}A${rr} ${rr} 0 ${to - from > Math.PI ? 1 : 0} 1 ${n(cx + Math.cos(to) * rr)} ${n(cy + Math.sin(to) * rr)}`
  let s = Cc(cx, cy, r, { fill: K3, stroke: INK, sa: sel ? .7 : .3 }) + P(arc(a0, a0 + Math.PI * 1.5, r + 4), { stroke: INK, sa: .14, sw: 2, cap: 'round' })
  if (v > .005) s += P(arc(a0, a1, r + 4), { stroke: INK, sa: wired ? .9 : .4, sw: 2, cap: 'round' })
  s += P(`M${n(cx + Math.cos(a1) * 5)} ${n(cy + Math.sin(a1) * 5)}L${n(cx + Math.cos(a1) * (r - 3))} ${n(cy + Math.sin(a1) * (r - 3))}`, { stroke: INK, sw: 1.6, cap: 'round' })
  s += Cc(cx + r + 10, cy, 2.2, { fill: INK })
  s += T(cx, cy + r + 16, fit(asGiven(m.name), MAC_W - 10, 10, 500), { size: 10, w: 500, anchor: 'middle', a: wired ? 1 : .6 })
  s += turning ? T(cx, cy + r + 28, fit(asGiven(macroText(t, m)), MAC_W - 10, 9), { size: 9, a: .8, anchor: 'middle' })
    : T(cx, cy + r + 28, wired ? fit(asGiven(m.to.plug || m.to.print), MAC_W - 10, 9) : 'not wired', { size: 9, a: .42, anchor: 'middle', it: !wired })
  if (sel) s += R(cx - MAC_W / 2 + 6.5, cy - r - 8.5, MAC_W - 13, 2 * r + 46, { rx: 3, stroke: INK, sa: .5, dash: '2 3' })
  return s
}
function macroColumn (y, h) {
  const t = macTrack(), g = WALL.g
  MAC.geo = null
  if (!t || !g || g.id !== t.id) { if (MAC.list) MAC.list = null; return '' }
  const w = wallOf(t), v = wallView(w, g), H = h - 26, ms = t.macros || []
  if (MAC.list && MAC.list.t !== t.id) MAC.list = null
  const fits = Math.max(1, Math.floor((H - 40) / MAC_ROW))
  MAC.top = clamp(MAC.top, 0, Math.max(0, ms.length - fits))
  const shownMs = ms.slice(MAC.top, MAC.top + fits), cyOf = k => y + 52 + k * MAC_ROW, cx = MAC_W / 2 - 6
  MAC.geo = { y, H, cx, top: MAC.top, ids: shownMs.map(m => m.id) }
  /* the dashed lines to what each turns, under the column and over the wall */
  let links = ''
  shownMs.forEach((m, k) => {
    const ins = macroIns(t, m), node = ins ? w.nodes.find(q => q.k === 'plug' && q.ins === ins) : macroNode(t, m)
    if (!node || (MAC.drag && MAC.drag.k === 'wire' && MAC.drag.id === m.id)) return
    const b0 = macScreen(v, node), a = { x: cx + 25, y: cyOf(k) }, b = { x: b0.x - 34 * v.z, y: b0.y - 18 * v.z }
    links += P(`M${n(a.x)} ${n(a.y)}C${n(a.x + 90)} ${n(a.y)} ${n(b.x - 90)} ${n(b.y)} ${n(b.x)} ${n(b.y)}`, { stroke: INK, sa: .22, dash: '3 4' }) + Cc(b.x, b.y, 2.2, { fill: INK, fa: .5 })
  })
  let s = `<clipPath id="mac-clip"><rect x="0" y="${n(y)}" width="${n(g.w)}" height="${n(H)}"/></clipPath>` + G(links, '', ' clip-path="url(#mac-clip)"')
  s += R(0, y, MAC_W, H, { fill: K1 }) + vline(MAC_W - .5, y, y + H, .08) + hit(0, y, MAC_W, H, 'macro', ' data-k="bg"', 'default')
  s += T(12, y + 18, 'macros', { size: 9.5, a: .42 }) + key(MAC_W - 12 - keyW('+'), y + 5, '+', { a: 'macro', more: ' data-k="add"' })[0]
  if (!ms.length) s += T(MAC_W / 2, y + 52, 'none yet', { size: 9, a: .32, anchor: 'middle', it: true })
  shownMs.forEach((m, k) => {
    const cy = cyOf(k), turning = MAC.drag && MAC.drag.k === 'turn' && MAC.drag.id === m.id
    s += macroKnob(cx, cy, t, m, MAC.sel === m.id, turning)
    s += hit(cx - 20, cy - 20, 40, 40, 'macro', ` data-k="knob" data-i="${m.id}"`, 'ns-resize') + hit(cx + 18, cy - 8, 16, 16, 'macro', ` data-k="port" data-i="${m.id}"`, 'crosshair') + hit(4, cy + 21, MAC_W - 8, 26, 'macro', ` data-k="name" data-i="${m.id}"`, 'default')
  })
  if (ms.length > fits) { const th = H - 48, bh = Math.max(14, th * fits / ms.length); s += R(MAC_W - 5, y + 40 + (th - bh) * MAC.top / (ms.length - fits), 2, bh, { rx: 1, fill: INK, fa: .3 }) }
  /* a wire being drawn from a macro */
  const d = MAC.drag
  if (d && d.k === 'wire') {
    const k = shownMs.findIndex(m => m.id === d.id)
    if (k >= 0) {
      const a = { x: cx + 25, y: cyOf(k) }, b = d.p, over = d.over != null ? w.nodes.find(q => q.id === d.over) : null
      s += P(`M${n(a.x)} ${n(a.y)}C${n(a.x + 90)} ${n(a.y)} ${n(b.x - 90)} ${n(b.y)} ${n(b.x)} ${n(b.y)}`, { stroke: INK, sw: 1.4 })
      if (over) { const o = macScreen(v, over); s += Cc(o.x, o.y, 32 * v.z + 9, { stroke: INK, sa: .9 }) }
    }
  }
  if (MAC.list) s += macroList(t, w, v, g, y, H)
  return s
}
function macroRows () {
  const L = MAC.list, q = L.q.trim().toLowerCase()
  return q ? L.rows.filter(r => r.name.includes(q)) : L.rows
}
function macroList (t, w, v, g, y, H) {
  const L = MAC.list, node = w.nodes.find(q => q.id === L.node), m = (t.macros || []).find(x => x.id === L.m)
  if (!node || !m) { MAC.list = null; return '' }
  const rows = macroRows(), lw = 236, rh = 21, at = macScreen(v, node)
  const fits = Math.max(3, Math.floor((H - 16 - 60 - 26) / rh)), shownN = Math.min(fits, Math.max(1, rows.length))
  L.top = clamp(L.top, 0, Math.max(0, rows.length - shownN)); L.hover = rows.length ? clamp(L.hover, 0, rows.length - 1) : -1
  if (L.hover >= 0 && L.hover < L.top) L.top = L.hover
  if (L.hover >= L.top + shownN) L.top = L.hover - shownN + 1
  const lh = 60 + shownN * rh + 26
  let lx = Math.round(at.x + 34 * v.z + 14)
  if (lx + lw > g.w - 8) lx = Math.round(at.x - 34 * v.z - 14 - lw)
  lx = clamp(lx, MAC_W + 8, Math.max(MAC_W + 8, g.w - lw - 8))
  const ly = Math.round(clamp(at.y - 70, y + 8, Math.max(y + 8, y + H - lh - 8)))
  let s = hit(lx, ly, lw, lh, 'macro', ' data-k="list"', 'default') + R(lx + .5, ly + .5, lw - 1, lh - 1, { rx: 2, fill: K2, stroke: INK, sa: .3 })
  s += T(lx + 12, ly + 19, fit(asGiven(L.plug), lw - 110, 10.5, 500), { size: 10.5, w: 500 }) + T(lx + lw - 12, ly + 19, fit(asGiven(m.name), 90, 9.5), { size: 9.5, a: .42, anchor: 'end' })
  s += R(lx + 10.5, ly + 30.5, lw - 21, 21, { rx: 1.5, fill: K0, stroke: INK, sa: .22 }) + (L.q ? T(lx + 18, ly + 45, asGiven(L.q), { size: 10, a: .9 }) + P(`M${n(lx + 19 + tw(asGiven(L.q), 10))} ${ly + 35}V${ly + 48}`, { stroke: INK, sa: .7 }) : T(lx + 18, ly + 45, L.busy ? 'asking the plug-in' : 'find a control', { size: 10, a: .38, it: true }))
  if (!L.busy && !rows.length) s += T(lx + 12, ly + 60 + 14.5, L.rows.length ? 'none by that name' : 'it has no controls to turn', { size: 10, a: .42, it: true })
  for (let i = L.top; i < Math.min(rows.length, L.top + shownN); i++) {
    const r = rows[i], yy = ly + 60 + (i - L.top) * rh, on = L.ins ? m.to && m.to.i === r.k && macroIns(t, m) === L.ins : m.to && m.to.node === L.node && m.to.hand === r.key
    if (i === L.hover) s += R(lx + 1, yy, lw - 2, rh, { fill: INK, fa: .06 })
    s += T(lx + 12, yy + 14.5, fit(asGiven(r.name), lw - 96, 10.5, on ? 500 : 400), { size: 10.5, w: on ? 500 : 400, a: i === L.hover || on ? 1 : .78 }) + T(lx + lw - 12, yy + 14.5, fit(asGiven(r.text.toLowerCase()), 70, 9.5), { size: 9.5, a: .46, anchor: 'end' })
    s += hit(lx + 1, yy, lw - 2, rh, 'macro', ` data-k="row" data-r="${i}"`)
  }
  if (rows.length > shownN) { const th = shownN * rh, bh = Math.max(14, th * shownN / rows.length); s += R(lx + lw - 5, ly + 60 + (th - bh) * L.top / (rows.length - shownN), 2, bh, { rx: 1, fill: INK, fa: .3 }) }
  s += hline(lx + 1, lx + lw - 1, ly + 60 + shownN * rh + 4, .14) + T(lx + 12, ly + lh - 9, L.busy ? '' : `${L.rows.length} ${L.ins ? 'controls' : 'hands'}`, { size: 9, a: .42 })
  MAC.list.geo = { lx, ly, lw, lh }
  return s
}
async function macroOpenList (t, m, node) {
  if (node.k !== 'plug') {                                                              // a print: its hands, as they read now
    const rows = macHands(t, node), now = m.to && m.to.node === node.id ? rows.findIndex(r => r.key === m.to.hand) : -1
    MAC.list = { t: t.id, m: m.id, node: node.id, ins: null, plug: node.k, rows, q: '', hover: Math.max(0, now), top: 0, busy: false }
    uiDirty('dock'); return
  }
  MAC.list = { t: t.id, m: m.id, node: node.id, ins: node.ins, plug: String(node.ins.name || 'plug-in').toLowerCase(), rows: [], q: '', hover: 0, top: 0, busy: true }
  uiDirty('dock')
  const rows = await macroControls(t, node.ins)
  if (!MAC.list || MAC.list.m !== m.id) return
  MAC.list.rows = rows; MAC.list.busy = false
  const now = m.to && macroIns(t, m) === node.ins ? rows.findIndex(r => r.k === m.to.i) : -1
  MAC.list.hover = Math.max(0, now)
  uiDirty('dock')
}
function macroPick (t, i) {
  const L = MAC.list, rows = L ? macroRows() : [], r = rows[i], m = L && (t.macros || []).find(x => x.id === L.m)
  const node = L && !L.ins ? wallNode(wallOf(t), L.node) : null
  if (node && r && m) { macroWirePrint(t, m, node, r); MAC.list = null; return }
  if (!r || !m || !t.inserts.includes(L.ins)) { MAC.list = null; uiDirty('dock'); return }
  macroWire(t, m, L.ins, r)
  MAC.list = null
}
/* named by hand, where its name stands (the room's own box, as a track's name is) */
function macroRename (t, m) {
  const k = MAC.geo ? MAC.geo.ids.indexOf(m.id) : -1
  if (k < 0) return
  const el = $('rename'), cy = MAC.geo.y + 52 + k * MAC_ROW
  el.style.cssText = `left:${n(4)}px;top:${n(cy + 22)}px;width:${n(MAC_W - 8)}px;height:18px;font:500 10px var(--f);text-align:center`
  el.value = m.name; el.hidden = false; el.focus(); el.select()
  let live = false
  setTimeout(() => { live = true; if (!el.hidden && document.activeElement !== el) { el.focus(); el.select() } }, 0)
  const done = keep => {
    el.onblur = el.onkeydown = null; el.hidden = true
    const v = el.value.trim().slice(0, 40)
    if (keep && v) { m.name = v; uiDirty('dock', 'head', 'lanes') }
  }
  el.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false) }
  el.onblur = () => { if (live) done(true) }
}

/* ── joined to the room ── */
{
  const patch0 = pPatch, down0 = onDown, move0 = onMove, up0 = onUp, wheel0 = onWheel
  pPatch = function (y, h) { const s = patch0(y, h); return s + macroColumn(y, h) }
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a="macro"]') : null
    if (!el) { if (MAC.list) { MAC.list = null; uiDirty('dock') } if (MAC.sel != null) { MAC.sel = null; uiDirty('dock') } MAC.keys = false; return down0(e) }
    e.preventDefault()
    if (S.menu) { S.menu = null; uiDirty('menu') }
    const t = macTrack()
    if (!t) return
    const k = el.dataset.k, id = el.dataset.i == null ? null : +el.dataset.i, m = id != null ? (t.macros || []).find(x => x.id === id) : null, p = pt(e)
    const now = performance.now(), twice = MAC.lastId === k + ':' + id && now - MAC.last < 380
    MAC.last = now; MAC.lastId = k + ':' + id; MAC.keys = true; S.focus = 'wall'; WALL.sel = null
    const hold = d => { MAC.drag = d; try { svg.setPointerCapture(e.pointerId) } catch (err) {} }
    if (k !== 'list' && k !== 'row' && MAC.list) MAC.list = null
    if (k === 'bg') MAC.sel = null
    else if (k === 'add') macroNew(t)
    else if (k === 'knob' && m) { MAC.sel = m.id; hold({ k: 'turn', id: m.id, y0: p.y, v0: macShown(t, m) }) }
    else if (k === 'port' && m) { MAC.sel = m.id; hold({ k: 'wire', id: m.id, p, over: null }) }
    else if (k === 'name' && m) { MAC.sel = m.id; if (twice) macroRename(t, m) }
    else if (k === 'row') macroPick(t, +el.dataset.r)
    uiDirty('dock')
  }
  onMove = function (e) {
    const d = MAC.drag
    if (d) {
      const t = macTrack(), p = pt(e), m = t && (t.macros || []).find(x => x.id === d.id)
      if (!t || !m) { MAC.drag = null; return }
      if (d.k === 'turn') macroSet(t, m, d.v0 + (d.y0 - p.y) / (e.shiftKey ? 600 : 150))
      else { d.p = p; const node = macroPlugAt(t, p); d.over = node ? node.id : null; uiDirty('dock') }
      return
    }
    if (MAC.list) { const el = e.target.closest ? e.target.closest('[data-a="macro"][data-k="row"]') : null; if (el && +el.dataset.r !== MAC.list.hover) { MAC.list.hover = +el.dataset.r; uiDirty('dock') } }
    move0(e)
  }
  onUp = function (e) {
    const d = MAC.drag
    if (!d) return up0(e)
    MAC.drag = null
    const t = macTrack(), m = t && (t.macros || []).find(x => x.id === d.id)
    if (t && m && d.k === 'wire') { const node = macroPlugAt(t, pt(e)); if (node && (node.k !== 'plug' || (node.ins && !node.ins.out))) macroOpenList(t, m, node) }
    uiDirty('dock')
  }
  onWheel = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a="macro"]') : null
    if (!el) return wheel0(e)
    e.preventDefault()
    if (MAC.list && (el.dataset.k === 'row' || el.dataset.k === 'list')) MAC.list.top += Math.sign(e.deltaY)
    else MAC.top += Math.sign(e.deltaY)
    uiDirty('dock')
  }
  /* keys: the list of controls is found in by typing; a chosen macro goes with delete */
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return
    const t = macTrack()
    if (MAC.list && t) {
      const L = MAC.list, rows = macroRows()
      if (e.key === 'Escape') MAC.list = null
      else if (e.key === 'Enter') { if (rows.length) macroPick(t, clamp(L.hover, 0, rows.length - 1)) }
      else if (e.key === 'ArrowDown') L.hover = Math.min(rows.length - 1, L.hover + 1)
      else if (e.key === 'ArrowUp') L.hover = Math.max(0, L.hover - 1)
      else if (e.key === 'Backspace') { L.q = L.q.slice(0, -1); L.hover = 0; L.top = 0 }
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) { L.q = (L.q + e.key).slice(0, 30); L.hover = 0; L.top = 0 }
      else return
      e.preventDefault(); e.stopImmediatePropagation(); uiDirty('dock'); return
    }
    if (MAC.keys && MAC.sel != null && t && (e.key === 'Backspace' || e.key === 'Delete') && !e.metaKey) {
      const m = (t.macros || []).find(x => x.id === MAC.sel)
      if (m) { e.preventDefault(); e.stopImmediatePropagation(); macroDrop(t, m) }
    }
  }, true)
}
