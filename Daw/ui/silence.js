/* ── strip silence (⌃X): a file cut down to where it sounds ──
   His ask (2026-10-23), after Logic's remove silence: what stays quieter than the threshold for at least so long is taken
   out, each piece beginning so much early (pre attack) and ending so much late (post release), its cuts moved onto the
   nearest place the sound crosses zero. And beside it a second way, whole bars: what sounds is kept whole — eight bars of
   hi-hat stay one region, however many rests there are between the hits — and only bars with nothing in them at all are
   taken out, cut on the bar lines. Where a sound leans over a bar line by no more than a beat (a pushed hit, a pickup, a
   tail) the cut is on the beat line beyond it, so that no whole empty bar is kept for it.
   Where it is quiet is found here, from how loud the file is along its length (op levels: a thousandth of a second to the
   step; in a browser, the outline the lanes draw, a hundredth), so that the same reckoning can show the pieces before
   they are cut, and the tidying of tracks can ask where each one sounds. The values used last are remembered.
   Read after edit.js and flex.js. */
const SIL_DEF = { floor: -40, gap: .3, pre: .01, post: .06, zero: true, whole: false, bars: 1 }
const SIL_RANGE = { floor: [-90, -6], gap: [0, 10], pre: [0, 1], post: [0, 5], bars: [1, 64] }
const silClean = o => {
  const c = Object.assign({}, SIL_DEF)
  for (const k of Object.keys(SIL_DEF)) {
    const v = o && o[k]
    if (typeof SIL_DEF[k] === 'boolean') { if (typeof v === 'boolean') c[k] = v }
    else if (Number.isFinite(+v) && v !== null && v !== '') c[k] = clamp(+v, SIL_RANGE[k][0], SIL_RANGE[k][1])
  }
  c.bars = Math.round(c.bars)
  return c
}
const SIL = silClean((() => { try { return JSON.parse(localStorage.getItem('slur.strip') || '{}') } catch (e) { return {} } })())
function silKeep (o) { Object.assign(SIL, silClean(Object.assign({}, SIL, o))); try { localStorage.setItem('slur.strip', JSON.stringify(SIL)) } catch (e) {} }

/* ── how loud a file is along its length: { hop (seconds of the file), lv } — lv in half decibels below full scale, 255
   for silence (levelOutline in Stretch.cpp) ── */
const SIL_LV = new Map()
async function silLevels (key) {
  if (SIL_LV.has(key)) return SIL_LV.get(key)
  const d = await NAT.call('levels', { key })
  if (!d || !d.ok || !(d.hop > 0)) return null
  const bin = atob(d.lv), lv = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) lv[i] = bin.charCodeAt(i)
  const L = { hop: d.hop, lv }
  SIL_LV.set(key, L)
  if (SIL_LV.size > 24) SIL_LV.delete(SIL_LV.keys().next().value)
  return L
}
/* …in a browser: the outline the lanes draw (the loudest of each hundredth of a second, to a thousandth of full scale) */
function silOutline (r) {
  const pk = r.peaksAll, N = pk ? pk.length : 0, len = srcSec(r)
  if (!N || !(len > 0)) return null
  const lv = new Uint8Array(N)
  for (let i = 0; i < N; i++) { const m = Math.abs(pk[i]); lv[i] = m > 0 ? Math.min(255, Math.floor(-40 * Math.log10(m))) : 255 }
  return { hop: len / N, lv }
}

/* where there is sound: [[from, to] …] in seconds of the file, nothing yet added at either end. Sound is what reaches the
   floor; a quiet stretch shorter than `gap` seconds is not a silence (soundParts in Stretch.cpp reckons the same) */
