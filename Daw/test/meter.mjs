// node test/meter.mjs — the measure: so many beats to a bar. Changing it moves nothing that sounds; the bars are counted anew
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const near = (x, y, tol = 1e-9) => Math.abs(x - y) <= tol
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(60) }
const regs = name => ev(`return S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4), +(r.off || 0).toFixed(4)])`)
const secs = name => ev(`return S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.slice().sort((x, y) => x.a - y.a).map(r => [+((r.a - 1) * SPB()).toFixed(6), +((r.b - 1) * SPB()).toFixed(6), +((r.off || 0) * SPB()).toFixed(6)])`)
const pickAt = async (sel, label) => { const p = await ev(`const el = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(p.x, p.y); await b.sleep(80); const i = await ev(`return S.menu ? S.menu.items.findIndex(it => it.t === ${JSON.stringify(label)}) : -1`); if (i < 0) { bad.push('menu ' + label); out.push('FAIL menu ' + label + ' ' + JSON.stringify(await ev('return S.menu && S.menu.items.map(i => i.t)'))); return } const q = await ev(`const el = document.querySelector('[data-a="pick"][data-i="${i}"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(q.x, q.y); await b.sleep(120) }

const t0 = { kick: await secs('kick'), air: await secs('air'), marks: await ev(`return SCENES.map(s => [s.name, +((s.a - 1) * SPB()).toFixed(6)])`), spb: await ev(`return SPB()`) }
await ev(`edit(() => { const h = S.tracks.find(t => t.name === 'hum'); addPoint(h, 'vol', 12, -6); addPoint(h, 'vol', 20, -20) }); setCycle(16, 24, true); S.pos = 8`)
ok('four-four at first: said in the middle of the bar at the top and beside the bars', await ev(`const a = [...document.querySelectorAll('#g-top text')].map(x => x.textContent), c = [...document.querySelectorAll('#g-ruler text')].map(x => x.textContent); return a.includes('4/4') && c.includes('4/4') && S.meter.join() === '4,4'`))
ok('a bar is four quarters long', near(t0.spb, 240 / 92))
await pickAt('[data-a="meter"]', '3/4')
ok('pressed, it offers the measures; three-four picked', await ev(`return S.meter.join() === '3,4'`) && await ev(`const a = [...document.querySelectorAll('#g-top text')].map(x => x.textContent), c = [...document.querySelectorAll('#g-ruler text')].map(x => x.textContent); return a.includes('3/4') && c.includes('3/4')`))
ok('a bar is three quarters long now', near(await ev(`return SPB()`), 180 / 92))
ok('no region moved in time: each begins and ends at the moment it did', same(await secs('kick'), t0.kick) && same(await secs('air'), t0.air), [await secs('kick'), t0.kick])
ok('but they are counted in the new bars: what began on bar 5 begins a third into bar 6', same((await regs('kick'))[0], [6.3333, 17, 5.3333]), await regs('kick'))
ok('the markers stay at their moments too', same(await ev(`return SCENES.map(s => [s.name, +((s.a - 1) * SPB()).toFixed(6)])`), t0.marks))
ok('and the points of a line, the cycle, the playhead', await ev(`const h = S.tracks.find(t => t.name === 'hum'); return Math.abs(h.autos.vol[0].b - 16) < 1e-9 && Math.abs(h.autos.vol[1].b - 20 * 4 / 3) < 1e-9 && Math.abs(S.cycle.a - 16 * 4 / 3) < 1e-9 && Math.abs(S.cycle.b - 32) < 1e-9 && Math.abs(S.pos - 8 * 4 / 3) < 1e-9`), await ev(`return [S.tracks.find(t => t.name === 'hum').autos.vol.map(q => q.b), S.cycle, S.pos]`))
ok('the loops are as long in bars as the measure makes them, and a region of one still plays it through unbroken', await ev(`const lp = LOOPS.kick; const rs = S.tracks.find(t => t.name === 'kick').regs.slice().sort((x, y) => x.a - y.a); return Math.abs(lp.bars * SPB() - lp.n / SND_SR) < 1e-4 && carriesOn(rs[1], rs[2])`), await ev(`return [LOOPS.kick.bars, LOOPS.kick.n / SND_SR / SPB()]`))
ok('what was done before cannot be undone past it', await ev(`return UNDO.length === 0 && REDO.length === 0`))
ok('the song is as long as it was, in more bars', await ev(`return SONG_END >= 56 && SONG_END <= 64`), await ev('return SONG_END'))
// counting
ok('places are said in threes', await ev(`return readout(0) === '1.1.1' && readout(1 / 3) === '1.2.1' && readout(2 / 3 + 1 / 12) === '1.3.2' && readout(5) === '6.1.1'`), await ev(`return [readout(1 / 3), readout(2 / 3 + 1 / 12)]`))
ok('and typed in threes', await ev(`return Math.abs(parsePos('2.3') - (1 + 2 / 3)) < 1e-12 && Math.abs(parsePos('2 3 2') - (1 + 2 / 3 + 1 / 12)) < 1e-12 && Math.abs(parsePos('2.9') - (1 + 2 / 3)) < 1e-12`))
ok('a nudge of a beat is a third of a bar, of a sixteenth a twelfth', await ev(`S.nudge = 'beat'; const x = nudgeBars(); S.nudge = '1/16'; const y = nudgeBars(); S.nudge = 'tick'; const z = nudgeBars(); S.nudge = 'beat'; return Math.abs(x - 1 / 3) < 1e-12 && Math.abs(y - 1 / 12) < 1e-12 && Math.abs(z - 1 / 2880) < 1e-15`))
ok('the grid: bars, then the beat and its halves — no half bar in three', await ev(`const g = gridSteps().map(x => +x.toFixed(6)); return JSON.stringify(g.slice(0, 6)) === JSON.stringify([4, 2, 1, +(1 / 3).toFixed(6), +(1 / 6).toFixed(6), +(1 / 12).toFixed(6)])`), await ev(`return gridSteps().slice(0, 7)`))
await ev(`setZoom(120, 12)`); await b.sleep(80)
ok('the bars are ticked in threes', await ev(`const d = [...document.querySelectorAll('#g-ruler path')].map(p => p.getAttribute('d')).join(''); const xs = [...d.matchAll(/M([\\d.]+) (\\d+)V/g)].filter(m => +m[2] === RU_Y + 20).map(m => +m[1]).sort((a, b) => a - b); const gaps = xs.slice(1).map((x, i) => x - xs[i]).filter(g => g < PXB / 2 + 1); return xs.length > 4 && gaps.every(g => Math.abs(g - PXB / 3) < .6)`), await ev(`return PXB`))
await ev(`setZoom(2000, 12)`); await b.sleep(80)
ok('close up, the bars say beats one to three', await ev(`const l = [...document.querySelectorAll('#g-ruler text')].map(t => t.textContent).filter(s => /^\\d+\\.\\d\\.\\d$/.test(s)); return l.length > 2 && l.every(s => +s.split('.')[1] <= 3 && +s.split('.')[2] <= 4) && l.some(s => s.split('.')[1] === '3')`), await ev(`return [...document.querySelectorAll('#g-ruler text')].map(t => t.textContent)`))
await ev(`setZoom(0)`)
// a quantize value is a note's length, whatever the measure
ok('a sixteenth is still a sixteenth of a whole note: a twelfth of this bar', await ev(`return Math.abs(S.q * WHOLE() - 1 / 12) < 1e-12`))
// six-eight
await pickAt('[data-a="meter"]', '6/8')
ok('six-eight: a bar of six eighths lasts as long as three quarters did, so nothing is recounted', await ev(`return S.meter.join() === '6,8' && Math.abs(SPB() - 180 / 92) < 1e-12`) && same((await regs('kick'))[0], [6.3333, 17, 5.3333]))
ok('but it is counted in six, two sixteenths to the beat', await ev(`return readout(.5) === '1.4.1' && readout(.5 + 1 / 12) === '1.4.2' && BEAT_16() === 2 && Math.abs(nudgeBars() - 1 / 6) < 1e-12`), await ev(`return [readout(.5), readout(.5 + 1 / 12)]`))
ok('and has a half bar on its grid', await ev(`return Math.abs(gridSteps()[3] - .5) < 1e-12 && Math.abs(gridSteps()[4] - 1 / 6) < 1e-12`))
ok('written with the project', await ev(`return JSON.parse(serialize()).meter.join() === '6,8'`))
// and back
await pickAt('[data-a="meter"]', '4/4')
ok('back in four-four: every region on the bar it was on', same(await regs('kick'), [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]) && same(await regs('air'), [[1, 43, 0]]) && same(await ev(`return SCENES.map(s => [s.name, +s.a.toFixed(6)])`), [['intro', 1], ['verse', 5], ['pre', 13], ['chorus', 17], ['verse 2', 25], ['chorus', 33], ['out', 41]]), [await regs('kick'), await ev(`return SCENES.map(s => [s.name, s.a])`)])
ok('the song is 42 bars again, the cycle where it was', await ev(`return SONG_END === 42 && Math.abs(S.cycle.a - 16) < 1e-9 && Math.abs(S.cycle.b - 24) < 1e-9`), await ev(`return [SONG_END, S.cycle]`))
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
