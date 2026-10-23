// node mixlab/logic-mix.mjs [list of .logicx, one a line] [--check] — his faders and pans as he left them, read from his
// own Logic projects: the ground truth hear-mix.mjs is held against (Slur Studio 2's ask, 2026-10-23).
// What a project keeps, as far as it was read here (ProjectData, chunks headed by a four-letter tag written backwards):
//   OCuA (half-word 0 is 6, or 5 in projects saved by an older Logic: the payload is laid out the same): a channel strip; its number at header byte 14 (ch), its own name 40 bytes into the payload
//     (Audio 21, Aux 10, Inst 8 …). In the payload: byte 69 the pan (0…127, 64 the middle: Logic shows −64…+63), bytes
//     72 and 74 where it goes out and where it comes in from (codes, not yet bus numbers: the step between a code and
//     Logic's bus number is not the same in every project), and bytes 96–99 the fader as fixed point 8.24 on Logic's
//     0…127 scale, 90 being 0 db: db = 40·log10(F / 90) (checked against what four of his saved windows show: −0.5,
//     −12.8, −16.0 exact; 127 is +6). Byte 65 holds the same fader rounded to a whole step.
//   ivnE: an object of the environment; a track is one of them, its name (the name he sees) 140 bytes in, its length in
//     the half-word before it, and after it, at the next even byte, the number of the strip it plays through plus one.
//   UCuA of 76 bytes: a send (the strip at header byte 14, its slot at byte 18, 0 the first), learnt from a project he
//     made for it (send 1 to bus 1 at −6, send 2 to bus 2 at −12 pre, pan left 30; ~/Downloads/send test): from header
//     byte 52, byte 0 on, byte 1 the level rounded, 4–7 where it goes (a code: the step from it to the aux that hears it
//     is not the same in every project), 8–11 the level as the fader's (8.24, same law), byte 12 its pan.
// Not read yet: whether a send is pre or post, which aux a send or an output reaches (only codes), automation (a strip in
// Read keeps here the level it is parked at, not what the automation plays), whether a strip is muted.
// Nothing is ever written to a project; one kept only in the cloud is fetched by reading it.
// Out: mixlab/out/logic-mix.json (every project), and for each song of mixlab/out/<song>.json that a project is found
// for, mixlab/out/<song>.logic.json { song, logic: { path, alternative, saved }, tracks: [{ name, strip, ch, kind,
// fader, pan, out, in, sends: [{ slot, level, pan, on, to }] }] } beside it — Slur Studio 2's own file is left as it is. mixlab/out is not kept in git.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url)), OUT = join(here, 'out')
mkdirSync(OUT, { recursive: true })

const db = F => F > 0 ? Math.round(40 * Math.log10(F / 90) * 100) / 100 : null                          // (Logic's fader law; 0 is −∞)
const KIND = [[/^Audio /, 'audio'], [/^Inst /, 'inst'], [/^Aux /, 'aux'], [/^Output/, 'out'], [/^Master/, 'master'], [/^Input/, 'input']]
const kindOf = s => (KIND.find(([re]) => re.test(s)) || [null, 'other'])[1]
/* objects of every project's environment that are not tracks */
const SYSTEM = new Set(['Not Assigned', 'No Output', 'MIDI Click', '(Folder)', 'Sequencer Input', 'Physical Input', 'Input View', 'Input Notes', 'Preview', 'Click'])
const OUTS = new Set(['Stereo Out', 'Master'])                                                          // (the strips every track ends in: kept apart)

