// node "design/stereo head meter draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: a stereo track's
// level in its head as two lines across, left over right (his ask, 2026-10-24: "스테레오 트랙인 경우에는, 트랙 해더에 있는
// 볼륨 미터를 가로 두 줄로"); a mono track keeps the one. The two lines take the room the one had, each half as tall with a
// hair between; the level's square stands over both. Stereo: a track whose sound has two sides (its files, a pair of inputs,
// an instrument, a bus); mono: one side. Drawn as if the song were playing.
// Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
setTimeout(() => { console.log('timed out'); process.exit(2) }, 300000)
const KIT = `
window.STEREO = new Set(['hats', 'keys', 'air', 'stereo out'])
const LV = { 'stereo out': [.7, .66], kick: [.62], snare: [.58], hats: [.55, .47], bass: [.66], keys: [.6, .52], guitar: [.57], hum: [.63], air: [.5, .58] }
const bar0 = levelBar
levelBar = function (x, y, w, t, vol) {
  if (!STEREO.has(t.name)) return bar0.apply(this, arguments).replace('R(x, y - 1, 0, 4', 'R(x, y - 1, 0, 4')
  const fader = volF(vol), [l, r] = LV[t.name] || [0, 0]
  return R(x, y - 1.5, w, 2, { fill: INK, fa: .12 }) + R(x, y + 1.5, w, 2, { fill: INK, fa: .12 }) + R(x, y - 1.5, w * l, 2, { fill: LEVEL, fa: .86 }) + R(x, y + 1.5, w * r, 2, { fill: LEVEL, fa: .86 })
    + R(x + w * volF(0), y - 3.5, 1, 9, { fill: INK, fa: .3 }) + R(x + w * fader - 3.5, y - 2.5, 7, 7, { fill: INK, fa: heard(t) ? 1 : .5 })
}`
async function sheet (file, setup, clip) {
  const b = await open(PAGE, { width: 1440, height: 900, dsf: 3 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    tpanelSet(false, false); ${setup}; dirtyAll(); flush()
    for (const t of S.tracks) { const el = document.getElementById('mt-' + t.id); if (el && !STEREO.has(t.name)) el.setAttribute('width', (+el.getAttribute('data-w') || 40) * (({ kick: .62, snare: .58, bass: .66, guitar: .57, hum: .63 })[t.name] || 0)) }
    return 1`)
  await b.sleep(200)
  const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: 3 } })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
await sheet('1 the heads - hats, keys, air and the stereo out stereo (two lines), the rest mono (one).png', `S.rh = 60`, [0, 40, 300, 560])
await sheet('2 rows zoomed shorter - the level beside the name, two lines the same.png', `S.rh = 28`, [0, 40, 300, 300])
process.exit(0)
