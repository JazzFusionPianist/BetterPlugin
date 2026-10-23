// node test/outline.mjs — the stereo out's own volume line (his ask, 2026-10-23: "stereo out 도 당연히 오토메이션이 되어야
// 하고, bus의 한 종류이기 때문에 … default 로 볼륨 오토메이션이 떠야"): always drawn on its row, as a bus's; the pencil puts
// points on it, a point is pulled, deleted, and every change is a step back; its head reads the line at the playhead; its
// level pulled with a line moves the whole line; it is kept with the project and read back; the engine is told it.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.rh = 30; VY = 0; S.master = -4; OUT.autos = {}; S.tool = 'pointer'; S.selR = []; S.selP = []; setZoom(0); flush(); return 1`)
const row = await ev(`const g = document.querySelector('#ln-out rect'), r = g.getBoundingClientRect(); return { l: r.x, r: r.right, t: r.y, b: r.bottom, path: !!document.querySelector('#ln-out path') }`)
ok('the stereo out row draws its volume line with no points yet', row.path, row)

/* the pencil: a point where it is pressed */
await ev(`S.tool = 'pencil'; return 1`)
await b.click(row.l + (row.r - row.l) * .3, row.t + (row.b - row.t) * .35)
await b.click(row.l + (row.r - row.l) * .6, row.t + (row.b - row.t) * .65)
const two = await ev(`flush(); return { n: autoPts(OUT, 'vol').length, v: autoPts(OUT, 'vol').map(q => q.v), path: document.querySelectorAll('#ln-out circle').length }`)
ok('two presses with the pencil: two points, the first higher', two.n === 2 && two.v[0] > two.v[1] && two.path >= 2, two)
await ev(`undoEdit(); flush(); return 1`)
ok('a step back takes the second away', await ev(`return autoPts(OUT, 'vol').length`) === 1)
await ev(`redoEdit(); flush(); return 1`)
ok('…and forward brings it again', await ev(`return autoPts(OUT, 'vol').length`) === 2)

/* the head reads the line at the playhead; the level pulled moves the whole line */
{ const r = await ev(`S.pos = autoPts(OUT, 'vol')[1].b + 1; dirtyAll(); flush(); const want = fmtDb(autoPts(OUT, 'vol')[1].v); return { want, said: [...document.querySelectorAll('#g-head text')].some(el => el.textContent === want) }`)
  ok("the stereo out's head reads its line where the playhead is", r.said, r)
  const m = await ev(`const v0 = autoPts(OUT, 'vol').map(q => q.v), m0 = S.master; outLevel(shown(OUT, 'vol') + 3); return { moved: autoPts(OUT, 'vol').map((q, i) => +(q.v - v0[i]).toFixed(1)), master: S.master === m0 }`)
  ok('its level set with a line: the whole line moves by as much, the plain level stays', m.moved.every(d => d === 3) && m.master, m) }

/* a point chosen and deleted, as a bus's */
{ await ev(`S.tool = 'pointer'; S.selP = [autoPts(OUT, 'vol')[0].id]; S.focus = 'lanes'; flush(); return 1`)
  await b.press('Backspace', 'Backspace', 8)
  ok('a chosen point deleted', await ev(`flush(); return autoPts(OUT, 'vol').length`) === 1) }

/* kept with the project, and read back */
{ const r = await ev(`const j = JSON.parse(serialize()); return { kept: j.outAutos && j.outAutos.vol.length, v: j.outAutos && j.outAutos.vol[0].v }`)
  ok('the line is kept with the project', r.kept === 1, r)
  const back = await ev(`const j = JSON.parse(serialize()); OUT.autos = {}; const pid = PID; OUT.autos = j.outAutos && Array.isArray(j.outAutos.vol) ? { vol: j.outAutos.vol.map(q => Object.assign({ id: ++PID, b: q.b, v: q.v })) } : {}; return autoPts(OUT, 'vol').length`)
  ok('…and read back', back === 1) }

/* what the engine is told: the line, and the level match laid over it */
{ const r = await ev(`const pts = autoBent(autoPts(OUT, 'vol')); return { pts: pts.length, first: pts[0] }`)
  ok('the engine is told the line in db along the song', r.pts >= 1 && Array.isArray(r.first) && r.first.length === 2, r)
  /* (that the engine plays it is the app's own check: ./selftest.sh steps:outLine) */ }
await ev(`OUT.autos = {}; flush(); return 1`)
ok('no errors on the page', !b.errors.length, b.errors.slice(0, 3))
console.log(out.join('\n'))
console.log(bad.length ? `\n${bad.length} failed` : '\nall passed')
await b.close()
process.exit(bad.length ? 1 : 0)
