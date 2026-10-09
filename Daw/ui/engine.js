/* Inside the app (a JUCE web view) the engine is native and NAT is the way to it. In a browser NAT is null. */
const NAT = (() => {
  const J = window.__JUCE__
  if (!J || !J.backend || !((J.initialisationData || {}).__juce__functions || []).includes('daw')) return null
  let nid = 1
  const wait = new Map()
  J.backend.addEventListener('__juce__complete', d => { const f = wait.get(d.promiseId); if (f) { wait.delete(d.promiseId); f(d.result) } })
  /* every sound the app decodes for the page is remembered by its key, so that it can be let go when the project is left */
  const keys = new Set(), keep = r => { for (const x of Array.isArray(r) ? r : r && Array.isArray(r.placed) ? r.placed : [r]) if (x && typeof x.key === 'string' && /^(file|warp):/.test(x.key)) keys.add(x.key); return r }
  return {
    keys,
    call: (op, data) => new Promise(res => { const id = nid++; wait.set(id, r => res(keep(r))); J.backend.emitEvent('__juce__invoke', { name: 'daw', params: [op, data == null ? {} : data], resultId: id }) }),
    on: (ev, fn) => J.backend.addEventListener(ev, fn),
  }
})()
let natInit = null, natReady = async () => {}, natSendLoops = async () => {}, natSession = async () => {}, natRolling = () => {}, natStopped = () => {}

/* ── the session ── */
let SONG_END = 42                        // the position, counted from zero, where the song is over
/* scenes: each starts on a bar (counted from one) and runs to the next one, the last to the end of the song */
const DEMO_SCENES = [['intro', 1], ['verse', 5], ['pre', 13], ['chorus', 17], ['verse 2', 25], ['chorus', 33], ['out', 41]]
const mkScenes = list => list.slice().sort((x, y) => x[1] - y[1]).map(([name, a], i, all) => ({ i, name, a, b: i + 1 < all.length ? all[i + 1][1] : SONG_END + 1 }))
let SCENES = mkScenes(DEMO_SCENES)
/* how the window is cut: the control bar, the tracks' own bar, the markers, the bars; the heads at the left; the foot.
   Below the lanes a panel opens (patch or mixer); at the right, slur. VIEW says how far each is open, as it is drawn now.
   The bars are cut in two along their length: the top (RU_CY of it) is the cycle's, the rest is the playhead's. */
const BAR_H = 44, TOOL_H = 26, MK_H = 22, RU_H = 24, RU_CY = 10, HEAD_W = 292, FOOT_H = 22, PH = 26, SLUR_W = 300, MIN_PANEL = 232
const X0 = HEAD_W, TY = BAR_H + TOOL_H + MK_H + RU_H, TOOL_Y = BAR_H, MK_Y = BAR_H + TOOL_H, RU_Y = BAR_H + TOOL_H + MK_H
const VIEW = { p: 0, s: 0 }
let RX = W, X1 = W, BY = H - FOOT_H, LANES_H = H - FOOT_H - TY
let PXB = 19.6, VX = 0, VY = 0                           // the view: pixels per bar, the position (bars from zero) at the left edge, and how far down the rows are scrolled
const bx = b => X0 + (b - 1 - VX) * PXB                  // where bar b (counted from one) sits
const barAt = x => (x - X0) / PXB + VX                   // the position (bars from zero) under a pixel
/* the room shows the song and a little past its end, so that where it stops can be seen */
const viewEnd = () => SONG_END * 1.05, fitPXB = () => (X1 - X0) / viewEnd(), maxVX = () => Math.max(0, viewEnd() - (X1 - X0) / PXB)
/* how far in the room goes: sixteen pixels to a single sample. (The slider on the tracks' bar goes as far as it always did —
   640 pixels to a bar; further in is the zoom tool's, the keys' and the pinch's.) */
const maxPXB = () => Math.max(640, 16 * SND_SR * SPB())
const oneSample = () => 1 / (SND_SR * SPB())            // a sample, in bars
const MAX_TRACKS = 256
let LOOPS = null
const lerp = (a, b, x) => a + (b - a) * x
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const mkPatch = (tape, space, delay, B) => ({ A: { tape, space, delay, share: 62 }, B: { tape: B[0], space: B[1], delay: B[2], share: B[3] == null ? 62 : B[3] }, x: 0 })
/* a track is born with nothing on its patch: prints are put on it by hand, like plug-ins */
const NO_PATCH = () => mkPatch(0, 0, 0, [0, 0, 0])
/* what the first song used to be shown with, when the patch was still a mock-up: kept only so that those exact values can
   be known again in a project saved back then, and taken off (see loadProjectNow) */
