// node test/wall.mjs — the patch as a wall (Patch on Slur's way): a patch begins with in and out and nothing between; a print
// picked from the list stands on the wall unwired; wires are drawn by hand from a port to a thing (the real pointer), never
// round in a ring; one output feeds several things; a mix takes several wires and shares a hundred among them; a print's
// amount is pulled on its plate, its other hands on the wall's foot; scrolling makes the wall nearer and further about the
// pointer and its ground is pulled about; a thing set down on a wire joins it; one taken off heals the wire; a patch
// from before walls comes out wired as it sounded; the wall is written with the project; what the engine would be
// told is the graph as drawn. (No app here: what is checked is the page. WALL_PAGE: another copy of the page.)
import { open, PAGE } from './cdp.mjs'
const [W, H] = [+(process.argv[2] || 1440), +(process.argv[3] || 900)]
const b = await open(process.env.WALL_PAGE || PAGE, { width: W, height: H, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (x0, y0, x1, y1, steps = 8) => { await mouse('mouseMoved', x0, y0, { buttons: 0 }); await mouse('mousePressed', x0, y0); for (let k = 1; k <= steps; k++) await mouse('mouseMoved', x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps); await b.sleep(40); await mouse('mouseReleased', x1, y1); await b.sleep(60) }
if (!(await ev(`return typeof wallOf === 'function'`))) { console.log('wall: the page does not list wall.js yet (WALL_PAGE: a copy that does)'); await b.close(); process.exit(0) }

await ev(`if (typeof START !== 'undefined') START.on = false; setView(true)
  S.sel = S.tracks.findIndex(t => t.name === 'kick'); S.panel.on = true; S.panel.tab = 'patch'; S.panel.h = ${H < 900 ? 300 : 420}; setView(true); dirtyAll(); flush()`)
/* where a thing of the wall is on the screen */
const at = (id, what = 'c') => ev(`flush(); const t = S.tracks[S.sel], w = wallOf(t), g = WALL.g, k = board.getBoundingClientRect().width / W, q = ${JSON.stringify(what)} === 'out' ? wallOutPort(w, ${id}, 0) : ${JSON.stringify(what)} === 'cap' ? { x: wallPos(w, ${id}).x, y: wallPos(w, ${id}).y + 52 } : wallPos(w, ${id}); return { x: (g.cx + (q.x - w.ox) * w.z) * k, y: (g.cy + (q.y - w.oy) * w.z) * k }`)
const wall = () => ev(`flush(); const t = S.tracks[S.sel], w = wallOf(t); return { nodes: w.nodes.map(n => [n.id, n.k, +(wallAmount(t, n)).toFixed(3), n.x, n.y]), wires: w.wires.map(e => [e.from, e.to, +(+e.gain).toFixed(3)]), z: +w.z.toFixed(3), o: [Math.round(w.ox), Math.round(w.oy)], sel: WALL.sel, drawn: document.querySelectorAll('#g-dock [data-k="node"]').length, focus: S.focus }`)

{ const s = await wall()
  ok('a patch begins with nothing on it and nothing wired', s.nodes.length === 0 && s.wires.length === 0 && s.drawn === 0, s)
  const m = await ev(`return wallMsg(S.tracks[S.sel])`)
  ok('…and what the engine would be told is an empty graph (the sound goes by)', m.nodes.length === 0 && m.edges.length === 0, m) }

/* a print from the list */
{ const p = await ev(`flush(); const el = document.querySelector('#g-dock [data-a="plugs"]'), r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`)
  await b.click(p.x, p.y); await b.sleep(250)
  const l = await ev(`return { open: S.picker.open, in: document.getElementById('picker').classList.contains('in'), cats: [...document.querySelectorAll('.pk-cat')].map(c => c.dataset.cat + ' ' + c.querySelector('span').textContent), rows: [...document.querySelectorAll('.pk-row b')].map(x => x.textContent) }`)
  ok('the list opens in the panel, with every print of patch on slur in it', l.open && l.in && l.rows.length === (await ev(`return WALL_PRINTS.length`)) && ['comp', 'shimmer', 'vocode', 'tape', 'mix', 'l/r'].every(k => l.rows.includes(k)), [l.rows.length, l.cats])
  ok('…filed among the kinds, and under a kind of their own', l.cats[1].startsWith('slur ') && l.cats.some(c => c.startsWith('dynamics ')) && l.cats.some(c => c.startsWith('reverb ')), l.cats)
  await b.type('comp'); await b.sleep(120)
  const r = await ev(`const el = [...document.querySelectorAll('.pk-row')].find(x => x.querySelector('b').textContent === 'comp'), q = el.getBoundingClientRect(); return { x: q.left + 30, y: q.top + q.height / 2 }`)
  await b.click(r.x, r.y); await b.sleep(150)
  const s = await wall()
  ok('a print picked stands on the wall, chosen, with no wire', s.nodes.length === 1 && s.nodes[0][1] === 'comp' && s.wires.length === 0 && s.drawn === 1 && s.sel && s.sel.node === s.nodes[0][0], s)
  await b.press('Escape', 'Escape', 27); await b.sleep(100) }

/* wired by hand: in to the print, the print to out */
{ const id = (await wall()).nodes[0][0]
  const a = await at(-1), n1 = await at(id), o = await at(id, 'out'), end = await at(-2)
  await pull(a.x + 6, a.y, n1.x, n1.y)
  const mid = await wall()
  ok('a wire pulled from in to the print', mid.wires.length === 1 && mid.wires[0][0] === -1 && mid.wires[0][1] === id, mid.wires)
  await pull(o.x, o.y, end.x, end.y)
  const s = await wall()
  ok('…and from the print’s port to out: the sound now goes through it', s.wires.length === 2 && s.wires[1][0] === id && s.wires[1][1] === -2, s.wires)
  const m = await ev(`return wallMsg(S.tracks[S.sel])`)
  ok('the engine would be told a comp between in and out', m.nodes.length === 1 && m.nodes[0].type === 35 && m.edges.length === 2 && m.edges[0].from === -1 && m.edges[1].to === -2, m)
  await pull(o.x, o.y, a.x, a.y)
  ok('a wire cannot be pulled back into in', (await wall()).wires.length === 2) }

/* the amount, on the plate */
{ const id = (await wall()).nodes[0][0], c = await at(id), v0 = (await wall()).nodes[0][2]
  await mouse('mouseMoved', c.x, c.y, { buttons: 0 }); await mouse('mousePressed', c.x, c.y)
  for (let k = 1; k <= 8; k++) await mouse('mouseMoved', c.x, c.y - k * 10)
  await b.sleep(60)
  const mid = await ev(`flush(); const w = wallOf(S.tracks[S.sel]); return { a: w.nodes[0].amount, x: w.nodes[0].x, text: [...document.querySelectorAll('#g-dock text')].map(t => t.textContent).join('|') }`)
  await mouse('mouseReleased', c.x, c.y - 80); await b.sleep(60)
  const s = await wall()
  ok('pulled up on its plate, a print’s amount rises under the hand (and it does not move)', mid.a > v0 + .3 && s.nodes[0][2] === +mid.a.toFixed(3) && s.nodes[0][3] === mid.x, [v0, mid.a])
  ok('…and the wall’s foot names its hands', /threshold/.test(mid.text) && /ratio/.test(mid.text) && /attack/.test(mid.text), mid.text.slice(-200)) }

/* two more, side by side into a mix */
{ await ev(`const t = S.tracks[S.sel]; wallAdd(t, 'space'); wallAdd(t, 'delay'); wallAdd(t, 'mix'); const w = wallOf(t); const P = { comp: [200, 0], space: [380, -90], delay: [380, 90], mix: [560, 0] }; for (const n of w.nodes) { n.x = P[n.k][0]; n.y = P[n.k][1] } w.in = { x: 40, y: 0 }; w.out = { x: 720, y: 0 }; w.z = 0; WALL.sel = null; dirtyAll(); flush()`)
  const s0 = await wall(), id = k => s0.nodes.find(n => n[1] === k)[0]
  ok('space and delay come on at the amount they always came on at', s0.nodes.find(n => n[1] === 'space')[2] === .3 && s0.nodes.find(n => n[1] === 'delay')[2] === .2, s0.nodes)
  /* the wire from comp to out is taken away: pressed, then the delete key */
  const w0 = await ev(`flush(); const el = document.querySelector('#g-dock [data-k="wire"][data-i="1"]'), L = el.getTotalLength(), q = el.getPointAtLength(L / 2), m = el.getScreenCTM(); return { x: q.x * m.a + m.e, y: q.y * m.d + m.f }`)
  await b.click(w0.x, w0.y); await b.sleep(80)
  ok('a wire pressed is chosen', (await wall()).sel && (await wall()).sel.wire === 1, (await wall()).sel)
  await b.press('Backspace', 'Backspace', 8); await b.sleep(80)
  ok('…and the delete key takes it away', (await wall()).wires.length === 1, (await wall()).wires)
  const cOut = await at(id('comp'), 'out')
  for (const k of ['space', 'delay']) { const to = await at(id(k)); await pull(cOut.x, cOut.y, to.x, to.y) }
  for (const k of ['space', 'delay']) { const from = await at(id(k), 'out'), to = await at(id('mix')); await pull(from.x, from.y, to.x, to.y) }
  { const from = await at(id('mix'), 'out'), to = await at(-2); await pull(from.x, from.y, to.x, to.y) }
  const s = await wall(), has = (a, c) => s.wires.some(e => e[0] === a && e[1] === c)
  ok('one output feeds two things, and both go into the mix, and the mix to out', has(id('comp'), id('space')) && has(id('comp'), id('delay')) && has(id('space'), id('mix')) && has(id('delay'), id('mix')) && has(id('mix'), -2) && s.wires.length === 6, s.wires)
  const sh = s.wires.filter(e => e[1] === id('mix')).map(e => e[2])
  ok('the mix shares a hundred between its two wires', sh.length === 2 && sh[0] === .5 && sh[1] === .5, sh)
  /* a ring is refused */
  { const from = await at(id('mix'), 'out'), to = await at(id('comp')); await pull(from.x, from.y, to.x, to.y) }
  ok('a wire that would make a ring is not drawn', (await wall()).wires.length === 6)
  /* a level pulled */
  const lv = await ev(`flush(); const el = document.querySelector('#g-dock [data-k="lvl"]'), r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, i: +el.dataset.i }`)
  await pull(lv.x, lv.y, lv.x, lv.y - 40)
  const s2 = await wall(), sh2 = s2.wires.filter(e => e[1] === id('mix')).map(e => e[2])
  ok('a level pulled up: the other gives way, a hundred in all', sh2[0] > .65 && Math.abs(sh2[0] + sh2[1] - 1) < .002, sh2)
  const m = await ev(`return wallMsg(S.tracks[S.sel])`)
  ok('the engine would be told the same graph: four prints, six wires, the mix’s shares', m.nodes.length === 4 && m.edges.length === 6 && m.nodes.find(n => n.type === 2).line === 2 && m.nodes.find(n => n.type === 10).line === 3 && Math.abs(m.edges.filter(e => e.to === id('mix')).reduce((a, e) => a + e.gain, 0) - 1) < .002, m.edges)
  await b.shot(`wall-${W}.png`) }

/* nearer and further, about the pointer; the ground pulled about */
{ const g = await ev(`const k = board.getBoundingClientRect().width / W; return { x: (WALL.g.cx + 120) * k, y: (WALL.g.cy - 40) * k }`)
  const s0 = await wall(), under0 = await ev(`const w = wallOf(S.tracks[S.sel]); return wallToWorld(w, WALL.g, pt({ clientX: ${g.x}, clientY: ${g.y} }))`)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: g.x, y: g.y, deltaX: 0, deltaY: -160 }); await b.sleep(80)
  const s1 = await wall(), under1 = await ev(`const w = wallOf(S.tracks[S.sel]); return wallToWorld(w, WALL.g, pt({ clientX: ${g.x}, clientY: ${g.y} }))`)
  ok('scrolled up over the wall, it comes nearer', s1.z > s0.z * 1.4, [s0.z, s1.z])
  ok('…about where the pointer is', Math.abs(under1.x - under0.x) < 1 && Math.abs(under1.y - under0.y) < 1, [under0, under1])
  await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: g.x, y: g.y, deltaX: 0, deltaY: 400 }); await b.sleep(80)
  ok('scrolled down, further away', (await wall()).z < s0.z, (await wall()).z)
  const e0 = await ev(`const k = board.getBoundingClientRect().width / W; return { x: 30 * k, y: (WALL.g.y + 30) * k }`), o0 = (await wall()).o
  await pull(e0.x, e0.y, e0.x + 60, e0.y + 20)
  const o1 = (await wall()).o
  ok('the empty ground pulled: the wall goes with the hand', o1[0] < o0[0] - 20 && o1[1] < o0[1], [o0, o1])
  const lanes = await ev(`return [PXB, VX]`)
  const far = await ev(`const k = board.getBoundingClientRect().width / W; return { x: 600 * k, y: (TY + 60) * k }`)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: far.x, y: far.y, deltaX: 0, deltaY: -160 }); await b.sleep(60)
  ok('scrolling over the lanes still scrolls the lanes, not the wall', JSON.stringify((await wall()).o) === JSON.stringify(o1)) }

