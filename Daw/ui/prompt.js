/* ── the prompt as a page of its own in the panel ──
   His pick, draft b of design/prompt panel draft 1: beside patch, mixer and notes the panel has a fourth page, prompt.
   Across its top the field — larger than the line at the foot, framed, with the cells of the line (hint.js) in it and the
   typing after them; under it at the left what can follow (the list that otherwise rises over the foot), at the right
   what was said and what came of it, the newest first (pressed: said again into the field). / opens the page and gives
   the field the keys. While the page is up the foot keeps only how the machine stands; with any other page up the foot's
   line is there as before.
   Read after hint.js, wall.js and roll.js (it wraps the panel's drawing and the room's hands). */
const PROMPT = { said: [], line: false, top: 0 }
const PR_FH = 38, PR_ROW = 26, PR_SAID = 40
const promptOn = () => S.panel.on && S.panel.tab === 'prompt' && VIEW.p > .5
const promptUp = () => S.panel.on && S.panel.tab === 'prompt'                              // (chosen, though the panel may still be opening)
const promptField = () => ({ x: 20, y: BY + PH + 16, w: RX - 40, h: PR_FH })
/* how many rows of what can follow the page has room for: a longer list is gone down with the arrows, or the wheel */
function promptRows () { const f = promptField(), cy = f.y + f.h + 16; return Math.max(1, Math.floor((BY + S.panel.h - 10 - (cy + 18)) / PR_ROW)) }
const promptListBox = () => { const f = promptField(), cy = f.y + f.h + 16; return { x: f.x - 10, y: cy + 18, w: Math.min(320, Math.round((RX - 40) * .3)), h: BY + S.panel.h - 10 - (cy + 18) } }
/* where the line's cells stand while the page is up (hint.js asks) */
function promptAt () { if (!promptOn()) return null; const f = promptField(); return { x: f.x + 34, y: f.y + 8, h: 22, size: 12 } }
/* what a thing said came to, in words (as the foot says it) */
function promptResult (L) {
  if (!L) return ''
  if (L.say) return String(L.say)
  const r = L.res
  if (!Array.isArray(r) || !r.length) return ''
  if (r.length === 1) {
    const a = r[0]
    if (a.k === 'vol') return `${a.t.name} ${fmtDb(a.from)} to ${fmtDb(a.to)} db`
    if (a.k === 'patch') return `${a.t.name} ${a.print} ${a.from} to ${a.to}`
    if (a.k === 'tempo') return `tempo ${a.from} to ${a.to} bpm`
    if (a.k === 'pan') return `${a.t.name} pan ${panText(a.from)} to ${panText(a.to)}`
    if (a.k === 'gain') return `region gain ${fmtDb(a.from)} to ${fmtDb(a.to)} db`
    return String(a.text || '')
  }
  const note = r.find(a => a.quiet), words = r.filter(a => a.text).map(a => a.text)
  return note ? note.text : words.length === r.length ? words.join(', ') : `${r.length} changes`
}
function promptLog (words) {
  if (!words) return
  const d = new Date()
  PROMPT.said.unshift({ at: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`, words, res: promptResult(S.last) })
  if (PROMPT.said.length > PR_SAID) PROMPT.said.length = PR_SAID
  uiDirty('dock')
}
function promptOpen () {
  if (!(S.panel.on && S.panel.tab === 'prompt')) { S.panel.on = true; S.panel.tab = 'prompt'; closePicker(); setView() }
  uiDirty('dock', 'top', 'cmd', 'hint')
  setTimeout(() => { const c = $('cmd'); c.focus(); promptPlace(); hintFresh(true) }, 0)      // (the keys may have been in the field already: no focus comes, the list is asked for here)
}

/* ── drawn ── */
function pPrompt (y, h) {
  const f = promptField(), cmd = $('cmd'), keys = document.activeElement === cmd
  let s = R(0, y, RX, h, { fill: K1 })
  s += R(f.x + .5, f.y + .5, f.w, f.h, { rx: 3, fill: K0, stroke: INK, sa: keys ? .6 : .36 }) + hit(f.x, f.y, f.w, f.h, 'prompt', ' data-k="field"', 'text')
  s += P(`M${f.x + 14} ${f.y + 13}L${f.x + 20} ${f.y + 19}L${f.x + 14} ${f.y + 25}`, { stroke: INK, sa: .9, sw: 1.5, cap: 'round' })
  if (S.think) s += T(f.x + f.w - 14, f.y + 23.5, 'thinking', { size: 10.5, a: .5, anchor: 'end' })
  /* what can follow: the list for the line as it stands */
  const cy = f.y + f.h + 16, lw = Math.min(320, Math.round((RX - 40) * .3)), bottom = y + h - 10
  const H_ = S.hint, typed = cmd.value.trim().toLowerCase(), room = promptRows(), n = H_ ? H_.items.length : 0
  if (H_) PROMPT.top = clamp(Math.min(PROMPT.top, H_.at), Math.max(0, H_.at - room + 1), Math.max(0, n - room))      // (the row chosen is always in view)
  s += T(f.x, cy + 10, 'what can follow', { size: 9.5, a: .4 })
  if (n > room) s += T(f.x + lw - 22, cy + 10, `${PROMPT.top + 1}–${Math.min(n, PROMPT.top + room)} of ${n}`, { size: 9.5, a: .4, anchor: 'end' })
  if (H_) H_.items.forEach((it, i) => {
    const ry = cy + 18 + (i - PROMPT.top) * PR_ROW
    if (i < PROMPT.top || ry + PR_ROW > bottom) return
    const on = i === H_.at, wt = on ? 500 : 400
    if (on) s += R(f.x - 10, ry, lw, PR_ROW, { rx: 2, fill: INK, fa: .08 })
    const ty = it.part.k === 'word' && it.part.from != null ? cmd.value.slice(it.part.from).trim().toLowerCase() : typed      // (a word of a line typed out: what was typed of it)
    if (ty && it.t.startsWith(ty)) s += R(f.x, ry + 19, tw(asGiven(it.t.slice(0, ty.length)), 11.5, wt), 1, { fill: INK, fa: .4 })      // (the letters typed so far)
    s += T(f.x, ry + 17, fit(asGiven(it.t), lw - 30 - (it.d ? tw(it.d, 10) + 12 : 0), 11.5, wt), { size: 11.5, w: wt, a: on ? 1 : .84 })
    if (it.d) s += T(f.x + lw - 22, ry + 17, it.d, { size: 10, a: .42, anchor: 'end' })
    s += hit(f.x - 10, ry, lw, PR_ROW, 'hint', ` data-i="${i}"`, 'pointer')
  })
  /* what was said, and what came of it */
  const hx = f.x + lw + 24
  s += vline(hx - 12, cy, bottom, .08) + T(hx + 12, cy + 10, 'said', { size: 9.5, a: .4 })
  const ww = Math.min(300, Math.round((RX - hx) * .42))
  PROMPT.said.forEach((q, i) => {
    const ry = cy + 18 + i * PR_ROW
    if (ry + PR_ROW > bottom) return
    s += T(hx + 12, ry + 17, asGiven(q.at), { size: 9.5, a: .36 })
    s += T(hx + 60, ry + 17, fit(asGiven(q.words), ww - 16, 11, 500), { size: 11, w: 500, a: .9 })
    if (q.res) s += T(hx + 60 + ww, ry + 17, fit(asGiven(q.res), RX - 20 - (hx + 60 + ww), 10), { size: 10, a: .55 })
    s += hit(hx, ry, RX - 20 - hx, PR_ROW, 'prompt', ` data-k="said" data-i="${i}"`, 'pointer')
  })
  return s
}
/* the field's box for the typing: after the cells, to the end of the field (at the foot again when the page is not up) */
function promptPlace () {
  const cmd = $('cmd')
  if (promptOn()) {
    const f = promptField(), x0 = S.lineX || f.x + 34, put = (k, v) => { if (cmd.style[k] !== v) cmd.style[k] = v }
    put('top', (f.y + 5) + 'px'); put('left', x0 + 'px'); put('width', Math.max(60, f.x + f.w - 14 - x0) + 'px'); put('height', '28px'); put('font', '400 12.5px/28px var(--f)')
    PROMPT.line = true
  } else if (PROMPT.line) {
    PROMPT.line = false
    cmd.style.top = (H - FOOT_H) + 'px'; cmd.style.height = ''; cmd.style.font = ''; cmd.style.left = (S.lineX || 26) + 'px'
    uiDirty('cmd', 'hint')
  }
}

/* ── joined to the room ── */
{
  const dock0 = PARTS.dock, down0 = onDown, flush0 = flush, rc0 = runCommand, ld0 = lineDo, relayout0 = relayout, wheel0 = onWheel
  relayout = function () { relayout0(); if (promptOn()) { PROMPT.line = false; promptPlace() } }      // (the window laid out again puts the typing back at the foot: while the page is up, it goes back into the field)
  PARTS.dock = function () {
    if (!(S.panel.on && S.panel.tab === 'prompt') || VIEW.p <= .001) return dock0()
    const y = BY, h = S.panel.h
    MGEOM = null
    return pPrompt(y + PH, h - PH) + pPanelHead(y, 'prompt')
  }
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null, a = el ? el.dataset.a : ''
    if (a === 'tab-prompt') { e.preventDefault(); promptOpen(); return }
    if (a === 'prompt') {
      e.preventDefault()
      const cmd = $('cmd')
      if (el.dataset.k === 'said') { const q = PROMPT.said[+el.dataset.i]; if (q) { S.line = { parts: [], done: false }; cmd.value = q.words; S.hint = null; uiDirty('hint', 'cmd', 'dock') } }
      cmd.focus(); if (el.dataset.k === 'said') cmd.select()
      uiDirty('dock'); return
    }
    down0(e)
  }
  /* the wheel over what can follow goes down the list (the row chosen goes with it) */
  onWheel = function (e) {
    const p = pt(e), L = promptListBox(), h = S.hint
    if (!promptOn() || !h || p.x < L.x || p.x > L.x + L.w || p.y < L.y || p.y > L.y + L.h) return wheel0(e)
    e.preventDefault()
    const room = promptRows(), n = h.items.length, d = Math.sign(e.deltaY)
    if (n <= room || !d) return
    PROMPT.top = clamp(PROMPT.top + d, 0, n - room); h.at = clamp(h.at, PROMPT.top, PROMPT.top + room - 1)
    uiDirty('dock')
  }
  flush = function () { if (promptOn() && (dirty.has('hint') || dirty.has('cmd'))) dirty.add('dock'); flush0(); promptPlace() }      // (the list and the typing are drawn in the page)
  KEYS['⌥Slash'] = () => promptOpen()                                                     // (/ is go to bar, as in Logic: his ask, 2026-10-22 — the prompt is option and /)
  KEYS.Slash = () => startRename('pos')                                                   // go to bar: the place the playhead is, typed
  /* what was said is kept for the page (a line of cells once, though it is said through the line's reader) */
  runCommand = async function (text, ...more) { const words = String(text || '').trim(), was = S.think, r = await rc0.call(this, text, ...more); if (words && !was && !PROMPT.inLine) promptLog(words); return r }
  lineDo = async function () { const words = S.line.parts.map(p => p.t).join(' '); PROMPT.inLine = true; let r; try { r = await ld0() } finally { PROMPT.inLine = false } if (r) promptLog(words); return r }
  $('cmd').addEventListener('focus', () => { if (promptOn()) { hintFresh(true); uiDirty('dock') } })      // (the page shows what can follow as soon as the keys are in its field)
  $('cmd').addEventListener('blur', () => { if (promptOn()) uiDirty('dock') })
}
