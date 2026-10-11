/* ── the room's own instruments, opened: the synth, the kit, the sampler ──
   An instrument stands at the head of its track's patch as a plate with its picture on it; pressed, it opens where the
   patch stands (the `chain` key at the right of the panel's bar goes back). Every hand on an instrument's page is a
   plate in the track's own pigment with the thing itself drawn on it in the pigment's dark — the instrument, the wave it
   makes, what its filter lets through, how a note rises and dies, a drum's stroke, the sampler's sound — and is taken
   hold of on the drawing (the ink marks). The words under a plate only say what the drawing shows.
   (Drawn first as a draft: design/midi round 1 draft, draft 3. Read after midi.js and pics.js.)
   Nothing here is an edit of the song: what is turned is kept with the track (t.inst.p) and told to the engine at once. */
const IV = { pad: new Map(), g: {}, drag: null, asked: new Set() }
const instOpen = () => { const t = S.tracks[S.sel]; return !!(S.panel.on && S.panel.tab === 'patch' && S.panel.inst && isInst(t) && t.inst.kind !== 'plug') }
const SYNTH_REST = { wave1: 0, wave2: 0, oct2: 0, semi2: 0, detune: 8, mix: .5, sub: 0, noise: 0, pw: .5, fm: 0, fmRatio: 1, fmDecay: .6, cutoff: 4000, reso: .15, slope: 1, envAmt: 2, keyTrack: .4, velCut: .3, fA: .002, fD: .35, fS: .3, fR: .3, aA: .004, aD: .4, aS: .8, aR: .25, lfoRate: 5.2, vib: 0, lfoCut: 0, glide: 0, mono: 0, level: -6, spread: .35 }
const SAMPLER_REST = { start: 0, end: 1, loop: 0, loopStart: 0, loopEnd: 1, root: 60, a: .002, d: .3, s: 1, r: .12, oneShot: 0 }
const ivShape = (x, y, w, h, t) => shapePath(x, y, w, h, SHAPES[t.outline] || SHAPES.notes)
const ivPlate = (x, y, w, h, t, on) => P(ivShape(x, y, w, h, t), { fill: on ? t.csel : t.c }) + (on ? P(ivShape(x + .5, y + .5, w - 1, h - 1, t), { stroke: INK }) : '')
const ivMark = (x, y) => R(x - 3, y - 3, 6, 6, { fill: K0 }) + R(x - 2, y - 2, 4, 4, { fill: INK })
const ivWord = (x, y, name, val) => T(x, y, name, { size: 9, a: .4 }) + (val == null ? '' : T(x + tw(name, 9) + 6, y, val, { size: 9.5, a: .9 }))
const ivHit = (x, y, w, h, k, v, cur = 'pointer') => hit(x, y, w, h, 'iv', ` data-k="${k}"${v == null ? '' : ` data-v="${v}"`}`, cur)
const ivMs = v => v >= 1 ? `${+v.toFixed(2)} s` : `${Math.round(v * 1000)} ms`
const ivHz = v => v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(Math.round(v))
/* a length of time against where its mark stands on a plate: short times are given room (a thousandth of a second to ten seconds, evenly by ratio) */
const ivTf = v => Math.log(v / .0005) / Math.log(10 / .0005), ivTime = f => .0005 * (10 / .0005) ** clamp(f, 0, 1)

/* two turns of the wave a sound makes, as numbers −1..1: its two oscillators mixed (or the first bent by the second), what is
   under it, and its filter's rounding */