function readProject (file) {
  const d = readFileSync(file), strips = new Map(), tracks = [], named = []
  for (let a = d.indexOf('OCuA'); a >= 0; a = d.indexOf('OCuA', a + 4)) {
    if (a + 56 > d.length || ![5, 6].includes(d.readUInt16LE(a + 4))) continue
    const len = d.readUInt32LE(a + 28)
    if (len < 100 || a + 56 + len > d.length) continue
    const p = d.subarray(a + 56, a + 56 + len), ch = d.readUInt16LE(a + 14)
    if (strips.has(ch)) continue
    const m = /[\x20-\x7e]{1,60}/.exec(p.toString('latin1', 40, 100)), name = m ? m[0].trim() : ''
    const F = p.readUInt32LE(96) / 2 ** 24, pan = p[69] - 64
    strips.set(ch, { ch, strip: name, kind: kindOf(name), fader: db(F), F: Math.round(F * 1e4) / 1e4, pan, out: p.readUInt16LE(72), in: p.readUInt16LE(74) })
  }
  for (let a = d.indexOf('UCuA'); a >= 0; a = d.indexOf('UCuA', a + 4)) {                                 // the sends
    if (a + 128 > d.length || d.readUInt16LE(a + 4) !== 4 || d.readUInt32LE(a + 28) !== 76) continue
    const s = strips.get(d.readUInt16LE(a + 14)), q = d.subarray(a + 52, a + 128), F = q.readUInt32LE(8) / 2 ** 24
    if (!s || q[0] > 1 || F > 128) continue
    ;(s.sends = s.sends || []).push({ slot: d.readUInt16LE(a + 18) + 1, level: db(F), pan: q[12] - 64, on: q[0] === 1, to: q.readUInt32LE(4) })
  }
  for (const s of strips.values()) if (s.sends) s.sends.sort((x, y) => x.slot - y.slot)
  for (let a = d.indexOf('ivnE'); a >= 0; a = d.indexOf('ivnE', a + 4)) {
    const len = d.readUInt32LE(a + 28)
    if (len < 160 || len > 1e6 || a + 56 + len > d.length) continue
    const p = d.subarray(a + 56, a + 56 + len), nl = p.readUInt16LE(138)
    if (!nl || nl > 120 || 142 + nl > p.length) continue
    const name = p.toString('utf8', 140, 140 + nl).replace(/[\x00-\x1f]+$/, '').trim(), num = p.readUInt16LE(140 + nl + (nl & 1))
    if (!name || SYSTEM.has(name) || !num || !strips.has(num - 1)) continue
    ;(OUTS.has(name) ? named : tracks).push({ name, ...strips.get(num - 1) })
  }
  /* the strips no track plays through but that still shape the mix: the outs, and a strip set away from its rest */
  const used = new Set(tracks.concat(named).map(t => t.ch))
  const rest = [...strips.values()].filter(s => !used.has(s.ch) && (s.kind === 'master' || s.kind === 'out' && s.fader !== 0))      // (an output's pan is only which side of its pair it is))
  return { tracks, outs: named.concat(rest.map(s => ({ name: s.strip, ...s }))) }
}

/* the newest of a project's alternatives */
function projectData (logicx) {
  const alt = join(logicx, 'Alternatives')
  if (!existsSync(alt)) return null
  const all = readdirSync(alt).map(x => ({ alt: x, f: join(alt, x, 'ProjectData') })).filter(x => existsSync(x.f))
  return all.sort((a, b) => statSync(b.f).mtimeMs - statSync(a.f).mtimeMs)[0] || null
}

/* --check: the values his saved windows showed (Alternatives/000/WindowImage.jpg), read back: [{ p: project, track,
   fader, pan?, sends? }], kept in out/checks.json (out is not in git: the projects are named for his clients' songs) */
const CHECKS = (() => { try { return JSON.parse(readFileSync(join(OUT, 'checks.json'), 'utf8')) } catch { return [] } })()

const args = process.argv.slice(2), check = args.includes('--check'), listFile = args.find(a => !a.startsWith('--'))

/* --bounce: the projects he copies whole, each with its final bounce, into /Volumes/창고/10s Rough Mix Project
   (indexed by projects.mjs into out/projects.json): read as they were saved nearest the bounce — before it if a save is
   kept from before, else after it — not as they stand now (most were saved again days or months later). Out:
   out/rough/<folder>.logic.json, with what moved between that save and the project as it stands. */
