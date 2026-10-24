// node test/boxes.mjs — the boxes (ui/boxes.js): a theme places every surface of the room by eight numbers.
//   1 the room as it comes, said as boxes (boxWrite) and worn again: the same cut, the same drawing, to the string;
//   2 the same for bauhaus (its column, its foot band);
//   3 a theme that could not be made before — the heads at the right, the bars and the markers under the lanes, the
//     command line at the top, no transport band: each where its box says; a marker pressed, the bars pressed, a head's
//     cell pressed and its level pulled all land; the wheel scrolls the lanes; the panel opens over the lanes' foot and
//     the rows under keep their place; the playhead runs through the lanes;
//   4 the window another size: the boxes follow their pins.
import { open, PAGE } from './cdp.mjs'
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const SET = `if (typeof START !== 'undefined') START.on = false; S.rh = 36; setZoom(26, 0); VX = 0; VY = 0; chooseTrack(1); S.panel.on = false; INSP.on = false; setView(true); dirtyAll(); flush(); return 1`
const CUT = `return { W, H, X0, X1, TY, BY, MK_Y, RU_Y, TOOL_Y, BAR_H, DECK_H, left: SKV.left, noTool: SKIN.noTool, right: !!SKIN.right, dx: BOX.dx, cmdDy: BOX.cmdDy, tl: [...$('tl').firstChild.attributes].map(a => a.value).join(' '), head: $('g-head').getAttribute('transform') }`
const DOM = `flush(); return board.innerHTML.replace(/ id="cl\\d+"/g, '').replace(/url\\(#cl\\d+\\)/g, '')`      // (the cells' clip ids count up with every drawing)
const FREE = (WW, WH) => ({ 'box.drawn': `${WW} ${WH}`, 'box.lanes': `0 22 ${WW - 292} ${WH - 22 - 52} 0 0 1 1`, 'box.heads': `${WW - 292} 22 292 ${WH - 22 - 52} 1 0 1 1`, 'box.bars': `0 ${WH - 52} ${WW - 292} 26 0 1 1 1`, 'box.markers': `0 ${WH - 26} ${WW - 292} 26 0 1 1 1`, 'box.command line': `0 0 ${WW} 22 0 0 1 0` })

async function same (b, name, wear) {
  if (wear) { await b.ev(wear); await b.sleep(300) }
  const cut0 = await b.ev(CUT), dom0 = await b.ev(DOM)
  const doc = await b.ev(`return boxWrite()`)
  await b.ev(`applyLook(Object.assign({}, LOOK, ${JSON.stringify(doc)})); dirtyAll(); flush(); return 1`); await b.sleep(300)
  const cut1 = await b.ev(CUT), dom1 = await b.ev(DOM), said = await b.ev(`return BOX.said`)
  const i = dom0 === dom1 ? -1 : [...dom0].findIndex((c, k) => c !== dom1[k])
  ok(`${name}: said as boxes and worn again — the same cut`, said && JSON.stringify(cut0) === JSON.stringify(cut1), { doc, cut0, cut1 })
  ok(`${name}: …and the same drawing, to the string`, dom0 === dom1, i < 0 ? undefined : { at: i, was: dom0.slice(Math.max(0, i - 80), i + 80), now: dom1.slice(Math.max(0, i - 80), i + 80) })
}

