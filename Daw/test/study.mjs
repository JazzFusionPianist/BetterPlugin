// node test/study.mjs [w h] — a print's study (Patch on Slur's way): a print pressed on the wall opens it at the wall's right;
// the big print pulled turns the amount, seen while the hand moves; its number pressed is typed into; a number row pulled,
// and typed into; a choice's cell pressed; a switch; remove pressed twice; the close mark, esc and a press on the empty
// wall put it away; the wheel over the print turns it and does not zoom the wall. A real pointer.
import { open, PAGE } from './cdp.mjs'
const [W, H] = [+(process.argv[2] || 1440), +(process.argv[3] || 900)]
const b = await open(PAGE, { width: W, height: H, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const el = sel => ev(`flush(); const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, r: r.right }`)
const node = k => ev(`const w = wallOf(S.tracks[S.sel]), n = w.nodes.find(x => x.k === ${JSON.stringify(k)}); return n && { id: n.id, a: +wallAmount(S.tracks[S.sel], n).toFixed(3), x: n.x, aux: n.aux.slice(), variant: n.variant || 0, wet: !!n.wet, bypass: !!n.bypass, div: n.div }`)

await ev(`if (typeof START !== 'undefined') START.on = false; S.sel = S.tracks.findIndex(t => t.name === 'kick'); S.panel.on = true; S.panel.tab = 'patch'; S.panel.h = ${H < 900 ? 300 : 420}; setView(true)
  const t = S.tracks[S.sel], w = wallOf(t); let x = 150, last = WALL_IN
  for (const k of ['comp', 'delay', 'cut']) { const nd = wallNew(k, x, 0); nd.id = wallFree(w); nd.amount = .5; w.nodes.push(nd); w.wires.push({ from: last, to: nd.id, gain: 1, port: 0 }); last = nd.id; x += 140 }
  w.wires.push({ from: last, to: WALL_OUT, gain: 1, port: 0 }); w.out.x = x; w.z = 0; dirtyAll(); flush()`)
const comp = await node('comp')

/* pressed on the wall: its study */
{ const c = await el(`#g-dock [data-a="wall"][data-k="node"][data-id="${comp.id}"]`)
  await b.click(c.x, c.y); await b.sleep(100)
  const s = await ev(`flush(); return { open: !!studyNode(), id: STUDY.id, text: [...document.querySelectorAll('#g-dock text')].map(t => t.textContent).join('|') }`)
  ok('a print pressed on the wall opens its study, with its name, its amount and its hands', s.open && s.id === comp.id && /comp/.test(s.text) && /ratio/.test(s.text) && /makeup/.test(s.text) && /bypass/.test(s.text), s.text.slice(-240))
  ok('…and its amount on the wall is as it was', (await node('comp')).a === comp.a) }

/* the big print pulled: the amount rises with the hand */
{ const p = await el('#g-dock [data-a="study"][data-k="print"]')
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y)
  for (let k = 1; k <= 6; k++) await mouse('mouseMoved', p.x, p.y - k * 9.5)
  await b.sleep(50)
  const mid = await ev(`flush(); return { a: +wallAmount(S.tracks[S.sel], studyNode()).toFixed(3), shown: [...document.querySelectorAll('#g-dock text')].some(t => t.textContent === studyAmountText(S.tracks[S.sel], studyNode())) }`)
  await mouse('mouseReleased', p.x, p.y - 57); await b.sleep(60)
  ok('the big print pulled up: the amount rises with the hand, and its number says so as it goes', Math.abs(mid.a - .8) < .02 && mid.shown, mid)
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y, { modifiers: 1 }); await mouse('mouseReleased', p.x, p.y, { modifiers: 1 }); await b.sleep(60)
  ok('with option: back where it rests', (await node('comp')).a === 0, await node('comp')) }

/* its number pressed and typed into */
{ const v = await el('#g-dock [data-a="study"][data-k="amt"]')
  await b.click(v.x, v.y); await b.sleep(80)
  ok('the number pressed: a box to type into', await ev(`return !STUDY_IN.hidden && document.activeElement === STUDY_IN`))
  const said = await ev(`return studyAmountText(S.tracks[S.sel], Object.assign({}, studyNode(), { amount: .35 })).replace(/^[−]/, '-')`)      // (the amount of .35, said in its own units)
  await b.press('a', 'KeyA', 65, 4); await b.type(said); await b.press('Enter', 'Enter', 13); await b.sleep(80)
  ok('…typed as it is said: the amount is that', Math.abs((await node('comp')).a - .35) < .02 && await ev(`return STUDY_IN.hidden`), [said, await node('comp')]) }

