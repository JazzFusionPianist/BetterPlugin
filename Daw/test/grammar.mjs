// node test/grammar.mjs — the command line's one grammar, past round one (ui/say.js sayValue, hint.js autoWrite, auto.js
// curves): a value of a track — its level, pan, prints, a plug-in's control, a macro — set, moved for a stretch, ramped
// (bent: exponentially, logarithmically, s-curve) or swept from one value to another; how much asked for when it is not
// said; which regions by after / before; all but some by except; fades in ms; and the plain lines the old patterns read.
// His three examples (2026-10-16) are the first three checks.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const say = async line => { await ev(`await runCommand(${JSON.stringify(line)}); flush()`); await b.sleep(30); return ev(`const L = S.last || {}; return L.say || (L.res || []).map(a => a.text || a.k).join(' | ')`) }
const line = (track, k) => ev(`const t = S.tracks.find(x => x.name === ${JSON.stringify(track)}); return autoPts(t, ${JSON.stringify(k)}).map(q => [+q.b.toFixed(3), +q.v.toFixed(3), q.c || ''])`)
const at = (track, k, pos) => ev(`const t = S.tracks.find(x => x.name === ${JSON.stringify(track)}); return autoAt(t, ${JSON.stringify(k)}, ${pos})`)
const fresh = () => ev(`while (UNDO.length) undoEdit(); REDO.length = 0; S.selR = []; S.selT = []; S.marq = null; S.pos = 0; SAY.ask = null; S.last = null; flush()`)
await ev(`if (typeof START !== 'undefined') START.on = false; dirtyAll(); flush()`)
const v0 = await ev(`return S.tracks.find(t => t.name === 'kick').vol`)

/* 1. "25~31마디에서 킥을 점점 exponentially 키워줘" */
ok('1  raise kick exponentially from 25 to 31 by 6 db: a ramp on its volume, bent', /kick|volume/.test(await say('raise kick exponentially from 25 to 31 by 6 db')) && JSON.stringify(await line('kick', 'vol')) === JSON.stringify([[24, v0, 'exp'], [31, v0 + 6, '']]), await line('kick', 'vol'))
{ const mid = await at('kick', 'vol', 27.5), lin = v0 + 3
  ok('…slow, then fast: halfway along it has risen far less than half', mid < lin - 1.5 && mid > v0, [mid, lin]) }
ok('…and it stays raised after the stretch', Math.abs(await at('kick', 'vol', 38) - (v0 + 6)) < 1e-9)
ok('…the app is told the bend as a run of points', await ev(`const t = S.tracks.find(x => x.name === 'kick'); const m = autoMsg(t).find(x => x.p === 0); return m && m.pts.length > 20`))
ok('…one step back takes it all away', await ev(`undoEdit(); return autoPts(S.tracks.find(x => x.name === 'kick'), 'vol').length === 0`))
ok('…said without how much: it asks', (await say('raise kick exponentially from 25 to 31')) === 'by how much' && await ev('return autoPts(S.tracks.find(x => x.name === "kick"), "vol").length === 0'))
ok('…and the answer finishes the line', /kick/.test(await say('6 db')) && JSON.stringify(await line('kick', 'vol')) === JSON.stringify([[24, v0, 'exp'], [31, v0 + 6, '']]), await line('kick', 'vol'))
await fresh()

/* 2. "26~32마디에서 macro 값을 -15dB 에서 0dB 까지 점점 키워줘" — a macro named by what it is wired to */
await ev(`const t = S.tracks.find(x => x.name === 'keys'); t.inserts = [{ n: 1, name: 'Pro-Q 3', uid: 0, pl: [[0, 'Gain', '0.5', '0.0 dB'], [1, 'Frequency', '0.5', '1000 Hz']], ps: { 0: { texts: ['-30', '-15', '0', '15', '30'], unit: 'dB' } } }]
  t.macros = [{ id: 1, name: 'Gain', v: .5, to: { n: 1, i: 0, plug: 'Pro-Q 3' } }]; SAY.vocab = null; flush()`)
ok('2  ramp macro gain from -15 db to 0 db over 26 to 32: the macro’s line, in the dB of the control it turns', /gain/i.test(await say('ramp macro gain from -15 db to 0 db over 26 to 32')) && JSON.stringify(await line('keys', 'mac1')) === JSON.stringify([[25, 0.5, ''], [25, 0.25, ''], [32, 0.5, '']]), [await last(), await line('keys', 'mac1')])
await fresh()
ok('…the same said of the plug-in itself: its own control’s line', /gain/.test(await say('set pro-q 3 gain to -15 db from 9 to 16')) && JSON.stringify(await line('keys', 'fx1.0')) === JSON.stringify([[8, 0.5, ''], [8, 0.25, ''], [16, 0.25, ''], [16, 0.5, '']]), await line('keys', 'fx1.0'))
ok('…a unit the control is not said in is refused, nothing drawn', (await say('set pro-q 3 gain to 40 ms from 9 to 16')) === 'pro-q 3 gain is said in db' || /is said in db/.test(await last()), await last())
await fresh()

