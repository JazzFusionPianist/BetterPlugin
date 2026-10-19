// node test/openlater.mjs — a project is on the screen before its sounds have come (his ask, 2026-10-19: a project of sixty
// tracks stood still with the wheel spinning until all were ready). Its regions are drawn at once with their sound's name,
// the card says how many have come, saving is open once its plug-ins are in, each region is filled in as its sound comes,
// one made from a waiting one meanwhile (an undo) too; a sound not found is then said to be; another project opened before
// they have all come takes none of the first's. The song's text comes as the app hands it over: base64 (Main.cpp, text64).
// (A stand-in for the app behind the page, which answers for a sound only when told to.)
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('openlater: TIMED OUT'); process.exit(2) }, 60000)
const APP = `(${(() => {
  const ASKED = window.__asked = [], HELD = window.__held = new Map()
  const peaks = Array.from({ length: 400 }, (_, i) => i % 50 < 3 ? .8 : .05)
  const PATCH = () => ({ A: { tape: 0, space: 0, delay: 0, share: 62 }, B: { tape: 0, space: 0, delay: 0, share: 62 }, x: 0 })
  const reg = (id, a, b, file) => ({ id, a, b, file, sec: 8, srcBars: 4, rate: 1, loop: false, off: 0 })
  const SONGS = {
    gig: { v: 3, name: 'gig', tempo: 120, meter: [4, 4], end: 16, scenes: [], tracks: [
      { id: 1, name: 'kick', kind: 'audio', vol: 0, pan: 0, patch: PATCH(), sends: [], autos: {}, regs: [reg(1, 1, 3, 'kick.wav'), reg(2, 5, 7, 'kick.wav')], inserts: [{ id: 'au:eq', name: 'An EQ', fmt: 'AudioUnit', state: '' }] },
      { id: 2, name: '베이스', kind: 'audio', vol: 0, pan: 0, patch: PATCH(), sends: [], autos: {}, regs: [reg(3, 1, 5, 'bass.wav')] },
      { id: 3, name: 'pad', kind: 'audio', vol: 0, pan: 0, patch: PATCH(), sends: [], autos: {}, regs: [reg(4, 1, 5, 'gone.wav')] }] },
    other: { v: 3, name: 'other', tempo: 100, meter: [4, 4], end: 16, scenes: [], tracks: [
      { id: 1, name: 'bass again', kind: 'audio', vol: 0, pan: 0, patch: PATCH(), sends: [], autos: {}, regs: [reg(1, 2, 4, 'bass.wav')] }] } }
  const b64 = s => { const u8 = new TextEncoder().encode(s); let t = ''; for (const c of u8) t += String.fromCharCode(c); return btoa(t) }
  let uid = 0
  const answer = (op, d) => {
    ASKED.push([op, d ? JSON.parse(JSON.stringify(d)) : null])
    if (op === 'hello') return { ok: true, sr: 48000, block: 256, bits: 24, ins: 2, selftest: '', diskFree: 80 * 1073741824, open: '', inName: 'in', outName: 'out' }
    if (op === 'prefGet') return { lastProject: '', elsewhere: [], foldersOpen: [] }
    if (op === 'projList') return Object.keys(SONGS).map(name => ({ name, key: name, modified: Date.now() }))
    if (op === 'projFolders') return []
    if (op === 'projLoad') return SONGS[d.name] ? { ok: true, json64: b64(JSON.stringify(SONGS[d.name])), saved: Date.now() } : { ok: false }
    if (op === 'insert') return { ok: true, uid: ++uid, name: 'An EQ', fmt: 'AudioUnit' }
    if (op === 'audioLoad') return new Promise(res => HELD.set(d.project + '/' + d.file, () => res(d.file === 'gone.wav' ? { ok: false, missing: 1, file: d.file } : { ok: true, key: 'file:' + d.project + '/' + d.file, file: d.file, name: d.file.replace('.wav', ''), sec: 8, peaks, ch: 2 })))
    if (op === 'distrust' || op === 'audioList' || op === 'takesLeft' || op === 'projBackups' || op === 'plugins') return []
    if (op === 'badEnds' || op === 'pluginStates') return null
    return { ok: true }
  }
  window.__let = key => { const f = HELD.get(key); HELD.delete(key); if (f) f() }
  const hear = new Map()
  window.__JUCE__ = { initialisationData: { __juce__functions: ['daw'] }, backend: {
    addEventListener: (ev, fn) => { if (!hear.has(ev)) hear.set(ev, []); hear.get(ev).push(fn) },
    emitEvent: (name, p) => { if (name !== '__juce__invoke') return; Promise.resolve(answer(p.params[0], p.params[1])).then(result => setTimeout(() => { for (const fn of hear.get('__juce__complete') || []) fn({ promiseId: p.resultId, result }) }, 1)) }
  } }
}).toString()})()`
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1, before: APP })
for (let i = 0; i < 60 && !(await b.ev(`return typeof START !== 'undefined' && START.read`)); i++) await b.sleep(100)
const ev = b.ev
const until = async (what, ms = 3000) => { for (let t = 0; t < ms; t += 50) { if (await ev(`return !!(${what})`)) return true; await b.sleep(50) } return false }
const regs = name => ev(`const t = S.tracks.find(t => t.name === ${JSON.stringify(name)}); return t ? t.regs.map(r => ({ a: r.a, key: r.key || null, wait: !!r.wait, missing: !!r.missing })) : null`)

