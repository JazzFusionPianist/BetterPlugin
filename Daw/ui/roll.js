/* ── the notes page: a region's notes against the keys; a kit's against its pads (key p; a region of notes pressed twice) ──
   The third page of the panel under the lanes. A note is drawn as the stroke its sound makes — as tall, at each moment, as
   its instrument is loud: how it rises, dies down, is held, and (fainter) rings on after the key is let go; a drum as its
   stroke for as long as it rings. Its colour says how hard it is played, in two inks: a cool one for soft, the room's own
   ink in the middle, a warm one for hard. Under the notes a lane of how hard each is; down the left the keys, in the
   track's pigment — or the kit's pads, each the drum it is. (Draft: Daw/design/midi round 2 draft, way a, colour 1.)
   Hands: a note pressed is chosen (shift: one more or less) and heard; pulled, the chosen ones go with it along the grid
   and up and down the keys (option: copies of them); its end pulled, it is longer or shorter. Pressed twice on the paper,
   a note is made there (on a kit one press makes a stroke, a stroke pressed twice goes). A pull over the paper chooses what
   it crosses. In the lane below, a bar pulled up or down is how hard. Keys while the page has the keys: delete; command
   a, c, x, v; option and the arrows move the chosen notes (shift: an octave); escape lets them go.
   The notes are the region's own (r.notes, quarter notes from its beginning) and are shown where they sound: its grid,
   its transposing and its repeats are in what is drawn. A note made or moved past the region's end makes the region
   longer, as far as the next one on the lane.
   (Read after the room's own hands are made, before they are put to work: see the end.) */
const ROLL = { lane: false, param: 'velocity', cp: new Set(), qv: '1/16', qs: 1, sw: 0, scale: 'major', root: 0, on: 'paper', rid: null, view: { a: 0, b: 8, hi: 84 }, rowH: 13, grid: '1/16', sel: new Set(), drag: null, pad: -1, vel: 100, g: null, clip: null, h: 460, hOther: 316, shown: false, last: { id: 0, at: 0 }, band: null }
const RL_RU = 16, RL_LP = 196, RL_AH = 136, RL_GRIDS = ['1/4', '1/8', '1/16', '1/32', '1/6', '1/12', '1/24']
/* what the lane under the notes can show (a: the key a pulls it up with): how hard each note is, or something turned along the region — [name, controller (128 the bend, 129 the pressure), where it rests] */
const RL_PARAMS = [['velocity', -1, 0], ['pitch bend', 128, 8192], ['modulation', 1, 0], ['sustain pedal', 64, 0], ['expression', 11, 127], ['volume', 7, 100], ['pan', 10, 64], ['breath', 2, 0], ['brightness', 74, 64], ['pressure', 129, 0]]
const RL_SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], 'harmonic minor': [0, 2, 3, 5, 7, 8, 11], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], 'major pentatonic': [0, 2, 4, 7, 9], 'minor pentatonic': [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10] }
const RL_ROOTS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const RL_CC = { 0: 'bank', 4: 'foot', 5: 'glide time', 6: 'data', 8: 'balance', 65: 'glide', 66: 'sostenuto', 67: 'soft pedal', 68: 'legato', 71: 'resonance', 72: 'release', 73: 'attack', 91: 'reverb', 93: 'chorus' }      // (names some of the other controllers go by)
const rollParam = () => { const m = /^cc (\d+)/.exec(ROLL.param); return m ? [ROLL.param, +m[1], 0] : RL_PARAMS.find(q => q[0] === ROLL.param) || RL_PARAMS[0] }
const rollSwitch = c => c >= 64 && c <= 69                                                // the pedals and switches: down or up, nothing between
/* the list of what the lane can show: the named ones, then every other controller by its number, sixteen to a list */
function rollParamMenu (x, y) {
  const pick = v => { ROLL.param = v; ROLL.cp = new Set(); uiDirty('dock') }
  openMenu(x, y - 14 - (RL_PARAMS.length + 1) * 20, RL_PARAMS.map(q => ({ t: q[0], v: q[0], on: q[0] === ROLL.param, sep: q[0] === 'pitch bend' })).concat([{ t: /^cc /.test(ROLL.param) ? ROLL.param : 'another controller', v: null, on: /^cc /.test(ROLL.param), sep: true }]), it => {
    if (it.v) { pick(it.v); return }
    setTimeout(() => openMenu(x, y - 14 - 8 * 20, [0, 16, 32, 48, 64, 80, 96, 112].map(a => ({ t: `${a} to ${a + 15}`, v: a })), it2 => {
      setTimeout(() => openMenu(x, y - 14 - 16 * 20, Array.from({ length: 16 }, (_, i) => it2.v + i).map(c => { const named = RL_PARAMS.find(q => q[1] === c); return { t: named ? `${c}  ${named[0]}` : RL_CC[c] ? `${c}  ${RL_CC[c]}` : String(c), v: named ? named[0] : `cc ${c}${RL_CC[c] ? ' ' + RL_CC[c] : ''}`, on: (named ? named[0] : `cc ${c}${RL_CC[c] ? ' ' + RL_CC[c] : ''}`) === ROLL.param } }), it3 => pick(it3.v), { w: 150 }), 0)
    }, { w: 150 }), 0)
  }, { w: 150 })
}
/* the panel's time quantize: the chosen notes (all of the region's when none is chosen) pulled to the grid — so far of the
   way, the off-beats so late — each keeping where it was played (o), so that it can be let go again. -> [the new list, how many] */
function rollQuant (r, ids, off) {
  const g = 4 / (+ROLL.qv.slice(2) || 16), qb = QB(), orgQ = ((r.a - 1) - (r.off || 0)) * qb, lo = (r.off || 0) * qb
  let k = 0
  const list = r.notes.map(x => {
    if (ids.size && !ids.has(x.id)) return x
    if (off) { if (x.o == null) return x; k++; const y = Object.assign({}, x, { t: x.o }); delete y.o; return y }
    const o = x.o == null ? x.t : x.o
    k++
    return Object.assign({}, x, { t: Math.max(lo, quantPlace(orgQ + o, g, ROLL.qs, ROLL.sw) - orgQ), o })
  })
  return [list, k]
}
/* a note cut in two at a place (bars from zero): on the page's grid where a line of it runs through the note, else just where the hand is. With others chosen besides, every chosen note the place runs through is cut there */
function rollCut (r, id, bar, e) {
  const { qb, org } = rollQ(r), snapped = rollSnap(bar, e), ids = ROLL.sel.has(id) ? new Set(ROLL.sel) : new Set([id]), lead = r.notes.find(x => x.id === id)
  if (!lead) return
  const inside = (x, q) => q > x.t + 1e-6 && q < x.t + x.d - 1e-6
  const at = inside(lead, (snapped - org) * qb) ? (snapped - org) * qb : (bar - org) * qb, made = []
  if (!inside(lead, at)) return
  const list = []
  for (const x of r.notes) { if (ids.has(x.id) && inside(x, at)) { list.push(Object.assign({}, x, { d: at - x.t })); const y = mkNote(at, x.t + x.d - at, x.n, x.v); list.push(y); made.push(y.id) } else list.push(x) }
  edit(() => { setNotes(r, list) })
  ROLL.sel = new Set(made); say(`${made.length} ${made.length === 1 ? 'note' : 'notes'} cut`); uiDirty('dock', 'lanes')
}
/* force legato: each chosen note (every note of the region when none is chosen) lasts until the next of them begins — longer
   or shorter, as that asks; notes that begin together last equally long; the last is left as it is */
