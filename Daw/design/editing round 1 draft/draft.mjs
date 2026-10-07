// editing, round 1 — the draft of what is new to the eye: fades with curves, crossfades, the smart tool's zones and cursors.
// It is drawn by the app's own page (ui/ui.js with DRAFT.fades switched on), so that what is approved is what gets built.
import { open, PAGE, DRAFT as DRAFT7 } from '/Users/steven/Downloads/BetterPlugin-main 2/Daw/test/cdp.mjs'
import { writeFileSync, readFileSync } from 'node:fs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)
const shot = async name => { const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(name + '.png', Buffer.from(r.data, 'base64')) }
// the board as one standalone picture: what only takes the pointer is left out, and the line that is typed into is written in
const svgOut = async name => {
  const s = await b.ev(`
    const el = document.getElementById('svg').cloneNode(true)
    for (const x of [...el.querySelectorAll('[data-a]')]) x.remove()
    const cmd = document.getElementById('cmd'), ns = 'http://www.w3.org/2000/svg', t = document.createElementNS(ns, 'text')
    t.setAttribute('x', 26); t.setAttribute('y', H - 22 + 14.6); t.setAttribute('font-family', FONT); t.setAttribute('font-size', 10.5); t.setAttribute('fill', INK); t.setAttribute('fill-opacity', .94); t.textContent = cmd.value
    el.appendChild(t)
    return '<?xml version="1.0" encoding="UTF-8"?>' + el.outerHTML.replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ')`)
  writeFileSync(name + '.svg', s)
}
await b.ev(`DRAFT.fades = true; window.__mk = (name, buf, regs, extra) => { const t = mkTrack(name, null, null, null, buf, -6, [], mkPatch(0, 0, 0, [0, 0, 0]), extra || {}); t.patch0 = copy(t.patch); t.regs = regs.map(o => mkReg(Object.assign({ buf, loop: true, off: o.a - 1 }, o))); return t }`)

// ── 1: fades and crossfades, close up ──
await b.ev(`
  const vox = __mk('lead vox', 'hum', [{ a: 1, b: 2.9, tag: 'take 1', fi: .22, fic: 2 }, { a: 2.9, b: 5.1, tag: 'take 3', off: 9.4 }, { a: 5.1, b: 7.6, tag: 'take 2', off: 20.2, fo: .55, foc: 1 }])
  const kick = __mk('kick', 'kick', [{ a: 1, b: 4.25 }, { a: 4.25, b: 8.5, off: 3.25 }])
  const gtr = __mk('gtr l', 'guitar', [{ a: 1, b: 3, tag: 'linear', fi: .5, fo: .5 }, { a: 3.3, b: 5.3, tag: 'equal power', fi: .5, fo: .5, fic: 1, foc: 1 }, { a: 5.6, b: 7.6, tag: 's curve', fi: .5, fo: .5, fic: 2, foc: 2 }])
  const bass = __mk('bass', 'bass', [{ a: 1, b: 4.5 }, { a: 4.5, b: 8.5, off: 3.5 }])
  const pno = __mk('piano', 'keys', [{ a: 1, b: 3.6, tag: 'take 1' }, { a: 3.6, b: 6.4, tag: 'take 2', off: 11.1 }, { a: 6.4, b: 8.5, tag: 'take 1', off: 5.4 }])
  S.tracks.length = 0; S.tracks.push(vox, kick, gtr, bass, pno)
  SONG_END = 16; SCENES = mkScenes([['verse', 1], ['chorus', 5], ['verse 2', 9]])
  crossfade(vox.regs[0], vox.regs[1], .3); crossfade(vox.regs[1], vox.regs[2], .18)
  crossfade(kick.regs[0], kick.regs[1], .07)
  crossfade(bass.regs[0], bass.regs[1], .5)
  crossfade(pno.regs[0], pno.regs[1], .4); crossfade(pno.regs[1], pno.regs[2], .26, 2)
  S.sel = 3; S.selR = []; S.selX = [bass.regs[0].id, bass.regs[1].id]; S.pos = 2.9 - 1; S.cycle = { on: false, a: 4, b: 8 }; S.master = -3.2; S.key = 'a min'
  S.panel.on = false; S.slur = false; setView(true)
  S.rh = 62; VX = 0; VY = 0; setZoom(148, 0); VX = 0
  document.getElementById('cmd').value = 'crossfade'
  S.last = { res: [{ k: 'word', text: 'crossfade made', mix: 0 }], snap: null }
  __daw.redraw()`)
