/* ── notes: tracks that an instrument plays, the regions of notes on them, the keys ──
   A track of notes is a track like any that sounds (kind 'audio': lanes, patch, plug-ins, sends, a fader) with an
   instrument at the head of its patch: t.inst = { kind, sound, p, sample, pads } for one of the DAW's own (synth, drums,
   sampler), or { kind: 'plug', id, name, fmt, uid, state } for one from outside.
   A region of notes holds r.notes = [{ id, t, d, n, v }]: t where the note begins, in quarter notes counted from where
   the region's own material begins (bar r.a - r.off, as a file's sound does); d how long; n its key (60 is middle c); v
   how hard (1..127). A list is NEVER changed in place — every edit makes a new list — because the steps kept for undo,
   and the pieces of a region that was cut, all point at the list they were made with.
   Quarter notes, not bars: a note keeps its place and its length in time whatever the measure is.
   What the region does to its notes without touching them: r.q (a grid in quarter notes that they are pulled to), r.qs
   (how far: 1 all the way), r.sw (swing: 0 straight, 1 the off-beats a triplet late), r.tr (semitones), r.vel (added to
   how hard), r.rep (so many quarter notes of it said over and over). r.ctl = [{ id, t, c, v }]: what was turned along
   the way (c: a controller's number; 128 the bend, v then 0..16383). */
let NID = 0
const isInst = t => !!(t && t.inst)
const isNotes = r => !!(r && r.notes)
const QB = () => 4 / WHOLE()                                          // quarter notes to a bar
const mkNote = (t, d, n, v) => ({ id: ++NID, t, d, n, v })
const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const keyName = n => NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 2)        // (middle c, key 60, is c3 — as logic counts)

/* ── the DAW's own instruments, as the page knows them ──
   The engine holds the numbers each one rests at; a sound is the numbers that differ from those. */
const SYNTH_SOUNDS = {
  'e piano':     { wave1: 3, fm: .3, fmRatio: 1, fmDecay: .9, cutoff: 9000, envAmt: 0, slope: 0, reso: 0, aA: .002, aD: 2.2, aS: .1, aR: .35, velAmp: .85, spread: .5 },
  'soft keys':   { wave1: 2, wave2: 2, detune: 6, cutoff: 1800, envAmt: 1.6, fD: .5, fS: .2, aD: 1.6, aS: .35, aR: .4, velCut: .5 },
  'organ':       { wave1: 3, wave2: 3, oct2: 1, mix: .4, sub: .5, detune: 0, cutoff: 6000, envAmt: 0, aA: .003, aD: .1, aS: 1, aR: .06, velAmp: 0, vib: .08, lfoRate: 6.2 },
  'bell':        { wave1: 3, fm: .55, fmRatio: 3.5, fmDecay: 1.4, cutoff: 14000, envAmt: 0, slope: 0, aA: .001, aD: 2.6, aS: 0, aR: 1.2, spread: .7 },
  'marimba':     { wave1: 3, fm: .35, fmRatio: 4, fmDecay: .12, cutoff: 9000, envAmt: 0, slope: 0, aA: .001, aD: .5, aS: 0, aR: .3 },
  'pluck':       { wave2: 1, mix: .4, cutoff: 700, reso: .25, envAmt: 4, fA: .001, fD: .12, fS: 0, fR: .12, aA: .001, aD: .28, aS: 0, aR: .18, velCut: .6 },
  'sub bass':    { wave1: 3, mix: 0, cutoff: 900, envAmt: .5, keyTrack: .2, aD: .3, aS: .9, aR: .12, mono: 1, glide: .04, level: -4, spread: 0 },
  'round bass':  { wave2: 1, oct2: -1, mix: .45, cutoff: 420, reso: .2, envAmt: 2.4, fD: .22, fS: .15, aA: .003, aD: .35, aS: .75, aR: .1, mono: 1, glide: .03, level: -5, spread: 0 },
  'saw bass':    { detune: 14, cutoff: 900, reso: .32, envAmt: 3, fD: .16, fS: .1, aD: .3, aS: .7, aR: .09, mono: 1, spread: 0 },
  'warm pad':    { detune: 18, cutoff: 900, reso: .1, envAmt: 1.2, fA: .9, fD: 1.5, fS: .6, fR: 1.2, aA: .5, aD: 1, aS: .85, aR: 1.3, lfoRate: .4, lfoCut: .15, spread: .9, velAmp: .3 },
  'strings':     { detune: 24, cutoff: 2600, envAmt: .6, fA: .3, aA: .22, aD: .6, aS: .9, aR: .6, vib: .12, lfoRate: 5.4, spread: .8, velAmp: .4 },
  'glass pad':   { wave1: 3, fm: .18, fmRatio: 2, fmDecay: 3, cutoff: 8000, envAmt: 0, aA: .35, aD: 2, aS: .7, aR: 1.6, spread: .9 },
  'square lead': { wave1: 1, mix: 0, cutoff: 3200, reso: .2, envAmt: 1.2, aD: .2, aS: .85, aR: .12, mono: 1, glide: .05, vib: .1, spread: 0 },
  'saw lead':    { detune: 12, cutoff: 4200, reso: .25, envAmt: 1.5, aD: .2, aS: .85, aR: .12, mono: 1, glide: .04, vib: .12, spread: .2 },
}
/* the kit's pads, in the engine's order: a name, and the key that plays it */
const DRUM_PADS = [['kick', 36], ['rim', 37], ['snare', 38], ['clap', 39], ['low tom', 41], ['hat', 42], ['mid tom', 45], ['open hat', 46], ['high tom', 48], ['crash', 49], ['ride', 51], ['tambourine', 54], ['cowbell', 56], ['conga', 63], ['shaker', 70], ['clave', 75]]
const INST_KINDS = ['synth', 'drums', 'sampler']
const INST_FIRST = { synth: 'e piano', drums: 'kit', sampler: 'sampler' }
function newInst (kind, sound) {
  if (kind && typeof kind === 'object') { const o = kind; if (o.kind === 'plug') return { kind: 'plug', id: o.id, name: o.name, fmt: o.fmt, state: '' }; return newInst(o.kind, o.sound) }      // (as the new-track list hands it over: one of the room's own, or one from outside by its id)
  if (kind === 'synth') { const s = SYNTH_SOUNDS[sound] ? sound : INST_FIRST.synth; return { kind, sound: s, p: {} } }
  if (kind === 'drums') return { kind, sound: 'kit', p: {}, pads: {} }
  return { kind: 'sampler', sound: 'sampler', p: {}, sample: null }
}
/* what an instrument is called on the page: its sound, or the sound it plays from, or the plug-in's name */
const instName = t => { const I = t.inst; if (!I) return ''; if (I.kind === 'plug') return String(I.name || 'instrument').toLowerCase(); if (I.kind === 'sampler') return I.sample && I.sample.name ? String(I.sample.name).toLowerCase() : 'sampler'; return I.sound }
/* the instrument a track about to be made will have, by name (see the new-track list) */
const instPickName = o => !o ? INST_FIRST.synth : o.kind === 'plug' ? String(o.name || 'instrument').toLowerCase() : o.kind === 'drums' ? 'kit' : o.kind === 'sampler' ? 'sampler' : o.sound || INST_FIRST.synth
const instWord = t => { const I = t.inst; return !I ? '' : I.kind === 'plug' ? (I.out ? 'left out' : I.fmt || 'plug-in') : I.kind }
/* the numbers the engine is given for one: its sound's, then whatever was turned by hand */
const instParams = I => Object.assign({}, I.kind === 'synth' ? SYNTH_SOUNDS[I.sound] || {} : {}, I.p || {})
const instCopy = (I, state) => { const c = copy(I); delete c.uid; delete c.busy; if (c.kind === 'plug' && state != null) c.state = state; return c }

