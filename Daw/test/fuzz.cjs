// Edits against the page's own code, run in Node (no browser, no app): see fuzz/load.cjs for how. First the plain cases
// (fuzz/cases.js: what earlier runs found, each with what should be there afterwards), then edits at random — fuzz/edits.js
// and fuzz/group.js say what is done and what is asked of the song after each act.
//
//   node test/fuzz.cjs                 the cases, then 12 seeds of 1500 acts of each kind
//   node test/fuzz.cjs 40 2500         40 seeds of 2500
//   node test/fuzz.cjs 12 1500 edits   one kind only (cases, edits, group)
//   node test/fuzz/load.cjs edits 7 1500 move,trim,tempo      one seed, some of the acts only
//
// Each run is a process of its own (the page keeps its song in one place), a few at a time.
const { spawn } = require('child_process'), path = require('path'), os = require('os')
const seeds = +(process.argv[2] || 12), steps = +(process.argv[3] || 1500), which = process.argv[4] ? [process.argv[4]] : ['cases', 'edits', 'group']
const jobs = which.flatMap(body => body === 'cases' ? [[body, 1]] : Array.from({ length: seeds }, (_, i) => [body, i + 1]).concat(body === 'edits' ? Array.from({ length: Math.ceil(seeds / 4) }, (_, i) => [body, 1001 + i]) : [])), total = jobs.length      // (seeds above a thousand: lanes as an old song can hold them, regions lying on regions)
let bad = 0, done = 0
const next = () => {
  const job = jobs.shift()
  if (!job) return
  const [body, seed] = job
  let out = ''
  const c = spawn(process.execPath, [path.join(__dirname, 'fuzz', 'load.cjs'), body, seed, steps], { stdio: ['ignore', 'pipe', 'pipe'] })
  c.stdout.on('data', d => { out += d }); c.stderr.on('data', d => { out += d })
  c.on('exit', code => {
    done++
    if (code) { bad++; process.stdout.write(out) }
    if (done === total) { console.log(bad ? `${bad} of ${done} runs found something` : `nothing wrong: ${which.join(', ')}${which.some(b => b !== 'cases') ? ` — ${seeds} seeds of ${steps} acts each` : ''}`); process.exitCode = bad ? 1 : 0 }
    next()
  })
}
for (let i = 0; i < Math.max(1, Math.min(6, os.cpus().length - 2)); i++) next()