const MOCK_PATCH = { kick: mkPatch(18, 0, 0, [34, 6, 0]), snare: mkPatch(10, 14, 0, [22, 34, 10]), hats: mkPatch(0, 6, 8, [8, 16, 26]), bass: mkPatch(22, 0, 0, [40, 0, 0]), keys: mkPatch(24, 46, 30, [30, 78, 62, 50]), guitar: mkPatch(8, 24, 22, [14, 48, 44]), hum: mkPatch(0, 52, 18, [0, 80, 40]), air: mkPatch(0, 30, 0, [0, 60, 12]) }
let TID = 0, RID = 0
/* a region: a..b in bars counted from one; off = where in its source it starts (bars); gain in dB; fades in bars */
const mkReg = o => Object.assign({ id: ++RID, off: 0, gain: 0, mute: false, fi: 0, fo: 0 }, o)
/* a track: kind 'audio' plays regions; 'bus' takes what is sent or routed to it; 'stack' is the bus its own tracks play into.
   out: the id of the bus it plays into (0 = the stereo out); parent: the stack it sits in; sends: [{to, db}]; autos: lines along the song, by parameter */
const mkTrack = (name, c, own, theirs, buf, vol, regs, patch, extra) => Object.assign({ id: ++TID, name, theirs, kind: 'audio', vol, def: vol, pan: 0, mute: false, solo: false, arm: false, mon: false, inp: 0, out: 0, parent: null, open: true, sends: [], autos: {}, ap: 'vol', buf0: buf, regs: regs.map(([a, b, tag]) => mkReg({ a, b, buf, loop: true, off: a - 1, tag })), patch, n: null, inserts: [] }, extra || {})
const S = {
  tempo: 92, meter: [4, 4], key: '', playing: false, pos: 0, sel: 4, queued: null, master: -4.2, click: false, countIn: true, rec: null, auto: false, flex: false, q: 1 / 16, rh: 25, selP: [],
  panel: { on: false, tab: 'patch', h: 316, mx: 0 }, slur: false, look: null,
  cycle: { on: false, a: 16, b: 24 }, tool: 'pointer', tool2: 'marquee', snap: true, mode: 'smart', mode0: 'smart', nudge: 'beat', selR: [], selX: null, marq: null, band: null, menu: null,
  /* what is chosen besides regions: the tracks chosen along with the leading one (S.sel), by id; the track a shift press reaches from;
     the marker that was pressed (by the bar it begins on); and which of these was taken hold of last — the delete key and the
     tracks' own bar go by that ('lanes', 'tracks' or 'marker') */
  selT: [], selA: null, selM: null, focus: 'lanes', newT: null,
  tracks: [
    mkTrack('kick', null, null, null, 'kick', -1.5, [[5, 13], [17, 25], [25, 33], [33, 41]], NO_PATCH()),
    mkTrack('snare', null, null, null, 'snare', -5, [[5, 13], [17, 25], [25, 33], [33, 41]], NO_PATCH()),
    mkTrack('hats', null, null, null, 'hats', -6, [[13, 17], [17, 25], [33, 41]], NO_PATCH()),
    mkTrack('bass', null, null, 'jun', 'bass', -6.5, [[5, 13], [17, 33], [33, 41]], NO_PATCH()),
    mkTrack('keys', null, null, null, 'keys', -4.5, [[1, 5], [5, 13], [13, 17], [17, 25], [33, 41]], NO_PATCH(), { midi: true }),
    mkTrack('guitar', null, null, 'jun', 'guitar', -5, [[13, 17], [17, 25, 'take 3'], [33, 43]], NO_PATCH()),
    mkTrack('hum', null, null, 'minseo', 'hum', -6, [[5, 13], [17, 25], [25, 33], [33, 41]], NO_PATCH()),
    mkTrack('air', null, null, null, 'air', -12, [[1, 43]], NO_PATCH()),
  ],
  last: null, think: false, drop: null, picker: { open: false, list: null, busy: null },
  ho: { open: false, what: 'stems', print: 'with patch', range: 'this scene', fmt: 'wav', rate: 0, bits: 24, state: 'idle', done: 0, total: 0, note: '' },
}
const CAP = { sample: null, downloads: null, mp3: false }
/* the measure: so many beats to a bar, each a 1/unit note (S.meter, [4, 4] at first). The tempo counts quarter notes a minute.
   Everything on the lanes is placed in bars; a note's length is a part of a whole note, and WHOLE() is a whole note in bars. */
const WHOLE = () => S.meter[1] / S.meter[0]
const BEATS = () => S.meter[0]
const BEAT_16 = () => 16 / S.meter[1]                      // sixteenths to a beat
const SPB = () => 240 / S.tempo / WHOLE()                  // the seconds a bar lasts
/* the song's loops are written in four-four: in bars they are as long as the measure makes them */
const songLoops = bpm => { const L = makeLoops(bpm), k = WHOLE(); if (Math.abs(k - 1) > 1e-12) for (const key in L) L[key].bars *= k; return L }
const MEASURES = [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [3, 8], [5, 8], [6, 8], [7, 8], [9, 8], [12, 8]]

