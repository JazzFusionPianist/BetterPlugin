// node test/alt.mjs — alternatives: a track's regions held several times over, one set on the lane and the others put aside
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const regs = name => ev(`return S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4), +(r.off || 0).toFixed(4)])`)
const alts = name => ev(`const t = S.tracks.find(t => t.name === ${JSON.stringify(name)}); return [t.alt || '1', (t.alts || []).map(a => [a.name, a.regs.length])]`)
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(60) }
const undo = () => key('z', 'KeyZ', 90, 4)
const head = name => ev(`const i = S.tracks.findIndex(t => t.name === ${JSON.stringify(name)}), el = document.querySelector('[data-a="sel"][data-i="' + i + '"]').getBoundingClientRect(); return { x: el.left + 60, y: el.top + el.height / 2 }`)
const rclick = async p => { await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'right', buttons: 2, clickCount: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'right', clickCount: 1 }); await b.sleep(80) }
const pick = async label => { const i = await ev(`return S.menu ? S.menu.items.findIndex(it => it.t === ${JSON.stringify(label)}) : -1`); if (i < 0) { bad.push('menu item ' + label); out.push('FAIL menu item ' + label + ' ' + JSON.stringify(await ev('return S.menu && S.menu.items.map(i => i.t)'))); return } const q = await ev(`const el = document.querySelector('[data-a="pick"][data-i="${i}"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(q.x, q.y); await b.sleep(80) }
const K0 = [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]
const headWords = name => ev(`const i = S.tracks.findIndex(t => t.name === ${JSON.stringify(name)}); return [...document.querySelectorAll('#hd-' + i + ' text')].map(x => x.textContent)`)

ok('a track with one set of regions says nothing about alternatives', !(await headWords('kick')).some(w => /^alt/.test(w)))
await rclick(await head('kick'))
ok('its menu offers them', (await ev(`return S.menu.items.map(i => i.t)`)).includes('alternatives'), await ev(`return S.menu.items.map(i => i.t)`))
await pick('alternatives')
ok('the list: the one there is, and two ways to make another', same(await ev(`return S.menu && S.menu.items.map(i => [i.t, !!i.on])`), [['alternative 1', true], ['new, empty', false], ['new, a copy of this one', false]]), await ev(`return S.menu && S.menu.items.map(i => [i.t, !!i.on])`))
await pick('new, empty')
ok('a new, empty one: the lane is empty, the first is put aside whole', same(await regs('kick'), []) && same(await alts('kick'), ['2', [['1', 4]]]), await alts('kick'))
ok('the head says which is on the lane', (await headWords('kick')).includes('alt 2'), await headWords('kick'))
await ev(`const t = S.tracks.find(t => t.name === 'kick'); edit(() => { t.regs.push(mkReg({ a: 9, b: 11, buf: 'kick', loop: true, off: 8 })) })`)
await rclick(await head('kick')); await pick('alternatives, 2'); await pick('alternative 1')
ok('back to the first: its regions are on the lane again, the second is put aside with what was made in it', same(await regs('kick'), K0) && same(await alts('kick'), ['1', [['2', 1]]]), [await regs('kick'), await alts('kick')])
await rclick(await head('kick')); await pick('alternatives, 2'); await pick('new, a copy of this one')
ok('a copy: the same regions as new ones, numbered three', same(await regs('kick'), K0) && same(await alts('kick'), ['3', [['2', 1], ['1', 4]]]) && await ev(`const t = S.tracks.find(t => t.name === 'kick'); const ids = t.regs.concat(...t.alts.map(a => a.regs)).map(r => r.id); return new Set(ids).size === ids.length`), await alts('kick'))
// what is done to the song's time is done to the ones put aside too
await ev(`timeAct.cut(12, 16)`)
ok('four bars cut out of the song: gone from the alternatives put aside as well', same(await regs('kick'), [[5, 13, 4], [13, 21, 16], [21, 29, 24], [29, 37, 32]]) && await ev(`const t = S.tracks.find(t => t.name === 'kick'), one = t.alts.find(a => a.name === '1').regs.slice().sort((x, y) => x.a - y.a).map(r => [r.a, r.b]); return JSON.stringify(one) === JSON.stringify([[5, 13], [13, 21], [21, 29], [29, 37]])`), await regs('kick'))
await undo()
await ev(`timeAct.repeat(8, 10)`)
ok('two bars said twice: in the one put aside too', await ev(`const t = S.tracks.find(t => t.name === 'kick'), two = t.alts.find(a => a.name === '2').regs.slice().sort((x, y) => x.a - y.a).map(r => [r.a, r.b]); return JSON.stringify(two) === JSON.stringify([[9, 11], [11, 13]])`), await ev(`return S.tracks.find(t => t.name === 'kick').alts.find(a => a.name === '2').regs.map(r => [r.a, r.b])`))
await undo()
// the tempo moves under files in the ones put aside
await ev(`const t = S.tracks.find(t => t.name === 'kick'); t.alts.find(a => a.name === '2').regs.push(mkReg({ a: 1, b: 3, key: 'file:z', loop: false, rate: 1, sec: 2 * SPB(), srcBars: 2 })); window.__t0 = S.tempo; setTempo(S.tempo * 2)`)
ok('the tempo doubled: a file in an alternative put aside is twice as many bars, as on the lanes', await ev(`const r = S.tracks.find(t => t.name === 'kick').alts.find(a => a.name === '2').regs.find(r => r.key === 'file:z'); return Math.abs((r.b - r.a) - 4) < 1e-9`))
await ev(`setTempo(__t0); const t = S.tracks.find(t => t.name === 'kick'), a = t.alts.find(a => a.name === '2'); a.regs = a.regs.filter(r => r.key !== 'file:z')`)
// undo, the project (the two changes of tempo just made are a step of their own now: that one first)
await undo()
await undo()
ok('undo takes the copy away again', same(await alts('kick'), ['1', [['2', 1]]]) && same(await regs('kick'), K0), await alts('kick'))
ok('written with the project, and read back', await ev(`const j = JSON.parse(serialize()), k = j.tracks.find(t => t.name === 'kick'); return k.alts.length === 1 && k.alts[0].name === '2' && k.alts[0].regs.length === 1 && k.alts[0].regs[0].a === 9 && !j.tracks.find(t => t.name === 'snare').alts`))
await rclick(await head('kick')); await pick('alternatives, 2'); await pick('delete the others')
ok('delete the others: only what is on the lane is left, and the head says nothing again', same(await alts('kick'), ['1', []]) && !(await headWords('kick')).some(w => /^alt/.test(w)))
await undo()
// with an edit group, the group's tracks go along
{ const p = await head('kick'), q = await head('snare'); await b.click(p.x, p.y); await b.click(q.x, q.y, 8); await key('g', 'KeyG', 71, 6); await key('Escape', 'Escape', 27); await key('Escape', 'Escape', 27) }      // (the name it was given kept, its card closed)
await rclick(await head('snare')); await pick('alternatives'); await pick('new, empty')
ok('a new one on a track of an edit group: on the group’s other tracks too', same(await regs('snare'), []) && same(await regs('kick'), []) && same(await alts('snare'), ['3', [['1', 4]]]) && same(await alts('kick'), ['3', [['2', 1], ['1', 4]]]), [await alts('snare'), await alts('kick')])
await rclick(await head('snare')); await pick('alternatives, 2'); await pick('alternative 1')
ok('back to the first on one: the other goes back to its first as well', same(await regs('snare'), K0) && same(await regs('kick'), K0), [await alts('snare'), await alts('kick')])
await undo(); await undo(); await undo()
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
