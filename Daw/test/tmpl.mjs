// node test/tmpl.mjs — the head as a template (ui/tmpl.js): drawn from its document, part by part.
//   1 the head as it comes (TMPL_HEAD0) draws the same string as headRow — every demo track and more (a bus, a stack
//     open and closed, a track in a stack and one two deep, their track, frozen, an alternative, a group, a ghost,
//     automation on, rows pulled taller), in every state (chosen, several chosen, armed, listening, muted, soloed, a
//     long name, the number off, names larger), at every height from 8 to 120;
//   2 a part moved in the template moves in the drawing: the level, the cells, the name's line, the mark;
//   3 a theme kept as one's own keeps its template (display.js clean).
import { open, PAGE } from './cdp.mjs'
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const b = await open(PAGE, { width: 1728, height: 1117, dsf: 1 })
await b.sleep(600)
await b.ev(`if (typeof START !== 'undefined') START.on = false; S.rh = 36; setZoom(26, 0); VX = 0; VY = 0; S.panel.on = false; INSP.on = false; tpanelSet(true, false); setView(true); dirtyAll(); flush(); return 1`)
/* the room peopled: a bus, a stack with two tracks (one of them a stack of its own with a track), their track, frozen, an alternative, a group */
const made = await b.ev(`
  const n0 = S.tracks.length
  const bus = addTrack ? addTrack('bus') : null
  const t = S.tracks
  t[5].name = 'a name so long it must be cut short and then some'; t[6].theirs = 'jun'; t[7].frozen = { sig: 'x' }
  t[2].alts = [{ name: 'take 2', regs: [] }]; t[2].alt = 'take 2'
  chooseTrack(0); chooseTrack(1, 'toggle'); grpMake(); grpClose()
  chooseTrack(3); chooseTrack(4, 'toggle'); const st = typeof stackChosen === 'function' ? stackChosen() : (typeof makeStack === 'function' ? makeStack() : null)
  t.find(x => x.kind === 'audio' && !x.parent && !x.grp && x !== t[5]).ghost = -3
  chooseTrack(1); S.selT = []
  dirtyAll(); flush()
  return { n0, n: S.tracks.length, kinds: S.tracks.map(x => x.kind + (x.parent ? '<' : '')), stack: !!st, bus: !!bus }`)
ok('the room peopled: a bus, a stack, a group, their track, frozen, an alternative', made.n > made.n0 && made.kinds.some(k => k === 'stack') && made.kinds.some(k => k.endsWith('<')), made)
/* the head drawn by headRow and by the template, the template put on and taken off between: the same string */
const SAME = `
  const rows = S.tracks.map((t, i) => i), res = { same: 0, differ: [] }
  for (const rh of [8, 9, 12, 16, 17, 20, 24, 30, 35, 36, 40, 50, 72, 120]) {
    S.rh = rh; for (const t of S.tracks) { delete t.h; delete t.hNow }
    if (rh === 50) S.tracks[0].h = 64                                              // (one row pulled taller than the rest)
    relayout(); dirtyAll(); flush()
    for (const i of rows) {
      applyLook(Object.assign({}, LOOK, { 'tmpl.head': null })); delete LOOK['tmpl.head']; const a = headRow(i)
      applyLook(Object.assign({}, LOOK, { 'tmpl.head': JSON.stringify(TMPL_HEAD0) })); const c = headRow(i)
      if (a === c) res.same++; else { const k = [...a].findIndex((ch, j) => ch !== c[j]); res.differ.push({ rh, i, kind: S.tracks[i].kind, at: k, was: a.slice(Math.max(0, k - 60), k + 60), now: c.slice(Math.max(0, k - 60), k + 60) }) }
    }
  }
  applyLook(Object.assign({}, LOOK, { 'tmpl.head': null })); delete LOOK['tmpl.head']; S.rh = 36; for (const t of S.tracks) delete t.h; relayout(); dirtyAll(); flush()
  return { same: res.same, differ: res.differ.slice(0, 4), n: res.differ.length }`
