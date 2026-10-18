// node test/groups.mjs — groups (groups draft 1): ⌘G makes a group of the chosen tracks, its name typed in place; its
// name after each track's name opens its card; what it shares is chosen thing by thing — editing, region gain, rubato,
// automation (volume by as much), volume, mute, solo, record; a group switched off, or every group let go with ⇧G, shares
// nothing; a track taken out (a group of one is none), the group deleted (its tracks stay); kept in the song; F2 is slip
// and back.
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('groups: TIMED OUT'); process.exit(2) }, 90000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(80) }
/* three tracks of sound, each with the same take over bars 5 to 9 (as three microphones would have) */
const set = await ev(`if (typeof START !== 'undefined') START.on = false
  const ts = S.tracks.filter(t => t.kind === 'audio' && !t.inst && !t.theirs).slice(0, 3), sec = 4 * SPB(), N = Math.round(sec * 100), pk = new Float32Array(N).fill(.3)
  ts.forEach((t, k) => { t.grp = null; delete t.gm; t.mute = false; t.solo = false; t.arm = false; t.autos = {}; t.vol = [-3, -6, -9][k]; t.regs = [mkReg({ a: 5, b: 9, key: 'file:kit', file: 'kit.wav', peaksAll: pk, loop: false, rate: 1, sec, srcBars: 4 })] })
  for (const t of S.tracks) if (!ts.includes(t)) { t.grp = null; delete t.gm }
  S.selT = [ts[0].id, ts[1].id]; S.sel = S.tracks.indexOf(ts[0]); S.focus = 'tracks'; S.grpOff = false; setView(true); dirtyAll(); flush()
  return { i: ts.map(t => S.tracks.indexOf(t)), ids: ts.map(t => t.id), r: ts.map(t => t.regs[0].id) }`)
