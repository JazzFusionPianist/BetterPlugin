// node test/speedfade.mjs — speed fades (his ask, 2026-10-23: "로직처럼 fade-in 이랑 fade-out 우클릭했을 때 speed up, slow
// down"): the other button on a fade out offers a fade or slow down, on a fade in a fade or speed up; picked, it is one
// step of undo, told to the engine, kept with the project, drawn as a broken line with the part above it a deep blue; half of a
// crossfade, or a region where it has no fade, keeps the tool menu. And heard (the page's own playback, rendered offline):
// through a slow down the sound runs slower and lower at its level, and before it is as it was; a speed up arrives where the
// sound plays on from, in step with it. Real presses.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const rclick = async p => { await b.sleep(300); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'right', buttons: 2, clickCount: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'right', clickCount: 1 }); await b.sleep(120) }
const items = () => ev(`return S.menu ? S.menu.items.map(it => [it.t, !!it.on]) : null`)
const pick = async label => { const i = await ev(`return S.menu ? S.menu.items.findIndex(it => it.t === ${JSON.stringify(label)}) : -1`); if (i < 0) return false; const q = await ev(`const el = document.querySelector('[data-a="pick"][data-i="${i}"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(q.x, q.y); await b.sleep(120); return true }
const close = () => ev(`S.menu = null; uiDirty('menu'); flush(); return 1`)
/* a place on the hum track's first region: x a bar (1-based), y down its row (0 top, 1 foot), in the window's pixels */
const at = (bar, down = .5) => ev(`flush(); const b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (bx(${bar}) + (SKV.left || 0)) * k, y: b0.top + (rowY(TI) + rowH(TI) * ${down}) * k }`)
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(false, false); S.rh = 60; S.auto = false; S.tool = 'pointer'; setZoom(48, 0); VX = 0; VY = 0
  const t = S.tracks.find(x => x.name === 'hum'); window.TI = S.tracks.indexOf(t); t.regs.sort((p, q) => p.a - q.a); window.RG = t.regs[0]; RG.fo = 1.5; RG.fi = 1; delete RG.fis; delete RG.fos
  S.selR = []; dirtyAll(); flush(); return [RG.a, RG.b]`)
const [ra, rb] = await ev(`return [RG.a, RG.b]`)

/* the fade out */
{ const u0 = await ev(`return UNDO.length`)
  await rclick(await at(rb - .4, .4))
  const m = await items()
  ok('the other button on a fade out: a fade (as it is) or slow down', JSON.stringify(m) === JSON.stringify([['fade', true], ['slow down', false]]), m)
  ok('…and the region is chosen', await ev(`return S.selR.includes(RG.id)`))
  await pick('slow down')
  const r = await ev(`const r = regOf(RG.id)[0]; return { fos: r.fos, fis: !!r.fis, undo: UNDO.length }`)
  ok('slow down picked: it is a slow down, the fade in left as it was, one step of undo', r.fos === true && !r.fis && r.undo === u0 + 1, [r, u0])
  await rclick(await at(rb - .4, .4))
  ok('…its menu says so', JSON.stringify(await items()) === JSON.stringify([['fade', false], ['slow down', true]]), await items())
  await close() }
{ const msg = await ev(`const r = regOf(RG.id)[0]; return { fis: speedFade(r, true) ? 1 : 0, fos: speedFade(r, false) ? 1 : 0 }`)      // (as native.js regMsgOf tells it)
  ok('told to the engine: fos 1, fis 0', msg.fos === 1 && msg.fis === 0, msg) }
ok('drawn: a broken line, the part above it darkened in a deep blue', await ev(`flush(); const g = LANES.rows.get(S.tracks[TI].id); return !!g && g.html.includes('stroke-dasharray="3 2.5"') && g.html.includes('fill="#18224F"')`))
ok('…its sound outline does not taper under it', await ev(`const r = regOf(RG.id)[0]; return fadeLevel(r, false, .5, fadeBend(r, false)) === 1 && fadeLevel(r, false, .05, fadeBend(r, false)) < 1`))
ok('its speed runs down evenly (no bend of its own)', await ev(`return fadeBend(regOf(RG.id)[0], false) === 0`))

/* the fade in */
await rclick(await at(ra + .3, .4))
ok('on a fade in: a fade or speed up', JSON.stringify(await items()) === JSON.stringify([['fade', true], ['speed up', false]]), await items())
await pick('speed up')
ok('speed up picked', await ev(`return regOf(RG.id)[0].fis === true`))
/* back to a fade, and undo */
await rclick(await at(ra + .3, .4)); await pick('fade')
ok('fade picked again: a fade', await ev(`return !regOf(RG.id)[0].fis`))
await ev(`undoEdit(); flush(); return 1`)
ok('…undone: speed up again', await ev(`return regOf(RG.id)[0].fis === true`))
/* kept */
{ const k = await ev(`const d = JSON.parse(serialize()), r = d.tracks.flatMap(t => t.regs || []).find(r => r.id === RG.id); return r && [r.fis, r.fos]`)
  ok('kept with the project', JSON.stringify(k) === '[true,true]', k) }
