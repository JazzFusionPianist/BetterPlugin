// node test/hint.mjs — the command line in cells (ui/hint.js), as its draft shows it (design/prompt draft 1):
// a letter lists what begins with it; what is taken stands in the line as a cell and the next list holds only what can
// follow (a track, what is on it, a plug-in's controls); a stretch of the song, in the cycle's colour, with its band on
// the bars; how much; the act last, with the line it would draw shown dashed before return draws it; what was done is
// said at the far end of the foot and is one step of undo. Korean says the act last, English may say it first.
// Looked at as the page drew it, with real keys.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const seen = () => ev(`const g = document.getElementById('g-hint'), cmd = document.getElementById('cmd')
  return { up: !!S.hint, items: S.hint ? S.hint.items.map(x => x.t) : [], kinds: S.hint ? S.hint.items.map(x => x.d) : [], at: S.hint ? S.hint.at : null, rows: g.querySelectorAll('[data-a="hint"]').length,
    texts: [...g.querySelectorAll('text')].map(t => t.textContent), parts: S.line.parts.map(p => [p.k, p.t]), done: S.line.done, value: cmd.value, left: parseFloat(cmd.style.left) || 26, focus: document.activeElement === cmd,
    band: [...g.querySelectorAll('rect')].filter(r => r.getAttribute('fill') === SOLO).map(r => [Math.round(+r.getAttribute('x')), Math.round(+r.getAttribute('width'))]), would: (document.getElementById('line-would') || { getAttribute: () => null }).getAttribute('d') }`)
const fresh = () => ev(`S.line = { parts: [], done: false }; S.hint = null; const cmd = document.getElementById('cmd'); cmd.value = ''; cmd.focus(); cmd.dispatchEvent(new Event('input')); S.last = null; flush()`)
const key = (k, code, vk) => b.press(k, code, vk)
const tab = async () => { await key('Tab', 'Tab', 9); await b.sleep(140) }
const ret = async () => { await key('Enter', 'Enter', 13); await b.sleep(200) }
const typed = async s => { await b.type(s); await b.sleep(120) }

/* a song with a track serum 2, a plug-in on kick whose threshold reads in db, and the cycle on bars 19 to 21 */
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true)
  S.tracks.find(t => t.name === 'snare').name = 'serum 2'
  const k = S.tracks.find(t => t.name === 'kick')
  k.inserts = [{ name: 'Pro-C 2', n: 1, uid: 0, pl: [[0, 'Threshold', .7, '-18.0 dB'], [1, 'Ratio', .3, '4.00:1'], [2, 'Attack', .2, '10 ms']], pv: { 0: .7 },
    ps: { 0: { texts: Array.from({ length: 101 }, (_, i) => (-60 + 60 * i / 100).toFixed(1) + ' dB'), unit: 'dB' } } }]
  S.cycle = { on: true, a: 18, b: 20 }; S.auto = false; UNDO.length = 0; dirtyAll(); flush()`)
await fresh()
ok('nothing typed: no list, no cell', !(await seen()).up && (await seen()).parts.length === 0)

/* 1. a letter, and the things of the song that begin with it */
await typed('k')
{ const s = await seen()
  ok('1  k: the list is up and holds the tracks that begin with k, each with which track it is', s.up && s.items[0] === 'kick' && s.items.includes('keys') && s.texts.includes('track 01') && s.rows === s.items.length, [s.items, s.kinds]) }
await fresh(); await typed('s')
{ const s = await seen(); ok('…and s finds serum 2', s.up && s.items[0] === 'serum 2', s.items) }

/* 2. the thing stands in the line as a cell; the list now holds only what is on it */
await fresh(); await typed('k'); await tab()
{ const s = await seen()
  ok('2  tab: kick stands in the line as a cell, the typing begins after it, the keys stay with the line', s.parts.length === 1 && s.parts[0][0] === 'who' && s.parts[0][1] === 'kick' && s.value === '' && s.left > 40 && s.focus && s.texts.includes('kick'), [s.parts, s.left])
  ok('…and the list at once holds what is on kick: its plug-in, its level, its pan, its prints', s.up && s.items[0] === 'pro-c 2' && s.items.includes('volume') && s.items.includes('pan') && s.items.includes('tape') && !s.items.includes('keys'), s.items) }