/* 3. "31마디 이후로 나오는 모든 pad region에 100ms fade-in을 넣어줘" */
await ev(`S.tracks.find(x => x.name === 'keys').name = 'pad'; SAY.vocab = null`)
const regs = () => ev(`return S.tracks.find(x => x.name === 'pad').regs.map(r => [r.a, +(r.fi || 0).toFixed(4)])`)
{ const before = await regs(), spb = await ev('return SPB()')
  const said = await say('add a 100 ms fade in to every pad region after bar 31'), after = await regs()
  ok('3  a 100 ms fade in on every pad region that begins at bar 31 or later, and on no other', /100 ms/.test(said) && after.every(([a, fi]) => a - 1 >= 30 ? Math.abs(fi - .1 / spb) < 1e-3 : fi === 0) && after.some(([a]) => a - 1 >= 30), [said, after, before]) }
await fresh(); await ev(`S.tracks.find(x => x.name === 'pad').name = 'keys'; SAY.vocab = null`)

/* values said plainly: what the old patterns read, now the same grammar */
const read = l => ev(`return JSON.stringify(parseLocal(${JSON.stringify(l)}))`)
ok('kick to -6: the fader to that level', (await read('kick to -6')) === JSON.stringify([{ do: 'volume', track: 'kick', db: -6, mode: 'absolute' }]))
ok('kick pan l 30, pan kick hard right, kick pan center', (await read('kick pan l 30')) === JSON.stringify([{ do: 'pan', track: 'kick', value: -0.3 }]) && (await read('pan kick hard right')) === JSON.stringify([{ do: 'pan', track: 'kick', value: 1 }]) && (await read('kick pan center')) === JSON.stringify([{ do: 'pan', track: 'kick', value: 0 }]), [await read('kick pan l 30'), await read('pan kick hard right')])
ok('guitar space 40, set guitar reverb to 40, kick delay 30, guitar tape 20: a print set', (await read('guitar space 40')) === JSON.stringify([{ do: 'patch', track: 'guitar', print: 'space', value: 40 }]) && (await read('set guitar reverb to 40')) === JSON.stringify([{ do: 'patch', track: 'guitar', print: 'space', value: 40 }]) && (await read('kick delay 30')) === JSON.stringify([{ do: 'patch', track: 'kick', print: 'delay', value: 30 }]), [await read('set guitar reverb to 40'), await read('kick delay 30')])
ok('…but send guitar to reverb is still a send', JSON.parse(await read('send guitar to reverb'))[0].do === 'send')
ok('guitar transpose +2: semitones, as before', (await read('guitar transpose +2')) === JSON.stringify([{ do: 'transpose', track: 'guitar', semitones: 2, mode: 'relative' }]))
ok('kick -3, kick 2 db down, vocals +1: the fader by so much, as before', (await read('kick -3')) === JSON.stringify([{ do: 'volume', track: 'kick', db: -3, mode: 'relative' }]) && JSON.parse(await read('kick 2 db down'))[0].db === -2)
ok('volume is said in db: another unit is refused', /is said in db/.test(await say('raise kick by 10 hz from 9 to 16')), await last())

/* for a stretch and back; gradually; and back; from a bar on */
ok('kick -3 from 9 to 16: lower for the stretch, then back', /kick/.test(await say('kick -3 from 9 to 16')) && JSON.stringify(await line('kick', 'vol')) === JSON.stringify([[8, v0, ''], [8, v0 - 3, ''], [16, v0 - 3, ''], [16, v0, '']]), await line('kick', 'vol'))
await fresh()
ok('lower snare gradually over 9 to 16 by 6 db and back: a straight ramp that comes back at its end', /snare/.test(await say('lower snare gradually over 9 to 16 by 6 db and back')) && await ev(`const t = S.tracks.find(x => x.name === 'snare'), p = autoPts(t, 'vol'); return p.length === 3 && p[1].b === 16 && Math.abs(p[1].v - (t.vol - 6)) < 1e-9 && p[2].b === 16 && p[2].v === t.vol && Math.abs(autoAt(t, 'vol', 12) - (t.vol - 3)) < 1e-9`), await line('snare', 'vol'))
await fresh()
ok('set hats volume to -20 db after bar 33: from that bar on', /hats/.test(await say('set hats volume to -20 db after bar 33')) && await ev(`const t = S.tracks.find(x => x.name === 'hats'); return autoAt(t, 'vol', 31) === t.vol && autoAt(t, 'vol', 40) === -20`), await line('hats', 'vol'))
await fresh()
ok('s-curve and logarithmically bend the other ways', /bass/.test(await say('raise bass logarithmically from 9 to 16 by 6 db')) && await ev(`const t = S.tracks.find(x => x.name === 'bass'); return autoAt(t, 'vol', 12) > t.vol + 3`) && (await fresh(), /bass/.test(await say('raise bass with an s-curve from 9 to 16 by 6 db'))) && await ev(`const t = S.tracks.find(x => x.name === 'bass'); return autoAt(t, 'vol', 9) < t.vol + 1 && Math.abs(autoAt(t, 'vol', 12) - (t.vol + 3)) < 1e-6`), await line('bass', 'vol'))
await fresh()
ok('a ramp with no end is asked over which bars', (await say('ramp kick to -10 db after bar 9')) === 'over which bars')

