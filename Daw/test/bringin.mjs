// node test/bringin.mjs — sound brought in by where it lies (his testers, 2026-10-20: bringing sound in was slow). Files let
// go from the Finder whose places the app kept (dropPaths), and files picked with import audio (importPick), are copied by
// the app (audioBring) and placed at once as outlines with their names, the regions filled in as each sound comes; how its
// first sound moves and how fast it goes are read once it has come. The card comes up only when it takes a while, and
// says nothing of esc. A file whose place is not known still comes over in pieces. An undo meanwhile is fine.
// (A stand-in for the app behind the page, which answers for a sound only when told to.)
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('bringin: TIMED OUT'); process.exit(2) }, 60000)
const APP = `(${(() => {
  const ASKED = window.__asked = [], HELD = window.__held = new Map()
  const peaks = Array.from({ length: 900 }, (_, i) => i % 50 < 3 ? .8 : .05)
  window.__known = []
  const answer = (op, d) => {
    ASKED.push([op, d ? JSON.parse(JSON.stringify(d, (k, v) => k === 'data' ? '…' : v)) : null])
    if (op === 'hello') return { ok: true, sr: 48000, block: 256, bits: 24, ins: 2, selftest: '', diskFree: 80 * 1073741824, open: '', inName: 'in', outName: 'out' }
    if (op === 'prefGet') return { lastProject: '', elsewhere: [], foldersOpen: [] }
    if (op === 'projList' || op === 'projFolders') return []
    if (op === 'dropPaths') { const k = window.__known; window.__known = []; return k }
    if (op === 'importPick') return ['/Users/x/Music/Pad Long.wav']
    if (op === 'audioBring') return d.paths.map(p => { const name = p.split('/').pop().replace(/\.[^.]+$/, ''); return /broken/.test(p) ? { ok: false, name } : { ok: true, file: name + '.wav', name, sec: 9 } })
    if (op === 'audioLoad') return new Promise(res => HELD.set(d.file, () => res({ ok: true, key: 'file:' + d.file, file: d.file, name: d.file.replace('.wav', ''), sec: 9, peaks, tone: [.4, .6], ch: 2 })))
    if (op === 'audioPut') return d.last ? { ok: true, key: 'file:put', file: d.name, sec: 4, peaks } : { ok: true }
    if (op === 'tempo') return { bpm: 0, sure: 0 }
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
const until = async (what, ms = 3000) => { for (let t = 0; t < ms; t += 25) { if (await ev(`return !!(${what})`)) return true; await b.sleep(25) } return false }
const regsOf = name => ev(`return S.tracks.flatMap(t => t.regs.map(r => ({ t: t.name, name: r.name, file: r.file, key: r.key || null, wait: !!r.wait, missing: !!r.missing, a: +r.a.toFixed(3) }))).filter(r => r.name === ${JSON.stringify(name)})`)
await ev(`START.on = false; closeStart && closeStart(); S.sel = 0; flush()`)

// two files let go from the Finder: their places known
await ev(`window.__known = [{ path: '/Users/x/Desktop/Kick Take.wav', name: 'Kick Take.wav', size: 44 }, { path: '/Users/x/Desktop/Vox Take.wav', name: 'Vox Take.wav', size: 55 }]
  window.__p = dropFiles([new File([new Uint8Array(44)], 'Kick Take.wav', { type: 'audio/wav' }), new File([new Uint8Array(55)], 'Vox Take.wav', { type: 'audio/wav' })], 0, 5)`)
ok('the app is asked to bring them in by where they lie', await until(`__asked.some(q => q[0] === 'audioBring')`) && JSON.stringify(await ev(`return __asked.find(q => q[0] === 'audioBring')[1].paths`)) === JSON.stringify(['/Users/x/Desktop/Kick Take.wav', '/Users/x/Desktop/Vox Take.wav']))
ok('nothing goes over in pieces', !(await ev(`return __asked.some(q => q[0] === 'audioPut')`)))
ok('both are on the lanes at once, where they were let go, waiting for their sound', await until(`S.tracks.some(t => t.regs.some(r => r.name === 'vox take'))`) && (await regsOf('kick take'))[0].a === 5 && (await regsOf('kick take'))[0].wait && (await regsOf('vox take'))[0].wait, [await regsOf('kick take'), await regsOf('vox take')])
await ev(`flush()`)
ok('drawn with their names', await ev(`return [...document.querySelectorAll('#g-lanes text')].some(t => t.textContent === 'kick take')`))
ok('nothing waiting is asked how fast it goes', !(await ev(`return __asked.some(q => q[0] === 'tempo')`)))
ok('quick ones bring no card up', !(await ev(`return PRINT.on`)))
await b.sleep(380)
ok('a while: the card says what comes in, and nothing of esc', await ev(`return PRINT.on && /bringing in/.test(document.getElementById('ld-word').textContent) && !/esc/.test(document.getElementById('ld-what').textContent)`), await ev(`return [PRINT.on, document.getElementById('ld-word').textContent, document.getElementById('ld-what').textContent]`))
await ev(`__let('Kick Take.wav')`)
ok('a sound come: its region filled in', await until(`S.tracks.some(t => t.regs.some(r => r.name === 'kick take' && r.key === 'file:Kick Take.wav' && !r.wait && !r.missing))`), await regsOf('kick take'))
ok('…and now asked how fast it goes', await until(`__asked.some(q => q[0] === 'tempo' && q[1].key === 'file:Kick Take.wav')`))
ok('…and played', await until(`__asked.some(q => q[0] === 'session' && (q[1].tracks || []).some(t => (t.regs || []).some(r => r.buf === 'file:Kick Take.wav')))`))
await ev(`__let('Vox Take.wav')`)
ok('all come: the card goes', await until(`!PRINT.on`) && (await regsOf('vox take'))[0].key === 'file:Vox Take.wav')
await ev(`await __p`)
ok('one step to undo it all', await ev(`undoEdit(); flush(); return !S.tracks.some(t => t.regs.some(r => /take$/.test(r.name)))`))

// import audio: the Mac's panel says where they lie, and the same way follows
await ev(`window.__p = importAudio()`)
ok('import audio: picked, placed at once', await until(`S.tracks.some(t => t.regs.some(r => r.name === 'pad long' && r.wait))`), await regsOf('pad long'))
await ev(`undoEdit(); flush()`)
await ev(`__let('Pad Long.wav')`); await ev(`await __p`)
ok('undone before its sound came: nothing comes back, nothing breaks', !(await ev(`return S.tracks.some(t => t.regs.some(r => r.name === 'pad long'))`)) && !(await ev(`return PRINT.on`)))

// a file one could not open, beside one that is fine
await ev(`window.__known = [{ path: '/x/broken.wav', name: 'broken.wav', size: 3 }, { path: '/x/Fine.wav', name: 'Fine.wav', size: 4 }]
  window.__p = dropFiles([new File([new Uint8Array(3)], 'broken.wav', { type: 'audio/wav' }), new File([new Uint8Array(4)], 'Fine.wav', { type: 'audio/wav' })], 0, 9)`)
await until(`__held.has('Fine.wav')`); await ev(`__let('Fine.wav')`); await ev(`await __p`)
ok('one that would not open is said; the other comes in', (await regsOf('fine')).length === 1 && (await regsOf('fine'))[0].key === 'file:Fine.wav' && !(await regsOf('broken')).length, [await regsOf('fine'), await ev(`return S.last`)])

// let go from somewhere that says nothing of where it lies: in pieces, as before
await ev(`window.__known = []; await dropFiles([new File([new Uint8Array(8)], 'From A Browser.wav', { type: 'audio/wav' })], 0, 13)`)
ok('a file whose place is not known still comes over in pieces', await ev(`return __asked.some(q => q[0] === 'audioPut' && q[1].name === 'From A Browser.wav')`) && (await regsOf('from a browser')).length === 1)

{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `bringin: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'bringin: all passed')
process.exit(bad.length ? 1 : 0)
