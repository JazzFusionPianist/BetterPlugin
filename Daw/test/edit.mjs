// node test/edit.mjs — editing, round 1: one sound at a time on a track (what is placed covers what was under it), crossfades
// as two fades that share a stretch, the playhead and the marquee going from beginning to beginning, trimming to the playhead
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const regs = name => ev(`return S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4), +(r.off || 0).toFixed(4)])`)
const overlaps = name => ev(`const rs = S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.slice().sort((x, y) => x.a - y.a); let n = 0; for (let i = 0; i + 1 < rs.length; i++) if (rs[i].b - rs[i + 1].a > 1e-6 && !xfadeOf(rs[i], rs[i + 1])) n++; return n`)
const at = (name, bar) => ev(`const i = S.tracks.findIndex(t => t.name === ${JSON.stringify(name)}), r = document.getElementById('board').getBoundingClientRect(); return { x: r.left + bx(${bar}), y: r.top + rowY(i) + S.rh / 2 }`)
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(60) }
const undo = () => key('z', 'KeyZ', 90, 4)
// how loud a track is over a stretch, printed dry by the page's own engine (rms), and the samples themselves for comparing
const rms = (name, a0, a1) => ev(`const t = S.tracks.find(t => t.name === ${JSON.stringify(name)}), buf = await renderStem(t, ${a0}, ${a1}, 'dry'), d = buf.getChannelData(0), n = Math.floor((${a1} - ${a0}) * SPB() * buf.sampleRate); let s = 0; for (let i = 0; i < n; i++) s += d[i] * d[i]; return Math.sqrt(s / n)`)
await ev(`window.__keep = async (name, a0, a1) => { const t = S.tracks.find(t => t.name === name), buf = await renderStem(t, a0, a1, 'dry'); return buf.getChannelData(0).slice(0, Math.floor((a1 - a0) * SPB() * buf.sampleRate)) }; window.__diff = (x, y) => { let m = 0; for (let i = 0; i < Math.min(x.length, y.length); i++) m = Math.max(m, Math.abs(x[i] - y[i])); return m }; window.__rms = (x, i0, i1) => { let s = 0; for (let i = i0; i < i1; i++) s += x[i] * x[i]; return Math.sqrt(s / (i1 - i0)) }`)

