/* ── ways: what a way does, on the tracks ──
   A way is a few steps on the tracks' walls and plug-ins (an eq, a duck, a carve, a compressor, a print, the fader), made
   by the planner (plan.js: targets along the ears' lines, moves, ways that differ in how) from what the ears heard. Here:
   the tracks as they stand, kept and put back in one step; what was heard of two tracks that meet; each step put on, set
   again and taken off (an eq: his first choice, else the room's own, eqOwnPut). The page that asked for ways in words is
   gone (his ask, 2026-10-22: no prompt in the room); this stays for the mix doctor, which offers ways for what it hears.
   Read after wall.js, side.js, macro.js, probe.js, ears.js and plan.js. */
const WAYS = { on: false, want: '', words: '', a: 0, b: 0, range: null, heard: null, ways: [], hear: 0, used: 0, busy: '', base: null, edit: null, list: null, top: 0 }
const MAC_EQ = 'AudioUnit:Effects/aufx,nbeq,appl'
const OWN_EQ = 'own'                                                                       // an eq made of the room's own prints (eqOwnPut)
const db2p = db => Math.pow(10, db / 10), p2db = p => 10 * Math.log10(Math.max(p, 1e-14))
const qToOct = q => 2 / Math.LN2 * Math.asinh(1 / (2 * q))                                // (an eq's q as the octaves its bandwidth spans)

/* ── the tracks as they stand: their walls (a plug-in's node kept by its id), what the side plays, their plug-ins, their level ── */
const wallKeep = w => w ? Object.assign({}, w, { in: Object.assign({}, w.in), out: Object.assign({}, w.out), wires: w.wires.map(e => Object.assign({}, e)),
  nodes: w.nodes.map(n => n.k === 'plug' ? Object.assign({}, n, { ins: undefined, insUid: n.ins ? n.ins.uid : null }) : JSON.parse(JSON.stringify(n))) }) : null
const waysSnap = ids => ids.map(id => byId(id)).filter(Boolean).map(t => ({ id: t.id, wall: wallKeep(t.wall), side: t.sideFrom || 0, vol: t.vol, patch: t.patch ? JSON.parse(JSON.stringify(t.patch)) : null,
  ins: (t.inserts || []).map(i => ({ uid: i.uid, id: i.id, set: i.waysSet ? i.waysSet.slice() : null })) }))
/* the tracks as a snapshot had them: plug-ins put on since are taken off, ones taken off since are put back (with what was set on them) */
async function waysBack (snap) {
  for (const x of snap) {
    const t = byId(x.id)
    if (!t) continue
    const keep = new Set(x.ins.map(i => i.uid)), uidMap = new Map()
    for (const i of (t.inserts || []).slice()) if (!keep.has(i.uid)) { if (NAT && i.uid) await NAT.call('remove', { track: t.id, uid: i.uid }); t.inserts.splice(t.inserts.indexOf(i), 1) }
    for (const i of x.ins) if (!t.inserts.some(q => q.uid === i.uid) && i.id && NAT) {
      PROBE.quiet++
      const r = await natInsert(S.tracks.indexOf(t), i.id).finally(() => PROBE.quiet--)
      if (r && r.ok) { const ni = t.inserts.find(q => q.uid === r.uid); uidMap.set(i.uid, r.uid); if (ni && i.set) { ni.waysSet = i.set.slice(); for (const [k, v] of i.set) await NAT.call('paramSet', { track: t.id, uid: ni.uid, index: k, v }) } }
    }
    if (x.wall) {
      const w = wallKeep(x.wall)
      w.nodes = w.nodes.map(n => { if (n.k !== 'plug') return n; const uid = uidMap.get(n.insUid) || n.insUid, ins = t.inserts.find(q => q.uid === uid); const m = Object.assign({}, n, { ins }); delete m.insUid; return m }).filter(n => n.k !== 'plug' || n.ins)
      t.wall = w
    } else delete t.wall
    if ((t.sideFrom || 0) !== x.side && typeof sideSet === 'function') await sideSet(t, x.side)
    t.vol = x.vol
    if (x.patch) t.patch = JSON.parse(JSON.stringify(x.patch))
    wallOf(t); await wallPush(t); pushTrack(t)
  }
  applyAll(); uiDirty('dock', 'head', 'lanes')
}
/* a step back or forward that holds walls brings them back as well (an undo step otherwise knows only the song's own parts) */
{
  const u0 = undoEdit, r0 = redoEdit
  undoEdit = function () { const st = UNDO[UNDO.length - 1], cur = st && st.walls ? waysSnap(st.walls.map(x => x.id)) : null; u0(); if (cur && REDO.length) REDO[REDO.length - 1].walls = cur; if (st && st.walls) { waysBack(st.walls); if (WAYS.on) { WAYS.used = 0; WAYS.hear = 0; uiDirty('dock') } } }
  redoEdit = function () { const st = REDO[REDO.length - 1], cur = st && st.walls ? waysSnap(st.walls.map(x => x.id)) : null; r0(); if (cur && UNDO.length) UNDO[UNDO.length - 1].walls = cur; if (st && st.walls) waysBack(st.walls) }
}