function silSound (L, floorDb, gap) {
  const { hop, lv } = L, n = lv.length, top = -2 * floorDb, minGap = Math.max(1, Math.round(gap / hop)), out = []
  let f = 0
  while (f < n) {
    while (f < n && lv[f] >= top) f++
    if (f >= n) break
    const from = f
    let last = f                                                                    // the last step with sound in this stretch
    while (f < n) {
      if (lv[f] < top) { last = f; f++; continue }
      let g = f
      while (g < n && lv[g] >= top) g++
      if (g >= n || g - f >= minGap) break                                          // a real silence (or the end): the stretch is over
      f = g
    }
    out.push([from * hop, (last + 1) * hop])
    f = Math.max(f, last + 1)
  }
  return out
}
/* Logic's way: each stretch so much early and so much late; what then overlaps is one */
function silPlain (snd, o, len) {
  const out = []
  for (const [a, b] of snd) {
    const x = Math.max(0, a - o.pre), y = Math.min(len, b + o.post), p = out[out.length - 1]
    if (p && x <= p[1]) p[1] = Math.max(p[1], y); else out.push([x, y])
  }
  return out
}
/* whole bars: stretches in bars from zero ([where the sound begins, where its tail ends]) grown to the bar lines round
   them; whatever has fewer than `bars` empty bars between is one piece. A piece whose first sound is in the last beat
   before a bar line it goes on past (a pushed hit, a pickup) is cut on the beat line before that sound; one whose last
   sound ends in the first beat after a bar line (a tail, a last hit on the one), on the beat line after it.
   [[from, to] …] in bars from zero. */
function silWhole (spans, o, hop) {
  const beat = 1 / BEATS(), eps = Math.max(.002, 1.5 * (hop || 0)) / SPB(), blocks = []      // (eps: a sound is found to begin up to a step of the outline early)
  for (const [x, y] of spans.slice().sort((p, q) => p[0] - q[0])) {
    const A = Math.floor(x + eps), B = Math.max(A + 1, Math.ceil(y - eps)), p = blocks[blocks.length - 1]
    if (p && A - p.B < o.bars) { p.B = Math.max(p.B, B); p.y = Math.max(p.y, y); continue }
    blocks.push({ A, B, x, y })
  }
  return blocks.map(({ A, B, x, y }) => [
    A + 1 - x <= beat + eps && B > A + 1 ? Math.floor((x + eps) / beat) * beat : A,
    y - (B - 1) <= beat + eps && x < B - 1 - eps ? Math.ceil((y - eps) / beat) * beat : B])
}
/* the pieces of a region that would be kept, in bars from zero, inside the region: `k` is how much faster than it is
   played the outline runs (the region's rate; 1 for a sound already warped). Plain pieces also come back in seconds
   of the file, for their cuts to be moved onto zero. */
function silPlan (r, k, L, o) {
  o = silClean(Object.assign({}, SIL, o))
  const len = L.lv.length * L.hop, bar = s => barOfD(r, s / k), ra = r.a - 1, rb = r.b - 1
  const snd = silSound(L, o.floor, o.gap)
  const inside = list => list.map(([x, y, s0, s1]) => [Math.max(ra, x), Math.min(rb, y), s0, s1]).filter(([x, y]) => y - x > 1e-4)
  if (o.whole) return inside(silWhole(snd.map(([a, b]) => [bar(a), bar(Math.min(len, b + o.post))]), o, L.hop / k))
  return inside(silPlain(snd, o, len).map(([a, b]) => [bar(a), bar(b), a, b]))
}

/* what is listened to for a region: its sound as warped where the app holds that, else its file at the region's rate */
const silSource = r => { const w = r.wkey && typeof LIVEW !== 'undefined' && LIVEW.has(r.wkey) ? r.wkey : null; return { key: w || r.key, k: w ? 1 : rateOf(r) } }
/* each file cut down to its pieces ([region, pieces in bars from zero, what it was when listened to] …), inside an edit:
   how many files were cut, how many pieces, the pieces made (Tidy Tracks cuts inside its own one step back) */
