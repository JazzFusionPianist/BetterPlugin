// notes and instruments, round 1 — the draft of what is new to the eye: the notes page (a region's notes against the keys;
// a kit's against its pads), the room's own instruments opened (synth, kit, sampler), the computer's keys as a keyboard.
// Drawn on the app's own page with the room's own kit (roll-draft.js is read into the page here; the app does not load
// it), in draft 7's session, so that what is agreed is what gets built.   node "design/midi round 1 draft/draft.mjs"
import { open, PAGE, DRAFT as DRAFT7 } from '../../test/cdp.mjs'
import { writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)
const ONLY = process.argv[2] || ''                                                    // node draft.mjs k1 — only the pictures whose names begin so
const shot = async name => { if (!name.startsWith(ONLY)) return; const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64')) }
// the panel below the lanes by itself, at twice its size: what an instrument looks like, close enough to read
const closeUp = async name => { if (!name.startsWith(ONLY)) return; const [y, h, w] = await b.ev('return [BY, H - BY, RX]'); const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y, width: w, height: h, scale: 1 } }); writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64')) }
// the board as one standalone picture: what only takes the pointer is left out, and the line that is typed into is written in
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
// the draft's drawing, read into the page as a script of its own (so that what it names is the page's to use)
const pInstr1 = 'window.pInstr1 = pInstr'                                               // (the instrument page of draft 1 is kept, so that its pictures can still be made)
await b.ev(`for (const code of ${JSON.stringify([readFileSync(join(here, 'roll-draft.js'), 'utf8'), pInstr1, readFileSync(join(here, 'keyboard-draft.js'), 'utf8'), readFileSync(join(here, 'instrument-draft.js'), 'utf8'), 'window.pInstr2 = pInstr; pInstr = pInstr1', readFileSync(join(here, 'pictures-draft.js'), 'utf8')])}) { const s = document.createElement('script'); s.textContent = code; document.head.appendChild(s) } PARTS.dock = pDock
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'g-keys'; document.getElementById('svg').insertBefore(g, document.getElementById('g-top'))`)

