// node test/round1022.mjs [w h] — his asks of 2026-10-22: a marker pressed is only chosen, gone to by its number it is
// cycled too; / asks for a bar to go to (⌥/ is the line at the foot); a thing on the patch, right-clicked: disconnect, bypass,
// delete; a group said in the mixer's strips (and the inspector's), named there by a double press, and right-clicked:
// what it shares, each on or off (pan among them now).
import { open, PAGE } from './cdp.mjs'
const [W, H] = [+(process.argv[2] || 1440), +(process.argv[3] || 900)]
const b = await open(PAGE, { width: W, height: H, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, ALT = 1, CMD = 4
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const click = async (x, y) => { await b.sleep(420); await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await b.sleep(100) }
const twice = async (x, y) => { await b.sleep(420); await mouse('mouseMoved', x, y, { buttons: 0 }); for (const c of [1, 2]) { await mouse('mousePressed', x, y, { clickCount: c }); await mouse('mouseReleased', x, y, { clickCount: c }); await b.sleep(40) } await b.sleep(120) }
const right = async (x, y) => { await b.sleep(420); await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y, { button: 'right', buttons: 2 }); await mouse('mouseReleased', x, y, { button: 'right', buttons: 0 }); await b.sleep(120) }
const key = async (k, code, vk, mods = 0) => { await b.press(k, code, vk, mods); await b.sleep(120) }
const rect = (sel, dx = .5) => ev(`flush(); const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width * ${dx}, y: r.top + r.height / 2 }`)
const menu = () => ev(`flush(); return S.menu ? S.menu.items.map(i => (i.on ? '*' : '') + i.t + (i.dim ? '(dim)' : '')) : null`)
const pick = async t => { const p = await ev(`flush(); const i = S.menu.items.findIndex(x => x.t === ${JSON.stringify(t)}), e = document.querySelector('[data-a="pick"][data-i="' + i + '"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }`); if (p) { await b.sleep(150); await b.click(p.x, p.y); await b.sleep(150) } return !!p }
await ev(`if (typeof START !== 'undefined') START.on = false; S.sel = 1; S.cycle = { on: false, a: 0, b: 4 }; setView(true); dirtyAll(); flush()`)

/* ── markers ── */
{ const m = await rect('#g-scenes [data-a="scene"][data-i="1"]')
  await click(m.x, m.y)
  const s = await ev(`return { cycle: Object.assign({}, S.cycle), sel: S.selM, focus: S.focus }`)
  ok('a marker pressed is only chosen: the cycle is as it was', !s.cycle.on && s.cycle.a === 0 && s.cycle.b === 4, s)
  await key('3', 'Numpad3', 99)
  const g = await ev(`const sc = SCENES[2]; return { cycle: Object.assign({}, S.cycle), a: sc.a - 1, b: Math.min(SONG_END, sc.b - 1), pos: +curPos().toFixed(4) }`)
  ok('gone to by its number (marker 3): the playhead at its start, and the marker cycled', g.cycle.on && g.cycle.a === g.a && g.cycle.b === g.b && Math.abs(g.pos - g.a) < 1e-6, g) }

/* ── / : a bar to go to; ⌥/ : the prompt ── */
{ await ev(`S.cycle.on = false; jumpTo(0); flush()`)
  await key('/', 'Slash', 191)
  const box = await ev(`const e = document.getElementById('rename'); return { shown: !e.hidden && document.activeElement === e, value: e.value }`)
  ok('/ asks for a place to go to, where the bar is said', box.shown, box)
  await b.type('17'); await key('Enter', 'Enter', 13)
  ok('…typed 17: the playhead is on bar 17', Math.abs((await ev(`return curPos()`)) - 16) < 1e-6, await ev(`return curPos()`))
  await key('/', 'Slash', 191, ALT)
  ok('⌥/ puts the hand on the line at the foot (the prompt page is gone, 2026-10-22; it was the prompt)', await ev(`flush(); return document.activeElement === $('cmd')`), await ev(`return document.activeElement && document.activeElement.id`))
  await ev(`$('cmd').blur()`)
  ok('the menu bar says so: Go to Bar… /, Say It ⌥/', await ev(`const all = MENU_BAR().flatMap(m => m[1]).filter(Array.isArray); return all.some(l => l[0] === 'Go to Bar…' && l[1] === 'Slash') && all.filter(l => l[0] === 'Say It').every(l => l[1] === '⌥Slash')`))
  await ev(`S.panel.on = false; setView(true); dirtyAll(); flush()`) }

/* ── a thing on the patch, right-clicked ── */
{ await ev(`S.sel = 0; S.panel.on = true; S.panel.tab = 'patch'; S.panel.h = 380; setView(true); const t = S.tracks[0]; delete t.wall; wallOf(t); wallAdd(t, 'comp'); wallAdd(t, 'tone'); WALL.sel = null; dirtyAll(); flush()`)
  const id = await ev(`return wallOf(S.tracks[0]).nodes.find(q => q.k === 'comp').id`)
  const c = await rect(`#g-dock [data-a="wall"][data-k="node"][data-id="${id}"]`)
  await right(c.x, c.y)
  ok('a print right-clicked: disconnect, bypass, delete', JSON.stringify(await menu()) === '["disconnect","bypass","delete"]', await menu())
  await pick('bypass')
  ok('…bypass: it is bypassed', await ev(`return wallNode(wallOf(S.tracks[0]), ${id}).bypass === true`))
  await right(c.x, c.y)
  ok('…and the menu says so', (await menu())[1] === '*bypass', await menu())
  await pick('disconnect')
  const w = await ev(`const w = wallOf(S.tracks[0]), tone = w.nodes.find(q => q.k === 'tone').id; return { wires: w.wires.map(e => [e.from, e.to]), tone, still: !!wallNode(w, ${id}) }`)
  ok('…disconnect: off its wires, the way healed (in, tone, out), it stays', w.still && w.wires.length === 2 && w.wires.some(e => e[0] === -1 && e[1] === w.tone) && w.wires.some(e => e[0] === w.tone && e[1] === -2), w)
  await right(c.x, c.y)
  ok('…a thing with no wires: disconnect is dim', (await menu())[0] === 'disconnect(dim)', await menu())
  await pick('delete')
  ok('…delete: it is gone', !(await ev(`return !!wallNode(wallOf(S.tracks[0]), ${id})`)))
  await ev(`S.panel.on = false; setView(true); dirtyAll(); flush()`) }

/* ── a group in the mixer ── */
{ await ev(`S.sel = 0; S.selT = []; chooseTrack(0); chooseTrack(1, 'toggle'); grpMake(); grpClose(); for (const t of S.tracks) t.pan = 0; S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 380; setView(true); dirtyAll(); flush()`)
  const g = await ev(`return { a: S.tracks[0].grp, b: S.tracks[1].grp, name: S.tracks[0].grp ? grpMeta(S.tracks[0].grp).name : null }`)
  ok('two tracks grouped', g.a && g.a === g.b, g)
  const said = await ev(`flush(); const rows = [...document.querySelectorAll('#g-dock [data-a="mgrp"]')]; return { rows: rows.map(e => +e.dataset.i), name: [...document.querySelectorAll('#g-dock text')].filter(t => t.textContent === ${JSON.stringify(g.name)}).length }`)
  ok('the mixer says the group under the names of the two grouped tracks, and nothing on the others', JSON.stringify(said.rows) === '[0,1]' && said.name === 2, said)
  const r = await rect('#g-dock [data-a="mgrp"][data-i="0"]')
  await right(r.x, r.y)
  const m = await menu()
  ok('right-clicked: group on, then what it shares — editing, automation, volume, pan… — each ticked, then rename', m && m[0] === '*group on' && ['*editing', '*automation', '*volume', '*pan', '*mute', '*solo', '*record'].every(x => m.includes(x)) && m.includes('rename') && m.includes('delete the group'), m)
  await pick('automation')
  const m2 = await menu()
  ok('…automation picked: it is off, and the menu is still up to set the next', m2 && m2.includes('automation') && !m2.includes('*automation') && !(await ev(`return grpMeta(S.tracks[0].grp).share.automation`)), m2)
  await key('Escape', 'Escape', 27)
  ok('esc puts the menu away', !(await ev(`flush(); return !!S.menu || !!document.querySelector('[data-a="menu-close"]')`)))
  /* pan, shared */
  const pn = await rect('#g-dock [data-a="mpan"][data-i="0"]', .5)
  await b.sleep(420); await mouse('mouseMoved', pn.x, pn.y, { buttons: 0 }); await mouse('mousePressed', pn.x, pn.y); for (let k = 1; k <= 8; k++) await mouse('mouseMoved', pn.x, pn.y - k * 4); await mouse('mouseReleased', pn.x, pn.y - 32)      // (a knob: up is to the right); await b.sleep(120)
  const pans = await ev(`return [Math.round(S.tracks[0].pan * 64), Math.round(S.tracks[1].pan * 64)]`)
  ok('a pan pulled on one: the other in its group goes as far', pans[0] === 16 && pans[1] === 16, pans)
  /* named by a double press, where it stands */
  await twice(r.x, r.y)
  const box = await ev(`const e = document.getElementById('rename'); return { shown: !e.hidden, value: e.value }`)
  ok('pressed twice on its row: its name, to be typed there', box.shown && box.value === g.name, box)
  await key('a', 'KeyA', 65, CMD); await b.type('drums'); await key('Enter', 'Enter', 13)
  ok('…typed: the group is called drums, in the strip too', (await ev(`return grpMeta(S.tracks[0].grp).name`)) === 'drums' && await ev(`flush(); return [...document.querySelectorAll('#g-dock text')].filter(t => t.textContent === 'drums').length === 2`)) }

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `round1022: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'round1022: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
