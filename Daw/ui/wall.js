/* ── a track's patch as a wall: Patch on Slur, built in ──
   What stands on a patch — Patch on Slur's prints, drawn as it draws them (prints.js), and plug-ins from outside — stands
   on a wall and is wired from port to port, the way it is in Patch on Slur: an output goes to as many inputs as it is given
   wires, a `mix` takes any number of wires and a level rides each of them, and ways that run side by side are lined up by
   the engine. A wall begins with `in` far at the left and `out` far at the right and one wire between them (his ask,
   2026-10-20: they stood too close, and the line was not there): the sound goes by untouched. What is picked from the
   list is set on that line, at its end, to the right of what was there, and wired in. Scrolling over the wall makes it
   nearer or further; its ground is pulled about with option held (a plain drag on it chooses what it passes over:
   wallorg.js).

   A track keeps its wall as t.wall = { nodes, wires, z, ox, oy, in: {x, y}, out: {x, y} }.
     a node:  { id, k, x, y, … }   k is a print's name ('tape', 'comp', 'mix', …) or 'plug'
              a print: amount (0 to 1), variant, decay [3], div, fb, wet, bypass, aux [8]
              a plug-in: ins = its entry in t.inserts (written into a project as p, its place among them)
     a wire:  { from, to, gain, port }   from and to are node ids, -1 is in, -2 is out
   tape, space and delay keep their amounts where they always were (t.patch: the lines drawn for them along the song, the
   command line's words for them and undo go on working as they did), so there is one of each on a wall.

   This script is read after the room's own hands are made (it takes the patch's place on the panel, and the list's). */
const WALL_IN = -1, WALL_OUT = -2, WALL_MAX = 16, WALL_R = 30, WALL_E = 39
const WALL_SPAN = 880, WALL_STEP = 150                                                     // (how far apart in and out stand at the least; how far a thing set on the line stands from the one before it)
/* ── the prints are Patch on Slur's ──
   What they are called, their families and flavours, where a new one rests, how its amount is said and read back, and
   every hand of its study come from the plug-in's own catalog: catalog.js, made from its printCatalog.ts on every build
   (tools/catalog-from-patch.mjs), so a print changed or added there is changed or added here with the next build. What is
   said here is only this wall's own: which prints stand on it, where each stands in the list of what can be added, and how
   the room writes their words. The build stops (tools/catalog-check.mjs) when the plug-in has a print that is neither
   given a place in that list nor left off this wall. */
const PC = PATCH_CATALOG
/* where each print stands in the list of what can be added: among the plug-ins of its kind (cats.js) */
const WALL_KIND = { cut: 'eq', tone: 'eq', air: 'eq', carve: 'eq', match: 'eq', sieve: 'eq', tape: 'saturation', crush: 'saturation', radio: 'saturation', ring: 'saturation', fold: 'saturation', amp: 'amp', glue: 'dynamics', comp: 'dynamics', gate: 'dynamics', swell: 'dynamics',
  delay: 'delay', repeat: 'delay', stutter: 'delay', space: 'reverb', shimmer: 'reverb', freeze: 'reverb', smear: 'reverb', doubler: 'modulation', mod: 'modulation', tremolo: 'modulation', wow: 'modulation', stereo: 'stereo', pan: 'stereo', 'l/r': 'stereo', 'm/s': 'stereo',
  pitch: 'pitch', formant: 'pitch', harmony: 'pitch', arp: 'pitch', grain: 'pitch', tune: 'pitch', vocode: 'pitch', shift: 'pitch', gain: 'channel', mix: 'channel', side: 'channel', bands: 'channel',
  lfo: 'modulation', drift: 'modulation', pulse: 'modulation', env: 'modulation', follow: 'modulation', macro: 'modulation', scene: 'modulation' }
/* the prints this wall leaves off (none now: every print of Patch on Slur stands here; one the plug-in gains is refused by
   the build until it is given a place above or named here) */
const WALL_OFF = new Set([])
const wallKey = name => name.toLowerCase()                                                // (the room's words are lowercase: L/R is l/r)
const WALL_TYPE = {}, WALL_FAMILIES = {}, WALL_FAMILY = {}
for (const p of PC.PRINTS) if (!WALL_OFF.has(p.name)) { const k = wallKey(p.name); WALL_TYPE[k] = p.type; (WALL_FAMILIES[p.family] = WALL_FAMILIES[p.family] || []).push(k); WALL_FAMILY[k] = p.family }   // (a family gives a print the shape of its plate)
const WALL_PRINTS = Object.keys(WALL_FAMILY)
const WALL_WET = new Set(WALL_PRINTS.filter(k => PC.WET_TYPES.has(WALL_TYPE[k])))          // (the ones that can drop their dry sound)
const WALL_LEGACY = { tape: 1, space: 2, delay: 3 }                                       // their amounts are the track's own (t.patch)
const WALL_TWO = new Set(['l/r', 'm/s'])                                                  // two ways out
const wallNeutral = k => PC.neutralOf(WALL_TYPE[k])
const wallMain = k => PC.MAIN_HAND[WALL_TYPE[k]] || 'amount'                              // (what the big hand is called, where "amount" would say too little)
const wallFlavours = k => PC.flavoursOf(WALL_TYPE[k])
/* the prints that play other prints' hands (an lfo, a macro, a follow…) and the wires they play along: a control wire lands
   on a hand (`hand`: amount, decay, aux3…, the share of a mix's wire, or another control wire's depth, wire:<from>:<hand>) */
