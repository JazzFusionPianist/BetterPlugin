/* ── settings > display: every part of the room, every quality of it, as plain values ──
   design/display draft 2, sheet 2 (his pick, 2026-10-16: "2장으로 가야지"). Down the left the parts of the room (look.js:
   LOOK_TREE), found by name in the field over them; on the right the chosen part's qualities, each a name and the thing
   itself against the right edge — a colour (its well, its value, how much of it), a number (dragged up or down, or pressed
   and typed), or one of a few. A change is worn by the room at once (settingsSet look); nothing is confirmed. A quality
   that is not as the room comes has a dot before its name: pressed, it goes back. ⌘Z takes the last change back.
   Over it all: the look in use (as it comes, or one kept by name, and how many changes since), and keep as…, open…,
   share… — a look kept by name, or written to a file and handed to someone. This window itself stays as the room
   comes (LOOK_PLAIN), so whatever a look does, it can always be undone from here. */
const DISP_W = 1100, DISP_H = 692
const D = { group: 'regions', part: 'a region', open: new Set(['regions']), find: '', hist: [], base: null, looks: {}, menu: null, drag: null, ready: false, said: '' }
const DX0 = 260, DTX = 28, DTW = 196

/* the parts of a group, and the part itself by its two names */
const groupOf = g => LOOK_TREE.find(x => x[0] === g)
const partOf = (g, p) => { const G = groupOf(g); return G ? G[1].find(x => x[0] === p) : null }
const sameLook = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {})
const lookDiff = (a, b) => { a = a || {}; b = b || {}; return [...new Set(Object.keys(a).concat(Object.keys(b)))].filter(k => QUAL.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k])).length }
const clean = v => { const o = {}; for (const k in v || {}) if (QUAL.has(k)) o[k] = v[k]; return o }

/* what the look is now, in words: as it comes or a kept one's name, and the changes since */
function lookWord () {
  const from = D.base && D.looks[D.base] ? D.looks[D.base] : {}, k = lookDiff(LOOK, from), name = D.base && D.looks[D.base] ? asGiven(D.base) : 'as it comes'
  return asGiven(`${inWords('look')}: ${inWords(name)}` + (k ? `, ${inWords(k === 1 ? 'one change' : '# changes').replace('#', k)}` : ''))      // (put into words piece by piece: a kept look's name is never put into other words)
}

/* ── a quality's thing, against the right edge x ── */
const dEnd = (x, y, t, size = 10, a = .5) => `<text x="${x}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="${size}" fill="${INK}" fill-opacity="${a}">${esc(inWords(t))}</text>`
const dNum = (x, y, v, unit, key, f = 'v', w = 52) => R(x - w + .5, y + .5, w - 1, 19, { rx: 2, stroke: INK, sa: D.drag && D.drag.key === key && D.drag.f === f ? .6 : .26 }) + T(x - w + 8, y + 13.6, String(+(+v).toFixed(2)), { size: 10, a: .92 }) + (unit ? dEnd(x - 7, y + 13.6, unit, 9, .38) : '') + hit(x - w, y, w, 20, 'd-num', ` data-k="${key}" data-f="${f}"`, 'ns-resize')
function dColour (x, y, q) {
  const v = lk(q[0]), o = q[3], c = v.c || (o.show ? o.show() : INK), word = v.c ? v.c.toLowerCase() : o.by || (o.d || '').toLowerCase()
  return R(x - 168, y + 3, 14, 14, { rx: 3, fill: c, fa: Math.max(.08, v.a / 100) }) + R(x - 167.5, y + 3.5, 13, 13, { rx: 3, stroke: INK, sa: .16 }) + hit(x - 170, y, 18, 20, 'd-well', ` data-k="${q[0]}"`)
    + T(x - 146, y + 13.6, v.c ? asGiven(word) : word, { size: 10, a: .88 }) + hit(x - 148, y, 92, 20, 'd-hex', ` data-k="${q[0]}"`, 'text')
    + dNum(x, y, v.a, '%', q[0], 'a', 50)
}
function dPick (x, y, q) {
  const v = lk(q[0]), its = q[3].items.map(t => ({ t, on: t === v, a: 'd-pick', more: ` data-k="${q[0]}" data-v="${esc(t)}"` })), w = cells(0, 0, 20, its, { size: 10, pad: 9 })[1]
  return cells(x - w, y, 20, its, { size: 10, pad: 9 })[0]
}