/* a number row pulled, and typed into */
{ const i = await ev(`return STUDY.g.rows.findIndex(r => r.h && r.h.label === 'release')`), r = await el(`#g-dock [data-a="study"][data-k="row"][data-i="${i}"]`), a0 = (await node('comp')).aux[2]
  await mouse('mouseMoved', r.x, r.y, { buttons: 0 }); await mouse('mousePressed', r.x, r.y)
  for (let k = 1; k <= 5; k++) await mouse('mouseMoved', r.x, r.y - k * 8)
  await mouse('mouseReleased', r.x, r.y - 40); await b.sleep(60)
  const a1 = (await node('comp')).aux[2]
  ok('a number row pulled up: release grows (along a log, as its range is wide)', a1 > a0 * 1.5, [a0, a1])
  await b.click(r.x, r.y); await b.sleep(80)
  await b.press('a', 'KeyA', 65, 4); await b.type('300'); await b.press('Enter', 'Enter', 13); await b.sleep(80)
  ok('…pressed and 300 typed: 300 ms', (await node('comp')).aux[2] === 300, (await node('comp')).aux)
  const j = await ev(`return STUDY.g.rows.findIndex(r => r.h && r.h.label === 'ratio')`), q = await el(`#g-dock [data-a="study"][data-k="row"][data-i="${j}"]`)
  await b.click(q.x, q.y); await b.sleep(80); await b.press('a', 'KeyA', 65, 4); await b.type('8'); await b.press('Enter', 'Enter', 13); await b.sleep(80)
  ok('a ratio typed as it reads (8, for 8.0:1)', (await node('comp')).aux[0] === 80, (await node('comp')).aux) }

/* a choice, and a switch */
{ const c = await el('#g-dock [data-a="study"][data-k="cell"][data-v="1"]')
  await b.click(c.x, c.y); await b.sleep(60)
  ok('a choice: the cell pressed is chosen (rms)', (await node('comp')).variant === 1, await node('comp'))
  const s = await el('#g-dock [data-a="study"][data-k="sw"][data-v="by"]')
  await b.click(s.x, s.y); await b.sleep(60)
  ok('bypass: switched on', (await node('comp')).bypass === true)
  await b.click(s.x, s.y); await b.sleep(60) }

/* the wheel over the print turns it, and the wall behind is not zoomed */
{ const p = await el('#g-dock [data-a="study"][data-k="print"]'), z0 = await ev(`return wallOf(S.tracks[S.sel]).z`), a0 = (await node('comp')).a
  await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: -50 }); await b.sleep(80)
  ok('the wheel over the print: more of it, and the wall stays as near as it was', (await node('comp')).a > a0 && (await ev(`return wallOf(S.tracks[S.sel]).z`)) === z0, [(await node('comp')).a, a0]) }

/* another print pressed: its study instead; the delay's time is a line of cells */
{ const d = await node('delay'), c = await el(`#g-dock [data-a="wall"][data-k="node"][data-id="${d.id}"]`)
  if (c.x < (await el('#g-dock [data-a="study"][data-k="bg"]')).l) { await b.click(c.x, c.y); await b.sleep(80) } else await ev(`studyOpen(S.tracks[S.sel], ${d.id})`)
  ok('another print pressed: its study instead', await ev(`return STUDY.id === ${d.id}`))
  const i = await ev(`flush(); return STUDY.g.rows.findIndex(r => r.h && r.h.label === 'time')`), cells = await ev(`return document.querySelectorAll('#g-dock [data-a="study"][data-k="cell"][data-i="${i}"]').length`)
  ok('…the delay\'s time stands as a line of cells, every division of it', cells === 7, cells)
  const c4 = await el(`#g-dock [data-a="study"][data-k="cell"][data-i="${i}"][data-v="4"]`); await b.click(c4.x, c4.y); await b.sleep(60)
  ok('…a quarter pressed', (await node('delay')).div === 4, await node('delay')) }

/* put away: the close mark, esc, a press on the empty wall */
{ const x = await el('#g-dock [data-a="study"][data-k="close"]'); await b.click(x.x, x.y); await b.sleep(60)
  ok('the close mark puts it away', !(await ev(`return !!studyNode()`)))
  await ev(`studyOpen(S.tracks[S.sel], ${comp.id})`); await b.press('Escape', 'Escape', 27); await b.sleep(60)
  ok('esc too', !(await ev(`return !!studyNode()`)))
  await ev(`studyOpen(S.tracks[S.sel], ${comp.id}); flush()`)
  const bg = await ev(`flush(); const r = document.querySelector('#g-dock [data-a="wall"][data-k="bg"]').getBoundingClientRect(), k = r.width / WALL.g.w, x0 = (typeof MAC_W !== 'undefined' ? MAC_W : 0) + 30; return { x: r.left + x0 * k, y: r.top + 30 }`)
  await b.click(bg.x, bg.y); await b.sleep(60)
  ok('a press on the empty wall too', !(await ev(`return !!studyNode()`))) }

/* remove, twice */
{ await ev(`studyOpen(S.tracks[S.sel], ${comp.id}); flush()`)
  const r = await el('#g-dock [data-a="study"][data-k="rm"]'); await b.click(r.x, r.y); await b.sleep(60)
  ok('remove pressed once: it asks', (await node('comp')) && await ev(`return STUDY.arm`))
  const r2 = await el('#g-dock [data-a="study"][data-k="rm"]'); await b.click(r2.x, r2.y); await b.sleep(60)
  ok('…twice: the print is gone from the wall, and the study with it', !(await node('comp')) && !(await ev(`return !!studyNode()`))) }

console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
if (b.errors.length) console.log('page errors:', b.errors.slice(0, 5))
await b.close()
process.exit(bad.length || b.errors.length ? 1 : 0)
