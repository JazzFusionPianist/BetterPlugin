// node test/wavez.mjs — the sound drawn taller or lower: ⌘+ and ⌘− (the real keys, as the page hears them) make every
// region's sound taller or lower on the lanes, the rows staying as they are; a quiet stretch grows, a loud one stops at
// the region's edge; it goes a long way up and no lower than as it is; a key held goes on; it is kept with the project's
// view and is not a change of the song.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const META = 4, SHIFT = 8
const key = async (k, code, vk, mods = META, repeat = false) => { await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers: mods, autoRepeat: repeat }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers: mods }); await b.sleep(60) }
const plus = (mods, repeat) => key('=', 'Equal', 187, mods, repeat), minus = (mods, repeat) => key('-', 'Minus', 189, mods, repeat)

await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.rh = 40; S.wz = 1; for (const t of S.tracks) delete t.h; VY = 0; if (typeof keepNow === 'function') keepNow('opened'); dirtyAll(); flush()`)
/* the first row of sound that shows, and its first region: how tall its sound is drawn, column by column (from the path the
   page itself made), against the room the region gives it */
const pick = await ev(`const vis = rows(); for (const i of vis) { const t = S.tracks[i]; if (t.midi || t.inst || !t.regs || !t.regs.length) continue; const r = t.regs.find(r => !r.notes && bx(r.b) > X0 + 40 && bx(r.a) < X1 - 40); if (r && rowY(i) > TY && rowY(i) + rowH(i) < BY) return { i, id: r.id, name: t.name } } return null`)
ok('there is a row of sound to look at', !!pick, pick)
const seen = () => ev(`flush(); const t = S.tracks[${pick.i}], r = t.regs.find(x => x.id === ${JSON.stringify(pick.id)}), lh = rowH(${pick.i}) - 3, hmax = lh / 2 - 1.5
  const d = r._p || '', ys = (d.match(/[ML][-\\d.]+ [-\\d.]+/g) || []).map(s => +s.split(' ')[1]), yc = (Math.min(...ys) + Math.max(...ys)) / 2, hs = ys.map(y => Math.abs(y - yc))
  hs.sort((a, b) => a - b)
  return { wz: S.wz, n: ys.length, top: +Math.max(...hs).toFixed(2), mid: +(hs.reduce((a, h) => a + h, 0) / hs.length).toFixed(2), full: hs.filter(h => h >= hmax - .05).length, hmax: +hmax.toFixed(2), rh: S.rh, rowH: rowH(${pick.i}), say: S.last && S.last.say, foot: document.getElementById('g-cmd').textContent }`)

const s0 = await seen()
ok('to begin with the sound is drawn as it is, inside its region', s0.wz === 1 && s0.n > 20 && s0.top <= s0.hmax + .01, s0)
ok('…and most of it is far from the edge (mid: how tall it stands on the whole)', s0.mid < s0.hmax * .6, [s0.mid, s0.hmax])

await plus()
const s1 = await seen()
ok('⌘+ : the sound is drawn one and a half times as tall', s1.wz === 1.5 && s1.mid > s0.mid * 1.15 && s1.full >= s0.full, [s0.mid, s1.mid])
ok('…the rows are as tall as they were', s1.rh === s0.rh && s1.rowH === s0.rowH, [s1.rh, s1.rowH])
ok('…what was loud stops at the region’s edge', s1.top <= s1.hmax + .01, [s1.top, s1.hmax])
ok('…and the foot of the window says how much', /waveform ×1\.5/.test(s1.say || ''), s1.say)

await plus(META | SHIFT)
const s2 = await seen()
ok('with shift held as well (the + of the key) it is the same key', Math.abs(s2.wz - 2.25) < 1e-9, s2.wz)

for (let k = 0; k < 6; k++) await plus(META, true)
const s3 = await seen()
ok('held down, it goes on', Math.abs(s3.wz - 2.25 * Math.pow(1.5, 6)) < 1e-6, s3.wz)
ok('…what was quiet now stands tall, many more columns reaching the edge', s3.mid > s1.mid * 1.5 && s3.full > s1.full && s3.top <= s3.hmax + .01, [s0.mid, s1.mid, s3.mid, s3.full])

for (let k = 0; k < 30; k++) await plus(META, true)
const s4 = await seen()
ok('it goes a long way and then stops: a thousand times', s4.wz === 1024 && /waveform ×1024/.test(s4.say || '') && s4.top <= s4.hmax + .01, [s4.wz, s4.say])
await b.shot('wavez-most.png')

{ const r = await ev(`const o = JSON.parse(serialize()); return { wz: o.view && o.view.wz, changed: typeof leaveChanged === 'function' ? leaveChanged() : null }`)
  ok('it is written with the project’s view', r.wz === 1024, r.wz)
  ok('…and is not a change of the song (closing does not ask because of it)', r.changed === false, r.changed) }

await minus()
const s5 = await seen()
ok('⌘− : lower again', Math.abs(s5.wz - 1024 / 1.5) < 1e-6 && /waveform ×683/.test(s5.say || ''), [s5.wz, s5.say])
for (let k = 0; k < 40; k++) await minus(META, true)
const s6 = await seen()
ok('all the way down it is as it is, never lower, and says so', s6.wz === 1 && s6.say === 'waveform as it is' && s6.mid === s0.mid && s6.top === s0.top, [s6.wz, s6.say, s6.mid, s0.mid])

/* the keys alone do nothing; typing a + into a field does not reach it */
await key('=', 'Equal', 187, 0); await key('-', 'Minus', 189, 0)
ok('without ⌘ the two keys leave it alone', (await seen()).wz === 1)

for (let k = 0; k < 4; k++) await plus()
await b.shot('wavez-some.png')
await ev(`S.wz = 1; dirtyAll(); flush()`)

console.log(out.join('\n'))
if (b.errors.length) { console.log('page errors:', b.errors); bad.push('errors') }
await b.close()
console.log(bad.length ? `wavez: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'wavez: all passed')
process.exit(bad.length ? 1 : 0)