/* ── the page, in the body's own units (left of it: the settings' parts) ── */
function displayBody () {
  const PR = DISP_W - SIDE - 28
  let b = T(28, 34, 'display', { size: 13, w: 500, a: .94 })
  let kx = PR
  for (const [t, a] of [['share…', 'd-share'], ['open…', 'd-open'], ['keep as…', 'd-keep']]) { const w = keyW(t, { size: 10, pad: 10 }); kx -= w; b += key(kx, 20, t, { h: 20, size: 10, pad: 10, a })[0]; D.at = D.at || {}; D.at[a] = kx; kx -= 8 }
  const lw = menuKey(108, 21, lookWord(), { h: 18, size: 9.5, a: 'd-looks' })
  b += lw[0]; D.lookW = lw[1]
  b += hline(28, PR, 54, .1)
  /* the parts, down the left */
  const f = D.find.trim().toLowerCase(), hits = (g, p) => !f || g.toLowerCase().includes(f) || p[0].toLowerCase().includes(f) || p[2].some(([h, qs]) => h.toLowerCase().includes(f) || qs.some(q => q[1].toLowerCase().includes(f)))
  b += R(DTX + .5, 66.5, DTW - 1, 21, { rx: 2, stroke: INK, sa: D.finding ? .5 : .22 }) + (D.find || D.finding ? '' : T(DTX + 9, 80.6, 'find a part', { size: 10, a: .36 })) + (D.finding ? '' : D.find ? T(DTX + 9, 80.6, asGiven(D.find), { size: 10, a: .9 }) : '') + hit(DTX, 66, DTW, 22, 'd-find', '', 'text')
  let y = 98
  for (const [grp, parts] of LOOK_TREE) {
    const shown = parts.filter(p => hits(grp, p))
    if (!shown.length) continue
    const many = parts.length > 1, open = many && (f ? true : D.open.has(grp)), here = D.group === grp
    const onSelf = !many && here
    if (onSelf) b += R(DTX, y, DTW, 20, { rx: 2, fill: INK })
    b += T(DTX + 2 + (onSelf ? 12 : 0), y + 13.6, grp, { size: 10.5, w: here ? 500 : 400, c: onSelf ? K1 : INK, a: onSelf ? 1 : here ? .95 : .72 })
    if (many) b += caret(DTX + DTW - 8, y + 9, open ? .55 : .3)
    b += hit(DTX, y, DTW, 20, 'd-group', ` data-g="${esc(grp)}"`)
    y += 21
    if (open) for (const p of shown) {
      const on = here && D.part === p[0]
      if (on) b += R(DTX, y, DTW, 20, { rx: 2, fill: INK })
      b += T(DTX + 14, y + 13.6, p[0], { size: 10, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .64 }) + hit(DTX, y, DTW, 20, 'd-part', ` data-g="${esc(grp)}" data-p="${esc(p[0])}"`)
      y += 20
    }
  }
  b += vline(DTX + DTW + 16, 62, DISP_H - 10, .1)
  /* the chosen part: every quality, as values */
  const part = partOf(D.group, D.part)
  if (part) {
    let ry = 64
    const many = groupOf(D.group)[1].length > 1
    if (many) { const gw = tw(D.group, 9.5); b += T(DX0, ry + 18, D.group, { size: 9.5, a: .4 }) + T(DX0 + gw + 6, ry + 18, '›', { size: 9.5, a: .3 }) + T(DX0 + gw + 16, ry + 18, part[0], { size: 12, w: 500, a: .95 }) }
    else b += T(DX0, ry + 18, part[0], { size: 12, w: 500, a: .95 })
    b += dEnd(PR, ry + 18, part[1], 9.5, .4)
    ry += 34
    D.rows = {}
    for (const [head, qs] of part[2]) {
      b += hline(DX0, PR, ry + 2, .1)
      if (head) { b += T(DX0, ry + 19, head, { size: 9.5, a: .4 }); ry += 27 } else ry += 10
      for (const q of qs) {
        const changed = q[0] in LOOK, lwid = tw(q[1], 10.5)
        b += T(DX0, ry + 14.5, q[1], { size: 10.5, a: changed ? .92 : .64 })
        if (q[3].note) b += T(DX0 + lwid + 8, ry + 14.5, q[3].note, { size: 9, a: .32 })
        if (changed) b += Cc(DX0 - 11, ry + 10.5, 2.5, { fill: INK, fa: .8 }) + hit(DX0 - 18, ry, 14, 20, 'd-reset', ` data-k="${q[0]}"`)
        b += q[2] === 'c' ? dColour(PR, ry, q) : q[2] === 'n' ? dNum(PR, ry, lk(q[0]), q[3].unit, q[0]) : dPick(PR, ry, q)
        D.rows[q[0]] = ry
        ry += 28
      }
    }
    if (D.said) b += T(DX0, DISP_H - 18, D.said, { size: 9.5, a: .6 })
  }
  return b
}
/* the list under the look: as the room comes, and every look kept by name */
function displayMenu () {
  if (!D.menu) return ''
  const items = [{ t: 'as it comes', v: '' }].concat(Object.keys(D.looks).sort().map(k => ({ t: asGiven(k), v: k })))
  const rowH = 20, w = Math.max(220, D.lookW || 0), h = items.length * rowH + 12, x = SIDE + 108, y = 42
  let s = hit(0, 0, DISP_W, DISP_H, 'd-close', '', 'default') + R(x, y, w, h, { rx: 3, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 3, stroke: INK, sa: .28 }), ry = y + 6
  for (const it of items) {
    const on = (it.v || null) === (D.base || null) && sameLook(LOOK, it.v ? D.looks[it.v] : {})
    if (on) s += R(x + 5, ry, w - 10, rowH, { rx: 2, fill: INK })
    s += T(x + 13, ry + 13.6, fit(it.t, w - 26, 10.5), { size: 10.5, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .84 }) + hit(x + 5, ry, w - 10, rowH, 'd-wear', ` data-v="${esc(it.v)}"`)
    ry += rowH
  }
  return s
}