/* ── a region's notes as they sound ── */
/* a place pulled to a grid of g quarter notes, `strength` of the way; with swing the off-beats of the grid lie later (at
   1 a third of the pair, as a triplet has them) */
function quantPlace (t, g, strength, swing) {
  if (!(g > 0)) return t
  const pair = 2 * g, k = Math.floor(t / pair + 1e-9), into = t - k * pair, late = g * (1 + (swing || 0) / 3)
  const to = Math.abs(into) <= Math.abs(into - late) ? (Math.abs(into) <= Math.abs(into - pair) ? 0 : pair) : (Math.abs(into - late) <= Math.abs(into - pair) ? late : pair)
  return t + (k * pair + to - t) * (strength == null ? 1 : strength)
}
/* where a note of a region begins as it sounds (quarter notes from the region's own beginning): its grid is the song's, not the region's */
const noteAt = (r, x, orgQ) => r.q > 0 ? quantPlace(orgQ + x.t, r.q, r.qs, r.sw) - orgQ : x.t
/* the notes of a region as they sound: [{ a, b (bars from zero), n, v, id }], in the order they begin. A note sounds when it
   begins inside the region, and is cut where the region ends. */
function regSound (r) {
  const sig = [r.a, r.b, r.off || 0, r.q || 0, r.qs == null ? 1 : r.qs, r.sw || 0, r.tr || 0, r.vel || 0, r.gain || 0, r.rep || 0, S.meter[0], S.meter[1]].join()
  const c = r._ns
  if (c && c.notes === r.notes && c.sig === sig) return c.out
  const qb = QB(), ra = r.a - 1, rb = r.b - 1, org = ra - (r.off || 0), orgQ = org * qb, rep = r.rep > 0 ? r.rep : 0, out = []
  const qa = (ra - org) * qb, qz = (rb - org) * qb, tr = r.tr || 0, dv = (r.vel || 0) + Math.round((r.gain || 0) * 4)      // (a region's gain, on notes, is how hard they are played: four steps to what would be a decibel)
  for (const x of r.notes) {
    const n = x.n + tr
    if (n < 0 || n > 127) continue
    const t = noteAt(r, x, orgQ), v = clamp(Math.round(x.v + dv), 1, 127)
    if (rep) {
      if (t < -1e-9 || t >= rep - 1e-9) continue
      for (let k = Math.max(0, Math.floor((qa - t) / rep)); k < 100000; k++) { const at = t + k * rep; if (at >= qz - 1e-9) break; if (at < qa - 1e-9) continue; out.push({ a: org + at / qb, b: Math.min(org + (at + x.d) / qb, rb), n, v, id: x.id }) }
    } else if (t >= qa - 1e-9 && t < qz - 1e-9) out.push({ a: org + t / qb, b: Math.min(org + (t + x.d) / qb, rb), n, v, id: x.id })
  }
  out.sort((x, y) => x.a - y.a || x.n - y.n)
  r._ns = { notes: r.notes, sig, out }
  return out
}
/* everything a track of notes plays, flat for the engine: [begins, ends, key, how hard, ...] in bars from zero. Of two notes
   on one key the earlier ends where the later begins (a key cannot go down twice). `only`: the regions that sound. */