/* ── what a track holds, read roughly: by its name first, then by how its first sound moves (t.tone, from the app) ── */
const FAM_WORDS = [
  ['drums', /(^|[^a-z])(kick|kik|bd|snare|snr|sn|clap|rim|hat|hats|hh|hi-?hat|tom|toms|oh|overheads?|room|cymbals?|ride|crash|perc|shaker|tamb|conga|bongo|drums?|kit|loop|beat)([^a-z]|$)|킥|스네어|하이햇|햇|드럼|탐|심벌/],
  ['bass', /(^|[^a-z])(bass|sub|808|moog)([^a-z]|$)|베이스/],
  ['vox', /(^|[^a-z])(vox|vocals?|voice|bgv|bv|backing|harmony|harm|ad ?libs?|choir|hum|dbl|double|rap|sing|lead vox)([^a-z]|$)|보컬|허밍|목소리|코러스/],
  ['gtr', /(^|[^a-z])(gtr|guitars?|guit|acoustic|strat|tele|uke|banjo|mandolin)([^a-z]|$)|기타/],
  ['keys', /(^|[^a-z])(keys?|piano|pno|rhodes|wurli|organ|synth|pad|e-?piano|ep|clav|strings?|brass)([^a-z]|$)|건반|키보드|피아노|신스|패드/],
  ['fx', /(^|[^a-z])(fx|sfx|riser|impacts?|sweep|noise|air|atmos|amb|foley|whoosh|uplifter|downlifter)([^a-z]|$)|효과음|에어/],
]
/* what a file sounds like, read roughly from its outline (about a hundred points to the second) and two numbers the app
   measures: how much of it lies below about 150 Hz (low), and how often it crosses zero (zc, about its pitch). Only what
   can be told this way is told: things that are struck (each rise falls away again at once, and it is either noise or a
   thud) are drums; a low, held sound is a bass. Anything else is left unread. */
function readTone (d) {
  const pk = d && d.peaks, tone = d && d.tone
  if (!pk || pk.length < 60 || !(d.sec > 0) || !tone) return null
  const per = pk.length / d.sec, w = Math.max(1, Math.round(per * .03)), after = Math.max(2, Math.round(per * .2)), dips = []
  let top = 0
  for (let i = 0; i < pk.length; i++) if (pk[i] > top) top = pk[i]
  if (top < .003) return null
  for (let i = w; i + after < pk.length; i++) {
    if (!(pk[i] > top * .12 && pk[i] > pk[i - w] * 2.2 && pk[i] >= pk[i + 1])) continue      // a hit, at its top
    let low = pk[i]
    for (let k = 1; k <= after; k++) if (pk[i + k] < low) low = pk[i + k]
    dips.push(20 * Math.log10(pk[i] / Math.max(low, 1e-4)))
    i += Math.max(1, Math.round(after / 2))
  }
  dips.sort((x, y) => x - y)
  const struck = dips.length >= Math.max(2, d.sec * .4) && dips[dips.length >> 1] >= 12           // most of its hits have fallen a long way a fifth of a second on
  if (struck && (tone.zc >= 1500 || (tone.low >= .5 && tone.zc < 220))) return 'drums'
  if (!struck && tone.low >= .45 && tone.zc > 0 && tone.zc < 260) return 'bass'
  return null
}
const famByName = name => { const s = String(name || '').toLowerCase(); for (const [f, re] of FAM_WORDS) if (re.test(s)) return f; return null }
const famOf = t => t.kind === 'bus' ? 'bus' : famByName(t.name) || t.tone || null
/* a family takes one pigment and lays it out from deep to light across its tracks, the way a colour is drawn down on a
   chart; each end is [hue, lightness, strength]. Buses are grey. A colour set by hand is [family, step 0..6]. */