/* ── a change ── */
let dSending = null
function dSend () {                                                   // the room is told once a frame, however fast a drag goes
  if (dSending) return
  dSending = requestAnimationFrame(() => { dSending = null; if (NAT) NAT.call('settingsSet', { what: 'look', value: LOOK }) })
}
function dSet (key, value, keepHist) {
  const q = QUAL.get(key)
  if (!q) return
  if (!keepHist) D.hist.push(JSON.stringify(LOOK)), D.hist.length > 200 && D.hist.shift()
  const next = Object.assign({}, LOOK)
  if (value === undefined) delete next[key]
  else {
    const o = q[3]
    const same = q[2] === 'c' ? (value.c == null || (o.d && value.c.toLowerCase() === o.d.toLowerCase())) && +value.a === (o.a == null ? 100 : o.a) : value === o.d
    if (same) delete next[key]; else next[key] = q[2] === 'c' ? { c: value.c == null || (o.d && value.c.toLowerCase() === o.d.toLowerCase()) ? null : value.c, a: +value.a } : value
  }
  LOOK = next
  dSend(); draw()
}
function dUndo () { if (!D.hist.length) return; LOOK = JSON.parse(D.hist.pop()); dSend(); draw() }
const clampTo = (q, v) => { const o = q[3]; v = Math.max(o.min, Math.min(o.max, v)); return Math.round(v / o.step) * o.step }

/* ── typing: one field laid over the page (a colour's value, a number, a name, the find field) ── */
function dType (x, y, w, value, done, o = {}) {
  const ed = document.getElementById('ed')
  ed.hidden = false; ed.value = value
  Object.assign(ed.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: (o.h || 20) + 'px', textAlign: o.align || 'left', border: o.bare ? '0' : '', background: o.bare ? 'transparent' : '', padding: o.bare ? '0 5px' : '' })      // (bare: the field drawn under it is its frame)
  ed.dataset.live = o.live ? '1' : ''
  dType.done = done; dType.live = o.live || null
  ed.focus(); ed.select()
}
function dTypeEnd (take) {
  const ed = document.getElementById('ed')
  if (ed.hidden) return
  ed.hidden = true; D.finding = false
  const f = dType.done; dType.done = null; dType.live = null
  if (take && f) f(ed.value)
  draw()
}
document.getElementById('ed').addEventListener('keydown', e => {
  e.stopPropagation()
  if (e.key === 'Enter') { e.preventDefault(); dTypeEnd(true) } else if (e.key === 'Escape') { e.preventDefault(); dTypeEnd(false) }
})
document.getElementById('ed').addEventListener('input', e => { if (dType.live) dType.live(e.target.value) })
document.getElementById('ed').addEventListener('blur', () => dTypeEnd(true))
/* the Mac's own colour panel, for a colour's well */
const cw = document.getElementById('cw')
cw.addEventListener('input', () => { if (cw.dataset.k) dSet(cw.dataset.k, { c: cw.value.toUpperCase(), a: lk(cw.dataset.k).a }, !!cw.dataset.started) ; cw.dataset.started = '1' })

