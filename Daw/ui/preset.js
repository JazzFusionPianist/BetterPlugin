/* ── a patch kept as a preset: Patch on Slur's own way, in the patch panel ──
   The bar in the panel's head is the one Patch on Slur has: the one before, the name with its list, the one after. The
   list: initial (the empty wall); the kept ones, each with remove (asked once: sure?); save, save as…, open…. A name with
   a star is a kept patch that has been changed since.

   The files are Patch on Slur's: <name>.orbpatch in ~/Library/Application Support/Orb/Sounds/Presets, so a patch kept in
   one is there in the other. A file holds the wall twice over:
     nodes, edges    what Patch on Slur reads — the prints and their wires; a plug-in from outside is not a thing it
                     has, so its place is closed over (prePlain)
     slurStudio      what this app reads — the wall whole: every print, every plug-in from outside with its settings, the
                     wires as they are hung (as a project keeps them). Patch on Slur passes this over, and a file it
                     writes has none: then the wall is made from nodes and edges.
   A patch put on a wall takes the place of everything that stood there, and is one step: undo brings the wall back as it
   was, its plug-ins with their settings.

   A track keeps which preset is up as t.pre = { name, key } (key: what the wall was when it was kept or put up; it is
   written into the project). This script is read after wall.js. */
const PRE = { list: [], open: false, sure: null, hover: null, top: 0, busy: false, geo: null, panel: 1 }
const PRE_LS = 'orb_wall_presets', PRE_FIRST = 'initial'
if (typeof KEEP_T !== 'undefined' && !KEEP_T.includes('pre')) KEEP_T.push('pre')

