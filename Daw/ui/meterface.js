/* ── the meter's face ──
   A window of the Mac's (Source/Meter.h) with this page in it. It asks the app twenty times a second what the meter on a
   track's wall shows (meterRead) and draws it, as the draft has it (design/meter draft 1, face a; made narrow it is face
   b): the wave as it came with the short-term loudness over it; how loud; each side; the stereo picture three ways.
   The page changes nothing in the song. What it is set to (how much of the wave, the aim, which picture, hold) is the
   same for every meter and is kept with the app's settings.
   In a browser there is no app: the page draws made-up sound, so that it can be looked at. */
const K0 = '#0E0E0E', K1 = '#151514', K2 = '#1B1B1A', K3 = '#262625', INK = '#ECEAE4', OCH = '#C9A23A', RED = '#D8432E'
const FONT = "'Instrument Sans', 'Pretendard Variable', 'Apple SD Gothic Neo', system-ui, sans-serif"
const Q = new URLSearchParams(location.search)
const WHO = { track: +(Q.get('track') || 0), id: +(Q.get('id') || 0), name: Q.get('name') || '', c: /^#[0-9a-f]{6}$/i.test(Q.get('c') || '') ? Q.get('c') : '#E0562F' }
const NAT = (() => {
  const J = window.__JUCE__
  if (!J || !J.backend || !((J.initialisationData || {}).__juce__functions || []).includes('daw')) return null
  let nid = 1
  const wait = new Map()
  J.backend.addEventListener('__juce__complete', d => { const f = wait.get(d.promiseId); if (f) { wait.delete(d.promiseId); f(d.result) } })
  return { call: (op, data) => new Promise(res => { const id = nid++; wait.set(id, res); J.backend.emitEvent('__juce__invoke', { name: 'daw', params: [op, data == null ? {} : data], resultId: id }) }) }
})()
const said = s => (window.LANG_WORDS ? window.LANG_WORDS(s) : s)
const SET = { sec: 10, aim: -14, mode: 'lissajous', hold: true }
const SECS = [5, 10, 30], AIMS = [-9, -14, -16, -23], MODES = ['lissajous', 'polar sample', 'polar level']
window.__errs = []; addEventListener('error', e => window.__errs.push(String(e.message || e))); addEventListener('unhandledrejection', e => window.__errs.push('rejected: ' + String((e.reason && e.reason.message) || e.reason)))
const F = { now: null, gone: false, hits: [], heldL: [], heldR: [], level: new Float32Array(48), w: 0, h: 0 }

/* ── what the app sent, made ready to draw ── */
const bytes = b64 => { const s = atob(b64 || ''), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u }
function take (r) {
  if (!r || !r.ok) { F.gone = true; return }
  F.gone = false
  r.waveB = bytes(r.wave); r.pairB = bytes(r.pairs)
  /* the peaks held: with hold, the highest since the count began (the app's); without, the highest of the last two seconds */
  const t = performance.now()
  for (const [list, v] of [[F.heldL, r.peakL], [F.heldR, r.peakR]]) { list.push([t, v]); while (list.length && t - list[0][0] > 2000) list.shift() }
  r.showL = SET.hold ? r.heldL : Math.max(...F.heldL.map(x => x[1])); r.showR = SET.hold ? r.heldR : Math.max(...F.heldR.map(x => x[1]))
  F.now = r
}
/* made-up sound, for a browser: a voice in phrases */
const FAKE = (() => {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 1.2
  const b64 = u => { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s) }
  return sec => {
    seed = 7
    const n = Math.round(sec * 100), wave = new Uint8Array(n * 4), pairs = new Uint8Array(2048)
    for (let i = 0; i < n; i++) {
      const t = i / n * 10, ph = [[.3, 1.9, .8], [2.3, 3.6, .95], [4.1, 5.2, .6], [5.6, 7.9, 1], [8.3, 9.8, .85]].find(p => t >= p[0] && t <= p[1])
      let e = .012
      if (ph) { const u = (t - ph[0]) / (ph[1] - ph[0]); e = Math.max(.012, ph[2] * Math.min(1, u * 9) * Math.min(1, (1 - u) * 5) * (.55 + .45 * Math.abs(Math.sin(t * 9.3)) * (.6 + .4 * rnd())) * .8) }
      wave[i * 4] = Math.round((e + 1) * 127.5); wave[i * 4 + 1] = Math.round((-e * .9 + 1) * 127.5); wave[i * 4 + 2] = Math.round((Math.max(-63.75, -14 - (1 - e) * 16) + 63.75) * 4); wave[i * 4 + 3] = Math.abs(t - 6.12) < .006 ? 1 : 0
    }
    for (let i = 0; i < 1024; i++) { const a = Math.pow(rnd(), .6) * .8, m = gauss() * a, s = gauss() * a * .34; pairs[i * 2] = Math.round((Math.max(-1, Math.min(1, m + s)) + 1) * 127.5); pairs[i * 2 + 1] = Math.round((Math.max(-1, Math.min(1, m - s)) + 1) * 127.5) }
    return { ok: true, m: -11.6, s: -13.1, i: -14.2, range: 6.3, tp: -.2, sec: 222, peakL: -6.2, peakR: -5.1, heldL: -1.4, heldR: -.2, rmsL: -17.8, rmsR: -18.4, over: 1, cor: .78, corLow: .12, bal: .4, width: .34, wave: b64(wave), pairs: b64(pairs) }
  }
})()