const wallPlays = node => !!node && PC.playsHandsType(WALL_TYPE[node.k])
const wallCtl = e => e.hand != null
const wallHasAmount = node => node.k === 'side' || WALL_TYPE[node.k] == null || PC.hasAmountType(WALL_TYPE[node.k])      // (an lfo, a mix, the splitters: no big hand)
const wallOuts = node => node ? (WALL_TWO.has(node.k) ? 2 : node.k === 'bands' ? PC.outPortsOf(WALL_TYPE.bands, node.aux || []) : 1) : 1      // (the bands: one way out a band)
/* how the room writes what Patch on Slur says: lowercase, a space before a unit, a minus that is a minus */
const wallSaid = s => String(s).toLowerCase().replace(/(^|[\s(])-(?=\.?\d)/g, '$1−').replace(/(\d)(ms|s|st|hz|db|oct|c)\b/g, '$1 $2').replace(/(\d)%/g, '$1 %')
const WALL_UNIT = { gain: 'db', ring: 'hz' }                                               // (Patch on Slur leaves the unit off these two amounts; the room says it)
const wallAmountText = (k, a, variant) => { const s = wallSaid(PC.fmtValue(WALL_TYPE[k], a, variant)); return WALL_UNIT[k] && /[\dk]$/.test(s) ? s + ' ' + WALL_UNIT[k] : s }
/* …and what is typed for it, back to 0..1 (null: not a value of it) */
const wallAmountParse = (k, text, variant) => PC.parseAmount(WALL_TYPE[k], String(text), variant)
/* a print as Patch on Slur holds it (the catalog reads and writes that), and what the catalog writes, put back on the wall's */
const wallAsNode = node => ({ type: WALL_TYPE[node.k], amount: node.amount || 0, variant: node.variant || 0, decay: node.decay || [.5, .5, .5], delayDiv: node.div == null ? 2 : node.div, delayFb: node.fb == null ? .35 : node.fb, wet: !!node.wet, bypass: !!node.bypass, aux: node.aux || [0, 0, 0] })
function wallApply (node, patch) { for (const [f, v] of Object.entries(patch)) node[f === 'delayDiv' ? 'div' : f === 'delayFb' ? 'fb' : f] = v }
/* a print's other hands, as its study in Patch on Slur shows them for this print now (a hand shown only with some flavours
   comes and goes with them): h is where it lives (variant, decay, div, fb, aux0…); a choice has its words (opts) and their
   values, a switch is a choice of off and on, a number has its range (lo, hi), step, rest (def), unit, and its own ways of
   being said and read. c is the catalog's hand. */
function wallHands (k, node) {
  node = node || wallNew(k, 0, 0)
  const n = wallAsNode(node)
  return PC.studyHandsOf(n).filter(c => c.at !== 'amount').map(c => {                     // (a hand that is the amount itself, as freeze's hold, is the big hand here)
    const label = wallSaid(PC.valueOf(c.label, n))
    if (c.kind !== 'gauge') { const opts = c.kind === 'switch' ? ['off', 'on'] : PC.valueOf(c.options, n).map(wallSaid); return { h: c.at, label, opts, vals: opts.map((_, i) => i), none: c.none ? wallSaid(c.none) : null, c } }      // (none: what it reads when nothing is chosen)
    return { h: c.at, label, lo: PC.valueOf(c.min, n), hi: PC.valueOf(c.max, n), step: c.step || 1, def: PC.valueOf(c.def, n), unit: c.unit ? wallSaid(c.unit) : '', sc: 1, c,
      fmt: c.format ? (v, nd) => wallSaid(c.format(v, wallAsNode(nd))) : null, parse: (text, nd) => c.parse ? c.parse(String(text), wallAsNode(nd)) : PC.parseLead(String(text)) }
  })
}

let PICK_HI = null                                                                        // (the row of the list pressed once: return puts it on)
const WALL = { sel: null, drag: null, g: null, sent: new Map(), last: 0, lastId: null, bad: new Map(), loose: null, out: false, outTold: false }
/* The stereo out has a wall too. It is not one of the song's tracks: it is kept here (OUT), and written into a project
   beside them. While something stands on its wall the engine is told of it as a bus that every track plays into on its
   way out (native.js, sendSession: wallOutTrack) — so it is played after everything, what stands on it is lined up and
   made up for like any bus's, and a print of the whole song goes through it (a print of one track does not). It stands
   before the stereo out's fader. Its wall is shown when the stereo out's strip is pressed by its name. */
const OUT_ID = 999999001
const OUT = { id: OUT_ID, name: 'stereo out', kind: 'bus', isOut: true, vol: 0, pan: 0, mute: false, solo: false, sends: [], autos: {}, regs: [], inserts: [], patch: NO_PATCH(), inp: 0, used: false }
const wallTrack = () => WALL.out ? OUT : S.tracks[S.sel]
const wallOutTrack = () => OUT.used ? OUT : null
/* the engine is told that the stereo out is a bus (or no longer one) before it is told what stands on it */
async function wallPushOut () {
  if (!NAT) return
  OUT.used = !!(OUT.wall && OUT.wall.nodes.length) || !!OUT.opening
  if (WALL.outTold !== OUT.used) { WALL.outTold = OUT.used; WALL.sent.delete(OUT_ID); WALL.outSig = null; await natSession() }
  if (!OUT.used) return
  const p = patchNow(OUT), sig = `${p.tape}|${p.space}|${p.delay}`                        // (its tape, space and delay turned: told as a track's are)
  if (WALL.outSig !== sig) { WALL.outSig = sig; await NAT.call('track', { id: OUT_ID, vol: 1, on: 1, pan: 0, tape: p.tape / 100, space: p.space / 100, delay: p.delay / 100, share: .62, patched: 0, wall: 1, mon: 0, live: 0, input: 0, sends: [] }) }
  return wallPush(OUT)
}
/* written into a project, and read from one (nothing written: nothing on it) */
function wallOutSaved () {
  if (!OUT.wall || !OUT.wall.nodes.length) return undefined
  return { wall: wallSaved(OUT), patch: copy(OUT.patch), inserts: OUT.inserts.filter(i => i.id).map(i => Object.assign({ id: i.id, name: i.name, fmt: i.fmt, state: i.state || '' }, i.off ? { off: true } : {})) }
}
async function wallOutLoad (d, step) {
  OUT.inserts = []; OUT.wall = null; OUT.patch = NO_PATCH(); OUT.used = false; OUT._told = null; WALL.out = false
  if (!d || !d.wall || !Array.isArray(d.wall.nodes) || !d.wall.nodes.length) { await wallPushOut(); return }
  OUT.wall = d.wall; if (d.patch) OUT.patch = d.patch
  await wallPushOut()
  for (const ins of d.inserts || []) {
    const kept = { uid: 0, name: ins.name || 'plug-in', fmt: ins.fmt || '', id: ins.id, state: ins.state || '', off: !!ins.off, out: true }
    const bare = typeof LOAD !== 'undefined' && LOAD.bare, no = typeof DISTRUST !== 'undefined' && DISTRUST.has(ins.id)
    delete ins.out                                                                     // (as a track's: tried again here — project.js)
    if (step && !ins.out) step(ins.name)
    const rr = !NAT || ins.out || bare || no ? null : await NAT.call('insert', { track: OUT_ID, id: ins.id, state: ins.state || '', show: 0 })
    if (rr && rr.ok) { OUT.inserts.push({ uid: rr.uid, name: rr.name, fmt: rr.fmt, id: ins.id, state: ins.state || '', off: !!ins.off, sc: !!rr.key }); if (ins.off) NAT.call('bypass', { track: OUT_ID, uid: rr.uid, off: 1 }) }
    else { OUT.inserts.push(kept); if (!ins.out && typeof LOAD !== 'undefined' && LOAD.left) LOAD.left.push(kept.name) }
  }
  wallOf(OUT); WALL.sent.delete(OUT_ID); await wallPushOut()
}
const wallIsPrint = n => n.k !== 'plug'
const wallNode = (w, id) => w.nodes.find(n => n.id === id) || null
const wallFree = w => { for (let i = 0; i < WALL_MAX; i++) if (!w.nodes.some(n => n.id === i)) return i; return -1 }
const wallPos = (w, id) => id === WALL_IN ? w.in : id === WALL_OUT ? w.out : wallNode(w, id)
const wallName = n => n.k === 'plug' ? String((n.ins && n.ins.name) || 'plug-in').toLowerCase() : n.k
/* a node's amount: tape, space and delay read the track's own */
const wallAmount = (t, n) => WALL_LEGACY[n.k] ? patchNow(t)[n.k] / 100 : n.amount || 0
function wallSetAmount (t, n, v, live) {
  v = clamp(v, 0, 1)
  if (WALL_LEGACY[n.k]) { setPrint(t, n.k, v * 100); if (t === OUT) wallPushOut(); else pushTrack(t); return }
  n.amount = v
  if (NAT && live) NAT.call('wallAmt', { track: t.id, id: n.id, v }); else wallPush(t)
}
const wallNew = (k, x, y) => Object.assign({ k, x, y, amount: wallNeutral(k), variant: PC.variantOf(WALL_TYPE[k]), decay: [.5, .5, .5], div: 2, fb: .35, wet: false, bypass: false, aux: PC.auxOf(WALL_TYPE[k]).concat([0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 8) }, k === 'lfo' ? { pts: PC.SINE_PTS.slice() } : null)      // (an lfo begins as a sine, drawn)

/* ── a track's wall: made from the patch it had (a project from before walls), and kept in step with its plug-ins ── */
function wallOf (t) {
  if (!t || t.kind === 'out') return null
  if (!t.inserts) t.inserts = []
  let w = t.wall
  if (!w || !Array.isArray(w.nodes)) {
    /* from the row it was: tape, then space and delay (side by side into a mix, when both are there), then the plug-ins */
    w = t.wall = { nodes: [], wires: [], z: 0, ox: 0, oy: 0, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } }
    const on = k => t.patch && printOn(t, k), p = t.patch ? patchNow(t) : { share: 62 }
    let last = [WALL_IN], x = 150
    const put = (node, y) => { node.id = wallFree(w); node.x = x; node.y = y || 0; w.nodes.push(node); return node.id }
    const join = id => { for (const f of last) w.wires.push({ from: f, to: id, gain: 1, port: 0 }) }
    if (on('tape')) { const id = put(wallNew('tape')); join(id); last = [id]; x += 146 }
    if (on('space') && on('delay')) {
      const a = put(wallNew('space'), -62), b = put(wallNew('delay'), 62); join(a); join(b); x += 146
      const m = put(wallNew('mix')); w.wires.push({ from: a, to: m, gain: clamp(p.share / 100, 0, 1), port: 0 }, { from: b, to: m, gain: clamp(1 - p.share / 100, 0, 1), port: 0 }); last = [m]; x += 146
    } else if (on('space') || on('delay')) { const id = put(wallNew(on('space') ? 'space' : 'delay')); join(id); last = [id]; x += 146 }
    for (const ins of t.inserts) { const id = put({ k: 'plug', ins }); join(id); last = [id]; x += 100 }
    for (const f of last) w.wires.push({ from: f, to: WALL_OUT, gain: 1, port: 0 })        // (nothing on it: in is wired straight to out)
    w.in = { x: 40, y: 0 }; w.out = { x: Math.max(260, x - (w.nodes.length ? 20 : 0)), y: 0 }
  }
  if (!w.in) w.in = { x: 40, y: 0 }
  if (!w.out) w.out = { x: 260, y: 0 }
  /* once for every wall, an old one too: in and out stand far apart, round what is between them; a wall with nothing on
     it and no wire is given the one from in to out */
  if (!w.wide) {
    const xs = w.nodes.map(q => q.x), lo = xs.length ? Math.min(...xs) : w.in.x, hi = xs.length ? Math.max(...xs) : w.out.x
    w.in.x = Math.min(w.in.x, lo - WALL_STEP); w.out.x = Math.max(w.out.x, hi + WALL_STEP)
    const more = WALL_SPAN - (w.out.x - w.in.x)
    if (more > 0) { w.in.x -= more / 2; w.out.x += more / 2 }
    w.in.x = Math.round(w.in.x); w.out.x = Math.round(w.out.x)
    if (!w.nodes.length && !w.wires.length) w.wires.push({ from: WALL_IN, to: WALL_OUT, gain: 1, port: 0 })
    w.wide = 1; w.z = 0
  }
  w.v = typeof isInst === 'function' && isInst(t) ? 1 : 0                                 // (a track of notes: its instrument stands where in would, and the wires start at its side)
  /* a plug-in written into a project by its place among the track's plug-ins is found again as they are opened */
  const own = t.inserts.filter(i => i.id || i.uid)
  for (const n of w.nodes) if (n.k === 'plug' && !n.ins && n.p != null && own[n.p]) { n.ins = own[n.p]; delete n.p }
  /* one that is no longer on the track goes from the wall (what fed it feeds what it fed); one that has no place gets one:
     picked from the wall's own list it stands unwired, to be wired by hand (wallPick); put on the track any other way (a
     command, a copy of a track, the check) it joins the end of the way, as a plug-in always did */
  for (const n of w.nodes.slice()) if (n.k === 'plug' && n.ins && !t.inserts.includes(n.ins)) wallTake(w, n.id)
  if (!w.nodes.some(n => n.k === 'plug' && !n.ins && n.p != null)) for (const ins of t.inserts) if (!w.nodes.some(n => n.ins === ins)) { const id = wallFree(w); if (id < 0) break; const loose = WALL.loose === t.id, at = loose ? wallSpot(w) : wallNextSpot(w); w.nodes.push({ id, k: 'plug', ins, x: at.x, y: at.y }); if (!loose) wallAppend(w, id) }
  /* a print turned up from somewhere else (the command line, a template) while it has no place: it joins the way out */
  if (t.patch) for (const k of PRINTS3) if (patchNow(t)[k] > .5 && !w.nodes.some(n => n.k === k)) { const id = wallFree(w); if (id < 0) break; const at = wallNextSpot(w); w.nodes.push(Object.assign(wallNew(k, at.x, at.y), { id })); wallAppend(w, id) }
  return w
}
/* a free place on the ground, near the middle of what stands there */
function wallSpot (w) {
  const cx = (w.in.x + w.out.x) / 2, cy = (w.in.y + w.out.y) / 2
  for (let ring = 0; ring < 6; ring++) for (const [dx, dy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = cx + dx * 110 * (ring + 1) * (ring ? 1 : 0), y = cy + (ring ? dy * 110 * ring : 96)
    if (![w.in, w.out].concat(w.nodes).some(q => Math.hypot(q.x - x, q.y - y) < 84)) return { x, y }
  }
  return { x: cx, y: cy + 110 }
}
/* where a thing set at the end of the way stands: on the line, to the right of the last thing that plays into out (on in's
   height when nothing does, or when several ways come into out side by side) — and out moves on to make room */
function wallNextSpot (w) {
  const feeds = w.wires.filter(e => e.to === WALL_OUT && !wallCtl(e) && e.from !== WALL_IN).map(e => wallNode(w, e.from)).filter(Boolean)
  const last = feeds.slice().sort((a, b) => b.x - a.x)[0], y = feeds.length === 1 ? last.y : w.in.y
  let x = last ? last.x + WALL_STEP : w.in.x + WALL_STEP
  while (w.nodes.some(q => Math.hypot(q.x - x, q.y - y) < 84)) x += 40
  if (x > w.out.x - WALL_STEP * .8) { w.out.x = Math.round(x + WALL_STEP); w.z = 0 }
  return { x: Math.round(x), y }
}
/* a node put at the end of the way: everything that went to out goes through it (nothing did: in, the node, out) */
function wallAppend (w, id) {
  const outs = w.wires.filter(e => e.to === WALL_OUT)
  if (outs.length) { for (const e of outs) e.to = id } else w.wires.push({ from: WALL_IN, to: id, gain: 1, port: 0 })
  w.wires.push({ from: id, to: WALL_OUT, gain: 1, port: 0 })
  wallShares(w, id)
}
/* a node taken off: when one wire fed it, that wire's start now feeds whatever it fed (Patch on Slur heals the same way) */
function wallTake (w, id) {
  const ins = w.wires.filter(e => e.to === id && !e.in && !wallCtl(e)), outs = w.wires.filter(e => e.from === id && !wallCtl(e))      // (what went into its key heals nothing: side.js; nor does what played its hands)
  w.wires = w.wires.filter(e => e.from !== id && e.to !== id && !(wallCtl(e) && String(e.hand).startsWith(`wire:${id}:`)))
  if (ins.length === 1) for (const o of outs) if (o.to !== ins[0].from && !w.wires.some(e => e.from === ins[0].from && e.to === o.to && (e.port || 0) === (ins[0].port || 0))) w.wires.push({ from: ins[0].from, to: o.to, gain: o.gain, port: ins[0].port || 0 })
  w.nodes = w.nodes.filter(n => n.id !== id)
}
const wallReach = (w, a, b, seen = new Set()) => { if (a === b) return true; if (seen.has(a)) return false; seen.add(a); return w.wires.some(e => e.from === a && !wallCtl(e) && wallReach(w, e.to, b, seen)) }      // (by the sound: a hand played is no way round)
/* may a wire be drawn from here to there: not onto itself, not twice, not into in or out of out, never round in a ring */
function wallMay (w, from, to, port, inp) {
  if (from === to || from === WALL_OUT || to === WALL_IN) return false
  if (typeof wallTakesNothing === 'function' && wallTakesNothing(w, to, inp)) return false      // (side.js: a side has no way in; only some prints have a key)
  if (w.wires.some(e => e.from === from && e.to === to && (e.port || 0) === (port || 0) && (e.in || 0) === (inp || 0))) return false
  return !wallReach(w, to, from)
}
/* a mix that blends shares a hundred among its wires: a new wire, or one taken away, and they are made even */
function wallShares (w, id) {
  const m = wallNode(w, id)
  if (!m || m.k !== 'mix' || (m.variant || 0) !== 0) return
  const ins = w.wires.filter(e => e.to === id && !wallCtl(e))
  for (const e of ins) e.gain = 1 / ins.length
}
function wallWire (t, from, to, port, inp) {
  const w = wallOf(t)
  if (!wallMay(w, from, to, port, inp)) return false
  w.wires.push(Object.assign({ from, to, gain: 1, port: port || 0 }, inp ? { in: 1 } : {})); if (!inp) wallShares(w, to); wallPush(t)
  return true
}
/* the level a wire carries into a mix, pulled: in a blending mix the others give way so that it stays a hundred in all */
function wallSetShare (t, i, v) {
  const w = wallOf(t), e = w.wires[i], m = e && wallNode(w, e.to)
  if (!e) return
  v = clamp(v, 0, 1)
  if (m && m.k === 'mix' && (m.variant || 0) === 0) {
    const rest = w.wires.filter(x => x.to === e.to && x !== e), sum = rest.reduce((a, x) => a + x.gain, 0)
    for (const x of rest) x.gain = rest.length ? (sum > 1e-6 ? x.gain / sum : 1 / rest.length) * (1 - v) : 0
    e.gain = rest.length ? v : 1
  } else e.gain = v
  wallPush(t)
}

/* ── told to the engine: the wall whole, whenever it is not what was last told (looked at twice a second, and at once after a hand) ── */
/* what a print carries beside its hands, as Patch on Slur writes it: a tremolo's drawn cycle, an lfo's points (and the shape
   it morphs toward), a scene's two snapshots */
const wallDrawn = n => Object.assign({}, n.curve ? { curve: n.curve } : null, n.pts ? { pts: n.pts } : null, n.pts2 ? { pts2: n.pts2 } : null, n.sceneA ? { sceneA: n.sceneA } : null, n.sceneB ? { sceneB: n.sceneB } : null)
function wallMsg (t) {
  const w = wallOf(t)
  if (!w) return null
  const nodes = w.nodes.map(n => {
    if (n.k === 'plug') { const i = n.ins; return i && i.uid && !i.out && !i.dead ? { id: n.id, type: 51, uid: i.uid } : { id: n.id, type: 5, amount: .75, bypass: 1 } }      // (one that would not open, or is still opening: the sound goes by its place)
    return { id: n.id, type: WALL_TYPE[n.k], amount: +wallAmount(t, n).toFixed(4), variant: n.variant || 0, decay: n.decay || [.5, .5, .5], delayDiv: n.div == null ? 2 : n.div, delayFb: n.fb == null ? .35 : n.fb, wet: n.wet ? 1 : 0, bypass: n.bypass ? 1 : 0, aux: n.aux || [], line: WALL_LEGACY[n.k] || 0, ...wallDrawn(n) }      // (a tremolo's shape, an lfo's points, a scene's snapshots)
  })
  const edges = w.wires.filter(e => (e.from === WALL_IN || wallNode(w, e.from)) && (e.to === WALL_OUT || wallNode(w, e.to))).map(e => Object.assign({ from: e.from, to: e.to, gain: +(+e.gain).toFixed(4), port: e.port || 0, in: e.in ? 1 : 0 }, wallCtl(e) ? { hand: e.hand, pol: e.pol || 0 } : null))
  return { track: t.id, nodes, edges }
}
function wallPush (t) {
  if (!NAT || !t || t.kind === 'out' || !t.id) return
  if (t === OUT && (!OUT.used || WALL.outTold !== OUT.used)) return wallPushOut()            // (the engine has to hold the stereo out as a bus first)
  const m = wallMsg(t)
  if (!m) return
  const amountless = JSON.stringify({ n: m.nodes.map(n => Object.assign({}, n, n.line ? { amount: 0 } : null)), e: m.edges })      // (tape, space and delay turned: the track says that itself)
  if (WALL.sent.get(t.id) === amountless) return
  if (!m.nodes.length && !WALL.sent.has(t.id)) { WALL.sent.set(t.id, amountless); return }       // (nothing on it, and nothing was: the engine has no wall to be told of)
  WALL.sent.set(t.id, amountless)
  return NAT.call('wall', m).then(r => {
    if (r && r.ok === false && r.error === 'busy') { WALL.sent.delete(t.id); return }                    // (a print is being made: told again when it is done)
    if (r && r.ok === false) WALL.bad.set(t.id, String(r.error || 'would not play')); else WALL.bad.delete(t.id)
    if (wallTrack() === t) uiDirty('dock')
  })
}
function wallPushAll () { if (NAT && !(typeof START !== 'undefined' && START.on)) { for (const t of S.tracks) wallPush(t); wallPushOut() } }
if (NAT) setInterval(wallPushAll, 500)

/* ── written into a project, read from one, taken along by a copy of a track ── */
function wallSaved (t) {
  if (!t.wall) return undefined
  const own = (t.inserts || []).filter(i => i.id || i.uid)
  return { nodes: t.wall.nodes.map(n => { const o = Object.assign({}, n); if (n.k === 'plug') { delete o.ins; o.p = n.ins ? own.indexOf(n.ins) : n.p } return o }).filter(o => o.k !== 'plug' || o.p >= 0), wires: copy(t.wall.wires), z: t.wall.z, ox: t.wall.ox, oy: t.wall.oy, in: copy(t.wall.in), out: copy(t.wall.out), wide: t.wall.wide || 0 }
}

/* a track's wall as a file Patch on Slur opens (the hand-off): its prints and their wires — a plug-in from outside is not a
   thing Patch on Slur has, so its place is closed over, as when it is taken off. Nothing to hand over: null. */
function wallPreset (t) {
  const w0 = wallOf(t)
  if (!w0 || !w0.nodes.some(n => n.k !== 'plug')) return null
  const w = { nodes: w0.nodes.slice(), wires: w0.wires.map(e => Object.assign({}, e)) }
  for (const n of w0.nodes) if (n.k === 'plug') wallTake(w, n.id)
  const x0 = Math.min(...w.nodes.map(n => n.x))
  return JSON.stringify({ nodes: w.nodes.map(n => ({ id: n.id, type: WALL_TYPE[n.k], amount: +wallAmount(t, n).toFixed(4), variant: n.variant || 0, decay: n.decay || [.5, .5, .5], delayDiv: n.div == null ? 2 : n.div, delayFb: n.fb == null ? .35 : n.fb, wet: !!n.wet, bypass: !!n.bypass, aux: n.aux || [0, 0, 0], ...wallDrawn(n), x: Math.round(180 + (n.x - x0) * 1.6), y: Math.round(280 + (n.y - w0.in.y) * 1.6) })),
    edges: w.wires.map(e => Object.assign({ from: e.from, to: e.to, gain: +(+e.gain).toFixed(4), port: e.port || 0 }, e.in ? { in: 1 } : {}, wallCtl(e) ? { hand: e.hand, pol: e.pol || 0 } : null)) }, null, 1)
}

/* a clock, as its print says it: in time with the song (1/4, 1/8. …) or so many times a second */
const wallRate = n => { const a = n.aux || []; return a[0] === 1 ? `${((a[3] || 200) / 100).toFixed(2)} hz` : `${PC.RATE_DIVS[a[1] ?? 3] || '1/4'}${a[2] === 1 ? '.' : a[2] === 2 ? 't' : ''}` }

/* ── drawn ── */
const wallView = (w, g) => { if (!w.z) wallFit(w, g); return { z: w.z, tx: g.cx - w.ox * w.z, ty: g.cy - w.oy * w.z } }
function wallFit (w, g) {
  const all = [w.in, w.out].concat(w.nodes), x0 = Math.min(...all.map(q => q.x)) - 70, x1 = Math.max(...all.map(q => q.x)) + 70, y0 = Math.min(...all.map(q => q.y)) - 60, y1 = Math.max(...all.map(q => q.y)) + 86
  const left = typeof MAC_W !== 'undefined' && typeof macTrack === 'function' && macTrack() ? MAC_W : 0      // (the macros' column stands over the wall's left: what is fitted is fitted beside it)
  w.z = clamp(Math.min((g.w - left - 24) / (x1 - x0), (g.h - 40) / (y1 - y0)), .45, 1)
  w.ox = (x0 + x1) / 2 - left / 2 / w.z; w.oy = (y0 + y1) / 2
}
const wallToWorld = (w, g, p) => ({ x: (p.x - g.cx) / w.z + w.ox, y: (p.y - g.cy) / w.z + w.oy })
const wallOutPort = (w, id, port) => { const q = wallPos(w, id); if (id === WALL_IN) return { x: q.x + (w.v ? WALL_E : 7), y: q.y }; const n = wallNode(w, id), N = wallOuts(n), gap = N > 2 ? 11 : 26; return { x: q.x + (wallPlays(n) ? WALL_E - 12 : WALL_E), y: q.y + (N > 1 ? ((port || 0) - (N - 1) / 2) * gap : 0) } }      // (a control print is smaller: its port comes in)
const wallInPort = (w, id) => { const q = wallPos(w, id); return id === WALL_OUT ? { x: q.x - 7, y: q.y } : { x: q.x - (wallPlays(wallNode(w, id)) ? WALL_E - 12 : WALL_E), y: q.y } }
const wallCurve = (a, b) => { const dx = Math.max(26, Math.abs(b.x - a.x) * .5); return `M${n(a.x)} ${n(a.y)}C${n(a.x + dx)} ${n(a.y)} ${n(b.x - dx)} ${n(b.y)} ${n(b.x)} ${n(b.y)}` }
function wallPrint (t, node, sel) {
  const fam = WALL_FAMILY[node.k] || 'tone', type = WALL_TYPE[node.k], tint = PATCH_PRINTS.PLATE_TINT[type] || '#B8B4AA'
  const inner = PATCH_PRINTS.printInner(Object.assign({ type, amount: wallAmount(t, node), variant: node.variant || 0, aux: node.aux || [0, 0, 0, 0, 0, 0, 0, 0] }, wallDrawn(node)), fam, tint).replace(/'Space Mono', ui-monospace, monospace/g, 'Instrument Sans')
  const r = WALL_R * (PC.isControlType(type) ? .6 : 1)                                  // (a control print is a fitting: about half a sound print, as on Patch on Slur's wall)
  return `<g transform="translate(${n(node.x)} ${n(node.y)}) scale(${n(r)})"${node.bypass ? ' opacity=".35"' : ''}>${inner}</g>` + (sel ? Cc(node.x, node.y, r + 7, { stroke: INK, sa: .5, dash: '2 3' }) : '')
}
const wallValue = (t, node) => {
  const a = wallAmount(t, node), v = node.bare || node.k === 'mix' || node.k === 'gain' ? '' : node.k === 'tremolo' ? wallSaid((PC.TREM_PRESETS[(node.aux || [])[2] || 0] || PC.TREM_PRESETS[0]).name) : wallSaid(wallFlavours(node.k)[node.variant || 0] || '')      // (bare: the amount alone, as the study says it; a tremolo is called by its shape)
  if (node.k === 'mix') return (node.variant || 0) === 0 ? 'blends' : 'adds'
  if (node.k === 'meter') return ''                                                      // (meternode.js: it has no amount; what it shows is on its face)
  if (node.k === 'side') return typeof sideWord === 'function' ? sideWord(t) : ''                // (side.js: the track it plays)
  if (WALL_TWO.has(node.k)) return ''
  if (node.k === 'bands') return PC.crossovers(node.aux || []).map(hz => wallSaid(PC.fmtHz(hz))).join(' / ')      // (where it cuts)
  if (node.k === 'lfo' || node.k === 'drift' || node.k === 'pulse') return wallRate(node)
  if (node.k === 'macro') return node.bare ? wallAmountText('macro', a, 0) : `${((node.aux || [])[0] || 0) + 1} · ${wallAmountText('macro', a, 0)}`      // (its number, and its knob)
  if (node.k === 'follow' || node.k === 'env') return wallSaid(wallFlavours(node.k)[node.variant || 0] || (node.k === 'follow' ? ['envelope', 'transient'][node.variant || 0] : ''))
  const num = wallAmountText(node.k, a, node.variant || 0)                               // (in Patch on Slur's units)
  return (v ? v + ' ' : '') + num
}
function wallPatch (y, h) {
  const t = wallTrack(), rx = RX - SIDE, cw = rx - pickerW(), w = wallOf(t)
  const cid = 'cl' + (++UID)
  let s = `<clipPath id="${cid}"><rect x="0" y="${n(y)}" width="${n(Math.max(0, cw))}" height="${n(h)}"/></clipPath>`
  if (w) {
    const g = WALL.g = { x: 0, y, w: cw, h, cx: cw / 2, cy: y + (h - 26) / 2, id: t.id }, v = wallView(w, g), sel = WALL.sel && WALL.sel.t === t.id ? WALL.sel : null, d = WALL.drag
    let a = '', hits = ''
    const dot = q => Cc(q.x, q.y, 2.2, { fill: INK })
    /* the wires, each with the level it carries where it goes into a mix */
    w.wires.forEach((e, i) => {
      if (wallCtl(e) || !wallPos(w, e.from) || !wallPos(w, e.to)) return                // (a control wire is drawn where it lands on a hand: ctl.js)
      const p0 = wallOutPort(w, e.from, e.port), p1 = e.in && typeof wallKeyPort === 'function' ? wallKeyPort(w, e.to) : wallInPort(w, e.to), dd = wallCurve(p0, p1), chosen = sel && sel.wire === i, m = wallNode(w, e.to)
      a += P(dd, { stroke: INK, sa: chosen ? 1 : .46, sw: chosen ? 1.6 : 1 }) + dot(p0) + dot(p1)
      hits += `<path d="${dd}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="12" data-a="wall" data-k="wire" data-i="${i}" style="cursor:pointer"/>`
      if (m && m.k === 'mix') {
        const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2, on = chosen || (d && d.k === 'lvl' && d.i === i)
        a += R(mx - 13, my - 7.5, 26, 15, { rx: 2, fill: K1 }) + R(mx - 12.5, my - 7, 25, 14, { rx: 2, stroke: INK, sa: on ? .7 : .24, fill: on ? K3 : K1 }) + T(mx, my + 3.4, asGiven(String(Math.round(e.gain * 100))), { size: 9, a: on ? 1 : .72, anchor: 'middle' })
        hits += `<rect x="${n(mx - 15)}" y="${n(my - 10)}" width="30" height="20" fill="#000" fill-opacity="0" data-a="wall" data-k="lvl" data-i="${i}" style="cursor:ns-resize"/>`
      }
    })
    if (d && d.k === 'wire' && d.to && !d.ctl) a += P(wallCurve(wallOutPort(w, d.from, d.port), d.land != null ? (d.landIn ? wallKeyPort(w, d.land) : wallInPort(w, d.land)) : d.to), { stroke: INK, sa: .85, dash: '3 3' }) + (d.land != null ? '' : Cc(d.to.x, d.to.y, 4.5, { stroke: INK, sa: .9 }))
    /* in and out */
    for (const [id, word] of [[WALL_IN, 'in'], [WALL_OUT, 'out']]) {
      const q = wallPos(w, id)
      if (id === WALL_IN && w.v) {
        const I = t.inst, o = wallOutPort(w, WALL_IN, 0)
        a += G(loanFrame(q.x, q.y, 32, instName(t)), '', I.out ? ' opacity=".35"' : '') + T(q.x, q.y + 49, fit(instName(t), 92, 10, 500), { size: 10, w: 500, anchor: 'middle' }) + T(q.x, q.y + 61.5, I.busy ? 'opening' : instWord(t), { size: 9, a: .46, anchor: 'middle' })
        a += T(q.x, q.y + 76, 'change', { size: 9, a: S.picker.open && S.picker.what === 'inst' ? .9 : .36, anchor: 'middle' })
        hits += hit(q.x - 34, q.y - 34, 68, 68, 'inst') + hit(q.x - 26, q.y + 66, 52, 14, 'inst-pick')
        hits += `<circle cx="${n(o.x)}" cy="${n(o.y)}" r="11" fill="#000" fill-opacity="0" data-a="wall" data-k="port" data-id="${WALL_IN}" style="cursor:crosshair"/>`
        if (!w.wires.some(e => e.from === WALL_IN)) a += Cc(o.x, o.y, 2.2, { stroke: INK, sa: .5, fill: K1 })
        continue
      }
      a += Cc(q.x, q.y, 4, { stroke: INK, sa: .8, sw: 1.2, fill: K1 }) + T(q.x, q.y + 20, word, { size: 9.5, a: .46, anchor: 'middle' })
      hits += `<circle cx="${n(q.x)}" cy="${n(q.y)}" r="15" fill="#000" fill-opacity="0" data-a="wall" data-k="${id === WALL_IN ? 'port' : 'end'}" data-id="${id}" style="cursor:${id === WALL_IN ? 'crosshair' : 'grab'}"/>`
    }
    /* what stands on it */
    for (const node of w.nodes) {
      const chosen = sel && sel.node === node.id, name = wallName(node), land = d && d.k === 'wire' && d.land === node.id
      if (node.k === 'plug') {
        const i = node.ins, dim = !i || i.off || i.out || i.busy || !i.uid
        a += G(loanFrame(node.x, node.y, 32, asGiven(name)), '', dim ? ' opacity=".4"' : '') + (chosen ? R(node.x - 38.5, node.y - 38.5, 77, 77, { rx: 3, stroke: INK, sa: .5, dash: '2 3' }) : '')
        a += T(node.x, node.y + 49, fit(asGiven(name), 96, 10, 500), { size: 10, w: 500, anchor: 'middle' }) + T(node.x, node.y + 61.5, !i ? 'opening' : i.busy ? 'opening' : i.out ? 'left out' : i.off ? 'off' : i.fmt || '', { size: 9, a: .46, anchor: 'middle' })
      } else {
        const cy = node.y + (PC.isControlType(WALL_TYPE[node.k]) ? 37 : 49)                // (under a control print, nearer: it is smaller)
        a += wallPrint(t, node, chosen)
        a += T(node.x, cy, node.k, { size: 10, w: 500, anchor: 'middle' }) + T(node.x, cy + 12.5, asGiven(wallValue(t, node)), { size: 9, a: .46, anchor: 'middle' })
      }
      if (land) a += Cc(node.x, node.y, WALL_R + 9, { stroke: INK, sa: .9 })
      hits += `<rect x="${n(node.x - 34)}" y="${n(node.y - 34)}" width="68" height="68" fill="#000" fill-opacity="0" data-a="wall" data-k="node" data-id="${node.id}" style="cursor:${node.k === 'plug' || node.k === 'meter' || node.k === 'side' ? 'pointer' : !wallHasAmount(node) ? 'grab' : 'ns-resize'}"/>`
      hits += `<rect x="${n(node.x - 44)}" y="${n(node.y + 38)}" width="88" height="28" fill="#000" fill-opacity="0" data-a="wall" data-k="cap" data-id="${node.id}" style="cursor:grab"/>`
      const N = wallOuts(node)
      for (let port = 0; port < N; port++) { const q = wallOutPort(w, node.id, port); hits += `<circle cx="${n(q.x)}" cy="${n(q.y)}" r="${N > 2 ? 5.5 : N > 1 ? 9 : 11}" fill="#000" fill-opacity="0" data-a="wall" data-k="port" data-id="${node.id}" data-p="${port}" style="cursor:crosshair"/>`; if (!w.wires.some(e => e.from === node.id && (e.port || 0) === port)) a += Cc(q.x, q.y, 2.2, { stroke: INK, sa: .5, fill: K1 }) }
      if (node.k !== 'side' && !PC.noInputType(WALL_TYPE[node.k]) && !w.wires.some(e => e.to === node.id && !wallCtl(e))) { const q = wallInPort(w, node.id);      // (a side and an lfo have no way in)
        a += Cc(q.x, q.y, 2.2, { stroke: INK, sa: .5, fill: K1 }) }
    }
    s += `<g clip-path="url(#${cid})"><rect x="0" y="${n(y)}" width="${n(Math.max(0, cw))}" height="${n(h)}" fill="#000" fill-opacity="0" data-a="wall" data-k="bg" style="cursor:default"/>` + G(a + hits, `translate(${n(v.tx)} ${n(v.ty)}) scale(${n(v.z)})`) + '</g>'
    s += wallFoot(t, w, y + h - 26, cw, sel)
    if (!w.nodes.length && !pickerIn()) s += T(cw / 2, y + h - 40, 'nothing on this patch yet', { size: 9.5, a: .3, anchor: 'middle' })
  }
  /* at the right: the chosen track's strip, and the strip of where the whole room plays (none while the transport panel
     has the chosen track's: SIDE) */
  if (!SIDE) { MGEOM = null; return s }
  s += R(rx, y, RX - rx, h, { fill: K2, fa: .6 }) + vline(rx - .5, y, y + h, .08)
  const x1 = rx + GUT, x2 = x1 + WSTRIP + 6
  MGEOM = stripGeom(y, h, true)
  s += stripGutter(rx, GUT, y, h, true)
  s += R(x1, y, WSTRIP, h, { fill: INK, fa: t === OUT ? 0 : .05 }) + strip(x1, y, WSTRIP, h, S.tracks[S.sel], S.sel, { wide: true, sel: t !== OUT }) + vline(x1 + WSTRIP + 2.5, y + 8, y + h - 8, .07)
  if (t === OUT) s += R(x2, y, WSTRIP, h, { fill: INK, fa: .05 })
  s += strip(x2, y, WSTRIP, h, MASTER(), -1, { wide: true, master: true, sel: t === OUT })
  return s
}
const wallQuant = (v, step) => { const q = Math.round(v / step) * step; return +q.toFixed(step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)))) }
const wallHandNow = (node, h) => { const v = h.c.get(wallAsNode(node)); return h.c.kind === 'switch' ? (v ? 1 : 0) : v }
function wallHandSet (node, h, v) {
  const c = h.c, n = wallAsNode(node)
  if (c.kind === 'gauge') return wallApply(node, c.set(wallQuant(clamp(v, h.lo, h.hi), h.step), n))
  v = Math.round(v)
  if (v === wallHandNow(node, h)) return                                                    // (picked again: nothing, as in Patch on Slur — a switch would turn back, a shape be drawn again)
  wallApply(node, c.set(c.kind === 'switch' ? !!v : v, n))
}
const wallHandText = (node, h) => { const v = wallHandNow(node, h); if (h.opts) { const i = h.vals.indexOf(v); return i < 0 && h.none ? h.none : h.opts[Math.max(0, i)] } return h.fmt ? h.fmt(v, node) : `${wallQuant(v, h.step)}${h.unit ? ' ' + h.unit : ''}` }
/* the foot of the wall: what is chosen, and its hands (Patch on Slur's study, as a line of fields); with nothing chosen, how near the wall is */
function wallFoot (t, w, y, cw, sel) {
  let s = R(0, y, cw, 26, { fill: K1 }) + hline(0, cw, y, .07)
  const by = y + 16.6
  s += key(10, y + 4, 'add', { a: 'plugs', armed: S.picker.open })[0]
  let x = 10 + keyW('add', {}) + 14
  const node = sel && sel.node != null ? wallNode(w, sel.node) : null, lim = cw - 12
  if (node) {
    s += T(x, by, fit(asGiven(wallName(node)), 120, 10, 500), { size: 10, w: 500 }); x += Math.min(120, tw(wallName(node), 10, 500)) + 14
    if (wallIsPrint(node)) {
      if (wallHasAmount(node)) { const [f, fw] = field(x, by, wallMain(node.k), asGiven(wallValue(t, Object.assign({}, node, { bare: true })).trim()), { a: 'wall', more: ` data-k="amt" data-id="${node.id}"` }); if (x + fw < lim) { s += f; x += fw + 14 } }
      wallHands(node.k, node).forEach((h, i) => { const [f, fw] = field(x, by, h.label, asGiven(wallHandText(node, h)), { a: 'wall', more: ` data-k="hand" data-id="${node.id}" data-h="${i}"`, cur: h.opts ? 'pointer' : 'ns-resize' }); if (x + fw < lim - 150) { s += f; x += fw + 14 } })
    }
    let rx = lim
    const word = (label, k, on) => { const wd = keyW(label, {}); rx -= wd; s += key(rx, y + 4, label, { a: 'wall', more: ` data-k="${k}" data-id="${node.id}"`, armed: on })[0]; rx -= 6 }
    word(sel.arm ? 'sure?' : 'remove', 'rm', !!sel.arm)
    if (node.k === 'plug') { if (node.ins && node.ins.uid && !node.ins.out) word('off', 'off', !!node.ins.off) }
    else { if (!PC.isUtilityType(WALL_TYPE[node.k])) word('bypass', 'by', !!node.bypass); if (WALL_WET.has(node.k)) word('wet only', 'wet', !!node.wet) }
  } else if (sel && sel.wire != null && w.wires[sel.wire]) {
    const e = w.wires[sel.wire], nm = id => id === WALL_IN ? 'in' : id === WALL_OUT ? 'out' : wallName(wallNode(w, id) || { k: '' })
    s += T(x, by, asGiven(`${nm(e.from)} → ${nm(e.to)}`), { size: 10, w: 500 })
    const wd = keyW('remove', {}); s += key(lim - wd, y + 4, 'remove', { a: 'wall', more: ' data-k="rmw"' })[0]
  } else {
    const bad = WALL.bad.get(t.id)
    if (bad) s += T(x, by, asGiven(bad), { size: 9.5, c: REC })
    s += T(lim, by, asGiven(Math.round(w.z * 100) + '%'), { size: 9.5, a: .4, anchor: 'end' })
  }
  return s
}

