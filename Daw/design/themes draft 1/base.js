/* Slur Studio, themes, draft 1 (2026-10-18): his ask — six built-in themes besides the room as it comes, each a different
   room (type, sizes, where everything stands, the transport, the meters), kept as .sst files. Each theme is drawn here
   whole, over the room's own page, from the song the room has open (low tide ep: its tracks, regions, sound, markers),
   so what is seen is the real song in another room. shots.mjs lays a theme over the page and takes its picture.
   This file: what every theme draws with. */
const TW = 1440, TH = 900
const TFONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@500;600&family=Permanent+Marker&family=Michroma&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Jost:wght@400;500;600;700;800&family=Poiret+One&family=Josefin+Sans:wght@300;400;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=VT323&display=block'
async function tdFonts () {
  if (!document.getElementById('td-fonts')) { const l = document.createElement('link'); l.id = 'td-fonts'; l.rel = 'stylesheet'; l.href = TFONTS; document.head.appendChild(l); await new Promise(r => { l.onload = r; l.onerror = r }) }
  const want = ['600 12px "Barlow Condensed"', '700 12px "Barlow Condensed"', '600 12px Barlow', '12px "Permanent Marker"', '12px Michroma', '12px "EB Garamond"', 'italic 12px "EB Garamond"', '600 12px "EB Garamond"', '500 12px Jost', '700 12px Jost', '800 12px Jost', '12px "Poiret One"', '400 12px "Josefin Sans"', '600 12px "Josefin Sans"', '400 12px "IBM Plex Mono"', '500 12px "IBM Plex Mono"', '12px VT323']
  await Promise.all(want.map(f => document.fonts.load(f).catch(() => null)))
}

/* ── drawing ── */
const nn = v => Math.round(v * 10) / 10
const tesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
/* a text: f font family, s size, w weight, c colour, a alpha, ls letter spacing, anchor, it italic, rot, x2 more attributes */
function tx (x, y, s, o = {}) {
  const { f = 'Barlow', z = 12, w = 400, c = '#000', a = 1, ls = 0, anchor = 'start', it = false, rot = 0, more = '' } = o
  return `<text x="${nn(x)}" y="${nn(y)}" font-family="${f}" font-size="${z}" font-weight="${w}"${it ? ' font-style="italic"' : ''} fill="${c}"${a < 1 ? ` fill-opacity="${a}"` : ''}${ls ? ` letter-spacing="${ls}"` : ''} text-anchor="${anchor}"${rot ? ` transform="rotate(${rot} ${nn(x)} ${nn(y)})"` : ''}${more}>${tesc(s)}</text>`
}
const rc = (x, y, w, h, o = {}) => `<rect x="${nn(x)}" y="${nn(y)}" width="${nn(Math.max(0, w))}" height="${nn(Math.max(0, h))}"${o.rx ? ` rx="${o.rx}"` : ''} fill="${o.fill || 'none'}"${o.fa != null ? ` fill-opacity="${o.fa}"` : ''}${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}${o.sa != null ? ` stroke-opacity="${o.sa}"` : ''}${o.more || ''}/>`
const ci = (x, y, r, o = {}) => `<circle cx="${nn(x)}" cy="${nn(y)}" r="${nn(r)}" fill="${o.fill || 'none'}"${o.fa != null ? ` fill-opacity="${o.fa}"` : ''}${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}${o.sa != null ? ` stroke-opacity="${o.sa}"` : ''}${o.more || ''}/>`
const pa = (d, o = {}) => `<path d="${d}" fill="${o.fill || 'none'}"${o.fa != null ? ` fill-opacity="${o.fa}"` : ''}${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}${o.sa != null ? ` stroke-opacity="${o.sa}"` : ''}${o.cap ? ` stroke-linecap="${o.cap}"` : ''}${o.join ? ` stroke-linejoin="${o.join}"` : ''}${o.more || ''}/>`
const gr = (inner, tr = '', more = '') => `<g${tr ? ` transform="${tr}"` : ''}${more}>${inner}</g>`
const ln = (x1, y1, x2, y2, c, w = 1, a = 1, more = '') => `<line x1="${nn(x1)}" y1="${nn(y1)}" x2="${nn(x2)}" y2="${nn(y2)}" stroke="${c}" stroke-width="${w}"${a < 1 ? ` stroke-opacity="${a}"` : ''}${more}/>`
/* a width of text, as drawn */
const tcv = document.createElement('canvas').getContext('2d')
function tw2 (s, f, z, w = 400, it = false) { tcv.font = `${it ? 'italic ' : ''}${w} ${z}px ${f}`; return tcv.measureText(String(s)).width }
/* a seeded random, so a picture comes out the same each time */
function rnd (seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 } }