/* a thing with no wires set down on a wire joins it; taken off, the wire heals */
{ await ev(`const t = S.tracks[S.sel]; wallAdd(t, 'air'); const w = wallOf(t), n = w.nodes.find(x => x.k === 'air'); n.x = 640; n.y = 150; w.z = 0; WALL.sel = null; dirtyAll(); flush()`)
  const s0 = await wall(), air = s0.nodes.find(n => n[1] === 'air')[0], mix = s0.nodes.find(n => n[1] === 'mix')[0]
  const cap = await at(air, 'cap'), wmid = await ev(`flush(); const w = wallOf(S.tracks[S.sel]), i = w.wires.findIndex(e => e.to === -2), el = document.querySelector('#g-dock [data-k="wire"][data-i="' + i + '"]'), L = el.getTotalLength(), q = el.getPointAtLength(L / 2), m = el.getScreenCTM(); return { x: q.x * m.a + m.e, y: q.y * m.d + m.f }`)
  await pull(cap.x, cap.y, wmid.x, wmid.y + (cap.y - (await at(air)).y))
  const s1 = await wall(), has = (a, c) => s1.wires.some(e => e[0] === a && e[1] === c)
  ok('a print with no wires, set down on a wire, joins it', has(mix, air) && has(air, -2) && !has(mix, -2), s1.wires)
  await ev(`const t = S.tracks[S.sel], w = wallOf(t); wallRemove(t, w.nodes.find(x => x.k === 'air')); flush()`)
  const s2 = await wall()
  ok('taken off again, the wire heals: the mix goes to out', s2.wires.some(e => e[0] === mix && e[1] === -2) && !s2.nodes.some(n => n[1] === 'air'), s2.wires) }

