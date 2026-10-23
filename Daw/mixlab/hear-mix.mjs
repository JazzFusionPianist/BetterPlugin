// node mixlab/hear-mix.mjs <song folder> [--test] — what he did in a mix, read back from the mix and its tracks.
// A song folder holds his final mix (a .wav or .mp3) and a folder of its tracks, each bounced from the same start.
// The mix is taken as the tracks' sum, each turned by its own gain in each octave and set between left and right
// ("Reverse engineering of a mix", Barchiesi and Reiss, JAES 2010, in the power domain): for every octave and each side,
// the mix's power frame by frame is fitted as a sum of the tracks' powers with weights that cannot go below nothing
// (Lawson and Hanson's non-negative least squares). A weight's root is the track's gain there; left against right is
// its pan; the octaves against each other are its eq; what the fit leaves unexplained says how much is not a plain sum
// (compression, saturation, rooms, a limiter on the mix).
// --mix=<file> --tracks=<folder>: the mix and the tracks named outright (a Logic project's folder: its bounce, and a
// folder of tracks that each run the whole song), the song's name taken from the folder given.
// --test: the same tracks summed here with gains and pans drawn at random, then read back; says how near it comes.
// Out: mixlab/out/<song>.json (kept out of git: his songs). Nothing is written to the song folder.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync, openSync, readSync, closeSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url)), OUT = join(here, 'out')
mkdirSync(OUT, { recursive: true })
const WIN = 4096, HOP = 2048
const RIDGE = +(process.env.MIXLAB_RIDGE || .02)
const OCT = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]                       // octave centres