function synthWave (p, N = 200) {
  const osc = (k, ph) => { ph -= Math.floor(ph); return k === 0 ? 2 * ph - 1 : k === 1 ? (ph < p.pw ? 1 : -1) : k === 2 ? 4 * Math.abs(ph - .5) - 1 : Math.sin(2 * Math.PI * ph) }
  const bent = p.fm > .0005, mix = bent ? 0 : p.mix, k2 = 2 ** (Math.round(p.oct2) + Math.round(p.semi2) / 12), out = []
  for (let i = 0; i < N; i++) { const t = 2 * i / (N - 1), pm = bent ? p.fm * 1.1 * Math.sin(2 * Math.PI * t * p.fmRatio) : 0; out.push((1 - mix) * osc(Math.round(p.wave1), t + pm) + mix * osc(Math.round(p.wave2), t * k2 + pm) + p.sub * Math.sin(Math.PI * t)) }
  const a = 1 - Math.exp(-2 * Math.PI * p.cutoff / 17600)
  let y = 0
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { y += a * (out[i] - y); if (pass) out[i] = y }
  const top = Math.max(1e-6, ...out.map(Math.abs))
  return out.map(v => v / top)
}
function waveBody (vals, x, y, w, h, c) {
  const mid = y + h / 2, amp = h / 2 - 7, N = vals.length
  let d = `M${n(x)} ${n(mid)}`
  for (let i = 0; i < N; i++) d += `L${n(x + w * i / (N - 1))} ${n(mid - vals[i] * amp)}`
  return P(d + `L${n(x + w)} ${n(mid)}Z`, { fill: c }) + P(`M${n(x)} ${n(mid) + .5}H${n(x + w)}`, { stroke: c, sa: .5 })
}
/* what a filter lets through: loudness against pitch (20 to 20k, each octave as wide as the next), as a body from the floor up */
function filterBody (p, x, y, w, h) {
  const q = 1 / (2 - 1.96 * clamp(p.reso, 0, 1)), lo = -42, hi = 22, pts = []
  const X = f => x + w * Math.log(f / 20) / Math.log(1000), Y = db => y + h - (clamp(db, lo, hi) - lo) / (hi - lo) * (h - 8) - 2
  for (let i = 0; i <= 120; i++) {
    const f = 20 * 1000 ** (i / 120), r = f / p.cutoff
    let db = -10 * Math.log10((1 - r * r) ** 2 + (r / q) ** 2)
    if (p.slope >= .5) db += -10 * Math.log10((1 - r * r) ** 2 + (r / .8) ** 2)
    pts.push([X(f), Y(db)])
  }
  const peak = pts.reduce((a, b) => b[1] < a[1] ? b : a, pts[0]), at = [X(clamp(p.cutoff, 20, 20000)), Y(p.slope >= .5 ? 20 * Math.log10(q) - 2 : 20 * Math.log10(q))]
  return { d: `M${n(x)} ${n(y + h)}L` + pts.map(q2 => `${n(q2[0])} ${n(q2[1])}`).join('L') + `L${n(x + w)} ${n(y + h)}Z`, at: p.reso > .3 ? peak : at, X }
}
/* how a note rises and dies, on a plate: the body, its four marks, and where each stands (kept for the hand: IV.g[name]) */
function envPlate (name, x, top, w, h, t, A, D, Su, Rl, keys) {
  const k = (w - 16) / 3.5, base = top + h - 7, hi = top + 9
  const xa = x + 8 + k * (.06 + ivTf(A) * .9), xd = xa + k * (.15 + ivTf(D) * .8), xs = Math.max(xd + 8, x + w * .62), xr = Math.min(x + w - 8, xs + k * (.12 + ivTf(Rl) * .9)), ys = base - (base - hi) * Math.max(.03, Su)
  IV.g[name] = { x, y: top, w, h, k, rise: base - hi, marks: [[xa, hi, 'a'], [xd, ys, 'd'], [xs, ys, 's'], [xr, base, 'r']], keys }
  return ivPlate(x, top, w, h, t) + P(`M${n(x + 8)} ${base}L${n(xa)} ${hi}Q${n(xa + (xd - xa) * .3)} ${n(ys)} ${n(xd)} ${n(ys)}H${n(xs)}Q${n(xs + (xr - xs) * .3)} ${base} ${n(xr)} ${base}Z`, { fill: t.deep })
    + ivMark(xa, hi) + ivMark(xd, ys) + ivMark(xs, ys) + ivMark(xr, base) + ivHit(x, top, w, h, name, null, 'move')
}
/* the stroke of a drum: how loud it is from the moment it is struck (time runs faster at first, so that a tick and a long
   ring both show), as numbers 0..1 */
const DRUM_STROKE = { kick: [.30, 0], rim: [.028, 1], snare: [.15, 1], clap: [.11, 1], 'low tom': [.26, 0], hat: [.038, 1], 'mid tom': [.26, 0], 'open hat': [.34, 1], 'high tom': [.26, 0], crash: [.55, 1], ride: [.5, 1], tambourine: [.16, 1], cowbell: [.24, 0], conga: [.17, 0], shaker: [.055, 1], clave: [.026, 0] }
function drumStroke (name, decay, N = 120, sec = 1.2) {
  const [tau, noise] = DRUM_STROKE[name] || [.2, 1], d = decay == null ? 1 : decay, out = []
  let seed = 17 + name.length * 131
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < N; i++) {
    const t = sec * (i / (N - 1)) ** 2
    let e = Math.exp(-t / (tau * d))
    if (name === 'clap') { e = 0; for (let k = 0; k < 3; k++) { const u = t - .011 * k; if (u >= 0) e = Math.max(e, Math.exp(-u / .0045)) } const u = t - .031; e = Math.max(e * .9, u >= 0 ? Math.exp(-u / (.11 * d)) : 0) }
    else if (name === 'cowbell') e = .6 * Math.exp(-t / .018) + .4 * Math.exp(-t / (.24 * d))
    else if (name === 'tambourine' || name === 'shaker') e *= Math.min(1, t / (name === 'shaker' ? .006 : .003))
    else if (name === 'snare') e = Math.max(Math.exp(-t / (.085 * d)), .9 * Math.exp(-t / (.15 * d)))
    out.push(e * (noise ? .62 + .38 * rnd() : .82 + .18 * Math.abs(Math.sin(i * (name === 'kick' ? .55 : name === 'clave' ? 2.4 : 1.1)))))
  }
  return out
}
function strokeBody (vals, x, y, w, h, c, level = 1) {
  const mid = y + h / 2, amp = (h / 2 - 3) * level, N = vals.length, top = [], bot = []
  for (let i = 0; i < N; i++) { const px = x + w * i / (N - 1), a = Math.max(.4, vals[i] * amp); top.push(`${n(px)} ${n(mid - a)}`); bot.push(`${n(px)} ${n(mid + a)}`) }
  return P('M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z', { fill: c })
}
/* a thing with a middle it rests at (a tuning, a place between left and right): the room's own centre-out line */
const ivMid = (x, y, word, v, txt, k) => T(x, y + 3.4, word, { size: 9, a: .4 }) + R(x + 34, y - 1, 80, 2, { fill: INK, fa: .12 }) + R(Math.min(x + 74, x + 34 + 80 * v), y - 1, Math.abs(80 * v - 40), 2, { fill: INK, fa: .5 }) + R(x + 74, y - 2.5, 1, 5, { fill: INK, fa: .3 }) + R(x + 34 + 80 * v - 1, y - 5, 2, 10, { fill: INK }) + T(x + 124, y + 3.4, txt, { size: 9.5, a: .9 }) + ivHit(x + 28, y - 9, 92, 18, k, null, 'ew-resize')