/* ── drawn ── */
const cv = document.getElementById('face'), g = cv.getContext('2d')
const px = v => Math.round(v) + .5
function text (x, y, s, o = {}) {
  g.font = `${o.it ? 'italic ' : ''}${o.w || 400} ${o.size || 10}px ${FONT}`
  g.textAlign = o.anchor === 'end' ? 'right' : o.anchor === 'middle' ? 'center' : 'left'
  g.globalAlpha = o.a == null ? 1 : o.a; g.fillStyle = o.c || INK
  if (o.ls) g.letterSpacing = o.ls
  g.fillText(s, x, y)
  if (o.ls) g.letterSpacing = '0px'
  g.globalAlpha = 1
  return g.measureText(s).width
}
const tw = (s, size = 10, w = 400) => { g.font = `${w} ${size}px ${FONT}`; return g.measureText(s).width }
const rect = (x, y, w, h, c, a = 1) => { g.globalAlpha = a; g.fillStyle = c; g.fillRect(x, y, Math.max(0, w), Math.max(0, h)); g.globalAlpha = 1 }
const line = (x0, y0, x1, y1, c = INK, a = .1, w = 1, dash) => { g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]); g.globalAlpha = 1 }
const hl = (x0, x1, y, a = .1) => line(x0, px(y), x1, px(y), INK, a), vl = (x, y0, y1, a = .1) => line(px(x), y0, px(x), y1, INK, a)
const num = (v, d = 1) => !isFinite(v) || v <= -100 ? '−∞' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(d)
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const hit = (x, y, w, h, k, v) => F.hits.push({ x, y, w, h, k, v })
function cell (x, y, s, on, k, v) {
  const w = Math.round(tw(said(s), 9.5, on ? 500 : 400) + 18)
  if (on) rect(x, y, w, 18, INK); else { g.globalAlpha = .22; g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, w - 1, 17); g.globalAlpha = 1 }
  text(x + w / 2, y + 12.6, said(s), { size: 9.5, anchor: 'middle', c: on ? K0 : INK, a: on ? 1 : .8, w: on ? 500 : 400 })
  hit(x, y - 3, w, 24, k, v)
  return w
}
const cellW = (s, on) => Math.round(tw(said(s), 9.5, on ? 500 : 400) + 18)
function field (x, y, k, v, key) { const a = text(x, y, said(k), { size: 9.5, a: .42 }), b = text(x + a + 6, y, v, { size: 9.5, a: .9 }); hit(x - 4, y - 14, a + b + 14, 22, key); return a + 6 + b }
function big (x, y, k, v, unit, o = {}) {
  const size = o.size || 22
  text(x, y, said(k), { size: 9.5, a: .42 })
  const w = text(x, y + size + 2, v, { size, w: 500, c: o.c || INK, ls: '-0.02em' })
  if (unit) text(x + w + 5, y + size + 2, unit, { size: 9.5, a: .42 })
}
const dbY = (db, y, h) => y + h * (1 - Math.min(1, Math.max(0, (db + 60) / 63)))
const luY = (lu, y, h) => y + h * Math.min(1, Math.max(0, -lu / 36))
function sideBar (x, y, w, h, rms, peak, held, lab) {
  rect(x, y, w, h, K0)
  rect(x, dbY(peak, y, h), w, y + h - dbY(peak, y, h), INK, .26); rect(x, dbY(rms, y, h), w, y + h - dbY(rms, y, h), INK, .82)
  line(x, px(dbY(held, y, h)), x + w, px(dbY(held, y, h)), held > -.3 ? RED : INK, 1, 1.5)
  text(x + w / 2, y + h + 13, lab, { size: 9.5, anchor: 'middle', a: .5 })
}
function dbScale (x, y, h) { for (const d of [0, -6, -12, -18, -24, -36, -48]) { const yy = dbY(d, y, h); hl(x - 3, x + 3, yy, .3); text(x - 7, yy + 3.3, String(Math.abs(d)), { size: 8.5, a: .42, anchor: 'end' }) } }
function loudBar (x, y, w, h, r) {
  rect(x, y, w, h, K0)
  rect(x, luY(r.m, y, h), w, y + h - luY(r.m, y, h), INK, .2); rect(x + 3, luY(r.s, y, h), w - 6, y + h - luY(r.s, y, h), INK, .82)
  if (r.i > -100) line(x - 4, px(luY(r.i, y, h)), x + w + 4, px(luY(r.i, y, h)), WHO.c, 1, 1.6)
  line(x - 4, px(luY(SET.aim, y, h)), x + w + 4, px(luY(SET.aim, y, h)), OCH, 1, 1, [2, 2])
  for (const d of [0, -6, -12, -18, -24, -30, -36]) { hl(x + w + 6, x + w + 10, luY(d, y, h), .3); text(x + w + 14, luY(d, y, h) + 3.3, String(Math.abs(d)), { size: 8.5, a: .42 }) }
}
function wave (x, y, w, h, r, loud) {
  rect(x, y, w, h, K0)
  const b = r.waveB, n = b.length >> 2, mid = y + h / 2, half = h / 2 - 3
  if (!n) return
  g.fillStyle = WHO.c; g.globalAlpha = .9; g.beginPath()
  for (let i = 0; i < w; i++) { const k = Math.min(n - 1, Math.floor(i * n / w)), k1 = Math.min(n, Math.max(k + 1, Math.floor((i + 1) * n / w))); let hi = -1; for (let j = k; j < k1; j++) hi = Math.max(hi, b[j * 4] / 127.5 - 1); const yy = mid - Math.max(.004, hi) * half; if (i === 0) g.moveTo(x, yy); else g.lineTo(x + i, yy) }
  for (let i = w - 1; i >= 0; i--) { const k = Math.min(n - 1, Math.floor(i * n / w)), k1 = Math.min(n, Math.max(k + 1, Math.floor((i + 1) * n / w))); let lo = 1; for (let j = k; j < k1; j++) lo = Math.min(lo, b[j * 4 + 1] / 127.5 - 1); g.lineTo(x + i, mid - Math.min(-.004, lo) * half) }
  g.closePath(); g.fill(); g.globalAlpha = 1
  hl(x, x + w, mid, .12)
  if (loud) { g.strokeStyle = INK; g.globalAlpha = .75; g.lineWidth = 1.1; g.beginPath(); let on = false; for (let i = 0; i < w; i += 2) { const k = Math.min(n - 1, Math.floor(i * n / w)), lu = b[k * 4 + 2] / 4 - 63.75; if (lu <= -63) { on = false; continue } const yy = y + 6 + (h - 12) * Math.min(1, Math.max(0, -lu / 36)); if (on) g.lineTo(x + i, yy); else { g.moveTo(x + i, yy); on = true } } g.stroke(); g.globalAlpha = 1 }
  for (let k = 0; k < n; k++) if (b[k * 4 + 3]) rect(x + k * w / n - 1, y + 1, 2, 5, RED)
}
/* the stereo picture */
function lissajous (x, y, sz, r) {
  const cx = x + sz / 2, cy = y + sz / 2, rad = sz / 2 - 16
  rect(x, y, sz, sz, K0)
  g.globalAlpha = .16; g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy - rad); g.lineTo(cx + rad, cy); g.lineTo(cx, cy + rad); g.lineTo(cx - rad, cy); g.closePath(); g.stroke(); g.globalAlpha = 1
  line(cx - rad, px(cy), cx + rad, px(cy), INK, .08); line(px(cx), cy - rad, px(cx), cy + rad, INK, .08); line(cx - rad / 2, cy - rad / 2, cx + rad / 2, cy + rad / 2, INK, .08); line(cx + rad / 2, cy - rad / 2, cx - rad / 2, cy + rad / 2, INK, .08)
  g.fillStyle = WHO.c; g.globalAlpha = .55
  const b = r.pairB
  for (let i = 0; i + 1 < b.length; i += 2) { const l = b[i] / 127.5 - 1, rr = b[i + 1] / 127.5 - 1, m = (l + rr) / 2, s = (rr - l) / 2, dx = s * rad * 1.3, dy = -m * rad * 1.3; if (Math.abs(dx) + Math.abs(dy) < rad) g.fillRect(cx + dx, cy + dy, 1.2, 1.2) }
  g.globalAlpha = 1
  text(cx, y + 11, 'm', { size: 9, a: .42, anchor: 'middle' }); text(x + sz - 6, cy + 3, 's', { size: 9, a: .42, anchor: 'end' }); text(cx - rad / 2 - 9, cy - rad / 2 - 5, 'l', { size: 9, a: .42 }); text(cx + rad / 2 + 6, cy - rad / 2 - 5, 'r', { size: 9, a: .42 })
}
function polar (x, y, sz, r, level) {
  const cx = x + sz / 2, cy = y + sz - 22, rad = Math.min(sz / 2 - 14, sz - 40)
  rect(x, y, sz, sz, K0)
  for (const k of [1, .66, .33]) { g.globalAlpha = k === 1 ? .16 : .07; g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, rad * k, Math.PI, 0); g.stroke() } g.globalAlpha = 1
  for (const a of [0, 45, 90, 135, 180]) { const q = a * Math.PI / 180; line(cx, cy, cx - Math.cos(q) * rad, cy - Math.sin(q) * rad, INK, .08) }
  hl(cx - rad, cx + rad, cy, .16)
  const b = r.pairB, bins = F.level.length
  if (level) for (let k = 0; k < bins; k++) F.level[k] *= .9
  g.fillStyle = WHO.c; g.globalAlpha = .55
  for (let i = 0; i + 1 < b.length; i += 2) {
    const l = b[i] / 127.5 - 1, rr = b[i + 1] / 127.5 - 1, m = (l + rr) / 2, s = (rr - l) / 2, q = Math.atan2(Math.abs(m), -s), a = Math.min(1, Math.hypot(m, s) * 1.3)
    if (level) { const k = Math.min(bins - 1, Math.floor(q / Math.PI * bins)); if (a > F.level[k]) F.level[k] = a } else g.fillRect(cx - Math.cos(q) * a * rad, cy - Math.sin(q) * a * rad, 1.2, 1.2)
  }
  g.globalAlpha = 1
  if (level) {
    g.beginPath(); g.moveTo(cx, cy)
    for (let k = 0; k < bins; k++) { const sm = (F.level[Math.max(0, k - 1)] + F.level[k] * 2 + F.level[Math.min(bins - 1, k + 1)]) / 4, q = (k + .5) / bins * Math.PI; g.lineTo(cx - Math.cos(q) * sm * rad, cy - Math.sin(q) * sm * rad) }
    g.closePath(); g.fillStyle = WHO.c; g.globalAlpha = .5; g.fill(); g.globalAlpha = 1; g.strokeStyle = WHO.c; g.lineWidth = 1.1; g.stroke()
  }
  text(cx - rad, cy + 13, 'l', { size: 9, a: .42, anchor: 'middle' }); text(cx + rad, cy + 13, 'r', { size: 9, a: .42, anchor: 'middle' }); text(cx, cy - rad - 5, 'm', { size: 9, a: .42, anchor: 'middle' })
}
const picture = (x, y, sz, r) => SET.mode === 'lissajous' ? lissajous(x, y, sz, r) : polar(x, y, sz, r, SET.mode === 'polar level')
/* a line with its middle marked, and where it stands now (v from -1 to 1) */
function gauge (x, y, w, lab, l, rr, v, word) {
  const at = x + w * (Math.max(-1, Math.min(1, v)) + 1) / 2
  text(x, y - 7, said(lab), { size: 9.5, a: .42 }); text(x + w, y - 7, word, { size: 9.5, a: .9, anchor: 'end' })
  rect(x, y, w, 5, K0); vl(x + w / 2, y - 2, y + 7, .3); rect(Math.min(at, x + w / 2), y, Math.abs(at - (x + w / 2)), 5, INK, .3); rect(at - 1, y - 2, 2, 9, INK)
  text(x, y + 17, said(l), { size: 8.5, a: .42 }); text(x + w, y + 17, said(rr), { size: 8.5, a: .42, anchor: 'end' })
}
const corWord = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2), balWord = v => Math.abs(v) < .05 ? said('middle') : `${v > 0 ? 'r' : 'l'} ${Math.abs(v).toFixed(1)} db`