function trackSound (t, only) {
  const all = []
  for (const r of t.regs) if (r.notes && !r.mute && (!only || only(r))) for (const x of regSound(r)) all.push(x)
  all.sort((x, y) => x.a - y.a)
  const last = new Map(), flat = []
  for (const x of all) {
    const p = last.get(x.n)
    if (p && p.b > x.a) p.b = x.a
    const y = { a: x.a, b: x.b, n: x.n, v: x.v }
    last.set(x.n, y); flat.push(y)
  }
  const out = []
  for (const y of flat) if (y.b - y.a > 1e-7) out.push(+y.a.toFixed(7), +y.b.toFixed(7), y.n, y.v)
  return out
}
/* what is turned along the way, flat: [where, status, byte, byte, ...] */
function trackCtl (t, only) {
  const out = [], qb = QB()
  for (const r of t.regs) {
    if (!r.notes || !r.ctl || !r.ctl.length || r.mute || (only && !only(r))) continue
    const ra = r.a - 1, rb = r.b - 1, org = ra - (r.off || 0)
    for (const c of r.ctl) { const at = org + c.t / qb; if (at < ra - 1e-9 || at >= rb - 1e-9) continue; if (c.c === 128) out.push(+at.toFixed(7), 0xE0, c.v & 127, (c.v >> 7) & 127); else if (c.c === 129) out.push(+at.toFixed(7), 0xD0, c.v & 127, 0); else out.push(+at.toFixed(7), 0xB0, c.c & 127, c.v & 127) }
  }
  return out
}
/* what the engine is told of a track of notes, beside what it is told of every track (see sendSession) */
const noteMsg = (t, only) => isInst(t) ? { inst: 1, notes: trackSound(t, only), ctl: trackCtl(t, only) } : {}
/* does a track hear what is played by hand: the chosen track of notes does, and every armed one */
const liveOn = t => isInst(t) && (!!t.arm || S.tracks[S.sel] === t)

/* ── the lanes: a region's notes, each a short line at its height (the region's own range of keys, an octave at least) ── */
function notesPath (r, ly, lh, v0, v1) {
  const snd = regSound(r)
  if (!snd.length) return ''
  let lo = 127, hi = 0
  for (const x of snd) { if (x.n < lo) lo = x.n; if (x.n > hi) hi = x.n }
  const span = Math.max(12, hi - lo), base = (lo + hi) / 2 - span / 2, ra = r.a - 1, top = ly + 3.5, room = Math.max(1, lh - 7)
  let d = ''
  for (const x of snd) {
    const xa = (x.a - ra) * PXB, xb = (x.b - ra) * PXB
    if (xb < v0 - 2 || xa > v1 + 2) continue
    const a = Math.max(xa + .5, v0 - 8), b = Math.max(a + 1.2, Math.min(xb - .5, v1 + 8))
    d += `M${n(a - v0)} ${n(top + room * (1 - (x.n - base) / span))}H${n(b - v0)}`
  }
  return d
}

/* ── changing notes: always a new list ── */
function setNotes (r, list) { r.notes = list; delete r._ns; dirtyReg(r) }
/* the same notes, in the same hands: two pieces of one region that was cut (they are one again when they meet) */
const sameNotes = (A, B) => A.notes === B.notes && (A.ctl || null) === (B.ctl || null) && (A.q || 0) === (B.q || 0) && (A.qs == null ? 1 : A.qs) === (B.qs == null ? 1 : B.qs) && (A.sw || 0) === (B.sw || 0) && (A.vel || 0) === (B.vel || 0) && (A.rep || 0) === (B.rep || 0) && (A.tr || 0) === (B.tr || 0)
/* a region's notes as they sound, written out as notes of their own counted from bar `from` (bars from zero): what the
   region did to them — its grid, its transposing, its end — is in them now */
function bakedNotes (r, from) {
  const qb = QB()
  return regSound(r).map(x => mkNote((x.a - from) * qb, (x.b - x.a) * qb, x.n, x.v))
}
const bakedCtl = (r, from) => { const qb = QB(), ra = r.a - 1, rb = r.b - 1, org = ra - (r.off || 0); return (r.ctl || []).filter(c => { const at = org + c.t / qb; return at >= ra - 1e-9 && at < rb - 1e-9 }).map(c => ({ id: ++NID, t: (org + c.t / qb - from) * qb, c: c.c, v: c.v })) }
/* regions of notes made one: from the first one's beginning to the last one's end, holding what each of them sounded.
   (Regions that are pieces of one are joined by the ordinary join; this is for regions that are not.) */
function joinNotes (t, rs) {
  rs = rs.filter(r => r.notes).sort((x, y) => x.a - y.a)
  if (rs.length < 2) return false
  if (rs.every((r, i) => i === 0 || (sameNotes(rs[i - 1], r) && Math.abs(r.a - rs[i - 1].b) < 1e-6 && Math.abs((r.off || 0) - ((rs[i - 1].off || 0) + (rs[i - 1].b - rs[i - 1].a))) < 1e-6))) return false      // pieces of one, end to end: the ordinary join's
  const a = rs[0].a, b = Math.max(...rs.map(r => r.b)), first = rs[0], notes = [], ctl = []
  for (const r of rs) { for (const x of bakedNotes(r, a - 1)) notes.push(x); for (const c of bakedCtl(r, a - 1)) ctl.push(c) }
  notes.sort((x, y) => x.t - y.t)
  const gone = new Set(rs.slice(1))
  for (const k of ['q', 'qs', 'sw', 'tr', 'vel', 'rep']) delete first[k]
  first.b = b; first.off = 0; first.fi = 0; first.fo = 0; first.ctl = ctl.length ? ctl : undefined
  setNotes(first, notes)
  t.regs = t.regs.filter(r => !gone.has(r)); S.selR = S.selR.filter(id => ![...gone].some(r => r.id === id))
  return true
}

/* q on regions of notes: their notes are pulled to the grid the room is set to — in the region's keeping, so the notes
   themselves stay where they were played, and option-command-q gives them back */
function quantizeNotes (rs) {
  const g = (S.q || 1 / 16) * 4
  edit(() => { let any = false; for (const r of rs) if (r.q !== g) { r.q = g; if (r.qs == null) r.qs = 1; delete r._ns; dirtyReg(r); any = true } return any })
  say(`notes to 1/${Math.round(4 / g)}`)
}
function dequantizeNotes (rs) { edit(() => { let any = false; for (const r of rs) if (r.q) { delete r.q; delete r._ns; dirtyReg(r); any = true } return any }) }
/* how far the grid pulls (0..100), and how late its off-beats lie (0..100), for the chosen regions of notes */
function setNoteFeel (what, pct) {
  const rs = selRegs().map(x => x[0]).filter(isNotes)
  if (!rs.length) { say('choose a region of notes first'); return false }
  const v = clamp(pct, 0, 100) / 100
  edit(() => { for (const r of rs) { if (what === 'swing') r.sw = v; else r.qs = v; if (!r.q) r.q = (S.q || 1 / 16) * 4; delete r._ns; dirtyReg(r) } })
  say(`${what} ${Math.round(v * 100)}`)
  return true
}