// ── draft 7's session, with tracks of notes in it: the rhodes and the pad played by the synth, a sub under the basses,
//    a kit beside the drums, a sampler among the voices ──
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
  /* a minor: am, f, c, g — each a voicing for the right hand over a low note */
  const CHORDS = [[45, [57, 60, 64, 67]], [41, [57, 60, 65, 69]], [48, [55, 60, 64, 67]], [43, [55, 59, 62, 67]]]
  const comp = bars => { const out = []; for (let k = 0; k < bars; k++) { const [low, hand] = CHORDS[k % 4], q = k * 4, hits = k % 4 === 3 ? [[0, 1.4], [1.5, .9], [2.5, .45], [3, .9]] : k % 2 ? [[0, .9], [1.5, 1.4], [3.5, .45]] : [[0, 1.4], [1.5, .9], [2.5, 1.4]]
      out.push([q, 3.4, low + 12, 84 + Math.round(rnd() * 14)])
      for (const [at, d] of hits) for (const n of hand) if (rnd() > .12) out.push([q + at + (rnd() - .5) * .05, d * (.86 + rnd() * .2), n, Math.round((at === 0 ? 92 : 70) + rnd() * 26)])
      if (k % 4 === 1) out.push([q + 3, .45, hand[3] + 2, 66], [q + 3.5, .45, hand[3] + 3, 74]) } return out }
  const pads = bars => { const out = []; for (let k = 0; k < bars; k += 2) { const [, hand] = CHORDS[(k / 2) % 4]; for (const n of hand) out.push([k * 4, 7.8, n + 12, 58 + Math.round(rnd() * 10)]) } return out }
  const subs = bars => { const out = []; for (let k = 0; k < bars; k++) { const low = CHORDS[k % 4][0] - 12, q = k * 4; out.push([q, 1.4, low, 108], [q + 1.5, .9, low, 96], [q + 2.5, .7, low + 12, 90], [q + 3.25, .7, low, 100]); if (k % 4 === 3) out.push([q + 3.75, .25, low + 2, 92]) } return out }
  const beat = bars => { const out = []; for (let k = 0; k < bars; k++) { const q = k * 4, fill = k % 8 === 7
      for (const at of [0, 1.5, 2.5]) out.push([q + at, .25, 36, at ? 104 : 120]); if (k % 2) out.push([q + 3.5, .25, 36, 96])
      out.push([q + 1, .25, 38, 112], [q + 3, .25, 38, 116]); if (k % 4 === 2) out.push([q + 3, .25, 39, 96])
      for (let h = 0; h < 8; h++) { if (fill && h > 4) break; if (h === 7 && k % 2) out.push([q + 3.5, .25, 46, 88]); else out.push([q + h * .5, .25, 42, h % 2 ? 62 + Math.round(rnd() * 12) : 92]) }
      if (k % 4 === 0) out.push([q, .25, 49, 100]); if (k % 2 === 0) out.push([q + 1.75, .25, 70, 60], [q + 3.75, .25, 70, 64])
      if (fill) out.push([q + 2.5, .25, 48, 100], [q + 2.75, .25, 48, 92], [q + 3, .25, 45, 104], [q + 3.25, .25, 45, 96], [q + 3.5, .25, 41, 110], [q + 3.75, .25, 41, 100]) } return out }
  const chops = bars => { const out = []; for (let k = 0; k < bars; k++) { const q = k * 4; out.push([q + .5, .4, 60, 96], [q + 1.5, .9, 63, 84], [q + 2.75, .2, 60, 72], [q + 3, .9, 67, 100]) } return out }
  const voice = (t, kind, sound, gen, tagOf) => { t.inst = newInst(kind, sound); delete t.midi; t.regs = t.regs.map(r => mkReg({ a: r.a, b: r.b, loop: false, tag: r.tag, notes: gen(Math.round(r.b - r.a)).map(([tt, d, n, v]) => mkNote(Math.max(0, tt), d, n, v)) })) }
  voice(T('rhodes'), 'synth', 'e piano', comp)
  voice(T('pad'), 'synth', 'warm pad', pads)
  const mk = (name, after, regs, kind, sound, gen, more) => { const t = mkTrack(name, null, null, null, null, -8, [], mkPatch(0, 0, 0, [0, 0, 0]), Object.assign({ parent: after.parent }, more || {})); t.patch0 = copy(t.patch); t.regs = regs.map(([a, bb]) => mkReg({ a, b: bb, loop: false })); voice(t, kind, sound, gen); S.tracks.splice(S.tracks.indexOf(after) + 1, 0, t); return t }
  const kit = mk('beat', T('room'), [[25, 33], [33, 49], [65, 73], [73, 89], [97, 113]], 'drums', null, beat, { vol: -6 })
  const sub = mk('sub', T('bass amp'), [[33, 49], [73, 89], [97, 113]], 'synth', 'sub bass', subs, { vol: -7 })
  const chop = mk('vox chop', T('ad libs'), [[41, 49], [81, 89], [105, 113]], 'sampler', null, chops, { vol: -11, pan: -.25 })
  { const N = 220, pk = []; for (let i = 0; i < N; i++) { const x = i / (N - 1), env = x < .04 ? x / .04 : Math.exp(-(x - .04) * 2.4), wob = .62 + .38 * Math.sin(x * 46) * Math.sin(x * 7.3); pk.push(Math.max(.02, env * wob * (.82 + .18 * Math.sin(i * 1.7)))) }
    chop.inst.sample = { file: 'ooh take 4.wav', name: 'ooh take 4', sec: 1.84, peaks: pk }; chop.inst.p = { start: .035, end: .78, loop: 1, loopStart: .3, loopEnd: .62, root: 63, r: .28, d: .6 } }
  kit.inst.pads = { 3: { file: 'clap 909.wav', name: 'clap 909' } }; kit.inst.p = { 'snare.level': -2, 'snare.tune': 2, 'snare.decay': 1.3, 'snare.pan': .08 }
  T('rhodes').regs[2].q = .25; T('rhodes').regs[2].qs = .8; T('rhodes').regs[2].tag = 'verse 2 comp'
  for (const r of kit.regs) { r.q = .25; r.sw = .18 }
  normalizeOrder(); repaint()
  S.pos = 50.3; S.cycle = { on: true, a: 48, b: 56 }; S.master = -3.2; S.key = 'a min'; S.playing = false; S.slur = false
  window.__pick = (name, k) => { const t = T(name); S.sel = S.tracks.indexOf(t); S.selT = []; S.selR = k == null ? [] : [t.regs[k].id]; S.focus = 'lanes'; showRow(S.sel); return t }
  window.__show = (o) => { S.panel.on = o.panel !== false; S.panel.tab = o.tab || 'patch'; S.panel.h = o.h || 316; ND.inst = !!o.inst; ND.keys = !!o.keys; TYPE.on = !!o.keys; setView(true); setZoom(9, 0); VY = clamp(o.vy == null ? VY : o.vy, 0, maxVY()); __daw.redraw(); flush(); document.getElementById('g-keys').innerHTML = pKeyboard() }
