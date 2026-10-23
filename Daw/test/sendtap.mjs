// node test/sendtap.mjs — where a send takes its sound (his ask, 2026-10-24, his pick of send modes draft 1 with post pan the
// way it always was): the other button on a send's knob in the mixer lists the buses, then post pan (lit: the way a send has
// always been), post fader and pre fader, each with its colour; pre fader picked: kept on the send, one step of undo, told to
// the engine (2), its knob amber; post fader: blue; post pan again: no word kept, the knob white; kept with the project;
// bauhaus: red, blue, yellow. Real presses.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const rclick = async p => { await b.sleep(300); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'right', buttons: 2, clickCount: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'right', clickCount: 1 }); await b.sleep(120) }
const pick = async label => { const i = await ev(`return S.menu ? S.menu.items.findIndex(it => it.t === ${JSON.stringify(label)}) : -1`); if (i < 0) return false; const q = await ev(`const el = document.querySelector('[data-a="pick"][data-i="${i}"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(q.x, q.y); await b.sleep(150); return true }
const knob = (sel = 'mp-send') => ev(`flush(); const el = [...document.querySelectorAll('[data-a="${sel}"][data-k="0"]')].find(e => e.getBoundingClientRect().width > 0); if (!el) return null; const q = el.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 - 4 }`)
/* the colour of the first send's ring as drawn in the mixer */
const ring = () => ev(`flush(); const t = S.tracks[TI], g = [...document.querySelectorAll('g.mpk')].find(x => x.querySelector('title') && x.querySelector('title').textContent.replace(/\\u2063/g, '') === 'verb'); const p = g && g.querySelectorAll('g > path')[1]; return p ? p.getAttribute('stroke') : null`)
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(false, false)
  const vb = mkTrack('verb', null, null, null, null, 0, [], NO_PATCH()); vb.kind = 'bus'; S.tracks.push(vb)
  const t = S.tracks.find(x => x.name === 'hum'); window.TI = S.tracks.indexOf(t); t.sends = [{ to: vb.id, db: -8 }]
  S.sel = TI; S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 420; setView(true); dirtyAll(); flush(); return 1`)
await rclick(await knob())
{ const m = await ev(`return S.menu ? S.menu.items.map(it => [it.t, !!it.on, it.sw || null]) : null`), c = await ev(`return [INK, SPACE, AMBER]`)
  const tail = m && m.slice(-3)
  ok('the other button on a send: the buses, then post pan (lit), post fader, pre fader, each with its colour', !!m && m[0][0] === 'verb' && JSON.stringify(tail) === JSON.stringify([['post pan', true, c[0]], ['post fader', false, c[1]], ['pre fader', false, c[2]]]), [m, c]) }
ok('…the colours drawn in the list', await ev(`return document.querySelectorAll('#g-menu rect[fill="${'#FFA848'}"], rect[fill="#FFA848"]').length >= 1`))
ok('a send that has always been: its knob white', await ring() === await ev(`return INK`), await ring())
{ const u0 = await ev(`return UNDO.length`); await pick('pre fader')
  const r = await ev(`const sd = S.tracks[TI].sends[0]; return { tap: sd.tap, n: sendTapN(sd), undo: UNDO.length }`)
  ok('pre fader picked: kept on the send, told to the engine as 2, one step of undo', r.tap === 'pre' && r.n === 2 && r.undo === u0 + 1, [r, u0])
  ok('…its knob amber', await ring() === '#FFA848', await ring()) }
await rclick(await knob()); await pick('post fader')
ok('post fader: told as 1, its knob blue', await ev(`return sendTapN(S.tracks[TI].sends[0])`) === 1 && await ring() === '#7896FF', await ring())
{ const k = await ev(`const d = JSON.parse(serialize()); return d.tracks.find(t => t.name === 'hum').sends[0].tap`); ok('kept with the project', k === 'post', k) }
await rclick(await knob()); await pick('post pan')
ok('post pan again: no word kept (the way it always was), told as 0, white', await ev(`const sd = S.tracks[TI].sends[0]; return !('tap' in sd) && sendTapN(sd) === 0`) && await ring() === await ev(`return INK`))
await ev(`undoEdit(); flush(); return 1`)
ok('…undone: post fader again', await ev(`return S.tracks[TI].sends[0].tap`) === 'post')
/* bauhaus */
await ev(`S.panel.on = false; applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); tpanelSet(true, false); setView(true); S.tracks[TI].sends[0].tap = 'pre'; dirtyAll(); flush(); return 1`); await b.sleep(300)
{ const c = await ev(`flush(); const g = document.querySelector('g.bmk'); if (!g) return null; return [...g.querySelectorAll('path')].map(p => p.getAttribute('stroke'))`), y = await ev(`return BH.yellow`)
  ok('bauhaus: a pre fader send\'s ring yellow', !!c && c.includes(y), [c, y]) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
