// node test/ctl.mjs — the prints that play other prints' hands (Patch on Slur's lfo, drift, pulse, macro, follow, env, scene)
// and the bands, on a wall: every print of Patch on Slur is in the wall's list; a wire drawn from an lfo, held over a print,
// shows that print's hands and lands on the one let go on; it is told to the engine as a control wire with its hand and
// depth; chosen, its depth is dragged and its way picked; a macro let go on a hand an lfo plays sets that play's depth; the
// played print's study has a row for each play; an lfo's study draws its shape (a point added, moved, taken away, by Patch
// on Slur's own rules); the bands' study moves a cut; a scene's study takes A and B and the edits at B go into B; a preset
// keeps all of it, and what Patch on Slur reads has it too.
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('ctl: TIMED OUT'); process.exit(2) }, 150000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const drag = async (a, z, steps = 8) => { await mouse('mouseMoved', a.x, a.y, { buttons: 0 }); await mouse('mousePressed', a.x, a.y); for (let i = 1; i <= steps; i++) await mouse('mouseMoved', a.x + (z.x - a.x) * i / steps, a.y + (z.y - a.y) * i / steps); await b.sleep(60) }
const click = async p => { await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); await mouse('mouseReleased', p.x, p.y); await b.sleep(120) }
await ev(`try { localStorage.removeItem('orb_wall_presets') } catch (e) {}; if (typeof START !== 'undefined') START.on = false; setView(true); S.sel = 1; S.panel.on = true; S.panel.tab = 'patch'; S.panel.h = 420; setView(true)
  const t = S.tracks[1]; t.inserts.length = 0; t.patch = NO_PATCH(); t.wall = undefined; for (const k of ['lfo', 'space', 'gain', 'macro', 'bands', 'scene']) wallAdd(t, k)
  const w = wallOf(t), id = k => w.nodes.find(n => n.k === k).id
  w.wires = [{ from: WALL_IN, to: id('space'), gain: 1, port: 0 }, { from: id('space'), to: id('gain'), gain: 1, port: 0 }, { from: id('gain'), to: WALL_OUT, gain: 1, port: 0 }]
  const at = { lfo: [120, -130], space: [260, 0], gain: [420, 0], macro: [420, -150], bands: [120, 140], scene: [560, -150] }
  for (const k in at) Object.assign(wallNode(w, id(k)), { x: at[k][0], y: at[k][1] }); w.in = { x: 40, y: 0 }; w.out = { x: 600, y: 0 }; w.z = 0; WALL.sel = null; studyClose(); dirtyAll(); flush()`)
await b.sleep(300)
const scr = (k, what) => ev(`flush(); const t = S.tracks[1], w = wallOf(t), v = wallView(w, WALL.g), node = w.nodes.find(n => n.k === '${k}'), q = ${what === 'out' ? 'wallOutPort(w, node.id, 0)' : what ? `ctlHandAt(w, node, '${what}')` : 'node'}; return { x: v.tx + q.x * v.z, y: v.ty + q.y * v.z }`)
const wires = () => ev(`const w = wallOf(S.tracks[1]); return w.wires.filter(e => e.hand != null).map(e => ({ from: wallNode(w, e.from).k, to: wallNode(w, e.to).k, hand: e.hand, gain: e.gain, pol: e.pol || 0 }))`)

ok('every print of Patch on Slur is in the wall’s list, the ones that play hands among modulation', await ev(`return PATCH_CATALOG.PRINTS.every(p => WALL_PRINTS.includes(p.name.toLowerCase())) && ['lfo', 'drift', 'pulse', 'env', 'follow', 'macro', 'scene'].every(k => WALL_KIND[k] === 'modulation') && WALL_KIND.bands === 'channel'`))
ok('a new lfo is a sine, drawn; a macro takes the next number', await ev(`const w = wallOf(S.tracks[1]); return Array.isArray(w.nodes.find(n => n.k === 'lfo').pts) && w.nodes.find(n => n.k === 'macro').aux[0] === 0`))

