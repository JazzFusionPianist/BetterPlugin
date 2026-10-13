/* ── a track's patch as a wall: Patch on Slur, built in ──
   What stands on a patch — Patch on Slur's prints, drawn as it draws them (prints.js), and plug-ins from outside — stands
   on a wall and is wired from port to port, the way it is in Patch on Slur: an output goes to as many inputs as it is given
   wires, a `mix` takes any number of wires and a level rides each of them, and ways that run side by side are lined up by
   the engine. A wall begins with `in` and `out` and nothing between them: the sound goes by untouched until something is
   wired from in to out. Scrolling over the wall makes it nearer or further; its ground is pulled about by hand.

   A track keeps its wall as t.wall = { nodes, wires, z, ox, oy, in: {x, y}, out: {x, y} }.
     a node:  { id, k, x, y, … }   k is a print's name ('tape', 'comp', 'mix', …) or 'plug'
              a print: amount (0 to 1), variant, decay [3], div, fb, wet, bypass, aux [8]
              a plug-in: ins = its entry in t.inserts (written into a project as p, its place among them)
     a wire:  { from, to, gain, port }   from and to are node ids, -1 is in, -2 is out
   tape, space and delay keep their amounts where they always were (t.patch: the lines drawn for them along the song, the
   command line's words for them and undo go on working as they did), so there is one of each on a wall.

   This script is read after the room's own hands are made (it takes the patch's place on the panel, and the list's). */
const WALL_IN = -1, WALL_OUT = -2, WALL_MAX = 16, WALL_R = 30, WALL_E = 39
const WALL_TYPE = { tone: 0, tape: 1, space: 2, stereo: 3, glue: 4, gain: 5, mod: 6, cut: 7, amp: 8, doubler: 9, delay: 10, mix: 11, tremolo: 12, arp: 13, radio: 14, harmony: 15, pitch: 16, formant: 17, grain: 18, crush: 20,
  shimmer: 21, swell: 22, stutter: 23, air: 24, ring: 25, gate: 26, wow: 27, 'l/r': 28, 'm/s': 29, comp: 35, carve: 37, match: 38, vocode: 39, freeze: 40, shift: 41, smear: 42, pan: 43, repeat: 44, fold: 46, sieve: 50 }
/* the families, as Patch on Slur's shelf has them: a family gives a print the shape of its plate */
const WALL_FAMILIES = { tone: ['cut', 'amp', 'tone', 'tape', 'glue', 'comp', 'air'], grit: ['crush', 'radio', 'ring', 'fold'], space: ['delay', 'space', 'shimmer', 'doubler', 'stereo'], motion: ['mod', 'tremolo', 'swell', 'stutter', 'gate', 'wow', 'repeat'],
  pitch: ['pitch', 'formant', 'harmony', 'arp', 'grain'], utility: ['gain', 'mix', 'l/r', 'm/s', 'pan'], spectral: ['carve', 'match', 'vocode', 'freeze', 'shift', 'smear', 'sieve'] }
const WALL_FAMILY = {}
for (const [f, ks] of Object.entries(WALL_FAMILIES)) for (const k of ks) WALL_FAMILY[k] = f
const WALL_PRINTS = Object.keys(WALL_FAMILY)
/* where each print stands in the list of what can be added: among the plug-ins of its kind (cats.js) */
const WALL_KIND = { cut: 'eq', tone: 'eq', air: 'eq', carve: 'eq', match: 'eq', sieve: 'eq', tape: 'saturation', crush: 'saturation', radio: 'saturation', ring: 'saturation', fold: 'saturation', amp: 'amp', glue: 'dynamics', comp: 'dynamics', gate: 'dynamics', swell: 'dynamics',
  delay: 'delay', repeat: 'delay', stutter: 'delay', space: 'reverb', shimmer: 'reverb', freeze: 'reverb', smear: 'reverb', doubler: 'modulation', mod: 'modulation', tremolo: 'modulation', wow: 'modulation', stereo: 'stereo', pan: 'stereo', 'l/r': 'stereo', 'm/s': 'stereo',
  pitch: 'pitch', formant: 'pitch', harmony: 'pitch', arp: 'pitch', grain: 'pitch', vocode: 'pitch', shift: 'pitch', gain: 'channel', mix: 'channel' }