/* the middle of the region, and half of a crossfade: the tool menu */
await rclick(await at((ra + rb) / 2, .4))
ok('the other button in the middle of the region: the tool menu, as before', await ev(`return !!S.menu && !!S.menu.tools`))
await close()
{ const r = await ev(`const t = S.tracks.find(x => x.name === 'keys'); window.TK = S.tracks.indexOf(t); window.KEPT = t.regs; const src = KEPT.find(q => !q.loop) || KEPT[0]
  const A = mkReg({ a: 2, b: 6, buf: src.buf, key: src.key, loop: src.loop, off: 0, srcBars: 99 }), B = mkReg({ a: 5, b: 9, buf: src.buf, key: src.key, loop: src.loop, off: 3, srcBars: 99 }); A.fo = 1; B.fi = 1; A.fos = true; t.regs = [A, B]; dirtyAll(); flush(); return [!!xfadeOf(A, B), speedFade(A, false, t)]`)
  ok('half of a crossfade stays a fade (a slow down set on it is not heard)', r[0] && r[1] === false, r)
  const p = await ev(`flush(); const b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (bx(5.5) + (SKV.left || 0)) * k, y: b0.top + (rowY(TK) + rowH(TK) * .4) * k }`)
  await rclick(p)
  ok('…and the other button on it: the tool menu', await ev(`return !!S.menu && !!S.menu.tools`), await items())
  await close()
  await ev(`S.tracks[TK].regs = KEPT; dirtyAll(); flush(); return 1`) }

/* heard: the page's own playback, rendered offline — a tone of 440 Hz, four seconds, a fade of one second at each end */
const heard = async (fis, fos, fi, fo) => ev(`
  const was = S.tempo; setTempo(120)
  const sr = 48000, sec = 4, ctx = new OfflineAudioContext(1, sr * sec, sr), buf = ctx.createBuffer(1, sr * 8, sr), d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = .5 * Math.sin(2 * Math.PI * 440 * i / sr)
  const r = mkReg({ a: 1, b: 3, loop: false, off: 1, srcBars: 4, rate: 1 }); r.buf = buf; r.fi = ${fi}; r.fo = ${fo}; if (${fis}) r.fis = true; if (${fos}) r.fos = true
  const t = { regs: [r] }
  schedule(ctx, t, ctx.destination, 0, 0, 99, () => buf)
  const o = await ctx.startRendering(), x = o.getChannelData(0); setTempo(was)
  const win = (s0, s1) => { const a = Math.round(s0 * sr), z = Math.round(s1 * sr); let n = 0, e = 0; for (let i = a + 1; i < z; i++) { if ((x[i - 1] < 0) !== (x[i] < 0)) n++; e += x[i] * x[i] } return { hz: n / 2 / (s1 - s0), rms: Math.sqrt(e / (z - a)) } }
  return { early: win(1.2, 1.3), half: win(3.45, 3.55), mid: win(.45, .55), late: win(3.9, 3.95), wave: Array.from(x.subarray(sr * 1.5 - 300, sr * 1.5 + 700)), pre: Array.from(x.subarray(sr * 2.5, sr * 2.5 + 400)) }`)
{ const plain = await heard(false, false, 0, 0), slow = await heard(false, true, 0, .5)
  ok('a slow down heard: half way through it the tone is an octave down, at its level', Math.abs(slow.half.hz - 220) < 15 && Math.abs(slow.half.rms - plain.early.rms) < .03, [slow.half, plain.early])
  ok('…before it, the sound as it was', plain.pre.every((v, i) => Math.abs(v - slow.pre[i]) < 1e-3))
  ok('…near its end lower still, and quieter', slow.late.hz < 40 && slow.late.rms < plain.early.rms * .9, slow.late) }
{ const plain = await heard(false, false, 0, 0), fast = await heard(true, false, .5, 0)
  ok('a speed up heard: half way through it the tone is an octave down, at its level', Math.abs(fast.mid.hz - 220) < 15 && Math.abs(fast.mid.rms - plain.early.rms) < .03, [fast.mid, plain.early])
  /* (the page's playback turns its speed once every 128 samples, so it lands within four thousandths of a second; the app's engine, to the sample: selftest speedFade) */
  let best = [1e9, 0]; for (let L = -200; L <= 200; L++) { let e = 0; for (let i = 0; i < 400; i++) e = Math.max(e, Math.abs(plain.wave[300 + i] - fast.wave[300 + i + L])); if (e < best[0]) best = [e, L] }
  ok('…after it, the sound in step with the plain one (within 4 thousandths of a second)', best[0] < .01 && Math.abs(best[1]) <= 192, best) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