function rollLegato (r) {
  const pick = r.notes.filter(x => !ROLL.sel.size || ROLL.sel.has(x.id)), starts = [...new Set(pick.map(x => +x.t.toFixed(6)))].sort((a, b) => a - b)
  let k = 0
  const ids = new Set(pick.map(x => x.id)), list = r.notes.map(x => { if (!ids.has(x.id)) return x; const nx = starts.find(t => t > x.t + 1e-6); if (nx == null || Math.abs(nx - x.t - x.d) < 1e-6) return x; k++; return Object.assign({}, x, { d: nx - x.t }) })
  if (k) edit(() => { setNotes(r, list) })
  say(k ? `${k} ${k === 1 ? 'note' : 'notes'} to the next` : pick.length < 2 ? 'choose two notes or more' : 'they already reach the next'); uiDirty('dock', 'lanes')
}
/* the same as a thing done (the panel's q, the q key while the page has the keys): the chosen notes to the panel's grid, or back to where they were played */
function rollQuantDo (r, off) { const [list, n] = rollQuant(r, ROLL.sel, off); if (n) edit(() => { setNotes(r, list) }); say(!n ? 'nothing to quantize' : off ? `${n} ${n === 1 ? 'note' : 'notes'} as played` : `${n} ${n === 1 ? 'note' : 'notes'} to ${ROLL.qv}`); uiDirty('dock', 'lanes') }
const rollQuanted = (r, ids) => { const pick = r ? r.notes.filter(x => !ids.size || ids.has(x.id)) : []; return pick.length > 0 && pick.every(x => x.o != null) }
const rollTop = c => c === 128 ? 16383 : 127                                             // the most a controller can say
const rollOn = () => S.panel.on && S.panel.tab === 'notes'
const rollBlack = p => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12)
const rollStep = () => WHOLE() / (+ROLL.grid.slice(2) || 16)                             // the page's grid, in bars
/* how hard, as a colour: two inks — cool when soft, the room's own ink between, warm when hard */
const RL_INKS = [[0, .42, .12, 262], [.3, .62, .085, 236], [.55, .90, .02, 95], [.78, .78, .13, 62], [1, .655, .19, 33]]
function rollColor (v) {
  const f = clamp((v - 1) / 126, 0, 1), st = RL_INKS
  let k = 0
  while (k < st.length - 2 && f > st[k + 1][0]) k++
  const p = st[k], q = st[k + 1], u = clamp((f - p[0]) / (q[0] - p[0]), 0, 1)
  return oklch(lerp(p[1], q[1], u), lerp(p[2], q[2], u), lerp(p[3], q[3], u))
}
/* the region the page shows: the chosen one if it holds notes, else the one under the playhead on the chosen track, else the one it showed, else the track's first */
function rollReg () {
  const t = S.tracks[S.sel]
  if (!t || !isInst(t)) return [null, t || null]
  for (const id of S.selR) { const [r, tr] = regOf(id); if (r && r.notes && tr === t) return [r, t] }
  const pos = curPos(), own = t.regs.filter(q => q.notes)
  return [own.find(q => pos >= q.a - 1 && pos < q.b - 1) || own.find(q => q.id === ROLL.rid) || own.slice().sort((x, y) => x.a - y.a)[0] || null, t]
}
const rollKit = t => !!t && isInst(t) && t.inst.kind === 'drums'
/* the view laid on a region: from a little before its beginning, as many bars as read well; the keys about its notes */
function rollFit (r, t) {
  const V = ROLL.view, a = r ? r.a - 1 : Math.floor(curPos()), len = r ? r.b - r.a : 4
  const span = clamp(len + .5, 2.5, 8.5)
  V.a = a - .25; V.b = V.a + span
  if (r && r.notes.length && !rollKit(t)) { const ns = regSound(r).map(x => x.n); if (ns.length) { const lo = Math.min(...ns), hi = Math.max(...ns); V.hi = clamp(Math.round((lo + hi) / 2) + 12, 24, 127) } }
  ROLL.sel = new Set(); ROLL.cp = new Set(); ROLL.rid = r ? r.id : null
}
/* how loud a note of this instrument is from the moment its key goes down (seconds): rise, fall, held level, ring */
function rollEnv (I) {
  if (!I || I.kind === 'plug' || I.kind === 'drums') return { A: 0, D: 1, S: 1, R: 0 }
  const p = instParams(I)
  return I.kind === 'sampler' ? { A: p.a == null ? .002 : p.a, D: p.d == null ? .3 : p.d, S: p.s == null ? 1 : p.s, R: p.r == null ? .12 : p.r } : { A: p.aA == null ? .004 : p.aA, D: p.aD == null ? .4 : p.aD, S: p.aS == null ? .8 : p.aS, R: p.aR == null ? .25 : p.aR }
}
function rollStroke (xa, xb, cy, half, env, pps, col, fa) {
  const { A, D, S: su, R: rl } = env, floor = .22, top = [], bot = [], step = 2
  const at = t => t < A ? t / Math.max(1e-4, A) : su + (1 - su) * Math.exp(-(t - A) / Math.max(.02, D / 3))
  const w = Math.max(2, xb - xa)
  for (let x = 0; ; x = Math.min(w, x + step)) { const e = Math.max(floor, at(x / pps)) * half; top.push(`${n(xa + x)} ${n(cy - e)}`); bot.push(`${n(xa + x)} ${n(cy + e)}`); if (x >= w) break }
  let s = P('M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z', { fill: col, fa })
  const e1 = Math.max(floor, at(w / pps)), tail = Math.min(rl * 1.6, 3) * pps
  if (rl > .03 && tail > 3) {
    const tt = [], bb = []
    for (let x = 0; ; x = Math.min(tail, x + step)) { const e = e1 * Math.exp(-(x / pps) / (rl / 3)) * half; tt.push(`${n(xb + x)} ${n(cy - e)}`); bb.push(`${n(xb + x)} ${n(cy + e)}`); if (x >= tail || e < .35) break }
    s += P('M' + tt.join('L') + 'L' + bb.reverse().join('L') + 'Z', { fill: col, fa: fa * .42 })
  }
  return s
}
function rollHit (xa, cy, half, name, decay, pps, col, xStop, fa) {
  const sec = 2.4, N = 160, vals = drumStroke(name, decay, N, sec), top = [], bot = []
  for (let i = 0; i < N; i++) { const t = sec * (i / (N - 1)) ** 2, x = xa + t * pps, e = vals[i] * half; if (x > xStop || (i > 3 && vals[i] < .035)) break; top.push(`${n(x)} ${n(cy - Math.max(.5, e))}`); bot.push(`${n(x)} ${n(cy + Math.max(.5, e))}`) }
  return top.length < 2 ? '' : P('M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z', { fill: col, fa })
}

