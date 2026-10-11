/* the instruments, draft 2 — a face for each of the room's own instruments. A DRAFT, drawn with the room's own kit on the
   room's own page (draft.mjs reads it into the page after roll-draft.js, whose instrument page it replaces; the app does
   not load it, and nothing here takes the pointer yet).

   Draft 1 was names and lines: it had to be read. Here every hand is a PLATE in the track's own pigment with the thing
   itself drawn on it in the pigment's dark, as a region carries its sound — the wave the synth makes, what its filter
   lets through, how a note rises and dies; a drum as the shape of its stroke; the sampler's sound. What is turned is
   taken hold of on the drawing (the ink marks); the words under a plate only say what the drawing already shows.
   At the head of the patch each instrument stands as a small plate of its own, beside tape, space and delay. */
const ID = { pad: 2 }
const plateShape = (x, y, w, h, t) => shapePath(x, y, w, h, SHAPES[t.outline] || SHAPES.notes)
const plateBox = (x, y, w, h, t, on) => P(plateShape(x, y, w, h, t), { fill: on ? t.csel : t.c }) + (on ? P(plateShape(x + .5, y + .5, w - 1, h - 1, t), { stroke: INK }) : '')
const holdMark = (x, y) => R(x - 3, y - 3, 6, 6, { fill: K0 }) + R(x - 2, y - 2, 4, 4, { fill: INK })
const belowText = (x, y, name, val) => T(x, y, name, { size: 9, a: .4 }) + (val == null ? '' : T(x + tw(name, 9) + 6, y, val, { size: 9.5, a: .9 }))
const msText = v => v >= 1 ? `${+v.toFixed(2)} s` : `${Math.round(v * 1000)} ms`
const hzText = v => v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(Math.round(v))
const SYNTH_REST = { wave1: 0, wave2: 0, oct2: 0, semi2: 0, detune: 8, mix: .5, sub: 0, noise: 0, pw: .5, fm: 0, fmRatio: 1, fmDecay: .6, cutoff: 4000, reso: .15, slope: 1, envAmt: 2, keyTrack: .4, velCut: .3, fA: .002, fD: .35, fS: .3, fR: .3, aA: .004, aD: .4, aS: .8, aR: .25, lfoRate: 5.2, vib: 0, lfoCut: 0, glide: 0, mono: 0, level: -6, spread: .35 }
const synthOf = sound => Object.assign({}, SYNTH_REST, SYNTH_SOUNDS[sound] || {})

/* two turns of the wave a sound makes, as numbers −1..1: its two oscillators mixed (or the first bent by the second), what is
   under it, and its filter's rounding */