// ── a region dragged onto another: the one under it gives way ──
const before = await rms('kick', 16, 18)
{ const p = await at('kick', 9), q = await at('kick', 15); await b.dragTo(p.x, p.y, q.x, p.y, 8); await b.sleep(80) }
ok('dragged six bars on, over the next region: that one now begins where this one ends', JSON.stringify(await regs('kick')) === JSON.stringify([[11, 19, 4], [19, 25, 18], [25, 33, 24], [33, 41, 32]]), await regs('kick'))
ok('nothing lies on anything', (await overlaps('kick')) === 0)
{ const after = await rms('kick', 16, 18); ok('and it is one kick that sounds there, not two', Math.abs(after / before - 1) < .05, [before, after]) }
// ── an edge pulled out over a neighbour ──
{ const p = await at('kick', 19), q = await at('kick', 21); await b.dragTo(p.x - 2, p.y, q.x, p.y, 8); await b.sleep(80) }
ok('its end pulled two bars over its neighbour: the neighbour begins two bars later', JSON.stringify(await regs('kick')) === JSON.stringify([[11, 21, 4], [21, 25, 20], [25, 33, 24], [33, 41, 32]]), await regs('kick'))
await undo(); ok('undo gives the neighbour back', JSON.stringify(await regs('kick')) === JSON.stringify([[11, 19, 4], [19, 25, 18], [25, 33, 24], [33, 41, 32]]), await regs('kick'))
await undo(); ok('and again: as it was written', JSON.stringify(await regs('kick')) === JSON.stringify([[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]), await regs('kick'))
// ── pasted into the middle of a long region: it is cut in two around what was pasted ──
{ const p = await at('hats', 15); await b.click(p.x, p.y); await key('c', 'KeyC', 67, 4)
  await ev(`S.sel = S.tracks.findIndex(t => t.name === 'air'); S.pos = 8`); await key('v', 'KeyV', 86, 4) }
ok('pasted into the middle of one long region: two pieces around it', JSON.stringify(await regs('air')) === JSON.stringify([[1, 9, 0], [9, 13, 12], [13, 43, 12]]), await regs('air'))
ok('nothing lies on anything there', (await overlaps('air')) === 0)
await undo()
// ── repeated over what follows ──
{ const p = await at('snare', 9); await b.click(p.x, p.y); await key('r', 'KeyR', 82, 4) }
ok('repeated over the region that follows: its first four bars give way', JSON.stringify(await regs('snare')) === JSON.stringify([[5, 13, 4], [13, 21, 4], [21, 25, 20], [25, 33, 24], [33, 41, 32]]), await regs('snare'))
await undo()
// ── nudged into a neighbour ──
{ const p = await at('hats', 15); await b.click(p.x, p.y); await key('ArrowRight', 'ArrowRight', 39, 1) }
ok('nudged a beat into its neighbour', JSON.stringify(await regs('hats')) === JSON.stringify([[13.25, 17.25, 12], [17.25, 25, 16.25], [33, 41, 32]]), await regs('hats'))
await undo()
// ── two that are moved together stay as they are to each other ──
await ev(`const t = S.tracks.find(t => t.name === 'kick'); S.selR = [t.regs[1].id, t.regs[2].id]; S.sel = 0; __daw.redraw()`)
{ const p = await at('kick', 20), q = await at('kick', 22); await b.dragTo(p.x, p.y, q.x, p.y, 8); await b.sleep(80) }
ok('two moved together: neither cuts the other, and the one they ran into gives way', JSON.stringify(await regs('kick')) === JSON.stringify([[5, 13, 4], [19, 27, 16], [27, 35, 24], [35, 41, 34]]), await regs('kick'))
await undo()

// ── a crossfade: a region cut in two, each half let run on past the cut ──
const whole = await ev(`window.__whole = await __keep('bass', 4, 12); return __whole.length`)
await ev(`const t = S.tracks.find(t => t.name === 'bass'), r = t.regs.find(x => x.a === 5); S.selR = [r.id]; S.pos = 8; act.splitAtPlayhead()`)
ok('cut in two at bar nine', JSON.stringify(await regs('bass')).startsWith('[[5,9,4],[9,13,8]'), await regs('bass'))
const zone = `Math.floor(3.7 * SPB() * SND_SR), Math.floor(4.3 * SPB() * SND_SR)`, loud0 = await ev(`return __rms(__whole, ${zone})`)
{ const r = await ev(`const x = await __keep('bass', 4, 12); return [__diff(__whole, x), __rms(x, ${zone})]`); ok('a plain cut changes nothing in the sound (to a hair: the browser starts each piece at a time, not at a sample)', r[0] < .03 && Math.abs(r[1] / loud0 - 1) < .003, r) }
const made = await ev(`const t = S.tracks.find(t => t.name === 'bass'), rs = t.regs.slice().sort((x, y) => x.a - y.a); window.__A = rs[0]; window.__B = rs[1]; return [crossfade(__A, __B, .5), __A.b, __B.a, __B.off, __A.fo, __B.fi, __A.foc, xfadeOf(__A, __B)]`)
ok('crossfaded over half a bar: each runs a quarter of a bar past the cut, with the plain curve (they are one sound)', JSON.stringify(made) === JSON.stringify(['cross', 9.25, 8.75, 7.75, .5, .5, 0, .5]), made)
{ const r = await ev(`const x = await __keep('bass', 4, 12); return [__diff(__whole, x), __rms(x, ${zone})]`); ok('and still nothing changes in the sound: the two halves add up to the whole', r[0] < .03 && Math.abs(r[1] / loud0 - 1) < .003, [r, loud0]) }
{ const r = await ev(`const sr = SND_SR, i0 = Math.floor(3.8 * SPB() * sr), i1 = Math.floor(4.2 * SPB() * sr), plain = __rms(await __keep('bass', 4, 12), i0, i1); __A.foc = __B.fic = 1; const pow = __rms(await __keep('bass', 4, 12), i0, i1); __A.foc = __B.fic = 0; return [plain, pow, 20 * Math.log10(pow / plain)]`); ok('the equal-power curve on one sound swells in the middle (it is for two different sounds)', r[2] > 1 && r[2] < 3.2, r) }
ok('the tidying leaves a crossfade alone', await ev(`const t = S.tracks.find(t => t.name === 'bass'); settleTrack(t); return xfadeOf(__A, __B) === .5 && __A.b === 9.25`))
ok('a crossfade is not an overlap', (await overlaps('bass')) === 0)
ok('undone by hand: a plain join again, in the middle', await ev(`return uncross(__A, __B) && __A.b === 9 && __B.a === 9 && __B.off === 8 && !__A.fo && !__B.fi`), await regs('bass'))
{ const r = await ev(`const x = await __keep('bass', 4, 12); return [__diff(__whole, x), __rms(x, ${zone})]`); ok('and the sound is the whole again', r[0] < .03 && Math.abs(r[1] / loud0 - 1) < .003, r) }
// two different sounds that meet: the equal-power curve by itself; a file with nothing to run on fades inside itself
ok('two different sounds: the equal-power curve is taken', await ev(`const k = S.tracks.find(t => t.name === 'kick').regs.find(x => x.a === 5), X = cloneReg(k, { a: 13, b: 17, buf: 'snare', off: 0 }); S.tracks.find(t => t.name === 'kick').regs.push(X); const got = crossfade(k, X, .25); const r = [got, k.foc, X.fic, +xfadeOf(k, X).toFixed(4)]; uncross(k, X); S.tracks.find(t => t.name === 'kick').regs.pop(); return JSON.stringify(r) === JSON.stringify(['cross', 1, 1, .25])`))
ok('files with no sound to run on: each fades inside itself instead', await ev(`const F1 = mkReg({ a: 1, b: 2, key: 'file:a', loop: false, rate: 1, sec: SPB(), srcBars: 1, off: 0 }), F2 = mkReg({ a: 2, b: 3, key: 'file:b', loop: false, rate: 1, sec: SPB(), srcBars: 1, off: 0 }); const got = crossfade(F1, F2, .25); return got === 'fades' && F1.b === 2 && F2.a === 2 && F1.fo === .125 && F2.fi === .125`))
ok('a file with sound on one side only: that side gives all of it', await ev(`const F1 = mkReg({ a: 1, b: 2, key: 'file:a', loop: false, rate: 1, sec: 2 * SPB(), srcBars: 2, off: 0 }), F2 = mkReg({ a: 2, b: 3, key: 'file:b', loop: false, rate: 1, sec: SPB(), srcBars: 1, off: 0 }); const got = crossfade(F1, F2, .25); return got === 'cross' && F1.b === 2.25 && F2.a === 2 && F1.fo === .25 && F2.fi === .25`))
await undo()

// ── the tempo moves under files that keep their length in seconds ──
ok('the tempo goes up: a file that now runs into the next is cut where the next begins', await ev(`
  const t = newTrack('audio', 'files'), len = 4 / SPB()                                         // two files of four seconds, one after the other
  t.regs.push(mkReg({ a: 1, b: 1 + len, key: 'file:x', loop: false, rate: 1, sec: 4, srcBars: len }), mkReg({ a: 1 + len, b: 1 + 2 * len, key: 'file:y', loop: false, rate: 1, sec: 4, srcBars: len }))
  const second = t.regs[1].a
  setTempo(120)
  const rs = t.regs.slice().sort((x, y) => x.a - y.a)
  const r = [rs.length === 2, Math.abs(rs[0].b - second) < 1e-9, Math.abs(rs[1].a - second) < 1e-9, Math.abs((rs[1].b - rs[1].a) - 2) < 1e-6]
  setTempo(92); deleteTrack(S.tracks.indexOf(t))
  return r.every(Boolean)`))
await b.sleep(200)

// ── from beginning to beginning ──
await ev(`
  const t = S.tracks.find(t => t.name === 'guitar'); t.theirs = null
  window.__F = mkReg({ a: 1, b: 3, key: 'file:t', loop: false, rate: 1, sec: 2 * SPB(), srcBars: 2, off: 0, name: 'take' })
  t.regs.push(__F); TRANS.set('file:t', [.5, 1.3, 2.6, 4])                                       // beginnings found in the file, in seconds
  S.selR = [__F.id]; S.sel = S.tracks.indexOf(t); S.pos = 0; S.marq = null; __daw.redraw()`)
const posOf = s => ev(`return +(${s} / SPB()).toFixed(6)`)
const pos = () => ev(`return +S.pos.toFixed(6)`)
await key('Tab', 'Tab', 9); ok('tab: to the first beginning in the file', (await pos()) === (await posOf(.5)), await pos())
await key('Tab', 'Tab', 9); ok('tab: to the next', (await pos()) === (await posOf(1.3)), await pos())
await key('.', 'Period', 190, 2); ok('control period does the same (his logic key)', (await pos()) === (await posOf(2.6)), await pos())
await key('Tab', 'Tab', 9, 1); ok('option tab: back one', (await pos()) === (await posOf(1.3)), await pos())
await key(',', 'Comma', 188, 2); ok('control comma: back again', (await pos()) === (await posOf(.5)), await pos())
await ev(`S.pos = ${await posOf(4)} + .0001`); await key('Tab', 'Tab', 9); ok('past the last beginning: to the region’s end', (await pos()) === 2, await pos())
await key('Tab', 'Tab', 9); ok('and on to where the next region begins', (await pos()) === 12, await pos())
await ev(`S.pos = ${await posOf(.5)}; S.selR = [__F.id]`)
await key('t', 'KeyT', 84, 4); ok('cut there: the region is two', await ev(`const t = S.tracks.find(t => t.name === 'guitar'); const rs = t.regs.filter(r => r.key === 'file:t').sort((x, y) => x.a - y.a); return rs.length === 2 && Math.abs(rs[0].b - 1 - ${await posOf(.5)}) < 1e-6`))
await undo()
await ev(`S.selR = [__F.id]; S.pos = 0; S.marq = null`)
await key('Tab', 'Tab', 9, 8); ok('shift tab: a marquee from the playhead to the first beginning', await ev(`return !!S.marq && S.marq.a === 0 && +S.marq.b.toFixed(6) === ${await posOf(.5)} && S.marq.t0 === S.sel && S.marq.t1 === S.sel`), await ev('return S.marq'))
await key('Tab', 'Tab', 9, 8); ok('again: one beginning further', await ev(`return +S.marq.b.toFixed(6) === ${await posOf(1.3)}`))
await key('ArrowRight', 'ArrowRight', 39); ok('with a marquee up, the arrow takes its end to the next beginning', await ev(`return +S.marq.b.toFixed(6) === ${await posOf(2.6)}`))
await key('ArrowLeft', 'ArrowLeft', 37); ok('and back', await ev(`return +S.marq.b.toFixed(6) === ${await posOf(1.3)}`))
await key('ArrowRight', 'ArrowRight', 39, 8); ok('with shift: its start', await ev(`return +S.marq.a.toFixed(6) === ${await posOf(.5)}`))
await key('Backspace', 'Backspace', 8); ok('delete: what the marquee held is gone, cut at beginnings', await ev(`const t = S.tracks.find(t => t.name === 'guitar'); const rs = t.regs.filter(r => r.key === 'file:t').sort((x, y) => x.a - y.a); return rs.length === 2 && Math.abs(rs[0].b - 1 - ${await posOf(.5)}) < 1e-6 && Math.abs(rs[1].a - 1 - ${await posOf(1.3)}) < 1e-6`))
await undo()

// ── to the playhead ──
await ev(`const t = S.tracks.find(t => t.name === 'snare'), r = t.regs.find(x => x.a === 17); S.selR = [r.id]; S.marq = null; S.pos = 18; window.__R = r.id`)
await key('[', 'BracketLeft', 219, 4); ok('command [: it begins at the playhead', await ev(`const r = regOf(__R)[0]; return r.a === 19 && r.b === 25 && r.off === 18`), await regs('snare'))
await ev(`S.pos = 22`); await key(']', 'BracketRight', 221, 4); ok('command ]: it ends at the playhead', await ev(`const r = regOf(__R)[0]; return r.a === 19 && r.b === 23`), await regs('snare'))
await ev(`S.pos = 27`); await key(']', 'BracketRight', 221, 4); ok('pulled out to the playhead over the next region: that one gives way', JSON.stringify(await regs('snare')) === JSON.stringify([[5, 13, 4], [19, 28, 18], [28, 33, 27], [33, 41, 32]]), await regs('snare'))
await undo(); await undo(); await undo()
ok('all undone', JSON.stringify(await regs('snare')) === JSON.stringify([[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]), await regs('snare'))

ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
