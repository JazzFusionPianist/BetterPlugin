// node test/armfollow.mjs — the record arm goes with the chosen track (his ask, 2026-10-24: a take armed a track of notes,
// a new track made and chosen, and the keys sounded on both): a new track of notes chosen takes the one arm, another chosen
// takes it on, an audio track chosen after a track of notes only lets it go; another's r pressed and the one that only went
// with the choice lets go; two pressed by hand stay whatever is chosen and only they hear the keys; one let go, the last
// goes with the choice again; an undo leaves one at most. Real presses on the heads; the arms and who hears the keys read back.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const st = () => ev(`flush(); return { sel: S.tracks[S.sel].name, armed: S.tracks.filter(t => t.arm).map(t => t.name).sort().join(), live: S.tracks.filter(liveOn).map(t => t.name).sort().join() }`)
const press = async (a, name) => {
  const p = await ev(`flush(); const i = S.tracks.findIndex(t => t.name === ${JSON.stringify(name)}), e = document.querySelector('#g-head [data-a="${a}"][data-i="' + i + '"]'); if (!e) return null; const q = e.getBoundingClientRect(); return [q.left + Math.min(30, q.width / 2), q.top + q.height / 2]`)
  if (!p) throw new Error(`no ${a} on ${name}`)
  await b.click(p[0], p[1]); await b.sleep(200)
}
const made = name => ev(`const t = newInstTrack('synth'); t.name = ${JSON.stringify(name)}; flush(); return 1`)
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(false, false); for (const t of S.tracks) t.arm = false; setView(true); dirtyAll(); flush(); return 1`)
await made('synA'); let s = await st()
ok('a new track of notes is chosen and takes the arm; the keys sound there', s.sel === 'synA' && s.armed === 'synA' && s.live === 'synA', s)
await made('synB'); await press('sel', 'synA'); await press('sel', 'synB'); s = await st()
ok('another track of notes chosen: the arm moves there, the keys sound only there', s.sel === 'synB' && s.armed === 'synB' && s.live === 'synB', s)
await press('sel', 'kick'); s = await st()
ok('an audio track chosen after a track of notes: the arm lets go and is not taken (no microphone asked); no keys', s.sel === 'kick' && s.armed === '' && s.live === '', s)
await press('sel', 'synA'); s = await st()
ok('a track of notes chosen again takes it', s.armed === 'synA' && s.live === 'synA', s)
await press('arm', 'synB'); s = await st()
ok('another one\'s r pressed: the one that only went with the choice lets go', s.armed === 'synB' && s.live === 'synB', s)
await press('arm', 'synA'); s = await st()
ok('a second r pressed: both armed, both hear the keys', s.armed === 'synA,synB' && s.live === 'synA,synB', s)
await made('synC'); await press('sel', 'kick'); await press('sel', 'synC'); s = await st()
ok('two by hand stay whatever is chosen; the chosen third is not heard', s.sel === 'synC' && s.armed === 'synA,synB' && s.live === 'synA,synB', s)
await press('arm', 'synA'); s = await st()
ok('one let go by hand: one left', s.armed === 'synB', s)
await press('sel', 'synA'); s = await st()
ok('…which goes with the choice again', s.armed === 'synA' && s.live === 'synA', s)
await ev(`undoEdit(); flush(); return 1`); await b.sleep(200); s = await st()
ok('an undo leaves one arm at most', s.armed.split(',').filter(Boolean).length <= 1, s)
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