/* a wire from the lfo, held over the space: its hands show; let go on decay */
{ const a = await scr('lfo', 'out'), z = await scr('space', 'decay')
  await drag(a, z)
  const mid = await ev(`flush(); return { reveal: CTL.reveal, hand: CTL.hand && CTL.hand.key, words: [...document.getElementById('g-dock').querySelectorAll('text')].map(t => t.textContent).filter(s => s === 'decay' || s === 'amount').length }`)
  ok('held over the space, the wire shows its hands (amount, decay), the nearest lit', mid.reveal != null && mid.hand === 'decay' && mid.words >= 2, mid)
  await mouse('mouseReleased', z.x, z.y); await b.sleep(150)
  const ws = await wires()
  ok('let go: a control wire from the lfo onto the space’s decay, half deep, as it goes', ws.length === 1 && ws[0].from === 'lfo' && ws[0].to === 'space' && ws[0].hand === 'decay' && ws[0].gain === .5 && ws[0].pol === 0, ws)
  const msg = await ev(`const m = wallMsg(S.tracks[1]); const e = m.edges.find(e => e.hand); return e ? { hand: e.hand, gain: e.gain, pol: e.pol } : null`)
  ok('…and the engine is told it with its hand and depth', !!msg && msg.hand === 'decay' && msg.gain === .5 && msg.pol === 0, msg) }