function silCut (heard) {
  let cut = 0, pieces = 0
  const made = []
  for (const [r0, parts, sig] of heard) {
    const [r, t] = regOf(r0.id)                                                    // (the region as it is now: the app was listened to meanwhile, and an undo or a hand may have changed it)
    if (!r || !Array.isArray(parts) || silSig(r) !== sig) continue
    const before = crossBefore(r, t), after = crossAfter(r, t), xs = before ? xfadeOf(before, r) : 0, xe = after ? xfadeOf(r, after) : 0
    const ra = r.a - 1, rb = r.b - 1
    let keepA = parts.length && parts[0][0] <= ra + xs + 1e-6, keepB = parts.length && parts[parts.length - 1][1] >= rb - xe - 1e-6      // the sound runs up to that end (into what it shares with its neighbour, where it shares): the end stays as it is, crossfade and all
    if (parts.length === 1 && keepA && keepB) continue                               // sound from end to end: nothing to take out
    const own2 = 2 * oneSample()                                                     // (a piece that would be no longer than the crossfade at its end has nothing of its own: that end is a plain join first)
    if (keepA && xs && parts[0][1] - ra <= xs + own2) keepA = false
    if (keepB && xe && rb - parts[parts.length - 1][0] <= xe + own2) keepB = false
    if (before && !keepA) uncross(before, r)
    if (after && !keepB) uncross(r, after)
    const a0 = r.a - 1, b0 = r.b - 1                                                 // (after the uncrossing)
    const own = parts.map(([x, y], i) => {
      const head = i === 0 && keepA, tail = i === parts.length - 1 && keepB
      x = head ? a0 : Math.max(a0, x); y = tail ? b0 : Math.min(b0, y)
      const q = cloneReg(r, { a: x + 1, b: y + 1, off: (r.off || 0) + (x - a0), fi: head ? r.fi || 0 : 0, fo: tail ? r.fo || 0 : 0 })
      if (!tail) delete q.xo
      return q
    }).filter(q => q.b - q.a > 1e-4)
    for (const q of own) fitFades(q, { regs: t.regs.filter(z => z !== r).concat(own) })
    t.regs = t.regs.filter(q => q !== r).concat(own); made.push(...own); cut++; pieces += own.length
  }
  return { cut, pieces, made }
}
const silSig = r => [r.key, r.wkey || '', !!r.rev, r.a, r.b, r.off || 0, r.rate || 1].join()
/* ⌃X: every chosen file cut down to its pieces, in one step back. o: values for this time only (else the remembered) */
async function stripSilence (o) {
  const rs = selRegs().filter(([q, t]) => !q.loop && !q.notes && !q.rev && t.kind === 'audio')
  if (!rs.length) { say('choose a file first'); return }
  o = silClean(Object.assign({}, SIL, o))
  if (!NAT && !rs.some(([r]) => r.peaksAll && r.peaksAll.length)) { say('the app listens for that'); return }
  say('listening')
  const heard = await Promise.all(rs.map(async ([r]) => {
    const { key, k } = silSource(r), L = NAT ? await silLevels(key) : silOutline(r)
    if (!L) return [r, null, '']
    let parts = silPlan(r, k, L, o)
    /* the cuts onto zero (Logic's search zero crossings): only where a piece is cut out of the file, not at its own ends */
    if (NAT && o.zero && !o.whole && parts.length) {
      const at = [], len = L.lv.length * L.hop
      parts.forEach(([, , s0, s1]) => { at.push([s0, -1], [s1, 1]) })
      const z = await NAT.call('zeroCross', { key, at, within: .01 })
      if (Array.isArray(z) && z.length === at.length) {
        const bar = s => clamp(barOfD(r, s / k), r.a - 1, r.b - 1)
        parts = parts.map(([x, y, s0, s1], i) => [x > r.a - 1 + 1e-9 && s0 > 0 ? bar(z[2 * i]) : x, y < r.b - 1 - 1e-9 && s1 < len ? bar(z[2 * i + 1]) : y])
        for (let i = 1; i < parts.length; i++) parts[i][0] = Math.max(parts[i][0], parts[i - 1][1])      // (two cuts moved past each other: they meet)
        parts = parts.filter(([x, y]) => y - x > 1e-4)
      }
    }
    return [r, parts.map(p => [p[0], p[1]]), silSig(r)]
  }))
  let cut = 0, pieces = 0
  edit(() => {
    const c = silCut(heard)
    cut = c.cut; pieces = c.pieces
    if (!cut) return false
    S.selR = c.made.map(q => q.id); S.focus = 'lanes'
  })
  say(cut ? pieces ? `${pieces} ${pieces === 1 ? 'piece' : 'pieces'} ${o.whole ? 'in whole bars' : 'with sound'}` : 'nothing in it reaches the threshold: taken out' : o.whole ? 'no empty bar in it' : 'no silence in it')
}