await b.sleep(250)
await shot('e1 1 fades and crossfades'); await svgOut('e1 1 fades and crossfades')

// ── 3: in the room, at the size it is worked at (the thirty rows of draft 7, looked at from bar 29) ──
const draft7 = readFileSync(DRAFT7, 'utf8')
const d0 = draft7.indexOf('const SECTIONS ='), d1 = draft7.indexOf('const SHORT =')
const data = draft7.slice(d0, d1).replace(/const HUES[\s\S]*?\nconst KICK/, 'const KICK')
await b.ev(`
  ${data}
  const loops = { kick: 'kick', snare: 'snare', hat: 'hats', tom: 'snare', oh: 'hats', room: 'air', bass: 'bass', piano: 'keys', gtr: 'guitar', lead: 'guitar', vox: 'hum', adlib: 'hum', riser: 'air', impact: 'kick' }
  let id = 0
  const made = TRACKS.map(t => ({ id: ++id, name: t.name, theirs: t.who || null, kind: t.kind || 'audio', vol: t.vol, def: t.vol, pan: t.pan || 0, mute: !!t.mute, solo: false, arm: false, mon: false, inp: 0, out: 0, parent: null, open: true, sends: [], autos: {}, ap: 'vol', midi: !!t.midi, buf0: loops[t.w] || 'keys', regs: [], n: null, inserts: [],
    patch: { A: { tape: 0, space: 0, delay: 0, share: 62 }, B: { tape: 0, space: 0, delay: 0, share: 62 }, x: 0 } }))
  TRACKS.forEach((t, k) => { const m = made[k]; if (t.parent) m.parent = made[t.parent.k].id; m.regs = (t.regs || []).map(([ra, rb, tag]) => mkReg({ a: ra, b: rb, buf: m.buf0, loop: true, off: ra - 1, tag: tag || null })); m.patch0 = copy(m.patch) })
  S.tracks.length = 0; for (const m of made) S.tracks.push(m)
  SONG_END = 120; SCENES = mkScenes(SECTIONS.map(s => [s.name, s.a]))
  const T = name => S.tracks.find(t => t.name === name), R = (name, a) => T(name).regs.find(r => Math.abs(r.a - a) < 1e-6)
  // the lead vocal of the chorus is a comp: takes that meet, each join crossfaded
  const lv = T('lead vox'); lv.regs = lv.regs.filter(r => r.a < 33 || r.a >= 49)
  const comp = [[33, 35.2, 'take 2', 0], [35.2, 37, 'take 5', 6.3], [37, 40.4, 'take 2', 4], [40.4, 42.1, 'take 1', 11.7], [42.1, 45.5, 'take 4', 2.2], [45.5, 48.5, 'take 2', 12.5]].map(([a, b, tag, off]) => mkReg({ a, b, buf: 'hum', loop: true, off, tag }))
  lv.regs.push(...comp); lv.regs.sort((p, q) => p.a - q.a)
  for (let k = 0; k + 1 < comp.length; k++) crossfade(comp[k], comp[k + 1], k === 2 ? .5 : .22, 1)
  comp[0].fi = .2; comp[0].fic = 2; comp[5].fo = .6; comp[5].foc = 1
  // the doubles are cut on the same words and healed with crossfades too narrow to draw
  const dbl = T('vox dbl'); for (const r of dbl.regs.filter(r => r.a >= 33 && r.a < 49).slice()) { const p = splitReg(r, dbl, r.a - 1 + 1.6); if (p) crossfade(r, p, defaultXfade()) }
  // guitars come in under a fade and leave under one
  for (const nm of ['gtr l', 'gtr r']) for (const r of T(nm).regs) { r.fi = .5; r.fic = 1; r.fo = 1; r.foc = 2 }
  const gl = R('gtr lead', 41); if (gl) { gl.fi = .8; gl.fic = 2; gl.fo = .4 }
  // the oh mics are cut at bar 41 and crossfaded long
  const oh = T('oh'), o1 = R('oh', 33); if (o1) { const o2 = splitReg(o1, oh, 40); if (o2) crossfade(o1, o2, .8) }
  S.sel = S.tracks.indexOf(lv); S.selR = [comp[1].id]; S.selX = null
  const vis = rows(); S.marq = { a: 41.5, b: 44.25, t0: S.tracks.indexOf(T('bgv hi')), t1: S.tracks.indexOf(T('bgv lo')) }
  S.pos = 40.4 - 1; S.cycle = { on: true, a: 32, b: 48 }; S.master = -3.2; S.key = 'a min'
  S.panel.on = false; S.slur = false; setView(true)
  S.rh = 25; VY = 0; setZoom(36, 0); VX = 28; __daw.redraw()
  document.getElementById('cmd').value = 'lead vox -3 db'
  S.last = null; __daw.redraw()`)
