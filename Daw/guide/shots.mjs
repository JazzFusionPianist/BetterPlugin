// node guide/shots.mjs [name …] — the guide's pictures of the app, taken from the app's own page (ui/index.html) in a
// headless browser: pics/<name>.png and, beside each, pics/<name>.json = where every named part (data-a) lies in it,
// which is what the guide's numbered lines are drawn to. With names, only those are taken again.
import { open, PAGE } from '../test/cdp.mjs'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url)), PICS = join(here, 'pics')
mkdirSync(PICS, { recursive: true })
const want = process.argv.slice(2)
process.setMaxListeners(200)
const W = 1180, H = 720
/* the page that is photographed is the installed app's own copy: the working tree may be in the middle of someone's
   change, and what the buyer has is what is installed. GUIDE_UI=tree takes the working tree instead, GUIDE_UI=/a/path/index.html any other copy. */
const INSTALLED = '/Applications/Slur Studio.app/Contents/Resources/ui/index.html'
export const UI = process.env.GUIDE_UI === 'tree' ? PAGE : process.env.GUIDE_UI && existsSync(process.env.GUIDE_UI) ? process.env.GUIDE_UI : existsSync(INSTALLED) ? INSTALLED : PAGE

export async function room (o = {}) {
  const b = await open(o.file || UI, { width: o.w || W, height: o.h || H, dsf: o.dsf || 2, before: o.before || '' })
  await b.sleep(500)
  /* a picture: the whole window, or the box [x, y, w, h] of it. Parts are noted by their data-a; the n-th of a name is name#n. */
  b.pic = async (name, clip, scale = 1) => {
    if (want.length && !want.includes(name)) return
    await b.ev(`if (window.__daw) { __daw.redraw && __daw.redraw(); __daw.flush && __daw.flush() }`)
    await b.sleep(120)
    const vw = o.w || W, vh = o.h || H
    if (typeof clip === 'string') { const [part, pad = 8] = clip.split('|'); const r = await b.box(part); if (!r) throw new Error('no part ' + part); const p = +pad; clip = [Math.max(0, Math.floor(r[0] - p)), Math.max(0, Math.floor(r[1] - p)), Math.ceil(r[2] + 2 * p), Math.ceil(r[3] + 2 * p)] }
    const [x, y, w, h] = clip || [0, 0, vw, vh]
    const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x, y, width: w, height: h, scale } })
    writeFileSync(join(PICS, name + '.png'), Buffer.from(r.data, 'base64'))
    const parts = await b.ev(`
      const out = {}, seen = {}
      for (const e of document.querySelectorAll('[data-a]')) {
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue
        if (r.right < ${x} || r.left > ${x + w} || r.bottom < ${y} || r.top > ${y + h}) continue
        const a = e.dataset.a + (e.dataset.k ? ':' + e.dataset.k : ''), i = seen[a] = (seen[a] || 0) + 1
        const box = [+(r.left - ${x}).toFixed(1), +(r.top - ${y}).toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]
        if (i === 1) out[a] = box
        out[a + '#' + i] = box
      }
      return out`)
    writeFileSync(join(PICS, name + '.json'), JSON.stringify({ w, h, parts }))
    console.log('took', name, w + 'x' + h)
  }
  b.box = (a, i = 1) => b.ev(`const e = [...document.querySelectorAll('[data-a="${a.split(':')[0]}"]${a.includes(':') ? `[data-k="${a.split(':')[1]}"]` : ''}')][${i - 1}]; if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]`)
  b.at = async (a, i = 1, fx = .5, fy = .5) => { const r = await b.box(a, i); if (!r) throw new Error('no part ' + a + '#' + i); return [r[0] + r[2] * fx, r[1] + r[3] * fy] }
  b.hit = async (a, i = 1, mods = 0, fx = .5, fy = .5) => { const [x, y] = await b.at(a, i, fx, fy); await b.click(x, y, mods); await b.sleep(120) }
  return b
}

