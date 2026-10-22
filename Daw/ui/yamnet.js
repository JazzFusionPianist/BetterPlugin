/* ── the room's ear for what a sound is ──
   His ask (2026-10-22): a producer's tracks are called audio 19; what each one is must be heard. YAMNet (Google, Apache
   2.0: tools/yamnet-make.mjs makes ui/yamnet/) hears 0.96 s of sound at 16 kHz and says how much it is each of AudioSet's
   521 kinds of sound (bass guitar, snare drum, singing, trumpet…). Here it is run in plain arithmetic, as it was built:
   the sound as a picture of 64 mel bands every 10 ms (a 25 ms window, log of the bands), cut in pieces of 96 frames; each
   piece through fourteen layers of a MobileNet (a 3×3 convolution, then thirteen of a 3×3 depthwise and a 1×1 pointwise,
   each with its bias and relu), averaged over the piece, and the 521 scores out of a sigmoid.
   YAM_MODEL(buffer) reads the weights; yamScores(model, pcm at 16 kHz) gives the mean score of every kind over the pieces.
   Plain script: a worker runs it (tidy.js), and tests read it in node. */
function YAM_MODEL (buf) {
  const dv = new DataView(buf), hn = dv.getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hn))), base = 4 + hn, T = {}
  for (const t of head.tensors) {
    const at = base + t.offset, n = t.shape.reduce((a, b) => a * b, 1)
    if (t.dtype === 'f32') T[t.name] = new Float32Array(buf.slice(at, at + n * 4))
    else {                                                                                    // int8 rows, one an output channel, each with its scale
      const outC = t.shape[t.shape.length - 1], per = n / outC, sc = new Float32Array(buf.slice(at, at + outC * 4)), q = new Int8Array(buf, at + outC * 4, n), f = new Float32Array(n)
      for (let o = 0; o < outC; o++) { const s = sc[o], r = o * per; for (let i = 0; i < per; i++) f[r + i] = q[r + i] * s }
      T[t.name] = f
    }
  }
  return { head, T }
}

/* ── the sound as YAMNet sees it: log mel bands, 10 ms apart ── */
function yamFFT (re, im) {                                                                    // in place, a power of two long
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t
      }
    }
  }
}
function yamMel (M, pcm) {
  const h = M.head, win = M.T.window, mel = M.T.mel, B = h.fft / 2 + 1
  /* as YAMNet pads it: at least one whole piece, and whole steps of a piece after it */
  const first = (h.patch - 1) * h.hop + h.win, step = h.patchHop * h.hop
  let len = Math.max(pcm.length, first); len = first + Math.ceil((len - first) / step) * step
  const x = new Float32Array(len); x.set(pcm.subarray(0, len))
  const nF = 1 + Math.floor((len - h.win) / h.hop), out = new Float32Array(nF * h.mel), re = new Float32Array(h.fft), im = new Float32Array(h.fft), mag = new Float32Array(B)
  for (let f = 0; f < nF; f++) {
    re.fill(0); im.fill(0)
    for (let i = 0; i < h.win; i++) re[i] = x[f * h.hop + i] * win[i]
    yamFFT(re, im)
    for (let b = 0; b < B; b++) mag[b] = Math.sqrt(re[b] * re[b] + im[b] * im[b])
    for (let m = 0; m < h.mel; m++) { let s = 0; for (let b = 0; b < B; b++) s += mag[b] * mel[b * h.mel + m]; out[f * h.mel + m] = Math.log(s + h.logOffset) }
  }
  return { frames: nF, data: out }
}