function draw () {
  const W = F.w, H = F.h, r = F.now
  F.hits = []
  rect(0, 0, W, H, K1)
  /* the head */
  rect(0, 0, W, 26, K2); hl(0, W, 25, .1); rect(12, 10, 6, 6, WHO.c)
  const nameX = 24 + text(24, 16.6, said('meter'), { size: 10.5, w: 500 }) + 8
  let hx = W - 12
  hx -= cellW('reset'); cell(hx, 4, 'reset', false, 'reset'); hx -= 6 + cellW('hold', SET.hold); cell(hx, 4, 'hold', SET.hold, 'hold')
  const wide = W >= 620
  if (wide) { const aimT = `${num(SET.aim, 0)} lufs`, secT = `${SET.sec} s`; hx -= 18 + tw(said('aim'), 9.5) + 6 + tw(aimT, 9.5); field(hx, 16.6, 'aim', aimT, 'aim'); hx -= 18 + tw(said('window'), 9.5) + 6 + tw(secT, 9.5); field(hx, 16.6, 'window', secT, 'sec') }
  if (WHO.name && hx - nameX > 40) { g.save(); g.beginPath(); g.rect(nameX, 0, hx - nameX - 10, 26); g.clip(); text(nameX, 16.6, WHO.name, { size: 9.5, a: .42 }); g.restore() }
  if (!r || F.gone) { text(W / 2, H / 2, said(F.gone ? 'this meter is not on the wall any more' : 'listening'), { size: 11, a: .5, anchor: 'middle' }); return }
  const tpRed = r.tp > -1 ? RED : INK                                                    // (over -1 dbtp: more than most places take)
  if (wide) {
    /* the wave as it came */
    const wy = 52, wh = Math.round(Math.max(90, Math.min(220, (H - 26) * .29)))
    text(16, 44, said('the wave as it came'), { size: 9.5, a: .42 }); text(W - 16, 44, said('short term over it'), { size: 9.5, a: .42, anchor: 'end' })
    wave(16, wy, W - 32, wh, r, true)
    for (let k = 0; k <= 10; k++) { const x = 16 + (W - 32) * k / 10, s = SET.sec * (10 - k) / 10; vl(x, wy + wh, wy + wh + 4, .3); text(x, wy + wh + 14, k === 10 ? said('now') : `−${+s.toFixed(1)} s`, { size: 8.5, a: .42, anchor: k === 0 ? 'left' : k === 10 ? 'end' : 'middle' }) }
    const top = wy + wh + 26
    hl(0, W, top, .1)
    const y0 = top + 18, bh = Math.max(120, H - y0 - 14 - 26), c1 = Math.round(W * .367), c2 = Math.round(W * .589)
    /* how loud */
    text(16, y0, said('how loud'), { size: 9.5, a: .42 })
    big(16, y0 + 22, 'integrated', num(r.i), 'lufs', { size: 40 })
    big(16, y0 + 96, 'short term', num(r.s), 'lufs'); big(128, y0 + 96, 'momentary', num(r.m), 'lufs')
    big(16, y0 + 150, 'range', r.range.toFixed(1), 'lu'); big(128, y0 + 150, 'true peak', num(r.tp), 'dbtp', { c: tpRed })
    if (bh >= 206) { big(16, y0 + 204, 'against the aim', r.i > -100 ? (r.i - SET.aim >= 0 ? '+' : '−') + Math.abs(r.i - SET.aim).toFixed(1) : '−∞', 'lu', { size: 16 }); big(128, y0 + 204, 'measured for', clock(r.sec), '', { size: 16 }) }
    loudBar(c1 - 72, y0 + 14, 22, bh, r)
    vl(c1, top, H, .1)
    /* each side */
    const bx = c1 + 22
    text(bx, y0, said('each side'), { size: 9.5, a: .42 }); text(c2 - 22, y0, said('rms, peak, held'), { size: 9.5, a: .42, anchor: 'end' })
    dbScale(bx + 14, y0 + 14, bh - 16); sideBar(bx + 26, y0 + 14, 22, bh - 16, r.rmsL, r.peakL, r.showL, 'l'); sideBar(bx + 54, y0 + 14, 22, bh - 16, r.rmsR, r.peakR, r.showR, 'r')
    const nx = bx + 96
    text(nx, y0 + 30, said('peak'), { size: 9.5, a: .42 }); text(nx, y0 + 46, num(r.showL), { size: 13, w: 500, c: r.showL > -.3 ? RED : INK }); text(nx, y0 + 62, num(r.showR), { size: 13, w: 500, c: r.showR > -.3 ? RED : INK })
    text(nx, y0 + 92, 'rms', { size: 9.5, a: .42 }); text(nx, y0 + 108, num(r.rmsL), { size: 13, w: 500 }); text(nx, y0 + 124, num(r.rmsR), { size: 13, w: 500 })
    const crest = Math.max(r.showL, r.showR) - Math.max(r.rmsL, r.rmsR)
    text(nx, y0 + 154, said('crest'), { size: 9.5, a: .42 }); text(nx, y0 + 170, Math.max(r.rmsL, r.rmsR) > -100 ? crest.toFixed(1) : '−∞', { size: 13, w: 500 })
    text(nx, y0 + 200, said('over'), { size: 9.5, a: .42 }); text(nx, y0 + 216, String(r.over), { size: 13, w: 500, c: r.over ? RED : INK })
    vl(c2, top, H, .1)
    /* the stereo picture */
    const sx = c2 + 22, sz = Math.round(Math.max(120, Math.min(bh, W - 16 - sx - 150)))
    text(sx, y0, said('the stereo picture'), { size: 9.5, a: .42 })
    let cx = W - 16; for (const m of MODES.slice().reverse()) { cx -= cellW(m, SET.mode === m); cell(cx, y0 - 13, m, SET.mode === m, 'mode', m); cx += 1 }
    picture(sx, y0 + 14, sz, r)
    const gx = sx + sz + 22, gw = W - 16 - gx
    if (gw > 60) {
      gauge(gx, y0 + 44, gw, 'correlation', '−1', '+1', r.cor, corWord(r.cor)); gauge(gx, y0 + 104, gw, 'balance', 'l', 'r', r.bal / 12, balWord(r.bal)); gauge(gx, y0 + 164, gw, 'width', 'mono', 'wide', r.width * 2 - 1, `${Math.round(r.width * 100)} %`)
      const safe = r.corLow >= 0
      text(gx, y0 + 214, said(safe ? 'mono safe' : 'goes under 0'), { size: 9.5, a: .9, c: safe ? INK : RED }); text(gx, y0 + 228, safe ? `${said('never under 0 in')} ${clock(r.sec)}` : `${said('lowest')} ${corWord(r.corLow)}`, { size: 9, a: .42 })
    }
  } else {
    /* made narrow: loudness and the sides, the picture beside them, the two lines under */
    wave(12, 36, W - 24, 54, r, false)
    big(12, 106, 'integrated', num(r.i), 'lufs', { size: 30 }); big(Math.max(150, W - 142), 106, 'true peak', num(r.tp), 'dbtp', { c: tpRed, size: 16 }); big(Math.max(150, W - 142), 144, 'range', r.range.toFixed(1), 'lu', { size: 16 })
    const by = 196, bh = Math.max(90, H - by - 124)
    loudBar(12, by, 16, bh, r); dbScale(84, by, bh); sideBar(92, by, 16, bh, r.rmsL, r.peakL, r.showL, 'l'); sideBar(114, by, 16, bh, r.rmsR, r.peakR, r.showR, 'r')
    const sz = Math.min(bh, W - 162)
    if (sz > 70) { picture(150, by, sz, r); hit(150, by, sz, sz, 'modeNext') }
    gauge(12, H - 78, W - 24, 'correlation', '−1', '+1', r.cor, corWord(r.cor)); gauge(12, H - 32, W - 24, 'balance', 'l', 'r', r.bal / 12, balWord(r.bal))
  }
}
function fit () {
  const d = window.devicePixelRatio || 1, w = Math.max(200, window.innerWidth), h = Math.max(200, window.innerHeight)
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d) }
  g.setTransform(d, 0, 0, d, 0, 0); F.w = w; F.h = h
}
function frame () { fit(); draw() }