/* ── drawing ── */
const rlHit = (x, y, w, h, k, more = '', cur = 'default') => hit(x, y, w, h, 'np', ` data-k="${k}"${more}`, cur)
function rollHead (y) {
  const t = S.tracks[S.sel], by = y + 16.6, [r] = rollReg()
  let s = R(0, y, RX, PH, { fill: K2 }) + hline(0, RX, y, .14) + hline(0, RX, y + PH - .5, .08)
  s += R(RX / 2 - 12, y + 2, 24, 2, { rx: 1, fill: INK, fa: .2 }) + hit(0, y - 3, RX, 8, 'pgrip', '', 'ns-resize')
  const said = typeof pPrompt === 'function'                                           // (prompt.js: a fourth page, the prompt)
  s += cells(10, y + 4, 18, [{ t: 'patch', a: 'tab-patch' }, { t: 'mixer', a: 'tab-mixer' }, { t: 'notes', on: true, a: 'tab-notes' }].concat(said ? [{ t: 'prompt', a: 'tab-prompt' }] : [], typeof pRubato === 'function' ? [{ t: 'rubato', a: 'tab-rubato' }] : []), { size: 9.5, widths: [48, 48, 48].concat(said ? [52] : [], typeof pRubato === 'function' ? [52] : []) })[0]
  if (!t) return s
  const nx = (said ? 220 : 168) + (typeof pRubato === 'function' ? 52 : 0), nm = fit(asGiven(t.name), 160, 10.5, 500)
  s += R(nx, y + 10, 6, 6, { fill: t.c }) + T(nx + 12, by, nm, { size: 10.5, w: 500 })
  let ax = nx + 12 + tw(nm, 10.5, 500) + 7
  if (r) { const nmR = asGiven(r.tag || r.name || 'region'); s += T(ax, by, fit(nmR, 160, 9.5), { size: 9.5, a: .7 }); ax += tw(fit(nmR, 160, 9.5), 9.5) + 8; s += T(ax, by, `bars ${+r.a.toFixed(2)} to ${+r.b.toFixed(2)}`, { size: 9.5, a: .4 }) }
  else if (!isInst(t)) s += T(ax, by, 'a track of sound', { size: 9.5, a: .4 })
  const g = ROLL.grid, mw = Math.round(tw(g, 9.5) + 26), fx = RX - 14 - mw
  s += menuKey(fx, y + 4, g, { a: 'np', more: ' data-k="grid"' })[0] + T(fx - tw('grid', 9.5) - 6, by, 'grid', { size: 9.5, a: .4 })
  if (ROLL.sel.size) s += T(fx - tw('grid', 9.5) - 24, by, `${ROLL.sel.size} chosen`, { size: 9.5, a: .5, anchor: 'end' })
  return s
}
function pRoll (y, h) {
  const [r, t] = rollReg(), inst = !!t && isInst(t), kit = rollKit(t)
  if ((r ? r.id : null) !== ROLL.rid || ROLL.tid !== (t ? t.id : 0)) { rollFit(r, t); ROLL.tid = t ? t.id : 0 }
  const LP = RL_LP, KW = kit ? 128 : 54, x0 = LP + KW, x1 = RX, top = y + RL_RU, laneH = ROLL.lane ? Math.min(RL_AH, Math.floor((h - RL_RU) * .42)) : 0, bot = y + h - laneH, gh = bot - top, V = ROLL.view
  const pxb = (x1 - x0) / (V.b - V.a), X = bar => x0 + (bar - V.a) * pxb, pps = pxb / SPB()
  const rowH = kit ? clamp(Math.floor(gh / DRUM_PADS.length), 12, 26) : ROLL.rowH, count = kit ? DRUM_PADS.length : Math.max(1, Math.floor(gh / rowH))
  if (!kit) V.hi = clamp(Math.round(V.hi), count - 1, 127)
  const hi = kit ? 0 : V.hi, lo = hi - count + 1
  const rowOfKey = p => kit ? (() => { const i = DRUM_PADS.findIndex(q => q[1] === p); return i < 0 ? -1 : DRUM_PADS.length - 1 - i })() : hi - p
  const Y = p => top + rowOfKey(p) * rowH, gb = top + count * rowH
  const noteCur = S.tool === 'scissors' && !kit ? 'col-resize' : S.tool === 'eraser' ? 'cell' : S.tool === 'velocity' ? 'ns-resize' : 'grab'
  const cid = 'rl' + (++UID), L = r ? regLook(r, t) : { c: t ? t.c : INK, deep: t ? t.deep : K0, sel: t ? t.csel : INK }, env = rollEnv(inst ? t.inst : null), step = rollStep()
  ROLL.g = { y, h, x0, x1, top, bot, gb, rowH, count, hi, pxb, kit, KW, LP, laneH, base: y + h - 9, room: Math.max(10, laneH - 24) }
  let s = R(0, y, RX, h, { fill: K0 }) + `<clipPath id="${cid}"><rect x="${x0}" y="${n(y)}" width="${n(x1 - x0)}" height="${n(h)}"/></clipPath>`
  let g = '', hits = rlHit(x0, top, x1 - x0, gb - top, 'paper'), out = ''                // (hits: on the paper, cut with it; out: the ruler's and the keys')
  /* the paper: the rows of the white keys a breath lighter, a hairline under every c; for a kit a hairline under every pad */
  if (kit) { let d = ''; for (let k = 1; k <= count; k++) d += `M${x0} ${top + k * rowH - .5}H${x1}`; g += P(d, { stroke: INK, sa: .045 }) }
  else if (inst) for (let p = hi; p >= lo; p--) { if (!rollBlack(p)) g += R(x0, Y(p), x1 - x0, rowH, { fill: INK, fa: .022 }); if (((p % 12) + 12) % 12 === 0) g += hline(x0, x1, Y(p) + rowH - 1, .1) }
  /* the grid: bars, beats, and the page's own division while its lines have room */
  { let bars = '', beats = '', steps = ''
    const bt = 1 / BEATS(), fine = step * pxb >= 6 ? step : bt * pxb >= 6 ? bt : 1
    for (let k = Math.floor(V.a / fine); k * fine <= V.b + 1e-9; k++) { const p = k * fine, x = n(X(p)) + .5; if (x < x0) continue; const ln = `M${x} ${top}V${gb}`, inBar = p - Math.floor(p + 1e-9); if (inBar < 1e-6 || 1 - inBar < 1e-6) bars += ln; else if (Math.abs(inBar / bt - Math.round(inBar / bt)) < 1e-6) beats += ln; else steps += ln }
    g += P(steps, { stroke: INK, sa: kit ? .04 : .025 }) + P(beats, { stroke: INK, sa: kit ? .085 : .06 }) + P(bars, { stroke: INK, sa: .17 }) }
  /* its notes; and, fainter, what the lane holds on either side of the region */
  const draw = (q, own) => {
    let out = '', ring = ''
    const list = regSound(q)
    for (let k = 0; k < list.length; k++) {
      const x = list[k], row = rowOfKey(x.n)
      if (row < 0 || row >= count) continue
      const xa = X(x.a), on = own && ROLL.sel.has(x.id), col = rollColor(x.v), fa = own ? 1 : .28, f = clamp((x.v - 1) / 126, 0, 1), yy = Y(x.n), cy = yy + rowH / 2
      if (kit) {
        const pad = DRUM_PADS.find(q2 => q2[1] === x.n), cellW = Math.max(6, step * pxb), dec = (t.inst.p || {})[`${pad[0]}.decay`]
        if (xa + 280 < x0 || xa > x1) continue
        let stop = 1e9
        for (let j = k + 1; j < list.length; j++) if (list[j].n === x.n) { stop = X(list[j].a) - 1.5; break }
        out += rollHit(xa + .5, cy, (rowH / 2 - 2.5) * (.4 + .6 * f), pad[0], dec, pps, col, stop, fa)
        if (on) ring += R(xa - 1, yy + 1.5, Math.min(cellW, stop - xa) + 1, rowH - 3, { stroke: INK })
        if (own) hits += rlHit(xa, yy, Math.max(6, Math.min(cellW, stop - xa + 1.5)), rowH, 'note', ` data-i="${x.id}"`, noteCur)
        continue
      }
      const xb = X(x.b), w = Math.max(2.5, xb - xa - 1)
      if (xa + w + 240 < x0 || xa > x1) continue
      out += rollStroke(xa + .5, xa + .5 + w, cy, (rowH / 2 - .5) * (.66 + .34 * f), env, pps, col, fa)
      if (on) ring += R(xa - 1, yy - .5, w + 3, rowH + 1, { stroke: INK })
      if (own) { hits += rlHit(xa, yy, Math.max(4, w + 1), rowH, 'note', ` data-i="${x.id}"`, noteCur); if (w >= 10 && noteCur === 'grab') hits += rlHit(xa + w - 4, yy, 6, rowH, 'len', ` data-i="${x.id}"`, 'ew-resize') }
    }
    return out + ring
  }
  if (inst) for (const q of t.regs) if (q.notes && q !== r) g += draw(q, false)
  if (r) {
    const xa = X(r.a - 1), xb = X(r.b - 1)
    g += draw(r, true)
    if (xa > x0) g += R(x0, top, xa - x0, gb - top, { fill: K1, fa: .62 })                 // outside the region the page is dimmed: what is edited is the region
    if (xb < x1) g += R(xb, top, x1 - xb, gb - top, { fill: K1, fa: .62 })
    g += P(`M${n(xa) + .5} ${top}V${y + h}M${n(xb) + .5} ${top}V${y + h}`, { stroke: INK, sa: .3 })
  }
  if (ROLL.band) { const b = ROLL.band; g += R(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0), { fill: INK, fa: .06, stroke: INK, sa: .5 }) }
  if (laneH) { const o = rollLane(r, t, X, x0, x1, bot, laneH); g += o[0]; hits += o[1] }
  { const px = X(curPos()); g += `<g id="np-ph" transform="translate(${n(px)} 0)"${px >= x0 && px <= x1 ? '' : ' visibility="hidden"'}>` + P(`M.5 ${y}V${y + h}`, { stroke: INK }) + '</g>' }
  const paper = G(g, '', ` clip-path="url(#${cid})"`)
  s += paper
  /* the bars along the top, and the region's own stretch marked on them */
  s += R(0, y, RX, RL_RU, { fill: K1 }) + hline(0, RX, y + RL_RU - .5, .1)
  { const every = [1, 2, 4, 8].find(k => k * pxb >= 44) || 8
    for (let b = Math.ceil(V.a); b <= V.b; b++) { const x = X(b); if (x < x0 || x > x1 - 12) continue; s += P(`M${n(x) + .5} ${y + (b % every ? 10 : 3)}V${y + RL_RU}`, { stroke: INK, sa: .22 }); if (b % every === 0) s += T(x + 4, y + 11, String(b + 1), { size: 8.5, a: .5 }) } }
  if (r) s += R(Math.max(x0, X(r.a - 1)), y + RL_RU - 3, Math.max(0, Math.min(x1, X(r.b - 1)) - Math.max(x0, X(r.a - 1))), 2, { fill: L.c })
  out += rlHit(x0, y, x1 - x0, RL_RU, 'ruler', '', 'pointer')
  /* down the left: the keys, as the instrument's own (its pigment, dark keys cut in) — or the kit's pads, each the drum it is */
  let kc = R(0, y, KW, h, { fill: K1 }), kh = ''
  if (kit) {
    DRUM_PADS.forEach(([name, key], i) => {
      const ry = top + (DRUM_PADS.length - 1 - i) * rowH, on = i === ROLL.pad, pw = 38, ph = rowH - 4
      if (on) kc += R(0, ry, KW, rowH, { fill: INK, fa: .07 })
      kc += R(8, ry + 2, pw, ph, { rx: 1.5, fill: on ? L.sel : L.c }) + PIC.pic(name, 8, ry + 2, pw, ph, L.deep, on ? L.sel : L.c, 1.5)
      kc += T(8 + pw + 9, ry + rowH / 2 + 3.2, name, { size: 9, a: on ? 1 : .7, w: on ? 500 : 400 }) + hline(0, KW, ry + rowH - .5, .045)
      kh += rlHit(0, ry, KW, rowH, 'key', ` data-v="${key}"`, 'pointer')
    })
  } else if (inst) {
    const bwid = Math.round(KW * .6), held = typeof TYPE !== 'undefined' ? new Set(TYPE.down.values()) : new Set()
    let whites = R(0, top, KW, count * rowH, { fill: L.c }), blacks = '', seams = ''
    for (let p = hi; p >= lo; p--) {
      const ry = Y(p), pc = ((p % 12) + 12) % 12
      if (rollBlack(p)) { blacks += R(0, ry, bwid, rowH, { fill: L.deep }); seams += `M${bwid} ${n(ry + rowH / 2)}H${KW}` }
      else if (pc === 4 || pc === 11) seams += `M0 ${ry}H${KW}`                          // (e and b have no black key above them: their upper edge is a seam all the way across)
      if (held.has(p) || ROLL.key === p) whites += R(rollBlack(p) ? 0 : bwid, ry, rollBlack(p) ? bwid : KW - bwid, rowH, { fill: L.sel })
      if (pc === 0) blacks += T(KW - 5, ry + rowH - 2.4, keyName(p), { size: 7.5, w: 500, c: L.deep, anchor: 'end' })
      kh += rlHit(0, ry, KW, rowH, 'key', ` data-v="${p}"`, 'pointer')
    }
    kc += whites + P(seams, { stroke: L.deep, sa: .55 }) + blacks
  }
  kc += vline(KW - .5, y, y + h, .12)
  const side = rollSide(y, h, r, t, bot, laneH, kit)
  s += G(kc, `translate(${LP} 0)`) + side[0]
  out += G(kh, `translate(${LP} 0)`) + side[1]
  return s + G(hits, '', ` clip-path="url(#${cid})"`) + out
}