/* ── what was heard ── */
function waysHeard (res, ids) {
  const C = res.centres, H = ids.map(id => res.tracks.find(x => x.id === id)).filter(Boolean)
  if (H.length < 2 || !H.every(h => h.bands && h.bands.length)) return null
  const info = H.map(h => {
    const mx = Math.max(...h.level), act = h.level.map(l => l > mx - 30)
    const mean = C.map((_, b) => { let s = 0, n = 0; h.bands.forEach((f, i) => { if (act[i]) { s += db2p(f[b]); n++ } }); return n ? p2db(s / n) : -120 })
    const hits = []; for (let i = 1; i < h.level.length; i++) if (h.level[i] - h.level[i - 1] >= 6 && h.level[i] > mx - 24 && (!hits.length || i - hits[hits.length - 1] > 2)) hits.push(i)
    const level = p2db(h.level.reduce((s, l) => s + db2p(l), 0) / h.level.length)
    return { id: h.id, h, mx, act, mean, hits, level, busy: act.filter(Boolean).length / act.length }
  })
  /* the one with the hits keeps its place; the other gives way */
  const [A, B] = info[0].hits.length / Math.max(1, info[0].busy * 100) >= info[1].hits.length / Math.max(1, info[1].busy * 100) ? info : [info[1], info[0]]
  const peak = (m, i0, i1) => { let k = i0; for (let b = i0; b <= i1; b++) if (m[b] > m[k]) k = b; return k }
  const kA = peak(A.mean, 2, 9), kB = peak(B.mean, 2, 11), topA = A.mean[kA], topB = B.mean[kB]
  let lo = 99, hi = -1
  for (let b = 1; b <= 12; b++) if (A.mean[b] >= topA - 10 && B.mean[b] >= topB - 10) { lo = Math.min(lo, b); hi = Math.max(hi, b) }
  if (hi < 0) { lo = Math.max(1, kA - 1); hi = kA + 1 }
  const band = [C[lo] / Math.pow(2, 1 / 6), C[hi] * Math.pow(2, 1 / 6)].map(f => Math.round(f))
  const covered = A.hits.filter(i => [i, i + 1].some(f => f < B.h.bands.length && f < A.h.bands.length && Array.from({ length: hi - lo + 1 }, (_, j) => lo + j).some(b => B.h.bands[f][b] >= A.h.bands[f][b] - 3))).length
  return { centres: C, hop: res.hop, a: A.id, b: B.id, A, B, fA: C[kA], fB: C[kB], lo: band[0], hi: band[1], loB: lo, hiB: hi, hits: A.hits.length, covered, longer: B.busy > A.busy * 1.2 }
}
/* how much quieter the one that gives way is on the hits of the other, in the bands where they meet, and over all (from a fresh listen) */
/* where the one that keeps its place hits, from its loudness every 5 ms (tenths of a db): a rise of 6 db on the 20 ms
   before it, within 24 db of its loudest, 100 ms after the last */
