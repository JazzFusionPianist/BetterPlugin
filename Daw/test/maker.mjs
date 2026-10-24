// node test/maker.mjs — the theme maker (ui/maker.js, the room's page with ?maker=1): the room live in the middle at
// the size the theme is drawn for, its boxes pressed, pulled and pinned; the head's template opened and a part pulled;
// undo; the sizes; the check; a theme kept.
import { open, PAGE } from './cdp.mjs'
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const b = await open(PAGE + '?maker=1', { width: 1920, height: 1200, dsf: 1 })
await b.sleep(1200)
const ev = b.ev
try {
/* where a window point (the theme's units) lies on the screen */
const at = async (wx, wy) => ev(`const r = board.getBoundingClientRect(); return { x: r.left + ${wx} * MK.k, y: r.top + ${wy} * MK.k }`)
const rect = nm => ev(`const r = boxRect(${JSON.stringify(nm)}, W + (SKV.left || 0), H); return r && { x: r.x0, y: r.y0, w: r.w, h: r.h }`)
const press = async (mk, more = '') => { const p = await ev(`const e = document.querySelector('[data-mk="${mk}"]${more}'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`); if (!p) return false; await b.click(p.x, p.y); await b.sleep(200); return true }

/* 1 the maker up: its chrome, the room scaled into the middle at 16″, its boxes written out */
const up = await ev(`return { maker: MK.on, chrome: ['mk-top', 'mk-left', 'mk-right', 'mk-layers'].every(id => !!$(id)), k: MK.k, W: W + (SKV.left || 0), H, said: boxSaid(), left: SKV.left, rows: document.querySelectorAll('#mk-left [data-mk="box"]').length }`)
ok('the maker up: its chrome around the room, the room at 1728 × 1117 scaled to fit, every box written out', up.maker && up.chrome && up.k > .3 && up.k < 1 && up.W === 1728 && up.H === 1117 && up.said && up.left === 248 && up.rows === 8, up)
/* 2 the heads box pressed in the room: chosen, said at the right */
const h0 = await rect('heads')
let p = await at(h0.x + h0.w / 2, h0.y + 300)
await b.click(p.x, p.y); await b.sleep(250)
const chosen = await ev(`return { sel: MK.sel, title: $('mk-right').querySelector('.title') && $('mk-right').querySelector('.title').textContent, nums: [...$('mk-right').querySelectorAll('input.num')].map(e => +e.value) }`)
ok('the heads pressed in the room: chosen; the right says where it stands', chosen.sel === 'heads' && /heads/.test(chosen.title) && JSON.stringify(chosen.nums) === JSON.stringify([248, 52, 292, 1043]), chosen)
const framed = await ev(`flush(); return { handles: document.querySelectorAll('#g-maker [data-a="mk-handle"]').length, canvas: !!document.querySelector('#g-maker [data-a="mk-canvas"]') }`)
ok('…framed, with its eight handles over the room', framed.handles === 8 && framed.canvas, framed)
/* 3 pulled to the right: it moves, the room with it; undone, it is back */
const k = up.k
await b.dragTo(p.x, p.y, p.x + 100, p.y, 10); await b.sleep(300)
const h1 = await rect('heads'), dx1 = await ev(`return BOX.dx`)
ok('pulled 100 px to the right: the box moves by as much in the theme\'s units, the heads drawn there', Math.abs(h1.x - (h0.x + 100 / k)) < 2 && Math.abs(dx1 - (h1.x - 248)) < 2, { h0, h1, k, dx: dx1 })
await press('undo')
const h2 = await rect('heads')
ok('undone: where it was', Math.abs(h2.x - h0.x) < .5 && (await ev(`return BOX.dx`)) === 0, h2)
/* 4 its pins: the bottom edge pressed goes from following to half way to staying */
const pin = async () => ev(`return boxNums(LOOK['box.heads']).slice(4)`)
ok('the bottom edge follows the window as it comes', JSON.stringify(await pin()) === '[0,0,0,1]', await pin())
await press('pin', '[data-p="3"]')
ok('…pressed: half way', (await pin())[3] === .5, await pin())
await press('pin', '[data-p="3"]')
ok('…pressed again: it stays', (await pin())[3] === 0, await pin())
await press('pin', '[data-p="3"]')
ok('…and again: it follows', (await pin())[3] === 1, await pin())
/* 5 the window another size: the boxes follow their pins (the heads' foot the window's) */
await press('size', '[data-w="1440"]')
const s13 = await ev(`return { W: W + (SKV.left || 0), H, k: MK.k }`), h13 = await rect('heads')
ok('13″: the room 1440 × 900, the heads as tall as the window lets them', s13.W === 1440 && s13.H === 900 && Math.abs(h13.h - (1043 - 217)) < .5 && h13.x === 248, { s13, h13 })
await press('size', '[data-w="1728"]')
/* 6 the check: nothing of the room as it comes is covered */
await press('check')
const warn = await ev(`return MK.warn`)
ok('check: nothing is covered in the room as it comes', Array.isArray(warn) && warn.length === 0, warn)
/* 7 the head opened: its columns, a part pressed and pulled */
await press('mode', '[data-mode="head"]')
const cols = await ev(`flush(); return { mode: MK.mode, tmpl: !!LOOK['tmpl.head'], parts: document.querySelectorAll('#g-maker [data-a="mk-part"]').length, levels: document.querySelectorAll('#g-maker [data-a="mk-part"][data-is="level"][data-c="1"]').length }`)
ok('the head opened: three columns of parts, the template in the theme', cols.mode === 'head' && cols.tmpl && cols.parts > 40 && cols.levels >= 8, cols)
const lv = await ev(`const es = [...document.querySelectorAll('#g-maker [data-a="mk-part"][data-is="level"][data-c="1"]')], e = es[1], r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`)
await b.click(lv.x, lv.y); await b.sleep(200)
ok('the level pressed in the middle column: chosen', await ev(`return MK.part && MK.part.is === 'level' && MK.part.c === 1`), await ev(`return MK.part`))
const x0 = await ev(`return tmplLayout(tmplOf('head'), 28).parts.find(p => p.is === 'level').x`)
await b.dragTo(lv.x, lv.y, lv.x - 30, lv.y, 10); await b.sleep(300)
const x1 = await ev(`return tmplLayout(tmplOf('head'), 28).parts.find(p => p.is === 'level').x`), gx = await ev(`flush(); const e = document.querySelector('#g-head [data-a="vol"][data-i="1"]'); return e && +e.dataset.gx`)
const hz = await ev(`return MK.hz`)
ok('pulled 30 px to the left: the one-line layout\'s level stands further left (the columns stand larger than life), in the room too', typeof x1 === 'number' && Math.abs(x1 - (x0 - 30 / k / hz)) < 2 && Math.abs(gx - x1) < .5, { x0, x1, gx, k, hz })
const other = await ev(`return tmplLayout(tmplOf('head'), 72).parts.find(p => p.is === 'level').x`)
ok('…the two-lines layout untouched', other === 'name', other)
await press('undo')
ok('undone: the level where it was', (await ev(`return tmplLayout(tmplOf('head') || TMPL_HEAD0, 28).parts.find(p => p.is === 'level').x`)) === x0)
/* 8 kept (a browser: in its own storage), and the theme holds boxes and the template */
await press('keep')
const kept = await ev(`const v = JSON.parse(localStorage.getItem('slur.maker.' + MK.name) || '{}'); return { said: MK.said, boxes: Object.keys(v).filter(k => /^box\\./.test(k)).length, tmpl: !!v['tmpl.head'], nonsense: Object.keys(v).some(k => !QUAL.has(k)) }`)
ok('kept: the theme with its boxes and its template, nothing else', /kept/.test(kept.said) && kept.boxes >= 7 && kept.tmpl && !kept.nonsense, kept)
ok('nothing went wrong on the page', !(await ev(`return (window.__errs || []).length`)) && !b.errors.length, [await ev(`return window.__errs`), b.errors.slice(0, 2)])
} catch (e) { out.push('FAIL threw: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); bad.push('threw') }
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `maker: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'maker: all passed')
process.exit(bad.length ? 1 : 0)
