// node test/grid.mjs [w h] — the grid on the lanes: lines at the division chosen in the control bar (a quarter unless
// another is chosen), a bar line stronger than a beat's, a beat's much stronger than the rest; seen from far away the
// lines thin out instead of running together; the list in the control bar; a triplet grid is pulled to; it is kept with
// the project. A real pointer.
import { open, PAGE } from './cdp.mjs'
import { readFileSync } from 'node:fs'
const [ww, hh] = [+process.argv[2] || 1440, +process.argv[3] || 900]
const b = await open(PAGE, { width: ww, height: hh, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
// (until the page reads grid.js by itself, the check reads it in)
await ev(`if (typeof GRIDS === 'undefined') { const s = document.createElement('script'); s.textContent = ${JSON.stringify(readFileSync(new URL('../ui/grid.js', import.meta.url), 'utf8'))}; document.head.appendChild(s) } setView(true); dirtyAll(); flush()`)
// the lines drawn, by their weight: how many of each, and how strong
const lines = () => ev(`flush(); const out = {}; for (const p of document.getElementById('ln-grid').querySelectorAll('path')) { const a = p.getAttribute('stroke-opacity') || '1', n = (p.getAttribute('d').match(/M/g) || []).length; if (n) out[a] = (out[a] || 0) + n } return out`)
const at = async (pxb, grid) => { await ev(`${grid ? `S.grid = ${JSON.stringify(grid)};` : ''} setZoom(${pxb}, 8); VX = 4; relayout(); dirtyAll(); flush()`); return lines() }
const span = () => ev(`return { bars: (X1 - X0) / PXB, pxb: PXB, end: SONG_END }`)
const BAR = '0.13', BEAT = '0.07', SUB = '0.03', FAR = '0.05'

ok('a quarter is the grid a project begins with, and the control bar says so', await ev(`return S.grid === '1/4' && document.getElementById('g-top').textContent.includes('grid1/4')`), await ev(`return [S.grid, document.getElementById('g-top').textContent.slice(-40)]`))
{ const L = await at(120), s = await span(), bars = L[BAR] || 0
  ok('at a quarter: between two bar lines three lines on the beats, and nothing finer', Math.abs((L[BEAT] || 0) - 3 * bars) <= 4 && !L[SUB] && bars >= 3, [L, s]) }
{ const L = await at(240, '1/16'), bars = L[BAR] || 0
  ok('at a sixteenth: the beats as before, and twelve fainter lines a bar between them', Math.abs((L[BEAT] || 0) - 3 * bars) <= 4 && Math.abs((L[SUB] || 0) - 12 * bars) <= 13, L)
  ok('a bar line is about twice as strong as a beat\'s, a beat\'s more than twice as strong as the rest', +BAR >= 1.8 * +BEAT && +BEAT >= 2.1 * +SUB) }
{ const L = await at(60, '1/16'), bars = L[BAR] || L[FAR] || 0, all = (L[BAR] || 0) + (L[FAR] || 0)
  ok('from further away the sixteenths would run together: every second one is drawn (eighths)', Math.abs((L[BEAT] || 0) - 3 * all) <= 4 && Math.abs((L[SUB] || 0) - 4 * all) <= 5, L) }
{ const L = await at(30, '1/16'), all = (L[BAR] || 0) + (L[FAR] || 0)
  ok('further still: the beats alone', Math.abs((L[BEAT] || 0) - 3 * all) <= 4 && !L[SUB], L) }
{ const L = await at(12, '1/16')
  ok('from far away: the bars alone, thinned as they were', !L[BEAT] && !L[SUB] && (L[BAR] || 0) > 0, L) }
{ const L = await at(240, '1/12'), bars = L[BAR] || 0
  ok('a triplet grid (twelve to a whole note): three of its lines a bar are on beats, eight are not', Math.abs((L[BEAT] || 0) - 3 * bars) <= 4 && Math.abs((L[SUB] || 0) - 8 * bars) <= 9, L) }
{ const L = await at(240, '1/6'), bars = L[BAR] || 0
  ok('six to a whole note: five lines a bar, one of them on a beat', Math.abs((L[BEAT] || 0) - 1 * bars) <= 2 && Math.abs((L[SUB] || 0) - 4 * bars) <= 5, L) }
{ const L = await at(240, '1/1')
  ok('one to a whole note: the bars alone', !L[BEAT] && !L[SUB] && (L[BAR] || 0) > 0, L) }
// what is pulled goes to the grid's kind
{ const st = await ev(`S.grid = '1/4'; setZoom(240, 8); const a = gridStep(); S.grid = '1/12'; const t = gridStep(); S.grid = '1/4'; const w = WHOLE(); return { a: w / a, t: w / t }`)
  ok('with a straight grid things are pulled to halves of halves; with a triplet one to thirds', Number.isInteger(Math.round(st.a * 1e6) / 1e6) && (Math.round(st.a) & (Math.round(st.a) - 1)) === 0 && Math.round(st.t) % 3 === 0, st) }
// the list in the control bar
{ await ev(`S.grid = '1/4'; uiDirty('top', 'lanes'); flush()`)
  const p = await ev(`const el = document.querySelector('[data-a="grid"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el, l: r.left, r: r.right }`)
  ok('its cell in the control bar can be reached', !!p && p.hit, p)
  ok('the control bar still has room: the cell ends before the level at the right begins', await ev(`const g = document.querySelector('[data-a="grid"]').getBoundingClientRect(), m = document.querySelector('[data-a="master"]').getBoundingClientRect(), tr = document.querySelector('[data-a="tostart"]').getBoundingClientRect(), mx = document.querySelector('[data-a="mixer"]').getBoundingClientRect(); return g.right <= m.left + 1 && tr.left >= mx.right`), await ev(`return [document.querySelector('[data-a="grid"]').getBoundingClientRect().right, document.querySelector('[data-a="master"]').getBoundingClientRect().left]`))
  await b.click(p.x, p.y); await b.sleep(80)
  ok('pressed: the list of grids, the chosen one marked, the triplet ones set apart', await ev(`const m = S.menu; return !!m && m.items.length === 10 && m.items.find(i => i.on).t === '1/4' && m.items.find(i => i.sep).t === '1/3'`), await ev('return S.menu && S.menu.items.map(i => i.t)'))
  const q = await ev(`flush(); const i = S.menu.items.findIndex(x => x.t === '1/8'), el = document.querySelector('[data-a="pick"][data-i="' + i + '"]'), r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`)
  await b.click(q.x, q.y); await b.sleep(80)
  ok('one picked: the grid is that, the bar says so, the lanes are drawn with it', await ev(`flush(); return S.grid === '1/8' && !S.menu && document.getElementById('g-top').textContent.includes('grid1/8') && /grid 1\\/8/.test(S.last && S.last.say || '')`), await ev('return [S.grid, S.last && S.last.say]'))
  const L = await at(240)
  ok('and the lanes show eighths', (L[SUB] || 0) > 0 && Math.abs((L[SUB] || 0) - 4 * (L[BAR] || 0)) <= 5, L) }
// kept with the project
ok('the grid is kept with the project and comes back with it', await ev(`const j = JSON.parse(serialize()); return j.grid === '1/8'`))
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
if (process.env.PICS) { const { writeFileSync } = await import('node:fs'); for (const [g, pxb] of [['1/4', 150], ['1/16', 150], ['1/12', 150], ['1/16', 40]]) { await ev(`S.grid = '${g}'; setZoom(${pxb}, 8); VX = 4; relayout(); dirtyAll(); flush()`); await b.sleep(100); const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: ww, height: 420, scale: 2 } }); writeFileSync(process.env.PICS + `grid ${g.replace('/', ' to ')} at ${pxb}.png`, Buffer.from(r.data, 'base64')) } }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
