// node test/stereometer.mjs — a stereo track's level in its head as two lines across, left over right (his ask, 2026-10-24,
// his pick of stereo head meter draft 1); a mono track keeps the one: a track fed from a pair of inputs, an instrument, a bus
// and the stereo out have two; a track of sound with nothing of two sides on it has one; each line as loud as its side (the
// engine's two sides per track), falling on its own; without the sides told, the one level on both.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(false, false); S.rh = 60
  const mk = (name, kind, o) => { const t = mkTrack(name, null, null, null, null, -6, [], NO_PATCH()); t.kind = kind; Object.assign(t, o || {}); S.tracks.push(t); return t }
  window.MONO = mk('mono one', 'audio'); window.PAIR = mk('a pair', 'audio', { inp: 100 }); window.BUS = mk('a bus', 'bus')
  window.SYN = S.tracks.find(t => t.inst) || mk('synth', 'audio', { inst: { name: 'synth' } })
  VY = maxVY(); dirtyAll(); flush(); return 1`)
const has = async name => ev(`flush(); const t = ${name}; return { one: !!document.getElementById('mt-' + t.id), two: !!document.getElementById('mt-' + t.id + '-0') && !!document.getElementById('mt-' + t.id + '-1'), stereo: stereoOf(t) }`)
{ const m = await has('MONO'); ok('a track of sound with nothing of two sides on it: one line', m.one && !m.two && !m.stereo, m) }
{ const m = await has('PAIR'); ok('fed from a pair of inputs: two lines', !m.one && m.two && m.stereo, m) }
{ const m = await has('BUS'); ok('a bus: two lines', !m.one && m.two, m) }
{ const m = await has('SYN'); ok('an instrument: two lines', m.stereo, m) }
ok('a sound of two sides decoded by the app makes its track stereo (its key remembered with its sides)', await ev(`const t = MONO; SOUND_CH.set('file:test2', 2); t.regs = [mkReg({ a: 1, b: 3, key: 'file:test2', loop: false, rate: 1, sec: 4, srcBars: 2 })]; const two = stereoOf(t); t.regs = []; SOUND_CH.delete('file:test2'); return two`))
/* each side as loud as it is */
{ const w = await ev(`flush(); const t = PAIR; METERS.t.set(t.id, .5); METERS.ts = new Map([[t.id, [.5, .05]]]); METERS.drawn = -2; drawMeters()
    return [0, 1].map(c => +document.getElementById('mt-' + t.id + '-' + c).getAttribute('width'))`)
  ok('each line as loud as its side: the left longer than the right', w[0] > w[1] + 5 && w[1] > 0, w) }
{ const w = await ev(`const t = PAIR; METERS.ts = null; METERS.t.set(t.id, .3); drawMeters(); return [0, 1].map(c => +document.getElementById('mt-' + t.id + '-' + c).getAttribute('width'))`)
  ok('…no sides told: the one level on both (the right rises to it, the left falls toward it)', Math.abs(w[0] - w[1]) < 1e-6 && w[0] > 0, w) }
{ const m = await ev(`flush(); return !!document.getElementById('mt-out-0') && !!document.getElementById('mt-out-1') && !document.getElementById('mt-out')`)
  ok('the stereo out\'s row: two lines', m) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