/* ── a wav, read as it is: pcm 16/24/32 or float 32, any number of channels; only its first two kept ── */
function readWav (file) {
  const fd = openSync(file, 'r'), head = Buffer.alloc(12); readSync(fd, head, 0, 12, 0)
  if (head.toString('latin1', 0, 4) !== 'RIFF' || head.toString('latin1', 8, 12) !== 'WAVE') { closeSync(fd); throw new Error('not a wav: ' + file) }
  let at = 12, fmt = null, data = null; const size = statSync(file).size, ch = Buffer.alloc(8)
  while (at + 8 <= size) {
    readSync(fd, ch, 0, 8, at); const id = ch.toString('latin1', 0, 4), len = ch.readUInt32LE(4)
    if (id === 'fmt ') { const b = Buffer.alloc(len); readSync(fd, b, 0, len, at + 8); fmt = { tag: b.readUInt16LE(0), chans: b.readUInt16LE(2), rate: b.readUInt32LE(4), bits: b.readUInt16LE(14) }; if (fmt.tag === 0xFFFE) fmt.tag = b.readUInt16LE(24) }
    if (id === 'data') { data = { at: at + 8, len: Math.min(len, size - at - 8) }; break }
    at += 8 + len + (len & 1)
  }
  if (!fmt || !data) { closeSync(fd); throw new Error('no fmt/data: ' + file) }
  const bps = fmt.bits / 8, frame = bps * fmt.chans, n = Math.floor(data.len / frame), raw = Buffer.alloc(n * frame)
  readSync(fd, raw, 0, raw.length, data.at); closeSync(fd)
  const out = [new Float32Array(n), new Float32Array(n)], two = Math.min(2, fmt.chans)
  for (let c = 0; c < two; c++) {
    const x = out[c]
    if (fmt.tag === 3) for (let i = 0, o = c * bps; i < n; i++, o += frame) x[i] = raw.readFloatLE(o)
    else if (bps === 2) for (let i = 0, o = c * bps; i < n; i++, o += frame) x[i] = raw.readInt16LE(o) / 32768
    else if (bps === 3) for (let i = 0, o = c * bps; i < n; i++, o += frame) { const v = raw[o] | (raw[o + 1] << 8) | (raw[o + 2] << 16); x[i] = (v & 0x800000 ? v - 0x1000000 : v) / 8388608 }
    else for (let i = 0, o = c * bps; i < n; i++, o += frame) x[i] = raw.readInt32LE(o) / 2147483648
  }
  if (two === 1) out[1] = out[0]
  return { rate: fmt.rate, n, L: out[0], R: out[1], mono: fmt.chans === 1 }
}
/* an aiff (or aifc: big-endian, sowt, or float 32), read as readWav reads a wav */
function readAiff (file) {
  const d = readFileSync(file)
  if (d.toString('latin1', 0, 4) !== 'FORM' || !/^AIF[FC]$/.test(d.toString('latin1', 8, 12))) throw new Error('not an aiff: ' + file)
  let at = 12, chans = 0, frames = 0, bits = 0, rate = 0, comp = 'NONE', data = -1
  while (at + 8 <= d.length) {
    const id = d.toString('latin1', at, at + 4), len = d.readUInt32BE(at + 4), b = at + 8
    if (id === 'COMM') { chans = d.readInt16BE(b); frames = d.readUInt32BE(b + 2); bits = d.readInt16BE(b + 6); const e = d.readUInt16BE(b + 8) & 0x7fff, m = d.readUInt32BE(b + 10) * 2 ** 32 + d.readUInt32BE(b + 14); rate = Math.round(m * 2 ** (e - 16383 - 63)); if (len >= 22) comp = d.toString('latin1', b + 18, b + 22) }
    if (id === 'SSND') data = b + 8 + d.readUInt32BE(b)
    at = b + len + (len & 1)
  }
  if (!chans || data < 0) throw new Error('no COMM/SSND: ' + file)
  const bps = bits / 8, frame = bps * chans, n = Math.min(frames, Math.floor((d.length - data) / frame)), two = Math.min(2, chans), out = [new Float32Array(n), new Float32Array(n)]
  const le = comp === 'sowt', fl = comp === 'fl32' || comp === 'FL32'
  for (let c = 0; c < two; c++) {
    const x = out[c]
    for (let i = 0, o = data + c * bps; i < n; i++, o += frame) {
      if (fl) x[i] = d.readFloatBE(o)
      else if (bps === 2) x[i] = (le ? d.readInt16LE(o) : d.readInt16BE(o)) / 32768
      else if (bps === 3) { const v = le ? (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) : ((d[o] << 16) | (d[o + 1] << 8) | d[o + 2]); x[i] = (v & 0x800000 ? v - 0x1000000 : v) / 8388608 }
      else x[i] = (le ? d.readInt32LE(o) : d.readInt32BE(o)) / 2147483648
    }
  }
  if (two === 1) out[1] = out[0]
  return { rate, n, L: out[0], R: out[1], mono: chans === 1 }
}
const readSound = file => /\.aiff?$/i.test(file) ? readAiff(file) : readWav(file)
/* a wav's rate, from its header alone */
function rateOf (file) {
  if (/\.aiff?$/i.test(file)) { try { return readAiff(file).rate } catch (e) { return 0 } }
  const fd = openSync(file, 'r'), b = Buffer.alloc(4096); readSync(fd, b, 0, 4096, 0); closeSync(fd)
  for (let at = 12; at + 8 <= b.length;) { const id = b.toString('latin1', at, at + 4), len = b.readUInt32LE(at + 4); if (id === 'fmt ') return b.readUInt32LE(at + 12); at += 8 + len + (len & 1) }
  return 0
}
/* an mp3 (or anything the Mac reads) as a wav in a folder of its own, gone again after */
function readAny (file) {
  if (extname(file).toLowerCase() === '.wav') return readWav(file)
  const dir = join(tmpdir(), 'mixlab-' + process.pid), wav = join(dir, 'x.wav'); mkdirSync(dir, { recursive: true })
  try { execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEF32', file, wav]); return readWav(wav) } finally { rmSync(dir, { recursive: true, force: true }) }
}

/* a shelf (RBJ's cookbook, slope 1), in place: the test's own eq */
function shelf (x, rate, f0, gdb, high) {
  const A = Math.pow(10, gdb / 40), w0 = 2 * Math.PI * f0 / rate, c = Math.cos(w0), al = Math.sin(w0) / 2 * Math.SQRT2, sA = 2 * Math.sqrt(A) * al
  let b0, b1, b2, a0, a1, a2
  if (high) { b0 = A * ((A + 1) + (A - 1) * c + sA); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sA); a0 = (A + 1) - (A - 1) * c + sA; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sA }
  else { b0 = A * ((A + 1) - (A - 1) * c + sA); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - sA); a0 = (A + 1) + (A - 1) * c + sA; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - sA }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) { const v = x[i], y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y }
}
/* ── power in each octave, frame by frame (a Hann window; the fft of yamnet.js) ── */
const ctx = { console }; vm.createContext(ctx)
vm.runInContext(readFileSync(join(here, '..', 'ui', 'yamnet.js'), 'utf8') + '\nthis.yamFFT = yamFFT', ctx)
const FFT = ctx.yamFFT, HANN = Float32Array.from({ length: WIN }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / WIN))
function octaves (x, rate) {
  const frames = Math.max(1, Math.floor((x.length - WIN) / HOP) + 1), P = OCT.map(() => new Float64Array(frames)), re = new Float32Array(WIN), im = new Float32Array(WIN)
  const edge = OCT.map(f => [Math.max(1, Math.round(f / Math.SQRT2 * WIN / rate)), Math.min(WIN / 2, Math.round(f * Math.SQRT2 * WIN / rate))])
  for (let t = 0; t < frames; t++) {
    for (let i = 0; i < WIN; i++) { re[i] = (x[t * HOP + i] || 0) * HANN[i]; im[i] = 0 }
    FFT(re, im)
    for (let b = 0; b < OCT.length; b++) { let s = 0; for (let k = edge[b][0]; k < edge[b][1]; k++) s += re[k] * re[k] + im[k] * im[k]; P[b][t] = s }
  }
  return P
}