await typed('p')
{ const s = await seen(); ok('p: only what on it begins with p', s.up && s.items.join() === 'pro-c 2,pan', s.items) }
await tab()
{ const s = await seen(); ok('the plug-in taken: its controls are listed, each with how it stands', s.parts.length === 2 && s.up && s.items.join() === 'threshold,ratio,attack' && s.texts.includes('-18.0 db'), [s.items, s.texts.slice(-6)]) }
await typed('t'); await tab()
{ const s = await seen(), v = await ev(`const k = S.tracks.find(t => t.name === 'kick'); return [S.auto, k.ap, autoName(k, k.ap)]`)
  ok('threshold taken: three cells, and its own line is on show on the lane', s.parts.map(p => p[1]).join('|') === 'kick|pro-c 2|threshold' && v[0] === true && v[1] === 'fx1.0' && v[2] === 'pro-c 2 threshold', [s.parts, v])
  const h = await ev(`flush(); const i = S.tracks.findIndex(t => t.name === 'kick'); return [rowH(i), rowH(i + 1), S.tracks[i].h || 0, JSON.parse(serialize()).tracks[i].h || 0]`)
  ok('…on a row made tall enough to read it for as long as the line is about it (not kept with the project)', h[0] === 76 && h[1] === 25 && h[2] === 0 && h[3] === 0, h) }

/* 3. a stretch of the song: bars, or the cycle as it stands */
await typed('19')
{ const s = await seen()
  ok('3  19: the cycle as it stands first, then from bar 19 on, then 19 to a bar typed next; last, 19 as an amount', s.up && s.items[0] === '19 ~ 21' && s.kinds[0] === 'the cycle' && s.items[1] === '19 ~ end' && s.items[2] === '19 ~' && s.items[3] === '19 db', [s.items, s.kinds]) }
await tab()
{ const s = await seen(), x = await ev(`return [Math.round(bx(19)), Math.round(bx(21) - bx(19))]`)
  ok('the stretch stands in the line, and its band is on the bars and over the track', s.parts[3][0] === 'where' && s.parts[3][1] === '19 ~ 21' && s.band.length === 2 && s.band.every(r => r[0] === x[0] && r[1] === x[1]), [s.parts[3], s.band, x]) }

/* 4. how much, then the act — and the line it would draw is shown before it is drawn */
await typed('3')
{ const s = await seen(); ok('4  3: with the stretch said, a number is an amount in the thing’s own unit', s.up && s.items.join() === '3 db' && s.kinds[0] === 'how much', [s.items, s.kinds]) }
await tab()
{ const s = await seen()
  ok('the amount taken: the acts are listed, the gradual ones first, each with how it uses the stretch', s.up && s.items[0] === 'lower gradually' && s.items.includes('lower') && s.items.includes('raise gradually') && s.kinds[0] === 'over the stretch' && s.kinds[s.items.indexOf('lower')] === 'for the stretch', [s.items, s.kinds])
  ok('…and the line the chosen act would draw is on the lane, dashed', !!s.would && /L/.test(s.would), s.would) }
const ramp = (await seen()).would
await key('ArrowDown', 'ArrowDown', 40); await key('ArrowDown', 'ArrowDown', 40); await b.sleep(120)
{ const s = await seen(); ok('6  another act chosen (lower): another line is shown — down for the stretch and back', s.items[s.at] === 'lower' && s.would && s.would !== ramp && (s.would.match(/L/g) || []).length > (ramp.match(/L/g) || []).length, [s.items[s.at], s.would]) }
await key('ArrowUp', 'ArrowUp', 38); await key('ArrowUp', 'ArrowUp', 38); await b.sleep(80)
await typed('lower g')
{ const s = await seen(); ok('letters narrow the acts too', s.up && s.items.join() === 'lower gradually', s.items) }
await tab()
{ const s = await seen(), n = await ev(`return [UNDO.length, autoPts(S.tracks.find(t => t.name === 'kick'), 'fx1.0').length]`)
  ok('the act taken: it stands filled at the end of the line, nothing is done yet, the dashed line still shows', s.parts.length === 6 && s.parts[5][0] === 'act' && !s.up && !!s.would && n[0] === 0 && n[1] === 0, [s.parts[5], n]) }