/* a key as the guide writes it ('⌥⌘n', '⇧/', 'space') pressed for real */
const CODES = { space: ['Space', ' ', 32], '↩': ['Enter', 'Enter', 13], esc: ['Escape', 'Escape', 27], tab: ['Tab', 'Tab', 9], '⌫': ['Backspace', 'Backspace', 8], '/': ['Slash', '/', 191], ',': ['Comma', ',', 188], '.': ['Period', '.', 190], ';': ['Semicolon', ';', 186], "'": ['Quote', "'", 222], '[': ['BracketLeft', '[', 219], ']': ['BracketRight', ']', 221], '`': ['Backquote', '`', 192], '←': ['ArrowLeft', 'ArrowLeft', 37], '→': ['ArrowRight', 'ArrowRight', 39], '↑': ['ArrowUp', 'ArrowUp', 38], '↓': ['ArrowDown', 'ArrowDown', 40], f1: ['F1', 'F1', 112], f2: ['F2', 'F2', 113], f3: ['F3', 'F3', 114], f4: ['F4', 'F4', 115] }
export async function key (b, combo) {
  let mods = 0, k = combo
  for (;;) { const c = k[0]; if (c === '⌥') mods |= 1; else if (c === '⌃') mods |= 2; else if (c === '⌘') mods |= 4; else if (c === '⇧') mods |= 8; else break; k = k.slice(1) }
  const [code, name, vk] = CODES[k] || (/^[a-z]$/.test(k) ? ['Key' + k.toUpperCase(), k, k.toUpperCase().charCodeAt(0)] : /^[0-9]$/.test(k) ? ['Digit' + k, k, 48 + +k] : [k, k, 0])
  await b.press(name, code, vk, mods)
  await b.sleep(120)
}