/* all but some */
ok('mute all except drums: every track but kick, snare and hats', /muted/.test(await say('mute all except drums')) && await ev(`return S.tracks.every(t => ['kick', 'snare', 'hats'].includes(t.name) ? !t.mute : t.mute)`), await ev(`return S.tracks.map(t => [t.name, t.mute])`))
await fresh(); await ev(`for (const t of S.tracks) t.mute = false`)
ok('lower all except vocals by 2 db', /tracks|vol/.test(await say('lower all except vocals by 2 db')) && await ev(`return S.tracks.filter(t => t.kind !== 'bus').every(t => t.name === 'hum' ? t.vol === t.def : t.vol === t.def - 2)`), await ev(`return S.tracks.map(t => [t.name, t.vol, t.def])`))
await fresh()

/* the cells: a ramp can be bent */
await ev(`$('cmd').focus(); S.line = { parts: [], done: false }; flush()`)
for (const [txt, tab] of [['kick', 1], ['volume', 1], ['9~16', 1], ['3', 1], ['raise gradually', 1]]) { await ev(`const c = $('cmd'); c.value = ${JSON.stringify(txt)}; c.dispatchEvent(new Event('input')); flush()`); await b.press('Tab', 'Tab', 9); await b.sleep(80) }
{ const items = await ev(`flush(); return lineList('').map(x => x.t)`), up = await ev(`return !!S.hint`)
  ok('cells: after raise gradually, how it may bend is offered (the list at the foot stays closed: return does it straight)', ['exponentially', 'logarithmically', 's-curve'].every(w => items.includes(w)) && !up, [items, up]) }
await ev(`const c = $('cmd'); c.value = 'exp'; c.dispatchEvent(new Event('input')); flush()`); await b.press('Tab', 'Tab', 9); await b.sleep(80)
await b.press('Enter', 'Enter', 13); await b.sleep(150)
ok('…taken, the line is drawn bent', JSON.stringify(await line('kick', 'vol')) === JSON.stringify([[8, v0, 'exp'], [15, v0 + 3, '']]), await line('kick', 'vol'))
await fresh(); await ev(`S.line = { parts: [], done: false }; $('cmd').value = ''; $('cmd').blur(); flush()`)