/* ── one piece through the layers (height × width × channels, the channels last) ── */
const yamSame = (n, s) => { const o = Math.ceil(n / s), pad = Math.max((o - 1) * s + 3 - n, 0); return [o, pad >> 1] }
function yamPiece (M, x0) {
  const T = M.T, L = M.head.layers
  let H = M.head.patch, W = M.head.mel, C = 1, x = x0
  /* the first: a 3×3 convolution */
  { const s = L[0].stride, [Ho, pt] = yamSame(H, s), [Wo, pl] = yamSame(W, s), Co = L[0].out, w = T['l1.w'], b = T['l1.b'], y = new Float32Array(Ho * Wo * Co)
    for (let oy = 0; oy < Ho; oy++) for (let ox = 0; ox < Wo; ox++) for (let o = 0; o < Co; o++) {
      let sum = b[o]
      for (let ky = 0; ky < 3; ky++) { const iy = oy * s + ky - pt; if (iy < 0 || iy >= H) continue; for (let kx = 0; kx < 3; kx++) { const ix = ox * s + kx - pl; if (ix < 0 || ix >= W) continue; sum += x[iy * W + ix] * w[o * 9 + ky * 3 + kx] } }
      y[(oy * Wo + ox) * Co + o] = sum > 0 ? sum : 0
    }
    x = y; H = Ho; W = Wo; C = Co }
  for (let k = 1; k < L.length; k++) {
    const l = L[k], n = k + 1, s = l.stride, [Ho, pt] = yamSame(H, s), [Wo, pl] = yamSame(W, s)
    /* depthwise 3×3, a channel at a time */
    const dw = T[`l${n}.dw`], db = T[`l${n}.db`], d = new Float32Array(Ho * Wo * C)
    for (let oy = 0; oy < Ho; oy++) for (let ox = 0; ox < Wo; ox++) {
      const od = (oy * Wo + ox) * C
      for (let c = 0; c < C; c++) d[od + c] = db[c]
      for (let ky = 0; ky < 3; ky++) { const iy = oy * s + ky - pt; if (iy < 0 || iy >= H) continue; for (let kx = 0; kx < 3; kx++) { const ix = ox * s + kx - pl; if (ix < 0 || ix >= W) continue; const id = (iy * W + ix) * C, kk = ky * 3 + kx; for (let c = 0; c < C; c++) d[od + c] += x[id + c] * dw[c * 9 + kk] } }
      for (let c = 0; c < C; c++) if (d[od + c] < 0) d[od + c] = 0
    }
    /* pointwise 1×1: each place a row of channels through the matrix */
    const pw = T[`l${n}.pw`], pb = T[`l${n}.pb`], Co = l.out, y = new Float32Array(Ho * Wo * Co)
    for (let p = 0; p < Ho * Wo; p++) {
      const ip = p * C, op = p * Co
      for (let o = 0; o < Co; o++) {
        const r = o * C
        let s0 = pb[o], s1 = 0, s2 = 0, s3 = 0, c = 0
        for (; c + 3 < C; c += 4) { s0 += d[ip + c] * pw[r + c]; s1 += d[ip + c + 1] * pw[r + c + 1]; s2 += d[ip + c + 2] * pw[r + c + 2]; s3 += d[ip + c + 3] * pw[r + c + 3] }
        for (; c < C; c++) s0 += d[ip + c] * pw[r + c]
        const v = s0 + s1 + s2 + s3
        y[op + o] = v > 0 ? v : 0
      }
    }
    x = y; H = Ho; W = Wo; C = Co
  }
  /* the mean over the piece, then the 521 */
  const g = new Float32Array(C)
  for (let p = 0; p < H * W; p++) for (let c = 0; c < C; c++) g[c] += x[p * C + c] / (H * W)
  const fw = T['fc.w'], fb = T['fc.b'], K = fb.length, out = new Float32Array(K)
  for (let o = 0; o < K; o++) { let s = fb[o]; const r = o * C; for (let c = 0; c < C; c++) s += g[c] * fw[r + c]; out[o] = 1 / (1 + Math.exp(-s)) }
  return out
}
/* every kind's mean score over the pieces of a sound (16 kHz, one channel); and the pieces' own, for those who want them */
function yamScores (M, pcm) {
  const h = M.head, mel = yamMel(M, pcm), pieces = []
  for (let f = 0; f + h.patch <= mel.frames; f += h.patchHop) pieces.push(yamPiece(M, mel.data.subarray(f * h.mel, (f + h.patch) * h.mel)))
  const mean = new Float32Array(pieces.length ? pieces[0].length : 0)
  for (const p of pieces) for (let i = 0; i < mean.length; i++) mean[i] += p[i] / pieces.length
  return { mean, pieces }
}
/* a sound at another rate, to 16 kHz: low-passed under 7.6 kHz (a windowed sinc), then read off where each sample falls */
function yamTo16k (pcm, rate) {
  if (rate === 16000) return pcm
  const r = 16000 / rate, n = Math.floor(pcm.length * r), out = new Float32Array(n), fc = Math.min(.5, 7600 / rate), half = 16
  for (let i = 0; i < n; i++) {
    const t = i / r, c = Math.floor(t)
    let s = 0, wsum = 0
    for (let k = c - half + 1; k <= c + half; k++) {
      if (k < 0 || k >= pcm.length) continue
      const d = t - k, x = 2 * fc * d, sinc = d === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x), w = .5 + .5 * Math.cos(Math.PI * d / half)
      s += pcm[k] * 2 * fc * sinc * w; wsum += 2 * fc * sinc * w
    }
    out[i] = wsum ? s / wsum * (2 * fc) / (2 * fc) : 0
  }
  return out
}
if (typeof module === 'object' && module.exports) module.exports = { YAM_MODEL, yamMel, yamPiece, yamScores, yamTo16k }
