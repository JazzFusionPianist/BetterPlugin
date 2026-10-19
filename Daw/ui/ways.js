/* ── ways: a request made by how it should sound, answered with ways of doing it ──
   Draft: design/choices draft 1 (his "초안 지린다 ㅋㅋ 이 방향으로 가자", 2026-10-16). A line asks for something by its sound —
   "kick and bass sound apart" — not by its knobs. The app listens to the tracks over a stretch (Engine::listen), says what
   it heard, and offers ways that differ in HOW (never one way at another strength: strength is a cell), each a few steps
   on the tracks' walls and plug-ins, shaped by what was heard. Each is heard against the song as it is, at matched
   levels; one is used — never two together — and that is one step back. Every amount is a cell typed over; an eq's cell
   swaps the plug-in for another eq on this Mac whose controls the room knows.
   What the ways are, and how far each is turned, is the planner's (plan.js: targets along the ears' lines, moves, ways
   that differ in how); this page asks, puts them on and takes them off, and draws them. Kick and bass apart: A carve the
   lows (his first choice of eq, else the Mac's own), B duck the bass under the kick (the room's comp), C only where they
   meet (the room's carve) — B and C keyed by the kick through the wall's side; which of the two gives way is heard.
   Read after wall.js, side.js, macro.js, hint.js, prompt.js, probe.js, ears.js and plan.js. */
const WAYS = { on: false, want: '', words: '', a: 0, b: 0, range: null, heard: null, ways: [], hear: 0, used: 0, busy: '', base: null, edit: null, list: null, top: 0 }
const MAC_EQ = 'AudioUnit:Effects/aufx,nbeq,appl'
const WAYS_H = 372
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

/* ── asked ── */
const waysTracks = () => [WAYS.a, WAYS.b].map(byId).filter(Boolean)
function waysRange (ts) {
  if (S.cycle.on && S.cycle.b - S.cycle.a >= 1) return [S.cycle.a, S.cycle.b]
  const sc = sceneAt(curPos())
  const both = (a, b) => ts.every(t => t.regs.some(r => !r.mute && r.a - 1 < b && r.b - 1 > a))
  if (sc && sc.i >= 0 && both(sc.a - 1, sc.b - 1)) return [sc.a - 1, sc.b - 1]
  for (const s of SCENES) if (both(s.a - 1, s.b - 1)) return [s.a - 1, s.b - 1]
  return [0, Math.min(16, SONG_END)]
}
async function waysAsk (want, ids, words) {
  if (WAYS.on && !WAYS.used) await waysBack(WAYS.base)
  const targets = PLAN_WANT[want] ? PLAN_WANT[want](ids) : null
  Object.assign(WAYS, { on: true, want, words, ids, targets, heard: null, H: null, ways: [], hear: 0, used: 0, busy: 'listening', base: waysSnap(ids), edit: null, list: null, master0: S.master })
  S.panel.on = true; S.panel.tab = 'prompt'
  if (S.panel.h < WAYS_H) { WAYS.h0 = S.panel.h; S.panel.h = WAYS_H }                    // (room for a way's three rows of cells, as drawn; given back when the page goes)
  setView(); uiDirty('dock')
  if (!targets) { WAYS.busy = 'that is not asked for that way yet'; uiDirty('dock'); return }
  if (!NAT) { WAYS.busy = 'the app listens for this'; uiDirty('dock'); return }
  if (S.playing) halt(false)
  WAYS.range = waysRange(ids.map(byId).filter(Boolean))
  WAYS.eq = await firstOf('eq')
  const H = await planHear(targets, WAYS.range)
  if (!H || targets.some(tg => tg.line === 'over') && !H.pair) { WAYS.busy = 'nothing of them was heard there'; uiDirty('dock'); return }
  WAYS.H = H; H.range = WAYS.range
  for (const tg of targets) if (tg.line === 'over') tg.pair = [H.pair.a, H.pair.b]          // (the one with the hits keeps its place)
  if (H.pair) { WAYS.heard = H.pair; WAYS.a = H.pair.a; WAYS.b = H.pair.b }
  WAYS.ways = planWays(targets, H)
  const EQ = WAYS.eq || { plug: MAC_EQ, plugName: 'mac eq' }                               // (his first choice of eq, settings > plug-ins; the Mac's own else)
  for (const w of WAYS.ways) for (const st of w.steps) if (st.kind === 'eq' && !st.plug) { st.plug = EQ.plug; st.plugName = EQ.plugName }
  await waysMeasure()
  WAYS.busy = ''
  /* room for the longest way's rows of cells (a way with a helper has more): the page grows, and is given back when it goes */
  const rows = Math.max(0, ...WAYS.ways.map((w, i) => wayLines(w, i + 1).length)), need = Math.min(Math.round(H0_WAYS(rows)), Math.round(innerHeight * .62))
  if (S.panel.h < need) { if (WAYS.h0 == null) WAYS.h0 = S.panel.h; S.panel.h = need; setView() }
  uiDirty('dock')
}
const H0_WAYS = rows => 257 + rows * 27                                                   // (the page's own height for so many rows: the field, the hear row, a card's head and keys)
/* each way heard out of hearing, and turned until each target is heard as asked (plan.js); what it took from the whole
   mix is kept, for levels to be matched */
