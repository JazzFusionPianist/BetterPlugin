/* ── the settings window ──
   A window of the Mac's (Source/Settings.h) with this page in it: the parts of the settings named down the left, the
   chosen part on the right — a name on the left of each row, the thing itself against the right edge. A change is
   taken at once; nothing is confirmed. General, display, audio and plug-ins are there: the others are named and cannot
   be picked yet. Drawn with the room's kit, at the sizes of the draft (design/settings draft 1); display and plug-ins
   are larger, and the window grows for them (display.js, design/display draft 2; plugpage.js, design/plugins draft 1). */
let PAGE_W = 700, PAGE_H = 440
const SIDE = 164, PX = 28, PR = 700 - SIDE - 28
const PARTS = ['general', 'display', 'audio', 'recording', 'editing', 'notes', 'plug-ins', 'command line', 'slur', 'hand off', 'storage']
const THERE = new Set(['general', 'display', 'audio', 'plug-ins'])        // the parts that are made
/* what a part reads as it is opened */
function partOpened (p) { if (p === 'display') displayRead(); else if (p === 'plug-ins' && !PG.list) plugRead() }
/* the page's size for a part: display has the room's every part in it, and is larger */
function setPage () {
  const [w, h] = V.part === 'display' || V.part === 'plug-ins' ? [DISP_W, DISP_H] : [700, 440]
  if (w === PAGE_W && h === PAGE_H) return
  PAGE_W = w; PAGE_H = h
  const svg = document.getElementById('svg')
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h)
  if (NAT) NAT.call('settingsSize', { w, h })
}

/* the way to the app: the room's one function (see engine.js); in a browser there is none, and the page shows a stand-in */
const NAT = (() => {
  const J = window.__JUCE__
  if (!J || !J.backend || !((J.initialisationData || {}).__juce__functions || []).includes('daw')) return null
  let nid = 1
  const wait = new Map()
  J.backend.addEventListener('__juce__complete', d => { const f = wait.get(d.promiseId); if (f) { wait.delete(d.promiseId); f(d.result) } })
  return {
    call: (op, data) => new Promise(res => { const id = nid++; wait.set(id, res); J.backend.emitEvent('__juce__invoke', { name: 'daw', params: [op, data == null ? {} : data], resultId: id }) }),
    on: (ev, fn) => J.backend.addEventListener(ev, fn),
  }
})()
const STAND_IN = { llm: 5, lang: LANG.now, outs: ['MacBook Pro Speakers', 'Scarlett 2i2 USB'], ins: ['MacBook Pro Microphone', 'Scarlett 2i2 USB'], out: 'MacBook Pro Speakers', in: 'Scarlett 2i2 USB', rates: [44100, 48000, 88200, 96000], rate: 48000, blocks: [32, 64, 128, 256, 512, 1024], block: 128, outLat: 45, inLat: 21, inputOn: true, level: .3, threads: 10, asked: -1, cores: 10, busy: false }

const V = { part: new URLSearchParams(location.search).get('part') || 'audio', now: null, menu: null, said: '', key: '' }
if (!THERE.has(V.part)) V.part = 'audio'

/* ── the things a row holds, each set against the right edge (x); every one says what a press does (data-a, data-v) ── */
const endText = (x, y, inner, size, a) => `<text x="${x}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="${size}" fill="${INK}" fill-opacity="${a}">${inner}</text>`
const said = s => esc(inWords(s))                             // a word in the language of the settings, for what the page writes without the kit
const low = s => String(s == null ? '' : s).toLowerCase()
/* one of a list, opened under the thing */
const pick = (id, t, w = 208) => (x, y) => R(x - w + .5, y + .5, w - 1, 19, { rx: 2, stroke: INK, sa: V.menu && V.menu.id === id ? .5 : .24 }) + T(x - w + 9, y + 13.6, fit(t ? asGiven(low(t)) : 'none', w - 32, 10), { size: 10, a: t ? .88 : .4 }) + caret(x - 12, y + 10, .5) + hit(x - w, y, w, 20, 'open', ` data-v="${id}"`)
/* one of a few, all in sight: a frame cut into cells, the chosen one filled */
const choice = (what, items, on, more) => (x, y) => {
  const its = items.map(([t, v]) => ({ t, on: v === on, a: 'set', more: ` data-what="${what}" data-v="${v}"` })), w = cells(0, 0, 20, its, { size: 10, pad: 10 })[1]
  const mw = more ? Math.ceil(tw(more, 9.5) * 1.12) + 9 : 0
  return cells(x - w - mw, y, 20, its, { size: 10, pad: 10 })[0] + (more ? endText(x, y + 13.6, said(more), 9.5, .42) : '')
}
const words = (...ts) => (x, y) => endText(x, y + 13.6, ts.map((t, i) => `<tspan${i ? ' dx="14"' : ''}>${said(t)}</tspan>`).join(''), 10, .5)
/* what comes in: the room's meter, in ink, ochre above −6 */
const level = v => (x, y) => { const w = 150, at = .78; return R(x - w, y + 8, w, 3, { fill: INK, fa: .12 }) + R(x - w, y + 8, w * Math.min(v, at), 3, { fill: INK, fa: .86, x: ' id="lv"' }) + (v > at ? R(x - w + w * at, y + 8, w * (Math.min(v, 1) - at), 3, { fill: SOLO }) : '') + vline(x - w + w * at, y + 5, y + 14, .3) }
const press = (t, a, armed) => (x, y) => key(x - keyW(t, { size: 10, pad: 10, armed }), y, t, { h: 20, size: 10, pad: 10, a, armed })[0]