/* ── the band (strip silence draft 1, his yes of 2026-10-23): ⌃X opens strip silence in the foot's black band, where
   the chosen region's gain and fades are — the way (each silence, whole bars), the values, how many pieces, strip and
   cancel — and the lanes show what would stay before anything is cut: the file's whole length a dashed frame in its
   track's colour, the pieces that stay drawn inside it. A value is pulled up or down (shift: finer), pressed twice to be
   typed, pressed with option to come back to where it starts. Return (or ⌃X again) strips with what the band shows and
   remembers it; esc, cancel, or another choice of regions leaves it. In a look without the black band (as it comes) the
   band lies along the foot of the lanes, in the room's own words. ── */
const SILB = { on: false, ids: [], sel: '', o: null, L: new Map(), plans: new Map(), ghosts: new Map(), n: 0, wait: 0, tick: 0, twice: { k: '', at: 0 } }
const SIL_FIELDS = {
  floor: { key: 'THRESHOLD', show: v => `${v < 0 ? '−' : ''}${Math.abs(+v.toFixed(1))} dB`, per: .25, step: .5, read: (x, u) => -Math.abs(x) },
  gap: { key: 'SHORTEST', show: v => `${v.toFixed(2)} s`, per: .005, step: .01, read: (x, u) => u === 'ms' ? x / 1000 : x },
  pre: { key: 'BEFORE', show: v => `${Math.round(v * 1000)} ms`, per: .0005, step: .001, read: (x, u) => u === 's' ? x : x / 1000 },
  post: { key: 'AFTER', show: v => `${Math.round(v * 1000)} ms`, per: .001, step: .001, read: (x, u) => u === 's' ? x : x / 1000 },
  bars: { key: 'EMPTY BARS', show: v => `at least ${v}`, per: .05, step: 1, read: x => Math.round(x) },
}
const silShown = () => SILB.o.whole ? ['floor', 'bars', 'post'] : ['floor', 'gap', 'pre', 'post']
const silRegs = () => SILB.ids.map(id => regOf(id)).filter(([r]) => r)

/* ⌃X: the band opens on the chosen files (open, ⌃X strips) */
function stripOpen (o) {
  if (SILB.on) { if (o && o.whole != null) silSet('whole', o.whole); else stripApply(); return }
  const rs = selRegs().filter(([q, t]) => !q.loop && !q.notes && !q.rev && t.kind === 'audio')
  if (!rs.length) { say('choose a file first'); return }
  if (!NAT && !rs.some(([r]) => r.peaksAll && r.peaksAll.length)) { say('the app listens for that'); return }
  Object.assign(SILB, { on: true, ids: rs.map(([r]) => r.id), sel: S.selR.join(), o: silClean(Object.assign({}, SIL, o)), n: 0 })
  SILB.L.clear(); SILB.plans.clear(); SILB.ghosts.clear()
  const ask = ++SILB.wait
  for (const [r] of rs) {
    const { key } = silSource(r)
    const got = NAT ? silLevels(key) : Promise.resolve(silOutline(r))
    got.then(L => { if (SILB.on && SILB.wait === ask && L) { SILB.L.set(r.id, L); silReplan() } })
  }
  addEventListener('keydown', silKey, true)
  clearInterval(SILB.tick); SILB.tick = setInterval(silWatch, 250)
  silReplan()
}
function stripClose () {
  if (!SILB.on) return
  SILB.on = false; SILB.wait++; SILB.plans.clear(); SILB.ghosts.clear(); SILB.L.clear()
  removeEventListener('keydown', silKey, true); clearInterval(SILB.tick)
  uiDirty('top', 'info', 'lanes')
}
/* return: what the band shows is done, in one step back, and kept for next time */
async function stripApply () {
  if (!SILB.on) return
  const o = Object.assign({}, SILB.o), ids = SILB.ids.filter(id => regOf(id)[0])
  silKeep(o); stripClose()
  if (!ids.length) return
  S.selR = ids; S.focus = 'lanes'
  await stripSilence(o)
}
/* the pieces each file would be cut into, worked out again from what was heard (no zero crossings: they move a cut by a
   hundredth of a second at most, and only when it is done) */
