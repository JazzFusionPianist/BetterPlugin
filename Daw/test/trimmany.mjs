// node test/trimmany.mjs — several regions chosen, the end of one pulled: the same end of every chosen one moves by as much
// (as in Logic), seen while the hand moves, each kept to what it can be (a sound from a file no longer than its file); one
// undo takes all of it back; with one chosen, only it. A real pointer.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, CMD = 4
const mouse = (type, x, y) => b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : type === 'mouseMoved' && !mouse.down ? 0 : 1, clickCount: 1, pointerType: 'mouse' })
// where a region's end is on the screen: a little inside it, low in its row
const endOf = (id, left) => ev(`flush(); const [r, t] = regOf(${id}), ti = S.tracks.indexOf(t), bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W; return { x: bd.left + (${left ? 'bx(r.a) + 2' : 'bx(r.b) - 2'}) * k, y: bd.top + (rowY(ti) + S.rh * .7) * k, pxb: PXB * k }`)
const span = id => ev(`const [r] = regOf(${id}); return [r.a, r.b, +(r.off || 0).toFixed(4)]`)
const pull = async (id, bars, left) => {
  const p = await endOf(id, left)
  mouse.down = false; await mouse('mouseMoved', p.x, p.y); await mouse('mousePressed', p.x, p.y); mouse.down = true
  for (let i = 1; i <= 8; i++) await mouse('mouseMoved', p.x + bars * p.pxb * i / 8, p.y)
  await b.sleep(40)
  const mid = await ev(`return { dirty: dirty.size, b: regOf(${ids.b})[0].b, a: regOf(${ids.b})[0].a }`)
  await mouse('mouseReleased', p.x + bars * p.pxb, p.y); mouse.down = false; await b.sleep(80)
  return mid
}

const ids = await ev(`
  setView(true); S.snap = true; S.flex = false; S.auto = false; S.tool = 'pointer'; S.mode = 'slip'
  for (const t of S.tracks) t.regs = t.regs.filter(r => r.b <= 60)
  const loops = S.tracks.filter(t => t.kind === 'audio' && !t.inst && t.regs.some(r => r.loop)), src = t => t.regs.find(r => r.loop)
  const A = loops[0], B = loops[1]
  const ra = mkReg({ a: 70, b: 72, buf: src(A).buf, loop: true, off: 69 }), rb = mkReg({ a: 72, b: 75, buf: src(B).buf, loop: true, off: 71 })
  A.regs.push(ra); B.regs.push(rb)
  const s = S.tracks.find(t => t.kind === 'audio' && !t.inst && !t.theirs && t !== A && t !== B), f = mkReg({ a: 71, b: 73, key: 'file:test', file: 'test.wav', loop: false, rate: 1, sec: 2.5 * SPB(), srcBars: 2.5 }); s.regs.push(f)
  SONG_END = Math.max(SONG_END, 120); repaint(); setZoom(60, 70); VX = 66
  for (const t of [A, B, s]) showRow(S.tracks.indexOf(t))
  S.selR = [ra.id, rb.id, f.id]; dirtyAll(); flush()
  return { a: ra.id, b: rb.id, f: f.id }`)
const s0 = { a: await span(ids.a), b: await span(ids.b), f: await span(ids.f) }

/* the right end of one pulled a bar out: all three, by a bar (the file's sound as far as its file goes) */
const mid = await pull(ids.a, 1)
const s1 = { a: await span(ids.a), b: await span(ids.b), f: await span(ids.f) }
ok('three chosen, the end of one pulled a bar out: each chosen one a bar longer at its end', s1.a[1] === 73 && s1.b[1] === 76 && s1.a[0] === 70 && s1.b[0] === 72, s1)
ok('…the sound from a file only as far as its file goes (half a bar more)', Math.abs(s1.f[1] - 73.5) < 1e-6, s1.f)
ok('…seen while the hand moves', mid.b === 76, mid)
await b.press('z', 'KeyZ', 90, CMD); await b.sleep(80)
ok('one undo: all three as they were', JSON.stringify({ a: await span(ids.a), b: await span(ids.b), f: await span(ids.f) }) === JSON.stringify(s0))

/* the left end of another pulled a bar in: all three a bar shorter at their beginning, their sound where it was */
await pull(ids.b, 1, true)
const s2 = { a: await span(ids.a), b: await span(ids.b), f: await span(ids.f) }
ok('the beginning of another pulled a bar in: each chosen one begins a bar later, what it plays stays where it was', s2.a[0] === 71 && s2.b[0] === 73 && s2.f[0] === 72 && Math.abs(s2.a[2] - (s0.a[2] + 1)) < 1e-6 && Math.abs(s2.f[2] - (s0.f[2] + 1)) < 1e-6 && s2.a[1] === 72, s2)
await b.press('z', 'KeyZ', 90, CMD); await b.sleep(80)

/* one chosen: only it */
await ev(`S.selR = [${ids.a}]; uiDirty('lanes'); flush()`)
await pull(ids.a, 1)
ok('one chosen: only it is trimmed', (await span(ids.a))[1] === 73 && (await span(ids.b))[1] === 75 && (await span(ids.f))[1] === 73, [await span(ids.a), await span(ids.b)])

console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
if (b.errors.length) console.log('page errors:', b.errors.slice(0, 5))
await b.close()
process.exit(bad.length || b.errors.length ? 1 : 0)