const PIGMENT = { drums: [[266, .40, .150], [236, .73, .085]], bass: [[302, .44, .135], [322, .60, .120]], keys: [[174, .48, .105], [146, .75, .090]], gtr: [[54, .56, .125], [92, .81, .125]], vox: [[36, .60, .175], [4, .81, .070]], fx: [[88, .86, .035], [88, .78, .030]] }
const PIG_ORDER = ['drums', 'bass', 'keys', 'gtr', 'vox', 'fx']
function swatch (fam, f) {
  const e = PIGMENT[fam]
  let L, C, h
  if (e) { h = e[0][0] + (e[1][0] - e[0][0]) * f; L = e[0][1] + (e[1][1] - e[0][1]) * f; C = e[0][2] + (e[1][2] - e[0][2]) * f } else { L = fam === 'bus' ? .62 : .3 + .5 * f; C = .01; h = 85 }
  return { c: oklch(L, C, h), deep: oklch(clamp(L - .42, .13, .3), C * .6, h), sel: oklch(Math.min(.94, L + .17), C * .7, h), on: L < .58 ? INK : K0 }
}
/* every track's colour and outline, worked out again whenever tracks come, go, move or are renamed */
function repaint () {
  const fams = new Map(), loose = []
  for (const t of S.tracks) { t.fam = famOf(t); if (t.kind === 'audio') { if (t.fam && t.fam !== 'bus') { if (!fams.has(t.fam)) fams.set(t.fam, []); fams.get(t.fam).push(t) } else loose.push(t) } }
  for (const t of S.tracks) {
    let fam = t.fam, f = .35
    if (t.kind === 'stack') { const kids = S.tracks.filter(c => c.parent === t.id), count = {}; for (const c of kids) { const cf = famOf(c); if (cf) count[cf] = (count[cf] || 0) + 1 } fam = famByName(t.name) || Object.keys(count).sort((a, b) => count[b] - count[a])[0] || 'fx'; f = .3 }
    else if (t.kind === 'audio') {
      if (fam && fams.has(fam)) { const m = fams.get(fam); f = m.length > 1 ? m.indexOf(t) / (m.length - 1) : .35 }
      else { const k = loose.indexOf(t); fam = PIG_ORDER[k % 5]; f = .35 + .12 * (Math.floor(k / 5) % 3) }          // a sound that was not recognised still gets a pigment of its own
    }
    const sw = t.col ? swatch(t.col[0], t.col[1] / 6) : swatch(fam, f)
    t.c = sw.c; t.deep = sw.deep; t.csel = sw.sel; t.on = sw.on
    t.outline = t.shape || (t.midi ? 'notes' : t.kind === 'audio' && t.fam && SHAPES[t.fam] ? t.fam : 'plain')
  }
}
/* a region's own colour and outline, when it was given one by hand; else its track's */
const regLook = (r, t) => { const sw = r.col ? swatch(r.col[0], r.col[1] / 6) : null; return { c: sw ? sw.c : t.c, deep: sw ? sw.deep : t.deep, sel: sw ? sw.sel : t.csel, on: sw ? sw.on : t.on, outline: r.shape || t.outline } }
const RH = () => S.rh
/* rows: the tracks that show (the ones inside a closed stack do not), as indexes into S.tracks */
const byId = id => S.tracks.find(t => t.id === id) || null
const rows = () => { const closed = new Set(S.tracks.filter(t => t.kind === 'stack' && !t.open).map(t => t.id)), out = []; S.tracks.forEach((t, i) => { if (!(t.parent && closed.has(t.parent))) out.push(i) }); return out }
const rowOf = i => rows().indexOf(i)
const rowY = i => TY + rowOf(i) * S.rh - VY
const laneAt = y => { const r = rows(); return r[clamp(Math.floor((y - TY + VY) / S.rh), 0, r.length - 1)] }
const maxVY = () => Math.max(0, rows().length * S.rh - LANES_H)
function showRow (i) { const k = rowOf(i); if (k < 0) return; const y = k * S.rh; if (y < VY) VY = y; else if (y + S.rh > VY + LANES_H) VY = y + S.rh - LANES_H; VY = clamp(VY, 0, maxVY()) }
/* a fader: −∞ at the bottom, +6 at the top, most of its travel given to the last 30 dB */
const volF = db => db <= -47.5 ? 0 : db <= -24 ? (db + 48) / 24 * .25 : .25 + (db + 24) / 30 * .75
const fVol = f => { const v = f <= .25 ? -48 + f / .25 * 24 : -24 + (f - .25) / .75 * 30; return v <= -47.5 ? -48 : Math.abs(v) < .35 ? 0 : Math.round(v * 10) / 10 }
const patchNow = t => { const { A, B, x } = t.patch; return { tape: lerp(A.tape, B.tape, x), space: lerp(A.space, B.space, x), delay: lerp(A.delay, B.delay, x), share: lerp(A.share, B.share, x) } }
/* is a print on a track's patch: it is when it is turned up at all, or a line is drawn for it along the song */
const PRINTS3 = ['tape', 'space', 'delay'], PRINT_START = { tape: 24, space: 30, delay: 20 }
const printOn = (t, k) => patchNow(t)[k] > .5 || ((t.autos && t.autos[k]) || []).length > 0
/* a print that is moved writes into the snapshot nearer the scene hand, so what you set is what you get */
function setPrint (t, k, v) {
  v = clamp(v, 0, 100)
  const { A, B, x } = t.patch
  if (x < .5) A[k] = clamp((v - B[k] * x) / (1 - x), 0, 100); else B[k] = clamp((v - A[k] * (1 - x)) / x, 0, 100)
}
const anySolo = () => S.tracks.some(t => t.solo)
/* where a track's sound goes next: its stack, else the bus it is routed to, else the stereo out (0) */
const destId = t => t.parent || t.out || 0
function reaches (a, b, depth = 0) {
  if (!a || !b || depth > 8) return false
  for (const id of [destId(a)].concat((a.sends || []).map(s => s.to))) { if (!id) continue; if (id === b.id) return true; if (reaches(byId(id), b, depth + 1)) return true }
  return false
}
/* solo keeps open what the soloed track plays into, and what plays into a soloed bus */
const audible = t => {
  if (!anySolo()) return !t.mute
  if (t.solo) return true
  if (t.mute) return false
  return S.tracks.some(s => s.solo && (reaches(s, t) || reaches(t, s)))
}
/* does it reach the speakers: itself open, and every bus on its way out */
const heard = t => { let x = t, k = 0; while (x && k++ < 8) { if (!audible(x)) return false; x = byId(destId(x)) } return true }
/* where no scene has begun yet (or there are none): a nameless stretch up to the first one */
const NO_SCENE = () => ({ i: -1, name: '', a: 1, b: SCENES.length ? SCENES[0].a : SONG_END + 1 })
const sceneAt = pos => SCENES.find(s => pos + 1 >= s.a - 1e-6 && pos + 1 < s.b - 1e-6) || (SCENES.length && pos + 1 >= SCENES[0].a ? SCENES[SCENES.length - 1] : NO_SCENE())
const dbLin = v => v <= -47.5 ? 0 : Math.pow(10, v / 20)