/* ── the files (in a browser, with no app behind the page: the browser's own store, as Patch on Slur does there) ── */
const preStore = () => { try { return JSON.parse(localStorage.getItem(PRE_LS) || '{}') || {} } catch (e) { return {} } }
const preStoreSet = all => { try { localStorage.setItem(PRE_LS, JSON.stringify(all)); return true } catch (e) { return false } }
const preClean = name => String(name || '').trim().toLowerCase().replace(/[\\/:*?"<>|]/g, '').slice(0, 48)
async function presetRefresh () {
  if (NAT) { const r = await NAT.call('presetList'); PRE.list = r && Array.isArray(r.names) ? r.names.map(String) : [] } else PRE.list = Object.keys(preStore()).sort()
  PRE.list = PRE.list.filter(n => n !== PRE_FIRST)
  uiDirty('dock')
}
async function preRead (name) {
  if (NAT) { const r = await NAT.call('presetLoad', { name }); return r && r.ok ? String(r.json || '') : null }
  const g = preStore()[name]
  return g ? JSON.stringify(g) : null
}
async function preWrite (name, json) {
  if (NAT) { const r = await NAT.call('presetSave', { name, json }); return !!(r && r.ok) }
  const all = preStore(); all[name] = JSON.parse(json)
  return preStoreSet(all)
}
async function preDrop (name) {
  if (NAT) { const r = await NAT.call('presetDelete', { name }); return !!(r && r.ok) }
  const all = preStore(); if (!(name in all)) return false
  delete all[name]
  return preStoreSet(all)
}

/* ── a wall as a file, and a file as a wall ── */
const preInserts = (t, whole) => (t.inserts || []).filter(i => i.id).map(i => Object.assign({ id: i.id, name: i.name, fmt: i.fmt, state: i.state || '' }, i.off ? { off: true } : {}, whole && i.key ? { key: i.key } : {}, whole && i.n ? { n: i.n } : {}, whole && i.pn ? { pn: i.pn } : {}))
/* the settings of the plug-ins on it, as they are now (the app is asked: a plug-in's own window does not say when it is turned) */
async function preFresh (t) {
  if (!NAT || !(t.inserts || []).some(i => i.uid)) return
  const st = await NAT.call('pluginStates')
  if (st) for (const i of t.inserts) if (i.uid && st['u' + i.uid] != null) i.state = st['u' + i.uid]
}
const preEmpty = () => ({ nodes: [], wires: [], z: 0, ox: 0, oy: 0, in: { x: 40, y: 0 }, out: { x: 260, y: 0 } })
/* the wall as Patch on Slur can hold it: the prints and their wires. A plug-in from outside is closed over — whatever fed
   it feeds whatever it fed, so the way from in to out is not broken where it stood */
function prePlain (t) {
  const w0 = wallOf(t), w = { nodes: w0.nodes.filter(n => n.k !== 'plug'), wires: w0.wires.map(e => Object.assign({}, e)) }
  for (const p of w0.nodes) if (p.k === 'plug') {
    const ins = w.wires.filter(e => e.to === p.id), outs = w.wires.filter(e => e.from === p.id)
    w.wires = w.wires.filter(e => e.from !== p.id && e.to !== p.id)
    for (const i of ins) for (const o of outs) if (i.from !== o.to && !w.wires.some(e => e.from === i.from && e.to === o.to && (e.port || 0) === (i.port || 0))) w.wires.push({ from: i.from, to: o.to, gain: o.gain, port: i.port || 0 })
  }
  if (!w.nodes.length) return { nodes: [], edges: [{ from: WALL_IN, to: WALL_OUT, gain: 1 }] }
  const x0 = Math.min(...w.nodes.map(n => n.x))
  return { nodes: w.nodes.map(n => ({ id: n.id, type: WALL_TYPE[n.k], amount: +wallAmount(t, n).toFixed(4), variant: n.variant || 0, decay: n.decay || [.5, .5, .5], delayDiv: n.div == null ? 2 : n.div, delayFb: n.fb == null ? .35 : n.fb, wet: !!n.wet, bypass: !!n.bypass, aux: n.aux || [0, 0, 0], x: Math.round(180 + (n.x - x0) * 1.6), y: Math.round(280 + (n.y - w0.in.y) * 1.6) })),
    edges: w.wires.filter(e => (e.from === WALL_IN || w.nodes.some(n => n.id === e.from)) && (e.to === WALL_OUT || w.nodes.some(n => n.id === e.to))).map(e => ({ from: e.from, to: e.to, gain: +(+e.gain).toFixed(4), port: e.port || 0 })) }
}
function presetJson (t) {
  const g = prePlain(t)
  g.slurStudio = { v: 1, wall: wallSaved(t) || preEmpty(), patch: copy(t.patch), inserts: preInserts(t) }
  return JSON.stringify(g, null, 1)
}
/* a file Patch on Slur wrote: its prints by their numbers, wired by their ids. What this app's wall has no print for is
   closed over, as a thing taken off is; so is a second tape, space or delay (a wall here has one of each). */
function preFromGraph (g) {
  const kOf = {}; for (const k in WALL_TYPE) kOf[WALL_TYPE[k]] = k
  const w = preEmpty(), patch = NO_PATCH(), src = Array.isArray(g.nodes) ? g.nodes : [], idOf = new Map(), drop = [], seen = {}
  const xs = src.map(n => +n.x || 0), ys = src.map(n => +n.y || 0), x0 = xs.length ? Math.min(...xs) : 0, ym = ys.length ? ys.reduce((a, v) => a + v, 0) / ys.length : 0
  let left = 0
  src.forEach((n, i) => {
    const k = kOf[n.type], id = i
    idOf.set(n.id, id)
    const node = Object.assign(wallNew(k || 'gain', 150 + ((+n.x || 0) - x0) / 1.6, ((+n.y || 0) - ym) / 1.6), { id })
    if (!k || i >= WALL_MAX || (WALL_LEGACY[k] && seen[k])) { drop.push(id); left++; w.nodes.push(node); return }
    seen[k] = true
    node.amount = clamp(n.amount == null ? node.amount : +n.amount, 0, 1); node.variant = n.variant | 0
    if (Array.isArray(n.decay)) node.decay = [0, 1, 2].map(j => n.decay[j] == null ? .5 : +n.decay[j])
    node.div = n.delayDiv == null ? 2 : n.delayDiv | 0; node.fb = n.delayFb == null ? .35 : +n.delayFb
    node.wet = !!n.wet; node.bypass = !!n.bypass
    if (Array.isArray(n.aux)) node.aux = n.aux.map(v => v | 0).concat([0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 8)
    if (WALL_LEGACY[k]) patch.A[k] = clamp(node.amount * 100, 0, 100)
    w.nodes.push(node)
  })
  const end = id => id === WALL_IN || id === WALL_OUT ? id : idOf.has(id) ? idOf.get(id) : null
  for (const e of Array.isArray(g.edges) ? g.edges : []) { const from = end(e.from), to = end(e.to); if (from == null || to == null || from === to) continue; w.wires.push({ from, to, gain: clamp(e.gain == null ? 1 : +e.gain, 0, 1), port: e.port | 0 }) }
  for (const id of drop) wallTake(w, id)
  w.out = { x: Math.max(260, ...w.nodes.map(n => n.x + 126)), y: 0 }
  return { wall: w, patch, inserts: [], left }
}
/* what a wall is, for telling whether it is still the patch that was kept: what stands on it and how it is wired, not where */
function presetKey (t) {
  const w = wallOf(t)
  if (!w) return ''
  const p = patchNow(t)
  return JSON.stringify({ n: w.nodes.map(n => n.k === 'plug' ? { id: n.id, plug: (n.ins && n.ins.id) || '' } : { id: n.id, k: n.k, a: WALL_LEGACY[n.k] ? Math.round(p[n.k] * 10) / 10 : +(+n.amount || 0).toFixed(4), v: n.variant || 0, d: n.decay, div: n.div, fb: n.fb, w: !!n.wet, b: !!n.bypass, x: n.aux }), e: w.wires.map(e => [e.from, e.to, +(+e.gain).toFixed(4), e.port || 0]) })
}
const presetDirty = t => !!(t && t.pre && t.pre.key && t.pre.key !== presetKey(t))

/* ── a wall taken off and another put up ── */
const preTrack = id => id === OUT_ID ? OUT : byId(id)
/* the wall as it stands, to be put back by an undo */
const preKeep = t => ({ wall: (wallOf(t), wallSaved(t)) || preEmpty(), patch: copy(t.patch), inserts: preInserts(t, true), pre: t.pre ? copy(t.pre) : null })
async function prePut (t, d) {
  const turn = t._preTurn = (t._preTurn || 0) + 1
  for (const i of t.inserts || []) if (NAT && i.uid && !i.out && !i.dead) NAT.call('remove', { track: t.id, uid: i.uid })
  /* its plug-ins stand on the wall at once, each in its place, and are opened one after another (wall.js draws and plays
     the place of one that is not open yet as a thing the sound goes by) */
  t.inserts = (d.inserts || []).map(i => ({ uid: 0, name: i.name || 'plug-in', fmt: i.fmt || '', id: i.id, state: i.state || '', off: !!i.off, key: i.key || 0, n: i.n || 0, pn: i.pn || null, dead: true, busy: true }))
  t.wall = d.wall && Array.isArray(d.wall.nodes) ? copy(d.wall) : preEmpty()
  t.wall.z = 0                                                                           // (it is fitted to the panel anew)
  t.patch = d.patch && d.patch.A ? copy(d.patch) : NO_PATCH()
  if (WALL.sel && WALL.sel.t === t.id) WALL.sel = null
  WALL.sent.set(t.id, ''); WALL.bad.delete(t.id)                                          // (told anew whatever stands on it — an empty wall too: the engine still holds the one taken off)
  wallOf(t)
  if (t === OUT) await wallPushOut(); else { pushTrack(t); wallPush(t) }
  uiDirty('dock', 'head', 'lanes')
  const left = []
  for (const ins of t.inserts.slice()) {
    const r = NAT ? await NAT.call('insert', { track: t.id, id: ins.id, state: ins.state, show: 0 }) : null
    ins.busy = false
    if (t._preTurn !== turn || !t.inserts.includes(ins)) { if (r && r.ok) NAT.call('remove', { track: t.id, uid: r.uid }); if (t._preTurn !== turn) return left; continue }      // (another patch was put up meanwhile)
    if (r && r.ok) { ins.uid = r.uid; ins.dead = false; ins.sc = !!r.key; ins.name = r.name || ins.name; ins.fmt = r.fmt || ins.fmt; if (ins.off) NAT.call('bypass', { track: t.id, uid: r.uid, off: 1 }); if (typeof keyTold === 'function' && t !== OUT) keyTold(t, ins) }
    else { ins.dead = false; ins.out = true; left.push(ins.name) }                       // it would not open: its place and its settings stay on the wall
    WALL.sent.set(t.id, '')
    if (t === OUT) await wallPushOut(); else wallPush(t)
    uiDirty('dock')
  }
  return left
}
/* a preset put on the wall of the track the panel shows: one step */
async function presetTake (d, name) {
  const t = wallTrack()
  if (!t || PRE.busy) return false
  PRE.busy = true
  try {
    await preFresh(t)
    const before = editState()
    before.pre = { t: t.id, was: preKeep(t) }
    commit(before)
    t.pre = { name, key: '' }
    const left = await prePut(t, d)
    if (t.pre && t.pre.name === name) t.pre.key = presetKey(t)
    const notes = []
    if (left.length) notes.push(`would not open: ${left.join(', ').toLowerCase()}`)
    if (d.left) notes.push(d.left === 1 ? 'one thing this wall has no print for was left out' : `${d.left} things this wall has no print for were left out`)
    if (notes.length) say(notes.join('. '))
  } finally { PRE.busy = false; PRE.open = false; PRE.sure = null; uiDirty('dock', 'head') }
  return true
}
function preRead2 (json) {
  let g = null
  try { g = JSON.parse(json) } catch (e) { g = null }
  if (!g || typeof g !== 'object' || (!Array.isArray(g.nodes) && !g.slurStudio)) { say('that is not a patch'); return null }
  const own = g.slurStudio
  return own && own.wall && Array.isArray(own.wall.nodes) ? { wall: own.wall, patch: own.patch, inserts: Array.isArray(own.inserts) ? own.inserts : [] } : preFromGraph(g)
}
async function presetLoad (name) {
  if (name === PRE_FIRST) return presetTake({ wall: preEmpty(), patch: NO_PATCH(), inserts: [] }, PRE_FIRST)
  const json = await preRead(name), d = json ? preRead2(json) : null
  if (!d) { if (!json) { say('that preset is not there any more'); await presetRefresh() } return false }
  return presetTake(d, name)
}
async function presetSave (name) {
  const t = wallTrack()
  name = preClean(name)
  if (!t || !name || name === PRE_FIRST || PRE.busy) return false
  await preFresh(t)
  const ok = await preWrite(name, presetJson(t))
  if (ok) { t.pre = { name, key: presetKey(t) }; await presetRefresh() } else say('the preset could not be written')
  PRE.open = false; PRE.sure = null; uiDirty('dock', 'head')
  return ok
}
/* save as…: the Mac's own panel, on the presets' folder (a browser has none: the name is asked for) */
async function presetSaveAs () {
  const t = wallTrack()
  if (!t || PRE.busy) return false
  const now = t.pre && t.pre.name !== PRE_FIRST ? t.pre.name : 'untitled'
  PRE.open = false; PRE.sure = null; uiDirty('dock')
  if (!NAT) { const typed = preClean(window.prompt('name', now === 'untitled' ? '' : now) || ''); return typed ? presetSave(typed) : false }
  await preFresh(t)
  const r = await NAT.call('presetSaveAs', { name: now, json: presetJson(t), panel: PRE.panel })
  if (!r || !r.ok) return false
  t.pre = { name: String(r.name), key: presetKey(t) }
  await presetRefresh(); uiDirty('dock', 'head')
  return true
}
/* open…: a file kept anywhere */
async function presetOpen (name) {
  if (!NAT || PRE.busy) return false
  PRE.open = false; PRE.sure = null; uiDirty('dock')
  const r = await NAT.call('presetOpen', { panel: PRE.panel, name: name || '' })
  const d = r && r.ok ? preRead2(String(r.json || '')) : null
  if (!d) return false
  const ok = await presetTake(d, String(r.name))
  await presetRefresh()
  return ok
}
async function presetRemove (name) {
  const ok = await preDrop(name)
  if (ok) for (const t of S.tracks.concat(OUT)) if (t.pre && t.pre.name === name) t.pre = null
  PRE.sure = null
  await presetRefresh()
  return ok
}
const presetNames = () => [PRE_FIRST].concat(PRE.list)
function presetStep (dir) {
  const t = wallTrack(), all = presetNames()
  if (!t || PRE.busy) return
  const i = t.pre ? all.indexOf(t.pre.name) : -1
  return presetLoad(all[(i + dir + all.length) % all.length])
}

/* ── undo and redo: a step that put a patch up carries the wall it took off ── */
{
  const turn = (from, to, step0) => function () {
    const st = from[from.length - 1]
    if (!st || !st.pre || S.rec) return step0()
    const t = preTrack(st.pre.t), now = t ? preKeep(t) : null
    step0()
    const back = to[to.length - 1]
    if (back && now) back.pre = { t: st.pre.t, was: now }
    if (t) { t.pre = st.pre.was.pre ? copy(st.pre.was.pre) : null; prePut(t, st.pre.was).then(() => uiDirty('dock', 'head')) }
  }
  undoEdit = turn(UNDO, REDO, undoEdit); redoEdit = turn(REDO, UNDO, redoEdit)
  if (typeof KEYS !== 'undefined') { KEYS['⌘KeyZ'] = () => undoEdit(); KEYS['⇧⌘KeyZ'] = () => redoEdit() }
}

/* ── drawn: the bar in the panel's head, and its list over the wall ── */
function presetBar (y) {
  const t = wallTrack()
  PRE.geo = null
  if (!t) return ''
  const nx = typeof pRoll === 'function' ? 168 : 120, by = y + 16.6, cw = RX - SIDE
  const nameW = WALL.out ? tw('stereo out', 10.5, 500) + 7 + tw('before its fader', 9.5) : tw(fit(asGiven(t.name), 160, 10.5, 500), 10.5, 500) + 7 + tw(`track ${S.sel + 1}`, 9.5)
  const left = nx + 12 + nameW + 18 + 22, right = cw - (NAT ? 12 + keyW('plug-ins') + 16 : 6) - 22, bw = Math.min(196, right - left)
  if (bw < 90) return ''
  const x = Math.round(clamp(cw / 2 - bw / 2, left, right - bw)), name = t.pre ? t.pre.name : 'untitled', given = !!t.pre && t.pre.name !== PRE_FIRST
  const chev = (cx, dir) => P(`M${n(cx - dir * 2)} ${n(y + 9)}L${n(cx + dir * 2)} ${n(y + 13)}L${n(cx - dir * 2)} ${n(y + 17)}`, { stroke: INK, sa: .5, sw: 1.1, cap: 'round' })
  const label = fit(given ? asGiven(name + (presetDirty(t) ? ' *' : '')) : name, bw - 30, 10.5, 500)
  PRE.geo = { x, y, bw }
  return chev(x - 12, -1) + chev(x + bw + 12, 1) + R(x + .5, y + 4.5, bw - 1, 17, { rx: 1.5, fill: PRE.open ? K3 : K2, stroke: INK, sa: PRE.open ? .42 : .22 }) +
    T(x + 9, by, label, { size: 10.5, w: 500, a: .88, it: !given && !!t.pre }) + caret(x + bw - 11, y + 13, .5) +
    hit(x - 22, y + 2, 20, PH - 4, 'pre', ' data-k="prev"') + hit(x + bw + 2, y + 2, 20, PH - 4, 'pre', ' data-k="next"') + hit(x, y + 2, bw, PH - 4, 'pre', ' data-k="box"')
}
function presetList () {
  const g = PRE.geo, t = wallTrack()
  if (!g || !t) return ''
  const rh = 22, lw = 250, cw = RX - SIDE, lx = Math.round(clamp(g.x + g.bw / 2 - lw / 2, 4, Math.max(4, cw - lw - 4))), ly = g.y + PH + 3
  const fits = Math.max(1, Math.floor((H - FOOT_H - 8 - ly - (4 + rh + 9 + 9 + 26)) / rh)), rows = PRE.list, shown = Math.min(fits, Math.max(1, rows.length))
  PRE.top = clamp(PRE.top, 0, Math.max(0, rows.length - shown))
  const lh = 4 + rh + 9 + shown * rh + 9 + 26, on = t.pre ? t.pre.name : null
  let s = hit(lx, ly, lw, lh, 'pre', ' data-k="list"', 'default') + R(lx + .5, ly + .5, lw - 1, lh - 1, { rx: 2, fill: K2, stroke: INK, sa: .3 }), yy = ly + 4
  if (PRE.hover === -1) s += R(lx + 1, yy, lw - 2, rh, { fill: INK, fa: .05 })
  s += T(lx + 12, yy + 15, PRE_FIRST, { size: 10.5, it: true, a: on === PRE_FIRST ? 1 : .7 }) + hit(lx + 1, yy, lw - 2, rh, 'pre', ' data-k="first" data-i="-1"'); yy += rh
  s += hline(lx + 10, lx + lw - 10, yy + 4, .14); yy += 9
  if (!rows.length) s += T(lx + 12, yy + 15, 'no presets yet', { size: 10.5, it: true, a: .42 })
  for (let k = 0; k < Math.min(shown, rows.length); k++) {
    const i = PRE.top + k, nm = rows[i], y0 = yy + k * rh, here = on === nm, hov = PRE.hover === i, sure = PRE.sure === nm, word = sure ? 'sure?' : 'remove', ww = tw(word, 9.5)
    if (hov) s += R(lx + 1, y0, lw - 2, rh, { fill: INK, fa: .05 })
    s += T(lx + 12, y0 + 15, fit(asGiven(nm), lw - 36 - ww, 10.5, here ? 500 : 400), { size: 10.5, w: here ? 500 : 400, a: here ? 1 : .7 }) + T(lx + lw - 12, y0 + 15, word, { size: 9.5, a: sure ? .9 : hov ? .6 : .34, anchor: 'end' })
    s += hit(lx + 1, y0, lw - 26 - ww, rh, 'pre', ` data-k="pick" data-i="${i}"`) + hit(lx + lw - 20 - ww, y0, ww + 19, rh, 'pre', ` data-k="rm" data-i="${i}"`)
  }
  if (rows.length > shown) { const th = shown * rh, bh = Math.max(14, th * shown / rows.length); s += R(lx + lw - 4, yy + (th - bh) * PRE.top / (rows.length - shown), 2, bh, { rx: 1, fill: INK, fa: .3 }) }
  yy += shown * rh
  s += hline(lx + 1, lx + lw - 1, yy + 4, .14); yy += 9
  let ax = lx + 12
  for (const [word, k, live] of [['save', 'save', !!t.pre && t.pre.name !== PRE_FIRST], ['save as…', 'saveas', true], ['open…', 'open', !!NAT]]) { if (!live) continue; const ww = tw(word, 10.5); s += T(ax, yy + 15, word, { size: 10.5, a: .88 }) + hit(ax - 6, yy + 1, ww + 12, 22, 'pre', ` data-k="${k}"`); ax += ww + 16 }
  return s
}
function presetPress (k, i) {
  const name = i >= 0 ? PRE.list[i] : null
  if (k === 'box') { PRE.open = !PRE.open; PRE.sure = null; PRE.hover = null; if (PRE.open) presetRefresh() }
  else if (k === 'prev' || k === 'next') { PRE.open = false; presetStep(k === 'prev' ? -1 : 1) }
  else if (k === 'first') presetLoad(PRE_FIRST)
  else if (k === 'pick' && name) presetLoad(name)
  else if (k === 'rm' && name) { if (PRE.sure === name) presetRemove(name); else PRE.sure = name }
  else if (k === 'save') { const t = wallTrack(); if (t && t.pre) presetSave(t.pre.name) }
  else if (k === 'saveas') presetSaveAs()
  else if (k === 'open') presetOpen()
  uiDirty('dock')
}

/* ── joined to the room ── */
{
  const down0 = onDown, move0 = onMove, wheel0 = onWheel, head0 = pPanelHead, dock0 = PARTS.dock
  pPanelHead = function (y, tab) { const s = head0(y, tab); return tab === 'patch' ? s + presetBar(y) : s }
  PARTS.dock = function () { PRE.geo = null; const s = dock0(); return s + (PRE.open && PRE.geo ? presetList() : '') }
  const put = () => { if (PRE.open) { PRE.open = false; PRE.sure = null; PRE.hover = null; uiDirty('dock') } }
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null
    if (el && el.dataset.a === 'pre') { e.preventDefault(); if (e.button === 0 || e.button == null) presetPress(el.dataset.k, el.dataset.i == null ? -1 : +el.dataset.i); return }
    put()                                                                                // a press anywhere else puts the list away, and does what it does
    down0(e)
  }
  onMove = function (e) {
    if (PRE.open) { const el = e.target.closest ? e.target.closest('[data-a="pre"]') : null, h = el && el.dataset.i != null ? +el.dataset.i : null; if (h !== PRE.hover) { PRE.hover = h; if (PRE.sure && (h == null || PRE.list[h] !== PRE.sure)) PRE.sure = null; uiDirty('dock') } }
    move0(e)
  }
  onWheel = function (e) {
    const el = PRE.open && e.target.closest ? e.target.closest('[data-a="pre"]') : null
    if (el) { e.preventDefault(); PRE.top += Math.sign(e.deltaY); uiDirty('dock'); return }
    wheel0(e)
  }
  addEventListener('keydown', e => { if (PRE.open && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); put() } }, true)
  presetRefresh()
}
