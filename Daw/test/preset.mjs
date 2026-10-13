// node test/preset.mjs — a patch kept as a preset, in the patch panel: the bar in the panel's head (the one before, the
// name with its list, the one after), the list (initial; the kept ones, each with remove, asked once; save, save as…),
// a wall kept under a name and put back from it whole — prints, their settings, the wires, a plug-in's place — in one
// step that undo takes back; the star after a name once the wall is changed; the file as Patch on Slur reads it, and a
// file Patch on Slur wrote put on a wall. (In a browser the presets are kept in the browser's own store.)
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('preset: TIMED OUT'); process.exit(2) }, 120000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const at = k => ev(`flush(); const el = document.querySelector('[data-a="pre"][data-k="${k.split(' ')[0]}"]${k.includes(' ') ? `[data-i="${k.split(' ')[1]}"]` : ''}'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
const press = async k => { const p = await at(k); if (!p) return false; await b.click(p.x, p.y); await b.sleep(180); return true }
const texts = () => ev(`flush(); return [...document.getElementById('g-dock').querySelectorAll('text')].map(t => t.textContent)`)
const wall = () => ev(`const t = wallTrack(), w = wallOf(t), p = patchNow(t); return { nodes: w.nodes.map(n => n.k === 'plug' ? 'plug:' + ((n.ins && n.ins.name) || '?') : n.k + ':' + Math.round(wallAmount(t, n) * 100)), wires: w.wires.map(e => [e.from, e.to, Math.round(e.gain * 100)]), inserts: t.inserts.map(i => [i.id, i.state, !!i.out]), pre: t.pre ? [t.pre.name, presetDirty(t)] : null, undo: UNDO.length }`)

await ev(`try { localStorage.removeItem('orb_wall_presets') } catch (e) {}; window.prompt = () => window.__typed || ''; if (typeof START !== 'undefined') START.on = false; setView(true); S.sel = 0; S.panel.on = true; S.panel.tab = 'patch'; setView(true); PRE.list = []; dirtyAll(); flush()`)
await b.sleep(500); await ev(`dirtyAll(); flush()`)

/* the bar, and the list with nothing kept */
{ const g = await ev(`flush(); return PRE.geo`), t0 = await texts()
  ok('the bar stands in the head of the patch panel, and a wall never kept reads untitled', !!g && t0.includes('untitled') && !!(await at('box')) && !!(await at('prev')) && !!(await at('next')), [g, t0.slice(0, 8)])
  await press('box')
  const t1 = await texts()
  ok('the name pressed: the list, with initial, no presets yet, save as… — and no save, no open… without the app', await ev(`return PRE.open`) && t1.includes('initial') && t1.includes('no presets yet') && t1.includes('save as…') && !t1.includes('save') && !t1.includes('open…'), t1.slice(-6))
  await b.press('Escape', 'Escape', 27); await b.sleep(100)
  ok('escape puts the list away', !(await ev(`return PRE.open`))) }

/* a wall built, and kept */
await ev(`const t = wallTrack(); wallAdd(t, 'tape'); wallAdd(t, 'space'); wallAdd(t, 'crush'); const w = wallOf(t), id = k => w.nodes.find(n => n.k === k).id
  w.wires = [{ from: WALL_IN, to: id('tape'), gain: 1, port: 0 }, { from: id('tape'), to: id('space'), gain: 1, port: 0 }, { from: id('tape'), to: id('crush'), gain: 1, port: 0 }, { from: id('space'), to: WALL_OUT, gain: 1, port: 0 }, { from: id('crush'), to: WALL_OUT, gain: 1, port: 0 }]
  wallSetAmount(t, wallNode(w, id('crush')), .4); setPrint(t, 'space', 46)
  t.inserts.push({ uid: 0, name: 'Channel EQ', fmt: 'au', id: 'AudioUnit:test/eq', state: 'c2V0dGluZ3M=', out: true }); wallOf(t); dirtyAll(); flush()`)
const w1 = await wall()
ok('a wall to keep: three prints, wired side by side, and a plug-in from outside', w1.nodes.length === 4 && w1.nodes.includes('plug:Channel EQ') && w1.nodes.includes('crush:40') && w1.nodes.includes('space:46'), w1.nodes)
{ await press('box'); await ev(`window.__typed = 'Lead Vox: Chain'`); await press('saveas'); await b.sleep(250)
  const s = await ev(`return { list: PRE.list, open: PRE.open, pre: wallTrack().pre && wallTrack().pre.name, store: Object.keys(JSON.parse(localStorage.getItem('orb_wall_presets') || '{}')) }`)
  ok('save as…: kept under the name typed, made lower and fit for a file; the list is away and the bar reads the name', s.list.join() === 'lead vox chain' && !s.open && s.pre === 'lead vox chain' && s.store.join() === 'lead vox chain' && (await texts()).includes('lead vox chain'), s)
  const f = await ev(`const g = JSON.parse(localStorage.getItem('orb_wall_presets'))['lead vox chain']; return { types: g.nodes.map(n => n.type), edges: g.edges.length, ids: g.nodes.every(n => typeof n.id === 'number'), own: !!g.slurStudio, wallNodes: g.slurStudio.wall.nodes.map(n => n.k), ins: g.slurStudio.inserts, hasIns: g.slurStudio.wall.nodes.some(n => 'ins' in n) }`)
  ok('the file as patch on slur reads it: the three prints by their numbers, wired; the plug-in is not among them', f.types.length === 3 && f.types.includes(1) && f.types.includes(2) && f.types.includes(20) && f.edges >= 5 && f.ids, f)
  ok('…and the wall whole beside it: the plug-in in its place, with what it is and its settings', f.own && f.wallNodes.filter(k => k === 'plug').length === 1 && f.ins.length === 1 && f.ins[0].id === 'AudioUnit:test/eq' && f.ins[0].state === 'c2V0dGluZ3M=' && !f.hasIns, f) }

/* changed: the star; saved: no star */
{ await ev(`const t = wallTrack(), w = wallOf(t); wallSetAmount(t, w.nodes.find(n => n.k === 'crush'), .9); dirtyAll(); flush()`)
  ok('the wall changed: a star after the name', (await wall()).pre[1] === true && (await texts()).includes('lead vox chain *'), await texts().then(t => t.filter(x => /chain/.test(x))))
  await press('box')
  ok('the list now offers save', (await texts()).includes('save'))
  await press('save'); await b.sleep(200)
  const s = await ev(`return { dirty: presetDirty(wallTrack()), amt: JSON.parse(localStorage.getItem('orb_wall_presets'))['lead vox chain'].slurStudio.wall.nodes.find(n => n.k === 'crush').amount }`)
  ok('save writes over the file, and the star is gone', s.dirty === false && Math.abs(s.amt - .9) < 1e-6, s) }

/* initial: the empty wall, in one step; undo brings everything back */
{ const before = await wall()
  await press('box'); await press('first'); await b.sleep(250)
  const w = await wall()
  ok('initial: nothing on the wall, no plug-in on the track, the bar reads initial', w.nodes.length === 0 && w.wires.length === 0 && w.inserts.length === 0 && w.pre[0] === 'initial' && w.undo === before.undo + 1, w)
  await ev(`undoEdit(); flush()`); await b.sleep(250)
  const back = await wall()
  ok('undo: the wall as it was — prints, amounts, wires, the plug-in and its settings, and its name', JSON.stringify(back.nodes) === JSON.stringify(before.nodes) && JSON.stringify(back.wires) === JSON.stringify(before.wires) && back.inserts[0][1] === 'c2V0dGluZ3M=' && back.pre[0] === 'lead vox chain', [back.nodes, before.nodes])
  await ev(`redoEdit(); flush()`); await b.sleep(250)
  ok('redo: empty again', (await wall()).nodes.length === 0) }

/* a name pressed: the kept wall is put up whole */
{ await press('box'); await press('pick 0'); await b.sleep(300)
  const w = await wall()
  ok('the name pressed in the list: the kept wall, whole', w.nodes.length === 4 && w.nodes.includes('crush:90') && w.nodes.includes('space:46') && w.nodes.includes('plug:Channel EQ') && w.wires.length >= 5 && w.inserts.length === 1 && w.inserts[0][0] === 'AudioUnit:test/eq' && w.inserts[0][1] === 'c2V0dGluZ3M=' && w.pre[0] === 'lead vox chain' && w.pre[1] === false, w) }

/* onto another track; the arrows */
{ await ev(`chooseTrack(2, ''); S.focus = 'tracks'; dirtyAll(); flush()`)
  ok('another track: its own wall, never kept', (await wall()).pre === null && (await texts()).includes('untitled'))
  await press('next'); await b.sleep(250)
  const a = await wall()
  await press('next'); await b.sleep(300)
  const c = await wall()
  await press('prev'); await b.sleep(250)
  const d = await wall()
  ok('the one after, twice: initial, then the kept one; the one before: initial again', a.pre[0] === 'initial' && c.pre[0] === 'lead vox chain' && c.nodes.length === 4 && d.pre[0] === 'initial' && d.nodes.length === 0, [a.pre, c.pre, d.pre]) }

/* a file patch on slur wrote: put on the wall from its prints and wires alone */
{ await ev(`const all = JSON.parse(localStorage.getItem('orb_wall_presets')); all['from the plug-in'] = { nodes: [{ id: 7, type: 1, amount: .3, variant: 1, x: 200, y: 280 }, { id: 9, type: 10, amount: .5, variant: 2, delayDiv: 3, delayFb: .6, x: 430, y: 200 }, { id: 12, type: 999, amount: .5, x: 430, y: 360 }, { id: 14, type: 10, amount: .2, x: 660, y: 280 }], edges: [{ from: -1, to: 7, gain: 1 }, { from: 7, to: 9, gain: 1 }, { from: 7, to: 12, gain: 1 }, { from: 9, to: 14, gain: 1 }, { from: 12, to: -2, gain: 1 }, { from: 14, to: -2, gain: 1 }] }; localStorage.setItem('orb_wall_presets', JSON.stringify(all))`)
  await press('box'); await b.sleep(200)
  const names = await ev(`return PRE.list`)
  await press('pick ' + names.indexOf('from the plug-in')); await b.sleep(300)
  const w = await wall(), more = await ev(`const t = wallTrack(), w = wallOf(t), d = w.nodes.find(n => n.k === 'delay'); return { div: d && d.div, fb: d && d.fb, variant: d && d.variant, said: S.last && S.last.say, reach: wallReach(w, WALL_IN, WALL_OUT) }`)
  ok('a file patch on slur wrote: its tape and its delay stand wired from in to out', names.includes('from the plug-in') && w.nodes.length === 2 && w.nodes.includes('tape:30') && w.nodes.includes('delay:50') && more.reach === true && more.div === 3 && Math.abs(more.fb - .6) < 1e-6 && more.variant === 2, [w, more])
  ok('…what this wall has no print for, and a second delay, are left out and said', /2 things/.test(more.said || ''), more.said) }

/* remove asks once */
{ await press('box'); await b.sleep(150)
  const i = (await ev(`return PRE.list`)).indexOf('from the plug-in')
  await press('rm ' + i)
  ok('remove, pressed once: sure?', (await ev(`return PRE.sure`)) === 'from the plug-in' && (await texts()).includes('sure?'))
  await press('rm ' + i); await b.sleep(200)
  const s = await ev(`return { list: PRE.list, store: Object.keys(JSON.parse(localStorage.getItem('orb_wall_presets'))), pre: wallTrack().pre }`)
  ok('pressed again: the preset is gone from the list and from where it was kept; the wall stays, named no more', !s.list.includes('from the plug-in') && !s.store.includes('from the plug-in') && s.pre === null && (await wall()).nodes.length === 2, s) }

/* a press elsewhere puts the list away; the project carries which preset is up */
{ if (!(await ev(`return PRE.open`))) await press('box')
  await b.click(700, 200); await b.sleep(120)
  ok('a press elsewhere puts the list away', !(await ev(`return PRE.open`)))
  const kept = await ev(`chooseTrack(0, ''); const o = JSON.parse(serialize()); return o.tracks[0].pre`)
  ok('which preset is up is written with the project', !!kept && kept.name === 'lead vox chain', kept) }

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `preset: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'preset: all passed')
process.exit(bad.length ? 1 : 0)
