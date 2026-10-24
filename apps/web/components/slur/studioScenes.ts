/* The Slur Studio page's moving parts — every scene drawn from where it is
   in its scroll, a four-bar song made in the browser once play is pressed,
   and the keycaps your own keyboard presses. Mounted on the page's root and
   torn down with it. Draft: apps/web/design/slur studio page draft 1
   (approved 2026-10-24). */

const NS = 'http://www.w3.org/2000/svg', INK = '#ECEAE4', K0 = '#0E0E0E', K1 = '#151514'
type Attrs = Record<string, string | number>

function el<K extends keyof SVGElementTagNameMap> (tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  if (parent) parent.appendChild(e)
  return e
}
const txt = (p: Element, x: number, y: number, s: string, a: Attrs = {}) => {
  const t = el('text', Object.assign({ x, y, fill: INK, 'font-family': 'Instrument Sans, sans-serif', 'font-size': 14 }, a), p)
  t.textContent = s
  return t
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1)
let seed = 11
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

/** The name written stroke by stroke: the SlurMark inside `svg` (its word,
    its arm, then the five strokes of "studio") drawn on with dashes. */
function writeOn (svg: SVGSVGElement, still: boolean) {
  const [word, arm, studio] = Array.from(svg.children) as SVGGElement[]
  const strokes = [word, arm, ...(studio ? Array.from(studio.children) : [])]
  const delay = [0, 1.4, .6, 1.1, 1.5, 1.7, 1.8]
  strokes.forEach((g, k) => {
    if (!g) return
    for (const p of Array.from(g.querySelectorAll('path'))) {
      const L = p.getTotalLength()
      p.style.strokeDasharray = String(L)
      p.style.strokeDashoffset = still ? '0' : String(L)
      if (still) continue
      p.style.transition = `stroke-dashoffset ${k === 1 ? 1.1 : 1.6}s cubic-bezier(.6,.05,.3,1) ${delay[k] ?? 1}s`
    }
  })
  svg.classList.add('ready')
  if (!still) requestAnimationFrame(() => requestAnimationFrame(() => { for (const p of Array.from(svg.querySelectorAll('path'))) p.style.strokeDashoffset = '0' }))
}