/* a level as the meter shows it: −48 db at its left end, 0 at its right */
const meterOf = lin => lin > 0 ? clamp01((20 * Math.log10(lin) + 48) / 48) : 0
const clamp01 = v => Math.max(0, Math.min(1, v))
const ms = (samples, rate) => `${(samples / rate * 1000).toFixed(1)} ms`

function audio (d) {
  const rates = [44100, 48000, 88200, 96000, 176400, 192000].filter(r => d.rates.includes(r) || r === d.rate).slice(0, 5).map(r => [String(+(r / 1000).toFixed(1)), r])
  const sizes = [32, 64, 128, 256, 512, 1024, 2048].filter(b => d.blocks.includes(b) || b === d.block)
  if (!sizes.includes(d.block)) sizes.push(d.block)
  const blocks = sizes.sort((a, b) => a - b).slice(0, 7).map(b => [String(b), b])
  const outMs = (d.outLat + d.block) / d.rate * 1000, inMs = (d.inLat + d.block) / d.rate * 1000
  const delay = d.inputOn ? words(`in ${inMs.toFixed(1)} ms`, `out ${outMs.toFixed(1)} ms`, `there and back ${(inMs + outMs).toFixed(1)} ms`) : words(`out ${outMs.toFixed(1)} ms`)
  const threads = [['all', 0]].concat([2, 4, 6, 8, 12, 16].filter(n => n <= d.cores).slice(0, 5).map(n => [String(n), n]))
  return [
    ['device', [
      ['output', pick('out', d.out)],
      ['input', pick('in', d.in)],
      ['what comes in', d.inputOn ? level(meterOf(d.level)) : press('listen', 'listen')],
    ]],
    ['time', [
      ['rate', choice('rate', rates, d.rate, 'khz')],
      ['buffer', choice('block', blocks, d.block, 'samples')],
      ['latency', delay],
      ['low latency', choice('llm', [['1', 1], ['3', 3], ['5', 5], ['10', 10], ['20', 20]], d.llm || 5, 'ms')],      // the transport's bolt steps past what is later than this, on the way of what is heard live
    ]],
    ['work', [
      ['threads', choice('threads', threads, d.asked < 0 ? 0 : d.threads)],
      ['test tone', press('play', 'tone')],
    ]],
  ]
}
/* general: the language the program speaks (each named in its own tongue, which is never put into another) */
function general (d) {
  return [
    ['', [
      ['language', choice('lang', [[asGiven('english'), 'en'], [asGiven('한국어'), 'ko']], d.lang === 'ko' ? 'ko' : 'en')],
    ]],
  ]
}
const BODY = { general, audio }

/* the list under a thing: the room's menu, the one in use filled */
function menuOf (m) {
  const rowH = 20, w = 208, h = m.items.length * rowH + 12, x = SIDE + PR - w, y = Math.min(m.y, PAGE_H - h - 6)
  let s = hit(0, 0, PAGE_W, PAGE_H, 'close', '', 'default') + R(x, y, w, h, { rx: 3, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 3, stroke: INK, sa: .28 }), ry = y + 6
  for (const it of m.items) {
    if (it.on) s += R(x + 5, ry, w - 10, rowH, { rx: 2, fill: INK })
    s += T(x + 13, ry + 13.6, fit(asGiven(low(it.t)), w - 26, 10.5, it.on ? 500 : 400), { size: 10.5, w: it.on ? 500 : 400, c: it.on ? K1 : INK, a: it.on ? 1 : .84 }) + hit(x + 5, ry, w - 10, rowH, 'set', ` data-what="${m.id}" data-v="${esc(it.t).replace(/"/g, '&quot;')}"`)
    ry += rowH
  }
  return s
}

