// node test/side.mjs — the side on a wall (Patch on Slur's sidechain): it is in the wall's list; it has no way in; a press on
// it lists the tracks, and the one picked is what it plays (written with the project); a wire from it lands on a print's
// key point (glue, gate, comp, … have one) and is told to the engine as a key wire; a print with no key takes none; the
// key wire stays a key wire in a preset and in what Patch on Slur reads, and one Patch on Slur wrote comes back as one;
// the last side taken off, the wall plays no track.
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('side: TIMED OUT'); process.exit(2) }, 120000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const texts = () => ev(`flush(); return [...document.getElementById('g-dock').querySelectorAll('text')].map(t => t.textContent.replace(/\u2063/g, ''))`)      // (a name people gave carries an unseen mark: kit.js asGiven)
await ev(`try { localStorage.removeItem('orb_wall_presets') } catch (e) {}; if (typeof START !== 'undefined') START.on = false; setView(true); S.sel = 1; S.panel.on = true; S.panel.tab = 'patch'; setView(true)
  const t = S.tracks[1]; wallAdd(t, 'side'); wallAdd(t, 'comp'); wallAdd(t, 'tape'); const w = wallOf(t), id = k => w.nodes.find(n => n.k === k).id
  w.wires = [{ from: WALL_IN, to: id('comp'), gain: 1, port: 0 }, { from: id('comp'), to: WALL_OUT, gain: 1, port: 0 }]
  Object.assign(wallNode(w, id('side')), { x: 80, y: 120 }); Object.assign(wallNode(w, id('comp')), { x: 260, y: 0 }); Object.assign(wallNode(w, id('tape')), { x: 260, y: 160 }); w.in = { x: 60, y: 0 }; w.out = { x: 460, y: 0 }; w.z = 0; WALL.sel = null; dirtyAll(); flush()`)
await b.sleep(300)
const scr = (k, port) => ev(`flush(); const t = S.tracks[1], w = wallOf(t), v = wallView(w, WALL.g), node = w.nodes.find(n => n.k === '${k}'), q = ${port === 'out' ? 'wallOutPort(w, node.id, 0)' : port === 'key' ? 'wallKeyPort(w, node.id)' : 'node'}; return { x: v.tx + q.x * v.z, y: v.ty + q.y * v.z, id: node.id }`)

ok('the side is in the wall’s list, among the channel’s things, and stands under its name saying it plays nothing', await ev(`return WALL_PRINTS.includes('side') && WALL_TYPE.side === 33`) && (await texts()).includes('side') && (await texts()).includes('nothing'))
ok('…and the comp shows its key point', (await texts()).includes('key'))
ok('nothing may be wired into a side; a key is taken only by a print that has one', await ev(`const t = S.tracks[1], w = wallOf(t), id = k => w.nodes.find(n => n.k === k).id; return !wallMay(w, WALL_IN, id('side'), 0) && !wallMay(w, WALL_IN, id('tape'), 0, 1) && wallMay(w, id('side'), id('comp'), 0, 1)`))

/* pressed: the tracks */
{ const p = await scr('side'); await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); await mouse('mouseReleased', p.x, p.y); await b.sleep(150)
  const menu = await ev(`return S.menu ? S.menu.items.map(i => i.t.replace(/\\u2063/g, '')) : null`)
  ok('a press on it lists nothing and every other track', !!menu && menu[0] === 'nothing' && menu.length === (await ev(`return S.tracks.length`)), menu)
  await ev(`const it = S.menu.items.find(i => i.v === S.tracks[0].id); S.menu.pick(it); S.menu = null; uiDirty('menu'); flush()`); await b.sleep(100)
  const s = await ev(`return { from: S.tracks[1].sideFrom, kick: S.tracks[0].id, name: S.tracks[0].name }`)
  ok('picked: the side plays that track, and says so under it', s.from === s.kick && (await texts()).includes(s.name), s) }

/* a wire from the side into the comp's key */
{ const a = await scr('side', 'out'), k = await scr('comp', 'key')
  await mouse('mouseMoved', a.x, a.y, { buttons: 0 }); await mouse('mousePressed', a.x, a.y)
  for (let i = 1; i <= 8; i++) await mouse('mouseMoved', a.x + (k.x - a.x) * i / 8, a.y + (k.y - a.y) * i / 8)
  await b.sleep(60)
  const mid = await ev(`return { land: WALL.drag && WALL.drag.land, landIn: WALL.drag && WALL.drag.landIn }`)
  await mouse('mouseReleased', k.x, k.y); await b.sleep(150)
  const r = await ev(`const t = S.tracks[1], w = wallOf(t), side = w.nodes.find(n => n.k === 'side'), comp = w.nodes.find(n => n.k === 'comp'); return { wire: w.wires.find(e => e.from === side.id), comp: comp.id, msg: wallMsg(t).edges.find(e => e.from === side.id), sideMsg: wallMsg(t).nodes.find(x => x.id === side.id) }`)
  ok('drawn from the side to the comp’s key point, it lands there', mid.land === r.comp && mid.landIn === 1, mid)
  ok('let go: a wire into the comp’s key, told to the engine as one; the side is told as Patch on Slur’s side', !!r.wire && r.wire.to === r.comp && r.wire.in === 1 && r.msg.in === 1 && r.sideMsg.type === 33, r) }

/* kept: project, preset, what patch on slur reads; and read back from patch on slur's */
{ const kept = await ev(`const o = JSON.parse(serialize()); return { from: o.tracks[1].sideFrom, wire: o.tracks[1].wall.wires.find(e => e.in) }`)
  ok('written with the project: what the side plays, and the key wire', kept.from === (await ev(`return S.tracks[0].id`)) && !!kept.wire, kept)
  const f = await ev(`const g = JSON.parse(presetJson(S.tracks[1])); return { side: g.nodes.find(n => n.type === 33), key: g.edges.find(e => e.in === 1), own: g.slurStudio.wall.wires.some(e => e.in) }`)
  ok('in a preset, and in the part Patch on Slur reads: the side by its own number, the key wire as one', !!f.side && !!f.key && f.key.from === f.side.id && f.own, f)
  const back = await ev(`const d = preFromGraph({ nodes: [{ id: 3, type: 33, x: 100, y: 300 }, { id: 5, type: 35, amount: .5, x: 300, y: 280 }], edges: [{ from: -1, to: 5, gain: 1 }, { from: 5, to: -2, gain: 1 }, { from: 3, to: 5, gain: 1, in: 1 }] }); return { kinds: d.wall.nodes.map(n => n.k), key: d.wall.wires.find(e => e.in), left: d.left }`)
  ok('a file Patch on Slur wrote with a side and a key wire comes back as one', back.kinds.join() === 'side,comp' && !!back.key && back.left === 0, back) }

/* taken off */
{ await ev(`const t = S.tracks[1]; wallRemove(t, wallOf(t).nodes.find(n => n.k === 'side')); flush()`); await b.sleep(100)
  const s = await ev(`const t = S.tracks[1], w = wallOf(t); return { from: t.sideFrom, keyWires: w.wires.filter(e => e.in).length, reach: wallReach(w, WALL_IN, WALL_OUT) }`)
  ok('the side taken off: its key wire goes with it, the way stays, and the wall plays no track', s.from === 0 && s.keyWires === 0 && s.reach, s) }
{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `side: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'side: all passed')
process.exit(bad.length ? 1 : 0)