/* ── hands ── */
function wallDown (e) {
  const el = e.target.closest ? e.target.closest('[data-a]') : null
  if (!el || el.dataset.a !== 'wall' || e.button === 2) return false
  const t = wallTrack(), w = wallOf(t), g = WALL.g
  if (!w || !g) return false
  e.preventDefault()
  if (S.menu) { S.menu = null; uiDirty('menu') }
  const k = el.dataset.k, id = el.dataset.id == null ? null : +el.dataset.id, p = pt(e), q = wallToWorld(w, g, p), node = id != null && id >= 0 ? wallNode(w, id) : null
  const now = performance.now(), twice = WALL.lastId === k + ':' + id && now - WALL.last < 380
  WALL.last = now; WALL.lastId = k + ':' + id
  const hold = d => { WALL.drag = Object.assign({ p0: p, q0: q, moved: false }, d); try { svg.setPointerCapture(e.pointerId) } catch (err) {} }
  S.focus = 'wall'
  const choose = v => { WALL.sel = v ? Object.assign({ t: t.id }, v) : null }
  switch (k) {
    case 'bg': if (twice) { w.z = 0 } else { choose(null); hold({ k: 'pan', ox: w.ox, oy: w.oy }) } break
    case 'port': choose(node ? { node: id } : null); hold({ k: 'wire', from: id, port: +(el.dataset.p || 0), to: null, land: null }); break
    case 'end': hold({ k: 'move', id, x: w.out.x, y: w.out.y }); break
    case 'cap': choose({ node: id }); hold({ k: 'move', id, x: node.x, y: node.y }); break
    case 'node': {
      choose({ node: id })
      if (node.k === 'plug' && e.altKey) {                                                // with option: stepped past, or back (one that was left out: all that are left out come back)
        const i = node.ins
        if (i && i.out) { if (typeof bringAllBack === 'function') bringAllBack() } else if (i && i.uid) { i.off = !i.off; if (NAT) NAT.call('bypass', { track: t.id, uid: i.uid, off: i.off ? 1 : 0 }) }
        break
      }
      if (node.k === 'plug' || node.k === 'meter' || node.k === 'side' || !wallHasAmount(node)) { hold({ k: 'move', id, x: node.x, y: node.y, press: node.k === 'plug' || node.k === 'meter' || node.k === 'side' }); break }
      if (e.altKey || twice) { wallSetAmount(t, node, WALL_LEGACY[node.k] ? PRINT_START[node.k] / 100 : wallNeutral(node.k)); break }      // twice, or with option: back to where it rests
      hold({ k: 'amt', id, v0: wallAmount(t, node), ly: p.y }); break
    }
    case 'amt': choose({ node: id }); if (e.altKey || twice) wallSetAmount(t, node, WALL_LEGACY[node.k] ? PRINT_START[node.k] / 100 : wallNeutral(node.k)); else hold({ k: 'amt', id, v0: wallAmount(t, node), ly: p.y }); break
    case 'wire': choose({ wire: +el.dataset.i }); break
    case 'lvl': { const i = +el.dataset.i; choose({ wire: i }); if (e.altKey || twice) { const m = wallNode(w, w.wires[i].to), n0 = w.wires.filter(x => x.to === w.wires[i].to).length; wallSetShare(t, i, m && (m.variant || 0) === 0 ? 1 / n0 : 1) } else hold({ k: 'lvl', i, v0: w.wires[i].gain, ly: p.y }); break }
    case 'hand': {
      const h = wallHands(node.k, node)[+el.dataset.h]
      if (!h) break
      if (h.opts) openMenu(p.x, p.y, h.opts.map((o, i) => ({ t: asGiven(o), v: h.vals[i], on: wallHandNow(node, h) === h.vals[i] })), it => { wallHandSet(node, h, it.v); if (node.k === 'mix') wallShares(w, node.id); wallPush(t); uiDirty('dock') }, { w: 120 })
      else if (e.altKey || twice) { wallHandSet(node, h, h.def); wallPush(t) }
      else hold({ k: 'hand', id, h, v0: wallHandNow(node, h), ly: p.y })
      break
    }
    case 'by': node.bypass = !node.bypass; wallPush(t); break
    case 'wet': node.wet = !node.wet; wallPush(t); break
    case 'off': if (node.ins) { node.ins.off = !node.ins.off; if (NAT) NAT.call('bypass', { track: t.id, uid: node.ins.uid, off: node.ins.off ? 1 : 0 }) } break
    case 'rm': if (node.k === 'plug' && !WALL.sel.arm) { WALL.sel.arm = true } else wallRemove(t, node); break
    case 'rmw': if (WALL.sel && WALL.sel.wire != null) { const to = w.wires[WALL.sel.wire].to; w.wires.splice(WALL.sel.wire, 1); wallShares(w, to); choose(null); wallPush(t) } break
  }
  uiDirty('dock')
  return true
}
function wallRemove (t, node) {
  const w = wallOf(t)
  if (node.k === 'plug') { const i = node.ins, at = t.inserts.indexOf(i); if (i && NAT && i.uid && !i.out) NAT.call('remove', { track: t.id, uid: i.uid }); if (at >= 0) t.inserts.splice(at, 1) }
  else if (WALL_LEGACY[node.k]) { setPrint(t, node.k, 0); if (t !== OUT) pushTrack(t) }
  const outs = w.wires.filter(e => e.from === node.id).map(e => e.to)
  wallTake(w, node.id)
  for (const to of outs) wallShares(w, to)
  WALL.sel = null; wallPush(t); uiDirty('dock')
}
function wallMove (e) {
  const d = WALL.drag, t = wallTrack(), w = wallOf(t), g = WALL.g
  if (!d || !w || !g) return
  const p = pt(e), q = wallToWorld(w, g, p)
  if (Math.hypot(p.x - d.p0.x, p.y - d.p0.y) > 3) d.moved = true
  if (d.k === 'pan') { w.ox = d.ox - (p.x - d.p0.x) / w.z; w.oy = d.oy - (p.y - d.p0.y) / w.z }
  else if (d.k === 'move' && d.moved) { const at = wallPos(w, d.id); at.x = Math.round(d.x + q.x - d.q0.x); at.y = Math.round(d.y + q.y - d.q0.y) }
  else if (d.k === 'amt') { const node = wallNode(w, d.id); if (node) wallSetAmount(t, node, d.v0 + (d.ly - p.y) * (e.shiftKey ? .001 : .005), true) }
  else if (d.k === 'lvl') wallSetShare(t, d.i, d.v0 + (d.ly - p.y) * (e.shiftKey ? .001 : .005))
  else if (d.k === 'hand') {
    const node = wallNode(w, d.id), h = d.h, dy = d.ly - p.y
    if (node) { const logish = h.lo > 0 && h.hi / h.lo >= 100, v = logish ? d.v0 * Math.pow(h.hi / h.lo, dy / 220) : d.v0 + dy * (h.hi - h.lo) / (e.shiftKey ? 1100 : 220); wallHandSet(node, h, clamp(v, h.lo, h.hi)); wallPush(t) }
  } else if (d.k === 'wire') {
    d.to = q; d.land = null; d.landIn = 0
    let best = 46
    for (const id of [WALL_OUT].concat(w.nodes.map(x => x.id))) { const at = wallPos(w, id), dist = Math.hypot(at.x - q.x, at.y - q.y); if (dist < best && wallMay(w, d.from, id, d.port)) { best = dist; d.land = id } }
    if (typeof wallKeyPort === 'function') for (const x of w.nodes) { if (!wallHasKey(x)) continue; const kp = wallKeyPort(w, x.id); if (Math.hypot(kp.x - q.x, kp.y - q.y) < 16 && wallMay(w, d.from, x.id, d.port, 1)) { d.land = x.id; d.landIn = 1 } }      // (near a print's key point: into its key)
  }
  uiDirty('dock')
}
function wallUp () {
  const d = WALL.drag, t = wallTrack(), w = wallOf(t)
  WALL.drag = null
  if (!d || !w) return
  if (d.k === 'wire' && d.land != null) wallWire(t, d.from, d.land, d.port, d.landIn)
  else if (d.k === 'move' && !d.moved && d.press) {                                    // a plug-in pressed and not moved: its own window (one that was left out: it is opened again, in its place)
    const node = wallNode(w, d.id), i = node && node.ins
    if (node && node.k === 'meter') { if (typeof meterOpen === 'function') meterOpen(t, node) }      // (a meter pressed: its face)
    else if (node && node.k === 'side') { if (typeof sideMenu === 'function') sideMenu(t, node) }   // (a side pressed: which track it plays)
    else if (i && i.out && typeof bringBack === 'function') bringBack(t, t.inserts.indexOf(i)).then(() => { WALL.sent.delete(t.id); wallPush(t); uiDirty('dock') })
    else if (i && i.uid && NAT) NAT.call('editor', { track: t.id, uid: i.uid })
  }
  else if (d.k === 'move' && d.moved && d.id >= 0) {
    /* something with no wires yet, set down on a wire, joins it there (as on Patch on Slur's wall) */
    const node = wallNode(w, d.id)
    if (node && !w.wires.some(e => e.from === d.id || e.to === d.id)) {
      let best = -1, bd = 26
      w.wires.forEach((e, i) => { const a = wallOutPort(w, e.from, e.port), b = wallInPort(w, e.to); for (let k = 1; k < 12; k++) { const u = k / 12, dx = Math.max(26, Math.abs(b.x - a.x) * .5), x = Math.pow(1 - u, 3) * a.x + 3 * Math.pow(1 - u, 2) * u * (a.x + dx) + 3 * (1 - u) * u * u * (b.x - dx) + Math.pow(u, 3) * b.x, yy = Math.pow(1 - u, 3) * a.y + 3 * Math.pow(1 - u, 2) * u * a.y + 3 * (1 - u) * u * u * b.y + Math.pow(u, 3) * b.y, dist = Math.hypot(x - node.x, yy - node.y); if (dist < bd) { bd = dist; best = i } } })
      if (best >= 0) { const e = w.wires[best], to = e.to; e.to = d.id; w.wires.push({ from: d.id, to, gain: e.gain, port: 0 }); e.gain = 1; wallPush(t) }
    }
  }
  if (d.k === 'amt' || d.k === 'hand' || d.k === 'lvl') wallPush(t)
  uiDirty('dock')
}
/* scrolling over the wall: nearer, further, about where the pointer is (a pinch does the same) */
function wallWheel (e) {
  const p = pt(e), g = WALL.g, t = wallTrack()
  if (!g || !S.panel.on || S.panel.tab !== 'patch' || (typeof instOpen === 'function' && instOpen()) || !t || t.id !== g.id || p.x < g.x || p.x > g.x + g.w || p.y < g.y || p.y > g.y + g.h - 26) return false
  const w = wallOf(t)
  if (!w) return false
  const q = wallToWorld(w, g, p), z = clamp(w.z * Math.exp(-(Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.ctrlKey ? .012 : .0035)), .35, 2.5)
  w.z = z; w.ox = q.x - (p.x - g.cx) / z; w.oy = q.y - (p.y - g.cy) / z
  e.preventDefault(); uiDirty('dock')
  return true
}

