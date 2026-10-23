// The trained ear of Tidy Tracks (ui/tidy.js: tidyEar, tidyWhatBySound) — how its numbers, ui/tidy-ear.json, are made.
// His ask (2026-10-23): the ear should learn — from his own projects, the tracks named for what they are, and the ones it
// is not sure of, which he tells by ear on a listening page. Apple Loops are only ever used to measure it. Nothing of what
// it learns from goes anywhere but its numbers (no names, no sound).
//
//   node tools/tidy-ear.mjs hear <list.json> <out.json>     list: [{ id, path }] → what the ear hears of each file (the
//        app's own yamnet.js and tidy.js, on its loudest stretches, 16 kHz mono through afconvert): YAMNet's scores and
//        the six measures. Read only: a file is decoded into the temporary folder and that copy taken away at once.
//   node tools/tidy-ear.mjs train <rows.json> [out]          rows: [{ f: (one of hear's), truth: family }] → the ear
//        (a softmax over the families, classes weighed equally), written to out (ui/tidy-ear.json)
//   node tools/tidy-ear.mjs judge <rows.json> [ear]          how often it is right, family by family, and what it takes for what
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import os from 'node:os'
const here = dirname(fileURLToPath(import.meta.url)), UI = join(here, '..', 'ui')
export const FAMILIES = ['drums', 'bass', 'guitars', 'keys', 'synths', 'strings', 'horns', 'vox', 'fx']
export const KINDS = ['Music', 'Musical instrument', 'Synthesizer', 'Electronic music', 'Sampler', 'Keyboard (musical)', 'Piano', 'Electric piano', 'Organ', 'Drum', 'Drum kit', 'Drum machine', 'Percussion', 'Snare drum', 'Bass drum', 'Hi-hat', 'Cymbal', 'Bass guitar', 'Guitar', 'Electric guitar', 'Acoustic guitar', 'Plucked string instrument', 'Bowed string instrument', 'Violin, fiddle', 'Cello', 'String section', 'Orchestra', 'Brass instrument', 'Trumpet', 'Saxophone', 'Wind instrument, woodwind instrument', 'Flute', 'Singing', 'Speech', 'Choir', 'Sound effect', 'Whoosh, swoosh, swish', 'Noise', 'Theremin', 'Beep, bleep', 'Electronic dance music', 'Techno', 'Dubstep', 'Hip hop music', 'Distortion', 'Effects unit', 'Rattle', 'Clapping', 'Tapping (guitar technique)', 'Strum', 'Harp', 'Marimba, xylophone', 'Vibraphone', 'Glockenspiel', 'Bell', 'Chime']

