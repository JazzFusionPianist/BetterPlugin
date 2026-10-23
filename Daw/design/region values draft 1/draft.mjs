// node "design/region values draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: what a chosen
// region is set to — its gain, transpose and fine tune — as a row of their own across the transport panel's foot (his ask,
// 2026-10-23: "트랜스포트 패널 어딘가에 어떤 리젼 클립 게인 얼마나 되어있는지 … 트랜스포즈랑 fine tune 도"). They were
// there, small and faint after the region's name, and the fine tune ran under the + for a new track.
//   a row under the count of tracks and what is chosen: three columns across the whole column, each its word in small
//     letters over its value, set as large as the panel's tool and mode; pulled up or down as before;
//   with no region chosen, the row stays, its values a dash (the panel does not move when a region is pressed);
//   the region's fades (and their curve, and its tempo) keep their small line under its name.
// Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
setTimeout(() => { console.log('timed out'); process.exit(2) }, 240000)
const PANEL_SRC = (() => { const all = readFileSync(join(here, '../../ui/panel.js'), 'utf8'), i = all.indexOf('SKINS.left.panel = () => {'), j = all.indexOf('\n}\n', i); return all.slice(i + 'SKINS.left.panel = '.length, j + 2) })()
const KIT = `
{ let src = ${JSON.stringify(PANEL_SRC)}
  const swap = (a, b) => { if (!src.includes(a)) throw new Error('panel changed: ' + a.slice(0, 40)); src = src.replace(a, b) }
  swap('outH = 2 * ring + 40, foot = 112', 'outH = 2 * ring + 40, foot = 112 + 30')
  swap('const r1 = f0 + 30', 'const r1 = f0 + 60')
  swap("line(ty, [[\`gain \${fmtDb(r.gain || 0)}\`, 'rgain', 'ns-resize'], [\`tr \${sg(r.tr)}\`, 'rtr', 'ns-resize']].concat(r.notes || rs[0][1].midi ? [] : [[\`fine \${sg(r.ft)}\`, 'rft', 'ns-resize']]))", '')
  swap('line(ty + 11, [[\`fades', 'line(ty, [[\`fades')
  swap("  const pick = (x, yy, label, v, a) =>", \`  /* draft: the chosen region's gain, transpose and fine tune, a row across the column (a dash with none chosen) */
  { const st = S.tracks[S.sel], rs = S.focus === 'tracks' ? [] : selRegs(), r = rs.length ? rs[0][0] : null, sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v || 0), yv = f0 + 40
    const notes = r && (r.notes || rs[0][1].midi), cols = [['gain', r ? fmtDb(r.gain || 0) + ' dB' : '—', 'rgain'], ['transpose', r ? sg(r.tr) : '—', 'rtr'], ['fine tune', r && !notes ? sg(r.ft) + ' ct' : '—', 'rft']]
    cols.forEach(([k, v, a], i) => { const x = GL + i * 76; s += tpCaps(x, yv - 14, k, { a: r ? .45 : .3 }) + T(x, yv, v, { size: 12, w: 500, a: r ? .92 : .3, x: tpNum }) + (r ? hit(x - 3, yv - 24, 70, 28, a, '', 'ns-resize') : '') }) }
  const pick = (x, yy, label, v, a) =>\`)
  const left0 = eval('(' + src + ')')
  SKINS.left.panel = function () {
    const s = left0.apply(this, arguments), x = TPX.CW - 24, y = 24
    const q = Cc(x, y, 7.5, { stroke: INK, sa: .5, sw: 1 }) + T(x, y + 3.5, '?', { size: 10, w: 600, c: INK, a: .7, anchor: 'middle' })
    return s.endsWith('</g></g>') ? s.slice(0, -8) + q + '</g></g>' : s + G(q, 'translate(' + (-TPX.CW) + ' 0)')
  } }
`
async function sheet (file, width, height, setup, clip) {
  const b = await open(PAGE, { width, height, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    jumpTo(18 + 2 / 4 + 1 / 16 + 37 / 3840)
    ${setup}
    tpanelSet(true, false); setView(true); dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  await b.sleep(400)
  await b.ev(`dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  const r = await b.send('Page.captureScreenshot', clip ? { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: clip[4] || 2 } } : { format: 'png' })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
const chosen = `const t = S.tracks.find(x => x.name === 'hum'), r = t.regs[0]; r.gain = -3.5; r.tr = 2; r.ft = 15; r.fo = 1; S.sel = S.tracks.indexOf(t); S.selR = [r.id]; S.focus = 'lanes'`
await sheet('1 a region chosen, the column.png', 1440, 900, chosen, [0, 0, 248, 900, 2])
await sheet('2 a region chosen, the foot close.png', 1440, 900, chosen, [0, 640, 248, 260, 3])
await sheet('3 no region chosen, the foot close.png', 1440, 900, `S.selR = []; S.focus = 'tracks'`, [0, 640, 248, 260, 3])
await sheet('4 a small window, 1100 x 700.png', 1100, 700, chosen, [0, 0, 248, 700, 2])
process.exit(0)
