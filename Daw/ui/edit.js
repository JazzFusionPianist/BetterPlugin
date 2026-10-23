/* ── editing: regions, tools, snap, the cycle, undo, and the keys (Steven's Logic set) ──
   Positions here are bars counted from zero; a region keeps a and b counted from one (b is where it ends). */
const toolWord = name => name === 'flex' ? 'rubato' : name                           // (the tool that pulls pins is called rubato, as the view is)
const TOOLS = [['pointer', 'KeyT', 't'], ['smart', 'KeyS', 's'], ['pencil', 'KeyP', 'p'], ['eraser', 'KeyE', 'e'], ['scissors', 'KeyI', 'i'], ['join', 'KeyJ', 'j'], ['mute', 'KeyM', 'm'], ['gain', 'KeyG', 'g'], ['fade', 'KeyA', 'a'], ['marquee', 'KeyR', 'r'], ['flex', 'KeyX', 'x'], ['zoom', 'KeyY', 'y'], ['velocity', 'KeyV', 'v']]      // (velocity: on the notes page a note is pulled up or down to be played harder or softer — roll.js; on the lanes it is the gain tool, which is the same thing said of a region)
/* how far one nudge goes. A tick is a 960th of a beat; the last three are lengths of time, whatever the tempo */
const NUDGES = ['bar', 'beat', '1/16', '10 ticks', 'tick', '10 ms', '1 ms', 'sample']
const NUDGE_KEY = { bar: '⌥⇧m', beat: '⌥⇧b', '1/16': '⌥⇧s', '10 ticks': '⌥⇧t', tick: '⌥⇧q', '10 ms': '⌃⌥0', '1 ms': '⌃⌥1', sample: '⌃⌥s' }
const nudgeBars = () => ({ bar: 1, beat: 1 / BEATS(), '1/16': WHOLE() / 16, '10 ticks': 10 * WHOLE() / 3840, tick: WHOLE() / 3840, '10 ms': .01 / SPB(), '1 ms': .001 / SPB(), sample: 1 / SND_SR / SPB() })[S.nudge] || 1 / 4
/* MIN_LEN — the shortest thing that can be made, or kept apart from an end, at the zoom the room is in: a thirty-second of a
   bar in the ordinary views; closer in, four pixels' worth, down to two samples. (Read wherever it is named, so it is
   always the present zoom's.) */
Object.defineProperty(window, 'MIN_LEN', { get: () => Math.max(2 * oneSample(), Math.min(1 / 32, 4 / PXB)), configurable: true })
const regOf = id => { for (const t of S.tracks) for (const r of t.regs) if (r.id === id) return [r, t]; return [null, null] }
/* the chosen regions, each with its track, in the order they were chosen (a few: looked up one by one; many: one pass over the song) */
const selRegs = () => {
  if (S.selR.length < 6) return S.selR.map(regOf).filter(x => x[0])
  const want = new Set(S.selR), got = new Map()
  for (const t of S.tracks) for (const r of t.regs) if (want.has(r.id)) got.set(r.id, [r, t])
  return S.selR.map(id => got.get(id)).filter(Boolean)
}
const dirtyReg = r => { delete r._p; delete r._k }
const cloneReg = (r, more) => { const c = Object.assign({}, r, more || {}); c.id = ++RID; if (r.flex) c.flex = r.flex.map(m => Object.assign({}, m)); dirtyReg(c); return c }

/* ── undo: the tracks and their order, what each holds and where it goes, the lines drawn along the song, the scenes ── */
const UNDO = [], REDO = []
const T_KEEP = ['name', 'kind', 'out', 'parent', 'open', 'ap', 'col', 'shape', 'grp', 'alt']
const keepRegs = list => list.map(r => Object.assign({}, r, r.flex ? { flex: r.flex.map(m => Object.assign({}, m)) } : {}))
const editState = () => ({
  order: S.tracks.slice(), regs: S.tracks.map(t => keepRegs(t.regs)),
  props: S.tracks.map(t => { const o = { sends: copy(t.sends || []), autos: copy(t.autos || {}), alts: (t.alts || []).map(a => ({ name: a.name, regs: keepRegs(a.regs) })) }; for (const k of T_KEEP) o[k] = t[k]; return o }),
  selR: S.selR.slice(), selP: S.selP.slice(), cycle: Object.assign({}, S.cycle), sel: S.sel, selT: S.selT.slice(), scenes: SCENES.map(s => [s.name, s.a, s.c]), end: SONG_END, tempo: S.tempo, selX: S.selX ? S.selX.slice() : null,
  ref: typeof refKeep === 'function' ? refKeep() : null,                                // (the reference's regions: reference.js)
})
/* the levels of every track as they stand. A step made by the command line carries them (a line may move faders, and
   takes them back with everything else it did); a step made by hand does not, so going back over an edit leaves the
   mix where it is now */
const mixState = () => S.tracks.map(t => ({ id: t.id, vol: t.vol, pan: t.pan, mute: t.mute, solo: t.solo, patch: copy(t.patch) }))
const withMix = (now, st) => { if (st.mix) now.mix = mixState(); return now }
function restoreEdit (st) {
  S.tracks = st.order.slice()
  if (st.mix) { for (const x of st.mix) { const t = byId(x.id); if (t) { t.vol = x.vol; t.pan = x.pan; t.mute = x.mute; t.solo = x.solo; t.patch = copy(x.patch); t.ghost = null } } applyAll() }
  S.tracks.forEach((t, i) => { t.regs = keepRegs(st.regs[i]); const o = st.props[i]; for (const k of T_KEEP) t[k] = o[k]; t.sends = copy(o.sends); t.autos = copy(o.autos); t.alts = (o.alts || []).map(a => ({ name: a.name, regs: keepRegs(a.regs) })) })
  S.selR = st.selR.slice(); S.selP = st.selP.slice(); S.cycle = Object.assign({}, st.cycle); S.sel = clamp(st.sel, 0, S.tracks.length - 1); S.marq = null
  { const A = st.selX ? regOf(st.selX[0])[0] : null, B = st.selX ? regOf(st.selX[1])[0] : null; S.selX = A && B && xfadeOf(A, B) ? st.selX.slice() : null }      // (a crossfade that was the thing chosen is chosen again, if it is there)
  /* a state comes back with the tempo it was kept at (a change of tempo is a step like any other): its regions are as many
     bars as they were then, and what is held on the clipboard goes with the tempo once more */
  if (st.tempo && Math.abs(S.tempo / st.tempo - 1) > 1e-9) {
    const k = st.tempo / S.tempo, was = S.playing && !S.rec, p = curPos()
    if (was) halt(false)                                                                // (a song that is playing stops for it and goes on from the same bar, as when the tempo is set)
    const sent = tempoBack(st.tempo); retimeClip(k)
    if (was) Promise.resolve(sent).then(() => { S.pos = Math.min(p, SONG_END); play(S.pos); uiDirty('top') })
  }
  S.selT = (st.selT || []).filter(id => S.tracks.some(t => t.id === id)); S.selM = null
  SONG_END = st.end; SCENES = mkScenes(st.scenes)
  if (typeof refBack === 'function') refBack(st.ref)
}
const EVERY = ['lanes', 'head', 'ruler', 'scenes', 'top', 'hand', 'dock', 'info', 'look']
/* what a region remembers of an edit of the song's time (see seamLane, partAt) is lengths in bars: counted anew with the rest */
function scaleNotes (r, k) {
  if (r.sm) r.sm = { t: r.sm.t * k, s: r.sm.s * k, fo: r.sm.fo * k, foc: r.sm.foc, f: r.sm.f * k, fi: r.sm.fi * k, g: r.sm.g * k }
  for (const key of ['px', 'py']) if (r[key]) r[key] = Object.assign({}, r[key], { la: r[key].la * k, lb: r[key].lb * k, aEnd: r[key].aEnd * k, bStart: r[key].bStart * k }, r[key].xo != null ? { xo: r[key].xo * k } : {})
}
/* a crossfade that was the thing chosen and is one no longer is not chosen */
function liveSelX () { if (S.selX) { const A = regOf(S.selX[0])[0], B = regOf(S.selX[1])[0]; if (!(A && B && xfadeOf(A, B))) S.selX = null } }
function afterEdit () { liveSelX(); growSong(); VY = clamp(VY, 0, maxVY()); repaint(); resync(); pushTransport(); uiDirty(...EVERY); reviveInserts() }
function commit (before) { joinEnds(); UNDO.push(before); if (UNDO.length > 120) UNDO.shift(); REDO.length = 0; afterEdit() }
function undoEdit () { if (UNDO.length && !S.rec) { const st = UNDO.pop(); REDO.push(withMix(editState(), st)); restoreEdit(st); afterEdit(); rewarpAll() } }      // (not while a take runs: a step may bring another tempo back, and the take is counted in this one)
function redoEdit () { if (REDO.length && !S.rec) { const st = REDO.pop(); UNDO.push(withMix(editState(), st)); restoreEdit(st); afterEdit(); rewarpAll() } }
/* the song is as long as what is in it, and a little more (the demo stays as it was written) */
function growSong () {
  const end = Math.max(0, ...S.tracks.flatMap(t => t.regs.map(r => r.b - 1))), base = isDemo() ? 42 : 64
  const far = Math.max(0, ...SCENES.map(s => s.a), S.cycle.on ? S.cycle.b : 0)           // (and it is no shorter than its last marker, which has a bar after it, nor than the cycle)
  const byRegs = end <= base ? base : Math.ceil((end + 8) / 8) * 8, want = far > byRegs ? Math.ceil(far / 8) * 8 : byRegs
  if (want === SONG_END) return
  SONG_END = want; SCENES = mkScenes(SCENES.map(s => [s.name, s.a, s.c]))
  PXB = Math.max(PXB, fitPXB()); VX = clamp(VX, 0, maxVX())
}

/* ── the measure is changed ──
   Nothing that sounds moves: every region, every point of a line, every marker, the cycle and the playhead stay at the
   moment they were at — which is another bar now, since the bars are counted anew under them (a region that began on
   bar 17 of a song in four-four begins a third of the way through bar 22 once the song is in three-four). What was
   done before cannot be undone past this, as it was counted in the old bars. */
function setMeter (b, u) {
  if (S.rec || (b === S.meter[0] && u === S.meter[1]) || !MEASURES.some(m => m[0] === b && m[1] === u)) return
  const was = S.playing && !S.rec, p = curPos(), spb0 = SPB()
  if (was) halt(false)
  S.meter = [b, u]
  const k = spb0 / SPB(), at = x => 1 + (x - 1) * k                                     // one bar of before is k bars now
  LOOPS = songLoops(S.tempo)
  for (const t of S.tracks) {
    for (const L of lanesOf(t)) for (const r of L.regs) { r.b = at(r.b); r.a = at(r.a); r.off = (r.off || 0) * k; r.fi = (r.fi || 0) * k; r.fo = (r.fo || 0) * k; if (r.srcBars) r.srcBars *= k; if (r.xo != null) r.xo *= k; scaleNotes(r, k); dirtyReg(r) }
    for (const key in t.autos || {}) for (const q of t.autos[key]) q.b *= k
  }
  const end = SONG_END * k
  SONG_END = Math.max(isDemo() ? 42 : 64, Math.ceil(end - 1e-9))
  SCENES = mkScenes(SCENES.map(s => [s.name, at(s.a), s.c]))
  if (S.selM != null) S.selM = at(S.selM)                                              // (the marker that was pressed is known by its place: its place is counted anew with the rest)
  S.cycle.a *= k; S.cycle.b = Math.min(SONG_END, S.cycle.b * k)
  S.pos = Math.min(p * k, SONG_END); S.marq = null
  UNDO.length = 0; REDO.length = 0; CLIP = []; TIME_CLIP = null                        // (and what was copied was measured in them too)
  growSong(); PXB = clamp(PXB, fitPXB(), maxPXB()); VX = clamp(VX * k, 0, maxVX())
  repaint(); resync(); pushTransport()
  uiDirty(...EVERY, 'menu')
  say(`${b}/${u}`)
  if (was) { play(S.pos); uiDirty('top') }
}

/* ── snap ── */
/* the grid follows the zoom: the smallest step that is still wide enough to aim at */
/* the steps the grid can take, in bars: four bars, two, one; half a bar where the measure has one; the beat, and the beat halved
   again and again down to a sixty-fourth of it; five ticks, one tick. Past that the grid is whole samples. (In four-four:
   4, 2, 1, 1/2, 1/4 … 1/256, 1/768, 1/3840.) */
const gridSteps = () => { const b = BEATS(), w = WHOLE(), out = [4, 2, 1]; if (typeof gridTriple === 'function' && gridTriple()) { for (let k = 3; k <= 192; k *= 2) out.push(w / k) } else { if (b % 2 === 0 && b > 2) out.push(1 / 2); for (let k = 1; k <= 64; k *= 2) out.push(1 / b / k) } out.push(w / 768, w / 3840); return out.filter((s, i) => i === 0 || s < out[i - 1] - 1e-12) }      // (a triplet grid — grid.js — is pulled to thirds, sixths, twelfths … of a whole note)
function gridStep (fine) {
  const steps = gridSteps()
  let i = steps.findIndex(s => s * PXB < 14)
  if (i < 0) {                                                                          // even a tick is wide: so many samples as are still wide enough to aim at (in the end, one)
    const one = oneSample()
    let k = 1
    while (k * one * PXB < 14 && k * 2 * one < steps[steps.length - 1]) k *= 2
    return fine ? one : k * one
  }
  i = Math.max(0, i - 1)
  if (fine) i = Math.min(steps.length - 1, i + 2)
  return steps[i]
}
/* ── how a pull is placed (the mode) ──
   smart: the grid, and the ends of regions, the playhead and the cycle pull harder than it. grid: the grid alone.
   slip: nothing pulls. shuffle: nothing pulls, and the regions of a track stand end to start — they close up or make
   room as one is moved, trimmed, taken out or put in. spot: nothing pulls, and a region that is pressed asks where it
   should begin. In a pull, control = a finer grid with no pull; control + shift = free. */
const MODES = ['smart', 'grid', 'slip', 'shuffle', 'spot']
function setMode (m) { if (!MODES.includes(m)) return; if (m !== 'slip') S.mode0 = m; S.mode = m; S.snap = m === 'smart' || m === 'grid'; uiDirty('info', 'menu') }
const shuffling = () => S.mode === 'shuffle'
function snapPos (pos, e, skip) {
  if (!S.snap || (e && e.ctrlKey && e.shiftKey)) return pos
  const fine = !!(e && e.ctrlKey), step = gridStep(fine)
  let best = Math.round(pos / step) * step
  if (!fine && S.mode !== 'grid') {
    const mags = [curPos(), S.cycle.a, S.cycle.b]
    for (const t of S.tracks) for (const r of t.regs) if (!skip || !skip.has(r.id)) mags.push(r.a - 1, r.b - 1)
    let bd = 6 / PXB
    for (const m of mags) { const d = Math.abs(m - pos); if (d < bd) { bd = d; best = m } }
  }
  return best
}

/* ── what can be done to regions ── */
/* a region cut in two at a place inside it (bars from zero): the piece after the cut is handed back */
function splitRaw (r, t, pos) {
  const fi0 = r.fi || 0, fo0 = r.fo || 0
  const right = cloneReg(r, { a: pos + 1, off: (r.off || 0) + (pos - (r.a - 1)), fi: 0 })
  delete right.tc; delete right.tcf; delete right.py; delete r.px; delete r.sm         // (what the region remembers of its end — px, sm — is the right piece's now; of its beginning, the left one's)
  r.b = pos + 1; r.fo = 0; clampFades(r); clampFades(right); dirtyReg(r)
  const lf = Math.abs(r.fi - fi0) > 1e-12, rf = Math.abs((right.fo || 0) - fo0) > 1e-12
  if (lf || rf) right.tcf = { fi: fi0, fo: fo0, l: r.fi, r: right.fo || 0, lf, rf }    // (a fade ran through the place and is shorter for it: should the two be one again with it untouched — see healAt — it is as long as it was)
  t.regs.splice(t.regs.indexOf(r) + 1, 0, right)
  return right
}
/* two that crossfade are parted at a place inside what they share, or on its edge (bars from one): the earlier ends there
   and the later begins there. Each keeps the part of its fade that lies on its own side — the earlier one still fades
   out up to the place, the later one in from it — so that neither is heard at full level where it only ever faded; on
   the far edge that is the whole fade of the one that stays as it is. Two that are one sound cut in two simply meet.
   Parted on the join itself — the place the crossfade was made about — the two ends are marked: when the edit is done,
   one that something stands against simply meets it, as the two met before the crossfade was made (see joinEnds). */
function partAt (A, B, at) {
  const s0 = B.a, e0 = A.b, j = joinOf(A, B), one = carriesOn(A, B)
  at = clamp(at, s0, e0)
  /* (what the crossfade was, kept on both: how far each ran over the place, its curve and its join, and the place in each
     one's sound — should these very ends meet again, it is made again as it was: see remakeMet) */
  const n = { la: e0 - at, lb: at - s0, curve: A.foc || 0, aEnd: (A.off || 0) + (at - A.a), bStart: (B.off || 0) + (at - s0), ka: srcKey(A), kb: srcKey(B) }
  if (A.xo != null) n.xo = A.xo
  A.px = n; B.py = n
  B.off = (B.off || 0) + (at - B.a); B.a = at; A.b = at; delete A.xo
  A.fo = one ? 0 : Math.max(0, at - s0); B.fi = one ? 0 : Math.max(0, e0 - at)
  if (!one && Math.abs(at - j) < 1e-9) { A._pj = (A._pj || 0) | 1; B._pj = (B._pj || 0) | 2 }
  dirtyReg(A); dirtyReg(B)
}
/* the ends that were parted on a crossfade's join (partAt marks them: 1 an end, 2 a beginning), once the edit is done. One
   that something stands against has no fade there — it would be a hole in front of what was put next to it, and the two
   met plainly before their crossfade was made; one left open keeps the fade it has, and does not end bare in silence. */
function joinEnds () {
  for (const t of S.tracks) for (const L of lanesOf(t)) {
    if (!L.regs.some(r => r._pj)) continue
    for (const r of L.regs) {
      if (!r._pj) continue
      if ((r._pj & 1) && L.regs.some(q => q !== r && Math.abs(q.a - r.b) < 1e-6)) { r.fo = 0; dirtyReg(r) }
      if ((r._pj & 2) && L.regs.some(q => q !== r && Math.abs(q.b - r.a) < 1e-6)) { r.fi = 0; dirtyReg(r) }
      delete r._pj
    }
  }
}
/* a cut made by hand, or by a key, in one region: not within a sliver of its ends. Inside a crossfade there is nothing to
   cut — the two regions are two already, and a cut that is only a cut changes nothing that is heard. */
function splitReg (r, t, pos) {
  const half = MIN_LEN / 2
  if (!(pos > r.a - 1 + half && pos < r.b - 1 - half)) return null
  for (const B of [crossAfter(r, t), r]) {
    const A = B === r ? crossBefore(r, t) : r
    if (A && B && pos > B.a - 1 - 1e-9 && pos < A.b - 1 + 1e-9) return null
  }
  return splitRaw(r, t, pos)
}
/* a lane made plain at one place (bars from zero): afterwards nothing on it crosses `at` — but for a hair, see `leave`.
   Two that crossfade over the place are parted exactly there (partAt). A region that runs through the place is cut in
   two; where one of the two pieces would be a sliver (o.sliver; half of the shortest a region can be at this zoom, when
   not given), o.leave says what happens: left whole, as it is — the way of edits to the song's time and of a marquee,
   where a take that begins a moment before a bar line, with its fade, belongs whole to what follows — or, when false,
   ending (beginning) there, the hair given up — the way of something put down, which covers exactly its own stretch.
   `keep`: ids left as they are. o.fresh: of the kept ones, which ends were only just put where they are ({id: {start,
   end}}) — an overlap at such an end is never a crossfade, whatever fades happen to lie there. Hands back the regions
   that now begin at the place because they were cut there. */
function cutLaneAt (L, at, keep, o) {
  o = o || {}
  const made = [], sliver = o.sliver == null ? MIN_LEN / 2 : o.sliver, leave = o.leave !== false, fresh = o.fresh
  /* (the two of a crossfade are looked for among all that lie on the place, not by who stands next to whom: a region just
     put down on top of them — it is kept — would stand between them in the order of the lane) */
  const kept = r => !!(keep && keep.has(r.id)), here = L.regs.filter(r => at > r.a - 1 - 1e-9 && at < r.b - 1 + 1e-9).sort((x, y) => x.a - y.a || x.b - y.b)
  for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {
    const A = here[i], B = here[j], over = xfadeOf(A, B)
    if (!over || (kept(A) && kept(B)) || !(at > B.a - 1 - 1e-9 && at < A.b - 1 + 1e-9)) continue
    if (Math.abs(over - (A.fo || 0)) > 1e-6 || Math.abs(over - (B.fi || 0)) > 1e-6) continue      // (two that only lie over each other by a hair, each with a fade of its own there, are no crossfade: each is looked at by itself, below)
    if (kept(A) && (!fresh || (fresh.get(A.id) || {}).end !== false)) continue      // (a kept one counts as half of a crossfade only at an end the act did not touch)
    if (kept(B) && (!fresh || (fresh.get(B.id) || {}).start !== false)) continue
    partAt(A, B, at + 1)
  }
  if (here.some(r => !(r.b - r.a > 1e-9))) L.regs = L.regs.filter(r => r.b - r.a > 1e-9 || kept(r))      // (one that was nothing but two crossfades, cut where they met, has nothing left of its own)
  for (const r of L.regs.slice()) {
    if (kept(r)) continue
    const ra = r.a - 1, rb = r.b - 1
    if (!(at > ra + 1e-9 && at < rb - 1e-9)) continue
    if (rb - at <= sliver) { if (!leave) { r.b = at + 1; fitFades(r, L); dirtyReg(r) } }      // (fitFades: a fade it shares with a neighbour at its other end stays as long as what they share)
    else if (at - ra <= sliver) { if (!leave) { r.off = (r.off || 0) + (at - ra); r.a = at + 1; fitFades(r, L); dirtyReg(r); made.push(r) } }
    else made.push(splitRaw(r, L, at))
  }
  return made
}
/* where a region's middle lies, in bars from zero: once a lane has been cut at a place (cutLaneAt), which side of the place a region is on */
const midOf = r => (r.a + r.b) / 2 - 1
/* … and the side itself: at the place or after it, a region belongs to what follows (the same answer wherever it is asked: a
   stretch taken out and put back must find everything on the side it left it) */