await b.sleep(250)
await shot('e1 3 in the room'); await svgOut('e1 3 in the room')

// ── 2: the smart tool — what the pointer does on a region depends on where it is; and the three pointers that are new ──
await b.ev(`
  const sw = swatch('vox', .2), sw2 = swatch('vox', .55), lh = 22
  const glyphs = { in: 'M2.5 13.5H13.5V2.5M2.5 13.5C8.5 13.5 9 2.5 13.5 2.5', out: 'M13.5 13.5H2.5V2.5M13.5 13.5C7.5 13.5 7 2.5 2.5 2.5', cross: 'M2.5 2.5C8.5 2.5 7.5 13.5 13.5 13.5M2.5 13.5C8.5 13.5 7.5 2.5 13.5 2.5',
    beam: 'M5.5 2.5C7 2.5 8 3.2 8 4.5V11.5C8 12.8 7 13.5 5.5 13.5M10.5 2.5C9 2.5 8 3.2 8 4.5M10.5 13.5C9 13.5 8 12.8 8 11.5M6.3 8H9.7', arrows: 'M2 8H14M4.6 5.2L2 8L4.6 10.8M11.4 5.2L14 8L11.4 10.8M8 3.5V12.5',
    hand: 'M4.5 8.2V4.6a1 1 0 0 1 2 0V7.4M6.5 7.4V3.4a1 1 0 0 1 2 0V7.4M8.5 7.4V3.8a1 1 0 0 1 2 0V7.8M10.5 7.8V5.4a1 1 0 0 1 2 0V10.2C12.5 12.4 11 13.8 8.8 13.8H8C6.4 13.8 5.4 13 4.6 11.6L3 8.8a.95 .95 0 0 1 1.5 -1.1Z' }
  const pointer = (kind, cx, cy, m = 1) => G(P(glyphs[kind], { stroke: K0, sa: .92, sw: 3.4, cap: 'round' }) + P(glyphs[kind], Object.assign({ stroke: INK, sw: 1.3, cap: 'round' }, kind === 'hand' ? { fill: K0, fa: .4 } : {})), 'translate(' + n(cx - 8 * m) + ' ' + n(cy - 8 * m) + ') scale(' + m + ')')
  const tmp = mkReg({ a: 1, b: 5, buf: 'hum', loop: true, off: 3.2 }), tmp2 = mkReg({ a: 1, b: 3, buf: 'hum', loop: true, off: 14 })
  PXB = 24
  const wA = 96, wB = 34, F = 12, Hf = 8, E = 6, Xc = 10, Hx = 8
  /* one region and the start of the next on a row of twenty-five, drawn k times their size: the zones are true to scale */
  function diagram (x0, y0, k, upper, lower) {
    const X = v => n(x0 + v * k), Y = v => n(y0 + v * k), big = k >= 8
    let s = R(x0 - 6 * k, y0 - 1.5 * k, (wA + wB + 12) * k, 25 * k, { fill: K0 })
    s += P(shapePath(x0 + .5 * k, y0, (wA - 1) * k, lh * k, SHAPES.vox, k), { fill: sw.c }) + G(P(wavePath(tmp, wA, lh / 2, lh / 2 - 1.5, 'vox', lh, 1, wA - 1, 'd' + k), { fill: sw.deep }), 'translate(' + x0 + ' ' + y0 + ') scale(' + k + ')')
    const cid = 'dg' + k
    s += '<clipPath id="' + cid + '"><rect x="' + X(wA) + '" y="' + Y(0) + '" width="' + n(wB * k) + '" height="' + n(lh * k) + '"/></clipPath>'
    s += G(P(shapePath(x0 + (wA + .5) * k, y0, 80 * k, lh * k, SHAPES.vox, k), { fill: sw2.c }) + G(P(wavePath(tmp2, 80, lh / 2, lh / 2 - 1.5, 'vox', lh, 1, 79, 'e' + k), { fill: sw2.deep }), 'translate(' + X(wA) + ' ' + y0 + ') scale(' + k + ')'), '', ' clip-path="url(#' + cid + ')"')
    const poly = pts => 'M' + pts.map(([px, py]) => X(px) + ' ' + Y(py)).join('L') + 'Z'
    const zones = [
      ['up', poly([[F, 0], [wA - F, 0], [wA - F, Hf], [wA - E, Hf], [wA - E, lh / 2], [E, lh / 2], [E, Hf], [F, Hf]]), wA / 2, (lh / 2) / 2, upper],
      ['low', poly([[E, lh / 2], [wA - E, lh / 2], [wA - E, lh - Hx], [wA - Xc, lh - Hx], [wA - Xc, lh], [E, lh]]), wA / 2, lh * .75, lower],
      ['fi', poly([[0, 0], [F, 0], [F, Hf], [0, Hf]]), F / 2, Hf / 2, ['fade in', 'in']],
      ['fo', poly([[wA - F, 0], [wA, 0], [wA, Hf], [wA - F, Hf]]), wA - F / 2, Hf / 2, ['fade out', 'out']],
      ['tl', poly([[0, Hf], [E, Hf], [E, lh], [0, lh]]), E / 2, (Hf + lh) / 2, ['trim', 'arrows']],
      ['tr', poly([[wA - E, Hf], [wA, Hf], [wA, lh - Hx], [wA - E, lh - Hx]]), wA - E / 2, (Hf + lh - Hx) / 2, ['trim', 'arrows']],
      ['x', poly([[wA - Xc, lh - Hx], [wA + Xc, lh - Hx], [wA + Xc, lh], [wA - Xc, lh]]), wA, lh - Hx / 2, ['crossfade', 'cross']],
    ]
    for (const [, d] of zones) s += P(d, { fill: K0, fa: .16, stroke: INK, sa: .7 })
    for (const [id, , cx, cy, [name, glyph]] of zones) {
      const px = x0 + cx * k, py = y0 + cy * k, wide = id === 'up' || id === 'low', size = big ? (wide ? 12 : 9.5) : (wide ? 9.5 : 0)
      if (wide) s += pointer(glyph, px - tw(name, size, 500) / 2 - (big ? 14 : 10), py, big ? 1.4 : 1) + T(px + (big ? 8 : 6), py + size * .35, name, { size, w: 500, anchor: 'middle' })
      else s += pointer(glyph, px, py - (big && id !== 'tr' ? 8 : 0), big ? 1.2 : .8) + (big && id !== 'tr' ? T(px, py + 16, name, { size, w: 500, anchor: 'middle' }) : '')
    }
    if (big) s += T(X(wA - E / 2), Y(-3.4), 'trim', { size: 9.5, w: 500, a: .9, anchor: 'middle' }) + P('M' + X(wA - E / 2) + ' ' + Y(-2.6) + 'V' + Y(Hf + 1.2), { stroke: INK, sa: .5 })
    return s
  }
  let s = R(0, 0, W, H, { fill: K1 })
  s += T(72, 62, 'a', { size: 11, w: 500 }) + T(90, 62, 'the upper half picks a stretch of time, the lower half takes hold of the region', { size: 11, a: .62 }) + T(90, 79, 'pro tools’ way round', { size: 9.5, a: .4 })
  s += diagram(120, 138, 8, ['range', 'beam'], ['grab', 'hand'])
  s += T(72, 392, 'b', { size: 11, w: 500 }) + T(90, 392, 'the other way round: the upper half takes hold, the lower half picks a stretch', { size: 11, a: .62 }) + T(90, 409, 'logic’s way round, as its click zones are', { size: 9.5, a: .4 })
  s += diagram(96, 442, 4, ['grab', 'hand'], ['range', 'beam'])
  // at its own size: the pointer in each place, on a row of 25
  s += T(712, 392, 'at its own size', { size: 11, a: .62 }) + T(712, 409, 'the pointer in each place, on a row of 25', { size: 9.5, a: .4 })
  { const X0v = 712, Y0v = 442, one = (x, y, w, r, c) => P(shapePath(x + .5, y, w - 1, lh, SHAPES.vox), { fill: c.c }) + G(P(wavePath(r, w, lh / 2, lh / 2 - 1.5, 'vox', lh, 1, w - 1, 'v' + w + c.c), { fill: c.deep }), 'translate(' + x + ' ' + y + ')')
    const scenes = [['range', 'beam', 40, 5.5], ['grab', 'hand', 44, 16.5], ['trim', 'arrows', 2.5, 15], ['fade in', 'in', 6, 4], ['fade out', 'out', 66, 4], ['crossfade', 'cross', 72, 18]]
    scenes.forEach(([name, glyph, px, py], i) => {
      const x = X0v + (i % 3) * 228, y = Y0v + Math.floor(i / 3) * 78
      s += R(x - 10, y - 1.5, 208, 25, { fill: K0 }) + one(x, y, 72, tmp, sw) + (name === 'crossfade' || name === 'fade out' ? one(x + 72, y, 60, tmp2, sw2) : '')
      s += pointer(glyph, x + px, y + py, 1) + T(x - 10, y + 42, name, { size: 9.5, a: .86 })
    })
  }
  // the three pointers that are new, on the lane's own dark and on two pigments
  s += T(712, 632, 'the pointers that are new', { size: 11, a: .62 }) + T(712, 649, 'ink with a dark edge, so that they read on a lane and on any pigment', { size: 9.5, a: .4 })
  { const X0p = 712, Y0p = 674, pale = swatch('fx', .3).c, mid = swatch('keys', .6).c
    ;[['in', 'fade in'], ['out', 'fade out'], ['cross', 'crossfade']].forEach(([kd, name], i) => {
      const x = X0p + i * 228
      s += R(x - 10, Y0p, 62, 62, { fill: K0 }) + R(x + 52, Y0p, 62, 62, { fill: mid }) + R(x + 114, Y0p, 62, 62, { fill: pale })
      s += pointer(kd, x + 21, Y0p + 31, 2.5) + pointer(kd, x + 83, Y0p + 31, 2.5) + pointer(kd, x + 145, Y0p + 31, 2.5)
      s += T(x - 10, Y0p + 84, name, { size: 9.5, a: .86 })
    })
  }
  document.getElementById('svg').innerHTML = s
  document.getElementById('cmd').style.display = 'none'`)
