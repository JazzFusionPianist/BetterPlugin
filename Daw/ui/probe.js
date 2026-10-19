/* ── plug-ins learnt by what they do ──
   His ask (2026-10-16): a request made by its sound must be able to use any plug-in of the kind it needs, whoever made
   it — "eq 말고도 다른 종류 플러그인도 다 되어야" — and none of them written out by hand. So the room learns a plug-in
   itself: it sends sound of a known kind through it (Engine::probe, Source/Probe.h), moves one control at a time, and
   reads from how the answer changes what the control is. Of an eq: which controls make a band (its frequency, gain,
   width, shape, the switch that brings it in), and how each control's travel reads in hz, db and q — measured, not taken
   from its words (a control's words are only where the learning starts looking). Of a compressor: where it begins, how
   hard it holds, how fast it takes hold and lets go. What is learnt is kept in the app's settings by the plug-in's id
   ('learnt'), and used by the ways (ways.js) to set it; anything set is measured again there, so a plug-in that was
   learnt wrong is caught, not trusted.
   Names are a help, never a rule: a control is only taken for what it is shown to do. */
const PROBE = { learnt: null, busy: '', calls: 0, quiet: 0 }
async function learntAll (fresh) {
  if (PROBE.learnt && !fresh) return PROBE.learnt
  const p = NAT ? await NAT.call('prefGet') : null
  PROBE.learnt = (p && p.learnt && typeof p.learnt === 'object') ? p.learnt : {}
  return PROBE.learnt
}
/* kept: read afresh first (the settings window learns too, and keeps what it learns in the same place) */
async function learntKeep (id, map) { const L = await learntAll(true); if (map) L[id] = map; else delete L[id]; if (NAT) await NAT.call('prefSet', { key: 'learnt', value: L }) }
/* a plug-in's name for what was learnt of it, the same wherever it is kept: an audio unit by its codes (the Mac's own),
   a vst3 by its file's name — not its folder, which differs from one person to the next */
const learntKey = p => { const id = String(p.id || p.ident || p.name || ''); return /^AudioUnit:/.test(id) ? id : 'vst3:' + id.split('/').pop().toLowerCase() }
const probeRun = (t, ins, sig, set, more) => { PROBE.calls++; return NAT.call('probe', Object.assign({ track: t.id, uid: ins.uid, sig, set: set || [] }, more || {})) }
/* a plug-in's controls ([index, name, value, words]) and the words of one along its travel, asked of the app once */
async function probeParams (t, ins) { if (!ins.pl && NAT) { const r = await NAT.call('params', { track: t.id, uid: ins.uid }); if (Array.isArray(r)) ins.pl = r } return ins.pl || [] }
async function probeTexts (t, ins, k) { ins.pt = ins.pt || {}; if (!ins.pt[k] && NAT) { const r = await NAT.call('paramScale', { track: t.id, uid: ins.uid, index: k }); ins.pt[k] = r && Array.isArray(r.texts) ? r.texts : [] } return ins.pt[k] || [] }
const fineHz = k => 20 * Math.pow(2, k / 12)
const hzFine = f => 12 * Math.log2(f / 20)

