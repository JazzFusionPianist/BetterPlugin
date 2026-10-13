// node test/nest.mjs — stacks inside stacks: tracks in a stack can be put in a stack of their own inside it; stacks can be
// put in a stack; what is in a stack inside a stack plays into that stack, and that one into the one it stands in; shut at
// any depth hides all that is in it; the rows step in once for each stack; a stack pulled into another stack goes with all
// that is in it; a stack taken apart leaves what was in it where the stack stood; never deeper than the room allows; undo.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const tree = () => ev(`flush(); return S.tracks.map(t => t.name + (t.kind === 'stack' ? '*' : '') + ':' + (t.parent ? byId(t.parent).name : '-') + ':' + depthOf(t))`)
const pick = names => ev(`const ns = ${JSON.stringify(names)}; const ts = ns.map(n => S.tracks.find(t => t.name === n)); S.sel = S.tracks.indexOf(ts[0]); S.selT = ts.map(t => t.id); S.focus = 'tracks'; S.selR = []; flush()`)
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.selR = []; dirtyAll(); flush()`)
/* kick, snare, hats in a stack: drums */
await pick(['kick', 'snare', 'hats']); await ev(`makeStack(); const st = S.tracks[S.sel]; st.name = 'drums'; flush()`)
ok('three tracks in a stack', JSON.stringify((await tree()).slice(0, 4)) === JSON.stringify(['drums*:-:0', 'kick:drums:1', 'snare:drums:1', 'hats:drums:1']), (await tree()).slice(0, 5))
/* two of them in a stack of their own, inside it */
await pick(['kick', 'snare']); await ev(`makeStack(); S.tracks[S.sel].name = 'shells'; flush()`)
const t1 = await tree()
ok('two tracks of a stack put in a stack of their own: it stands inside the first', JSON.stringify(t1.slice(0, 5)) === JSON.stringify(['drums*:-:0', 'shells*:drums:1', 'kick:shells:2', 'snare:shells:2', 'hats:drums:1']), t1.slice(0, 6))
ok('…and plays into it, as its tracks play into the inner one', await ev(`const k = S.tracks.find(t => t.name === 'kick'), sh = S.tracks.find(t => t.name === 'shells'), dr = S.tracks.find(t => t.name === 'drums'); return destId(k) === sh.id && destId(sh) === dr.id && destId(dr) === 0 && reaches(k, dr) && !reaches(dr, k)`))
/* the head steps in */
{ const r = await ev(`flush(); const xs = n => { const i = S.tracks.findIndex(t => t.name === n), g = document.getElementById('hd-' + i), tx = [...g.querySelectorAll('text')].find(e => e.textContent === n); return tx ? +tx.getAttribute('x') : null }; return [xs('drums'), xs('shells'), xs('kick'), xs('hats'), xs('bass')]`)
  ok('each row steps in once for each stack it stands in', r[0] === 42 && r[1] === 58 && r[2] === 74 && r[3] === 58 && r[4] === 42, r) }
/* shut at any depth */
{ const all = await ev(`return rows().length`)
  await ev(`S.tracks.find(t => t.name === 'shells').open = false; dirtyAll(); flush()`)
  const inner = await ev(`return rows().map(i => S.tracks[i].name)`)
  await ev(`S.tracks.find(t => t.name === 'shells').open = true; S.tracks.find(t => t.name === 'drums').open = false; dirtyAll(); flush()`)
  const outer = await ev(`return rows().map(i => S.tracks[i].name)`)
  await ev(`S.tracks.find(t => t.name === 'drums').open = true; dirtyAll(); flush()`)
  ok('the inner stack shut: its two tracks are hidden, the rest of the outer one shows', inner.length === all - 2 && !inner.includes('kick') && inner.includes('hats') && inner.includes('shells'), inner)
  ok('the outer stack shut: all that is in it is hidden, the inner stack and its tracks too', outer.length === all - 4 && !outer.includes('shells') && !outer.includes('kick') && !outer.includes('hats'), outer) }
/* solo of a track deep inside: the stacks it plays through stay open */
{ const r = await ev(`const k = S.tracks.find(t => t.name === 'kick'); k.solo = true; const got = ['kick', 'shells', 'drums', 'hats', 'bass'].map(n => heard(S.tracks.find(t => t.name === n))); k.solo = false; return got`)
  ok('a track two stacks deep soloed: it is heard, through both stacks; what is beside it is not', r[0] && r[1] && r[2] && !r[3] && !r[4], r) }
/* a stack of stacks: bass and guitar in a stack, then that stack and drums in one */
await pick(['bass', 'guitar']); await ev(`makeStack(); S.tracks[S.sel].name = 'strings'; flush()`)
await pick(['drums', 'strings']); await ev(`makeStack(); S.tracks[S.sel].name = 'band'; flush()`)
const t2 = await tree()
ok('two stacks put in a stack: they stand in it with all that is in them', t2.includes('band*:-:0') && t2.includes('drums*:band:1') && t2.includes('shells*:drums:2') && t2.includes('kick:shells:3') && t2.includes('strings*:band:1') && t2.includes('bass:strings:2'), t2)
ok('…in order: a stack, then what is in it, all the way down', JSON.stringify(t2.slice(0, 9).map(s => s.split(':')[0])) === JSON.stringify(['band*', 'drums*', 'shells*', 'kick', 'snare', 'hats', 'strings*', 'bass', 'guitar']), t2.slice(0, 9))
/* no deeper than the room allows */
{ await pick(['kick']); await ev(`makeStack(); flush()`)
  const d4 = await ev(`return depthOf(S.tracks.find(t => t.name === 'kick'))`)
  await pick(['kick']); const n0 = await ev(`return S.tracks.length`); await ev(`makeStack(); flush()`)
  ok('four stacks deep, and no deeper: the next one is not made', d4 === 4 && (await ev(`return S.tracks.length`)) === n0 && (await ev(`return depthOf(S.tracks.find(t => t.name === 'kick'))`)) === 4, [d4, n0])
  await ev(`undoEdit(); flush()`)
  ok('undone: three deep again', (await ev(`return depthOf(S.tracks.find(t => t.name === 'kick'))`)) === 3) }
/* a stack pulled into another stack goes with what is in it; pulled out again */
{ await ev(`const st = S.tracks.find(t => t.name === 'strings'), sh = S.tracks.find(t => t.name === 'shells'), vis = rows(); moveTracks([st], vis.indexOf(S.tracks.indexOf(S.tracks.find(t => t.name === 'snare')))); flush()`)
  const t3 = await tree()
  ok('a stack let go in front of a row inside another stack stands in that stack, with all that is in it', t3.includes('strings*:shells:3') && t3.includes('bass:strings:4') && t3.indexOf('strings*:shells:3') === t3.indexOf('kick:shells:3') + 1, t3.slice(0, 10))
  await ev(`const dr = S.tracks.find(t => t.name === 'drums'), vis = rows(); moveTracks([dr], vis.indexOf(S.tracks.indexOf(S.tracks.find(t => t.name === 'bass')))); flush()`)
  ok('a stack cannot be let go inside itself: nothing moves', JSON.stringify(await tree()) === JSON.stringify(t3))
  await ev(`undoEdit(); flush()`)
  ok('undone: where it was', JSON.stringify(await tree()) === JSON.stringify(t2), (await tree()).slice(0, 10)) }
/* its way out, from the list: a stack may play into a stack, never into one that is inside it */
{ const r = await ev(`const dr = S.tracks.find(t => t.name === 'drums'), sh = S.tracks.find(t => t.name === 'shells'), band = S.tracks.find(t => t.name === 'band'); return { shCanDr: canFeed(sh, dr), drCanSh: canFeed(dr, sh), bandCanSh: canFeed(band, sh) }`)
  ok('a stack may play into the stack it stands in; never into one that is inside it', r.shCanDr && !r.drCanSh && !r.bandCanSh, r) }
/* a stack taken apart: what was in it stands where the stack stood */
{ await ev(`deleteTrack(S.tracks.indexOf(S.tracks.find(t => t.name === 'drums'))); flush()`); await b.sleep(150)
  const t4 = await tree()
  ok('the middle stack taken away: what was in it stands in the stack that one stood in', !t4.some(s => s.startsWith('drums*')) && t4.includes('shells*:band:1') && t4.includes('kick:shells:2') && t4.includes('hats:band:1'), t4.slice(0, 9))
  await ev(`undoEdit(); flush()`); await b.sleep(100)
  ok('undone: the three levels again', JSON.stringify(await tree()) === JSON.stringify(t2), (await tree()).slice(0, 9)) }
/* written and read */
{ const r = await ev(`const o = JSON.parse(serialize()); return o.tracks.filter(t => t.parent).length`)
  ok('written with the project: every track says the stack it stands in', r === 8, r) }
{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
await b.shot('nest.png')
console.log(out.join('\n'))
console.log(bad.length ? `nest: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'nest: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