const after = (r, p) => midOf(r) > p - 1e-9
/* a region that an edit of the song's time has carried to before the song's first bar by the hair it stuck out: the hair is given up there (there is no room for it) */
function notBeforeOne (r) { if (r.a < 1) { const cut = 1 - r.a; r.a = 1; r.off = (r.off || 0) + cut; r.fi = Math.max(0, (r.fi || 0) - cut); clampFades(r); dirtyReg(r) } }
function removeRegs (ids) { const s = new Set(ids); for (const t of S.tracks) t.regs = t.regs.filter(r => !s.has(r.id)); S.selR = S.selR.filter(id => !s.has(id)) }
/* two regions are one again when the second carries on exactly where the first stops */
function joinPair (t, r1, r2) {
  if (!!r1.notes !== !!r2.notes || (r1.notes && !sameNotes(r1, r2))) return false          // (regions of notes are one again only as pieces of one: the same notes in the same keeping; others are made one by joinNotes)
  if ((r1.gain || 0) !== (r2.gain || 0) || !!r1.mute !== !!r2.mute) return false           // (one louder than the other, or one of them silent: as one region they would not sound as they do)
  if (xfadeOf(r1, r2) && carriesOn(r1, r2)) uncross(r1, r2)
  const same = r1.loop === r2.loop && (r1.loop ? r1.buf === r2.buf : (r1.buf === r2.buf && r1.key === r2.key)) && (r1.wsig || '') === (r2.wsig || '') && Math.abs(r2.a - r1.b) < 1e-6
  if (!same) return false
  const len1 = r1.b - r1.a, cont = Math.abs(((r2.off || 0) - ((r1.off || 0) + len1))), per = r1.loop ? LOOPS[r1.buf].bars : 0
  if (!(cont < 1e-6 || (per && Math.abs(cont % per) < 1e-6) || (per && Math.abs(per - cont % per) < 1e-6))) return false
  if (r2.sm) r1.sm = r2.sm; else delete r1.sm
  if (r2.px) r1.px = r2.px; else delete r1.px
  r1.b = r2.b; r1.fo = r2.fo || 0; r1.foc = r2.foc || 0; if (r2.xo != null) r1.xo = r2.xo; else delete r1.xo; dirtyReg(r1)
  t.regs = t.regs.filter(x => x !== r2); S.selR = S.selR.filter(id => id !== r2.id)
  return true
}
function joinFrom (r, t) {
  const sorted = t.regs.slice().sort((x, y) => x.a - y.a), i = sorted.indexOf(r)
  return i >= 0 && i < sorted.length - 1 && joinPair(t, r, sorted[i + 1])
}
/* ── regions made one (j; the join tool) ──
   Pieces of one sound that lie end to end are one region again, and nothing is written. Anything else — different
   sounds, a gap between them, a stretch two of them share — is consolidated: what the regions sound like from the first
   one's beginning to the last one's end is written to a file of its own (the regions alone, as they lie: their gains,
   their fades; nothing the track does to its sound afterwards), with silence where no region lies, and one region that
   plays that file takes their place. With a marquee it is the marquee's stretch on each of its tracks, silence and all.
   Regions of notes are made one region that holds what each of them sounded.
   Whatever lies in the stretch goes into it — a region that reaches in from outside is cut at the edge, a muted one is
   left out as the silence it is — so the song sounds as it did. It is one step: undo brings the regions back (the file
   that was written stays in the song's folder). */
let JOINING = false
const laneSig = t => t.regs.map(r => [r.id, r.a, r.b, r.off || 0, r.gain || 0, r.mute ? 1 : 0, r.fi || 0, r.fo || 0, r.wkey || ''].join()).join('|')
/* what lies in a stretch of a lane, the lane cut at both its ends (bars from zero) */
function laneIn (L, a, b) { cutLaneAt(L, a); cutLaneAt(L, b); return L.regs.filter(r => after(r, a) && !after(r, b)).sort((x, y) => x.a - y.a) }
/* pieces of one that lie end to end, made one again: what is left of them */
function mendAll (L, rs) { for (let i = rs.length - 2; i >= 0; i--) joinPair(L, rs[i], rs[i + 1]); return rs.filter(r => L.regs.includes(r)) }
const fillsSpan = (r, a, b) => Math.abs(r.a - 1 - a) < 1e-6 && Math.abs(r.b - 1 - b) < 1e-6
/* regions of notes in a stretch made one region that is the stretch, holding what each of them sounded there */
function joinNotesIn (t, rs, a, b) {
  const first = rs[0], gone = new Set(rs.slice(1)), notes = [], ctl = []
  for (const r of rs) { for (const x of bakedNotes(r, a)) notes.push(x); for (const c of bakedCtl(r, a)) ctl.push(c) }
  notes.sort((x, y) => x.t - y.t)
  for (const k of ['q', 'qs', 'sw', 'tr', 'vel', 'rep', 'chords']) delete first[k]
  first.a = a + 1; first.b = b + 1; first.off = 0; first.fi = 0; first.fo = 0; first.ctl = ctl.length ? ctl : undefined
  setNotes(first, notes)
  t.regs = t.regs.filter(r => !gone.has(r))
  return first
}
async function joinNow () {
  if (JOINING) return false
  const m = S.marq && S.marq.b - S.marq.a >= MIN_LEN ? S.marq : null, spans = []
  if (m) { for (const t of marqTracks()) if (t.kind === 'audio' && !t.theirs) spans.push({ t, a: m.a, b: m.b, ids: null }) }
  else {
    const by = new Map()
    for (const [r, t] of selRegs()) { if (t.kind !== 'audio' || t.theirs) continue; if (!by.has(t)) by.set(t, []); by.get(t).push(r) }
    for (const [t, rs] of by) if (rs.length > 1) spans.push({ t, a: Math.min(...rs.map(r => r.a)) - 1, b: Math.max(...rs.map(r => r.b)) - 1, ids: new Set(rs.map(r => r.id)) })
  }
  if (!spans.length) return false
  JOINING = true
  try {
    /* a region whose sound is a rendering (stretched, transposed, turned round) is joined as that rendering */
    const sounding = spans.filter(s => !s.t.inst).flatMap(s => s.t.regs.filter(r => !r.notes && r.a - 1 < s.b && r.b - 1 > s.a))
    if (NAT && sounding.some(r => warpSig(r) !== (r.wsig || '') || (r.wkey && !LIVEW.has(r.wkey)))) await rewarp(sounding)
    /* what each stretch needs, found out on a copy of its lane: nothing, a mending, a joining of notes, or a file */
    for (const s of spans) {
      const t = s.t, lane = () => ({ regs: t.regs.map(r => cloneReg(r)) })
      if (t.inst) { const rs = s.ids ? [] : laneIn(lane(), s.a, s.b).filter(r => !r.mute); s.how = s.ids ? 'chosen' : rs.length && !(rs.length === 1 && fillsSpan(rs[0], s.a, s.b) && t.regs.some(r => fillsSpan(r, s.a, s.b))) ? 'notes' : ''; continue }      // (a stretch that is one region of notes already is left alone)
      if (s.ids) { const L = lane(), own = L.regs.filter((c, i) => s.ids.has(t.regs[i].id)).sort((x, y) => x.a - y.a); if (mendAll(L, own).length === 1) { s.how = 'chosen'; continue } }
      const L = lane(), rs = laneIn(L, s.a, s.b).filter(r => !r.mute), left = mendAll(L, rs.slice()), now = t.regs.filter(r => r.a - 1 < s.b - 1e-9 && r.b - 1 > s.a + 1e-9)
      if (!rs.length) s.how = ''
      else if (left.length === 1 && fillsSpan(left[0], s.a, s.b)) s.how = now.length === 1 && fillsSpan(now[0], s.a, s.b) ? '' : 'mend'
      else { s.how = 'file'; s.regs = left; s.sig = laneSig(t) }
    }
    const files = spans.filter(s => s.how === 'file')
    if (files.length && !NAT) { say('joining different sounds into one is in the app'); for (const s of files) s.how = '' }
    else if (files.length) {
      if (S.playing) halt(false)
      say('joining')
      const res = await NAT.call('join', { project: projKey(), tracks: files.map(s => ({ id: s.t.id, name: `${s.t.name} joined`, a0: s.a, a1: s.b, regs: s.regs.map(window.__nat.regMsg) })) })
      const placed = res && Array.isArray(res.placed) ? res.placed : []
      files.forEach((s, i) => { const d = placed[i]; if (d && d.ok !== false && d.key && S.tracks.includes(s.t) && laneSig(s.t) === s.sig) s.got = d; else s.how = '' })      // (a lane that was changed while its file was being written is left as it is now)
      if (!files.some(s => s.got)) { say(res && res.error ? String(res.error) : 'could not join'); if (!spans.some(s => s.how)) return false }
    }
    if (!spans.some(s => s.how)) return false
    const ids = []
    let any = false
    edit(() => {
      for (const s of spans) {
        const t = s.t
        if (s.how === 'chosen') {                                                         // the chosen regions themselves: notes into one list, pieces of one mended
          const rs = t.regs.filter(r => s.ids.has(r.id)).sort((x, y) => x.a - y.a)
          if (t.inst && joinNotes(t, rs)) any = true
          else for (let i = rs.length - 2; i >= 0; i--) any = joinPair(t, rs[i], rs[i + 1]) || any
          for (const r of rs) if (t.regs.includes(r)) ids.push(r.id)
        } else if (s.how === 'mend') { for (const r of mendAll(t, laneIn(t, s.a, s.b).filter(r => !r.mute))) ids.push(r.id); any = true }
        else if (s.how === 'notes') { const rs = laneIn(t, s.a, s.b), keep = rs.filter(r => !r.mute); t.regs = t.regs.filter(r => !rs.includes(r) || keep.includes(r)); ids.push(joinNotesIn(t, keep, s.a, s.b).id); any = true }
        else if (s.how === 'file') {
          const rs = laneIn(t, s.a, s.b), d = s.got, grp = rs.length && rs.every(r => r.grp && r.grp === rs[0].grp) ? rs[0].grp : null
          t.regs = t.regs.filter(r => !rs.includes(r))
          const n = mkReg(Object.assign({ a: s.a + 1, b: s.b + 1, key: d.key, file: d.file, peaksAll: d.peaks, loop: false, rate: 1, sec: d.sec, srcBars: d.sec / SPB(), name: String(d.name).toLowerCase() }, grp ? { grp } : {}))
          t.regs.push(n); ids.push(n.id); any = true
        }
      }
      if (!any) return false
      S.selR = ids; S.selX = null; S.marq = null; S.focus = 'lanes'
    })
    if (any && files.some(s => s.got)) { say(`joined ${files.filter(s => s.got).length === 1 ? 'into one region' : 'into ' + files.filter(s => s.got).length + ' regions'}`); if (typeof refreshPool === 'function') refreshPool() }
    uiDirty('lanes', 'dock')
    return any
  } finally { JOINING = false }
}
/* the tracks a marquee lies over: the rows that show between its two ends */
function marqTracks () {
  const m = S.marq, vis = rows()
  if (!m) return []
  const k0 = vis.indexOf(Math.min(m.t0, m.t1)), k1 = vis.indexOf(Math.max(m.t0, m.t1))
  const own = k0 < 0 || k1 < 0 ? [] : vis.slice(k0, k1 + 1).map(i => S.tracks[i])
  return m.also && m.also.length ? own.concat(m.also.map(byId).filter(t => t && !own.includes(t))) : own
}
/* a stretch of time that lies on a track of an edit group lies on the group's other tracks too */
function marqMates () {
  const m = S.marq, vis = rows()
  if (!m) return
  const k0 = vis.indexOf(Math.min(m.t0, m.t1)), k1 = vis.indexOf(Math.max(m.t0, m.t1)), own = k0 < 0 || k1 < 0 ? [] : vis.slice(k0, k1 + 1).map(i => S.tracks[i])
  m.also = [...new Set(own.flatMap(groupMates))].filter(t => !own.includes(t)).map(t => t.id)
}
/* cut every region the marquee crosses at its edges; returns the pieces inside */
function cutByMarquee () {
  const m = S.marq, inside = []
  cutByMarquee.changed = false                                                        // (said for whoever must know whether anything was touched at all)
  if (!m || m.b - m.a < MIN_LEN) return inside
  for (const t of marqTracks()) {
    const was = t.regs.length, sig = t.regs.map(r => r.a + r.b).join()
    cutLaneAt(t, m.a); cutLaneAt(t, m.b)
    if (t.regs.length !== was || t.regs.map(r => r.a + r.b).join() !== sig) cutByMarquee.changed = true
    for (const r of t.regs) if (after(r, m.a) && !after(r, m.b)) inside.push(r)                 // (one that sticks out of the marquee by a hair is in it whole)
  }
  return inside
}
/* what a marquee holds, as it would be if it were cut out — for the clipboard; nothing on the lanes is changed. (A copy
   of the lane is cut the way the lane itself would be, so that what is copied is exactly what a cut would take.) */
/* does the marquee lie just where a stretch was (the one a copy was taken from, or the one it was last put down on)? */
const sameStretch = (m, f) => !!(m && f && Math.abs(m.a - f.a) < 1e-6 && Math.abs(m.b - f.b) < 1e-6 && Math.min(m.t0, m.t1) === f.t0 && Math.max(m.t0, m.t1) === f.t1)
function marqueeClip () {
  const m = S.marq, out = []
  for (const t of marqTracks()) {
    const L = { regs: t.regs.filter(r => r.a - 1 < m.b && r.b - 1 > m.a).map(r => Object.assign({}, r, r.flex ? { flex: r.flex.map(q => Object.assign({}, q)) } : {})) }
    cutLaneAt(L, m.a); cutLaneAt(L, m.b)
    for (const c of L.regs) { if (after(c, m.a) && !after(c, m.b)) { delete c.tc; delete c.tcf; delete c._pj; delete c.sm; delete c.px; delete c.py; out.push({ r: c, ti: S.tracks.indexOf(t), da: c.a - 1 - m.a }) } }
  }
  return out
}
/* clear a stretch of a track: what crosses its edges is cut, what lies inside goes */
function carve (t, a, b, keep, fresh) {
  if (!(b - a > 1e-9)) return
  const o = { sliver: 1e-4, leave: false, fresh: fresh || new Map() }
  cutLaneAt(t, a, keep, o); cutLaneAt(t, b, keep, o)
  t.regs = t.regs.filter(r => (keep && keep.has(r.id)) || !(r.a - 1 >= a - 1e-9 && r.b - 1 <= b + 1e-9))      // (what lay wholly inside is gone)
}
const fadeRoom = (r, other) => r.notes ? 0 : Math.max(0, (r.b - r.a) - (other || 0))                 // how long a fade at one end of a region can be, the fade at its other end being as long as it is
const clampFades = r => { if (r.notes) { r.fi = 0; r.fo = 0; return } const len = Math.max(0, r.b - r.a); r.fi = clamp(r.fi || 0, 0, len); r.fo = clamp(r.fo || 0, 0, len); if (r.fi + r.fo > len) { const k = len / (r.fi + r.fo); r.fi *= k; r.fo *= k } }
/* the one a region crossfades into at its end, and the one it rises out of at its start — looked for among all on the
   lane, not by who stands next to whom (that cannot be trusted while several are being moved or pulled at once) */
const crossAfter = (r, t) => t.regs.find(q => q !== r && q.a > r.a + 1e-9 && xfadeOf(r, q)) || null
const crossBefore = (r, t) => t.regs.find(q => q !== r && q.a < r.a - 1e-9 && xfadeOf(q, r)) || null
/* how much of a region is shared with a neighbour at its start and at its end (0: a plain end there) */
function crossedAt (r, t) { const p = crossBefore(r, t), n = crossAfter(r, t); return [p ? xfadeOf(p, r) : 0, n ? xfadeOf(r, n) : 0] }
/* a region as a copy of it should be: without the crossfades it has with regions that are not copied along (`set`: the
   ids that are). It ends, or begins, on the join, with no fade there — the run-on and the fade belong to the crossfade,
   which stays behind with the original; a copy that carried them would stand late by the run-on. */
function plainCopy (r, t, set) {
  const c = Object.assign({}, r, r.flex ? { flex: r.flex.map(m => Object.assign({}, m)) } : {}), p = crossBefore(r, t), n = crossAfter(r, t)
  if (p && !(set && set.has(p.id))) { const j = joinOf(p, r); c.off = (c.off || 0) + (j - c.a); c.a = j; c.fi = 0 }
  if (n && !(set && set.has(n.id))) { c.b = joinOf(r, n); c.fo = 0; delete c.xo }
  return c
}
/* a region whose end was moved: its fades fit in it again. A fade it shares with a neighbour (a crossfade) is as long as
   the stretch the two share, and stays so; the fade at its other end, which is its own, is the one that gives way. */
function fitFades (r, t) {
  const len = Math.max(0, r.b - r.a), [xs, xe] = crossedAt(r, t)
  const sharedS = xs > 0 && Math.abs((r.fi || 0) - xs) < 1e-6, sharedE = xe > 0 && Math.abs((r.fo || 0) - xe) < 1e-6      // (a crossfade's fade is exactly the stretch shared: two that only happen to overlap where each has a fade are not one)
  if (sharedS && sharedE) return
  if (sharedS) r.fo = clamp(r.fo || 0, 0, Math.max(0, len - xs))
  else if (sharedE) r.fi = clamp(r.fi || 0, 0, Math.max(0, len - xe))
  else clampFades(r)
}
/* ── what is edited as one ──
   An edit group is a set of tracks (a letter, said after each track's name): a press on a region of one chooses, on the
   others, the regions that lie over the very same stretch, and a cut, a trim, a fade or a stretch of time made on one
   is made on all — several microphones on one drum kit stay one recording. ⇧g lets go of every group for a while.
   A region group is a set of regions (on any tracks) that are always chosen together. */
const groupMates = (t, what = 'editing') => !t || !t.grp || (typeof grpShares === 'function' ? !grpShares(t, what) : S.grpOff) ? [] : S.tracks.filter(x => x !== t && x.grp === t.grp && x.kind === 'audio')      // (what: which of the things a group shares — groups.js)
const sameSpan = (x, r) => Math.abs(x.a - r.a) < 1e-6 && Math.abs(x.b - r.b) < 1e-6
/* the regions on a track's group mates that lie over the same stretch as r: [[region, track]] */
const companions = (r, t, what) => groupMates(t, what).flatMap(m => m.regs.filter(x => sameSpan(x, r)).map(x => [x, m]))
const anyGroups = () => S.tracks.some(t => t.grp || t.regs.some(r => r.grp))
/* ids, and everything that is chosen with them */
function withTheirs (ids) {
  if (!ids.length || !anyGroups()) return ids
  const out = new Set(ids), at = new Map(), gs = new Set()
  for (const t of S.tracks) for (const r of t.regs) at.set(r.id, [r, t])
  for (const id of ids) { const q = at.get(id); if (!q) continue; if (q[0].grp) gs.add(q[0].grp); for (const [x] of companions(q[0], q[1])) out.add(x.id) }
  if (gs.size) for (const [id, q] of at) if (q[0].grp && gs.has(q[0].grp)) { out.add(id); for (const [x] of companions(q[0], q[1])) out.add(x.id) }
  return [...out]
}
/* copies of regions that were in region groups are groups of their own */
function freshGroups (list) {
  const to = new Map()
  let g = Math.max(0, ...S.tracks.flatMap(lanesOf).flatMap(t => t.regs.map(r => r.grp || 0)))             // (the alternatives put aside have their groups too)
  const many = new Map()
  for (const r of list) if (r.grp) many.set(r.grp, (many.get(r.grp) || 0) + 1)
  for (const r of list) if (r.grp) { if (many.get(r.grp) < 2) { delete r.grp; continue } if (!to.has(r.grp)) to.set(r.grp, ++g); r.grp = to.get(r.grp) }      // (one copied without the rest of its group is by itself)
}
/* the same join on a track's group mates: [[A, B]] — two regions there that meet (or share a stretch) where these two do */
function joinMates (A, B, t) {
  const at = joinOf(A, B)
  return groupMates(t).flatMap(m => joinsOf(m).filter(([a, b]) => Math.abs(joinOf(a, b) - at) < 1e-6))
}
/* ── shuffle ── everything on a track that begins at `from` or later (bars from one) goes by `by`; `skip`: ids left where they are */
function ripple (t, from, by, skip, byMid) { if (Math.abs(by) > 1e-12) for (const r of t.regs) if (!(skip && skip.has(r.id)) && (byMid ? after(r, from - 1) : r.a >= from - 1e-6)) { r.a += by; r.b += by } }      // (byMid: by where its middle lies — after a marquee's cut, which may leave a region sticking over the place by a hair)
/* stretches of a track are gone ([[a, b]] in bars from one): what began after each goes earlier by its length */
function closeUp (t, spans, skip, byMid) {
  const s = spans.slice().sort((x, y) => x[0] - y[0]), one = []
  for (const sp of s) { const last = one[one.length - 1]; if (last && sp[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], sp[1]); else one.push(sp.slice()) }
  for (let i = one.length - 1; i >= 0; i--) ripple(t, one[i][1], -(one[i][1] - one[i][0]), skip, byMid)
}
/* where time was cut and put together again, two regions may overlap by a hair: one that began a moment before the place
   went whole with what followed it, one that rang a moment past it stayed whole (cutLaneAt, `leave`). There the later
   one is heard as it is — its beginning and its fade in are its own, and the first beat of what follows is under them —
   and the earlier one gives way: it ends where the later one begins, with the fade out it had (one that had none is
   given one as long as the later one's fade in, a hair at most: it is cut in the middle of its sound). The two share nothing — a
   crossfade there would make the later one's own fade half of something that can be taken off. What the earlier one
   gave up is kept on it (`sm`: how much of it, and its fades), and comes back in a later edit of the song's time once
   nothing begins on its end any more (seamBack) — unless its end or its fade out was changed by hand meanwhile. A hair that lies
   wholly under the beginning of another is gone: nothing of it would be heard by itself. A hair is at most half of the
   longest MIN_LEN there is at any zoom, on each side: the room may have been nearer or further when the time was cut
   than it is now. `was`: what each pair that sounded at once shared before the edit (sharesOf) — a pair that lies as
   it lay then is left as it is. */
const SEAM = 1 / 32
function sharesOf (L) {
  const rs = L.regs.slice().sort((x, y) => x.a - y.a || x.b - y.b), out = new Map()
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length && rs[j].a < rs[i].b - 1e-9; j++) out.set(rs[i].id + '|' + rs[j].id, rs[i].b - rs[j].a)      // (the earlier one first: the same two the other way round are another pair)
  return out
}
const endIn = r => (r.off || 0) + (r.b - r.a)                                           // where a region's end lies in its sound, in bars
/* what an earlier seam took from a region comes back, once nothing begins on its end any more */
function seamBack (L) {
  for (const X of L.regs) {
    const m = X.sm
    if (!m) continue
    if (Math.abs(endIn(X) - m.s) > 1e-9 || Math.abs((X.fo || 0) - m.f) > 1e-9) { delete X.sm; continue }      // (its end or its fade out changed by hand since: it is as it was left)
    if (L.regs.some(q => q !== X && Math.abs(q.a - X.b) < 1e-9)) continue                                     // (what it gave way to still begins there)
    X.b += m.t; X.fo = m.fo; X.foc = m.foc
    if (Math.abs((X.fi || 0) - m.g) < 1e-9) X.fi = m.fi                                                       // (its fade in, should the seam have had to shorten that too)
    delete X.sm; dirtyReg(X)
  }
}
function seamLane (L, was) {
  const own = 2 * oneSample(), asWas = (X, Y) => { const w = was && was.get(X.id + '|' + Y.id); return w != null && Math.abs(w - (X.b - Y.a)) < 1e-9 }
  const rs = L.regs.slice().sort((x, y) => x.a - y.a || x.b - y.b)
  const gone = r => { const p = crossBefore(r, L), n = crossAfter(r, L); if (p) uncross(p, r); if (n) uncross(r, n); L.regs = L.regs.filter(q => q !== r); S.selR = S.selR.filter(id => id !== r.id); rs.splice(rs.indexOf(r), 1) }
  for (let i = 0; i + 1 < rs.length; i++) {
    const X = rs[i], Y = rs[i + 1], over = X.b - Y.a
    if (over <= 1e-9 || asWas(X, Y)) continue
    if (xfadeOf(X, Y) && Math.abs(over - (X.fo || 0)) < 1e-6 && Math.abs(over - (Y.fi || 0)) < 1e-6) continue
    if (Y.b <= X.b + 1e-9 && Y.b - X.a <= SEAM + 1e-9) { gone(Y); i--; continue }      // the later of the two lies wholly in the first hair of the earlier one
    if (over > SEAM + 1e-9) continue
    if (!(Y.a - X.a > own)) { gone(X.b <= Y.b + 1e-9 ? X : Y); i--; continue }          // they begin on one place: the one that lies under the other
    const xs = crossBefore(X, L), held = xs && xs !== Y ? xfadeOf(xs, X) : 0, yb = crossBefore(Y, L), fi = yb && yb !== X ? 0 : Y.fi || 0      // (what the earlier one shares at its other end is not to be run into; a fade in the later one shares with another is not its own)
    if (held && Y.a - X.a - held < own) {                                               // (nothing of its own would be left between the two: its crossfade at the other end is as long as it can still be, or a plain join)
      const y = (Y.a - X.a) - own
      if (y > 1e-6) { xs.b = X.a + y; xs.fo = X.fi = y; if (xs.xo != null) xs.xo = Math.min(xs.xo, y); dirtyReg(xs) }
      else { if (!(Y.a - joinOf(xs, X) > own)) continue; uncross(xs, X) }
    }
    const m = X.sm, before = m ? { t: m.t, fo: m.fo, foc: m.foc, fi: m.fi } : { t: 0, fo: X.fo || 0, foc: X.foc || 0, fi: X.fi || 0 }      // (given way before, and not yet back: what it was at first is what is kept)
    before.t += X.b - Y.a
    X.b = Y.a; delete X.xo
    if (!(before.fo > 1e-9) && fi > 1e-9) { X.fo = Math.min(fi, SEAM / 2); X.foc = Y.fic || 0 }      // (no longer than a hair: it is only there so that the cut does not click — a take that swells in over a bar does not make what stands before it die away over a bar)
    fitFades(X, L)
    X.sm = Object.assign(before, { s: endIn(X), f: X.fo || 0, g: X.fi || 0 })
    dirtyReg(X)
  }
}
/* of two that share a stretch, one is about to go and the other to stay: they are a plain join again first */
function partCrossed (gone) { for (const t of S.tracks) for (const [A, B] of joinsOf(t)) if (xfadeOf(A, B) && gone.has(A.id) !== gone.has(B.id)) uncross(A, B) }
/* a move let go in the shuffle mode: the gaps the moved ones left are closed, and on each track they land on they are put
   in at the join nearest to where they were let go — what stands after it makes room */