function synthWave (p, N = 200) {
  const osc = (k, ph) => { ph -= Math.floor(ph); return k === 0 ? 2 * ph - 1 : k === 1 ? (ph < p.pw ? 1 : -1) : k === 2 ? 4 * Math.abs(ph - .5) - 1 : Math.sin(2 * Math.PI * ph) }
  const bent = p.fm > .0005, mix = bent ? 0 : p.mix, k2 = 2 ** (Math.round(p.oct2) + (Math.round(p.semi2)) / 12), out = []
  for (let i = 0; i < N; i++) { const t = 2 * i / (N - 1), pm = bent ? p.fm * 1.1 * Math.sin(2 * Math.PI * t * p.fmRatio) : 0; out.push((1 - mix) * osc(Math.round(p.wave1), t + pm) + mix * osc(Math.round(p.wave2), t * k2 + pm) + p.sub * Math.sin(Math.PI * t)) }
  const a = 1 - Math.exp(-2 * Math.PI * p.cutoff / 17600)
  let y = 0
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { y += a * (out[i] - y); if (pass) out[i] = y }
  const top = Math.max(1e-6, ...out.map(Math.abs))
  return out.map(v => v / top)
}
/* a line of numbers −1..1 as a dark body about the middle of a box */
function waveBody (vals, x, y, w, h, c) {
  const mid = y + h / 2, amp = h / 2 - 7, N = vals.length
  let d = `M${n(x)} ${n(mid)}`
  for (let i = 0; i < N; i++) d += `L${n(x + w * i / (N - 1))} ${n(mid - vals[i] * amp)}`
  return P(d + `L${n(x + w)} ${n(mid)}Z`, { fill: c }) + P(`M${n(x)} ${n(mid) + .5}H${n(x + w)}`, { stroke: c, sa: .5 })
}
/* how a note of a sound rises and dies, as a body about the middle (a key held for the middle part of the box, then let go) */
function noteShape (p, x, y, w, h, c) {
  const tf = v => Math.log(v / .0005) / Math.log(10 / .0005), k = w / 3.4, xa = x + 3 + k * (.04 + tf(p.aA) * .9), xd = xa + k * (.15 + tf(p.aD) * .8), xs = Math.max(xd, x + w * .62), xr = Math.min(x + w - 2, xs + k * (.12 + tf(p.aR) * .9)), mid = y + h / 2, amp = h / 2 - 4, s = Math.max(.04, p.aS)
  const top = `M${n(x + 3)} ${n(mid)}L${n(xa)} ${n(mid - amp)}Q${n(xa + (xd - xa) * .3)} ${n(mid - amp * s)} ${n(xd)} ${n(mid - amp * s)}H${n(xs)}Q${n(xs + (xr - xs) * .3)} ${n(mid)} ${n(xr)} ${n(mid)}`
  const bot = `Q${n(xs + (xr - xs) * .3)} ${n(mid)} ${n(xs)} ${n(mid + amp * s)}H${n(xd)}Q${n(xa + (xd - xa) * .3)} ${n(mid + amp * s)} ${n(xa)} ${n(mid + amp)}Z`
  return P(top + bot, { fill: c })
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

/* ── at the head of the patch: the instrument as a small plate of its own ── */
function instPlate (t, cx, cy, r) {
  const I = t.inst, x = cx - r, y = cy - r, w = 2 * r
  return R(x, y, w, w, { rx: 2, fill: t.c }) + PIC.pic(picOfInst(I), x, y, w, w, t.deep, t.c, 3)
}
{ const frame0 = loanFrame; loanFrame = function (cx, cy, r, name) { const t = S.tracks[S.sel]; return ID.plates && isInst(t) && t.inst.kind !== 'plug' && name === instName(t) ? instPlate(t, cx, cy, r) : frame0(cx, cy, r, name) } }

/* ── the instrument, opened where the patch stands ── */
pInstr = function (y, h) {
  const t = S.tracks[S.sel], I = t.inst, rx = RX - SIDE, p0 = instParams(I)
  let s = sideStrips(y, h)
  const top = y + 30, name = (x, word) => T(x, y + 20, word, { size: 9, a: .34 })
  if (I.kind === 'synth') {
    const p = Object.assign({}, SYNTH_REST, p0)
    /* its face: the instrument the chosen sound is, large; under it every sound, each a small plate with its instrument on it */
    const names = Object.keys(SYNTH_SOUNDS), wx = 24, hw = 328, hh = 128, cw = 42, chh = 27, cg = (hw - 7 * cw) / 6
    s += name(wx, I.sound) + plateBox(wx, top, hw, hh, t) + PIC.pic(I.sound, wx, top, hw, hh, t.deep, t.c, 12)
    names.forEach((nm, i) => { const cx = wx + (i % 7) * (cw + cg), cy = top + hh + 12 + Math.floor(i / 7) * (chh + 6), on = nm === I.sound; s += plateBox(cx, cy, cw, chh, t, on) + PIC.pic(nm, cx, cy, cw, chh, t.deep, on ? t.csel : t.c, 3) })
    const tw0 = 62, gx = 8
    /* three plates: the wave, what the filter lets through, how a note rises and dies */
    const px0 = wx + hw + 30, side = 150, gap = 18, pw = Math.floor((rx - px0 - 24 - side - 3 * gap) / 3), ph = 128, uy = top + ph + 17
    { const x = px0
      s += name(x, 'wave') + plateBox(x, top, pw, ph, t) + waveBody(synthWave(p), x + 8, top + 6, pw - 16, ph - 12, t.deep)
      /* under it: the shape each of the two oscillators makes, as shapes; how much of each */
      const glyph = k => (cx, cy, c, a) => P(k === 0 ? `M${cx - 6} ${cy + 4}L${cx + 4} ${cy - 4}V${cy + 4}` : k === 1 ? `M${cx - 6} ${cy + 4}V${cy - 4}H${cx}V${cy + 4}H${cx + 6}` : k === 2 ? `M${cx - 6} ${cy + 4}L${cx} ${cy - 4}L${cx + 6} ${cy + 4}` : `M${cx - 6} ${cy}C${cx - 3} ${cy - 8} ${cx - 1} ${cy - 8} ${cx} ${cy}S${cx + 3} ${cy + 8} ${cx + 6} ${cy}`, { stroke: c, sa: a, sw: 1.1 })
      const pick = (yy, which, cur) => T(x, yy + 12.6, which, { size: 9, a: .4 }) + cells(x + 14, yy, 18, [0, 1, 2, 3].map(k => ({ g: glyph(k), on: Math.round(cur) === k })), { widths: [24, 24, 24, 24] })[0]
      s += pick(uy - 8, '1', p.wave1) + pick(uy + 16, '2', p.wave2)
      const mx = x + 14 + 96 + 16, mw = pw - (14 + 96 + 16)
      if (mw > 40) s += R(mx, uy + 12, mw, 2, { fill: INK, fa: .12 }) + R(mx + mw * (p.fm > .0005 ? 0 : p.mix) - 1, uy + 8, 2, 10, { fill: INK }) + T(mx, uy + 1, '1', { size: 8.5, a: .4 }) + T(mx + mw, uy + 1, '2', { size: 8.5, a: .4, anchor: 'end' }) }
    { const x = px0 + pw + gap, f = filterBody(p, x, top, pw, ph)
      const cid = 'fl' + (++UID)
      let ticks = ''
      for (const hz of [100, 1000, 10000]) ticks += `M${n(f.X(hz)) + .5} ${top + ph - 6}V${top + ph}`
      s += name(x, 'filter') + `<clipPath id="${cid}"><path d="${plateShape(x, top, pw, ph, t)}"/></clipPath>` + plateBox(x, top, pw, ph, t) + G(P(f.d, { fill: t.deep }) + P(ticks, { stroke: t.c, sa: .7 }), '', ` clip-path="url(#${cid})"`) + holdMark(f.at[0], f.at[1])
      s += belowText(x, uy + 4, 'cutoff', hzText(p.cutoff)) + belowText(x + 92, uy + 4, 'resonance', String(Math.round(p.reso * 100)))
      const steep = k => (cx, cy, c, a) => P(k ? `M${cx - 7} ${cy - 4}H${cx - 1}L${cx + 3} ${cy + 5}` : `M${cx - 7} ${cy - 4}H${cx - 2}L${cx + 7} ${cy + 5}`, { stroke: c, sa: a, sw: 1.1 })
      s += T(x, uy + 28.6, 'slope', { size: 9, a: .4 }) + cells(x + 34, uy + 16, 18, [{ g: steep(0), on: p.slope < .5 }, { g: steep(1), on: p.slope >= .5 }], { widths: [26, 26] })[0] }
    { const x = px0 + 2 * (pw + gap), tf = v => Math.log(v / .0005) / Math.log(10 / .0005), k = (pw - 16) / 3.5, base = top + ph - 7, hi = top + 9
      const xa = x + 8 + k * (.06 + tf(p.aA) * .9), xd = xa + k * (.15 + tf(p.aD) * .8), xs = Math.max(xd + 8, x + pw * .62), xr = Math.min(x + pw - 8, xs + k * (.12 + tf(p.aR) * .9)), ys = base - (base - hi) * Math.max(.03, p.aS)
      s += name(x, 'loudness') + plateBox(x, top, pw, ph, t)
      s += P(`M${n(x + 8)} ${base}L${n(xa)} ${hi}Q${n(xa + (xd - xa) * .3)} ${n(ys)} ${n(xd)} ${n(ys)}H${n(xs)}Q${n(xs + (xr - xs) * .3)} ${base} ${n(xr)} ${base}Z`, { fill: t.deep })
      s += holdMark(xa, hi) + holdMark(xd, ys) + holdMark(xs, ys) + holdMark(xr, base)
      ;[msText(p.aA), msText(p.aD), String(Math.round(p.aS * 100)), msText(p.aR)].forEach((v, k2) => { s += T(x + pw * (k2 + .5) / 4, uy + 4, v, { size: 9.5, a: .9, anchor: 'middle' }) }) }
    /* at the side: how it moves — a note that wavers, a note that slides to the next — each a small plate; one voice or many */
    { const x = rx - 24 - side, sh = 52
      const vib = p.vib, wav = []; for (let i = 0; i <= 60; i++) wav.push(`${n(x + 8 + (side - 16) * i / 60)} ${n(top + sh / 2 - Math.sin(i / 60 * Math.PI * 10) * (sh / 2 - 9) * vib * (i / 60))}`)
      s += name(x, 'movement') + plateBox(x, top, side, sh, t) + P('M' + wav.join('L'), { stroke: t.deep, sw: 2 }) + belowText(x, top + sh + 13, 'wavers', String(Math.round(vib * 100)))
      const y2 = top + sh + 26, gl = clamp(p.glide / .2, 0, 1), xm = x + side * .34
      s += plateBox(x, y2, side, sh, t) + P(`M${x + 8} ${y2 + sh - 12}H${n(xm)}C${n(xm + (side * .5) * gl * .5)} ${y2 + sh - 12} ${n(xm + (side * .5) * gl * .5)} ${y2 + 12} ${n(xm + side * .5 * gl)} ${y2 + 12}H${x + side - 8}`, { stroke: t.deep, sw: 2 }) + belowText(x, y2 + sh + 13, 'slides', msText(p.glide))
      s += T(x, y2 + sh + 40.6, 'voices', { size: 9, a: .4 }) + cells(x + 42, y2 + sh + 28, 18, [{ t: 'many', on: p.mono < .5 }, { t: 'one', on: p.mono >= .5 }], { size: 9.5, widths: [44, 38] })[0] }
  } else if (I.kind === 'drums') {
    /* the pads, each the shape of its stroke; the chosen one large beside them, its tail and its height to be taken hold of */
    const pw = 92, ph = 50, g = 6, gx = 24, gy = top
    s += name(gx, 'pads')
    DRUM_PADS.forEach(([nm], i) => {
      const cx = gx + (i % 4) * (pw + g), cy = gy + (3 - Math.floor(i / 4)) * (ph + g), on = i === ID.pad, own = I.pads && I.pads[i], d = p0[`${nm}.decay`]
      s += plateBox(cx, cy, pw, ph, t, on) + PIC.pic(nm, cx, cy, pw, ph, t.deep, on ? t.csel : t.c, 5)
      if (own) s += R(cx + pw - 10, cy + 5, 4, 4, { fill: INK })
    })
    const [pn, pk] = DRUM_PADS[ID.pad], bx0 = gx + 4 * (pw + g) + 30, bw = rx - bx0 - 24, bh = 142, lvl = ((p0[`${pn}.level`] || 0) + 36) / 42, d = p0[`${pn}.decay`] == null ? 1 : p0[`${pn}.decay`], own = I.pads && I.pads[ID.pad]
    const face = 178, sx0 = bx0 + face + 12, sw0 = bw - face - 20
    const vals = drumStroke(pn, d, 260), cut = Math.max(8, vals.findIndex(v => v < .02)), xEnd = sx0 + sw0 * (cut < 0 ? 1 : cut / (vals.length - 1)), cid = 'dr' + (++UID)
    let ticks = ''
    for (const sec of [.01, .1, 1]) { const px = sx0 + sw0 * Math.sqrt(sec / 1.2); ticks += P(`M${n(px) + .5} ${top + bh - 6}V${top + bh}`, { stroke: t.deep, sa: .8 }) + T(px + 4, top + bh - 4, sec < 1 ? `${sec * 1000} ms` : '1 s', { size: 7.5, c: t.deep, a: .8 }) }
    s += T(bx0, y + 20, pn, { size: 9, w: 500, a: .9 }) + T(bx0 + tw(pn, 9, 500) + 6, y + 20, keyName(pk), { size: 9, a: .4 })
    s += `<clipPath id="${cid}"><path d="${plateShape(bx0, top, bw, bh, t)}"/></clipPath>` + plateBox(bx0, top, bw, bh, t) + PIC.pic(pn, bx0, top, face, bh, t.deep, t.c, 14) + P(`M${bx0 + face + .5} ${top + 12}V${top + bh - 12}`, { stroke: t.deep, sa: .5 }) + G(strokeBody(vals, sx0, top + 6, sw0, bh - 12, t.deep, .35 + .65 * lvl) + ticks, '', ` clip-path="url(#${cid})"`)
    s += P(`M${n(xEnd) + .5} ${top + 10}V${top + bh - 10}`, { stroke: INK, sa: .9 }) + holdMark(xEnd, top + bh / 2) + holdMark(sx0, top + bh / 2 - (bh / 2 - 9) * (.35 + .65 * lvl))
    const uy = top + bh + 22, col = Math.min(210, (bw - 20) / 4)
    s += T(bx0, uy + 3.4, 'sound', { size: 9, a: .4 }) + menuKey(bx0 + 36, uy - 9, own ? String(own.name).toLowerCase() : 'made here')[0]
    const mid = (x, word, v, txt) => T(x, uy + 3.4, word, { size: 9, a: .4 }) + R(x + 34, uy - 1, 80, 2, { fill: INK, fa: .12 }) + R(Math.min(x + 74, x + 34 + 80 * v), uy - 1, Math.abs(80 * v - 40), 2, { fill: INK, fa: .5 }) + R(x + 74, uy - 2.5, 1, 5, { fill: INK, fa: .3 }) + R(x + 34 + 80 * v - 1, uy - 5, 2, 10, { fill: INK }) + T(x + 124, uy + 3.4, txt, { size: 9.5, a: .9 })
    s += mid(bx0 + col + 20, 'tune', ((p0[`${pn}.tune`] || 0) + 24) / 48, ((p0[`${pn}.tune`] || 0) >= 0 ? '+' : '−') + Math.abs(p0[`${pn}.tune`] || 0)) + mid(bx0 + 2 * col + 20, 'pan', ((p0[`${pn}.pan`] || 0) + 1) / 2, panText(p0[`${pn}.pan`] || 0))
  } else {
    /* the sampler: its sound as a region carries a sound, where it starts and ends, the stretch it goes round (marked as the cycle is); how a note of it rises and dies */
    const p = Object.assign({ start: 0, end: 1, loop: 0, loopStart: 0, loopEnd: 1, root: 60, a: .002, d: .3, s: 1, r: .12, oneShot: 0 }, p0), sm = I.sample, ew = 190, gap = 18, fx = 24, fw = 178, wx = fx + fw + gap, ww = rx - 24 - wx - ew - gap, ph = 128, uy = top + ph + 22
    s += plateBox(fx, top, fw, ph, t) + PIC.pic('sampler', fx, top, fw, ph, t.deep, t.c, 14)
    s += name(fx, 'sampler') + name(wx, 'sound') + T(wx + tw('sound', 9) + 8, y + 20, sm ? String(sm.name).toLowerCase() : 'none', { size: 9, a: .9 }) + (sm && sm.sec ? T(wx + tw('sound', 9) + 16 + tw(String(sm.name).toLowerCase(), 9), y + 20, `${sm.sec.toFixed(2)} s`, { size: 9, a: .4 }) : '')
    const cid = 'sm' + (++UID), xs = wx + ww * p.start, xe = wx + ww * p.end
    let inner = sm && sm.peaks ? strokeBody(sm.peaks, wx + 2, top + 4, ww - 4, ph - 8, t.deep) : ''
    inner += R(wx, top, xs - wx, ph, { fill: K1, fa: .7 }) + R(xe, top, wx + ww - xe, ph, { fill: K1, fa: .7 })
    if (p.loop >= .5) inner += R(wx + ww * p.loopStart, top, ww * (p.loopEnd - p.loopStart), 3, { fill: SOLO }) + P(`M${n(wx + ww * p.loopStart) + .5} ${top}V${top + ph}M${n(wx + ww * p.loopEnd) - .5} ${top}V${top + ph}`, { stroke: SOLO, sa: .8 })
    s += `<clipPath id="${cid}"><path d="${plateShape(wx, top, ww, ph, t)}"/></clipPath>` + plateBox(wx, top, ww, ph, t) + G(inner, '', ` clip-path="url(#${cid})"`)
    s += P(`M${n(xs) + .5} ${top}V${top + ph}M${n(xe) + .5} ${top}V${top + ph}`, { stroke: INK }) + holdMark(xs, top + ph / 2) + holdMark(xe, top + ph / 2)
    const ex = wx + ww + gap, tf = v => Math.log(v / .0005) / Math.log(10 / .0005), k = (ew - 16) / 3.5, base = top + ph - 7, hi = top + 9
    const xa = ex + 8 + k * (.06 + tf(p.a) * .9), xd = xa + k * (.15 + tf(p.d) * .8), xh = Math.max(xd + 8, ex + ew * .62), xr = Math.min(ex + ew - 8, xh + k * (.12 + tf(p.r) * .9)), ys = base - (base - hi) * Math.max(.03, p.s)
    s += name(ex, 'loudness') + plateBox(ex, top, ew, ph, t) + P(`M${n(ex + 8)} ${base}L${n(xa)} ${hi}Q${n(xa + (xd - xa) * .3)} ${n(ys)} ${n(xd)} ${n(ys)}H${n(xh)}Q${n(xh + (xr - xh) * .3)} ${base} ${n(xr)} ${base}Z`, { fill: t.deep }) + holdMark(xa, hi) + holdMark(xd, ys) + holdMark(xh, ys) + holdMark(xr, base)
    s += T(wx, uy + 3.4, 'plays', { size: 9, a: .4 }) + cells(wx + 34, uy - 9, 18, [{ t: 'while held', on: p.oneShot < .5 }, { t: 'to its end', on: p.oneShot >= .5 }], { size: 9.5 })[0]
    s += T(wx + 230, uy + 3.4, 'goes round', { size: 9, a: .4 }) + cells(wx + 230 + 62, uy - 9, 18, [{ t: 'no', on: p.loop < .5 }, { t: 'yes', on: p.loop >= .5, c: SOLO }], { size: 9.5, widths: [34, 38] })[0]
    /* its own key, shown where it lies among the keys: two octaves of a keyboard, the key in the track's pigment */
    { const kx = wx + 420, kw = 9, kh = 18, lo = Math.floor(p.root / 12) * 12 - 12
      s += T(kx, uy + 3.4, 'its key', { size: 9, a: .4 })
      let whites = '', blacks = '', i = 0
      for (let key = lo; key < lo + 36; key++) { const pc = key % 12, black = [1, 3, 6, 8, 10].includes(pc), on = key === Math.round(p.root); if (black) blacks += R(kx + 40 + i * kw - 3, uy - 9, 6, 11, { fill: on ? t.c : K0 }); else { whites += R(kx + 40 + i * kw, uy - 9, kw - 1, kh, { fill: on ? t.c : INK, fa: on ? 1 : .88 }); i++ } }
      s += whites + blacks + T(kx + 40 + i * kw + 8, uy + 3.4, keyName(Math.round(p.root)), { size: 9.5, a: .9 }) }
  }
  return s
}
