// node test/tone.mjs — the reader of tones (what a file is taken to be from its outline and two numbers), tried on sounds whose kind is known
import { open, PAGE, DRAFT } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const r = await b.ev(`
  const sr = SND_SR
  // the same measures the app takes
  const measure = (x, sec) => {
    const n = x.length, bins = Math.max(1200, Math.min(24000, Math.floor(n / 480))), peaks = []
    for (let k = 0; k < bins; k++) { const i0 = Math.floor(k * n / bins), i1 = Math.max(i0 + 1, Math.floor((k + 1) * n / bins)); let m = 0; for (let i = i0; i < i1 && i < n; i++) { const v = Math.abs(x[i]); if (v > m) m = v } peaks.push(Math.round(m * 1000) / 1000) }
    const a = 1 - Math.exp(-2 * Math.PI * 150 / sr); let all = 0, low = 0, l1 = 0, l2 = 0, prev = 0, zc = 0
    for (let i = 0; i < n; i++) { const v = x[i]; l1 += a * (v - l1); l2 += a * (l1 - l2); all += v * v; low += l2 * l2; if ((v >= 0) !== (prev >= 0)) zc++; prev = v }
    return { peaks, sec: n / sr, tone: { low: all > 1e-9 ? Math.round(low / all * 1000) / 1000 : 0, zc: Math.round(zc / (n / sr) / 2) } }
  }
  const out = {}
  for (const k in LOOPS) { const lp = LOOPS[k], x = new Float32Array(lp.n); for (const c of lp.ch) for (let i = 0; i < lp.n; i++) x[i] += c[i] / lp.ch.length; const m = measure(x); out[k] = [readTone(m), m.tone.low, m.tone.zc] }
  // made here: a held sine bass, a plucked bass line, a sung line (vowel-like, with vibrato), white-noise hats, a piano-like decay, a spoken-like burst train
  const mk = (sec, f) => { const x = new Float32Array(Math.floor(sec * sr)); for (let i = 0; i < x.length; i++) x[i] = f(i / sr, i); return x }
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1 }
  const tests = {
    'held sub bass': mk(8, t => Math.sin(2 * Math.PI * 55 * t) * .6 * (1 - .1 * Math.sin(2 * Math.PI * .5 * t))),
    'plucked bass 8ths': mk(8, t => { const p = t % .326; return (Math.sin(2 * Math.PI * 82 * t) + .4 * Math.sin(2 * Math.PI * 164 * t)) * .5 * Math.exp(-p * 3) }),
    'short stabs bass': mk(8, t => { const p = t % .326; return Math.sin(2 * Math.PI * 65 * t) * .6 * Math.exp(-p * 22) }),
    'sung vowel': mk(8, t => { const f = 220 * (1 + .01 * Math.sin(2 * Math.PI * 5.5 * t)), ph = (t % 2) / 2; return (Math.sin(2 * Math.PI * f * t) + .5 * Math.sin(2 * Math.PI * 2 * f * t) + .3 * Math.sin(2 * Math.PI * 3 * f * t)) * .3 * Math.min(1, ph * 12) * Math.min(1, (1 - ph) * 6) }),
    'noise hats 16ths': mk(8, t => rnd() * .4 * Math.exp(-(t % .163) * 45)),
    'open noise wash': mk(8, t => rnd() * .2),
    'piano-like chords': mk(8, t => { const p = t % 1.3; return (Math.sin(2 * Math.PI * 262 * t) + Math.sin(2 * Math.PI * 330 * t) + Math.sin(2 * Math.PI * 392 * t)) * .2 * Math.exp(-p * 1.6) }),
    'spoken bursts': mk(8, t => { const p = t % .22; return (Math.sin(2 * Math.PI * 180 * t) + .6 * Math.sin(2 * Math.PI * 700 * t) + .2 * rnd()) * .3 * (p < .12 ? 1 : .02) }),
    'kick only': mk(8, t => { const p = t % .652; return Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-p * 30)) * p) * .9 * Math.exp(-p * 9) }),
    'long 808': mk(8, t => { const p = t % 1.304; return Math.sin(2 * Math.PI * (45 + 60 * Math.exp(-p * 40)) * p) * .8 * Math.exp(-p * 1.2) }),
  }
  for (const k in tests) { const m = measure(tests[k]); out[k] = [readTone(m), m.tone.low, m.tone.zc] }
  return out
`)
for (const k in r) console.log(k.padEnd(22), String(r[k][0]).padEnd(8), 'low', r[k][1], 'zc', r[k][2])
await b.close()