function waysHits (fast, sec) {
  const mx = Math.max(...fast), gap = Math.round(.1 / sec), out = []
  for (let i = 4; i < fast.length; i++) if (fast[i] - Math.min(fast[i - 1], fast[i - 2], fast[i - 3], fast[i - 4]) >= 60 && fast[i] > mx - 240 && (!out.length || i - out[out.length - 1] >= gap)) out.push(i)
  return out
}
/* how far the other gave way on those hits, where they meet: in the 150 ms from each hit, its loudness between lo and hi
   with the way against without it — the deepest of it (three 5 ms steps, as a meter of gain reduction shows it), over the
   hits where it was sounding. Without those (an engine that does not give them), the frames of bands, smeared. */
function waysDuck (h0, h1, hd) {
  const all = h => p2db(h.level.reduce((s, l) => s + db2p(l), 0) / h.level.length)
  if (h0.near && h1.near && hd.fastHits && hd.fastHits.length) {
    const n0 = h0.near, n1 = h1.near, mx = Math.max(...n0), w = Math.round(.15 / hd.fastSec), gr = []
    for (const j of hd.fastHits) {
      const d = []
      for (let k = j; k < Math.min(j + w, n0.length, n1.length); k++) if (n0[k] > mx - 300) d.push((n1[k] - n0[k]) / 10)
      if (d.length >= 3) { d.sort((x, y) => x - y); gr.push((d[0] + d[1] + d[2]) / 3) }
    }
    if (gr.length) return { hits: gr.reduce((q, x) => q + x, 0) / gr.length, level: all(h1) - all(h0), n: gr.length }
  }
  const on = (h, f) => { let s = 0; for (let b = hd.loB; b <= hd.hiB; b++) s += db2p(h.bands[f][b]); return s }
  let a = 0, b = 0
  for (const i of hd.A.hits) for (const f of [i, i + 1]) if (f < h0.bands.length && f < h1.bands.length) { a += on(h0, f); b += on(h1, f) }
  return { hits: a && b ? p2db(b) - p2db(a) : 0, level: all(h1) - all(h0) }
}

/* the one that gives way, between where they meet, as it is (each way's duck or carve is measured against it), and the
   other's hits every 5 ms */
async function waysNear (hd, res, range) {
  hd.fastSec = res && res.fast ? res.fast : 256 / 48000
  hd.fastHits = hd.A.h.fast ? waysHits(hd.A.h.fast, hd.fastSec || 256 / 48000) : []
  const r0 = await NAT.call('listen', { a0: range[0], a1: range[1], tracks: [hd.b], band: [hd.lo, hd.hi] })
  const b0 = r0 && r0.ok ? r0.tracks.find(x => x.id === hd.b) : null
  if (b0) hd.B0 = b0
}

/* the comp's knob for a duck of so many db on the key's loudest hits: its threshold that far under them, given the ratio */
const duckAmount = (hd, st) => { const thr = clamp(hd.A.mx + 3 - (st.depth + (st.fix || 0)) / (1 - 1 / st.ratio), -60, 0); return +(-thr / 60).toFixed(4) }      // (fix: what one hearing of it found short, or over)

/* his first choice of a kind (settings > plug-ins, first choices: firstpage.js) as {plug, plugName}, or null: the room's own */
async function firstOf (kind) {
  if (!NAT) return null
  const p = await NAT.call('prefGet'), id = p && p.firstChoice && p.firstChoice[kind]
  if (!id || id === 'own') return null
  const list = (S.picker && S.picker.list && S.picker.list.length ? S.picker.list : await NAT.call('plugins')) || [], pl = list.find(x => x.id === id)
  return pl ? { plug: id, plugName: String(pl.name).toLowerCase().replace(/^(fabfilter|uadx?) /, '') } : null
}

/* ── what a way does, on the tracks ── */
/* an eq put on and set: what its controls are was learnt by what it does (probe.js) — the first time it is used, then
   kept; none is written out by hand. Whatever it gives is measured again with the way (waysMeasure). */