function shuffleDrop (d) {
  const moved = new Set(d.orig.keys())
  if (!d.copy) {
    const gone = new Map()
    for (const o of d.orig.values()) { const t = S.tracks[o.ti]; if (!gone.has(t)) gone.set(t, []); gone.get(t).push([o.a, o.b]) }
    for (const [t, spans] of gone) closeUp(t, spans, moved)
  }
  const by = new Map()
  for (const id of moved) { const [r, t] = regOf(id); if (r) { if (!by.has(t)) by.set(t, []); by.get(t).push(r) } }
  for (const [t, rs] of by) {
    const a0 = Math.min(...rs.map(r => r.a)), len = Math.max(...rs.map(r => r.b)) - a0, rest = t.regs.filter(r => !moved.has(r.id))
    const inA = new Set(), inB = new Set()
    for (const [A, B] of joinsOf({ regs: rest })) if (xfadeOf(A, B)) { inA.add(A.id); inB.add(B.id) }      // two that share a stretch are not parted
    const stops = [1]
    for (const r of rest) { if (!inB.has(r.id)) stops.push(r.a); if (!inA.has(r.id)) stops.push(r.b) }
    const ins = stops.reduce((p, q) => Math.abs(q - a0) < Math.abs(p - a0) ? q : p)
    for (const r of rest) if (r.a >= ins - 1e-6) { r.a += len; r.b += len }
    for (const r of rs) { r.a += ins - a0; r.b += ins - a0 }
  }
}
/* ── the overlap rule: one sound at a time on a track. A region put somewhere (moved, pasted, drawn, pulled longer) covers
   what was under it there: the other regions of its track give way over that stretch — cut, not thrown away, so pulling
   their edge back out brings them back. The one exception is made on purpose: a crossfade, where two regions share a
   stretch, one falling as the other rises (see crossfade). `placed`: [[region, track, from, to]] in bars from zero ── */
function settle (placed) {
  const ids = new Set(placed.map(p => p[0].id)), fresh = new Map()
  /* (an end of a placed region that lies on the edge of its placed stretch was only just put there: the whole region, when
     it was moved or pasted; the end that was pulled, when it was trimmed. Its other end may be half of a crossfade.) */
  for (const [r, , a, b] of placed) { const f = fresh.get(r.id) || { start: false, end: false }; if (Math.abs(a - (r.a - 1)) < 1e-9) f.start = true; if (Math.abs(b - (r.b - 1)) < 1e-9) f.end = true; fresh.set(r.id, f) }
  for (const [, t, a, b] of placed) if (t) carve(t, a, b, ids, fresh)
  S.selR = S.selR.filter(id => regOf(id)[0])
}
/* two regions of a lane that sound at once without being a crossfade: a song from before one sound at a time was the rule
   can hold some (the same thing put down twice on one spot), and nothing takes them apart unasked — what gives way
   gives way to something that was put there, or to a tempo that moved. As "id|id", either way round. */
function overlapsOf (L) {
  const rs = L.regs.slice().sort((x, y) => x.a - y.a || x.b - y.b), out = new Set()
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length && rs[j].a < rs[i].b - 1e-9; j++) if (!xfadeOf(rs[i], rs[j])) { out.add(rs[i].id + '|' + rs[j].id); out.add(rs[j].id + '|' + rs[i].id) }
  return out
}
/* the tempo is about to move under every lane: which regions already sounded at once is noted first, and afterwards each
   lane is made sound again without touching those (see settleTrack). `move`: what moves the tempo's bars. */
function settleAfter (move) {
  const lanes = S.tracks.flatMap(lanesOf), was = lanes.map(L => overlapsOf(L))
  const r = move()
  lanes.forEach((L, i) => settleTrack(L, was[i]))
  return r
}
/* a track after its regions changed length by themselves (the tempo moved under files that keep their length in seconds):
   where one now runs into a later one, the one that begins later is the one heard. Two that crossfaded still do — over as
   much as the fades they had, and the regions themselves, now allow. `was`: pairs that sounded at once before (overlapsOf),
   left as they are. */
function settleTrack (t, was) {
  const rs = t.regs.slice().sort((x, y) => x.a - y.a || x.b - y.b), tiny = 1e-9, own = 2 * oneSample(), cut = new Set(), gone = new Set()
  for (let i = 0; i < rs.length; i++) {
    const A = rs[i]
    if (gone.has(A)) continue
    for (let j = i + 1; j < rs.length; j++) {
      const B = rs[j], over = A.b - B.a
      if (over <= tiny) break                                                          // (they are in the order they begin: none after this one reaches into A either)
      if (gone.has(B) || (was && was.has(A.id + '|' + B.id))) continue
      if (xfadeOf(A, B) && Math.abs(over - (A.fo || 0)) < 1e-6 && Math.abs(over - (B.fi || 0)) < 1e-6 && B.a - A.a > tiny && B.b - A.b > tiny) { A.fo = B.fi = over; break }      // a crossfade as it should be (its fades are what the two share, to the last digit: the tempo moved their lengths, not their beginnings, and a hair of difference would grow with the next change of measure)
      const x = (B.a - A.a) - (A.fi || 0) >= tiny ? Math.min(over, A.fo || 0, B.fi || 0, (B.b - B.a) - (B.fo || 0) - own) : 0
      if (x > 1e-6) { A.b = B.a + x; A.fo = B.fi = x; if (A.xo != null) A.xo = Math.min(A.xo, x); dirtyReg(A); dirtyReg(B); break }
      if (!(B.a - A.a > tiny)) { gone.add(A); break }                                  // the later one begins where this one does: this one is not heard at all
      A.b = B.a; A.fo = 0; cut.add(A); dirtyReg(A)
      const P = rs.slice(0, i).reverse().find(q => !gone.has(q) && xfadeOf(q, A)), px = P ? xfadeOf(P, A) : 0      // (the one before it crossfaded into it, and it is shorter now: that crossfade is as long as it can still be)
      if (px) { const y = Math.min(px, (A.b - A.a) - own); if (y > 1e-6) { P.b = A.a + y; P.fo = A.fi = y } else { P.b = A.a; P.fo = 0; A.fi = 0 } dirtyReg(P) }
      clampFades(A)
      break
    }
  }
  if (gone.size || cut.size) t.regs = t.regs.filter(r => !gone.has(r) && !(cut.has(r) && r.b - r.a <= 1e-4))      // (what was cut down to a sliver goes too)
}

/* ── a crossfade: two regions that meet are each let run on a little past the join — as far as each has sound to run on —
   one falling while the other rises. It is nothing more than a fade out and a fade in sharing a stretch; the engine
   plays both. Where the two are one sound cut in two, the plain curve gives back exactly what was there; where they are
   different sounds, the equal-power curve keeps the level from sagging in the middle. ── */
const FADE_CURVES = ['linear', 'equal power', 's curve']
const fadeShape = (c, x, bend = 0) => c === 1 ? Math.sin(clamp(x, 0, 1) * Math.PI / 2) : c === 2 ? (x = clamp(x, 0, 1), x * x * (3 - 2 * x)) : bend ? Math.pow(clamp(x, 0, 1), Math.pow(2, 2 * bend)) : clamp(x, 0, 1)
/* how a straight fade is bent (Engine.h fadeShape): as pulled by hand — control and a pull up or down (r.fib, r.fob,
   −1…1) — else, for a fade of its own, as the ear hears an even fall to silence: a plain line of level was loud to the
   last moment and then gone (his ear, 2026-10-22); half of a crossfade stays straight, its two halves adding up */
const FADE_BEND = .66
function fadeBend (r, left, t) {
  const own = left ? r.fib : r.fob
  if (own != null) return own
  if (left ? r.fic : r.foc) return 0
  if (left ? r.fis : r.fos) return 0                                                                      // (a speed fade: an even run up to speed, or down to a standstill)
  const tt = t || regOf(r.id)[1]
  return tt && (left ? crossBefore(r, tt) : crossAfter(r, tt)) ? 0 : FADE_BEND
}
/* ── a speed fade (his ask, 2026-10-23: as Logic has it, a scratch of a sound): a fade in that speeds the sound up from a
   standstill, a fade out that slows it down to one (r.fis, r.fos). Its curve is the speed's, not the level's: the sound
   runs slower and lower (Engine.h addRegion), and only goes quiet under an eighth of its speed, three octaves down, so it
   ends without a click. Half of a crossfade stays a fade. ── */
function speedFade (r, left, t) {
  if (!(left ? r.fis : r.fos) || !((left ? r.fi : r.fo) > 0) || r.notes) return false
  const tt = t || regOf(r.id)[1]
  return !(tt && (left ? crossBefore(r, tt) : crossAfter(r, tt)))
}
const SPEED_QUIET = 8
/* how loud a fade lets the sound be, x of the way from its silent end (0…1): its curve; a speed fade, its full level until the speed is low */
const fadeLevel = (r, left, x, bend, t) => { const k = fadeShape(left ? r.fic || 0 : r.foc || 0, x, bend); return speedFade(r, left, t) ? Math.min(1, SPEED_QUIET * k) : k }
/* how far the sound has run through a speed fade x of the way from its still end (0…1), in lengths of the fade: the area under
   its speed (Engine.h fadeRun) */
function fadeRun (c, x, bend = 0) {
  x = clamp(x, 0, 1)
  if (c === 1) return (1 - Math.cos(x * Math.PI / 2)) / (Math.PI / 2)
  if (c === 2) return x * x * x - x * x * x * x / 2
  const q = bend ? Math.pow(2, 2 * bend) : 1
  return Math.pow(x, q + 1) / (q + 1)
}
/* the other button on a fade of a region of sound: a fade, or (a fade in) speed up, (a fade out) slow down — for it and those
   that take its fades along (its edit group, the other chosen) */
function fadeMenu (p) {
  if (S.auto || (p.y - TY + VY) >= rowTops().all) return false
  const ti = laneAt(p.y), t = S.tracks[ti]
  if (!t || t.kind !== 'audio' || t.inst) return false
  const pos = barAt(p.x)
  for (let k = t.regs.length - 1; k >= 0; k--) {
    const r = t.regs[k]
    if (r.notes || !(pos >= r.a - 1 && pos < r.b - 1)) continue
    const xl = bx(r.a), xr = bx(r.b)
    const left = r.fi > 0 && p.x <= xl + r.fi * PXB && !crossBefore(r, t) ? true : r.fo > 0 && p.x >= xr - r.fo * PXB && !crossAfter(r, t) ? false : null
    if (left == null) return false
    if (!S.selR.includes(r.id)) { S.selR = withTheirs([r.id]); S.sel = ti; S.focus = 'lanes'; uiDirty('lanes', 'head', 'dock') }
    const on = !!(left ? r.fis : r.fos)
    openMenu(p.x, p.y, [{ t: 'fade', on: !on, v: false }, { t: left ? 'speed up' : 'slow down', on, v: true }], it => setSpeedFade(r.id, left, it.v))
    return true
  }
  return false
}
function setSpeedFade (id, left, on) {
  const [r, t] = regOf(id)
  if (!r) return
  edit(() => {
    let any = false
    for (const x of [r].concat(fadeWith(r, t))) {
      if (!((left ? x.fi : x.fo) > 0) || x.notes || !!(left ? x.fis : x.fos) === on) continue
      const k = left ? 'fis' : 'fos'
      if (on) x[k] = true; else delete x[k]
      any = true; dirtyReg(x)
    }
    if (!any) return false
    uiDirty('lanes', 'dock')
  })
}
const headRoom = r => r.notes ? 0 : r.loop ? Infinity : Math.max(0, r.off || 0)                                         // sound it has before its start, in bars
const tailRoom = r => r.notes ? 0 : r.loop ? Infinity : Math.max(0, (r.srcBars || 0) - (r.off || 0) - (r.b - r.a))      // and after its end
/* is B the same sound as A, carrying on exactly where A stops (a region cut in two)? */
function carriesOn (A, B) {
  if (!!A.loop !== !!B.loop || (A.loop ? A.buf !== B.buf : A.key !== B.key || A.buf !== B.buf) || (A.wsig || '') !== (B.wsig || '') || (A.tr || 0) !== (B.tr || 0) || (A.ft || 0) !== (B.ft || 0) || !!A.rev !== !!B.rev) return false
  const d = (B.off || 0) - ((A.off || 0) + (B.a - A.a)), per = A.loop ? LOOPS[A.buf].bars : 0
  return Math.abs(d) < 1e-6 || (per > 0 && (Math.abs(d % per) < 1e-6 || Math.abs(per - Math.abs(d % per)) < 1e-6))
}
const xfadeOf = (A, B) => { const over = A.b - B.a; return over > 1e-6 && over <= Math.min(A.fo || 0, B.fi || 0) + 1e-6 ? over : 0 }      // the stretch two regions share on purpose, in bars
/* where two that crossfade would meet without the crossfade (bars from one): the place it was made about. The first runs
   on past it by `xo`, kept on it since the crossfade was made — one side may have had less sound to run on with than the
   other, so it is not always the middle; where it is not known, the middle of what they share. Two that only meet: there. */
const joinOf = (A, B) => { const over = xfadeOf(A, B); return over ? clamp(A.b - (A.xo != null ? A.xo : over / 2), B.a, A.b) : A.b }
const defaultXfade = () => .02 / SPB()                                                                    // twenty thousandths of a second: enough to take the click out of a cut
/* A ends where B begins. Returns what was made: 'cross', 'fades' (neither had sound to run on, so each fades inside itself), or null */
/* how far each of two regions that meet can run on over the other: the first to the right, as far as it has sound and
   no further than where the second's own fade out begins; the second to the left, as far as it has sound and no further
   than where the first's fade in ends. (So a region is never shorter than the fades on it, and a crossfade never runs
   into the one at the region's other end.) Each keeps a little that is its own, so that the earlier of the two begins
   first and ends first, whatever is pulled. */
const crossRoom = (A, B) => { const own = 2 * oneSample(); return [Math.max(0, Math.min(tailRoom(A), (B.b - B.a) - (B.fo || 0) - own)), Math.max(0, Math.min(headRoom(B), (A.b - A.a) - (A.fi || 0) - own))] }
function crossBy (A, B, la, lb, curve) {
  if (curve == null) curve = carriesOn(A, B) ? 0 : 1
  A.b += la; B.a -= lb; B.off = (B.off || 0) - lb
  A.fo = B.fi = la + lb; A.foc = B.fic = curve; A.xo = la
  dirtyReg(A); dirtyReg(B)
  return 'cross'
}
function crossfade (A, B, len, curve) {
  if (xfadeOf(A, B)) uncross(A, B)
  if (Math.abs(A.b - B.a) > 1e-4) return null
  A.fo = 0; B.fi = 0                                                                  // (what each had of a fade of its own at this join gives way to the crossfade)
  len = Math.max(1e-4, len)
  const [ra, rb] = crossRoom(A, B)
  let la = Math.min(len / 2, ra), lb = Math.min(len / 2, rb)
  la = Math.min(len - lb, ra); lb = Math.min(len - la, rb)                              // where one side has too little, the other gives more
  if (la + lb < 1e-5) {                                                               // neither has anything to run on with: each fades inside itself
    if (curve == null) curve = carriesOn(A, B) ? 0 : 1
    A.fo = Math.min(len / 2, Math.max(0, (A.b - A.a) - (A.fi || 0))); B.fi = Math.min(len / 2, Math.max(0, (B.b - B.a) - (B.fo || 0))); A.foc = B.fic = curve
    dirtyReg(A); dirtyReg(B)
    return 'fades'
  }
  return crossBy(A, B, la, lb, curve)
}
/* a crossfade over one stretch exactly (bars from zero): the two are made to share it, each as far as it can */
function crossfadeOver (A, B, a, b, curve) {
  const at = joinOf(A, B) - 1
  if (!(xfadeOf(A, B) || Math.abs(A.b - B.a) < 1e-4) || !(at > a - 1e-9 && at < b + 1e-9)) return null
  joinAt(A, B, at + 1)
  A.fo = 0; B.fi = 0
  const [ra, rb] = crossRoom(A, B), la = Math.min(Math.max(0, b - at), ra), lb = Math.min(Math.max(0, at - a), rb)
  if (la + lb < 1e-5) return crossfade(A, B, b - a, curve)
  return crossBy(A, B, la, lb, curve)
}
/* back to a plain join, where they met before the crossfade was made (see joinOf) */
function uncross (A, B) {
  const over = xfadeOf(A, B)
  if (!over) return false
  const j = joinOf(A, B)
  B.off = (B.off || 0) + (j - B.a); B.a = j; A.b = j; A.fo = 0; B.fi = 0; delete A.xo
  dirtyReg(A); dirtyReg(B)
  return true
}
/* two regions that meet or share a stretch, made to meet exactly at `at` (bars from one) with nothing shared */
function joinAt (A, B, at) {
  if (xfadeOf(A, B)) { A.fo = 0; B.fi = 0 }
  B.off = (B.off || 0) + (at - B.a); B.a = at; A.b = at; delete A.xo
  dirtyReg(A); dirtyReg(B)
}
/* the join of two that crossfade taken to `at` (bars from one): both go with it, each keeping to the sound it has, and the
   crossfade is as long as it was (as far as the two still have sound to run on with there). Says whether it moved. */
function moveJoin (A, B, at) {
  const len = xfadeOf(A, B), curve = A.foc || 0, mid = joinOf(A, B)
  const lo = Math.max(A.a + MIN_LEN + (A.fi || 0), B.loop ? 1 : B.a - (B.off || 0)), hi = Math.min(B.b - MIN_LEN - (B.fo || 0), A.loop || !A.srcBars ? Infinity : A.a + (A.srcBars - (A.off || 0)))
  if (!len || lo > hi) return false                                                    // (two too short to give anything at this zoom: it stays)
  at = clamp(at, Math.min(lo, mid), Math.max(hi, mid))
  if (Math.abs(at - mid) < 1e-9) return false
  joinAt(A, B, at); crossfade(A, B, len, curve)
  return true
}
/* the regions of a track that meet end to start (or share a stretch), in order: [[A, B] …] */
function joinsOf (t) {
  const rs = t.regs.slice().sort((x, y) => x.a - y.a), out = []
  for (let i = 0; i + 1 < rs.length; i++) if (xfadeOf(rs[i], rs[i + 1]) || Math.abs(rs[i].b - rs[i + 1].a) < 1e-6) out.push([rs[i], rs[i + 1]])
  return out
}
/* ── the smart tool: what a press on a region does depends on where it lands (the draft's zones, on a row of 25: corners
   12 by 8, ends 6 wide, the foot of a join 20 by 8). Its top corners are its fades — and where a fade is there already,
   the place along the top where the fade ends is its handle; its ends trim it; the foot of a join is the crossfade;
   the rest is cut in two along its length — one half picks a stretch of time, the other takes hold of the region.
   Which half does which is SMART.flip (false: the upper half picks, as in Pro Tools). ── */
const SMART = { flip: false }
function smartZone (ti, p) {
  const t = S.tracks[ti]
  if (!t || t.kind !== 'audio') return { z: 'range' }
  const y = p.y - rowY(ti) - 1.5, lh = rowH(ti) - 3, corner = Math.min(8, lh * .36)
  if (y > lh - corner && !t.inst) for (const [A, B] of joinsOf(t)) { const x0 = bx(B.a), x1 = bx(A.b); if (p.x >= Math.min(x0, x1) - 10 && p.x <= Math.max(x0, x1) + 10) return { z: 'x', A, B } }
  const pos = barAt(p.x), r = hitRegion(ti, pos)
  if (!r) return { z: 'range' }
  if (y < corner && !r.notes) {                                                            // along the top: a fade — at the corner, or at the place where a fade that is there ends
    let best = null, bd = Infinity
    for (const q of t.regs) {
      if (!(pos >= q.a - 1 && pos < q.b - 1)) continue
      const xl = bx(q.a), xr = bx(q.b), w = xr - xl, f = Math.min(12, w / 4)
      if (w < 16) continue
      const hi = Math.abs(p.x - (xl + (q.fi || 0) * PXB)), ho = Math.abs(p.x - (xr - (q.fo || 0) * PXB))
      if ((hi <= 6 || p.x - xl < f) && hi < bd) { bd = hi; best = { z: 'fi', r: q } }
      if ((ho <= 6 || xr - p.x < f) && ho < bd) { bd = ho; best = { z: 'fo', r: q } }
    }
    if (best) return best
  }
  const end = endAt(ti, p)
  if (end) return { z: end[1] === 'l' ? 'tl' : 'tr', r: end[0] }
  return { z: (y < lh / 2) !== SMART.flip ? 'range' : 'grab', r }
}
/* the end of a region under the pointer, if there is one: [region, 'l' | 'r']. Where two share a stretch the nearer end is the one */
function endAt (ti, p) {
  const t = S.tracks[ti], pos = barAt(p.x)
  let best = null, bd = Infinity
  if (t) for (const r of t.regs) {
    if (!(pos >= r.a - 1 && pos < r.b - 1)) continue
    const xl = bx(r.a), xr = bx(r.b), ed = Math.min(6, (xr - xl) / 4)
    if (p.x - xl < ed && p.x - xl < bd) { bd = p.x - xl; best = [r, 'l'] }
    if (xr - p.x < ed && xr - p.x < bd) { bd = xr - p.x; best = [r, 'r'] }
  }
  return best
}
/* a stretch of time is begun with the pointer; with shift, the one that is there is pulled from its nearer end instead */
function marqStart (e, ti, pos, cursor) {
  const a = Math.max(0, snapPos(pos, e)), m = S.marq
  S.selR = []; S.selP = []
  if (e.shiftKey && m && m.b - m.a >= MIN_LEN) { const p0 = Math.abs(a - m.a) < Math.abs(a - m.b) ? m.b : m.a; S.marq = { a: Math.min(p0, a), b: Math.max(p0, a), t0: m.t0, t1: ti }; drag = { a: 'marq', p0 } }
  else { S.marq = { a, b: a, t0: ti, t1: ti }; drag = { a: 'marq', p0: a, cursor } }      // `cursor`: let go without a pull, the playhead goes there
  marqMates()
}
const mateIds = (A, B, t) => joinMates(A, B, t).map(([a, b]) => [a.id, b.id])
/* the two regions of a pull at a join, and the same two on each track of the edit group: [[A, B] …] */
const pairsOf = d => [[d.A, d.B]].concat(d.mates || []).map(([a, b]) => [regOf(a)[0], regOf(b)[0]]).filter(q => q[0] && q[1])
/* fades are pulled freely — a fade heals a cut, and a cut is not on the grid — except where the grid is all there is (the grid mode) */
const fadeSnap = (pos, e) => { if (S.mode !== 'grid' || (e && e.ctrlKey && e.shiftKey)) return pos; const g = gridStep(true); return Math.round(pos / g) * g }
/* control and shift held over a region of sound: the pointer (and the smart tool) is the fade tool there, as in Logic —
   pulled in its first half a fade in, in its second a fade out, across a join a crossfade. (Not over notes, which have no
   fades, nor with the lines up.) */