/* chosen: depth and way, in the foot */
{ const foot = await ev(`flush(); return [...document.getElementById('g-dock').querySelectorAll('text')].map(t => t.textContent)`)
  ok('the new wire is chosen: its foot says what it plays, its depth and its way', foot.some(s => /lfo → space decay/.test(s)) && foot.includes('depth') && foot.includes('as it goes'), foot.filter(s => /→|depth|way|goes/.test(s)))
  const d = await ev(`const r = document.querySelector('#g-dock [data-k="cdepth"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
  await drag(d, { x: d.x, y: d.y - 20 }, 4); await mouse('mouseReleased', d.x, d.y - 20); await b.sleep(120)
  const g = (await wires())[0].gain
  ok('its depth dragged up', g > .6 && g <= 1, g)
  const wy = await ev(`flush(); const r = document.querySelector('#g-dock [data-k="cway"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
  await click(wy)
  await ev(`const it = S.menu.items.find(i => i.v === 1); S.menu.pick(it); S.menu = null; uiDirty('menu'); flush()`)
  ok('its way picked: one way', (await wires())[0].pol === 1) }

/* a macro onto the decay the lfo plays: it sets that play's depth */
{ const a = await scr('macro', 'out'), z = await scr('space', 'decay')
  await drag(a, z); await mouse('mouseReleased', z.x, z.y); await b.sleep(150)
  const ws = await wires()
  ok('a macro let go on the decay the lfo plays sets that play’s depth (a wire onto the wire), the whole way', ws.length === 2 && ws[1].from === 'macro' && ws[1].hand === `wire:${await ev(`return wallOf(S.tracks[1]).nodes.find(n => n.k === 'lfo').id`)}:decay` && ws[1].gain === 1, ws) }

/* the space's study: a row for each play */
{ await ev(`studyOpen(S.tracks[1], wallOf(S.tracks[1]).nodes.find(n => n.k === 'space').id); flush()`)
  const rows = await ev(`return STUDY.g.rows.filter(r => r.k === 'ctl' && r.what === 'play').length`)
  const words = await ev(`return [...document.getElementById('g-dock').querySelectorAll('text')].map(t => t.textContent)`)
  ok('the space’s study has a row for each play of its hands, who and which', rows === 2 && words.some(s => /lfo 1\/4 · decay/.test(s)) && words.some(s => /macro 1 · decay depth/.test(s)), words.filter(s => /·/.test(s))) }

/* the lfo's study: its shape drawn by hand */
{ await ev(`studyOpen(S.tracks[1], wallOf(S.tracks[1]).nodes.find(n => n.k === 'lfo').id); flush()`)
  const box = await ev(`const G = STUDY.g, b = ctlLfoBox(G); return { x: b.x, y: b.y, W: b.W, pad: CTL_PAD, n: wallOf(S.tracks[1]).nodes.find(n => n.k === 'lfo').pts.length / 3 }`)
  const at = (x, y) => ({ x: box.x + box.pad + x * box.W, y: box.y + box.pad + (1 - y) * box.W })
  await click(at(.6, .9))
  const n1 = await ev(`return wallOf(S.tracks[1]).nodes.find(n => n.k === 'lfo').pts.length / 3`)
  ok('a press on the empty grid adds a point there', n1 === box.n + 1, [box.n, n1])
  const before = await ev(`return wallOf(S.tracks[1]).nodes.find(n => n.k === 'lfo').pts.slice()`)
  await drag(at(0, .5), at(0, .2)); await mouse('mouseReleased', at(0, .2).x, at(0, .2).y); await b.sleep(120)
  const after = await ev(`return wallOf(S.tracks[1]).nodes.find(n => n.k === 'lfo').pts.slice()`)
  const want = await ev(`return PATCH_CATALOG.lfoMovePoint(${JSON.stringify(before)}, 0, { x: 0, y: .2 }, false)`)
  ok('the first point dragged down: the last comes with it (the loop’s seam), as Patch on Slur moves it', Math.abs(after[1] - .2) < .02 && Math.abs(after[after.length - 2] - after[1]) < 1e-6 && Math.abs(want[want.length - 2] - want[1]) < 1e-6, [after[1], after[after.length - 2]])
  const sent = await ev(`const m = wallMsg(S.tracks[1]); const n = m.nodes.find(n => n.type === 30); return n && n.pts ? n.pts.length : 0`)
  ok('…and the engine is told the points', sent === after.length) }

/* the bands' study: a cut dragged */
{ await ev(`studyOpen(S.tracks[1], wallOf(S.tracks[1]).nodes.find(n => n.k === 'bands').id); flush()`)
  const c = await ev(`const r = document.querySelector('#g-dock [data-k="bcut"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
  const was = await ev(`return wallOf(S.tracks[1]).nodes.find(n => n.k === 'bands').aux[0]`)
  await drag(c, { x: c.x + 40, y: c.y }); await mouse('mouseReleased', c.x + 40, c.y); await b.sleep(120)
  const now = await ev(`return wallOf(S.tracks[1]).nodes.find(n => n.k === 'bands').aux[0]`)
  ok('a cut dragged right goes up in hz', now > was * 1.5, [was, now]) }

/* the scene: takes A at the gain as it is, B with the gain down; then an edit at B goes into B */
{ await ev(`const t = S.tracks[1], w = wallOf(t); studyOpen(t, w.nodes.find(n => n.k === 'scene').id); flush()`)
  const take = v => ev(`const r = document.querySelector('#g-dock [data-k="ctake"][data-v="${v}"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
  await click(await take('a'))
  await ev(`const t = S.tracks[1], w = wallOf(t), g = w.nodes.find(n => n.k === 'gain'); g.amount = .5; wallPush(t); flush()`)
  await click(await take('b'))
  const held = await ev(`flush(); return ctlHeld(wallOf(S.tracks[1]).nodes.find(n => n.k === 'scene'))`)
  ok('a scene takes A and B, and holds the hand they disagree on', held === '1 hand', held)
  await ev(`const t = S.tracks[1], w = wallOf(t), sc = w.nodes.find(n => n.k === 'scene'), g = w.nodes.find(n => n.k === 'gain'); sc.amount = 1; wallPush(t); g.amount = .3; wallPush(t)`)
  const rows = await ev(`const sc = wallOf(S.tracks[1]).nodes.find(n => n.k === 'scene'), g = wallOf(S.tracks[1]).nodes.find(n => n.k === 'gain'), row = a => { for (let i = 0; i < a.length; i += PATCH_CATALOG.SCENE_STRIDE) if (a[i] === g.id) return a[i + 1] }; return { a: row(sc.sceneA), b: row(sc.sceneB) }`)
  ok('with the knob at B, the gain edited goes into B, A kept', Math.abs(rows.a - .75) < 1e-6 && Math.abs(rows.b - .3) < 1e-6, rows)
  const m = await ev(`const n = wallMsg(S.tracks[1]).nodes.find(n => n.type === 49); return n && n.sceneA && n.sceneB ? [n.sceneA.length, n.sceneB.length] : null`)
  ok('…and the engine is told both takes', !!m && m[0] > 0 && m[1] > 0, m) }

/* a preset keeps the control wires, the lfo's points and the scene's takes; Patch on Slur reads them */
{ const r = await ev(`const t = S.tracks[1], j = JSON.parse(presetJson(t)), g = preFromGraph(j), ids = {}; j.nodes.forEach(n => { ids[n.id] = n.type })
    const ctl = j.edges.filter(e => e.hand); return { hands: ctl.map(e => e.hand.replace(/\\d+/, 'N')), lfo: (j.nodes.find(n => n.type === 30) || {}).pts, scene: (j.nodes.find(n => n.type === 49) || {}).sceneA, back: g.wall ? g.wall.wires.filter(e => e.hand).length : g.wires.filter(e => e.hand).length }`)
  ok('a preset keeps the control wires, the lfo’s points and the scene’s takes, and reads them back', r.hands.includes('decay') && r.hands.includes('wire:N:decay') && Array.isArray(r.lfo) && Array.isArray(r.scene) && r.back === 2, r)
  const hand = await ev(`return JSON.parse(wallPreset(S.tracks[1])).edges.filter(e => e.hand).length`)
  ok('…and what Patch on Slur reads (the hand-off) has them', hand === 2, hand) }

{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `ctl: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'ctl: all passed')
process.exit(bad.length ? 1 : 0)