async function eqPut (t, st) {
  PROBE.quiet++
  const r = await natInsert(S.tracks.indexOf(t), st.plug).finally(() => PROBE.quiet--)
  if (!(r && r.ok)) return { ok: false, why: `${st.plugName} would not open` }
  const ins = t.inserts.find(i => i.uid === r.uid), name = String(ins.name).toLowerCase()
  let map = await learntOf(ins)
  if (!map || map.kind !== 'eq') { const was = WAYS.busy; WAYS.busy = `learning ${name}`; uiDirty('dock'); map = await learnPlug(t, ins, 'eq'); WAYS.busy = was; uiDirty('dock') }
  if (map.kind !== 'eq') return { ok: false, why: `${name}: ${map.why || 'no band of it could be found'}` }
  if (map.bands.length < st.bands.length) return { ok: false, why: `${name} has too few bands for this` }
  ins.waysSet = []
  for (let k = 0; k < st.bands.length; k++) await learntBell(t, ins, map, k, st.bands[k])
  st._uid = ins.uid
  return { ok: true, ins }
}
/* an eq of the room's own (his word, 2026-10-21: what the prompt does to a sound it does with the room's prints, never the
   Mac's eq). A lean of the whole — a band down low and one up high, the one raised as the other is lowered — is the tone
   print. Anything else is the bands print, cut at the edges of each bell (the octaves its q spans), with the band between
   them raised or lowered by a gain print and the rest going by as it is: no lateness, nothing learnt. */