async function waysMeasure (only) {
  for (let i = 1; i <= WAYS.ways.length; i++) {
    if (only && only !== i) continue
    const way = WAYS.ways[i - 1]
    WAYS.busy = `hearing ${way.letter}`; uiDirty('dock')
    await planTune(way, WAYS.targets, WAYS.H, () => wayOn(i), () => wayRe(i))
  }
  await waysBack(WAYS.base)
  WAYS.busy = ''
}
async function waysHear (i) {
  if (WAYS.busy || WAYS.used) return
  WAYS.busy = i ? `hearing ${'ABC'[i - 1]}` : ''; uiDirty('dock')
  const ok = i ? await wayOn(i) : (await waysBack(WAYS.base), true)
  WAYS.hear = ok ? i : 0; WAYS.busy = ''
  waysOut(WAYS.hear ? WAYS.ways[WAYS.hear - 1].out : 0)
  if (!ok) say(WAYS.ways[i - 1].why || 'that way would not go on')
  uiDirty('dock')
}
async function waysUse (i) {
  if (WAYS.busy || WAYS.used) return
  if (WAYS.hear !== i) await waysHear(i)
  if (WAYS.hear !== i) return
  const st = Object.assign(editState(), { mix: mixState().map(x => { const b = WAYS.base.find(q => q.id === x.id); return b ? Object.assign(x, { vol: b.vol }) : x }), walls: WAYS.base })
  UNDO.push(st); if (UNDO.length > 120) UNDO.shift(); REDO.length = 0
  waysOut(0)                                                                              // (the matching was for hearing only)
  WAYS.used = i
  say(`${WAYS.ways[i - 1].letter} used: ${WAYS.ways[i - 1].name}`)
  uiDirty('dock', 'cmd')
}
/* the page let go of: a way heard and not used is taken off again */
async function waysClose () {
  if (!WAYS.on || WAYS.closing) return
  WAYS.closing = true                                                                     // (the room draws again while it is being let go of: once is enough)
  if (!WAYS.used && WAYS.base) await waysBack(WAYS.base)
  if (!WAYS.used) waysOut(0)
  if (WAYS.h0 != null && S.panel.h >= WAYS_H) { S.panel.h = WAYS.h0; setView() }
  WAYS.h0 = null
  WAYS.on = false; WAYS.edit = null; WAYS.list = null; WAYS.closing = false
  uiDirty('dock')
}