/* ── at the head of the patch: one of the room's own instruments is a plate with its picture ── */
function instPlate (t, cx, cy, r) { const x = cx - r, y = cy - r, w = 2 * r; return R(x, y, w, w, { rx: 2, fill: t.c }) + PIC.pic(picOfInst(t.inst), x, y, w, w, t.deep, t.c, 3) }

/* the track's own strip and the room's, at the right (as the patch has them) */
function ivStrips (y, h) {
  const t = S.tracks[S.sel], rx = RX - SIDE, x1 = rx + GUT, x2 = x1 + WSTRIP + 6
  let s = R(rx, y, RX - rx, h, { fill: K2, fa: .6 }) + vline(rx - .5, y, y + h, .08)
  MGEOM = stripGeom(y, h, true)
  s += stripGutter(rx, GUT, y, h, true)
  s += R(x1, y, WSTRIP, h, { fill: INK, fa: .05 }) + strip(x1, y, WSTRIP, h, t, S.sel, { wide: true, sel: true }) + vline(x1 + WSTRIP + 2.5, y + 8, y + h - 8, .07)
  return s + strip(x2, y, WSTRIP, h, MASTER(), -1, { wide: true, master: true })
}
function pInst (y, h) {
  const t = S.tracks[S.sel], I = t.inst, rxr = RX - SIDE, rx = Math.max(rxr, 800), tight = rx < 1000, p0 = instParams(I), cid = 'iv' + (++UID)      // (narrower than 800 — the smallest window with slur open — it is laid out as for 800 and cut where the strips begin)
  IV.g = {}
  const top = y + 30, name = (x, word) => T(x, y + 20, word, { size: 9, a: .34 })
  let s = ''
  if (I.kind === 'synth') {
    const p = Object.assign({}, SYNTH_REST, p0)
    /* its face: the instrument the chosen sound is, large; under it every sound, each a small plate with its instrument on it */
    const names = Object.keys(SYNTH_SOUNDS), wx = 24, hw = clamp(Math.round(rx * .27), 216, 328), hh = clamp(h - 112, 88, 128)       // (as tall as the panel leaves room for: two rows of sounds stand under it)
    const chh = 27, cg = hw < 300 ? 4 : 34 / 6, cw = (hw - 6 * cg) / 7
    s += name(wx, I.sound) + ivPlate(wx, top, hw, hh, t) + PIC.pic(I.sound, wx, top, hw, hh, t.deep, t.c, 12)
    names.forEach((nm, i) => { const cx = wx + (i % 7) * (cw + cg), cy = top + hh + 12 + Math.floor(i / 7) * (chh + 6), on = nm === I.sound; s += ivPlate(cx, cy, cw, chh, t, on) + PIC.pic(nm, cx, cy, cw, chh, t.deep, on ? t.csel : t.c, 3) + ivHit(cx, cy, cw, chh, 'sound', nm) })
    /* three plates: the wave, what the filter lets through, how a note rises and dies */
    const px0 = wx + hw + (tight ? 18 : 30), side = clamp(Math.round(rx * .13), 108, 150), gap = tight ? 12 : 18, pw = Math.max(96, Math.floor((rx - px0 - 24 - side - 3 * gap) / 3)), ph = hh, uy = top + ph + 17, slim = pw < 170      // (slim: what stands under a plate takes a row more instead of standing side by side)
    { const x = px0
      s += name(x, 'wave') + ivPlate(x, top, pw, ph, t) + waveBody(synthWave(p), x + 8, top + 6, pw - 16, ph - 12, t.deep)
      /* under it: the shape each of the two oscillators makes, as shapes; how much of each */
      const cwd = pw < 150 ? 20 : 24
      const glyph = k => (cx, cy, c, a) => P(k === 0 ? `M${cx - 6} ${cy + 4}L${cx + 4} ${cy - 4}V${cy + 4}` : k === 1 ? `M${cx - 6} ${cy + 4}V${cy - 4}H${cx}V${cy + 4}H${cx + 6}` : k === 2 ? `M${cx - 6} ${cy + 4}L${cx} ${cy - 4}L${cx + 6} ${cy + 4}` : `M${cx - 6} ${cy}C${cx - 3} ${cy - 8} ${cx - 1} ${cy - 8} ${cx} ${cy}S${cx + 3} ${cy + 8} ${cx + 6} ${cy}`, { stroke: c, sa: a, sw: 1.1 })
      const pick = (yy, which, cur, key) => T(x, yy + 12.6, which, { size: 9, a: .4 }) + cells(x + 14, yy, 18, [0, 1, 2, 3].map(k => ({ g: glyph(k), on: Math.round(cur) === k, a: 'iv', more: ` data-k="${key}" data-v="${k}"` })), { widths: [cwd, cwd, cwd, cwd] })[0]
      s += pick(uy - 8, '1', p.wave1, 'wave1') + pick(uy + 16, '2', p.wave2, 'wave2')
      const mx = slim ? x + 14 : x + 14 + 96 + 16, mw = slim ? pw - 28 : pw - (14 + 96 + 16), my = slim ? uy + 32 : uy
      IV.g.mix = { x: mx, w: mw }
      s += R(mx, my + 12, mw, 2, { fill: INK, fa: .12 }) + R(mx + mw * (p.fm > .0005 ? 0 : p.mix) - 1, my + 8, 2, 10, { fill: INK }) + ivHit(mx - 6, my + 2, mw + 12, 20, 'mix', null, 'ew-resize')
      s += slim ? T(x, my + 15.6, '1', { size: 8.5, a: .4 }) + T(x + pw, my + 15.6, '2', { size: 8.5, a: .4, anchor: 'end' }) : T(mx, uy + 1, '1', { size: 8.5, a: .4 }) + T(mx + mw, uy + 1, '2', { size: 8.5, a: .4, anchor: 'end' }) }
    { const x = px0 + pw + gap, f = filterBody(p, x, top, pw, ph)
      let ticks = ''
      for (const hz of [100, 1000, 10000]) ticks += `M${n(f.X(hz)) + .5} ${top + ph - 6}V${top + ph}`
      IV.g.filter = { x, y: top, w: pw, h: ph }
      s += name(x, 'filter') + `<clipPath id="${cid}"><path d="${ivShape(x, top, pw, ph, t)}"/></clipPath>` + ivPlate(x, top, pw, ph, t) + G(P(f.d, { fill: t.deep }) + P(ticks, { stroke: t.c, sa: .7 }), '', ` clip-path="url(#${cid})"`) + ivMark(f.at[0], f.at[1]) + ivHit(x, top, pw, ph, 'filter', null, 'move')
      s += ivWord(x, uy + 4, 'cutoff', ivHz(p.cutoff)) + ivWord(slim ? x : x + 92, slim ? uy + 18 : uy + 4, 'resonance', String(Math.round(p.reso * 100)))
      const steep = k => (cx, cy, c, a) => P(k ? `M${cx - 7} ${cy - 4}H${cx - 1}L${cx + 3} ${cy + 5}` : `M${cx - 7} ${cy - 4}H${cx - 2}L${cx + 7} ${cy + 5}`, { stroke: c, sa: a, sw: 1.1 })
      s += T(x, uy + (slim ? 40.6 : 28.6), 'slope', { size: 9, a: .4 }) + cells(x + 34, uy + (slim ? 28 : 16), 18, [0, 1].map(k => ({ g: steep(k), on: (p.slope >= .5) === !!k, a: 'iv', more: ` data-k="slope" data-v="${k}"` })), { widths: [26, 26] })[0] }
    { const x = px0 + 2 * (pw + gap)
      s += name(x, 'loudness') + envPlate('env', x, top, pw, ph, t, p.aA, p.aD, p.aS, p.aR, ['aA', 'aD', 'aS', 'aR'])
      ;[ivMs(p.aA), ivMs(p.aD), String(Math.round(p.aS * 100)), ivMs(p.aR)].forEach((v, k2) => { s += T(x + pw * (k2 + .5) / 4, uy + 4 + (slim && k2 % 2 ? 14 : 0), v, { size: 9.5, a: .9, anchor: 'middle' }) }) }
    /* at the side: how it moves — a note that wavers, a note that slides to the next — each a small plate; one voice or many */
    { const x = rx - 24 - side, sh = Math.round((ph - 24) / 2), vib = p.vib, wav = []
      for (let i = 0; i <= 60; i++) wav.push(`${n(x + 8 + (side - 16) * i / 60)} ${n(top + sh / 2 - Math.sin(i / 60 * Math.PI * 10) * (sh / 2 - 9) * vib * (i / 60))}`)
      s += name(x, 'movement') + ivPlate(x, top, side, sh, t) + P('M' + wav.join('L'), { stroke: t.deep, sw: 2 }) + ivWord(x, top + sh + 13, 'wavers', String(Math.round(vib * 100))) + ivHit(x, top, side, sh, 'vib', null, 'ns-resize')
      const y2 = top + sh + 26, gl = clamp(p.glide / .2, 0, 1), xm = x + side * .34
      s += ivPlate(x, y2, side, sh, t) + P(`M${x + 8} ${y2 + sh - 12}H${n(xm)}C${n(xm + (side * .5) * gl * .5)} ${y2 + sh - 12} ${n(xm + (side * .5) * gl * .5)} ${y2 + 12} ${n(xm + side * .5 * gl)} ${y2 + 12}H${x + side - 8}`, { stroke: t.deep, sw: 2 }) + ivWord(x, y2 + sh + 13, 'slides', ivMs(p.glide)) + ivHit(x, y2, side, sh, 'glide', null, 'ew-resize')
      s += T(x, y2 + sh + 40.6, 'voices', { size: 9, a: .4 }) + cells(x + (side < 126 ? 38 : 42), y2 + sh + 28, 18, [{ t: 'many', on: p.mono < .5, a: 'iv', more: ' data-k="mono" data-v="0"' }, { t: 'one', on: p.mono >= .5, a: 'iv', more: ' data-k="mono" data-v="1"' }], { size: 9.5, widths: side < 126 ? [38, 32] : [44, 38] })[0] }
  } else if (I.kind === 'drums') {
    /* the pads, each the drum it is; the chosen one beside them — the drum, then its stroke, its tail and its height to be taken hold of */
    const pw = 92, g = 6, ph = clamp(Math.floor((h - 42 - 3 * g) / 4), 34, 50), gx = 24, gy = top, sel = clamp(IV.pad.get(t.id) == null ? 0 : IV.pad.get(t.id), 0, DRUM_PADS.length - 1)
    s += name(gx, 'pads')
    DRUM_PADS.forEach(([nm], i) => {
      const cx = gx + (i % 4) * (pw + g), cy = gy + (3 - Math.floor(i / 4)) * (ph + g), on = i === sel, own = I.pads && I.pads[i]
      s += ivPlate(cx, cy, pw, ph, t, on) + PIC.pic(nm, cx, cy, pw, ph, t.deep, on ? t.csel : t.c, 5) + (own ? R(cx + pw - 10, cy + 5, 4, 4, { fill: INK }) : '') + ivHit(cx, cy, pw, ph, 'pad', i)
    })
    const [pn, pk] = DRUM_PADS[sel], bx0 = gx + 4 * (pw + g) + (tight ? 20 : 30), bw = rx - bx0 - 24, two = bw < 540, bh = two ? clamp(h - 100, 100, 142) : clamp(h - 74, 110, 142), lvDb = p0[`${pn}.level`] || 0, lvl = (lvDb + 36) / 42, d = p0[`${pn}.decay`] == null ? 1 : p0[`${pn}.decay`], own = I.pads && I.pads[sel]
    const face = Math.min(178, bw * .3), sx0 = bx0 + face + 12, sw0 = bw - face - 20
    const vals = drumStroke(pn, d, 260), cut = Math.max(8, vals.findIndex(v => v < .02)), xEnd = sx0 + sw0 * (cut < 0 ? 1 : cut / (vals.length - 1)), yLv = top + bh / 2 - (bh / 2 - 9) * (.35 + .65 * lvl)
    let ticks = ''
    for (const sec of [.01, .1, 1]) { const px = sx0 + sw0 * Math.sqrt(sec / 1.2); ticks += P(`M${n(px) + .5} ${top + bh - 6}V${top + bh}`, { stroke: t.deep, sa: .8 }) + T(px + 4, top + bh - 4, sec < 1 ? `${sec * 1000} ms` : '1 s', { size: 7.5, c: t.deep, a: .8 }) }
    IV.g.stroke = { x: sx0, y: top, w: sw0, h: bh, marks: [[xEnd, top + bh / 2, 'decay'], [sx0, yLv, 'level']], pad: pn }
    s += T(bx0, y + 20, pn, { size: 9, w: 500, a: .9 }) + T(bx0 + tw(pn, 9, 500) + 6, y + 20, keyName(pk), { size: 9, a: .4 })
    s += `<clipPath id="${cid}"><path d="${ivShape(bx0, top, bw, bh, t)}"/></clipPath>` + ivPlate(bx0, top, bw, bh, t) + PIC.pic(pn, bx0, top, face, bh, t.deep, t.c, 14) + P(`M${n(bx0 + face) + .5} ${top + 12}V${top + bh - 12}`, { stroke: t.deep, sa: .5 }) + G(strokeBody(vals, sx0, top + 6, sw0, bh - 12, t.deep, .35 + .65 * lvl) + ticks, '', ` clip-path="url(#${cid})"`)
    s += P(`M${n(xEnd) + .5} ${top + 10}V${top + bh - 10}`, { stroke: INK, sa: .9 }) + ivMark(xEnd, top + bh / 2) + ivMark(sx0, yLv) + ivHit(bx0, top, face, bh, 'pad', sel) + ivHit(sx0 - 8, top, sw0 + 16, bh, 'stroke', null, 'move')
    const uy = top + bh + 22, col = Math.min(210, (bw - 20) / 4), tune = p0[`${pn}.tune`] || 0, pan = p0[`${pn}.pan`] || 0
    const half = Math.max(170, Math.round(bw / 2)), xt = two ? bx0 : bx0 + col + 20, xp = two ? bx0 + half : bx0 + 2 * col + 20, y2 = two ? uy + 26 : uy
    s += T(bx0, uy + 3.4, 'sound', { size: 9, a: .4 }) + menuKey(bx0 + 36, uy - 9, fit(own ? String(own.name).toLowerCase() : 'made here', two ? 110 : Math.min(130, col - 46), 9.5), { a: 'iv', more: ' data-k="padsound"' })[0]
    IV.g.ptune = { x: xt + 34, w: 80, pad: pn }; IV.g.ppan = { x: xp + 34, w: 80, pad: pn }
    s += ivMid(xt, y2, 'tune', (tune + 24) / 48, (tune >= 0 ? '+' : '−') + Math.abs(tune), 'ptune') + ivMid(xp, y2, 'pan', (pan + 1) / 2, panText(pan), 'ppan')
    s += ivWord(two ? bx0 + half : bx0 + 3 * col + 20, uy + 3.4, 'level', `${fmtDb(lvDb)} db`)
  } else {
    /* the sampler: the machine; its sound as a region carries a sound, where it starts and ends, the stretch it goes round (marked as the cycle is); how a note of it rises and dies */
    const p = Object.assign({}, SAMPLER_REST, p0), sm = I.sample, ew = tight ? 150 : 190, gap = tight ? 12 : 18, fx = 24, fw = tight ? 140 : 178, wx = fx + fw + gap, ww = Math.max(160, rx - 24 - wx - ew - gap)
    const keyRow = ww + gap + ew < 690, ph = keyRow ? clamp(h - 101, 96, 128) : 128, uy = top + ph + 22      // (keyRow: its key stands on a row of its own, under the other two)
    s += name(fx, 'sampler') + ivPlate(fx, top, fw, ph, t) + PIC.pic('sampler', fx, top, fw, ph, t.deep, t.c, 14)
    s += name(wx, 'sound') + menuKey(wx + tw('sound', 9) + 8, y + 7, fit(sm ? String(sm.name).toLowerCase() : 'none', 220, 9.5), { a: 'iv', more: ' data-k="smsound"' })[0]
    const xs = wx + ww * p.start, xe = wx + ww * p.end, pk = sm && sampleShape(sm)
    let inner = pk ? strokeBody(pk, wx + 2, top + 4, ww - 4, ph - 8, t.deep) : P(`M${wx + 8} ${top + ph / 2 + .5}H${wx + ww - 8}`, { stroke: t.deep, sa: .6 })
    inner += R(wx, top, xs - wx, ph, { fill: K1, fa: .7 }) + R(xe, top, wx + ww - xe, ph, { fill: K1, fa: .7 })
    if (p.loop >= .5) inner += R(wx + ww * p.loopStart, top, ww * (p.loopEnd - p.loopStart), 3, { fill: SOLO }) + P(`M${n(wx + ww * p.loopStart) + .5} ${top}V${top + ph}M${n(wx + ww * p.loopEnd) - .5} ${top}V${top + ph}`, { stroke: SOLO, sa: .8 })
    IV.g.sm = { x: wx, y: top, w: ww, h: ph, loop: p.loop >= .5 }
    s += `<clipPath id="${cid}"><path d="${ivShape(wx, top, ww, ph, t)}"/></clipPath>` + ivPlate(wx, top, ww, ph, t) + G(inner, '', ` clip-path="url(#${cid})"`)
    s += P(`M${n(xs) + .5} ${top}V${top + ph}M${n(xe) + .5} ${top}V${top + ph}`, { stroke: INK }) + ivMark(xs, top + ph / 2) + ivMark(xe, top + ph / 2) + ivHit(wx - 6, top, ww + 12, ph, 'sm', null, 'ew-resize')
    const ex = wx + ww + gap
    s += name(ex, 'loudness') + envPlate('senv', ex, top, ew, ph, t, p.a, p.d, p.s, p.r, ['a', 'd', 's', 'r'])
    s += T(wx, uy + 3.4, 'plays', { size: 9, a: .4 }) + cells(wx + 34, uy - 9, 18, [{ t: 'while held', on: p.oneShot < .5, a: 'iv', more: ' data-k="oneShot" data-v="0"' }, { t: 'to its end', on: p.oneShot >= .5, a: 'iv', more: ' data-k="oneShot" data-v="1"' }], { size: 9.5 })[0]
    s += T(wx + 230, uy + 3.4, 'goes round', { size: 9, a: .4 }) + cells(wx + 230 + 62, uy - 9, 18, [{ t: 'no', on: p.loop < .5, a: 'iv', more: ' data-k="loop" data-v="0"' }, { t: 'yes', on: p.loop >= .5, c: SOLO, a: 'iv', more: ' data-k="loop" data-v="1"' }], { size: 9.5, widths: [34, 38] })[0]
    /* its own key, shown where it lies among the keys: three octaves of a keyboard, the key in the track's pigment */
    { const kx = keyRow ? wx : wx + 420, kw = 9, kh = 18, lo = Math.floor(p.root / 12) * 12 - 12, keysAt = [], uy0 = uy
      { const uy = uy0 + (keyRow ? 28 : 0)
        s += T(kx, uy + 3.4, 'its key', { size: 9, a: .4 })
        let whites = '', blacks = '', i = 0
        for (let key = lo; key < lo + 36; key++) { const black = [1, 3, 6, 8, 10].includes(key % 12), on = key === Math.round(p.root); if (black) { blacks += R(kx + 40 + i * kw - 3, uy - 9, 6, 11, { fill: on ? t.c : K0 }); keysAt.push([kx + 40 + i * kw - 3, 6, key, true]) } else { whites += R(kx + 40 + i * kw, uy - 9, kw - 1, kh, { fill: on ? t.c : INK, fa: on ? 1 : .88 }); keysAt.push([kx + 40 + i * kw, kw, key, false]); i++ } }
        IV.g.root = { y: uy - 9, keys: keysAt }
        s += whites + blacks + T(kx + 40 + i * kw + 8, uy + 3.4, keyName(Math.round(p.root)), { size: 9.5, a: .9 }) + ivHit(kx + 38, uy - 10, i * kw + 4, kh + 2, 'root')
      } }
  }
  return ivStrips(y, h) + (rxr < rx ? `<clipPath id="${cid}p"><rect x="0" y="${y}" width="${rxr}" height="${h}"/></clipPath>` + G(s, '', ` clip-path="url(#${cid}p)"`) : s)
}
/* the sound a sampler plays from, as a body: its outline as the app measured it (a hundred points or so) */
function sampleShape (sm) {
  if (sm.peaks && sm.peaks.length > 8) return sm.peaks
  if (!IV.asked.has(sm.file) && NAT) {
    IV.asked.add(sm.file)
    NAT.call('audioLoad', { project: projKey(), file: sm.file }).then(d => {
      if (!d || !d.ok || !Array.isArray(d.peaks) || d.peaks.length < 2) return
      const N = Math.min(320, d.peaks.length), out = []                              // (a long sound is thinned to what a plate can show: the loudest of each stretch)
      for (let i = 0; i < N; i++) { let m = 0; for (let k = Math.floor(i * d.peaks.length / N); k < Math.floor((i + 1) * d.peaks.length / N); k++) m = Math.max(m, Math.abs(d.peaks[k])); out.push(m) }
      const top = Math.max(1e-6, ...out)
      sm.peaks = out.map(v => +(v / top).toFixed(3)); sm.sec = d.sec; uiDirty('dock')
    })
  }
  return null
}

