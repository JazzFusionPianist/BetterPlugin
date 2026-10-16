// node test/stems.mjs — which stems are handed off: every track that sounds in the range has a row in the hand-off panel; a
// row pressed is left out (its mark is a dash, the count and the plan go down by one), pressed again it is in; with option,
// that one alone, and with option again all of them; tracks that do not sound in the range cannot be pressed in.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); Object.assign(S.ho, { open: true, what: 'stems', print: 'with patch', range: 'song', skip: [], done: 0, note: '' }); dirtyAll(); flush()`)
const see = () => ev(`flush(); const pl = hoPlan(); return { list: pl.list.map(t => t.name), cands: pl.cands.map(t => t.name), skip: (S.ho.skip || []).length, head: document.getElementById('g-hand').textContent.match(/(\\d+) stems/), rows: document.querySelectorAll('#g-hand [data-a="ho-pick"]').length }`)
const row = name => ev(`flush(); const i = S.tracks.findIndex(t => t.name === ${JSON.stringify(name)}), el = document.querySelector('#g-hand [data-a="ho-pick"][data-i="' + i + '"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2 }`)
const s0 = await see()
ok('every track that sounds in the song has a row that can be pressed, and all of them are in', s0.list.length === s0.cands.length && s0.cands.length >= 6 && s0.rows === s0.cands.length && +s0.head[1] === s0.list.length, s0)
{ const p = await row('snare'); await b.click(p.x, p.y); await b.sleep(80)
  const s = await see()
  ok('a row pressed: that stem is left out, and the count says one fewer', !s.list.includes('snare') && s.list.length === s0.list.length - 1 && +s.head[1] === s0.list.length - 1 && s.cands.includes('snare'), s)
  ok('…its row can still be pressed', s.rows === s0.rows)
  await b.click(p.x, p.y); await b.sleep(80)
  ok('pressed again: it is in again', (await see()).list.includes('snare') && (await see()).list.length === s0.list.length) }
{ const p = await row('bass'); await b.click(p.x, p.y, 1); await b.sleep(80)
  const s = await see()
  ok('with option: that one alone', JSON.stringify(s.list) === JSON.stringify(['bass']) && +s.head[1] === 1, s.list)
  await b.click(p.x, p.y, 1); await b.sleep(80)
  ok('with option again on the only one: all of them', (await see()).list.length === s0.list.length, (await see()).list) }
{ await ev(`S.ho.skip = hoPlan().cands.map(t => t.id); dirtyAll(); flush()`)
  const s = await see()
  ok('all pressed out: nothing would be printed, and every row can still be pressed in', s.list.length === 0 && s.rows === s0.rows, s)
  await ev(`S.ho.skip = []; S.ho.open = false; dirtyAll(); flush()`) }
{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `stems: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'stems: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
