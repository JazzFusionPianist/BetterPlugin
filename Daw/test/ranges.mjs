// node test/ranges.mjs — how far a region's transpose and gain go (his ask, 2026-10-24): transpose ±48 semitones, gain
// ±30 dB — pulled far in the transport panel they stop there; the gain key stops there too. Real pulls.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (p, dy) => { await b.sleep(300); await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); for (let k = 1; k <= 20; k++) await mouse('mouseMoved', p.x, p.y + dy * k / 20); await b.sleep(30); await mouse('mouseReleased', p.x, p.y + dy); await b.sleep(150) }
const place = a => ev(`flush(); const e = document.querySelector('#g-top [data-a="${a}"]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }`)
const reg = () => ev(`const r = S.tracks[TI].regs[0]; return { tr: r.tr || 0, gain: r.gain || 0 }`)
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(true, false)
  const t = S.tracks.find(x => x.kind === 'audio' && !x.inst && !x.midi && x.regs.some(r => !r.notes)); window.TI = S.tracks.indexOf(t); const r = t.regs.find(q => !q.notes); t.regs = [r]; r.tr = 0; r.gain = 0
  S.sel = TI; S.selR = [r.id]; S.focus = 'lanes'; dirtyAll(); flush(); return 1`)
await pull(await place('rtr'), -500)
ok('transpose pulled far up: +48 and no further', (await reg()).tr === 48, await reg())
await pull(await place('rtr'), 500); await pull(await place('rtr'), 500)
ok('…pulled far down: −48', (await reg()).tr === -48, await reg())
await pull(await place('rgain'), -500)
ok('gain pulled far up: +30 dB and no further', (await reg()).gain === 30, await reg())
await pull(await place('rgain'), 500); await pull(await place('rgain'), 500)
ok('…pulled far down: −30 dB', (await reg()).gain === -30, await reg())
{ const r = await ev(`const r = S.tracks[TI].regs[0]; act.gain(80); return { gain: r.gain }`); ok('the gain key past the top: +30', r.gain === 30, r) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
