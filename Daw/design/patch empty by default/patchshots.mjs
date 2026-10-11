// the patch as it is now built: empty to begin with, the list that adds to it, and with things on it
import { open, PAGE } from '/Users/steven/Downloads/BetterPlugin-main 2/Daw/test/cdp.mjs'
import { writeFileSync } from 'node:fs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)
const clip = async (name, x, y, w, h) => { const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x, y, width: w, height: h, scale: 1 } }); writeFileSync(name, Buffer.from(r.data, 'base64')) }
await b.ev(`S.sel = 4; S.panel.on = true; S.panel.tab = 'patch'; setView(true); __daw.redraw()`); await b.sleep(150)
const lay = await b.ev(`return __daw.lay()`)
await clip('p1 empty.png', 0, lay.BY, 1440, 900 - lay.BY)
await b.ev(`openPicker()`); await b.sleep(250)
await clip('p2 add list.png', 0, 0, 1440, 900)
const box = await b.ev(`const r = document.getElementById('picker').getBoundingClientRect(); return [r.left, r.top, r.width, r.height, [...document.querySelectorAll('.pk-row')].map(e => e.textContent)]`)
await b.ev(`closePicker(); const t = S.tracks[4]; setPrint(t, 'tape', 24); setPrint(t, 'space', 46); __daw.redraw()`); await b.sleep(150)
await clip('p3 tape and space.png', 0, lay.BY, 1440, 900 - lay.BY)
await b.ev(`const t = S.tracks[4]; setPrint(t, 'delay', 30); __daw.redraw()`); await b.sleep(150)
await clip('p4 all three.png', 0, lay.BY, 1440, 900 - lay.BY)
console.log(JSON.stringify([await b.ev(`return window.__errs`), lay.BY, box]))
await b.close()
