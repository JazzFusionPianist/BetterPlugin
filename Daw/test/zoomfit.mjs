// node test/zoomfit.mjs — his asks of 2026-10-23, in the page: rows can be made far thinner than before (the zoom bar runs
// between the thinnest and the tallest evenly by ratio, a thin row keeps its colour and its name and drops its buttons);
// Z makes what is chosen fill the window, as in Logic (the chosen regions, else the chosen tracks, else all) and Z again
// puts the view back; a band can be pulled from the room under the rows, the stereo out's row included; the stereo out's
// patch opens from its head only, never from its lane.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const keyZ = () => b.press('z', 'KeyZ', 90)
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.rh = 25; for (const t of S.tracks) delete t.h; VY = 0; S.sel = 0; S.selT = []; S.selR = []; S.focus = 'lanes'; setZoom(0); flush(); return 1`)

/* thin rows, and tall */
{ const r = await ev(`setRowH(1); flush(); const h0 = document.getElementById('hd-0'); return { rh: S.rh, min: RH_MIN, cells: h0 ? h0.querySelectorAll('[data-a="mute"], [data-a="vol"]').length : -1, name: h0 ? [...h0.querySelectorAll('text')].some(t => t.textContent.length > 1) : false, f: rhF() }`)
  ok('rows go down to the thinnest (6 px), far under the old 20', r.rh === 6 && r.min === 6, r)
  ok('a thin row keeps no buttons and no level', r.cells === 0, r.cells)
  ok('the zoom bar stands at its foot there', r.f === 0, r.f)
  const t = await ev(`setRowH(12); flush(); const h0 = document.getElementById('hd-0'); return { name: h0 ? [...h0.querySelectorAll('text')].map(t => t.textContent).join('|') : '', f: +rhF().toFixed(3) }`)
  ok('a row of 12 px still says its name', t.name.length > 0, t.name)
  const bar = await ev(`setRowH(fRh(.5)); return [S.rh, Math.round(Math.sqrt(RH_MIN * RH_MAX))]`)
  ok('half way along the bar is the middle by ratio', Math.abs(bar[0] - bar[1]) <= 1, bar)
  await ev(`setRowH(25); flush(); return 1`) }

/* Z: the chosen regions fill the window, and Z again puts it back */
{ const before = await ev(`return { rh: S.rh, pxb: PXB, vx: VX, vy: VY }`)
  const pick = await ev(`const ts = S.tracks.map((t, i) => [t, i]).filter(([t]) => t.kind === 'audio' && t.regs.length).slice(1, 3); S.selR = ts.map(([t]) => t.regs[0].id); S.focus = 'lanes'; flush(); return ts.map(([t, i]) => i)`)
  await keyZ(); await b.sleep(100)
  const z = await ev(`flush(); const rs = selRegs(), a = Math.min(...rs.map(x => x[0].a)) - 1, b = Math.max(...rs.map(x => x[0].b)) - 1; return { rh: S.rh, vy: VY, top: rowTops().tops[rows().indexOf(${pick[0]})], x0: bx(a + 1), x1: bx(b + 1), X0, X1, lanes: LANES_H }`)
  ok('Z: the chosen regions run across the window', z.x0 >= z.X0 - 2 && z.x1 <= z.X1 + 2 && (z.x1 - z.x0) > (z.X1 - z.X0) * .8, [z.x0, z.x1, z.X0, z.X1])
  ok('Z: their tracks fill the lanes from the top', z.vy === Math.min(z.top, z.vy) && z.rh >= Math.floor(z.lanes / 2) - 1, z)
  await keyZ(); await b.sleep(100)
  const back = await ev(`return { rh: S.rh, pxb: PXB, vx: VX, vy: VY }`)
  ok('Z again: the view as it was', JSON.stringify(back) === JSON.stringify(before), [before, back]) }

/* Z with tracks chosen, no regions: the whole song across, those tracks down */
{ const r = await ev(`S.selR = []; const ids = S.tracks.slice(0, 6).map(t => t.id); S.sel = 0; S.selT = ids; flush(); return ids.length`)
  await keyZ(); await b.sleep(100)
  const z = await ev(`flush(); return { rh: S.rh, vy: VY, fit: Math.abs(PXB - fitPXB()) < .01, want: Math.floor(LANES_H / ${r}) }`)
  ok('Z with six tracks chosen: they fill the lanes, the whole song across', z.fit && Math.abs(z.rh - z.want) <= 1 && z.vy === 0, z)
  await keyZ(); await ev(`S.selT = []; flush(); return 1`) }

/* Z on one region: its track as tall as the lanes (no ceiling of 120 in the way) */
{ const r = await ev(`const t = S.tracks.find(x => x.kind === 'audio' && x.regs.length); S.selT = []; S.selR = [t.regs[0].id]; S.focus = 'lanes'; flush(); return 1`)
  await keyZ(); await b.sleep(100)
  const z = await ev(`flush(); return { rh: S.rh, lanes: LANES_H }`)
  ok('Z on one region: its track fills the lanes', z.rh >= z.lanes - 2 && z.rh > 120, z)
  await keyZ(); await ev(`S.selR = []; flush(); return 1`) }

/* a band pulled from the room under the rows, up over the last rows */
{ const g = await ev(`S.selR = []; setRowH(25); VY = 0; flush(); const vis = rows(), last = vis[vis.length - 1], y = TY + rowTops().all + (typeof outRowH === 'function' ? outRowH() : 0) + 12 - VY; return { y, ylast: rowY(vis[vis.length - 3]) + 4, x0: X0 + 40, x1: X1 - 40, below: y < BY }`)
  if (!g.below) ok('there is room under the rows in this window', false, g)
  else {
    await b.dragTo(g.x1, g.y, g.x0, g.ylast, 8)
    await b.sleep(80)
    const r = await ev(`const vis = rows(), last3 = vis.slice(-3).map(i => S.tracks[i]); return { chosen: S.selR.length, mine: S.selR.filter(id => last3.some(t => t.regs.some(r => r.id === id))).length, band: S.band }`)
    ok('a band pulled from under the rows chooses the regions of the rows it covers', r.chosen > 0 && r.mine === r.chosen, r)
  }
  await ev(`S.selR = []; flush(); return 1`)
  const g2 = await ev(`const y = TY + rowTops().all - VY + 3, x = X0 + 100; return { x, y }`)
  await b.dragTo(g2.x, g2.y, g2.x + 200, g2.y + 4, 6)
  const r2 = await ev(`return { out: !!WALL.out, chosen: S.selR.length }`)
  ok("a band from the stereo out's own row is a band too (and its lane opens no patch)", !r2.out, r2) }

/* the stereo out's patch: from its head only */
{ const box = sel => ev(`const el = document.querySelector('${sel}'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
  const ln = await box('#ln-out rect'), y = ln.y
  await b.click(ln.x, y)
  const lane = await ev(`return !!WALL.out`)
  ok("a press on the stereo out's lane does not open its patch", !lane, lane)
  await b.click(80, y)
  const head = await ev(`return !!WALL.out`)
  ok("a press on the stereo out's head opens its patch", head, head) }

ok('no errors on the page', !b.errors.length, b.errors.slice(0, 3))
console.log(out.join('\n'))
console.log(bad.length ? `\n${bad.length} failed` : '\nall passed')
await b.close()
process.exit(bad.length ? 1 : 0)