/* ── round two (2026-10-16): regions and notes, as the hand edits them ── */
const R = (track, i) => ev(`const t = S.tracks.find(x => x.name === ${JSON.stringify(track)}), r = t.regs.slice().sort((x, y) => x.a - y.a)[${i}]; return { id: r.id, a: +r.a.toFixed(4), b: +r.b.toFixed(4), rev: !!r.rev, tag: r.tag || '', gain: r.gain || 0, grp: r.grp || 0, mute: !!r.mute, foc: r.foc || 0 }`)
const choose = (track, ...ix) => ev(`const t = S.tracks.find(x => x.name === ${JSON.stringify(track)}), rr = t.regs.slice().sort((x, y) => x.a - y.a); S.selR = ${JSON.stringify(ix)}.map(i => rr[i].id); S.focus = 'lanes'; flush()`)
const beat = await ev('return 1 / BEATS()'), spb = await ev('return SPB()')
await fresh(); await choose('kick', 0)
ok('move this later by 1 beat', /later by 1 beat/.test(await say('move this later by 1 beat')) && (await R('kick', 0)).a === +(5 + beat).toFixed(4), [await last(), await R('kick', 0)])
await fresh(); await choose('kick', 0)
ok('nudge these earlier by 100 ms', /earlier by 100 ms/.test(await say('nudge these earlier by 100 ms')) && Math.abs((await R('kick', 0)).a - (5 - .1 / spb)) < 1e-3, [await last(), await R('kick', 0)])
await fresh(); await choose('kick', 0)
ok('make this 2 beats shorter', /shorter by 2 beats/.test(await say('make this 2 beats shorter')) && Math.abs((await R('kick', 0)).b - (13 - 2 * beat)) < 1e-4, [await last(), await R('kick', 0)])
await fresh(); await choose('kick', 0)
ok('…said without how much: it asks, and the answer finishes it', (await say('move this later')) === 'later by how much' && /later by 2 bars/.test(await say('2 bars')) && (await R('kick', 0)).a === 7, [await last(), await R('kick', 0)])
await fresh(); await choose('kick', 0)
ok('trim the end of this to bar 9', /the end at 9\.1\.1/.test(await say('trim the end of this to bar 9')) && (await R('kick', 0)).b === 9 && await ev('return S.pos === 0'), [await last(), await R('kick', 0)])
await fresh(); await choose('kick', 0)
ok('trim the start of this to bar 7', /the start at 7\.1\.1/.test(await say('trim the start of this to bar 7')) && (await R('kick', 0)).a === 7, [await last(), await R('kick', 0)])
await fresh(); await choose('kick', 0)
ok('reverse a loop: the room leaves it as it is, and says so', (await say('reverse this')) === 'loops and notes are not reversed' && !(await R('kick', 0)).rev, await last())
await ev(`const r = S.tracks.find(x => x.name === 'kick').regs.slice().sort((x, y) => x.a - y.a)[0]; r.loop = false; r.srcBars = r.b - r.a; r.off = 0; flush()`)
ok('reverse this', /reversed/.test(await say('reverse this')) && (await R('kick', 0)).rev, await last())
await fresh(); await choose('kick', 0)
ok('rename this to "Verse Take": the name as typed, capitals and all', /called Verse Take/.test(await say('rename this to "Verse Take"')) && (await R('kick', 0)).tag === 'Verse Take', [await last(), await R('kick', 0)])
ok('…and the regions named so are found by it', /1 region chosen/.test(await say('select regions named "verse take"')) && await ev(`return S.selR.length === 1`), await last())
await fresh()
ok('rename kick to "Kick In": a track, when one is named', /kick is Kick In/.test(await say('rename kick to "Kick In"')) && await ev(`return S.tracks[0].name === 'Kick In'`), await last())
await ev(`S.tracks[0].name = 'kick'; SAY.vocab = null`); await fresh(); await choose('kick', 0, 1)
ok('set the gain of these to -3 db, then +2', /gain at −3\.0 db/.test(await say('set the gain of these to -3 db')) && (await R('kick', 0)).gain === -3 && /gain \+2 db/.test(await say('raise their gain by 2 db')) && (await R('kick', 1)).gain === -1, [await last(), await R('kick', 1)])
await fresh(); await choose('kick', 0, 1)
ok('group these regions, and ungroup them', /grouped/.test(await say('group these regions')) && (await R('kick', 0)).grp > 0 && (await R('kick', 0)).grp === (await R('kick', 1)).grp && /ungrouped/.test(await say('ungroup these')) && !(await R('kick', 0)).grp, [await last(), await R('kick', 0)])
await fresh(); await ev(`const t = S.tracks.find(x => x.name === 'snare'), rr = t.regs.slice().sort((x, y) => x.a - y.a); rr[1].mute = rr[3].mute = true; flush()`)
ok('select the muted regions on snare', /2 regions chosen/.test(await say('select the muted regions on snare')) && await ev(`return S.selR.length === 2`), await last())
ok('select regions longer than 10 bars', /chosen/.test(await say('select regions longer than 10 bars')) && await ev(`return S.selR.length === 2 && selRegs().every(([r]) => r.b - r.a > 10)`), [await last(), await ev('return selRegs().map(([r, t]) => [t.name, r.a, r.b])')])
ok('select the first 2 kick regions', /2 regions chosen/.test(await say('select the first 2 kick regions')) && await ev(`return selRegs().map(([r]) => r.a).join() === '5,17'`), await ev('return selRegs().map(([r]) => r.a)'))
await ev(`for (const t of S.tracks) for (const r of t.regs) r.mute = false`); await fresh()
ok('fade out guitar 2 bars with an s-curve', /fade out/.test(await say('fade out guitar 2 bars with an s-curve')) && (await R('guitar', 2)).foc === 2, [await last(), await R('guitar', 2)])
await fresh()
/* notes: a region of notes made on keys */
await ev(`const t = S.tracks.find(x => x.name === 'keys'), r = t.regs.slice().sort((x, y) => x.a - y.a)[0]; t.inst = { kind: 'keys', sound: 'e piano', p: {}, pads: {} }
  r.notes = [48, 52, 55, 60, 64, 67, 72, 76].map((n, k) => mkNote(k * 2, 1, n, 40 + k * 10)); delete r.loop; delete r._ns; dirtyAll(); flush()`)
