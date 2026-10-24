// node "design/theme maker built 2/shots.mjs" <out dir> — the free transport theme (free transport.sst) photographed:
// in the room at 1728×1117, and in the maker with the cluster's play button chosen (stage three built, 2026-10-24)
import { open, PAGE } from '../../test/cdp.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url)), out = process.argv[2] || here
const theme = JSON.parse(readFileSync(join(here, 'free transport.sst'), 'utf8')).theme
{ const b = await open(PAGE, { width: 1728, height: 1117, dsf: 1 })
  await b.sleep(600)
  await b.ev(`if (typeof START !== 'undefined') START.on = false; S.rh = 36; setZoom(26, 0); VX = 0; VY = 0; chooseTrack(1); INSP.on = false; tpanelSet(true, false); applyLook(${JSON.stringify(theme)}); jumpTo(16); S.cycle = { on: true, a: 16, b: 24 }; setView(true); dirtyAll(); flush(); return 1`)
  await b.sleep(500)
  const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, '1 free transport, the room.png'), Buffer.from(r.data, 'base64'))
  console.log('room', JSON.stringify(b.errors.slice(0, 2))); await b.close() }
{ const b = await open(PAGE + '?maker=1', { width: 1920, height: 1200, dsf: 1 })
  await b.sleep(1400)
  await b.ev(`applyLook(${JSON.stringify(theme)}); MK.name = 'free transport'; setView(true); dirtyAll(); flush(); return 1`); await b.sleep(400)
  const p = await b.ev(`const w = wgList().find(q => q.id === 'play'), r = wgRect(w), q = board.getBoundingClientRect(); return { x: q.left + (r.x0 + r.w / 2) * MK.k, y: q.top + (r.y0 + r.h / 2) * MK.k }`)
  await b.click(p.x, p.y); await b.sleep(400)
  const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, '2 free transport, in the maker, the play button chosen.png'), Buffer.from(r.data, 'base64'))
  console.log('maker', JSON.stringify(b.errors.slice(0, 2))); await b.close() }
process.exit(0)