const fadeHeld = (e, p) => { if (!e.ctrlKey || !e.shiftKey || e.metaKey || e.altKey || S.auto || (S.tool !== 'pointer' && S.tool !== 'smart') || (p.y - TY + VY) >= rowTops().all) return false; const r = hitRegion(laneAt(p.y), barAt(p.x)); return !!r && !r.notes }
/* a fade taken hold of: where it is part of a crossfade, the crossfade is what is pulled. `pos`: where it was taken hold
   of, when the pull is to be counted from there (the smart tool: the fade grows by as much as the hand moves); without
   it the fade reaches to wherever the pointer is (the fade tool) */
/* the regions that take a fade along with the one whose fade is pulled: the same stretch on the tracks edited along with
   its own (an edit group), and — when it is one of several chosen regions — every other chosen region of sound: each gets
   a fade as long, as far as it has room for one */
function fadeWith (r, t) {
  const out = new Map(companions(r, t).map(([x]) => [x.id, x]))
  if (S.selR.includes(r.id) && S.selR.length > 1) for (const [x] of selRegs()) if (!x.notes) out.set(x.id, x)
  out.delete(r.id)
  return [...out.values()]
}
function fadeGrab (r, t, left, before, pos) {
  const pair = joinsOf(t).find(([A, B]) => xfadeOf(A, B) && (left ? B === r : A === r))
  if (pair) { S.selR = []; S.selX = [pair[0].id, pair[1].id]; return { a: 'xfade', A: pair[0].id, B: pair[1].id, mates: mateIds(pair[0], pair[1], t), before, moved: false } }
  const with_ = fadeWith(r, t)
  if (!(S.selR.includes(r.id) && S.selR.length > 1)) S.selR = withTheirs([r.id])           // (one of several chosen: they stay chosen, and take the fade with it)
  return { a: 'fade', id: r.id, left, before, also: with_.map(x => x.id), dx: pos == null ? 0 : left ? pos - (r.a - 1 + (r.fi || 0)) : pos - (r.b - 1 - (r.fo || 0)) }
}
/* says whether the press was the smart tool's own (a fade, a crossfade, a stretch of time); the rest is the pointer's */
function smartDown (e, p, ti, pos, before) {
  const q = smartZone(ti, p)
  if (q.z === 'x') {                                                                       // the foot of a join: no crossfade there yet, one is pulled out of it; one that is there is taken hold of, and goes along the two with the hand
    const over = xfadeOf(q.A, q.B)
    S.selR = []; S.selX = [q.A.id, q.B.id]
    drag = over ? { a: 'join', A: q.A.id, B: q.B.id, len: over, curve: q.A.foc || 0, at: joinOf(q.A, q.B), grab: pos - (joinOf(q.A, q.B) - 1), before } : { a: 'xfade', A: q.A.id, B: q.B.id, x0: p.x, before, moved: false }
    drag.mates = mateIds(q.A, q.B, S.tracks[ti])
  }
  else if (q.z === 'fi' || q.z === 'fo') { drag = fadeGrab(q.r, S.tracks[ti], q.z === 'fi', before, pos); drag.x0 = p.x; drag.y0 = p.y }
  else if (q.z === 'range') { marqStart(e, ti, pos, true); return true }
  else { S.marq = null; return false }
  S.marq = null
  return true
}
function edit (fn) { const before = editState(); if (fn() !== false) commit(before) }
/* ── the song's own time: a stretch of it taken out of every track at once, or put in ──
   What crosses an edge of the stretch is cut there; the regions, the points of every line and the markers that come
   after it go with the time. What is taken out is handed back, so that it can be put in again somewhere else — that
   is how a part of the song is moved or said twice. Places here are bars from zero. */
/* ── lines through edits of the song's time ──
   A line is its points in order; two points on one place are a step (the first is the level the line arrives with, the
   last the level it leaves with). Time taken out or put in cuts a line at exact places, and a cut end is a point of its
   own — marked `e`, so that it is taken away again whenever the line would run the same without it (a part moved away
   and back leaves the line as it was). Points that already stand on the place are those ends — they are not made anew,
   and they keep what they are: a point somebody set is never taken away for running straight. Each goes where the
   line has its level and needs a point (a step moves whole, with what follows it). */
const seamPt = (b, v) => ({ id: ++PID, b, v, e: 1 })
/* the level a line arrives at a place with, and the level it leaves it with */
function lineAt (pts, x) {
  const n = pts.length
  let i = 0, j
  while (i < n && pts[i].b < x - 1e-9) i++
  for (j = i; j < n && pts[j].b <= x + 1e-9;) j++
  if (j > i) return [pts[i].v, pts[j - 1].v]                                            // points stand on the place itself
  const p = pts[i - 1], q = pts[j]
  if (!p) return [q.v, q.v]
  if (!q) return [p.v, p.v]
  const v = p.v + (q.v - p.v) * (x - p.b) / (q.b - p.b)
  return [v, v]
}
function tidyLine (pts) {
  const same = (x, y) => Math.abs(x - y) < 1e-9
  for (let again = true; again;) {
    again = false
    for (let i = pts.length - 1; i >= 0 && pts.length > 1; i--) {
      const q = pts[i], p = pts[i - 1], r = pts[i + 1]
      if (!q.e) continue
      const gone = !p ? same(q.v, r.v)                                                  // the first point, and the line begins at that level anyway
        : !r ? same(q.v, p.v)                                                           // the last
        : same(p.b, q.b) && same(q.b, r.b) ? true                                       // the middle one of three on one place
        : same(p.b, q.b) ? same(p.v, q.v)                                               // twice the same point
        : same(q.b, r.b) ? same(q.v, r.v)
        : same(q.v, p.v + (r.v - p.v) * (q.b - p.b) / (r.b - p.b))                      // on the straight line between its neighbours
      if (gone) { pts.splice(i, 1); again = true }
    }
  }
  return pts
}
/* a line with the stretch from a to b gone, and what the stretch held: [the level it began with, the level it ended with,
   [[how far in, level] …], and whether each of those two levels was a point somebody set (the inner half of a step on the
   stretch's edge, which goes with the stretch)] */
function lineLift (pts, a, b) {
  const [outL, inL] = lineAt(pts, a), [inR, outR] = lineAt(pts, b)
  const held = [inL, inR, pts.filter(q => q.b > a + 1e-9 && q.b < b - 1e-9).map(q => [q.b - a, q.v, q.e ? 1 : 0]), false, false]
  const rest = pts.filter(q => q.b < a - 1e-9), near = (x, y) => Math.abs(x - y) <= 1e-9, onA = pts.filter(q => near(q.b, a)), onB = pts.filter(q => near(q.b, b))
  /* the first point on the stretch's beginning carries the level the line arrives with, the last on its end the level it
     leaves with; a step that stood whole on one of the two places gives the other its point where the level is the same */
  const arr = onA[0] || (onB.length > 1 && near(onB[0].v, outL) ? onB[0] : null)
  const dep = onB.length ? onB[onB.length - 1] : onA.length > 1 && near(onA[onA.length - 1].v, outR) ? onA[onA.length - 1] : null
  held[3] = onA.length > 1 && onA[onA.length - 1] !== dep && !onA[onA.length - 1].e
  held[4] = onB.length > 1 && onB[0] !== arr && !onB[0].e
  if (arr) arr.b = a
  rest.push(arr || seamPt(a, outL))
  if (dep && dep === onA[onA.length - 1]) rest.push(...onA.slice(1, -1))               // (more than two on the place, and all of them stay: those between stay between)
  if (dep) { dep.b = a; rest.push(dep) } else if (!near(outL, outR)) rest.push(seamPt(a, outR))
  for (const q of pts) if (q.b > b + 1e-9) { q.b -= b - a; rest.push(q) }
  return [tidyLine(rest), held]
}
/* a line with time put in at `at`: before it and after it the line runs as it did. Across the new time it holds the level
   it arrived with — a step that stood on the place stands at the end of the new time — unless `line` (as lineLift hands
   it back) says what the line does there. */
function lineDrop (pts, at, len, line) {
  const [vL, vR] = lineAt(pts, at), out = pts.filter(q => q.b < at - 1e-9), on = pts.filter(q => Math.abs(q.b - at) <= 1e-9)
  const arr = seamPt(at, vL), end = line && line[4] ? { id: ++PID, b: at + len, v: line[1] } : seamPt(at + len, line ? line[1] : vL)
  let dep = end, inn = null                                                             // the point the line leaves the new time with, and the one it steps into it with
  out.push(arr)
  if (line) {
    if (line[3]) out.push({ id: ++PID, b: at, v: line[0] }); else if (Math.abs(line[0] - vL) > 1e-9) out.push(inn = seamPt(at, line[0]))
    for (const [d, v, e] of line[2]) if (d > 1e-9 && d < len - 1e-9) out.push(e ? seamPt(at + d, v) : { id: ++PID, b: at + d, v })
  }
  out.push(end)
  if (Math.abs(end.v - vR) > 1e-9) out.push(dep = seamPt(at + len, vR))
  for (const q of pts) if (q.b > at + 1e-9) { q.b += len; out.push(q) }
  /* points that stood on the place are those ends, not new ones. The last of them is where the line leaves again, after
     the new time, and the first where it arrives — but each stands rather where the line has its level and needs a
     point, when it needs none in that first place: a step goes later whole, a corner stands where the line turns, and
     a step into time that carries on level stays the step it was */
  const put = (q, where) => { q.b = where.b; out[out.indexOf(where)] = q }
  const home = (first, second) => { if (!second || !second.e || !out.includes(second)) return first; const needs = tidyLine(out.slice()); return !needs.includes(first) && needs.includes(second) ? second : first }      // (only onto a point the edit made: one somebody set is never written over)
  if (on.length > 1) {
    const tail = on[on.length - 1], mids = on.slice(1, -1), h = home(dep, inn && Math.abs(inn.v - vR) <= 1e-9 ? inn : null)
    if (mids.length && h === end) out.splice(out.indexOf(end), 0, seamPt(at + len, end.v))      // (more than two stood on the place: those between go with the last, and the level the new time ends with keeps a point of its own before them)
    put(tail, h)
    if (mids.length) out.splice(out.indexOf(tail), 0, ...mids.map(m => { m.b = tail.b; return m }))
  }
  if (on.length) put(on[0], home(arr, on.length > 1 ? (end !== dep && Math.abs(end.v - vL) <= 1e-9 ? end : null) : dep))
  return tidyLine(out)
}
/* every lane is made plain at `at` (see cutLaneAt: a region that only sticks over the place by a hair is left whole); the
   piece after a cut remembers that it was made here, `tc`, so that it can be healed if the two ever stand together again */
function cutAll (at) { for (const L of S.tracks.flatMap(lanesOf)) for (const right of cutLaneAt(L, at)) right.tc = 1 }
/* an edit of the song's time, as one step. It parts the crossfades that lie on its edges (partAt); where the same two
   regions — or a copy of one of them made by this edit — meet again when it is done, the crossfade is made again as it
   was (a part said twice keeps the crossfade that led into it, and has the one that led out of it at the end of its
   second saying). Regions that now overlap by a hair at a seam crossfade there (seamLane). What was chosen and is gone
   is no longer chosen, and neither is a marker: markers are made anew, and the one that was pressed is known by its place. */
function timeEdit (fn) {
  return edit(() => {
    const lanes = S.tracks.flatMap(lanesOf), was = lanes.map(sharesOf), met = lanes.map(meetsOf)
    const r = fn()
    if (r === false) return r
    lanes.forEach((L, i) => { seamBack(L); remakeMet(L, met[i]); seamLane(L, was[i]); for (const x of L.regs) delete x._of })
    S.selR = S.selR.filter(id => regOf(id)[0])
    if (S.selX && !(regOf(S.selX[0])[0] && regOf(S.selX[1])[0] && xfadeOf(regOf(S.selX[0])[0], regOf(S.selX[1])[0]))) S.selX = null
    if (S.selP.length) { const live = new Set(S.tracks.flatMap(t => Object.values(t.autos || {}).flat().map(q => q.id))); S.selP = S.selP.filter(id => live.has(id)) }
    S.selM = null; if (S.focus === 'marker') S.focus = 'lanes'
    return r
  })
}
/* two that crossfaded and were parted remember it (partAt: `px` on the earlier one, of its end; `py` on the later one, of
   its beginning). Where those very ends meet again — the regions themselves or copies of them, in the edit that parted
   them or a later one — the crossfade is made again as it was. Not where the two already met before the edit: two that
   somebody put end to start by hand are left as they were put. */
const sameNote = (p, q) => !!(p && q && p.ka === q.ka && p.kb === q.kb && Math.abs(p.aEnd - q.aEnd) < 1e-6 && Math.abs(p.bStart - q.bStart) < 1e-6 && Math.abs(p.la - q.la) < 1e-9 && Math.abs(p.lb - q.lb) < 1e-9)
const meetKey = (A, B) => A.id + '|' + B.id + '|' + ((A.off || 0) + (A.b - A.a)).toFixed(6) + '|' + (B.off || 0).toFixed(6)      // (the two, and the very ends they meet with: a piece of one of them meeting the other is another meeting)
function meetsOf (L) { const out = new Set(); for (const [A, B] of joinsOf(L)) if (!xfadeOf(A, B)) out.add(meetKey(A, B)); return out }
function remakeMet (L, met) {
  for (const [a, b] of joinsOf(L)) {
    if (xfadeOf(a, b) || !sameNote(a.px, b.py) || (met && met.has(meetKey(a, b)))) continue
    const n = a.px
    if (srcKey(a) !== n.ka || srcKey(b) !== n.kb || Math.abs((a.off || 0) + (a.b - a.a) - n.aEnd) > 1e-6 || Math.abs((b.off || 0) - n.bStart) > 1e-6 || crossAfter(a, L) || crossBefore(b, L)) continue
    remake(a, b, n); delete a.px; delete b.py
  }
}
/* a crossfade made again as it was (`n`, as partAt noted it when the two were parted): each runs over the place as far as
   it did, so the crossfade lies where it lay, about the join it was made about, with the same curve */
function remake (A, B, n) {
  A.fo = 0; B.fi = 0
  if (A._pj) A._pj &= ~1
  if (B._pj) B._pj &= ~2
  const [ra, rb] = crossRoom(A, B)
  if (!(n.la <= ra + 1e-9 && n.lb <= rb + 1e-9)) return crossfade(A, B, n.la + n.lb, n.curve)
  crossBy(A, B, n.la, n.lb, n.curve)
  if (n.xo != null) A.xo = n.xo; else delete A.xo
  return 'cross'
}
function liftTime (a, b) {
  const len = b - a, held = { len, regs: [], lines: [], marks: [], cycle: null }
  if (!(len > 1e-9)) return held
  cutAll(a); cutAll(b)
  for (const t of S.tracks) {
    lanesOf(t).forEach((L, li) => {                                                    // (li: 0 the track's own regions, then its alternatives in their order)
      const keep = []
      for (const r of L.regs) {
        if (after(r, a) && !after(r, b)) held.regs.push([t.id, r, r.a - a, li ? L.name : (t.alt || '1')])     // in the stretch: it goes, kept by how far into the stretch it began (and by the name of the alternative it lay on)
        else { if (after(r, b)) { r.a -= len; r.b -= len; notBeforeOne(r) } keep.push(r) }
      }
      L.regs = keep
    })
    for (const k in t.autos || {}) {
      const pts = t.autos[k]
      if (!pts.length) continue
      const [rest, line] = lineLift(pts, a, b)
      held.lines.push([t.id, k, line[0], line[1], line[2], line[3], line[4]])
      t.autos[k] = rest
    }
  }
  const marks = []
  for (const s of SCENES) { if (s.a - 1 >= a - 1e-9 && s.a - 1 < b - 1e-9) held.marks.push([s.name, s.a - 1 - a, s.c]); else marks.push([s.name, s.a - 1 >= b - 1e-9 ? s.a - len : s.a, s.c]) }
  SCENES = mkScenes(marks)
  const c = S.cycle                                                                     // the cycle and the playhead go with the time they stand in
  if (c.a >= b - 1e-9) { c.a -= len; c.b -= len }
  else if (c.a >= a - 1e-9 && c.b <= b + 1e-9 && c.b - c.a >= MIN_LEN) { held.cycle = [c.a - a, c.b - a, !!c.on]; c.a = c.b = a; c.on = false }      // it lay in the stretch: it goes with it, and comes back where the stretch is put
  else if (c.b > a + 1e-9) { c.a = Math.min(c.a, a); c.b = Math.max(c.a, c.b > b ? c.b - len : a); if (c.b - c.a < MIN_LEN) c.on = false }
  if (!S.playing) S.pos = S.pos >= b ? S.pos - len : S.pos > a ? a : S.pos
  return held
}
/* time is put in at `at`; with `held` (from a lift), what was lifted stands in it. `fresh`: as copies — the regions are new ones */
function dropTime (at, len, held, fresh) {
  if (!(len > 1e-9)) return
  cutAll(at)
  for (const t of S.tracks) {
    for (const L of lanesOf(t)) for (const r of L.regs) if (after(r, at)) { r.a += len; r.b += len }
    const lines = new Set(Object.keys(t.autos || {}).concat(held ? held.lines.filter(q => q[0] === t.id).map(q => q[1]) : []))
    for (const k of lines) {
      let pts = (t.autos && t.autos[k]) || []
      const hl = held && held.lines.find(q => q[0] === t.id && q[1] === k), line = hl ? [hl[2], hl[3], hl[4], hl[5], hl[6]] : null
      if (!pts.length) {                                                                // the track has no such line (any more): the stretch brings its own, and outside it the control stays where it stands
        const A = AUTO[k], now = A && (k.slice(0, 4) !== 'send' || t.sends[+k.slice(4)]) ? A.now(t) : null
        if (!line || now == null || (!line[2].length && Math.abs(line[0] - now) < 1e-9 && Math.abs(line[1] - now) < 1e-9)) continue
        pts = [seamPt(at, now)]
        t.autos = t.autos || {}
      }
      t.autos[k] = lineDrop(pts, at, len, line)
    }
  }
  const marks = SCENES.map(s => [s.name, s.a - 1 >= at - 1e-9 ? s.a + len : s.a, s.c])
  if (held) {
    const made = []
    for (const [tid, r, d, on] of held.regs) {
      const t = byId(tid), L = t && ((t.alt || '1') === on ? t : (t.alts || []).find(q => q.name === on))
      if (!L) continue
      const x = fresh ? cloneReg(r) : r
      if (fresh) { x._of = r.id; made.push(x) }
      x.b = at + d + (r.b - r.a); x.a = at + d
      notBeforeOne(x)
      L.regs.push(x); dirtyReg(x)
    }
    if (fresh) freshGroups(made)
    for (const [name, d, c] of held.marks) if (!marks.some(m => Math.abs(m[1] - (at + d + 1)) < 1e-6)) marks.push([name, at + d + 1, c])
  }
  const end = Math.max(SONG_END, ...S.tracks.flatMap(lanesOf).flatMap(t => t.regs.map(r => r.b - 1)), ...marks.map(m => m[1] - 1))      // (the song is not shorter than its last marker)
  if (end > SONG_END) SONG_END = Math.ceil(end)
  SCENES = mkScenes(marks)
  const c = S.cycle
  if (c.a >= at - 1e-9) { c.a += len; c.b += len } else if (c.b > at + 1e-9) c.b += len
  if (held && held.cycle) { c.a = at + held.cycle[0]; c.b = at + held.cycle[1]; c.on = held.cycle[2] }
  if (!S.playing && S.pos >= at) S.pos += len
}
/* two pieces that a time edit cut apart and that stand together again at `at`, the second carrying on exactly where the
   first stops, are one region again (a cut the edit made and then had no use for) */
