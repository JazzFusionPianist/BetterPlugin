// node test/folders.mjs — folders among the projects on the start page, with a stand-in for the app behind the page: a
// folder is a row that opens; a project's row is carried onto a folder and is in it, carried back among the others and is
// out again; a new folder is named where it stands; an empty one is taken away; a search lists every project wherever it
// lies. A real pointer and real keys.
import { open, PAGE } from './cdp.mjs'
const APP = `(${(() => {
  const now = Date.now(), day = 86400000
  const mk = (name, ago, dir) => ({ name, key: dir ? '/music/Projects/' + dir + '/' + name + '.sls' : name, dir, modified: now - ago * day })
  const SHELF = [mk('night bus ep', .2), mk('snap', 1), mk('paper boats', 3), mk('kick tests', 9), mk('old demo one', 30, 'demos'), mk('sketch in d', 12, 'sketches')]
  const FOLDERS = ['demos', 'sketches', 'empty one']
  const PREFS = { lastProject: 'snap', elsewhere: [], foldersOpen: [] }
  const ASKED = window.__asked = []
  window.__shelf = SHELF; window.__folders = FOLDERS; window.__prefs = PREFS
  const answer = (op, d) => {
    ASKED.push([op, d ? JSON.parse(JSON.stringify(d)) : null])
    if (op === 'hello') return { ok: true, sr: 48000, block: 256, bits: 24, ins: 2, selftest: '', diskFree: 8 * 1073741824, open: '', inName: 'in', outName: 'out' }
    if (op === 'prefGet') return JSON.parse(JSON.stringify(PREFS))
    if (op === 'prefSet') { PREFS[d.key] = d.value; return { ok: true } }
    if (op === 'projList') return SHELF.map(p => ({ name: p.name, key: p.key, dir: p.dir, modified: p.modified }))
    if (op === 'projFolders') return FOLDERS.map(name => ({ name }))
    if (op === 'projFacts') return SHELF.some(p => p.key === d.name) ? { ok: true, bytes: 5e6, tempo: 100, meter: [4, 4], key: '', tracks: [{ id: 1, name: 'vox 1', kind: 'audio', regs: [1, 9] }] } : { ok: false }
    if (op === 'folderNew') { if (FOLDERS.includes(d.name)) return { ok: false, why: 'there is one of that name' }; FOLDERS.push(d.name); return { ok: true, name: d.name } }
    if (op === 'folderDrop') { if (SHELF.some(p => p.dir === d.name)) return { ok: false, why: 'the folder is not empty' }; FOLDERS.splice(FOLDERS.indexOf(d.name), 1); return { ok: true } }
    if (op === 'projMove') { const p = SHELF.find(q => q.key === d.name); if (!p) return { ok: false, why: 'no such project' }; p.dir = d.to || undefined; p.key = d.to ? '/music/Projects/' + d.to + '/' + p.name + '.sls' : p.name; return { ok: true, key: p.key } }
    if (op === 'projLoad') return { ok: false }
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
process.on('uncaughtException', e => { console.log(out.join('\n')); console.log('THREW', e && e.stack); process.exit(1) })
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const b = await open(PAGE, { width: 1440, height: 872, dsf: 1, before: APP })
for (let i = 0; i < 60 && !(await b.ev(`return typeof START !== 'undefined' && START.on && START.read`)); i++) await b.sleep(100)
const ev = b.ev, SHIFT = 8, CMD = 4
const rows = () => ev(`flush(); return startLay().list.map(p => p.folder != null ? '[' + p.name + ' ' + p.n + (FOLD.open.has(p.folder) ? ' open' : '') + ']' : (p.dir ? '  ' : '') + p.name)`)
const asked = op => ev(`return __asked.filter(q => q[0] === ${JSON.stringify(op)}).map(q => q[1])`)
const rowAt = async name => ev(`flush(); const L = startLay(), i = L.list.findIndex(p => p.name === ${JSON.stringify(name)}); if (i < 0) return null; const el = document.querySelector('[data-a="st-row"][data-i="' + i + '"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { i, x: r.left + 120, y: r.top + r.height / 2, cx: r.left + 18 }`)
const carry = async (name, onto) => { const a = await rowAt(name), z = await rowAt(onto); await b.dragTo(a.x, a.y, z.x + 40, z.y, 8); await b.sleep(150) }
const typed = async text => { for (const ch of text) { const up = ch.toUpperCase(), o = { key: ch, code: /[a-z]/i.test(ch) ? 'Key' + up : ch === ' ' ? 'Space' : 'Digit' + ch, windowsVirtualKeyCode: up.charCodeAt(0) }; await b.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown', text: ch }, o)); await b.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, o)) } await b.sleep(60) }

ok('the room behind is shown again once the page is up', await ev(`return document.getElementById('board').style.visibility !== 'hidden'`))
ok('the folders stand first, by name, each saying how many it holds; closed, their projects are not listed', JSON.stringify(await rows()) === JSON.stringify(['[demos 1]', '[empty one 0]', '[sketches 1]', 'night bus ep', 'snap', 'paper boats', 'kick tests']), await rows())
ok('the count of projects counts projects', await ev(`return document.getElementById('g-start').textContent.includes('projects6') || START.list.length === 6`))
// opened by its mark
{ const r = await rowAt('demos'); await b.click(r.cx, r.y); await b.sleep(80) }
ok('a press on its mark opens it: its project stands under it, set in', (await rows())[1] === '  old demo one' && (await ev(`return FOLD.open.has('demos') && __prefs.foldersOpen.includes('demos')`)), await rows())
ok('set in: its name begins further in than a project\'s that is in no folder', await ev(`const g = document.getElementById('g-start'), xs = name => { const t = [...g.querySelectorAll('text')].find(e => e.textContent === name); return t ? +t.getAttribute('x') : -1 }; return xs('old demo one') > xs('night bus ep') + 10 && xs('night bus ep') === 14`))
// carried in
await carry('paper boats', 'demos')
{ const m = await asked('projMove'), r = await rows()
  ok('a project carried onto a folder is put in it', m.length === 1 && m[0].name === 'paper boats' && m[0].to === 'demos' && r.indexOf('  paper boats') > 0 && r.includes('[demos 2 open]') && !r.includes('paper boats'), [m, r])
  ok('and is the one chosen, known by where it lies now', await ev(`const L = startLay(), p = L.list[START.sel]; return p.name === 'paper boats' && p.dir === 'demos' && p.key === '/music/Projects/demos/paper boats.sls'`)) }
// the one the app remembers as the last worked on goes with its place
await carry('snap', 'sketches')
ok('carried onto a closed folder: it is in it, the folder opens to show it, and what the app remembered by its place goes along', (await rows()).includes('[sketches 2 open]') && (await ev(`return __prefs.lastProject`)) === '/music/Projects/sketches/snap.sls', [await rows(), await ev('return __prefs.lastProject')])
if (process.env.PICS) {                                                                  // pictures for looking at: at rest, and a row in the hand over a folder
  const { writeFileSync } = await import('node:fs')
  const shot = async name => { const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 520, scale: 2 } }); writeFileSync(process.env.PICS + name + '.png', Buffer.from(r.data, 'base64')) }
  await shot('folders 1 at rest')
  const a0 = await rowAt('night bus ep'), z0 = await rowAt('empty one')
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a0.x, y: a0.y, buttons: 0 }); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a0.x, y: a0.y, button: 'left', buttons: 1, clickCount: 1 })
  for (let k = 1; k <= 6; k++) await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a0.x + (z0.x + 60 - a0.x) * k / 6, y: a0.y + (z0.y - a0.y) * k / 6, button: 'left', buttons: 1 })
  await b.sleep(120); await shot('folders 2 a project carried over a folder')
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a0.x, y: a0.y, button: 'left', buttons: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a0.x, y: a0.y, button: 'left', buttons: 0, clickCount: 1 }); await b.sleep(120)
}
// carried onto a project of a folder: into that folder
await carry('kick tests', 'old demo one')
ok('carried onto a project that is in a folder: into that folder', (await rows()).includes('[demos 3 open]') && (await asked('projMove')).slice(-1)[0].to === 'demos', await rows())
// carried out
await carry('paper boats', 'night bus ep')
{ const m = (await asked('projMove')).slice(-1)[0], r = await rows()
  ok('carried among those in no folder: out again', m.name === '/music/Projects/demos/paper boats.sls' && m.to === '' && r.includes('paper boats') && r.includes('[demos 2 open]'), [m, r]) }