/* ── the list of what can be added: every print of Patch on Slur and every plug-in, by kind. What is picked (twice: his
   ask, 2026-10-20 — once opened one, and the habit of a double press opened two) is set at the end of the way and wired
   in; a print that plays other prints' hands, or has no way in, stands by itself, to be wired by hand ── */
const wallInline = k => !PC.isControlType(WALL_TYPE[k]) && !PC.noInputType(WALL_TYPE[k]) && k !== 'side'
function wallAdd (t, k) {
  const w = wallOf(t), id = wallFree(w)
  if (id < 0) return
  const inline = wallInline(k), at = inline ? wallNextSpot(w) : wallSpot(w)
  const node = Object.assign(wallNew(k, at.x, at.y), { id })
  if (k === 'macro') { const used = new Set(w.nodes.filter(x => x.k === 'macro').map(x => (x.aux || [])[0] || 0)); let m = 0; while (used.has(m) && m < 7) m++; node.aux = PC.auxOf(WALL_TYPE.macro, m).concat([0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 8) }      // (macro 1, 2… as on Patch on Slur's wall)
  w.nodes.push(node)
  if (inline) wallAppend(w, id)
  if (WALL_LEGACY[k]) { setPrint(t, k, PRINT_START[k]); if (t !== OUT) pushTrack(t) }
  WALL.sel = { t: t.id, node: id }; S.focus = 'wall'
  wallPush(t); uiDirty('dock')
}
async function wallPick (p) {
  const t = wallTrack(), w = wallOf(t), slot = S.panel.tab === 'mixer'
  if (S.picker.busy || wallFree(w) < 0) return
  S.picker.busy = p.id
  $('pk-head').innerHTML = `<b>opening</b><span>${esc(p.name.toLowerCase())}</span>`
  WALL.loose = null                                                                       // (at the end of the way, wired in, as from a strip's slot)
  const also = t === OUT || typeof pickTracks !== 'function' ? [] : pickTracks().filter(i => i !== S.sel && wallFree(wallOf(S.tracks[i])) >= 0)
  let r
  if (t === OUT) {                                                                       // the stereo out: the engine holds it as a bus from now on, and the plug-in is opened on that
    OUT.opening = true; await wallPushOut()
    r = await NAT.call('insert', { track: OUT_ID, id: p.id })
    OUT.opening = false
    if (r && r.ok) OUT.inserts.push({ uid: r.uid, name: r.name, fmt: r.fmt, id: p.id, sc: !!r.key })
  } else r = await natInsert(S.sel, p.id)
  S.picker.busy = null
  if (r && r.ok) wallOf(t)
  WALL.loose = null
  let more = 0
  if (r && r.ok) for (const i of also) { const q = await natInsert(i, p.id, { show: false }); if (q && q.ok) more++ }      // (on the others chosen with it: their windows stay shut)
  if (r && r.ok) { const nw = wallOf(t), node = nw.nodes.find(x => x.ins && x.ins.uid === r.uid); if (node && !slot) { WALL.sel = { t: t.id, node: node.id }; S.focus = 'wall' } wallPush(t); if (slot || more) closePicker(); else drawPicker(); if (more) say(`${p.name.toLowerCase()} put on ${more + 1} tracks`); uiDirty('dock') }
  else $('pk-head').innerHTML = `<b>would not open</b><span>${esc(String((r && r.error) || '').toLowerCase())}</span>`
}

/* ── joined to the room ── */
{
  const down0 = onDown, move0 = onMove, up0 = onUp, wheel0 = onWheel, draw0 = drawPicker, context0 = onContext
  pPatch = wallPatch
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null, a = el ? el.dataset.a : ''
    if (a === 'wall-out') {                                                              // the stereo out's strip, pressed by its name: its wall
      e.preventDefault(); WALL.out = true; WALL.sel = null; closePicker()
      if (!(S.panel.on && S.panel.tab === 'patch')) { S.panel.on = true; S.panel.tab = 'patch'; if (S.panel.inst) S.panel.inst = false; setView() }
      uiDirty('dock', 'head'); return
    }
    if (WALL.out && (a === 'sel' || a === 'msel' || a === 'm-patch' || a === 'lanes' || a === 'tab-mixer' || a === 'tab-notes' || a === 'mixer')) { WALL.out = false; WALL.sel = null; closePicker(); uiDirty('dock') }      // a track taken hold of: the patch is that track's again
    if (!wallDown(e)) down0(e)
  }
  { const head0 = pPanelHead
    pPanelHead = function (y, tab) {
      let s = head0(y, tab)
      if (tab !== 'patch' || !WALL.out) return s
      const nx = typeof pRoll === 'function' ? 168 : 120
      return s + R(nx - 4, y + 1, 300, PH - 2, { fill: K2 }) + R(nx, y + 10, 6, 6, { fill: MASTER().c }) + T(nx + 12, y + 16.6, 'stereo out', { size: 10.5, w: 500 }) + T(nx + 12 + tw('stereo out', 10.5, 500) + 7, y + 16.6, 'before its fader', { size: 9.5, a: .4 })
    } }
  onMove = function (e) { if (WALL.drag) { wallMove(e); return } move0(e) }
  onUp = function (e) { if (WALL.drag) { wallUp(); return } up0(e) }
  onWheel = function (e) { if (!wallWheel(e)) wheel0(e) }
  /* the other button on a plug-in: what it listens to (its key input) */
  onContext = function (e) {
    const el = e.button === 2 && e.target.closest ? e.target.closest('[data-a="wall"]') : null
    if (!el) return context0(e)
    e.preventDefault()
    const t = wallTrack(), w = wallOf(t), node = w && el.dataset.id != null ? wallNode(w, +el.dataset.id) : null, p = pt(e)
    if (node && node.k === 'plug' && node.ins && typeof openKeyMenu === 'function') openKeyMenu(t, t.inserts.indexOf(node.ins), p.x, p.y)
  }
  /* the delete key takes away what is chosen on the wall, when the wall was the last thing taken hold of */
  for (const code of ['Backspace', 'Delete']) { const k0 = KEYS[code]; KEYS[code] = () => { const t = wallTrack(), w = S.focus === 'wall' && WALL.sel && t && WALL.sel.t === t.id ? wallOf(t) : null; if (!w || !(S.panel.on && S.panel.tab === 'patch')) return k0(); if (WALL.sel.node != null) { const node = wallNode(w, WALL.sel.node); if (node) wallRemove(t, node) } else if (WALL.sel.wire != null && w.wires[WALL.sel.wire]) { const to = w.wires[WALL.sel.wire].to; w.wires.splice(WALL.sel.wire, 1); wallShares(w, to); WALL.sel = null; wallPush(t); uiDirty('dock') } } }
  /* the list, on a patch: the prints stand among the plug-ins of their kind, and under a kind of their own */
  drawPicker = function () {
    if (S.picker.what !== 'fx') return draw0()
    const t = wallTrack(), w = wallOf(t), q = $('pk-q').value.trim().toLowerCase(), full = !w || wallFree(w) < 0
    const prints0 = full ? [] : WALL_PRINTS.filter(k => !(WALL_LEGACY[k] && w.nodes.some(n => n.k === k)) && (!q || k.includes(q)))
    const found = full ? [] : (S.picker.list || []).filter(p => !p.inst && plugShown(p) && (!q || (p.name + ' ' + p.maker).toLowerCase().includes(q)))      // (not those left out in settings > plug-ins)
    const kinds = pickerIn(), cat = kinds ? S.picker.cat || 'all' : 'all', kindOf = p => p.cat || (p.cat = plugCat(p)), count = { all: prints0.length + found.length, slur: prints0.length }
    for (const k of prints0) count[WALL_KIND[k]] = (count[WALL_KIND[k]] || 0) + 1
    for (const p of found) count[kindOf(p)] = (count[kindOf(p)] || 0) + 1
    const prints = cat === 'all' || cat === 'slur' ? prints0 : prints0.filter(k => WALL_KIND[k] === cat), list = cat === 'all' ? found : cat === 'slur' ? [] : found.filter(p => kindOf(p) === cat)
    const cb = $('pk-cats'), box = $('pk-list')
    cb.hidden = !kinds; cb.textContent = ''; box.textContent = ''
    if (kinds) for (const c of ['all', 'slur'].concat(PLUG_CATS)) {
      if (c !== 'all' && c !== cat && !count[c]) continue
      const el = document.createElement('button'), nm = document.createElement('b'), k = document.createElement('span')
      el.type = 'button'; el.className = 'pk-cat' + (c === cat ? ' on' : ''); el.dataset.cat = c
      nm.textContent = LANG_WORDS(c); k.textContent = String(count[c] || 0)
      el.append(nm, k); el.onclick = () => { S.picker.cat = c; drawPicker(); $('pk-list').scrollTop = 0; $('pk-q').focus() }
      cb.append(el)
    }
    const many = t === OUT || typeof pickTracks !== 'function' ? 0 : pickTracks().length      // (several tracks chosen: it goes on all of them — mix.js)
    $('pk-head').innerHTML = full ? `<b>the wall is full</b><span>sixteen things</span>` : many > 1 ? `<b>on ${many} tracks</b><span>${esc(pickTracks().map(i => S.tracks[i].name).join(' '))}</span>` : `<b>add</b><span>${prints.length + list.length}</span>`
    const row = (name, maker, kind, pick, mark) => {
      const el = document.createElement('button'), nm = document.createElement('b'), mk = document.createElement('span'), f = document.createElement('i')
      el.type = 'button'; el.className = 'pk-row'; if (mark) el.dataset.print = mark
      nm.textContent = name; mk.textContent = maker; f.textContent = kind
      el.append(nm, mk, f)
      el.onclick = () => { for (const o of box.querySelectorAll('.pk-row.on')) o.classList.remove('on'); el.classList.add('on'); PICK_HI = pick }      // once: it is the one lit (return puts it on)
      el.ondblclick = e => { e.preventDefault(); PICK_HI = null; pick() }                                                                    // twice: on the wall
      box.append(el)
    }
    for (const k of prints) row(k, 'slur', 'print', () => { if (t !== OUT && (S.panel.tab === 'mixer' || pickTracks().length > 1)) { fxPrintOn(k); closePicker() } else { wallAdd(t, k); drawPicker() } }, k)
    for (const p of list.slice(0, 500)) row(p.name.toLowerCase(), (p.maker || '').toLowerCase(), p.fmt, () => wallPick(p))
  }
  $('pk-q').addEventListener('keydown', e => { if (e.key === 'Enter' && PICK_HI && S.picker.what === 'fx') { e.preventDefault(); const p = PICK_HI; PICK_HI = null; p() } })
  /* a plug-in opened on a track is on its wall, and the engine told, before whoever asked for it goes on (it plays nothing
     until the engine knows its place) */
  { const ni0 = natInsert; natInsert = async function (trackIndex, id, ...more) { const r = await ni0(trackIndex, id, ...more), t = S.tracks[trackIndex]; if (r && r.ok && t) { wallOf(t); await wallPush(t) } return r } }
  /* the walls are told to the engine when the room is (a project opened, the device changed) */
  if (typeof natSession === 'function') { const ns0 = natSession; natSession = async function (...a) { const r = await ns0(...a); WALL.sent.clear(); WALL.outTold = !!wallOutTrack(); wallPushAll(); return r } }
}

