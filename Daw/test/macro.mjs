// node test/macro.mjs — macros in the patch panel: + makes one; a wire drawn from its dot to a plug-in on the wall opens
// the list of that plug-in's controls, found by typing; the one picked is what it turns, and it takes its name; turned by
// hand, the control is set (asked of the app); in the automation view the track's lines list it by that name and a line
// drawn for it is told to the engine as the control's line; named by hand twice on its name; delete takes it with its
// line; kept with the project and with a preset. (In a browser there is no app: a stand-in lists the controls.)
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('macro: TIMED OUT'); process.exit(2) }, 120000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1, before: `window.MACRO_STAND_IN = ins => [[0, 'Threshold', .42, '-18.0 dB'], [1, 'Head Room', .3, '5.0 dB'], [2, 'Attack Time', .1, '1.0 ms'], [3, 'Release Time', .2, '50 ms'], [4, 'Master Gain', .5, '0.0 dB']]` })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const at = sel => ev(`flush(); const el = document.querySelector('${sel}'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
const texts = () => ev(`flush(); return [...document.getElementById('g-dock').querySelectorAll('text')].map(t => t.textContent)`)
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.sel = 0; S.panel.on = true; S.panel.tab = 'patch'; setView(true)
  const t = S.tracks[0]; t.inserts.push({ uid: 0, id: 'AudioUnit:test/comp', name: 'Compressor', fmt: 'au', state: '' }); wallOf(t); const w = wallOf(t), pl = w.nodes.find(n => n.k === 'plug'); pl.x = 360; pl.y = 0; w.z = 0; dirtyAll(); flush()`)
await b.sleep(300)

ok('the column of macros stands at the left of the wall, with none yet and its +', (await texts()).includes('macros') && (await texts()).includes('none yet') && !!(await at('[data-a="macro"][data-k="add"]')))
{ const p = await at('[data-a="macro"][data-k="add"]'); await b.click(p.x, p.y); await b.sleep(100) }
const m0 = await ev(`return S.tracks[0].macros`)
ok('+ makes a macro, named macro 1, not wired', m0.length === 1 && m0[0].name === 'macro 1' && m0[0].to === null && (await texts()).includes('not wired'), m0)

/* a wire from its dot to the plug-in */
{ const a = await at('[data-a="macro"][data-k="port"]'), node = await ev(`const t = S.tracks[0], w = wallOf(t), v = wallView(w, WALL.g), n = w.nodes.find(q => q.k === 'plug'); return { x: v.tx + n.x * v.z, y: v.ty + n.y * v.z }`)
  await mouse('mouseMoved', a.x, a.y, { buttons: 0 }); await mouse('mousePressed', a.x, a.y)
  for (let k = 1; k <= 8; k++) await mouse('mouseMoved', a.x + (node.x - a.x) * k / 8, a.y + (node.y - a.y) * k / 8)
  await b.sleep(60)
  const mid = await ev(`return { drag: MAC.drag && MAC.drag.k, over: MAC.drag && MAC.drag.over }`)
  ok('drawn from its dot over the plug-in, the plug-in is lit', mid.drag === 'wire' && mid.over != null, mid)
  await mouse('mouseReleased', node.x, node.y); await b.sleep(250) }
{ const L = await ev(`return MAC.list ? { plug: MAC.list.plug, rows: MAC.list.rows.map(r => r.name), busy: MAC.list.busy } : null`), tx = await texts()
  ok('let go on it: the list of its controls, with what each reads now', !!L && L.plug === 'compressor' && L.rows.length === 5 && !L.busy && tx.includes('threshold') && tx.includes('-18.0 db') && tx.includes('5 controls'), [L, tx.filter(x => /db|ms|controls/.test(x))])
  await b.press('m', 'KeyM', 77); await b.press('a', 'KeyA', 65); await b.press('s', 'KeyS', 83); await b.sleep(100)
  const f = await ev(`return { q: MAC.list.q, rows: macroRows().map(r => r.name) }`)
  ok('typed: only the controls by that name are left', f.q === 'mas' && f.rows.join() === 'master gain', f)
  await b.press('Enter', 'Enter', 13); await b.sleep(150) }
{ const m = await ev(`const t = S.tracks[0], m = t.macros[0], ins = macroIns(t, m); return { name: m.name, to: m.to, v: m.v, n: ins && ins.n, pn: ins && ins.pn, list: !!MAC.list }`)
  ok('picked: the macro turns that control, takes its name, and stands where the control does', m.name === 'master gain' && m.to && m.to.i === 4 && m.to.plug === 'compressor' && m.v === .5 && m.n >= 1 && !m.list && (await texts()).includes('master gain') && (await texts()).includes('compressor'), m) }