const eqEdges = b => { const half = Math.max(.3, qToOct(b.q) / 2); return [clamp(b.f / Math.pow(2, half), 20, 20000), clamp(b.f * Math.pow(2, half), 20, 20000)] }      // (never narrower than 0.6 of an octave: the bands' own slopes would leave a narrower band hardly touched)
const gainAmount = db => db >= 0 ? clamp(.75 + db / 48, .75, 1) : clamp(.75 * (1 + db / 60), 0, .75)      // (the gain print: .75 unity, the top quarter +12 dB, the bottom −60)
const eqTilted = st => st.bands.length === 2 && Math.round(st.bands[0].f) === 120 && Math.round(st.bands[1].f) === 6000 && st.bands[0].g === -st.bands[1].g
function eqSplit (st) {                                                                   // where the bands print cuts (five at most), and how far each band is raised or lowered
  const edges = [...new Set(st.bands.flatMap(eqEdges).map(Math.round))].sort((a, b) => a - b)
  while (edges.length > PC.MAX_CROSS) { let k = 0, best = Infinity; for (let i = 0; i + 1 < edges.length; i++) if (edges[i + 1] / edges[i] < best) { best = edges[i + 1] / edges[i]; k = i } edges.splice(k, 2, Math.round(Math.sqrt(edges[k] * edges[k + 1]))) }
  const gains = Array.from({ length: edges.length + 1 }, (_, r) => {
    const mid = Math.sqrt((r ? edges[r - 1] : 20) * (r < edges.length ? edges[r] : 20000))
    return st.bands.reduce((g, b) => { const [l, h] = eqEdges(b); return mid >= l && mid <= h ? g + b.g : g }, 0)
  })
  return { edges, gains }
}
const wallPut = (w, k) => { const id = wallFree(w); if (id < 0) return null; const at = wallSpot(w), node = Object.assign(wallNew(k, at.x, at.y), { id }); w.nodes.push(node); return node }
async function eqOwnPut (t, st) {
  const w = wallOf(t)
  st._nodes = []
  if (eqTilted(st)) {
    const node = wallPut(w, 'tone')
    if (!node) return { ok: false, why: 'no room on the wall' }
    node.amount = clamp(.5 + st.bands[1].g / 12, 0, 1)                                 // (the tone print: ±6 db, a shelf at 300 hz down as one at 2.8 khz goes up)
    st._nodes = [node.id]; st._shape = 'tilt'
    wallAppend(w, node.id); await wallPush(t)
    return { ok: true }
  }
  /* a narrow bell (a ring) is cut a second time, by a split of its own after the first: one split alone takes too little of
     a band that narrow (the others are cut once) */
  const splits = eqSplits(st)
  st._shape = eqShape(splits)
  let outs = null
  for (const { edges, gains } of splits) {
    const B = wallPut(w, 'bands')
    if (!B) return { ok: false, why: 'no room on the wall' }
    B.aux = PC.bandsPut(B.aux || [0, 0, 0, 0, 0, 0, 0, 0], edges)
    st._nodes.push(B.id)
    if (!outs) { wallAppend(w, B.id); w.wires = w.wires.filter(e => !(e.from === B.id && e.to === WALL_OUT)) }      // (what went to the out goes into the bands; each band goes on from there)
    else for (const o of outs) w.wires.push({ from: o.id, to: B.id, gain: 1, port: o.port })
    outs = []
    for (let r = 0; r <= edges.length; r++) {
      if (Math.abs(gains[r]) < .05) { outs.push({ id: B.id, port: r }); continue }
      const G = wallPut(w, 'gain')
      if (!G) return { ok: false, why: 'no room on the wall' }
      G.amount = gainAmount(gains[r]); st._nodes.push(G.id)
      w.wires.push({ from: B.id, to: G.id, gain: 1, port: r }); outs.push({ id: G.id, port: 0 })
    }
  }
  for (const o of outs) w.wires.push({ from: o.id, to: WALL_OUT, gain: 1, port: o.port })
  await wallPush(t)
  return { ok: true }
}
const eqSplits = st => { const narrow = st.bands.filter(b => b.q >= 3); return [eqSplit(st)].concat(narrow.length ? [eqSplit({ bands: narrow })] : []) }
const eqShape = splits => splits.map(({ edges, gains }) => edges.join(',') + '|' + gains.map(g => Math.abs(g) < .05 ? 0 : 1).join('')).join(' ')
/* the same eq turned (its gains only): false when it must be made again (where it cuts has moved) */
async function eqOwnRe (t, st) {
  const nodes = (st._nodes || []).map(id => (wallOf(t).nodes || []).find(n => n.id === id))
  if (!nodes.length || nodes.some(n => !n)) return false
  if (st._shape === 'tilt') { if (!eqTilted(st)) return false; nodes[0].amount = clamp(.5 + st.bands[1].g / 12, 0, 1); await wallPush(t); return true }
  const splits = eqSplits(st)
  if (st._shape !== eqShape(splits)) return false
  let k = 0
  for (const { gains } of splits) { k++; for (const g of gains) if (Math.abs(g) >= .05) nodes[k++].amount = gainAmount(g) }      // (each split: its bands, then its gains)
  await wallPush(t)
  return true
}
/* a print's node on the wall set from its step (a duck keyed through the side, a carve, a compressor, the stereo) */
function stepNode (st, node) {
  if (st.kind === 'print') node.amount = clamp(st.amount, 0, 1)
  else if (st.kind === 'comp') { node.amount = clamp(-st.thr / 60, 0, 1); node.aux = [Math.round(st.ratio * 10), Math.round(st.attack * 10), Math.round(st.release), 6, 0, 0, 0, 0]; node.variant = 0 }
  else if (st.kind === 'duck') { node.amount = duckAmount(WAYS.H.pair, st); node.aux = [Math.round(st.ratio * 10), Math.round(st.attack * 10), Math.round(st.release), 6, 0, 0, 0, 0]; node.variant = 0 }
  else { node.amount = clamp(st.depth * (st.k || 1) / 24, 0, 1); node.aux = [Math.round(st.attack), Math.round(st.release), Math.round(st.lo), Math.round(st.hi), 0, 0, 0, 0] }      // (k: how much harder the carve is turned than it gives — it cuts as deep as the key is loud — found by hearing it)
}
/* a step that is on, changed where it stands (its amounts only): false if what it put on is not there to change */
async function stepRe (st) {
  const t = byId(st.track)
  if (!t) return false
  if (st.kind === 'gain') { const b = WAYS.base.find(x => x.id === t.id); t.vol = clamp(Math.round(((b ? b.vol : t.vol) + st.db) * 10) / 10, -48, 6); pushTrack(t); return true }
  if (st.kind === 'patch') { setPrint(t, st.print, clamp(st.value, 0, 100)); flush(); wallOf(t); await wallPush(t); pushTrack(t); return true }
  if (st.kind === 'eq' && (!st.plug || st.plug === OWN_EQ)) return eqOwnRe(t, st)
  if (st.kind === 'eq') {
    const ins = t.inserts.find(i => i.uid === st._uid), map = ins ? await learntOf(ins) : null
    if (!ins || !map || map.kind !== 'eq') return false
    ins.waysSet = []
    for (let k = 0; k < st.bands.length; k++) await learntBell(t, ins, map, k, st.bands[k])
    return true
  }
  const node = (wallOf(t).nodes || []).find(n => n.id === st._node)
  if (!node) return false
  stepNode(st, node)
  await wallPush(t)
  return true
}
async function stepDo (st) {
  const t = byId(st.track)
  if (!t) return { ok: false, why: 'the track is gone' }
  if (st.kind === 'eq' && (!st.plug || st.plug === OWN_EQ)) return eqOwnPut(t, st)
  if (st.kind === 'eq') { if (!NAT) return { ok: false, why: 'plug-ins are put on in the app' }; return eqPut(t, st) }
  if (st.kind === 'gain') { t.vol = clamp(Math.round((t.vol + st.db) * 10) / 10, -48, 6); pushTrack(t); return { ok: true } }
  if (st.kind === 'patch') { setPrint(t, st.print, clamp(st.value, 0, 100)); flush(); wallOf(t); await wallPush(t); pushTrack(t); return { ok: true } }      // (space, tape: the patch's own, one of each)
  if (st.kind === 'print' || st.kind === 'comp' || (st.kind === 'carve' && !st.key)) {     // a print of the room's on the track's wall, at the end of its way, nothing keying it
    const w = wallOf(t), focus = S.focus, sel = WALL.sel
    wallAdd(t, st.kind === 'print' ? st.print : st.kind); const node = w.nodes[w.nodes.length - 1]
    S.focus = focus; WALL.sel = sel
    if (!node) return { ok: false, why: 'no room on the wall' }
    stepNode(st, node); st._node = node.id
    wallAppend(w, node.id)
    await wallPush(t)
    return { ok: true }
  }
  const w = wallOf(t)
  if (typeof sideSet === 'function') await sideSet(t, st.key)
  const focus = S.focus, sel = WALL.sel
  wallAdd(t, 'side'); const side = w.nodes[w.nodes.length - 1]
  wallAdd(t, st.kind === 'duck' ? 'comp' : 'carve'); const node = w.nodes[w.nodes.length - 1]
  S.focus = focus; WALL.sel = sel
  if (!side || !node || side.k !== 'side') return { ok: false, why: 'no room on the wall' }
  stepNode(st, node); st._node = node.id
  wallAppend(w, node.id)
  w.wires.push({ from: side.id, to: node.id, gain: 1, port: 0, in: 1 })
  await wallPush(t)
  return { ok: true }
}
/* a way that is on, changed where it stands; put on afresh if any of it is not there */
async function wayRe (i) {
  const way = WAYS.ways[i - 1]
  if (!way) return true
  for (const st of way.steps) if (!await stepRe(st)) return wayOn(i)
  applyAll()
  return true
}
/* a way heard: the tracks as they were, then its steps */
async function wayOn (i) {
  await waysBack(WAYS.base)
  const way = WAYS.ways[i - 1]
  if (!way) return true
  for (const st of way.steps) { const r = await stepDo(st); if (!r.ok) { way.why = r.why; return false } }
  applyAll()
  return true
}
/* levels matched: while a way is heard, the stereo out is lifted or lowered by what the way took from the whole mix (or
   gave it), so that A, B, C and as it is are heard at one loudness; it is never kept — a way used leaves the out as it was */
function waysOut (db) { if (WAYS.master0 == null) return; S.master = clamp(Math.round((WAYS.master0 + (db || 0)) * 10) / 10, -48, 6); if (typeof pushMaster === 'function') pushMaster(); uiDirty('dock') }
