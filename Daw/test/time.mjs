// node test/time.mjs — the song's own time: a part of it taken out, said twice, moved before the part ahead of it or after the one
// behind it; time made room for; the lines and the markers going with it
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const regs = name => ev(`return S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4), +(r.off || 0).toFixed(4)])`)
const marks = () => ev(`return SCENES.map(s => [s.name, s.a])`)
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(60) }
const undo = () => key('z', 'KeyZ', 90, 4)
const all = () => ev(`return JSON.stringify(S.tracks.map(t => [t.name, t.regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4), +(r.off || 0).toFixed(4), r.fi || 0, r.fo || 0])]))`)
const K0 = [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]], M0 = [['intro', 1], ['verse', 5], ['pre', 13], ['chorus', 17], ['verse 2', 25], ['chorus', 33], ['out', 41]]
const whole = await all()
ok('the song as it is written', same(await regs('kick'), K0) && same(await marks(), M0) && same(await regs('air'), [[1, 43, 0]]), [await regs('air'), await marks()])

// ── a part cut out ──
await ev(`partAct(2, 'cut')`)
ok('the pre cut out of the song: four bars are gone from every track', same(await regs('kick'), [[5, 13, 4], [13, 21, 16], [21, 29, 24], [29, 37, 32]]) && same(await regs('hats'), [[13, 21, 16], [29, 37, 32]]), [await regs('kick'), await regs('hats')])
ok('a region that ran through it is two pieces now, the sound of those four bars missing between them', same(await regs('air'), [[1, 13, 0], [13, 39, 16]]), await regs('air'))
ok('the markers after it came along, and its own is gone', same(await marks(), [['intro', 1], ['verse', 5], ['chorus', 13], ['verse 2', 21], ['chorus', 29], ['out', 37]]), await marks())
await undo()
ok('one undo: all as it was', (await all()) === whole && same(await marks(), M0))

// ── a part said twice ──
await ev(`partAct(3, 'repeat')`)
ok('the chorus repeated: a copy stands right after it, the rest eight bars later', same(await regs('kick'), [[5, 13, 4], [17, 25, 16], [25, 33, 16], [33, 41, 24], [41, 49, 32]]), await regs('kick'))
ok('the long region is cut only where the copy was put in', same(await regs('air'), [[1, 25, 0], [25, 33, 16], [33, 51, 24]]), await regs('air'))
ok('and the markers say chorus twice', same(await marks(), [['intro', 1], ['verse', 5], ['pre', 13], ['chorus', 17], ['chorus', 25], ['verse 2', 33], ['chorus', 41], ['out', 49]]), await marks())
ok('the copies are regions of their own', await ev(`const ids = S.tracks.flatMap(t => t.regs.map(r => r.id)); return new Set(ids).size === ids.length`))
ok('the song grew to hold it', await ev(`return SONG_END >= 50`), await ev('return SONG_END'))
await undo()
ok('undone', (await all()) === whole && same(await marks(), M0))