const [A, B, C] = set.i, T = k => `S.tracks[${set.i[k]}]`
await key('g', 'KeyG', 71, 4)
const made = await ev(`return { a: ${T(0)}.grp, b: ${T(1)}.grp, c: ${T(2)}.grp, name: ${T(0)}.grp && grpMeta(${T(0)}.grp).name, card: !!GCARD, typing: !document.getElementById('rename').hidden }`)
ok('⌘G: the two chosen tracks are one group, named, its card open and its name ready to be typed', !!made.a && made.a === made.b && !made.c && /^group \d+$/.test(made.name) && made.card && made.typing, made)
await ev(`const el = document.getElementById('rename'); el.value = 'drums'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); flush()`)
ok('its name typed: on both tracks, and after each track’s name', await ev(`return grpMeta(${T(0)}.grp).name === 'drums' && ${T(1)}.gm.name === 'drums' && [...document.querySelectorAll('#g-head text, text')].filter(q => q.textContent === 'drums').length >= 2`))
await ev(`undoEdit(); flush()`)
ok('undone: the name it had', await ev(`return /^group \\d+$/.test(grpMeta(${T(0)}.grp).name)`))
await ev(`redoEdit(); flush()`)
const g = await ev(`return ${T(0)}.grp`)
/* each thing shared, and not */
const share = (k, on) => ev(`const s = Object.assign({}, grpMeta('${g}').share); s['${k}'] = ${on}; grpSet('${g}', { share: s }); flush()`)
const mates = (k) => ev(`return groupMates(${T(0)}, '${k}').map(t => t.id)`)
for (const k of ['editing', 'region gain', 'rubato', 'automation', 'volume', 'mute', 'solo', 'record']) {
  const on = await mates(k); await share(k, false); const off = await mates(k); await share(k, true)
  ok(`${k}: shared with the other track, and not when it is not`, on.length === 1 && on[0] === set.ids[1] && off.length === 0, [on, off])
}
ok('editing: a press on one region chooses the other track’s too', await ev(`return withTheirs([${set.r[0]}]).includes(${set.r[1]}) && !withTheirs([${set.r[0]}]).includes(${set.r[2]})`))
await share('region gain', false)
ok('region gain not shared: the gain moves on the region alone, though editing chose both', await ev(`return JSON.stringify(grpGainIds(regOf(${set.r[0]})[0], ${T(0)}, withTheirs([${set.r[0]}]))) === JSON.stringify([${set.r[0]}])`))
await share('region gain', true); await share('editing', false)
ok('region gain shared, editing not: the other region’s gain moves too', await ev(`return grpGainIds(regOf(${set.r[0]})[0], ${T(0)}, [${set.r[0]}]).includes(${set.r[1]})`))
await share('editing', true)
ok('rubato: the other track’s region is stretched with it', await ev(`return flexMates(regOf(${set.r[0]})[0]).map(x => x.id).includes(${set.r[1]})`))
/* mute and solo pressed on one */
await ev(`for (const x of groupOf(${A}, 'mute')) x.mute = true; flush()`)
ok('mute: pressed on one, both', await ev(`return ${T(0)}.mute && ${T(1)}.mute && !${T(2)}.mute`))
await ev(`for (const t of S.tracks) t.mute = false`)
ok('record and volume go to the group too', await ev(`return groupOf(${A}, 'record').includes(${T(1)}) && groupOf(${A}, 'volume').includes(${T(1)}) && !groupOf(${A}, 'record').includes(${T(2)})`))
/* automation: a line drawn on one is drawn on the other, volume by as much */
await ev(`const t = ${T(0)}; edit(() => { addPoint(t, 'vol', 5, -3); addPoint(t, 'vol', 7, -20) }); flush()`)
const au = await ev(`return { b: (${T(1)}.autos.vol || []).map(q => [q.b, q.v]), c: (${T(2)}.autos.vol || []).length }`)
ok('automation: the line drawn on one is on the other, by as much (−6 dB below it)', JSON.stringify(au.b) === JSON.stringify([[5, -6], [7, -23]]) && au.c === 0, au)
await ev(`undoEdit(); flush()`)
ok('…undone, from both', await ev(`return !(${T(0)}.autos.vol || []).length && !(${T(1)}.autos.vol || []).length`))
await share('automation', false)
await ev(`const t = ${T(0)}; edit(() => { addPoint(t, 'vol', 5, -3) }); flush()`)
ok('automation not shared: drawn on one only', await ev(`return (${T(0)}.autos.vol || []).length === 1 && !(${T(1)}.autos.vol || []).length`))
await ev(`undoEdit(); flush()`); await share('automation', true)
/* the group switched off, and every group let go */
await ev(`grpSet('${g}', { on: false }); flush()`)
ok('switched off: nothing is shared, its name dims', (await mates('editing')).length === 0 && (await mates('mute')).length === 0)
await ev(`grpSet('${g}', { on: true }); flush()`)
await key('G', 'KeyG', 71, 8)
ok('⇧G: every group let go', await ev(`return S.grpOff && groupMates(${T(0)}).length === 0`))
await key('G', 'KeyG', 71, 8)
ok('⇧G again: back', await ev(`return !S.grpOff && groupMates(${T(0)}).length === 1`))
/* its card: the chosen third track put in, one taken out, the group deleted */
await ev(`GCARD = { g: '${g}', i: ${A} }; S.selT = [${set.ids[2]}]; S.focus = 'tracks'; DOWN_MORE['gc-add'](); flush()`)
ok('+ the chosen tracks: the third is in', await ev(`return ${T(2)}.grp === '${g}' && ${T(2)}.gm.name === grpMeta('${g}').name`))
ok('kept in the song', await ev(`const s = serialize(); return /"gm":\\{"name":"drums"/.test(typeof s === 'string' ? s : JSON.stringify(s))`))
await ev(`DOWN_MORE['gc-out'](null, { dataset: { t: '${set.ids[2]}' } }); flush()`)
ok('× takes one out', await ev(`return !${T(2)}.grp && ${T(0)}.grp === '${g}'`))
await ev(`DOWN_MORE['gc-out'](null, { dataset: { t: '${set.ids[1]}' } }); flush()`)
ok('…and a group of one is no group', await ev(`return !${T(0)}.grp && !${T(1)}.grp && !GCARD`))
await ev(`undoEdit(); undoEdit(); flush(); GCARD = { g: '${g}', i: ${A} }; DOWN_MORE['gc-del'](); flush()`)
ok('delete the group: its tracks stay, ungrouped', await ev(`return !${T(0)}.grp && !${T(1)}.grp && S.tracks.includes(${T(0)}) && !GCARD`))
/* F2: slip, and back */
await ev(`setMode('smart')`)
await key('F2', 'F2', 113); const m1 = await ev(`return S.mode`)
await key('F2', 'F2', 113); const m2 = await ev(`return S.mode`)
ok('F2: slip, and again back to what it was', m1 === 'slip' && m2 === 'smart', [m1, m2])
ok('the menu says ⌘G groups the tracks', await ev(`return JSON.stringify(MENU_BAR(), (k, v) => typeof v === 'function' ? undefined : v).includes('["Group Tracks","⌘KeyG"')`))
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `groups: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'groups: all passed')
process.exit(bad.length ? 1 : 0)