function silReplan () {
  if (!SILB.on) return
  let n = 0
  for (const [r] of silRegs()) {
    const L = SILB.L.get(r.id)
    if (!L) { SILB.plans.set(r.id, null); continue }
    const plan = silPlan(r, silSource(r).k, L, SILB.o).map(p => [p[0], p[1]])
    SILB.plans.set(r.id, plan); SILB.ghosts.set(r.id, silGhosts(r, plan)); n += plan.length
  }
  SILB.n = n
  uiDirty('top', 'info', 'lanes')
}
const silReady = () => SILB.ids.every(id => SILB.plans.get(id))
/* the band goes when what it was opened on is no longer what is chosen, or is gone */
function silWatch () { if (SILB.on && (S.selR.join() !== SILB.sel || !silRegs().length)) stripClose() }
function silKey (e) {
  if (!SILB.on || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return
  if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); stripApply() }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stripClose() }
}
function silSet (k, v) {
  const o = SILB.o
  if (k === 'whole' || k === 'zero') o[k] = !!v
  else { const f = SIL_FIELDS[k]; o[k] = silClean({ [k]: Math.round(v / f.step) * f.step })[k] }
  silReplan()
}

/* ── on the lanes (laneRow asks): a file the band is about is drawn as the pieces that would stay, each as a region of
   its own would be (so its sound is drawn as it will be), and round the file's whole length a dashed frame in its
   track's colour, a little outside the regions ── */
function silGhosts (r, plan) {
  const ra = r.a - 1, rb = r.b - 1
  return plan.map(([a, b], k) => {
    const q = Object.assign({}, r, { id: `s${r.id}.${k}`, a: a + 1, b: b + 1, off: (r.off || 0) + (a - ra), fi: a <= ra + 1e-6 ? r.fi || 0 : 0, fo: b >= rb - 1e-6 ? r.fo || 0 : 0 })
    for (const f of Object.keys(q)) if (f[0] === '_') delete q[f]                       // (what was drawn of the whole file is not the piece's)
    delete q.xo
    return q
  })
}
const silPieces = list => SILB.on ? list.flatMap(r => SILB.ids.includes(r.id) && SILB.ghosts.get(r.id) ? SILB.ghosts.get(r.id) : [r]) : list
function silFrames (t, rh, xEnd) {
  if (!SILB.on) return ''
  let s = ''
  for (const r of t.regs) {
    if (!SILB.ids.includes(r.id)) continue
    const xa = Math.max(bx(r.a), X0 - 4), xb = Math.min(bx(r.b), xEnd, X1 + 4)
    if (xb > xa) s += R(n(xa + 1), 2, n(xb - xa - 2), rh - 4, { stroke: regLook(r, t).c, sw: 1.2, dash: '4 3' })
  }
  return s
}