const N = () => ev(`const t = S.tracks.find(x => x.name === 'keys'), r = t.regs.slice().sort((x, y) => x.a - y.a)[0]; return r.notes.map(x => [x.n, x.v, +x.d.toFixed(3)])`)
const n0 = await N()
ok('delete the notes above c3 on keys (c3 is middle c, key 60)', /4 notes deleted/.test(await say('delete the notes above c3 on keys')) && JSON.stringify((await N()).map(x => x[0])) === JSON.stringify([48, 52, 55, 60]), [await last(), await N()])
await fresh()
ok('transpose the keys notes below c3 by +12', /3 notes \+12 semitones/.test(await say('transpose the keys notes below c3 by +12')) && JSON.stringify((await N()).map(x => x[0])) === JSON.stringify([60, 64, 67, 60, 64, 67, 72, 76]), [await last(), await N()])
await fresh()
ok('set the velocity of keys notes above 80 to 100', /3 notes velocity 100/.test(await say('set the velocity of keys notes above 80 to 100')) && JSON.stringify((await N()).map(x => x[1])) === JSON.stringify([40, 50, 60, 70, 80, 100, 100, 100]), [await last(), await N()])
await fresh()
ok('scale the keys velocities to 50%', /8 notes velocity 50%/.test(await say('scale the keys velocities to 50%')) && JSON.stringify((await N()).map(x => x[1])) === JSON.stringify(n0.map(x => Math.round(x[1] / 2))), [await last(), await N()])
await fresh()
ok('keys velocity -10', /velocity −10/.test(await say('lower the keys velocity by 10')) && (await N())[0][1] === 30, [await last(), await N()])
await fresh()
ok('set the note length on keys to 1/16', /8 notes 1\/16 long/.test(await say('set the note length on keys to 1/16')) && (await N()).every(x => x[2] === .25), [await last(), await N()])
await fresh()
ok('legato the keys notes: each to the next', /legato/.test(await say('legato the keys notes')) && (await N()).slice(0, -1).every(x => x[2] === 2), [await last(), await N()])
await fresh(); await choose('keys', 0)
ok('quantize this 1/16 at 60% strength with 20% swing', /60% strength, 20% swing/.test(await say('quantize this 1/16 at 60% strength with 20% swing')) && await ev(`const r = S.tracks.find(x => x.name === 'keys').regs.slice().sort((x, y) => x.a - y.a)[0]; return r.q === .25 && r.qs === .6 && r.sw === .2`), await last())
await fresh(); await ev(`const t = S.tracks.find(x => x.name === 'keys'); delete t.inst; for (const r of t.regs) { delete r.notes; delete r._ns } dirtyAll(); flush()`)

/* ── every word of the grammar offered by the letters typed (2026-10-16: "what can follow에 뜨는게 거의 없어 … 알파벳에 맞춰") ── */
const typeIn = async v => { await ev(`const c = $('cmd'); c.focus(); c.value = ${JSON.stringify(v)}; c.setSelectionRange(c.value.length, c.value.length); c.dispatchEvent(new Event('input')); flush()`); await b.sleep(60) }
const listed = () => ev(`return S.hint ? S.hint.items.map(x => [x.t, x.part.k]) : []`)
await ev(`S.line = { parts: [], done: false }; S.panel.on = false; setView(true); flush()`)
await typeIn('s')
{ const l = await listed(), words = l.filter(x => x[1] === 'word').map(x => x[0])
  ok('s: selected, select, solo, send, set and the rest are listed', ['selected', 'select', 'solo', 'send', 'set', 'split', 'strip silence', 'swing'].every(w => words.includes(w)) && l[0][1] !== 'word', l.slice(0, 6))
  ok('…the words in the order of the alphabet, after the cells', JSON.stringify(words) === JSON.stringify(words.slice().sort()), words.slice(0, 12)) }
await typeIn('r')
{ const l = (await listed()).map(x => x[0]); ok('r: reverse, rename, repeat, remove, ramp, raise are all there', ['reverse', 'rename', 'repeat', 'remove', 'ramp', 'raise'].every(w => l.includes(w)), l) }
{ const means = await ev(`return [...new Set(sayWordsAll().filter(w => w.t.startsWith('c')).map(w => w.key))]`); await typeIn('c'); const rows = await ev(`return S.hint.items.filter(x => x.part.k === 'word').map(x => sayWordsAll().find(w => w.t === x.t).key)`)
  ok('c: every meaning the grammar has a word for that begins with c is offered, once', means.length > 10 && means.every(k => rows.includes(k)) && rows.length === new Set(rows).size, [means.length, rows.length, means.filter(k => !rows.includes(k))]) }
await typeIn('s')
{ const w = (await listed()).map(x => x[0]); ok('words of one meaning are one row: s offers selected, not selection, and one of seconds, secs, sec', w.includes('selected') && !w.includes('selection') && w.filter(x => ['seconds', 'secs', 'sec'].includes(x)).length === 1, w) }
await typeIn('selecti')
ok('…typed further, the other word of it is found (selection)', (await listed()).map(x => x[0]).includes('selection'), await listed())
await typeIn('reverse selection'); ok('…and every one of them is read', JSON.parse(await ev(`return JSON.stringify(parseLocal('reverse selection'))`))[0].who.sel === true)
await typeIn('r')
{ const n = (await listed()).length; for (let k = 0; k < 9; k++) await b.press('ArrowDown', 'ArrowDown', 40)
  ok('the list goes past its last row shown with the arrows, and says how many there are (at the foot, or on the prompt page)', n > 8 && await ev(`flush(); return S.hint.at === 9 && !!document.querySelector('[data-a="hint"][data-i="9"]') && [...document.querySelectorAll('#g-hint text, #g-dock text')].some(t => / of \\d+$/.test(t.textContent))`), [n, await ev(`return [S.hint && S.hint.at, S.panel.on && S.panel.tab, [...document.querySelectorAll('[data-a="hint"]')].map(e => e.dataset.i)]`)]) }