/* ── non-negative least squares (Lawson and Hanson), on the normal equations: min |Aw − y|, w ≥ 0 ── */
function nnls (AtA, Aty, n) {                                                              // (a ridge toward a prior is added by the caller, to AtA and Aty)
  const w = new Float64Array(n), P = new Set(), maxIt = 3 * n + 30
  const grad = () => Aty.map((v, i) => { let s = v; for (let j = 0; j < n; j++) s -= AtA[i * n + j] * w[j]; return s })
  const solveOn = idx => {                                                                    // least squares on the columns in idx (Cholesky with a little ridge)
    const k = idx.length, M = new Float64Array(k * k), r = new Float64Array(k)
    for (let a = 0; a < k; a++) { r[a] = Aty[idx[a]]; for (let b = 0; b < k; b++) M[a * k + b] = AtA[idx[a] * n + idx[b]] + (a === b ? 1e-12 * (AtA[idx[a] * n + idx[a]] + 1e-30) : 0) }
    for (let i = 0; i < k; i++) { for (let j = 0; j < i; j++) { let s = M[i * k + j]; for (let p = 0; p < j; p++) s -= M[i * k + p] * M[j * k + p]; M[i * k + j] = s / M[j * k + j] } let s = M[i * k + i]; for (let p = 0; p < i; p++) s -= M[i * k + p] * M[i * k + p]; M[i * k + i] = Math.sqrt(Math.max(s, 1e-300)) }
    const z = new Float64Array(k)
    for (let i = 0; i < k; i++) { let s = r[i]; for (let p = 0; p < i; p++) s -= M[i * k + p] * z[p]; z[i] = s / M[i * k + i] }
    for (let i = k - 1; i >= 0; i--) { let s = z[i]; for (let p = i + 1; p < k; p++) s -= M[p * k + i] * z[p]; z[i] = s / M[i * k + i] }
    return z
  }
  for (let it = 0; it < maxIt; it++) {
    const g = grad(); let best = -1, gb = 1e-10 * Math.max(...Aty.map(Math.abs), 1e-30)
    for (let j = 0; j < n; j++) if (!P.has(j) && g[j] > gb) { gb = g[j]; best = j }
    if (best < 0) break
    P.add(best)
    for (let inner = 0; inner < 3 * n; inner++) {
      const idx = [...P], z = solveOn(idx)
      if (z.every(v => v > 0)) { idx.forEach((j, a) => { w[j] = z[a] }); break }
      let alpha = 1
      idx.forEach((j, a) => { if (z[a] <= 0) alpha = Math.min(alpha, w[j] / (w[j] - z[a] + 1e-300)) })
      idx.forEach((j, a) => { w[j] += alpha * (z[a] - w[j]); if (w[j] <= 1e-15) { w[j] = 0; P.delete(j) } })
    }
  }
  return w
}
/* the normal equations of rows given as columns (each a Float64Array of frames), the rows scaled by k */
function normal (cols, y, k = 1) {
  const n = cols.length, T = y.length, AtA = new Float64Array(n * n), Aty = new Float64Array(n), k2 = k * k
  for (let i = 0; i < n; i++) { const ci = cols[i]; let s = 0; for (let t = 0; t < T; t++) s += ci[t] * y[t]; Aty[i] = s * k2; for (let j = i; j < n; j++) { const cj = cols[j]; let q = 0; for (let t = 0; t < T; t++) q += ci[t] * cj[t]; AtA[i * n + j] = AtA[j * n + i] = q * k2 } }
  return { AtA, Aty }
}
const resid = (cols, y, w) => { let res = 0, tot = 0; for (let t = 0; t < y.length; t++) { let p = 0; for (let i = 0; i < cols.length; i++) p += w[i] * cols[i][t]; res += (y[t] - p) ** 2; tot += y[t] ** 2 } return tot ? 1 - res / tot : 0 }
/* one side: first one gain for each track over every octave at once (each octave's rows scaled by the mix's own power
   there, so the lows do not outweigh the rest); then each track's gain as a smooth curve over the octaves — its level,
   tilt, bow and twist (a cubic in the octave) — fitted to every octave together by Levenberg and Marquardt, so an
   octave a track hardly sounds in follows the rest of its curve instead of taking any gain it likes */