function draw () {
  const d = V.now
  let s = R(0, 0, PAGE_W, PAGE_H, { fill: K1 }) + vline(SIDE, 0, PAGE_H, .1)
  PARTS.forEach((p, i) => {
    const y = 14 + i * 26, on = p === V.part, there = THERE.has(p)
    if (on) s += R(10, y, SIDE - 20, 22, { rx: 2, fill: INK })
    s += T(22, y + 14.8, p, { size: 10.5, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : there ? .78 : .26 })
    if (there && !on) s += hit(10, y, SIDE - 20, 22, 'part', ` data-v="${p}"`)
  })
  if (V.part === 'display') { document.getElementById('svg').innerHTML = s + G(displayBody(), `translate(${SIDE} 0)`) + displayMenu(); return }
  if (V.part === 'plug-ins') { document.getElementById('svg').innerHTML = s + G(plugBody(), `translate(${SIDE} 0)`); return }
  let b = T(PX, 34, V.part, { size: 13, w: 500, a: .94 }), y = 54
  V.at = {}
  if (d && BODY[V.part]) for (const [head, rows] of BODY[V.part](d)) {
    b += hline(PX, PR, y, .1); y += 1
    if (head) { b += T(PX, y + 19, head, { size: 9.5, a: .4 }); y += 26 } else y += 8
    for (const [label, thing] of rows) { V.at[label] = y; b += T(PX, y + 17.5, label, { size: 10.5, a: .62 }) + thing(PR, y + 4); y += 30 }
    y += 6
  }
  if (V.said) b += T(PX, PAGE_H - 18, V.said, { size: 9.5, a: .6 })
  s += G(b, `translate(${SIDE} 0)`)
  if (V.menu) s += menuOf(V.menu)
  document.getElementById('svg').innerHTML = s
}

/* what the app says of itself now; drawn again only when something that is shown has changed */
async function read () {
  const d = NAT ? await NAT.call('settingsRead') : STAND_IN
  if (!d || !d.outs) return
  if (d.lang && d.lang !== LANG.now) setLang(d.lang)           // the language was changed while this window was away
  if (d.part && THERE.has(d.part) && d.part !== V.part) { V.part = d.part; V.menu = null; V.key = ''; setPage(); partOpened(V.part) }
  const k = JSON.stringify([d.lang, d.outs, d.ins, d.out, d.in, d.rates, d.rate, d.blocks, d.block, d.outLat, d.inLat, d.inputOn, Math.round(meterOf(d.level) * 150), d.threads, d.asked, d.busy])
  V.now = d
  if (k !== V.key) { V.key = k; draw() }
}
const SAID = { busy: 'not while a take or a print is under way', check: 'the check leaves the machine’s device as it is' }
async function set (what, value) {
  V.menu = null
  if (!NAT) { const d = STAND_IN; if (what === 'lang') { d.lang = value; setLang(value) } else if (what === 'threads') { d.asked = value ? value - 1 : -1; d.threads = value || d.cores } else d[what] = value; V.key = ''; return read() }
  const r = await NAT.call('settingsSet', { what, value })
  V.said = r && r.ok ? '' : low((r && (SAID[r.why] || r.error)) || 'that could not be set')
  V.key = ''
  await read()
}

document.getElementById('svg').addEventListener('pointerdown', async e => {
  const el = e.target.closest('[data-a]')
  if (!el) return
  const a = el.dataset.a, v = el.dataset.v, d = V.now
  if (a.startsWith('d-')) { e.preventDefault(); return displayPress(el, e) }      // (so the press does not take the focus from a field it opens)
  if (a.startsWith('p-')) { e.preventDefault(); return plugPress(el, e) }
  if (a === 'part') { V.part = v; V.menu = null; V.said = ''; setPage(); partOpened(v); draw() }
  else if (a === 'open') { V.menu = V.menu && V.menu.id === v ? null : { id: v, y: V.at[v === 'out' ? 'output' : 'input'] + 26, items: (v === 'out' ? d.outs : d.ins).map(t => ({ t, on: t === (v === 'out' ? d.out : d.in) })) }; draw() }
  else if (a === 'close') { V.menu = null; draw() }
  else if (a === 'set') { const what = el.dataset.what; await set(what, what === 'out' || what === 'in' || what === 'lang' ? v : +v) }
  else if (a === 'listen') { if (NAT) { const r = await NAT.call('inputOn'); V.said = r && r.ok ? '' : low((r && r.error) || 'the input would not open') } V.key = ''; await read() }
  else if (a === 'tone') { if (NAT) NAT.call('settingsTone') }
})
addEventListener('pointermove', e => { displayMove(e) })
addEventListener('pointerup', () => { displayUp() })
addEventListener('wheel', e => { if (V.part === 'plug-ins') plugWheel(e) }, { passive: true })
addEventListener('keydown', e => {
  if (V.part === 'display' && e.metaKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); dUndo(); return }
  if (V.part === 'plug-ins' && e.metaKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); pgUndo(); return }
  if (e.key === 'Escape' && V.part === 'plug-ins' && PG.find) { PG.find = ''; PG.group = null; draw(); return }
  if (e.key === 'Escape' && V.part === 'display' && D.menu) { D.menu = null; draw(); return }
  if (e.key === 'Escape') { if (V.menu) { V.menu = null; draw() } else if (NAT) NAT.call('settingsClose') }
  else if (e.metaKey && (e.key === 'w' || e.key === ',')) { e.preventDefault(); if (NAT && e.key === 'w') NAT.call('settingsClose') }
})
LANG.heard.push(() => { V.key = ''; draw() })                 // another language: the page is written again

Promise.all([400, 500, 600].map(w => document.fonts.load(`${w} 10px 'Instrument Sans'`))).then(async () => {
  setPage()
  if (V.part === 'display') await displayRead()
  draw()
  if (V.part === 'plug-ins') plugRead()
  await read()
  setInterval(() => { if (!document.hidden) read() }, 120)
})