`).catch(e => console.log('ERR', e.message))

// 1: the notes page — the rhodes' part in the second verse, the page pulled up to give the keys room
await b.ev(`const t = __pick('rhodes', 2), r = t.regs[2]; ND.view = { a: 47.5, b: 56.5, hi: 84 }; ND.rowH = 9
  ND.chosen = new Set(r.notes.filter(x => x.t >= 9.4 && x.t < 9.6).map(x => x.id)); ND.held = new Set()
  __show({ tab: 'notes', h: 440, vy: 250 })`)
await b.sleep(200); await shot('m1 1 notes'); await svgOut('m1 1 notes')

// 2: the same page on a kit: its pads down the side, a step for every sixteenth
await b.ev(`const t = __pick('beat', 1); ND.view = { a: 31.75, b: 36.25, hi: 0 }; ND.pad = 2; ND.chosen = new Set(t.regs[1].notes.filter(x => x.n === 38 && x.t < 16).map(x => x.id)); S.pos = 33.5
  __show({ tab: 'notes', h: 440, vy: 0 })`)
await b.sleep(200); await shot('m1 2 notes of a kit'); await svgOut('m1 2 notes of a kit')

// 3 – 5: the instruments, opened where the patch stands
await b.ev(`__pick('rhodes', 2); S.pos = 50.3; __show({ tab: 'patch', inst: true, vy: 0 })`)
await b.sleep(200); await shot('m1 3 synth'); await svgOut('m1 3 synth'); await closeUp('c1 2 synth')
await b.ev(`__pick('beat', 1); ND.pad = 2; __show({ tab: 'patch', inst: true, vy: 0 })`)
await b.sleep(200); await shot('m1 4 kit'); await svgOut('m1 4 kit'); await closeUp('c1 3 kit')
await b.ev(`__pick('vox chop', 0); __show({ tab: 'patch', inst: true, vy: 420 })`)
await b.sleep(200); await shot('m1 5 sampler'); await svgOut('m1 5 sampler'); await closeUp('c1 4 sampler')

// 6: the computer's keys as a keyboard, over the lanes; under it the patch as it is built now, the instrument at its head
await b.ev(`__pick('rhodes', 2); TYPE.oct = 5; TYPE.vel = 100; ND.held = new Set([60, 64, 67]); ND.kb = { way: 'a', held: [0, 4, 7], mod: -1, bend: 0 }; __show({ tab: 'patch', keys: true, vy: 0 })`)
await b.sleep(200); await shot('m1 6 keyboard'); await svgOut('m1 6 keyboard'); await closeUp('c1 1 where it opens')

// 7: as it is built now (no draft in this one): a new track of notes, and the list of what can play it
await b.ev(`ND.keys = false; ND.kb = null; TYPE.on = false; document.getElementById('g-keys').innerHTML = ''; __pick('rhodes', 2); __show({ tab: 'patch', vy: 0 }); openNewTrack(); S.newT.kind = 'midi'; S.newT.inst = 'synth'; uiDirty('new'); flush(); openPicker('inst'); document.getElementById('picker').style.left = '318px'; document.getElementById('picker').style.top = '74px'`)
await b.sleep(400); await shot('m1 7 as built')

// ── the keyboard, draft 2 (keyboard-draft.js): every state on one sheet; then each of the two ways in the room ──
await b.ev(`closeNewTrack(); closePicker(); flush()`)
const states = await b.ev(`repaint(); return kbStates(S.tracks.find(t => t.name === 'rhodes'))`)
const doc = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900" fill="none">${states}</svg>`
if ('k1 1 keyboard'.startsWith(ONLY)) writeFileSync(join(here, 'k1 1 keyboard.svg'), doc)
await b.ev(`const d = document.createElement('div'); d.id = 'kb-sheet'; d.style.cssText = 'position:fixed;left:0;top:0;width:1440px;height:900px;z-index:99'; d.innerHTML = ${JSON.stringify(doc.replace(/^<\?xml[^>]*>/, ''))}; document.body.appendChild(d)`)
await b.sleep(200); await shot('k1 1 keyboard')
await b.ev(`document.getElementById('kb-sheet').remove()`)
await b.ev(`__pick('rhodes', 2); TYPE.oct = 5; TYPE.vel = 100; ND.kb = { way: 'a', held: [0, 4, 7], mod: -1, bend: 0 }; S.pos = 50.3; __show({ panel: false, keys: true, vy: 0 })`)
await b.sleep(200); await shot('k1 2 way a in the room'); await svgOut('k1 2 way a in the room')
await b.ev(`ND.kb = { way: 'b', held: [0, 4, 7] }; __show({ panel: false, keys: true, vy: 0 })`)
await b.sleep(200); await shot('k1 3 way b in the room'); await svgOut('k1 3 way b in the room')
// ── the instruments, draft 2 (instrument-draft.js): a face for each — plates in the track's pigment with the thing itself
//    drawn on them; and each instrument as a small plate of its own at the head of the patch ──
await b.ev(`pInstr = pInstr2; ID.plates = true; ND.kb = null; ND.keys = false; TYPE.on = false; document.getElementById('g-keys').innerHTML = ''`)
await b.ev(`__pick('rhodes', 2); S.pos = 50.3; __show({ tab: 'patch', inst: true, vy: 0 })`)
await b.sleep(200); await shot('i2 1 synth'); await svgOut('i2 1 synth'); await closeUp('c2 1 synth')
await b.ev(`__pick('sub', 0); __show({ tab: 'patch', inst: true, vy: 0 })`)
await b.sleep(200); await closeUp('c2 2 synth, another sound')
await b.ev(`__pick('beat', 1); ID.pad = 2; __show({ tab: 'patch', inst: true, vy: 0 })`)
await b.sleep(200); await shot('i2 2 kit'); await svgOut('i2 2 kit'); await closeUp('c2 3 kit')
await b.ev(`__pick('vox chop', 0); __show({ tab: 'patch', inst: true, vy: 420 })`)
await b.sleep(200); await shot('i2 3 sampler'); await svgOut('i2 3 sampler'); await closeUp('c2 4 sampler')
await b.ev(`__pick('rhodes', 2); __show({ tab: 'patch', vy: 0 })`)
await b.sleep(200); await shot('i2 4 at the head of the patch'); await svgOut('i2 4 at the head of the patch'); await closeUp('c2 5 at the head of the patch')
await b.ev(`__pick('beat', 1); __show({ tab: 'patch', vy: 0 })`)
await b.sleep(200); await closeUp('c2 6 the kit at the head of its patch')
// ── the instruments, draft 3 (pictures-draft.js): every sound, pad and instrument drawn as the thing it is ──
const sheetOf = async (name, fn) => {
  if (!name.startsWith(ONLY)) return
  const inner = await b.ev(`repaint(); return ${fn}`)
  const doc = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900" fill="none">${inner}</svg>`
  writeFileSync(join(here, name + '.svg'), doc)
  await b.ev(`const d = document.createElement('div'); d.id = 'over-sheet'; d.style.cssText = 'position:fixed;left:0;top:0;width:1440px;height:900px;z-index:99'; d.innerHTML = ${JSON.stringify(doc.replace(/^<\?xml[^>]*>/, ''))}; document.body.appendChild(d)`)
  await b.sleep(200); await shot(name)
  await b.ev(`document.getElementById('over-sheet').remove()`)
}
await sheetOf('p3 0 pictures', 'picSheet()')
await sheetOf('p4 clap', 'clapSheet()')
await b.ev(`pInstr = pInstr2; ID.plates = true; ND.kb = null; ND.keys = false; TYPE.on = false; document.getElementById('g-keys').innerHTML = ''`)
await b.ev(`__pick('rhodes', 2); S.pos = 50.3; __show({ tab: 'patch', inst: true, vy: 0 })`)
await b.sleep(200); await shot('p3 1 synth'); await svgOut('p3 1 synth'); await closeUp('c3 2 synth')
await b.ev(`const t = __pick('pad', 2); t.inst = newInst('synth', 'strings'); repaint(); __show({ tab: 'patch', inst: true, vy: 0 })`)
await b.sleep(200); await closeUp('c3 3 synth, another sound')
await b.ev(`__pick('beat', 1); ID.pad = 2; __show({ tab: 'patch', inst: true, vy: 0 })`)
await b.sleep(200); await shot('p3 2 kit'); await svgOut('p3 2 kit'); await closeUp('c3 4 kit')
await b.ev(`__pick('vox chop', 0); __show({ tab: 'patch', inst: true, vy: 420 })`)
await b.sleep(200); await shot('p3 3 sampler'); await svgOut('p3 3 sampler'); await closeUp('c3 5 sampler')
await b.ev(`__pick('rhodes', 2); __show({ tab: 'patch', vy: 0 })`)
await b.sleep(200); await shot('p3 4 at the head of the patch'); await svgOut('p3 4 at the head of the patch'); await closeUp('c3 1 at the head of the patch')
await b.ev(`__pick('beat', 1); __show({ tab: 'patch', vy: 0 })`)
await b.sleep(200); await closeUp('c3 6 the kit at the head of its patch')
console.log(JSON.stringify(await b.ev(`return window.__errs`)), b.errors.join('\n'))
await b.close()