const NB = 4, UB = OCT.map((_, b) => (b - (OCT.length - 1) / 2) / ((OCT.length - 1) / 2)), BASIS = UB.map(u => [1, u, u * u, u * u * u])
function fitSide (tracks, ys, side, G) {
  const n = tracks.length, B = OCT.length, AtA = new Float64Array(n * n), Aty = new Float64Array(n), per = []
  for (let b = 0; b < B; b++) {                                                                  // each octave's own normal equations (scaled by the mix's power there): all the rest is worked from these
    const cols = tracks.map(t => G ? Float64Array.from(t.P[side][b], (v, i) => v * G[i]) : t.P[side][b]), y = ys[b], m = y.reduce((s, v) => s + v, 0) / y.length || 1
    const e = normal(cols, y, 1 / m); let yy = 0; for (const v of y) yy += (v / m) ** 2
    per.push({ cols, y, G: e.AtA, c: e.Aty, yy })
    for (let i = 0; i < n * n; i++) AtA[i] += e.AtA[i]; for (let i = 0; i < n; i++) Aty[i] += e.Aty[i]
  }
  for (let i = 0; i < n; i++) AtA[i * n + i] *= 1 + RIDGE                                       // (a contribution costs a little: a quiet track is not blown up to soak up what nothing explains)
  const w0 = nnls(AtA, Aty, n)
  /* the curves: theta[k] = [level (ln), tilt, bow, twist]; a track the first fit left out stays out */
  const on = [...Array(n).keys()].filter(i => w0[i] > 0), N = on.length, K = N * NB, th = new Float64Array(K)
  on.forEach((i, k) => { th[k * NB] = Math.log(w0[i]) })
  const wOf = th => on.map((_, k) => BASIS.map(f => Math.exp(f.reduce((s, v, j) => s + v * th[k * NB + j], 0))))
  const cost = th => { const W = wOf(th); let c = 0; for (let b = 0; b < B; b++) { const { G, c: cy, yy } = per[b]; let q = yy; for (let k = 0; k < N; k++) { const wk = W[k][b], i = on[k]; q -= 2 * wk * cy[i]; for (let k2 = 0; k2 < N; k2++) q += wk * W[k2][b] * G[i * n + on[k2]] } c += q } return c }
  let lam = 1e-3, c0 = cost(th)
  for (let it = 0; it < 40 && K; it++) {
    const W = wOf(th), JtJ = new Float64Array(K * K), Jtr = new Float64Array(K)
    for (let b = 0; b < B; b++) {
      const { G, c: cy } = per[b], f = BASIS[b]
      const r = on.map((i, k) => { let v = cy[i]; for (let k2 = 0; k2 < N; k2++) v -= W[k2][b] * G[i * n + on[k2]]; return v })      // (Aᵀ the residual, for each track)
      for (let k = 0; k < N; k++) {
        const wk = W[k][b], i = on[k]
        for (let j = 0; j < NB; j++) Jtr[k * NB + j] += wk * f[j] * r[k]
        for (let k2 = 0; k2 < N; k2++) { const gw = wk * W[k2][b] * G[i * n + on[k2]]; if (!gw) continue; for (let j = 0; j < NB; j++) for (let j2 = 0; j2 < NB; j2++) JtJ[(k * NB + j) * K + k2 * NB + j2] += gw * f[j] * f[j2] }
      }
    }
    let better = false
    for (let tries = 0; tries < 8; tries++) {
      const M = Float64Array.from(JtJ); for (let i = 0; i < K; i++) M[i * K + i] += lam * (JtJ[i * K + i] + 1e-12)
      const step = solve(M, Jtr, K), next = th.map((v, i) => v + step[i]), c1 = cost(next)
      if (c1 < c0) { th.set(next); lam = Math.max(lam / 3, 1e-7); better = c0 - c1 > 1e-7 * c0; c0 = c1; break }
      lam *= 8
    }
    if (!better) break
  }
  const Wc = wOf(th), W = OCT.map((_, b) => { const w = new Float64Array(n); on.forEach((i, k) => { w[i] = Wc[k][b] }); return w })
  const R2 = OCT.map((_, b) => resid(per[b].cols, per[b].y, W[b]))
  return { w0, W, R2 }
}
/* a symmetric system, by Cholesky (a little ridge keeps it whole) */
function solve (M, r, k) {
  const L = Float64Array.from(M)
  for (let i = 0; i < k; i++) { for (let j = 0; j < i; j++) { let s = L[i * k + j]; for (let p = 0; p < j; p++) s -= L[i * k + p] * L[j * k + p]; L[i * k + j] = s / L[j * k + j] } let s = L[i * k + i]; for (let p = 0; p < i; p++) s -= L[i * k + p] * L[i * k + p]; L[i * k + i] = Math.sqrt(Math.max(s, 1e-300)) }
  const z = new Float64Array(k); for (let i = 0; i < k; i++) { let s = r[i]; for (let p = 0; p < i; p++) s -= L[i * k + p] * z[p]; z[i] = s / L[i * k + i] }
  for (let i = k - 1; i >= 0; i--) { let s = z[i]; for (let p = i + 1; p < k; p++) s -= L[p * k + i] * z[p]; z[i] = s / L[i * k + i] }
  return z
}
/* ── where the mix stands against the tracks' sum: the lag of best agreement of their loudness, frame by frame ── */
function lagOf (sum, mix, most = 120) {
  const a = sum.map(v => Math.log10(v + 1e-12)), b = mix.map(v => Math.log10(v + 1e-12)), ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length, c = new Map()
  for (let lag = -most; lag <= most; lag++) { let s = 0, n = 0; for (let t = 0; t < a.length; t++) { const u = t + lag; if (u < 0 || u >= b.length) continue; s += (a[t] - ma) * (b[u] - mb); n++ } if (n > a.length / 2) c.set(lag, s / n) }
  /* the peaks, best first: music repeats, so a lag a bar away can agree nearly as well — the fit decides among them */
  const peaks = [...c].filter(([l, v]) => (c.get(l - 1) ?? -Infinity) <= v && (c.get(l + 1) ?? -Infinity) <= v).sort((x, y) => y[1] - x[1])
  return peaks.slice(0, 4).map(([l]) => l)
}

const tidy = (() => { try { const c = { console }; vm.createContext(c); vm.runInContext(readFileSync(join(here, '..', 'ui', 'tidy.js'), 'utf8').split('/* ── by sound: YAMNet, in a worker ── */')[0] + '\nthis.w = tidyByWords', c); return s => c.w(s) } catch (e) { return () => null } })()
const db = p => 10 * Math.log10(Math.max(p, 1e-20))

const song = process.argv[2], test = process.argv.includes('--test')
if (!song || !existsSync(song)) { console.log('node mixlab/hear-mix.mjs <song folder> [--test]'); process.exit(1) }
const entries = readdirSync(song).filter(x => !x.startsWith('.'))
/* the mix: of the sound files at the top of the song's folder, the one his names mark as the mix — MIX, MON2, Monitor,
   MAST — the more stars the later (his way: ** is the one sent), a mix before a master, never a tune monitor, and never
   one named in brackets for another song; else the only one. The tracks: a folder of them, or else every other sound
   file at the top */
