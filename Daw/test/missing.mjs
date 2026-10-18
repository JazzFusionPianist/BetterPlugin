// node test/missing.mjs — a project opened where its sounds are not (copied to another Mac without them, or kept where the
// app may not read): every region stays where it was, drawn as not found and named; the app says how many were not found;
// nothing of them is sent to be played; saved, the song keeps them exactly; File › Find Missing Sounds… asks for a folder,
// takes each sound found there into the project, and the regions play again. (A stand-in for the app behind the page.)
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('missing: TIMED OUT'); process.exit(2) }, 60000)
const APP = `(${(() => {
  const ASKED = window.__asked = []
  const N = 400, peaks = Array.from({ length: N }, (_, i) => i % 50 < 3 ? .8 : .05)
  const PATCH = () => ({ A: { tape: 0, space: 0, delay: 0, share: 62 }, B: { tape: 0, space: 0, delay: 0, share: 62 }, x: 0 })
  const SONG = { v: 3, name: 'gig', tempo: 120, meter: [4, 4], end: 16, scenes: [], tracks: [
    { id: 1, name: 'kick', kind: 'audio', vol: 0, pan: 0, patch: PATCH(), sends: [], autos: {}, regs: [{ id: 1, a: 1, b: 3, file: 'kick.wav', sec: 4, srcBars: 2, rate: 1, loop: false, off: 0, gain: -2 }, { id: 2, a: 5, b: 7, file: 'kick.wav', sec: 4, srcBars: 2, rate: 1, loop: false, off: 0 }] },
    { id: 2, name: 'bass', kind: 'audio', vol: 0, pan: 0, patch: PATCH(), sends: [], autos: {}, regs: [{ id: 3, a: 1, b: 5, file: 'bass.wav', sec: 8, srcBars: 4, rate: 1, loop: false, off: 0 }] }] }
  const answer = (op, d) => {
    ASKED.push([op, d ? JSON.parse(JSON.stringify(d)) : null])
    if (op === 'hello') return { ok: true, sr: 48000, block: 256, bits: 24, ins: 2, selftest: '', diskFree: 8 * 1073741824, open: '', inName: 'in', outName: 'out' }
    if (op === 'prefGet') return { lastProject: '', elsewhere: [], foldersOpen: [] }
    if (op === 'projList') return [{ name: 'gig', key: 'gig', modified: Date.now() }]
    if (op === 'projFolders') return []
    if (op === 'projLoad') return { ok: true, json: JSON.stringify(SONG), saved: Date.now() }
    if (op === 'audioLoad') {
      const here = d.file === 'bass.wav' || (d.file === 'kick.wav' && (d.also || []).includes('/elsewhere'))
      return here ? { ok: true, key: 'file:' + d.file, file: d.file, name: d.file.replace('.wav', ''), sec: d.file === 'bass.wav' ? 8 : 4, peaks, ch: 2 } : { ok: false, missing: 1, file: d.file }
    }
    if (op === 'audioFind') return { ok: true, dir: '/elsewhere' }
    if (op === 'distrust' || op === 'audioList' || op === 'takesLeft' || op === 'projBackups' || op === 'plugins') return []
    if (op === 'badEnds' || op === 'pluginStates') return null
    return { ok: true }
  }
  const hear = new Map()
  window.__JUCE__ = { initialisationData: { __juce__functions: ['daw'] }, backend: {
    addEventListener: (ev, fn) => { if (!hear.has(ev)) hear.set(ev, []); hear.get(ev).push(fn) },
    emitEvent: (name, p) => { if (name !== '__juce__invoke') return; const result = answer(p.params[0], p.params[1]); setTimeout(() => { for (const fn of hear.get('__juce__complete') || []) fn({ promiseId: p.resultId, result }) }, 0) },
  } }
}).toString()})()`
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1, before: APP })
for (let i = 0; i < 60 && !(await b.ev(`return typeof START !== 'undefined' && START.read`)); i++) await b.sleep(100)
const ev = b.ev
const opened = await ev(`START.on = false; const ok = await loadProject('gig'); flush(); return ok`)
ok('the project opens', opened === true)
const kept = await ev(`const k = S.tracks.find(t => t.name === 'kick'), bs = S.tracks.find(t => t.name === 'bass'); return { kick: k.regs.map(r => [r.a, r.b, !!r.missing, !!r.key]), bass: bs.regs.map(r => [r.a, r.b, !!r.missing, !!r.key]) }`)
ok('the regions whose sound was not found are all still there, where they were', JSON.stringify(kept.kick) === JSON.stringify([[1, 3, true, false], [5, 7, true, false]]), kept)
ok('…and the one found plays as ever', JSON.stringify(kept.bass) === JSON.stringify([[1, 5, false, true]]), kept)
ok('the app says how many sounds were not found, and where to find them', /^1 sound of this project not found: File › Find Missing Sounds…$/.test(await ev(`return (S.last && S.last.say) || ''`)), await ev(`return S.last`))
ok('on the lane: drawn as not found, with its sound’s name', await ev(`return [...document.querySelectorAll('text')].filter(t => t.textContent === 'kick.wav — not found').length === 2`))
const sent = await ev(`const s = __asked.filter(q => q[0] === 'session' && q[1].tracks && q[1].tracks.length).pop(); if (!s) return null; return s[1].tracks.map(t => (t.regs || []).map(r => r.buf))`)
ok('nothing of them is sent to be played', !!sent && sent.flat().every(x => x === 'file:bass.wav' || x === 'file:bass.wav'.replace('.wav', '')) && !sent.flat().some(x => x == null), sent)
const saved = await ev(`const j = JSON.parse(serialize()), k = j.tracks.find(t => t.name === 'kick'); return k.regs.map(r => [r.a, r.b, r.file, r.gain || 0, 'missing' in r])`)
ok('saved: the song keeps them exactly as they were (and not that they were missing)', JSON.stringify(saved) === JSON.stringify([[1, 3, 'kick.wav', -2, false], [5, 7, 'kick.wav', 0, false]]), saved)
await ev(`await findMissing(); flush()`)
const back = await ev(`const k = S.tracks.find(t => t.name === 'kick'); return { regs: k.regs.map(r => [!!r.missing, r.key]), asked: __asked.filter(q => q[0] === 'audioLoad' && q[1].adopt).map(q => [q[1].file, q[1].also, q[1].adopt]), say: S.last && S.last.say }`)
ok('Find Missing Sounds…: the folder picked is looked in, the sound taken into the project, and the regions play again', JSON.stringify(back.regs) === JSON.stringify([[false, 'file:kick.wav'], [false, 'file:kick.wav']]) && JSON.stringify(back.asked) === JSON.stringify([['kick.wav', ['/elsewhere'], 1]]) && back.say === 'found it: back in the project', back)
ok('the menu bar has it', await ev(`return JSON.stringify(MENU_BAR(), (k, v) => typeof v === 'function' ? undefined : v).includes('Find Missing Sounds…')`))
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `missing: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'missing: all passed')
process.exit(bad.length ? 1 : 0)
