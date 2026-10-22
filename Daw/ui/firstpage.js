/* ── settings > plug-ins: first choices ──
   design/first choices draft 1, sheet 2 (his pick, 2026-10-17: "2번째께 나음!! setting 안에 있는거!"). Above the kinds,
   a group of its own: for each kind a request made by its sound reaches for (an eq, a compressor, a reverb …), the
   plug-in it puts on first — the room's own until he picks one. Each row says how often he put that kind's plug-ins on
   by hand (probe.js counts it) and what the room has learnt of the chosen one: it learns a plug-in by sending sound
   through it (probe.js, Engine::probe), on a track of the engine's own that is in no song, as soon as it is chosen.
   A row's list: the room's own first, then that kind's plug-ins, the most used first, found by typing.
   Kept in the app's settings: firstChoice {kind: plug-in id | 'own'}, used, learnt, shareUse. */
const FC_LIMIT = /limit|maxim|clip|\bpro-l\b|\bl[123]\b/i
const FC_ROLES = [
  { k: 'eq', learn: 'eq', own: 'the room’s eq', is: p => pgKind(p) === 'eq' },      // (the room's own: its bands and tone prints — never the Mac's eq, his word 2026-10-21)
  { k: 'compressor', learn: 'comp', own: 'the room’s comp', is: p => pgKind(p) === 'dynamics' && !FC_LIMIT.test(p.name) && !/gate|expand|de-?ess|\bds\b|transient|duck|\bpro-g\b/i.test(p.name) },
  { k: 'limiter', learn: 'comp', own: 'the room’s glue', is: p => pgKind(p) === 'dynamics' && FC_LIMIT.test(p.name) },
  { k: 'de-esser', learn: null, own: 'the room’s carve', is: p => /de-?ess|\bds\b|sibil/i.test(p.name) },
  { k: 'transients', learn: null, own: null, is: p => /transient|impact|punch|smack|kickstart|envelope/i.test(p.name) },
  { k: 'reverb', learn: null, own: 'the room’s space', is: p => pgKind(p) === 'reverb' },
  { k: 'delay', learn: null, own: 'the room’s delay', is: p => pgKind(p) === 'delay' },
  { k: 'saturation', learn: null, own: 'the room’s tape', is: p => pgKind(p) === 'saturation' },
  { k: 'width', learn: null, own: 'the room’s stereo', is: p => pgKind(p) === 'stereo' },
]
const FC = { on: false, choice: {}, used: {}, share: true, state: {}, queue: [], learning: '', menu: null, find: '', ms: 0, read: false }
const FC_ROW = 30, FC_Y = 108, FC_MX = 120, FC_SX = 390, FC_LW = 250, FC_PER = 12

const fcPlugs = role => (PG.list || []).filter(p => !p.inst && role.is(p))
const fcShort = name => asGiven(String(name || '').replace(/^(fabfilter|uadx?|uaudio) /i, '').toLowerCase())
const fcUsed = p => FC.used[learntKey(p)] || 0
const fcChosen = role => { const id = FC.choice[role.k]; return id && id !== 'own' ? (PG.list || []).find(p => p.id === id) || null : null }
/* what the room has learnt of the chosen one, in a word (or nothing: the room's own print needs no learning) */
function fcState (role) {
  const p = fcChosen(role), id = p ? p.id : role.ownId
  if (!id) return ''
  if (FC.learning === id) return 'learning'
  const st = FC.state[id]
  if (st && st.startsWith('failed:')) return st.slice(7) === 'hardware' ? 'hardware' : 'failed'
  if (FC.queue.some(q => q.id === id)) return 'next'
  if (!role.learn) return ''
  const L = PROBE.learnt || {}, m = L[learntKey({ id })]
  return m && (m.kind === 'eq' || m.kind === 'comp') ? 'learnt' : ''
}

