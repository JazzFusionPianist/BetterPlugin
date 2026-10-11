// node test/deep.mjs — close up: the room zooms in until a single sample is sixteen pixels wide; the bars divide into beats,
// sixteenths, ticks and samples; the sound is drawn as it is; and what is cut or placed there lands on a sample
import { open, PAGE } from './cdp.mjs'
import { copyFileSync, mkdirSync } from 'node:fs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(60) }
const labels = () => ev(`return [...document.querySelectorAll('#g-ruler text')].map(t => t.textContent).filter(s => s !== 'bars' && s !== '4/4')`)
const KEEP = process.argv[2]                                    // a folder to keep the pictures in
const shot = async name => { const f = await b.shot(`deep-${name}.png`); if (KEEP) { mkdirSync(KEEP, { recursive: true }); copyFileSync(new URL('./out/' + f, import.meta.url), `${KEEP}/deep-${name}.png`) } }
const coords = () => ev(`let m = 0; for (const el of document.querySelectorAll('#g-lanes path, #g-lanes rect, #g-lanes g, #g-ruler path')) for (const a of ['d', 'x', 'width', 'transform']) { const v = el.getAttribute(a); if (v) for (const q of v.match(/-?\\d+(\\.\\d+)?/g) || []) m = Math.max(m, Math.abs(+q)) } return m`)

await ev(`S.rh = 60; __daw.redraw()`)
ok('as far in as it goes: sixteen pixels to a sample', await ev(`return Math.abs(maxPXB() - 16 * SND_SR * SPB()) < 1e-6 && maxPXB() > 1e6`), await ev(`return maxPXB()`))
// ── beats ──
await ev(`setZoom(900, 18)`); await b.sleep(80)
ok('past 640 to a bar the bars say their beats', (await labels()).every(s => /^\d+\.\d$/.test(s)) && (await labels()).includes('19.1'), await labels())
await shot('1-beats')
await ev(`setZoom(3000, 18)`); await b.sleep(80)
ok('further in: sixteenths', (await labels()).every(s => /^\d+\.\d\.\d$/.test(s)), await labels())
await ev(`setZoom(60000, 18)`); await b.sleep(80)
ok('further: ticks', (await labels()).every(s => /^\d+\.\d\.\d\.\d+$/.test(s)), await labels())
await shot('2-ticks')
ok('the grid step there is still one that can be aimed at', await ev(`const g = gridStep(); return g * PXB >= 7 && g * PXB < 60`), await ev(`return [gridStep(), gridStep() * PXB]`))
// ── samples ──
await ev(`setZoom(1e9, 18)`); await b.sleep(120)
ok('all the way in: the zoom stops at its limit', await ev(`return Math.abs(PXB - maxPXB()) < 1e-6`))
ok('the bars count samples there', (await labels()).length > 2 && (await labels()).every(s => /^[\d ]+$/.test(s)), await labels())
ok('and the grid is one sample', await ev(`return Math.abs(gridStep() - oneSample()) < 1e-15`))
ok('nothing is drawn with a number too large to be drawn truly', (await coords()) < 20000, await coords())
ok('the sound is a line from sample to sample, each one marked', await ev(`const i = S.tracks.findIndex(t => t.name === 'bass'), d = [...document.querySelectorAll('#ln-rows g path')].map(p => p.getAttribute('d')).filter(d => /h2\\.8v2\\.8h-2\\.8Z/.test(d)); return d.length > 0`))
await shot('3-samples')
// a cut there lands on a sample
await ev(`pickTool('scissors')`)
{ const p = await ev(`const i = S.tracks.findIndex(t => t.name === 'bass'), r = document.getElementById('board').getBoundingClientRect(); return { x: r.left + X0 + 403.3, y: r.top + rowY(i) + S.rh / 2 }`); await b.click(p.x, p.y); await b.sleep(80) }
ok('a cut made there lands on a sample exactly', await ev(`const rs = S.tracks.find(t => t.name === 'bass').regs.slice().sort((x, y) => x.a - y.a), cut = rs.find(r => ![5, 17, 33].includes(r.a)); if (!cut) return false; const s = (cut.a - 1) / oneSample(); return Math.abs(s - Math.round(s)) < 1e-6`), await ev(`return S.tracks.find(t => t.name === 'bass').regs.map(r => r.a)`))
await key('z', 'KeyZ', 90, 4); await ev(`pickTool('pointer')`)
// a fade drawn there, a few samples long
await ev(`pickTool('smart'); const t = S.tracks.find(t => t.name === 'kick'), r = t.regs.find(x => x.a === 17); VX = 16 - 4 / PXB; __daw.redraw()`)
{ const p = await ev(`const i = S.tracks.findIndex(t => t.name === 'kick'), r = document.getElementById('board').getBoundingClientRect(); return { x: r.left + bx(17) + 4, y: r.top + rowY(i) + 4 }`); await b.dragTo(p.x, p.y, p.x + 160, p.y, 6); await b.sleep(80) }
ok('a fade pulled over ten samples is ten samples long', await ev(`const r = S.tracks.find(t => t.name === 'kick').regs.find(x => x.a === 17); return Math.abs(r.fi / oneSample() - 10) < 1e-6`), await ev(`const r = S.tracks.find(t => t.name === 'kick').regs.find(x => x.a === 17); return r.fi / oneSample()`))
await shot('4-fade')
await key('z', 'KeyZ', 90, 4); await ev(`pickTool('pointer')`)
// ── and out again ──
await ev(`setZoom(0)`); await b.sleep(80)
ok('out again: the bars are bars', (await labels()).every(s => /^\d+$/.test(s)), await labels())
await ev(`setZoom(640, 18)`); await b.sleep(80)
ok('at 640 to a bar nothing has changed: bar numbers, the sound in its one shape', (await labels()).every(s => /^\d+$/.test(s)) && await ev(`return gridStep() === 1 / 32`), [await labels(), await ev('return gridStep()')])
ok('the slider on the bar still ends there', await ev(`return zoomF() === 1`))
await key('ArrowRight', 'ArrowRight', 39, 4)
ok('command right goes further in than the slider does', await ev(`return PXB > 640 && zoomF() === 1`), await ev('return PXB'))
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