/* the lane under the notes: how hard each note is played (a bar under it, in the note's own colour), or something turned
   along the region — its points, the line between them, the stretch under the line; a pedal is down or up. -> [drawing, hands] */
function rollLane (r, t, X, x0, x1, ly, lh) {
  const [, c, rest] = rollParam(), base = ly + lh - 9, room = Math.max(10, lh - 24), topV = rollTop(c), Yv = v => base - room * clamp(v / topV, 0, 1)
  let g = R(x0, ly, x1 - x0, lh, { fill: K0 }) + hline(x0, x1, ly, .14) + hline(x0, x1, base - room, .045) + hline(x0, x1, base - room / 2, c === 128 || c === 10 ? .1 : .03) + hline(x0, x1, base, .08), hits = ''
  if (c < 0) {
    if (r) for (const x of regSound(r)) { const xa = X(x.a), hg = Math.max(2, room * x.v / 127), on = ROLL.sel.has(x.id), col = rollColor(x.v); if (xa < x0 - 4 || xa > x1) continue; g += R(xa + .5, base - hg, 3, hg, { fill: col }) + R(xa + .5, base - hg, 7, 2, { fill: col }) + (on ? R(xa - 1.5, base - hg - 2, 11, hg + 3, { stroke: INK, sa: .8 }) : '') }
    return [g, rlHit(x0, ly + 2, x1 - x0, lh - 4, 'vel', '', 'ns-resize')]
  }
  hits = rlHit(x0, ly + 2, x1 - x0, lh - 4, 'clane', '', 'crosshair')
  if (!r) return [g, hits]
  const qb = QB(), org = (r.a - 1) - (r.off || 0), xa = X(r.a - 1), xb = X(r.b - 1), pts = (r.ctl || []).filter(q => q.c === c).slice().sort((a, b) => a.t - b.t), step = rollSwitch(c), L = regLook(r, t)
  if (pts.length) {
    let d = '', lastY = Yv(pts[0].v)
    pts.forEach((q, i) => { const x = X(org + q.t / qb), yy = Yv(step ? (q.v >= 64 ? topV : 0) : q.v); d += i ? (step ? `H${n(x)}V${n(yy)}` : `L${n(x)} ${n(yy)}`) : `M${n(x)} ${n(yy)}`; lastY = yy })
    const x1p = X(org + pts[0].t / qb), end = Math.max(xb, X(org + pts[pts.length - 1].t / qb))
    g += P(d + `H${n(end)}V${n(base)}H${n(x1p)}Z`, { fill: L.c, fa: .16 }) + P(d + `H${n(end)}`, { stroke: L.c, sw: 1.5 })
    for (const q of pts) { const x = X(org + q.t / qb), yy = Yv(step ? (q.v >= 64 ? topV : 0) : q.v), on = ROLL.cp.has(q.id); if (x < x0 - 6 || x > x1 + 6) continue; g += R(x - (on ? 4 : 3), yy - (on ? 4 : 3), on ? 8 : 6, on ? 8 : 6, { fill: K0 }) + R(x - (on ? 3 : 2), yy - (on ? 3 : 2), on ? 6 : 4, on ? 6 : 4, { fill: on ? INK : L.sel }); hits += rlHit(x - 6, yy - 6, 12, 12, 'cpt', ` data-i="${q.id}"`, 'grab') }
  } else g += P(`M${n(Math.max(x0, xa))} ${n(Yv(rest)) + .5}H${n(Math.min(x1, xb))}`, { stroke: INK, sa: .22, dash: '2 3' })      // nothing turned yet: where it rests
  return [g, hits]
}
/* the panel at the left: the region's quantize (its grid, how far, how late the off-beats), the keys of a scale, how hard
   the chosen notes are; at its foot the lane's own key and what the lane shows. -> [drawing, hands] */
function rollSide (y, h, r, t, bot, laneH, kit) {
  const W0 = RL_LP, x = 14, w = W0 - 28, inst = !!t && isInst(t)
  let s = R(0, y, W0, h, { fill: K1 }) + vline(W0 - .5, y, y + h, .12) + rlHit(0, y, W0, h, 'none'), hits = ''      // (the panel takes the presses that land on none of its keys)
  const word = (yy, text) => T(x, yy, text, { size: 9, a: .34 })
  const line = (yy, name, f, val, k) => T(x, yy + 3.4, name, { size: 9.5, a: .46 }) + R(x + 58, yy - 1, w - 58 - 30, 2, { fill: INK, fa: .12 }) + R(x + 58, yy - 1, (w - 58 - 30) * clamp(f, 0, 1), 2, { fill: INK, fa: .5 }) + R(x + 58 + (w - 58 - 30) * clamp(f, 0, 1) - 1, yy - 5, 2, 10, { fill: INK }) + T(x + w, yy + 3.4, val, { size: 9.5, a: .9, anchor: 'end' }) + rlHit(x + 52, yy - 9, w - 58 - 30 + 12, 18, k, '', 'ew-resize')
  ROLL.side = { x: x + 58, w: w - 58 - 30 }
  let cy = y + RL_RU + 14
  if (inst) {
    const on = rollQuanted(r, ROLL.sel), qs = ROLL.qs, sw = ROLL.sw, dim = !r
    s += word(cy, 'time quantize'); cy += 8
    s += menuKey(x, cy, ROLL.qv, { a: 'np', more: ' data-k="qgrid"', dim })[0] + key(x + w - 24, cy, 'q', { armed: on, pad: 8, a: 'np', more: ' data-k="qon"', dim })[0]; cy += 32
    s += line(cy, 'strength', qs, String(Math.round(qs * 100)), 'qs'); cy += 22
    s += line(cy, 'swing', sw, String(Math.round(sw * 100)), 'sw'); cy += 30
    if (!kit) {
      s += word(cy, 'scale quantize'); cy += 8
      const rk = menuKey(x, cy, RL_ROOTS[ROLL.root], { a: 'np', more: ' data-k="root"' }), sk = menuKey(x + rk[1] + 6, cy, fit(ROLL.scale, w - rk[1] - 6 - 30 - 26, 9.5), { a: 'np', more: ' data-k="scale"' })
      s += rk[0] + sk[0] + key(x + w - 24, cy, 'q', { pad: 8, a: 'np', more: ' data-k="sq"', dim })[0]; cy += 40
    }
    const lead = r && r.notes.find(q => ROLL.sel.has(q.id)), v = lead ? lead.v : ROLL.vel
    s += word(cy, 'velocity'); cy += 14
    s += line(cy, ROLL.sel.size ? 'chosen' : 'new notes', v / 127, String(v), 'nvel'); cy += 24
  }
  /* at its foot: the lane's key, and — while the lane is up — what it shows */
  const fy = laneH ? bot + 10 : y + h - 30
  s += hline(0, W0, fy - 10, laneH ? .14 : .08)
  s += cells(x, fy, 18, [{ t: 'automation', k: 'a', on: ROLL.lane, a: 'np', more: ' data-k="lane"' }], { size: 9.5 })[0]
  if (laneH) {
    s += menuKey(x, fy + 28, fit(ROLL.param, w - 30, 9.5), { a: 'np', more: ' data-k="param"' })[0]
    const c = rollParam()[1], n0 = r ? (r.ctl || []).filter(q => q.c === c).length : 0
    if (c < 0) { const room = Math.max(10, laneH - 24), base = y + h - 9; for (let k = 0; k < room; k++) s += R(W0 - 12, base - k - 1, 5, 1.2, { fill: rollColor(1 + 126 * k / (room - 1)) }) }
    else if (fy + 66 < y + h) s += T(x, fy + 62, n0 ? `${n0} ${n0 === 1 ? 'point' : 'points'}` : 'nothing turned yet', { size: 9, a: .34 })
  }
  return [s, hits]
}
/* the notes of a region pulled onto the keys of a scale: each to the nearest key of it (of two as near, the lower) */
function rollToScale (r, ids) {
  const set = RL_SCALES[ROLL.scale] || RL_SCALES.major, ok = k => set.includes((((k - ROLL.root) % 12) + 12) % 12), tr = r.tr || 0
  const near = k => { for (let d = 0; d < 7; d++) { if (ok(k - d) && k - d >= 0) return k - d; if (ok(k + d) && k + d <= 127) return k + d } return k }
  let moved = 0
  const list = r.notes.map(x => { if (ids.size && !ids.has(x.id)) return x; const to = near(x.n + tr) - tr; if (to === x.n) return x; moved++; return Object.assign({}, x, { n: to }) })
  if (moved) edit(() => { setNotes(r, list) })
  say(moved ? `${moved} ${moved === 1 ? 'note' : 'notes'} to ${RL_ROOTS[ROLL.root]} ${ROLL.scale}` : `all in ${RL_ROOTS[ROLL.root]} ${ROLL.scale}`)
  uiDirty('dock', 'lanes')
}
const rollSetCtl = (r, list) => { r.ctl = list.slice().sort((a, b) => a.t - b.t); dirtyReg(r) }