/* ── a cell of a way typed over: its amount, in its unit ── */
const WAY_UNIT = { f: 'hz', g: 'db', q: '', ratio: ':1', depth: 'db', attack: 'ms', release: 'ms', lo: 'hz', hi: 'hz', thr: 'db', value: '%', amount: '%', db: 'db' }
const WAY_LIM = { f: [20, 20000], g: [-24, 24], q: [.1, 10], ratio: [1, 20], depth: [0, 24], attack: [.1, 200], release: [10, 2000], lo: [20, 20000], hi: [20, 20000], thr: [-60, 0], value: [0, 100], amount: [-100, 100], db: [-24, 12] }
function waysEdit (wi, si, field, bi) {
  const way = WAYS.ways[wi - 1], st = way && way.steps[si], cur = !st ? null : bi != null ? st.bands[bi][field] : st[field]
  if (cur == null) return
  WAYS.edit = { wi, si, field, bi }
  const el = waysInput()
  el.value = field === 'depth' ? `-${cur}` : field === 'amount' ? String(Math.round((cur - .5) * 200)) : String(cur)      // (a depth is written as what it takes: −4 db; a width as how much wider: +40)
  el.style.display = 'block'; el.focus(); el.select()
  uiDirty('dock')
}
function waysInput () {
  let el = document.getElementById('ways-edit')
  if (el) return el
  el = document.createElement('input'); el.id = 'ways-edit'; el.type = 'text'; el.autocomplete = 'off'; el.spellcheck = false
  el.style.cssText = 'position:absolute;display:none;z-index:30;background:var(--k0,#111);color:var(--ink,#ecebe4);border:1px solid rgba(236,234,228,.9);border-radius:2px;font:400 10.5px/18px var(--f);padding:0 6px;outline:none'
  document.body.appendChild(el)
  el.addEventListener('keydown', e => {
    e.stopPropagation()
    if (e.key === 'Enter') waysEditDone(true); else if (e.key === 'Escape') waysEditDone(false)
  })
  el.addEventListener('blur', () => waysEditDone(true))
  return el
}
async function waysEditDone (keep) {
  const el = document.getElementById('ways-edit'), ed = WAYS.edit
  if (!el || !ed) return
  WAYS.edit = null; el.style.display = 'none'
  const way = WAYS.ways[ed.wi - 1], st = way && way.steps[ed.si], v = parseFloat(String(el.value).replace(/[−–]/g, '-'))
  if (keep && st && isFinite(v)) {
    const [lo, hi] = WAY_LIM[ed.field], x0 = clamp(ed.field === 'depth' ? Math.abs(v) : v, lo, hi), x = ed.field === 'amount' ? .5 + x0 / 200 : x0      // (−1.5 or 1.5: a depth of 1.5)
    if (ed.bi != null) st.bands[ed.bi][ed.field] = x
    else st[ed.field] = x
    if (st.kind === 'duck' || st.kind === 'carve') { delete st.fix; delete st.k }
    const d = way.drives.find(q => q.refs && q.refs.some(r => r.at === ed.si && (r.band == null || ed.bi == null || r.band === ed.bi || (q.move === 'eqTilt' && ed.bi === r.band + 1))))
    if (d && ed.field === 'depth' && st.key) { way.asked = way.asked || []; way.asked[d.target] = -x; d.held = false }      // (a duck's or a carve's depth is what it should give: turned until it does)
    else if (d && ['g', 'db', 'value', 'amount', 'thr', 'depth'].includes(ed.field)) d.held = true      // (its own amount, typed: left there, and only heard)
    WAYS.busy = 'hearing it again'; uiDirty('dock'); await waysMeasure(ed.wi); WAYS.busy = ''      // (changed: turned again until heard so, and its level matched again)
    const back = WAYS.used || WAYS.hear                                                  // (measuring took it off: what was heard, or used, goes on again — as it now says)
    if (back) { const was = WAYS.used; WAYS.used = 0; WAYS.hear = 0; await waysHear(back); WAYS.used = was; if (was) waysOut(0) }
  }
  uiDirty('dock')
}
/* an eq's cell pressed: the eqs on this Mac, those the room has learnt first; one not learnt yet is learnt as it is heard */
async function waysPlugList (wi, si, x, y) {
  const list = (S.picker && S.picker.list && S.picker.list.length ? S.picker.list : NAT ? await NAT.call('plugins') : []) || []
  const L = await learntAll()
  const eqs = list.filter(p => typeof plugCat === 'function' && plugCat(p) === 'eq' && !p.inst).map(p => ({ id: p.id, name: String(p.name).toLowerCase(), maker: String(p.maker || p.manufacturer || '').toLowerCase(), known: !!(L[learntKey(p)] && L[learntKey(p)].kind === 'eq') }))
  eqs.sort((a, b) => (b.known - a.known) || a.name.localeCompare(b.name))
  WAYS.list = { wi, si, x, y, rows: eqs.slice(0, 12) }
  uiDirty('dock')
}
async function waysPlugPick (row) {
  const L = WAYS.list
  WAYS.list = null
  if (!L) return
  const st = WAYS.ways[L.wi - 1].steps[L.si]
  st.plug = row.id; st.plugName = row.name
  if (WAYS.hear === L.wi) await waysHear(L.wi)
  uiDirty('dock')
}