/* 5. return: done, said at the far end of the foot, one step of undo */
await ret()
{ const r = await ev(`flush(); const k = S.tracks.find(t => t.name === 'kick'); return { pts: autoPts(k, 'fx1.0').map(q => [q.b, +q.v.toFixed(3)]), undo: UNDO.length, say: S.last && S.last.say, far: S.last && S.last.far, done: S.line.done, said: [...document.querySelectorAll('#g-cmd text')].map(t => t.textContent).join(' | ') }`)
  ok('5  return: the line is drawn — where it stood at bar 19, three db lower at bar 21, and it stays there', JSON.stringify(r.pts) === '[[18,0.7],[20,0.65]]' && r.undo === 1, r.pts)
  ok('…and what was done is said: threshold, from −18.0 to −21.0 db', r.done && r.far && /threshold/.test(r.say) && /−18\.0 db/.test(r.say) && /−21\.0 db/.test(r.say) && /−21\.0 db/.test(r.said), [r.say, r.said])
  const s = await seen(); ok('…the cells still stand, the dashed line and the band are gone', s.parts.length === 6 && !s.would && s.band.length === 0, [s.parts.length, s.band]) }
await ev(`undoEdit(); flush()`)
ok('one undo takes the whole line back', (await ev(`return autoPts(S.tracks.find(t => t.name === 'kick'), 'fx1.0').length`)) === 0)
await typed('s')
{ const s = await seen(); ok('typing after a line was done begins a new line', s.parts.length === 0 && s.up && s.items[0] === 'serum 2', [s.parts, s.items]) }

/* the other act: for the stretch and back; and on a level, without a stretch */
await fresh(); await typed('k'); await tab(); await typed('vol'); await tab(); await typed('19~21'); await tab(); await typed('3'); await tab(); await typed('lower'); await key('ArrowDown', 'ArrowDown', 40); await b.sleep(60)
{ const s = await seen(); ok('19~21 typed in one go is the stretch; lower is offered beside lower gradually', s.parts[2][1] === '19 ~ 21' && s.items.join() === 'lower gradually,lower' && s.items[s.at] === 'lower', [s.parts, s.items]) }
await tab(); await ret()
{ const r = await ev(`const k = S.tracks.find(t => t.name === 'kick'); return { pts: autoPts(k, 'vol').map(q => [q.b, q.v]), vol: k.vol, say: S.last.say }`)
  ok('lower, with a stretch: down by three at bar 19 and back at bar 21, the level elsewhere as it was', JSON.stringify(r.pts) === JSON.stringify([[18, r.vol], [18, r.vol - 3], [20, r.vol - 3], [20, r.vol]]), r.pts) }
await ev(`undoEdit(); flush()`)
await fresh(); await typed('ser'); await tab(); await typed('vol'); await tab(); await typed('2 db'); await tab(); await typed('rai'); await tab()
{ const s = await seen(); ok('without a stretch only the plain acts are offered (raise taken)', s.parts.map(p => p[0]).join() === 'who,what,much,act' && s.parts[3][1] === 'raise', s.parts) }
{ const v0 = await ev(`return S.tracks.find(t => t.name === 'serum 2').vol`); await ret()
  const r = await ev(`const t = S.tracks.find(t => t.name === 'serum 2'); return [t.vol, autoPts(t, 'vol').length, S.last.say]`)
  ok('…and return moves the level itself, with no line drawn', r[0] === v0 + 2 && r[1] === 0 && /volume/.test(r[2]), [v0, r]); await ev(`undoEdit(); flush()`)
  ok('…which one undo puts back', (await ev(`return S.tracks.find(t => t.name === 'serum 2').vol`)) === v0) }

/* cells are taken back one by one; escape puts the list away, then the cells */
await fresh(); await typed('k'); await tab(); await typed('pan'); await tab()
await key('Backspace', 'Backspace', 8); await b.sleep(100)
{ const s = await seen(); ok('backspace on nothing takes the last cell back', s.parts.length === 1 && s.parts[0][1] === 'kick', s.parts) }
await key('Escape', 'Escape', 27); await b.sleep(60); await key('Escape', 'Escape', 27); await b.sleep(80)
{ const s = await seen(); ok('escape: the list goes; again: the cells go, and the line is plain again', !s.up && s.parts.length === 0 && s.left === 26 && s.focus, [s.parts, s.left]) }

/* a marker as the stretch; a press on a row */
await fresh(); await typed('k'); await tab(); await typed('vol'); await tab(); await typed('cho')
{ const s = await seen(); ok('a marker by its name is a stretch: chorus, with its bars', s.up && /^chorus \d+ ~ \d+$/.test(s.items[0]) && s.kinds[0] === 'marker', [s.items, s.kinds]) }
{ const p = await ev(`flush(); const r = document.querySelector('#g-hint [data-a="hint"][data-i="0"]').getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10 }`)
  await b.click(p.x, p.y); await b.sleep(160)
  const s = await seen(); ok('a press on a row takes it, and the line keeps the keys', s.parts.length === 3 && s.parts[2][0] === 'where' && s.focus, [s.parts, s.focus]) }

