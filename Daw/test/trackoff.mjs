// node test/trackoff.mjs [w h] — a track switched off (his ask, 2026-10-20: for the processor): the track's other button
// has disable track above delete; picked, the track is silent and drawn faded, the engine would be told to leave it be,
// and it is written with the project; again, it is on. A stack switched off switches off what is in it. The menu bar
// has the line too. An instrument or plug-in that did not open is no longer written as left out.
import { open, PAGE } from './cdp.mjs'
const [W, H] = [+(process.argv[2] || 1440), +(process.argv[3] || 900)]
const b = await open(PAGE, { width: W, height: H, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const right = async (x, y) => { await b.sleep(400); await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y, { button: 'right', buttons: 2 }); await mouse('mouseReleased', x, y, { button: 'right', buttons: 0 }); await b.sleep(120) }
const click = async (x, y) => { await b.sleep(400); await b.click(x, y); await b.sleep(120) }
const rect = sel => ev(`flush(); const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + Math.min(60, r.width / 2), y: r.top + r.height / 2 }`)
await ev(`if (typeof START !== 'undefined') START.on = false; S.sel = 2; setView(true); dirtyAll(); flush()`)

{ const h = await rect('#hd-2 [data-a="sel"]')
  await right(h.x, h.y)
  const m = await ev(`flush(); return S.menu ? S.menu.items.map(i => i.t) : null`)
  const k = m ? m.indexOf('disable track') : -1
  ok('the track’s other button: disable track, just above delete', k >= 0 && m[k + 1] === 'delete', m)
  const it = await ev(`flush(); const i = S.menu.items.findIndex(x => x.v === 'trackoff'), e = document.querySelector('[data-a="pick"][data-i="' + i + '"]'), r = e.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }`)
  await click(it.x, it.y)
  const s = await ev(`flush(); const t = S.tracks[2], f = e => e && e.firstElementChild && e.firstElementChild.tagName === 'g' && e.firstElementChild.getAttribute('opacity'); return { off: !!t.disabled, heard: audible(t), head: f(document.getElementById('hd-2')), lane: [...document.querySelectorAll('#ln-rows > g')].some(g => g.firstElementChild && g.firstElementChild.getAttribute('opacity') === '${'0.34'}' || (g.innerHTML.startsWith('<g opacity="0.34"'))), saved: JSON.parse(serialize()).tracks[2].disabled === true }`)
  ok('picked: the track is switched off and not heard', s.off && !s.heard, s)
  ok('…drawn faded, its head and its lane', !!s.head && s.lane, s)
  ok('…written with the project', s.saved, s)
  await right(h.x, h.y)
  const m2 = await ev(`flush(); return S.menu ? S.menu.items.map(i => i.t) : null`)
  ok('its other button now has enable track', m2 && m2.includes('enable track'), m2)
  await ev(`const i = S.menu.items.findIndex(x => x.v === 'trackoff'); S.menu.pick(S.menu.items[i]); S.menu = null; flush()`)
  ok('…and picked, it is on again', await ev(`return !S.tracks[2].disabled && audible(S.tracks[2]) && JSON.parse(serialize()).tracks[2].disabled === undefined`)) }

/* a stack: what is in it goes with it */
{ const r = await ev(`S.selR = [S.tracks[0].regs[0].id, S.tracks[1].regs[0].id]; S.focus = 'lanes'; makeStack(); flush(); const st = S.tracks.find(t => t.kind === 'stack'), kids = S.tracks.filter(t => t.parent === st.id)
    trackOffToggle([st]); const off = [st].concat(kids).every(t => t.disabled); trackOffToggle([st]); const on = [st].concat(kids).every(t => !t.disabled); return { kids: kids.length, off, on }`)
  ok('a stack switched off switches off what is in it, and on again', r.kids >= 2 && r.off && r.on, r) }

ok('the menu bar has it: Track > Disable Track', await ev(`return MENU_BAR().find(m => m[0] === 'Track')[1].some(l => Array.isArray(l) && l[0] === 'Disable Track')`))

/* what did not open is not written as left out: the Mac that has it opens it again */
{ const r = await ev(`const t = S.tracks[0]; t.inserts = [{ uid: 0, id: '/Library/Audio/Plug-Ins/VST3/Nowhere.vst3', name: 'Nowhere', fmt: 'vst3', state: 'abc', out: true }]
    const o = JSON.parse(serialize()).tracks[0].inserts[0], c = instCopy({ kind: 'plug', id: 'x', name: 'Synth', state: 'zz', out: true, uid: 9 }); t.inserts = []
    return { insert: o, inst: c }`)
  ok('a plug-in that did not open is written with its settings, not as left out', r.insert.id && r.insert.state === 'abc' && !('out' in r.insert), r.insert)
  ok('…an instrument too', r.inst.state === 'zz' && !('out' in r.inst) && !('uid' in r.inst), r.inst) }

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `trackoff: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'trackoff: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