export function mountStudio (root: HTMLElement): () => void {
  const $ = <T extends Element = HTMLElement>(id: string) => root.querySelector(`#${id}`) as T
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  const offs: (() => void)[] = []
  const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, capture = false) => {
    addEventListener(type, fn, capture); offs.push(() => removeEventListener(type, fn, capture))
  }
  seed = 11
  /* what is built here goes with it, so a second mount starts from the same empty page */
  const built = ['staff', 'tidySvg', 'tpSvg', 'rubSvg', 'docSvg', 'roughSvg', 'patchSvg', 'caps', 'sets'].map(id => $<Element>(id))
  const name = root.querySelector('.ss-name') as SVGSVGElement
  offs.push(() => { for (const e of built) e.replaceChildren(); name.classList.remove('ready') })

  writeOn(name, still)

  /* ── the music: a four-bar loop at 92, made here (WebAudio), only once play is pressed ── */
  const BPM = 92, BEAT = 60 / BPM, BAR = 4 * BEAT
  const A = { ctx: null as AudioContext | null, bus: null as GainNode | null, noise: null as AudioBuffer | null, on: false, t0: 0, next: 0, step: 0, timer: 0 }
  const CHORDS = [[50, 53, 57, 60, 64], [53, 59, 64, 68], [52, 55, 59, 62, 67], [55, 61, 65, 70]], ROOTS = [38, 43, 36, 45]
  const voice = (type: OscillatorType, f: number, t: number, len: number, g: number, o: { drop?: number; dropT?: number; lp?: number; att?: number } = {}) => {
    const c = A.ctx!, osc = c.createOscillator(), v = c.createGain(); osc.type = type; osc.frequency.setValueAtTime(f, t)
    if (o.drop) osc.frequency.exponentialRampToValueAtTime(o.drop, t + o.dropT!)
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + (o.att || .005)); v.gain.exponentialRampToValueAtTime(0.0001, t + len)
    let n: AudioNode = osc
    if (o.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; osc.connect(f2); n = f2 }
    n.connect(v); v.connect(A.bus!); osc.start(t); osc.stop(t + len + .05)
  }
  const noise = (t: number, len: number, g: number, hp: number, bp?: number) => {
    const c = A.ctx!, src = c.createBufferSource(); src.buffer = A.noise
    const f = c.createBiquadFilter(); f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = bp || hp; if (bp) f.Q.value = .8
    const v = c.createGain(); v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0001, t + len)
    src.connect(f); f.connect(v); v.connect(A.bus!); src.start(t); src.stop(t + len + .02)
  }
  const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
  const schedule = (s: number, t: number) => {                                  // one sixteenth: s from 0 to 63 over four bars
    const bar = Math.floor(s / 16), q = s % 16
    if (q === 0 || q === 8 || q === 10 || (bar === 3 && q === 14)) voice('sine', 130, t, .42, .9, { drop: 42, dropT: .11 })      // kick
    if (q === 4 || q === 12) { noise(t, .2, .35, 0, 1900); voice('triangle', 190, t, .12, .25) }                                     // snare
    if (q % 2 === 0) noise(t, q % 4 === 2 ? .07 : .035, q % 4 === 2 ? .09 : .05, 7500)                                             // hats
    if ([0, 3, 6, 8, 11, 14].includes(q)) voice('sawtooth', mtof(ROOTS[bar] + (q === 11 ? 12 : 0)), t, BEAT * .45, .16, { lp: 420, att: .01 })      // bass
    if (q === 0) for (const m of CHORDS[bar]) voice('triangle', mtof(m), t, BAR * .95, .035, { att: .25, lp: 1800 })                              // keys
  }
  const tick = () => {
    const c = A.ctx!, ahead = .12, sx = BEAT / 4
    while (A.next < c.currentTime + ahead) { schedule(A.step % 64, A.next); A.next += sx; A.step++ }
  }
  const playToggle = async () => {
    if (!A.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const c = A.ctx = new Ctx()
      A.noise = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = A.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3
      A.bus = c.createGain(); A.bus.gain.value = .55; A.bus.connect(comp); comp.connect(c.destination)
    }
    if (A.ctx.state === 'suspended') await A.ctx.resume()
    A.on = !A.on
    if (A.on) { A.t0 = A.ctx.currentTime + .05; A.next = A.t0; A.step = 0; A.timer = window.setInterval(tick, 25) }
    else clearInterval(A.timer)
    $('playTri').setAttribute('fill', A.on ? INK : 'none')
    $('play').setAttribute('aria-label', A.on ? 'stop' : 'play')
  }
  const playBtn = $('play'), onPlay = () => { void playToggle() }
  playBtn.addEventListener('click', onPlay); offs.push(() => playBtn.removeEventListener('click', onPlay))
  on('keydown', e => { if (e.code === 'Space' && !e.repeat && !e.metaKey && !e.ctrlKey) { e.preventDefault(); void playToggle() } })
  offs.push(() => { clearInterval(A.timer); void A.ctx?.close() })
  /* the song's place: from the music while it plays, else still at the start */
  const songBars = () => A.on && A.ctx ? Math.max(0, (A.ctx.currentTime - A.t0) / BAR) : 0
  let lastBeat = -1

  /* ── 0: a staff behind the name, and notes on it that answer the beat ── */
  const staff = $<SVGSVGElement>('staff'), NOTES: SVGGElement[] = []
  const drawStaff = () => {
    staff.innerHTML = ''; NOTES.length = 0
    const W = innerWidth, H = innerHeight; staff.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const y0 = H * .5 - 52
    for (let k = 0; k < 5; k++) el('line', { x1: 0, x2: W, y1: y0 + k * 26, y2: y0 + k * 26, stroke: INK, 'stroke-opacity': .07 }, staff)
    const cols = ['#5C80FF', '#3FB872', '#F89C38', '#B79CFF', '#F27BA6', '#E5B73B']
    for (let i = 0; i < 9; i++) {
      const x = W * (.06 + i * .11), y = y0 + ((i * 5) % 9) * 13, g = el('g', { transform: `translate(${x} ${y})` }, staff)
      el('ellipse', { cx: 0, cy: 0, rx: 15, ry: 10.5, transform: 'rotate(-22)', fill: cols[i % 6], 'fill-opacity': 0 }, g); NOTES.push(g)
    }
  }
  drawStaff(); on('resize', drawStaff)

  /* ── 1: tidy — the regions as they came, flung about; they fall into lanes, and the lanes sort themselves ── */
  interface Reg { rg: SVGGElement; body: SVGRectElement; bars: SVGRectElement[]; a: number; w: number; fling: { x: number; y: number; r: number; s: number } }
  interface Lane { raw: string; name: string; fam: string; c: string; d: string; at: number; regs: [number, number][] }
  const tidySvg = $<SVGSVGElement>('tidySvg')
  el('rect', { x: 0, y: 0, width: 1440, height: 900, fill: K0 }, tidySvg)
  const LANES: Lane[] = [
    { raw: 'Audio 12', name: 'riser', fam: 'effects', c: '#D1C7B0', d: '#322D22', at: 8, regs: [[7, 9], [15, 17]] },
    { raw: 'VOX comp 3', name: 'lead vox', fam: 'voice', c: '#DF716A', d: '#400707', at: 6, regs: [[5, 11], [11, 17], [19, 25]] },
    { raw: 'Audio 1', name: 'kick', fam: 'drums', c: '#213E97', d: '#000326', at: 0, regs: [[1, 9], [9, 17], [17, 25]] },
    { raw: 'keys bounce v2', name: 'keys', fam: 'keys', c: '#338B69', d: '#001004', at: 4, regs: [[1, 13], [13, 25]] },
    { raw: 'snr_top_FINAL', name: 'snare', fam: 'drums', c: '#3B79B8', d: '#000326', at: 1, regs: [[5, 9], [9, 17], [17, 25]] },
    { raw: 'Bass DI (1)', name: 'bass', fam: 'bass', c: '#784A99', d: '#10001E', at: 3, regs: [[1, 9], [9, 17], [17, 25]] },
    { raw: 'GTR L', name: 'guitar', fam: 'guitar', c: '#C07E2B', d: '#2F0F00', at: 5, regs: [[5, 13], [13, 21]] },
    { raw: 'bgv stack', name: 'bgv', fam: 'voice', c: '#E58F86', d: '#400707', at: 7, regs: [[9, 17], [21, 25]] },
    { raw: 'Audio 7', name: 'hats', fam: 'drums', c: '#71B0D6', d: '#001A2E', at: 2, regs: [[3, 17], [19, 25]] },
  ]
  const TX0 = 300, TX1 = 1400, PX = (TX1 - TX0) / 24, TOP = 128, LH = 52, tbx = (b: number) => TX0 + (b - 1) * PX
  const tGrid = el('g', {}, tidySvg)
  for (let b = 1; b <= 25; b++) el('line', { x1: tbx(b), x2: tbx(b), y1: TOP - 20, y2: TOP + 9 * LH, stroke: INK, 'stroke-opacity': b % 4 === 1 ? .09 : .035 }, tGrid)
  const tLanes = LANES.map((L, i) => {
    const g = el('g', {}, tidySvg), nm = txt(g, 60, 0, L.raw, { 'font-size': 20, 'fill-opacity': .55 })
    const bar = el('rect', { x: 34, y: -14, width: 5, height: 28, fill: '#6E6B63' }, g)
    const regs: Reg[] = L.regs.map(([a, b]) => {
      const w = (b - a) * PX - 3, rg = el('g', {}, tidySvg), h = LH - 14
      const body = el('rect', { x: 0, y: -h / 2, width: w, height: h, rx: L.fam === 'voice' || L.fam === 'effects' ? 7 : 0, fill: '#3A3A38' }, rg)
      const bars: SVGRectElement[] = []
      for (let px = 4; px < w - 4; px += 3) {
        const k = px / w, beat = L.fam === 'drums' ? (Math.floor(px / (PX / 4)) % 2 ? .3 : 1) : .65 + .35 * Math.sin(k * 9 + i)
        const hh = Math.max(2, (rnd() * .5 + .5) * (h - 10) * beat * (L.fam === 'effects' ? k : 1))
        bars.push(el('rect', { x: px, y: -hh / 2, width: 1.4, height: hh, fill: K0, opacity: .7 }, rg))
      }
      const fling = { x: 80 + rnd() * 1250, y: 80 + rnd() * 740, r: (rnd() - .5) * 70, s: .7 + rnd() * .5 }
      return { rg, body, bars, a, w, fling }
    })
    return { ...L, g, nm, bar, regs, raw0: i }
  })
  const tPh = el('line', { x1: 0, x2: 0, y1: TOP - 26, y2: TOP + 9 * LH, stroke: INK, 'stroke-width': 2, opacity: 0 }, tidySvg)
  const tMarkers = el('g', { opacity: 0 }, tidySvg)
  ;['intro', 'verse', 'pre', 'chorus', 'verse 2', 'chorus'].forEach((m, k) => {
    const x = tbx([1, 5, 9, 13, 17, 21][k])
    el('rect', { x: x + .5, y: TOP - 70, width: 4 * PX - 1, height: 28, fill: K1, stroke: INK, 'stroke-opacity': .25 }, tMarkers); txt(tMarkers, x + 10, TOP - 51, m, { 'font-size': 15 })
  })
  const drawTidy = (p: number) => {
    const fly = seg(p, .02, .42), sort = seg(p, .46, .72), paint = seg(p, .5, .8), play = seg(p, .78, 1)
    tGrid.setAttribute('opacity', String(fly))
    tLanes.forEach((L, i) => {
      const row = lerp(L.raw0, L.at, ease(sort)), y = TOP + row * LH + LH / 2
      L.g.setAttribute('transform', `translate(0 ${y})`); L.g.setAttribute('opacity', String(seg(fly, .5, 1)))
      L.nm.textContent = sort > .5 ? L.name : L.raw; L.nm.setAttribute('fill-opacity', sort > .5 ? '1' : '.55')
      const ink = paint > 0 ? TX0 + paint * (TX1 - TX0) * 1.2 : 0
      L.bar.setAttribute('fill', paint > .1 ? L.c : '#6E6B63')
      L.regs.forEach((R, k) => {
        const t = ease(seg(fly, (i * 3 + k) / 40, .55 + (i * 3 + k) / 60)), fx = R.fling
        const x = lerp(fx.x, tbx(R.a) + 1.5, t), yy = lerp(fx.y, y, t), r = lerp(fx.r, 0, t), sc = lerp(fx.s, 1, t)
        R.rg.setAttribute('transform', `translate(${x.toFixed(1)} ${yy.toFixed(1)}) rotate(${r.toFixed(2)}) scale(${sc.toFixed(3)})`)
        const lit = ink > 0 && tbx(R.a) < ink
        R.body.setAttribute('fill', lit ? L.c : '#3A3A38'); for (const b of R.bars) b.setAttribute('fill', lit ? L.d : K0)
      })
    })
    tPh.setAttribute('opacity', play > 0 ? '1' : '0'); tPh.setAttribute('transform', `translate(${lerp(TX0, TX1, play)} 0)`)
    tMarkers.setAttribute('opacity', String(seg(p, .74, .82)))
    $('tidyWord').classList.toggle('on', p > .5)
  }

  /* ── 2: the transport, as big as a poster: the place counts with the scroll (or with the music) ── */
  const tp = $<SVGSVGElement>('tpSvg'), RED = '#D8432E'
  el('path', { d: 'M90 110L210 180L90 250Z', fill: INK }, tp); el('rect', { x: 260, y: 116, width: 60, height: 60, fill: INK }, tp); el('circle', { cx: 290, cy: 226, r: 27, fill: 'none', stroke: RED, 'stroke-width': 3 }, tp)
  const tpBar = txt(tp, 70, 600, '1', { 'font-size': 380, 'font-weight': 500, 'letter-spacing': '-22' })
  const tpSub = txt(tp, 400, 590, '.1.1', { 'font-size': 64 }), tpTick = txt(tp, 520, 590, '.001', { 'font-size': 40, 'fill-opacity': .7 })
  const tpTime = txt(tp, 82, 668, '00:00:00:00', { 'font-size': 30 }); txt(tp, 280, 668, '30 fps', { 'font-size': 20, 'fill-opacity': .5 })
  el('rect', { x: 760, y: 120, width: 130, height: 130, fill: 'none', stroke: INK, 'stroke-width': 3 }, tp); txt(tp, 825, 202, '4/4', { 'font-size': 42, 'font-weight': 500, 'text-anchor': 'middle' })
  const tpBeats = [0, 1, 2, 3].map(k => el('rect', { x: 762 + k * 32, y: 270, width: 22, height: 22, fill: 'none', stroke: INK, 'stroke-width': 2.5 }, tp))
  const dx = 1110, dy = 230
  for (let k = 0; k < 60; k++) {
    const a = k / 60 * Math.PI * 2, r1 = k % 15 ? 124 : 112
    el('line', { x1: dx + Math.sin(a) * 134, y1: dy - Math.cos(a) * 134, x2: dx + Math.sin(a) * r1, y2: dy - Math.cos(a) * r1, stroke: INK, 'stroke-opacity': .5, 'stroke-width': 2 }, tp)
  }
  txt(tp, dx - 12, dy + 26, '92', { 'font-size': 96, 'font-weight': 500, 'text-anchor': 'middle' }); txt(tp, dx + 52, dy + 26, '.00', { 'font-size': 32 }); txt(tp, dx, dy + 72, 'bpm', { 'font-size': 26, 'fill-opacity': .7, 'text-anchor': 'middle' })
  const tpDot = el('circle', { cx: dx, cy: dy + 134, r: 7, fill: INK }, tp)
  const tpTri = el('path', { d: 'M0 -70L62 52H-62Z', fill: '#E5B73B', transform: 'translate(800 470)' }, tp)
  el('rect', { x: 709, y: 546, width: 182, height: 38, fill: INK }, tp); txt(tp, 723, 573, 'cycle 17 to 25', { 'font-size': 21, fill: K1 })
  el('path', { d: 'M1000 520A110 110 0 1 1 1220 520', fill: 'none', stroke: '#2B2B2A', 'stroke-width': 22 }, tp)
  const tpArc = el('path', { d: '', fill: 'none', stroke: INK, 'stroke-width': 3 }, tp)
  const tpKnob = el('rect', { x: 0, y: 0, width: 20, height: 20, fill: INK }, tp)
  txt(tp, 1110, 526, '−4.2', { 'font-size': 58, 'font-weight': 500, 'text-anchor': 'middle' }); txt(tp, 1110, 564, 'out', { 'font-size': 24, 'fill-opacity': .7, 'text-anchor': 'middle' })
  const drawTransport = (p: number, bars: number) => {
    const bar = 1 + (A.on ? bars % 24 : p * 23.99), whole = Math.floor(bar), fr = bar - whole, beat = Math.floor(fr * 4), six = Math.floor(fr * 16) % 4, tk = Math.floor(fr * 3840) % 240, sec = (bar - 1) * BAR
    tpBar.textContent = String(whole); const wb = tpBar.getComputedTextLength()
    tpSub.textContent = `.${beat + 1}.${six + 1}`; tpSub.setAttribute('x', String(70 + wb + 10))
    tpTick.textContent = '.' + String(tk + 1).padStart(3, '0'); tpTick.setAttribute('x', String(70 + wb + 10 + tpSub.getComputedTextLength() + 6))
    const pad = (v: number) => String(Math.floor(v)).padStart(2, '0'); tpTime.textContent = `${pad(sec / 3600)}:${pad(sec / 60 % 60)}:${pad(sec % 60)}:${pad(sec % 1 * 30)}`
    tpBeats.forEach((q, k) => q.setAttribute('fill', k === beat ? INK : 'none'))
    const a = (bar - 1) * Math.PI / 2; tpDot.setAttribute('cx', String(dx + Math.sin(a) * 134)); tpDot.setAttribute('cy', String(dy + Math.cos(a) * 134))
    tpTri.setAttribute('transform', `translate(800 470) rotate(${(bar - 1) * 15})`)
    const lv = .55 + .25 * Math.sin(bar * 2.1) + (beat === 0 ? .08 : 0), ang = Math.PI * (1 + lv), ex = 1110 + Math.cos(ang) * 110, ey = 520 + Math.sin(ang) * 110
    tpArc.setAttribute('d', `M1000 520A110 110 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`); tpKnob.setAttribute('x', String(ex - 10)); tpKnob.setAttribute('y', String(ey - 10))
    $('tpWord').classList.toggle('on', p > .15)
  }

  /* ── 3: rubato — the pins fall, then the time between them is pulled ── */
  const rub = $<SVGSVGElement>('rubSvg'); el('rect', { x: 0, y: 0, width: 1440, height: 900, fill: K0 }, rub)
  const ry = 560, rh = 230, rx0 = 80, rx1 = 1360
  el('rect', { x: rx0, y: ry - rh / 2, width: rx1 - rx0, height: rh, rx: 18, fill: '#DF716A' }, rub)
  const rBars: { f: number; r: SVGRectElement }[] = []; seed = 3
  const words = [[0, .14], [.18, .33], [.37, .52], [.56, .72], [.76, .96]]
  for (let k = 0; k < 360; k++) {
    const f = k / 360, inWord = words.find(([a, b]) => f >= a && f <= b), env = inWord ? Math.sin(Math.PI * (f - inWord[0]) / (inWord[1] - inWord[0])) : .04
    const hh = Math.max(2, (rnd() * .45 + .55) * (rh - 30) * env)
    rBars.push({ f, r: el('rect', { x: 0, y: ry - hh / 2, width: 2, height: hh, fill: '#400707' }, rub) })
  }
  const rPins = [0, .18, .37, .56, .76, 1].map(f => ({ f, g: el('g', {}, rub) }))
  for (const P of rPins) { el('line', { x1: 0, x2: 0, y1: ry - rh / 2 - 34, y2: ry + rh / 2 + 8, stroke: INK, 'stroke-width': 3 }, P.g); el('rect', { x: -9, y: ry - rh / 2 - 52, width: 18, height: 18, fill: INK }, P.g) }
  const rTo = [0, .14, .41, .58, .80, 1]                                       // where the pins are pulled to: a late first word, a pushed third
  const drawRubato = (p: number) => {
    const drop = seg(p, .05, .35), pull = ease(seg(p, .4, .85))
    const P = rPins.map((q, i) => [q.f, lerp(q.f, rTo[i], pull)])
    const map = (f: number) => { for (let i = 1; i < P.length; i++) if (f <= P[i][0]) { const [a, A0] = P[i - 1], [b, B0] = P[i]; return A0 + (f - a) / (b - a) * (B0 - A0) } return f }
    for (const B of rBars) B.r.setAttribute('x', (rx0 + 8 + map(B.f) * (rx1 - rx0 - 16)).toFixed(1))
    rPins.forEach((Q, i) => {
      const t = ease(seg(drop, i / 8, i / 8 + .4)), x = rx0 + 8 + map(Q.f) * (rx1 - rx0 - 16)
      Q.g.setAttribute('transform', `translate(${x.toFixed(1)} ${lerp(-500, 0, t).toFixed(1)})`); Q.g.setAttribute('opacity', String(t))
    })
    $('rubWord').classList.toggle('on', p > .2)
  }

  /* ── 4: the doctor — two sounds in the same place, found, and one of them ducked ── */
  const doc = $<SVGSVGElement>('docSvg')
  const X = (f: number) => 120 + Math.log(f / 21) / Math.log(400 / 21) * 760, Y0 = 760
  const curve = (c: number, w: number, g: number) => { let d = ''; for (let k = 0; k <= 120; k++) { const f = 21 * Math.pow(400 / 21, k / 120), v = g * Math.exp(-Math.pow(Math.log(f / c) / w, 2)); d += (k ? 'L' : 'M') + X(f).toFixed(1) + ' ' + (Y0 - v).toFixed(1) } return d }
  el('line', { x1: 120, x2: 880, y1: Y0, y2: Y0, stroke: INK, 'stroke-opacity': .6 }, doc)
  for (const [f, w] of [[21, '21 hz'], [92, '92 hz'], [400, '400 hz']] as const) txt(doc, X(f) - 20, Y0 + 34, w, { 'font-size': 20, 'fill-opacity': .7 })
  const dBand = el('rect', { x: X(63), y: Y0 - 420, width: X(100) - X(63), height: 420, fill: '#E5B73B', opacity: 0 }, doc)
  const dKick = el('path', { d: curve(80, .55, 380) + `L${X(400)} ${Y0}L${X(21)} ${Y0}Z`, fill: '#213E97' }, doc)
  const dBass = el('path', { d: curve(95, .75, 360), fill: 'none', stroke: '#B57BE0', 'stroke-width': 5, 'stroke-linejoin': 'round' }, doc)
  dKick.style.clipPath = 'inset(0 100% 0 0)'
  const dBL = dBass.getTotalLength(); dBass.style.strokeDasharray = String(dBL)
  const key = el('g', { transform: 'translate(0 712)' }, doc)
  el('rect', { x: 140, y: 120, width: 18, height: 18, fill: '#213E97' }, key); txt(key, 168, 136, 'kick', { 'font-size': 22 })
  el('line', { x1: 250, x2: 276, y1: 129, y2: 129, stroke: '#B57BE0', 'stroke-width': 5 }, key); txt(key, 286, 136, 'bass', { 'font-size': 22 })
  const dFound = el('g', { opacity: 0, transform: 'translate(0 170)' }, doc)
  el('rect', { x: 950, y: 150, width: 52, height: 52, fill: INK }, dFound); txt(dFound, 976, 189, '1', { 'font-size': 34, 'font-weight': 600, fill: K1, 'text-anchor': 'middle' })
  txt(dFound, 1022, 176, 'kick and bass meet', { 'font-size': 34, 'font-weight': 500 }); txt(dFound, 1022, 210, 'chorus 17–24', { 'font-size': 20, 'fill-opacity': .7 })
  const dPct = txt(dFound, 1022, 270, '72% together', { 'font-size': 26 })
  const dWay = el('g', { opacity: 0, transform: 'translate(0 170)' }, doc)
  el('rect', { x: 950, y: 330, width: 52, height: 52, fill: INK }, dWay); txt(dWay, 976, 368, 'B', { 'font-size': 34, 'font-weight': 600, fill: K1, 'text-anchor': 'middle' })
  txt(dWay, 1022, 356, 'duck the bass', { 'font-size': 34, 'font-weight': 500 }); txt(dWay, 1022, 390, 'whole band −4.0 dB while the kick plays', { 'font-size': 20, 'fill-opacity': .7 })
  const dHeard = txt(dWay, 1022, 440, 'heard 0.0 dB', { 'font-size': 26, fill: '#E5484D' })
  const drawDoctor = (p: number, bars: number) => {
    const draw = seg(p, .02, .3), find = seg(p, .32, .45), duck = ease(seg(p, .55, .85))
    dKick.style.clipPath = `inset(0 ${(100 - draw * 100).toFixed(1)}% 0 0)`; dBass.style.strokeDashoffset = String(dBL * (1 - draw))
    const beatPulse = A.on ? Math.pow(1 - ((bars * 4) % 1), 3) : 0
    dBand.setAttribute('opacity', (find * (.25 + .2 * beatPulse) * (1 - duck * .7)).toFixed(3))
    dBass.setAttribute('d', curve(95, .75, 360 - duck * (150 + 30 * beatPulse)))
    dFound.setAttribute('opacity', String(find)); dWay.setAttribute('opacity', String(seg(p, .5, .58)))
    dPct.textContent = `${Math.round(72 - duck * 49)}% together`; dHeard.textContent = `heard −${(duck * 4.1).toFixed(1)} dB`
    $('docWord').classList.toggle('on', p > .1)
  }

  /* ── 5: the rough mix — the tracks in the room, front to back, left to right: up front, one room, wide ── */
  const rough = $<SVGSVGElement>('roughSvg'), cx = 1070, top = 150, RW = 540, RH = 520
  el('rect', { x: cx - RW / 2, y: top, width: RW, height: RH, fill: '#1B1B1A' }, rough)
  const mInner = el('rect', { x: cx - RW / 2 + 70, y: top + 50, width: RW - 140, height: RH - 180, fill: '#232322', opacity: 0 }, rough)
  const mFrame = el('rect', { x: cx - RW / 2, y: top, width: RW, height: RH, fill: 'none', stroke: INK, 'stroke-width': 3, opacity: 0 }, rough)
  txt(rough, cx - RW / 2 + 14, top + 26, 'back', { 'font-size': 17, 'fill-opacity': .45 }); txt(rough, cx - RW / 2 + 14, top + RH - 14, 'front', { 'font-size': 17, 'fill-opacity': .45 })
  ;['l', 'c', 'r'].forEach((c, k) => txt(rough, cx - RW / 2 + k * RW / 2 - (k === 2 ? 10 : k ? 4 : 0), top + RH + 30, c, { 'font-size': 18, 'fill-opacity': .5 }))
  const mLetter = txt(rough, cx - RW / 2, top - 30, 'A', { 'font-size': 64, 'font-weight': 600 }), mName = txt(rough, cx - RW / 2 + 64, top - 40, 'up front', { 'font-size': 30, 'font-weight': 500 })
  /* each track: its number, its colour, and where it stands in A, B and C (x −1…1 across, y 0 back…1 front, and a width for the wide ones) */
  type At = [number, number] | [number, number, number]
  const TR: [string, string, At, At, At][] = [['01', '#213E97', [0, .78], [0, .7], [.05, .62]], ['02', '#3B79B8', [.03, .62], [0, .36], [.15, .55]], ['03', '#71B0D6', [-.28, .58], [-.2, .3], [-.42, .5]], ['04', '#784A99', [0, .86], [0, .8], [0, .8]],
    ['05', '#338B69', [-.05, .56, .36], [-.1, .33, .5], [-.2, .3, 1.5]], ['06', '#C07E2B', [-.52, .6], [-.25, .35], [-.8, .3]], ['07', '#DF716A', [0, .93], [0, .62], [0, .75]], ['08', '#D1C7B0', [-.15, .38, .6], [-.1, .12, .8], [-.1, .06, 1.6]]]
  const mTracks = TR.map(([n, c, a, b, cc]) => {
    const g = el('g', {}, rough), wide = a.length > 2
    const shape = wide ? el('rect', { x: -100, y: -9, width: 200, height: 18, fill: c }, g) : el('circle', { r: 26, fill: c }, g)
    txt(g, wide ? -92 : 0, 6, n, { 'font-size': 16, 'font-weight': 600, fill: n === '08' ? K1 : INK, 'text-anchor': wide ? 'start' : 'middle' })
    return { g, shape, wide, at: [a, b, cc] }
  })
  const WAYS = [['A', 'up front'], ['B', 'one room'], ['C', 'wide']]
  const drawRough = (p: number, bars: number) => {
    const s = p * 2, k = Math.min(1, Math.floor(s)), f = clamp(s - k, 0, 1), t = ease(f < .55 ? 0 : (f - .55) / .45), cur = t > .5 ? k + 1 : k
    mLetter.textContent = WAYS[cur][0]; mName.textContent = WAYS[cur][1]
    mInner.setAttribute('opacity', cur === 1 ? '1' : '0'); mFrame.setAttribute('opacity', cur === 1 ? '1' : '0')
    const pulse = A.on ? Math.pow(1 - ((bars * 4) % 1), 4) : 0
    for (const R of mTracks) {
      const a = R.at[k], b = R.at[Math.min(2, k + 1)], x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), w = lerp(a[2] ?? 1, b[2] ?? 1, t)
      R.g.setAttribute('transform', `translate(${(cx + x * RW / 2 * .9).toFixed(1)} ${(top + y * RH).toFixed(1)}) scale(${R.wide ? 1 : (1 + pulse * .12).toFixed(3)})`)
      if (R.wide) { R.shape.setAttribute('width', String(200 * w)); R.shape.setAttribute('x', String(-100 * w)) }
    }
    $('roughWord').classList.toggle('on', p > .1)
  }

  /* ── 6: the patch — prints on the wall, wired, each doing its thing ── */
  const patch = $<SVGSVGElement>('patchSvg'), py = 420
  const wires: { w: SVGPathElement; L: number }[] = []
  const wire = (d: string) => { wires.push({ w: el('path', { d, fill: 'none', stroke: INK, 'stroke-width': 2.4, 'stroke-opacity': .85 }, patch), L: 0 }) }
  wire(`M120 ${py}H330`); wire(`M470 ${py}C540 ${py} 560 ${py - 140} 640 ${py - 140}`); wire(`M470 ${py}C540 ${py} 560 ${py + 140} 640 ${py + 140}`)
  wire(`M800 ${py - 140}C880 ${py - 140} 880 ${py} 940 ${py}`); wire(`M800 ${py + 140}C880 ${py + 140} 880 ${py} 940 ${py}`); wire(`M1040 ${py}H1140`); wire(`M1260 ${py}H1340`)
  for (const [x, w] of [[120, 'in'], [1340, 'out']] as const) { el('circle', { cx: x, cy: py, r: 9, fill: K0, stroke: INK, 'stroke-width': 2.4 }, patch); txt(patch, x - 8, py + 38, w, { 'font-size': 20, 'fill-opacity': .7 }) }
  /* tape: an orange plate with two reels for eyes */
  const tape = el('g', {}, patch); el('rect', { x: -70, y: -70, width: 140, height: 140, fill: '#E07B3C' }, tape)
  const eyes = [-30, 30].map(ex => { const g = el('g', {}, tape); g.dataset.at = `translate(${ex} -12)`; g.setAttribute('transform', g.dataset.at); el('circle', { r: 22, fill: 'none', stroke: '#FBFAF7', 'stroke-width': 5 }, g); el('circle', { r: 6, fill: '#FBFAF7' }, g); return g })
  el('path', { d: 'M-46 30Q0 50 46 30', fill: 'none', stroke: '#FBFAF7', 'stroke-width': 5, 'stroke-linecap': 'round' }, tape)
  txt(patch, 400, py + 104, 'tape', { 'font-size': 22, 'font-weight': 600, 'text-anchor': 'middle' }); txt(patch, 400, py + 130, 'hard 24', { 'font-size': 18, 'fill-opacity': .6, 'text-anchor': 'middle' })
  /* space: a blue disc of rings */
  const space = el('g', {}, patch); el('circle', { r: 70, fill: '#5C80FF' }, space)
  const RINGS = [18, 32, 46, 58], rings = RINGS.map(r => el('circle', { r, fill: 'none', stroke: '#FBFAF7', 'stroke-width': 2.4, 'stroke-opacity': .8 }, space)); el('circle', { r: 6, fill: '#FBFAF7' }, space)
  txt(patch, 720, py - 40, 'space', { 'font-size': 22, 'font-weight': 600, 'text-anchor': 'middle' }); txt(patch, 720, py - 14, 'hall 30', { 'font-size': 18, 'fill-opacity': .6, 'text-anchor': 'middle' })
  /* delay: a teal disc of fading bars */
  const delay = el('g', {}, patch); el('circle', { r: 70, fill: '#3E9E96' }, delay)
  const taps = [0, 1, 2, 3, 4, 5].map(k => el('rect', { x: -38 + k * 13, y: -30 + k * 4, width: 6, height: 60 - k * 8, fill: '#FBFAF7' }, delay))
  txt(patch, 720, py + 244, 'delay', { 'font-size': 22, 'font-weight': 600, 'text-anchor': 'middle' }); txt(patch, 720, py + 270, 'clean 20', { 'font-size': 18, 'fill-opacity': .6, 'text-anchor': 'middle' })
  /* mix: two lines become one */
  el('path', { d: `M940 ${py - 30}C980 ${py - 30} 980 ${py} 1000 ${py}M940 ${py + 30}C980 ${py + 30} 980 ${py} 1000 ${py}M1000 ${py}H1040`, fill: 'none', stroke: '#F3E6C8', 'stroke-width': 5, 'stroke-linecap': 'round' }, patch)
  const mixDot = el('circle', { cx: 1000, cy: py, r: 9, fill: '#F3E6C8' }, patch); txt(patch, 990, py + 70, 'mix', { 'font-size': 22, 'font-weight': 600, 'text-anchor': 'middle' })
  /* a plug-in of the mac's own, in the same patch */
  el('rect', { x: 1140, y: py - 60, width: 120, height: 120, fill: '#1B1B1A', stroke: INK, 'stroke-opacity': .5, 'stroke-width': 2 }, patch); el('rect', { x: 1240, y: py - 52, width: 10, height: 10, fill: INK }, patch)
  txt(patch, 1200, py + 8, 'comp', { 'font-size': 22, 'text-anchor': 'middle' }); txt(patch, 1200, py + 104, 'au', { 'font-size': 18, 'fill-opacity': .6, 'text-anchor': 'middle' })
  for (const W of wires) { W.L = W.w.getTotalLength(); W.w.style.strokeDasharray = String(W.L); W.w.style.strokeDashoffset = String(W.L) }
  const prints = [[tape, `translate(400 ${py})`], [space, `translate(720 ${py - 140})`], [delay, `translate(720 ${py + 140})`]] as const
  const drawPatch = (p: number, bars: number, now: number) => {
    const wd = seg(p, .05, .45)
    wires.forEach((W, i) => { W.w.style.strokeDashoffset = String(W.L * (1 - seg(wd, i / 9, i / 9 + .4))) })
    prints.forEach(([g, at], i) => { const t = ease(seg(p, .02 + i * .08, .25 + i * .08)); g.setAttribute('transform', `${at} scale(${(.3 + .7 * t).toFixed(3)})`); g.setAttribute('opacity', String(t)) })
    const b = A.on ? bars * 4 : now / 650, ph = b % 1, beat = Math.floor(b)
    rings.forEach((r, k) => { r.setAttribute('r', Math.min(66, RINGS[k] + ph * 14).toFixed(1)); r.setAttribute('stroke-opacity', (.85 * (1 - ph * .6)).toFixed(2)) })
    taps.forEach((r, k) => r.setAttribute('opacity', k === beat % 6 ? '1' : '.35'))
    const blink = (now % 3600) < 140
    for (const e of eyes) e.setAttribute('transform', `${e.dataset.at} scale(1 ${blink ? .12 : 1})`)
    mixDot.setAttribute('r', (9 + (A.on ? Math.pow(1 - ph, 3) * 6 : 0)).toFixed(1))
    $('patchWord').classList.toggle('on', p > .3)
  }

  /* ── 7: the looks — the same room wiped from one wear to the other ── */
  const shot = $('shot'), shotB = $('shotB'), wipe = $('wipe')
  const drawLooks = (p: number) => {
    const t = ease(seg(p, .15, .85))
    shotB.style.clipPath = `inset(0 0 0 ${(100 - t * 100).toFixed(2)}%)`
    wipe.style.left = `calc(${(100 - t * 100).toFixed(2)}% - 1px)`
    wipe.style.opacity = t > 0 && t < 1 ? '1' : '0'
    shot.style.transform = `translateY(-50%) scale(${(1.08 - seg(p, 0, .3) * .08).toFixed(3)})`
    $('looksWord').classList.toggle('on', p > .1)
  }

  /* ── 8: your keys — the set you came with; your own keyboard presses them ── */
  const SETS: Record<string, Record<string, [string, string]>> = {
    'logic pro': { KeyT: ['t', 'tool menu'], KeyT2: ['⌘t', 'split'], KeyD: ['⌘d', 'duplicate'], KeyM: ['m', 'mute'], Space: ['space', 'play'] },
    'ableton live': { KeyB: ['b', 'pencil'], KeyE: ['⌘e', 'split'], Space: ['space', 'play'], KeyD: ['⌘d', 'duplicate'] },
    'cubase': { Digit1: ['1', 'pointer'], KeyX: ['⌥x', 'split'], Space: ['space', 'play'] },
    'pro tools': { Digit7: ['⌘7', 'smart'], KeyE: ['⌘e', 'separate'], Space: ['space', 'play'] },
  }
  let SET = 'logic pro'
  const capsBox = $('caps'), setsBox = $('sets'), say = $('keySay')
  const drawCaps = () => {
    capsBox.innerHTML = ''
    for (const [code, [k, w]] of Object.entries(SETS[SET])) {
      const d = document.createElement('div'); d.className = 'cap'; d.dataset.code = code.replace(/2$/, ''); d.dataset.mod = k.startsWith('⌘') ? 'meta' : k.startsWith('⌥') ? 'alt' : ''
      const b = document.createElement('b'), s = document.createElement('span'); b.textContent = k; s.textContent = w; d.append(b, s); capsBox.appendChild(d)
    }
  }
  setsBox.innerHTML = ''
  for (const n of Object.keys(SETS)) {
    const b = document.createElement('button'); b.textContent = n
    b.onclick = () => { SET = n; for (const x of Array.from(setsBox.children)) x.classList.toggle('on', x === b); drawCaps(); say.textContent = 'press them' }
    setsBox.appendChild(b)
  }
  setsBox.firstElementChild?.classList.add('on'); drawCaps()
  const keysEl = $('keys'), timers: number[] = []
  on('keydown', e => {
    const r = keysEl.getBoundingClientRect(); if (r.top > innerHeight * .6 || r.bottom < innerHeight * .3) return
    for (const c of Array.from(capsBox.querySelectorAll<HTMLElement>('.cap'))) {
      const mod = c.dataset.mod, ok = c.dataset.code === e.code && (mod === 'meta' ? e.metaKey : mod === 'alt' ? e.altKey : !e.metaKey && !e.altKey)
      if (!ok) continue
      e.preventDefault(); c.classList.add('down')
      say.textContent = `${c.querySelector('b')!.textContent} — ${c.querySelector('span')!.textContent}, as in ${SET}`
      timers.push(window.setTimeout(() => c.classList.remove('down'), 160))
    }
  }, true)
  offs.push(() => timers.forEach(clearTimeout))

  /* ── every frame: where each scene is, and the song's place ── */
  const DRAW: [string, (p: number, bars: number, now: number) => void][] = [['tidy', drawTidy], ['transport', drawTransport], ['rubato', drawRubato], ['doctor', drawDoctor], ['rough', drawRough], ['patch', drawPatch], ['looks', drawLooks]]
  const SC = DRAW.map(([id, draw]) => ({ el: $(id), draw }))
  const prog = (e: HTMLElement) => { const r = e.getBoundingClientRect(), total = e.offsetHeight - innerHeight; return clamp(-r.top / total, 0, 1) }
  const visible = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight }
  const rB = $('rB'), rS = $('rS'), rT = $('rT'), m4 = Array.from(root.querySelectorAll('#m4 i'))
  let raf = 0, alive = true
  const frame = (now: number) => {
    const bars = songBars(), whole = Math.floor(bars), fr = bars - whole, beat = Math.floor(fr * 4), six = Math.floor(fr * 16) % 4
    /* the first screen's readout, the beat squares, the notes on the staff */
    rB.textContent = String(whole + 1); rS.textContent = `.${beat + 1}.${six + 1}`; rT.textContent = '.' + String(Math.floor(fr * 3840) % 240 + 1).padStart(3, '0')
    m4.forEach((q, k) => q.classList.toggle('on', A.on && k === beat))
    const b16 = Math.floor(bars * 16)
    if (A.on && b16 !== lastBeat) {
      lastBeat = b16; const n = NOTES[b16 % NOTES.length]
      if (n && b16 % 2 === 0) { const e = n.firstChild as SVGEllipseElement; e.style.transition = 'none'; e.setAttribute('fill-opacity', '1'); requestAnimationFrame(() => { e.style.transition = 'fill-opacity 1.2s ease'; e.setAttribute('fill-opacity', '0') }) }
    }
    for (const s of SC) if (visible(s.el)) s.draw(prog(s.el), bars, now)
    raf = requestAnimationFrame(frame)
  }
  /* the poster's numbers are measured, so the first frame waits for the fonts */
  void document.fonts.ready.then(() => { if (alive) raf = requestAnimationFrame(frame) })
  offs.push(() => { alive = false; cancelAnimationFrame(raf) })

  return () => { for (const off of offs) off() }
}