await typeIn('sel'); await b.press('ArrowDown', 'ArrowDown', 40); await b.press('Tab', 'Tab', 9); await b.sleep(80)
ok('tab takes the word into the line, and a space after it', (await ev(`return $('cmd').value`)) === 'selected ' && await ev(`return S.line.parts.length === 0`), await ev(`return $('cmd').value`))
ok('…then what the line lacks is offered: the acts', (await listed()).some(x => x[0] === 'reverse'), (await listed()).slice(0, 8))
await fresh(); await choose('kick', 0); await typeIn('selected rev'); await b.press('Enter', 'Enter', 13); await b.sleep(200)
ok('return on a word not yet whole (rev): it is completed, and the line is said', (await ev(`return $('cmd').value`)).startsWith('selected reverse') && (await R('kick', 0)).rev, [await ev(`return $('cmd').value`), await last()])
await fresh(); await ev(`for (const t of S.tracks) t.mute = false`); await typeIn('mute kick'); await b.press('Enter', 'Enter', 13); await b.sleep(200)
ok('return on a whole word (kick, though kick in may be offered): the line as typed', await ev(`return S.tracks[0].mute`) && (await ev(`return $('cmd').value`)) === 'mute kick', await last())
await fresh(); await ev(`S.tracks[0].mute = false; const c = $('cmd'); c.value = ''; c.blur(); S.hint = null; flush()`)

/* ── round three (2026-10-16): tracks ── */
const names = () => ev(`return S.tracks.map(t => t.name)`), T = n => ev(`const t = S.tracks.find(x => x.name === ${JSON.stringify(n)}); return t ? { kind: t.kind, inst: !!t.inst, col: t.col || null, grp: t.grp || null, parent: t.parent || null, out: t.out || 0, arm: !!t.arm, regs: t.regs.length } : null`)
await fresh(); const tn0 = (await names()).length
ok('add 3 audio tracks called "Pad": three, named, as the track keys make them', /Pad 1, Pad 2, Pad 3 made/.test(await say('add 3 audio tracks called "Pad"')) && (await names()).length === tn0 + 3 && (await T('Pad 2')).kind === 'audio', [await last(), await names()])
ok('…one step back takes all three away', await ev('undoEdit(); return S.tracks.length') === tn0)
await fresh()
ok('new instrument track', /made/.test(await say('new instrument track')) && await ev(`return S.tracks.length === ${tn0 + 1} && S.tracks.some(t => !!t.inst)`), await last())
await fresh()
ok('new bus called "Drum Bus"', /Drum Bus made/.test(await say('new bus called "Drum Bus"')) && (await T('Drum Bus')).kind === 'bus', [await last(), await names()])
ok('route kick and snare to drum bus', /kick, snare to Drum Bus/.test(await say('route kick and snare to drum bus')) && await ev(`const b = S.tracks.find(t => t.name === 'Drum Bus'); return ['kick', 'snare'].every(n => S.tracks.find(t => t.name === n).out === b.id)`), await last())
await fresh()
ok('duplicate kick: a track, not its regions said again', /kick duplicated/.test(await say('duplicate kick')) && (await names()).length === tn0 + 1 && (await names()).filter(n => /^kick/.test(n)).length === 2, [await last(), await names()])
await fresh()
ok('duplicate kick with its regions', /with its regions/.test(await say('duplicate kick with its regions')) && await ev(`const k = S.tracks.filter(t => /^kick/.test(t.name)); return k.length === 2 && k[1].regs.length === k[0].regs.length`), await last())
await fresh(); await choose('kick', 0); const k0 = (await R('kick', 1)).a
ok('duplicate this (regions): still said once more', /once more|repeated/.test(await say('duplicate this')) && (await names()).length === tn0, await last())
await fresh()
await say('add 2 audio tracks')
ok('delete the empty tracks', /2 empty tracks deleted/.test(await say('delete the empty tracks')) && (await names()).length === tn0, [await last(), await names()])
await fresh()
ok('delete the guitar track: the track, not only its regions', /guitar deleted/.test(await say('delete the guitar track')) && !(await names()).includes('guitar'), [await last(), await names()])
await fresh()
ok('move bass above keys, and air to the top', /bass above keys/.test(await say('move bass above keys')) && await ev(`const n = S.tracks.map(t => t.name); return n.indexOf('bass') === n.indexOf('keys') - 1`) && /air to the top/.test(await say('move air to the top')) && (await names())[0] === 'air', [await last(), await names()])
await fresh()
ok('color hum red, then dark blue, then as read', /hum coloured/.test(await say('color hum red')) && JSON.stringify((await T('hum')).col) === JSON.stringify(['vox', 3]) && /coloured/.test(await say('paint hum dark blue')) && JSON.stringify((await T('hum')).col) === JSON.stringify(['drums', 1]) && /as read/.test(await say('color hum as read')) && (await T('hum')).col === null, [await last(), await T('hum')])
await fresh(); await choose('keys', 1)
ok('color this region green', /1 region coloured/.test(await say('color this region green')) && await ev(`const r = S.tracks.find(t => t.name === 'keys').regs.slice().sort((x, y) => x.a - y.a)[1]; return JSON.stringify(r.col) === '["keys",3]'`), await last())
await fresh()
ok('group kick and snare for editing, then ungroup them', /grouped for editing/.test(await say('group kick and snare for editing')) && (await T('kick')).grp && (await T('kick')).grp === (await T('snare')).grp && /no longer grouped/.test(await say('ungroup kick for editing')) && !(await T('kick')).grp, [await last(), await T('kick')])
await fresh()
ok('stack kick and snare, then unstack them', /kick, snare/.test(await say('stack kick and snare')) && (await T('kick')).parent && /taken apart/.test(await say('unstack kick')) && !(await T('kick')).parent, [await last(), await T('kick')])
await fresh()
{ const said = await say('arm hum'), t = await T('hum'); ok('arm hum: armed if the input opens, and said as it came out', (t.arm && /armed/.test(said)) || (!t.arm && /could not be opened/.test(said)), [said, t.arm]) }
await ev(`for (const t of S.tracks) t.arm = false`); await fresh()

