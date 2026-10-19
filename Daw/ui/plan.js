/* ── the planner: a request made by its sound, as changes along the ears' lines, answered by ways that differ in how ──
   His rule (2026-10-16): no recipe a request. A request is a few TARGETS — a line of ears.js on a track (or the mix, or
   one track against another) and how far it should move: the vocal's presence down 1.5 db, the keys' fill up 3 db, the
   bass over the kick on the kick's hits down 4 db. MOVES are what the room can do to move lines — an eq band, a duck, a
   carve, a compressor, a room, the width, tape, the fader — each knowing which lines it moves, which way, where to begin
   (from what was heard), and the one amount that turns it harder. A WAY is one move for the first target and, for the
   others, moves of the same family (the fader goes with any): so A, B and C differ in how, never in how much. Each way is
   then put on, measured, and turned until every target is heard as asked (or as near as four hearings get) — what it
   gave is what the card says. Families and moves are few and fixed; requests are data (say.js's words, or Claude's).
   A target: { line, on: track id (0: the whole mix), pair: [a, b] (b against a), amount (the change asked, in the
   line's unit) }. */
const PLAN_TOL = { tilt: .3, width: .03, widthLow: .03, widthHigh: .03, mono: .05, wet: .03 }      // (near enough: else half a db)
const planTol = line => PLAN_TOL[line] || .5

/* the stretches of the spectrum the lines name, and the words a card says them in */
const PLAN_BANDS = { low: [20, 120], mud: [150, 450], box: [450, 1100], presence: [1500, 5000], air: [10000, 20000], sib: [5000, 10000] }
const planBandWord = (lo, hi) => { const c = Math.sqrt(lo * hi); return c < 150 ? 'lows' : c < 500 ? 'low mids' : c < 2000 ? 'mids' : c < 6000 ? 'presence' : 'highs' }
/* where in a stretch a track is loudest (its own spectrum, ears.js): an eq band goes there */
function planPeak (E, lo, hi, C) { let best = Math.sqrt(lo * hi), v = -Infinity; (C || []).forEach((f, b) => { if (f >= lo && f <= hi && E.spectrum[b] > v) { v = E.spectrum[b]; best = f } }); return Math.round(best) }

/* ── the moves ──
   Each makes its steps from what was heard; its DRIVE is the one amount that turns it harder, read and set through the
   places it made (refs: a step, and the band of it for an eq — eq bands of one track end up in one plug-in) */