await b.sleep(200)
await shot('e1 2 smart tool')
{ const s2 = await b.ev(`return '<?xml version="1.0" encoding="UTF-8"?>' + document.getElementById('svg').outerHTML`); writeFileSync('e1 2 smart tool.svg', s2) }

// ── 4: key command assignments — a window of its own, as in logic: every command, its key, a key pressed to give it another ──
await b.ev(`
  const win = (x, y, w, h, title, body) => R(x, y, w, h, { rx: 6, fill: K1 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 6, stroke: INK, sa: .16 }) + P('M' + x + ' ' + (y + 28) + 'V' + (y + 6) + 'a6 6 0 0 1 6 -6H' + (x + w - 6) + 'a6 6 0 0 1 6 6V' + (y + 28) + 'Z', { fill: K2 })
    + ['#FF5F57', '#FEBC2E', '#28C840'].map((c, i) => Cc(x + 20 + i * 20, y + 14, 6, { fill: c })).join('') + T(x + w / 2, y + 18.3, title, { size: 12, w: 500, a: .82, anchor: 'middle' }) + hline(x, x + w, y + 27.5, .1) + body
  const keyCell = (xr, y, k, o = {}) => { const w = Math.max(30, Math.round(tw(k, 10) + 16)); return (o.on ? R(xr - w, y, w, 16, { rx: 2, fill: K1 }) : R(xr - w + .5, y + .5, w - 1, 15, { rx: 2, stroke: o.c || INK, sa: o.dim ? .12 : .26 })) + T(xr - w / 2, y + 11.4, k, { size: 10, c: o.c || INK, a: o.dim ? .3 : .9, anchor: 'middle' }) }
  function list (x, y, w, h, state) {
    const groups = SHEET.flat(), rowH = 21, L = x + 22, KX = x + w - 150, DX = x + w - 34
    let s = T(L, y + 25, 'find', { size: 9.5, a: .4 }) + P('M' + (L + 30) + ' ' + (y + 30.5) + 'H' + (L + 230), { stroke: INK, sa: .24 }) + (state.find ? T(L + 32, y + 25, state.find, { size: 10.5, a: .94 }) : '')
    s += G(cells(0, 0, 18, [{ t: 'all', on: !state.used }, { t: 'with a key', on: !!state.used }, { t: 'without' }], { size: 9.5 })[0], 'translate(' + (x + w - 22 - 196) + ' ' + (y + 12) + ')')
    s += T(L, y + 58, 'command', { size: 9, a: .38 }) + T(KX, y + 58, 'key', { size: 9, a: .38, anchor: 'end' }) + T(DX, y + 58, 'logic', { size: 9, a: .38, anchor: 'end' }) + hline(x + 1, x + w - 1, y + 66, .08)
    let cy = y + 72, n = 0
    const cid = 'kc' + x
    let body = ''
    for (const [name, rows] of groups) {
      if (state.find && !rows.some(r => r[0].includes(state.find))) continue
      body += T(L, cy + 15, name, { size: 9.5, a: .4 }); cy += 22
      for (const [what, k] of rows) {
        if (state.find && !what.includes(state.find)) continue
        const st = state.rows[what] || {}
        if (st.on) body += R(x + 8, cy, w - 16, rowH, { rx: 2, fill: INK })
        body += T(L + 10, cy + 14.2, what, { size: 10.5, w: st.on ? 500 : 400, c: st.on ? K1 : INK, a: st.on ? 1 : .86 })
        if (st.learn) body += T(KX, cy + 14.2, 'press a key', { size: 10, c: K1, a: .6, anchor: 'end' })
        else if (st.clash) body += keyCell(KX, cy + 2.5, st.key, { on: true }) + T(KX - 54, cy + 14.2, 'taken by ' + st.clash, { size: 9.5, c: K1, a: .7, anchor: 'end' }) + T(DX - 46, cy + 14.2, 'take it', { size: 9.5, w: 500, c: K1, anchor: 'end' }) + T(DX, cy + 14.2, 'leave', { size: 9.5, c: K1, a: .6, anchor: 'end' })
        else body += keyCell(KX, cy + 2.5, st.key || k, { on: !!st.on, c: st.on ? K1 : INK }) + (st.key ? T(DX, cy + 14.2, k, { size: 9.5, c: st.on ? K1 : INK, a: .34, anchor: 'end' }) : '')
        cy += rowH; n++
      }
      cy += 6
    }
    s += '<clipPath id="' + cid + '"><rect x="' + x + '" y="' + (y + 67) + '" width="' + w + '" height="' + (h - 67 - 34) + '"/></clipPath>' + G(body, '', ' clip-path="url(#' + cid + ')"')
    if (!state.find) s += R(x + w - 6, y + 72, 3, 150, { rx: 1.5, fill: INK, fa: .22 })
    s += hline(x + 1, x + w - 1, y + h - 34, .08) + T(L, y + h - 13, 'back to logic’s key', { size: 9.5, a: state.reset ? .9 : .4 }) + T(L + 118, y + h - 13, 'all back to logic’s', { size: 9.5, a: .4 }) + T(x + w - 22, y + h - 13, '71 commands, 71 with a key', { size: 9.5, a: .4, anchor: 'end' })
    return s
  }
  const w = 660, h = 700, x1 = 40, x2 = 740, y0 = 100
  let s = R(0, 0, W, H, { fill: '#0A0A0A' })
  s += T(x1, 62, 'a key is asked for', { size: 11, a: .62 }) + T(x1, 79, 'a row is chosen, then any key pressed is its key', { size: 9.5, a: .4 })
  s += win(x1, y0, w, h, 'Key Command Assignments', list(x1, y0 + 28, w, h - 28, { rows: { 'cycle what is chosen': { on: true, learn: true }, 'click': { key: '⌥c' } } }))
  s += T(x2, 62, 'the key belongs to something else', { size: 11, a: .62 }) + T(x2, 79, 'the row says whose it is; taken, the other is left without a key', { size: 9.5, a: .4 })
  s += win(x2, y0, w, h, 'Key Command Assignments', list(x2, y0 + 28, w, h - 28, { find: 'cy', rows: { 'cycle what is chosen': { on: true, clash: 'cycle', key: 'c' } } }))
  document.getElementById('svg').innerHTML = s`)
await b.sleep(200)
await shot('e1 4 key command assignments')
{ const s2 = await b.ev(`return '<?xml version="1.0" encoding="UTF-8"?>' + document.getElementById('svg').outerHTML`); writeFileSync('e1 4 key command assignments.svg', s2) }
console.log(JSON.stringify(await b.ev(`return [window.__errs, __daw.lay()]`)))
await b.close()