/* ── round three: the song's time ── */
const marks = () => ev(`return SCENES.map(s => [s.name, s.a])`)
await fresh(); const m0 = await marks(), end0 = await ev('return SONG_END')
ok('add a marker "Bridge 2" at bar 37', /marker Bridge 2 at bar 37/.test(await say('add a marker "Bridge 2" at bar 37')) && (await marks()).some(m => m[0] === 'Bridge 2' && m[1] === 37), [await last(), await marks()])
ok('rename the second chorus marker to "Last Chorus"', /chorus is Last Chorus/.test(await say('rename the second chorus marker to "Last Chorus"')) && (await marks()).some(m => m[0] === 'Last Chorus' && m[1] === 33), [await last(), await marks()])
ok('move the bridge 2 marker to bar 39', /at bar 39/.test(await say('move the bridge 2 marker to bar 39')) && (await marks()).some(m => m[0] === 'Bridge 2' && m[1] === 39), [await last(), await marks()])
ok('delete the pre marker', /pre deleted/.test(await say('delete the pre marker')) && !(await marks()).some(m => m[0] === 'pre'), [await last(), await marks()])
await fresh(); ok('…and one step back each', JSON.stringify(await marks()) === JSON.stringify(m0))
ok('insert 2 bars at bar 17: what follows goes later', /2 bars put in at 17/.test(await say('insert 2 bars at bar 17')) && await ev(`return SCENES.find(s => s.name === 'chorus').a === 19 && SCENES.find(s => s.name === 'out').a === 43`), [await last(), await ev('return [SONG_END, SCENES.map(s => [s.name, s.a])]')])
await fresh()
ok('take out bars 9 to 12: the song closes over them', /taken out of the song/.test(await say('take out bars 9 to 12')) && await ev(`return SCENES.find(s => s.name === 'pre').a === 9 && SCENES.find(s => s.name === 'chorus').a === 13`), [await last(), await ev('return SCENES.map(s => [s.name, s.a])')])
await fresh(); const tp = await ev('return S.tempo')
ok('raise the tempo by 4, then set the tempo to 100', (await say('raise the tempo by 4')) === 'tempo' && await ev(`return S.tempo === ${tp + 4}`) && (await say('set the tempo to 100')) === 'tempo' && await ev('return S.tempo === 100'), [await last(), await ev('return S.tempo')])
ok('a tempo change partway along is said to be not there yet', (await say('set the tempo to 120 at bar 17')) === 'the tempo is one for the whole song in this version')
await fresh()
ok('set the meter to 3/4: as the measure menu does it, the steps back cleared and none made', /measure 4\/4 to 3\/4: the steps back are cleared/.test(await say('set the meter to 3/4')) && await ev('return S.meter.join() === "3,4" && UNDO.length === 0') && /the measures there are/.test(await say('meter 11/4')), [await last(), await ev('return [S.meter, UNDO.length]')])
await ev(`setMeter(4, 4)`); await fresh()

