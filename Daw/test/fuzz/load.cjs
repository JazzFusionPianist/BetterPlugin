// The page's own scripts run in Node, with no browser: a stand-in for the document, enough for the hands and the edits
// to work on the song as they do on the page (nothing is drawn, nothing sounds, nothing of the project is read or written).
// The scripts share one scope on the page; here they are run one after another in this context for the same reason, and
// so is the body of a check (edits.js, group.js), which is why those are plain scripts and not modules.
//
//   node test/fuzz/load.cjs <body> <seed> <steps> [ops]
const vm = require('vm'), fs = require('fs'), path = require('path')
const UI = path.join(__dirname, '..', '..', 'ui')
const mkEl = () => {
  const el = { style: {}, dataset: {}, children: [], innerHTML: '', hidden: true, value: '', textContent: '',
    setAttribute () {}, getAttribute () { return null }, appendChild (c) { this.children.push(c); return c }, remove () {}, focus () {}, select () {}, blur () {},
    addEventListener () {}, removeEventListener () {}, getBoundingClientRect () { return { left: 0, top: 0, width: 1440, height: 900 } }, closest () { return null },
    setPointerCapture () {}, querySelector () { return null }, querySelectorAll () { return [] }, getContext () { return { font: '', measureText: s => ({ width: String(s).length * 5.2 }), scale () {}, stroke () {}, fill () {} } }, toDataURL () { return 'data:,' } }
  el.firstChild = { setAttribute () {} }
  return el
}
const els = new Map()
globalThis.window = globalThis
globalThis.document = { createElement: () => mkEl(), createElementNS: () => mkEl(), getElementById: id => { if (!els.has(id)) els.set(id, mkEl()); return els.get(id) }, documentElement: mkEl(), fonts: { load: async () => {}, check: () => true }, activeElement: null, hidden: false, elementFromPoint: () => null }
globalThis.requestAnimationFrame = () => 0
globalThis.addEventListener = () => {}
globalThis.Path2D = function () {}
for (const f of ['sound.js', 'kit.js', 'engine.js', 'ui.js', 'edit.js', 'mix.js', 'auto.js', 'rec.js', 'flex.js', 'project.js', 'native.js', 'midi.js']) vm.runInThisContext(fs.readFileSync(path.join(UI, f), 'utf8'), { filename: f })
vm.runInThisContext(`
  svg = $('svg'); board = $('board')
  LOOPS = songLoops(S.tempo)
  for (const t of S.tracks) t.patch0 = copy(t.patch)
  repaint()
  flush = function () {}
  startRename = function () {}
  globalThis.trk = name => S.tracks.find(t => t.name === name)
  globalThis.trki = name => S.tracks.findIndex(t => t.name === name)
  /* what must hold of every lane (a track's own regions, and each of its alternatives): nothing of no length, no fade
     longer than its region, no two fades of one region running into each other, and no two regions sounding at once
     unless they are a crossfade — the earlier one falling over exactly the stretch the later one rises, each keeping
     something that is its own */
  globalThis.inv = () => {
    const errs = []
    for (const t of S.tracks) lanesOf(t).forEach((L, li) => {
      const rs = L.regs.slice().sort((x, y) => x.a - y.a || x.b - y.b), nm = t.name + (li ? ' alt ' + L.name : '')
      for (const r of rs) {
        const len = r.b - r.a
        if (!isFinite(r.a) || !isFinite(r.b) || !isFinite(r.off || 0) || !isFinite(r.fi || 0) || !isFinite(r.fo || 0)) { errs.push(nm + ': not a number'); continue }
        if (!(len > 0)) errs.push(nm + ': length ' + len + ' at ' + r.a)
        if ((r.fi || 0) < 0 || (r.fo || 0) < 0) errs.push(nm + ': a fade below nothing at ' + r.a)
        if ((r.fi || 0) > len + 1e-9 || (r.fo || 0) > len + 1e-9) errs.push(nm + ': a fade longer than the region [' + r.a.toFixed(4) + ',' + r.b.toFixed(4) + '] fi ' + (r.fi || 0).toFixed(4) + ' fo ' + (r.fo || 0).toFixed(4))
        else if ((r.fi || 0) + (r.fo || 0) > len + 1e-6) errs.push(nm + ': fi+fo longer than the region [' + r.a.toFixed(4) + ',' + r.b.toFixed(4) + '] fi ' + (r.fi || 0).toFixed(4) + ' fo ' + (r.fo || 0).toFixed(4))
        if (r.a < 1 - 1e-9) errs.push(nm + ': begins before the song ' + r.a)
        if (!r.loop && (r.off || 0) < -1e-6) errs.push(nm + ': a file played from before its beginning [' + r.a.toFixed(4) + ',' + r.b.toFixed(4) + '] off ' + r.off.toFixed(5))
        if (!r.loop && r.srcBars && (r.off || 0) + len > r.srcBars + 1e-6) errs.push(nm + ': a file played past its end [' + r.a.toFixed(4) + ',' + r.b.toFixed(4) + '] off ' + (r.off || 0).toFixed(5) + ' of ' + r.srcBars.toFixed(5))
      }
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const A = rs[i], B = rs[j], over = A.b - B.a
        if (over <= 1e-6) continue
        const x = xfadeOf(A, B)
        if (!x) errs.push(nm + ': overlap, no crossfade: [' + A.a.toFixed(4) + ',' + A.b.toFixed(4) + '] fo ' + (A.fo || 0).toFixed(4) + ' and [' + B.a.toFixed(4) + ',' + B.b.toFixed(4) + '] fi ' + (B.fi || 0).toFixed(4))
        else if (Math.abs((A.fo || 0) - (B.fi || 0)) > 1e-6 || Math.abs(over - (A.fo || 0)) > 1e-6) errs.push(nm + ': crossfade out of step: share ' + over.toFixed(4) + ' fo ' + (A.fo || 0).toFixed(4) + ' fi ' + (B.fi || 0).toFixed(4))
        else if (!(B.a - A.a > 1e-9) || !(B.b - A.b > 1e-9)) errs.push(nm + ': crossfade swallows a region: [' + A.a.toFixed(5) + ',' + A.b.toFixed(5) + '] and [' + B.a.toFixed(5) + ',' + B.b.toFixed(5) + ']')
      }
    })
    return errs
  }
  /* the hand: a press, some moves, a let-go on the lanes, as onDown / onMove / onUp would hand them on */
  globalThis.hEV = (o = {}) => Object.assign({ shiftKey: false, ctrlKey: false, altKey: false, metaKey: false }, o)
  globalThis.hPress = (p, o) => { drag = null; lanesDown(hEV(o), p); globalThis.__hand = drag ? drag.a : 'none' }
  globalThis.hMove = (p, o) => { if (drag) drag.live = true; if (drag && LANE_DRAGS.has(drag.a)) lanesMove(hEV(o), p) }      // (live: as onMove marks every drag at its first move, whatever it is)
  globalThis.hUp = () => { if (drag) { globalThis.__hand += drag.moved ? ', moved' : ', not moved'; lanesUp(); drag = null } }
  globalThis.hDrag = (p0, p1, steps = 6, o) => { hPress(p0, o); for (let i = 1; i <= steps; i++) hMove({ x: p0.x + (p1.x - p0.x) * i / steps, y: p0.y + (p1.y - p0.y) * i / steps }, o); hUp() }
  globalThis.hAt = (name, bar, fy = .5, dx = 0) => ({ x: bx(bar) + dx, y: rowY(trki(name)) + 1.5 + (S.rh - 3) * fy })
  globalThis.__commits = 0; { const c0 = commit; commit = function (b) { __commits++; return c0(b) } }
`, { filename: 'stand-in.js' })
module.exports = { run: (file, o) => { Object.assign(globalThis, o); return vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: path.basename(file) }) } }
if (require.main === module) {
  const [body, seed, steps, only] = process.argv.slice(2)
  Promise.resolve(module.exports.run(path.join(__dirname, (body || 'edits') + '.js'), { __seed: +(seed || 1), __steps: +(steps || 1500), __only: only || '' }))
    .then(found => { process.exitCode = found ? 1 : 0 }, e => { console.error('ERR', e); process.exitCode = 2 })
}