/* written with the project */
{ const r = await ev(`const o = JSON.parse(serialize()), t = o.tracks.find(x => x.name === 'kick'); return { wall: t.wall && { n: t.wall.nodes.map(n => n.k), w: t.wall.wires.length, z: t.wall.z }, changed: typeof leaveChanged === 'function' ? leaveChanged() : null }`)
  ok('the wall is written with the project', r.wall && r.wall.n.length === 4 && r.wall.w === 6, r.wall) }

/* a patch from before walls: wired as it sounded */
{ const r = await ev(`const t = S.tracks.find(x => x.name === 'snare'); delete t.wall; setPrint(t, 'tape', 24); setPrint(t, 'space', 30); setPrint(t, 'delay', 20); t.patch.A.share = t.patch.B.share = 70; t.inserts = [{ uid: 7, id: 'x', name: 'Pro-Q 4', fmt: 'au' }]
    const w = wallOf(t), id = k => (w.nodes.find(n => n.k === k) || {}).id, has = (a, c) => w.wires.some(e => e.from === a && e.to === c)
    return { ks: w.nodes.map(n => n.k), ok: has(-1, id('tape')) && has(id('tape'), id('space')) && has(id('tape'), id('delay')) && has(id('space'), id('mix')) && has(id('delay'), id('mix')) && has(id('mix'), id('plug')) && has(id('plug'), -2) && w.wires.length === 7, share: w.wires.filter(e => e.to === id('mix')).map(e => +e.gain.toFixed(2)), msg: wallMsg(t).nodes.map(n => [n.type, n.uid || 0, n.line || 0]) }`)
  ok('a patch from before walls is wired as it was played: tape, then space and delay into a mix, then the plug-in', r.ok && r.share[0] === .7 && r.share[1] === .3, r)
  ok('…the plug-in is told to the engine by the name it was opened under', r.msg.some(m => m[0] === 51 && m[1] === 7) && r.msg.some(m => m[0] === 1 && m[2] === 1), r.msg)
  const c = await ev(`const t = S.tracks.find(x => x.name === 'hats'); delete t.wall; wallOf(t); setPrint(t, 'space', 40); const w = wallOf(t), id = (w.nodes.find(n => n.k === 'space') || {}).id; return { n: w.nodes.length, wires: w.wires.map(e => [e.from, e.to]), id }`)
  ok('a print turned up from elsewhere (the command line) on an empty wall is wired in to out by itself', c.n === 1 && c.wires.length === 2 && c.wires[0][0] === -1 && c.wires[0][1] === c.id && c.wires[1][1] === -2, c) }