function healAt (at) {
  for (const t of S.tracks.flatMap(lanesOf)) for (const [A, B] of joinsOf(t)) {
    if (!B.tc || Math.abs(A.b - 1 - at) > 1e-6 || xfadeOf(A, B) || !carriesOn(A, B) || Math.abs((B.off || 0) - ((A.off || 0) + (B.a - A.a))) > 1e-6) continue
    if (!((A.gain || 0) === (B.gain || 0) && !!A.mute === !!B.mute && (A.tag || '') === (B.tag || '') && !A.fo && !B.fi && !A.flex && !B.flex && (A.grp || 0) === (B.grp || 0))) continue
    const f = B.tcf, afi = A.fi || 0, bfo = B.fo || 0, m = B.sm
    if (!joinPair(t, A, B) || !f) continue
    if (f.lf && Math.abs(afi - f.l) < 1e-9) A.fi = f.fi                                // (a fade the cut shortened, untouched since, is as long as it was)
    if (f.rf && Math.abs(bfo - f.r) < 1e-9) A.fo = f.fo
    else if (f.rf && m && Math.abs(m.fo - f.r) < 1e-9) A.sm = Object.assign({}, m, { fo: f.fo })      // (… or will be, once what a seam took from that end is back)
    fitFades(A, t); dirtyReg(A)
  }
}
let TIME_CLIP = null
const copyHeld = h => ({ len: h.len, cycle: h.cycle ? h.cycle.slice() : null, regs: h.regs.map(([tid, r, d, on]) => [tid, Object.assign({}, r, r.flex ? { flex: r.flex.map(m => Object.assign({}, m)) } : {}), d, on]), lines: h.lines.map(q => [q[0], q[1], q[2], q[3], q[4].map(x => x.slice()), q[5], q[6]]), marks: h.marks.map(m => m.slice()) })
const timeAct = {
  /* a stretch goes out of the song, and the song closes over it; it is kept, to be put in somewhere else */
  cut (a, b) { if (!(b - a >= MIN_LEN)) return; timeEdit(() => { TIME_CLIP = copyHeld(liftTime(a, b)); healAt(a) }); say(`${+(b - a).toFixed(2)} bars taken out`) },
  /* nothing is put in: everything from `at` on goes later by `len` */
  room (at, len) { if (!(len >= MIN_LEN)) return; timeEdit(() => { dropTime(at, len) }) },
  /* the stretch last taken out is put in at the playhead */
  put (at) { const h = TIME_CLIP; if (!h) return; timeEdit(() => { dropTime(at, h.len, copyHeld(h), true); healAt(at); healAt(at + h.len) }) },
  /* a stretch is said twice: a copy of it is put in right after it */
  /* (nothing before the stretch's end is touched: what the stretch holds is taken from copies of the lanes and the lines, cut
     as a lift would cut them, and put in after it. Lifting it and putting it back let the hairs on either side of it meet
     for a moment, and cut what ran through its first place) */
  repeat (a, b) {
    if (!(b - a >= MIN_LEN)) return
    timeEdit(() => {
      const len = b - a, held = { len, regs: [], lines: [], marks: [], cycle: null }
      for (const t of S.tracks) {
        lanesOf(t).forEach((L, li) => {
          const C = { regs: L.regs.filter(r => r.a - 1 < b + 1e-9 && r.b - 1 > a - 1e-9).map(r => Object.assign({}, r, r.flex ? { flex: r.flex.map(q => Object.assign({}, q)) } : {})) }
          cutLaneAt(C, a); cutLaneAt(C, b)
          for (const c of C.regs) { if (after(c, a) && !after(c, b)) { delete c.tc; delete c.tcf; held.regs.push([t.id, c, c.a - a, li ? L.name : (t.alt || '1')]) } }      // (a beginning that was parted on a crossfade's join keeps its mark: see joinEnds)
        })
        for (const k in t.autos || {}) { const pts = t.autos[k]; if (!pts.length) continue; const line = lineLift(pts.map(q => Object.assign({}, q)), a, b)[1]; held.lines.push([t.id, k, line[0], line[1], line[2], line[3], line[4]]) }
      }
      for (const sc of SCENES) if (sc.a - 1 >= a - 1e-9 && sc.a - 1 < b - 1e-9) held.marks.push([sc.name, sc.a - 1 - a])
      const c = S.cycle
      if (c.a >= a - 1e-9 && c.b <= b + 1e-9 && c.b - c.a >= MIN_LEN) held.cycle = [c.a - a, c.b - a, !!c.on]
      dropTime(b, len, held, true); healAt(b); healAt(b + len)
    })
  },
  /* a stretch is moved so that it begins at `to` (a place in the song as it is now) */
  move (a, b, to) {
    if (!(b - a >= MIN_LEN) || (to > a - 1e-9 && to < b + 1e-9)) return
    timeEdit(() => { const h = liftTime(a, b), at = to >= b ? to - h.len : to; dropTime(at, h.len, h, false); healAt(a > at ? a + h.len : a); healAt(at); healAt(at + h.len) })
  },
}
/* the same, by the song's parts: the part a marker begins is the stretch from it to the next marker */
function partAct (i, what) {
  const sc = SCENES[i]
  if (!sc) return
  const a = sc.a - 1, b = Math.min(SONG_END, sc.b - 1)
  let to = null                                                                         // where its marker stands afterwards (a bar, from one)
  if (what === 'repeat') { timeAct.repeat(a, b); to = sc.a }
  else if (what === 'cut') timeAct.cut(a, b)
  else if (what === 'earlier' && i > 0) { to = SCENES[i - 1].a; timeAct.move(a, b, to - 1) }
  else if (what === 'later' && i + 1 < SCENES.length) { const end = Math.min(SONG_END, SCENES[i + 1].b - 1); to = end - (b - a) + 1; timeAct.move(a, b, end) }
  S.selM = to; S.focus = to == null ? 'lanes' : 'marker'
  uiDirty('scenes', 'lanes', 'ruler', 'top')
}

const act = {
  mute () { const rs = S.marq ? null : selRegs(); edit(() => { const list = S.marq ? cutByMarquee() : rs.map(x => x[0]); if (!list.length) return S.marq && cutByMarquee.changed ? undefined : false; const to = !list.every(r => r.mute); for (const r of list) r.mute = to; S.marq = null }) },
  gain (d) { edit(() => { const rs = selRegs(); if (!rs.length) return false; for (const [r] of rs) { r.gain = clamp(Math.round(((r.gain || 0) + d) * 10) / 10, -30, 12); dirtyReg(r) } }) },
  /* the delete key goes by what was taken hold of last: a marker that was pressed; else the points of a line, what a marquee
     holds, the chosen regions; and with tracks chosen and nothing left on them, the tracks themselves — so a track's
     regions go at the first press and the track at the second */
  del () {
    if (S.focus === 'marker') { const sc = SCENES.find(x => x.a === S.selM); if (sc) { removeScene(sc.i); return } S.focus = 'lanes'; S.selM = null }      // (the marker that was pressed is no longer there)
    if (S.selX && S.focus === 'lanes' && !S.selR.length && !S.marq) { const [A, t] = regOf(S.selX[0]), B = regOf(S.selX[1])[0]; S.selX = null; if (A && B) edit(() => { let any = false; for (const [a, b] of [[A, B]].concat(joinMates(A, B, t))) any = uncross(a, b) || any; return any }); uiDirty('lanes', 'dock'); return }
    if (S.auto && (S.selP.length || S.marq || S.focus !== 'tracks')) { edit(() => autoDelete()); return }      // the lines up: a delete is the lines' — the chosen points, else those in the marquee's stretch — and never the sound (his ask, 2026-10-19)
    if (S.selP.length && S.focus !== 'tracks') { edit(() => autoDelete()); return }      // (the lines away: chosen points go — a marquee up as well: a stack's points chosen inside one stayed, his report 2026-10-21)
    if (S.marq || S.selR.length) {
      edit(() => {
        const m = S.marq, mts = m ? marqTracks().filter(t => t.kind === 'audio') : null
        S.selX = null
        if (!m) partCrossed(new Set(S.selR))                                             // (of two that share a stretch, one goes: the one that stays ends, or begins, on the plain join)
        let pts = false                                                                  // (a bus's or a stack's own line under the marquee: its points in the stretch go with the sound — they stayed, his report 2026-10-21)
        if (m) for (const t of marqTracks().filter(lineOwn)) { const was = autoPts(t, 'vol'), keep = was.filter(q => q.b < m.a - 1e-9 || q.b > m.b + 1e-9); if (keep.length !== was.length) { t.autos.vol = keep; pts = true } }
        const list = m ? cutByMarquee().map(r => r.id) : S.selR.slice()
        if (!list.length && !pts && !(m && (shuffling() || cutByMarquee.changed))) return false
        const spans = new Map()
        if (shuffling() && !m) for (const id of list) { const [r, t] = regOf(id); if (r) { if (!spans.has(t)) spans.set(t, []); spans.get(t).push([r.a, r.b]) } }
        removeRegs(list); S.marq = null
        if (shuffling() && m) { if (m.b - m.a < MIN_LEN) return false; for (const t of mts) { const was = sharesOf(t), met = meetsOf(t); closeUp(t, [[m.a + 1, m.b + 1]], null, true); seamBack(t); remakeMet(t, met); seamLane(t, was) } }      // shuffle: the stretch itself is gone, and what follows it closes up
        else for (const [t, sp] of spans) closeUp(t, sp)
      })
      return
    }
    if (S.focus !== 'tracks') return
    const ts = chosen(), ids = ts.flatMap(t => t.regs.map(r => r.id))
    if (ids.length) edit(() => { removeRegs(ids) }); else deleteTracks(ts)
  },
  splitAtPlayhead () { edit(() => { const p = curPos(); let any = false; if (S.marq) { any = cutByMarquee().length > 0 || cutByMarquee.changed; S.marq = null } else for (const [r, t] of selRegs()) any = !!splitReg(r, t, p) || any; return any }) },
  join () { return joinNow() },
  /* command r: what is chosen is said again right after itself — the regions, or the stretch under the marquee (and the
     marquee goes over what was put down, so the next press follows that one). the clipboard stays what it was; if it holds
     this very stretch, it goes along, so a command v after it follows on too */
  repeat () {
    if (S.marq && S.marq.b - S.marq.a >= MIN_LEN) {
      const keep = CLIP, here = sameStretch(S.marq, keep.from)
      act.copy(); act.paste()
      const now = CLIP.from; CLIP = keep
      if (here) keep.from = now
      return
    }
    edit(() => {
      const rs = selRegs()
      if (!rs.length) return false
      const set = new Set(S.selR), cs = rs.map(([r, t]) => [plainCopy(r, t, set), t])      // what is said again is each region without the crossfades it has with what is not: it begins on its join, in time
      const a0 = Math.min(...cs.map(x => x[0].a)), b1 = Math.max(...cs.map(x => x[0].b)), ids = [], put = []
      for (const [p, t] of cs) { const c = cloneReg(p, { a: p.a + (b1 - a0), b: p.b + (b1 - a0) }); t.regs.push(c); ids.push(c.id); put.push([c, t, c.a - 1, c.b - 1]) }
      freshGroups(put.map(x => x[0])); S.selR = ids; S.focus = 'lanes'; settle(put)
    })
  },
  selectAll () { S.focus = 'lanes'; S.selX = null; if (S.auto) { S.selP = S.tracks.flatMap(t => autoPts(t, shownKey(t)).map(q => q.id)); uiDirty('lanes'); return } S.selR = S.tracks.flatMap(t => t.regs.map(r => r.id)); S.marq = null; uiDirty('lanes', 'dock') },
  /* choosing by key (his Logic set): none; the others; all that follow (on every track, or on the same ones); what lies in the cycle; what is muted; the first, the last; one more to a side */
  deselect () { S.selR = []; S.selP = []; S.selX = null; S.marq = null; S.focus = 'lanes'; uiDirty('lanes', 'dock') },
  invert () { const s = new Set(S.selR); pickRegs(S.tracks.flatMap(t => t.regs).filter(r => !s.has(r.id))) },
  following (same) { const rs = selRegs(), from = rs.length ? Math.min(...rs.map(x => x[0].a)) : curPos() + 1, ts = same ? (rs.length ? [...new Set(rs.map(x => x[1]))] : chosen()) : S.tracks; pickRegs(ts.flatMap(t => t.regs).filter(r => r.a >= from - 1e-9)) },
  inCycle () { const c = S.cycle; if (c.b - c.a >= MIN_LEN) pickRegs(S.tracks.flatMap(t => t.regs).filter(r => r.a - 1 < c.b - 1e-9 && r.b - 1 > c.a + 1e-9)) },
  muted () { pickRegs(S.tracks.flatMap(t => t.regs).filter(r => r.mute)) },
  edge (last) { const own = chosen().flatMap(t => t.regs), all = (own.length ? own : S.tracks.flatMap(t => t.regs)).sort((x, y) => x.a - y.a); if (all.length) pickRegs([all[last ? all.length - 1 : 0]]) },
  more (dir) {
    const rs = selRegs()
    if (!rs.length) { act.step(dir); return }
    const [r, t] = rs.reduce((p, q) => (dir > 0 ? q[0].a > p[0].a : q[0].a < p[0].a) ? q : p), sorted = t.regs.slice().sort((x, y) => x.a - y.a), nx = sorted[sorted.indexOf(r) + dir]
    if (nx) { S.selR = withTheirs(S.selR.concat(nx.id)); S.focus = 'lanes'; uiDirty('lanes', 'dock') }
  },
  copy () { if (S.marq && S.marq.b - S.marq.a >= MIN_LEN) { const m = S.marq; CLIP = marqueeClip(); CLIP.span = m.b - m.a; CLIP.rows = [Math.min(m.t0, m.t1), Math.max(m.t0, m.t1)]; CLIP.from = { a: m.a, b: m.b, t0: CLIP.rows[0], t1: CLIP.rows[1] }; return } const rs = selRegs(); if (!rs.length) return; const set = new Set(S.selR), cs = rs.map(([r, t]) => [plainCopy(r, t, set), t]), a0 = Math.min(...cs.map(x => x[0].a)); CLIP = cs.map(([c, t]) => ({ r: c, ti: S.tracks.indexOf(t), da: c.a - a0 })) },      // (each as it is without the crossfades it has with what is not copied along)
  cut () { act.copy(); act.del() },
  /* command v: what the clipboard holds is put down —
       right after the marquee, while the marquee still lies where the stretch was copied (or where it was last put down):
         the copy follows what it is a copy of, and the marquee goes over the copy, so the next press follows that one —
         as often as it is pressed, wherever the playhead stands (it is command r, pressed as c and v);
       at the beginning of a marquee drawn somewhere else, on its rows: the marquee says where;
       with no marquee, at the playhead, on the rows it came from while the leading track is one of them (else as far down
         as the leading track is from the first of them) — and the playhead goes to its end, so the next press follows on. */
  paste () {
    if (!CLIP.length) return
    const rows = CLIP.rows || null, span = CLIP.span != null ? CLIP.span : Math.max(...CLIP.map(c => c.da + c.r.b - c.r.a))
    const m = S.marq && S.marq.b - S.marq.a >= MIN_LEN ? S.marq : null, mTop = m ? Math.min(m.t0, m.t1) : 0, after = sameStretch(m, CLIP.from)
    let at = 0, dt = 0, any = false
    edit(() => {
      const lead = Math.min(0, ...CLIP.map(c => c.da)), ids = [], put = [], top = rows ? rows[0] : Math.min(...CLIP.map(c => c.ti))
      at = Math.max(1 - lead, (m ? (after ? m.b : m.a) : S.mode === 'grid' ? snapPos(curPos(), null) : curPos()) + 1)
      dt = m ? mTop - top : (rows ? S.sel >= rows[0] && S.sel <= rows[1] : CLIP.some(c => c.ti === S.sel)) ? 0 : S.sel - top
      if (CLIP.some(c => { const t = S.tracks[c.ti + dt]; return !t || t.kind !== 'audio' || t.theirs })) dt = 0
      if (shuffling()) { const all = Math.max(...CLIP.map(c => c.da + c.r.b - c.r.a)); for (const t of new Set(CLIP.map(c => S.tracks[c.ti + dt]))) { if (!t || t.kind !== 'audio') continue; cutLaneAt(t, at - 1); ripple(t, at, all, null, true) } }      // shuffle: what is pasted is put in, and what stood there makes room
      for (const c of CLIP) { const t = S.tracks[c.ti + dt]; if (!t || t.kind !== 'audio' || !!t.inst !== !!c.r.notes) continue; const len = c.r.b - c.r.a, n = cloneReg(c.r, { a: at + c.da, b: at + c.da + len }); t.regs.push(n); ids.push(n.id); put.push([n, t, n.a - 1, n.b - 1]) }
      freshGroups(put.map(x => x[0])); S.selR = ids; S.focus = 'lanes'; S.marq = null; settle(put)
      any = ids.length > 0
      return any
    })
    rewarp(selRegs().map(x => x[0]))                                                     // (copied before the tempo moved, a stretched one is rendered for the tempo of now)
    if (!any) { if (m) S.marq = m; return }
    if (rows) { S.selR = []; S.marq = { a: at - 1, b: at - 1 + span, t0: rows[0] + dt, t1: rows[1] + dt }; marqMates(); CLIP.from = { a: S.marq.a, b: S.marq.b, t0: rows[0] + dt, t1: rows[1] + dt } }
    if (!m && !S.playing) jumpTo(Math.min(SONG_END, at - 1 + span))
    uiDirty('lanes', 'dock', 'scenes', 'top')
  },
  /* the chosen regions are a group from now on: one of them pressed, all of them are chosen; and apart again */
  groupRegs () { edit(() => { const rs = selRegs(); if (rs.length < 2) return false; const g = 1 + Math.max(0, ...S.tracks.flatMap(lanesOf).flatMap(t => t.regs.map(r => r.grp || 0))); for (const [r] of rs) r.grp = g }) },
  ungroupRegs () { edit(() => { const gs = new Set(selRegs().map(x => x[0].grp).filter(Boolean)); if (!gs.size) return false; for (const t of S.tracks) for (const r of t.regs) if (gs.has(r.grp)) delete r.grp }) },
  /* what is chosen is put so that the first of it begins at `to` (bars from zero); the rest keeps its distance */
  spot (to) { edit(() => { const rs = selRegs(); if (!rs.length) return false; if (Math.abs(to + 1 - Math.min(...rs.map(x => x[0].a))) < 1e-9) return false; partCrossed(new Set(S.selR)); const d = to + 1 - Math.min(...rs.map(x => x[0].a)); for (const [r] of rs) { r.a += d; r.b += d } settle(rs.map(([r, t]) => [r, t, r.a - 1, r.b - 1])) }) },
  nudge (dir) {
    const d = nudgeBars() * dir
    if (S.marq && !S.selR.length) { const m = S.marq, k = clamp(d, -m.a, SONG_END - m.b); m.a += k; m.b += k; uiDirty('lanes'); return }      // a marquee moves as a whole
    if (!S.selR.length) { jumpTo(clamp(curPos() + d, 0, SONG_END)); uiDirty('scenes'); return }       // nothing chosen: the playhead moves instead
    edit(() => { const rs = selRegs(); if (!rs.length || rs.some(([r]) => r.a - 1 + d < -1e-9)) return false; partCrossed(new Set(S.selR)); for (const [r] of rs) { r.a += d; r.b += d } settle(rs.map(([r, t]) => [r, t, r.a - 1, r.b - 1])) })
  },
  /* ⌥⇧← and ⌥⇧→: what is chosen ends one nudge earlier or later (a marquee too); a file cannot run past its own end */
  nudgeLen (dir) {
    const d = nudgeBars() * dir
    if (S.marq && !S.selR.length) { const m = S.marq; m.b = clamp(m.b + d, m.a + MIN_LEN, SONG_END); uiDirty('lanes'); return }
    edit(() => {
      const put = [], chosen = new Set(S.selR)
      let any = false
      const plan = selRegs().map(([r, t]) => [r, t, crossAfter(r, t)])                   // (who crossfades with whom is read before anything moves)
      for (const [r, t, mate] of plan) {
        if (mate && chosen.has(mate.id)) continue                                       // both of a crossfade chosen: the two are one stretch, and its end is the later one's
        if (mate) { any = moveJoin(r, mate, joinOf(r, mate) + d) || any; continue }      // an end that is part of a crossfade: the join is what goes, the crossfade as long as it was (as with the hand)
        const [xs] = crossedAt(r, t)
        const next = Math.min(Infinity, ...t.regs.filter(q => q !== r && chosen.has(q.id) && q.a >= r.b - 1e-9).map(q => q.a))      // (not on into another of the chosen)
        const nb = Math.max(Math.min(r.b, r.a + MIN_LEN + xs), Math.min(r.b + d, next, SONG_END + 1, !r.loop && r.srcBars ? r.a + (r.srcBars - (r.off || 0)) : Infinity))      // (it stays longer than what it shares with the one before it)
        if (Math.abs(nb - r.b) < 1e-9) continue
        if (nb > r.b) put.push([r, t, r.b - 1, nb - 1])
        r.b = nb; fitFades(r, t); dirtyReg(r); any = true
      }
      settle(put)
      return any
    })
  },
  /* ; — what is chosen is taken to the playhead: the first of it begins there, the rest keep their places to it. With `next`
     (shift), the region that came after it on the track is chosen in its place, to be brought along in its turn */
  toPlayhead (next) {
    const rs = selRegs()
    if (!rs.length) return
    const d0 = curPos() + 1 - Math.min(...rs.map(x => x[0].a)), last = rs.reduce((p, q) => q[0].a > p[0].a ? q : p)
    const after = next ? last[1].regs.filter(r => r.a > last[0].a + 1e-9 && !S.selR.includes(r.id)).sort((x, y) => x.a - y.a)[0] : null
    if (Math.abs(d0) > 1e-9) edit(() => { partCrossed(new Set(S.selR)); const d = curPos() + 1 - Math.min(...rs.map(x => x[0].a)); for (const [r] of rs) { r.a += d; r.b += d } settle(rs.map(([r, t]) => [r, t, r.a - 1, r.b - 1])) })
    if (after && regOf(after.id)[0]) pickRegs([regOf(after.id)[0]])
  },
  /* ⌥[ and ⌥]: what is chosen is pushed up against the region before it (or the start of the song), or the one after */
  shuffle (dir) {
    edit(() => {
      /* what goes as one: a chosen region, and with it the chosen ones it crossfades on into */
      const ids = new Set(S.selR), seen = new Set(), units = []
      for (const [r, t] of selRegs().sort((p, q) => p[0].a - q[0].a)) {
        if (seen.has(r.id)) continue
        const u = [r]
        seen.add(r.id)
        for (let n = crossAfter(r, t); n && ids.has(n.id) && !seen.has(n.id); n = crossAfter(n, t)) { u.push(n); seen.add(n.id) }
        units.push([u, t])
      }
      let any = false
      for (const [u, t] of units.sort((p, q) => dir < 0 ? p[0][0].a - q[0][0].a : q[0][0].a - p[0][0].a)) {
        const first = u[0], last = u[u.length - 1], order = t.regs.filter(x => !u.includes(x) || x === first || x === last).sort((x, y) => x.a - y.a)
        if (dir < 0 ? crossBefore(first, t) : crossAfter(last, t)) continue              // it shares a stretch with the neighbour it would go to: it is against it already
        const prev = order[order.indexOf(first) - 1], nx = order[order.indexOf(last) + 1]
        const by = dir < 0 ? (prev ? prev.b : 1) - first.a : nx ? nx.a - last.b : 0
        if (Math.abs(by) < 1e-9 || first.a + by < 1) continue
        const other = dir < 0 ? crossAfter(last, t) : crossBefore(first, t)              // what it shares with the neighbour it leaves is a plain join first
        if (other) { if (dir < 0) uncross(last, other); else uncross(other, first) }
        const d = dir < 0 ? (prev ? prev.b : 1) - first.a : nx.a - last.b                // (again: the uncrossing may have moved its end)
        for (const x of u) { x.a += d; x.b += d; dirtyReg(x) }
        any = true
      }
      return any
    })
  },
  /* D and G — a fade by the playhead, for the chosen regions it stands in (with none chosen: the ones under it on the chosen
     tracks): d fades in from the region's start up to the playhead, g fades out from the playhead to its end. They are
     keys for working while the song runs: the fade ends, or begins, at the moment the key is pressed. */
  fadeTo (out) {
    const p = curPos()
    edit(() => {
      const held = selRegs(), rs = held.length ? held : chosen().filter(t => t.kind === 'audio').flatMap(t => t.regs.map(r => [r, t]))
      let any = false
      for (const [r, t] of rs) {
        const [xs, xe] = crossedAt(r, t)
        if (!(p > r.a - 1 + xs + 1e-6 && p < r.b - 1 - xe - 1e-6)) continue                     // the playhead is not in the part of it that is its own (on a join, say: nothing to fade)
        for (const [A, B] of joinsOf(t)) if (xfadeOf(A, B) && (out ? A === r : B === r)) uncross(A, B)      // (the end that is faded was part of a crossfade: a plain end first)
        if (out) r.fo = clamp(r.b - 1 - p, 0, fadeRoom(r, r.fi)); else r.fi = clamp(p - (r.a - 1), 0, fadeRoom(r, r.fo))
        dirtyReg(r); any = true
      }
      if (!any) return false
      say(out ? 'fade out from the playhead' : 'fade in to the playhead')
    })
  },
  /* F — fades for what is chosen, all at once: every join between chosen regions that meet is crossfaded (as long as takes
     the click out of a cut), and each open end with no fade gets a short one. With a marquee up, the marquee says how long:
     a join inside it is crossfaded over its width, and a region it begins or ends with fades over it. */
  fades () {
    let x = 0, f = 0                                                                  // how many crossfades and how many fades were made: said afterwards, so that the key pressed by mistake is noticed
    edit(() => {
      const short = .01 / SPB()
      if (S.marq && S.marq.b - S.marq.a >= MIN_LEN) {
        const m = S.marq, len = m.b - m.a
        for (const t of marqTracks().filter(q => q.kind === 'audio')) {
          for (const [A, B] of joinsOf(t)) if (crossfadeOver(A, B, m.a, m.b, xfadeOf(A, B) ? A.foc || 0 : undefined)) x++      // (one that is a crossfade already keeps its curve)
          for (const r of t.regs) {                                                     // (an end that is part of a crossfade has its fade already)
            const [xs, xe] = crossedAt(r, t)
            if (!xs && Math.abs(r.a - 1 - m.a) < 1e-6 && r.b - 1 > m.b - 1e-9) { r.fi = Math.min(len, fadeRoom(r, r.fo)); dirtyReg(r); f++ }
            if (!xe && Math.abs(r.b - 1 - m.b) < 1e-6 && r.a - 1 < m.a + 1e-9) { r.fo = Math.min(len, fadeRoom(r, r.fi)); dirtyReg(r); f++ }
          }
        }
        S.marq = null
        return x + f > 0
      }
      const chosen = new Set(S.selR)
      for (const t of S.tracks) {
        const crossed = new Set()
        for (const [A, B] of joinsOf(t)) { if (!chosen.has(A.id) || !chosen.has(B.id)) continue; crossed.add(A.id + ':out'); crossed.add(B.id + ':in'); if (!xfadeOf(A, B) && !(A.fo > 0) && !(B.fi > 0) && crossfade(A, B, defaultXfade())) x++ }      // (a join where one of them has a fade of its own is left as it was made)
        for (const r of t.regs) {
          if (!chosen.has(r.id) || r.notes || r.b - r.a < short * 4) continue
          if (!(r.fi > 0) && !crossed.has(r.id + ':in')) { const v = Math.min(short, r.b - r.a - (r.fo || 0)); if (v > 1e-9) { r.fi = v; dirtyReg(r); f++ } }
          if (!(r.fo > 0) && !crossed.has(r.id + ':out')) { const v = Math.min(short, r.b - r.a - (r.fi || 0)); if (v > 1e-9) { r.fo = v; dirtyReg(r); f++ } }
        }
      }
      return x + f > 0
    })
    const many = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
    if (x + f) say([x ? many(x, 'crossfade') : '', f ? many(f, 'fade') : ''].filter(Boolean).join(', '))
  },
  /* ⌥⌘T: what is chosen is cut at the cycle's two ends (with a marquee up, at the marquee's) */
  splitAtCycle () {
    edit(() => {
      if (S.marq) { const any = cutByMarquee().length > 0 || cutByMarquee.changed; S.marq = null; return any }
      const c = S.cycle
      if (!(c.b - c.a >= MIN_LEN)) return false
      let any = false
      for (const [r, t] of selRegs()) { const right = splitReg(r, t, c.a); any = !!right || any; any = !!splitReg(right || r, t, c.b) || any }
      return any
    })
  },
  /* ⌘[ and ⌘]: what is chosen begins (or ends) at the playhead; with a marquee, the marquee does. A region the playhead
     lies wholly before cannot be made to end there, nor one it lies wholly after to begin there: those stay as they are. */
  trimTo (end) {
    const p = curPos()
    if (S.marq) { if (end) S.marq.b = Math.max(S.marq.a + MIN_LEN, p); else S.marq.a = Math.min(S.marq.b - MIN_LEN, p); uiDirty('lanes'); return }
    edit(() => {
      const put = [], chosen = new Set(S.selR)
      let any = false
      const plan = selRegs().map(([r, t]) => [r, t, end ? crossAfter(r, t) : crossBefore(r, t)])      // (who crossfades with whom is read before anything moves)
      for (const [r, t, mate] of plan) {
        const ra = r.a - 1, rb = r.b - 1
        if (end ? p <= ra + 1e-9 : p >= rb - 1e-9) continue
        if (mate) {
          if (chosen.has(mate.id)) continue                                             // both of a crossfade chosen: the two are one stretch — its end is the later one's, its beginning the earlier one's
          const A = end ? r : mate, B = end ? mate : r
          if (p > A.a - 1 + 1e-9 && p < B.b - 1 - 1e-9) any = moveJoin(A, B, p + 1) || any      // the end that is asked for is part of a crossfade: the join goes to the playhead, the crossfade as long as it was
          continue
        }
        const [xs, xe] = crossedAt(r, t)                                                // (what it shares at its other end it keeps: it stays longer than that)
        if (!end) {
          const prev = Math.max(0, ...t.regs.filter(q => q !== r && chosen.has(q.id) && q.b <= r.a + 1e-9).map(q => q.b - 1))      // (not back across another of the chosen)
          const na = clamp(p, Math.max(prev, r.loop || r.notes ? 0 : Math.max(0, ra - (r.off || 0))), Math.max(ra, rb - MIN_LEN - xe))            // a file cannot begin before its own beginning
          if (Math.abs(na - ra) < 1e-9) continue
          if (na < ra) put.push([r, t, na, ra])
          r.off = (r.off || 0) + (na - ra); r.a = na + 1
        } else {
          const next = Math.min(SONG_END, ...t.regs.filter(q => q !== r && chosen.has(q.id) && q.a >= r.b - 1e-9).map(q => q.a - 1))
          const nb = clamp(p, Math.min(rb, ra + MIN_LEN + xs), Math.min(next, !r.loop && r.srcBars ? ra + (r.srcBars - (r.off || 0)) : SONG_END))
          if (Math.abs(nb - rb) < 1e-9) continue
          if (nb > rb) put.push([r, t, rb, nb])
          r.b = nb + 1
        }
        fitFades(r, t); dirtyReg(r); any = true
      }
      settle(put)
      return any
    })
  },
  /* to the next (or the last) place where something begins on the tracks being worked on: a region's edge, or a beginning
     the app found inside a file. With `extend`, a marquee is drawn from the playhead to there, and each further press
     takes it one beginning further. Only with the song stopped: while it runs the playhead is the song's. */
  async transient (dir, extend) {                                                                     // (while the song runs too: it goes on from there)
    const m = extend ? S.marq : null, tracks = editTracks(), from = m ? (dir > 0 ? m.b : m.a) : curPos(), to = nextStop(await stopsOf(tracks), from, dir)
    if (to == null) return
    if (!extend) { S.marq = null; jumpTo(to); uiDirty('scenes', 'top', 'lanes'); return }
    if (m) { if (dir > 0) m.b = to; else m.a = to }
    else { const p = curPos(), vis = rows(), ks = tracks.map(t => vis.indexOf(S.tracks.indexOf(t))).filter(k => k >= 0); if (!ks.length) return; S.selR = []; S.marq = { a: Math.min(p, to), b: Math.max(p, to), t0: vis[Math.min(...ks)], t1: vis[Math.max(...ks)] }; marqMates() }
    uiDirty('lanes', 'dock')
  },
  /* with a marquee up, the arrows move its end to the next or the last beginning (with shift: its start) */
  async marqStop (dir, start) {
    const m = S.marq
    if (!m) return
    const to = nextStop(await stopsOf(marqTracks().filter(t => t.kind === 'audio')), start ? m.a : m.b, dir)
    if (to == null || S.marq !== m) return
    if (start) { if (to < m.b - MIN_LEN) m.a = to } else if (to > m.a + MIN_LEN) m.b = to
    uiDirty('lanes')
  },
  step (dir) {                                                                                       // the next or the previous region on the same track
    const [r, t] = selRegs()[0] || []
    if (!r) { const tr = S.tracks[S.sel], first = tr && tr.regs.slice().sort((x, y) => x.a - y.a)[0]; if (first) pickRegs([first]); return }
    const sorted = t.regs.slice().sort((x, y) => x.a - y.a), nx = sorted[sorted.indexOf(r) + dir]
    if (nx) pickRegs([nx])
  },
  locators (rounded) {
    let a, b
    if (S.marq && S.marq.b > S.marq.a) { a = S.marq.a; b = S.marq.b } else { const rs = selRegs(); if (!rs.length) return; a = Math.min(...rs.map(x => x[0].a)) - 1; b = Math.max(...rs.map(x => x[0].b)) - 1 }
    if (rounded) { a = Math.round(a); b = Math.max(a + 1, Math.round(b)) }
    setCycle(a, b, true)
  },
  /* L: the chosen region again and again, up to the next one on its track or the end of the song */
  loop () {
    edit(() => {
      const set = new Set(S.selR)
      let any = false
      for (const [r, t] of selRegs()) {
        const p = plainCopy(r, t, set), len = p.b - p.a, stop = Math.min(SONG_END + 1, ...t.regs.filter(x => x !== r && x.a > r.a + 1e-9).map(x => x.a))
        let a = p.b, k = 0
        while (a + len <= stop + 1e-9 && k++ < 256) { const c = cloneReg(p, { a, b: a + len }); freshGroups([c]); t.regs.push(c); a += len; any = true }      // (each copy by itself: not one more of the group its first was in)
      }
      return any
    })
  },
  /* up or down: a line's chosen points when the lines show, else the pitch of the chosen regions */
  transpose (d) {
    if (S.selP.length) { edit(() => autoNudge(d)); return }
    const rs = selRegs().map(x => x[0])
    if (!rs.length) return
    edit(() => { for (const r of rs) r.tr = clamp((r.tr || 0) + d, -24, 24) })
    rewarp(rs)
  },
  reverse () { const rs = selRegs().map(x => x[0]).filter(r => !r.loop && !r.notes); if (!rs.length) return; edit(() => { for (const r of rs) { r.rev = !r.rev; r.off = Math.max(0, (r.srcBars || 0) - (r.off || 0) - (r.b - r.a)); r.flex = [] } }); rewarp(rs) },
  quantize () { const ns = selRegs().map(x => x[0]).filter(r => r.notes), rs = selRegs().map(x => x[0]).filter(r => !r.loop && !r.notes); if (ns.length) quantizeNotes(ns); if (!rs.length) { if (!ns.length) say('choose a region first'); return } quantize(rs) },
  dequantize () { const ns = selRegs().map(x => x[0]).filter(r => r.notes && r.q); if (ns.length) dequantizeNotes(ns); const rs = selRegs().map(x => x[0]).filter(r => r.flex && r.flex.length); if (!rs.length) return; edit(() => { for (const r of rs) r.flex = [] }); rewarp(rs) },
  follow () { const rs = selRegs().map(x => x[0]).filter(r => !r.loop && !r.notes); if (!rs.length) return; edit(() => { const to = !rs.every(r => r.fx); for (const r of rs) r.fx = to }); rewarp(rs) },
  /* the song takes the speed of the chosen file (as it is played: at its rate) */
  async tempoFrom () {
    const r = selRegs().map(x => x[0]).find(q => !q.loop && !q.notes)
    if (!r) { say('choose a file first'); return }
    if (!NAT && r.bpm == null) { say('the app listens for that'); return }
    const bpm = await ensureTempo(r)
    if (!bpm) { say('no steady beat heard in it'); return }
    const to = clamp(Math.round(bpm * rateOf(r) * 100) / 100, 40, 240)
    if (Math.abs(to - S.tempo) > 1e-6) setTempo(to)
    say(`tempo ${+to.toFixed(2)}, from ${String(r.tag || r.name || 'the file').slice(0, 24)}`)
  },
  /* the chosen files are stretched so that their own beat is the song's, and follow the tempo from then on */
  async fitTempo () {
    const rs = selRegs().filter(([q]) => !q.loop && !q.notes)
    if (!rs.length) { say('choose a file first'); return }
    if (!NAT && rs.some(([q]) => q.bpm == null)) { say('the app listens for that'); return }
    await Promise.all(rs.map(([q]) => ensureTempo(q)))
    const can = rs.filter(([q]) => q.bpm > 0 && S.tempo / q.bpm > .5 && S.tempo / q.bpm < 2)
    if (!can.length) { say('no steady beat heard in it'); return }
    edit(() => {
      const now = can.map(([r]) => regOf(r.id)).filter(x => x[0])                       // (as they are now: the app was listened to meanwhile)
      if (!now.length) return false
      settleAfter(() => {                                                              // files that change their length by themselves: where one now runs into a later one, the later one is heard (as when the tempo moves)
        for (const [r, t] of now) {
          const k0 = rateOf(r), k1 = S.tempo / r.bpm, g = k0 / k1                         // it plays g times as long as it did
          for (const q of [crossBefore(r, t)]) if (q) uncross(q, r)
          for (const q of [crossAfter(r, t)]) if (q) uncross(r, q)
          r.rate = k1; r.fx = true; r.sec = (r.sec || 0) * g; if (r.srcBars) r.srcBars *= g
          r.b = r.a + (r.b - r.a) * g; r.off = (r.off || 0) * g; r.fi = (r.fi || 0) * g; r.fo = (r.fo || 0) * g
          for (const m of r.flex || []) m.d *= g
          dirtyReg(r)
        }
      })
      S.selR = S.selR.filter(id => regOf(id)[0])
    })
    rewarp(can.map(x => x[0]))
  },
  /* strip silence (silence.js): ⌃X opens its band; with values (said on the command line, the self-test) it is done at once */
  strip (o) { return o ? stripSilence(o) : stripOpen() },
}
let CLIP = []
/* regions chosen by a key: they are what the delete key and the tracks' own bar are about from here on */
function pickRegs (list) { S.selR = withTheirs(list.map(r => r.id)); S.selX = null; S.marq = null; S.focus = 'lanes'; uiDirty('lanes', 'dock') }
/* the stretch that what is chosen covers (a marquee, else the chosen regions), in bars from zero */
const selSpan = () => { if (S.marq && S.marq.b > S.marq.a) return [S.marq.a, S.marq.b]; const rs = selRegs(); return rs.length ? [Math.min(...rs.map(x => x[0].a)) - 1, Math.max(...rs.map(x => x[0].b)) - 1] : null }
const goTo = bar => { jumpTo(clamp(bar, 0, SONG_END)); uiDirty('scenes', 'top') }
const songEnd = () => Math.min(SONG_END, Math.max(0, ...S.tracks.flatMap(t => t.regs.map(r => r.b - 1))))
/* the cycle moved on or back by its own length; made twice as long, or half */
function moveCycle (dir) { const c = S.cycle, len = c.b - c.a; if (!(len >= MIN_LEN)) return; const a = clamp(c.a + dir * len, 0, Math.max(0, SONG_END - len)); setCycle(a, a + len) }
function scaleCycle (k) { const c = S.cycle, len = (c.b - c.a) * k; if (c.b - c.a >= MIN_LEN && len >= MIN_LEN) setCycle(c.a, Math.min(SONG_END, c.a + len)) }
/* The bar keys: a bar back or on, or eight. Pressed again soon after (or held), the next step is counted from where the
   last one went, not from where the playhead has got to since — while the song plays the playhead has moved on by the
   time the key comes again, and (in the app) is a moment behind being told. Back, while the song plays: to the start of
   the bar that is playing, or, within the first moments of it, to the bar before (so that it can be gone back past). */