const R0 = R => R[0].st, B0 = R => R[0].st.bands[R[0].band || 0]
const PLAN_MOVES = [
  /* one against another: the second gives way under the first */
  { id: 'eqOver', family: 'eq', sense: -1, fits: tg => tg.line === 'over' && tg.amount < 0,
    make: (tg, H) => { const P = H.pair, B = byId(tg.pair[1]), A = byId(tg.pair[0]), apart = Math.abs(Math.log2(P.fB / P.fA)) >= 1 / 3
      return { name: `carve the ${planBandWord(P.lo, P.hi)}`, says: `each keeps a low of its own: the ${B.name} dips under the ${A.name}${apart ? `, the ${A.name} under the ${B.name}` : ''}`,
        steps: [{ kind: 'eq', track: tg.pair[1], bands: [{ f: P.fA, g: -3, q: 1.4 }] }].concat(apart ? [{ kind: 'eq', track: tg.pair[0], bands: [{ f: P.fB, g: -2, q: 1.4 }] }] : []) } },
    drive: R => -B0(R).g, setDrive: (R, v) => { const k = v / Math.max(.01, -B0(R).g); for (const r of R) { const b = r.st.bands[r.band || 0]; b.g = Math.round(b.g * k * 10) / 10 } }, lim: [.5, 12] },
  { id: 'duck', family: 'dyn', sense: -1, fits: tg => tg.line === 'over' && tg.amount < 0, add: true, slope: 'seen',
    make: (tg, H) => { const A = byId(tg.pair[0]), B = byId(tg.pair[1])
      return { name: `duck the ${B.name}`, says: `the ${B.name} steps aside for as long as the ${A.name} sounds`, steps: [{ kind: 'duck', track: tg.pair[1], key: tg.pair[0], ratio: 4, depth: -tg.amount, attack: 1, release: 80 }] } },
    drive: R => R0(R).depth + (R0(R).fix || 0), setDrive: (R, v) => { R0(R).fix = v - R0(R).depth }, lim: [.5, 30] },
  { id: 'carveKey', family: 'dyn2', sense: -1, fits: tg => tg.line === 'over' && tg.amount < 0,
    make: (tg, H) => { const P = H.pair, A = byId(tg.pair[0]), B = byId(tg.pair[1])
      return { name: 'only where they meet', says: `the ${B.name} gives way between ${Math.round(P.lo)} and ${Math.round(P.hi)} hz, and only on the ${A.name}’s hits`,
        steps: [{ kind: 'carve', track: tg.pair[1], key: tg.pair[0], lo: P.lo, hi: P.hi, depth: -tg.amount, attack: 5, release: 80 }] } },
    drive: R => R0(R).depth * (R0(R).k || 1), setDrive: (R, v) => { R0(R).k = clamp(v / R0(R).depth, .25, 24 / Math.max(.5, R0(R).depth)) }, lim: [.5, 24] },
  /* a stretch of the spectrum up or down: an eq band where the track is loudest in it */
  { id: 'eqBand', family: 'eq', sense: 1, helper: true, fits: tg => PLAN_BANDS[tg.line] && tg.line !== 'sib',
    make: (tg, H) => { const t = byId(tg.on), [lo, hi] = PLAN_BANDS[tg.line], f = planPeak(H.ears[tg.on], lo, hi, H.C), up = tg.amount > 0
      return { name: `${up ? 'lift' : 'lower'} the ${tg.line === 'mud' ? 'mud' : tg.line === 'box' ? 'box' : planBandWord(lo, hi)}`, says: `an eq band on the ${t.name} at ${f} hz`, steps: [{ kind: 'eq', track: tg.on, bands: [{ f, g: Math.sign(tg.amount) * Math.min(6, Math.abs(tg.amount) * 1.5), q: .9 }] }] } },
    drive: R => B0(R).g, setDrive: (R, v) => { B0(R).g = Math.round(v * 10) / 10 }, lim: [-15, 15] },
  { id: 'eqTilt', family: 'eq', sense: 1, helper: true, fits: tg => tg.line === 'tilt',
    make: (tg, H) => { const t = byId(tg.on), up = tg.amount > 0
      return { name: up ? 'brighten it' : 'darken it', says: `the ${t.name} leans ${up ? 'up' : 'down'}: lows and highs moved apart`, steps: [{ kind: 'eq', track: tg.on, bands: [{ f: 120, g: -Math.sign(tg.amount) * 2, q: .5 }, { f: 6000, g: Math.sign(tg.amount) * 2, q: .5 }] }] } },
    drive: R => R0(R).bands[(R[0].band || 0) + 1].g, setDrive: (R, v) => { const k = R[0].band || 0; R0(R).bands[k + 1].g = Math.round(v * 10) / 10; R0(R).bands[k].g = -Math.round(v * 10) / 10 }, lim: [-12, 12] },
  { id: 'eqRing', family: 'eq', sense: -1, helper: true, fits: tg => tg.line === 'ring' && tg.amount < 0,
    make: (tg, H) => { const t = byId(tg.on), f = H.ears[tg.on].ringHz || 3000
      return { name: 'notch what rings', says: `a narrow cut on the ${t.name} where it rings, ${f} hz`, steps: [{ kind: 'eq', track: tg.on, bands: [{ f, g: -4, q: 5 }] }] } },
    drive: R => -B0(R).g, setDrive: (R, v) => { B0(R).g = -Math.round(v * 10) / 10 }, lim: [.5, 18] },
  /* what rings, or the esses: a carve that cuts only what stands out, as it stands out */
  { id: 'carveSelf', family: 'dyn', sense: -1, fits: tg => (tg.line === 'ring' || tg.line === 'sib') && tg.amount < 0,
    make: (tg, H) => { const t = byId(tg.on), E = H.ears[tg.on], [lo, hi] = tg.line === 'sib' ? [5000, 10000] : [Math.max(150, (E.ringHz || 3000) / 2), Math.min(16000, (E.ringHz || 3000) * 2)]
      return { name: tg.line === 'sib' ? 'tame the esses' : 'smooth what rings', says: `the ${t.name}’s own peaks between ${Math.round(lo)} and ${Math.round(hi)} hz pulled down as they stand out`, steps: [{ kind: 'carve', track: tg.on, lo, hi, depth: 6, attack: 5, release: 80 }] } },
    drive: R => R0(R).depth * (R0(R).k || 1), setDrive: (R, v) => { R0(R).k = clamp(v / R0(R).depth, .25, 24 / R0(R).depth) }, lim: [1, 24] },
  /* how it moves: a compressor of its own */
  { id: 'comp', family: 'dyn', sense: tg => tg.line === 'fill' ? 1 : -1, fits: tg => (tg.line === 'punch' || tg.line === 'crest' || tg.line === 'dyn') && tg.amount < 0 || tg.line === 'fill' && tg.amount > 0,
    make: (tg, H) => { const t = byId(tg.on), E = H.ears[tg.on]
      return { name: 'hold it together', says: `a compressor on the ${t.name}: its loud parts held, its quiet ones nearer`, steps: [{ kind: 'comp', track: tg.on, thr: Math.round(clamp(E.loud + 6, -50, -6)), ratio: 3, attack: 10, release: 120 }] } },
    drive: R => -R0(R).thr, setDrive: (R, v) => { R0(R).thr = Math.round(-v) }, lim: [1, 60] },
  /* further back, longer: the room's space */
  { id: 'space', family: 'space', sense: 1, fits: tg => (tg.line === 'fill' || tg.line === 'tail' || tg.line === 'width' || tg.line === 'wet') && tg.amount > 0,
    make: (tg, H) => { const t = byId(tg.on)
      return { name: 'put it in a room', says: `the ${t.name} sent into the room’s space`, steps: [{ kind: 'patch', track: tg.on, print: 'space', value: 25 }] } },
    drive: R => R0(R).value, setDrive: (R, v) => { R0(R).value = Math.round(v) }, lim: [2, 100] },
  /* wider or narrower: the room's stereo (phase, so the mono sum stays as it was) */
  { id: 'stereo', family: 'width', sense: 1, fits: tg => tg.line === 'width' || tg.line === 'widthHigh',
    make: (tg, H) => { const t = byId(tg.on), up = tg.amount > 0
      return { name: up ? 'widen it' : 'narrow it', says: `the ${t.name}’s two sides pulled ${up ? 'apart' : 'together'}, the sum to mono left as it was`, steps: [{ kind: 'print', track: tg.on, print: 'stereo', amount: up ? .7 : .3 }] } },
    drive: R => R0(R).amount - .5, setDrive: (R, v) => { R0(R).amount = clamp(.5 + v, 0, 1) }, lim: [-.5, .5] },
  /* fewer peaks: tape (the room's is warm: it takes air, it does not give it) */
  { id: 'tape', family: 'sat', sense: -1, fits: tg => tg.line === 'crest' && tg.amount < 0,
    make: (tg, H) => { const t = byId(tg.on)
      return { name: 'run it through tape', says: `the ${t.name} through the room’s tape: harmonics on top, peaks rounded`, steps: [{ kind: 'patch', track: tg.on, print: 'tape', value: 30 }] } },
    drive: R => R0(R).value, setDrive: (R, v) => { R0(R).value = Math.round(v) }, lim: [2, 100] },
  /* louder or quieter, or one against another: the fader (goes with any way) */
  { id: 'gain', family: '*', sense: 1, helper: true, add: true, fits: tg => tg.line === 'loud' || tg.line === 'apart',
    make: (tg, H) => { const id = tg.line === 'apart' ? tg.pair[0] : tg.on, t = byId(id)
      return { name: `${tg.amount > 0 ? 'raise' : 'lower'} the ${t.name}`, says: `the ${t.name}’s fader`, steps: [{ kind: 'gain', track: id, db: tg.amount }] } },
    drive: R => R0(R).db, setDrive: (R, v) => { R0(R).db = Math.round(v * 10) / 10 }, lim: [-24, 12] },
]
/* which family answers a line first: ways are offered in this order */
const PLAN_ORDER = { over: ['eq', 'dyn', 'dyn2'], ring: ['eq', 'dyn'], sib: ['dyn', 'eq'], fill: ['space', 'dyn'], tail: ['space'], width: ['width', 'space'], widthHigh: ['width'], punch: ['dyn', 'space'], crest: ['dyn', 'sat'], dyn: ['dyn'],
  air: ['eq'], presence: ['eq'], low: ['eq'], mud: ['eq'], box: ['eq'], tilt: ['eq'], wet: ['space'], loud: ['*'], apart: ['*'] }