/* ── hands ── */
async function displayPress (el, e) {
  const a = el.dataset.a, k = el.dataset.k
  D.said = ''
  if (a === 'd-group') { const g = el.dataset.g, G = groupOf(g); if (G[1].length > 1) { if (D.open.has(g) && D.group === g) D.open.delete(g); else { D.open.add(g); if (D.group !== g) { D.group = g; D.part = G[1][0][0] } } } else { D.group = g; D.part = G[1][0][0] } draw() }
  else if (a === 'd-part') { D.group = el.dataset.g; D.part = el.dataset.p; draw() }
  else if (a === 'd-reset') dSet(k, undefined)
  else if (a === 'd-pick') dSet(k, el.dataset.v)
  else if (a === 'd-num') { const q = QUAL.get(k), f = el.dataset.f; D.drag = { key: k, f, y0: e.clientY, v0: f === 'a' ? lk(k).a : lkN(k), moved: false, el }; draw() }
  else if (a === 'd-hex') {
    const r = el.getBoundingClientRect(), v = lk(k)
    dType(r.left, r.top, 92, v.c || '', t => { const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(t.trim()); if (!t.trim()) dSet(k, { c: null, a: v.a }); else if (m) { const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]; dSet(k, { c: '#' + h.toUpperCase(), a: v.a }) } else D.said = 'a colour is written #rrggbb' })
  }
  else if (a === 'd-well') { const v = lk(k), q = QUAL.get(k); cw.dataset.k = k; cw.dataset.started = ''; cw.value = (v.c || (q[3].show ? q[3].show() : INK)).toLowerCase(); cw.click() }
  else if (a === 'd-find') { const r = el.getBoundingClientRect(); D.finding = true; draw(); dType(r.left + 1, r.top + 1, DTW - 2, D.find, t => { D.find = t }, { live: t => { D.find = t; draw() }, bare: true }) }
  else if (a === 'd-looks') { D.menu = !D.menu; draw() }
  else if (a === 'd-close') { D.menu = null; draw() }
  else if (a === 'd-wear') { const v = el.dataset.v; D.menu = null; D.hist.push(JSON.stringify(LOOK)); LOOK = v ? clean(D.looks[v]) : {}; D.base = v || null; dSend(); dKeepBase(); draw() }
  else if (a === 'd-keep') {
    const r = el.getBoundingClientRect()
    dType(r.left - 120, r.top, 200, D.base || '', async t => {
      const name = t.trim().slice(0, 40)
      if (!name) return
      D.looks[name] = clean(LOOK); D.base = name
      if (NAT) await NAT.call('prefSet', { key: 'looks', value: D.looks })
      dKeepBase(); D.said = asGiven(`${inWords('kept as')} ${name}`); draw()
    })
  }
  else if (a === 'd-share') { if (NAT) { const r = await NAT.call('lookShare', { name: D.base || 'a look', json: JSON.stringify({ slurLook: 1, name: D.base || '', look: LOOK }, null, 1) }); D.said = r && r.ok ? 'written' : '' } draw() }
  else if (a === 'd-open') {
    if (!NAT) return
    const r = await NAT.call('lookOpen')
    if (!r || !r.ok) return
    let got = null
    try { const j = JSON.parse(r.json); got = j && j.look && typeof j.look === 'object' ? clean(j.look) : null } catch (err) {}
    if (!got) { D.said = 'that file holds no look'; draw(); return }
    const name = String(r.name || 'a look').slice(0, 40)
    D.hist.push(JSON.stringify(LOOK)); LOOK = got; D.looks[name] = got; D.base = name
    await NAT.call('prefSet', { key: 'looks', value: D.looks })
    dKeepBase(); dSend(); draw()
  }
}
/* which look the one in use began from, kept with the looks (so 'look: night, 2 changes' is still said after a restart) */
function dKeepBase () { if (NAT) NAT.call('prefSet', { key: 'lookBase', value: D.base || '' }) }
function displayMove (e) {
  const d = D.drag
  if (!d) return false
  const q = QUAL.get(d.key), dy = d.y0 - e.clientY
  if (!d.moved && Math.abs(dy) < 3) return true
  if (!d.moved) { d.moved = true; D.hist.push(JSON.stringify(LOOK)) }
  if (d.f === 'a') { const a = Math.max(0, Math.min(100, Math.round(d.v0 + dy / 2))), v = lk(d.key); dSet(d.key, { c: v.c, a }, true) }
  else dSet(d.key, clampTo(q, d.v0 + Math.round(dy / 3) * q[3].step * (e.shiftKey ? .2 : 1)), true)
  return true
}
function displayUp () {
  const d = D.drag
  if (!d) return false
  D.drag = null
  if (!d.moved) {                                                      // pressed, not dragged: typed
    const r = d.el.getBoundingClientRect(), q = QUAL.get(d.key)
    dType(r.left, r.top, r.width, String(d.f === 'a' ? lk(d.key).a : lkN(d.key)), t => {
      const v = parseFloat(t.replace(',', '.'))
      if (!isFinite(v)) return
      if (d.f === 'a') dSet(d.key, { c: lk(d.key).c, a: Math.max(0, Math.min(100, v)) }); else dSet(d.key, clampTo(q, v))
    }, { align: 'center' })
  }
  draw()
  return true
}
/* the look as the app keeps it, read when the part is opened */
async function displayRead () {
  if (!NAT) { D.ready = true; return }
  const p = await NAT.call('prefGet')
  LOOK = clean(p && p.look); D.looks = p && p.looks && typeof p.looks === 'object' ? p.looks : {}
  D.base = p && p.lookBase && D.looks[p.lookBase] ? p.lookBase : null
  D.ready = true
  draw()
}