for (const [name, set] of [
  ['as it comes', ''],
  ['several chosen, one armed, one listening, one muted, one soloed', 'chooseTrack(0); chooseTrack(2, "toggle"); S.tracks[1].arm = true; S.tracks[1].mon = true; S.tracks[2].mute = true; S.tracks[3].solo = true'],
  ['the number off, names larger', 'applyLook(Object.assign({}, LOOK, { "heads.num": "off", "heads.size": 13, "heads.mark": 6 }))'],
  ['automation on, one track with a line drawn', 'applyLook({}); S.auto = true; S.tracks[1].autos = { vol: [{ b: 0, v: -6 }, { b: 8, v: -3 }] }'],
  ['the stack closed', 'S.auto = false; for (const t of S.tracks) if (t.kind === "stack") t.open = false'],
]) {
  if (set) await b.ev(set + '; dirtyAll(); flush(); return 1')
  const r = await b.ev(SAME)
  ok(`the template draws what headRow draws — ${name}: ${r.same} heads at 14 heights`, r.n === 0 && r.same > 100, r.n ? r : undefined)
}
/* 2 a part moved: the level further left and wider, the cells further in, the name's line higher, the mark at the edge */
await b.ev(`for (const t of S.tracks) if (t.kind === 'stack') t.open = true; chooseTrack(1); S.selT = []; S.rh = 30; relayout(); dirtyAll(); flush(); return 1`)      // (30: the one-line layout, 17 up to 36)
const moved = await b.ev(`
  const doc = JSON.parse(JSON.stringify(TMPL_HEAD0)), lay = doc.layouts[1], part = is => lay.parts.find(p => p.is === is)
  part('level').x = 100; part('level').w = 60; part('level').reads.x = 170; part('cells').right = 30; part('name').y = { a: -2, k: .5 }; part('mark').x = 0
  applyLook(Object.assign({}, LOOK, { 'tmpl.head': JSON.stringify(doc) })); dirtyAll(); flush()
  const i = 0, el = document.querySelector('#g-head [data-a="vol"][data-i="' + i + '"]'), cell = document.querySelector('#g-head [data-a="mute"][data-i="' + i + '"]')
  const mt = document.getElementById('mt-' + S.tracks[i].id) || document.getElementById('mt-' + S.tracks[i].id + '-0')
  const r = { gx: +el.dataset.gx, gw: +el.dataset.gw, meterX: mt && +mt.getAttribute('x'), meterW: mt && +mt.getAttribute('data-w'), cellX: +cell.getAttribute('x'), cellsRight: HEAD_W - 30 - squaresW(cellsOf(S.tracks[i]).length, 14) }
  const name = [...document.querySelectorAll('#hd-' + i + ' text')].find(t => t.textContent === S.tracks[i].name), num = [...document.querySelectorAll('#hd-' + i + ' text')].find(t => t.textContent === '01')
  r.nameY = name && +name.getAttribute('y'); r.rowY = rowY(i); r.numY = num && +num.getAttribute('y')
  const mark = document.querySelector('#hd-' + i + ' rect[fill="' + S.tracks[i].c + '"]'); r.markX = mark && +mark.getAttribute('x')
  applyLook(Object.assign({}, LOOK, { 'tmpl.head': null })); delete LOOK['tmpl.head']; dirtyAll(); flush()
  return r`)
ok('the level moved to 100 and widened to 60: its press and its meter say so', moved.gx === 100 && moved.gw === 60 && moved.meterX === 100 && moved.meterW === 60, moved)
ok('the cells further in by 20: the mute cell (the third) stands where the template says', Math.abs(moved.cellX - (moved.cellsRight + 2 * 16)) < .3, moved)
ok('the name\'s line higher: its baseline at the row\'s middle less 2', Math.abs(moved.nameY - (moved.rowY + 30 / 2 - 2)) < .3, moved)
ok('the mark at the edge', moved.markX === 0, moved)
/* 3 a theme kept with its template keeps it */
const kept = await b.ev(`const keep = v => { const o = {}; for (const k in v) if (QUAL.has(k)) o[k] = v[k]; return o }; const v = keep({ 'win.ink': { c: '#ffffff', a: 100 }, 'tmpl.head': JSON.stringify(TMPL_HEAD0), 'nonsense': 1 }); return { tmpl: !!v['tmpl.head'], ink: !!v['win.ink'], nonsense: 'nonsense' in v }`)      // (display.js clean keeps what QUAL knows)
ok('a theme kept as one\'s own keeps its template (and nothing it does not know)', kept.tmpl && kept.ink && !kept.nonsense, kept)
ok('nothing went wrong on the page', !(await b.ev(`return (window.__errs || []).length`)) && !b.errors.length, [await b.ev(`return window.__errs`), b.errors.slice(0, 2)])
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `tmpl: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'tmpl: all passed')
process.exit(bad.length ? 1 : 0)