/* one project of the index read at its save nearest the bounce, and what moved after it */
function bounceRead (pr) {
  const L = pr.logic || {}, at = L.beforeBounce ? 'beforeBounce' : L.afterBounce ? 'afterBounce' : 'current', src = at === 'current' ? L : L[at]
  if (!src || !src.data || !existsSync(src.data)) return null
  const r = readProject(src.data), now = L.data && L.data !== src.data && existsSync(L.data) ? readProject(L.data) : null
  const moved = now ? r.tracks.filter(t => { const n = now.tracks.find(x => x.name === t.name && x.ch === t.ch); return n && (n.fader !== t.fader || n.pan !== t.pan) }).length : null
  const gapDays = pr.mix && pr.mix.made && src.saved ? Math.round(Math.abs(Date.parse(src.saved) - Date.parse(pr.mix.made)) / 864e5 * 10) / 10 : null      // (how far the save read lies from the bounce: a save long after it may not be what was heard)
  return { folder: pr.folder, song: pr.song || null, mix: pr.mix && pr.mix.file, logic: { path: L.project, read: src.data, at, saved: src.saved, gapDays }, movedSince: moved, tracks: r.tracks, outs: r.outs }
}
/* a rough file is named for its folder; two folders of one name (an EP's "intro" beside another's) take their song's name too */
const roughFile = (folder, song) => { const same = index().filter(x => x.folder === folder).length > 1; return (same && song ? `${folder} (${song})` : folder).replace(/[:/]/g, '-') + '.logic.json' }
const index = () => existsSync(join(OUT, 'projects.json')) ? JSON.parse(readFileSync(join(OUT, 'projects.json'), 'utf8')).projects || [] : []
if (args.includes('--bounce')) {
  const dir = join(OUT, 'rough')
  mkdirSync(dir, { recursive: true })
  for (const pr of index()) {
    const b = bounceRead(pr)
    if (!b) { console.log(`  ${pr.folder}: no ProjectData`); continue }
    writeFileSync(join(dir, roughFile(pr.folder, pr.song)), JSON.stringify(b, null, 1))
    console.log(`  ${pr.folder}: ${b.logic.at} (${b.logic.saved}), ${b.tracks.length} tracks, ${b.tracks.filter(t => t.fader !== 0).length} faders moved, ${b.movedSince != null ? b.movedSince + ' changed since' : ''}`)
  }
  process.exit(0)
}

/* where the projects are: Spotlight, and every drive plugged in walked as well — Spotlight has no index of his 창고 for a
   while after it is plugged in again, and even then it once knew 246 of its 452 */
