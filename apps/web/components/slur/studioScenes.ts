/* The Slur Studio page's moving parts — every scene drawn from where it is
   in its scroll, a four-bar song made in the browser once play is pressed,
   and the keycaps your own keyboard presses. Mounted on the page's root and
   torn down with it. Drafts: apps/web/design/slur studio page draft 1, worn
   in bauhaus by design/bauhaus site draft 1 (both approved 2026-10-24). */

const NS = 'http://www.w3.org/2000/svg', INK = '#151412', PAPER = '#F1ECDF', P2 = '#E8E1D0', P3 = '#DCD4C0', T2 = '#6E685B'
const RED = '#D52B1E', BLUE = '#1D4E9E', YELLOW = '#F2C230'
type Attrs = Record<string, string | number>

function el<K extends keyof SVGElementTagNameMap> (tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  if (parent) parent.appendChild(e)
  return e
}
const txt = (p: Element, x: number, y: number, s: string, a: Attrs = {}) => {
  const t = el('text', Object.assign({ x, y, fill: INK, 'font-family': 'Jost, sans-serif', 'font-size': 14 }, a), p)
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
    $('playTri').setAttribute('d', A.on ? 'M 27 27 H 47 V 47 H 27 Z' : 'M 29 22 L 55 37 L 29 52 Z')
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
    for (let k = 0; k < 5; k++) el('line', { x1: 0, x2: W, y1: y0 + k * 26, y2: y0 + k * 26, stroke: INK, 'stroke-opacity': .12 }, staff)
    const cols = [RED, BLUE, YELLOW, INK, RED, BLUE]
    for (let i = 0; i < 9; i++) {
      const x = W * (.06 + i * .11), y = y0 + ((i * 5) % 9) * 13, g = el('g', { transform: `translate(${x} ${y})` }, staff)
      el('circle', { cx: 0, cy: 0, r: 13, fill: cols[i % 6], 'fill-opacity': 0 }, g); NOTES.push(g)
    }
  }
  drawStaff(); on('resize', drawStaff)

  /* ── 1: tidy — the regions as they came, flung about; they fall into lanes, and the lanes sort themselves ── */
  interface Reg { rg: SVGGElement; body: SVGRectElement; bars: SVGRectElement[]; a: number; w: number; fling: { x: number; y: number; r: number; s: number } }
  interface Lane { raw: string; name: string; fam: string; c: string; at: number; regs: [number, number][] }
  const tidySvg = $<SVGSVGElement>('tidySvg')
  el('rect', { x: 0, y: 0, width: 1440, height: 900, fill: PAPER }, tidySvg)
  /* the daw's bauhaus colours by family: drums and voices red, bass and effects blue, keys yellow, guitars black */
  const LANES: Lane[] = [
    { raw: 'Audio 12', name: 'riser', fam: 'effects', c: BLUE, at: 8, regs: [[7, 9], [15, 17]] },
    { raw: 'VOX comp 3', name: 'lead vox', fam: 'voice', c: RED, at: 6, regs: [[5, 11], [11, 17], [19, 25]] },
    { raw: 'Audio 1', name: 'kick', fam: 'drums', c: RED, at: 0, regs: [[1, 9], [9, 17], [17, 25]] },
    { raw: 'keys bounce v2', name: 'keys', fam: 'keys', c: YELLOW, at: 4, regs: [[1, 13], [13, 25]] },
    { raw: 'snr_top_FINAL', name: 'snare', fam: 'drums', c: RED, at: 1, regs: [[5, 9], [9, 17], [17, 25]] },
    { raw: 'Bass DI (1)', name: 'bass', fam: 'bass', c: BLUE, at: 3, regs: [[1, 9], [9, 17], [17, 25]] },
    { raw: 'GTR L', name: 'guitar', fam: 'guitar', c: INK, at: 5, regs: [[5, 13], [13, 21]] },
    { raw: 'bgv stack', name: 'bgv', fam: 'voice', c: RED, at: 7, regs: [[9, 17], [21, 25]] },
    { raw: 'Audio 7', name: 'hats', fam: 'drums', c: RED, at: 2, regs: [[3, 17], [19, 25]] },
  ]
  const TX0 = 300, TX1 = 1400, PX = (TX1 - TX0) / 24, TOP = 150, LH = 50, tbx = (b: number) => TX0 + (b - 1) * PX
  const tGrid = el('g', {}, tidySvg)
  for (let b = 1; b <= 25; b++) el('rect', { x: tbx(b), y: TOP - 6, width: 1, height: 9 * LH + 6, fill: INK, opacity: b % 4 === 1 ? .16 : .06 }, tGrid)
  const tLanes = LANES.map((L, i) => {
    const g = el('g', {}, tidySvg)
    const nb = txt(g, 56, 8, String(L.at + 1).padStart(2, '0'), { 'font-size': 24, 'font-weight': 700, fill: L.c, opacity: 0 })
    const nm = txt(g, 100, 7, L.raw, { 'font-size': 20, 'font-weight': 500, fill: T2 })
    const regs: Reg[] = L.regs.map(([a, b]) => {
      const w = (b - a) * PX - 3, rg = el('g', {}, tidySvg), h = LH - 12
      const body = el('rect', { x: 0, y: -h / 2, width: w, height: h, fill: P3 }, rg)
      const bars: SVGRectElement[] = []
      for (let px = 4; px < w - 4; px += 3) {
        const k = px / w, beat = L.fam === 'drums' ? (Math.floor(px / (PX / 4)) % 2 ? .3 : 1) : .65 + .35 * Math.sin(k * 9 + i)
        const hh = Math.max(2, (rnd() * .5 + .5) * (h - 10) * beat * (L.fam === 'effects' ? k : 1))
        bars.push(el('rect', { x: px, y: -hh / 2, width: 1.4, height: hh, fill: '#B3AA93' }, rg))
      }
      const fling = { x: 80 + rnd() * 1250, y: 80 + rnd() * 740, r: (rnd() - .5) * 70, s: .7 + rnd() * .5 }
      return { rg, body, bars, a, w, fling }
    })
    return { ...L, g, nb, nm, regs, raw0: i }
  })
  /* the markers as shapes over a thick rule, the cycle a yellow stretch of it; the playhead a disc on the rule */
  const tMarkers = el('g', { opacity: 0 }, tidySvg)
  el('rect', { x: TX0, y: TOP - 20, width: TX1 - TX0, height: 6, fill: INK }, tMarkers); el('rect', { x: tbx(17), y: TOP - 20, width: 8 * PX, height: 6, fill: YELLOW }, tMarkers)
  ;([['intro', 1, 'c', RED], ['verse', 5, 's', BLUE], ['pre', 9, 't', YELLOW], ['chorus', 13, 'c', RED], ['verse 2', 17, 's', BLUE], ['chorus', 21, 't', YELLOW]] as const).forEach(([m, a, s, c]) => {
    const x = tbx(a) + 4, y = TOP - 52
    if (s === 'c') el('circle', { cx: x + 8, cy: y, r: 8, fill: c }, tMarkers)
    if (s === 's') el('rect', { x, y: y - 8, width: 16, height: 16, fill: c }, tMarkers)
    if (s === 't') el('path', { d: `M ${x + 8} ${y - 9} L ${x + 17} ${y + 8} L ${x - 1} ${y + 8} Z`, fill: c }, tMarkers)
    txt(tMarkers, x + 26, y + 7, m, { 'font-size': 19, 'font-weight': 500 })
  })
  const tPh = el('g', { opacity: 0 }, tidySvg)
  el('rect', { x: -1.5, y: TOP - 20, width: 3, height: 9 * LH + 20, fill: RED }, tPh); el('circle', { cx: 0, cy: TOP - 17, r: 10, fill: RED }, tPh)
  const drawTidy = (p: number) => {
    const fly = seg(p, .02, .42), sort = seg(p, .46, .72), paint = seg(p, .5, .8), play = seg(p, .78, 1)
    tGrid.setAttribute('opacity', String(fly))
    tLanes.forEach((L, i) => {
      const row = lerp(L.raw0, L.at, ease(sort)), y = TOP + row * LH + LH / 2
      L.g.setAttribute('transform', `translate(0 ${y})`); L.g.setAttribute('opacity', String(seg(fly, .5, 1)))
      const sorted = sort > .5
      L.nm.textContent = sorted ? L.name : L.raw; L.nm.setAttribute('fill', sorted ? INK : T2); L.nb.setAttribute('opacity', String(seg(sort, .5, .9)))
      const ink = paint > 0 ? TX0 + paint * (TX1 - TX0) * 1.2 : 0
      L.regs.forEach((R, k) => {
        const t = ease(seg(fly, (i * 3 + k) / 40, .55 + (i * 3 + k) / 60)), fx = R.fling
        const x = lerp(fx.x, tbx(R.a) + 1.5, t), yy = lerp(fx.y, y, t), r = lerp(fx.r, 0, t), sc = lerp(fx.s, 1, t)
        R.rg.setAttribute('transform', `translate(${x.toFixed(1)} ${yy.toFixed(1)}) rotate(${r.toFixed(2)}) scale(${sc.toFixed(3)})`)
        const lit = ink > 0 && tbx(R.a) < ink
        R.body.setAttribute('fill', lit ? L.c : P3); for (const b of R.bars) b.setAttribute('fill', lit ? PAPER : '#B3AA93')
      })
    })
    tPh.setAttribute('opacity', play > 0 ? '1' : '0'); tPh.setAttribute('transform', `translate(${lerp(TX0, TX1, play)} 0)`)
    tMarkers.setAttribute('opacity', String(seg(p, .74, .82)))
    $('tidyWord').classList.toggle('on', p > .5)
  }

  /* ── 2: the transport, as a poster: the daw's bauhaus column made large; the place counts with the scroll (or with the music) ── */
  const tp = $<SVGSVGElement>('tpSvg')
  el('circle', { cx: 200, cy: 210, r: 100, fill: RED }, tp); el('path', { d: 'M 170 160 L 255 210 L 170 260 Z', fill: PAPER }, tp)
  el('rect', { x: 348, y: 112, width: 104, height: 104, fill: INK }, tp)
  el('circle', { cx: 400, cy: 290, r: 42, fill: 'none', stroke: RED, 'stroke-width': 10 }, tp)
  const tpBar = txt(tp, 54, 690, '1', { 'font-size': 420, 'font-weight': 700, 'letter-spacing': -18 })
  const tpSub = txt(tp, 545, 680, '.1.1', { 'font-size': 70, 'font-weight': 600, fill: RED }), tpTick = txt(tp, 668, 680, '.001', { 'font-size': 42, 'font-weight': 500, fill: RED })
  const tpClock = txt(tp, 72, 756, '0:00.0', { 'font-size': 32, 'font-weight': 600 }), tpTime = txt(tp, 196, 756, '00:00:00:00', { 'font-size': 24, fill: T2 })
  el('rect', { x: 600, y: 112, width: 156, height: 156, fill: BLUE }, tp); txt(tp, 678, 208, '4/4', { 'font-size': 56, 'font-weight': 600, fill: PAPER, 'text-anchor': 'middle' })
  const tpBeats = [0, 1, 2, 3].map(k => el('rect', { x: 604 + k * 38, y: 290, width: 24, height: 24, fill: 'none', stroke: INK, 'stroke-width': 3 }, tp))
  el('circle', { cx: 1010, cy: 230, r: 140, fill: YELLOW }, tp); txt(tp, 1010, 262, '92', { 'font-size': 120, 'font-weight': 700, 'text-anchor': 'middle' }); txt(tp, 1010, 312, 'bpm', { 'font-size': 24, 'font-weight': 600, 'text-anchor': 'middle' })
  const tpTri = el('path', { d: 'M 0 -113 L 100 57 L -100 57 Z', fill: YELLOW, transform: 'translate(840 513)' }, tp)
  el('rect', { x: 724, y: 590, width: 232, height: 46, fill: INK }, tp); txt(tp, 742, 621, 'cycle 17 to 25', { 'font-size': 23, fill: PAPER })
  /* the out: a needle through a blue ring, a red disc at its end, moving with the level */
  const tpNeedle = el('g', { transform: 'translate(1180 600)' }, tp)
  el('rect', { x: -1.5, y: -250, width: 3, height: 500, fill: INK }, tpNeedle); el('circle', { cx: 0, cy: -210, r: 12, fill: RED }, tpNeedle)
  el('circle', { cx: 1180, cy: 600, r: 112, fill: 'none', stroke: BLUE, 'stroke-width': 54 }, tp); el('circle', { cx: 1180, cy: 600, r: 84, fill: PAPER }, tp)
  txt(tp, 1180, 606, '−4.2', { 'font-size': 52, 'font-weight': 700, 'text-anchor': 'middle' }); txt(tp, 1180, 638, 'out', { 'font-size': 20, 'font-weight': 600, 'text-anchor': 'middle' })
  const drawTransport = (p: number, bars: number) => {
    const bar = 1 + (A.on ? bars % 24 : p * 23.99), whole = Math.floor(bar), fr = bar - whole, beat = Math.floor(fr * 4), six = Math.floor(fr * 16) % 4, tk = Math.floor(fr * 3840) % 240, sec = (bar - 1) * BAR
    tpBar.textContent = String(whole); const wb = tpBar.getComputedTextLength()
    tpSub.textContent = `.${beat + 1}.${six + 1}`; tpSub.setAttribute('x', String(54 + wb + 14))
    tpTick.textContent = '.' + String(tk + 1).padStart(3, '0'); tpTick.setAttribute('x', String(54 + wb + 14 + tpSub.getComputedTextLength() + 6))
    const pad = (v: number) => String(Math.floor(v)).padStart(2, '0')
    tpClock.textContent = `${Math.floor(sec / 60)}:${pad(sec % 60)}.${Math.floor(sec % 1 * 10)}`; tpTime.textContent = `${pad(sec / 3600)}:${pad(sec / 60 % 60)}:${pad(sec % 60)}:${pad(sec % 1 * 30)}`
    tpBeats.forEach((q, k) => q.setAttribute('fill', k === beat ? INK : 'none'))
    tpTri.setAttribute('transform', `translate(840 513) rotate(${(bar - 1) * 15})`)
    const lv = .55 + .25 * Math.sin(bar * 2.1) + (beat === 0 ? .08 : 0)
    tpNeedle.setAttribute('transform', `translate(1180 600) rotate(${(-80 + lv * 90).toFixed(1)})`)
    $('tpWord').classList.toggle('on', p > .15)
  }

  /* ── 3: rubato — the pins fall, then the time between them is pulled ── */
  const rub = $<SVGSVGElement>('rubSvg'); el('rect', { x: 0, y: 0, width: 1440, height: 900, fill: PAPER }, rub)
  const ry = 610, rh = 220, rx0 = 80, rx1 = 1360
  el('rect', { x: rx0, y: ry - rh / 2, width: rx1 - rx0, height: rh, fill: RED }, rub)
  const rBars: { f: number; r: SVGRectElement }[] = []; seed = 3
  const words = [[0, .14], [.18, .33], [.37, .52], [.56, .72], [.76, .96]]
  for (let k = 0; k < 360; k++) {
    const f = k / 360, inWord = words.find(([a, b]) => f >= a && f <= b), env = inWord ? Math.sin(Math.PI * (f - inWord[0]) / (inWord[1] - inWord[0])) : .04
    const hh = Math.max(2, (rnd() * .45 + .55) * (rh - 30) * env)
    rBars.push({ f, r: el('rect', { x: 0, y: ry - hh / 2, width: 2, height: hh, fill: PAPER }, rub) })
  }
  const rTo = [0, .14, .41, .58, .80, 1]                                       // where the pins are pulled to: a late first word, a pushed third
  const rPins = [0, .18, .37, .56, .76, 1].map((f, i) => {
    const g = el('g', {}, rub)
    el('rect', { x: -1.5, y: ry - rh / 2 - 40, width: 3, height: rh + 52, fill: INK }, g); el('rect', { x: -10, y: ry - rh / 2 - 60, width: 20, height: 20, fill: INK }, g)
    const dir = Math.sign(rTo[i] - f), arrow = dir ? el('path', { d: dir > 0 ? `M 18 ${ry - rh / 2 - 57} L 30 ${ry - rh / 2 - 50} L 18 ${ry - rh / 2 - 43} Z` : `M -18 ${ry - rh / 2 - 57} L -30 ${ry - rh / 2 - 50} L -18 ${ry - rh / 2 - 43} Z`, fill: YELLOW, opacity: 0 }, g) : null
    return { f, g, arrow }
  })
  const drawRubato = (p: number) => {
    const drop = seg(p, .05, .35), pull = ease(seg(p, .4, .85)), P = rPins.map((q, i) => [q.f, lerp(q.f, rTo[i], pull)])
    const map = (f: number) => { for (let i = 1; i < P.length; i++) if (f <= P[i][0]) { const [a, A0] = P[i - 1], [b, B0] = P[i]; return A0 + (f - a) / (b - a) * (B0 - A0) } return f }
    for (const B of rBars) B.r.setAttribute('x', (rx0 + 8 + map(B.f) * (rx1 - rx0 - 16)).toFixed(1))
    rPins.forEach((Q, i) => {
      const t = ease(seg(drop, i / 8, i / 8 + .4)), x = rx0 + 8 + map(Q.f) * (rx1 - rx0 - 16)
      Q.g.setAttribute('transform', `translate(${x.toFixed(1)} ${lerp(-500, 0, t).toFixed(1)})`); Q.g.setAttribute('opacity', String(t))
      Q.arrow?.setAttribute('opacity', String(seg(p, .4, .5) * (1 - seg(p, .9, 1))))
    })
    $('rubWord').classList.toggle('on', p > .2)
  }

  /* ── 4: the doctor — two sounds in the same place, found, and one of them ducked ── */
  const doc = $<SVGSVGElement>('docSvg')
  const X = (f: number) => 120 + Math.log(f / 21) / Math.log(400 / 21) * 760, Y0 = 800
  const curve = (c: number, w: number, g: number) => { let d = ''; for (let k = 0; k <= 120; k++) { const f = 21 * Math.pow(400 / 21, k / 120), v = g * Math.exp(-Math.pow(Math.log(f / c) / w, 2)); d += (k ? 'L' : 'M') + X(f).toFixed(1) + ' ' + (Y0 - v).toFixed(1) } return d }
  const dBand = el('rect', { x: X(63), y: Y0 - 400, width: X(100) - X(63), height: 400, fill: YELLOW, opacity: 0 }, doc)
  const dKick = el('path', { d: curve(80, .55, 330) + `L${X(400)} ${Y0}L${X(21)} ${Y0}Z`, fill: BLUE }, doc)
  const dGhost = el('path', { d: curve(95, .75, 330), fill: 'none', stroke: RED, 'stroke-width': 3, 'stroke-dasharray': '6 7', opacity: 0 }, doc)
  const dBass = el('path', { d: curve(95, .75, 330), fill: 'none', stroke: RED, 'stroke-width': 7, 'stroke-linejoin': 'round' }, doc)
  el('rect', { x: 120, y: Y0, width: 760, height: 3, fill: INK }, doc)
  for (const [f, w] of [[21, '21 hz'], [92, '92 hz'], [400, '400 hz']] as const) txt(doc, X(f) - 20, Y0 + 34, w, { 'font-size': 18, fill: T2 })
  dKick.style.clipPath = 'inset(0 100% 0 0)'
  const dBL = dBass.getTotalLength(); dBass.style.strokeDasharray = String(dBL)
  const dFound = el('g', { opacity: 0, transform: 'translate(960 330)' }, doc)
  el('rect', { x: 0, y: 0, width: 56, height: 56, fill: INK }, dFound); txt(dFound, 28, 41, '1', { 'font-size': 36, 'font-weight': 700, fill: PAPER, 'text-anchor': 'middle' })
  txt(dFound, 76, 28, 'kick and bass meet', { 'font-size': 34, 'font-weight': 600 }); txt(dFound, 76, 62, 'chorus 17 to 24', { 'font-size': 20, fill: T2 })
  const dPct = txt(dFound, 76, 118, '72% together', { 'font-size': 26, 'font-weight': 500 })
  const dWay = el('g', { opacity: 0, transform: 'translate(960 330)' }, doc)
  el('rect', { x: 0, y: 180, width: 56, height: 56, fill: YELLOW }, dWay); txt(dWay, 28, 221, 'B', { 'font-size': 36, 'font-weight': 700, 'text-anchor': 'middle' })
  txt(dWay, 76, 208, 'duck the bass', { 'font-size': 34, 'font-weight': 600 }); txt(dWay, 76, 242, 'whole band −4.0 dB while the kick plays', { 'font-size': 20, fill: T2 })
  const dHeard = txt(dWay, 76, 296, 'heard 0.0 dB', { 'font-size': 26, 'font-weight': 600, fill: RED })
  const key = el('g', { transform: 'translate(960 690)' }, doc)
  el('rect', { x: 0, y: 0, width: 20, height: 20, fill: BLUE }, key); txt(key, 30, 17, 'kick', { 'font-size': 20 })
  el('rect', { x: 110, y: 7, width: 30, height: 7, fill: RED }, key); txt(key, 150, 17, 'bass', { 'font-size': 20 })
  el('rect', { x: 230, y: 0, width: 20, height: 20, fill: YELLOW }, key); txt(key, 260, 17, 'where they meet', { 'font-size': 20 })
  const drawDoctor = (p: number, bars: number) => {
    const draw = seg(p, .02, .3), find = seg(p, .32, .45), duck = ease(seg(p, .55, .85))
    dKick.style.clipPath = `inset(0 ${(100 - draw * 100).toFixed(1)}% 0 0)`; dBass.style.strokeDashoffset = String(dBL * (1 - draw))
    const beatPulse = A.on ? Math.pow(1 - ((bars * 4) % 1), 3) : 0
    dBand.setAttribute('opacity', (find * (.9 - duck * .35 + .1 * beatPulse)).toFixed(3))
    dBass.setAttribute('d', curve(95, .75, 330 - duck * (140 + 30 * beatPulse))); dGhost.setAttribute('opacity', (duck * .55).toFixed(3))
    dFound.setAttribute('opacity', String(find)); dWay.setAttribute('opacity', String(seg(p, .5, .58)))
    dPct.textContent = `${Math.round(72 - duck * 41)}% together`; dHeard.textContent = `heard −${(duck * 3.5).toFixed(1)} dB`
    $('docWord').classList.toggle('on', p > .1)
  }

  /* ── 5: the rough mix — the tracks in the room, front to back, left to right: up front, one room, wide ── */
  const rough = $<SVGSVGElement>('roughSvg'), cx = 1120, top = 200, RW = 540, RH = 520
  const WAYS = [['A', 'up front'], ['B', 'one room'], ['C', 'wide']]
  const mWays = WAYS.map(([l, n], i) => {
    const x = cx - RW / 2 + i * (RW / 3), cell = el('rect', { x, y: 96, width: RW / 3, height: 64, fill: 'none', stroke: INK, 'stroke-width': 2 }, rough)
    return { cell, l: txt(rough, x + 18, 140, l, { 'font-size': 32, 'font-weight': 700 }), n: txt(rough, x + 52, 138, n, { 'font-size': 20, 'font-weight': 500 }) }
  })
  el('rect', { x: cx - RW / 2, y: top, width: RW, height: RH, fill: P2 }, rough)
  const mInner = el('rect', { x: cx - RW / 2 + 70, y: top + 50, width: RW - 140, height: RH - 180, fill: P3, opacity: 0 }, rough)
  el('rect', { x: cx - RW / 2, y: top, width: RW, height: RH, fill: 'none', stroke: INK, 'stroke-width': 3 }, rough)
  txt(rough, cx - RW / 2 + 14, top + 28, 'back', { 'font-size': 17, fill: T2 }); txt(rough, cx - RW / 2 + 14, top + RH - 14, 'front', { 'font-size': 17, fill: T2 })
  ;['l', 'c', 'r'].forEach((c, k) => txt(rough, cx - RW / 2 + k * RW / 2 - (k === 2 ? 10 : k ? 4 : 0), top + RH + 32, c, { 'font-size': 18, fill: T2 }))
  /* each track: its number, its colour, and where it stands in A, B and C (x −1…1 across, y 0 back…1 front, and a width for the wide ones) */
  type At = [number, number] | [number, number, number]
  const TR: [string, string, At, At, At][] = [['01', RED, [0, .78], [0, .72], [.05, .62]], ['02', RED, [.03, .6], [.16, .34], [.15, .55]], ['03', RED, [-.3, .58], [-.3, .3], [-.42, .5]], ['04', BLUE, [0, .9], [0, .86], [0, .8]],
    ['05', YELLOW, [-.05, .5, .36], [-.1, .5, .5], [-.2, .3, 1.5]], ['06', INK, [-.52, .66], [-.6, .46], [-.8, .3]], ['07', RED, [.2, .76], [.22, .6], [0, .75]], ['08', BLUE, [-.15, .36, .6], [-.1, .12, .8], [-.1, .06, 1.6]]]
  const mTracks = TR.map(([n, c, a, b, cc]) => {
    const g = el('g', {}, rough), wide = a.length > 2
    const shape = wide ? el('rect', { x: -100, y: -10, width: 200, height: 20, fill: c }, g) : el('circle', { r: 28, fill: c }, g)
    txt(g, wide ? -92 : 0, 6, n, { 'font-size': 16, 'font-weight': 700, fill: c === YELLOW ? INK : PAPER, 'text-anchor': wide ? 'start' : 'middle' })
    return { g, shape, wide, at: [a, b, cc] }
  })
  const drawRough = (p: number, bars: number) => {
    const s = p * 2, k = Math.min(1, Math.floor(s)), f = clamp(s - k, 0, 1), t = ease(f < .55 ? 0 : (f - .55) / .45), cur = t > .5 ? k + 1 : k
    mWays.forEach((w, i) => { const on = i === cur; w.cell.setAttribute('fill', on ? INK : 'none'); w.l.setAttribute('fill', on ? PAPER : INK); w.n.setAttribute('fill', on ? PAPER : INK) })
    mInner.setAttribute('opacity', cur === 1 ? '1' : '0')
    const pulse = A.on ? Math.pow(1 - ((bars * 4) % 1), 4) : 0
    for (const R of mTracks) {
      const a = R.at[k], b = R.at[Math.min(2, k + 1)], x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), w = lerp(a[2] ?? 1, b[2] ?? 1, t)
      R.g.setAttribute('transform', `translate(${(cx + x * RW / 2 * .9).toFixed(1)} ${(top + y * RH).toFixed(1)}) scale(${R.wide ? 1 : (1 + pulse * .12).toFixed(3)})`)
      if (R.wide) { R.shape.setAttribute('width', String(200 * w)); R.shape.setAttribute('x', String(-100 * w)) }
    }
    $('roughWord').classList.toggle('on', p > .1)
  }

  /* ── 6: the patch — prints on the wall, wired, each doing its thing (the prints keep their own colours) ── */
  const patch = $<SVGSVGElement>('patchSvg'), py = 380
  const wires: { w: SVGPathElement; L: number }[] = []
  const wire = (d: string) => { wires.push({ w: el('path', { d, fill: 'none', stroke: INK, 'stroke-width': 3 }, patch), L: 0 }) }
  wire(`M120 ${py}H330`); wire(`M470 ${py}C540 ${py} 560 ${py - 140} 640 ${py - 140}`); wire(`M470 ${py}C540 ${py} 560 ${py + 140} 640 ${py + 140}`)
  wire(`M800 ${py - 140}C880 ${py - 140} 880 ${py} 940 ${py}`); wire(`M800 ${py + 140}C880 ${py + 140} 880 ${py} 940 ${py}`); wire(`M1000 ${py}H1140`); wire(`M1260 ${py}H1340`)
  for (const [x, w] of [[120, 'in'], [1340, 'out']] as const) { el('circle', { cx: x, cy: py, r: 10, fill: PAPER, stroke: INK, 'stroke-width': 3 }, patch); txt(patch, x - 8, py + 40, w, { 'font-size': 20, fill: T2 }) }
  /* tape: an orange plate with two reels for eyes */
  const tape = el('g', {}, patch); el('rect', { x: -70, y: -70, width: 140, height: 140, fill: '#E07B3C' }, tape)
  const eyes = [-30, 30].map(ex => { const g = el('g', {}, tape); g.dataset.at = `translate(${ex} -12)`; g.setAttribute('transform', g.dataset.at); el('circle', { r: 22, fill: 'none', stroke: '#FBFAF7', 'stroke-width': 5 }, g); el('circle', { r: 6, fill: '#FBFAF7' }, g); return g })
  el('path', { d: 'M-46 30Q0 50 46 30', fill: 'none', stroke: '#FBFAF7', 'stroke-width': 5, 'stroke-linecap': 'round' }, tape)
  txt(patch, 400, py + 104, 'tape', { 'font-size': 22, 'font-weight': 600, 'text-anchor': 'middle' }); txt(patch, 400, py + 130, 'hard 24', { 'font-size': 18, fill: T2, 'text-anchor': 'middle' })
  /* space: a blue disc of rings */
  const space = el('g', {}, patch); el('circle', { r: 70, fill: '#5C80FF' }, space)
  const RINGS = [18, 32, 46, 58], rings = RINGS.map(r => el('circle', { r, fill: 'none', stroke: '#FBFAF7', 'stroke-width': 2.4, 'stroke-opacity': .8 }, space)); el('circle', { r: 6, fill: '#FBFAF7' }, space)
  txt(patch, 720, py - 40, 'space', { 'font-size': 22, 'font-weight': 600, 'text-anchor': 'middle' }); txt(patch, 720, py - 14, 'hall 30', { 'font-size': 18, fill: T2, 'text-anchor': 'middle' })
  /* delay: a teal disc of fading bars */
  const delay = el('g', {}, patch); el('circle', { r: 70, fill: '#3E9E96' }, delay)
  const taps = [0, 1, 2, 3, 4, 5].map(k => el('rect', { x: -38 + k * 13, y: -30 + k * 4, width: 6, height: 60 - k * 8, fill: '#FBFAF7' }, delay))
  txt(patch, 720, py + 244, 'delay', { 'font-size': 22, 'font-weight': 600, 'text-anchor': 'middle' }); txt(patch, 720, py + 270, 'clean 20', { 'font-size': 18, fill: T2, 'text-anchor': 'middle' })
  /* mix: the two lines summed in a disc */
  const mixDot = el('circle', { cx: 970, cy: py, r: 30, fill: PAPER, stroke: INK, 'stroke-width': 3 }, patch)
  el('path', { d: `M 954 ${py} H 986 M 970 ${py - 16} V ${py + 16}`, stroke: INK, 'stroke-width': 3 }, patch); txt(patch, 970, py + 62, 'mix', { 'font-size': 22, 'font-weight': 600, 'text-anchor': 'middle' })
  /* a plug-in of the mac's own, in the same patch */
  el('rect', { x: 1140, y: py - 60, width: 120, height: 120, fill: P2, stroke: INK, 'stroke-width': 3 }, patch); el('rect', { x: 1236, y: py - 50, width: 14, height: 14, fill: RED }, patch)
  txt(patch, 1200, py + 8, 'comp', { 'font-size': 22, 'font-weight': 500, 'text-anchor': 'middle' }); txt(patch, 1200, py + 96, 'au', { 'font-size': 18, fill: T2, 'text-anchor': 'middle' })
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
    mixDot.setAttribute('r', (30 + (A.on ? Math.pow(1 - ph, 3) * 6 : 0)).toFixed(1))
    $('patchWord').classList.toggle('on', p > .3)
  }

  /* ── 7: the looks — the same room wiped from one wear to the other ── */
  const shot = $('shot'), shotB = $('shotB'), wipe = $('wipe')
  const drawLooks = (p: number) => {
    const t = ease(seg(p, .15, .85))
    shotB.style.clipPath = `inset(0 0 0 ${(100 - t * 100).toFixed(2)}%)`
    wipe.style.left = `calc(${(100 - t * 100).toFixed(2)}% - 1px)`
    wipe.style.opacity = t > 0 && t < 1 ? '1' : '0'
    shot.style.transform = `scale(${(1.08 - seg(p, 0, .3) * .08).toFixed(3)})`
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
      if (n && b16 % 2 === 0) { const e = n.firstChild as SVGCircleElement; e.style.transition = 'none'; e.setAttribute('fill-opacity', '1'); requestAnimationFrame(() => { e.style.transition = 'fill-opacity 1.2s ease'; e.setAttribute('fill-opacity', '0') }) }
    }
    for (const s of SC) if (visible(s.el)) s.draw(prog(s.el), bars, now)
    raf = requestAnimationFrame(frame)
  }
  /* the poster's numbers are measured, so the first frame waits for the fonts */
  void document.fonts.ready.then(() => { if (alive) raf = requestAnimationFrame(frame) })
  offs.push(() => { alive = false; cancelAnimationFrame(raf) })

  return () => { for (const off of offs) off() }
}