/* ── the ways: one for each family that can move a target; in it, that family's moves wherever it has one, and the
   helpers (an eq band for the sound's colour, the fader for its level) for the targets it cannot move; a target nothing
   in it can move is left (and said so). The ways that move most of what was asked come first. ── */
function planWays (targets, H) {
  const fams = [...new Set(PLAN_MOVES.filter(m => m.family !== '*' && targets.some(tg => m.fits(tg))).map(m => m.family))]
  const rank = f => { let r = 0; targets.forEach((tg, i) => { const o = PLAN_ORDER[tg.line] || [], k = o.indexOf(f); if (k >= 0) r += (targets.length - i) * 10 - k }); return r }
  fams.sort((a, b) => targets.filter(tg => PLAN_MOVES.some(m => m.family === b && m.fits(tg))).length - targets.filter(tg => PLAN_MOVES.some(m => m.family === a && m.fits(tg))).length || rank(b) - rank(a))
  const ways = []
  for (const f of fams) {
    if (ways.length >= 3) break
    const way = { letter: 'ABC'[ways.length], steps: [], drives: [], left: [], name: '', says: '' }
    const used = new Map()                                                                 // (a print of the room's is put on once in a way: a second target for it is moved with the first)
    targets.forEach((tg, i) => {
      const m = PLAN_MOVES.find(x => x.family === f && x.fits(tg)) || PLAN_MOVES.find(x => x.helper && x.fits(tg))
      if (!m) { way.left.push(tg); return }
      const made = m.make(tg, H)
      const k = made.steps.length === 1 && (made.steps[0].kind === 'patch' || made.steps[0].kind === 'print') ? `${made.steps[0].kind}:${made.steps[0].print}:${made.steps[0].track}` : null
      if (k && used.has(k)) { way.drives.push({ target: i, move: m.id, with: used.get(k) }); return }
      if (!way.name && m.family === f) { way.name = made.name; way.says = made.says }
      const refs = made.steps.map((st, j) => ({ at: way.steps.length + j, band: st.kind === 'eq' ? 0 : null }))
      way.steps.push(...made.steps)
      way.drives.push({ target: i, move: m.id, refs })
      if (k) used.set(k, way.drives.length - 1)
    })
    if (!way.name) continue
    planMerge(way)
    ways.push(way)
  }
  ways.forEach((w, i) => { w.letter = 'ABC'[i] })
  return ways
}
/* the eq bands a way puts on one track: one plug-in, its bands one after another (the drives follow them there) */
function planMerge (way) {
  const firstOf = new Map(), map = []                                                       // map[old step] = [new step, band offset]
  const out = []
  way.steps.forEach((st, i) => {
    if (st.kind === 'eq' && firstOf.has(st.track)) { const j = firstOf.get(st.track), off = out[j].bands.length; out[j].bands.push(...st.bands.map(b => Object.assign({}, b))); map[i] = [j, off]; return }
    if (st.kind === 'eq') { firstOf.set(st.track, out.length); out.push(Object.assign({}, st, { bands: st.bands.map(b => Object.assign({}, b)) })) }
    else out.push(st)
    map[i] = [out.length - 1, 0]
  })
  way.steps = out
  for (const d of way.drives) if (d.refs) d.refs = d.refs.map(r => ({ at: map[r.at][0], band: r.band == null ? null : r.band + map[r.at][1] }))
}
const planMove = id => PLAN_MOVES.find(m => m.id === id)
/* a way's drive for a target, read and set (a target moved with another's print has none of its own) */
const planRefs = (way, d) => d.refs.map(r => ({ st: way.steps[r.at], band: r.band }))
function planDrive (way, d) { return d.refs ? planMove(d.move).drive(planRefs(way, d)) : null }
function planSetDrive (way, d, v) { if (!d.refs) return; const m = planMove(d.move), [lo, hi] = m.lim; m.setDrive(planRefs(way, d), clamp(v, lo, hi)) }
/* after turning: an eq band left at nothing is taken off (and a plug-in left with no band) */
function planTidy (way) {
  const gone = new Set()
  way.steps.forEach((st, i) => { if (st.kind === 'eq') { st.bands = st.bands.filter(b => Math.abs(b.g) >= .3); if (!st.bands.length) gone.add(i) } })
  if (!gone.size) return
  const keep = way.steps.map((_, i) => !gone.has(i)), newAt = []; let n = 0
  keep.forEach((k, i) => { newAt[i] = k ? n++ : -1 })
  way.steps = way.steps.filter((_, i) => keep[i])
  for (const d of way.drives) if (d.refs) { d.refs = d.refs.filter(r => newAt[r.at] >= 0).map(r => ({ at: newAt[r.at], band: r.band })); if (!d.refs.length) d.refs = null }
}