/* ── the song ── */
function tdSong () {
  const tracks = S.tracks.filter(t => t.kind !== 'bus' && t.kind !== 'stack')
  for (const t of tracks) { if (t.theirs === 'jun') t.theirs = 'theo'; if (t.theirs === 'minseo') t.theirs = 'mina' }
  return { tracks, scenes: SCENES, end: SONG_END + 1, head: 19.04, tempo: S.tempo || 92, name: 'low tide ep', cycle: { a: 16, b: 24, on: true }, meter: '4/4' }
}
/* bars from b0 to b1 (counted from one) across x0 … x1 */
function tdMap (x0, x1, b0 = 1, b1 = SONG_END + 2) { X0 = x0; VX = b0 - 1; PXB = (x1 - x0) / (b1 - b0) }
/* whether a track sounds at a place (bars from zero), and how loud it is said to be there */
const tdAt = (t, pos) => t.regs.some(r => !r.mute && r.a - 1 <= pos && r.b - 1 > pos)
function tdLevel (t, pos) { if (!tdAt(t, pos) || t.mute) return -40; const base = (t.vol || 0) - 6; return Math.min(3, base + ((t.name.length * 7) % 5) - 1.5) }      // (a still picture: a believable reading)
/* the outline of a region's sound, between v0 and v1 (pixels of the region), as a list of peaks 0 … 1 */
function tdPeaks (r, w, v0, v1) {
  const len = r.b - r.a, steps = Math.max(1, v1 - v0), gk = dbLin(r.gain || 0)
  let pk, norm
  if (r.loop) { const lp = LOOPS[r.buf], o = r.off || 0; norm = lp.peak || (lp.peak = peakOf(lp.ch)); pk = loopPeaks(lp, o + len * v0 / w, o + len * v1 / w, steps) } else { pk = bufPeaks(r, steps, v0 / w, v1 / w); norm = r.peak || 1 }
  const out = new Float32Array(steps)
  for (let i = 0; i < steps; i++) out[i] = Math.min(1, pk[i] / norm * gk)
  return out
}
/* the regions of a track that are in sight between x0 and x1, each with where it stands */
function tdRegs (t, x0, x1) {
  const out = []
  for (const r of t.regs) {
    const xa = bx(r.a), xb = bx(r.b)
    if (xb < x0 || xa > x1 || xb - xa < 2) continue
    out.push({ r, xa, xb, w: xb - xa, v0: Math.max(0, Math.floor(x0 - xa)), v1: Math.min(Math.floor(xb - xa), Math.ceil(x1 - xa)) })
  }
  return out
}
/* a region's sound as a path in absolute units: mirror (filled both ways), half (standing on its foot), line (its top only),
   bars (a stroke every `step` pixels), dots */
function tdWave (g, yc, hmax, style = 'mirror', step = 1) {
  const { r, xa, w, v0, v1 } = g
  const pk = tdPeaks(r, w, v0, v1), quiet = .6 / Math.max(1, hmax)
  if (style === 'bars') { let d = ''; for (let i = 0; i < pk.length; i += step) { let m = 0; for (let k = i; k < Math.min(pk.length, i + step); k++) m = Math.max(m, pk[k]); const h = Math.max(.6, m * hmax); d += `M${nn(xa + v0 + i + step / 2)} ${nn(yc - h)}V${nn(yc + h)}` } return d }
  if (style === 'line') { let d = '', on = false; for (let i = 0; i < pk.length; i++) { const h = pk[i] * hmax; if (pk[i] < quiet) { on = false; continue } d += `${on ? 'L' : 'M'}${nn(xa + v0 + i)} ${nn(yc - h)}`; on = true } return d }
  let d = '', up = '', dn = '', run = 0
  const end = () => { if (run > 1) d += up + dn + 'Z'; up = ''; dn = ''; run = 0 }
  for (let i = 0; i < pk.length; i++) {
    const h = pk[i] * hmax
    if (pk[i] < quiet) { end(); continue }
    const x = xa + v0 + i + .5
    up += `${run ? 'L' : 'M'}${nn(x)} ${nn(yc - h)}`; dn = `L${nn(x)} ${nn(style === 'half' ? yc : yc + h)}` + dn; run++
  }
  end()
  return d
}
/* a region of notes, as strokes */
function tdNotes (g, y, h) { const { r, xa, v0, v1 } = g; const d = r.notes ? notesPath(r, y, h, v0, v1) : midiPath(r, y, h, v0, v1); return { d, tr: `translate(${nn(xa + v0)} 0)` } }
const tdIsNotes = (t, r) => !!(r.notes || t.midi)

/* ── the picture: one layer over the page ── */
function tdShow (svgInner, bg = '#000') {
  let el = document.getElementById('td-layer')
  if (!el) { el = document.createElement('div'); el.id = 'td-layer'; Object.assign(el.style, { position: 'fixed', left: 0, top: 0, width: TW + 'px', height: TH + 'px', zIndex: 9999, background: bg }); document.body.appendChild(el) }
  el.style.background = bg
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}" viewBox="0 0 ${TW} ${TH}">${svgInner}</svg>`
}
const THEMES = {}
