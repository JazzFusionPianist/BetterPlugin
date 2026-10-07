// node test/draft-session.mjs — the page dressed as draft 7's own session, photographed in the draft's five states (test/out/b*.png), for laying beside the draft
import { open, PAGE, DRAFT } from './cdp.mjs'
import { readFileSync } from 'node:fs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)
const draft = readFileSync(DRAFT, 'utf8')
// the draft's own session, lifted out of its generator
const a = draft.indexOf('const SECTIONS ='), z = draft.indexOf('const SHORT =')
const data = draft.slice(a, z).replace(/const HUES[\s\S]*?\nconst KICK/, 'const KICK').replace(/function paint[\s\S]*?\n}\n/, '')
await b.ev(`
  ${data}
  const S = __daw.S
  const loops = { kick: 'kick', snare: 'snare', hat: 'hats', tom: 'snare', oh: 'hats', room: 'air', bass: 'bass', piano: 'keys', gtr: 'guitar', lead: 'guitar', vox: 'hum', adlib: 'hum', riser: 'air', impact: 'kick' }
  let id = 0
  const made = TRACKS.map(t => ({ id: ++id, name: t.name, theirs: t.who || null, kind: t.kind || 'audio', vol: t.vol, def: t.vol, pan: t.pan || 0, mute: !!t.mute, solo: false, arm: !!t.arm, mon: !!t.mon, inp: 0, out: 0, parent: null, open: true, sends: [], autos: {}, ap: 'vol', midi: !!t.midi, buf0: loops[t.w] || 'keys', regs: [], n: null, inserts: (t.loans || []).map((nm, k) => ({ uid: 1000 + id * 10 + k, name: nm, fmt: 'au', id: 'x' })),
    patch: { A: { tape: (t.patch || []).includes('tape') ? 24 : 0, space: (t.patch || []).includes('space') ? 46 : 0, delay: (t.patch || []).includes('delay') ? 30 : 0, share: 62 }, B: { tape: 0, space: 0, delay: 0, share: 62 }, x: 0 } }))
  TRACKS.forEach((t, k) => { const m = made[k]; if (t.parent) m.parent = made[t.parent.k].id; m.sends = (t.sends || []).map(([nm, db]) => ({ to: made[TRACKS.findIndex(q => q.name === nm)].id, db })); let rid = 0; m.regs = (t.regs || []).map(([ra, rb, tag]) => __daw.mkReg({ a: ra, b: rb, buf: m.buf0, loop: true, off: ra - 1, tag: tag || null })); m.patch0 = JSON.parse(JSON.stringify(m.patch)) })
  S.tracks.length = 0; for (const m of made) S.tracks.push(m)
  SONG_END = 120; SCENES = mkScenes(SECTIONS.map(s => [s.name, s.a]))
  S.sel = S.tracks.findIndex(t => t.name === 'lead vox'); S.selR = [S.tracks[S.sel].regs[8].id]; S.tracks[S.sel].regs[8].tag = 'chorus comp'
  S.pos = 40.3; S.cycle = { on: true, a: 32, b: 48 }; S.master = -3.2; S.key = 'a min'; S.playing = false
  __daw.setZoom(9, 0)
`).catch(e => console.log('ERR', e.message))
const shot = async (name, p, s, tab) => { await b.ev(`const S = __daw.S; S.panel.on = ${p}; S.panel.tab = '${tab || 'patch'}'; S.slur = ${s}; __daw.setView(true); __daw.setZoom(9, 0); __daw.redraw()`); await b.sleep(150); await b.shot(name) }
await shot('b1 arrange.png', false, false)
await shot('b2 mixer.png', true, false, 'mixer')
await shot('b3 patch.png', true, false, 'patch')
await shot('b4 patch slur.png', true, true, 'patch')
await shot('b6 mixer slur.png', true, true, 'mixer')
console.log(JSON.stringify(await b.ev(`return [window.__errs, __daw.lay()]`)), b.errors.join('\n'))
await b.close()