const JUMP = { to: 0, at: -1e9 }
function barStep (d) {
  const now = performance.now(), soon = now - JUMP.at < 700 && (S.playing || Math.abs(curPos() - JUMP.to) < 1e-6), base = soon ? JUMP.to : curPos()      // (stopped, the playhead is where it is: what counts is whether it is still where the last step put it)
  let to = base + d
  if (d === 1) to = Math.floor(base + 1e-6) + 1
  else if (d === -1) { to = Math.ceil(base - 1e-6) - 1; if (S.playing && !soon && (base - Math.floor(base)) * (240 / S.tempo) * S.meter[0] / S.meter[1] < .6) to = Math.floor(base) - 1 }
  to = clamp(to, 0, SONG_END)
  jumpTo(to); uiDirty('scenes')
  JUMP.to = to; JUMP.at = now                                                           // (after the jump: any other sending of the playhead forgets it)
}
/* the window brought to the playhead, or to what is chosen */
function showPlayhead () {
  const p = curPos(), span = (X1 - X0) / PXB
  if (p < VX || p > VX + span) { S.away = false; catchView(p); return }
  /* the playhead in sight, the window brought here for it: back to where he was working (ui.js CATCH); while the song
     plays the window then stays there, until ` brings it to the playhead again */
  const w = CATCH.work
  if (!w || !CATCH.mine || CATCH.mine.vx !== VX || CATCH.mine.pxb !== PXB) return
  if (w.pxb !== PXB) setZoom(w.pxb)
  VX = clamp(w.vx, 0, maxVX()); CATCH.mine = null; S.away = S.playing
  uiDirty('lanes', 'ruler', 'scenes')
}
function showChosen () {
  const sp = selSpan(), span = (X1 - X0) / PXB, first = selRegs()[0]
  if (!sp) return
  if (sp[0] < VX || sp[0] > VX + span * .9) VX = clamp(sp[0] - span * .1, 0, maxVX())
  if (first) showRow(S.tracks.indexOf(first[1]))
  uiDirty('lanes', 'ruler', 'scenes', 'head')
}
function pageV (dir) { VY = clamp(VY + dir * LANES_H * .9, 0, maxVY()); uiDirty('lanes', 'head') }
function setCycle (a, b, on) {
  S.cycle.a = clamp(Math.min(a, b), 0, SONG_END); S.cycle.b = clamp(Math.max(a, b), 0, SONG_END)
  if (on != null) S.cycle.on = on && S.cycle.b - S.cycle.a >= MIN_LEN
  pushTransport(); uiDirty('ruler', 'top', 'hand')
}
function setZoom (pxb, aroundBar) {
  if (!isFinite(pxb) || (aroundBar != null && !isFinite(aroundBar))) return              // (asked for with nothing to go by — what was chosen is gone, say: the view stays)
  pxb = clamp(pxb, fitPXB(), maxPXB())
  const at = aroundBar == null ? VX + (X1 - X0) / PXB / 2 : aroundBar, k = (at - VX) * PXB
  PXB = pxb; VX = clamp(at - k / PXB, 0, maxVX())
  uiDirty('lanes', 'ruler', 'scenes', 'info')
}
function scrollBy (bars) { VX = clamp(VX + bars, 0, maxVX()); uiDirty('lanes', 'ruler', 'scenes') }
/* taller or shorter rows, keeping the chosen track where it is */
function setRowH (h) {
  const k = rowOf(S.sel), y = rowY(S.sel)
  S.rh = clamp(Math.round(h), 20, 120)                                                  // (a row with a height of its own keeps it)
  VY = clamp(k < 0 ? VY : VY + rowY(S.sel) - y, 0, maxVY())
  uiDirty('lanes', 'head', 'info')
}
/* the sound in every region drawn taller or lower, the rows as they are (Logic's ⌘+ and ⌘−): what is quiet can be read
   without making the rows tall; what is loud runs flat against the region's edge. Only how it is drawn: nothing is heard of it */
const WZ_MAX = 1024
function setWaveZoom (k) {
  S.wz = clamp(k, 1, WZ_MAX); if (S.wz < 1.01) S.wz = 1
  say(S.wz === 1 ? 'waveform as it is' : `waveform ×${S.wz < 10 ? +S.wz.toFixed(1) : Math.round(S.wz)}`)
  uiDirty('lanes')
}
/* up and down the rows; with shift, the rows passed over are chosen too */
function stepTrack (dir, more) { const vis = rows(), k = vis.indexOf(S.sel); chooseTrack(vis[clamp((k < 0 ? 0 : k) + dir, 0, vis.length - 1)], more ? 'range' : '') }

