// node test/stretch.mjs — a region stretched by its end: with option held the right end is pulled, and what is in the
// region fills its new length (notes begin and last so much later and longer; a sound plays slower, at its pitch, and
// follows the tempo from then on). Without option the end is only pulled out, as before. A real pointer.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, ALT = 1
const near = (x, y, e = 1e-6) => Math.abs(x - y) < e
// where a region's right end is on the screen, a little inside it and in the lower half of its row
const endOf = id => ev(`flush(); const [r, t] = regOf(${id}), ti = S.tracks.indexOf(t), bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W; return { x: bd.left + (bx(r.b) - 2) * k, y: bd.top + (rowY(ti) + S.rh * .7) * k, k, pxb: PXB * k }`)
const reg = id => ev(`const [r] = regOf(${id}); return r ? { a: r.a, b: r.b, off: r.off || 0, fi: r.fi || 0, fo: r.fo || 0, rate: r.rate || 1, sec: r.sec || 0, fx: !!r.fx, srcBars: r.srcBars || 0, flex: (r.flex || []).map(m => [m.s, m.d]), notes: (r.notes || []).map(q => [q.t, q.d, q.n, q.v]), ctl: (r.ctl || []).map(c => [c.t, c.v]), rep: r.rep || 0 } : null`)
const pull = async (id, bars, mods) => { const p = await endOf(id); await b.dragTo(p.x, p.y, p.x + bars * p.pxb, p.y, 8, mods); await b.sleep(80) }

// a clear stretch of song with three tracks: notes, a sound from a file, one of the song's own loops
const ids = await ev(`
  setView(true); S.snap = true; S.flex = false; S.auto = false; S.tool = 'pointer'
  for (const t of S.tracks) t.regs = t.regs.filter(r => r.b <= 60)
  const n = newInstTrack('synth', 'e piano'); n.regs = [mkReg({ a: 70, b: 72, loop: false, notes: [mkNote(0, 1, 60, 100), mkNote(2, .5, 64, 80), mkNote(6, 2, 67, 60)], ctl: [{ id: 9001, t: 4, c: 1, v: 64 }] })]
  const s = S.tracks.find(t => t.kind === 'audio' && !t.inst && !t.theirs)
  const f = mkReg({ a: 70, b: 72, key: 'file:test', file: 'test.wav', loop: false, rate: 1, sec: 2 * SPB(), srcBars: 2, fi: .25, fo: .5 }); f.flex = [{ s: SPB(), d: SPB() * 1.1 }]
  const f2 = mkReg({ a: 73, b: 74, key: 'file:next', file: 'next.wav', loop: false, rate: 1, sec: SPB(), srcBars: 1 })
  s.regs.push(f, f2)
  const l = S.tracks.find(t => t !== s && t.kind === 'audio' && !t.inst && t.regs.some(r => r.loop)), lp = mkReg({ a: 70, b: 72, buf: l.regs.find(r => r.loop).buf, loop: true, off: 69 }); l.regs.push(lp)
  SONG_END = Math.max(SONG_END, 120); repaint(); setZoom(60, 70); VX = 66; showRow(S.tracks.indexOf(n)); dirtyAll(); flush()
  return { n: n.regs[0].id, f: f.id, f2: f2.id, lp: lp.id, rows: [S.tracks.indexOf(n), S.tracks.indexOf(s), S.tracks.indexOf(l)] }`)
await ev(`showRow(${ids.rows[1]}); showRow(${ids.rows[0]}); dirtyAll(); flush()`)

// notes: option, the end pulled out by two bars — twice as long, every note twice as late and twice as long
{ const was = await reg(ids.n)
  await pull(ids.n, 2, ALT)
  const now = await reg(ids.n), g = (now.b - now.a) / (was.b - was.a)
  ok('notes, with option: the region is twice as long', near(g, 2, 1e-6), [now.a, now.b])
  ok('each note begins and lasts twice as late and as long; pitch and velocity as they were', now.notes.every((q, i) => near(q[0], was.notes[i][0] * g) && near(q[1], was.notes[i][1] * g) && q[2] === was.notes[i][2] && q[3] === was.notes[i][3]), now.notes)
  ok('what was turned along them goes with them', near(now.ctl[0][0], was.ctl[0][0] * g), now.ctl)
  await b.press('z', 'KeyZ', 90, 4); await b.sleep(80)
  const back = await reg(ids.n)
  ok('one undo: as it was', near(back.b, was.b) && JSON.stringify(back.notes) === JSON.stringify(was.notes), [back.b, back.notes])
  await pull(ids.n, -1, ALT)
  const half = await reg(ids.n)
  ok('pulled in: half as long, the notes twice as close', near((half.b - half.a) / (was.b - was.a), .5) && near(half.notes[2][0], was.notes[2][0] * .5), [half.b, half.notes])
  await b.press('z', 'KeyZ', 90, 4); await b.sleep(80) }
