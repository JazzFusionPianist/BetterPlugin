// node "design/theme maker built 1/shots.mjs" <out dir> — the free theme of test/boxes.mjs photographed in a browser (stage 1 built, 2026-10-24)
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
const WW = 1728, WH = 1117
const FREE = { 'box.drawn': `${WW} ${WH}`, 'box.lanes': `0 22 ${WW - 292} ${WH - 22 - 52} 0 0 1 1`, 'box.heads': `${WW - 292} 22 292 ${WH - 22 - 52} 1 0 1 1`, 'box.bars': `0 ${WH - 52} ${WW - 292} 26 0 1 1 1`, 'box.markers': `0 ${WH - 26} ${WW - 292} 26 0 1 1 1`, 'box.command line': `0 0 ${WW} 22 0 0 1 0` }
const b = await open(PAGE, { width: WW, height: WH, dsf: 1 })
await b.sleep(600)
await b.ev(`if (typeof START !== 'undefined') START.on = false; S.rh = 36; setZoom(26, 0); VX = 0; VY = 0; chooseTrack(1); INSP.on = false; tpanelSet(false, false); applyLook(${JSON.stringify(FREE)}); jumpTo(16); setView(true); dirtyAll(); flush(); return 1`)
await b.sleep(400)
let r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(process.argv[2] + '/free-1.png', Buffer.from(r.data, 'base64'))
await b.ev(`S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 300; setView(true); dirtyAll(); flush(); return 1`); await b.sleep(400)
r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(process.argv[2] + '/free-2.png', Buffer.from(r.data, 'base64'))
console.log(JSON.stringify(b.errors)); await b.close(); process.exit(0)