/* ── the engine ── */
const E = { ctx: null, master: null, rev: null, an: null, buf: {}, gen: null, anchors: [], timer: null, jumpAt: 0 }

function toBuffer (ctx, lp) { const b = ctx.createBuffer(lp.ch.length, lp.n, SND_SR); lp.ch.forEach((a, c) => b.copyToChannel(a, c)); return b }
const _curves = new Map()
function tapeCurve (a) {
  const k = Math.round(clamp(a, 0, 1) * 50)
  if (_curves.has(k)) return _curves.get(k)
  const N = 2048, c = new Float32Array(N), drive = .01 + (k / 50) * 7, norm = Math.tanh(drive), g = Math.pow(norm / drive, .8)
  for (let i = 0; i < N; i++) { const x = i / (N - 1) * 2 - 1; c[i] = Math.tanh(drive * x) / norm * g }
  _curves.set(k, c)
  return c
}
function makeReverb (ctx, dest) {
  const input = ctx.createGain(), hp = ctx.createBiquadFilter(), conv = ctx.createConvolver(), out = ctx.createGain()
  hp.type = 'highpass'; hp.frequency.value = 170
  const ir = makeIR(ctx.sampleRate, 3.7), b = ctx.createBuffer(2, ir[0].length, ctx.sampleRate)
  b.copyToChannel(ir[0], 0); b.copyToChannel(ir[1], 1)
  conv.buffer = b; out.gain.value = .9
  input.connect(hp); hp.connect(conv); conv.connect(out); out.connect(dest)
  return { input }
}
/* one track: tape, then space and delay side by side, then the fader */
function makeTrackNodes (ctx, dest, revIn, dry) {
  const g = () => ctx.createGain()
  const nd = { in: g(), fader: g(), gate: g(), gl: g(), gr: g() }
  /* after the fader: a balance, the far side falling away */
  const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2)
  nd.gate.channelCount = 2; nd.gate.channelCountMode = 'explicit'
  nd.fader.connect(nd.gate); nd.gate.connect(split); split.connect(nd.gl, 0); split.connect(nd.gr, 1); nd.gl.connect(merge, 0, 0); nd.gr.connect(merge, 0, 1); merge.connect(dest)
  if (dry) { nd.in.connect(nd.fader); return nd }
  nd.shaper = ctx.createWaveShaper(); nd.shaper.oversample = '2x'
  nd.tone = ctx.createBiquadFilter(); nd.tone.type = 'lowpass'; nd.tone.Q.value = .5
  nd.delay = ctx.createDelay(2); nd.fbLP = ctx.createBiquadFilter(); nd.fbLP.type = 'lowpass'; nd.fbLP.frequency.value = 3200
  nd.fb = g(); nd.dWet = g(); nd.send = g()
  nd.in.connect(nd.shaper); nd.shaper.connect(nd.tone); nd.tone.connect(nd.fader)
  nd.tone.connect(nd.delay); nd.delay.connect(nd.fbLP); nd.fbLP.connect(nd.fb); nd.fb.connect(nd.delay); nd.fbLP.connect(nd.dWet); nd.dWet.connect(nd.fader)
  nd.tone.connect(nd.send); if (revIn) nd.send.connect(revIn)
  return nd
}
/* how: 'ramp' while playing, 'set' when a track is born, 'print' for a stem (mute and solo do not print) */
function setTrack (ctx, nd, t, how) {
  const set = (param, v) => { if (how === 'ramp') param.setTargetAtTime(v, ctx.currentTime, .015); else param.value = v }
  const vol = dbLin(t.vol), on = how === 'print' ? 1 : (heard(t) ? 1 : 0)
  set(nd.fader.gain, vol); set(nd.gate.gain, on)
  { const p = t.pan || 0; set(nd.gl.gain, p <= 0 ? 1 : 1 - p); set(nd.gr.gain, p >= 0 ? 1 : 1 + p) }
  if (!nd.shaper) return
  const p = patchNow(t)
  nd.shaper.curve = tapeCurve(p.tape / 100)
  set(nd.tone.frequency, 19000 - 13500 * Math.pow(p.tape / 100, 1.3))
  set(nd.delay.delayTime, SPB() / 8)
  set(nd.fb.gain, .35)
  set(nd.dWet.gain, (1 - p.share / 100) * (p.delay / 100) * 1.5)
  set(nd.send.gain, (p.share / 100) * (p.space / 100) * 1.7 * vol * on)
}
function schedule (ctx, t, bus, fromBar, atTime, endBar, bufOf) {
  const spb = SPB(), srcs = []
  for (const r of t.regs) {
    if (r.mute) continue
    const ra = r.a - 1, rb = Math.min(r.b - 1, endBar)
    if (rb <= fromBar + 1e-9 || ra >= endBar) continue
    const st = Math.max(ra, fromBar), src = ctx.createBufferSource(), g = ctx.createGain()
    const tAt = bar => atTime + (bar - fromBar) * spb, when = tAt(st), until = tAt(rb), lvl = dbLin(r.gain || 0), into = (r.off || 0) + (st - ra)
    if (r.loop) {
      const lp = LOOPS[r.buf]
      src.buffer = bufOf(r.buf); src.loop = true
      src.start(when, ((((into % lp.bars) + lp.bars) % lp.bars) * spb) % src.buffer.duration)
    } else {
      const rate = r.rate || 1, off = into * spb * rate
      if (!r.buf || off < 0 || off >= r.buf.duration) continue
      src.buffer = r.buf; src.playbackRate.value = rate
      src.start(when, off)
    }
    /* the region's own level, with its fades */
    const fi = Math.min(r.fi || 0, rb - ra), fo = Math.min(r.fo || 0, rb - ra - fi), fiEnd = ra + fi, foStart = rb - fo
    /* a fade is drawn into the gain as a short run of points along its curve (a straight one too, so all are made the same way).
       Nothing else may be set inside a run, so the level is only set by itself where no run begins at the very start */
    const run = (b0, b1, f) => { const N = 48, pts = new Float32Array(N + 1); for (let i = 0; i <= N; i++) pts[i] = lvl * f(b0 + (b1 - b0) * i / N); const d = tAt(b1) - tAt(b0); if (d > 2e-4) g.gain.setValueCurveAtTime(pts, tAt(b0), d - 1e-4); else g.gain.setValueAtTime(pts[N], tAt(b0)) }
    const inAt = b => fadeShape(r.fic || 0, (b - ra) / fi), outAt = b => fadeShape(r.foc || 0, (rb - b) / fo)
    const rising = fi > 0 && st < fiEnd, s0 = fo > 0 ? Math.max(rising ? fiEnd : st, foStart) : Infinity
    if (rising) run(st, fiEnd, inAt)
    else if (!(s0 <= st + 1e-9)) g.gain.setValueAtTime(lvl, when)                                  // it begins at its full level
    if (fo > 0 && rb > s0 + 1e-9) run(s0, rb, outAt)
    src.stop(until); src.connect(g); g.connect(bus); srcs.push(src)
  }
  return srcs
}