/* turned by hand */
{ const k = await at('[data-a="macro"][data-k="knob"]')
  await ev(`window.__set = []`)
  await mouse('mouseMoved', k.x, k.y, { buttons: 0 }); await mouse('mousePressed', k.x, k.y)
  for (let s = 1; s <= 5; s++) await mouse('mouseMoved', k.x, k.y - s * 6)
  await mouse('mouseReleased', k.x, k.y - 30); await b.sleep(100)
  const v = await ev(`const t = S.tracks[0], m = t.macros[0], ins = macroIns(t, m); return { v: m.v, pv: ins.pv[4] }`)
  ok('turned up by hand: it reads more, and so does the control it turns', v.v > .65 && Math.abs(v.v - .7) < .02 && v.pv === v.v, v) }

/* in the automation view */
{ const r = await ev(`const t = S.tracks[0]; return { params: autoParams(t), name: autoName(t, 'mac' + t.macros[0].id) }`)
  ok('the track’s lines list it after its own, by its name', r.params.slice(0, 6).join() === 'vol,pan,tape,space,delay,mac1' && r.name === 'master gain', r)
  const items = await ev(`const t = S.tracks[0]; await openAutoMenu(t, 200, 200); flush(); return S.menu.items.map(i => [i.t, i.k, !!i.sep])`)
  ok('…and the line’s list says it with the plug-in it is in', items.some(i => /master gain/.test(i[0]) && /compressor/.test(i[1]) && i[2]), items)
  await ev(`S.menu = null; uiDirty('menu'); const t = S.tracks[0]; t.inserts[0].uid = 77; addPoint(t, 'mac1', 4, .2); addPoint(t, 'mac1', 8, .9)`)
  const msg = await ev(`return autoMsg(S.tracks[0])`)
  ok('a line drawn for it is told to the engine as the control’s line', msg.some(m => m.p === 100 && m.uid === 77 && m.i === 4 && m.pts.length === 2), msg)
  await ev(`S.tracks[0].inserts[0].uid = 0`) }

/* named by hand; kept with the project and a preset; taken away */
{ const nm = await at('[data-a="macro"][data-k="name"]')
  await b.click(nm.x, nm.y); await b.click(nm.x, nm.y); await b.sleep(150)
  const box = await ev(`const el = document.getElementById('rename'); return { open: !el.hidden, v: el.value }`)
  await ev(`const el = document.getElementById('rename'); el.value = 'Glue'`); await b.press('Enter', 'Enter', 13); await b.sleep(100)
  ok('twice on its name: named by hand', box.open && box.v === 'master gain' && (await ev(`return S.tracks[0].macros[0].name`)) === 'Glue', box)
  const kept = await ev(`const o = JSON.parse(serialize()); return o.tracks[0].macros`)
  ok('written with the project', Array.isArray(kept) && kept[0].name === 'Glue' && kept[0].to.i === 4, kept)
  const pre = await ev(`const g = JSON.parse(presetJson(S.tracks[0])); return { macros: g.slurStudio.macros, n: g.slurStudio.inserts[0].n }`)
  ok('…and with a preset, the plug-in with the number it is wired by', pre.macros.length === 1 && pre.macros[0].to.n === pre.n, pre)
  const k = await at('[data-a="macro"][data-k="knob"]'); await b.click(k.x, k.y); await b.sleep(60)
  await b.press('Backspace', 'Backspace', 8); await b.sleep(120)
  const gone = await ev(`const t = S.tracks[0]; return { macros: t.macros.length, line: !!(t.autos && t.autos.mac1), regs: t.regs.length }`)
  ok('chosen, delete takes it away with its line, and nothing else', gone.macros === 0 && !gone.line && gone.regs > 0, gone) }
{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `macro: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'macro: all passed')
process.exit(bad.length ? 1 : 0)