/* ── what is done to the notes ── */
const rollQ = r => { const qb = QB(), org = (r.a - 1) - (r.off || 0); return { qb, org, toQ: bar => (bar - org) * qb, limit: rollLimit(r) } }
/* how far a region may grow: to the next region on its lane, or the song's end (bars from zero) */
function rollLimit (r) { const [, t] = regOf(r.id); let lim = SONG_END; if (t) for (const q of t.regs) if (q !== r && q.a > r.a && q.a - 1 < lim) lim = q.a - 1; return lim }
/* the region covers its notes: longer by whole bars when one ends past it (never past the limit) */
function rollGrow (r) {
  const { qb, org, limit } = rollQ(r)
  let end = r.b - 1
  for (const x of r.notes) { const e = org + (x.t + x.d) / qb; if (e > end + 1e-9) end = e }
  const b = Math.min(limit, Math.ceil(end - 1e-9)) + 1
  if (b > r.b) { r.b = b; dirtyReg(r) }
}
const rollSnap = (bar, e) => { if (e && e.ctrlKey && e.shiftKey) return bar; const st = e && e.ctrlKey ? rollStep() / 4 : rollStep(); return Math.round(bar / st) * st }
const rollAt = p => { const g = ROLL.g; return { bar: ROLL.view.a + (p.x - g.x0) / g.pxb, row: Math.floor((p.y - g.top) / g.rowH) } }
const rollKeyOfRow = row => { const g = ROLL.g; return g.kit ? (DRUM_PADS[DRUM_PADS.length - 1 - clamp(row, 0, DRUM_PADS.length - 1)] || DRUM_PADS[0])[1] : clamp(g.hi - row, 0, 127) }
function rollHear (key, v) { if (S.playing) return; syncLive(); playKey(0x90, key, v || ROLL.vel); setTimeout(() => playKey(0x80, key, 0), 160) }
/* a note made at a place (bars from zero) on a key as it sounds; the region is made first where the track has none there */
function rollMake (bar, key, e) {
  let [r, t] = rollReg()
  if (!t || !isInst(t) || t.theirs) return null
  const st = rollStep(), at = Math.max(0, Math.floor(bar / st + 1e-9) * st)
  let made = null
  edit(() => {
    if (!(r && at >= r.a - 1 - 1e-9 && at < rollLimit(r) - 1e-9)) {                      // not where the region shown is or may grow to
      const other = t.regs.find(q => q.notes && at >= q.a - 1 - 1e-9 && at < q.b - 1 - 1e-9)
      if (other) r = other                                                               // another region of notes lies there: it goes into that one
      else {                                                                             // none: a bar of its own, if the lane is free there
        const a = Math.floor(at + 1e-9) + 1
        if (t.regs.some(q => q.a < a + 1 - 1e-9 && q.b > a + 1e-9)) return false
        r = mkReg({ a, b: a + 1, loop: false, notes: [] }); t.regs.push(r)
      }
      S.selR = [r.id]; ROLL.rid = r.id
    }
    const { toQ } = rollQ(r), note = mkNote(toQ(at), Math.max(.05, st * QB()), clamp(key - (r.tr || 0), 0, 127), ROLL.vel)
    setNotes(r, r.notes.concat([note])); rollGrow(r)
    made = note
  })
  if (made) { ROLL.sel = new Set([made.id]); rollHear(key, ROLL.vel); uiDirty('dock', 'lanes') }
  return made
}
function rollDelete (ids) {
  const [r] = rollReg()
  if (!r || !ids.size) return
  edit(() => { setNotes(r, r.notes.filter(x => !ids.has(x.id))) })
  ROLL.sel = new Set(); uiDirty('dock', 'lanes')
}
/* the chosen notes moved by so many quarter notes and so many keys (from the list as it was: `from`) */
function rollMoved (r, from, ids, dq, dn, kit) {
  const { toQ, limit } = rollQ(r), lo = toQ(r.a - 1), hiQ = toQ(limit)
  const sel = from.filter(x => ids.has(x.id))
  if (!sel.length) return from
  dq = clamp(dq, lo - Math.min(...sel.map(x => x.t)), hiQ - .01 - Math.max(...sel.map(x => x.t)))
  const padI = k => DRUM_PADS.findIndex(q => q[1] === k)
  if (kit) { const is = sel.map(x => padI(x.n)).filter(i => i >= 0); if (is.length) dn = clamp(dn, -Math.min(...is), DRUM_PADS.length - 1 - Math.max(...is)) }
  else dn = clamp(dn, -Math.min(...sel.map(x => x.n)), 127 - Math.max(...sel.map(x => x.n)))
  return from.map(x => { if (!ids.has(x.id)) return x; const y = Object.assign({}, x, { t: x.t + dq, n: kit ? (padI(x.n) < 0 ? x.n : DRUM_PADS[padI(x.n) + dn][1]) : x.n + dn }); if (Math.abs(dq) > 1e-9) delete y.o; return y })
}

