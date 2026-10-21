// node test/prompt.mjs [w h] — the prompt's own page in the panel (draft b): / opens it with the keys in its field; what is
// typed and said is listed under it with what came of it; a line in cells stands in the field, its list in the page and a
// row of it pressed is taken; a said row pressed is said into the field again; the foot keeps only the machine's state while
// the page is up, and has its line back with another page; every page of the panel shows the prompt's tab. Real keys.
import { open, PAGE } from './cdp.mjs'
const [W, H] = [+(process.argv[2] || 1440), +(process.argv[3] || 900)]
const b = await open(PAGE, { width: W, height: H, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const el = sel => ev(`flush(); const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom }`)
const texts = () => ev(`flush(); return [...document.querySelectorAll('#g-dock text, #g-hint text')].map(t => t.textContent).join('|')`)
const foot = () => ev(`flush(); return { chevron: !!document.querySelector('#g-cmd [data-a="cmdline"]'), top: parseFloat($('cmd').style.top) }`)

await ev(`if (typeof START !== 'undefined') START.on = false; S.panel.on = false; setView(true); dirtyAll(); flush()`)
ok('the foot has its line while the page is not up', (await foot()).chevron)
await b.press('/', 'Slash', 191, 1); await b.sleep(400)      // (⌥/: / is go to bar since 2026-10-22)
const f = await el('#g-dock [data-a="prompt"][data-k="field"]')
ok('⌥/ opens the prompt\'s page, with the keys in its field', (await ev(`return S.panel.on && S.panel.tab === 'prompt' && document.activeElement === $('cmd')`)) && !!f)
{ const c = await ev(`const r = $('cmd').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }`)
  ok('…the typing stands in the field, not at the foot', c.top >= f.top && c.bottom <= f.bottom + 1, [c, f])
  ok('…and the foot keeps only the machine\'s state', !(await foot()).chevron) }

/* said: listed under the field, with what came of it */
await b.type('snare -2'); await b.press('Enter', 'Enter', 13); await b.sleep(250)
{ const t = await texts()
  ok('what was said is listed, with what came of it', /said/.test(t) && /snare -2/.test(t) && /−5\.0 to −7\.0 db|-5\.0 to -7\.0 db/.test(t), t.slice(-160)) }

/* a line in cells, in the field; its list in the page */
await b.press('a', 'KeyA', 65, 4); await b.press('Backspace', 'Backspace', 8)
await b.type('kic'); await b.sleep(150)
{ const row = await el('#g-dock [data-a="hint"][data-i="0"]')
  ok('typed: what can follow is listed in the page (not over the foot)', !!row && row.top > f.bottom && !(await ev(`return !!document.querySelector('#g-hint [data-a="hint"]')`)), row)
  await b.click(row.x, row.y); await b.sleep(150)
  const cells = await ev(`return S.line.parts.map(p => p.t)`), c = await ev(`flush(); const r = [...document.querySelectorAll('#g-hint text')].find(t => t.textContent === 'kick'); if (!r) return null; const q = r.getBoundingClientRect(); return { top: q.top, bottom: q.bottom }`)
  ok('a row pressed is taken: a cell, in the field, and the keys stay there', cells[0] === 'kick' && c && c.top > f.top && c.bottom < f.bottom && (await ev(`return document.activeElement === $('cmd')`)), [cells, c, f]) }
await b.press('Escape', 'Escape', 27); await b.press('Escape', 'Escape', 27); await b.sleep(80)

/* a said row pressed: into the field again */
{ await ev(`$('cmd').focus()`); const r = await el('#g-dock [data-a="prompt"][data-k="said"][data-i="0"]'); await b.click(r.x, r.y); await b.sleep(100)
  ok('a said row pressed: its words in the field again, chosen', (await ev(`return $('cmd').value`)) === 'snare -2' && (await ev(`return document.activeElement === $('cmd')`)), await ev(`return $('cmd').value`)) }

/* what can follow, with nothing typed: at every step of a line (draft b shows it after the stretch); a longer list than
   the page has room for goes down with the arrows and the wheel; return does a line that is whole */
await b.press('Escape', 'Escape', 27); await b.press('Escape', 'Escape', 27); await ev(`S.line = { parts: [], done: false }; $('cmd').value = ''; $('cmd').blur(); flush()`); await b.sleep(60)
{ const r = await el('#g-dock [data-a="prompt"][data-k="field"]'); await b.click(r.x, r.y); await b.sleep(150) }
const list = () => ev(`flush(); return S.hint ? S.hint.items.map(x => x.t) : []`)
const shown = () => ev(`flush(); return [...document.querySelectorAll('#g-dock [data-a="hint"]')].length`)
ok('the field pressed, nothing typed: what can begin a line is listed (tracks, and acts)', (await list()).includes('kick') && (await list()).includes('lower'), await list())
{ const n = (await list()).length, fit = await ev('return promptRows()'), seen = await shown()
  ok('…a list longer than the page has room for is not cut: as many rows as fit are shown, and it says how many there are', n > fit && seen === fit && /of \d+/.test(await texts()), [n, fit, seen])
  for (let k = 0; k < fit + 2; k++) await b.press('ArrowDown', 'ArrowDown', 40)
  ok('…the arrows go past the last row shown, and the list follows', await ev(`flush(); return S.hint.at === ${fit + 2} && !!document.querySelector('#g-dock [data-a="hint"][data-i="${fit + 2}"]') && !document.querySelector('#g-dock [data-a="hint"][data-i="0"]')`))
  const L = await ev(`const q = promptListBox(), r = board.getBoundingClientRect(); return { x: r.left + (q.x + 40) * r.width / W, y: r.top + (q.y + 20) * r.height / H }`)
  for (let k = 0; k < 30; k++) await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: L.x, y: L.y, deltaX: 0, deltaY: -60 })
  await b.sleep(100)
  ok('…and the wheel brings it back up', await ev(`flush(); return PROMPT.top === 0 && !!document.querySelector('#g-dock [data-a="hint"][data-i="0"]')`)) }