/* ── drawn, in the body's own units ── */
function fcLeft () {
  const y = 130, on = FC.on
  let b = R(PTX - 4, y - 2, PTW + 8, 26, { fill: K1 })
  if (on) b += R(PTX, y, PTW, 20, { rx: 2, fill: INK })
  b += T(PTX + 10, y + 13.6, 'first choices', { size: 10, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .72 }) + T(PTX + PTW - 10, y + 13.6, String(FC_ROLES.length), { size: 9.5, c: on ? K1 : INK, a: on ? .7 : .38, anchor: 'end' })
  b += hit(PTX, y, PTW, 20, 'p-fc') + hline(PTX + 6, PTX + PTW - 6, y + 23, .1)
  return b
}
function fcRight () {
  const PRb = DISP_W - SIDE - 28, x = PX0
  let b = R(x - 20, 58, PRb - x + 48, DISP_H - 58, { fill: K1 })
  b += T(x, 82, 'first choices', { size: 12, w: 500, a: .95 }) + T(x + tw('first choices', 12, 500) + 10, 82, 'what a request made by its sound puts on first, of each kind', { size: 9.5, a: .42 })
  const kw = keyW('learn again', { size: 9.5, pad: 9 })
  b += key(PRb - kw, 69, 'learn again', { h: 18, size: 9.5, pad: 9, a: 'p-fc-again' })[0] + hline(x, PRb, 98, .1)
  FC_ROLES.forEach((role, i) => {
    const y = FC_Y + i * FC_ROW, p = fcChosen(role), word = p ? fcShort(p.name) : role.own || 'none'
    b += T(x, y + 13.4, role.k, { size: 10.5, a: .62 })
    b += menuKey(x + FC_MX, y, word, { h: 20, size: 10, dim: !p, a: 'p-fc-open', more: ` data-v="${role.k}"` })[0]
    const st = fcState(role), sx = x + FC_SX
    if (st === 'learnt') b += T(sx, y + 13.4, 'learnt', { size: 9.5, a: .5 })
    else if (st === 'learning') { const k = Math.min(.95, (PROBE.calls - (FC.calls0 || 0)) / (role.learn === 'comp' ? 30 : 80)); b += T(sx, y + 13.4, 'learning', { size: 9.5, a: .8 }) + R(sx + 52, y + 9, 60, 2, { fill: INK, fa: .14 }) + R(sx + 52, y + 9, 60 * Math.max(.05, k), 2, { fill: INK, fa: .8 }) }
    else if (st === 'next') b += T(sx, y + 13.4, 'next', { size: 9.5, a: .32 })
    else if (st === 'hardware') b += T(sx, y + 13.4, 'cannot be learnt without its hardware', { size: 9.5, a: .32 })
    else if (st === 'failed') b += T(sx, y + 13.4, 'could not be learnt', { size: 9.5, a: .32 })
    const n = fcPlugs(role).reduce((q, pl) => q + fcUsed(pl), 0)
    if (n) b += T(PRb, y + 13.4, `used ${n} ${n === 1 ? 'time' : 'times'}`, { size: 9.5, a: .38, anchor: 'end' })
  })
  const yb = FC_Y + FC_ROLES.length * FC_ROW
  b += hline(x, PRb, yb + 4, .1) + T(x, yb + 30, 'share which plug-ins are used, without a name', { size: 10, a: .62 })
  b += cells(PRb - 72, yb + 17, 20, [{ t: 'on', on: FC.share, a: 'p-fc-share', more: ' data-v="1"' }, { t: 'off', on: !FC.share, a: 'p-fc-share', more: ' data-v="0"' }], { size: 9.5, widths: [36, 36] })[0]
  if (FC.menu) b += fcList()
  return b
}
/* a row's list: the room's own, then the kind's plug-ins (most used first), the chosen one filled */
function fcItems (role) {
  const q = FC.find.trim().toLowerCase(), chosen = FC.choice[role.k] || 'own'
  /* one row a plug-in: of its audio unit and its vst3 (one name), the one used more, else the audio unit */
  const one = new Map()
  for (const p of fcPlugs(role)) { const k = fcShort(p.name), was = one.get(k); if (!was || fcUsed(p) > fcUsed(was) || (fcUsed(p) === fcUsed(was) && p.fmt === 'au' && was.fmt !== 'au')) one.set(k, p) }
  const ps = [...one.values()].filter(p => !q || (p.name + ' ' + (p.maker || '')).toLowerCase().includes(q)).sort((a, b) => fcUsed(b) - fcUsed(a) || fcShort(a.name).localeCompare(fcShort(b.name)))
  return { own: role.own && (!q || role.own.includes(q)) ? { t: role.own, id: 'own', on: chosen === 'own', r: 'the room’s own' } : null, ps: ps.map(p => ({ t: fcShort(p.name), id: p.id, on: chosen === p.id, r: fcUsed(p) ? String(fcUsed(p)) : asGiven(String(p.maker || '').replace(/\s*\(.*\)\s*$/, '').toLowerCase()), dim: !fcUsed(p) })) }
}
function fcList () {
  const role = FC_ROLES.find(r => r.k === FC.menu), i = FC_ROLES.indexOf(role), x = PX0 + FC_MX, y = FC_Y + i * FC_ROW + 24, rh = 21, w = FC_LW
  const { own, ps } = fcItems(role)
  FC.ms = Math.max(0, Math.min(FC.ms, ps.length - FC_PER))
  const shown = ps.slice(FC.ms, FC.ms + FC_PER), more = ps.length - FC.ms - shown.length
  const h = 32 + (own ? rh + 6 : 0) + Math.max(1, shown.length) * rh + (more > 0 ? 22 : 6), y0 = Math.min(y, DISP_H - h - 8)
  let b = hit(-SIDE, 0, DISP_W, DISP_H, 'p-fc-close', '', 'default') + R(x, y0, w, h, { rx: 3, fill: K2 }) + R(x + .5, y0 + .5, w - 1, h - 1, { rx: 3, stroke: INK, sa: .28 })
  const typing = !document.getElementById('ed').hidden
  b += R(x + 6.5, y0 + 6.5, w - 13, 19, { rx: 2, stroke: INK, sa: typing ? .5 : .2 }) + (typing ? '' : T(x + 14, y0 + 19.5, FC.find || `find ${/^[aeiou]/.test(role.k) ? 'an' : 'a'} ${role.k}`, { size: 9.5, a: FC.find ? .9 : .34 })) + hit(x + 6, y0 + 6, w - 12, 20, 'p-fc-find', '', 'text')
  let ry = y0 + 32
  const item = (it, n) => {
    let s = ''
    if (it.on) s += R(x + 5, ry, w - 10, rh - 1, { rx: 2, fill: INK })
    s += T(x + 13, ry + 13.6, fit(it.t, w - 90, 10, it.on ? 500 : 400), { size: 10, w: it.on ? 500 : 400, c: it.on ? K1 : INK, a: it.on ? 1 : .86 })
    if (it.r) s += T(x + w - 13, ry + 13.6, fit(it.r, 80, 9), { size: 9, c: it.on ? K1 : INK, a: it.on ? .6 : it.dim ? .26 : .4, anchor: 'end' })
    s += hit(x + 5, ry, w - 10, rh - 1, 'p-fc-pick', ` data-v="${n}"`)
    ry += rh
    return s
  }
  if (own) { b += item(own, -1); b += hline(x + 10, x + w - 10, ry + 2, .1); ry += 6 }
  shown.forEach((it, k) => { b += item(it, FC.ms + k) })
  if (!shown.length) { b += T(x + 13, ry + 13.6, 'none of this kind on this Mac', { size: 9.5, a: .36 }); ry += rh }
  if (more > 0) b += T(x + 13, ry + 14, `and ${more} more, a scroll away`, { size: 9, a: .32 })
  return b
}

