/* ── the demo song, made from nothing: every stem is computed when the page opens ── */
let SND_SR = 44100                        // inside the app this becomes the device's rate
function srand (seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647 }
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12)

const HUM_NOTES = [[4, 6, 76], [10, 3, 74], [13, 3, 72], [16, 9, 69], [36, 4, 67], [40, 4, 69], [44, 4, 72], [48, 6, 74], [54, 2, 72], [56, 7, 69]]
const KEY_CHORDS = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 67], [55, 59, 60, 64], [55, 57, 59, 62, 64]]
const KEY_HITS = [[0, 6.5, 1], [7, 2.5, .55], [10, 5, .8]]

function makeLoops (tempo) {
  const SR = SND_SR, spb = 240 / tempo, s16 = spb / 16
  const tStep = i => i * s16 + (i % 2 ? .14 * s16 : 0)                       // a light swing: odd sixteenths sit late
  const mk = (bars, ch) => { const n = Math.round(bars * spb * SR); return { bars, n, ch: Array.from({ length: ch }, () => new Float32Array(n)) } }
  /* add one voice into a loop; a tail that runs past the end comes round to the start */
  const putCh = (lp, c, t0, dur, fn, g = 1) => {
    const n = lp.n, i0 = Math.round(t0 * SR), len = Math.round(dur * SR), a = lp.ch[c]
    for (let i = 0; i < len; i++) { let k = (i0 + i) % n; if (k < 0) k += n; a[k] += fn(i / SR) * g }
  }
  const put = (lp, t0, dur, fn, gL = 1, gR = gL) => {
    const n = lp.n, i0 = Math.round(t0 * SR), len = Math.round(dur * SR), L = lp.ch[0], R = lp.ch[1]
    for (let i = 0; i < len; i++) { let k = (i0 + i) % n; if (k < 0) k += n; const v = fn(i / SR); L[k] += v * gL; if (R) R[k] += v * gR }
  }
  const level = (lp, peak) => {
    let m = 0
    for (const a of lp.ch) for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v }
    const k = m > 0 ? peak / m : 1
    for (const a of lp.ch) for (let i = 0; i < a.length; i++) a[i] *= k
    return lp
  }

  /* kick */
  const kick = mk(1, 1)
  for (const [st, g] of [[0, 1], [7, .55], [10, .9]]) {
    const rnd = srand(11 + st)
    put(kick, tStep(st), .5, t => {
      const ph = 2 * Math.PI * (46 * t + (115 / 34) * (1 - Math.exp(-34 * t)))
      return Math.tanh((Math.sin(ph) * Math.exp(-t * 7.2) + (rnd() * 2 - 1) * Math.exp(-t * 700) * .25) * 1.7) * g
    })
  }

  /* snare */
  const snare = mk(1, 1)
  for (const [st, g] of [[4, 1], [12, .95], [15, .22]]) {
    const rnd = srand(31 + st); let lp = 0, hp = 0, prev = 0
    put(snare, tStep(st), .32, t => {
      lp += .55 * ((rnd() * 2 - 1) - lp)
      hp = .93 * (hp + lp - prev); prev = lp
      const tone = Math.sin(2 * Math.PI * (178 * t + 1.5 * (1 - Math.exp(-40 * t)))) * Math.exp(-t * 26) * .55
      return Math.tanh((hp * Math.exp(-t * 17) * 1.1 + tone) * 1.4) * g
    })
  }

  /* hats */
  const hats = mk(1, 2)
  for (const [st, g, open] of [[0, .55, 0], [2, .9, 0], [3, .28, 0], [4, .5, 0], [6, .85, 0], [8, .55, 0], [10, .9, 0], [11, .3, 0], [12, .5, 0], [14, .8, 1]]) {
    const rnd = srand(51 + st); let p1 = 0, p2 = 0, h1 = 0, h2 = 0
    const pan = (st % 4 === 2) ? .12 : -.08
    put(hats, tStep(st), open ? .34 : .09, t => {
      const x = rnd() * 2 - 1
      h1 = .55 * (h1 + x - p1); p1 = x
      h2 = .55 * (h2 + h1 - p2); p2 = h1
      return h2 * Math.exp(-t * (open ? 13 : 70)) * g
    }, .5 - pan, .5 + pan)
  }

  /* bass */
  const bass = mk(4, 1)
  ;[33, 29, 36, 31].forEach((r, b) => {
    for (const [st, len, m, g] of [[0, 5, r, 1], [7, 2.2, r, .8], [10, 3.2, r + 7, .85], [14, 1.6, r + 12, .7]]) {
      const f = midiHz(m), dur = len * s16
      put(bass, b * spb + tStep(st), dur + .06, t => {
        const a = Math.min(1, t / .006) * (t < dur ? (.72 + .28 * Math.exp(-t * 9)) : Math.max(0, 1 - (t - dur) / .06))
        const ph = 2 * Math.PI * f * t
        return Math.tanh((Math.sin(ph) + .5 * Math.sin(2 * ph) + .2 * Math.sin(3 * ph)) * 1.2) * a * g
      })
    }
  })

  /* keys: a soft electric piano, two operators */
  const keys = mk(4, 2)
  KEY_CHORDS.forEach((ch, b) => {
    for (const [st, len, g] of KEY_HITS) {
      ch.forEach((m, j) => {
        const f = midiHz(m), dur = len * s16, t0 = b * spb + tStep(st) + j * .009
        const voice = ff => t => {
          const env = Math.min(1, t / .004) * Math.exp(-t * 1.9) * (t < dur ? 1 : Math.exp(-(t - dur) * 14))
          const ph = 2 * Math.PI * ff * t
          return Math.sin(ph + (1.5 * Math.exp(-t * 7) + .22) * Math.sin(ph)) * env
        }
        const amp = .2 * g, sp = .5 + .5 * Math.sin(b * 1.7 + j)
        putCh(keys, 0, t0, dur + .35, voice(f), amp * (.75 + .25 * sp))
        putCh(keys, 1, t0, dur + .35, voice(f * 1.0018), amp * (1 - .25 * sp))
      })
    }
  })
  {
    const dur = keys.n / SR, w = 2 * Math.PI * Math.round(4.5 * dur) / dur, L = keys.ch[0], R = keys.ch[1]
    for (let i = 0; i < keys.n; i++) { const s = .16 * Math.sin(w * i / SR); L[i] *= 1 + s; R[i] *= 1 - s }
  }

  /* guitar: plucked strings */
  const guitar = mk(4, 2)
  ;[[64, 69, 72, 76], [65, 69, 72, 77], [64, 67, 72, 76], [62, 67, 71, 74]].forEach((ar, b) => [0, 1, 2, 3, 2, 1, 2, 1].forEach((oi, k) => {
    const f = midiHz(ar[oi]), N = Math.max(2, Math.round(SR / f - .5)), rnd = srand(101 + b * 8 + k)
    const line = new Float32Array(N)
    let z = 0, mean = 0
    for (let i = 0; i < N; i++) { z += .45 * ((rnd() * 2 - 1) - z); line[i] = z; mean += z }
    mean /= N
    for (let i = 0; i < N; i++) line[i] -= mean
    let idx = 0
    const g = (k % 2 ? .7 : 1)
    put(guitar, b * spb + tStep(k * 2), 1.2, t => {
      const out = line[idx], nx = line[(idx + 1) % N]
      line[idx] = .496 * (out + nx)
      idx = (idx + 1) % N
      return out * Math.min(1, (1.2 - t) / .08) * g
    }, .42, .58)
  }))

  /* hum: a wordless voice */
  const formant = f => 1 / (1 + Math.pow((f - 340) / 130, 2)) + .55 / (1 + Math.pow((f - 880) / 170, 2)) + .06
  const humLine = (seed, cents, late, gL, gR) => {
    const lp = mk(4, 2), tune = Math.pow(2, cents / 1200)
    let prevF = midiHz(72) * tune
    for (const [st, len, m] of HUM_NOTES) {
      const f1 = midiHz(m) * tune, f0 = prevF, dur = len * s16, rnd = srand(seed + st)
      let ph = 0, bn = 0
      put(lp, tStep(st) + late, dur + .16, t => {
        const f = (f0 + (f1 - f0) * Math.min(1, t / .06)) * (1 + .0055 * Math.min(1, Math.max(0, (t - .12) / .25)) * Math.sin(2 * Math.PI * 5.3 * t + seed))
        ph += 2 * Math.PI * f / SR
        let v = 0
        for (let k = 1; k <= 7; k++) v += Math.sin(k * ph) * formant(k * f) / Math.pow(k, .8)
        bn += .08 * ((rnd() * 2 - 1) - bn)
        const env = Math.min(1, t / .07) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / .16))
        return (v * .32 + bn * .5) * env
      }, gL, gR)
      prevF = f1
    }
    return lp
  }
  const hum = humLine(200, 0, 0, .56, .44), hum2 = humLine(260, 9, .021, .3, .7)

  /* air: a slow breath of tone and hiss */
  const air = mk(8, 2)
  {
    const n = air.n, L = air.ch[0], R = air.ch[1], rl = srand(301), rr = srand(302), dur = n / SR
    const q = f => 2 * Math.PI * Math.round(f * dur) / dur
    const tones = [[81, .5], [88, .35], [83, .22], [76, .3]].map(([m, g], k) => ({ wl: q(midiHz(m)), wr: q(midiHz(m) * 1.003), g, k }))
    let al = 0, bl = 0, ar = 0, br = 0
    for (let i = 0; i < n; i++) {
      const t = i / SR, u = t / dur
      const xl = rl() * 2 - 1, xr = rr() * 2 - 1
      al += .25 * (xl - al); bl += .03 * (xl - bl); ar += .25 * (xr - ar); br += .03 * (xr - br)
      const swell = .55 + .45 * Math.sin(2 * Math.PI * u - Math.PI / 2)
      let tl = 0, tr = 0
      for (const o of tones) { const a = o.g * (.5 + .5 * Math.sin(2 * Math.PI * (o.k + 2) * u + o.k * 1.3)); tl += Math.sin(o.wl * t) * a; tr += Math.sin(o.wr * t + 1) * a }
      L[i] = (tl * .12 + (al - bl) * .45) * swell
      R[i] = (tr * .12 + (ar - br) * .45) * swell
    }
  }

  return {
    kick: level(kick, .92), snare: level(snare, .8), hats: level(hats, .5), bass: level(bass, .85), keys: level(keys, .7),
    guitar: level(guitar, .6), hum: level(hum, .6), hum2: level(hum2, .5), air: level(air, .45),
  }
}