/* ── the band in the black foot (bauhaus) ── */
function silFoot (y0) {
  const o = SILB.o, rs = silRegs()
  let s = R(0, y0, W, DECK_H, { fill: BH.black }), x = 16
  const yb = y0 + DECK_H / 2 + 4
  /* at the right: how many pieces, strip, cancel (the rest stops short of them in a narrow window, as the region's does) */
  const pc = silReady() ? String(SILB.n) : 'listening'
  const sw = tw('strip', 11) + 24, cw = tw('cancel', 11), rx = W - 16 - cw - 22 - sw, px = rx - 22 - tw(pc, 11), lim = px - 9 - tw('PIECES', 7, 600) - 24
  s += T(px, yb, pc, { size: 11, c: BH.paper }) + T(px - 9 - tw('PIECES', 7, 600), yb - .5, 'PIECES', { size: 7, w: 600, c: BH.yellow })
  s += R(rx, y0 + 8, sw, DECK_H - 16, { fill: BH.red }) + T(rx + 12, yb, 'strip', { size: 11, c: BH.paper }) + hit(rx, y0 + 4, sw, DECK_H - 8, 'sil-go')
  s += T(W - 16 - cw, yb, 'cancel', { size: 11, c: BH.paper, a: .42 }) + hit(W - 22 - cw, y0 + 4, cw + 12, DECK_H - 8, 'sil-off')
  const key = k => { s += T(x, yb - .5, k, { size: 7, w: 600, c: BH.yellow }); x += tw(k, 7, 600) + 9 }
  const val = (v, c, a) => { s += T(x, yb, v, { size: 11, c: c || BH.paper, a }); x += tw(v, 11) }
  const item = (k, v, more, cur) => { if (x + tw(k, 7, 600) + 9 + tw(v, 11) > lim) { x = Infinity; return } const x0 = x; key(k); const vx = x; val(v); s += hit(x0 - 4, y0 + 3, x - x0 + 8, DECK_H - 6, 'sil', `${more} data-vx="${n(vx)}" data-vw="${n(x - vx)}" data-fs="11"`, cur); x += 26 }
  item('STRIP SILENCE', rs.length === 1 ? asGiven(rs[0][0].tag || rs[0][0].name || rs[0][1].name) : `${rs.length} files`, '', 'default')
  if (x + tw('WAY', 7, 600) + 9 + tw('each silence', 11) + tw('whole bars', 11) + 28 > lim) return s
  key('WAY')
  for (const [w, on, k] of [['each silence', !o.whole, 'each'], ['whole bars', o.whole, 'whole']]) {
    const x0 = x
    if (on) { s += R(x - 6, y0 + 8, tw(w, 11) + 12, DECK_H - 16, { fill: BH.yellow }); val(w, BH.black) } else val(w, BH.paper, .42)
    s += hit(x0 - 6, y0 + 3, x - x0 + 12, DECK_H - 6, 'sil-way', ` data-k="${k}"`)
    x += 14
  }
  x += 12
  for (const k of silShown()) item(SIL_FIELDS[k].key, SIL_FIELDS[k].show(o[k]), ` data-k="${k}"`, 'ns-resize')
  if (!o.whole) item('ZERO CROSSINGS', o.zero ? 'on' : 'off', ' data-k="zero"')
  return s
}
/* …and along the foot of the lanes, in a look without it: the room's own fields and cells */
const SILB_H = 30
function silBand () {
  const o = SILB.o, rs = silRegs(), y = BY - SILB_H, by = y + SILB_H / 2 + 3.5
  let s = R(X0, y, X1 - X0, SILB_H, { fill: K1 }) + hline(X0, X1, y + .5, .16), x = X0 + 14
  const [k2, kw] = cells(0, 0, 18, [{ t: 'strip', on: true, a: 'sil-go' }, { t: 'cancel', a: 'sil-off' }], { size: 9.5 })
  const [pf, pw] = field(0, 0, 'pieces', silReady() ? String(SILB.n) : 'listening'), lim = X1 - 14 - kw - 16 - pw - 20
  s += G(pf, `translate(${n(X1 - 14 - kw - 16 - pw)} ${n(by)})`) + G(k2, `translate(${n(X1 - 14 - kw)} ${n(y + 6)})`)
  const put = (l, v, more, cur) => { if (x + tw(l, 9.5) + 5 + tw(v, 9.5) > lim) { x = Infinity; return } const [f, fw] = field(x, by, l, v), vx = x + tw(l, 9.5) + 5; s += f + hit(x - 4, y + 4, fw + 8, SILB_H - 8, 'sil', `${more} data-vx="${n(vx)}" data-vw="${n(tw(v, 9.5))}" data-fs="9.5"`, cur); x += fw + 18 }
  put('strip silence', rs.length === 1 ? fit(asGiven(rs[0][0].tag || rs[0][0].name || rs[0][1].name), 110, 9.5) : `${rs.length} files`, '', 'default')
  const [c, cw] = cells(x, y + 6, 18, [{ t: 'each silence', on: !o.whole, a: 'sil-way', more: ' data-k="each"' }, { t: 'whole bars', on: o.whole, a: 'sil-way', more: ' data-k="whole"' }], { size: 9.5 })
  if (x + cw > lim) return s
  s += c; x += cw + 18
  for (const k of silShown()) put(SIL_FIELDS[k].key.toLowerCase(), SIL_FIELDS[k].show(o[k]), ` data-k="${k}"`, 'ns-resize')
  if (!o.whole) put('zero crossings', o.zero ? 'on' : 'off', ' data-k="zero"')
  return s
}
/* ── presses and pulls on the band (ui.js hands presses on through DOWN_MORE, and a pull through drag.move) ── */
var DOWN_MORE = typeof DOWN_MORE === 'object' && DOWN_MORE ? DOWN_MORE : {}
Object.assign(DOWN_MORE, {
  'sil': (e, el, p) => {
    const k = el.dataset.k
    if (!SILB.on || !k) return
    if (k === 'zero') { silSet('zero', !SILB.o.zero); return }
    if (e.altKey) { silSet(k, SIL_DEF[k]); return }
    const now = performance.now(), T2 = SILB.twice, two = T2.k === k && now - T2.at < 420
    T2.k = two ? '' : k; T2.at = now
    if (two) { silType(k, el); return }
    const f = SIL_FIELDS[k], v0 = SILB.o[k]
    drag = { a: 'sil', k, ly: p.y, acc: 0, move: (ev, q) => { silSet(k, v0 + pulled(drag, q.y, f.per, ev)) }, up: () => {} }
  },
  'sil-way': (e, el) => { if (SILB.on) silSet('whole', el.dataset.k === 'whole') },
  'sil-go': () => stripApply(),
  'sil-off': () => stripClose(),
})
/* a value typed where it is read: a number, in the value's own unit unless another is said (ms, s) */
function silType (k, el) {
  const box = el.getBBox ? el.getBBox() : null, inp = $('rename'), f = SIL_FIELDS[k]
  if (!box || !inp) return
  const vx = +el.dataset.vx, vw = +el.dataset.vw, fs = +el.dataset.fs || 10.5                     // (over the value, as wide as it, and a little more for what is typed)
  inp.style.cssText = `left:${n(vx - 5)}px;top:${n(box.y + box.height / 2 - 9)}px;width:${n(Math.max(44, vw + 12))}px;height:18px;font:400 ${fs}px var(--f);text-align:left`
  inp.value = f.show(SILB.o[k]).replace('at least ', '').replace(/ (dB|ms|s)$/, '').replace('−', '-'); inp.hidden = false; inp.focus(); inp.select()
  let live = false
  setTimeout(() => { live = true; if (!inp.hidden && document.activeElement !== inp) { inp.focus(); inp.select() } }, 0)
  const done = keep => {
    inp.onblur = inp.onkeydown = null; inp.hidden = true
    const m = /^\s*([+-−]?\d*\.?\d+)\s*(db|ms|s|bars?)?\s*$/i.exec(inp.value)
    if (keep && m && SILB.on) silSet(k, f.read(+m[1].replace('−', '-'), (m[2] || '').toLowerCase()))
  }
  inp.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); done(true) } else if (ev.key === 'Escape') { ev.preventDefault(); done(false) } }
  inp.onblur = () => { if (live) done(true) }
}
/* joined to the room: the black foot shows the band while it is up; another look has it along the foot of the lanes */
{
  if (typeof SKINS === 'object' && SKINS.foot && SKINS.foot.poster) { const f0 = SKINS.foot.poster; SKINS.foot.poster = y0 => SILB.on ? silFoot(y0) : f0(y0) }
  const top0 = PARTS.top
  PARTS.top = function () { const s = top0.apply(this, arguments); return SILB.on && !(typeof SKIN === 'object' && SKIN.k.transport === 'poster' && DECK_H > 0) ? s + silBand() : s }
}