// while it is pulled the region is seen at the length it would have, and what is in it is drawn stretched with it
{ const p = await endOf(ids.n), was = await reg(ids.n)
  const wide = () => ev(`flush(); const [r] = regOf(${ids.n}); return { drawn: document.getElementById('g-lanes').innerHTML.length, b: r.b, x: bx(r.b), last: r.notes[r.notes.length - 1].t, said: S.last && S.last.say, html: document.getElementById('g-lanes').innerHTML }`)
  const w0 = await wide()
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, buttons: 0, modifiers: ALT }); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1, modifiers: ALT })
  for (const dx of [10, 40, 90, 120]) await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + dx, y: p.y, button: 'left', buttons: 1, modifiers: ALT })
  await b.sleep(120)
  const w1 = await ev(`const [r] = regOf(${ids.n}); return { b: r.b, last: r.notes[r.notes.length - 1].t, said: S.last && S.last.say, html: document.getElementById('g-lanes').innerHTML }`)      // (not flushed by the check: what the page drew by itself)
  ok('held, mid-pull: the region is drawn longer already, its notes further apart, and the foot says by how much', w1.b === 74 && w1.last === was.notes[2][0] * 2 && w1.html !== w0.html && /stretch 200%/.test(w1.said || ''), [w1.b, w1.last, w1.said, w1.html === w0.html])
  if (process.env.PICS) { const { writeFileSync } = await import('node:fs'); const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 100, width: 1440, height: 330, scale: 2 } }); writeFileSync(process.env.PICS + 'stretch, held.png', Buffer.from(r.data, 'base64')) }
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1, modifiers: ALT }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', buttons: 0, clickCount: 1, modifiers: ALT }); await b.sleep(80) }
// without option the end is only pulled: the notes stay where they are
{ const was = await reg(ids.n)
  await pull(ids.n, 1, 0)
  const now = await reg(ids.n)
  ok('without option the end is only pulled out: the notes are where they were', near(now.b, was.b + 1) && JSON.stringify(now.notes) === JSON.stringify(was.notes), [now.b])
  await b.press('z', 'KeyZ', 90, 4); await b.sleep(80) }

// a sound: slower to fill the length, at its pitch; its pins and fades go with it; it covers what it grew over
await ev(`showRow(${ids.rows[1]}); dirtyAll(); flush()`)
{ const was = await reg(ids.f)
  await pull(ids.f, 2, ALT)
  const now = await reg(ids.f), g = (now.b - now.a) / (was.b - was.a), nx = await reg(ids.f2)
  ok('a sound, with option: twice as long', near(g, 2), [now.a, now.b])
  ok('it plays at half its speed, at its pitch, and follows the tempo from now on', near(now.rate, was.rate / g) && near(now.sec, was.sec * g) && now.fx === true && near(now.srcBars, was.srcBars * g), [now.rate, now.sec, now.fx])
  ok('its pin and its fades are as far along as they were, of the whole', near(now.flex[0][1], was.flex[0][1] * g) && near(now.flex[0][0], was.flex[0][0]) && near(now.fi, was.fi * g) && near(now.fo, was.fo * g), [now.flex, now.fi, now.fo])
  ok('what lay where it grew to gives way to it', !nx || nx.a >= now.b - 1e-9, nx && [nx.a, nx.b])
  await b.press('z', 'KeyZ', 90, 4); await b.sleep(80)
  const back = await reg(ids.f), nx2 = await reg(ids.f2)
  ok('one undo: the sound and its neighbour as they were', near(back.b, was.b) && near(back.rate, 1) && back.fx === false && !!nx2 && near(nx2.a, 73) && near(nx2.b, 74), [back, nx2])
  // no further than a quarter of its own speed
  await ev(`const t = S.tracks[${ids.rows[1]}]; t.regs = t.regs.filter(r => r.id !== ${ids.f2}); dirtyAll(); flush()`)
  await pull(ids.f, 12, ALT)
  const far = await reg(ids.f)
  ok('pulled very far: no slower than a quarter of its own speed', near(far.rate, .25) && near(far.b - far.a, 8), [far.rate, far.b])
  await b.press('z', 'KeyZ', 90, 4); await b.sleep(80)
  // pulled out and back to where it was: nothing happened
  const p = await endOf(ids.f)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, buttons: 0, modifiers: ALT }); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1, modifiers: ALT })
  for (const dx of [20, 60, 30, 0]) await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + dx, y: p.y, button: 'left', buttons: 1, modifiers: ALT })
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', buttons: 0, clickCount: 1, modifiers: ALT }); await b.sleep(80)
  const same = await reg(ids.f)
  ok('pulled out and let go where it was: as before', near(same.b, was.b) && near(same.rate, 1) && same.fx === false, [same.b, same.rate, same.fx]) }
// the pointer says so
{ const p = await endOf(ids.f)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, buttons: 0, modifiers: ALT }); await b.sleep(40)
  const c1 = await ev(`return document.querySelector('[data-a="lanes"]').style.cursor`)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x - 1, y: p.y, buttons: 0, modifiers: 0 }); await b.sleep(40)
  const c2 = await ev(`return document.querySelector('[data-a="lanes"]').style.cursor`)
  ok('over the end with option the pointer is the stretching one; without, the pulling one', c1 === 'e-resize' && /url\(.* ew-resize$/.test(c2), [c1, c2.slice(-40)]) }      // (the pulling one: the smart tool's trim, drawn — ew-resize where a drawn pointer is not taken)
// one of the song's own loops is not stretched: with option too its end is only pulled
await ev(`showRow(${ids.rows[2]}); dirtyAll(); flush()`)
{ const was = await reg(ids.lp)
  await pull(ids.lp, 1, ALT)
  const now = await reg(ids.lp)
  ok('a loop of the song: with option too it is only pulled out', near(now.b, was.b + 1) && near(now.off, was.off) && now.fx === false, [now.b, now.off]) }
// the smart tool: the same end, the same pull
await ev(`S.tool = 'smart'; showRow(${ids.rows[0]}); dirtyAll(); flush()`)
{ const was = await reg(ids.n)
  await pull(ids.n, 2, ALT)
  const now = await reg(ids.n)
  ok('with the smart tool too', near((now.b - now.a) / (was.b - was.a), 2) && near(now.notes[2][0], was.notes[2][0] * 2), [now.b]) }
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
