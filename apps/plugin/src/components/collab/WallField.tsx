import { useEffect, useRef } from 'react'
import { hasJuceBridge } from '../../lib/juceBridge'

/*  The wall's field — one shader behind everything.

    A slow, very dark warmth that breathes with what leaves the patch:
    the lows swell it, the highs put grain in it. It is a wall in a dim
    room, not a visualiser: at rest it is almost nothing, and it never
    gets bright. Drawn at a third of the wall's size and stretched, so
    Logic's WebView pays little for it.

    The signal comes from the plugin's audio events (the out samples the
    scope already receives); in a plain browser a slow breath stands in. */

const VERT = `attribute vec2 p; void main () { gl_Position = vec4(p, 0.0, 1.0); }`
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2  u_res;
uniform float u_time;
uniform float u_low, u_mid, u_high, u_level;

float hash (vec2 p) {
  // integer-ish hash: no sin of a large number, so no NaN on a mobile GPU
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise (vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm (vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main () {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 q = uv * vec2(u_res.x / u_res.y, 1.0);
  float t = u_time * 0.035;
  // the field: a slow warp that the lows push wider
  vec2 warp = vec2(fbm(q * 1.4 + vec2(t, -t * 0.7)), fbm(q * 1.4 + vec2(-t * 0.6, t)));
  float field = fbm(q * (1.1 - 0.35 * u_low) + warp * (0.9 + 1.4 * u_low) + vec2(0.0, t * 0.5));
  field = smoothstep(0.35, 0.95, field);
  // grain: the highs bring a fine texture up
  float grain = noise(q * (18.0 + 30.0 * u_high) + t * 40.0) * u_high * 0.5;
  // the room's vignette keeps the edges dark
  float vig = 1.0 - smoothstep(0.35, 0.95, distance(uv, vec2(0.5, 0.48)) * 1.15);
  float a = (0.045 + 0.16 * u_low + 0.05 * u_level) * field + grain * 0.06;
  a *= vig;
  vec3 paper = vec3(0.965, 0.953, 0.918);
  vec3 warm  = vec3(0.98, 0.80, 0.55);
  vec3 col = mix(paper, warm, 0.35 + 0.4 * u_low);
  a = clamp(a, 0.0, 0.32);
  if (!(a == a)) a = 0.0;   // never let a NaN through
  gl_FragColor = vec4(col * a, a);   // premultiplied: WKWebView composites a non-premultiplied canvas as an opaque wash
}`

/** base64 → little-endian float32 samples */
function decode (b64: string): Float32Array {
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const u8 = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return new Float32Array(buf)
}

/** in-place radix-2 FFT on re/im (length a power of two) */
function fft (re: Float32Array, im: Float32Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr
      }
    }
  }
}

const N = 1024

export default function WallField ({ width, height }: { width: number; height: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ring = useRef(new Float32Array(N))
  const wr = useRef(0)
  const sr = useRef(48000)
  const bands = useRef({ low: 0, mid: 0, high: 0, level: 0 })
  const sizeRef = useRef({ width, height }); sizeRef.current = { width, height }   // one context for the canvas's life; the size is read each frame

  // feed: the out samples the plugin sends the scope
  useEffect(() => {
    if (!hasJuceBridge) return
    const onAudio = (e: Event) => {
      const d = (e as CustomEvent).detail as { samples?: string; sr?: number; ch?: number }
      if (!d.samples) return
      if (d.sr) sr.current = d.sr
      const ch = Math.max(1, d.ch ?? 2)
      const f = decode(d.samples)
      const n = Math.floor(f.length / ch)
      const r = ring.current
      for (let i = 0; i < n; i++) { let s2 = 0; for (let c = 0; c < ch; c++) s2 += f[i * ch + c]; r[wr.current] = s2 / ch; wr.current = (wr.current + 1) % N }
    }
    window.addEventListener('__juceDawAudio', onAudio)
    return () => window.removeEventListener('__juceDawAudio', onAudio)
  }, [])

  useEffect(() => {
    const el = canvas.current; if (!el) return
    const gl = el.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false })
    if (!gl) return
    // (dev) StrictMode mounts twice: a context lost by the first pass is brought back, never thrown away
    if (gl.isContextLost()) { gl.getExtension('WEBGL_lose_context')?.restoreContext(); return }
    const mk = (type: number, src: string) => { const sh = gl.createShader(type)!; gl.shaderSource(sh, src); gl.compileShader(sh); return sh }
    const prog = gl.createProgram()!
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u = {
      res: gl.getUniformLocation(prog, 'u_res'), time: gl.getUniformLocation(prog, 'u_time'),
      low: gl.getUniformLocation(prog, 'u_low'), mid: gl.getUniformLocation(prog, 'u_mid'), high: gl.getUniformLocation(prog, 'u_high'), level: gl.getUniformLocation(prog, 'u_level'),
    }
    const re = new Float32Array(N), im = new Float32Array(N)
    let raf = 0
    const t0 = performance.now()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) return
      const now = (performance.now() - t0) / 1000
      // the bands: fast up, slow down
      let low: number, mid: number, high: number, level: number
      if (hasJuceBridge) {
        const r = ring.current; let rms = 0
        for (let i = 0; i < N; i++) {
          const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)
          const s2 = r[(wr.current + i) % N]
          re[i] = s2 * w; im[i] = 0; rms += s2 * s2
        }
        fft(re, im)
        const hz = (k: number) => k * sr.current / N
        const band = (lo: number, hi: number) => {
          let e = 0, c = 0
          for (let k = 1; k < N / 2; k++) { const f = hz(k); if (f >= lo && f < hi) { e += re[k] * re[k] + im[k] * im[k]; c++ } }
          return c > 0 ? Math.sqrt(e / c) : 0
        }
        const shape = (x: number, g: number) => Math.min(1, Math.log10(1 + x * g) / Math.log10(1 + g))
        low = shape(band(30, 160), 40); mid = shape(band(160, 2000), 40); high = shape(band(2000, 10000), 60); level = Math.min(1, Math.sqrt(rms / N) * 2.5)
      } else {
        // a plain browser: a slow breath, so the wall is not dead
        low = 0.25 + 0.2 * Math.sin(now / 3.1); mid = 0.15; high = 0.08 + 0.06 * Math.sin(now / 1.3); level = 0.2
      }
      const b = bands.current
      const ease = (cur: number, target: number) => cur + (target - cur) * (target > cur ? 0.35 : 0.06)
      b.low = ease(b.low, low); b.mid = ease(b.mid, mid); b.high = ease(b.high, high); b.level = ease(b.level, level)
      // a third of the wall: plenty for a field this soft
      const W = Math.max(2, Math.round(sizeRef.current.width / 3)), H = Math.max(2, Math.round(sizeRef.current.height / 3))
      if (el.width !== W || el.height !== H) { el.width = W; el.height = H }
      gl.viewport(0, 0, W, H)
      gl.uniform2f(u.res, W, H); gl.uniform1f(u.time, now)
      gl.uniform1f(u.low, b.low); gl.uniform1f(u.mid, b.mid); gl.uniform1f(u.high, b.high); gl.uniform1f(u.level, b.level)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)   // the canvas goes with the component; the context goes with the canvas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvas} className="sg-field" />
}
