// node test/doors.mjs — going out: when the song is not as it was last saved, closing asks first (save, don't save,
// cancel); where one stands in the song is not a change; while the question is up nothing else takes keys or the pointer.
// (No app here: what would be said to it is noted instead. The app's own check does it with the real file.)
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const at = sel => ev(`flush(); const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el }`)
const st = () => ev(`flush(); return { up: !!S.leave, busy: S.leave && S.leave.busy, hold: PROJ.hold, sent: LEAVE.sent.slice(), text: document.getElementById('g-leave').textContent, changed: leaveChanged() }`)

await ev(`setView(true); keepNow('opened'); LEAVE.sent.length = 0; dirtyAll(); flush()`)
ok('as it was opened: nothing to ask about', (await st()).changed === false)
await ev(`leadTrack(2); setZoom(PXB * 1.5, 4); S.cycle.on = !S.cycle.on; S.snap = !S.snap; dirtyAll(); flush()`)
ok('another track chosen, the view nearer, the cycle and the grid turned: still nothing to ask about', (await st()).changed === false)
await ev(`edit(() => { S.tracks[0].regs[0].gain = -3 }); flush()`)
ok('a region made quieter: the song is not as it was saved', (await st()).changed === true)
const hold0 = (await st()).hold
await ev(`leaveAsk(); flush()`)
{ const s = await st()
  ok('asked: the question is up, names the project, and says since when', s.up && s.text.includes('save') && s.text.includes('before closing') && s.text.includes('not saved since it was opened'), s.text)
  ok('the app is told to wait, and nothing is written quietly meanwhile', s.sent.join() === 'quitWait' && s.hold === hold0 + 1, [s.sent, s.hold]) }
// nothing else hears keys or the pointer
{ const auto0 = await ev('return S.auto'), sel0 = await ev('return JSON.stringify(S.selR)')
  await b.press('a', 'KeyA', 65); await b.sleep(40)
  await b.click(700, 200); await b.sleep(40)
  ok('while it is up a key of the room does nothing, and a press on the lanes chooses nothing', (await ev('return S.auto')) === auto0 && (await ev('return JSON.stringify(S.selR)')) === sel0 && (await st()).up) }
await b.press('Escape', 'Escape', 27); await b.sleep(60)
{ const s = await st(); ok('escape: it goes, the app stays, the quiet writing goes on', !s.up && s.hold === hold0 && s.sent.join() === 'quitWait' && s.text === '', [s.up, s.hold, s.sent]) }
// don't save
await ev(`LEAVE.sent.length = 0; leaveAsk(); flush()`)
{ const p = await at('[data-a="leave"][data-k="dont"]'); ok('its three keys can be reached', !!p && p.hit && (await at('[data-a="leave"][data-k="cancel"]')).hit && (await at('[data-a="leave"][data-k="save"]')).hit)
  await b.click(p.x, p.y); await b.sleep(80)
  const s = await st(); ok('don\'t save: the file is put back as it was last saved (what was written since is put aside), then the app closes', s.sent.join() === 'quitWait,projSave,quit', s.sent) }
await ev(`S.leave = null; PROJ.hold = ${hold0}; LEAVE.sent.length = 0; uiDirty('leave'); flush(); leaveAsk(); flush()`)
await b.press('d', 'KeyD', 68); await b.sleep(80)
ok('d does the same', (await st()).sent.join() === 'quitWait,projSave,quit', (await st()).sent)
// save
await ev(`S.leave = null; PROJ.hold = ${hold0}; LEAVE.sent.length = 0; uiDirty('leave'); flush(); leaveAsk(); flush()`)
await b.press('Enter', 'Enter', 13); await b.sleep(80)
ok('return saves and closes', (await st()).sent.join() === 'quitWait,quit', (await st()).sent)
await ev(`S.leave = null; PROJ.hold = ${hold0}; LEAVE.sent.length = 0; uiDirty('leave'); flush(); leaveAsk(); flush()`)
{ const p = await at('[data-a="leave"][data-k="cancel"]'); await b.click(p.x, p.y); await b.sleep(60); const s = await st(); ok('cancel: it goes, nothing is said to the app but to wait', !s.up && s.sent.join() === 'quitWait' && s.hold === hold0, [s.sent, s.hold]) }
// asked twice
await ev(`LEAVE.sent.length = 0; leaveAsk(); flush(); quitAsked(); flush()`)
ok('asked again while it is up: it stays, the app waits', (await st()).up && (await st()).sent.join() === 'quitWait,quitWait', (await st()).sent)
await ev(`leaveAnswer('cancel'); flush()`)
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