/* ── the stereo out as a row of its own, under the last track (his ask, 2026-10-21: "stereo out 도 채널로 메인 화면에 보이게
   … 선택을 못하니까 패치를 못건다"): its colour, its name, its level as a track's (pulled across; with option, 0), what
   it reads. Its head pressed, it is chosen: its patch below, to put things on (as its strip pressed by its name). Its lane
   is a ground of its own and holds no regions; pressed, it is as the room under the rows (his ask, 2026-10-23: the patch
   shows only when the head is pressed, and a band can be pulled from here). Not one of the song's tracks, so nothing else
   counts it. ── */
const outRowH = () => typeof SKIN === 'object' && SKINS.head[SKIN.k.heads] ? 0 : (typeof RTB !== 'undefined' && RTB.on ? 0 : S.rh)      // (a theme's own heads, a realtime print: none)
const outRowY = () => TY + rowTops().all - VY
function outHead () {
  const rh = outRowH(), y = outRowY()
  if (!rh || y >= BY || y + rh <= TY) return ''
  const on = !!WALL.out, c = MASTER().c, by = y + rh / 2 + 3.9, ins = clamp(Math.round(rh * .22), 4, 11), hs = lkN('heads.size')
  const two = rh >= HEAD_TWO, ny = two ? y + rh / 2 - 1.5 : by, lx = two ? 42 : HEAD_FX, lw = two ? HEAD_FW2 : HEAD_FW, ly = two ? y + rh / 2 + 9 : y + rh / 2 - 1, dbx = two ? lx + lw + 30 : HEAD_DB, dby = two ? ly + 3.6 : by - .4
  let s = R(0, y, HEAD_W, rh, { fill: K0, fa: .4 })                                       // (a ground a step darker: not one of the song's tracks)
  if (on) s += R(0, y, HEAD_W, rh, { fill: lkC('heads.chosen'), fa: lkA('heads.chosen') })
  s += R(10, y + ins, lkN('heads.mark'), rh - 2 * ins, { fill: c })
  s += hit(0, y, HEAD_W, rh, 'wall-out')
  s += T(42, ny, 'stereo out', { size: hs, w: on ? 500 : 400, a: on ? 1 : .88 })
  const held = OUT.wall && OUT.wall.nodes ? OUT.wall.nodes.length : 0
  if (held) s += T(42 + tw(LANG_WORDS('stereo out'), hs, on ? 500 : 400) + 6, ny, 'patch', { size: 9, a: .4 })      // (something stands on its wall)
  s += levelBar(lx, ly, lw, OUT, S.master).replace(`id="mt-${OUT.id}-0"`, 'id="mt-out-0"').replace(`id="mt-${OUT.id}-1"`, 'id="mt-out-1"') + hit(lx - 6, ly - 7, lw + 12, 16, 'outvol', ` data-gx="${n(lx)}" data-gw="${n(lw)}"`, 'ew-resize')
  s += T(dbx, dby, fmtDb(shown(OUT, 'vol')), { size: 9, a: on || autoPts(OUT, 'vol').length ? .9 : .56, anchor: 'end' })      // (where its line stands at the playhead, when it has one)
  return s + hline(0, HEAD_W, y + rh - .5, .05)
}
{ const head0 = PARTS.head
  PARTS.head = function () {
    const s = head0.apply(this, arguments), o = outHead()
    return !o || typeof s !== 'string' || (typeof SKIN === 'object' && SKIN.right) ? s : s + G(o, '', ' clip-path="url(#hdc)"')      // (in the heads' own clip, as the rows are)
  } }
{ const lanes0 = PARTS.lanes
  PARTS.lanes = function () {
    const r = lanes0.apply(this, arguments), clip = $('ln-clip'), edge = $('ln-edge')
    if (!clip || !edge) return r
    let g = $('ln-out'), h = $('ln-outhit')
    if (!g) { g = document.createElementNS(SVG_NS, 'g'); g.id = 'ln-out'; clip.insertBefore(g, $('ln-rows')) }
    const rh = outRowH(), y = outRowY(), shown = rh && y < BY && y + rh > TY
    const html = shown ? R(X0, y, X1 - X0, rh, { fill: K0, fa: .4 }) + autoLane(Object.assign(OUT, { c: MASTER().c }), y, rh) + hline(X0, X1, y + rh - .5, .045) : ''      // (its volume line, always up, as a bus's: auto.js)
    if (g.dataset.html !== html) { g.dataset.html = html; g.innerHTML = html }
    if (!h || h.parentNode !== edge) { h = document.createElementNS(SVG_NS, 'g'); h.id = 'ln-outhit'; edge.appendChild(h) }
    const hh = ''                                                                          // (its lane is the room under the rows: no press of its own)
    if (h.dataset.html !== hh) { h.dataset.html = hh; h.innerHTML = hh }
    return r
  } }
