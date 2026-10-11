// notes, round 2 — the notes page drawn again (notes-draft.js): each note coloured by how hard it is played, and three ways
// of drawing a note. On the app's own page, in draft 7's session with tracks of notes in it.
//   node "design/midi round 2 draft/draft.mjs" [prefix]
import { open, PAGE, DRAFT as DRAFT7 } from '../../test/cdp.mjs'
import { writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)
const ONLY = process.argv[2] || ''
const shot = async name => { if (!name.startsWith(ONLY)) return; const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64')) }
const closeUp = async name => { if (!name.startsWith(ONLY)) return; const [y, h, w] = await b.ev('return [BY, H - BY, RX]'); const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y, width: w, height: h, scale: 1 } }); writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64')) }
const svgOut = async name => {
  if (!name.startsWith(ONLY)) return
  const s = await b.ev(`
    const el = document.getElementById('svg').cloneNode(true)
    for (const x of [...el.querySelectorAll('[data-a]')]) x.remove()
    const cmd = document.getElementById('cmd'), ns = 'http://www.w3.org/2000/svg', t = document.createElementNS(ns, 'text')
    t.setAttribute('x', 26); t.setAttribute('y', H - 22 + 14.6); t.setAttribute('font-family', FONT); t.setAttribute('font-size', 10.5); t.setAttribute('fill', INK); t.setAttribute('fill-opacity', .94); t.textContent = cmd.value
    el.appendChild(t)
    return '<?xml version="1.0" encoding="UTF-8"?>' + el.outerHTML.replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ')`)
  writeFileSync(join(here, name + '.svg'), s)
}
await b.ev(`for (const code of ${JSON.stringify([readFileSync(join(here, 'notes-draft.js'), 'utf8')])}) { const s = document.createElement('script'); s.textContent = code; document.head.appendChild(s) }`)