/* ── hands ── */
/* something turned on the chosen track's own instrument (told to the engine at once; the panel is drawn again) */
function ivSet (p) { const t = S.tracks[S.sel]; setInstParams(t, p); uiDirty('dock') }
/* with option held, a press puts things back where the sound (or the instrument) has them */
function ivRest (keys) { const t = S.tracks[S.sel], I = t.inst; for (const k of keys) delete I.p[k]; t._instTold = null; instSyncAll(); uiDirty('dock') }
function ivPadSound (t, sel, x, y) {
  const own = t.inst.pads && t.inst.pads[sel], files = (PROJ.pool || []).slice(0, 40)
  openMenu(x, y, [{ t: 'made here', v: null, on: !own }].concat(files.map(f => ({ t: fit(String(f.file).replace(/\.[^.]+$/, '').toLowerCase(), 180, 9.5), v: f, on: !!own && own.file === f.file }))), it => { setInstSample(t, sel, it.v ? { file: it.v.file, name: String(it.v.file).replace(/\.[^.]+$/, '') } : null) }, { w: 220 })
}
function ivDown (e) {
  const el = e.target.closest ? e.target.closest('[data-a]') : null
  if (!el || e.button === 2) return false
  const a = el.dataset.a, t = S.tracks[S.sel]
  if (a === 'inst' && isInst(t) && t.inst.kind !== 'plug' && !e.altKey) { S.panel.inst = true; closePicker(); uiDirty('dock'); e.preventDefault(); return true }      // the instrument's plate at the head of the patch: its page opens where the patch stands
  if (a !== 'iv' || !isInst(t)) return false
  e.preventDefault()
  if (S.menu) { S.menu = null; uiDirty('menu') }
  const k = el.dataset.k, v = el.dataset.v, p = pt(e), I = t.inst, g = IV.g, sel = clamp(IV.pad.get(t.id) || 0, 0, DRUM_PADS.length - 1)
  const P0 = Object.assign({}, I.kind === 'synth' ? SYNTH_REST : I.kind === 'sampler' ? SAMPLER_REST : {}, instParams(I))
  const hold = d => { IV.drag = Object.assign({ x0: p.x, y0: p.y, P0 }, d); try { svg.setPointerCapture(e.pointerId) } catch (err) {} }
  const nearest = marks => marks.reduce((best, m) => Math.hypot(m[0] - p.x, m[1] - p.y) < Math.hypot(best[0] - p.x, best[1] - p.y) ? m : best, marks[0])
  switch (k) {
    case 'chain': S.panel.inst = false; uiDirty('dock'); break
    case 'sound': setInst(t, 'synth', v); break
    case 'wave1': case 'wave2': if (e.altKey) ivRest([k]); else ivSet({ [k]: +v, fm: k === 'wave1' && +v !== 3 ? 0 : P0.fm }); break       // (a wave other than the plain one is not bent by the second oscillator: it would no longer be that wave)
    case 'slope': case 'mono': case 'oneShot': ivSet({ [k]: +v }); break
    case 'loop': ivSet(Object.assign({ loop: +v }, +v && !(P0.loopEnd - P0.loopStart > .02 && P0.loopStart >= P0.start && P0.loopEnd <= P0.end) ? { loopStart: P0.start + (P0.end - P0.start) * .3, loopEnd: P0.start + (P0.end - P0.start) * .7 } : {})); break
    case 'mix': if (e.altKey) ivRest(['mix']); else { hold({ k }); ivMove(e) } break
    case 'filter': if (e.altKey) ivRest(['cutoff', 'reso']); else hold({ k }); break
    case 'env': case 'senv': if (e.altKey) ivRest(g[k].keys); else hold({ k, m: nearest(g[k].marks)[2], keys: g[k].keys, kk: g[k].k, rise: g[k].rise }); break
    case 'vib': if (e.altKey) ivRest(['vib']); else hold({ k }); break
    case 'glide': if (e.altKey) ivRest(['glide']); else hold({ k }); break
    case 'pad': { const i = +v; IV.pad.set(t.id, i); playKey(0x90, DRUM_PADS[i][1], 100); setTimeout(() => playKey(0x80, DRUM_PADS[i][1], 0), 140); uiDirty('dock'); break }      // a pad pressed is chosen, and heard
    case 'stroke': { const pn = g.stroke.pad; if (e.altKey) ivRest([`${pn}.decay`, `${pn}.level`]); else hold({ k, m: nearest(g.stroke.marks)[2], pn, d0: I.p[`${pn}.decay`] == null ? 1 : I.p[`${pn}.decay`], l0: I.p[`${pn}.level`] || 0 }); break }
    case 'ptune': case 'ppan': { const pn = g[k].pad, key = `${pn}.${k === 'ptune' ? 'tune' : 'pan'}`; if (e.altKey) ivRest([key]); else { hold({ k, key }); ivMove(e) } break }
    case 'padsound': ivPadSound(t, sel, p.x - 10, p.y - 14 - Math.min(40, (PROJ.pool || []).length + 1) * 19); break
    case 'smsound': { const files = (PROJ.pool || []).slice(0, 40), sm = I.sample; openMenu(p.x - 10, p.y + 12, files.length ? files.map(f => ({ t: fit(String(f.file).replace(/\.[^.]+$/, '').toLowerCase(), 200, 9.5), v: f, on: !!sm && sm.file === f.file })) : [{ t: 'no sound in this project yet', dim: true }], it => { if (it.v) setInstSample(t, 0, { file: it.v.file, name: String(it.v.file).replace(/\.[^.]+$/, '') }) }, { w: 240 }); break }
    case 'sm': { if (e.altKey) { ivRest(['start', 'end', 'loopStart', 'loopEnd']); break } const q = g.sm, X = f => q.x + q.w * f, cands = [[X(P0.start), 'start'], [X(P0.end), 'end']].concat(q.loop ? [[X(P0.loopStart), 'loopStart'], [X(P0.loopEnd), 'loopEnd']] : []); hold({ k, m: cands.reduce((b, c) => Math.abs(c[0] - p.x) < Math.abs(b[0] - p.x) ? c : b, cands[0])[1] }); break }
    case 'root': { const q = g.root, hitKey = q.keys.filter(z => z[3] && p.x >= z[0] && p.x < z[0] + z[1] && p.y < q.y + 11)[0] || q.keys.filter(z => !z[3] && p.x >= z[0] && p.x < z[0] + z[1])[0]; if (hitKey) { ivSet({ root: hitKey[2] }); playKey(0x90, hitKey[2], 100); setTimeout(() => playKey(0x80, hitKey[2], 0), 200) } break }
  }
  return true
}
function ivMove (e) {
  const d = IV.drag
  if (!d) return
  const p = pt(e), dx = p.x - d.x0, dy = p.y - d.y0, fine = e.shiftKey ? .2 : 1, g = IV.g, P0 = d.P0
  if (d.k === 'mix') ivSet({ mix: clamp((p.x - g.mix.x) / g.mix.w, 0, 1), fm: 0 })
  else if (d.k === 'filter') ivSet({ cutoff: clamp(P0.cutoff * 1000 ** (dx * fine / g.filter.w), 20, 20000), reso: clamp(P0.reso - dy * fine / (g.filter.h * .7), 0, 1) })
  else if (d.k === 'env' || d.k === 'senv') {
    const [kA, kD, kS, kR] = d.keys, out = {}
    if (d.m === 'a') out[kA] = ivTime(ivTf(P0[kA]) + dx * fine / (d.kk * .9))
    else if (d.m === 'r') out[kR] = ivTime(ivTf(P0[kR]) + dx * fine / (d.kk * .9))
    else { if (d.m === 'd') out[kD] = ivTime(ivTf(P0[kD]) + dx * fine / (d.kk * .8)); out[kS] = clamp(P0[kS] - dy * fine / d.rise, 0, 1) }
    ivSet(out)
  } else if (d.k === 'vib') ivSet({ vib: clamp(P0.vib - dy * fine / 60, 0, 1) })
  else if (d.k === 'glide') ivSet({ glide: clamp(P0.glide + dx * fine * .002, 0, 2) })
  else if (d.k === 'stroke') { if (d.m === 'decay') ivSet({ [`${d.pn}.decay`]: clamp(d.d0 + dx * fine / 160, .2, 3) }); else ivSet({ [`${d.pn}.level`]: Math.round(clamp(d.l0 - dy * fine * .35, -36, 6) * 10) / 10 }) }
  else if (d.k === 'ptune') ivSet({ [d.key]: Math.round(clamp((p.x - g.ptune.x) / g.ptune.w, 0, 1) * 48 - 24) })
  else if (d.k === 'ppan') { const v = clamp((p.x - g.ppan.x) / g.ppan.w, 0, 1) * 2 - 1; ivSet({ [d.key]: Math.abs(v) < .06 ? 0 : Math.round(v * 100) / 100 }) }
  else if (d.k === 'sm') {
    const f = clamp((p.x - g.sm.x) / g.sm.w, 0, 1), o = {}
    if (d.m === 'start') o.start = Math.min(f, P0.end - .02); else if (d.m === 'end') o.end = Math.max(f, P0.start + .02)
    else if (d.m === 'loopStart') o.loopStart = clamp(f, P0.start, P0.loopEnd - .02); else o.loopEnd = clamp(f, P0.loopStart + .02, P0.end)
    ivSet(o)
  }
}
function ivUp () { IV.drag = null }

