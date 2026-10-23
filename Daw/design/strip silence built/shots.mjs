/* strip silence as built, in the scene of strip silence draft 1 (the same shaker, the same zoom), for the two to be laid
   side by side: node "design/strip silence built/shots.mjs" (from Daw; GUIDE_UI=tree for the working tree) */
import { room } from '../../guide/shots.mjs'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const b = await room({ w: 1440, h: 900, dsf: 2 })
await b.sleep(900)
await b.ev(`for (const t of S.tracks) { if (t.theirs === 'jun') t.theirs = 'theo'; if (t.theirs === 'minseo') t.theirs = 'mina' } applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); setView(true); dirtyAll(); try { localStorage.removeItem('slur.strip') } catch (e) {} Object.assign(SIL, SIL_DEF); return 1`)
await b.sleep(1000)
await b.ev(`
  const spb = SPB(), sec = 24 * spb, N = Math.round(sec * 100), pk = new Array(N).fill(0), beat = 1 / BEATS()
  const hit = (bar, v) => { const i0 = Math.round(bar * spb * 100); for (let i = 0; i < 30; i++) if (i0 + i < N) pk[i0 + i] = Math.max(pk[i0 + i], (v || .55) * Math.exp(-i / 8) + .012) }
  for (let x = 4; x < 12 - 1e-9; x += beat) hit(x, (x * 4) % 2 < 1e-6 ? .6 : .38)
  hit(16 - .03 / spb, .5); for (let x = 16 + beat; x < 20 - 1e-9; x += beat) hit(x, (x * 4) % 2 < 1e-6 ? .6 : .38)
  const t = addTrack('audio', 'shaker', 2); normalizeOrder()
  t.regs.push(mkReg({ a: 1, b: 25, key: 'shaker', peaksAll: pk, loop: false, rate: 1, sec, srcBars: 24, name: 'shaker' }))
  leadTrack(S.tracks.indexOf(t)); S.selR = [t.regs[0].id]; S.focus = 'regions'; VX = 0; PXB = (W - X0 - 24) / 25; setView(true); dirtyAll(); return 1`)
await b.sleep(400)
const shot = async name => { await b.ev(`flush(); return 1`); await b.sleep(400); const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } }); writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64')) }
await b.press('x', 'KeyX', 88, 2); await b.sleep(500)
await shot('1 each silence, before return')
await b.ev(`silSet('whole', true); return 1`); await b.sleep(300)
await shot('2 whole bars, before return')
await b.press('Enter', 'Enter', 13); await b.sleep(500)
await shot('3 after return')
console.log('errors', b.errors.slice(0, 4))
await b.close()