const h0 = await ev(`START.on = false; return PROJ.hold`)                                          // (what holds it besides: the start page put away by hand)
await ev(`window.__done = null; loadProject('gig').then(ok => { window.__done = { ok } })`)
ok('the song is on the screen while its sounds are still to come', await until(`S.tracks.some(t => t.name === '베이스') && __held.size === 3`), await ev(`return [S.tracks.map(t => t.name), __held.size]`))
ok('its text came as base64, its names whole', await ev(`return S.tracks.map(t => t.name).join() === 'kick,베이스,pad'`), await ev(`return S.tracks.map(t => t.name)`))
ok('every region is there, waiting for its sound', JSON.stringify(await regs('kick')) === JSON.stringify([{ a: 1, key: null, wait: true, missing: true }, { a: 5, key: null, wait: true, missing: true }]), await regs('kick'))
await ev(`flush()`)
ok('drawn with its sound’s name, not as not found', await ev(`const txt = [...document.querySelectorAll('#g-lanes text')].map(t => t.textContent); return txt.filter(x => x === 'kick.wav').length === 2 && !txt.some(x => /not found/.test(x))`), await ev(`return [...document.querySelectorAll('#g-lanes text')].map(t => t.textContent)`))
ok('its plug-ins are put in meanwhile', await until(`__asked.some(q => q[0] === 'insert')`))
ok('the card says how many sounds have come', await until(`OPENING.on && /^sounds 0 of 3/.test(document.getElementById('ld-what').textContent) && !document.getElementById('loading').hidden`), await ev(`return document.getElementById('ld-what').textContent`))
ok('the song may be saved from here', await until(`PROJ.hold === ${h0}`), await ev(`return [PROJ.hold, ${h0}]`))
ok('nothing waiting is sent to be played', await ev(`const s = __asked.filter(q => q[0] === 'session' && q[1].tracks && q[1].tracks.length).pop(); return !!s && s[1].tracks.every(t => !(t.regs || []).length)`))

await ev(`__let('gig/bass.wav')`)
ok('a sound come: its region is filled in at once', await until(`S.tracks.find(t => t.name === '베이스').regs[0].key === 'file:gig/bass.wav'`), await regs('베이스'))
ok('…and played', await until(`__asked.some(q => q[0] === 'session' && (q[1].tracks || []).some(t => (t.regs || []).some(r => r.buf === 'file:gig/bass.wav')))`))
ok('the card says one has come', await ev(`return /^sounds 1 of 3/.test(document.getElementById('ld-what').textContent)`), await ev(`return document.getElementById('ld-what').textContent`))

// a region moved while its sound is still coming, and the move undone after it has come: it comes back with its sound
await ev(`const t = S.tracks.find(t => t.name === 'kick'), before = editState(); t.regs[0].a += 1; t.regs[0].b += 1; commit(before)`)
await ev(`__let('gig/kick.wav')`)
await until(`S.tracks.find(t => t.name === 'kick').regs.every(r => r.key)`)
ok('moved meanwhile: filled in where it was moved to', JSON.stringify((await regs('kick')).map(r => [r.a, r.key, r.wait])) === JSON.stringify([[2, 'file:gig/kick.wav', false], [5, 'file:gig/kick.wav', false]]), await regs('kick'))
await ev(`undoEdit(); flush()`)
ok('undone after it came: back where it was, with its sound', JSON.stringify((await regs('kick')).map(r => [r.a, r.key, r.wait])) === JSON.stringify([[1, 'file:gig/kick.wav', false], [5, 'file:gig/kick.wav', false]]), await regs('kick'))

ok('still opening while one is to come', await ev(`return OPENING.on && !__done`))
await ev(`__let('gig/gone.wav')`)
ok('all come: the opening ends', await until(`__done && __done.ok && !OPENING.on && document.getElementById('loading').hidden`), await ev(`return [__done, OPENING.on]`))
ok('one not found: drawn as not found, and said', JSON.stringify(await regs('pad')) === JSON.stringify([{ a: 1, key: null, wait: false, missing: true }]) && /^1 sound of this project not found/.test(await ev(`return (S.last && S.last.say) || ''`)), [await regs('pad'), await ev(`return S.last`)])
ok('how long each part took is written down', await ev(`return /^drawn in /.test(OPENING.last.took[0]) && OPENING.last.took.some(x => /^sounds 3 in /.test(x))`), await ev(`return OPENING.last`))

// another project opened before the first one's sounds have come: none of them lands in it
await ev(`window.__done = null; loadProject('gig').then(ok => { window.__done = { ok } })`)
await until(`__held.size === 3`)
await ev(`window.__done2 = null; loadProject('other').then(ok => { window.__done2 = { ok } })`)
ok('the first one’s opening gives way', await until(`__done && S.tracks.some(t => t.name === 'bass again')`), await ev(`return [__done, S.tracks.map(t => t.name)]`))
await ev(`__let('gig/bass.wav'); __let('gig/kick.wav'); __let('gig/gone.wav')`)
await b.sleep(150)
ok('what still came for it is let go, not put in the other', JSON.stringify(await regs('bass again')) === JSON.stringify([{ a: 2, key: null, wait: true, missing: true }]) && await ev(`return __asked.some(q => q[0] === 'dropBuffer' && q[1].key === 'file:gig/bass.wav')`), [await regs('bass again'), await ev(`return __asked.filter(q => q[0] === 'dropBuffer').map(q => q[1].key)`)])
await ev(`__let('other/bass.wav')`)
ok('the other gets its own', await until(`__done2 && __done2.ok && S.tracks[0].regs[0].key === 'file:other/bass.wav'`), [await regs('bass again'), await ev(`return __done2`)])
ok('and nothing is said as not found', !/not found/.test(await ev(`return (S.last && S.last.say) || ''`)), await ev(`return S.last`))

{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `openlater: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'openlater: all passed')
process.exit(bad.length ? 1 : 0)
