// node test/zoomfeel.mjs [w h] — zooming and sliding along the song by the hand (his users, 2026-10-19: a trackpad's zoom
// was not smooth): while the hand goes, the lanes as last drawn are stretched to the new view and nothing of them is drawn
// again; once it stops they are drawn for real — and then each region stands where it would have been drawn had the view
// been set at once. A pinch told twice (as a gesture and as a wheel) zooms once.
import { open, PAGE } from './cdp.mjs'
const [ww, hh] = [+process.argv[2] || 1440, +process.argv[3] || 900]
const b = await open(PAGE, { width: ww, height: hh, dsf: 1 })
await b.sleep(900)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
/* a region's place as drawn on the screen (its box through every transform), and where it should be */
const where = `const t = S.tracks.find(x => x.regs.length), r = t.regs[0], row = LANES.rows.get(t.id); const el = row && [...row.el.querySelectorAll('path')].find(e => e.getAttribute('fill') && e.getAttribute('fill') !== 'none')
  const box = el ? el.getBoundingClientRect() : null, svg = document.getElementById('svg').getBoundingClientRect(), k = svg.width / W
  return { drawn: box ? (box.x - svg.x) / k : null, should: bx(r.a), pxb: PXB, vx: VX, stretched: !!document.getElementById('ln-rows').getAttribute('transform') }`
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); setZoom(PXB * 2, 8); dirtyAll(); flush()`)
const a0 = await ev(where)
ok('as drawn: a region stands where it should', a0.drawn != null && Math.abs(a0.drawn - a0.should) < 1.5, a0)
/* a pinch's steps */
let n0 = await ev(`window.__drawn = 0; const box = document.getElementById('ln-rows'); window.__mo = new MutationObserver(m => { for (const x of m) if (x.type === 'childList' || x.attributeName !== 'transform') __drawn++ }); __mo.observe(box, { subtree: true, childList: true, attributes: true }); return 0`)
await ev(`for (let i = 1; i <= 12; i++) zoomLive(PXB * 1.04, VX + 3)`)
const a1 = await ev(`flush(); ${where}`)
ok('while the hand zooms: the lanes are stretched, not drawn again', a1.stretched && await ev(`return __drawn`) === 0, [a1, await ev(`return __drawn`)])
ok('…and a region stands where the new view would draw it', a1.drawn != null && Math.abs(a1.drawn - a1.should) < 2, a1)
await b.sleep(400)
const a2 = await ev(`flush(); ${where}`)
ok('the hand stopped: drawn for real, nothing stretched', !a2.stretched && Math.abs(a2.drawn - a2.should) < 1.5, a2)
/* two fingers along the song */
await ev(`viewLive(PXB, VX + 2); viewLive(PXB, VX + 2)`)
const a3 = await ev(`flush(); ${where}`)
ok('two fingers along: slid, and where it should be', a3.stretched && Math.abs(a3.drawn - a3.should) < 2, a3)
await b.sleep(400)
/* a pinch told as a gesture and as a wheel: once */
const z = await ev(`const p0 = PXB; ZOOM.pinch = true; const svg = document.getElementById('svg'); svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -40, ctrlKey: true, clientX: 700, clientY: 300, bubbles: true, cancelable: true })); const same = PXB === p0; ZOOM.pinch = false; svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -40, ctrlKey: true, clientX: 700, clientY: 300, bubbles: true, cancelable: true })); return { same, after: PXB > p0 }`)
ok('a pinch told as a gesture too: the wheel does not zoom it again', z.same, z)
ok('a wheel with ctrl alone zooms', z.after, z)
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