/* a plug-in put on the track from somewhere other than the wall's list joins the end of the way; from the list, it stands unwired */
{ const r = await ev(`const t = S.tracks.find(x => x.name === 'guitar'); delete t.wall; t.inserts = []; wallOf(t); t.inserts.push({ uid: 41, id: 'a', name: 'one', fmt: 'au' }); const w1 = wallOf(t), a = w1.wires.map(e => [e.from, e.to])
    t.inserts.push({ uid: 42, id: 'b', name: 'two', fmt: 'au' }); const w2 = wallOf(t), b2 = w2.wires.map(e => [e.from, e.to]), ids = w2.nodes.map(n => n.id)
    WALL.loose = t.id; t.inserts.push({ uid: 43, id: 'c', name: 'three', fmt: 'au' }); const w3 = wallOf(t); WALL.loose = null
    return { a, b2, ids, three: w3.nodes.length, wires3: w3.wires.length }`)
  ok('put on a track from elsewhere, a plug-in joins the end of the way: in, it, out', JSON.stringify(r.a) === JSON.stringify([[-1, r.ids[0]], [r.ids[0], -2]]), r.a)
  ok('…and the next one after it', JSON.stringify(r.b2) === JSON.stringify([[-1, r.ids[0]], [r.ids[0], r.ids[1]], [r.ids[1], -2]]), r.b2)
  ok('picked from the wall’s own list, it stands unwired', r.three === 3 && r.wires3 === 3, [r.three, r.wires3]) }