const atTop = entries.map(x => join(song, x)).filter(p => statSync(p).isFile() && /\.(wav|mp3|aif|aiff|m4a)$/i.test(p))
const nfc = x => x.normalize('NFC').toLowerCase()                                              // (the Mac keeps hangul in names taken apart)
const title = nfc(basename(song).split(',').slice(1).join(',').trim())
const others = readdirSync(dirname(song)).filter(x => !x.startsWith('.') && nfc(x) !== nfc(basename(song))).map(x => nfc(x.split(',').slice(1).join(',').trim())).filter(Boolean)      // (the other songs' names beside this one)
const mixScore = p => { const n = nfc(basename(p)), br = /\[([^\]]+)\]/.exec(n); let v = 0
  if (/mix|mon\d|monitor|mast/.test(n)) v += 10; if (/^mix\.(wav|mp3|aif|aiff|m4a)$/.test(n)) v += 50; if (/mix/.test(n)) v += 2; v += (n.match(/\*/g) || []).length; if (/tune/.test(n)) v -= 100
  if (title && !n.includes(title) && br && others.some(o => br[1].includes(o) || o.includes(br[1].trim()))) v -= 100          // (named in brackets for another song beside it: put here by mistake)
  return v }
const named = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || null
const mixFile = named('mix') || [...atTop].sort((a, b) => mixScore(b) - mixScore(a)).find(p => mixScore(p) >= 10) || (atTop.length === 1 && mixScore(atTop[0]) > -50 ? atTop[0] : null)
if (process.argv.includes('--which')) { console.log(basename(song).padEnd(28), mixFile ? basename(mixFile) : '(no mix)'); process.exit(0) }      // (--which: only which file is taken for the mix)
const tdir = named('tracks') || entries.map(x => join(song, x)).find(p => statSync(p).isDirectory() && !/\.logicx$/i.test(p)) || song
const skip = (process.argv.find(a => a.startsWith('--skip=')) || '').slice(7).split(',').filter(Boolean)      // --skip=Track 1,Click: tracks to leave out by name
const under = (dir, depth = 0) => readdirSync(dir).filter(x => !x.startsWith('.')).flatMap(x => { const p = join(dir, x); return statSync(p).isDirectory() ? (depth < 3 && p !== song ? under(p, depth + 1) : []) : [p] })
const files = (tdir === song ? readdirSync(song).filter(x => !x.startsWith('.')).map(x => join(song, x)).filter(p => statSync(p).isFile()) : under(tdir))
  .filter(p => { const bounce = /2\s?mix|\(realtime\)|bounce in place|full mix/i.test(basename(p)); if (bounce) console.log('  left out (a bounce of the whole song, by its name):', basename(p)); return !bounce })
  .filter(p => /\.(wav|aiff?)$/i.test(p) && p !== mixFile && !skip.some(k => basename(p).replace(/\.(wav|aiff?)$/i, '').replace(/^untitled - /i, '') === k)).map(p => p.slice(tdir.length + 1)).sort()
console.log(`${basename(song)}: ${files.length} tracks, mix ${mixFile ? basename(mixFile) : '(none)'}${test ? ' — test: a mix made here' : ''}`)

/* each track's octaves, both sides (a mono track is the same on both) — read one at a time, the sound let go after */
/* the rate most of the tracks have; a track (or the mix) at another is read at it (between two samples, the straight
   line: enough for power in octaves) */