function ensureAudio () {
  if (E.ctx) return E.ctx
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = E.ctx = new AC()
  E.master = ctx.createGain(); E.master.gain.value = dbLin(S.master)
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -3; comp.knee.value = 2; comp.ratio.value = 20; comp.attack.value = .002; comp.release.value = .12
  E.an = ctx.createAnalyser(); E.an.fftSize = 2048
  E.master.connect(comp); comp.connect(ctx.destination); comp.connect(E.an)
  E.rev = makeReverb(ctx, E.master)
  for (const k in LOOPS) E.buf[k] = toBuffer(ctx, LOOPS[k])
  for (const t of S.tracks) birth(t)
  return ctx
}
function birth (t) { if (!E.ctx || t.n) return; t.n = makeTrackNodes(E.ctx, E.master, E.rev.input); setTrack(E.ctx, t.n, t, 'set') }      // in a browser every track plays straight to the out: buses, sends and automation are the app's
function applyAll () { if (E.ctx) for (const t of S.tracks) { birth(t); setTrack(E.ctx, t.n, t, 'ramp') } }
/* the page's hands reach the engine through these; native.js swaps them when the app is the engine */
function pushTrack (t) { if (t.n) setTrack(E.ctx, t.n, t, 'ramp') }
function pushTransport () {}
function pushMaster () { if (E.master) E.master.gain.value = dbLin(S.master) }
function pushClick () {}
let resyncT = 0
function resyncSoon () { if (!resyncT) resyncT = setTimeout(() => { resyncT = 0; resync() }, 60) }      // many small moves, one telling
function pushQueue () {}
async function decodeFile (f) { const ctx = ensureAudio(), buf = await ctx.decodeAudioData(await f.arrayBuffer()); return { buf, sec: buf.duration } }