{ const b = await open(PAGE, { width: 1728, height: 1117, dsf: 1 })
  await b.sleep(600)
  await b.ev(SET)
  /* 1 the room as it comes (the transport panel up, as the app begins) */
  await same(b, 'the room as it comes', `tpanelSet(true, false); setView(true); dirtyAll(); flush()`)
  /* 2 bauhaus */
  await same(b, 'bauhaus', `applyLook(Object.assign({}, THEMES.bauhaus)); setView(true); dirtyAll(); flush()`)
  await b.ev(`applyLook({}); tpanelSet(false, false); setView(true); dirtyAll(); flush(); return 1`); await b.sleep(200)
  /* 3 free: the heads at the right, the bars and the markers under the lanes, the command line at the top */
  await b.ev(`applyLook(${JSON.stringify(FREE(1728, 1117))}); setView(true); dirtyAll(); flush(); return 1`); await b.sleep(300)
  const c = await b.ev(CUT)
  ok('free: the lanes from the left edge, the heads at the right of them', c.X0 === 0 && c.X1 === 1728 - 292 && c.dx === 1728 - 292 && !c.head, c)
  ok('free: the bars and the markers under the lanes, the command line over them', c.TY === 22 && c.BY === 1117 - 52 && c.RU_Y === 1117 - 52 && c.MK_Y === 1117 - 26 && c.cmdDy === -(1117 - 22) && c.BAR_H === 0 && c.left === 0, c)
  ok('free: the playhead\'s clip runs from the lanes\' top to the markers\' foot', c.tl === `0 22 1436 ${1117 - 22}`, c.tl)
  const hd = await b.ev(`flush(); const r = $('g-head').getBoundingClientRect(), s = board.getBoundingClientRect(); return { x: Math.round(r.left - s.left), w: Math.round(r.width) }`)
  ok('free: the heads are drawn at the right', hd.x >= 1728 - 292 - 1 && hd.w <= 292 + 1, hd)
  const ph = await b.ev(`flush(); const p = document.querySelector('#ph path'); return p ? p.getAttribute('d') : null`)
  ok('free: the playhead\'s line runs through the lanes', !!ph && /M\.5 22V/.test(ph), ph)
  /* a marker pressed, the bars pressed: each lands where it stands */
  const sc = await b.ev(`flush(); const e = document.querySelector('[data-a="scene"][data-i="2"]'), r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, at: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).dataset.a }`)
  await b.click(sc.x, sc.y); await b.sleep(150)
  ok('free: a marker under the lanes, pressed: it is the one chosen', sc.at === 'scene' && await b.ev(`return S.selM != null && (S.selM === 2 || S.selM === SCENES[2].a || S.selM === SCENES[2].id)`), { sc, selM: await b.ev(`return S.selM`), scene: await b.ev(`return SCENES[2]`) })
  const pos0 = await b.ev(`return curPos()`)
  const ru = await b.ev(`const es = [...document.querySelectorAll('#g-ruler [data-a]')].filter(e => e.dataset.a !== 'cycle' && e.dataset.a !== 'prestart'); es.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width); const e = es[0], r = e.getBoundingClientRect(); return { x: r.left + 300, y: r.top + r.height * .7, a: e.dataset.a, at: document.elementFromPoint(r.left + 300, r.top + r.height * .7).dataset.a }`)
  await b.click(ru.x, ru.y); await b.sleep(150)
  const pos1 = await b.ev(`return curPos()`)
  ok('free: the bars under the lanes, pressed: the playhead goes there', Math.abs(pos1 - pos0) > .5, { pos0, pos1, ru })
  /* a head's cell pressed, its level pulled: in the heads' own units, wherever they stand */
  const mu = await b.ev(`flush(); const e = document.querySelector('#g-head [data-a="mute"][data-i="0"]'), r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, at: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).dataset.a }`)
  await b.click(mu.x, mu.y); await b.sleep(150)
  ok('free: a head\'s mute, pressed at the right: the track is muted', mu.at === 'mute' && (await b.ev(`return !!S.tracks[0].mute`)), mu)
  await b.click(mu.x, mu.y); await b.sleep(100)
  const lv = await b.ev(`flush(); const e = document.querySelector('#g-head [data-a="vol"][data-i="0"]'), r = e.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width, vol: S.tracks[0].vol }`)
  await b.dragTo(lv.x + lv.w * .5, lv.y, lv.x + lv.w * .9, lv.y, 8); await b.sleep(150)
  const vol1 = await b.ev(`return S.tracks[0].vol`)
  ok('free: a head\'s level pulled to the right: louder, as the pointer says', vol1 > lv.vol + 2, { was: lv.vol, now: vol1 })
  /* the wheel over the lanes scrolls them (the rows are no longer "between the markers and the lanes' foot") */
  await b.ev(`setZoom(80, 0); VX = 0; dirtyAll(); flush(); return 1`)
  const vx0 = await b.ev(`return VX`)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 600, y: 500, deltaX: 240, deltaY: 0 }); await b.sleep(250)
  ok('free: the wheel over the lanes moves them', (await b.ev(`return VX`)) > vx0, { vx0, vx: await b.ev(`return VX`) })
  /* the panel opens over the lanes' foot; the rows under keep their place */
  await b.ev(`S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 300; setView(true); dirtyAll(); flush(); return 1`); await b.sleep(250)
  const cp = await b.ev(CUT)
  ok('free: the panel open — the lanes end above it, the bars and the markers stay at the foot', cp.BY === 1117 - 52 - 300 && cp.RU_Y === 1117 - 52 && cp.MK_Y === 1117 - 26, cp)
  const dock = await b.ev(`flush(); const r = $('g-dock').firstElementChild; return r ? { y: +r.getAttribute('y'), h: +r.getAttribute('height') } : null`)
  ok('free: …the panel\'s board stands between them', !!dock && dock.y === cp.BY && dock.y + dock.h <= 1117 - 52 + 2, dock)
  await b.ev(`S.panel.on = false; setView(true); dirtyAll(); flush(); return 1`)
  /* nothing covers a head's cell or a marker: the hit on top is theirs */
  const covered = await b.ev(`flush(); const bad = []; for (const sel of ['#g-head [data-a="solo"][data-i="1"]', '#g-head [data-a="sel"][data-i="3"]', '[data-a="scene"][data-i="1"]']) { const e = document.querySelector(sel); if (!e) { bad.push(sel + ' missing'); continue } const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (t !== e && !(t && t.dataset && t.dataset.a === e.dataset.a)) bad.push(sel + ' under ' + (t && (t.dataset.a || t.id || t.tagName))) } return bad`)
  ok('free: nothing covers a head\'s cells or a marker', !covered.length, covered)
  ok('nothing went wrong on the page', !(await b.ev(`return (window.__errs || []).length`)) && !b.errors.length, await b.ev(`return window.__errs`))
  await b.close() }

/* 4 another window: the boxes follow their pins — the heads still at the right edge, the rows still at the foot */
{ const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
  await b.sleep(600)
  await b.ev(SET)
  await b.ev(`tpanelSet(false, false); applyLook(${JSON.stringify(FREE(1728, 1117))}); setView(true); dirtyAll(); flush(); return 1`); await b.sleep(300)
  const c = await b.ev(CUT)
  ok('a smaller window: the heads at its right edge, the lanes the rest', c.X0 === 0 && c.X1 === 1440 - 292 && c.dx === 1440 - 292 && c.W === 1440, c)
  ok('a smaller window: the bars and the markers at its foot, the lanes down to them', c.RU_Y === 900 - 52 && c.MK_Y === 900 - 26 && c.BY === 900 - 52 && c.TY === 22, c)
  ok('nothing went wrong on the page', !(await b.ev(`return (window.__errs || []).length`)), await b.ev(`return window.__errs`))
  await b.close() }

console.log(out.join('\n'))
console.log(bad.length ? `boxes: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'boxes: all passed')
process.exit(bad.length ? 1 : 0)