/* the app's own code, run as it is */
export function app () {
  const ctx = { console, Math, Object, Array, Number, JSON, Float32Array, Float64Array, Uint8Array, Int8Array, Int16Array, DataView, TextDecoder, Map, Set, Promise, atob, performance, KEEP_T: [], T_KEEP: [], runCommand: async () => {}, sayKeys: () => new Set(), say () {}, S: { tracks: [] }, NAT: null }
  vm.createContext(ctx)
  vm.runInContext(readFileSync(join(UI, 'yamnet.js'), 'utf8'), ctx)
  vm.runInContext(readFileSync(join(UI, 'tidy.js'), 'utf8').replace(/^\{\n  const rc0 = runCommand[\s\S]*$/m, '') + '\n;globalThis.__t = { tidyLow, tidyHigh, tidyStruck, tidyCrest, tidyPitch, tidyFlat, tidyLoudest, tidyEar, tidyWhatBySound, TIDY_SEC, TIDY_PARTS }', ctx)
  return { ctx, T: ctx.__t, classes: JSON.parse(readFileSync(join(UI, 'yamnet', 'classes.json'), 'utf8')) }
}
const readWav = p => {
  const b = readFileSync(p)
  let o = 12, sr = 16000, data = null
  while (o + 8 <= b.length) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'fmt ') sr = b.readUInt32LE(o + 12); if (id === 'data') { data = b.subarray(o + 8, o + 8 + n); break } o += 8 + n + (n & 1) }
  const a = new Float32Array(data.length >> 1); for (let i = 0; i < a.length; i++) a[i] = data.readInt16LE(2 * i) / 32768
  return { a, sr }
}
/* what the ear hears of one file: as tidySound takes it in the app (its loudest stretches of TIDY_SEC, the louder ones) */
function hearOne ({ ctx, T, classes }, M, path, tmp) {
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', path, tmp], { stdio: 'pipe' })
  const { a, sr } = readWav(tmp); unlinkSync(tmp)
  const hop = Math.round(sr / 1000), n = Math.ceil(a.length / hop), lv = new Uint8Array(n).fill(255)
  for (let f = 0; f < n; f++) { let m = 0; for (let i = f * hop; i < Math.min(a.length, (f + 1) * hop); i++) m = Math.max(m, Math.abs(a[i])); if (m > 0) lv[f] = Math.min(255, Math.floor(-40 * Math.log10(m))) }
  const starts = T.tidyLoudest({ hop: hop / sr, lv }, a.length / sr), step = Math.round(T.TIDY_SEC * sr), parts = []
  for (const st of starts.length ? starts : [0]) { const i0 = Math.round(st * sr), p = a.slice(i0, i0 + step); if (p.length < sr * .5) continue; let q = 0; for (const v of p) q += v * v; parts.push({ p, rms: Math.sqrt(q / p.length) }) }
  const loud = parts.filter(x => x.rms > 1e-3).sort((x, y) => y.rms - x.rms).slice(0, T.TIDY_PARTS).map(x => x.p)
  if (!loud.length) return { empty: true }
  const sc = new Float32Array(classes.length); let pc = 0
  for (const p of loud) { const r = ctx.yamScores(M, p); for (const s of r.pieces) { for (let i = 0; i < sc.length; i++) sc[i] += s[i]; pc++ } }
  for (let i = 0; i < sc.length; i++) sc[i] /= Math.max(1, pc)
  return { scores: Array.from(sc, v => +v.toFixed(5)), low: T.tidyLow(loud), high: T.tidyHigh(loud), struck: T.tidyStruck(loud), crest: T.tidyCrest(loud), pitch: T.tidyPitch(loud), flat: T.tidyFlat(loud), at: starts[0] || 0 }
}
const vec = (f, idx) => KINDS.map(k => Math.log(1e-4 + (f.scores[idx.get(k)] || 0))).concat([f.pitch, Math.log(1e-4 + f.flat), f.low, f.high, Math.min(6, f.struck), f.crest / 10])
export function train (rows, classes, lam = 3e-3, iters = 1500, lr = .5) {
  const idx = new Map(classes.map((c, i) => [c, i])), X = rows.map(r => vec(r.f, idx)), Y = rows.map(r => FAMILIES.indexOf(r.truth)), d = X[0].length, K = FAMILIES.length
  const mu = Array(d).fill(0), sd = Array(d).fill(0)
  for (const x of X) x.forEach((v, j) => { mu[j] += v / X.length })
  for (const x of X) x.forEach((v, j) => { sd[j] += (v - mu[j]) ** 2 / X.length })
  for (let j = 0; j < d; j++) sd[j] = Math.sqrt(sd[j]) || 1
  const Z = X.map(x => x.map((v, j) => (v - mu[j]) / sd[j])), cnt = Array(K).fill(0); Y.forEach(y => cnt[y]++)
  const wt = Y.map(y => rows.length / (K * Math.max(1, cnt[y]))), W = Array.from({ length: K }, () => Array(d + 1).fill(0))
  for (let it = 0; it < iters; it++) {
    const G = Array.from({ length: K }, () => Array(d + 1).fill(0))
    Z.forEach((z, n) => { const s = W.map(w => w[d] + z.reduce((a, v, j) => a + v * w[j], 0)), m = Math.max(...s), e = s.map(v => Math.exp(v - m)), t = e.reduce((a, b) => a + b, 0); for (let k = 0; k < K; k++) { const g = (e[k] / t - (Y[n] === k ? 1 : 0)) * wt[n]; for (let j = 0; j < d; j++) G[k][j] += g * z[j]; G[k][d] += g } })
    for (let k = 0; k < K; k++) for (let j = 0; j <= d; j++) W[k][j] -= lr * (G[k][j] / Z.length + (j < d ? lam * W[k][j] : 0))
  }
  const r = v => +v.toFixed(5)
  return { stacks: FAMILIES, kinds: KINDS, d, mu: mu.map(r), sd: sd.map(r), W: W.map(w => w.map(r)), n: rows.length, made: new Date().toISOString().slice(0, 10) }
}
if (isMainThread && process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a1, a2] = process.argv.slice(2)
  if (cmd === 'hear') {
    const list = JSON.parse(readFileSync(a1, 'utf8')), K = Math.max(1, os.cpus().length - 2), out = []
    await Promise.all(Array.from({ length: K }, (_, w) => new Promise((res, rej) => { const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { w, jobs: list.filter((_, i) => i % K === w) } }); wk.on('message', m => { out.push(...m); res() }); wk.on('error', rej) })))
    writeFileSync(a2, JSON.stringify(out)); console.log(`${out.length} heard, ${out.filter(x => x.empty).length} silent, ${out.filter(x => x.bad).length} unreadable`)
  } else if (cmd === 'train') {
    const { classes } = app(), rows = JSON.parse(readFileSync(a1, 'utf8')).filter(r => r.f && !r.f.empty && FAMILIES.includes(r.truth))
    writeFileSync(a2 || join(UI, 'tidy-ear.json'), JSON.stringify(train(rows, classes))); console.log(`trained on ${rows.length}`)
  } else if (cmd === 'judge') {
    const { T, classes } = app(), ear = JSON.parse(readFileSync(a2 || join(UI, 'tidy-ear.json'), 'utf8')), rows = JSON.parse(readFileSync(a1, 'utf8')).filter(r => r.f && !r.f.empty)
    const fam = v => { const s = v; return s }, per = new Map(); let ok = 0
    for (const r of rows) { const o = T.tidyWhatBySound(r.f, classes, ear), got = o.length ? T.tidyEar(r.f, classes, ear)[0][0] : '(none)'; if (got === r.truth) ok++; const p = per.get(r.truth) || [0, 0]; p[1]++; if (got === r.truth) p[0]++; per.set(r.truth, p) }
    console.log(`${ok}/${rows.length} (${(100 * ok / rows.length).toFixed(1)}%)  ` + [...per].map(([k, [x, y]]) => `${k} ${x}/${y}`).join('  '))
  } else console.log('hear <list> <out> | train <rows> [out] | judge <rows> [ear]')
}
if (!isMainThread) {
  const A = app(), M = A.ctx.YAM_MODEL(readFileSync(join(UI, 'yamnet', 'model.bin')).buffer.slice(0)), out = []
  for (const j of workerData.jobs) { try { out.push(Object.assign({ id: j.id }, hearOne(A, M, j.path, join(os.tmpdir(), `tidyear-${process.pid}-${workerData.w}.wav`)))) } catch (e) { out.push({ id: j.id, empty: true, bad: String(e.message).slice(0, 120) }) } }
  parentPort.postMessage(out)
}