/* ── hands ── */
function rollDown (e) {
  const el = e.target.closest ? e.target.closest('[data-a="np"]') : null
  if (!el || e.button === 2) return false
  e.preventDefault()
  if (S.menu) { S.menu = null; uiDirty('menu') }
  S.focus = 'notes'
  const k = el.dataset.k, p = pt(e), g = ROLL.g, [r, t] = rollReg(), now = performance.now()
  const hold = d => { ROLL.drag = Object.assign({ x0: p.x, y0: p.y, moved: false }, d); try { svg.setPointerCapture(e.pointerId) } catch (err) {} }
  ROLL.on = k === 'clane' || k === 'cpt' || k === 'vel' ? 'lane' : k === 'paper' || k === 'note' || k === 'len' ? 'paper' : ROLL.on
  if (k === 'none') return true
  if (k === 'lane') { ROLL.lane = !ROLL.lane; uiDirty('dock'); return true }
  if (k === 'param') { rollParamMenu(p.x - 20, p.y); return true }
  if (k === 'root') { openMenu(p.x - 10, p.y + 12, RL_ROOTS.map((v, i) => ({ t: v, v: i, on: i === ROLL.root })), it => { ROLL.root = it.v; uiDirty('dock') }, { w: 70 }); return true }
  if (k === 'scale') { openMenu(p.x - 10, p.y + 12, Object.keys(RL_SCALES).map(v => ({ t: v, v, on: v === ROLL.scale })), it => { ROLL.scale = it.v; uiDirty('dock') }, { w: 150 }); return true }
  if (k === 'qgrid' || k === 'qon' || k === 'qs' || k === 'sw' || k === 'sq' || k === 'nvel') {
    if (!r || !t || t.theirs) return true
    const quant = off => rollQuantDo(r, off)
    if (k === 'qgrid') openMenu(p.x - 10, p.y + 12, ['off'].concat(RL_GRIDS).map(v => ({ t: v, v, on: v === ROLL.qv, sep: v === '1/4' || v === '1/6' })), it => { if (it.v === 'off') quant(true); else { ROLL.qv = it.v; quant(false) } }, { w: 84 })
    else if (k === 'qon') quant(rollQuanted(r, ROLL.sel))
    else if (k === 'sq') rollToScale(r, ROLL.sel)
    else { hold({ k: 'line', what: k, before: editState(), from: r.notes, ids: new Set(ROLL.sel) }); rollMove(e) }
    return true
  }
  if (k === 'clane' || k === 'cpt') {
    if (!r || !t || t.theirs) return true
    const c = rollParam()[1], { qb, org, toQ } = rollQ(r), topV = rollTop(c), valAt = yy => clamp(Math.round((g.base - yy) / g.room * topV), 0, topV)
    if (k === 'cpt') {
      const id = +el.dataset.i, twice = ROLL.last.id === -id - 10 && now - ROLL.last.at < 420
      ROLL.last = { id: -id - 10, at: now }
      if (twice) { edit(() => rollSetCtl(r, (r.ctl || []).filter(q => q.id !== id))); ROLL.cp.delete(id); uiDirty('dock'); return true }      // a point pressed twice goes
      if (e.shiftKey) { if (ROLL.cp.has(id)) ROLL.cp.delete(id); else ROLL.cp.add(id) } else if (!ROLL.cp.has(id)) ROLL.cp = new Set([id])
      const q = (r.ctl || []).find(z => z.id === id)
      if (q && ROLL.cp.has(id)) hold({ k: 'cpt', id, from: r.ctl || [], before: editState(), ids: new Set(ROLL.cp), bar0: ROLL.view.a + (p.x - g.x0) / g.pxb, v0: q.v, t0: q.t, c })
      uiDirty('dock'); return true
    }
    const at = clamp(rollSnap(ROLL.view.a + (p.x - g.x0) / g.pxb, e), r.a - 1, r.b - 1 - 1e-6), made = { id: ++NID, t: toQ(at), c, v: rollSwitch(c) ? (valAt(p.y) >= 64 ? 127 : 0) : valAt(p.y) }, before = editState(), from = (r.ctl || []).filter(q => !(q.c === c && Math.abs(q.t - made.t) < 1e-6)).concat([made])      // (one point to a place: a new one there takes the old one's)
    rollSetCtl(r, from); ROLL.cp = new Set([made.id])
    hold({ k: 'cpt', id: made.id, from, before, ids: new Set([made.id]), bar0: ROLL.view.a + (p.x - g.x0) / g.pxb, v0: made.v, t0: made.t, c, fresh: true, moved: true })
    uiDirty('dock', 'lanes'); return true
  }
  if (k === 'grid') { openMenu(p.x - 70, g.y - 4, RL_GRIDS.map(v => ({ t: v, v, on: v === ROLL.grid, sep: v === '1/6' })), it => { ROLL.grid = it.v; uiDirty('dock') }, { w: 96 }); return true }
  if (k === 'ruler') { const at = Math.max(0, rollSnap(ROLL.view.a + (p.x - g.x0) / g.pxb, e)); jumpTo(at); uiDirty('dock', 'scenes', 'top'); return true }
  if (k === 'key') { const key = +el.dataset.v; if (g.kit) ROLL.pad = DRUM_PADS.findIndex(q => q[1] === key); ROLL.key = key; syncLive(); playKey(0x90, key, ROLL.vel); hold({ k: 'key', key }); uiDirty('dock'); return true }
  if (!t || !isInst(t)) return true
  const mine = !t.theirs
  if (k === 'note' || k === 'len') {
    const id = +el.dataset.i, x = r && r.notes.find(q => q.id === id)
    if (!x) return true
    if (mine && S.tool === 'eraser') { rollDelete(new Set(ROLL.sel.has(id) ? ROLL.sel : [id])); return true }      // the eraser: the note pressed goes (the chosen ones with it, when it is one of them)
    if (mine && S.tool === 'scissors' && !g.kit) { rollCut(r, id, ROLL.view.a + (p.x - g.x0) / g.pxb, e); return true }      // the scissors: it is cut where it was pressed, on the grid
    const twice = ROLL.last.id === id && now - ROLL.last.at < 420
    ROLL.last = { id, at: now }
    if (g.kit && twice && !e.shiftKey && mine) { rollDelete(new Set([id])); return true }        // a stroke pressed twice goes
    if (e.shiftKey) { if (ROLL.sel.has(id)) ROLL.sel.delete(id); else ROLL.sel.add(id) } else if (!ROLL.sel.has(id)) ROLL.sel = new Set([id])
    ROLL.vel = clamp(x.v, 1, 127)
    const snd = regSound(r).find(q => q.id === id), at = rollAt(p)
    if (snd) rollHear(snd.n, snd.v)
    if (ROLL.sel.has(id) && mine && S.tool === 'velocity') { hold({ k: 'nv', id, from: r.notes, before: editState(), ids: new Set(ROLL.sel), v0: x.v }); uiDirty('dock'); return true }      // the velocity tool: pulled up or down, the chosen notes are played harder or softer
    if (ROLL.sel.has(id) && mine) hold({ k: k === 'len' && !g.kit ? 'len' : 'move', id, from: r.notes, before: editState(), bar0: at.bar, row0: at.row, a0: snd ? snd.a : at.bar, b0: snd ? snd.b : at.bar, copy: e.altKey && k !== 'len', ids: new Set(ROLL.sel) })
    uiDirty('dock'); return true
  }
  if (k === 'vel') {
    if (!r || !mine) return true
    const list = regSound(r).map(x => [Math.abs(g.x0 + (x.a - ROLL.view.a) * g.pxb + 2 - p.x), x]).filter(q => q[0] <= 7).sort((a, b) => a[0] - b[0] || (ROLL.sel.has(b[1].id) ? 1 : 0) - (ROLL.sel.has(a[1].id) ? 1 : 0))
    if (!list.length) return true
    const id = list[0][1].id
    if (!ROLL.sel.has(id)) ROLL.sel = new Set([id])
    hold({ k: 'vel', id, from: r.notes, before: editState(), ids: new Set(ROLL.sel), v0: r.notes.find(q => q.id === id).v })
    rollMove(e); return true
  }
  /* the paper */
  const at = rollAt(p), twice = ROLL.last.id === -1 && now - ROLL.last.at < 420 && Math.hypot(p.x - ROLL.last.x, p.y - ROLL.last.y) < 5
  ROLL.last = { id: -1, at: now, x: p.x, y: p.y }
  if (at.row >= 0 && at.row < g.count && (twice || g.kit || S.tool === 'pencil' || e.metaKey)) { rollMake(at.bar, rollKeyOfRow(at.row), e); ROLL.last = { id: 0, at: 0 }; return true }
  if (!e.shiftKey) ROLL.sel = new Set()
  hold({ k: 'band', base: new Set(ROLL.sel) })
  uiDirty('dock'); return true
}
function rollMove (e) {
  const d = ROLL.drag
  if (!d) return
  const p = pt(e), g = ROLL.g, [r, t] = rollReg()
  if (d.k === 'key') return
  if (d.k === 'line') {                                                                  // a line of the panel at the left: how far along it the hand is
    if (!r) return
    const f = clamp((p.x - ROLL.side.x) / ROLL.side.w, 0, 1)
    if (d.what === 'qs' || d.what === 'sw') {                                            // how far, how late: the chosen notes that are quantized follow the line as it is pulled
      ROLL[d.what] = Math.round(f * 100) / 100
      const was = r.notes; r.notes = d.from; const list = d.from.map(x => (d.ids.size && !d.ids.has(x.id)) || x.o == null ? x : rollQuant({ a: r.a, off: r.off, notes: [x] }, new Set(), false)[0][0]); r.notes = was
      if (list.some((x, i) => x !== d.from[i])) setNotes(r, list)
    }
    else { const v = clamp(Math.round(f * 127), 1, 127); ROLL.vel = v; if (d.ids.size) setNotes(r, d.from.map(x => !d.ids.has(x.id) ? x : Object.assign({}, x, { v }))); say(`velocity ${v}`) }
    d.moved = true; uiDirty('dock', 'lanes'); return
  }
  if (d.k === 'nv') {                                                                    // so many steps of how hard for every two units the hand has gone up or down; with shift, a quarter of that
    if (!r || (!d.moved && Math.abs(p.y - d.y0) < 2)) return
    const dv = Math.round((d.y0 - p.y) * (e.shiftKey ? .25 : .8)), lead = clamp(d.v0 + dv, 1, 127)
    setNotes(r, d.from.map(x => !d.ids.has(x.id) ? x : Object.assign({}, x, { v: clamp(x.v + dv, 1, 127) })))
    ROLL.vel = lead; say(`velocity ${lead}`); d.moved = true; uiDirty('dock', 'lanes'); return
  }
  if (d.k === 'cpt') {
    if (!r) return
    if (!d.fresh && !d.moved && Math.hypot(p.x - d.x0, p.y - d.y0) < 3) return
    const { qb, toQ } = rollQ(r), topV = rollTop(d.c), bar = ROLL.view.a + (p.x - g.x0) / g.pxb, lead0 = (r.a - 1 - (r.off || 0)) + d.t0 / qb
    const to = clamp(rollSnap(lead0 + (bar - d.bar0), e), r.a - 1, r.b - 1 - 1e-6), dq = toQ(to) - d.t0, v = clamp(Math.round((g.base - p.y) / g.room * topV), 0, topV), dv = v - d.v0, lo = toQ(r.a - 1), hiQ = toQ(r.b - 1) - 1e-6
    rollSetCtl(r, d.from.map(q => !d.ids.has(q.id) ? q : Object.assign({}, q, { t: clamp(q.t + dq, lo, hiQ), v: rollSwitch(d.c) ? ((q.id === d.id ? v : q.v + dv) >= 64 ? 127 : 0) : clamp(q.id === d.id ? v : q.v + dv, 0, topV) })))
    say(`${ROLL.param} ${d.c === 128 ? v - 8192 : v}`)
    d.moved = true; uiDirty('dock', 'lanes'); return
  }
  if (!d.moved && d.k !== 'vel' && Math.hypot(p.x - d.x0, p.y - d.y0) < 3) return
  if (d.k === 'band') {
    d.moved = true
    ROLL.band = { x0: d.x0, y0: clamp(d.y0, g.top, g.gb), x1: p.x, y1: clamp(p.y, g.top, g.gb) }
    const xa = Math.min(d.x0, p.x), xb = Math.max(d.x0, p.x), ra = Math.floor((Math.min(d.y0, p.y) - g.top) / g.rowH), rb = Math.floor((Math.max(d.y0, p.y) - g.top) / g.rowH), got = new Set(d.base)
    if (r) for (const x of regSound(r)) { const nx0 = g.x0 + (x.a - ROLL.view.a) * g.pxb, nx1 = g.kit ? nx0 + Math.max(6, rollStep() * g.pxb) : g.x0 + (x.b - ROLL.view.a) * g.pxb, row = g.kit ? DRUM_PADS.length - 1 - DRUM_PADS.findIndex(q => q[1] === x.n) : g.hi - x.n; if (nx1 >= xa && nx0 <= xb && row >= ra && row <= rb) got.add(x.id) }
    ROLL.sel = got; uiDirty('dock'); return
  }
  if (!r) return
  const { qb } = rollQ(r), at = rollAt(p)
  if (d.k === 'move') {
    if (!d.moved && d.copy) {                                                            // option: what is pulled away are copies; the notes themselves stay
      const copies = d.from.filter(x => d.ids.has(x.id)).map(x => mkNote(x.t, x.d, x.n, x.v))
      d.from = d.from.concat(copies); d.ids = new Set(copies.map(x => x.id)); ROLL.sel = new Set(d.ids)
    }
    const to = rollSnap(d.a0 + (at.bar - d.bar0), e), dq = (to - d.a0) * qb, dn = d.row0 - at.row
    setNotes(r, rollMoved(r, d.from, d.ids, dq, dn, g.kit)); rollGrow(r)
    if (dn !== d.dn) { d.dn = dn; const lead = regSound(r).find(x => d.ids.has(x.id)); if (lead && d.moved) rollHear(lead.n, lead.v) }
    d.moved = true
  } else if (d.k === 'len') {
    const end = rollSnap(d.b0 + (at.bar - d.bar0), e), dq = (end - d.b0) * qb, least = Math.min(rollStep() * qb / 4, .0625)
    setNotes(r, d.from.map(x => !d.ids.has(x.id) ? x : Object.assign({}, x, { d: Math.max(least, x.d + dq) }))); rollGrow(r)
    d.moved = true
  } else if (d.k === 'vel') {
    const v = clamp(Math.round((g.base - p.y) / g.room * 127), 1, 127), dv = v - d.v0
    setNotes(r, d.from.map(x => !d.ids.has(x.id) ? x : Object.assign({}, x, { v: clamp(x.id === d.id ? v : x.v + dv, 1, 127) })))
    ROLL.vel = v; say(`velocity ${v}`); d.moved = true
  }
  uiDirty('dock', 'lanes')
}
function rollUp () {
  const d = ROLL.drag
  ROLL.drag = null
  if (!d) return
  if (d.k === 'nv' && d.moved) { const [r] = rollReg(), x = r && regSound(r).find(q => q.id === d.id); if (x) rollHear(x.n, x.v) }      // let go: heard as hard as it is now
  if (d.moved) ROLL.last = { id: 0, at: 0 }                                              // (a pull is not the first of two presses)
  if (d.k === 'key') { playKey(0x80, d.key, 0); ROLL.key = null; uiDirty('dock'); return }
  if (d.k === 'band') { ROLL.band = null; uiDirty('dock'); return }
  if (d.moved && d.before) { const [r] = rollReg(); if (r && (d.k === 'line' || d.k === 'cpt' || d.k === 'nv' || r.notes !== d.from)) commit(d.before); else uiDirty('dock') }
}
/* the wheel over the page: up and down the keys, along the song; a pinch (or command) draws the time nearer about the pointer */
function rollWheel (e) {
  const g = ROLL.g, V = ROLL.view, p = pt(e)
  if (!rollOn() || !g || p.y < g.y || p.y > g.y + g.h || p.x > RX) return false
  e.preventDefault()
  if (e.ctrlKey || e.metaKey) {
    const at = V.a + (p.x - g.x0) / g.pxb, k = Math.exp(e.deltaY * .01), span = clamp((V.b - V.a) * k, .5, 64)
    V.a = at - (at - V.a) * span / (V.b - V.a); V.b = V.a + span
  } else {
    const dx = e.shiftKey ? e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY
    if (Math.abs(dx) > Math.abs(dy)) { const d = dx / g.pxb, span = V.b - V.a; V.a = clamp(V.a + d, -1, SONG_END); V.b = V.a + span }
    else if (!g.kit) { ROLL.wy = (ROLL.wy || 0) + dy; const rows = Math.trunc(ROLL.wy / g.rowH); if (rows) { ROLL.wy -= rows * g.rowH; V.hi = clamp(V.hi - rows, g.count - 1, 127) } }
  }
  uiDirty('dock')
  return true
}
/* the keys, while the page has them */
function rollKey (e) {
  if (!rollOn() || S.focus !== 'notes' || S.menu || S.leave || (typeof START !== 'undefined' && START.on)) return
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
  const [r] = rollReg(), cmd = e.metaKey && !e.ctrlKey && !e.altKey, plain = !e.metaKey && !e.ctrlKey && !e.altKey, c = e.code, take = () => { e.preventDefault(); e.stopImmediatePropagation() }
  if (cmd && !e.shiftKey && /^Arrow/.test(c)) {                                          // command and an arrow: the page's own view — nearer, further; taller, shorter rows
    take()
    const V = ROLL.view, g = ROLL.g
    if (c === 'ArrowRight' || c === 'ArrowLeft') { const span = clamp((V.b - V.a) * (c === 'ArrowRight' ? 1 / 1.5 : 1.5), .5, 64), pos = curPos(), at = pos >= V.a && pos <= V.b ? pos : (V.a + V.b) / 2; V.a = at - (at - V.a) * span / (V.b - V.a); V.b = V.a + span }
    else if (g && !g.kit) { const mid = g.hi - g.count / 2; ROLL.rowH = clamp(Math.round(ROLL.rowH * (c === 'ArrowDown' ? 1.25 : 1 / 1.25)), 7, 30); const count = Math.max(1, Math.floor((g.bot - g.top) / ROLL.rowH)); V.hi = clamp(Math.round(mid + count / 2), count - 1, 127) }
    uiDirty('dock'); return
  }
  if (c === 'KeyQ' && r && ((plain && !e.shiftKey) || (e.metaKey && e.altKey && !e.ctrlKey))) { take(); if (!e.repeat) rollQuantDo(r, !plain); return }      // q: the chosen notes to the panel's own grid (not the region to the room's); option command q: back as played
  if (c === 'KeyL' && plain && !e.shiftKey && r) { take(); if (!e.repeat) rollLegato(r); return }      // l: force legato (on the lanes l fills a region to the next; here, each chosen note)
  if (c === 'KeyA' && plain && !e.shiftKey) { take(); if (!e.repeat) { ROLL.lane = !ROLL.lane; uiDirty('dock') } return }      // a: the lane under the notes, up or away
  if ((c === 'Backspace' || c === 'Delete') && plain) {
    take()
    if (e.repeat) return
    if (ROLL.on === 'lane' && ROLL.cp.size && r) { const ids = new Set(ROLL.cp); edit(() => rollSetCtl(r, (r.ctl || []).filter(q => !ids.has(q.id)))); ROLL.cp = new Set(); uiDirty('dock', 'lanes') }
    else rollDelete(new Set(ROLL.sel))
    return
  }
  if (c === 'Escape' && plain && (ROLL.sel.size || ROLL.cp.size)) { take(); ROLL.sel = new Set(); ROLL.cp = new Set(); uiDirty('dock'); return }
  if (!r) return
  if (cmd && c === 'KeyA' && !e.shiftKey) { take(); ROLL.sel = new Set(r.notes.map(x => x.id)); uiDirty('dock'); return }
  if (cmd && (c === 'KeyC' || c === 'KeyX') && !e.shiftKey) {
    take()
    const sel = r.notes.filter(x => ROLL.sel.has(x.id))
    if (!sel.length) return
    const t0 = Math.min(...sel.map(x => x.t))
    ROLL.clip = sel.map(x => ({ dt: x.t - t0, d: x.d, n: x.n, v: x.v })); say(`${sel.length} ${sel.length === 1 ? 'note' : 'notes'} ${c === 'KeyX' ? 'cut' : 'copied'}`)
    if (c === 'KeyX') rollDelete(new Set(ROLL.sel))
    return
  }
  if (cmd && c === 'KeyV' && !e.shiftKey) {
    take()
    if (!ROLL.clip || !ROLL.clip.length) return
    const { toQ, limit } = rollQ(r), at = clamp(rollSnap(curPos()), r.a - 1, limit - rollStep()), made = ROLL.clip.map(x => mkNote(toQ(at) + x.dt, x.d, x.n, x.v))
    edit(() => { setNotes(r, r.notes.concat(made)); rollGrow(r) })
    ROLL.sel = new Set(made.map(x => x.id)); uiDirty('dock', 'lanes'); return
  }
  if (e.altKey && !e.metaKey && !e.ctrlKey && /^Arrow/.test(c) && ROLL.on === 'lane' && ROLL.cp.size && r) {      // the lane's chosen points: a step earlier or later, a little higher or lower — they alone
    take()
    const cc = rollParam()[1], topV = rollTop(cc), along = c === 'ArrowRight' ? 1 : c === 'ArrowLeft' ? -1 : 0, up = c === 'ArrowUp' ? 1 : c === 'ArrowDown' ? -1 : 0, { toQ } = rollQ(r), lo = toQ(r.a - 1), hiQ = toQ(r.b - 1) - 1e-6
    const sel = (r.ctl || []).filter(q => ROLL.cp.has(q.id))
    if (!sel.length) return
    const dq = clamp(along * rollStep() * QB(), lo - Math.min(...sel.map(q => q.t)), hiQ - Math.max(...sel.map(q => q.t))), dv = up * (cc === 128 ? 128 : 1) * (e.shiftKey ? 10 : 1)
    edit(() => rollSetCtl(r, (r.ctl || []).map(q => !ROLL.cp.has(q.id) ? q : Object.assign({}, q, { t: q.t + dq, v: rollSwitch(cc) ? (up > 0 ? 127 : up < 0 ? 0 : q.v) : clamp(q.v + dv, 0, topV) }))))
    uiDirty('dock', 'lanes'); return
  }
  if (e.altKey && !e.metaKey && !e.ctrlKey && /^Arrow/.test(c) && ROLL.sel.size) {
    take()
    const up = c === 'ArrowUp' ? 1 : c === 'ArrowDown' ? -1 : 0, along = c === 'ArrowRight' ? 1 : c === 'ArrowLeft' ? -1 : 0, kit = ROLL.g && ROLL.g.kit
    edit(() => { setNotes(r, rollMoved(r, r.notes, ROLL.sel, along * nudgeBars() * QB(), up * (e.shiftKey && !kit ? 12 : 1), kit)); rollGrow(r) })      // (along the song: by the nudge the room is set to, as a region goes — not by the page's grid)
    if (up) { const lead = regSound(r).find(x => ROLL.sel.has(x.id)); if (lead) rollHear(lead.n, lead.v) }
    uiDirty('dock', 'lanes')
  }
}
/* the page comes and goes with a height of its own (the keys want more room than a patch does) */
function rollSync () {
  const on = rollOn()
  if (on === ROLL.shown) return
  ROLL.shown = on
  if (on) rollRecall()
  if (on) { ROLL.hOther = S.panel.h; S.panel.h = ROLL.h } else { ROLL.h = S.panel.h; S.panel.h = ROLL.hOther; if (S.focus === 'notes') S.focus = 'lanes' }
  relayout(); dirtyAll()
}
/* how the page was left — its grids, how far and how late, the scale, the lane and what it shows, the height of its rows —
   is kept with the app's settings and comes back when the app is opened again */
