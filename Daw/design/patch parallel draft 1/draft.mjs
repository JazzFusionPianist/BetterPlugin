// node "design/patch parallel draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the patch as a wall
// (Patch on Slur's way: things wired from port to port, one output to several wires, a mix that takes any number of wires,
// a level riding each wire into it), with plug-ins and prints side by side. Nothing of this is in the app: the page's
// pPatch is replaced here, in this browser only, by a drawing of an example.
import { open, PAGE } from '../../test/cdp.mjs'
import { copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
await b.sleep(500)
const LIST = ['Pro-Q 4|FabFilter', 'Pro-C 2|FabFilter', 'Pro-L 2|FabFilter', 'Pro-R 2|FabFilter', 'Saturn 2|FabFilter', 'Timeless 3|FabFilter', 'ValhallaVintageVerb|Valhalla DSP', 'ValhallaPlate|Valhalla DSP', 'ValhallaRoom|Valhalla DSP', 'ValhallaDelay|Valhalla DSP', 'EchoBoy|Soundtoys', 'Decapitator|Soundtoys', 'Little Plate|Soundtoys', 'MicroShift|Soundtoys',
  'UAD Pultec EQP-1A|Universal Audio', 'UAD Fairchild 670|Universal Audio', 'UAD EMT 140|Universal Audio', 'UAD Lexicon 224|Universal Audio', 'UAD Neve 1073|Universal Audio', 'UAD Studer A800|Universal Audio', 'Auto-Tune Pro|Antares', 'Archetype Plini|Neural DSP', 'Ozone 12 Imager|iZotope', 'soothe2|oeksound', 'UAD 1176 Rev A|Universal Audio', 'UAD Capitol Chambers|Universal Audio']
await b.ev(`if (typeof START !== 'undefined') START.on = false
  S.picker.list = ${JSON.stringify(LIST)}.map((s, i) => ({ id: 'p' + i, name: s.split('|')[0], maker: s.split('|')[1], fmt: 'au' })).sort((a, b) => a.name.localeCompare(b.name))
  S.sel = S.tracks.findIndex(t => /hum/.test(t.name)); S.tracks[S.sel].name = 'vocal'; S.panel.on = true; S.panel.tab = 'patch'; S.panel.h = 452; setView(true)
  window.DRAFT_WIRING = false
  pPatch = function (y, h) {
    const t = S.tracks[S.sel], rx = RX - SIDE, cw = rx - pickerW(), NR = 32, e = NR + 7, MID = y + Math.round(h / 2) - 14
    const k = Math.min(1, (cw - 16) / 900), ox = Math.max(8, Math.round((cw - 900 * k) / 2))
    const end = (x, yy, o = {}) => Cc(x, yy, o.r || 2, { fill: INK, fa: o.a == null ? 1 : o.a })
    const wire = (ax, ay, bx2, by, o = {}) => { const dx = Math.max(18, (bx2 - ax) * .5); return P('M' + ax + ' ' + ay + 'C' + n(ax + dx) + ' ' + ay + ' ' + n(bx2 - dx) + ' ' + by + ' ' + bx2 + ' ' + by, { stroke: INK, sa: o.a || .46, sw: o.sw || 1, dash: o.dash }) + (o.open ? '' : end(ax, ay) + end(bx2, by)) }
    const label = (cx, yy, name, rest) => T(cx, yy, name, { size: 10, w: 500, anchor: 'middle' }) + (rest ? T(cx, yy + 12.5, rest, { size: 9, a: .46, anchor: 'middle' }) : '')
    const lvl = (x, yy, v, on) => R(x - 13, yy - 7.5, 26, 15, { rx: 2, fill: K1 }) + R(x - 12.5, yy - 7, 25, 14, { rx: 2, stroke: INK, sa: on ? .7 : .22, fill: on ? INK : K1, fa: on ? .1 : 1 }) + T(x, yy + 3.4, String(v), { size: 9, a: on ? 1 : .7, anchor: 'middle' })
    const loan = (x, yy, name, sub) => loanFrame(x, yy, NR, name) + label(x, yy + NR + 17, fit(name, 84, 10, 500), sub || 'au')
    const pr = (kind, x, yy, name, sub) => plate(kind, x, yy, NR) + label(x, yy + NR + 17, name, sub)
    const A = [250, MID], V = [440, MID - 104], D = [440, MID], M = [640, MID], L = [800, MID], IN = [80, MID], OUT = [900, MID], C = [440, MID + 104]
    let g = ''
    g += Cc(IN[0], IN[1], 4, { stroke: INK, sa: .8, sw: 1.2 }) + T(IN[0], IN[1] + 20, 'in', { size: 9.5, a: .46, anchor: 'middle' })
    g += wire(IN[0] + 7, MID, A[0] - e, MID)
    g += wire(A[0] + e, MID, V[0] - e, V[1]) + wire(A[0] + e, MID, D[0] - e, D[1])                       // one output, several wires
    if (window.DRAFT_WIRING) g += wire(A[0] + e, MID, C[0] - e, C[1]) + wire(C[0] + e, C[1], C[0] + e + 96, C[1] - 38, { dash: '3 3', a: .8, open: true }) + end(C[0] + e, C[1]) + Cc(C[0] + e + 96, C[1] - 38, 5, { stroke: INK, sa: .9 })
    else { const ax = A[0] + e, mx = M[0] - e, yb = MID + 104; g += P('M' + ax + ' ' + MID + 'C' + (ax + 50) + ' ' + MID + ' ' + (ax + 40) + ' ' + yb + ' ' + (ax + 110) + ' ' + yb + 'H' + (mx - 110) + 'C' + (mx - 40) + ' ' + yb + ' ' + (mx - 50) + ' ' + (MID + 14) + ' ' + mx + ' ' + (MID + 14), { stroke: INK, sa: .46 }) + end(mx, MID + 14) }      // the sound itself, round the two, into the same mix
    g += wire(V[0] + e, V[1], M[0] - e, M[1] - 14) + wire(D[0] + e, D[1], M[0] - e, M[1])
    g += lvl((V[0] + e + M[0] - e) / 2, (V[1] + M[1] - 14) / 2, 35, true) + lvl((D[0] + e + M[0] - e) / 2, MID, 20)
    if (!window.DRAFT_WIRING) g += lvl(D[0], MID + 104, 100)
    g += wire(M[0] + e, MID, L[0] - e, MID) + wire(L[0] + e, MID, OUT[0] - 7, MID)
    g += Cc(OUT[0], OUT[1], 4, { stroke: INK, sa: .8, sw: 1.2 }) + T(OUT[0], OUT[1] + 20, 'out', { size: 9.5, a: .46, anchor: 'middle' })
    g += loan(A[0], A[1], 'pro-q 4') + loan(V[0], V[1], 'valhalla vintageverb') + pr('delay', D[0], D[1], 'delay', '1/8 25 fb 35') + pr('mix', M[0], M[1], 'mix', 'adds') + loan(L[0], L[1], 'pro-l 2')
    if (window.DRAFT_WIRING) g += loan(C[0], C[1], 'pro-c 2')
    let s = G(g, 'translate(' + ox + ' 0) scale(' + n(k) + ')' )
    s += R(rx, y, RX - rx, h, { fill: K2, fa: .6 }) + vline(rx - .5, y, y + h, .08)
    const x1 = rx + GUT, x2 = x1 + WSTRIP + 6
    MGEOM = stripGeom(y, h, true)
    s += stripGutter(rx, GUT, y, h, true)
    s += R(x1, y, WSTRIP, h, { fill: INK, fa: .05 }) + strip(x1, y, WSTRIP, h, t, S.sel, { wide: true, sel: true }) + vline(x1 + WSTRIP + 2.5, y + 8, y + h - 8, .07)
    s += strip(x2, y, WSTRIP, h, MASTER(), -1, { wide: true, master: true })
    return s
  }
  dirtyAll(); flush()`)
await b.sleep(200)
await b.shot('patch-parallel-1.png')
await b.ev(`window.DRAFT_WIRING = true; S.picker.cat = 'dynamics'; openPicker(); dirtyAll(); flush()`)
await b.sleep(300)
await b.shot('patch-parallel-2.png')
await b.close()
for (const [f, name] of [['patch-parallel-1.png', '1 a patch with two ways side by side.png'], ['patch-parallel-2.png', '2 wiring a new plug-in from the list.png']]) { copyFileSync(join(here, '../../test/out', f), join(here, name)); rmSync(join(here, '../../test/out', f)) }
console.log('drawn')
