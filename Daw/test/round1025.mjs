// node test/round1025.mjs — his asks of 2026-10-25: every chosen point of every line goes with the hand when the line is taken
// hold of between them; a slot of the mixer pulled onto another strip moves there (with option: a copy), on the strip the
// mixer draws under the hand; a stack takes plug-ins and sends; a switched-off track's regions can be seen; option s hears
// the chosen regions alone and control s every one again; a value changed by hand on the main screen, and a point's, boxed
// for two seconds. Real presses, real modifiers. (The short fades of tidy: test/tidy.mjs.)
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(600)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, ALT = 1
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (x0, y0, x1, y1, m = 0) => {
  await b.sleep(250); await mouse('mouseMoved', x0, y0, { buttons: 0, modifiers: m }); await mouse('mousePressed', x0, y0, { modifiers: m })
  for (let k = 1; k <= 8; k++) { await mouse('mouseMoved', x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8, { modifiers: m }); await b.sleep(16) }
  await mouse('mouseReleased', x1, y1, { modifiers: m }); await b.sleep(120)
}
const key = async (code, k, m = 0) => { await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code, key: k, modifiers: m }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, modifiers: m }); await b.sleep(80) }

await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.tool = 'pointer'; VY = 0; setZoom(0); flush(); return 1`)

/* 1: all the points chosen, a line taken hold of between two of them: every point of every line goes down by as much */
{ await ev(`S.rh = 60; const ts = S.tracks.filter(t => t.kind === 'audio').slice(0, 2); window.TI = ts.map(t => S.tracks.indexOf(t))
    ts.forEach(t => { t.autos = t.autos || {}; t.ap = 'vol'; t.autos.vol = [{ id: ++PID, b: 2, v: -6 }, { id: ++PID, b: 6, v: -6 }, { id: ++PID, b: 10, v: -12 }] })
    S.auto = true; S.ap = 'vol'; flush(); act.selectAll(); flush(); return S.selP.length`)
  const p = await ev(`const ti = TI[0], t = S.tracks[ti], g = autoGeom(t, rowY(ti), rowH(ti)); return { x: bx(4 + 1), y: g.yOf(autoAt(t, 'vol', 4)) }`)
  const before = await ev(`return TI.map(i => S.tracks[i].autos.vol.map(q => q.v))`)
  await pull(p.x, p.y, p.x, p.y + 14)
  const after = await ev(`return TI.map(i => S.tracks[i].autos.vol.map(q => [q.v, q.b]))`)
  const dv = before.map((vs, k) => vs.map((v, j) => +(after[k][j][0] - v).toFixed(3)))
  ok('all the points of two lines chosen, one line pulled down between two of them: every point of both lines goes down', dv.flat().every(d => d < -.2), dv)
  ok('…none goes along the song', after.flat().every((q, j) => true) && after.every(l => l.map(q => q[1]).join() === '2,6,10'), after)
  ok('…the two lines by the same db', new Set(dv.flat().map(d => d.toFixed(1))).size <= 3 && Math.abs(dv[0][0] - dv[1][0]) < .05, dv)
  /* 7: the points moved are boxed with their value, for two seconds */
  const lit = await ev(`flush(); return { up: AUTO_LIT.until > performance.now(), ids: AUTO_LIT.ids.size, drawn: [...document.querySelectorAll('#g-lanes rect')].filter(r => r.getAttribute('height') === '11.8').length }`)
  ok('…each point moved has its value in a box of the line\'s ink', lit.up && lit.ids === 6 && lit.drawn >= 2, lit)
  await b.sleep(2300)
  ok('…gone two seconds after', await ev(`flush(); return AUTO_LIT.until < performance.now() && [...document.querySelectorAll('#g-lanes rect')].filter(r => r.getAttribute('height') === '11.8').length === 0`))
  /* a line with no chosen point under the hand: only its stretch, as before */
  await ev(`S.selP = []; flush(); return 1`)
  const q = await ev(`const ti = TI[1], t = S.tracks[ti], g = autoGeom(t, rowY(ti), rowH(ti)); return { x: bx(8 + 1), y: g.yOf(autoAt(t, 'vol', 8)) }`)
  const b2 = await ev(`return S.tracks[TI[1]].autos.vol.map(q => q.v)`)
  await pull(q.x, q.y, q.x, q.y + 14)
  const a2 = await ev(`return S.tracks[TI[1]].autos.vol.map(q => q.v)`), first = await ev(`return S.tracks[TI[0]].autos.vol.map(q => q.v)`)
  ok('…nothing chosen: the stretch under the hand alone, the other line left', a2[0] === b2[0] && a2[1] < b2[1] && a2[2] < b2[2] && JSON.stringify(first) === JSON.stringify(after[0].map(x => x[0])), [b2, a2])
  await ev(`for (const i of TI) S.tracks[i].autos.vol = []; S.auto = false; S.selP = []; flush(); return 1`) }

/* 2 and 3: the mixer's slots pulled onto another strip; a stack's strip */
await ev(`S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 470; S.sel = 0; setView(true); dirtyAll(); flush(); return 1`)
const slot = (i, k) => ev(`flush(); const el = document.querySelector('#g-dock [data-a="mfx"][data-i="${i}"][data-k="${k}"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }`)
const stripX = i => ev(`flush(); const s = MIX_AT.find(x => x[0] === ${i}); if (!s) return null; return new DOMPoint((s[1] + s[2]) / 2, 0).matrixTransform(document.getElementById('g-dock').getScreenCTM()).x`)      // (the mixer's own measure, on the screen)
{ await ev(`for (const t of S.tracks) setPrint(t, 'tape', 0); setPrint(S.tracks[0], 'tape', 40); uiDirty('dock'); flush(); return 1`)
  const k0 = await ev(`return fxItems(S.tracks[0]).findIndex(it => it.k === 'tape')`)
  const s = await slot(0, k0), x2 = await stripX(2)
  ok('the mixer says where each strip stands', !!s && x2 != null, [s, x2])
  if (s && x2 != null) {
    await pull(s.x, s.y, x2, s.y)
    ok('a slot pulled onto another strip: it moves there', await ev(`return patchNow(S.tracks[2]).tape === 40 && !patchNow(S.tracks[0]).tape`), await ev(`return [patchNow(S.tracks[0]).tape, patchNow(S.tracks[2]).tape]`))
    const k2 = await ev(`return fxItems(S.tracks[2]).findIndex(it => it.k === 'tape')`), s2 = await slot(2, k2), x3 = await stripX(4)
    await pull(s2.x, s2.y, x3, s2.y, ALT)
    ok('…with option: a copy, the first stays', await ev(`return patchNow(S.tracks[2]).tape === 40 && patchNow(S.tracks[4]).tape === 40`), await ev(`return [patchNow(S.tracks[2]).tape, patchNow(S.tracks[4]).tape]`))
  }
  /* the same in bauhaus's own mixer, whose strips are not all as wide */
  const bau = await ev(`applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); S.panel.on = true; S.panel.tab = 'mixer'; setView(true); dirtyAll(); flush(); return SKIN.k.mixer`)
  ok('bauhaus has a mixer of its own', bau === 'poster', bau)
  if (bau === 'poster') {
    const k3 = await ev(`S.sel = 4; dirtyAll(); flush(); return fxItems(S.tracks[4]).findIndex(it => it.k === 'tape')`), s3 = await slot(4, k3), x5 = await stripX(7)
    if (s3 && x5 != null) { await pull(s3.x, s3.y, x5, s3.y); ok('…and in bauhaus\'s mixer, its strips as they are drawn', await ev(`return patchNow(S.tracks[7]).tape === 40 && !patchNow(S.tracks[4]).tape`)) }
    else ok('…and in bauhaus\'s mixer, its strips as they are drawn', false, [s3, x5])
    await b.send('Page.reload'); await b.sleep(1200); await ev(`if (typeof START !== 'undefined') START.on = false; S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 470; setView(true); dirtyAll(); flush(); return 1`)
  }
}
{ const si = await ev(`S.focus = 'tracks'; S.sel = 6; S.selT = [S.tracks[6].id, S.tracks[7].id]; makeStack(); flush(); return S.tracks.findIndex(t => t.kind === 'stack')`)
  ok('a stack made', si >= 0, si)
  await ev(`S.sel = ${si}; S.panel.tab = 'mixer'; dirtyAll(); flush(); return 1`)
  const has = await ev(`return { fx: !!document.querySelector('#g-dock [data-a="mfxadd"][data-i="${si}"]'), send: !!document.querySelector('#g-dock [data-a="msendadd"][data-i="${si}"]') }`)
  ok('a stack\'s strip: a place for a plug-in and for a send', has.fx && has.send, has)
  await ev(`setPrint(S.tracks[0], 'tape', 25); uiDirty('dock'); flush(); return 1`)
  const k0 = await ev(`return fxItems(S.tracks[0]).findIndex(it => it.k === 'tape')`), s = await slot(0, k0), xs = await stripX(si)
  if (s && xs != null) { await pull(s.x, s.y, xs, s.y, ALT); ok('…a slot pulled onto it with option goes on it', await ev(`return patchNow(S.tracks[${si}]).tape === 25`)) }
  else ok('…a slot pulled onto it with option goes on it', false, [s, xs])
  const add = await ev(`const el = document.querySelector('#g-dock [data-a="msendadd"][data-i="${si}"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
  await pull(add.x, add.y, add.x, add.y)
  const items = await ev(`return S.menu ? S.menu.items.map(i => i.t) : null`)
  ok('…its + send: where to, a new bus among them', !!items && items.some(t => /new bus/.test(t)), items)
  await ev(`const k = S.menu.items.findIndex(i => /new bus/.test(i.t)); S.menu.pick(S.menu.items[k]); S.menu = null; flush(); return 1`)
  ok('…a send from the stack', await ev(`return (S.tracks[${si}].sends || []).length === 1`)) }

/* 5: a switched-off track's regions faded less than its head */
{ const r = await ev(`const i = S.tracks.findIndex(t => t.kind === 'audio'); S.tracks[i].disabled = true; const lane = laneRow(i, new Set()), head = headRow(i); S.tracks[i].disabled = false; return { lane: /^<g opacity="([\\d.]+)">/.exec(lane)?.[1], head: /^<g opacity="([\\d.]+)">/.exec(head)?.[1] }`)
  ok('a track switched off: its regions at .62, its head at .34', r.lane === '0.62' || r.lane === '.62', r) }

/* 6: option s, the chosen regions alone; control s, every one again */
{ await ev(`S.panel.on = false; S.focus = 'lanes'; const t = S.tracks.find(t => t.kind === 'audio' && t.regs.length > 1); window.RT = t; S.selR = [t.regs[0].id]; setView(true); flush(); return 1`)
  await key('KeyS', 's', ALT)
  const on = await ev(`flush(); return { set: S.rsolo ? [...S.rsolo] : null, ok0: rsoloOk(RT.regs[0]), ok1: rsoloOk(RT.regs[1]), other: S.tracks.filter(t => t !== RT).flatMap(t => t.regs).every(r => !rsoloOk(r)), faded: /opacity=".34"/.test(laneRow(S.tracks.indexOf(RT), new Set())) }`)
  ok('option s: the chosen region alone is heard, every other silent', on.set && on.set.length === 1 && on.ok0 && !on.ok1 && on.other, on)
  ok('…the others drawn faded', on.faded, on)
  await key('KeyS', 's', 2)
  ok('control s: every region heard again', await ev(`return S.rsolo === null && S.tracks.flatMap(t => t.regs).every(rsoloOk)`)) }

/* 7: the main screen's values boxed while changed by hand and two seconds after: a strip's level pulled in the mixer */
{ await ev(`S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 470; S.sel = 1; S.tracks[1].vol = -10; setView(true); dirtyAll(); flush(); return 1`)
  const f = await ev(`const el = document.querySelector('#g-dock [data-a="mvol"][data-i="1"]'); const r = el.getBoundingClientRect(); return { x: r.x + 8, y: r.y + r.height / 2 }`)
  await pull(f.x, f.y, f.x, f.y - 30)
  await b.sleep(120)
  const lit = await ev(`const g = document.getElementById('g-litm'); return g ? { n: g.children.length, word: [...g.querySelectorAll('text')].map(t => t.textContent).join(' ') } : null`)
  ok('a level pulled in the mixer: its value boxed on the main screen', !!lit && lit.n >= 1 && /\d/.test(lit.word), lit)
  await b.sleep(2400)
  ok('…gone two seconds after', await ev(`const g = document.getElementById('g-litm'); return !g || g.children.length === 0`)) }

ok('no errors on the page', !b.errors.length, b.errors.slice(0, 3))
console.log(out.join('\n'))
console.log(bad.length ? `\n${bad.length} failed` : '\nall passed')
await b.close()
process.exit(bad.length ? 1 : 0)