/* the stereo out's level set by hand: with a line drawn, the whole line moves with it (as a track's fader does: auto.js volSet) */
function outLevel (v) {
  const pts = autoPts(OUT, 'vol')
  if (!pts.length) { S.master = v; pushMaster() }
  else { const d = v - shown(OUT, 'vol'); if (d) { for (const q of pts) q.v = clamp(Math.round((q.v + d) * 10) / 10, -48, 6); resyncSoon() } }
  uiDirty('top', 'dock', 'head', 'lanes')
}
/* its level pulled across, as a track's: where the hand is (with shift, finely; with option, 0) */
{ const down0 = onDown, move0 = onMove
  onDown = function (e) {
    const el = e && e.target && e.target.closest ? e.target.closest('[data-a="outvol"]') : null
    if (!el || e.button !== 0) return down0.apply(this, arguments)
    e.preventDefault()
    if (e.altKey) { outLevel(0); return }
    const p = pt(e), gx = +el.dataset.gx, gw = +el.dataset.gw
    drag = { a: 'outvol', gx, gw, f: volF(S.master), lx: p.x }
    if (!e.shiftKey) { drag.f = clamp((p.x - gx) / gw, 0, 1); outLevel(fVol(drag.f)) }
    try { svg.setPointerCapture(e.pointerId) } catch (err) {}
  }
  onMove = function (e) {
    const r = move0.apply(this, arguments)
    if (drag && drag.a === 'outvol') { const d = drag, x = pt(e).x; d.f = e.shiftKey ? clamp(d.f + (x - d.lx) / d.gw * .2, 0, 1) : clamp((x - d.gx) / d.gw, 0, 1); d.lx = x; outLevel(fVol(d.f)) }
    return r
  } }
/* what it reads, as the out's ring does */
{ const meters0 = drawMeters
  drawMeters = function () {
    meters0.apply(this, arguments)
    if (typeof METERS === 'object') for (let c = 0; c < 2; c++) { const el = $('mt-out-' + c); if (el) el.setAttribute('width', n(+el.dataset.w * volF(Math.min(6, linDb(METERS.mm[c] || 0))))) }      // (two sides, as a stereo track's: ui.js levelBar)
  } }