/* ── joined to the room (this script is read after the room's own hands are made, before they are put to work) ── */
{
  const down0 = onDown, move0 = onMove, up0 = onUp, dock0 = PARTS.dock, head0 = pPanelHead, frame0 = loanFrame
  onDown = function (e) { if (!ivDown(e)) down0(e) }
  onMove = function (e) { if (IV.drag) { ivMove(e); return } move0(e) }
  onUp = function (e) { if (IV.drag) { ivUp(); return } up0(e) }
  /* one of the room's own instruments at the head of a patch is its plate, not a frame with a name in it */
  loanFrame = function (cx, cy, r, name) { const t = S.tracks[S.sel]; return isInst(t) && t.inst.kind !== 'plug' && name === instName(t) ? instPlate(t, cx, cy, r) : frame0(cx, cy, r, name) }
  /* the panel's bar while an instrument is open: which instrument, and the key that goes back to the chain */
  pPanelHead = function (y, tab) {
    let s = head0(y, tab)
    if (tab !== 'patch' || !instOpen()) return s
    const t = S.tracks[S.sel], rx = RX - SIDE, cw = keyW('chain', {}), word = `${instName(t)}  ${instWord(t)}`
    return s + R(rx - 150, y + 1, 149, PH - 2, { fill: K2 }) + hit(rx - 150, y + 1, 149, PH - 2, 'iv', ' data-k="none"', 'default') + key(rx - 12 - cw, y + 4, 'chain', { a: 'iv', more: ' data-k="chain"' })[0] + T(rx - 12 - cw - 10, y + 16.6, fit(word, 124, 9.5), { size: 9.5, a: .6, anchor: 'end' })
  }
  PARTS.dock = function () {
    if (!instOpen() || VIEW.p <= .001) return dock0()
    const y = BY, h = S.panel.h
    return R(0, y, RX, h + 2, { fill: K1 }) + pInst(y + PH, h - PH) + pPanelHead(y, 'patch')
  }
}
