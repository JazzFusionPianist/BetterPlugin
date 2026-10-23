// node test/pointers.mjs — every tool a pointer of its own (his ask, 2026-10-23: "각 툴마다 마우스 포인터 모양이 다 달랐으면
// 좋겠어"; design/tool pointers draft 1, his OK the same day): each is drawn, each differs from the others, each lands a press
// where the draft's red cross is; over an empty lane a tool shows its own, the pointer tool takes the smart tool's grab and
// trim over a region, a volume line (a track's, or the stereo out's) shows the point unless the tool is the pencil or the
// eraser, the velocity tool keeps its own on the lanes, and the notes page shows them on its paper and its notes.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const TOOLS = ['pointer', 'smart', 'pencil', 'eraser', 'scissors', 'join', 'mute', 'gain', 'fade', 'marquee', 'flex', 'zoom', 'velocity']
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.rh = 40; for (const t of S.tracks) delete t.h; VY = 0; S.auto = false; S.selR = []; S.flex = false; setZoom(0); flush()
  window.__norm = c => { const d = document.createElement('div'); d.style.cursor = c; return d.style.cursor }      // (the browser writes a pointer back in its own words)
  window.__which = c => Object.keys(TOOL_CURSOR).find(k => __norm(TOOL_CURSOR[k]) === c) || Object.keys(SMART_CURSOR).map(k => 'smart ' + k).find(k => __norm(SMART_CURSOR[k.slice(6)]) === c) || '?'
  return 1`)

/* drawn, and each its own */
{ const r = await ev(`const ks = Object.keys(TOOL_CURSOR); return { ks, drawn: ks.filter(k => /url\\(data:image\\/png/.test(TOOL_CURSOR[k])), distinct: new Set(ks.map(k => TOOL_CURSOR[k])).size, vars: ks.filter(k => getComputedStyle(document.documentElement).getPropertyValue('--cur-' + k).includes('data:image')).length }`)
  ok('a pointer for each of the 13 tools, and one for a line', TOOLS.every(k => r.ks.includes(k)) && r.ks.includes('point') && r.ks.length === 14, r.ks)
  ok('every one of them drawn, none the system\'s', r.drawn.length === 14, r.drawn.length)
  ok('no two alike', r.distinct === 14, r.distinct)
  ok('each is a css variable too, for the notes page', r.vars === 14, r.vars)
  const hot = await ev(`const at = k => { const m = TOOL_CURSOR[k].match(/\\) (\\d+) (\\d+), /); return m ? [+m[1], +m[2]] : null }; return { pencil: at('pencil'), pointer: at('pointer'), scissors: at('scissors'), zoom: at('zoom') }`)
  ok('a press lands where the draft says: the pencil at its tip, the arrow at its point, the scissors at their blades, the lens at its middle', JSON.stringify(hot) === JSON.stringify({ pencil: [4, 20], pointer: [5, 4], scissors: [12, 3], zoom: [10, 10] }), hot) }

/* what a pointer shows where it hovers */
const at = await ev(`const vis = rows(), ti = vis.find(i => S.tracks[i].kind === 'audio' && S.tracks[i].regs.length > 0); const t = S.tracks[ti], r = t.regs.slice().sort((p, q) => p.a - q.a)[0]
  const y = rowY(ti) + rowH(ti) * .7, gap = Math.max(...t.regs.map(q => q.b)) + .5
  return { ti, y, mid: bx(r.a + (r.b - r.a) / 2), end: bx(r.b) - 2, empty: bx(Math.min(SONG_END - .2, gap)), emptyOk: gap < SONG_END - .3 }`)
const hover = async (x, y) => { await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 }); await b.sleep(30); return ev(`const el = document.elementFromPoint(${x}, ${y}); const ln = el && el.closest('[data-a="lanes"]'); return ln ? ln.style.cursor : null`) }
const is = (c, k) => ev(`return ${JSON.stringify(c)} === __norm(TOOL_CURSOR[${JSON.stringify(k)}])`)
const which = c => ev(`return __which(${JSON.stringify(c)})`)
if (!at.emptyOk) ok('there is an empty stretch of lane to hover', false, at)
else {
  const seen = {}
  for (const k of TOOLS) { await ev(`S.tool = '${k}'; flush(); return 1`); seen[k] = await is(await hover(at.empty, at.y), k) }
  ok('over an empty lane, each tool shows its own', Object.values(seen).every(Boolean), seen)
}
await ev(`S.tool = 'pointer'; flush(); return 1`)
{ const w = await which(await hover(at.mid, at.y)); ok('the pointer tool over a region: the smart tool\'s grab', w === 'smart grab', w) }
{ const w = await which(await hover(at.end, at.y)); ok('…and at its end: the trim', w === 'smart tl' || w === 'smart tr', w) }
await ev(`S.tool = 'smart'; flush(); return 1`)
{ const w = await which(await hover(at.mid, at.y)); ok('the smart tool in a region: the zone\'s own, as before', w.startsWith('smart '), w) }
await ev(`S.tool = 'velocity'; flush(); return 1`)
ok('the velocity tool on the lanes: its own, though a press there is the gain\'s', await is(await hover(at.mid, at.y), 'velocity'))

/* on a volume line */
{ await ev(`S.auto = true; flush(); return 1`)
  const r = {}
  for (const k of ['pencil', 'eraser', 'gain', 'pointer', 'zoom']) { await ev(`S.tool = '${k}'; flush(); return 1`); r[k] = await which(await hover(at.mid, at.y)) }
  ok('with the lines shown: the pencil and the eraser their own, the zoom its own, the others the point', r.pencil === 'pencil' && r.eraser === 'eraser' && r.gain === 'point' && r.pointer === 'point' && r.zoom === 'zoom', r)
  await ev(`S.auto = false; flush(); return 1`) }
{ const o = await ev(`OUT.autos = {}; S.master = -6; flush(); const g = document.querySelector('#ln-out rect'); if (!g) return null; const q = g.getBoundingClientRect(), gm = autoGeom(OUT, outRowY(), outRowH()); return { x: q.x + q.width / 2, y: gm.yOf(S.master), y2: q.y + 2 }`)
  if (!o) ok('the stereo out has a row', false)
  else {
    await ev(`S.tool = 'gain'; flush(); return 1`)
    ok("on the stereo out's line: the point", await is(await hover(o.x, o.y), 'point'))
    ok("…and off it, on its row: the tool's own", await is(await hover(o.x, o.y2 + (o.y > o.y2 + 12 ? 0 : 20)), 'gain'))
  } }

/* the notes page */
{ const r = await ev(`const t = newInstTrack('synth', 'e piano'); t.regs = [mkReg({ a: 1, b: 3, loop: false, notes: [mkNote(0, 1, 60, 100), mkNote(1, 1, 64, 90)] })]; S.sel = S.tracks.indexOf(t); S.selR = [t.regs[0].id]; S.tool = 'pencil'; rollOpen(); S.panel.h = Math.max(S.panel.h || 0, 320); setView(true); dirtyAll(); flush()
    const paper = document.querySelector('[data-a="np"][data-k="paper"]'), note = document.querySelector('[data-a="np"][data-k="note"]')
    const one = { paper: paper && paper.style.cursor, note: note && note.style.cursor }
    S.tool = 'eraser'; dirtyAll(); flush()
    const n2 = document.querySelector('[data-a="np"][data-k="note"]'), p2 = document.querySelector('[data-a="np"][data-k="paper"]')
    return { one, eraser: { note: n2 && n2.style.cursor, paper: p2 && p2.style.cursor } }`)
  if (!r) ok('there is a track of notes to open', false)
  else {
    ok('the notes page: the pencil on its paper, the grab on a note', r.one.paper === 'var(--cur-pencil)' && (!r.one.note || r.one.note === 'var(--cur-grab)'), r.one)
    ok('…the eraser its own on both', r.eraser.paper === 'var(--cur-eraser)' && (!r.eraser.note || r.eraser.note === 'var(--cur-eraser)'), r.eraser)
  } }

ok('no errors on the page', !b.errors.length, b.errors.slice(0, 3))
console.log(out.join('\n'))
console.log(bad.length ? `\n${bad.length} failed` : '\nall passed')
await b.close()
process.exit(bad.length ? 1 : 0)