/* 8, 9. english may say the act first */
await fresh(); await typed('lo')
{ const s = await seen(); ok('8  at the start of a line the acts are offered too: lo finds lower and lower gradually', s.up && s.items.includes('lower') && s.items.includes('lower gradually'), s.items) }
await typed('wer g'); await tab(); await typed('k'); await tab(); await typed('pro'); await tab(); await typed('thr'); await tab(); await typed('3 db'); await tab(); await typed('19~21'); await tab()
{ const s = await seen(); ok('9  lower gradually, kick, pro-c 2, threshold, 3 db, 19 ~ 21: the act first, the same cells', s.parts.map(p => p[0]).join() === 'act,who,what,param,much,where' && !!s.would, [s.parts, !!s.would]) }
await ret()
ok('…and return draws the same line', JSON.stringify(await ev(`return autoPts(S.tracks.find(t => t.name === 'kick'), 'fx1.0').map(q => [q.b, +q.v.toFixed(3)])`)) === '[[18,0.7],[20,0.65]]')
await ev(`undoEdit(); flush()`)
await fresh(); await typed('sol'); await tab(); await typed('ser'); await tab(); await ret(); await b.sleep(200)
ok('a plain act and a track (solo, serum 2) is done by the line’s own reader', (await ev(`return S.tracks.find(t => t.name === 'serum 2').solo`)) === true)
await ev(`S.tracks.find(t => t.name === 'serum 2').solo = false; applyAll(); dirtyAll(); flush()`)

/* korean: the same cells, the act last and in korean; a syllable still being typed finds its word */
await ev(`setLang('ko'); flush()`); await fresh(); await typed('k'); await tab()
{ const s = await seen(); ok('in korean: what is on a track is named in korean, names stay as given', s.items.includes('볼륨') && s.items.includes('팬') && s.items[0] === 'pro-c 2' && s.texts.includes('플러그인'), [s.items, s.texts.slice(0, 6)]) }
await typed('pro'); await tab(); await typed('thr'); await tab(); await typed('19'); await tab(); await typed('3'); await tab()
{ const s = await seen(); ok('…the acts are in korean, with how each uses the stretch', s.items[0] === '점점 줄여줘' && s.items.includes('줄여줘') && s.texts.includes('구간에 걸쳐') && s.texts.includes('구간 동안만'), [s.items, s.texts.slice(-6)]) }
await ev(`const cmd = document.getElementById('cmd'); cmd.value = '저'; cmd.dispatchEvent(new Event('input')); flush()`); await b.sleep(80)
{ const s = await seen(); ok('…and 저, on its way to 점, already finds 점점 줄여줘', s.up && s.items[0] === '점점 줄여줘', s.items) }
await ev(`const cmd = document.getElementById('cmd'); cmd.value = '줄'; cmd.dispatchEvent(new Event('input')); flush()`); await b.sleep(80)
{ const s = await seen(); ok('…줄 finds 줄여줘, and 점점 줄여줘 after it', s.items.join() === '줄여줘,점점 줄여줘', s.items) }
await ev(`setLang('en'); flush()`)

/* a line with no cell in it is read as before */
await fresh(); await typed('serum 2 mute')
{ const s = await seen(); ok('a whole line typed out: nothing is offered', !s.up && s.parts.length === 0, s.items) }
await ret(); await b.sleep(150)
ok('…and return runs it as ever (the track is muted)', (await ev(`return S.tracks.find(t => t.name === 'serum 2').mute`)) === true)
await fresh(); await typed('k'); await tab(); await typed('vol'); await tab()
ok('a row is tall while the line is about it…', (await ev(`flush(); return rowH(S.tracks.findIndex(t => t.name === 'kick'))`)) === 76)
await key('Escape', 'Escape', 27); await b.sleep(60); await key('Escape', 'Escape', 27); await b.sleep(100)
ok('…and as it was once the line is let go of', (await ev(`flush(); return rowH(S.tracks.findIndex(t => t.name === 'kick'))`)) === 25)
await ev(`S.tracks.find(t => t.name === 'serum 2').mute = false; applyAll(); const cmd = document.getElementById('cmd'); cmd.value = ''; cmd.dispatchEvent(new Event('input')); cmd.blur(); dirtyAll(); flush()`)

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `hint: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'hint: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