/* ── round three: the project ── */
await fresh(); await ev(`S.ho.open = false; S.ho.skip = []`)
ok('bounce the mix as mp3 320: the hand-off panel opens, set so; the key is still pressed by hand', /hand off set: the mix/.test(await say('bounce the mix as mp3 320')) && await ev(`return S.ho.open && S.ho.what === 'mix' && S.ho.fmt === 'mp3' && S.ho.kbps === 320 && S.ho.state !== 'busy'`), [await last(), await ev('return S.ho')])
ok('export stems of kick and snare as wav 24 bit 48k: in the intro nothing of them sounds, and it says so', /no stem sounds in intro/.test(await say('export stems of kick and snare as wav 24 bit 48k')), await last())
ok('export the chorus stems of kick and snare as wav 24 bit 48k: only those stems, the chorus', /2 stems/.test(await say('export the chorus stems of kick and snare as wav 24 bit 48k')) && await ev(`return S.ho.what === 'stems' && S.ho.fmt === 'wav' && S.ho.bits === 24 && S.ho.rate === 48000 && hoPlan().list.map(t => t.name).join() === 'kick,snare'`), [await last(), await ev('return [S.ho, hoPlan().list.map(t => t.name)]')])
ok('bounce stems of the whole song dry: every stem again, the whole song, dry', /stems/.test(await say('bounce stems of the whole song dry')) && await ev(`return S.ho.range === 'song' && S.ho.print === 'dry' && !(S.ho.skip || []).length`), [await last(), await ev('return S.ho')])
ok('a rate the room has not is said', /the rates there are/.test(await say('export the mix as wav 22k')))
ok('save as "Dress v2": a copy under that name (in the app)', /saving is in the app|saved as Dress v2/.test(await say('save as "Dress v2"')), await last())
await ev(`S.ho.open = false; S.ho.skip = []; S.ho.what = 'stems'; S.ho.fmt = 'wav'; S.ho.print = 'with patch'; S.ho.range = 'this scene'; S.ho.bits = 24; S.ho.rate = 0; uiDirty('hand'); flush()`); await fresh()

/* ── round three: the patch (prints here; plug-ins need the app: the real-app step) ── */
await fresh()
const wall = n => ev(`const t = S.tracks.find(x => x.name === ${JSON.stringify(n)}), w = wallOf(t); return { nodes: w.nodes.map(x => [x.id, x.k, !!x.bypass]), wires: w.wires.map(e => [e.from, e.to]) }`)
ok('add a tremolo print to keys: put on at the end of its way', /tremolo put on: keys/.test(await say('add a tremolo print to keys')) && await (async () => { const w = await wall('keys'), id = (w.nodes.find(x => x[1] === 'tremolo') || [])[0]; return id != null && w.wires.some(e => e[1] === id) && w.wires.some(e => e[0] === id && e[1] === -2) })(), [await last(), await wall('keys')])
ok('add a delay print to keys in parallel: beside the tremolo, from in to out', /delay put on in parallel/.test(await say('add a delay print to keys in parallel')) && await (async () => { const w = await wall('keys'), d = w.nodes.find(x => x[1] === 'delay')[0], tr = w.nodes.find(x => x[1] === 'tremolo')[0]; return w.wires.some(e => e[0] === -1 && e[1] === d) && w.wires.some(e => e[0] === d && e[1] === -2) && w.wires.some(e => e[0] === tr && e[1] === -2) && !w.wires.some(e => e[0] === tr && e[1] === d) })(), [await last(), await wall('keys')])
ok('bypass the tremolo print on keys, and turn it on again', /tremolo off/.test(await say('bypass the tremolo print on keys')) && (await wall('keys')).nodes.find(x => x[1] === 'tremolo')[2] && /tremolo on/.test(await say('turn on the tremolo print on keys')) && !(await wall('keys')).nodes.find(x => x[1] === 'tremolo')[2], [await last(), await wall('keys')])
ok('a print whose name is another word: add a gain print to keys', /gain put on/.test(await say('add a gain print to keys')) && (await wall('keys')).nodes.some(x => x[1] === 'gain'), [await last(), await wall('keys')])
ok('remove the tremolo print from keys', /tremolo taken off/.test(await say('remove the tremolo print from keys')) && !(await wall('keys')).nodes.some(x => x[1] === 'tremolo'), [await last(), await wall('keys')])
await fresh()

async function last () { return ev(`const L = S.last || {}; return L.say || (L.res || []).map(a => a.text || a.k).join(' | ')`) }
ok('nothing went wrong on the page', b.errors.length === 0 && (await ev('return (window.__errs || []).length')) === 0, [b.errors.slice(0, 3), await ev('return window.__errs')])
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `FAILED: ${bad.join(' | ')}` : 'grammar: all passed')
process.exit(bad.length ? 1 : 0)