/* ── pressed ── */
function keep () { if (NAT) NAT.call('prefSet', { key: 'meter', value: JSON.stringify(SET) }) }
cv.addEventListener('pointerdown', e => {
  const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top
  const h = F.hits.slice().reverse().find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h)
  if (!h) return
  if (h.k === 'reset') { F.heldL = []; F.heldR = []; if (NAT) NAT.call('meterReset', { track: WHO.track, id: WHO.id }) }
  else if (h.k === 'hold') { SET.hold = !SET.hold; keep() }
  else if (h.k === 'mode') { SET.mode = h.v; keep() }
  else if (h.k === 'modeNext') { SET.mode = MODES[(MODES.indexOf(SET.mode) + 1) % MODES.length]; keep() }
  else if (h.k === 'sec') { SET.sec = SECS[(SECS.indexOf(SET.sec) + 1) % SECS.length]; keep() }
  else if (h.k === 'aim') { SET.aim = AIMS[(AIMS.indexOf(SET.aim) + 1) % AIMS.length]; keep() }
  frame()
})
cv.addEventListener('pointermove', e => { const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; cv.style.cursor = F.hits.some(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) ? 'pointer' : 'default' })
addEventListener('resize', frame)

/* ── begun ── */
async function tick () {
  if (document.hidden && !window.__always) return                                       // (a face put away asks for nothing; the check looks at one that is not in front)
  if (F.asking && performance.now() - F.asking < 1000) return                            // (the last question is still out: one at a time)
  F.asking = performance.now(); F.asked = (F.asked || 0) + 1
  const r = NAT ? await NAT.call('meterRead', { track: WHO.track, id: WHO.id, sec: SET.sec }) : FAKE(SET.sec)
  F.asking = 0; F.answered = (F.answered || 0) + 1
  take(r)
  frame()
}
(async () => {
  if (NAT) { const p = await NAT.call('prefGet'); try { const s = JSON.parse((p && p.meter) || '{}'); if (SECS.includes(s.sec)) SET.sec = s.sec; if (AIMS.includes(s.aim)) SET.aim = s.aim; if (MODES.includes(s.mode)) SET.mode = s.mode; if (typeof s.hold === 'boolean') SET.hold = s.hold } catch (e) {} }
  for (const k of ['sec', 'aim', 'mode', 'hold']) if (Q.get(k) != null) SET[k] = k === 'mode' ? Q.get(k) : k === 'hold' ? Q.get(k) === '1' : +Q.get(k)      // (for looking at it in a browser)
  if (document.fonts && document.fonts.load) { try { await Promise.all([document.fonts.load(`400 10px ${FONT}`), document.fonts.load(`500 10px ${FONT}`)]) } catch (e) {} }
  window.__meter = { F, SET, WHO, frame, tick }
  await tick()
  setInterval(tick, 50)
})()