// ── draft 7's session, with tracks of notes in it (as round 1's draft dressed it) ──
const draft7 = readFileSync(DRAFT7, 'utf8')
const d0 = draft7.indexOf('const SECTIONS ='), d1 = draft7.indexOf('const SHORT =')
const data = draft7.slice(d0, d1).replace(/const HUES[\s\S]*?\nconst KICK/, 'const KICK').replace(/function paint[\s\S]*?\n}\n/, '')
await b.ev(`
  ${data}
  const loops = { kick: 'kick', snare: 'snare', hat: 'hats', tom: 'snare', oh: 'hats', room: 'air', bass: 'bass', piano: 'keys', gtr: 'guitar', lead: 'guitar', vox: 'hum', adlib: 'hum', riser: 'air', impact: 'kick' }
  let id = 0
  const made = TRACKS.map(t => ({ id: ++id, name: t.name, theirs: t.who || null, kind: t.kind || 'audio', vol: t.vol, def: t.vol, pan: t.pan || 0, mute: !!t.mute, solo: false, arm: false, mon: false, inp: 0, out: 0, parent: null, open: true, sends: [], autos: {}, ap: 'vol', buf0: loops[t.w] || 'keys', regs: [], n: null, inserts: [],
    patch: { A: { tape: (t.patch || []).includes('tape') ? 24 : 0, space: (t.patch || []).includes('space') ? 46 : 0, delay: (t.patch || []).includes('delay') ? 30 : 0, share: 62 }, B: { tape: 0, space: 0, delay: 0, share: 62 }, x: 0 } }))
  TRACKS.forEach((t, k) => { const m = made[k]; if (t.parent) m.parent = made[t.parent.k].id; m.sends = (t.sends || []).map(([nm, db]) => ({ to: made[TRACKS.findIndex(q => q.name === nm)].id, db })); m.regs = (t.regs || []).map(([ra, rb, tag]) => mkReg({ a: ra, b: rb, buf: m.buf0, loop: true, off: ra - 1, tag: tag || null })); m.patch0 = copy(m.patch) })
  S.tracks.length = 0; for (const m of made) S.tracks.push(m)
  SONG_END = 120; SCENES = mkScenes(SECTIONS.map(s => [s.name, s.a]))
  const T = name => S.tracks.find(t => t.name === name)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  /* a minor: am, f, c, g — a voicing for the right hand over a low note, played as a player plays: the first of the bar harder, the answers softer, a line on top that swells */
  const CHORDS = [[45, [57, 60, 64, 67]], [41, [57, 60, 65, 69]], [48, [55, 60, 64, 67]], [43, [55, 59, 62, 67]]]
  const comp = bars => { const out = []; for (let k = 0; k < bars; k++) { const [low, hand] = CHORDS[k % 4], q = k * 4, hits = k % 4 === 3 ? [[0, 1.4, 104], [1.5, .9, 70], [2.5, .45, 52], [3, .9, 86]] : k % 2 ? [[0, .9, 96], [1.5, 1.4, 64], [3.5, .45, 46]] : [[0, 1.4, 110], [1.5, .9, 60], [2.5, 1.4, 78]]
      out.push([q, 3.4, low + 12, 92 + Math.round(rnd() * 20)])
      for (const [at, d, vv] of hits) hand.forEach((n, i) => { if (rnd() > .1) out.push([q + at + (rnd() - .5) * .05, d * (.86 + rnd() * .2), n, clamp(Math.round(vv + (i === hand.length - 1 ? 14 : i === 0 ? -6 : -14) + (rnd() - .5) * 14), 20, 127)]) })
      if (k % 4 === 1) out.push([q + 3, .45, hand[3] + 2, 58], [q + 3.5, .45, hand[3] + 3, 80])
      if (k % 4 === 3) out.push([q + 2, .4, hand[3] + 5, 36], [q + 2.5, .4, hand[3] + 3, 52], [q + 3, .4, hand[3] + 2, 74], [q + 3.5, .45, hand[3] + 5, 118]) } return out }
  const pads = bars => { const out = []; for (let k = 0; k < bars; k += 2) { const [, hand] = CHORDS[(k / 2) % 4]; hand.forEach((n, i) => out.push([k * 4 + i * .08, 7.6, n + 12, 44 + i * 9 + Math.round(rnd() * 10)])) } return out }
  const subs = bars => { const out = []; for (let k = 0; k < bars; k++) { const low = CHORDS[k % 4][0] - 12, q = k * 4; out.push([q, 1.4, low, 108], [q + 1.5, .9, low, 96], [q + 2.5, .7, low + 12, 90], [q + 3.25, .7, low, 100]); if (k % 4 === 3) out.push([q + 3.75, .25, low + 2, 92]) } return out }
  const beat = bars => { const out = []; for (let k = 0; k < bars; k++) { const q = k * 4, fill = k % 8 === 7
      for (const at of [0, 1.5, 2.5]) out.push([q + at, .25, 36, at ? 98 : 122]); if (k % 2) out.push([q + 3.5, .25, 36, 84])
      out.push([q + 1, .25, 38, 112], [q + 3, .25, 38, 120]); if (k % 2) out.push([q + 2.25, .25, 38, 30], [q + 3.75, .25, 38, 38]); if (k % 4 === 2) out.push([q + 3, .25, 39, 96])
      for (let h = 0; h < 8; h++) { if (fill && h > 4) break; if (h === 7 && k % 2) out.push([q + 3.5, .25, 46, 92]); else out.push([q + h * .5, .25, 42, h % 2 ? 42 + Math.round(rnd() * 16) : 88 + Math.round(rnd() * 10)]) }
      if (k % 2 === 0) for (const at of [.25, 2.75]) out.push([q + at, .25, 42, 28 + Math.round(rnd() * 10)])
      if (k % 4 === 0) out.push([q, .25, 49, 108]); if (k % 2 === 0) out.push([q + 1.75, .25, 70, 50], [q + 3.75, .25, 70, 62])
      if (k % 4 === 1) out.push([q + .5, .25, 51, 70], [q + 1.5, .25, 51, 58], [q + 2.5, .25, 51, 76])
      if (fill) out.push([q + 2.5, .25, 48, 78], [q + 2.75, .25, 48, 90], [q + 3, .25, 45, 100], [q + 3.25, .25, 45, 108], [q + 3.5, .25, 41, 116], [q + 3.75, .25, 41, 124]) } return out }
  const chops = bars => { const out = []; for (let k = 0; k < bars; k++) { const q = k * 4; out.push([q + .5, .4, 60, 96], [q + 1.5, .9, 63, 84], [q + 2.75, .2, 60, 72], [q + 3, .9, 67, 100]) } return out }
  const voice = (t, kind, sound, gen) => { t.inst = newInst(kind, sound); delete t.midi; t.regs = t.regs.map(r => mkReg({ a: r.a, b: r.b, loop: false, tag: r.tag, notes: gen(Math.round(r.b - r.a)).map(([tt, d, n, v]) => mkNote(Math.max(0, tt), d, n, v)) })) }
  voice(T('rhodes'), 'synth', 'e piano', comp)
  voice(T('pad'), 'synth', 'warm pad', pads)
  const mk = (name, after, regs, kind, sound, gen, more) => { const t = mkTrack(name, null, null, null, null, -8, [], mkPatch(0, 0, 0, [0, 0, 0]), Object.assign({ parent: after.parent }, more || {})); t.patch0 = copy(t.patch); t.regs = regs.map(([a, bb]) => mkReg({ a, b: bb, loop: false })); voice(t, kind, sound, gen); S.tracks.splice(S.tracks.indexOf(after) + 1, 0, t); return t }
  const kit = mk('beat', T('room'), [[25, 33], [33, 49], [65, 73], [73, 89], [97, 113]], 'drums', null, beat, { vol: -6 })
  const sub = mk('sub', T('bass amp'), [[33, 49], [73, 89], [97, 113]], 'synth', 'sub bass', subs, { vol: -7 })
  const chop = mk('vox chop', T('ad libs'), [[41, 49], [81, 89], [105, 113]], 'sampler', null, chops, { vol: -11, pan: -.25 })
  T('rhodes').regs[2].q = .25; T('rhodes').regs[2].qs = .8; T('rhodes').regs[2].tag = 'verse 2 comp'
  for (const r of kit.regs) { r.q = .25; r.sw = .18 }
  normalizeOrder(); repaint()
  S.pos = 50.3; S.cycle = { on: true, a: 48, b: 56 }; S.master = -3.2; S.key = 'a min'; S.playing = false; S.slur = false
  window.__pick = (name, k) => { const t = T(name); S.sel = S.tracks.indexOf(t); S.selT = []; S.selR = k == null ? [] : [t.regs[k].id]; S.focus = 'lanes'; showRow(S.sel); return t }
  window.__show = (o) => { S.panel.on = true; S.panel.tab = 'notes'; S.panel.h = o.h || 470; S.panel.inst = false; Object.assign(NW, o.nw || {}); setView(true); setZoom(9, 0); VY = clamp(o.vy == null ? VY : o.vy, 0, maxVY()); __daw.redraw(); flush() }
`).catch(e => console.log('ERR', e.message))