function startGen (fromBar, atTime) {
  const ctx = E.ctx, g = { srcs: [], buses: [] }
  for (const t of S.tracks) {
    birth(t)
    const bus = ctx.createGain(); bus.connect(t.n.in); g.buses.push(bus)
    for (const s of schedule(ctx, t, bus, fromBar, atTime, SONG_END, k => E.buf[k])) g.srcs.push(s)
  }
  E.gen = g
  E.anchors.push({ t: atTime, bar: fromBar })
  if (E.anchors.length > 6) E.anchors.splice(0, E.anchors.length - 6)
}
function cutGen (g, atTime) {
  if (!g) return
  const ctx = E.ctx
  for (const bus of g.buses) { bus.gain.setValueAtTime(1, Math.max(ctx.currentTime, atTime - .006)); bus.gain.linearRampToValueAtTime(0, Math.max(ctx.currentTime + .001, atTime)) }
  for (const s of g.srcs) { try { s.stop(atTime + .02) } catch (e) {} }
  setTimeout(() => { for (const bus of g.buses) { try { bus.disconnect() } catch (e) {} } }, Math.max(0, (atTime - ctx.currentTime) * 1000) + 500)
}
function posAt (time) {
  let a = null
  for (const x of E.anchors) if (x.t <= time + 1e-6) a = x
  if (!a) a = E.anchors[0]
  return a ? a.bar + (time - a.t) / SPB() : S.pos
}
function curPos () { return S.playing && E.ctx ? clamp(posAt(E.ctx.currentTime), 0, SONG_END) : S.pos }
const timeOf = bar => { const a = E.anchors[E.anchors.length - 1]; return a.t + (bar - a.bar) * SPB() }

/* where the song starts from when it is told to play: the place given; else, with the cycle on, where the cycle begins; else the playhead */
const cycleLives = () => S.cycle.on && S.cycle.b - S.cycle.a > 1e-3
function startBar (from) { if (from != null) S.pos = clamp(from, 0, SONG_END); else if (cycleLives()) S.pos = S.cycle.a; if (S.pos >= SONG_END - 1e-6) S.pos = 0; return S.pos }
/* stop, pressed with the song already stopped: back to where the cycle begins, and from there to the start */
const restBar = () => cycleLives() && Math.abs(S.pos - S.cycle.a) > 1e-6 ? S.cycle.a : 0
function play (from) {
  const ctx = ensureAudio()
  if (ctx.state !== 'running') ctx.resume()
  if (S.playing) return
  startBar(from)
  E.anchors = []; E.jumpAt = 0
  startGen(S.pos, ctx.currentTime + .08)
  S.playing = true
  clearInterval(E.timer); E.timer = setInterval(tick, 25)
}
function halt (rewind) {
  if (S.playing) {
    const now = E.ctx.currentTime
    S.pos = clamp(posAt(now), 0, SONG_END)
    cutGen(E.gen, now + .03); E.gen = null
    S.playing = false; S.queued = null
    clearInterval(E.timer)
  } else if (rewind) S.pos = restBar()
}
function jumpTo (bar, T) {
  if (!S.playing) { S.pos = clamp(bar, 0, SONG_END); return }
  T = T || E.ctx.currentTime + .05
  cutGen(E.gen, T); startGen(bar, T); E.jumpAt = T
}
function resync () { if (S.playing) { const T = E.ctx.currentTime + .06, p = posAt(T); cutGen(E.gen, T); startGen(p, T); E.jumpAt = T } }
function tick () {
  const now = E.ctx.currentTime
  if (now < E.jumpAt) return
  const p = posAt(now)
  if (S.queued != null) {                                   // a scene asked for while playing goes at the next bar line
    const T = timeOf(Math.floor(p + 1e-6) + 1)
    if (T - now < .14) { const sc = SCENES[S.queued]; S.queued = null; jumpTo(sc.a - 1, Math.max(T, now + .02)); uiDirty('scenes') }
    return
  }
  if (S.cycle.on && S.cycle.b - S.cycle.a > 1e-3 && p < S.cycle.b + 1e-6) { const T = timeOf(S.cycle.b); if (T - now < .14) { jumpTo(S.cycle.a, Math.max(T, now + .02)); return } }   // the cycle
  if (p >= SONG_END) { halt(false); S.pos = 0; uiDirty('top', 'scenes') }
}
/* every list of regions a track has: its own, and those of its alternatives that are put aside (t.alts: [{ name, regs }]) —
   whatever is done to the song's time is done to all of them */
