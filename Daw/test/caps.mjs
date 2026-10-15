// node test/caps.mjs — a name is kept as it is typed, capitals and all: a track's, a marker's, a region's (and drawn so);
// what is not a name (the tempo, the key) is read as before. Real keys in the box.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const typeIn = async (what, i, text) => {
  await ev(`if (typeof START !== 'undefined') START.on = false; ${what === 'region' ? `S.selR = [S.tracks[0].regs[0].id];` : ''} startRename(${JSON.stringify(what)}, ${i})`); await b.sleep(80)
  await b.press('a', 'KeyA', 65, 4); await b.type(text); await b.press('Enter', 'Enter', 13); await b.sleep(120)
}
const drawn = s => ev(`flush(); return [...document.querySelectorAll('#board text')].some(e => e.textContent.includes(${JSON.stringify(s)}))`)

await ev(`setView(true); dirtyAll(); flush()`)
await typeIn('track', 0, 'Kick Drum')
ok('a track named with capitals keeps them, and its head shows them', (await ev(`return S.tracks[0].name`)) === 'Kick Drum' && await drawn('Kick Drum'), await ev(`return S.tracks[0].name`))
await typeIn('scene', 1, 'Verse A')
ok('a marker too', (await ev(`return SCENES[1].name`)) === 'Verse A' && await drawn('Verse A'), await ev(`return SCENES[1].name`))
await typeIn('region', 0, 'Take 2B')
ok('a region too', (await ev(`return S.tracks[0].regs[0].tag`)) === 'Take 2B', await ev(`return S.tracks[0].regs[0].tag`))
await typeIn('key', 0, 'F#m')
ok('the key is read as before (lowercase)', (await ev(`return S.key`)) === 'f#m', await ev(`return S.key`))
await typeIn('tempo', 0, '120')
ok('the tempo too', (await ev(`return S.tempo`)) === 120, await ev(`return S.tempo`))
await ev(`undoEdit()`)

console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
if (b.errors.length) console.log('page errors:', b.errors.slice(0, 5))
await b.close()
process.exit(bad.length || b.errors.length ? 1 : 0)