/* ── what was heard of the targets: each target's line, and what a way did to it ── */
const planTracks = targets => [...new Set(targets.flatMap(tg => tg.pair ? tg.pair.filter(x => typeof x === 'number') : [tg.on]).filter(x => x != null))]
async function planHear (targets, range, base) {
  const ids = planTracks(targets).filter(id => id !== 0), H = { range, ears: {}, rest: {} }
  const r = await NAT.call('listen', { a0: range[0], a1: range[1], tracks: ids.concat([0]) })
  if (!r || !r.ok) return null
  H.res = r; H.C = r.centres; H.raw = {}
  for (const t of r.tracks) { H.ears[t.id] = earsOf(t, r); H.raw[t.id] = t }
  for (const tg of targets) if (tg.pair && tg.pair[1] === 'rest' && !H.rest[tg.pair[0]]) { const q = await NAT.call('listen', { a0: range[0], a1: range[1], tracks: [tg.pair[0]], as: 'rest' }); if (q && q.ok) H.rest[tg.pair[0]] = earsOf(q.tracks[0], q) }
  const over = targets.find(tg => tg.line === 'over')
  if (over) {                                                                             // (one under another: measured as the ways measure a duck — ways.js)
    if (base && base.pair) H.pair = base.pair
    else { H.pair = waysHeard(r, over.pair); if (H.pair) await waysNear(H.pair, r, range) }
    if (H.pair) { const q = await NAT.call('listen', { a0: range[0], a1: range[1], tracks: [over.pair[1]], band: [H.pair.lo, H.pair.hi] }); H.near = q && q.ok ? q.tracks[0] : null }
  }
  return H
}
/* what a target's line moved by, from the first hearing (base) to this one (now) */
function planGave (tg, base, now) {
  if (tg.line === 'over') return base.pair && now.near ? waysDuck(base.pair.B0 || base.pair.B.h, now.near, base.pair).hits : 0
  if (tg.line === 'apart') { const b = tg.pair[1] === 'rest' ? 'rest' : 'ears', vb = (H, id) => b === 'rest' ? H.rest[id] : H.ears[tg.pair[1]]; const d = H => H.ears[tg.pair[0]].loud - vb(H, tg.pair[0]).loud; return d(now) - d(base) }
  if (tg.line === 'fill' && base.raw && now.raw && base.raw[tg.on] && now.raw[tg.on]) {   // (how filled in, over the moments it sounded before: a room's tail in its gaps must not count as more gap)
    const f0 = base.raw[tg.on].fast || [], mx = Math.max(...f0), on = f0.map(x => x > mx - 600)
    const fill = f => { const xs = f.filter((_, i) => on[i]); return xs.length > 20 ? (earPct(xs, .1) - earPct(xs, .9)) / 10 : 0 }
    return fill(now.raw[tg.on].fast || []) - fill(f0)
  }
  const a = base.ears[tg.on], b = now.ears[tg.on]
  return a && b && a[tg.line] != null && b[tg.line] != null ? b[tg.line] - a[tg.line] : 0
}