const lanesOf = t => [t].concat(t.alts || [])
/* a file keeps its length in seconds when the tempo moves, so its bars change — unless it is told to follow the tempo: then it keeps its bars and is stretched (those are handed back) */
function retime (from, to) { return retimeBy(to / from) }
/* one region when the bar becomes 1/k as long in seconds: a file keeps its seconds, so it is k times as many bars. Says
   whether it follows the tempo by being stretched instead (it stays as many bars, and what plays it is rendered again). */
function retimeReg (r, k) {
  delete r._p
  if (r.loop) return false
  if (r.fx) { r.rate = (r.rate || 1) * k; r.sec = (r.sec || 0) / k; for (const m of r.flex || []) m.d /= k; return true }
  r.b = r.a + (r.b - r.a) * k; r.off = (r.off || 0) * k; if (r.srcBars) r.srcBars *= k; r.fi = (r.fi || 0) * k; r.fo = (r.fo || 0) * k; if (r.xo) r.xo *= k; scaleNotes(r, k)
  return false
}
/* what is held goes with the tempo as what lies in the song does: what was copied is so many more bars, or fewer; a stretch
   taken out of the song was so many bars of before — its files would not fill it now — and is let go */
function retimeClip (k) {
  TIME_CLIP = null
  for (const c of CLIP) { if (c.r.flex) c.r.flex = c.r.flex.map(m => Object.assign({}, m)); retimeReg(c.r, k) }
}
/* the bar became 1/k as long in seconds (the tempo moved, or the measure) */
function retimeBy (k) {
  const follow = []
  retimeClip(k)
  for (const t of S.tracks) for (const L of lanesOf(t)) for (const r of L.regs) if (retimeReg(r, k) && L === t) follow.push(r)
  return follow
}
/* a change of tempo is a step that can be undone: the song as it stood, tempo and all, is kept first. Changes that follow
   one another closely — a value being pulled — are one step. */
function tempoStep () {
  const last = UNDO[UNDO.length - 1], now = Date.now()
  if (last && last.tempoAt && now - last.tempoAt < 1500) { last.tempoAt = now; REDO.length = 0; return }
  const st = editState()
  st.tempoAt = now
  UNDO.push(st); if (UNDO.length > 120) UNDO.shift()
  REDO.length = 0
}
/* the tempo set to what a kept state of the song was at (undo, redo): nothing in the song is measured anew — the state
   brings its own regions, as many bars long as they were at that tempo */
let tempoBack = bpm => {
  S.tempo = bpm
  LOOPS = songLoops(bpm)
  if (E.ctx) for (const k in LOOPS) E.buf[k] = toBuffer(E.ctx, LOOPS[k])
}
function setTempo (bpm) {
  const was = S.playing, p = curPos(), was0 = S.tempo
  if (was) halt(false)
  tempoStep()
  S.tempo = bpm
  LOOPS = songLoops(bpm)
  settleAfter(() => retime(was0, bpm)); liveSelX()
  if (E.ctx) { for (const k in LOOPS) E.buf[k] = toBuffer(E.ctx, LOOPS[k]); applyAll() }
  growSong()                                                                          // (files are so many more bars now, or fewer: the song is as long as what is in it)
  S.pos = Math.min(p, SONG_END)
  if (was) play(S.pos)
}

/* ── stems ── */
async function renderStem (t, a0, a1, mode) {
  const wet = mode !== 'dry', frames = Math.ceil(((a1 - a0) * SPB() + (wet ? 2.5 : .05)) * SND_SR)
  const oc = new OfflineAudioContext(2, frames, SND_SR)
  const rev = wet ? makeReverb(oc, oc.destination) : null
  const nd = makeTrackNodes(oc, oc.destination, rev && rev.input, !wet)
  setTrack(oc, nd, t, 'print')
  const cache = {}
  schedule(oc, t, nd.in, a0, 0, a1, k => cache[k] || (cache[k] = toBuffer(oc, LOOPS[k])))
  return oc.startRendering()
}
function wav16 (buf) {
  const len = buf.length, L = buf.getChannelData(0), Rr = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
  const ab = new ArrayBuffer(44 + len * 4), v = new DataView(ab)
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + len * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true)
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, len * 4, true)
  let o = 44
  for (let i = 0; i < len; i++) {
    const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, Rr[i]))
    v.setInt16(o, l < 0 ? l * 32768 : l * 32767, true); v.setInt16(o + 2, r < 0 ? r * 32768 : r * 32767, true); o += 4
  }
  return new Uint8Array(ab)
}
const CRC_T = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0 } return t })()
function crc32 (u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
/* a zip with nothing squeezed: wav does not shrink much, and this keeps the page small */
function zipStore (files) {
  const enc = new TextEncoder(), parts = [], central = []
  let off = 0
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true)
    lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true)
    parts.push(new Uint8Array(lh.buffer), name, f.data)
    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true)
    ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true)
    central.push(new Uint8Array(ch.buffer), name)
    off += 30 + name.length + sz
  }
  const csz = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true)
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' })
}