await b.press('Escape', 'Escape', 27); await ev(`$('cmd').focus(); hintFresh(true)`)
await b.type('kick'); await b.press('Tab', 'Tab', 9); await b.sleep(120)
ok('a track taken: what is on it is listed, every act among it (none left out)', (await list()).filter(w => ['mute', 'unmute', 'solo', 'unsolo', 'delete', 'select'].includes(w)).length === 6, await list())
await b.type('vol'); await b.press('Tab', 'Tab', 9); await b.sleep(120)
ok('a thing taken: where it may be done is listed (the markers), with nothing typed', (await list()).some(w => /^chorus /.test(w)), await list())
await b.type('5~7'); await b.press('Tab', 'Tab', 9); await b.sleep(120)
ok('a stretch taken: an amount to begin from, and the acts — as draft b shows', JSON.stringify((await list()).slice(0, 2)) === JSON.stringify(['3 db', 'lower gradually']) && (await list()).includes('set to'), await list())
await b.press('Tab', 'Tab', 9); await b.sleep(120)
await b.press('ArrowDown', 'ArrowDown', 40); await b.press('ArrowDown', 'ArrowDown', 40); await b.press('Tab', 'Tab', 9); await b.sleep(150)
ok('…the amount taken, then the act', JSON.stringify(await ev(`return S.line.parts.map(p => p.t)`)) === JSON.stringify(['kick', 'volume', '5 ~ 7', '3 db', 'lower']), await ev(`return S.line.parts.map(p => p.t)`))
await b.press('Enter', 'Enter', 13); await b.sleep(200)
ok('…return does the whole line: kick 3 db lower over bars 5 to 7, one step', await ev(`const t = S.tracks.find(x => x.name === 'kick'); return S.line.done && autoPts(t, 'vol').length >= 4 && Math.abs(autoPts(t, 'vol').find(q => Math.abs(q.b - 4) < 1e-6 && q.v < t.vol - 2.9).v - (t.vol - 3)) < 1e-6`), await ev(`return autoPts(S.tracks.find(x => x.name === 'kick'), 'vol').map(q => [q.b, q.v])`))
await ev(`undoEdit(); S.line = { parts: [], done: false }; $('cmd').value = ''; flush()`)

/* another page: the foot has its line again */
{ const t = await el('[data-a="tab-mixer"]'); await b.click(t.x, t.y); await b.sleep(400)
  const fo = await foot()
  ok('another page: the foot has its line again', fo.chevron && Math.abs(fo.top - (await ev('return H - FOOT_H'))) < 1, fo)
  ok('…and every page shows the prompt\'s tab', !!(await el('[data-a="tab-prompt"]')))
  await ev(`rollOpen(); flush()`); await b.sleep(300)
  ok('…the notes page too', !!(await el('[data-a="tab-prompt"]')))
  const p = await el('[data-a="tab-prompt"]'); await b.click(p.x, p.y); await b.sleep(400)
  ok('its tab pressed: the prompt\'s page, with the keys', await ev(`return S.panel.tab === 'prompt' && document.activeElement === $('cmd')`)) }

console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
if (b.errors.length) console.log('page errors:', b.errors.slice(0, 5))
await b.close()
process.exit(bad.length || b.errors.length ? 1 : 0)