/* ── a take of notes: what came in becomes notes where it was played ──
   ev: [where (bars from zero), status, byte, byte, ...] as the engine kept it. Returns { notes, ctl, last } with places in
   bars from zero (not yet a region's). A key still down when the take ended ends there (`end`). */
function notesFromEvents (ev, end) {
  const open = new Map(), notes = [], ctl = []
  let last = 0
  const close = (key, bar) => { const o = open.get(key); if (!o) return; open.delete(key); notes.push({ a: o.bar, b: Math.max(bar, o.bar + 1e-4), n: key, v: o.v }) }
  for (let k = 0; k + 3 < ev.length; k += 4) {
    const bar = ev[k], st = ev[k + 1] & 0xF0, d1 = ev[k + 2], d2 = ev[k + 3]
    if (bar > last) last = bar
    if (st === 0x90 && d2 > 0) { close(d1, bar); open.set(d1, { bar, v: d2 }) }
    else if (st === 0x80 || st === 0x90) close(d1, bar)
    else if (st === 0xB0) ctl.push({ at: bar, c: d1, v: d2 })
    else if (st === 0xE0) ctl.push({ at: bar, c: 128, v: d1 | (d2 << 7) })
    else if (st === 0xD0) ctl.push({ at: bar, c: 129, v: d1 })
  }
  for (const key of [...open.keys()]) close(key, Math.max(end == null ? last : end, last))
  notes.sort((x, y) => x.a - y.a)
  return { notes, ctl, last }
}
/* Notes laid on a track from bar `from` to `to` (bars from zero). Where a region of notes already lies under all of them,
   they are added to it — playing over a part adds to the part; where they reach past it, or over several, those and
   the new notes become one region. Call inside an edit. Returns the region. */
function layNotes (t, got, from, to) {
  const qb = QB(), under = t.regs.filter(r => r.notes && r.a - 1 < to - 1e-9 && r.b - 1 > from + 1e-9)
  if (under.length === 1 && under[0].a - 1 <= from + 1e-9 && under[0].b - 1 >= to - 1e-9) {
    const r = under[0], org = r.a - 1 - (r.off || 0)
    setNotes(r, r.notes.concat(got.notes.map(x => mkNote((x.a - org) * qb, (x.b - x.a) * qb, x.n, x.v))).sort((x, y) => x.t - y.t))
    if (got.ctl.length) r.ctl = (r.ctl || []).concat(got.ctl.map(c => ({ id: ++NID, t: (c.at - org) * qb, c: c.c, v: c.v }))).sort((x, y) => x.t - y.t)
    return r
  }
  const a = Math.min(from, ...under.map(r => r.a - 1)), b = Math.max(to, ...under.map(r => r.b - 1))
  const notes = [], ctl = []
  for (const r of under) { for (const x of bakedNotes(r, a)) notes.push(x); for (const c of bakedCtl(r, a)) ctl.push(c) }
  for (const x of got.notes) notes.push(mkNote((x.a - a) * qb, (x.b - x.a) * qb, x.n, x.v))
  for (const c of got.ctl) ctl.push({ id: ++NID, t: (c.at - a) * qb, c: c.c, v: c.v })
  notes.sort((x, y) => x.t - y.t); ctl.sort((x, y) => x.t - y.t)
  const gone = new Set(under)
  t.regs = t.regs.filter(r => !gone.has(r))
  carve(t, a, b)                                                                        // (whatever else lay there gives way, as under any take)
  const r = mkReg(Object.assign({ a: a + 1, b: b + 1, loop: false, notes, name: under.length ? under[0].name : undefined }, ctl.length ? { ctl } : {}))
  t.regs.push(r)
  return r
}
/* the engine's answer for one track of notes at the end of a take (see recStop): a region from where the take began to the
   bar line after it ended */
function placeNoteTake (t, d, start, end) {
  const got = notesFromEvents(d.ev || [], end)
  if (!got.notes.length) return null
  const to = Math.max(start + 1, Math.ceil(Math.max(end || 0, ...got.notes.map(x => x.b)) - 1e-6))
  for (const x of got.notes) if (x.b > to) x.b = to
  return layNotes(t, got, start, to)
}
/* ⇧R: what was just played, though nothing was recording, laid on the chosen track of notes. Played while the song ran, it
   lies where it was played; played with the song standing still, it begins at the playhead, as fast as it was played. */
async function captureNotes () {
  const t = S.tracks[S.sel]
  if (!isInst(t)) { say('choose a track of notes first'); return null }
  if (!NAT) { say('the keys are in the app'); return null }
  const d = await NAT.call('capture')
  if (!d || !d.ok || !Array.isArray(d.ev) || !d.ev.length) { say('nothing was played'); return null }
  const ev = d.ev.slice()
  if (!d.rolling) {
    /* seconds since the first key: the last phrase only (what came before a silence of eight seconds is let go), from the bar the playhead is in */
    let cut = 0
    for (let k = 4; k + 3 < ev.length; k += 4) if (ev[k] - ev[k - 4] > 8) cut = k
    const t0 = ev[cut], at = Math.max(0, Math.floor(curPos() + 1e-6))
    ev.splice(0, cut)
    for (let k = 0; k + 3 < ev.length; k += 4) ev[k] = at + (ev[k] - t0) / SPB()
  }
  const got = notesFromEvents(ev, null)
  if (!got.notes.length) { say('nothing was played'); return null }
  const from = Math.max(0, Math.floor(got.notes[0].a + 1e-6)), to = Math.max(from + 1, Math.ceil(Math.max(...got.notes.map(x => x.b)) - 1e-6))
  let made = null
  edit(() => { made = layNotes(t, got, from, to); S.selR = [made.id]; S.focus = 'lanes'; return true })
  say(`${got.notes.length} notes kept`)
  return made
}