/* ── requests as targets: the room's own few, for trying the planner out (his Claude link, when he decides it, says these
   for any words) — each a few lines moved, nothing more ── */
const PLAN_WANT = {
  apart: ids => ids.length === 2 ? [{ line: 'over', pair: ids.slice(), amount: -4 }] : null,
  embedded: ids => [{ line: 'wet', on: ids[0], amount: .1 }, { line: 'presence', on: ids[0], amount: -1.5 }, { line: 'apart', pair: [ids[0], 'rest'], amount: -1.5 }],
  wider: ids => ids.map(id => ({ line: 'width', on: id, amount: .08 })),
  back: ids => [{ line: 'wet', on: ids[0], amount: .15 }, { line: 'presence', on: ids[0], amount: -1.5 }, { line: 'loud', on: ids[0], amount: -1 }],
  transparent: ids => [{ line: 'ring', on: ids[0], amount: -3 }, { line: 'mud', on: ids[0], amount: -2 }, { line: 'air', on: ids[0], amount: 1.5 }],
  brighter: ids => ids.map(id => ({ line: 'tilt', on: id, amount: .5 })),
  darker: ids => ids.map(id => ({ line: 'tilt', on: id, amount: -.5 })),
  warmer: ids => [{ line: 'tilt', on: ids[0], amount: -.4 }, { line: 'low', on: ids[0], amount: 1.5 }],
}
/* how a target is said on the page: its line, and how far */
const PLAN_UNIT = { tilt: 'db an octave', width: '', widthLow: '', widthHigh: '', mono: '', wet: '' }
const PLAN_WORD = { over: 'over', apart: 'against the rest', loud: 'level', fill: 'fill', tail: 'tail', ring: 'ringing', sib: 'esses', low: 'lows', mud: 'mud', box: 'box', presence: 'presence', air: 'air', tilt: 'tilt', width: 'width', widthHigh: 'width up high', wet: 'wet', punch: 'punch', crest: 'peaks', dyn: 'dynamics' }
function planNum (tg, v) {
  const pct = tg.line === 'width' || tg.line === 'widthHigh' || tg.line === 'wet', n = Math.round(v * (pct ? 100 : 10)) / (pct ? 1 : 10)
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}${pct ? '%' : PLAN_UNIT[tg.line] != null ? (PLAN_UNIT[tg.line] ? ' ' + PLAN_UNIT[tg.line] : '') : ' db'}`
}
const planSaid = (tg, v) => `${PLAN_WORD[tg.line] || tg.line} ${planNum(tg, v)}`

/* ── a way turned until it is heard as asked ──
   One target at a time, the first first and the fader last (a compressor moves the level; the fader then puts it back):
   its move turned, heard, turned again — from the last two hearings once there are two (a line that does not start at
   nought is met so, not overshot back and forth), else by how it was said to go — until it is within reach of what was
   asked, three turns at most; then the next. A move whose amount was typed by hand is left where it was put. After the
   first hearing, a way is only changed where it stands (re), not taken off and put on again. */
const planSense = (m, tg) => typeof m.sense === 'function' ? m.sense(tg) : m.sense || 1
async function planTune (way, targets, base, on, re) {
  const asked = targets.map((tg, i) => way.asked && way.asked[i] != null ? way.asked[i] : tg.amount)
  way.gave = targets.map(() => 0); way.out = 0; way.why = ''; way.trace = []
  let now = null
  const hear = async first => {
    if (!(first ? await on() : await (re || on)())) return false
    now = await planHear(targets, base.range, base)
    if (!now) return false
    way.gave = targets.map(tg => Math.round(planGave(tg, base, now) * 100) / 100)
    if (base.ears[0] && now.ears[0]) way.out = Math.round(clamp(base.ears[0].loud - now.ears[0].loud, -6, 6) * 10) / 10
    way.trace.push({ gave: way.gave.slice(), drives: way.drives.map(d => d.refs ? Math.round(planDrive(way, d) * 100) / 100 : null) })
    return true
  }
  if (!await hear(true)) return false
  const order = way.drives.filter(d => d.refs && !d.held && !way.left.includes(targets[d.target])).sort((a, b) => (planMove(a.move).id === 'gain') - (planMove(b.move).id === 'gain') || a.target - b.target)
  for (const d of order) {
    const m = planMove(d.move), tg = targets[d.target], want = asked[d.target], tol = planTol(tg.line), sense = planSense(m, tg), [lo, hi] = m.lim, span = hi - lo
    const pts = [{ cur: planDrive(way, d), got: way.gave[d.target] }], start = pts[0].cur
    for (let turn = 0; turn < 4; turn++) {
      const { cur, got } = pts[pts.length - 1]
      if (Math.abs(want - got) <= tol) break
      let v = null
      const below = pts.filter(p => (p.got - want) * Math.sign(got - want) < 0)          // (a hearing on the other side of what is asked)
      if (below.length) { const b = below.reduce((q, p) => Math.abs(p.got - want) < Math.abs(q.got - want) ? p : q); v = cur + (want - got) * (b.cur - cur) / ((b.got - got) || 1e-9) }
      else if (pts.length > 1) {
        const p = pts[pts.length - 2], s = (got - p.got) / ((cur - p.cur) || 1e-9)
        if (Math.sign(s) !== sense && Math.abs(got - p.got) > tol / 2) { planSetDrive(way, d, start); way.wrong = (way.wrong || []).concat([d.target]); await hear(false); break }      // (it went the wrong way: as it was, and left)
        if (Math.abs(s) > 1e-6 && Math.sign(s) === sense) v = cur + (want - got) / s
      }
      if (v == null) { const est = Math.abs(cur) > 1e-3 && Math.abs(got) > tol / 4 ? Math.abs(got / cur) : 2 * tol / (.1 * span); v = cur + (want - got) / (m.id === 'gain' ? 1 : sense * est) }
      v = cur + clamp(v - cur, -span / 2, span / 2)
      if ((m.id === 'eqBand' || m.id === 'eqTilt') && Math.sign(v) !== Math.sign(want)) v = 0      // (a band asked to lift is never turned into a cut because the rest of the way lifted it already: it goes, at nothing)
      planSetDrive(way, d, v)
      if (Math.abs(planDrive(way, d) - cur) < 1e-3) break                                  // (at the end of its travel: as far as it goes)
      if (!await hear(false)) return false
      pts.push({ cur: planDrive(way, d), got: way.gave[d.target] })
    }
  }
  planTidy(way)
  return true
}