// let go where it is: nothing
{ const n0 = (await asked('projMove')).length; await carry('night bus ep', 'paper boats'); ok('let go among its own: nothing is moved', (await asked('projMove')).length === n0) }
// a new folder
{ const k = await ev(`const el = document.querySelector('[data-a="st-folder"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el }`)
  ok('the key for a new folder can be reached', !!k && k.hit)
  await b.click(k.x, k.y); await b.sleep(100)
  ok('pressed: a row at the head of the list, its name being typed', await ev(`return !!FOLD.naming && !FOLD_IN.hidden && document.activeElement === FOLD_IN && FOLD_IN.value === 'untitled folder' && startLay().list[0].naming === true`))
  await typed('ideas'); await b.press('Enter', 'Enter', 13); await b.sleep(150)
  const m = await asked('folderNew'), r = await rows()
  ok('typed and return: the folder is made, stands among the others by name, and is chosen', m.length === 1 && m[0].name === 'ideas' && r.includes('[ideas 0 open]') && (await ev(`return startLay().list[START.sel].folder === 'ideas' && FOLD_IN.hidden && !FOLD.naming`)), [m, r])
  ok('its letters did not wander off to the search or the room', await ev(`return START.find === '' && ST_FIND.value === ''`)) }
await b.press('n', 'KeyN', 78, CMD | SHIFT); await b.sleep(100)
ok('shift command n: a name is being typed again', await ev(`return !!FOLD.naming && document.activeElement === FOLD_IN`))
await b.press('Escape', 'Escape', 27); await b.sleep(100)
ok('escape: let go, nothing is made', (await asked('folderNew')).length === 1 && (await ev(`return !FOLD.naming && FOLD_IN.hidden`)))
// taken away
{ const r = await rowAt('ideas'); await b.click(r.x, r.y); await b.sleep(60); await b.press('Backspace', 'Backspace', 8); await b.sleep(150)
  ok('the delete key on an empty folder takes it away', (await asked('folderDrop')).length === 1 && !(await rows()).some(x => x.startsWith('[ideas')), await rows()) }
{ const r = await rowAt('demos'); await b.click(r.x, r.y); await b.sleep(60); await b.press('Backspace', 'Backspace', 8); await b.sleep(150)
  ok('on one that holds projects it says so and leaves it', (await rows()).some(x => x.startsWith('[demos')) && (await asked('folderDrop')).length === 1 && (await ev(`return S.last && S.last.say`)) === 'the folder is not empty', [await rows(), await ev('return S.last && S.last.say')]) }
// return on a folder closes and opens it
await b.press('Enter', 'Enter', 13); await b.sleep(80)
ok('return on a folder closes it', (await rows()).includes('[demos 2]'), await rows())
await b.press('Enter', 'Enter', 13); await b.sleep(80)
ok('and opens it', (await rows()).includes('[demos 2 open]'))
ok('no project was opened by any of this', (await asked('projLoad')).length === 0)
// looked for by name
await typed('old'); await b.sleep(120)
ok('looked for by name: every project that matches, wherever it lies, and where that is', JSON.stringify(await rows()) === JSON.stringify(['  old demo one']) && (await ev(`return document.getElementById('g-start').textContent.includes('demos')`)), await rows())
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
const pic = await b.send('Page.captureScreenshot', { format: 'png' })
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