/* ── the computer's own keys as a keyboard (command k): the row from a to ' is the white keys from c, the row above the
   black ones; z and x move an octave, c and v play softer and harder, tab holds the pedal, 1 and 2 bend ── */
const TYPE = { on: false, oct: 5, vel: 100, down: new Map(), ped: false, told: false, mod: -1, bend: 0 }      // (down: what holds a key — a letter's code, or the pointer — and the key it holds; mod: which of the wheel's six cells, bend: −1, 0, 1)
const TYPE_KEYS = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17 }
/* a key sent to the engine as a keyboard would send it (in a browser there is no instrument to hear it) */
function playKey (st, d1, d2) { if (NAT) NAT.call('key', { st, d1, d2 }) }
function typeAllUp () { for (const n of TYPE.down.values()) playKey(0x80, n, 0); TYPE.down.clear(); if (TYPE.ped) { TYPE.ped = false; playKey(0xB0, 64, 0) } if (TYPE.bend) { TYPE.bend = 0; playKey(0xE0, 0, 64) } uiDirty('keys') }
/* the keyboard's own hands (a letter and the pointer on the sheet do the same things): a key down or up, held by `id` */
function typeNote (id, key, on) {
  if (on) {
    if (key > 127 || key < 0 || TYPE.down.has(id)) return
    if (!S.tracks.some(liveOn) && !TYPE.told) { TYPE.told = true; say('choose a track of notes to hear the keyboard') }
    syncLive()
    TYPE.down.set(id, key); playKey(0x90, key, TYPE.vel)
  } else if (TYPE.down.has(id)) { playKey(0x80, TYPE.down.get(id), 0); TYPE.down.delete(id) } else return
  uiDirty('keys')
}
function typeOct (d) { typeAllUp(); TYPE.oct = clamp(TYPE.oct + d, 0, 9); say(`keyboard from ${keyName(TYPE.oct * 12)}`); uiDirty('cmd', 'keys') }
function typeVel (d) { TYPE.vel = clamp(TYPE.vel + d, 10, 127); say(`keyboard at ${TYPE.vel}`); uiDirty('keys') }
function typePed (on) { if (TYPE.ped === !!on) return; TYPE.ped = !!on; playKey(0xB0, 64, on ? 127 : 0); uiDirty('keys') }
function typeBend (d) { TYPE.bend = d; if (d < 0) playKey(0xE0, 0, 0); else if (d > 0) playKey(0xE0, 127, 127); else playKey(0xE0, 0, 64); uiDirty('keys') }
function typeMod (i) { TYPE.mod = i; playKey(0xB0, 1, Math.round(i * 127 / 5)); uiDirty('keys') }
function toggleTyping (on) {
  TYPE.on = on == null ? !TYPE.on : !!on
  if (!TYPE.on) typeAllUp()
  say(TYPE.on ? `keyboard on  ${keyName(TYPE.oct * 12)}  ${TYPE.vel}` : 'keyboard off')
  uiDirty('cmd', 'top', 'keys')
}
function typeDown (e) {
  if (!TYPE.on || e.metaKey || e.ctrlKey || e.altKey || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return
  if (S.newT || S.menu || S.sheet || S.ask || (typeof START !== 'undefined' && START.on)) return      // (a list or a sheet is up, or the start page: the keys are theirs)
  const c = e.code, st = TYPE_KEYS[c]
  const mine = st != null || c === 'KeyZ' || c === 'KeyX' || c === 'KeyC' || c === 'KeyV' || c === 'Tab' || /^Digit[1-8]$/.test(c)
  if (!mine || e.shiftKey) return
  e.preventDefault(); e.stopImmediatePropagation()                                      // (it is a key of the keyboard now: the commands do not hear it)
  if (e.repeat) return
  if (st != null) typeNote(c, TYPE.oct * 12 + st, true)
  else if (c === 'KeyZ' || c === 'KeyX') typeOct(c === 'KeyX' ? 1 : -1)
  else if (c === 'KeyC' || c === 'KeyV') typeVel(c === 'KeyV' ? 10 : -10)
  else if (c === 'Tab') typePed(true)
  else if (c === 'Digit1') typeBend(-1)
  else if (c === 'Digit2') typeBend(1)
  else typeMod(+c.slice(5) - 3)
}
function typeUp (e) {
  if (!TYPE.on) return
  const c = e.code
  if (TYPE.down.has(c)) { typeNote(c, 0, false); e.stopImmediatePropagation() }
  else if (c === 'Tab' && TYPE.ped) typePed(false)
  else if (c === 'Digit1' || c === 'Digit2') typeBend(0)
}
addEventListener('keydown', typeDown, true)
addEventListener('keyup', typeUp, true)
addEventListener('blur', () => { if (TYPE.on) typeAllUp() })

/* every instrument silent at once, every key up (control-command-period; and stop pressed twice) */
function hushNotes () { typeAllUp(); if (NAT) NAT.call('hush') }

/* ── a new track of notes ── */
/* a name for it: what it plays, numbered when that is taken */
function instTrackName (I) {
  const stem = I.kind === 'plug' ? String(I.name || 'instrument').toLowerCase().slice(0, 24) : I.kind === 'drums' ? 'drums' : I.kind === 'sampler' ? 'sampler' : I.sound
  if (!S.tracks.some(t => t.name === stem)) return stem
  let k = 2
  while (S.tracks.some(t => t.name === `${stem} ${k}`)) k++
  return `${stem} ${k}`
}
/* option-command-s: a track of notes at once, playing the synth's first sound */
function newInstTrack (kind = 'synth', sound) {
  if (S.tracks.length >= MAX_TRACKS) { say('no room for another track'); return null }
  const made = newTracks({ kind: 'midi', inst: { kind, sound }, n: 1, out: S.tracks[S.sel] && S.tracks[S.sel].parent ? S.tracks[S.sel].parent : 0 })
  return made[0] || null
}
/* another instrument for a track of notes (one of the DAW's own): kind, and for the synth which sound */
function setInst (t, kind, sound) {
  if (!isInst(t) || !INST_KINDS.includes(kind)) return
  const was = t.inst
  if (was.kind === kind && (kind !== 'synth' || was.sound === sound || !SYNTH_SOUNDS[sound])) return      // it is that already
  if (was.kind === 'plug' && was.uid && NAT) NAT.call('remove', { track: t.id, uid: was.uid })
  t.inst = newInst(kind, sound)
  t._instTold = null
  instSyncAll(); uiDirty('dock', 'head', 'lanes')
}
/* something turned on a track's own instrument: {name: value}. Kept with the track, and told to the engine at once. */
function setInstParams (t, p) {
  if (!isInst(t) || t.inst.kind === 'plug') return
  Object.assign(t.inst.p, p)
  t._instTold = instSig(t)
  if (NAT) NAT.call('instSet', { track: t.id, p })
}
/* a sound for the sampler to play from, or for one pad of the kit: a file of the project ({ file, name }) */
function setInstSample (t, slot, f) {
  if (!isInst(t)) return
  const I = t.inst
  if (I.kind === 'sampler') I.sample = f ? { file: f.file, name: f.name } : null
  else if (I.kind === 'drums') { I.pads = I.pads || {}; if (f) I.pads[slot] = { file: f.file, name: f.name }; else delete I.pads[slot] }
  else return
  t._instTold = null
  instSyncAll(); uiDirty('dock', 'head')
}
/* an instrument from outside takes the track's instrument place */
async function setInstPlug (t, p, quiet) {
  if (!isInst(t) || !NAT) return null
  const was = t.inst
  if (was.kind === 'plug' && was.uid) await NAT.call('remove', { track: t.id, uid: was.uid })
  const r = await NAT.call('insert', { track: t.id, id: p.id, state: '', show: quiet ? 0 : 1, inst: 1 })
  if (r && r.ok) { t.inst = { kind: 'plug', id: p.id, name: r.name, fmt: r.fmt, uid: r.uid, state: '' }; t._instTold = instSig(t) } else { t._instTold = null; instSyncAll() }      // (it would not open: the instrument the track had is put back)
  uiDirty('dock', 'head')
  return r
}

/* ── the engine is told of the instruments ──
   After every telling of the session: a track of notes the engine has not been given its instrument for — it is new, or
   came back with an undo (the engine let the track go meanwhile), or its instrument is another — is given it. */
const instSig = t => { const I = t.inst; return I.kind === 'plug' ? `plug|${I.id}` : `${I.kind}|${I.sound}|${JSON.stringify(I.p || {})}|${I.sample ? I.sample.file : ''}|${JSON.stringify(I.pads || {})}` }
let INST_IN = new Set(), instRun = null, instAgain = false
function instSyncAll () {                                                               // (one at a time: asked for while one runs, it runs once more when that one is done)
  if (!NAT) return Promise.resolve()
  if (instRun) { instAgain = true; return instRun }
  instRun = (async () => { do { instAgain = false; await instSyncNow() } while (instAgain) })().finally(() => { instRun = null })
  return instRun
}
async function instSyncNow () {
  const now = new Set()
  for (const t of S.tracks) {
    if (!isInst(t)) continue
    now.add(t.id)
    if (!INST_IN.has(t.id)) { t._instTold = null; if (t.inst.kind === 'plug') t.inst.uid = 0 }      // the engine did not hold this track at the last telling: whatever it was given is gone
    const sig = instSig(t)
    if (t._instTold === sig) continue
    t._instTold = sig
    const I = t.inst
    if (I.kind === 'plug') {
      if (I.uid || I.out || I.busy) continue
      if (LOAD.bare || DISTRUST.has(I.id)) { I.out = true; LOAD.left.push(I.name || 'instrument'); continue }
      I.busy = true
      const r = await NAT.call('insert', { track: t.id, id: I.id, state: I.state || '', show: 0, inst: 1 })
      I.busy = false
      if (r && r.ok) { I.uid = r.uid; I.name = r.name; I.fmt = r.fmt } else { I.out = true; LOAD.left.push(I.name || 'instrument') }
      uiDirty('dock')
      continue
    }
    await NAT.call('inst', { track: t.id, kind: I.kind, p: instParams(I) })
    const sounds = I.kind === 'sampler' ? (I.sample ? [[0, I.sample]] : []) : I.kind === 'drums' ? Object.entries(I.pads || {}).map(([k, f]) => [+k, f]) : []
    for (const [slot, f] of sounds) {
      const d = await NAT.call('audioLoad', { project: projKey(), file: f.file })
      if (d && d.ok) await NAT.call('instSample', { track: t.id, slot, key: d.key })
    }
  }
  INST_IN = now
}
/* the chosen track, or what is armed, has changed: the engine is told which tracks hear the keys */
let liveTold = ''
function syncLive () {
  const sig = S.tracks.filter(liveOn).map(t => t.id).join()
  if (sig === liveTold) return
  const was = new Set(liveTold ? liveTold.split(',').map(Number) : []), now = new Set(sig ? sig.split(',').map(Number) : [])
  liveTold = sig
  for (const t of S.tracks) if (was.has(t.id) !== now.has(t.id)) pushTrack(t)
}

/* ── notes in a standard file (a .mid): out, for whoever takes the song further; in, onto tracks of notes ── */
const SMF_PPQ = 480
function smfVar (v) { const b = [v & 127]; v = Math.floor(v / 128); while (v > 0) { b.unshift((v & 127) | 128); v = Math.floor(v / 128) } return b }
/* the song as a file of type 1: a first track with the tempo, the measure and the markers, then one for each track of
   notes (a kit on the drum channel). a0, a1: the stretch to write, in bars from zero (the whole song when left out);
   it begins at the file's beginning. */
function smfWrite (a0, a1, only) {
  const qb = QB(), from = a0 == null ? 0 : a0, to = a1 == null ? SONG_END : a1, tick = bar => Math.max(0, Math.round((bar - from) * qb * SMF_PPQ))
  const chunk = (id, bytes) => [...id].map(c => c.charCodeAt(0)).concat([bytes.length >>> 24 & 255, bytes.length >>> 16 & 255, bytes.length >>> 8 & 255, bytes.length & 255], bytes)
  const text = s => [...new TextEncoder().encode(String(s))]
  const track = evs => {                                                               // evs: [tick, order, bytes]
    evs.sort((x, y) => x[0] - y[0] || x[1] - y[1])
    const out = []
    let at = 0
    for (const [t, , bytes] of evs) { out.push(...smfVar(t - at), ...bytes); at = t }
    out.push(0, 0xFF, 0x2F, 0)
    return chunk('MTrk', out)
  }
  const us = Math.round(60000000 / S.tempo), lead = [[0, 0, [0xFF, 0x51, 3, us >>> 16 & 255, us >>> 8 & 255, us & 255]], [0, 0, [0xFF, 0x58, 4, S.meter[0], Math.round(Math.log2(S.meter[1])), 24, 8]]]
  for (const sc of SCENES) { const at = sc.a - 1; if (at >= from - 1e-9 && at < to) { const nm = text(sc.name); lead.push([tick(at), 1, [0xFF, 0x06, ...smfVar(nm.length), ...nm]]) } }
  const tracks = [track(lead)]
  let ch = 0
  for (const t of S.tracks) {
    if (!isInst(t) || (only && !only(t))) continue
    const flat = trackSound(t), ctl = trackCtl(t), drum = t.inst.kind === 'drums', c = drum ? 9 : (ch === 9 ? ++ch : ch) & 15
    if (!drum) ch++
    const nm = text(t.name), evs = [[0, 0, [0xFF, 0x03, ...smfVar(nm.length), ...nm]]]
    for (let k = 0; k + 3 < flat.length; k += 4) {
      const a = flat[k], b = Math.min(flat[k + 1], to)
      if (a < from - 1e-9 || a >= to - 1e-9) continue
      evs.push([tick(a), 3, [0x90 | c, flat[k + 2], flat[k + 3]]], [Math.max(tick(a) + 1, tick(b)), 1, [0x80 | c, flat[k + 2], 0]])
    }
    for (let k = 0; k + 3 < ctl.length; k += 4) if (ctl[k] >= from - 1e-9 && ctl[k] < to) evs.push([tick(ctl[k]), 2, (ctl[k + 1] & 0xF0) === 0xD0 ? [ctl[k + 1] | c, ctl[k + 2]] : [ctl[k + 1] | c, ctl[k + 2], ctl[k + 3]]])
    if (evs.length > 1) tracks.push(track(evs))
  }
  const head = chunk('MThd', [0, 1, tracks.length >>> 8 & 255, tracks.length & 255, SMF_PPQ >>> 8 & 255, SMF_PPQ & 255])
  return { bytes: new Uint8Array(head.concat(...tracks)), tracks: tracks.length - 1 }
}
/* a standard file read: { ok, bpm, meter, tempos (how many tempos it holds), markers: [[name, quarter]], tracks: [{ name, drum, notes:
   [{ t, d, n, v }] (quarter notes from the file's beginning), ctl }] } */
function smfRead (u8) {
  const str = (o, k) => String.fromCharCode(...u8.subarray(o, o + k)), u32 = o => (u8[o] << 24 | u8[o + 1] << 16 | u8[o + 2] << 8 | u8[o + 3]) >>> 0, u16 = o => u8[o] << 8 | u8[o + 1]
  if (u8.length < 14 || str(0, 4) !== 'MThd') return { ok: false }
  const div = u16(12)
  if (div & 0x8000 || !div) return { ok: false }                                         // (timed in frames of film, not in beats: not a song's file)
  const out = { ok: true, bpm: 0, meter: null, tempos: 0, markers: [], tracks: [] }
  let o = 8 + u32(4)
  while (o + 8 <= u8.length) {
    const id = str(o, 4), len = u32(o + 4), end = Math.min(u8.length, o + 8 + len)
    o += 8
    if (id !== 'MTrk') { o = end; continue }
    const tr = { name: '', drum: false, notes: [], ctl: [] }, open = new Map()
    let tick = 0, run = 0, chans = new Set()
    const vlq = () => { let v = 0; for (let k = 0; k < 4 && o < end; k++) { const b = u8[o++]; v = v * 128 + (b & 127); if (!(b & 128)) break } return v }
    while (o < end) {
      tick += vlq()
      let st = u8[o]
      if (st & 0x80) o++; else st = run
      const q = tick / div
      if (st === 0xFF) {
        const type = u8[o++], n = vlq()
        if (type === 0x51 && n === 3) { out.tempos++; if (!out.bpm) out.bpm = 60000000 / (u8[o] << 16 | u8[o + 1] << 8 | u8[o + 2]) }
        else if (type === 0x58 && n >= 2 && !out.meter) out.meter = [u8[o], 1 << u8[o + 1]]
        else if (type === 0x03 && !tr.name) tr.name = new TextDecoder().decode(u8.subarray(o, o + n))
        else if (type === 0x06) out.markers.push([new TextDecoder().decode(u8.subarray(o, o + n)), q])
        o += n
      } else if (st === 0xF0 || st === 0xF7) { o += vlq() }
      else {
        run = st
        const type = st & 0xF0, ch = st & 15, d1 = u8[o++], d2 = type === 0xC0 || type === 0xD0 ? 0 : u8[o++], key = ch * 128 + d1
        const close = () => { const s = open.get(key); if (s) { open.delete(key); tr.notes.push({ t: s.q, d: Math.max(q - s.q, 1 / div), n: d1, v: s.v }) } }
        if (type === 0x90 && d2 > 0) { close(); open.set(key, { q, v: d2 }); chans.add(ch) }
        else if (type === 0x80 || type === 0x90) close()
        else if (type === 0xB0) tr.ctl.push({ t: q, c: d1, v: d2 })
        else if (type === 0xE0) tr.ctl.push({ t: q, c: 128, v: d1 | (d2 << 7) })
      }
    }
    tr.drum = chans.size > 0 && [...chans].every(c => c === 9)
    tr.notes.sort((x, y) => x.t - y.t)
    if (tr.notes.length) out.tracks.push(tr)
    o = end
  }
  return out
}
/* a file of notes let go on the room (or chosen to bring in): each of its tracks becomes a track of notes with one region,
   from bar `bar` (counted from one). A song that holds nothing yet takes the file's tempo and measure; any other keeps
   its own, and the notes keep their beats. */
function placeMidi (u8, name, bar) {
  const f = smfRead(u8)
  if (!f.ok || !f.tracks.length) { say(`no notes in ${String(name).toLowerCase().slice(0, 28)}`); return false }
  const empty = !S.tracks.some(t => t.regs.length)
  if (empty && f.meter && MEASURES.some(m => m[0] === f.meter[0] && m[1] === f.meter[1]) && (f.meter[0] !== S.meter[0] || f.meter[1] !== S.meter[1])) setMeter(f.meter[0], f.meter[1])
  if (empty && f.bpm >= 40 && f.bpm <= 240 && Math.abs(f.bpm - S.tempo) > .005) setTempo(Math.round(f.bpm * 100) / 100)
  const qb = QB(), before = editState(), made = [], base = String(name || 'notes').replace(/\.[^.]+$/, '').toLowerCase()
  for (const tr of f.tracks) {
    if (S.tracks.length >= MAX_TRACKS) break
    const I = newInst(tr.drum ? 'drums' : 'synth'), nm = (tr.name || (f.tracks.length > 1 ? `${base} ${made.length + 1}` : base)).toLowerCase().slice(0, 24)
    const t = mkTrack(nm, null, null, null, null, 0, [], mkPatch(0, 0, 0, [0, 0, 0]), { inst: I })
    t.patch0 = copy(t.patch)
    const lastQ = Math.max(...tr.notes.map(x => x.t + x.d)), len = Math.max(1, Math.ceil(lastQ / qb - 1e-6))
    const r = mkReg(Object.assign({ a: bar, b: bar + len, loop: false, notes: tr.notes.map(x => mkNote(x.t, x.d, x.n, x.v)), name: nm }, tr.ctl.length ? { ctl: tr.ctl.map(c => ({ id: ++NID, t: c.t, c: c.c, v: c.v })) } : {}))
    t.regs.push(r); S.tracks.push(t); made.push(t)
  }
  if (!made.length) return false
  normalizeOrder(); leadTrack(S.tracks.indexOf(made[0])); S.selR = made.map(t => t.regs[0].id); S.focus = 'lanes'
  birthAll(); commit(before)
  say(`${made.length} ${made.length > 1 ? 'tracks' : 'track'} of notes from ${base.slice(0, 28)}${!empty && f.bpm && Math.abs(f.bpm - S.tempo) > .5 ? `, at the song's ${+S.tempo.toFixed(2)} not its ${+f.bpm.toFixed(2)}` : ''}`)
  return true
}
/* what goes into a hand-off folder beside the sound: the notes as a standard file, and a page that says the tempo, the
   measure, the key and where the markers are. dir: the folder the app printed into. */
function songInfo (a0, a1) {
  const lines = [`${PROJ.name}`, '', `tempo  ${+S.tempo.toFixed(2)}`, `measure  ${S.meter[0]}/${S.meter[1]}`]
  if (S.key) lines.push(`key  ${S.key}`)
  lines.push(`from bar ${+(a0 + 1).toFixed(3)} to bar ${+(a1 + 1).toFixed(3)}  (${mmss((a1 - a0) * SPB())})`, '', 'markers')
  for (const sc of SCENES) if (sc.a - 1 >= a0 - 1e-9 && sc.a - 1 < a1) lines.push(`  bar ${sc.a}  ${clock(sc.a - 1 - a0)}  ${sc.name}`)
  lines.push('', 'tracks')
  S.tracks.forEach((t, i) => { if (t.kind === 'audio') lines.push(`  ${pad2(i + 1)}  ${t.name}${isInst(t) ? `  (notes, played by ${instName(t)})` : ''}`) })
  return lines.join('\n') + '\n'
}
async function handOffExtras (dir, name, a0, a1) {
  if (!NAT || !dir) return 0
  let n = 0
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s) }
  const mid = smfWrite(a0, a1)
  if (mid.tracks > 0 && (await NAT.call('fileWrite', { dir, name: `${name}.mid`, data: b64(mid.bytes) }) || {}).ok) n++
  if ((await NAT.call('fileWrite', { dir, name: `${name} info.txt`, data: b64(new TextEncoder().encode(songInfo(a0, a1))) }) || {}).ok) n++
  return n
}

/* ── joined to the rest of the room (this script is read after the app's own engine has taken its place) ── */
{
  const flush0 = flush
  flush = function () { flush0(); syncLive() }
  if (NAT) {
    /* stop, pressed with the song already standing still, also silences every instrument: a note that hangs (an instrument from
       outside that missed its key coming up) is put out by the key that is already under the hand */
    const halt0 = halt
    halt = function (rewind) { if (rewind && !S.playing && !S.rec) hushNotes(); return halt0(rewind) }
    const tell0 = natSession
    natSession = async only => { const r = await tell0(only); if (!only) await instSyncAll(); return r }
    resync = () => { natSession() }
    NAT.on('dawRate', () => { for (const t of S.tracks) if (isInst(t) && t.inst.kind !== 'plug') t._instTold = null })      // (the sounds they play from come again at the new rate: they are handed over again)
  }
}