const RL_KEPT = ['qv', 'qs', 'sw', 'grid', 'scale', 'root', 'lane', 'param', 'rowH']
const rollKeptSig = () => JSON.stringify(RL_KEPT.map(k => ROLL[k]))
function rollRecall () {
  if (ROLL.recalled || !NAT) return
  ROLL.recalled = true
  NAT.call('prefGet').then(pr => {
    const o = pr && pr.notesPage
    if (o && typeof o === 'object') {
      if (['1/4', '1/8', '1/16', '1/32', '1/6', '1/12', '1/24'].includes(o.qv)) ROLL.qv = o.qv
      if (RL_GRIDS.includes(o.grid)) ROLL.grid = o.grid
      if (o.qs >= 0 && o.qs <= 1) ROLL.qs = +o.qs
      if (o.sw >= 0 && o.sw <= 1) ROLL.sw = +o.sw
      if (RL_SCALES[o.scale]) ROLL.scale = o.scale
      if (o.root >= 0 && o.root < 12) ROLL.root = o.root | 0
      if (typeof o.lane === 'boolean') ROLL.lane = o.lane
      if (typeof o.param === 'string' && (RL_PARAMS.some(q => q[0] === o.param) || /^cc \d+/.test(o.param))) ROLL.param = o.param
      if (o.rowH >= 7 && o.rowH <= 30) ROLL.rowH = Math.round(o.rowH)
    }
    ROLL.keptSig = rollKeptSig(); uiDirty('dock')
  })
}
function rollKeep () { if (!NAT || !ROLL.recalled || ROLL.keptSig == null) return; const sig = rollKeptSig(); if (sig === ROLL.keptSig) return; ROLL.keptSig = sig; const o = {}; for (const k of RL_KEPT) o[k] = ROLL[k]; NAT.call('prefSet', { key: 'notesPage', value: o }) }
function rollOpen () { if (!rollOn()) { S.panel.on = true; S.panel.tab = 'notes'; closePicker(); setView() } rollSync(); S.focus = 'notes'; uiDirty('dock', 'top') }