/* ── drawn: the prompt's page, while it answers a request by its sound (design/choices draft 1) ── */
function waysLine (x, y, parts, o = {}) {
  const h = 20, size = 10.5
  let s = '', cx = x
  for (const p of parts) {
    const extra = p.k === 'plug' ? 14 : 0, w = Math.round(tw(asGiven(p.t), size, p.k === 'act' ? 500 : 400) + size * 1.4 + extra), dim = o.dim
    if (p.k === 'act') s += R(cx, y, w, h, { rx: 2, fill: INK, fa: dim ? .4 : 1 })
    else s += R(cx + .5, y + .5, w - 1, h - 1, { rx: 2, stroke: p.c || INK, sa: p.k === 'much' ? .5 : p.c ? .8 : .26 })
    s += T(cx + size * .7, y + h / 2 + size * .36, asGiven(p.t), { size, w: p.k === 'act' ? 500 : 400, c: p.k === 'act' ? K1 : p.c || INK, a: dim ? .35 : p.k === 'plain' ? .55 : .95 })
    if (p.k === 'plug') s += caret(cx + w - 9, y + h / 2, dim ? .2 : .55)
    if (p.a && !dim) s += hit(cx, y, w, h, p.a, p.more || '', 'text')
    if (p.edit) { const r = document.getElementById('ways-edit'); if (r && WAYS.edit) { const b = board.getBoundingClientRect(), k = b.width / W; Object.assign(r.style, { left: (b.left + cx * k) + 'px', top: (b.top + y * k) + 'px', width: Math.max(44, w - 2) * k + 'px', height: (h - 2) * k + 'px', fontSize: (size * k) + 'px', lineHeight: ((h - 2) * k) + 'px' }) } }
    cx += w + 4
  }
  return s
}
const fmtN = (x, d = 1) => (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toString().replace('-', '−')
function wayLines (way, wi) {
  const tc = t => t ? t.csel || t.c : INK, who = id => { const t = byId(id); return { t: t ? t.name : '?', c: tc(t) } }, ed = (si, field, bi) => WAYS.edit && WAYS.edit.wi === wi && WAYS.edit.si === si && WAYS.edit.field === field && (WAYS.edit.bi ?? null) === (bi ?? null)
  const much = (t, si, field, bi) => ({ t, k: 'much', a: 'ways-edit', more: ` data-w="${wi}" data-s="${si}" data-f="${field}"${bi != null ? ` data-b="${bi}"` : ''}`, edit: ed(si, field, bi) })
  const out = []
  way.steps.forEach((st, si) => {
    if (st.kind === 'eq') {
      out.push([{ t: 'put', k: 'act' }, { t: st.plugName, k: 'plug', a: 'ways-plug', more: ` data-w="${wi}" data-s="${si}"` }, { t: 'on', k: 'plain' }, who(st.track)])
      st.bands.forEach((b, bi) => out.push([who(st.track), { t: 'bell' }, much(`${Math.round(b.f)} hz`, si, 'f', bi), much(`${b.g > 0 ? '+' : ''}${fmtN(b.g)} db`, si, 'g', bi), much(`q ${fmtN(b.q)}`, si, 'q', bi)]))
    } else if (st.kind === 'duck') {
      out.push([{ t: 'put', k: 'act' }, { t: 'comp' }, { t: 'on', k: 'plain' }, who(st.track)])
      out.push([{ t: 'key', k: 'plain' }, who(st.key), much(`ratio ${fmtN(st.ratio)}:1`, si, 'ratio'), much(`−${fmtN(st.depth)} db`, si, 'depth')])
      out.push([much(`attack ${fmtN(st.attack)} ms`, si, 'attack'), much(`release ${Math.round(st.release)} ms`, si, 'release')])
    } else if (st.kind === 'carve') {
      out.push([{ t: 'put', k: 'act' }, { t: 'carve' }, { t: 'on', k: 'plain' }, who(st.track)])
      out.push([who(st.track), much(`${Math.round(st.lo)} hz`, si, 'lo'), much(`${Math.round(st.hi)} hz`, si, 'hi'), much(`up to −${fmtN(st.depth)} db`, si, 'depth')])
      if (st.key) out.push([{ t: 'key', k: 'plain' }, who(st.key), much(`attack ${fmtN(st.attack)} ms`, si, 'attack'), much(`release ${Math.round(st.release)} ms`, si, 'release')])
      else out.push([much(`attack ${fmtN(st.attack)} ms`, si, 'attack'), much(`release ${Math.round(st.release)} ms`, si, 'release')])
    } else if (st.kind === 'comp') {
      out.push([{ t: 'put', k: 'act' }, { t: 'comp' }, { t: 'on', k: 'plain' }, who(st.track)])
      out.push([who(st.track), much(`from ${fmtN(st.thr)} db`, si, 'thr'), much(`ratio ${fmtN(st.ratio)}:1`, si, 'ratio')])
      out.push([much(`attack ${fmtN(st.attack)} ms`, si, 'attack'), much(`release ${Math.round(st.release)} ms`, si, 'release')])
    } else if (st.kind === 'patch') {
      out.push([{ t: 'put', k: 'act' }, { t: st.print }, { t: 'on', k: 'plain' }, who(st.track)])
      out.push([who(st.track), { t: st.print }, much(`${Math.round(st.value)} %`, si, 'value')])
    } else if (st.kind === 'print') {
      out.push([{ t: 'put', k: 'act' }, { t: st.print }, { t: 'on', k: 'plain' }, who(st.track)])
      out.push([who(st.track), { t: 'width' }, much(`${st.amount >= .5 ? '+' : '−'}${Math.round(Math.abs(st.amount - .5) * 200)} %`, si, 'amount')])
    } else if (st.kind === 'gain') {
      out.push([who(st.track), { t: 'fader' }, much(`${st.db > 0 ? '+' : ''}${fmtN(st.db)} db`, si, 'db')])
    }
  })
  return out
}
function pWays (y, h) {
  const fx = 20, fy = y + 16, fw = RX - 40, cmd = $('cmd')
  let s = R(0, y, RX, h, { fill: K1 })
  s += R(fx + .5, fy + .5, fw, 37, { rx: 3, fill: K0, stroke: INK, sa: document.activeElement === cmd ? .6 : .36 }) + hit(fx, fy, fw, 37, 'prompt', ' data-k="field"', 'text')
  s += P(`M${fx + 14} ${fy + 13}L${fx + 20} ${fy + 19}L${fx + 14} ${fy + 25}`, { stroke: INK, sa: .9, sw: 1.5, cap: 'round' })
  const cy = fy + 37 + 18, lw = 300, bottom = y + h - 12, hd = WAYS.heard
  /* what was heard */
  s += T(fx, cy + 10, 'heard', { size: 9.5, a: .4 })
  if (WAYS.range) s += T(fx + lw, cy + 10, `bars ${Math.round(WAYS.range[0]) + 1} – ${Math.round(WAYS.range[1])}`, { size: 9.5, a: .4, anchor: 'end' })
  if (!hd && WAYS.targets && WAYS.H) {                                                   // (no two to draw: each target, its track, what is asked)
    let ty = cy + 34
    for (const tg of WAYS.targets) {
      if (ty > bottom) break
      const id = tg.pair ? tg.pair[0] : tg.on, t = byId(id), E = WAYS.H.ears[id], v = E && E[tg.line]
      s += T(fx, ty, asGiven(`${t ? t.name : 'the mix'} ${PLAN_WORD[tg.line] || tg.line}`), { size: 10, a: .45 }) + T(fx + 150, ty, asGiven(`asked ${planNum(tg, tg.amount)}`), { size: 10, a: .9 })
      if (v != null && typeof v === 'number') s += T(fx + lw, ty, tg.line === 'width' || tg.line === 'widthHigh' || tg.line === 'wet' ? `now ${Math.round(v * 100)}%` : `now ${fmtN(v)}`, { size: 9.5, a: .4, anchor: 'end' })
      ty += 18
    }
  }
  if (hd) {
    const gy = cy + 26, gh = 90, f0 = Math.log(30), f1 = Math.log(400), X = f => fx + (Math.log(f) - f0) / (f1 - f0) * lw
    const top = Math.max(...hd.A.mean.slice(1, 14), ...hd.B.mean.slice(1, 14)), Y = db => gy + gh - clamp((db - (top - 36)) / 36, 0, 1) * gh * .92
    s += R(X(hd.lo), gy, X(hd.hi) - X(hd.lo), gh, { fill: SOLO, fa: .12 }) + P(`M${X(hd.lo)} ${gy}V${gy + gh}M${X(hd.hi)} ${gy}V${gy + gh}`, { stroke: SOLO, sa: .5, dash: '2 3' })
    s += hline(fx, fx + lw, gy + gh, .14)
    for (const f of [50, 100, 200]) s += T(X(f), gy + gh + 13, `${f} hz`, { size: 8.5, a: .4, anchor: 'middle' })
    const curve = (mean, c) => { let d = ''; hd.centres.forEach((f, b) => { if (f < 25 || f > 420) return; d += (d ? 'L' : 'M') + X(clamp(f, 30, 400)).toFixed(1) + ' ' + Y(mean[b]).toFixed(1) }); return P(d, { stroke: c, sw: 1.6, sa: .95 }) }
    const A = byId(hd.a), B = byId(hd.b), ca = A ? A.csel || A.c : INK, cb = B ? B.csel || B.c : INK
    s += curve(hd.A.mean, ca) + curve(hd.B.mean, cb)
    s += T(fx + lw, gy + 10, asGiven(A ? A.name : ''), { size: 9.5, c: ca, anchor: 'end' }) + T(fx + lw, gy + 24, asGiven(B ? B.name : ''), { size: 9.5, c: cb, anchor: 'end' })
    let ty = gy + gh + 34
    for (const [a, b] of [['they meet at', `${hd.lo} – ${hd.hi} hz`], [`${A ? A.name : ''} low`, `${Math.round(hd.fA)} hz`], [`${B ? B.name : ''} low`, `${Math.round(hd.fB)} hz${hd.longer ? ', longer' : ''}`], [`${B ? B.name : ''} over the ${A ? A.name : ''}`, hd.hits ? `${Math.round(100 * hd.covered / hd.hits)}% of its hits` : 'no hits heard']]) {
      if (ty > bottom) break
      s += T(fx, ty, asGiven(a), { size: 10, a: .45 }) + T(fx + 128, ty, asGiven(b), { size: 10, a: .9 }); ty += 18
    }
  }
  s += vline(fx + lw + 24, cy, bottom, .08)
  const wx = fx + lw + 48
  if (WAYS.busy || !WAYS.ways.length) { s += T(wx, cy + 30, WAYS.busy || 'nothing to offer', { size: 11, a: .6 }); return s }
  /* hear: as it is, or one of the ways, at matched levels */
  s += T(wx, cy + 10, 'hear', { size: 9.5, a: .4 })
  const keys = [{ t: 'as it is', on: WAYS.hear === 0, a: WAYS.used ? '' : 'ways-hear', more: ' data-i="0"' }].concat(WAYS.ways.map((w, i) => ({ t: w.letter, on: WAYS.hear === i + 1, a: WAYS.used ? '' : 'ways-hear', more: ` data-i="${i + 1}"` })))
  s += cells(wx + 34, cy - 3, 18, keys, { size: 9.5, widths: [64].concat(WAYS.ways.map(() => 34)) })[0]
  s += T(wx + 34 + 64 + 34 * WAYS.ways.length + 12, cy + 10, 'levels matched', { size: 9.5, a: .4 })
  s += T(RX - 20, cy + 10, WAYS.used ? `${WAYS.ways[WAYS.used - 1].letter} used — the others step back` : `${['no', 'one', 'two', 'three', 'four'][WAYS.ways.length] || WAYS.ways.length} ways — one is used`, { size: 9.5, a: .4, anchor: 'end' })
  const n = WAYS.ways.length, ww = Math.floor((RX - 20 - wx - (n - 1) * 14) / n), wy = cy + 26, wh = bottom - wy
  WAYS.ways.forEach((way, k) => {
    const i = k + 1, x = wx + k * (ww + 14), used = WAYS.used === i, dim = WAYS.used && !used, heard = WAYS.hear === i
    s += R(x + .5, wy + .5, ww - 1, wh - 1, { rx: 4, stroke: INK, sa: used ? .9 : heard ? .5 : .16, fill: used ? K0 : 'none' })
    s += T(x + 16, wy + 26, way.letter, { size: 15, w: 500, a: dim ? .3 : .95 }) + T(x + 38, wy + 25, asGiven(way.name), { size: 12.5, w: 500, a: dim ? .3 : .95 })
    const words = way.says.split(' '), lines = ['']; for (const wd of words) { const tr = (lines[lines.length - 1] + ' ' + wd).trim(); if (tw(tr, 10) > ww - 54 && lines[lines.length - 1]) lines.push(wd); else lines[lines.length - 1] = tr }
    lines.slice(0, 2).forEach((l, j) => { s += T(x + 38, wy + 43 + j * 14, asGiven(l), { size: 10, a: dim ? .22 : .5 }) })
    let ly = wy + 74
    for (const l of wayLines(way, i)) { if (ly + 20 > wy + wh - 40) break; s += waysLine(x + 16, ly, l, { dim }); ly += 27 }
    const ky = wy + wh - 32
    let nx = x + 16
    if (used) { s += T(x + 16, ky + 13, 'used — one step back', { size: 10, a: .7 }); nx += tw('used — one step back', 10) + 14 }
    else if (!WAYS.used) { const hk = heard ? 'hearing' : 'hear'; s += key(x + 16, ky, hk, { h: 20, size: 10, armed: heard, a: 'ways-hear', more: ` data-i="${i}"` })[0] + key(x + ww - 16 - keyW('use this', { size: 10 }), ky, 'use this', { h: 20, size: 10, a: 'ways-use', more: ` data-i="${i}"` })[0]; nx += keyW(hk, { size: 10 }) + 14 }
    /* what it was heard to do (measured, out of hearing), beside its keys: the cells above keep their room */
    const room = x + ww - 16 - keyW('use this', { size: 10 }) - 14 - nx
    const T0 = WAYS.targets || [], g0 = way.gave && way.gave.length ? way.gave : []
    let note = way.why || (!g0.length ? '' : T0[0] && T0[0].line === 'over' ? (g0[0] < -.2 ? `heard: −${fmtN(-g0[0])} db on the hits, where they meet` : '') : 'heard: ' + T0.map((tg, j) => way.left.includes(tg) ? null : planSaid(tg, g0[j] || 0)).filter(Boolean).join(', '))
    if (note && !way.why && tw(note, 9.5) > room) note = T0[0] && T0[0].line === 'over' ? `heard: −${fmtN(-g0[0])} db on the hits` : `heard: ${planSaid(T0[0], g0[0] || 0)}`
    if (note && tw(note, 9.5) <= room) s += T(nx, ky + 13, asGiven(note), { size: 9.5, a: way.why ? (dim ? .3 : .85) : dim ? .2 : .45 })
  })
  if (WAYS.list) {                                                                         // an eq's cell pressed: the eqs on this Mac
    const L = WAYS.list, lw2 = 260, rows = L.rows.length ? L.rows : [{ name: 'no eq found', maker: '', known: false }]
    s += R(L.x, L.y, lw2, rows.length * 24 + 10, { rx: 3, fill: K2, stroke: INK, sa: .28 })
    rows.forEach((r, i) => { const ry = L.y + 5 + i * 24; s += T(L.x + 14, ry + 16, asGiven(r.name), { size: 10.5, a: .9 }) + T(L.x + lw2 - 14, ry + 16, asGiven(r.maker || ''), { size: 9.5, a: .42, anchor: 'end' }) + (L.rows.length ? hit(L.x + 5, ry, lw2 - 10, 24, 'ways-pick', ` data-i="${i}"`) : '') })
  }
  return s
}

/* ── joined to the room ── */
{
  const pp0 = pPrompt, down0 = onDown, rc0 = runCommand
  const shown = () => WAYS.on && ['', WAYS.words].includes($('cmd').value.trim())        // (something else typed in the field: the page's own list, as ever)
  pPrompt = function (y, h) { return shown() ? pWays(y, h) : pp0(y, h) }
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null, a = el ? el.dataset.a : ''
    if (WAYS.on && a.startsWith('ways-')) {
      e.preventDefault()
      const d = el.dataset
      if (a === 'ways-hear') waysHear(+d.i)
      else if (a === 'ways-use') waysUse(+d.i)
      else if (a === 'ways-edit') waysEdit(+d.w, +d.s, d.f, d.b != null ? +d.b : null)
      else if (a === 'ways-plug') { const p = pt(e); waysPlugList(+d.w, +d.s, p.x, p.y + 12) }
      else if (a === 'ways-pick' && WAYS.list) waysPlugPick(WAYS.list.rows[+d.i])
      return
    }
    if (WAYS.on && WAYS.list) { WAYS.list = null; uiDirty('dock') }
    down0(e)
  }
  /* the page let go of by the hand — the panel shut, another tab: as when another line is said */
  const fl0 = flush
  flush = function (...a) { const r = fl0.apply(this, a); if (WAYS.on && !WAYS.busy && !WAYS.edit && (!S.panel.on || S.panel.tab !== 'prompt')) waysClose(); return r }
  /* another line said: the request is let go of (a way heard and not used is taken off again) */
  runCommand = async function (text, ...more) { if (WAYS.on && String(text || '').trim() !== WAYS.words) await waysClose(); return rc0.call(this, text, ...more) }
}