/* ── hands ── */
async function fcSave (key, value) { if (NAT) await NAT.call('prefSet', { key, value }) }
async function fcPress (el) {
  const a = el.dataset.a, v = el.dataset.v
  if (a === 'p-fc') { FC.on = true; FC.menu = null; if (!FC.read) await fcRead() }
  else if (a === 'p-fc-open') { FC.menu = FC.menu === v ? null : v; FC.find = ''; FC.ms = 0 }
  else if (a === 'p-fc-close') FC.menu = null
  else if (a === 'p-fc-pick') {
    const role = FC_ROLES.find(r => r.k === FC.menu), { own, ps } = fcItems(role), it = +v < 0 ? own : ps[+v]
    if (it) { FC.choice[role.k] = it.id; await fcSave('firstChoice', FC.choice); fcLearn(role) }
    FC.menu = null
  }
  else if (a === 'p-fc-find') { const r = el.getBoundingClientRect(); dType(r.left + 1, r.top + 1, FC_LW - 14, FC.find, t => { FC.find = t }, { live: t => { FC.find = t; FC.ms = 0; draw() }, bare: true }) }
  else if (a === 'p-fc-again') { for (const role of FC_ROLES) { const p = fcChosen(role), id = p ? p.id : role.ownId; if (id && role.learn) { await learntKeep(learntKey({ id }), null); delete FC.state[id]; fcLearn(role) } } }
  else if (a === 'p-fc-share') { FC.share = v === '1'; await fcSave('shareUse', FC.share) }
  draw()
}
/* the chosen one of a kind learnt, one after another (none twice; a kind the room cannot learn yet is left) */
function fcLearn (role) {
  const p = fcChosen(role), id = p ? p.id : role.ownId
  if (!id || !role.learn || FC.queue.some(q => q.id === id) || FC.learning === id) return
  const m = (PROBE.learnt || {})[learntKey({ id })]
  if (m && m.kind === (role.learn === 'comp' ? 'comp' : 'eq')) return
  FC.queue.push({ id, learn: role.learn })
  fcWork()
}
async function fcWork () {
  if (FC.learning || !FC.queue.length) return
  const job = FC.queue.shift()
  FC.learning = job.id; FC.calls0 = PROBE.calls
  const tick = setInterval(() => { if (V.part === 'plug-ins' && FC.on) draw() }, 250)
  try {
    const m = await learnById(job.id, job.learn)
    FC.state[job.id] = m.kind === 'eq' || m.kind === 'comp' ? 'learnt' : 'failed:' + (m.why || '')
  } catch (e) { FC.state[job.id] = 'failed:' }
  clearInterval(tick)
  FC.learning = ''
  draw()
  fcWork()
}
async function fcRead () {
  const p = NAT ? await NAT.call('prefGet') : window.FC_STAND_IN || {}
  FC.choice = (p && p.firstChoice) || {}; FC.used = (p && p.used) || {}; FC.share = !(p && p.shareUse === false)
  PROBE.learnt = (p && p.learnt) || {}
  FC.read = true
  for (const role of FC_ROLES) fcLearn(role)                                              // (what is chosen and not learnt yet — the Mac's eq too — is learnt now)
}

/* ── joined to the plug-ins page ── */
{
  const body0 = plugBody, press0 = plugPress, wheel0 = plugWheel, read0 = plugRead
  plugBody = function () { PG.y0 = 157; PG.away = FC.on; let b = body0(); if (!PG.list) return b; b += fcLeft(); if (FC.on) b += fcRight(); return b }
  plugPress = async function (el, e) {
    const a = el.dataset.a
    if (a.startsWith('p-fc')) return fcPress(el, e)
    if (a === 'p-group' || a === 'p-find' || a === 'p-by') { FC.on = false; FC.menu = null }
    return press0(el, e)
  }
  plugWheel = function (e) {
    if (!FC.on) return wheel0(e)
    if (!FC.menu) return
    FC.wheel = (FC.wheel || 0) + e.deltaY
    const steps = Math.trunc(FC.wheel / 21)
    if (!steps) return
    FC.wheel -= steps * 21; FC.ms = Math.max(0, FC.ms + steps); draw()
  }
  plugRead = async function (again) { await read0(again); if (!FC.read) { await fcRead(); draw() } }
}