const walked = () => readdirSync('/Volumes').filter(v => v !== 'Macintosh HD').flatMap(v => {
  try {
    return execFileSync('find', [join('/Volumes', v), '-maxdepth', '7', '(', '-name', '*.logicx', '-prune', '-print', ')', '-o', '(', '-type', 'd', '(', '-name', 'Audio Files', '-o', '-name', 'Samples', '-o', '-name', 'Bounces', ')', '-prune', ')'], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')
  } catch (e) { return (e.stdout || '').split('\n') }                                                       // (a folder it may not enter is passed by)
})
const list = [...new Set((listFile ? readFileSync(listFile, 'utf8').split('\n') : execFileSync('mdfind', ["kMDItemFSName == '*.logicx'"], { encoding: 'utf8', maxBuffer: 1 << 24 }).split('\n').concat(check ? [] : walked()))
  .map(s => s.trim()))].filter(s => s.endsWith('.logicx') && !basename(s).startsWith('._') && !/\/Library\/(Application Support|Caches)\/|\.Trash|Project File Backups/.test(s))
  .filter(s => check ? CHECKS.some(c => basename(s) === c.p) : basename(s) !== 'send test.logicx')      // (the project he made to learn the sends by is not a mix)

const projects = []
for (const path of list) {
  const pd = projectData(path)
  if (!pd) continue
  try {
    const r = readProject(pd.f)
    projects.push({ project: basename(path, '.logicx'), path, alternative: pd.alt, saved: statSync(pd.f).mtime.toISOString(), ...r })
    console.log(`${String(projects.length).padStart(3)} ${basename(path)}: ${r.tracks.length} tracks, ${r.tracks.filter(t => t.fader !== 0).length} faders moved, ${r.tracks.filter(t => t.pan).length} panned`)
  } catch (e) { console.log('  could not read', basename(path), e.message) }
}

if (check) {
  let bad = 0
  for (const c of CHECKS) {
    const pr = projects.find(x => basename(x.path) === c.p), t = pr && pr.tracks.find(x => x.name === c.track)
    const sends = t && (t.sends || []).map(x => x.level)
    const ok = t && Math.abs(t.fader - c.fader) < .05 && (c.pan == null || t.pan === c.pan) && (!c.sends || c.sends.length === sends.length && c.sends.every((v, i) => Math.abs(v - sends[i]) < .05))
    if (!ok) bad++
    console.log(ok ? 'ok  ' : 'BAD ', c.p, c.track, 'set', c.fader, c.pan != null ? 'pan ' + c.pan : '', c.sends ? 'sends ' + c.sends.join(' ') : '', '| read', t ? t.fader : '(not found)', t && c.pan != null ? 'pan ' + t.pan : '', c.sends && t ? 'sends ' + sends.join(' ') : '')
  }
  process.exit(bad ? 1 : 0)
}

/* a project on a drive that is not there now (his 창고 comes and goes) keeps what was read of it last time */
const last = existsSync(join(OUT, 'logic-mix.json')) ? JSON.parse(readFileSync(join(OUT, 'logic-mix.json'), 'utf8')).projects || [] : []
const away = last.filter(pr => !projects.some(x => x.path === pr.path) && !existsSync(pr.path) && /^\/Volumes\//.test(pr.path))
if (away.length) console.log(`  ${away.length} projects on a drive not here now: kept as last read`)
projects.push(...away.map(pr => Object.assign(pr, { away: true })))
writeFileSync(join(OUT, 'logic-mix.json'), JSON.stringify({ made: new Date().toISOString(), law: 'db = 40*log10(F/90)', projects }, null, 1))

/* the songs Slur Studio 2 hears: each to the project its mix came from — the newest one whose name holds the song's
   title and says MIX (a live or teaser version is not the record, unless the title itself says so: GO LIVE). A project
   he copied whole beside its bounce (out/projects.json) is read at its save nearest the bounce, as in out/rough — one
   truth for one song. */
const norm = s => s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const idx = index(), samePath = (x, y) => !!x && !!y && x.normalize('NFC') === y.normalize('NFC')      // (a path found by walking the drive comes in Unicode's decomposed form, the index's in the composed one)
const songs = readdirSync(OUT).filter(f => /^[^,]+, .+\.json$/.test(f) && !/\.(logic|test)\.json$/.test(f)).map(f => f.replace(/\.json$/, ''))      // (a song's file is named "artist, title")
for (const song of songs) {
  const title = norm(song.split(',').slice(1).join(',') || song), not = ['live', 'teaser', 'length', 'stem'].filter(w => !title.split(' ').includes(w))
  const hits = projects.filter(pr => norm(pr.project).includes(title) && !not.some(w => new RegExp(`\\b${w}\\b`, 'i').test(norm(pr.path))))
  const pick = hits.sort((a, b) => idx.some(x => x.logic && samePath(x.logic.project, b.path)) - idx.some(x => x.logic && samePath(x.logic.project, a.path)) || /mix/i.test(b.project) - /mix/i.test(a.project) || b.saved.localeCompare(a.saved))[0]
  if (!pick) { console.log(`  ${song}: no project found`); continue }
  const whole = idx.find(x => x.logic && samePath(x.logic.project, pick.path)), b = whole && bounceRead(whole)
  const out = b ? { song, logic: b.logic, rough: join('rough', roughFile(whole.folder, whole.song)), movedSince: b.movedSince, tracks: b.tracks, outs: b.outs }
    : { song, logic: { path: pick.path, alternative: pick.alternative, saved: pick.saved, at: 'current' }, tracks: pick.tracks, outs: pick.outs }
  writeFileSync(join(OUT, `${song}.logic.json`), JSON.stringify(out, null, 1))
  console.log(`  ${song}: ${pick.path.replace(/^.*\//, '')}${b ? ' (' + b.logic.at + ', ' + b.logic.gapDays + ' days from the bounce)' : ''}`)
}
