// node test/small.mjs — the smallest window with a session too big for it (the draft's thirty rows): nothing runs into anything, and what does not fit can be turned to
import { open, PAGE, DRAFT } from './cdp.mjs'
import { readFileSync } from 'node:fs'
const b = await open(PAGE, { width: 1100, height: 640, dsf: 2 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const draft = readFileSync(DRAFT, 'utf8')
const a = draft.indexOf('const SECTIONS ='), z = draft.indexOf('const SHORT =')
const data = draft.slice(a, z).replace(/const HUES[\s\S]*?\nconst KICK/, 'const KICK')
await b.ev(`
  ${data}
  const loops = { kick: 'kick', snare: 'snare', hat: 'hats', tom: 'snare', oh: 'hats', room: 'air', bass: 'bass', piano: 'keys', gtr: 'guitar', lead: 'guitar', vox: 'hum', adlib: 'hum', riser: 'air', impact: 'kick' }
  let id = 0
  const made = TRACKS.map(t => ({ id: ++id, name: t.name, theirs: t.who || null, kind: t.kind || 'audio', vol: t.vol, def: t.vol, pan: t.pan || 0, mute: !!t.mute, solo: false, arm: !!t.arm, mon: !!t.mon, inp: 0, out: 0, parent: null, open: true, sends: [], autos: {}, ap: 'vol', midi: !!t.midi, buf0: loops[t.w] || 'keys', regs: [], n: null, inserts: [],
    patch: { A: { tape: (t.patch || []).includes('tape') ? 24 : 0, space: (t.patch || []).includes('space') ? 46 : 0, delay: (t.patch || []).includes('delay') ? 30 : 0, share: 62 }, B: { tape: 0, space: 0, delay: 0, share: 62 }, x: 0 } }))
  TRACKS.forEach((t, k) => { const m = made[k]; if (t.parent) m.parent = made[t.parent.k].id; m.sends = (t.sends || []).map(([nm, db]) => ({ to: made[TRACKS.findIndex(q => q.name === nm)].id, db })); m.regs = (t.regs || []).map(([ra, rb, tag]) => mkReg({ a: ra, b: rb, buf: m.buf0, loop: true, off: ra - 1, tag: tag || null })); m.patch0 = JSON.parse(JSON.stringify(m.patch)) })
  S.tracks.length = 0; for (const m of made) S.tracks.push(m)
  SONG_END = 120; SCENES = mkScenes(SECTIONS.map(s => [s.name, s.a]))
  S.sel = S.tracks.findIndex(t => t.name === 'lead vox'); S.selR = [S.tracks[S.sel].regs[8].id]; S.pos = 40.3
  S.panel.on = true; S.panel.tab = 'mixer'; S.slur = true; setView(true); setZoom(0); __daw.redraw()
`)
await b.sleep(200)
// every word on the board: none may lie over another on the same line (a crude check of boxes), and none may leave the board
const clash = async () => b.ev(`
  const bw = W, bh = H, texts = [...document.querySelectorAll('#svg text')].filter(t => t.getBBox().width > 0).map(t => { let g = t; let clipped = false; while (g && g.id !== 'svg') { if (g.getAttribute && g.getAttribute('clip-path')) clipped = true; g = g.parentNode } const r = t.getBoundingClientRect(); return { s: t.textContent, x: r.left, y: r.top, w: r.width, h: r.height, clipped } })
  const outside = texts.filter(t => !t.clipped && (t.x < -1 || t.x + t.w > bw + 1 || t.y < -1 || t.y + t.h > bh + 1)).map(t => t.s)
  const over = []
  const free = texts.filter(t => !t.clipped && t.y < 70 || (!t.clipped && t.y > bh - 22))      // the bars at the top and the foot: words that stand alone
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) { const p = free[i], q = free[j]; if (Math.abs(p.y - q.y) < 6 && p.x < q.x + q.w - 1 && q.x < p.x + p.w - 1) over.push(p.s + ' / ' + q.s) }
  return { n: texts.length, outside, over }
`)
let c = await clash(); ok('small window, mixer and slur: no words outside or over each other', !c.outside.length && !c.over.length, c)
await b.shot('e1 small mixer slur.png')
const lay = await b.ev(`return Object.assign(__daw.lay(), { mx: S.panel.mx, strips: document.querySelectorAll('[data-a="msel"]').length, rows: rows().length })`)
ok('every track on one screen: a strip for each', lay.strips === lay.rows && lay.rows > 20, lay)      // (the room's one mixer shows every track, narrow where it must: mixpanel.js)
await b.ev(`const base = S.tracks.slice(0, 8); for (let k = 0; S.tracks.length < 90; k++) { const t = mkTrack('w' + k, null, null, null, null, -6, [], NO_PATCH()); t.c = base[k % 8].c; S.tracks.push(t) } S.panel.mx = 0; dirtyAll(); flush(); return 1`)
// the mixer turns sideways under the wheel
const p = await b.ev(`const r = document.querySelector('[data-a="mvol"]').getBoundingClientRect(); return { x: r.left + 60, y: r.top + 40 }`)
for (let k = 0; k < 6; k++) await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: 40 })
await b.sleep(150)
const mx1 = await b.ev(`flush(); return [S.panel.mx, document.querySelector('#g-dock [data-a="msel"]').dataset.i]`)
ok('more than one screen holds: the wheel turns the mixer', mx1[0] > 0 && +mx1[1] === mx1[0], mx1)
for (let k = 0; k < 160; k++) { await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: 40 }); if (k % 20 === 19) await b.sleep(30) }      // (ninety tracks: many more turns than thirty took)
await b.sleep(150)
const mx2 = await b.ev(`flush(); return [S.panel.mx, rows().length, document.querySelectorAll('#g-dock [data-a="msel"]').length, [...document.querySelectorAll('#g-dock [data-a="msel"]')].pop().dataset.i]`)
ok('and stops at the last strip', mx2[0] + mx2[2] === mx2[1] && +mx2[3] === mx2[1] - 1, mx2)
await b.shot('e2 small mixer end.png')
// the lanes scroll under the wheel when the rows do not fit
const q = await b.ev(`const L = __daw.lay(); const r = document.getElementById('board').getBoundingClientRect(); return { x: r.left + 500, y: r.top + L.TY + 40, maxVY: maxVY() }`)
for (let k = 0; k < 5; k++) await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: q.x, y: q.y, deltaX: 0, deltaY: 60 })
await b.sleep(150)
ok('the wheel scrolls the rows', (await b.ev('return VY')) > 0 && q.maxVY > 0, [await b.ev('return VY'), q.maxVY])
await b.ev(`setZoom(20, 0)`)
for (let k = 0; k < 5; k++) await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: q.x, y: q.y, deltaX: 80, deltaY: 0 })
await b.sleep(150)
ok('and sideways along the song', (await b.ev('return VX')) > 0, await b.ev('return VX'))
// patch page in the small window with slur: the chain is drawn smaller, inside its room
await b.ev(`S.panel.tab = 'patch'; VX = 0; VY = 0; setView(true); __daw.redraw()`); await b.sleep(150)
c = await clash(); ok('small window, patch and slur: no words outside or over each other', !c.outside.length && !c.over.length, c)
const chain = await b.ev(`const out = [...document.querySelectorAll('#g-dock [data-a="wall"][data-k="node"]')].map(e => e.getBoundingClientRect()); const side = __daw.lay().RX - 222; return { right: Math.max(...out.map(r => r.right)), left: Math.min(...out.map(r => r.left)), side, bottom: Math.max(...out.map(r => r.bottom)), foot: H - 22 }`)
ok('the chain keeps inside its room', chain.right < chain.side && chain.left > 0 && chain.bottom < chain.foot, chain)
await b.shot('e3 small patch slur.png')
await b.ev(`S.slur = false; S.panel.on = false; setView(true); __daw.redraw()`); await b.sleep(150)
c = await clash(); ok('small window, lanes only: no words outside or over each other', !c.outside.length && !c.over.length, c)
await b.shot('e4 small arrange.png')
ok('no errors on the page', (await b.ev('return window.__errs')).length === 0 && b.errors.length === 0, [await b.ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