/* ── the pictures ── each from a fresh room in a known state, reached the way a user reaches it (keys, presses) ── */
const NAMES = [['jun', 'theo'], ['minseo', 'mina']]                                    // the demo song's players, given made-up names
async function fresh (o) {
  const b = await room(o)
  if (!(o && o.file)) await b.ev(`for (const t of __daw.S.tracks) { if (t.theirs === 'jun') t.theirs = 'theo'; if (t.theirs === 'minseo') t.theirs = 'mina' } __daw.redraw()`)
  b.lay = () => b.ev(`return __daw.lay()`)
  b.X = async bar => { const L = await b.lay(); return L.X0 + (bar - 1 - L.VX) * L.PXB }
  b.Y = async row => { const L = await b.lay(); return L.TY + (row - .5) * L.rh - L.VY }
  b.right = async (x, y) => { await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 }); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 }); await b.sleep(150) }
  b.twice = async (x, y) => { await b.click(x, y); await b.sleep(60); await b.click(x, y); await b.sleep(150) }
  b.names = () => b.ev(`const m = {}; for (const e of document.querySelectorAll('[data-a]')) { const k = e.dataset.a + (e.dataset.k ? ':' + e.dataset.k : ''); m[k] = (m[k] || 0) + 1 } return Object.entries(m).map(([k, v]) => k + (v > 1 ? '×' + v : '')).join(' ')`)
  return b
}
const PANEL = [0, H - 22 - 316, W, 316]
const PATCH = [248, H - 22 - 316, W - 248, 316]                                     // the patch as the app shows it: the transport panel at the left (and no strips at the patch's right)
const tpanel = (b, on) => b.ev(`if (typeof tpanelSet === 'function') { tpanelSet(${on}, false); flush() } return 1`)
const SHOTS = {
  /* settings > display: the room wearing a look of its own (light ground, dark ink, round corners, the sound standing on the region's foot) */
  'display-room': async b => {
    await b.ev(`applyLook({ 'win.k1': { c: '#E9E4D8', a: 100 }, 'win.k2': { c: '#DCD6C8', a: 100 }, 'win.k3': { c: '#CFC8B8', a: 100 }, 'win.k4': { c: '#C2BAA8', a: 100 }, 'lanes.k0': { c: '#F4F0E6', a: 100 }, 'win.ink': { c: '#1E1C18', a: 100 }, 'reg.corners': 4, 'reg.line': { c: '#1E1C18', a: 35 }, 'snd.drawn': 'half', 'fam.drums.0': { c: '#C2412D', a: 100 }, 'fam.drums.1': { c: '#F2B33D', a: 100 } }); return 1`)
    await b.sleep(300); await b.pic('display-room')
  },
  async window (b) {
    await b.click(await b.X(14), await b.Y(5))
    await b.ev(`const S = __daw.S; S.cycle = { on: true, a: 16, b: 24 }; S.pos = 19; __daw.redraw()`)
    /* the markers and bars, and the foot, as they stand with nothing at the top (the transport panel hidden) */
    const mk = await b.ev(`return MK_Y`)
    await b.pic('ruler', [0, mk, W, 47], 1.5)
    await b.pic('foot', [0, H - 22, W, 22], 1.5)
    /* the window as the app begins: the transport panel at the left (panel.js) */
    await b.ev(`if (typeof tpanelSet === 'function') { tpanelSet(true, false); flush(); SKINS.frame.panel(curPos()) } return 1`); await b.sleep(250)
    await b.ev(`flush(); if (typeof SKINS === 'object' && SKINS.frame.panel) SKINS.frame.panel(curPos()); return 1`)
    await b.pic('window')
    await b.pic('panel', [0, 0, 248, H], 1.5)
    await b.ev(`if (typeof tpanelSet === 'function') { tpanelSet(false, false); flush() } return 1`)
  },
  async heads (b) {
    // a stack over the first three tracks, two of them an edit group, one armed and heard, one muted, one soloed, one with alternatives
    await b.click(60, await b.Y(1)); await b.click(60, await b.Y(3), 8); await key(b, '⇧⌘d')
    await b.ev(`const S = __daw.S; S.tracks[0].name = 'drums'; __daw.repaint(); __daw.redraw()`)
    await b.click(60, await b.Y(2)); await b.click(60, await b.Y(3), 8); await key(b, '⌃⌘g'); await key(b, 'esc'); await key(b, 'esc')        // (the group's card opens as it is made, its name box first: both put away)
    await b.ev(`const S = __daw.S, T = S.tracks; T[5].arm = true; T[5].mon = true; T[7].mute = true; T[3].solo = true; T[8].alts = [[]]; T[8].alt = 1; __daw.chooseTrack(5, ''); __daw.redraw()`)
    console.log('heads', await b.names())
    const L = await b.lay()
    await b.pic('heads', [0, 93, 292, 23 + 9 * L.rh + 3], 2)
    await b.pic('heads-window')
    await b.right(60, await b.Y(6)); await b.pic('trackmenu', [0, 93, 420, 400], 2); await key(b, 'esc')
  },
  async newtrack (b) {
    await key(b, '⌥⌘n'); console.log('newtrack', await b.names()); await b.pic('newtrack', [0, 44, 330, 250], 2)
  },
  async menus (b) {
    await b.click(await b.X(14), await b.Y(5))
    const mk = await b.ev(`return MK_Y`)
    const s = await b.at('scene', 3); await b.right(s[0], s[1]); await b.pic('markermenu', [380, mk, 420, 220], 2); await key(b, 'esc')
    /* the lists of the transport panel: each opens beside its word (the bars at the top are gone) */
    await b.ev(`if (typeof tpanelSet === 'function') { tpanelSet(true, false); flush() } return 1`); await b.sleep(250)
    const near = async (a, w, h, dx = -12, dy = -24) => { const r = await b.box(a); return [Math.max(0, Math.round(r[0] + dx)), Math.max(0, Math.round(r[1] + dy)), w, h] }
    /* a list and the word it opened from, cut to the two: the list's own rows give its edges */
    const list = async (name, a) => { const w = await b.box(a); await b.hit(a)
      const m = await b.ev(`const q = [...document.querySelectorAll('#g-menu [data-a="pick"]')].map(e => e.getBoundingClientRect()); if (!q.length) return null; const l = Math.min(...q.map(r => r.left)), t = Math.min(...q.map(r => r.top)); return [l, t, Math.max(...q.map(r => r.right)) - l, Math.max(...q.map(r => r.bottom)) - t]`)
      const x = Math.max(0, Math.round(Math.min(m[0], w[0]) - 16)), y = Math.max(0, Math.round(m[1] - 16)), x2 = Math.round(Math.max(m[0] + m[2], w[0] + w[2]) + 16), y2 = Math.round(Math.max(m[1] + m[3], w[1] + w[3]) + 12)
      await b.pic(name, [x, y, x2 - x, y2 - y], 2); await key(b, 'esc') }
    await list('toolmenu', 'toolmenu')
    await list('modemenu', 'modemenu')
    await b.hit('look', 1); console.log('look', await b.names()); { const r = await b.box('look'); await b.pic('look', [Math.max(0, Math.round(r[0]) - 20), Math.max(0, Math.round(r[1]) - 300), 520, 330], 1.5) } await key(b, 'esc')
    await list('nudgelist', 'nudge')
    { const c = await near('meter', 220, 360, -12, -12); await b.hit('meter'); await b.pic('meterlist', c, 2); await key(b, 'esc') }
    await b.ev(`if (typeof tpanelSet === 'function') { tpanelSet(false, false); flush() } return 1`)
  },

  async fades (b) {
    // close in on a join of two kick regions; a fade in, a fade out, and a crossfade drawn with the fade tool
    await b.ev(`const S = __daw.S; S.rh = 64; __daw.setZoom(110, 22.6); __daw.redraw()`)
    console.log('fades lay', JSON.stringify(await b.lay()))
    await key(b, 't'); await key(b, 'a')
    const y = await b.Y(1), xj = await b.X(25)
    await b.dragTo(xj, y, xj + 44, y, 8)
    const y2 = await b.Y(2), x0 = await b.X(17), x1 = await b.X(25)
    void x0
    await b.dragTo(x1 + 8, y2, x1 + 96, y2, 8)
    await b.dragTo(x1 - 10, y2, x1 - 120, y2, 8)
    await b.click(xj, y)
    console.log('fades', JSON.stringify(await b.ev(`const S = __daw.S; return { tool: S.tool, selX: S.selX, r: S.tracks[0].regs.map(r => [r.a, r.b, r.fi, r.fo]) }`)))
    const L = await b.lay()
    await b.pic('fades', [L.X0, 93, W - L.X0, 23 + 2 * 64 + 6], 1.5)
    console.log('fades view', JSON.stringify(L))
    await b.pic('fades-row', [0, 44, W, 27], 1.5)
  },
  async auto (b) {
    await b.click(60, await b.Y(4)); await key(b, 'a')
    const y = await b.Y(4)
    for (const [bar, dy] of [[5, 4], [9, -6], [13, -6], [17, 6], [25, 0]]) await b.twice(await b.X(bar), y + dy)
    console.log('auto', await b.names())
    const L = await b.lay()
    await b.pic('auto', [0, 93, W, 23 + 5 * L.rh + 3], 1.5)
    const k = await b.box('ap', 4)
    if (k) { await b.click(k[0] + k[2] / 2, k[1] + k[3] / 2); await b.pic('autolist', [0, 93, 420, 330], 2); await key(b, 'esc') }
  },
  async mixer (b) {
    await b.ev(`const S = __daw.S, T = S.tracks; __daw.newTracks ? 0 : 0`)
    await b.click(60, await b.Y(5)); await key(b, '⌃n')
    await b.ev(`const S = __daw.S, T = S.tracks; const bus = T[T.length - 1]; bus.name = 'plate'; bus.patch.A.space = 46; T[6].sends = [{ to: bus.id, db: -12 }]; T[4].sends = [{ to: bus.id, db: -18 }]; T[4].patch.A.tape = 24; T[4].patch.A.space = 30; T[4].patch.A.delay = 20; T[4].inserts = [{ uid: 9001, name: 'comp', fmt: 'au', id: 'x' }, { uid: 9002, name: 'equaliser', fmt: 'vst3', id: 'y' }]; T[2].mute = true; T[3].solo = false; __daw.repaint(); __daw.chooseTrack(4, ''); __daw.redraw()`)
    await key(b, 'x'); console.log('mixer', await b.names()); await b.pic('mixer', PANEL, 1.5)
    /* the room's one mixer (mixpanel.js) */
    await b.pic('mixpanel', PANEL, 1.5)
    /* where a strip plays, and its list: from the mixer (the patch has no strips at its right since 2026-10-21) */
    { const o = await b.box('mout', 1)
      if (o) { await b.click(o[0] + o[2] / 2, o[1] + o[3] / 2); await b.sleep(200)
        const m = await b.ev(`const q = [...document.querySelectorAll('#g-menu [data-a="pick"]')].map(e => e.getBoundingClientRect()); if (!q.length) return null; return [Math.min(...q.map(r => r.left)), Math.min(...q.map(r => r.top)), Math.max(...q.map(r => r.right)), Math.max(...q.map(r => r.bottom))]`)
        if (m) { const x = Math.max(0, Math.round(Math.min(o[0], m[0]) - 24)), y = Math.max(0, Math.round(Math.min(o[1], m[1]) - 24)), x2 = Math.round(Math.max(o[0] + o[2], m[2]) + 24), y2 = Math.round(Math.max(o[1] + o[3], m[3]) + 24); await b.pic('outlist', [x, y, x2 - x, y2 - y], 1.5) }
        await key(b, 'esc') } }
    await tpanel(b, true); await b.sleep(250)
    await key(b, 'b'); console.log('patch', await b.names()); await b.pic('patch', PATCH, 1.5)
    await b.click(248 + 60, await b.Y(1)); await b.pic('patch-empty', PATCH, 1.5)
    await b.hit('plugs'); await b.pic('addlist', [600, 300, 580, 398], 1.5); await key(b, 'esc')
    await tpanel(b, false)
  },
  async handoff (b) {
    await b.ev(`const S = __daw.S; S.cycle = { on: true, a: 16, b: 24 }; S.pos = 19; __daw.redraw()`)
    await key(b, '⌘b'); await b.pic('handoff', 'ho-pane|10', 2)
  },
  async inst (b) {
    await key(b, '⌥⌘s')
    await b.ev(`const S = __daw.S, t = S.tracks[S.sel]; const notes = []; let id = 0
      const fig = [[0, 60, 1], [1, 64, .5], [1.5, 67, .5], [2, 72, 1], [3, 71, .5], [3.5, 67, .5], [4, 65, 1], [5, 69, .5], [5.5, 72, .5], [6, 76, 1.5], [7.5, 74, .5]]
      for (let rep = 0; rep < 4; rep++) for (const [tt, n, d] of fig) notes.push({ id: ++id, t: rep * 8 + tt, d, n: n + (rep === 2 ? 5 : rep === 3 ? -2 : 0), v: 96 })
      const r = __daw.mkReg({ a: 5, b: 13, off: 0 }); r.notes = notes; t.regs.push(r); const r2 = __daw.mkReg({ a: 17, b: 25, off: 0 }); r2.notes = notes; t.regs.push(r2); __daw.redraw()`)
    await b.ev(`__daw.S.rh = 44; __daw.redraw()`)
    { const L = await b.lay(), i = await b.ev(`return __daw.S.sel`); await b.pic('notes', [0, L.TY + i * 44 - 2, W, 44 + 4], 1.5) }
    await b.ev(`__daw.S.rh = 25; __daw.redraw()`)
    await tpanel(b, true); await b.sleep(250)
    await key(b, 'b'); await b.pic('inst-patch', PATCH, 1.5)
    await b.hit('inst-pick'); await b.sleep(300); { const r = await b.ev(`const e = document.getElementById('picker'); const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]`); await b.pic('instlist', [Math.round(r[0]) - 10, Math.round(r[1]) - 34, Math.round(r[2]) + 20, Math.round(r[3]) + 44], 2) } await key(b, 'esc')
    await b.hit('inst'); await b.pic('synth', PATCH, 1.5)
    await b.ev(`const S = __daw.S, t = S.tracks[S.sel]; t.inst = { kind: 'drums', sound: 'kit', p: {}, pads: {} }; t.name = 'drums'; __daw.repaint(); __daw.redraw()`)
    await b.pic('kit', PATCH, 1.5)
    await b.ev(`const S = __daw.S, t = S.tracks[S.sel]; t.inst = { kind: 'sampler', sound: '', p: { loop: 1, la: .3, lb: .7 }, sample: null }; t.name = 'sampler'; __daw.repaint(); __daw.redraw()`)
    await b.pic('sampler', PATCH, 1.5)
    await tpanel(b, false)
    await b.ev(`const S = __daw.S, t = S.tracks[S.sel]; t.inst = { kind: 'synth', sound: 'e piano', p: {} }; t.name = 'e piano'; __daw.repaint(); __daw.redraw()`)
    await b.hit('iv:chain'); await key(b, 'b')
    await key(b, '⌘k'); await b.pic('keyboard', [0, 0, W, 700]); await b.pic('keyboard-sheet', 'kb:none|10', 2)
    /* the notes page: the region's notes against the keys, then the same page on a kit */
    await key(b, '⌘k')
    await b.ev(`const S = __daw.S, t = S.tracks[S.sel], v = [112, 64, 52, 96, 70, 44, 84, 58, 66, 120, 76]; t.regs[0].notes = t.regs[0].notes.map((x, i) => Object.assign({}, x, { v: v[i % v.length] })); delete t.regs[0]._ns; S.selR = [t.regs[0].id]; __daw.redraw()`)
    await key(b, 'p'); await b.sleep(600)
    await b.ev(`const S = __daw.S, t = S.tracks[S.sel], r = t.regs[0]; let id = 5000; r.ctl = [[0, 20], [6, 96], [12, 40], [20, 110], [28, 30]].map(([tt, v]) => ({ id: ++id, t: tt, c: 1, v })); ROLL.lane = true; ROLL.param = 'modulation'; __daw.redraw()`)
    { const L = await b.lay(); await b.pic('roll', [0, L.BY, W, H - L.BY]) }
    await b.ev(`ROLL.param = 'velocity'; __daw.redraw()`)
    await b.ev(`const S = __daw.S, t = S.tracks[S.sel]; t.inst = { kind: 'drums', sound: 'kit', p: {}, pads: {} }; t.name = 'drums'; const ns = []; let id = 900
      for (let k = 0; k < 8; k++) { const q = k * 4; for (const at of [0, 1.5, 2.5]) ns.push({ id: ++id, t: q + at, d: .25, n: 36, v: at ? 98 : 122 }); ns.push({ id: ++id, t: q + 1, d: .25, n: 38, v: 112 }, { id: ++id, t: q + 3, d: .25, n: 38, v: 120 }, { id: ++id, t: q + 2.25, d: .25, n: 38, v: 30 }); for (let h = 0; h < 8; h++) ns.push({ id: ++id, t: q + h * .5, d: .25, n: 42, v: h % 2 ? 46 : 92 }); if (k % 4 === 0) ns.push({ id: ++id, t: q, d: .25, n: 49, v: 108 }) }
      t.regs[0].notes = ns; delete t.regs[0]._ns; __daw.repaint(); __daw.redraw()`)
    await b.sleep(250)
    { const L = await b.lay(); await b.pic('roll-kit', [0, L.BY, W, H - L.BY]) }
  },
  /* the command line at the foot (option and / give it the keys): a line said, and what came of it beside it; then a word
     two tracks answer to, and the question it asks */
  async say (b) {
    const line = async (text, name) => { await key(b, '⌥/'); await b.type(text); await key(b, '↩'); await b.sleep(350); await b.pic(name, [0, H - 22, 620, 22], 2.5); await key(b, 'esc') }
    await line('kick -3', 'say-1')
    await line('drums 2db down then solo bass', 'say-2')
    await line('select chorus', 'say-3')
    await b.ev(`const T = __daw.S.tracks; T[0].name = 'kick in'; T[1].name = 'kick out'; __daw.repaint(); __daw.redraw()`)
    await line('kick mute', 'say-4')
  },
}
const SIZE = {}
async function standIn () {
  // the app as far as the page asks it anything, borrowed from the start page's own check, with the names changed
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../test/start.mjs', import.meta.url), 'utf8')
  const a = src.indexOf('const APP = `(${') + 'const APP = `(${'.length, z = src.indexOf('.toString()})()`')
  let fn = src.slice(a, z)
  for (const [x, y] of [['night bus ep', 'low tide ep'], ['jun’s guitars', 'theo’s guitars'], ['minseo demo 2', 'mina demo 2'], ['wedding song for hana', 'wedding song for ana'], ['strings for hana', 'strings for ana'], ['veloso live, mix', 'riverside live, mix'], ['/Users/steven/Desktop/', '/Users/you/Desktop/']]) fn = fn.split(x).join(y)
  return `(${fn})()`
}
async function standInFolders () {
  // the same for a shelf with folders on it, borrowed from the folders' own check
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../test/folders.mjs', import.meta.url), 'utf8')
  const a = src.indexOf('const APP = `(${') + 'const APP = `(${'.length, z = src.indexOf('.toString()})()`')
  let fn = src.slice(a, z)
  for (const [x, y] of [['night bus ep', 'low tide ep'], ['snap', 'porch take'], ["'empty one'", "'for the record'"], ["foldersOpen: []", "foldersOpen: ['demos']"]]) fn = fn.split(x).join(y)
  return `(${fn})()`
}
async function others () {
  const b = await room({ before: await standIn() })
  for (let i = 0; i < 60 && !(await b.ev(`return typeof START !== 'undefined' && START.on && START.read`)); i++) await b.sleep(100)
  await b.sleep(300); await b.pic('start'); await b.close()
  if (!want.length || want.includes('folders')) {
    const f = await room({ before: await standInFolders() })
    for (let i = 0; i < 60 && !(await f.ev(`return typeof START !== 'undefined' && START.on && START.read`)); i++) await f.sleep(100)
    await f.sleep(300); await f.pic('folders', [0, 0, W, 470]); await f.close()
  }
  const s = await room({ file: join(dirname(UI), 'settings.html'), w: 1100, h: 692 })        // (the window is laid out at the size display and plug-ins open it at)
  await s.sleep(700); await s.pic('settings', [0, 0, 1100, 450], 1.3)
  console.log('settings', await s.ev(`return [...new Set([...document.querySelectorAll('[data-a]')].map(e => e.dataset.a + (e.dataset.k ? ':' + e.dataset.k : '')))].join(' ')`))
  await s.close()
  if (!want.length || want.includes('display')) {                                    // settings > display, with a few qualities set so the dots and the count show
    const d = await room({ file: join(dirname(UI), 'settings.html') + '?part=display', w: 1100, h: 692 })
    await d.sleep(400); await d.ev(`LOOK = { 'reg.corners': 4, 'reg.line': { c: null, a: 35 }, 'reg.shape': 'off' }; draw(); return 1`)
    await d.pic('display', [0, 0, 1100, 692], 1.2); await d.close()
  }
  for (const th of ['bauhaus']) if (!want.length || want.includes('theme-' + th)) {      // the room in a built-in theme, its parts and all (theme.js, skins.js)
    const t = await room({}); await t.sleep(800)
    await t.ev(`for (const tr of S.tracks) { if (tr.theirs === 'jun') tr.theirs = 'theo'; if (tr.theirs === 'minseo') tr.theirs = 'mina' } S.panel.on = true; S.panel.tab = 'mixer'; setView(true); applyLook(JSON.parse(JSON.stringify(THEMES['${th}']))); return 1`)
    await t.sleep(1200); await t.ev(`flush(); return 1`)
    await t.pic('theme-' + th); await t.close()
  }
  if (!want.length || want.includes('keycommands')) {                                // settings > key commands, with the room's own commands, as logic pro with a change or two
    const r0 = await room({}); await r0.sleep(800)
    const cat = await r0.ev(`return kcCatalog().map(c => ({ id: c.id, menu: c.menu, name: c.name, keys0: c.keys0, shown: c.shown, loose: !!c.loose }))`); await r0.close()
    const k = await room({ file: join(dirname(UI), 'settings.html') + '?part=key+commands', w: 1100, h: 692, before: `window.KEY_STAND_IN = ${JSON.stringify(cat)}; window.KEY_STAND_SET = { base: 'logic', changes: { 'Region > Mute': ['KeyN'], 'Tools > Nudge Value > Bar': ['⌥⇧KeyM'] } }` })
    await k.sleep(600); await k.ev(`KP.rec = 'Transport > Record'; KP.said = inWords('press its key, ⌫ for none, esc to keep it'); draw(); return 1`)
    await k.pic('keycommands', [0, 0, 1100, 692], 1.2); await k.close()
  }
  if (!want.length || want.includes('plugins')) {                                    // settings > plug-ins, with the plug-ins of a Mac like his (design/plugins draft 1), a few left out
    const list = (await import('node:fs')).readFileSync(new URL('../design/plugins draft 1/plugs.json', import.meta.url), 'utf8')
    const out = ['Console Recall', 'Ocean Way Studios', 'Auto-Key', 'UAD Fairchild 660', 'UAD Fairchild 670', 'UAD dbx 160', 'UAD Teletronix LA-3A', 'UAD Precision Limiter', 'UAD Precision Multiband', 'UAD Precision Buss Compressor']
    const kinds = { 'UAD Sphere Mic Collection': 'channel', 'UAD Ocean Way Mic Collection': 'channel', 'UAD Putnam Mic Collection': 'channel' }      // (a few kinds set by hand, as design/plugins draft 2 has them)
    const g = await room({ file: join(dirname(UI), 'settings.html') + '?part=plug-ins', w: 1100, h: 692, before: `window.PLUG_STAND_IN = ${list}; window.PLUG_STAND_OUT = ${JSON.stringify(out)}; window.PLUG_STAND_KINDS = ${JSON.stringify(kinds)}` })
    await g.sleep(500); await g.ev(`PG.group = 'channel'; draw(); PG.hover = PG.rows.findIndex(p => p.name === 'UAD Sphere Mic Collection'); draw(); return 1`)      // (the row under the pointer shows its kind)
    await g.pic('plugins', [0, 0, 1100, 692], 1.2); await g.close()
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!want.length || want.includes('start') || want.includes('settings') || want.includes('folders') || want.includes('display') || want.includes('plugins') || want.includes('keycommands') || want.some(w => w.startsWith('theme-'))) await others()
  if (!want.length || want.includes('keys')) { const b = await room(); writeFileSync(join(here, 'keys.json'), JSON.stringify(await b.ev(`return SHEET`), null, 1)); await b.close(); console.log('took keys.json') }       // the app's own sheet of keys: the guide's last chapter is set from it
  for (const [name, fn] of Object.entries(SHOTS)) {
    const b = await fresh(SIZE[name])
    try { await fn(b) } catch (e) { console.log('FAILED', name, e.message.split('\n')[0]) }
    if (b.errors.length) console.log(name, 'errors:', b.errors.slice(0, 3).join(' | '))
    await b.close()
  }
}