/* ── a frequency answer read: against the plug-in at rest, where it moves most, how far, how wide, and its shape ── */
function tfShape (tf, ref) {
  const d = tf.map((v, k) => (v - (ref ? ref[k] : 0)) / 10), n = d.length
  let km = 0; for (let k = 0; k < n; k++) if (Math.abs(d[k]) > Math.abs(d[km])) km = k
  const peak = d[km], half = Math.abs(peak) / 2
  let a = km, b = km
  while (a > 0 && Math.abs(d[a - 1]) >= half && Math.sign(d[a - 1]) === Math.sign(peak)) a--
  while (b < n - 1 && Math.abs(d[b + 1]) >= half && Math.sign(d[b + 1]) === Math.sign(peak)) b++
  const lowEnd = (d[0] + d[1] + d[2] + d[3]) / 4, highEnd = (d[n - 1] + d[n - 2] + d[n - 3] + d[n - 4]) / 4      // (20–25 hz, and the top above 16 khz)
  let shape = 'flat'
  if (Math.abs(peak) >= 1) {
    const big = x => Math.abs(x) > .6 * Math.abs(peak) && Math.sign(x) === Math.sign(peak), none = x => Math.abs(x) < .25 * Math.abs(peak)
    if (big(lowEnd) && none(highEnd)) shape = peak < -15 && d[0] < d[6] - 6 ? 'lowCut' : 'lowShelf'
    else if (big(highEnd) && none(lowEnd)) shape = peak < -15 && d[n - 1] < d[n - 7] - 6 ? 'highCut' : 'highShelf'
    else if (none(lowEnd) && none(highEnd)) shape = 'bell'
    else if (big(lowEnd) && big(highEnd)) shape = 'all'
    else shape = 'other'
  }
  /* where it lies: a bell its top; a shelf or a cut where it is half way (its corner, near enough) */
  let hz = fineHz(km)
  if (shape === 'lowShelf' || shape === 'lowCut') { let k = 0; while (k < n - 1 && Math.abs(d[k]) > half) k++; hz = fineHz(k) }
  if (shape === 'highShelf' || shape === 'highCut') { let k = n - 1; while (k > 0 && Math.abs(d[k]) > half) k--; hz = fineHz(k) }
  return { shape, hz: Math.round(hz), db: Math.round(peak * 10) / 10, oct: Math.round((b - a + 1) / 12 * 100) / 100, low: Math.round(lowEnd * 10) / 10, high: Math.round(highEnd * 10) / 10 }
}
/* a bell's width in octaves at half its height, as a Q (and back) */
const octToQ = o => { const p = Math.pow(2, Math.max(.05, o)); return Math.sqrt(p) / (p - 1) }

/* ── a control's travel as numbers, from points measured along it (norm → x); found again the other way ── */
function travelAt (pts, x, log) {                                                          // the norm that gives x (pts sorted by norm, x one way along them)
  const f = v => log ? Math.log(Math.max(v, 1e-6)) : v, X = f(x), P = pts.map(([n, v]) => [n, f(v)])
  const up = P[P.length - 1][1] >= P[0][1]
  for (let i = 0; i < P.length - 1; i++) {
    const [n0, v0] = P[i], [n1, v1] = P[i + 1]
    if ((up ? X >= v0 && X <= v1 : X <= v0 && X >= v1) && v0 !== v1) return n0 + (n1 - n0) * (X - v0) / (v1 - v0)
  }
  return (up ? X < P[0][1] : X > P[0][1]) ? P[0][0] : P[P.length - 1][0]
}
function travelOf (pts, norm, log) {                                                       // the x at a norm
  for (let i = 0; i < pts.length - 1; i++) {
    const [n0, v0] = pts[i], [n1, v1] = pts[i + 1]
    if (norm >= n0 && norm <= n1) { const u = (norm - n0) / ((n1 - n0) || 1); return log ? Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * u) : v0 + (v1 - v0) * u }
  }
  return norm < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1]
}

/* ── a control's own words: where along it a frequency is said (the nearest place to hz), and the places a control
   that moves in steps has (the middle of each run of one word) ── */
const textHz = x => { const m = String(x).replace(',', '.').match(/(-?\d+(?:\.\d+)?)\s*(k)?/i); return m ? parseFloat(m[1]) * (m[2] ? 1000 : 1) : NaN }
async function probeNear (t, ins, k, hz) {
  const texts = await probeTexts(t, ins, k)
  if (texts.length < 2) return .5
  let best = .5, bd = Infinity
  texts.forEach((x, i) => { const v = textHz(x); if (isFinite(v) && v > 0) { const d = Math.abs(Math.log2(v / hz)); if (d < bd) { bd = d; best = i / (texts.length - 1) } } })
  return bd < 2 ? best : .5
}
async function probePlaces (t, ins, k) {
  const x = await probeTexts(t, ins, k)
  if (x.length < 2) return []
  const out = []
  for (let i = 0; i < x.length;) { let j = i; while (j + 1 < x.length && x[j + 1] === x[i]) j++; out.push(Math.round((i + j) / 2 / (x.length - 1) * 1000) / 1000); i = j + 1 }
  return out
}