const RATE = (() => { const c = new Map(); for (const f of files) { const r = rateOf(join(tdir, f)); if (r) c.set(r, (c.get(r) || 0) + 1) } return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] || 48000 })()
const at = (x, r) => { if (r === RATE) return x; const k = r / RATE, n = Math.floor(x.length / k), y = new Float32Array(n); for (let i = 0; i < n; i++) { const p = i * k, j = Math.floor(p), u = p - j; y[i] = (x[j] || 0) * (1 - u) + (x[j + 1] || 0) * u } return y }
const t0 = Date.now(), tracks = []
let rate = 0, len = 0, made = test ? null : undefined
const truth = []
for (const f of files) {
  const w = readSound(join(tdir, f)); rate = RATE
  if (w.rate !== RATE) { const same = w.L === w.R; w.L = at(w.L, w.rate); w.R = same ? w.L : at(w.R, w.rate); w.n = w.L.length; console.log(`  read at ${RATE} Hz (it is at ${w.rate}): ${f}`) }
  len = Math.max(len, w.n)
  if (!w.mono) { let d = 0, e = 0; for (let i = 0; i < w.n; i += 7) { d += (w.L[i] - w.R[i]) ** 2; e += w.L[i] ** 2 } if (e > 0 && d / e < 1e-6) w.mono = true }      // (two sides alike: one sound)
  const tr = { name: basename(f).replace(/\.(wav|aiff?)$/i, '').replace(/^untitled - /i, ''), file: f, mono: w.mono, P: null }
  { const l = octaves(w.L, rate); tr.P = [l, w.mono ? l : octaves(w.R, rate)] }
  tr.what = tidy(tr.name); tr.raw = OCT.map((_, b) => db((tr.P[0][b].reduce((s, v) => s + v, 0) + tr.P[1][b].reduce((s, v) => s + v, 0)) / 2 / tr.P[0][b].length))
  if (test) {                                                                                     // the test's own mix: a gain and a pan drawn for each track, summed here
    const g = -12 + 12 * Math.random(), pan = w.mono ? -1 + 2 * Math.random() : 0, gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2, a = Math.pow(10, g / 20)
    const lo = -6 + 12 * Math.random(), hi = -6 + 12 * Math.random()
    truth.push({ g, pan: w.mono ? pan : null, lo, hi })
    for (const x of w.mono ? [w.L] : [w.L, w.R]) { shelf(x, rate, 150, lo, false); shelf(x, rate, 4000, hi, true) }
    { const after = octaves(w.L, rate), sum = p => p.reduce((s, v) => s + v, 0); truth[truth.length - 1].oct = OCT.map((_, b) => db(sum(after[b])) - db(sum(tr.P[0][b]))) }      // (what the shelves did, octave by octave)
    if (!made) made = { L: new Float32Array(len), R: new Float32Array(len) }
    if (made.L.length < w.n) { const L = new Float32Array(w.n), R = new Float32Array(w.n); L.set(made.L); R.set(made.R); made = { L, R } }
    for (let i = 0; i < w.n; i++) { made.L[i] += w.L[i] * a * gl; made.R[i] += w.R[i] * a * gr }
  }
  tracks.push(tr)
}
console.log(`  tracks heard in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
/* the same part twice — a vocal as recorded and again as tuned, a stem and its own copy — would answer for each other:
   of two tracks that sound at the same moments with the same loudness (their power, frame by frame, goes together over
   the frames where either sounds), with the same balance of octaves (within 3 db) and within 6 db of each other, one is
   kept: the one whose name or folder says tuned, else the first. (Loudness on its own is not enough: two different
   parts that both rest through the verse go together in that.) */
{ const Tm = Math.max(...tracks.map(tr => tr.P[0][0].length)), env = tracks.map(tr => Float64Array.from({ length: Tm }, (_, t) => OCT.reduce((q, _, b) => q + (tr.P[0][b][t] || 0) + (tr.P[1][b][t] || 0), 0)))
  const lvl = tracks.map(tr => db(tr.raw.reduce((s, v) => s + Math.pow(10, v / 10), 0))), peak = env.map(e => Math.max(...e))
  const shape = tracks.map((tr, i) => tr.raw.map(v => v - lvl[i]))
  const gone = new Set()
  for (let i = 0; i < tracks.length; i++) for (let j = i + 1; j < tracks.length; j++) {
    if (gone.has(i) || gone.has(j) || Math.abs(lvl[i] - lvl[j]) > 6) continue
    let sd = 0, nb = 0; for (let b = 0; b < OCT.length; b++) if (shape[i][b] > -40 || shape[j][b] > -40) { sd += (shape[i][b] - shape[j][b]) ** 2; nb++ }
    if (!nb || Math.sqrt(sd / nb) > 3) continue
    const on = []; for (let t = 0; t < Tm; t++) if (env[i][t] > peak[i] * 1e-4 || env[j][t] > peak[j] * 1e-4) on.push(t)
    if (on.length < 20) continue
    let mi = 0, mj = 0; for (const t of on) { mi += env[i][t]; mj += env[j][t] } mi /= on.length; mj /= on.length
    let c = 0, vi = 0, vj = 0; for (const t of on) { const x = env[i][t] - mi, y = env[j][t] - mj; c += x * y; vi += x * x; vj += y * y }
    c /= Math.sqrt(vi * vj) || 1
    if (c > .95) { const tuned = k => /tun/i.test(tracks[k].file), drop = tuned(j) && !tuned(i) ? i : j; gone.add(drop); console.log(`  left out: ${tracks[drop].file} (the same part as ${tracks[drop === i ? j : i].file}: they go together ${c.toFixed(3)})`) }
  }
  for (const k of [...gone].sort((a, b) => b - a)) { tracks.splice(k, 1); if (test) truth.splice(k, 1) }
}
/* a track that is the whole song already (a bounce left among the tracks) would answer for all the rest: one whose
   loudness, frame by frame, goes with the rest's sum nearly exactly, and is as loud as it, is left out */
{ const Tm = Math.max(...tracks.map(tr => tr.P[0][0].length)), tot = tr => Float64Array.from({ length: Tm }, (_, t) => OCT.reduce((q, _, b) => q + (tr.P[0][b][t] || 0) + (tr.P[1][b][t] || 0), 0))
  const each = tracks.map(tot), all = Float64Array.from({ length: Tm }, (_, t) => each.reduce((q, e) => q + e[t], 0))
  const corr = (a, b) => { const la = [...a].map(v => Math.log10(v + 1e-12)), lb = [...b].map(v => Math.log10(v + 1e-12)), ma = la.reduce((s, v) => s + v, 0) / la.length, mb = lb.reduce((s, v) => s + v, 0) / lb.length; let n = 0, da = 0, dbb = 0; for (let t = 0; t < la.length; t++) { n += (la[t] - ma) * (lb[t] - mb); da += (la[t] - ma) ** 2; dbb += (lb[t] - mb) ** 2 } return n / Math.sqrt(da * dbb + 1e-30) }
  for (let i = tracks.length - 1; i >= 0; i--) {
    const rest = Float64Array.from(all, (v, t) => v - each[i][t]), c = corr(each[i], rest), lv = db(each[i].reduce((s, v) => s + v, 0)) - db(rest.reduce((s, v) => s + v, 0))
    if (process.env.MIXLAB_SAY) console.log(`    ${tracks[i].name}: goes with the rest ${c.toFixed(3)}, ${lv.toFixed(1)} db`)
    if (c > .8 && lv > -3) { console.log(`  left out: ${tracks[i].name} (the whole song already: it goes with the rest ${c.toFixed(3)}, ${lv.toFixed(1)} db against them)`); tracks.splice(i, 1); if (test) truth.splice(i, 1) }
  }
}
const mix = test ? { rate, L: made.L, R: made.R } : readAny(mixFile)
if (mix.rate !== rate) console.log(`  the mix is at ${mix.rate} Hz, the tracks at ${rate}: the mix is read at ${rate}`)
const M = [octaves(at(mix.L, mix.rate), rate), octaves(at(mix.R, mix.rate), rate)]

/* line the mix up with the tracks' sum (every track as long as the longest: what a shorter one lacks is silence) */
const T = Math.max(...tracks.map(tr => tr.P[0][0].length))
for (const tr of tracks) tr.P = tr.P.map(side => side.map(p => { if (p.length === T) return p; const q = new Float64Array(T); q.set(p); return q }))
const sum = Float64Array.from({ length: T }, (_, t) => tracks.reduce((s, tr) => s + OCT.reduce((q, _, b) => q + tr.P[0][b][t] + tr.P[1][b][t], 0), 0))
const mixAll = Float64Array.from({ length: M[0][0].length }, (_, t) => OCT.reduce((q, _, b) => q + M[0][b][t] + M[1][b][t], 0))
const lag = test ? 0 : (() => {
  const cands = lagOf(sum, mixAll); if (cands.length < 2) return cands[0] || 0
  /* each candidate tried: one gain a track over every octave, both sides; the lag the tracks explain best is the mix's */
  const tryLag = l => { let r = 0; for (let side = 0; side < 2; side++) { const ys = OCT.map((_, b) => Float64Array.from({ length: T }, (_, t) => M[side][b][t + l] || 0)); const n = tracks.length, AtA = new Float64Array(n * n), Aty = new Float64Array(n); let yy = 0
      for (let b = 0; b < OCT.length; b++) { const y = ys[b], m = y.reduce((s, v) => s + v, 0) / y.length || 1, e = normal(tracks.map(t => t.P[side][b]), y, 1 / m); for (let i = 0; i < n * n; i++) AtA[i] += e.AtA[i]; for (let i = 0; i < n; i++) Aty[i] += e.Aty[i]; for (const v of y) yy += (v / m) ** 2 }
      const w = nnls(AtA, Aty, n); let q = yy; for (let i = 0; i < n; i++) { q -= 2 * w[i] * Aty[i]; for (let j = 0; j < n; j++) q += w[i] * w[j] * AtA[i * n + j] } r += 1 - q / yy } return r / 2 }
  const scored = cands.map(l => [l, tryLag(l)]).sort((x, y) => y[1] - x[1])
  if (process.env.MIXLAB_SAY) console.log('  lags tried:', scored.map(([l, r]) => `${(l * HOP / RATE).toFixed(2)} s → ${r.toFixed(3)}`).join(', '))
  const L0 = scored[0][0]
  return L0
})()
console.log(`  the mix stands ${(lag * HOP / rate).toFixed(2)} s from the tracks' start`)
const yOf = (side, b) => Float64Array.from({ length: T }, (_, t) => M[side][b][t + lag] || 0)

/* the weights: every octave, each side */
/* the tracks' curves, and the mix's own hold: a gain over the whole mix that moves frame by frame (a compressor or a
   limiter on the mix, a pumping duck), the same in every octave and on both sides — the two are fitted in turn */
const W = [], R2 = [], W0 = [], Y = [0, 1].map(side => OCT.map((_, b) => yOf(side, b))), mOf = Y.map(sd => sd.map(y => y.reduce((s, v) => s + v, 0) / y.length || 1))
let G = test ? null : new Float64Array(T).fill(1), holdDb = 0
for (let round = 0; round < (test ? 1 : 4); round++) {
  for (let side = 0; side < 2; side++) { const r = fitSide(tracks, Y[side], side, G); W[side] = r.W; R2[side] = r.R2; W0[side] = r.w0 }
  if (!G) break
  const g = new Float64Array(T)
  for (let t = 0; t < T; t++) { let num = 0, den = 0; for (let side = 0; side < 2; side++) for (let b = 0; b < OCT.length; b++) { let p = 0; for (let i = 0; i < tracks.length; i++) p += W[side][b][i] * tracks[i].P[side][b][t]; const m2 = mOf[side][b] ** 2; num += Y[side][b][t] * p / m2; den += p * p / m2 } g[t] = den > 0 ? Math.min(100, Math.max(.01, num / den)) : 1 }
  const sorted = [...g].sort((a, b) => a - b), med = sorted[Math.floor(T / 2)] || 1
  for (let t = 0; t < T; t++) G[t] = Math.sqrt(g[t] / med * (G[t] || 1))                     // (halfway each round, and the middle of it held at nothing)
  holdDb = db(sorted[Math.floor(T * .95)] / med) - db(sorted[Math.floor(T * .05)] / med)
}
if (G) console.log(`  the mix's own hold moves over ${holdDb.toFixed(1)} db (5th to 95th of its frames)`)

/* what each track was given: its gain (power-weighted over octaves, against the mix's loudest), its eq (each octave
   against its own gain), its pan (left against right, from a sine-cosine pan law) */
const out = tracks.map((tr, i) => {
  const e = tr.raw.map(v => Math.pow(10, v / 10)), et = e.reduce((s, v) => s + v, 0)
  const p0 = (W0[0][i] + W0[1][i]) / 2, pc = OCT.reduce((s, _, b) => s + (W[0][b][i] + W[1][b][i]) / 2 * e[b], 0) / (et || 1), gain = pc > 0 ? db(pc) : null      // (a power weight: 10 log10 of it is the gain in db)
  const gb = OCT.map((_, b) => { const p = (W[0][b][i] + W[1][b][i]) / 2; return p > 0 && tr.raw[b] > Math.max(...tr.raw) - 30 ? db(p) : null })      // (an octave the track hardly sounds in says nothing of its eq)
  const pan = tr.mono && p0 > 0 ? Math.atan2(Math.sqrt(W0[1][i]), Math.sqrt(W0[0][i])) / (Math.PI / 4) - 1 : null
  return { name: tr.name, what: tr.what, mono: tr.mono, raw: tr.raw.map(v => +v.toFixed(2)), gain, pan, eq: gb.map(g => g != null && gain != null ? +(g - gain).toFixed(1) : null), loudRaw: +db(tr.raw.reduce((s, v) => s + Math.pow(10, v / 10), 0)).toFixed(1) }
})
const r2 = OCT.map((_, b) => +((R2[0][b] + R2[1][b]) / 2).toFixed(3))
console.log('  how much of the mix the tracks explain, octave by octave:', OCT.map((f, b) => `${f < 1000 ? f : f / 1000 + 'k'} ${r2[b]}`).join('  '))
const top = Math.max(...out.filter(o => o.gain != null).map(o => o.gain + o.loudRaw))
for (const o of [...out].sort((a, b) => ((b.gain ?? -99) + b.loudRaw) - ((a.gain ?? -99) + a.loudRaw))) {
  const inMix = o.gain != null ? (o.gain + o.loudRaw - top).toFixed(1) : '  —'
  console.log(`  ${o.name.slice(0, 26).padEnd(26)} ${String(o.what || '').padEnd(10)} in the mix ${String(inMix).padStart(6)} db  gain ${o.gain != null ? o.gain.toFixed(1).padStart(6) : '     —'}  pan ${o.pan != null ? (o.pan > .05 ? 'R' + Math.round(o.pan * 100) : o.pan < -.05 ? 'L' + Math.round(-o.pan * 100) : 'C').padEnd(4) : 'st  '}  eq ${o.eq.map(v => v == null ? ' ·' : (v >= 0 ? '+' : '') + v.toFixed(0)).join(' ')}`)
}
if (test) {
  const err = out.map((o, i) => o.gain != null ? Math.abs(o.gain - truth[i].g) : null).filter(v => v != null), perr = out.map((o, i) => o.pan != null && truth[i].pan != null ? Math.abs(o.pan - truth[i].pan) : null).filter(v => v != null)
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }
  const lo = out.map((o, i) => o.eq[1] != null ? Math.abs(o.eq[1] - (truth[i].lo - (truth[i].lo + truth[i].hi) / 2 * 0)) : null)
  /* a shelf is not an octave: what the octaves should read is the shelves' gain at 63 hz and 8 khz against the track's own gain (the gain read back takes in both shelves, weighed by where its sound is) */
  /* each octave the track sounds in: its gain there (gain + eq) against what the test gave it there (g + the shelves) */
  const octErr = []; out.forEach((o, i) => o.eq.forEach((v, b) => { if (v != null && o.gain != null) octErr.push(Math.abs(o.gain + v - truth[i].g - truth[i].oct[b])) }))
  writeFileSync(join(OUT, basename(song).replace(/[^\w가-힣 ,.-]/g, '_') + '.test-summary.json'), JSON.stringify({ song: basename(song), made: new Date().toISOString(), tracks: out.length, octaves: octErr.length, octMedian: +med(octErr).toFixed(2), octP90: +[...octErr].sort((x, y) => x - y)[Math.floor(octErr.length * .9)].toFixed(2), panMedian: +(med(out.map((o, i) => o.pan != null && truth[i].pan != null ? Math.abs(o.pan - truth[i].pan) : null).filter(v => v != null)) ?? 0).toFixed(3) }))
  console.log(`  test: each octave's gain read back within ${med(octErr)?.toFixed(2)} db (median), ${[...octErr].sort((x, y) => x - y)[Math.floor(octErr.length * .9)]?.toFixed(2)} for nine in ten, over ${octErr.length} octaves`)
  const eqErr = out.map((o, i) => o.eq[1] != null && o.eq[8] != null ? Math.abs((o.eq[8] - o.eq[1]) - (truth[i].hi - truth[i].lo)) : null).filter(v => v != null)
  console.log(`  test: the eq read back (8 khz against 63 hz, against the shelves' difference) within ${med(eqErr)?.toFixed(2)} db (median) over ${eqErr.length} tracks`)
  console.log(`\n  test: gain read back within ${med(err)?.toFixed(2)} db (median), ${Math.max(...err).toFixed(2)} at worst, ${out.filter(o => o.gain == null).length} not found; pan within ${med(perr)?.toFixed(3)} (median)`)
}
writeFileSync(join(OUT, basename(song).replace(/[^\w가-힣 ,.-]/g, '_') + (test ? '.test' : '') + '.json'), JSON.stringify({ song: basename(song), mix: mixFile ? basename(mixFile) : null, rate, lagSec: lag * HOP / rate, octaves: OCT, r2, holdDb: +holdDb.toFixed(1), tracks: out }, null, 1))
