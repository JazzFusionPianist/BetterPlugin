// node "design/bars before one draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: bars before bar 1,
// as far as −8 (his ask, 2026-10-24: "1마디 이전으로 -8마디까지 … Default는 1마디 시작 … 로직은 1마디 이전으로 마디 넘버를
// 드래그하면 마이너스 마디로"). As Logic counts them: 1, then 0, −1 … −8.
//   the song begins at bar 1, as now; at its start, at the foot of the bars, a small square: the song's start;
//   pulled to the left, bars are put in before bar 1, one for each bar's width pulled — 0, −1, −2 … as far as −8 — and
//     everything stays at the bar it was at; pulled back, the empty ones go again (never one with sound, a line or a marker
//     on it);
//   the other button on the square: where the song starts, picked from a list (the option): 1, 0, −1 … −8;
//   the transport panel counts the same: before bar 1 the bar is −2, and the time runs up to zero at bar 1 (−00:00:05:06).
// Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
setTimeout(() => { console.log('timed out'); process.exit(2) }, 300000)
const UI = join(here, '../../ui')
const cut = (file, head) => { const all = readFileSync(join(UI, file), 'utf8'), i = all.indexOf(head), j = all.indexOf('\n}\n', i); return all.slice(i, j + 2) }
const RULER = cut('ui.js', 'function pRuler () {'), PANEL = cut('panel.js', 'SKINS.left.panel = () => {'), FRAME = cut('panel.js', 'SKINS.frame.panel = ')
const KIT = `
window.PREBARS = 0
const placeD = p => { const s = place(p).split('.'); s[0] = String(+s[0] - PREBARS).replace('-', '−'); return s.join('.') }
const smpteD = p => { const q = p - PREBARS; return (q < -1e-9 ? '−' : '') + smpte(Math.abs(q)) }
{ let src = ${JSON.stringify(RULER)}
  const swap = (a, b) => { if (!src.includes(a)) throw new Error('ruler changed: ' + a.slice(0, 40)); src = src.replace(a, b) }
  swap("String(b + 1), { size: lkN('bars.size')", "String(b + 1 - PREBARS).replace('-', '−'), { size: lkN('bars.size')")
  swap("if (b % major === 0) t4 +=", "if ((((b - PREBARS) % major) + major) % major === 0) t4 +=")
  swap("(b % lab === 0 ? 5 : RU_H - 9)", "((((b - PREBARS) % lab) + lab) % lab === 0 ? 5 : RU_H - 9)")
  swap("if (b % lab === 0 && x < X1 - 14)", "if ((((b - PREBARS) % lab) + lab) % lab === 0 && x < X1 - 14)")
  swap("  return s + G(g, '', TL) +", "  { const x = bx(1); if (x >= X0 - 1 && x <= X1) g += R(n(x) + .5, y + RU_H - 7.5, 6.5, 6.5, { fill: INK, fa: .85 }) }      // (draft: the song's start)\\n  return s + G(g, '', TL) +")
  pRuler = eval('(' + src.replace('function pRuler () {', 'function () {') + ')'); PARTS.ruler = pRuler }
{ let src = ${JSON.stringify(PANEL)}
  src = src.replace(/place\\(p\\)/g, 'placeD(p)').replace(/smpte\\(p\\)/g, 'smpteD(p)')
  SKINS.left.panel = eval('(' + src.slice('SKINS.left.panel = '.length) + ')') }
window.frameD = (() => { let src = ${JSON.stringify(FRAME)}
  src = src.replace(/place\\(p\\)/g, 'placeD(p)').replace(/smpte\\(p\\)/g, 'smpteD(p)')
  return eval('(' + src.slice('SKINS.frame.panel = '.length) + ')') })()
window.preTo = k => { const d = k - PREBARS; if (d > 0) timeAct.room(0, d); PREBARS = k; dirtyAll(); flush() }`
async function sheet (file, k, clip, more = '') {
  const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    tpanelSet(true, false); S.rh = 50; setZoom(30, 0); VX = 0; VY = 0; dirtyAll(); flush()
    preTo(${k}); jumpTo(${k > 0 ? 1 : 0}); VX = 0; ${more}
    dirtyAll(); flush(); SKINS.frame.panel = frameD; SKINS.frame.panel(curPos()); return 1`)
  await b.sleep(500)
  await b.ev(`SKINS.frame.panel = frameD; dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: 2 } })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
const MENU = k => `{ const b0 = board.getBoundingClientRect(); const x = bx(1) + 4, y = RU_Y + RU_H; openMenu(x, y, [{ t: 'the song starts at bar', dim: true }].concat([1, 0, -1, -2, -3, -4, -5, -6, -7, -8].map(v => ({ t: String(v).replace('-', '−'), on: v === 1 - ${k}, v }))), () => {}, { w: 150 }); flush() }`
await sheet('1 the song begins at bar 1, its start a small square at the foot of the bars.png', 0, [0, 0, 1100, 330])
await sheet('2 pulled three bars to the left - bars 0, −1, −2 before bar 1.png', 3, [0, 0, 1440, 900])
await sheet('3 as far as it goes - bar −8.png', 9, [0, 0, 1100, 330])
await sheet('4 the other button on the square - where the song starts.png', 3, [0, 0, 1100, 520], MENU(3))
process.exit(0)
