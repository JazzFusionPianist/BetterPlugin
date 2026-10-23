// node "design/speed fade draft 1/draft.mjs" — pictures of speed fades as built (his ask, 2026-10-23: "로직처럼 fade-in 이랑
// fade-out 우클릭했을 때 speed up, slow down"): the menu the other button opens on a fade out and on a fade in, and a region
// with a speed up at its start and a slow down at its end — the line is the speed's, broken, the part above it darkened in a
// deep blue (his word: "선 위는 대신 어둡게 … 다른 색이면 더 좋고") — beside the same region with plain fades.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
setTimeout(() => { console.log('timed out'); process.exit(2) }, 240000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(700)
const shot = async (file, clip) => { await b.sleep(250); const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: clip[4] || 2 } }); writeFileSync(join(here, file), Buffer.from(r.data, 'base64')); console.log(file) }
const rclick = async p => { await b.sleep(300); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'right', buttons: 2, clickCount: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'right', clickCount: 1 }); await b.sleep(200) }
await b.ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(true, false); S.rh = 90; S.auto = false; S.tool = 'pointer'; VY = 0
  const t = S.tracks.find(x => x.name === 'hum'); window.TI = S.tracks.indexOf(t); t.regs.sort((p, q) => p.a - q.a); window.RA = t.regs[0]
  RA.fi = 1.2; RA.fo = 1.6; RA.fis = true; RA.fos = true
  S.sel = TI; S.selR = []; showRow(TI); setZoom(Math.max(20, (X1 - X0 - 260) / (RA.b - RA.a)), 0); VX = 0; dirtyAll(); flush()
  VX = Math.max(0, RA.a - 1 - 60 / PXB); dirtyAll(); flush(); return [PXB, VX, bx(RA.a), bx(RA.b)]`)
const at = (bar, down = .4) => b.ev(`flush(); const b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (bx(${bar}) + (SKV.left || 0)) * k, y: b0.top + (rowY(TI) + rowH(TI) * ${down}) * k }`)
const box = () => b.ev(`flush(); const b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (bx(RA.a) - 30 + (SKV.left || 0)) * k, w: (bx(RA.b) - bx(RA.a) + 60) * k, y: b0.top + (rowY(TI) - 12) * k, h: (rowH(TI) + 24) * k }`)
{ const q = await box(); await shot('1 a speed up at its start, a slow down at its end.png', [q.x, q.y, q.w, q.h, 2]) }
await b.ev(`delete RA.fis; delete RA.fos; dirtyAll(); flush(); return 1`)
{ const q = await box(); await shot('2 the same region with plain fades, as before.png', [q.x, q.y, q.w, q.h, 2]) }
await b.ev(`RA.fos = true; dirtyAll(); flush(); return 1`)
{ const p = await at((await b.ev(`return RA.b`)) - .5); await rclick(p); await shot('3 the other button on a fade out.png', [p.x - 240, p.y - 90, 420, 230, 2]) }
await b.ev(`S.menu = null; uiDirty('menu'); flush(); return 1`)
{ const p = await at((await b.ev(`return RA.a`)) + .4); await rclick(p); await shot('4 the other button on a fade in.png', [p.x - 120, p.y - 90, 420, 230, 2]) }
await b.close(); process.exit(0)