/* ── the hand on the lanes: what a press does depends on the tool ── */
function hitRegion (ti, pos) { const t = S.tracks[ti]; if (!t) return null; for (let i = t.regs.length - 1; i >= 0; i--) { const r = t.regs[i]; if (pos >= r.a - 1 && pos < r.b - 1) return r } return null }
const pencilSource = t => t.regs.length ? t.regs[t.regs.length - 1] : (t.buf0 ? { buf: t.buf0, loop: true } : null)
const LANE_DRAGS = new Set(['move', 'trimL', 'trimR', 'gain', 'fade', 'marq', 'band', 'zoom', 'apt', 'aband', 'flex', 'xfade', 'join'])
function lanesDown (e, p) {
  lanesPress(e, p)
  if (drag && drag.px == null) { drag.px = p.x; drag.py = p.y }                          // where it was pressed: nothing is moved before the hand has gone a little way from there (see lanesMove)
}
function lanesPress (e, p) {
  if (S.focus !== 'lanes') { S.focus = 'lanes'; S.selM = null; uiDirty('scenes') }
  if ((p.y - TY + VY) >= rowTops().all) { S.selR = []; S.selP = []; S.marq = null; uiDirty('lanes', 'dock'); return }       // below the last row
  const tool = fadeHeld(e, p) ? 'fade' : S.tool                                         // (command held is no second tool: he had it gone, 2026-10-21)
  if (S.auto && tool !== 'zoom' && tool !== 'marquee') { autoDown(e, p, tool); return }
  const ti = laneAt(p.y), t = S.tracks[ti], pos = barAt(p.x)
  /* a bus's or a stack's own line is taken where it is, the lines shown or not (auto.js: lineOwn) */
  if (tool !== 'zoom' && tool !== 'marquee' && lineOwn(t) && (tool === 'pencil' || tool === 'eraser' || onOwnLine(ti, p) || (tool === 'pointer' && inMarq(t, pos)))) { if (S.selR.length || S.selX) { S.selR = []; S.selX = null; uiDirty('dock') } autoDown(e, p, tool); return }
  if (!S.auto && S.selP.length && !e.shiftKey) { S.selP = []; uiDirty('lanes') }                // (a press elsewhere lets go of such a line's points)
  let r = hitRegion(ti, pos), before = editState()
  /* a press with the pointer inside a marquee, as in Logic: the stretch becomes regions of its own — cut at both its edges,
     on every track it covers — and they are what is chosen and taken hold of (pulled, they move; command x takes just
     them). The cut is a step of its own. A press anywhere else, or with another tool, puts the marquee away. */
  if (tool === 'pointer' && S.marq && S.marq.b - S.marq.a >= MIN_LEN && pos >= S.marq.a - 1e-9 && pos <= S.marq.b + 1e-9 && marqTracks().includes(t)) {
    let ids = []
    edit(() => { ids = cutByMarquee().map(x => x.id); if (!ids.length && !cutByMarquee.changed) return false })
    S.marq = null; S.selR = withTheirs(ids)
    r = hitRegion(ti, pos); before = editState()
  }
  if (tool === 'join' && S.marq && S.marq.b - S.marq.a >= MIN_LEN && pos >= S.marq.a - 1e-9 && pos <= S.marq.b + 1e-9 && marqTracks().includes(t)) { joinNow(); return }      // (the join tool pressed inside a marquee: its stretch is made one)
  if (tool !== 'marquee' && tool !== 'smart' && S.marq) S.marq = null
  S.selX = null
  if (S.flex && r && !r.loop && !r.notes && !S.auto) { const g = rubatoBoxAt(r, rowY(ti) + Math.min(lkN('reg.gap'), rowH(ti) / 2 - 4), rowH(ti) - 2 * Math.min(lkN('reg.gap'), rowH(ti) / 2 - 4)); if (p.x >= g.x - 2 && p.x <= g.x + g.w + 2 && p.y >= g.y - 2 && p.y <= g.y + g.h + 2) { edit(() => rubatoSet([r], !rubatoOn(r))); uiDirty('lanes', 'head', 'dock', 'info'); return } }      // (its square pressed: rubato on or off for it — flex.js)
  if (S.flex && r && rubatoOn(r) && (tool === 'flex' || tool === 'pointer' || tool === 'smart') && flexDown(e, p, r, t, tool, before)) { uiDirty('lanes', 'head', 'dock'); return }
  if (tool === 'smart' && smartDown(e, p, ti, pos, before)) { uiDirty('lanes', 'head', 'dock'); return }
  const pick = () => (r ? (S.selR.includes(r.id) ? S.selR.slice() : withTheirs([r.id])) : [])
  if (tool === 'pointer' || tool === 'flex' || tool === 'smart') {
    const end = endAt(ti, p), r = end ? end[0] : hitRegion(ti, pos)
    if (!r) { if (!e.shiftKey) S.selR = []; drag = { a: 'band', x0: p.x, y0: p.y, base: S.selR.slice() }; S.band = null }
    else {
      if (e.shiftKey) { const its = withTheirs([r.id]); S.selR = S.selR.includes(r.id) ? S.selR.filter(x => !its.includes(x)) : [...new Set(S.selR.concat(its))] } else if (!S.selR.includes(r.id)) S.selR = withTheirs([r.id])
      if (!isChosen(ti)) leadTrack(ti); else S.sel = ti
      const held = (x, tr) => { const [xs, xe] = crossedAt(x, tr); return { a: x.a, b: x.b, off: x.off || 0, xs, xe } }      // as it is when taken hold of (and how much of it is shared at each end)
      const o = held(r, t)
      const cross = end ? joinsOf(t).find(([A, B]) => (end[1] === 'l' ? B === r : A === r) && xfadeOf(A, B)) : null
      if (cross) drag = { a: 'join', A: cross[0].id, B: cross[1].id, mates: mateIds(cross[0], cross[1], t), len: xfadeOf(cross[0], cross[1]), curve: cross[0].foc || 0, at: joinOf(cross[0], cross[1]), grab: pos - (joinOf(cross[0], cross[1]) - 1), before }      // where two regions crossfade, an end pulled is the join pulled: both move, the crossfade stays as long as it was
      else if (end) {
        const all = [[r, t]].concat(companions(r, t))                                 // an end pulled on a track of an edit group: the same end on the others
        drag = { a: end[1] === 'l' ? 'trimL' : 'trimR', id: r.id, o, before, also: all.slice(1).map(([x, tr]) => ({ id: x.id, o: held(x, tr) })) }
        if (shuffling()) drag.rip = all.flatMap(([x, tr]) => tr.regs.filter(y => y !== x && y.a > x.a + 1e-9).map(y => [y, y.a, y.b]))      // shuffle: what follows on the track goes along with the end
        else if (S.selR.length > 1 && S.selR.includes(r.id)) {                       // several chosen, the end of one pulled: the same end of every chosen one, by as much (as in Logic), each as far as it can go
          const have = new Set(all.map(([x]) => x.id))
          const left = end[1] === 'l', chosenIds = new Set(S.selR.concat(all.map(([x]) => x.id)))
          drag.more = selRegs().flatMap(([x, tr]) => [[x, tr]].concat(companions(x, tr))).filter(([x]) => !have.has(x.id) && (have.add(x.id), true))
            .filter(([x, tr]) => !(left ? crossBefore(x, tr) : crossAfter(x, tr)))      // (an end that is part of a crossfade stays: its join is moved by its own hand, as a key does)
            .map(([x, tr]) => ({ id: x.id, o: held(x, tr), lim: left ? Math.max(-Infinity, ...tr.regs.filter(q => q !== x && chosenIds.has(q.id) && q.b <= x.a + 1e-9).map(q => q.b)) : Math.min(Infinity, ...tr.regs.filter(q => q !== x && chosenIds.has(q.id) && q.a >= x.b - 1e-9).map(q => q.a)) }))      // (not on into another of the chosen, as the keys go)
          drag.lim = left ? Math.max(-Infinity, ...t.regs.filter(q => q !== r && chosenIds.has(q.id) && q.b <= r.a + 1e-9).map(q => q.b)) : Math.min(Infinity, ...t.regs.filter(q => q !== r && chosenIds.has(q.id) && q.a >= r.b - 1e-9).map(q => q.a))      // (the one pulled no further into another of the chosen than they go into each other)
        }
      }
      else if (S.selR.includes(r.id)) drag = { a: 'move', lead: r.id, grab: pos - (r.a - 1), ti0: ti, copy: e.altKey, before, orig: new Map(selRegs().map(([x, tr]) => [x.id, { a: x.a, b: x.b, ti: S.tracks.indexOf(tr) }])) }
    }
  } else if (tool === 'pencil') {
    const src = t.inst ? { notes: [], loop: false } : pencilSource(t)                    // (on a track of notes the pencil draws a region with nothing in it yet)
    if (!r && src && t.kind === 'audio' && !t.theirs) {
      const a = Math.max(0, snapPos(pos, e)), nr = cloneReg(src, { a: a + 1, b: a + 1 + Math.min(Math.max(1, gridStep()), src.loop || !src.srcBars ? Infinity : src.srcBars), off: src.loop ? a : 0, gain: 0, mute: false, fi: 0, fo: 0, tag: null })
      delete nr.grp; delete nr.tc; delete nr.xo
      t.regs.push(nr); S.selR = [nr.id]; leadTrack(ti)
      drag = { a: 'trimR', id: nr.id, o: { a: nr.a, b: nr.b, off: nr.off }, before, moved: true, fresh: true }
    }
  } else if (tool === 'eraser') { const ids = pick(); if (ids.length) { partCrossed(new Set(ids)); removeRegs(ids); commit(before) } }
  else if (tool === 'scissors') {                                                   // (on a track of an edit group: the group's other tracks are cut at the same place)
    const at = r ? snapPos(pos, e, new Set([r.id])) : 0
    if (r && [t].concat(groupMates(t)).map(tr => tr.regs.slice().map(x => splitReg(x, tr, at)).some(Boolean)).some(Boolean)) commit(before)
  }
  else if (tool === 'join') {
    /* the join tool: pressed on one of several chosen regions, they are made one; else the region and the one that follows
       it on its lane are — mended if they are pieces of one (on a track of an edit group: on the group's other tracks
       too, as the scissors cut them), joined if they are not */
    if (!r) { /* nothing under the hand */ }
    else if (S.selR.includes(r.id) && selRegs().filter(x => x[1] === t).length > 1) joinNow()
    else if ([[r, t]].concat(companions(r, t)).map(([x, tr]) => joinFrom(x, tr)).some(Boolean)) commit(before)
    else { const sorted = t.regs.slice().sort((x, y) => x.a - y.a), nx = sorted[sorted.indexOf(r) + 1]; if (nx) { S.selR = withTheirs([r.id, nx.id]); S.selX = null; S.focus = 'lanes'; joinNow() } }
  }
  else if (tool === 'mute') { const ids = pick(); if (ids.length) { const to = !r.mute; for (const id of ids) regOf(id)[0].mute = to; commit(before) } }
  else if (tool === 'gain') { if (r) { if (e.altKey) { r.gain = 0; dirtyReg(r); commit(before) } else { S.selR = pick(); drag = { a: 'gain', y0: p.y, before, orig: new Map((typeof grpGainIds === 'function' ? grpGainIds(r, t, S.selR) : S.selR).map(id => [id, regOf(id)[0].gain || 0])) } } } }
  else if (tool === 'fade') {
    const near = joinsOf(t).find(([A, B]) => { const x0 = bx(B.a), x1 = bx(A.b); return p.x >= Math.min(x0, x1) - 6 && p.x <= Math.max(x0, x1) + 6 })
    if (near && !e.altKey) { S.selR = []; S.selX = [near[0].id, near[1].id]; drag = { a: 'xfade', A: near[0].id, B: near[1].id, mates: mateIds(near[0], near[1], t), x0: p.x, before, moved: false } }      // across a join: a crossfade
    else if (near && xfadeOf(near[0], near[1])) { for (const [a, b] of [near].concat(joinMates(near[0], near[1], t))) uncross(a, b); commit(before) }      // with option on a crossfade: a plain join again
    else if (r && e.altKey) {                                                           // with option: that fade is taken off (one that is half of a crossfade, as the crossfade it is; on a track of an edit group, on the others too)
      const left = pos - (r.a - 1) < (r.b - r.a) / 2, pair = joinsOf(t).find(([A, B]) => xfadeOf(A, B) && (left ? B === r : A === r))
      if (pair) { for (const [a, b] of [pair].concat(joinMates(pair[0], pair[1], t))) uncross(a, b); commit(before) }
      else if (left ? r.fi : r.fo) { for (const x of [r].concat(fadeWith(r, t).filter(x => { const xt = regOf(x.id)[1]; return !(left ? crossBefore(x, xt) : crossAfter(x, xt)) }))) { if (left) x.fi = 0; else x.fo = 0; dirtyReg(x) } commit(before) }      // (one taken along whose end there is half of a crossfade keeps it, as in a drag)
    }
    else if (r) { drag = fadeGrab(r, t, pos - (r.a - 1) < (r.b - r.a) / 2, before); drag.x0 = p.x; drag.y0 = p.y }
  }
  else if (tool === 'marquee') marqStart(e, ti, pos, false)
  else if (tool === 'zoom') drag = { a: 'zoom', x0: p.x, x1: p.x }
  uiDirty('lanes', 'head', 'dock')
}
/* a region, an end, a fade or a pin taken hold of is not moved by the first twitch of the hand: with the grid pulling, a
   press that was meant to choose would otherwise carry a region that stands off the grid onto the nearest line. (`out`:
   the hand has left the place of the press. Not `live`, which the page sets at any move at all, for the turning of the
   room at its edges.) */
const DEAD_ZONE = new Set(['move', 'trimL', 'trimR', 'join', 'fade', 'gain', 'flex'])
function lanesMove (e, p) {
  const pos = barAt(p.x), d = drag
  if (!d.out && DEAD_ZONE.has(d.a) && !d.fresh) { if (d.px != null && Math.hypot(p.x - d.px, p.y - d.py) < 3) return; d.out = true }
  if (d.a === 'apt' || d.a === 'aband') { autoMove(e, p); return }
  if (d.a === 'flex') { flexMove(e, p); return }
  if (d.a === 'move') {
    const lead = d.orig.get(d.lead), vis = rows()
    let dx = Math.max(0, snapPos(pos - d.grab, e, new Set(d.orig.keys()))) - (lead.a - 1)
    for (const o of d.orig.values()) dx = Math.max(dx, -(o.a - 1))
    if (e.shiftKey && !e.ctrlKey) dx = 0                                               // shift held: only to another track, where it is in the song kept (his ask, 2026-10-19)
    let dk = vis.indexOf(laneAt(p.y)) - vis.indexOf(d.ti0)
    const dest = o => S.tracks[vis[vis.indexOf(o.ti) + dk]]
    for (const o of d.orig.values()) { const tt = dest(o); if (vis.indexOf(o.ti) < 0 || !tt || tt.kind !== 'audio' || tt.theirs !== S.tracks[o.ti].theirs || !!tt.inst !== !!S.tracks[o.ti].inst) dk = 0 }      // (one of them lies on a track that does not show — inside a closed stack: nothing changes rows then)
    if (!d.moved && (Math.abs(dx) > 1e-9 || dk)) {
      d.moved = true
      if (!d.copy) for (const tr of new Set([...d.orig.values()].map(o => S.tracks[o.ti]))) for (const [A, B] of joinsOf(tr)) if (xfadeOf(A, B) && d.orig.has(A.id) !== d.orig.has(B.id)) {      // one of a crossfaded pair is taken away from the other: they are a plain join again first (a copy leaves what stays as it is)
        uncross(A, B)
        for (const x of [A, B]) if (d.orig.has(x.id)) { const o = d.orig.get(x.id); if (x.id === d.lead) d.grab -= x.a - o.a; o.a = x.a; o.b = x.b }
      }
      if (d.copy) {
        /* what stays behind is each region as it was, crossfades and all; what is carried is the copy, and a copy leaves
           the crossfades it had with what is not carried along (it would stand late by its run-on otherwise) */
        const carried = new Set(d.orig.keys()), plain = [...d.orig.keys()].map(id => { const [r, tr] = regOf(id); return [r, plainCopy(r, tr, carried)] }), left = []
        for (const [id, o] of d.orig) { const [r] = regOf(id), c = cloneReg(r, { a: o.a, b: o.b }); S.tracks[o.ti].regs.push(c); left.push(c) }
        freshGroups(left)
        for (const [r, pc] of plain) {
          if (Math.abs(pc.a - r.a) < 1e-12 && Math.abs(pc.b - r.b) < 1e-12) continue
          const o = d.orig.get(r.id)
          if (r.id === d.lead) d.grab -= pc.a - r.a
          r.off = pc.off; r.a = pc.a; r.b = pc.b; r.fi = pc.fi; r.fo = pc.fo; if (pc.xo === undefined) delete r.xo
          o.a = r.a; o.b = r.b; dirtyReg(r)
        }
      }
    }
    for (const [id, o] of d.orig) {
      const [r, tr] = regOf(id), target = (dk ? dest(o) : null) || S.tracks[o.ti] || tr
      r.a = o.a + dx; r.b = o.b + dx
      if (target !== tr) { tr.regs = tr.regs.filter(x => x !== r); target.regs.push(r) }
    }
    d.last = [dx, dk]
  } else if (d.a === 'trimL' || d.a === 'trimR') {
    const [r] = regOf(d.id), o = d.o, s = snapPos(pos, e, new Set([d.id])), all = [[r, o]].concat((d.also || []).map(q => [regOf(q.id)[0], q.o]).filter(q => q[0]))
    if (d.a === 'trimL' && d.rip) {                                                 // shuffle: it keeps to where it begins, loses (or gains) at its head, and what follows closes up
      const far = Math.max(o.b, ...d.rip.map(x => x[2]))
      const na = clamp(s, Math.max(...all.map(([x, q]) => x.loop || x.notes ? (q.a - 1) - Math.max(0, SONG_END + 1 - far) : (q.a - 1) - q.off)), Math.min(...all.map(([, q]) => Math.max(q.a - 1, (q.b - 1) - MIN_LEN - (q.xe || 0))))), by = na - (o.a - 1)
      for (const [x, q] of all) { x.off = q.off + by; x.b = q.b - by; dirtyReg(x) }
      for (const [x, a, b] of d.rip) { x.a = a - by; x.b = b - by }
    } else if (d.a === 'trimL') {
      const na = clamp(s, Math.max(...all.map(([x, q]) => x.loop || x.notes ? 0 : Math.max(0, (q.a - 1) - q.off)), d.lim == null ? -Infinity : Math.min(o.a - 1, d.lim - 1)), Math.min(...all.map(([, q]) => Math.max(q.a - 1, (q.b - 1) - MIN_LEN - (q.xe || 0)))))      // (it stays longer than what it shares at its end; one that is shorter than that already — made at a nearer zoom — is not made longer by a pull the other way)
      for (const [x, q] of all) { x.off = q.off + (na - (q.a - 1)); x.a = na + 1; dirtyReg(x) }
    } else {
      const nb = Math.min(Math.max(s, ...all.map(([, q]) => Math.min(q.b - 1, (q.a - 1) + MIN_LEN + (q.xs || 0)))), SONG_END, ...all.map(([x, q]) => !x.loop && x.srcBars ? (q.a - 1) + (x.srcBars - q.off) : Infinity), d.lim == null ? Infinity : Math.max(o.b - 1, d.lim - 1))
      for (const [x] of all) { x.b = nb + 1; dirtyReg(x) }
      if (d.rip) for (const [x, a, b] of d.rip) { x.a = a + (r.b - o.b); x.b = b + (r.b - o.b) }
    }
    if (d.more && d.more.length) {                                                  // the other chosen ones: their same end, moved by as much as this one's, each kept to what it can be
      const by = d.a === 'trimL' ? r.a - o.a : r.b - o.b
      for (const q of d.more) {
        const [x] = regOf(q.id), w = q.o
        if (!x) continue
        if (d.a === 'trimL') { const na = clamp((w.a - 1) + by, Math.max(x.loop || x.notes ? 0 : Math.max(0, (w.a - 1) - w.off), q.lim == null ? -Infinity : Math.min(w.a - 1, q.lim - 1)), Math.max(w.a - 1, (w.b - 1) - MIN_LEN - (w.xe || 0))); x.off = w.off + (na - (w.a - 1)); x.a = na + 1 }
        else x.b = Math.min(Math.max((w.b - 1) + by, Math.min(w.b - 1, (w.a - 1) + MIN_LEN + (w.xs || 0))), SONG_END, !x.loop && x.srcBars ? (w.a - 1) + (x.srcBars - w.off) : Infinity, q.lim == null ? Infinity : Math.max(w.b - 1, q.lim - 1)) + 1
        dirtyReg(x)
      }
    }
    d.moved = true
  } else if (d.a === 'xfade') {                                                         // pulled away from the join: the crossfade is as long as twice that, about the join
    const A = regOf(d.A)[0], B = regOf(d.B)[0]
    if (!A || !B || (!d.moved && Math.abs(p.x - (d.x0 == null ? p.x : d.x0)) < 2)) return
    if (!d.moved) { const over = xfadeOf(A, B); d.moved = true; d.curve = over ? A.foc || 0 : null; d.at = joinOf(A, B); d.dh = over ? Math.abs(barAt(d.x0) - (d.at - 1)) - over / 2 : 0 }      // one that is there grows by as much as the hand moves; a new one reaches to the pointer
    const half = Math.max(0, Math.abs(fadeSnap(pos, e) - (d.at - 1)) - d.dh)
    if (!d.was) d.was = pairsOf(d).map(([a, b]) => ({ a, b, wa: { b: a.b, fi: a.fi || 0, fo: a.fo || 0, foc: a.foc || 0, xo: a.xo }, wb: { a: b.a, off: b.off || 0, fi: b.fi || 0, fo: b.fo || 0, fic: b.fic || 0 }, over: xfadeOf(a, b) }))
    for (const w of d.was) {                                                            // (each time from how the two were when taken hold of: pulled out and pushed back to nothing, two that only met are as they were — fades of their own, curves and all)
      Object.assign(w.a, w.wa); if (w.wa.xo === undefined) delete w.a.xo; Object.assign(w.b, w.wb); dirtyReg(w.a); dirtyReg(w.b)
      if (half * 2 * PXB >= 2) { joinAt(w.a, w.b, d.at); crossfade(w.a, w.b, half * 2, d.curve == null ? undefined : d.curve) }
      else if (w.over) joinAt(w.a, w.b, d.at)                                           // a crossfade pulled down to nothing: a plain join where it was made about
    }
  } else if (d.a === 'join') {                                                          // the join between two crossfaded regions goes with the hand; each keeps to the sound it has
    const A = regOf(d.A)[0], B = regOf(d.B)[0]
    if (!A || !B) return
    if (!d.was) d.was = pairsOf(d).map(([a, b]) => ({ a, b, wa: { b: a.b, fi: a.fi || 0, fo: a.fo || 0, foc: a.foc || 0, xo: a.xo }, wb: { a: b.a, off: b.off || 0, fi: b.fi || 0, fo: b.fo || 0, fic: b.fic || 0 }, len: xfadeOf(a, b), curve: a.foc || 0 }))
    for (const w of d.was) { Object.assign(w.a, w.wa); if (w.wa.xo === undefined) delete w.a.xo; Object.assign(w.b, w.wb); dirtyReg(w.a); dirtyReg(w.b) }      // (each time from how they were when taken hold of: let go where it was taken, nothing has changed)
    const lo = Math.max(...d.was.map(({ a, b }) => Math.max(a.a + MIN_LEN + (a.fi || 0), b.loop ? 1 : b.a - (b.off || 0)))), hi = Math.min(...d.was.map(({ a, b }) => Math.min(b.b - MIN_LEN - (b.fo || 0), a.loop || !a.srcBars ? Infinity : a.a + (a.srcBars - (a.off || 0)))))
    const at = lo <= hi ? clamp(snapPos(pos - (d.grab || 0), e, new Set(d.was.flatMap(({ a, b }) => [a.id, b.id]))) + 1, Math.min(lo, d.at), Math.max(hi, d.at)) : d.at      // (two that are too short to give anything at this zoom: the join stays where it is)
    d.moved = Math.abs(at - d.at) > 1e-9
    if (d.moved) for (const w of d.was) { joinAt(w.a, w.b, at); if (w.len) crossfade(w.a, w.b, w.len, w.curve); else { fitFades(w.a, regOf(w.a.id)[1]); fitFades(w.b, regOf(w.b.id)[1]) } }      // (on a track edited along with this one the same join moves; it is a crossfade there only if it was one — where the two only meet, the fades of their own must still fit in them)
  } else if (d.a === 'gain') { for (const [id, g] of d.orig) { const [r] = regOf(id); r.gain = clamp(Math.round((g - (p.y - d.y0) * .1) * 10) / 10, -30, 12); dirtyReg(r) } d.moved = true }
  else if (d.a === 'fade' && (d.mode || (d.mode = e.ctrlKey && !e.shiftKey && d.y0 != null && Math.abs(p.y - d.y0) >= Math.abs(p.x - (d.x0 != null ? d.x0 : p.x)) ? 'bend' : 'len')) === 'bend') {      // (which, said by the first move out of the dead zone)
    /* control, pulled up or down: the fade bent — up, fuller sooner; down, quieter longer (his ask, 2026-10-22) */
    const [r] = regOf(d.id)
    if (!d.bend) d.bend = { b0: fadeBend(r, d.left), y0: p.y }
    const b = clamp(Math.round((d.bend.b0 - (d.bend.y0 - p.y) / 15) * 100) / 100, -1, 1)
    for (const x of [r].concat((d.also || []).map(id => regOf(id)[0]).filter(Boolean))) { if (d.left) { x.fib = b; x.fic = 0 } else { x.fob = b; x.foc = 0 } dirtyReg(x) }
    d.moved = true
  }
  else if (d.a === 'fade') {
    const [r] = regOf(d.id), len = r.b - r.a, s = fadeSnap(pos - (d.dx || 0), e)
    if (d.left) r.fi = clamp(s - (r.a - 1), 0, fadeRoom(r, r.fo)); else r.fo = clamp((r.b - 1) - s, 0, fadeRoom(r, r.fi))
    if ((d.left ? r.fi : r.fo) * PXB < 1) { if (d.left) r.fi = 0; else r.fo = 0 }
    for (const id of d.also || []) { const [x, xt] = regOf(id); if (!x || (d.left ? crossBefore(x, xt) : crossAfter(x, xt))) continue; if (d.left) x.fi = clamp(r.fi, 0, fadeRoom(x, x.fo)); else x.fo = clamp(r.fo, 0, fadeRoom(x, x.fi)); dirtyReg(x) }      // (a companion whose end there is half of a crossfade keeps it)
    d.moved = true; dirtyReg(r)
  } else if (d.a === 'marq') { const b = Math.max(0, snapPos(pos, e)); S.marq.a = Math.min(d.p0, b); S.marq.b = Math.max(d.p0, b); S.marq.t1 = laneAt(p.y); marqMates() }
  else if (d.a === 'band') {
    const x0 = Math.min(d.x0, p.x), x1 = Math.max(d.x0, p.x), vis = rows(), k0 = vis.indexOf(laneAt(Math.min(d.y0, p.y))), k1 = vis.indexOf(laneAt(Math.max(d.y0, p.y))), a = barAt(x0), b = barAt(x1)
    S.band = { x0, x1, y0: Math.min(d.y0, p.y), y1: Math.max(d.y0, p.y) }
    const got = []
    for (let k = k0; k <= k1; k++) for (const r of S.tracks[vis[k]].regs) if (r.a - 1 < b && r.b - 1 > a) got.push(r.id)
    S.selR = withTheirs([...new Set(d.base.concat(got))])
    /* a stack's or a bus's own line is up with the lines hidden too: its points inside the band are chosen, in the
       regions' place (his ask, 2026-10-19 — a stack's points could not be taken by a drag). Only while the band holds no
       region: a band over a stack's tracks is for their regions, and a delete or a nudge then is theirs, not its line's */
    if (!d.pbase) d.pbase = S.selP.slice()
    const pts = []
    if (!got.length) for (let k = k0; k <= k1; k++) { const i = vis[k], t = S.tracks[i]; if (!lineOwn(t)) continue; const g = autoGeom(t, rowY(i), rowH(i)); for (const q of autoPts(t, g.k)) { const x = bx(q.b + 1), y = g.yOf(q.v); if (x >= x0 && x <= x1 && y >= S.band.y0 - 3 && y <= S.band.y1 + 3) pts.push(q.id) } }
    S.selP = [...new Set(d.pbase.concat(pts))]
  } else if (d.a === 'zoom') { d.x1 = p.x; S.band = { x0: Math.min(d.x0, p.x), x1: Math.max(d.x0, p.x), y0: TY, y1: TY + LANES_H } }
  uiDirty('lanes')
}
/* is a region, in these of its values, what it was when the pull began? (so that a pull that ends where it began leaves no step to undo) */
function asWas (d, r, keys) {
  for (const list of d.before.regs) for (const w of list) if (w.id === r.id) return keys.every(k => Math.abs((r[k] || 0) - (w[k] || 0)) < 1e-9)
  return false
}
function lanesUp () {
  const d = drag
  if (!d) return
  if (d.a === 'zoom') { S.band = null; if (Math.abs(d.x1 - d.x0) > 8) { const a = barAt(Math.min(d.x0, d.x1)), b = barAt(Math.max(d.x0, d.x1)); PXB = clamp((X1 - X0) / (b - a), fitPXB(), maxPXB()); VX = a; setZoom(PXB, a + (b - a) / 2) } else setZoom(PXB / 2, barAt(d.x0)) }
  else if (d.a === 'band' || d.a === 'aband') S.band = null
  else if (d.a === 'marq') {
    if (S.marq && S.marq.b - S.marq.a < MIN_LEN) { S.marq = null; if (d.cursor) { jumpTo(d.p0); uiDirty('scenes', 'top') } }
    else if (S.marq) { const ts = marqTracks(); if (ts.length && !ts.includes(S.tracks[S.sel])) { leadTrack(S.tracks.indexOf(ts[0])); uiDirty('head', 'dock') } }      // a marquee made: the leading track is one of those it lies on, as with a region pressed (what is pasted next lands there)
  }
  else if (d.a === 'xfade') {                                                           // pressed and let go: a crossfade is made where there was none (as long as takes the click out of a cut); one that is there is chosen
    const A = regOf(d.A)[0], B = regOf(d.B)[0]
    if (d.moved) { if (!(A && B && asWas(d, A, ['b', 'fo', 'foc']) && asWas(d, B, ['a', 'fi', 'fic']))) commit(d.before) }      // (pulled out and pushed back to what it was: nothing to undo)
    else if (A && B && !xfadeOf(A, B)) { for (const [a, b] of pairsOf(d)) crossfade(a, b, defaultXfade()); commit(d.before); S.selX = [A.id, B.id] }
  }
  else if (d.a === 'join') { if (d.moved) commit(d.before) }
  else if (d.a === 'flex') { if (d.moved) { const r = regOf(d.id)[0], ms = r ? (d.mates ? d.mates.map(id => regOf(id)[0]).filter(Boolean) : flexShare(r, d.keep)) : []; for (const x of ms) x.flex = (r.flex || []).map(m => Object.assign({}, m)); commit(d.before); rewarp([r].concat(ms).filter(Boolean)) } else restoreFlex(d) }      // (its mates followed it as it went: flex.js)
  else if (d.before && d.moved) {
    if (d.a === 'move') {
      if (d.last && Math.abs(d.last[0]) < 1e-9 && !d.last[1]) {                        // carried off and brought back to where it was taken up: as if it had not been touched (the crossfades it left to be carried are there again, nothing stays behind as a copy)
        const sel = S.selR.slice(), lead = S.sel, selT = S.selT.slice()
        restoreEdit(d.before); S.selR = sel.filter(id => regOf(id)[0]); S.sel = lead; S.selT = selT
        uiDirty(...EVERY); return
      }
      if (shuffling()) shuffleDrop(d)
      settle([...d.orig.keys()].map(regOf).filter(x => x[0]).map(([r, t]) => [r, t, r.a - 1, r.b - 1]))
    }
    else if (d.a === 'trimL' || d.a === 'trimR') {                                  // an edge pulled outwards covers only the stretch it gained (a region just drawn: all of it)
      const all = [{ id: d.id, o: d.o }].concat(d.also || [], d.more || [])
      if (!d.fresh && all.every(q => { const [r] = regOf(q.id); return !r || (Math.abs(r.a - q.o.a) < 1e-9 && Math.abs(r.b - q.o.b) < 1e-9) })) { uiDirty('lanes', 'dock'); return }      // (the end is where it was: nothing to undo)
      for (const q of all) {
        const [r, t] = regOf(q.id)
        if (r && d.rip) fitFades(r, t)
        else if (r) { fitFades(r, t); if (d.fresh) settle([[r, t, r.a - 1, r.b - 1]]); else if (d.a === 'trimL' && r.a < q.o.a) settle([[r, t, r.a - 1, q.o.a - 1]]); else if (d.a === 'trimR' && r.b > q.o.b) settle([[r, t, q.o.b - 1, r.b - 1]]) }
      }
    }
    else if (d.a === 'fade') { if ([d.id].concat(d.also || []).every(id => { const [r] = regOf(id); return !r || asWas(d, r, ['fi', 'fo', 'fib', 'fob', 'fic', 'foc']) })) { uiDirty('lanes', 'dock'); return } }      // (a fade bent is a change too)
    else if (d.a === 'gain') { if ([...d.orig].every(([id, g]) => { const [r] = regOf(id); return !r || (r.gain || 0) === g })) { uiDirty('lanes', 'dock'); return } }
    commit(d.before)
  }
  else if (d.a === 'move' && !d.moved && S.mode === 'spot' && S.selR.length) startRename('spot')      // spot: pressed and let go, it asks where it should begin
  liveSelX()                                                                          // (a press across a join that made no crossfade of it has not chosen one)
  uiDirty('lanes', 'dock')
}
/* the tracks an edit made without the pointer is about: under the marquee, else of what is chosen, else the chosen track */
const editTracks = () => { if (S.marq) return marqTracks().filter(t => t.kind === 'audio'); const ts = [...new Set(selRegs().map(x => x[1]))]; return ts.length ? ts : chosen().filter(t => t.kind === 'audio') }
/* where things begin on some tracks, in bars from zero and in order: each region's two ends, and inside a file the beginnings found in it */
async function stopsOf (tracks) {
  const regs = tracks.flatMap(t => t.regs)
  await Promise.all(regs.map(ensureTransients))
  const out = new Set()
  for (const r of regs) {
    const ra = r.a - 1, rb = r.b - 1
    out.add(+ra.toFixed(6)); out.add(+rb.toFixed(6))
    if (!r.loop && !r.rev) for (const s of transOf(r)) { const b = barOfD(r, sToD(r, s)); if (b > ra + 1e-4 && b < rb - 1e-4) out.add(+b.toFixed(6)) }
  }
  return [...out].sort((x, y) => x - y)
}
const nextStop = (stops, from, dir) => { if (dir > 0) return stops.find(v => v > from + 1e-4); for (let i = stops.length - 1; i >= 0; i--) if (stops[i] < from - 1e-4) return stops[i]; return undefined }
/* the cursor says what a press would do */
function lanesHover (e, p, el) {
  const tool = fadeHeld(e, p) ? 'fade' : S.tool
  let c = { pencil: 'crosshair', eraser: 'cell', scissors: 'col-resize', join: 'copy', mute: 'not-allowed', gain: 'ns-resize', fade: 'ew-resize', marquee: 'crosshair', zoom: 'zoom-in', flex: 'col-resize' }[tool] || 'default'
  if (S.auto && tool !== 'zoom' && tool !== 'marquee') c = tool === 'eraser' ? 'cell' : 'crosshair'
  else if (tool !== 'zoom' && tool !== 'marquee' && (p.y - TY + VY) < rowTops().all && onOwnLine(laneAt(p.y), p)) c = tool === 'eraser' ? 'cell' : 'crosshair'
  else if (tool === 'smart') { const ti = laneAt(p.y), r = S.flex ? hitRegion(ti, barAt(p.x)) : null; c = r && rubatoOn(r) && flexNear(r, p.x) ? 'col-resize' : SMART_CURSOR[smartZone(ti, p).z] || 'default' }
  else if (tool === 'pointer') { const ti = laneAt(p.y), r = hitRegion(ti, barAt(p.x)); if (r) c = endAt(ti, p) ? 'ew-resize' : S.flex && rubatoOn(r) && flexNear(r, p.x) ? 'col-resize' : 'grab' }
  if (el.style.cursor !== c) el.style.cursor = c
}

