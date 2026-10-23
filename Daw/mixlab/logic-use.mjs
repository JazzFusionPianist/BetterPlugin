// node mixlab/logic-use.mjs [list of .logicx, one a line] — which plug-ins he reaches for, read from his own Logic projects.
// His ask (2026-10-23): the rough mix uses outside plug-ins without holding back, the ones he uses most first; so what
// each is for, and where he puts it, must be known before a mix is made. Logic keeps a project in ProjectData, chunks
// each headed #G… with a four-letter tag written backwards: OCuA is a channel strip (its name after the header), UCuA one
// thing on a strip — an audio unit (its name, then its maker, kind and subtype, each four letters backwards, then its
// state as a plist) or one of Logic's own (its name 100 bytes in: Channel EQ, Gain…). A UCuA's header says which strip
// (the sixth half-word) and which place on it (the eighth: 2 is the first; 12 and 13 are the strip's own settings).
// Nothing is ever written to a project; a project kept only in the cloud is fetched by reading it, so the list is his.
// Out: mixlab/out/plugin-use.json (projects, strips, plug-ins in order) and a summary on the terminal. mixlab/out is
// not kept in git: it holds his clients' song and track names.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url)), OUT = join(here, 'out')
mkdirSync(OUT, { recursive: true })

/* the audio units of this Mac, by their codes: "aufx FqEh oDin  -  Valhalla DSP, LLC: ValhallaFreqEcho" */
const AU = new Map()
for (const l of execFileSync('auval', ['-a'], { encoding: 'utf8', maxBuffer: 1 << 24, stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')) {
  const m = /^(au\w\w) (.{4}) (.{4})\s+-\s+(.*)$/.exec(l)
  if (m) AU.set(`${m[1]}/${m[2]}/${m[3]}`, m[4].trim())
}

/* what a strip is, by the words of its name: the room's own reading (ui/tidy.js), run here as it runs in the page */
const tidy = (() => {
  try {
    const ctx = { console }; vm.createContext(ctx)
    vm.runInContext(readFileSync(join(here, '..', 'ui', 'tidy.js'), 'utf8').split('/* ── by sound: YAMNet, in a worker ── */')[0] + '\nthis.tidyByWords = tidyByWords; this.TIDY_FAM = TIDY_FAM', ctx)
    return { what: s => ctx.tidyByWords(s), fam: s => ctx.TIDY_FAM(s) }
  } catch (e) { console.log('(tidy.js not read: ' + e.message + ')'); return { what: () => null, fam: () => null } }
})()

const rev = b => Buffer.from(b).reverse().toString('latin1')
const printable = (buf, from, min = 2) => { let i = from; while (i < buf.length && buf[i] >= 32 && buf[i] < 127) i++; return i - from >= min ? buf.toString('latin1', from, i) : '' }

function readProject (file) {
  const d = readFileSync(file), strips = new Map(), things = []
  for (let a = d.indexOf('OCuA'); a >= 0; a = d.indexOf('OCuA', a + 4)) {
    if (a + 56 > d.length || d.readUInt16LE(a + 4) !== 6) continue
    const ch = d.readUInt16LE(a + 14), m = /[\x20-\x7e]{2,60}/.exec(d.toString('latin1', a + 56, a + 140))
    if (!strips.has(ch)) strips.set(ch, m ? m[0].trim() : '')
  }
  for (let a = d.indexOf('UCuA'); a >= 0; a = d.indexOf('UCuA', a + 4)) {
    if (a + 56 > d.length || d.readUInt16LE(a + 4) !== 4) continue
    const ch = d.readUInt16LE(a + 14), place = d.readUInt16LE(a + 18), len = d.readUInt32LE(a + 28)
    if (place === 12 || place === 13 || len < 8 || len > 50e6) continue
    const p = d.subarray(a + 56, a + 56 + len)
    if (p.subarray(0, 8).toString('latin1') === 'bplist00') continue
    const head = p.subarray(0, Math.min(p.length, 600)), t = head.toString('latin1').search(/xfua|umua|fmua|imua/)
    if (t >= 4) {                                                                                   // an audio unit
      const type = rev(head.subarray(t, t + 4)), sub = rev(head.subarray(t + 4, t + 8)), maker = rev(head.subarray(t - 4, t))
      let n = t - 4; while (n > 0 && head[n - 1] === 0) n--; let s = n; while (s > 0 && head[s - 1] >= 32 && head[s - 1] < 127) s--
      const key = `${type}/${sub}/${maker}`
      things.push({ ch, place, au: key, name: AU.get(key) || head.toString('latin1', s, n), here: AU.has(key), inst: type === 'aumu' })
    } else {                                                                                        // one of Logic's own
      const nm = printable(p, 100)
      if (nm && /^[A-Z]/.test(nm)) things.push({ ch, place, name: 'Logic: ' + nm, logic: true })
    }
  }
  const out = []
  for (const [ch, name] of strips) {
    const on = things.filter(x => x.ch === ch).sort((a, b) => a.place - b.place)
    if (!on.length) continue
    const what = tidy.what(name)
    out.push({ ch, name, what, fam: what ? tidy.fam(what) : null, kind: /^aux/i.test(name) ? 'aux' : /^(output|stereo out|master)/i.test(name) ? 'out' : on.some(x => x.inst) ? 'inst' : 'audio', chain: on.map(x => ({ place: x.place, name: x.name, au: x.au || null, logic: !!x.logic, inst: !!x.inst })) })
  }
  return out
}

/* the newest of a project's alternatives (looked at without fetching: a size and a date are known in the cloud too) */
function projectData (logicx) {
  const alt = join(logicx, 'Alternatives')
  if (!existsSync(alt)) return null
  const all = readdirSync(alt).map(x => join(alt, x, 'ProjectData')).filter(existsSync)
  return all.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || null
}

const list = (process.argv[2] ? readFileSync(process.argv[2], 'utf8') : execFileSync('mdfind', ["kMDItemFSName == '*.logicx'"], { encoding: 'utf8' }))
  .split('\n').map(s => s.trim()).filter(s => s.endsWith('.logicx') && !/\/Library\/(Application Support|Caches)\/|\.Trash/.test(s))
const projects = []
for (const p of list) {
  const f = projectData(p)
  if (!f) continue
  const t0 = Date.now()
  try { const strips = readProject(f); projects.push({ project: basename(p, '.logicx'), path: p, strips }); console.log(`${String(projects.length).padStart(3)} ${basename(p)}: ${strips.length} strips, ${strips.reduce((s, x) => s + x.chain.length, 0)} plug-ins (${Date.now() - t0} ms)`) }
  catch (e) { console.log('  could not read', basename(p), e.message) }
}
writeFileSync(join(OUT, 'plugin-use.json'), JSON.stringify({ made: new Date().toISOString(), projects }, null, 1))

/* the summary: most used, then by what the strip is, then what tends to follow what */
const count = new Map(), byFam = new Map(), first = new Map(), pairs = new Map()
const add = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n)
for (const pr of projects) for (const s of pr.strips) {
  const ins = s.chain.filter(x => !x.inst)
  ins.forEach((x, i) => { add(count, x.name); add(byFam, `${s.kind === 'aux' ? 'aux' : s.kind === 'out' ? 'out' : s.fam || '?'}  ${x.name}`); if (!i) add(first, x.name); if (i) add(pairs, `${ins[i - 1].name}  →  ${x.name}`) })
}
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n)
console.log(`\n${projects.length} projects read\n\nmost used:`); for (const [k, v] of top(count, 40)) console.log(String(v).padStart(5), k)
console.log('\nby what the strip is:'); for (const [k, v] of top(byFam, 50)) console.log(String(v).padStart(5), k)
console.log('\nfirst on a strip:'); for (const [k, v] of top(first, 15)) console.log(String(v).padStart(5), k)
console.log('\none after another:'); for (const [k, v] of top(pairs, 25)) console.log(String(v).padStart(5), k)
