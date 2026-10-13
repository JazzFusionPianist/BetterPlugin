// node test/fadekeys.mjs — control and shift held, the pointer is the fade tool over a region of sound: pulled at its end a
// fade out, at its beginning a fade in — seen growing while the hand moves — and the region itself stays where it is.
// Without the keys the same pull moves the region, as before; over notes the keys change nothing. A real pointer.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, CTRL = 2, SHIFT = 8, KEYS = CTRL | SHIFT
const mouse = (type, x, y, modifiers = 0) => b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseMoved' && !mouse.down ? 0 : type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse', modifiers })
const reg = id => ev(`const [r] = regOf(${id}); return { a: r.a, b: r.b, fi: +(r.fi || 0).toFixed(4), fo: +(r.fo || 0).toFixed(4) }`)
// a place in a region: so many bars from its beginning (or, negative, from its end), in the middle of its row
const at = (id, bars) => ev(`flush(); const [r, t] = regOf(${id}), ti = S.tracks.indexOf(t), bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W; return { x: bd.left + bx(${bars} >= 0 ? r.a + ${bars} : r.b + ${bars}) * k, y: bd.top + (rowY(ti) + S.rh * .5) * k, pxb: PXB * k }`)

const ids = await ev(`
  setView(true); S.snap = true; S.flex = false; S.auto = false; S.tool = 'pointer'; S.mode = S.mode === 'grid' ? 'slip' : S.mode
  for (const t of S.tracks) t.regs = t.regs.filter(r => r.b <= 60)
  const s = S.tracks.find(t => t.kind === 'audio' && !t.inst && !t.theirs)
  const f = mkReg({ a: 70, b: 74, key: 'file:test', file: 'test.wav', loop: false, rate: 1, sec: 4 * SPB(), srcBars: 4 }); s.regs.push(f)
  const n = newInstTrack('synth', 'e piano'); n.regs = [mkReg({ a: 70, b: 74, loop: false, notes: [mkNote(0, 1, 60, 100)] })]
  SONG_END = Math.max(SONG_END, 120); repaint(); setZoom(60, 70); VX = 66; showRow(S.tracks.indexOf(n)); showRow(S.tracks.indexOf(s)); dirtyAll(); flush()
  return { f: f.id, n: n.regs[0].id }`)

// the pointer over the region with the keys held says what a pull would do
{ const p = await at(ids.f, -.2)
  await mouse('mouseMoved', p.x, p.y, KEYS); await b.sleep(40)
  ok('control and shift over a region of sound: the pointer is the fade tool\'s', (await ev(`return document.getElementById('board').style.cursor || [...document.querySelectorAll('#board, #board *')].map(e => e.style && e.style.cursor).find(c => c === 'ew-resize') || ''`)) === 'ew-resize') }

// a fade out: pressed near the end, pulled a bar into the region
{ const p = await at(ids.f, -.1), r0 = await reg(ids.f)
  mouse.down = false; await mouse('mouseMoved', p.x, p.y, KEYS); await mouse('mousePressed', p.x, p.y, KEYS); mouse.down = true
  for (let i = 1; i <= 6; i++) await mouse('mouseMoved', p.x - .9 * p.pxb * i / 6, p.y, KEYS)
  await b.sleep(60)
  const mid = await reg(ids.f), drawn = await ev(`flush(); return dirty.size === 0`)
  await mouse('mouseReleased', p.x - .9 * p.pxb, p.y, KEYS); mouse.down = false; await b.sleep(80)
  const r1 = await reg(ids.f)
  ok('pulled from its end inwards: a fade out as long as the pull — already while the hand moves', Math.abs(mid.fo - 1) < .03 && drawn, mid)
  ok('let go: the fade stays, and the region is where it was', Math.abs(r1.fo - 1) < .03 && r1.a === r0.a && r1.b === r0.b && r1.fi === 0, r1) }

// a fade in: pressed near the beginning, pulled half a bar in
{ const p = await at(ids.f, .1)
  await b.dragTo(p.x, p.y, p.x + .4 * p.pxb, p.y, 6, KEYS); await b.sleep(80)
  const r2 = await reg(ids.f)
  ok('pulled from its beginning: a fade in, the fade out untouched', Math.abs(r2.fi - .5) < .03 && Math.abs(r2.fo - 1) < .03 && r2.a === 70, r2)
  await ev(`undoEdit()`)
  ok('one undo takes that fade off again', (await reg(ids.f)).fi === 0 && Math.abs((await reg(ids.f)).fo - 1) < .03, await reg(ids.f)) }

// without the keys the same pull moves the region, as it always did
{ const p = await at(ids.f, 2), r0 = await reg(ids.f)
  await b.dragTo(p.x, p.y, p.x + p.pxb, p.y, 6); await b.sleep(80)
  const r3 = await reg(ids.f)
  ok('without the keys: the region is moved, its fade as it was', r3.a === r0.a + 1 && r3.fo === r0.fo && r3.fi === 0, r3)
  await ev(`undoEdit()`) }

// over notes the keys are not the fade tool: the region is taken as the pointer takes it
{ const p = await at(ids.n, 2), r0 = await reg(ids.n)
  await b.dragTo(p.x, p.y, p.x + p.pxb, p.y, 6, KEYS); await b.sleep(80)
  const r4 = await reg(ids.n)
  ok('over a region of notes: no fade, the pointer as it is (the region moves)', r4.fi === 0 && r4.fo === 0 && r4.a !== r0.a, r4) }

console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
if (b.errors.length) console.log('page errors:', b.errors.slice(0, 5))
await b.close()
process.exit(bad.length || b.errors.length ? 1 : 0)