/* ── joined to the room ── */
{
  const down0 = onDown, move0 = onMove, up0 = onUp, wheel0 = onWheel, dock0 = PARTS.dock, toggle0 = togglePanel, flush0 = flush, lanePress0 = lanesPress, laneHover0 = lanesHover
  /* on the lanes the velocity tool is the gain tool (how hard a region of notes is played is its gain) */
  const asGain = fn => function (...a) { if (S.tool !== 'velocity') return fn(...a); S.tool = 'gain'; try { return fn(...a) } finally { S.tool = 'velocity' } }
  lanesPress = asGain(lanePress0); lanesHover = asGain(laneHover0)
  PARTS.dock = function () {
    if (!rollOn() || VIEW.p <= .001) return dock0()
    const y = BY, h = S.panel.h
    MGEOM = null
    return R(0, y, RX, h + 2, { fill: K1 }) + pRoll(y + PH, h - PH) + rollHead(y)
  }
  togglePanel = function (tab) { toggle0(tab); rollSync() }
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null, a = el ? el.dataset.a : ''
    if (a === 'tab-notes') { e.preventDefault(); rollOpen(); return }
    if (rollDown(e)) return
    down0(e)
    if (a === 'tab-patch' || a === 'tab-mixer' || a === 'tab-notes' || a === 'patch' || a === 'mixer') rollSync()
    else if (a === 'lanes' && !e.button) {                                               // a region of notes pressed twice: its notes
      const p = pt(e), ti = laneAt(p.y), r = (p.y - TY + VY) < rowTops().all ? hitRegion(ti, barAt(p.x)) : null, now = performance.now()
      if (r && r.notes && ROLL.lastReg && ROLL.lastReg.id === r.id && now - ROLL.lastReg.at < 420) { ROLL.lastReg = null; if (!rollOn()) rollOpen(); else { S.focus = 'notes'; uiDirty('dock') } }
      else ROLL.lastReg = r && r.notes ? { id: r.id, at: now } : null
    }
  }
  onMove = function (e) { if (ROLL.drag) { rollMove(e); return } move0(e) }
  onUp = function (e) { if (ROLL.drag) { rollUp(); return } up0(e) }
  onWheel = function (e) { if (!rollWheel(e)) wheel0(e) }
  addEventListener('keydown', rollKey, true)
  KEYS.KeyP = () => { if (rollOn()) togglePanel('notes'); else rollOpen() }
  /* held keys of the keyboard are shown on the page's own keys; while the song runs its playhead is carried along */
  flush = function () { if (rollOn() && (dirty.has('keys') || ROLL.toolWas !== S.tool)) dirty.add('dock'); ROLL.toolWas = S.tool; flush0() }      // (another tool: the pointer over a note says so)
  setInterval(rollKeep, 1500)
  setInterval(() => { if (!rollOn() || !S.playing || !ROLL.g) return; const el = document.getElementById('np-ph'), g = ROLL.g; if (!el) return; const x = g.x0 + (curPos() - ROLL.view.a) * g.pxb; el.setAttribute('transform', `translate(${n(x)} 0)`); el.setAttribute('visibility', x >= g.x0 && x <= g.x1 ? 'visible' : 'hidden') }, 33)
}