/* a hall: noise that darkens as it dies */
function makeIR (SR, seconds) {
  const n = Math.round(SR * seconds), pre = Math.round(.018 * SR), out = [new Float32Array(n), new Float32Array(n)]
  out.forEach((a, c) => {
    const rnd = srand(700 + c); let z = 0
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / SR
      z += (.1 + .75 * Math.exp(-t * 2.4)) * ((rnd() * 2 - 1) - z)
      a[i] = z * Math.exp(-6.9 * t / seconds) * Math.min(1, t / .004)
    }
  })
  return out
}

/* peaks of a loop for a stretch of bars, one value per step, 0..1 */
function loopPeaks (lp, barFrom, barTo, steps) {
  const out = new Float32Array(steps), n = lp.n, per = n / lp.bars, w = (barTo - barFrom) * per / steps
  for (let s = 0; s < steps; s++) {
    const i0 = Math.floor((barFrom * per + s * w)), i1 = Math.max(i0 + 1, Math.floor(barFrom * per + (s + 1) * w))
    let m = 0
    const stride = Math.max(1, Math.floor((i1 - i0) / 48))
    for (let i = i0; i < i1; i += stride) { const k = ((i % n) + n) % n; for (const a of lp.ch) { const v = Math.abs(a[k]); if (v > m) m = v } }
    out[s] = m
  }
  return out
}

/* a stretch of a loop close up: from sample i0 to i1 (they go round), in at most n steps — the lowest and the highest sample of each */
function loopWave (lp, i0, i1, n) {
  const a = Math.floor(i0), b = Math.max(a + 1, Math.ceil(i1)), count = b - a, steps = Math.max(1, Math.min(n, count)), lo = new Float32Array(steps), hi = new Float32Array(steps), N = lp.n, ch = lp.ch
  for (let s = 0; s < steps; s++) {
    const j0 = a + Math.floor(s * count / steps), j1 = Math.max(j0 + 1, a + Math.floor((s + 1) * count / steps)), stride = Math.max(1, Math.floor((j1 - j0) / 256))
    let mn = Infinity, mx = -Infinity
    for (let j = j0; j < j1; j += stride) { const k = ((j % N) + N) % N; for (const c of ch) { const v = c[k]; if (v < mn) mn = v; if (v > mx) mx = v } }      // (the lowest and the highest on any channel, as the app answers for a file)
    lo[s] = mn; hi[s] = mx
  }
  return { from: a, to: b, n: steps, lo, hi }
}
if (typeof module !== 'undefined') module.exports = { makeLoops, makeIR, loopPeaks, loopWave, SND_SR }