const keys = `const t = __pick('rhodes', 2), r = t.regs[2]; NW.view = { a: 47.6, b: 54.2, hi: 79 }; NW.rowH = 13
  NW.chosen = new Set(r.notes.filter(x => x.t >= 9.4 && x.t < 9.6).map(x => x.id)); NW.held = new Set(); S.pos = 50.3`
const kit = `const t = __pick('beat', 1); NW.view = { a: 31.8, b: 35.6, hi: 0 }; NW.pad = 2; NW.chosen = new Set(); S.pos = 33.5`
const pad = `const t = __pick('pad', 2), r = t.regs[2]; NW.view = { a: r.a - 1.4, b: r.a + 5.2, hi: 86 }; NW.rowH = 13; NW.chosen = new Set(); NW.held = new Set(); S.pos = r.a + 1.3`
const sub = `const t = __pick('sub', 0), r = t.regs[0]; NW.view = { a: r.a - 1.4, b: r.a + 5.2, hi: 60 }; NW.rowH = 13; NW.chosen = new Set(); NW.held = new Set(); S.pos = r.a + 1.3`
const room = async (name, pick, nw, vy) => { await b.ev(`${pick}; __show({ vy: ${vy}, nw: ${JSON.stringify(nw)} })`); await b.sleep(150); await shot(name); await svgOut(name) }
const close = async (name, pick, nw, vy) => { await b.ev(`${pick}; __show({ vy: ${vy}, nw: ${JSON.stringify(nw)} })`); await b.sleep(150); await closeUp(name) }
// the two ways of drawing a note, each on the keys and on a kit, in the room
await room('n2 1 way a, strokes', keys, { form: 'stroke', ramp: 'duo' }, 250)
await room('n2 2 way a, strokes of a kit', kit, { form: 'stroke', ramp: 'duo' }, 0)
await room('n2 3 way b, tiles', keys, { form: 'tile', ramp: 'duo' }, 250)
await room('n2 4 way b, tiles of a kit', kit, { form: 'tile', ramp: 'duo' }, 0)
// close: the panel alone
await close('c 1 strokes', keys, { form: 'stroke', ramp: 'duo' }, 250)
await close('c 2 strokes of a kit', kit, { form: 'stroke', ramp: 'duo' }, 0)
await close('c 3 tiles', keys, { form: 'tile', ramp: 'duo' }, 250)
await close('c 4 tiles of a kit', kit, { form: 'tile', ramp: 'duo' }, 0)
// a stroke is the shape of its instrument's sound: the same page on a pad (slow to rise, long to die) and on a bass
await close('c 5 strokes of a pad', pad, { form: 'stroke', ramp: 'duo' }, 250)
await close('c 6 strokes of a bass', sub, { form: 'stroke', ramp: 'duo' }, 150)
// what velocity does to the colour: the three ways
await close('v 1 two inks', keys, { form: 'stroke', ramp: 'duo' }, 250)
await close('v 2 across the pigments', keys, { form: 'stroke', ramp: 'warm' }, 250)
await close('v 3 its own pigment', keys, { form: 'stroke', ramp: 'own' }, 250)
await close('v 4 two inks, kit', kit, { form: 'stroke', ramp: 'duo' }, 0)
await close('v 5 across the pigments, kit', kit, { form: 'stroke', ramp: 'warm' }, 0)
await close('v 6 its own pigment, kit', kit, { form: 'stroke', ramp: 'own' }, 0)
console.log(JSON.stringify(await b.ev(`return window.__errs`)), b.errors.join('\n'))
await b.close()