// ── a part moved ──
await ev(`partAct(2, 'earlier')`)
ok('the pre moved before the verse: it begins at bar five, the verse at nine', same(await marks(), [['intro', 1], ['pre', 5], ['verse', 9], ['chorus', 17], ['verse 2', 25], ['chorus', 33], ['out', 41]]) && same(await regs('kick'), [[9, 17, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]) && same((await regs('hats'))[0], [5, 9, 12]), [await marks(), await regs('kick'), await regs('hats')])
ok('its marker is the one chosen', await ev(`return S.focus === 'marker' && S.selM === 5`))
await ev(`partAct(1, 'later')`)
ok('and moved back after it: every region as it was, the cuts healed', (await all()) === whole && same(await marks(), M0), [await regs('air'), await marks()])
await undo(); await undo()
ok('both undone', (await all()) === whole && same(await marks(), M0))
await ev(`partAct(5, 'later')`)
ok('the last chorus moved after the out', same(await marks(), [['intro', 1], ['verse', 5], ['pre', 13], ['chorus', 17], ['verse 2', 25], ['out', 33], ['chorus', 35]]), await marks())
await undo()
ok('the first part cannot go earlier, the last cannot go later', await ev(`const n = UNDO.length; partAct(0, 'earlier'); partAct(SCENES.length - 1, 'later'); return UNDO.length === n`))

// ── a line keeps its shape ──
await ev(`edit(() => { const h = S.tracks.find(t => t.name === 'hum'); addPoint(h, 'vol', 12, -6); addPoint(h, 'vol', 20, -20) })`)
const lineAt = pos => ev(`return autoAt(S.tracks.find(t => t.name === 'hum'), 'vol', ${pos})`)
ok('a line from −6 at bar 13 down to −20 at bar 21', (await lineAt(12)) === -6 && (await lineAt(16)) === -13 && (await lineAt(20)) === -20)
await ev(`timeAct.cut(14, 18)`)
ok('four bars cut out of the middle of its slope: before the cut it runs as it did', Math.abs((await lineAt(13)) + 7.75) < 1e-9 && Math.abs((await lineAt(14)) + 9.5) < 1e-9, [await lineAt(13), await lineAt(14)])
ok('and after it too, a step between', Math.abs((await lineAt(14.002)) + 16.5) < .01 && Math.abs((await lineAt(15)) + 18.25) < .01 && (await lineAt(16)) === -20, [await lineAt(14.002), await lineAt(15), await lineAt(16)])
await ev(`timeAct.put(14)`)
ok('put back in where it was: the line is the slope again', Math.abs((await lineAt(13)) + 7.75) < 1e-9 && Math.abs((await lineAt(16)) + 13) < .01 && Math.abs((await lineAt(19)) + 18.25) < .01 && (await lineAt(20)) === -20, [await lineAt(13), await lineAt(16), await lineAt(19), await ev(`return S.tracks.find(t => t.name === 'hum').autos.vol.map(q => [+q.b.toFixed(3), +q.v.toFixed(2)])`)])
ok('and so are the regions', same(await regs('kick'), K0) && same(await regs('air'), [[1, 43, 0]]), [await regs('kick'), await regs('air')])
await undo(); await undo()
await ev(`timeAct.room(16, 4)`)
ok('room made in the middle of the slope: the line holds its level across the new bars and goes on after them', Math.abs((await lineAt(16)) + 13) < 1e-9 && Math.abs((await lineAt(18)) + 13) < 1e-9 && Math.abs((await lineAt(20)) + 13) < .01 && Math.abs((await lineAt(22)) + 16.5) < .01 && (await lineAt(24)) === -20, [await lineAt(16), await lineAt(18), await lineAt(20), await lineAt(22), await lineAt(24)])
ok('and everything from there on is four bars later, the long region cut where the room is', same(await regs('kick'), [[5, 13, 4], [21, 29, 16], [29, 37, 24], [37, 45, 32]]) && same(await regs('air'), [[1, 17, 0], [21, 47, 16]]), [await regs('kick'), await regs('air')])
await undo(); await undo()
ok('undone', (await all()) === whole && same(await marks(), M0))

// ── by the cycle, with his logic keys ──
await ev(`setCycle(16, 24, true); S.pos = 0`)
await key('x', 'KeyX', 88, 6)
ok('control command x: the cycle’s stretch is cut out of the song', same(await regs('kick'), [[5, 13, 4], [17, 25, 24], [25, 33, 32]]) && same(await marks(), [['intro', 1], ['verse', 5], ['pre', 13], ['verse 2', 17], ['chorus', 25], ['out', 33]]), [await regs('kick'), await marks()])
await ev(`S.pos = 4`)
await key('v', 'KeyV', 86, 6)
ok('control command v: put in at the playhead', same(await regs('kick'), [[5, 13, 16], [13, 21, 4], [25, 33, 24], [33, 41, 32]]) && same(await marks(), [['intro', 1], ['chorus', 5], ['verse', 13], ['pre', 21], ['verse 2', 25], ['chorus', 33], ['out', 41]]), [await regs('kick'), await marks()])
await undo(); await undo()
await ev(`setCycle(16, 24, true)`)
await key('r', 'KeyR', 82, 6)
ok('control command r: the cycle’s stretch said twice', same(await regs('kick'), [[5, 13, 4], [17, 25, 16], [25, 33, 16], [33, 41, 24], [41, 49, 32]]), await regs('kick'))
await undo()
await key('z', 'KeyZ', 90, 6)
ok('control command z: room as long as the cycle, where the cycle begins', same(await regs('kick'), [[5, 13, 4], [25, 33, 16], [33, 41, 24], [41, 49, 32]]) && await ev(`return S.cycle.a === 24 && S.cycle.b === 32`), [await regs('kick'), await ev('return S.cycle')])
await undo()

// ── a crossfade that the cut runs through ──
await ev(`const rs = S.tracks.find(t => t.name === 'kick').regs.slice().sort((x, y) => x.a - y.a); edit(() => { crossfade(rs[1], rs[2], 1) })`)
await ev(`timeAct.cut(22, 26)`)
ok('time cut through a crossfade: plain ends on both sides, nothing left hanging', await ev(`const rs = S.tracks.find(t => t.name === 'kick').regs.slice().sort((x, y) => x.a - y.a); return rs.length === 4 && rs[1].b === 23 && rs[2].a === 23 && !rs[1].fo && !rs[2].fi && rs[2].off === 26`), await regs('kick'))
await undo(); await undo()

// ── the marker's own menu ──
{ const p = await ev(`const el = document.querySelector('[data-a="scene"][data-i="2"]').getBoundingClientRect(); return { x: el.left + 8, y: el.top + el.height / 2 }`)
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'right', buttons: 2, clickCount: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'right', clickCount: 1 }); await b.sleep(80)
  ok('a marker’s menu offers the part', same(await ev(`return S.menu && S.menu.items.map(i => i.t)`), ['rename', 'cycle this part', 'repeat this part', 'move it earlier', 'move it later', 'cut it out of the song', 'new marker at the playhead', 'delete the marker']), await ev(`return S.menu && S.menu.items.map(i => i.t)`))
  const i = await ev(`return S.menu.items.findIndex(it => it.t === 'move it later')`)
  const q = await ev(`const el = document.querySelector('[data-a="pick"][data-i="${i}"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(q.x, q.y); await b.sleep(80)
  ok('move it later, picked there: the pre stands after the chorus', same(await marks(), [['intro', 1], ['verse', 5], ['chorus', 13], ['pre', 21], ['verse 2', 25], ['chorus', 33], ['out', 41]]), await marks()) }
await undo()
ok('all undone at the end', (await all()) === whole && same(await marks(), M0))
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
