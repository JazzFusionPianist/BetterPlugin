// node test/llm.mjs — low latency mode, the bolt in the transport: it stands after the click, off at first; pressed, it is
// lit in the monitor's orange and pressed again it goes out; what the engine says it steps past on the wall is dimmed and
// says so, and how late it was; the mode is not written with a project; settings > audio has its limit.
import { open, PAGE } from './cdp.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
setTimeout(() => { console.log('llm: TIMED OUT'); process.exit(2) }, 90000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const click = async p => { await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); await mouse('mouseReleased', p.x, p.y); await b.sleep(150) }
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); dirtyAll(); flush()`)
const bolt = () => ev(`flush(); const el = document.querySelector('[data-a="lowlat"]'); if (!el) return null; const r = el.getBoundingClientRect(), c = document.querySelector('[data-a="click"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, after: r.x > c.x, fill: [...document.querySelectorAll('rect')].some(q => q.getAttribute('fill') === MON && Math.abs(+q.getAttribute('x') - (r.x - document.getElementById('svg').getBoundingClientRect().x)) < 2) }`)
const b0 = await bolt()
ok('the bolt stands in the transport, after the click, off at first', !!b0 && b0.after && !b0.fill && (await ev(`return S.lowLat`)) === false, b0)
await click(b0)
const b1 = await bolt()
ok('pressed: on, lit in the monitor’s orange, and says so', (await ev(`return S.lowLat`)) === true && b1.fill && /low latency/.test(await ev(`return (S.last && S.last.say) || ''`)), [b1, await ev(`return S.last`)])
await click(b1)
ok('pressed again: off', (await ev(`return S.lowLat`)) === false && !(await bolt()).fill)
/* what the engine steps past, on the wall */
await ev(`S.sel = 1; S.panel.on = true; S.panel.tab = 'patch'; setView(true); const t = S.tracks[1]; t.inserts.length = 0; t.patch = NO_PATCH(); t.wall = undefined; wallAdd(t, 'pitch'); wallAdd(t, 'space')
  const w = wallOf(t); w.wires = [{ from: WALL_IN, to: w.nodes[0].id, gain: 1, port: 0 }, { from: w.nodes[0].id, to: w.nodes[1].id, gain: 1, port: 0 }, { from: w.nodes[1].id, to: WALL_OUT, gain: 1, port: 0 }]
  S.lowLat = true; LLM.facts = { on: true, ms: 5, fast: [t.id], skipped: [{ track: t.id, node: w.nodes[0].id, ms: 46.4 }] }; WALL.sel = null; dirtyAll(); flush()`)
const words = await ev(`return [...document.getElementById('g-dock').querySelectorAll('text')].map(q => q.textContent)`)
ok('on the wall, what is stepped past says so, and how late it was, in the monitor’s orange', words.includes('skipped · 46 ms') && await ev(`return [...document.getElementById('g-dock').querySelectorAll('text')].some(q => q.textContent === 'skipped · 46 ms' && q.getAttribute('fill') === MON)`), words.filter(w => /skipped/.test(w)))
ok('…and only that one', words.filter(w => /skipped/.test(w)).length === 1)
ok('the mode is not written with a project', (await ev(`const s = serialize(); return typeof s === 'string' ? s : JSON.stringify(s)`)).length > 100 && !/lowLat/.test(await ev(`const s = serialize(); return typeof s === 'string' ? s : JSON.stringify(s)`)))
await ev(`S.lowLat = false; LLM.facts = null; dirtyAll(); flush()`)
ok('off: nothing on the wall says it is stepped past', !(await ev(`return [...document.getElementById('g-dock').querySelectorAll('text')].map(q => q.textContent)`)).some(w => /skipped/.test(w)))
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
await b.close()
/* settings > audio: the limit */
const here = dirname(fileURLToPath(import.meta.url)), s = await open(join(here, '../ui/settings.html'), { width: 760, height: 560, dsf: 1 })
await s.sleep(500)
const row = await s.ev(`const all = [...document.querySelectorAll('text')].map(q => q.textContent); return { label: all.includes('low latency'), five: all.includes('5'), ms: all.includes('ms') }`)
ok('settings > audio has the limit, 5 ms at first', row.label && row.five && row.ms, row)
console.log(out.join('\n'))
console.log(bad.length ? `llm: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'llm: all passed')
process.exit(bad.length ? 1 : 0)