/* ── what a control's name suggests (only where to look first) ── */
const PROBE_WORDS = {
  f: /\b(freq|frequency|hz|cutoff|center|centre|corner)\b/i, g: /\b(gain|boost|cut|level|amount)\b/i, q: /\b(q|bandwidth|bw|width|resonance|res|slope)\b/i,
  type: /\b(type|shape|mode|curve|filter)\b/i, on: /\b(on|enable|enabled|active|used|in|power|state)\b/i, bypass: /\b(bypass|off|mute)\b/i,
  thr: /\b(thresh|threshold|peak reduction|compress(ion)?|squash|amount)\b/i, ratio: /\b(ratio)\b/i, attack: /\b(attack|att)\b/i, release: /\b(release|rel|recovery)\b/i,
  makeup: /\b(make ?-?up|output|out gain|out)\b/i, input: /\b(input|in gain|drive)\b/i, mix: /\b(mix|dry|wet|blend)\b/i,
}
/* which band a control belongs to, by its name ("Band 3 Gain", "B3 Freq", "Gain 3", "3 Gain"); controls of one name
   without a number (Apple's eq) are counted out in the order they come */
function probeBands (rows) {
  const seen = {}, out = []
  for (const r of rows) {
    const name = String(r[1] || ''), m = name.match(/(?:band|bnd|\bb|eq|filter|flt)\s*#?\s*(\d+)/i) || name.match(/^(\d+)\b/) || name.match(/\b(\d+)\s*$/)
    const bare = name.replace(/(?:band|bnd|\bb|eq|filter|flt)\s*#?\s*\d+/i, '').replace(/^\d+\s*|\s*\d+$/, '').trim().toLowerCase()
    let band = m ? +m[1] : null
    if (band == null) { seen[bare] = (seen[bare] || 0) + 1; band = seen[bare] > 1 || rows.filter(q => String(q[1]).trim().toLowerCase() === bare).length > 1 ? seen[bare] : null }
    const role = Object.keys(PROBE_WORDS).filter(k => PROBE_WORDS[k].test(bare || name))
    out.push({ k: r[0], name, bare, band, role, v: r[2], text: r[3] })
  }
  return out
}

/* ── an eq learnt ──
   Band one is found and learnt whole; every other band is taken to be made like it (the same controls in the same
   order) and one of them is tried to be sure. → { kind: 'eq', bands: [{f, g, q, type, on}], shapes: {bell, lowShelf, …:
   value of type}, on: value, maps: {f, g, q: [[norm, value]]} } or { kind: 'not an eq', why } */
async function learnEq (t, ins, say) {
  say = say || (() => {})
  const rows = probeBands(await probeParams(t, ins)), rest = await probeRun(t, ins, 'noise')
  if (!rest || !rest.ok) return { kind: 'unknown', why: (rest && rest.error) || 'it would not play' }
  const ref = rest.tf, run = async set => { const r = await probeRun(t, ins, 'noise', set); return r && r.ok ? tfShape(r.tf, ref) : null }
  if (!rows.some(r => r.band != null)) for (const r of rows) r.band = 0                  // (one band, its controls without numbers: Apple's parametric eq)
  const bands = [...new Set(rows.filter(r => r.band != null).map(r => r.band))].sort((a, b) => a - b)
  const of = (b, role) => rows.filter(r => r.band === b && r.role.includes(role))
  for (const b of bands.slice(0, 3)) {                                                     // (the first band that answers)
    say(`band ${b}`)
    const gs = of(b, 'g'), fs = of(b, 'f')
    if (!gs.length || !fs.length) continue
    const types = of(b, 'type'), ons = of(b, 'on').concat(of(b, 'bypass'))
    /* what brings it in: the gain at either end, with each switch of the band either way, until the answer moves */
    let found = null
    const tries = [[]]
    for (const s of ons) tries.push([[s.k, 1]], [[s.k, 0]])
    if (ons.length > 1) tries.push(ons.map(s => [s.k, s.role.includes('bypass') ? 0 : 1]))
    for (const g of gs) {
      for (const base of tries) {
        for (const gv of [.95, .05]) {
          const sh = await run(base.concat([[g.k, gv]]))
          if (sh && sh.shape !== 'flat') { found = { g, base, gv, sh }; break }
        }
        if (found) break
      }
      if (found) break
    }
    if (!found) continue
    const g = found.g, on = found.base
    /* a frequency control's place nearest 1 khz, by its words (only a start: what it gives is measured below) */
    const near = {}
    for (const fc of fs) near[fc.k] = await probeNear(t, ins, fc.k, 1000)
    const fAt = fs.map(fc => [fc.k, near[fc.k]])
    /* its shapes: each place of the type control, the band at 1 khz and the gain up */
    const shapes = {}
    let type = null
    for (const ty of types) {
      const places = await probePlaces(t, ins, ty.k)
      if (places.length < 2 || places.length > 16) continue
      for (const p of places) { const sh = await run(on.concat(fAt, [[ty.k, p], [g.k, .95]])); if (sh && sh.shape !== 'flat' && shapes[sh.shape] == null) shapes[sh.shape] = p }
      if (Object.keys(shapes).length > 1) { type = ty; break }
    }
    const bell = type && shapes.bell != null ? [[type.k, shapes.bell]] : []
    if (!bell.length) { const sh = await run(on.concat(fAt, [[g.k, .95]])); if (!sh || sh.shape !== 'bell') continue }      // (no shapes to choose from: it must be a bell as it is)
    /* the frequency's travel, with a bell up */
    let f = null, fmap = [], fLog = true
    for (const fc of fs) {
      const pts = [], at = async n => { const sh = await run(on.concat(bell, [[g.k, .95], [fc.k, n]])); if (sh && sh.shape === 'bell') { pts.push([n, sh.hz]); pts.sort((a, c) => a[0] - c[0]); return true } return false }
      for (const n of [0, .02, .05, .1, .15, .2, .3, .4, .5, .6, .7, .8, .9, .95, 1]) await at(n)
      /* where its travel is straight in hz, the lows lie in its first hair: looked for there, a third of the way down each time */
      for (let i = 0; i < 6 && pts.length && pts[0][1] > 40 && pts[0][0] > 1e-4; i++) if (!await at(pts[0][0] / 3)) break
      const up = pts.length > 4 && pts.every((p, i) => !i || p[1] >= pts[i - 1][1]), down = pts.length > 4 && pts.every((p, i) => !i || p[1] <= pts[i - 1][1])
      if ((up || down) && pts[pts.length - 1][1] !== pts[0][1]) { f = fc; fmap = pts; break }
    }
    if (!f) continue
    /* whether it travels evenly in hz or in octaves: whichever guesses each point from its neighbours better */
    { let eLin = 0, eLog = 0
      for (let i = 1; i < fmap.length - 1; i++) {
        const [n0, v0] = fmap[i - 1], [n1, v1] = fmap[i], [n2, v2] = fmap[i + 1], u = (n1 - n0) / ((n2 - n0) || 1)
        eLin += Math.abs(Math.log2((v0 + (v2 - v0) * u) / v1)); eLog += Math.abs(Math.log2(Math.exp(Math.log(v0) + (Math.log(v2) - Math.log(v0)) * u) / v1))
      }
      fLog = eLog <= eLin }
    const at1k = travelAt(fmap, 1000, fLog)
    /* the gain's travel, a bell at 1 khz: how high (or deep) it stands */
    const gmap = []
    for (const n of [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1]) { const sh = await run(on.concat(bell, [[f.k, at1k], [g.k, n]])); if (sh) gmap.push([n, sh.shape === 'flat' ? 0 : sh.db]) }
    /* the width's travel, the bell 6 db up (as a band is mostly used: on some eqs a bell narrows as it grows) */
    const qmap = [], g6 = gmap.length > 2 ? travelAt(gmap, 6, false) : .95
    let q = null
    for (const qc of of(b, 'q')) {
      const pts = []
      for (const n of [.02, .05, .1, .2, .3, .4, .5, .6, .7, .8, .9, .95, .98]) { const sh = await run(on.concat(bell, [[f.k, at1k], [g.k, g6], [qc.k, n]])); if (sh && sh.shape === 'bell') pts.push([n, Math.round(octToQ(sh.oct) * 100) / 100]) }
      if (pts.length > 3 && pts[pts.length - 1][1] !== pts[0][1]) { q = qc; qmap.push(...pts); break }
    }
    /* every band as this one: the same controls, as far from its first as this band's are from its first */
    const first = Math.min(...rows.filter(r => r.band === b).map(r => r.k)), offs = { f: f.k - first, g: g.k - first, q: q ? q.k - first : null, type: type ? type.k - first : null, on: on.map(([k, v]) => [k - first, v]) }
    const firstOf = bb => { const ks = rows.filter(r => r.band === bb).map(r => r.k); return ks.length ? Math.min(...ks) : null }
    const all = bands.map(bb => { const f0 = firstOf(bb); return f0 == null ? null : { band: bb, f: f0 + offs.f, g: f0 + offs.g, q: offs.q == null ? null : f0 + offs.q, type: offs.type == null ? null : f0 + offs.type, on: offs.on.map(([o, v]) => [f0 + o, v]) } }).filter(Boolean)
    /* one more band tried, to be sure (the second, at 300 hz) */
    let sure = all.length < 2
    if (all.length > 1) {
      const o = all[1], sh = await run(o.on.concat(o.type != null && shapes.bell != null ? [[o.type, shapes.bell]] : [], [[o.g, .95], [o.f, travelAt(fmap, 300, fLog)]]))
      sure = !!sh && sh.shape === 'bell' && Math.abs(Math.log2(sh.hz / 300)) < .25
    }
    return { kind: 'eq', name: String(ins.name), bands: sure ? all : all.slice(0, 1), shapes, maps: { f: fmap, g: gmap, q: qmap }, fLog, at: Date.now(), v: 1 }
  }
  return { kind: 'not an eq', why: 'no control moved a band' }
}

/* ── a compressor learnt (where it begins, how hard it holds, how fast) ── its curve read from the levels: the first
   level where it comes out a db or more under a straight line through the quiet ones */
function curveOf (r) {
  const ins = r.in, outs = r.out, g0 = outs[0] - ins[0]
  let knee = null
  for (let i = 0; i < ins.length; i++) if (outs[i] - ins[i] < g0 - 1) { knee = ins[i]; break }
  const top = ins.length - 1, slope = knee == null || top < 2 ? 1 : (outs[top] - outs[top - 3]) / (ins[top] - ins[top - 3])
  return { knee, ratio: slope > .02 ? Math.round(1 / slope * 10) / 10 : 50, gain: Math.round(g0 * 10) / 10, held: Math.round(((outs[top] - ins[top]) - g0) * 10) / 10 }
}
async function learnComp (t, ins, say) {
  say = say || (() => {})
  const rows = probeBands(await probeParams(t, ins)), rest = await probeRun(t, ins, 'levels')
  if (!rest || !rest.ok) return { kind: 'unknown', why: (rest && rest.error) || 'it would not play' }
  const c0 = curveOf(rest), out = { kind: 'comp', name: String(ins.name), rest: c0, maps: {}, at: Date.now(), v: 1 }
  /* every control that moves freely (not a switch, not a few steps), moved from end to end: what it does to the curve
     says what it is — the knee moving, the slope, the whole line up or down — and its words only break a tie */
  const cands = []
  for (const r of rows.slice(0, 40)) {
    const places = await probePlaces(t, ins, r.k)
    if (places.length && places.length < 12) continue
    say(r.name)
    const pts = []
    for (const n of [0, .25, .5, .75, 1]) { const m = await probeRun(t, ins, 'levels', [[r.k, n]]); if (m && m.ok) pts.push([n, curveOf(m)]) }
    if (pts.length < 3) continue
    const span = key => { const v = pts.map(p => p[1][key] == null ? 0 : p[1][key]); return Math.max(...v) - Math.min(...v) }
    cands.push({ r, pts, knee: span('knee'), ratio: span('ratio'), gain: span('gain'), held: span('held') })
  }
  const pick = (what, test, read, word) => {
    const c = cands.filter(test).sort((a, b) => (PROBE_WORDS[word].test(b.r.bare || b.r.name) - PROBE_WORDS[word].test(a.r.bare || a.r.name)) || b[what] - a[what])[0]
    if (!c) return
    out[word] = c.r.k; out.maps[word] = c.pts.map(([n, cv]) => [n, read(cv)]); cands.splice(cands.indexOf(c), 1)
  }
  pick('knee', c => c.knee >= 6 && c.gain < 3, cv => cv.knee == null ? 0 : cv.knee, 'thr')                   // the knee moves, the quiet level stays: where it begins
  pick('ratio', c => c.ratio >= 1 && c.knee < 6 && c.gain < 3, cv => cv.ratio, 'ratio')                       // only the slope: how hard
  pick('gain', c => c.gain >= 3 && c.held < 3, cv => cv.gain, 'makeup')                                     // the whole line, nothing held more: what comes out
  pick('held', c => c.gain >= 3 && c.held >= 3, cv => cv.held, 'input')                                     // in harder: more held (an 1176's input)
  if (out.thr == null && out.input == null) { out.kind = 'not a compressor'; return out }
  /* how fast: with it holding (begun 30 db under the burst), each control left over moved end to end — the one that
     changes how soon it takes hold is its attack, the one that changes how soon it lets go its release (named ones first) */
  const hold = out.thr != null ? [[out.thr, travelAt(out.maps.thr, -36, false)]] : [[out.input, 1]]
  const b0 = await probeRun(t, ins, 'burst', hold), t0 = b0 && b0.ok ? burstOf(b0) : null
  out.rest.timing = t0
  if (t0 && t0.depth >= 3) {
    const named = w => c => PROBE_WORDS[w].test(c.r.bare || c.r.name)
    cands.sort((a, b) => (named('attack')(b) || named('release')(b)) - (named('attack')(a) || named('release')(a)))
    for (const c of cands) {
      if (out.attack != null && out.release != null) break
      say(c.r.name)
      const ra = await probeRun(t, ins, 'burst', hold.concat([[c.r.k, .05]])), rb = await probeRun(t, ins, 'burst', hold.concat([[c.r.k, .95]]))
      const A = ra && ra.ok ? burstOf(ra) : null, B = rb && rb.ok ? burstOf(rb) : null
      if (!A || !B || A.att == null || B.att == null || A.rel == null || B.rel == null) continue
      const fa = Math.max(A.att, B.att, 1) / Math.max(1, Math.min(A.att, B.att)), fr = Math.max(A.rel, B.rel, 1) / Math.max(1, Math.min(A.rel, B.rel))
      const role = out.attack == null && fa >= 2 && fa > fr ? 'attack' : out.release == null && fr >= 2 && fr > fa ? 'release' : null
      if (!role) continue
      const pts = []
      for (const n of [0, .05, .1, .25, .5, .75, 1]) { const m = await probeRun(t, ins, 'burst', hold.concat([[c.r.k, n]])); const q = m && m.ok ? burstOf(m) : null; if (q && q[role === 'attack' ? 'att' : 'rel'] != null) pts.push([n, q[role === 'attack' ? 'att' : 'rel']]) }
      if (pts.length >= 3) { out[role] = c.r.k; out.maps[role] = pts }
    }
  }
  return out
}
/* a compressor's timing, from the burst (its gain each millisecond): how much it holds the loud part (depth, db), and
   how many milliseconds it takes to get two thirds of the way there (att) and back again (rel) */
function burstOf (r) {
  const g = r.gain.map(v => v / 10), up = r.up, down = r.down
  const avg = (a, b) => { let s = 0, n = 0; for (let i = Math.max(0, a); i < Math.min(g.length, b); i++) { s += g[i]; n++ } return n ? s / n : 0 }
  const lo = avg(up - 200, up - 10), hi = avg(down - 150, down - 10), back = avg(g.length - 200, g.length - 10), depth = lo - hi
  if (depth < 1) return { lo, hi, depth, att: null, rel: null }
  let att = null, rel = null
  for (let i = up; i < down; i++) if (lo - g[i] >= .63 * depth) { att = i - up; break }
  for (let i = down; i < g.length; i++) if (g[i] - hi >= .63 * (lo - hi)) { rel = i - down; break }
  if (att == null) att = down - up                                                          // (not there within the burst, or back within what follows: at least that long)
  if (rel == null) rel = g.length - down
  return { lo: Math.round(lo * 10) / 10, hi: Math.round(hi * 10) / 10, depth: Math.round(depth * 10) / 10, att, rel }
}

/* ── what a plug-in is, by what it does at rest and when its likeliest controls move ── */
async function learnPlug (t, ins, want, say) {
  const id = learntKey(ins)
  PROBE.busy = String(ins.name).toLowerCase()
  try {
    const map = want === 'comp' ? await learnComp(t, ins, say) : await learnEq(t, ins, say)
    if (map.kind === 'eq' || map.kind === 'comp') await learntKeep(id, map)
    return map
  } finally { PROBE.busy = '' }
}
async function learntOf (ins) { const L = await learntAll(); return L[learntKey(ins)] || null }

/* ── a band set on a learnt eq: a bell at f hz, g db, q — the nearest the plug-in has ── */
async function learntBell (t, ins, map, k, b) {
  const o = map.bands[k]
  if (!o) return false
  const set = o.on.slice()
  if (o.type != null && map.shapes.bell != null) set.push([o.type, map.shapes.bell])
  set.push([o.f, travelAt(map.maps.f, b.f, map.fLog !== false)], [o.g, travelAt(map.maps.g, b.g, false)])
  if (o.q != null && map.maps.q.length) set.push([o.q, travelAt(map.maps.q, b.q, true)])
  for (const [i, v] of set) { ins.waysSet = ins.waysSet || []; ins.waysSet.push([i, v]); ins.pv = ins.pv || {}; ins.pv[i] = v; await NAT.call('paramSet', { track: t.id, uid: ins.uid, index: i, v }) }
  return true
}

/* ── a plug-in learnt where nothing of the song is: opened on the engine's own track for it (Engine::kLearnTrack, never
   played), learnt, taken off again — the settings window's first choices learn so ── */
const LEARN_TRACK = -7
async function learnById (id, want, say) {
  if (!NAT) return { kind: 'unknown', why: 'the app learns plug-ins' }
  const r = await NAT.call('insert', { track: LEARN_TRACK, id, show: 0 })
  if (!(r && r.ok)) return { kind: 'unknown', why: /!UAD$/.test(id) ? 'hardware' : (r && r.error) || 'would not open' }      // (a UAD plug-in that runs on its card: without the card it does not open)
  const t = { id: LEARN_TRACK }, ins = { uid: r.uid, name: r.name, fmt: r.fmt, id }
  try { return await learnPlug(t, ins, want, say) } finally { await NAT.call('remove', { track: LEARN_TRACK, uid: r.uid }) }
}

/* ── how often each plug-in is put on by hand (from the lists, the wall, the command line): the settings window's first
   choices list them by it. A song opened, or a way put on by the room itself (PROBE.quiet), is not counted. ── */
async function probeUsed (id) {
  if (!NAT) return
  const p = await NAT.call('prefGet'), u = (p && p.used && typeof p.used === 'object') ? p.used : {}, k = learntKey({ id })
  u[k] = (u[k] || 0) + 1
  await NAT.call('prefSet', { key: 'used', value: u })
}
if (typeof natInsert === 'function') {
  const ni0 = natInsert
  natInsert = async function (ti, id, ...more) { const r = await ni0.call(this, ti, id, ...more); if (r && r.ok && id && !PROBE.quiet) probeUsed(id); return r }
}