/* ── the keys: Steven's Logic set, read by where the key sits so a Korean keyboard changes nothing ── */
const combo = e => (e.ctrlKey ? '⌃' : '') + (e.altKey ? '⌥' : '') + (e.shiftKey ? '⇧' : '') + (e.metaKey ? '⌘' : '') + e.code
const togglePlay = () => { if (S.playing) halt(false); else play(); uiDirty('top', 'scenes') }
/* m, s and the like on a row act on every chosen row: they all go the way the first press would take them */
const flipChosen = k => { const ts = chosen(), to = !ts.every(t => t[k]); for (const t of ts) t[k] = to; applyAll(); uiDirty('head', 'lanes', 'dock') }
const pickTool = name => { S.tool = name; S.menu = null; uiDirty('info', 'menu', 'lanes') }
const say = text => { S.last = { say: text }; uiDirty('cmd') }
const KEYS = {
  Space: togglePlay, NumpadEnter: () => { if (!S.playing) togglePlay() }, Numpad0: () => { halt(true); uiDirty('top', 'scenes') }, NumpadDecimal: togglePlay, NumpadMultiply: () => record(),
  '⇧Space': () => { const sp = selSpan(); if (!sp) return; if (S.playing) jumpTo(sp[0]); else play(sp[0]); uiDirty('top', 'scenes') },
  Enter: () => goTo(0), '⌥Enter': () => goTo(songEnd()), '⌃Home': () => { const sp = selSpan(); if (sp) goTo(sp[0]) }, '⌃End': () => { const sp = selSpan(); if (sp) goTo(sp[1]) },
  KeyR: () => record(), '⌘Period': () => stopRecord(false), '⇧KeyR': () => captureNotes(),
  '⌘KeyK': () => toggleTyping(), '⌥⌘KeyS': () => newInstTrack(), '⌃⌘Period': () => { hushNotes(); say('every note off') },
  KeyK: () => toggleClick(), '⇧KeyK': () => { S.countIn = !S.countIn; say(S.countIn ? 'count-in on' : 'count-in off') },
  KeyC: () => { if (!(S.cycle.b - S.cycle.a >= MIN_LEN)) { const sc = sceneAt(curPos()); S.cycle.a = sc.a - 1; S.cycle.b = Math.min(SONG_END, sc.b - 1) } setCycle(S.cycle.a, S.cycle.b, !S.cycle.on) },
  KeyU: () => act.locators(true), '⌘KeyU': () => act.locators(false),
  KeyN: () => act.mute(),
  KeyM: () => flipChosen('mute'), KeyS: () => flipChosen('solo'),
  KeyB: () => togglePanel('patch'), KeyX: () => togglePanel('mixer'), KeyO: () => toggleSlur(),
  '⌃KeyI': () => toggleMon(S.sel),
  Semicolon: () => act.toPlayhead(false), '⇧Semicolon': () => act.toPlayhead(true),
  KeyF: () => act.fades(), KeyD: () => act.fadeTo(false), KeyG: () => act.fadeTo(true),
  '⌃⌘KeyX': () => timeAct.cut(S.cycle.a, S.cycle.b), '⌃⌘KeyZ': () => timeAct.room(S.cycle.a, S.cycle.b - S.cycle.a), '⌃⌘KeyV': () => timeAct.put(Math.max(0, snapPos(curPos(), null))), '⌃⌘KeyR': () => timeAct.repeat(S.cycle.a, S.cycle.b),
  '⌃KeyX': () => act.strip(), '⌃⌥KeyT': () => act.tempoFrom(), '⌃⌥KeyF': () => act.fitTempo(),
  '⌃⌘KeyG': () => (typeof grpMake === 'function' ? grpMake() : groupTracks()), '⇧KeyG': () => { S.grpOff = !S.grpOff; say(S.grpOff ? 'groups off' : 'groups on'); uiDirty('head') }, '⌥⌘KeyG': () => act.groupRegs(), '⌥⌘KeyU': () => act.ungroupRegs(),
  '⇧KeyD': () => act.deselect(), '⇧KeyI': () => act.invert(), '⇧KeyF': () => act.following(false), '⌃⇧KeyF': () => act.following(true), '⇧KeyL': () => act.inCycle(), '⇧KeyM': () => act.muted(), '⇧Home': () => act.edge(false), '⇧End': () => act.edge(true),
  '⌥⌘KeyT': () => act.splitAtCycle(), '⌥BracketLeft': () => act.shuffle(-1), '⌥BracketRight': () => act.shuffle(1),
  KeyT: () => { if (S.menu) { S.menu = null; uiDirty('menu') } else openToolMenu(S.px || 400, S.py || 300) },
  KeyA: () => toggleAuto(), '⌘KeyY': () => cycleAutoParam(), '⌘KeyF': () => toggleFlex(),
  KeyQ: () => act.quantize(), '⌥⌘KeyQ': () => act.dequantize(), '⌃KeyF': () => act.follow(), '⌃⇧KeyR': () => act.reverse(),
  '⌥ArrowUp': () => act.transpose(1), '⌥ArrowDown': () => act.transpose(-1), '⌥⇧ArrowUp': () => act.transpose(12), '⌥⇧ArrowDown': () => act.transpose(-12),
  '⌘KeyG': () => (typeof grpMake === 'function' ? grpMake() : groupTracks()), F1: () => setMode('shuffle'), F2: () => setMode(S.mode === 'slip' ? S.mode0 || 'smart' : 'slip'), F3: () => setMode('spot'), F4: () => setMode('grid'),      // (⌘G makes a group, as in Pro Tools; F2 goes into slip and, again, back out of it)
  '⌘ArrowRight': () => setZoom(PXB * 1.5), '⌘ArrowLeft': () => setZoom(PXB / 1.5), '⌘ArrowDown': () => setRowH(S.rh * 1.25), '⌘ArrowUp': () => setRowH(S.rh / 1.25),
  '⌘Equal': () => setWaveZoom((S.wz || 1) * 1.5), '⇧⌘Equal': () => setWaveZoom((S.wz || 1) * 1.5), '⌘NumpadAdd': () => setWaveZoom((S.wz || 1) * 1.5), '⌘Minus': () => setWaveZoom((S.wz || 1) / 1.5), '⌘NumpadSubtract': () => setWaveZoom((S.wz || 1) / 1.5),
  Home: () => scrollBy(-(X1 - X0) / PXB * .9), End: () => scrollBy((X1 - X0) / PXB * .9), PageUp: () => pageV(-1), PageDown: () => pageV(1), Backquote: () => showPlayhead(), '⇧Backquote': () => showChosen(),
  '⌃⇧KeyZ': () => { const c = S.cycle; if (c.b - c.a >= MIN_LEN) setZoom((X1 - X0) / ((c.b - c.a) * 1.1), (c.a + c.b) / 2) },
  KeyZ: () => { if (PXB > fitPXB() + .01) setZoom(0); else { const rs = selRegs(); if (rs.length) { const a = Math.min(...rs.map(x => x[0].a)) - 1, b = Math.max(...rs.map(x => x[0].b)) - 1; setZoom((X1 - X0) / Math.max(1, (b - a) * 1.2), (a + b) / 2) } } },
  '⌘KeyZ': undoEdit, '⇧⌘KeyZ': redoEdit,
  '⌘KeyA': act.selectAll, '⌘KeyC': act.copy, '⌘KeyX': act.cut, '⌘KeyV': act.paste, '⌘KeyR': act.repeat, '⌘KeyT': act.splitAtPlayhead, '⌘KeyJ': act.join, KeyJ: act.join,
  Backspace: act.del, Delete: act.del,
  ArrowLeft: () => S.marq ? act.marqStop(-1) : act.step(-1), ArrowRight: () => S.marq ? act.marqStop(1) : act.step(1),
  '⇧ArrowLeft': () => S.marq ? act.marqStop(-1, true) : act.more(-1), '⇧ArrowRight': () => S.marq ? act.marqStop(1, true) : act.more(1),
  Tab: () => act.transient(1), '⌥Tab': () => act.transient(-1), '⇧Tab': () => act.transient(1, true), '⌥⇧Tab': () => act.transient(-1, true),
  '⌃Period': () => act.transient(1), '⌃Comma': () => act.transient(-1),
  '⌘BracketLeft': () => act.trimTo(false), '⌘BracketRight': () => act.trimTo(true),
  BracketLeft: () => act.trimTo(false), BracketRight: () => act.trimTo(true),          // (the same by one key, for trimming while the song runs)
  ArrowUp: () => stepTrack(-1), ArrowDown: () => stepTrack(1), '⇧ArrowUp': () => stepTrack(-1, true), '⇧ArrowDown': () => stepTrack(1, true),
  '⌥ArrowLeft': () => act.nudge(-1), '⌥ArrowRight': () => act.nudge(1), '⌥⇧ArrowLeft': () => act.nudgeLen(-1), '⌥⇧ArrowRight': () => act.nudgeLen(1),
  '⌥⇧KeyQ': () => setNudge('tick'), '⌥⇧KeyT': () => setNudge('10 ticks'), '⌥⇧KeyS': () => setNudge('1/16'), '⌥⇧KeyB': () => setNudge('beat'), '⌥⇧KeyM': () => setNudge('bar'),
  '⌃⌥KeyS': () => setNudge('sample'), '⌃⌥Digit1': () => setNudge('1 ms'), '⌃⌥Digit0': () => setNudge('10 ms'),
  '⌃⇧ArrowUp': () => act.gain(1), '⌃⇧ArrowDown': () => act.gain(-1), '⌃⌥⇧ArrowUp': () => act.gain(.1), '⌃⌥⇧ArrowDown': () => act.gain(-.1),
  Comma: () => barStep(-1), Period: () => barStep(1), '⇧Comma': () => barStep(-8), '⇧Period': () => barStep(8),
  '⌃⇧Comma': () => { jumpTo(S.cycle.a); uiDirty('scenes') }, '⌃⇧Period': () => { jumpTo(S.cycle.b); uiDirty('scenes') },
  '⇧⌘Period': () => moveCycle(1), '⇧⌘Comma': () => moveCycle(-1), '⌥⇧⌘Period': () => scaleCycle(2), '⌥⇧⌘Comma': () => scaleCycle(.5),
  '⌥Period': () => stepMarker(1), '⌥Comma': () => stepMarker(-1), '⌃⌥KeyC': () => cycleMarker(),
  KeyV: () => { if (NAT) NAT.call('closeEditors', {}) },
  KeyL: () => act.loop(), '⌘KeyD': () => duplicateTrack(S.sel), '⌥⇧⌘KeyD': () => duplicateTrack(S.sel, true), '⇧Slash': () => toggleSheet(), '⌥KeyK': () => toggleSheet(),
  '⌥⌘KeyN': () => openNewTrack(), '⌥⌘KeyA': () => newTrack('audio'), '⌃KeyN': () => newTrack('bus'), '⌘Backspace': () => deleteTracks(chosen()), '⇧⌘Backspace': () => deleteUnused(),
  '⇧Enter': () => { if (S.focus === 'marker' && markerNow()) startRename('scene', markerNow().i); else if (S.focus !== 'tracks' && S.selR.length) startRename('region'); else startRename('track', S.sel) },
  '⇧⌘KeyD': () => makeStack(), '⇧⌘KeyU': () => { const t = S.tracks[S.sel], st = t.kind === 'stack' ? t : byId(t.parent); if (st) deleteTrack(S.tracks.indexOf(st)) },
  '⌃⌘ArrowRight': () => foldStack(true), '⌃⌘ArrowLeft': () => foldStack(false),
  '⇧⌘KeyI': () => importAudio(), '⌘KeyI': () => importAudio(), '⌘KeyS': () => { if (!NAT) return; if (PROJ.fresh && typeof saveFirst === 'function') saveFirst(); else saveNow(true).then(ok => say(ok ? 'saved' : 'could not save')) },      // (a song never given a name: the first save asks for one) '⇧⌘KeyS': () => saveAsAsk(), '⌘KeyN': () => newProject(), '⌘KeyO': () => openProjectAsk(),
  '⌘KeyB': () => { S.ho.open = !S.ho.open; S.ho.note = ''; S.ho.done = 0; uiDirty('top', 'hand') }, '⌘KeyE': () => { S.ho.what = 'stems'; S.ho.open = true; S.ho.note = ''; S.ho.done = 0; uiDirty('top', 'hand') },
  '⌃KeyB': () => bounceInPlace(), '⌘Comma': () => { if (NAT) NAT.call('audioSettings') },
  '⌥Quote': () => addScene(Math.round(curPos()) + 1), '⌥Backspace': () => { const sc = sceneAt(curPos()); if (sc.i >= 0) removeScene(sc.i) },
  '⇧Quote': () => { const sc = markerNow(); if (sc) startRename('scene', sc.i) }, '⌥⇧Quote': () => markerForChosen(),
  Slash: () => startRename('pos'), '⌥Slash': () => $('cmd').focus(),      // (/ is go to bar, as in Logic: his ask, 2026-10-22; option and / is the line at the foot)
  Escape: () => { if (S.menu) S.menu = null; else if (S.back) { S.back = null; uiDirty('back') } else if (S.newT) S.newT = null; else if (S.look) S.look = null; else if (S.sheet) { S.sheet = false; syncSlur() } else if (S.picker.open) closePicker(); else if (S.ho.open) S.ho.open = false; else { S.marq = null; S.selR = []; S.selP = []; S.selX = null; S.selT = []; S.selM = null; S.focus = 'lanes' } uiDirty('menu', 'new', 'look', 'lanes', 'head', 'scenes', 'top', 'hand', 'dock', 'sheet', 'cmd', 'info') },
}
for (let k = 1; k <= 9; k++) KEYS['Numpad' + k] = () => markerNumber(k)                 // the number pad goes to the markers by their place
function setNudge (v) { if (!NUDGES.includes(v)) return; S.nudge = v; say(`nudge ${v}`); uiDirty('top') }
function onKey (e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
  if (S.newT && !S.menu && !e.metaKey && !e.ctrlKey && !e.altKey && newTrackKey(e.code)) { e.preventDefault(); return }      // the new-track list is up: return makes them, the arrows change it
  if (S.menu && S.menu.tools && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {     // the tool menu is up: a letter picks a tool
    const t = TOOLS.find(x => x[1] === e.code)
    if (t) { e.preventDefault(); pickTool(t[0]); return }
  }
  if (e.repeat && !/^(Arrow|Comma|Period|Tab|Equal|Minus|NumpadAdd|NumpadSubtract)/.test(e.code)) { e.preventDefault(); return }  // a key held down acts once (arrows, the bar keys and tab go on)
  if (S.rec && (e.code === 'Space' || e.code === 'KeyR')) { e.preventDefault(); stopRecord(true); return }
  const f = typeof keyFor === 'function' ? keyFor(combo(e)) : KEYS[combo(e)]      // (the keys as settings > key commands has them: commands.js)
  if (f) { e.preventDefault(); f() }
}