/* read again from a project: the plug-in finds its place as it is opened */
{ const r = await ev(`const src = S.tracks.find(x => x.name === 'snare'), saved = JSON.parse(JSON.stringify(wallSaved(src))), savedAs = saved.nodes.map(n => [n.k, n.p == null ? null : n.p, 'ins' in n]), t = S.tracks.find(x => x.name === 'bass'); t.wall = saved; t.inserts = []; setPrint(t, 'tape', 24); setPrint(t, 'space', 30); setPrint(t, 'delay', 20)
    const w0 = wallOf(t), pl0 = w0.nodes.find(n => n.k === 'plug'), m0 = wallMsg(t).nodes.find(n => n.id === pl0.id), before = [w0.nodes.length, !!pl0.ins, m0.type, !!m0.bypass]
    t.inserts.push({ uid: 31, id: 'x', name: 'Pro-Q 4', fmt: 'au' })
    const w1 = wallOf(t), pl = w1.nodes.find(n => n.k === 'plug')
    return { saved: savedAs, before, after: [w1.nodes.length, pl.ins && pl.ins.uid, w1.wires.length, wallMsg(t).nodes.find(n => n.id === pl.id).uid] }`)
  ok('a plug-in is written by its place among the track’s plug-ins, not as itself', r.saved.some(n => n[0] === 'plug' && n[1] === 0 && !n[2]), r.saved)
  ok('read again, its place waits (the sound goes by it) until it is opened, and is then its own', r.before[0] === 5 && !r.before[1] && r.before[2] === 5 && r.before[3] && r.after[0] === 5 && r.after[1] === 31 && r.after[2] === 7 && r.after[3] === 31, r) }

