// node test/meternode.mjs — the meter on a wall: it is in the wall's list among the channel's things; added, it stands
// on the wall as a plate of its own with no amount under it; the engine is told of it as a place the sound is handed out
// at, with a meter there; a press on it asks for its face (and does not turn anything); it is kept with the project and
// with a preset, and left out of what Patch on Slur reads — the way going on through where it stood; taken off like
// anything else. And its face (meter.html) draws by itself in a browser, wide and narrow, and its cells do what they say.
import { open, PAGE } from './cdp.mjs'
import { join, dirname } from 'node:path'
setTimeout(() => { console.log('meternode: TIMED OUT'); process.exit(2) }, 120000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
await ev(`try { localStorage.removeItem('orb_wall_presets') } catch (e) {}; if (typeof START !== 'undefined') START.on = false; setView(true); S.sel = 0; S.panel.on = true; S.panel.tab = 'patch'; setView(true); dirtyAll(); flush()`)
await b.sleep(400)

ok('the meter is in the wall’s list, among the channel’s things', await ev(`return WALL_PRINTS.includes('meter') && WALL_KIND.meter === 'channel' && WALL_FAMILY.meter === 'utility'`))
await ev(`const t = wallTrack(); wallAdd(t, 'tape'); wallAdd(t, 'meter'); const w = wallOf(t), id = k => w.nodes.find(n => n.k === k).id; w.wires = [{ from: WALL_IN, to: id('tape'), gain: 1, port: 0 }, { from: id('tape'), to: id('meter'), gain: 1, port: 0 }, { from: id('meter'), to: WALL_OUT, gain: 1, port: 0 }]; WALL.sel = null; dirtyAll(); flush()`)
{ const s = await ev(`flush(); const t = wallTrack(), w = wallOf(t), m = w.nodes.find(n => n.k === 'meter'), dock = document.getElementById('g-dock'), texts = [...dock.querySelectorAll('text')].map(x => x.textContent), hitEl = dock.querySelector('[data-a="wall"][data-k="node"][data-id="' + m.id + '"]'); const r = hitEl.getBoundingClientRect(); return { id: m.id, name: texts.includes('meter'), bars: dock.innerHTML.includes('rx="2"'), cur: hitEl.style.cursor, x: r.x + r.width / 2, y: r.y + r.height / 2, msg: wallMsg(t).nodes.find(x => x.id === m.id), others: wallMsg(t).nodes.filter(x => x.id !== m.id).map(x => x.type), value: wallValue(t, m) }`)
  ok('added, it stands on the wall under its name, with no amount under it', s.name && s.value === '' && s.cur === 'pointer', s)
  ok('the engine is told of a place the sound is handed out at, with a meter there; the print beside it as before', s.msg && s.msg.meter === 1 && s.others.join() === '1', [s.msg, s.others])
  const before = await ev(`const t = wallTrack(); return wallAmount(t, wallOf(t).nodes.find(n => n.k === 'meter'))`)
  await mouse('mouseMoved', s.x, s.y, { buttons: 0 }); await mouse('mousePressed', s.x, s.y); await mouse('mouseReleased', s.x, s.y); await b.sleep(120)
  const after = await ev(`const t = wallTrack(), m = wallOf(t).nodes.find(n => n.k === 'meter'); return { asked: METER_AT.asked, tid: t.id, id: m.id, amt: wallAmount(t, m), sel: WALL.sel && WALL.sel.node }`)
  ok('a press on it asks for its face, chooses it, and turns nothing', !!after.asked && after.asked.track === after.tid && after.asked.id === after.id && after.amt === before && after.sel === after.id, after) }

/* kept with the project; kept with a preset, and left out of what patch on slur reads */
{ const p = await ev(`const t = wallTrack(), o = JSON.parse(serialize()); return o.tracks[S.sel].wall.nodes.map(n => n.k)`)
  ok('it is written with the project', p.includes('meter') && p.includes('tape'), p)
  const f = await ev(`const g = JSON.parse(presetJson(wallTrack())); return { types: g.nodes.map(n => n.type), edges: g.edges.map(e => [e.from, e.to]), own: g.slurStudio.wall.nodes.map(n => n.k) }`)
  ok('a preset keeps it in the part this app reads, and leaves it out of what patch on slur reads — the way goes on through', f.own.includes('meter') && f.types.join() === '1' && f.edges.length === 2 && f.edges.some(e => e[0] === -1) && f.edges.some(e => e[1] === -2), f)
  const h = await ev(`const g = JSON.parse(wallPreset(wallTrack())); return { types: g.nodes.map(n => n.type), edges: g.edges.map(e => [e.from, e.to]), still: wallOf(wallTrack()).nodes.map(n => n.k) }`)
  ok('a hand-off’s patch file leaves it out the same way, and the wall is as it was after', h.types.join() === '1' && h.edges.length === 2 && h.still.includes('meter'), h) }

/* taken off */
{ await ev(`const t = wallTrack(); wallRemove(t, wallOf(t).nodes.find(n => n.k === 'meter')); flush()`)
  const s = await ev(`const t = wallTrack(), w = wallOf(t); return { kinds: w.nodes.map(n => n.k), reach: wallReach(w, WALL_IN, WALL_OUT) }`)
  ok('taken off: the way from in to out goes on without it', !s.kinds.includes('meter') && s.reach === true, s) }
{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the room’s page', !errs.length && !b.errors.length, [errs, b.errors]) }
await b.close().catch(() => {})

/* its face, by itself in a browser */
const FACE = join(dirname(PAGE), 'meter.html')
for (const [w, h, wide] of [[900, 488, true], [300, 470, false]]) {
  const f = await open(FACE + '?name=lead vox', { width: w, height: h, dsf: 1 })
  await f.sleep(700)
  const s = await f.ev(`const m = window.__meter; return m ? { w: m.F.w, h: m.F.h, now: !!m.F.now, hits: m.F.hits.map(q => q.k), i: m.F.now && m.F.now.i, wave: m.F.now && m.F.now.waveB.length, pairs: m.F.now && m.F.now.pairB.length, set: m.SET } : null`)
  ok(`the face draws by itself ${w} wide: it reads what it is given and lays out its cells`, !!s && s.now && s.wave === 4000 && s.pairs === 2048 && s.hits.includes('reset') && s.hits.includes('hold') && (wide ? s.hits.filter(k => k === 'mode').length === 3 && s.hits.includes('aim') && s.hits.includes('sec') : s.hits.includes('modeNext')), s)
  if (wide) {
    const at = k => f.ev(`const q = window.__meter.F.hits.filter(q => q.k === '${k.split(':')[0]}')${k.includes(':') ? `.find(q => q.v === '${k.split(':')[1]}')` : '[0]'}; return { x: q.x + q.w / 2, y: q.y + q.h / 2 }`)
    let p = await at('mode:polar level'); await f.click(p.x, p.y); await f.sleep(120)
    p = await at('sec'); await f.click(p.x, p.y); await f.sleep(120)
    p = await at('aim'); await f.click(p.x, p.y); await f.sleep(120)
    p = await at('hold'); await f.click(p.x, p.y); await f.sleep(120)
    const t = await f.ev(`return window.__meter.SET`)
    ok('its cells: another picture, more of the wave, another aim, hold let go', t.mode === 'polar level' && t.sec === 30 && t.aim === -16 && t.hold === false, t)
  }
  ok(`…and nothing went wrong on it (${w} wide)`, !f.errors.length, f.errors)
  await f.close().catch(() => {})
}
console.log(out.join('\n'))
console.log(bad.length ? `meternode: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'meternode: all passed')
process.exit(bad.length ? 1 : 0)