const WALL_VARIANTS = { tape: ['hard', 'clean'], space: ['hall', 'room', 'plate'], mod: ['chorus', 'flanger', 'phaser'], amp: ['clean', 'crunch', 'lead', 'fuzz'], doubler: ['tight', 'wide'], delay: ['clean', 'tape', 'pingpong'], tremolo: ['sine', 'triangle', 'square', 'pulse', 'saw'],
  arp: ['up', 'down', 'up-down', 'random'], radio: ['am', 'phone'], harmony: ['key', 'chromatic'], pitch: ['raw', 'natural'], grain: ['cloud', 'stutter', 'reverse'], crush: ['both', 'bits', 'rate'], shimmer: ['octave', 'fifth', 'down'], swell: ['soft', 'hard'],
  stutter: ['beat', 'bar'], air: ['silk', 'bright'], ring: ['ring', 'am'], gate: ['tight', 'loose'], wow: ['wow', 'flutter', 'both'], mix: ['blend', 'sum'], fold: ['sine', 'triangle'] }
const WALL_WET = new Set(['space', 'delay', 'doubler', 'mod', 'harmony', 'grain', 'shimmer'])
const WALL_LEGACY = { tape: 1, space: 2, delay: 3 }                                       // their amounts are the track's own (t.patch)
const WALL_TWO = new Set(['l/r', 'm/s'])                                                  // two ways out
const WALL_AUX0 = { cut: [2, 0, 0], arp: [12, 0, 0], harmony: [0, 0, 2], grain: [120, 300, 7, 0, 0, 50, 0, 0], comp: [40, 100, 150, 6, 0], carve: [20, 200, 20, 20000], match: [1, 12, 0], vocode: [24, 10, 80], shift: [200, 0, 0], smear: [800, 0, 0], sieve: [5, 80, 100], repeat: [0, 3, 0, 200, -30, 0] }
const wallNeutral = k => k === 'tone' || k === 'stereo' || k === 'pitch' || k === 'formant' || k === 'pan' ? .5 : k === 'gain' ? .75 : 0
/* what the big hand of a print is called, where "amount" would say too little */
const WALL_MAIN = { cut: 'cutoff', comp: 'threshold', carve: 'depth', pan: 'pan', fold: 'drive', freeze: 'hold', sieve: 'keep', gain: 'level' }
/* the other hands of each print (Patch on Slur's study): a gauge is pulled, a choice is picked from its list */
const WALL_DIVS = ['1/16', '1/8t', '1/8', '1/8.', '1/4', '1/4.', '1/2'], WALL_RATES = ['1/32', '1/16', '1/8', '1/4', '1/2', '1/1', '2/1', '4/1'], WALL_KEYS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const wg = (h, label, lo, hi, unit, def, sc) => ({ h, label, lo, hi, unit: unit || '', def, sc: sc || 1 }), wc = (h, label, opts, vals) => ({ h, label, opts, vals: vals || opts.map((_, i) => i) })
const WALL_HANDS = {
  cut: [wc('variant', 'pass', ['low pass', 'high pass'], [1, 0]), wc('aux0', 'slope', ['12', '24', '36', '48'], [1, 2, 3, 4])],
  tremolo: [wc('aux0', 'moves', ['volume', 'pan']), wc('div', 'rate', WALL_DIVS)],
  space: [wg('decay', 'decay', 0, 100, '', 50)],
  delay: [wc('div', 'time', WALL_DIVS), wg('fb', 'feedback', 0, 100, '%', 35)],
  arp: [wc('div', 'rate', WALL_DIVS), wg('aux0', 'step', 1, 12, 'st', 12)],
  harmony: [wc('aux0', 'key', WALL_KEYS), wc('aux1', 'scale', ['major', 'minor']), wg('aux2', 'interval', -12, 12, '', 2)],
  pitch: [wg('aux0', 'cents', -100, 100, 'c', 0), wc('aux1', 'engine', ['fine', 'live'])],
  formant: [wc('aux0', 'engine', ['fine', 'live'])],
  grain: [wg('aux0', 'size', 10, 600, 'ms', 120), wg('aux1', 'spray', 0, 1500, 'ms', 300), wg('aux2', 'scatter', 0, 24, 'st', 7), wc('aux6', 'pitch', ['key', 'intervals', 'cents', 'free']), wc('aux3', 'key', WALL_KEYS), wc('aux4', 'scale', ['major', 'minor']), wc('div', 'rate', WALL_DIVS), wg('aux5', 'pan', 0, 100, '%', 50), wc('aux7', 'freeze', ['off', 'on'])],
  swell: [wg('aux0', 'depth', 0, 100, '%', 100)],
  comp: [wc('variant', 'detector', ['peak', 'rms']), wg('aux0', 'ratio', 10, 200, ':1', 40, .1), wg('aux1', 'attack', 1, 1000, 'ms', 100, .1), wg('aux2', 'release', 10, 2000, 'ms', 150), wg('aux3', 'knee', 0, 24, 'db', 6), wg('aux4', 'makeup', 0, 24, 'db', 0)],
  carve: [wg('aux0', 'attack', 1, 200, 'ms', 20), wg('aux1', 'release', 20, 2000, 'ms', 200), wg('aux2', 'from', 20, 20000, 'hz', 20), wg('aux3', 'to', 20, 20000, 'hz', 20000)],
  match: [wc('aux0', 'learn', ['off', 'on']), wg('aux1', 'smooth', 1, 48, '', 12)],
  vocode: [wg('aux0', 'bands', 8, 64, '', 24), wg('aux1', 'attack', 1, 200, 'ms', 10), wg('aux2', 'release', 10, 2000, 'ms', 80)],
  shift: [wg('aux0', 'hz', -2000, 2000, 'hz', 200), wg('aux1', 'feedback', 0, 95, '%', 0)],
  smear: [wg('aux0', 'time', 50, 5000, 'ms', 800), wg('aux1', 'blur', 0, 100, '%', 0)],
  sieve: [wg('aux0', 'attack', 1, 200, 'ms', 5), wg('aux1', 'release', 20, 2000, 'ms', 80), wg('aux2', 'mix', 0, 100, '%', 100)],
  repeat: [wc('aux0', 'clock', ['sync', 'hz']), wc('aux1', 'rate', WALL_RATES), wc('aux2', 'feel', ['straight', 'dotted', 'triplet']), wg('aux3', 'hz', 1, 2000, 'hz', 200, .01), wg('aux4', 'threshold', -60, -1, 'db', -30)],
  gain: [wc('variant', 'phase', ['as it is', 'ø left', 'ø right', 'ø both'])],
}
const wallHands = k => { const own = WALL_HANDS[k] || []; return WALL_VARIANTS[k] && !own.some(h => h.h === 'variant') && k !== 'gain' ? [wc('variant', k === 'mix' ? 'adds' : 'mode', WALL_VARIANTS[k])].concat(own) : own }

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
  return { wall: wallSaved(OUT), patch: copy(OUT.patch), inserts: OUT.inserts.filter(i => i.id).map(i => Object.assign({ id: i.id, name: i.name, fmt: i.fmt, state: i.state || '' }, i.off ? { off: true } : {}, i.out ? { out: true } : {})) }
}
async function wallOutLoad (d) {
  OUT.inserts = []; OUT.wall = null; OUT.patch = NO_PATCH(); OUT.used = false; OUT._told = null; WALL.out = false
  if (!d || !d.wall || !Array.isArray(d.wall.nodes) || !d.wall.nodes.length) { await wallPushOut(); return }
  OUT.wall = d.wall; if (d.patch) OUT.patch = d.patch
  await wallPushOut()
  for (const ins of d.inserts || []) {
    const kept = { uid: 0, name: ins.name || 'plug-in', fmt: ins.fmt || '', id: ins.id, state: ins.state || '', off: !!ins.off, out: true }
    const bare = typeof LOAD !== 'undefined' && LOAD.bare, no = typeof DISTRUST !== 'undefined' && DISTRUST.has(ins.id)
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
const wallNew = (k, x, y) => ({ k, x, y, amount: wallNeutral(k), variant: k === 'cut' ? 1 : 0, decay: [.5, .5, .5], div: 2, fb: .35, wet: false, bypass: false, aux: (WALL_AUX0[k] || [0, 0, 0]).concat([0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 8) })

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
    if (w.nodes.length) for (const f of last) w.wires.push({ from: f, to: WALL_OUT, gain: 1, port: 0 })
    w.in = { x: 40, y: 0 }; w.out = { x: Math.max(260, x - (w.nodes.length ? 20 : 0)), y: 0 }
  }
  if (!w.in) w.in = { x: 40, y: 0 }
  if (!w.out) w.out = { x: 260, y: 0 }
  w.v = typeof isInst === 'function' && isInst(t) ? 1 : 0                                 // (a track of notes: its instrument stands where in would, and the wires start at its side)
  /* a plug-in written into a project by its place among the track's plug-ins is found again as they are opened */
  const own = t.inserts.filter(i => i.id || i.uid)
  for (const n of w.nodes) if (n.k === 'plug' && !n.ins && n.p != null && own[n.p]) { n.ins = own[n.p]; delete n.p }
  /* one that is no longer on the track goes from the wall (what fed it feeds what it fed); one that has no place gets one:
     picked from the wall's own list it stands unwired, to be wired by hand (wallPick); put on the track any other way (a
     command, a copy of a track, the check) it joins the end of the way, as a plug-in always did */
  for (const n of w.nodes.slice()) if (n.k === 'plug' && n.ins && !t.inserts.includes(n.ins)) wallTake(w, n.id)
  if (!w.nodes.some(n => n.k === 'plug' && !n.ins && n.p != null)) for (const ins of t.inserts) if (!w.nodes.some(n => n.ins === ins)) { const id = wallFree(w); if (id < 0) break; const at = wallSpot(w); w.nodes.push({ id, k: 'plug', ins, x: at.x, y: at.y }); if (WALL.loose !== t.id) wallAppend(w, id) }
  /* a print turned up from somewhere else (the command line, a template) while it has no place: it joins the way out */
  if (t.patch) for (const k of PRINTS3) if (patchNow(t)[k] > .5 && !w.nodes.some(n => n.k === k)) { const id = wallFree(w); if (id < 0) break; const at = wallSpot(w); w.nodes.push(Object.assign(wallNew(k, at.x, at.y), { id })); wallAppend(w, id) }
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
/* a node put at the end of the way: everything that went to out goes through it (nothing did: in, the node, out) */
function wallAppend (w, id) {
  const outs = w.wires.filter(e => e.to === WALL_OUT)
  if (outs.length) { for (const e of outs) e.to = id } else w.wires.push({ from: WALL_IN, to: id, gain: 1, port: 0 })
  w.wires.push({ from: id, to: WALL_OUT, gain: 1, port: 0 })
  wallShares(w, id)
}
/* a node taken off: when one wire fed it, that wire's start now feeds whatever it fed (Patch on Slur heals the same way) */
function wallTake (w, id) {
  const ins = w.wires.filter(e => e.to === id), outs = w.wires.filter(e => e.from === id)
  w.wires = w.wires.filter(e => e.from !== id && e.to !== id)
  if (ins.length === 1) for (const o of outs) if (o.to !== ins[0].from && !w.wires.some(e => e.from === ins[0].from && e.to === o.to && (e.port || 0) === (ins[0].port || 0))) w.wires.push({ from: ins[0].from, to: o.to, gain: o.gain, port: ins[0].port || 0 })
  w.nodes = w.nodes.filter(n => n.id !== id)
}
const wallReach = (w, a, b, seen = new Set()) => { if (a === b) return true; if (seen.has(a)) return false; seen.add(a); return w.wires.some(e => e.from === a && wallReach(w, e.to, b, seen)) }
/* may a wire be drawn from here to there: not onto itself, not twice, not into in or out of out, never round in a ring */
function wallMay (w, from, to, port) {
  if (from === to || from === WALL_OUT || to === WALL_IN) return false
  if (w.wires.some(e => e.from === from && e.to === to && (e.port || 0) === (port || 0))) return false
  return !wallReach(w, to, from)
}
/* a mix that blends shares a hundred among its wires: a new wire, or one taken away, and they are made even */
function wallShares (w, id) {
  const m = wallNode(w, id)
  if (!m || m.k !== 'mix' || (m.variant || 0) !== 0) return
  const ins = w.wires.filter(e => e.to === id)
  for (const e of ins) e.gain = 1 / ins.length
}
function wallWire (t, from, to, port) {
  const w = wallOf(t)
  if (!wallMay(w, from, to, port)) return false
  w.wires.push({ from, to, gain: 1, port: port || 0 }); wallShares(w, to); wallPush(t)
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
function wallMsg (t) {
  const w = wallOf(t)
  if (!w) return null
  const nodes = w.nodes.map(n => {
    if (n.k === 'plug') { const i = n.ins; return i && i.uid && !i.out && !i.dead ? { id: n.id, type: 51, uid: i.uid } : { id: n.id, type: 5, amount: .75, bypass: 1 } }      // (one that would not open, or is still opening: the sound goes by its place)
    return { id: n.id, type: WALL_TYPE[n.k], amount: +wallAmount(t, n).toFixed(4), variant: n.variant || 0, decay: n.decay || [.5, .5, .5], delayDiv: n.div == null ? 2 : n.div, delayFb: n.fb == null ? .35 : n.fb, wet: n.wet ? 1 : 0, bypass: n.bypass ? 1 : 0, aux: n.aux || [], line: WALL_LEGACY[n.k] || 0 }
  })
  const edges = w.wires.filter(e => (e.from === WALL_IN || wallNode(w, e.from)) && (e.to === WALL_OUT || wallNode(w, e.to))).map(e => ({ from: e.from, to: e.to, gain: +(+e.gain).toFixed(4), port: e.port || 0, in: 0 }))
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
  return { nodes: t.wall.nodes.map(n => { const o = Object.assign({}, n); if (n.k === 'plug') { delete o.ins; o.p = n.ins ? own.indexOf(n.ins) : n.p } return o }).filter(o => o.k !== 'plug' || o.p >= 0), wires: copy(t.wall.wires), z: t.wall.z, ox: t.wall.ox, oy: t.wall.oy, in: copy(t.wall.in), out: copy(t.wall.out) }
}

/* a track's wall as a file Patch on Slur opens (the hand-off): its prints and their wires — a plug-in from outside is not a
   thing Patch on Slur has, so its place is closed over, as when it is taken off. Nothing to hand over: null. */
function wallPreset (t) {
  const w0 = wallOf(t)
  if (!w0 || !w0.nodes.some(n => n.k !== 'plug')) return null
  const w = { nodes: w0.nodes.slice(), wires: w0.wires.map(e => Object.assign({}, e)) }
  for (const n of w0.nodes) if (n.k === 'plug') wallTake(w, n.id)
  const x0 = Math.min(...w.nodes.map(n => n.x))
  return JSON.stringify({ nodes: w.nodes.map(n => ({ id: n.id, type: WALL_TYPE[n.k], amount: +wallAmount(t, n).toFixed(4), variant: n.variant || 0, decay: n.decay || [.5, .5, .5], delayDiv: n.div == null ? 2 : n.div, delayFb: n.fb == null ? .35 : n.fb, wet: !!n.wet, bypass: !!n.bypass, aux: n.aux || [0, 0, 0], x: Math.round(180 + (n.x - x0) * 1.6), y: Math.round(280 + (n.y - w0.in.y) * 1.6) })),
    edges: w.wires.map(e => ({ from: e.from, to: e.to, gain: +(+e.gain).toFixed(4), port: e.port || 0 })) }, null, 1)
}

/* ── drawn ── */
const wallView = (w, g) => { if (!w.z) wallFit(w, g); return { z: w.z, tx: g.cx - w.ox * w.z, ty: g.cy - w.oy * w.z } }
function wallFit (w, g) {
  const all = [w.in, w.out].concat(w.nodes), x0 = Math.min(...all.map(q => q.x)) - 70, x1 = Math.max(...all.map(q => q.x)) + 70, y0 = Math.min(...all.map(q => q.y)) - 60, y1 = Math.max(...all.map(q => q.y)) + 86
  w.z = clamp(Math.min((g.w - 24) / (x1 - x0), (g.h - 40) / (y1 - y0)), .45, 1)
  w.ox = (x0 + x1) / 2; w.oy = (y0 + y1) / 2
}
const wallToWorld = (w, g, p) => ({ x: (p.x - g.cx) / w.z + w.ox, y: (p.y - g.cy) / w.z + w.oy })
const wallOutPort = (w, id, port) => { const q = wallPos(w, id); if (id === WALL_IN) return { x: q.x + (w.v ? WALL_E : 7), y: q.y }; const n = wallNode(w, id), two = n && WALL_TWO.has(n.k); return { x: q.x + WALL_E, y: q.y + (two ? (port ? 13 : -13) : 0) } }
const wallInPort = (w, id) => { const q = wallPos(w, id); return id === WALL_OUT ? { x: q.x - 7, y: q.y } : { x: q.x - WALL_E, y: q.y } }
const wallCurve = (a, b) => { const dx = Math.max(26, Math.abs(b.x - a.x) * .5); return `M${n(a.x)} ${n(a.y)}C${n(a.x + dx)} ${n(a.y)} ${n(b.x - dx)} ${n(b.y)} ${n(b.x)} ${n(b.y)}` }
function wallPrint (t, node, sel) {
  const fam = WALL_FAMILY[node.k] || 'tone', type = WALL_TYPE[node.k], tint = PATCH_PRINTS.PLATE_TINT[type] || '#B8B4AA'
  const inner = PATCH_PRINTS.printInner({ type, amount: wallAmount(t, node), variant: node.variant || 0, aux: node.aux || [0, 0, 0, 0, 0, 0, 0, 0] }, fam, tint).replace(/'Space Mono', ui-monospace, monospace/g, 'Instrument Sans')
  return `<g transform="translate(${n(node.x)} ${n(node.y)}) scale(${WALL_R})"${node.bypass ? ' opacity=".35"' : ''}>${inner}</g>` + (sel ? Cc(node.x, node.y, WALL_R + 7, { stroke: INK, sa: .5, dash: '2 3' }) : '')
}
const wallValue = (t, node) => {
  const a = wallAmount(t, node), vs = WALL_VARIANTS[node.k], v = vs && node.k !== 'mix' ? vs[node.variant || 0] || '' : ''
  if (node.k === 'mix') return (node.variant || 0) === 0 ? 'blends' : 'adds'
  if (WALL_TWO.has(node.k)) return ''
  const num = node.k === 'tone' || node.k === 'stereo' || node.k === 'pan' || node.k === 'pitch' || node.k === 'formant' ? (a === .5 ? '0' : (a > .5 ? '+' : '−') + Math.round(Math.abs(a - .5) * 200)) : String(Math.round(a * 100))
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
      if (!wallPos(w, e.from) || !wallPos(w, e.to)) return
      const p0 = wallOutPort(w, e.from, e.port), p1 = wallInPort(w, e.to), dd = wallCurve(p0, p1), chosen = sel && sel.wire === i, m = wallNode(w, e.to)
      a += P(dd, { stroke: INK, sa: chosen ? 1 : .46, sw: chosen ? 1.6 : 1 }) + dot(p0) + dot(p1)
      hits += `<path d="${dd}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="12" data-a="wall" data-k="wire" data-i="${i}" style="cursor:pointer"/>`
      if (m && m.k === 'mix') {
        const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2, on = chosen || (d && d.k === 'lvl' && d.i === i)
        a += R(mx - 13, my - 7.5, 26, 15, { rx: 2, fill: K1 }) + R(mx - 12.5, my - 7, 25, 14, { rx: 2, stroke: INK, sa: on ? .7 : .24, fill: on ? K3 : K1 }) + T(mx, my + 3.4, asGiven(String(Math.round(e.gain * 100))), { size: 9, a: on ? 1 : .72, anchor: 'middle' })
        hits += `<rect x="${n(mx - 15)}" y="${n(my - 10)}" width="30" height="20" fill="#000" fill-opacity="0" data-a="wall" data-k="lvl" data-i="${i}" style="cursor:ns-resize"/>`
      }
    })
    if (d && d.k === 'wire' && d.to) a += P(wallCurve(wallOutPort(w, d.from, d.port), d.land != null ? wallInPort(w, d.land) : d.to), { stroke: INK, sa: .85, dash: '3 3' }) + (d.land != null ? '' : Cc(d.to.x, d.to.y, 4.5, { stroke: INK, sa: .9 }))
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
        a += wallPrint(t, node, chosen)
        a += T(node.x, node.y + 49, node.k, { size: 10, w: 500, anchor: 'middle' }) + T(node.x, node.y + 61.5, asGiven(wallValue(t, node)), { size: 9, a: .46, anchor: 'middle' })
      }
      if (land) a += Cc(node.x, node.y, WALL_R + 9, { stroke: INK, sa: .9 })
      hits += `<rect x="${n(node.x - 34)}" y="${n(node.y - 34)}" width="68" height="68" fill="#000" fill-opacity="0" data-a="wall" data-k="node" data-id="${node.id}" style="cursor:${node.k === 'plug' ? 'pointer' : node.k === 'mix' || WALL_TWO.has(node.k) ? 'grab' : 'ns-resize'}"/>`
      hits += `<rect x="${n(node.x - 44)}" y="${n(node.y + 38)}" width="88" height="28" fill="#000" fill-opacity="0" data-a="wall" data-k="cap" data-id="${node.id}" style="cursor:grab"/>`
      const two = WALL_TWO.has(node.k)
      for (const port of two ? [0, 1] : [0]) { const q = wallOutPort(w, node.id, port); hits += `<circle cx="${n(q.x)}" cy="${n(q.y)}" r="${two ? 9 : 11}" fill="#000" fill-opacity="0" data-a="wall" data-k="port" data-id="${node.id}" data-p="${port}" style="cursor:crosshair"/>`; if (!w.wires.some(e => e.from === node.id && (e.port || 0) === port)) a += Cc(q.x, q.y, 2.2, { stroke: INK, sa: .5, fill: K1 }) }
      if (!w.wires.some(e => e.to === node.id)) { const q = wallInPort(w, node.id); a += Cc(q.x, q.y, 2.2, { stroke: INK, sa: .5, fill: K1 }) }
    }
    s += `<g clip-path="url(#${cid})"><rect x="0" y="${n(y)}" width="${n(Math.max(0, cw))}" height="${n(h)}" fill="#000" fill-opacity="0" data-a="wall" data-k="bg" style="cursor:default"/>` + G(a + hits, `translate(${n(v.tx)} ${n(v.ty)}) scale(${n(v.z)})`) + '</g>'
    s += wallFoot(t, w, y + h - 26, cw, sel)
    if (!w.nodes.length && !pickerIn()) s += T(cw / 2, y + h - 40, 'nothing on this patch yet', { size: 9.5, a: .3, anchor: 'middle' })
  }
  /* at the right: the chosen track's strip, and the strip of where the whole room plays */
  s += R(rx, y, RX - rx, h, { fill: K2, fa: .6 }) + vline(rx - .5, y, y + h, .08)
  const x1 = rx + GUT, x2 = x1 + WSTRIP + 6
  MGEOM = stripGeom(y, h, true)
  s += stripGutter(rx, GUT, y, h, true)
  s += R(x1, y, WSTRIP, h, { fill: INK, fa: t === OUT ? 0 : .05 }) + strip(x1, y, WSTRIP, h, S.tracks[S.sel], S.sel, { wide: true, sel: t !== OUT }) + vline(x1 + WSTRIP + 2.5, y + 8, y + h - 8, .07)
  if (t === OUT) s += R(x2, y, WSTRIP, h, { fill: INK, fa: .05 })
  s += strip(x2, y, WSTRIP, h, MASTER(), -1, { wide: true, master: true, sel: t === OUT })
  return s
}
const wallHandNow = (node, h) => h.h === 'variant' ? node.variant || 0 : h.h === 'div' ? (node.div == null ? 2 : node.div) : h.h === 'fb' ? Math.round((node.fb == null ? .35 : node.fb) * 100) : h.h === 'decay' ? Math.round(((node.decay || [.5, .5, .5])[clamp(node.variant || 0, 0, 2)]) * 100) : (node.aux || [])[+h.h.slice(3)] || 0
function wallHandSet (node, h, v) {
  v = Math.round(v)
  if (h.h === 'variant') node.variant = v
  else if (h.h === 'div') node.div = v
  else if (h.h === 'fb') node.fb = v / 100
  else if (h.h === 'decay') { node.decay = (node.decay || [.5, .5, .5]).slice(); node.decay[clamp(node.variant || 0, 0, 2)] = v / 100 }
  else { node.aux = (node.aux || []).concat([0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 8); node.aux[+h.h.slice(3)] = v; if (node.k === 'swell' && h.h === 'aux0') node.aux[1] = 1 }
}
const wallHandText = (node, h) => { const v = wallHandNow(node, h); if (h.opts) { const i = h.vals.indexOf(v); return h.opts[i < 0 ? 0 : i] } const x = v * h.sc; return (h.sc < 1 ? (h.sc <= .01 ? x.toFixed(2) : x.toFixed(1)) : String(x)) + (h.unit ? (h.unit === ':1' ? '' : ' ') + h.unit : '') }
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
      if (node.k !== 'mix' && !WALL_TWO.has(node.k)) { const [f, fw] = field(x, by, WALL_MAIN[node.k] || 'amount', asGiven(wallValue(t, Object.assign({}, node, { variant: -1 })).trim()), { a: 'wall', more: ` data-k="amt" data-id="${node.id}"` }); if (x + fw < lim) { s += f; x += fw + 14 } }
      wallHands(node.k).forEach((h, i) => { const [f, fw] = field(x, by, h.label, asGiven(wallHandText(node, h)), { a: 'wall', more: ` data-k="hand" data-id="${node.id}" data-h="${i}"`, cur: h.opts ? 'pointer' : 'ns-resize' }); if (x + fw < lim - 150) { s += f; x += fw + 14 } })
    }
    let rx = lim
    const word = (label, k, on) => { const wd = keyW(label, {}); rx -= wd; s += key(rx, y + 4, label, { a: 'wall', more: ` data-k="${k}" data-id="${node.id}"`, armed: on })[0]; rx -= 6 }
    word(sel.arm ? 'sure?' : 'remove', 'rm', !!sel.arm)
    if (node.k === 'plug') { if (node.ins && node.ins.uid && !node.ins.out) word('off', 'off', !!node.ins.off) }
    else { if (node.k !== 'mix' && !WALL_TWO.has(node.k)) word('bypass', 'by', !!node.bypass); if (WALL_WET.has(node.k)) word('wet only', 'wet', !!node.wet) }
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
      if (node.k === 'plug' || node.k === 'mix' || WALL_TWO.has(node.k)) { hold({ k: 'move', id, x: node.x, y: node.y, press: node.k === 'plug' }); break }
      if (e.altKey || twice) { wallSetAmount(t, node, WALL_LEGACY[node.k] ? PRINT_START[node.k] / 100 : wallNeutral(node.k)); break }      // twice, or with option: back to where it rests
      hold({ k: 'amt', id, v0: wallAmount(t, node), ly: p.y }); break
    }
    case 'amt': choose({ node: id }); if (e.altKey || twice) wallSetAmount(t, node, WALL_LEGACY[node.k] ? PRINT_START[node.k] / 100 : wallNeutral(node.k)); else hold({ k: 'amt', id, v0: wallAmount(t, node), ly: p.y }); break
    case 'wire': choose({ wire: +el.dataset.i }); break
    case 'lvl': { const i = +el.dataset.i; choose({ wire: i }); if (e.altKey || twice) { const m = wallNode(w, w.wires[i].to), n0 = w.wires.filter(x => x.to === w.wires[i].to).length; wallSetShare(t, i, m && (m.variant || 0) === 0 ? 1 / n0 : 1) } else hold({ k: 'lvl', i, v0: w.wires[i].gain, ly: p.y }); break }
    case 'hand': {
      const h = wallHands(node.k)[+el.dataset.h]
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
    d.to = q; d.land = null
    let best = 46
    for (const id of [WALL_OUT].concat(w.nodes.map(x => x.id))) { const at = wallPos(w, id), dist = Math.hypot(at.x - q.x, at.y - q.y); if (dist < best && wallMay(w, d.from, id, d.port)) { best = dist; d.land = id } }
  }
  uiDirty('dock')
}
function wallUp () {
  const d = WALL.drag, t = wallTrack(), w = wallOf(t)
  WALL.drag = null
  if (!d || !w) return
  if (d.k === 'wire' && d.land != null) wallWire(t, d.from, d.land, d.port)
  else if (d.k === 'move' && !d.moved && d.press) {                                    // a plug-in pressed and not moved: its own window (one that was left out: it is opened again, in its place)
    const node = wallNode(w, d.id), i = node && node.ins
    if (i && i.out && typeof bringBack === 'function') bringBack(t, t.inserts.indexOf(i)).then(() => { WALL.sent.delete(t.id); wallPush(t); uiDirty('dock') })
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

/* ── the list of what can be added: every print of Patch on Slur and every plug-in, by kind; what is picked is set on the wall, unwired ── */
function wallAdd (t, k) {
  const w = wallOf(t), id = wallFree(w)
  if (id < 0) return
  const at = wallSpot(w)
  w.nodes.push(Object.assign(wallNew(k, at.x, at.y), { id }))
  if (WALL_LEGACY[k]) { setPrint(t, k, PRINT_START[k]); if (t !== OUT) pushTrack(t) }
  WALL.sel = { t: t.id, node: id }; S.focus = 'wall'
  wallPush(t); uiDirty('dock')
}
async function wallPick (p) {
  const t = wallTrack(), w = wallOf(t)
  if (S.picker.busy || wallFree(w) < 0) return
  S.picker.busy = p.id
  $('pk-head').innerHTML = `<b>opening</b><span>${esc(p.name.toLowerCase())}</span>`
  WALL.loose = t.id
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
  if (r && r.ok) { const nw = wallOf(t), node = nw.nodes.find(x => x.ins && x.ins.uid === r.uid); if (node) { WALL.sel = { t: t.id, node: node.id }; S.focus = 'wall' } wallPush(t); drawPicker(); uiDirty('dock') }
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
    const found = full ? [] : (S.picker.list || []).filter(p => !p.inst && (!q || (p.name + ' ' + p.maker).toLowerCase().includes(q)))
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
    $('pk-head').innerHTML = `<b>${full ? 'the wall is full' : 'add'}</b><span>${full ? 'sixteen things' : prints.length + list.length}</span>`
    const row = (name, maker, kind, pick, mark) => {
      const el = document.createElement('button'), nm = document.createElement('b'), mk = document.createElement('span'), f = document.createElement('i')
      el.type = 'button'; el.className = 'pk-row'; if (mark) el.dataset.print = mark
      nm.textContent = name; mk.textContent = maker; f.textContent = kind
      el.append(nm, mk, f); el.onclick = pick
      box.append(el)
    }
    for (const k of prints) row(k, 'slur', 'print', () => { wallAdd(t, k); drawPicker() }, k)
    for (const p of list.slice(0, 500)) row(p.name.toLowerCase(), (p.maker || '').toLowerCase(), p.fmt, () => wallPick(p))
  }
  /* a plug-in opened on a track is on its wall, and the engine told, before whoever asked for it goes on (it plays nothing
     until the engine knows its place) */
  { const ni0 = natInsert; natInsert = async function (trackIndex, id) { const r = await ni0(trackIndex, id), t = S.tracks[trackIndex]; if (r && r.ok && t) { wallOf(t); await wallPush(t) } return r } }
  /* the walls are told to the engine when the room is (a project opened, the device changed) */
  if (typeof natSession === 'function') { const ns0 = natSession; natSession = async function (...a) { const r = await ns0(...a); WALL.sent.clear(); WALL.outTold = !!wallOutTrack(); wallPushAll(); return r } }
}