/* the stereo out has a wall of its own */
{ await ev(`S.panel.tab = 'mixer'; setView(true); dirtyAll(); flush()`)
  const nm = await ev(`flush(); const el = document.querySelector('#g-dock [data-a="wall-out"]'), r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`)
  await b.click(nm.x, nm.y); await b.sleep(250)
  const s0 = await ev(`flush(); return { out: WALL.out, tab: S.panel.tab, is: wallTrack() === OUT, head: [...document.querySelectorAll('#g-dock text')].map(t => t.textContent).join('|').includes('stereo out|before its fader'), nodes: document.querySelectorAll('#g-dock [data-k="node"]').length, told: !!wallOutTrack() }`)
  ok('the stereo out’s strip pressed by its name: the patch is the stereo out’s, and says so', s0.out && s0.tab === 'patch' && s0.is && s0.head && s0.nodes === 0, s0)
  ok('with nothing on it the engine is told of no such bus', !s0.told)
  await ev(`wallAdd(OUT, 'glue'); const w = wallOf(OUT), id = w.nodes[0].id; wallWire(OUT, -1, id, 0); wallWire(OUT, id, -2, 0); OUT.used = !!OUT.wall.nodes.length; flush()`)
  const s1 = await ev(`flush(); const o = JSON.parse(serialize()); return { nodes: document.querySelectorAll('#g-dock [data-k="node"]').length, msg: wallMsg(OUT), told: !!wallOutTrack(), saved: o.out && { n: o.out.wall.nodes.map(x => x.k), w: o.out.wall.wires.length }, kick: (o.tracks.find(t => t.name === 'kick').wall || { nodes: [] }).nodes.map(x => x.k) }`)
  ok('a print set on it and wired: it is on the stereo out’s wall, not on a track’s', s1.nodes === 1 && s1.msg.track === 999999001 && s1.msg.nodes[0].type === 4 && s1.msg.edges.length === 2 && !s1.kick.includes('glue'), s1)
  ok('…the engine would be told of the stereo out as a bus, and it is written with the project', s1.told && s1.saved && s1.saved.n[0] === 'glue' && s1.saved.w === 2, s1.saved)
  const row = await ev(`S.panel.tab = 'patch'; flush(); const el = document.querySelector('#hd-2 [data-a="sel"]'), r = el.getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2 }`)
  await b.click(row.x, row.y); await b.sleep(150)
  const s2 = await ev(`flush(); return { out: WALL.out, t: wallTrack().name, head: [...document.querySelectorAll('#g-dock text')].map(t => t.textContent).join('|').includes('before its fader') }`)
  ok('a track’s row pressed: the patch is that track’s again', !s2.out && s2.t === 'hats' && !s2.head, s2)
  const r3 = await ev(`const saved = JSON.parse(JSON.stringify(wallOutSaved())); return wallOutLoad(null).then(() => { const empty = !OUT.wall && !wallOutTrack(); return wallOutLoad(saved).then(() => ({ empty, back: wallOf(OUT).nodes.map(n => n.k), wires: wallOf(OUT).wires.length })) })`)
  ok('a new song has nothing on it; a project read again has what was written', r3.empty && r3.back[0] === 'glue' && r3.wires === 2, r3)
  await ev(`wallOutLoad(null)`) }

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `wall: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'wall: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
