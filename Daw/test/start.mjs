// node test/start.mjs [width height] — the start page, with a stand-in for the app behind the page: it comes up instead of
// a project, nothing is written while it is up, the room's keys do not reach through it, a project opens from it (a press
// twice, return), a new one begins as the chosen template with the numbers typed, the list narrows as a name is typed,
// and a project whose disk is not connected stays where it is. Pictures go to test/out.
import { open, PAGE } from './cdp.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
const WW = +process.argv[2] || 1440, HH = +process.argv[3] || 872
/* the app, as far as the page asks it anything: a shelf of projects (made up, the way the draft's were), and a note of every question */
const APP = `(${(() => {
  const rnd = (i, seed) => { let h = Math.imul((i | 0) ^ (seed * 374761393), 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296 }
  const day = 86400000, d0 = new Date(), mid = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime()
  const LIST = [
    ['night bus ep', -.4, 102, [4, 4], 'a min', 120, [['drums', 9, .9, 1], ['bass', 2, .9, 1], ['keys', 3, .6], ['gtr', 3, .5, 2], ['vox', 5, .7, 1], ['fx', 2, .6]], 1.9e9],
    ['snap', 1, 102, [4, 4], '', 42, [['gtr', 2, .92], ['vox', 1, .8, 1]], 212e6],
    ['paper boats', 3, 84, [4, 4], 'd maj', 72, [['drums', 4, .82, 1], ['bass', 1, .86, 1], ['keys', 2, .7], ['gtr', 3, .6, 1], ['vox', 4, .7, 1]], 640e6],
    ['paper boats, strings idea', 3.1, 84, [4, 4], 'd maj', 24, [['keys', 5, .8], ['vox', 1, .6]], 96e6],
    ['wedding song for hana', 7, 72, [6, 8], 'g maj', 150, [['keys', 2, .92], ['gtr', 2, .7, 1], ['bass', 1, .6, 2], ['vox', 3, .75, 1], ['fx', 1, .5]], 410e6],
    ['bridge idea, late', 9, 120, [4, 4], '', 22, [['gtr', 1, 1], ['vox', 1, .8]], 38e6],
    ['slow one in d', 12, 66, [4, 4], 'd min', 83, [['drums', 3, .7, 2], ['bass', 1, .8, 1], ['keys', 3, .82], ['vox', 3, .7, 1], ['fx', 1, .5]], 780e6],
    ['veloso live, mix', 16, 96, [4, 4], '', 152, [['drums', 10, .97], ['bass', 2, .97], ['keys', 4, .9], ['gtr', 6, .9], ['vox', 8, .85], ['fx', 2, .6]], 4.1e9, '/Volumes/sessions ssd/veloso live, mix.sls'],
    ['untitled 3', 21, 120, [4, 4], '', 9, [['vox', 1, 1]], 6e6],
    ['minseo demo 2', 26, 92, [4, 4], 'e min', 70, [['drums', 2, .8, 1], ['bass', 1, .8, 1], ['keys', 2, .8], ['vox', 3, .7, 1]], 350e6],
    ['blue in green, cover', 31, 58, [4, 4], '', 70, [['drums', 2, .8, 1], ['bass', 1, .9, 1], ['keys', 2, .95]], 520e6],
    ['kick tests', 38, 120, [4, 4], '', 26, [['drums', 4, 1]], 44e6],
    ['jun’s guitars', 41, 110, [4, 4], 'a maj', 99, [['gtr', 7, .75]], 690e6, '/Users/steven/Desktop/jun’s guitars.sls'],
    ['the long drive', 49, 128, [4, 4], 'f# min', 125, [['drums', 6, .85, 1], ['bass', 2, .85, 1], ['keys', 5, .7], ['gtr', 3, .6, 2], ['vox', 5, .7, 1], ['fx', 1, .6]], 1.4e9],
    ['voice memos, sorted', 56, 120, [4, 4], '', 181, [['vox', 12, .32]], 300e6],
    ['old piano thing', 68, 76, [4, 4], 'c maj', 44, [['keys', 2, 1], ['vox', 1, .5, 1]], 120e6],
    ['the long drive, radio edit', 71, 128, [4, 4], 'f# min', 104, [['drums', 6, .85, 1], ['bass', 2, .85, 1], ['keys', 5, .7], ['gtr', 3, .6, 2], ['vox', 5, .7, 1]], 1.1e9],
    ['summer set rehearsal', 75, 100, [4, 4], '', 170, [['drums', 8, .95], ['bass', 1, .95], ['keys', 2, .9], ['gtr', 2, .9], ['vox', 3, .8]], 2.6e9],
    ['strings for hana', 78, 72, [6, 8], 'g maj', 96, [['keys', 6, .8]], 88e6],
    ['mic shootout', 82, 120, [4, 4], '', 30, [['vox', 6, 1]], 140e6],
    ['first take', 400, 84, [4, 4], 'd maj', 70, [['gtr', 1, 1], ['vox', 1, .9]], 110e6],
  ]
  const GONE = '/Volumes/sessions two/church set sept.sls'
  const tracksOf = (seed, bars, parts) => {
    const secs = []
    for (let b = 1, i = 0; b < bars + 1; i++) { const len = [4, 8, 8, 16, 8][Math.floor(rnd(i, seed) * 5)]; secs.push([b, Math.min(bars + 1, b + len)]); b += len }
    const out = []
    let id = 0
    parts.forEach(([g, cnt, dens, from = 0], pi) => { for (let k = 0; k < cnt; k++) {
      const regs = []
      secs.forEach(([a, e], si) => {
        if (si < from || rnd(si * 31 + (g === 'drums' || g === 'bass' ? 0 : k * 7) + pi * 101, seed + 3) > dens) return
        if (g === 'vox') { for (let p = a; p < e; p += 4) if (rnd(p * 3 + k, seed + 9) > .28) regs.push(p + (rnd(p, seed + k) > .5 ? 0 : .5), Math.min(e, p + 3.4)) }
        else if (g === 'fx') regs.push(Math.max(1, a - 2), Math.min(e, a + 1.5))
        else regs.push(a, e)
      })
      out.push({ id: ++id, name: `${g} ${k + 1}`, kind: 'audio', regs })
    } })
    if (out.length > 2) out.push({ id: ++id, name: 'plate', kind: 'bus', regs: [] })
    return out
  }
  const SHELF = new Map(LIST.map(([name, ago, tempo, meter, key, bars, parts, bytes, at], i) => [at || name, { name, key: at || name, in: at ? at.split('/').slice(-2, -1)[0] : undefined, modified: Math.round(mid + 14.5 * 3600000 - ago * day), tempo, meter, keyOf: key, bytes, tracks: tracksOf(i * 13 + 5, bars, parts) }]))
  const patch = () => ({ A: { tape: 0, space: 0, delay: 0, share: 62 }, B: { tape: 0, space: 0, delay: 0, share: 62 }, x: 0 })
  const ASKED = window.__asked = []
  const SAVED = window.__saved = new Map()
  const answer = (op, d) => {
    ASKED.push([op, d && (d.name || d.key || d.text) || ''])
    if (op === 'hello') return { ok: true, sr: 48000, block: 256, bits: 24, ins: 2, selftest: '', diskFree: 8.0 * 1073741824, open: '', inName: 'MacBook Pro Microphone', outName: 'MacBook Pro Speakers' }
    if (op === 'prefGet') return { lastProject: 'snap', elsewhere: [...SHELF.keys()].filter(k => k[0] === '/').concat([GONE]) }
    if (op === 'projList') return [...SHELF.values()].concat([...SAVED.keys()].filter(k => !SHELF.has(k)).map(k => ({ name: k, key: k, modified: Date.now() }))).map(p => ({ name: p.name, key: p.key, in: p.in, modified: p.modified }))
    if (op === 'projFacts') { const p = SHELF.get(d.name); if (!p) return d.name === GONE ? { ok: false, gone: 'sessions two' } : { ok: false }; return { ok: true, bytes: p.bytes, tempo: p.tempo, meter: p.meter, key: p.keyOf, tracks: p.tracks } }
    if (op === 'projLoad') { const p = SHELF.get(d.name); if (SAVED.has(d.name)) return { ok: true, json: SAVED.get(d.name), saved: Date.now() }; if (!p) return { ok: false }; return { ok: true, saved: p.modified, json: JSON.stringify({ v: 3, name: p.name, demo: false, tempo: p.tempo, meter: p.meter, key: p.keyOf, end: 64, scenes: [], tracks: p.tracks.map(t => ({ id: t.id, name: t.name, kind: t.kind, vol: 0, pan: 0, regs: [], patch: patch(), inserts: [] })) }) } }
    if (op === 'projSave') { SAVED.set(d.name, d.json); return { ok: true } }
    if (op === 'distrust' || op === 'audioList' || op === 'takesLeft' || op === 'projBackups' || op === 'plugins') return []
    if (op === 'badEnds' || op === 'pluginStates') return null
    return { ok: true }
  }
  const hear = new Map()
  window.__JUCE__ = { initialisationData: { __juce__functions: ['daw'] }, backend: {
    addEventListener: (ev, fn) => { if (!hear.has(ev)) hear.set(ev, []); hear.get(ev).push(fn) },
    emitEvent: (name, p) => { if (name !== '__juce__invoke') return; const result = answer(p.params[0], p.params[1]); setTimeout(() => { for (const fn of hear.get('__juce__complete') || []) fn({ promiseId: p.resultId, result }) }, 0) },
  } }
  window.__tell = (ev, d) => { for (const fn of hear.get(ev) || []) fn(d) }
}).toString()})()`
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
mkdirSync(new URL('./out', import.meta.url), { recursive: true })
const CMD = 4
const fresh = async () => { const b = await open(PAGE, { width: WW, height: HH, dsf: 2, before: APP }); for (let i = 0; i < 60 && !(await b.ev(`return typeof START !== 'undefined' && START.on && START.read`)); i++) await b.sleep(100); return b }
const shot = async (b, name) => { const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(new URL(`./out/start-${name}${WW === 1440 ? '' : '-' + WW}.png`, import.meta.url), Buffer.from(r.data, 'base64')) }
const press = async (b, k, code, vk, mods = 0) => { await b.press(k, code, vk, mods); await b.sleep(60) }
const away = async b => { for (let i = 0; i < 100 && (await b.ev(`return START.on || !!START.busy || PROJ.hold > 0`)); i++) await b.sleep(100); await b.sleep(150) }      // a project opening or being made: until the page is gone and nothing is held any more
const asked = (b, op) => b.ev(`return __asked.filter(q => q[0] === ${JSON.stringify(op)}).map(q => q[1])`)
const centre = (b, sel) => b.ev(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y); return { x, y, hit: top === el }`)
const typed = async (b, text) => { for (const ch of text) { const up = ch.toUpperCase(), o = { key: ch, code: /[a-z]/i.test(ch) ? 'Key' + up : ch === ' ' ? 'Space' : 'Digit' + ch, windowsVirtualKeyCode: up.charCodeAt(0) }; await b.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown', text: ch }, o)); await b.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, o)) } await b.sleep(80) }      // keys as a hand presses them: down, the letter, up
const click = async (b, sel) => { const p = await centre(b, sel); if (!p || !p.hit) { ok(`${sel} can be pressed`, false, p); return } await b.click(p.x, p.y); await b.sleep(60) }

// ── it comes up instead of a project, and nothing behind it is touched ──
let b = await fresh()
ok('the page is up when the app opens, with every project the app knows', await b.ev(`return START.on && START.list.length === 22 && document.getElementById('g-start').childElementCount > 0`), await b.ev('return [START.on, START.list.length]'))
ok('no project was opened for it', (await asked(b, 'projLoad')).length === 0, await asked(b, 'projLoad'))
ok('the last worked on is first, and chosen', await b.ev(`return START.list[0].name === 'night bus ep' && START.sel === 0`))
ok('one kept somewhere else says where; one whose disk is away stays, said so', await b.ev(`const v = START.list.find(p => p.name === 'veloso live, mix'), g = START.list.find(p => p.gone); return v.in === 'sessions ssd' && !!g && g.name === 'church set sept' && g.gone === 'sessions two'`))
ok('every project was read into numbers and lanes', await b.ev(`return START.list.filter(p => !p.gone).every(p => p.f && p.f.count > 0 && p.f.len > 0 && p.f.lanes.length > 0)`))
ok('the command line is put away, and the window keeps the name it was born with', await b.ev(`return getComputedStyle(document.getElementById('cmd')).display === 'none'`) && (await asked(b, 'title')).length === 0, await asked(b, 'title'))
await shot(b, '1-rest')
await b.sleep(3600)                                                                                        // the quiet save comes round every three seconds
ok('nothing is written while the page is up', (await asked(b, 'projSave')).length === 0, await asked(b, 'projSave'))
await press(b, ' ', 'Space', 32); await press(b, 'b', 'KeyB', 66); await press(b, 'r', 'KeyR', 82)
ok('the room’s keys do not reach through it', await b.ev(`return !S.playing && !S.rec && !S.panel.on || !S.playing && !S.rec`), await b.ev('return [S.playing, !!S.rec]'))
await b.ev(`ST_FIND.value = ''; START.find = ''; ST_FIND.blur()`)

// ── the arrows, return ──
await press(b, 'ArrowDown', 'ArrowDown', 40); await press(b, 'ArrowDown', 'ArrowDown', 40)
ok('the arrows walk the list', await b.ev(`return START.sel === 2 && START.focus === 'list'`), await b.ev('return START.sel'))
await press(b, 'Enter', 'Enter', 13); await away(b)
ok('return opens the chosen project, and the room is the page again', await b.ev(`return !START.on && PROJ.name === 'paper boats' && S.tempo === 84 && document.getElementById('g-start').childElementCount === 0 && getComputedStyle(document.getElementById('cmd')).display !== 'none'`), await b.ev('return [START.on, PROJ.name, S.tempo]'))
ok('the window is named after it', (await asked(b, 'title')).pop() === 'paper boats')
await b.sleep(3400)
ok('with a project open the quiet save writes into that project and no other', (await asked(b, 'projSave')).every(n => n === 'paper boats'), await asked(b, 'projSave'))
await b.close()

// ── a press twice; the project that is called what the song standing in is called ──
b = await fresh()
await click(b, '[data-a="st-row"][data-i="4"]')
ok('a press chooses a row', await b.ev(`return START.sel === 4 && START.on`))
{ const p = await centre(b, '[data-a="st-row"][data-i="0"]'); await b.click(p.x, p.y); await b.click(p.x, p.y); await away(b) }
ok('a press twice opens it — the one named like the song the app is born with too', await b.ev(`return !START.on && PROJ.name === 'night bus ep' && S.tempo === 102 && !PROJ.demo`), await b.ev('return [START.on, PROJ.name, S.tempo, PROJ.demo]'))
await b.close()

// ── a name typed narrows the list; a project whose disk is away does not open ──
b = await fresh()
await typed(b, 'pa')
ok('letters land in the box and narrow the list', await b.ev(`return document.activeElement === ST_FIND && START.find === 'pa' && startShown().map(p => p.name).join('|') === 'paper boats|paper boats, strings idea'`), await b.ev(`return [START.find, startShown().map(p => p.name)]`))
await shot(b, '2-find')
await press(b, 'ArrowDown', 'ArrowDown', 40)
ok('the arrows still walk what is left', await b.ev(`return START.sel === 1`))
await press(b, 'Escape', 'Escape', 27)
ok('escape empties the box', await b.ev(`return START.find === '' && startShown().length === 22`))
await b.ev(`START.sel = START.list.findIndex(p => p.gone); uiDirty('start')`); await b.sleep(80)
await press(b, 'Enter', 'Enter', 13); await b.sleep(200)
ok('a project whose disk is not connected stays shut', await b.ev(`return START.on`) && (await asked(b, 'projLoad')).length === 0)
ok('and has no key to open it with', await b.ev(`return !document.querySelector('[data-a="st-open"]')`))

// ── a new project: the template, the numbers, command n ──
await click(b, '[data-a="st-tpl"][data-i="2"]')
ok('a press on a template chooses it, and return would now make it', await b.ev(`return START.tpl === 2 && START.focus === 'band'`))
await click(b, '[data-a="st-tempo"]'); await typed(b, '96'); await press(b, 'Enter', 'Enter', 13)
ok('a tempo typed is taken', await b.ev(`return START.num.tempo === 96 && ST_TYPE.hidden`), await b.ev('return START.num.tempo'))
await click(b, '[data-a="st-meter"]')
ok('the measure opens its list over the page', await b.ev(`return !!S.menu && S.menu.items.length === MEASURES.length`))
await click(b, '[data-a="pick"][data-i="8"]')
ok('and takes what is picked', await b.ev(`return !S.menu && START.num.meter.join('/') === '6/8'`), await b.ev('return START.num.meter'))
await click(b, '[data-a="st-key"]'); await typed(b, 'G Maj'); await press(b, 'Enter', 'Enter', 13)
ok('a key typed is taken, small', await b.ev(`return START.num.key === 'g maj'`), await b.ev('return START.num.key'))
await shot(b, '3-band')
await press(b, 'n', 'KeyN', 78, CMD); await away(b)
ok('command n makes it: the template’s tracks, the numbers typed', await b.ev(`return !START.on && PROJ.name === 'untitled' && S.tracks.map(t => t.name).join('|') === 'drums|bass|keys|guitar left|guitar right|lead vox|backing vox|plate' && S.tempo === 96 && S.meter.join('/') === '6/8' && S.key === 'g maj'`), await b.ev(`return [START.on, PROJ.name, S.tracks.map(t => t.name), S.tempo, S.meter, S.key]`))
ok('its voices send to the plate, and the plate holds a space', await b.ev(`const p = S.tracks.find(t => t.name === 'plate'), v = S.tracks.filter(t => /vox/.test(t.name)); return p.kind === 'bus' && patchNow(p).space > 0 && v.length === 2 && v.every(t => t.sends.length === 1 && t.sends[0].to === p.id) && S.tracks.filter(t => !/vox/.test(t.name)).every(t => !t.sends.length)`))
ok('it is saved as it begins, under a name of its own, and there is nothing to undo', await b.ev(`const d = JSON.parse(__saved.get('untitled')); return d.tracks.length === 8 && d.tempo === 96 && UNDO.length === 0`) && (await asked(b, 'projSave')).every(n => n === 'untitled'), await asked(b, 'projSave'))
await shot(b, '4-made')
await b.close()

// ── return on the band; an empty shelf ──
b = await fresh()
await press(b, 'ArrowRight', 'ArrowRight', 39)
ok('the side arrows walk the templates', await b.ev(`return START.tpl === 1 && START.focus === 'band'`))
await press(b, 'Enter', 'Enter', 13); await away(b)
ok('return on a template makes the project', await b.ev(`return !START.on && S.tracks.map(t => t.name).join('|') === 'vox|vox double|guitar|guitar 2|plate|slap' && S.tempo === 120 && S.meter.join('/') === '4/4'`), await b.ev(`return [START.on, S.tracks.map(t => t.name), S.tempo]`))
ok('each track painted by its name', await b.ev(`return S.tracks.slice(0, 4).map(t => t.fam).join('|') === 'vox|vox|gtr|gtr'`), await b.ev(`return S.tracks.map(t => t.fam)`))
await b.close()
b = await fresh()
await click(b, '[data-a="st-tpl"][data-i="3"]'); await press(b, 'Enter', 'Enter', 13); await away(b)
ok('a template with instruments: tracks of notes where the app has them, plain tracks where it has not', await b.ev(`const notes = canNotes(), head = S.tracks.slice(0, 4); return !START.on && S.tracks.map(t => t.name).join('|') === 'kit|bass|keys|pad|lead vox|plate' && head.every(t => !!t.inst === notes) && !S.tracks[4].inst && (!notes || head[0].inst.kind === 'drums')`), await b.ev(`return [canNotes(), S.tracks.map(t => [t.name, t.kind, t.inst ? t.inst.kind : ''])]`))
ok('and nothing went wrong making it', b.errors.length === 0, b.errors)
await b.close()
b = await open(PAGE, { width: WW, height: HH, dsf: 2, before: APP.replace('const SHELF = new Map(LIST.map(', 'const SHELF = new Map([].map(').replace('.concat([GONE]) }', ' }') })
for (let i = 0; i < 40 && !(await b.ev(`return typeof START !== 'undefined' && START.on && START.read`)); i++) await b.sleep(100)
ok('the first time, with nothing saved yet: the page, an empty list, and return makes a project', await b.ev(`return START.on && START.list.length === 0 && ST_FIND.hidden`))
await shot(b, '5-first')
await press(b, 'Enter', 'Enter', 13); await away(b)
ok('an empty project: one track, as before', await b.ev(`return !START.on && PROJ.name === 'untitled' && S.tracks.length === 1 && S.tempo === 120`), await b.ev(`return [START.on, PROJ.name, S.tracks.length, S.tempo]`))
ok('nothing went wrong on the page', b.errors.length === 0, b.errors)
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `FAILED: ${bad.join(' | ')}` : 'start: all passed')
process.exit(bad.length ? 1 : 0)
