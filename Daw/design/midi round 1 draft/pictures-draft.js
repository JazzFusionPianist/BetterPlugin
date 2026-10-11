/* the instruments, draft 3 — pictures. A DRAFT (draft.mjs reads it into the page; the app does not).
   Every sound of the synth, every pad of the kit and the sampler itself is drawn as the instrument it is: seen from the
   front, flat, in the track's dark on the track's pigment, its details cut out of it in the pigment — the way a
   region carries its sound, and the way a print is cut. One hand for all of them: no outlines round things, no
   shading, no slant; a thing is a dark shape, and what is on it is cut out.
   Each is drawn in a box of 100 by 60 and set into whatever plate it is given. D: the dark, C: the pigment (the cut). */
const PIC = (() => {
  const f = v => +(+v).toFixed(2)
  const r = (x, y, w, h, c, rx = 0) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${rx}"` : ''} fill="${c}"/>`
  const o = (cx, cy, rad, c) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad)}" fill="${c}"/>`
  const ring = (cx, cy, rad, sw, c) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad)}" fill="none" stroke="${c}" stroke-width="${sw}"/>`
  const e = (cx, cy, rx, ry, c, rot) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}"${rot ? ` transform="rotate(${rot} ${f(cx)} ${f(cy)})"` : ''}/>`
  const l = (x1, y1, x2, y2, sw, c, cap = 'round') => `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="${cap}" fill="none"/>`
  const p = (d, c) => `<path d="${d}" fill="${c}"/>`
  const s = (d, sw, c, cap = 'round') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="${cap}" stroke-linejoin="round"/>`
  const g = (inner, tr) => `<g transform="${tr}">${inner}</g>`
  /* a run of keys: a strip in the pigment, the seams between the white keys and the black keys in the dark */
  const keys = (x, y, w, h, nWhite, D, C) => {
    let out = r(x, y, w, h, C)
    const kw = w / nWhite
    for (let i = 1; i < nWhite; i++) out += l(x + i * kw, y, x + i * kw, y + h, Math.min(.7, kw * .16), D, 'butt')
    for (let i = 0; i < nWhite - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) out += r(x + (i + 1) * kw - kw * .3, y, kw * .6, h * .58, D)
    return out
  }
  /* a stand on three feet, from the floor up to a height */
  const stand = (x, top, D, floor = 58, spread = 11) => l(x, top, x, floor - 7, 1.9, D, 'butt') + l(x, floor - 8, x - spread, floor, 1.9, D) + l(x, floor - 8, x + spread, floor, 1.9, D)
  /* a drum from the side: its shell, a hoop above and below, its lugs cut out */
  const shell = (x, y, w, h, D, C, lugs = 4) => { let out = r(x, y, w, h, D) + r(x - 2.5, y - 2.6, w + 5, 3.6, D, 1.2) + r(x - 2.5, y + h - 1, w + 5, 3.6, D, 1.2); for (let i = 0; i < lugs; i++) { const lx = x + w * (i + .5) / lugs; out += l(lx, y + 4.5, lx, y + h - 4.5, 1.1, C, 'butt') } return out }
  /* a hand, fingers up, its middle at 0 0: four fingers each with its own tip, the seams between them cut out, a thumb at the
     left, and a cuff below the wrist. handEdge: the same hand a little larger, in the pigment — laid under a hand that
     stands in front of another, so that the two stay two */
  const HAND = 'M-8.6 3V-17.6A2.15 2.15 0 0 1 -4.3 -17.6V-21.6A2.15 2.15 0 0 1 0 -21.6V-23.4A2.15 2.15 0 0 1 4.3 -23.4V-20.6A2.15 2.15 0 0 1 8.6 -20.6V4C8.6 9 6.6 12 6.6 14.5H-6.4C-6.4 11 -8.6 8 -8.6 3Z'
  const THUMB = 'M-8.4 -1C-10.6 -3.4 -13.4 -8.4 -14.6 -11.4A2.6 2.6 0 0 0 -19.2 -9.2C-17.6 -4 -14.4 2.6 -8.6 7.6Z'
  const hand = (D, C, seams = true) => p(HAND, D) + p(THUMB, D) + (seams ? l(-4.3, -16.4, -4.3, -4.6, .8, C, 'butt') + l(0, -19, 0, -4.6, .8, C, 'butt') + l(4.3, -19, 4.3, -4.6, .8, C, 'butt') : '') + r(-6.4, 15.8, 13, 8.6, D, 1.4)
  const handEdge = C => s(HAND, 3, C) + s(THUMB, 3, C) + r(-7.9, 14.3, 16, 11.6, C, 2)
  const P = {
    'e piano': (D, C) => p('M8 30V17C8 12 12 9 17 9H83C88 9 92 12 92 17V30Z', D) + l(13, 25.5, 87, 25.5, 1, C, 'butt') + r(8, 30, 84, 13, D) + keys(11, 31, 78, 9.5, 19, D, C) + l(15, 43, 10, 58, 2, D) + l(85, 43, 90, 58, 2, D) + l(17, 45, 83, 56, 1.3, D) + l(83, 45, 17, 56, 1.3, D) + r(45, 55.4, 10, 2.8, D, 1),
    'soft keys': (D, C) => r(24, 3, 52, 54, D, 1.5) + r(19, 29, 62, 8, D, 1) + keys(23, 30.2, 54, 5.6, 17, D, C) + s('M34 12H66V22H34Z', 1, C) + l(38, 15.5, 62, 15.5, .8, C, 'butt') + l(38, 18.5, 56, 18.5, .8, C, 'butt') + r(45.5, 51, 3.4, 2.2, C, .8) + r(51, 51, 3.4, 2.2, C, .8) + r(22, 57, 8, 2, D) + r(70, 57, 8, 2, D),
    organ: (D, C) => { let out = ''; const hs = [26, 33, 40, 46, 50, 46, 40, 33, 26]; hs.forEach((h, i) => { const x = 9.5 + i * 9.2; out += p(`M${x} 50V${50 - h + 4}L${x + 3.6} ${50 - h}L${x + 7.2} ${50 - h + 4}V50Z`, D) + p(`M${x + 1.6} 42.4H${x + 5.6}L${x + 3.6} 39.4Z`, C) + l(x + 1.6, 43.6, x + 5.6, 43.6, .8, C, 'butt') }); return out + r(6, 50, 88, 8, D, 1) + keys(32, 52.4, 36, 3.4, 11, D, C) },
    bell: (D, C) => p('M50 5C56.5 5 61 9.5 62 17C63.6 29 67 37 79 44.5L81.5 50.5H18.5L21 44.5C33 37 36.4 29 38 17C39 9.5 43.5 5 50 5Z', D) + l(26.5, 44, 73.5, 44, 1.1, C, 'butt') + l(39.5, 17.5, 60.5, 17.5, .9, C, 'butt') + o(50, 54.4, 3.6, D) + r(47.6, 1.4, 4.8, 4.4, D, 1),
    marimba: (D, C) => { let out = ''; for (let i = 0; i < 11; i++) { const x = 7 + i * 8, top = 5 + i * 1.25, bot = 35 - i * 1.25; out += r(x, top, 6, bot - top, D, .8) + l(x + 3, bot + 2.2, x + 3, 57 - i * 1.9, 2.6, D, 'butt') } return out + l(6, 11.5, 94, 20.5, .9, C, 'butt') + l(6, 28.5, 94, 19.5, .9, C, 'butt') },
    pluck: (D, C) => { let out = s('M71.5 9C57 1 40 8 27.5 23', 4.6, D) + l(72, 7, 72, 55, 4.2, D, 'butt') + p('M24 21.5L30.5 19L70 52.5V56H61Z', D) + r(56, 54, 22, 3.6, D, 1.4); for (let i = 0; i < 9; i++) { const x = 34 + i * 4, yn = 9 + (71.5 - x) ** 2 * .0072, ys = 24.5 + (x - 30) * .79; out += l(x, yn + 1.5, x, ys, .7, D, 'butt') } return out },
    'sub bass': (D, C) => r(23, 3, 54, 54, D, 3) + ring(50, 33, 18.5, 1.5, C) + ring(50, 33, 11.5, 1.1, C) + o(50, 33, 4.6, C) + r(38, 7, 24, 3.4, C, 1.7),
    'round bass': (D, C) => p('M40 27C37 25 35.5 21 37.5 17C38.5 14.5 41 12.5 44 11.5C38 7.5 28 8.5 21.5 12C12 16.5 5 22 5 30C5 38.5 12 45.5 21.5 49C28 51.5 35.5 50.5 40 47.5C37.5 44.5 36.5 40 38.2 36.2C39 34.6 40 33.6 40 33Z', D) + r(40, 27.2, 46, 5.6, D) + p('M86 27.2L96.5 23.8C98 25 98 27.6 96.4 29L97 34.6C96 36.4 93 36.6 91.4 35.2L86 32.8Z', D) + l(13, 28.8, 95, 28.8, .7, C, 'butt') + l(13, 31.2, 95, 31.2, .7, C, 'butt') + r(21, 25.6, 3, 8.8, C, .8) + r(29, 25.6, 3, 8.8, C, .8) + r(9.6, 26.6, 2.2, 6.8, C, .6) + o(15, 41.5, 1.5, C) + o(20.5, 43.6, 1.5, C),
    'saw bass': (D, C) => { let out = r(9, 13, 82, 36, D, 3); for (let i = 0; i < 6; i++) out += o(19 + i * 12.4, 21.5, 2.9, C) + l(19 + i * 12.4, 21.5, 19 + i * 12.4 + (i % 2 ? 1.6 : -1.6), 19.3, .9, D); for (let i = 0; i < 8; i++) out += r(15 + i * 9, 36, 6.6, 9, C, .8); for (const i of [0, 1, 3, 4, 5]) out += r(20.5 + i * 9, 28.6, 4.6, 5, C, .8); return out },
    'warm pad': (D, C) => { let out = r(5, 13, 90, 31, D, 2.5) + keys(10, 31, 80, 10, 24, D, C); for (let i = 0; i < 9; i++) { const x = 15 + i * 6.4; out += l(x, 17.5, x, 27.5, .8, C, 'butt') + r(x - 1.7, 18.5 + [5, 2, 6, 1, 4, 3, 6, 2, 5][i], 3.4, 2.2, C, .5) } return out + o(81, 22.5, 3, C) + o(71.5, 22.5, 3, C) },
    strings: (D, C) => p('M9 28C9 17 16.5 10.5 25.5 11.5C30.5 12 33 15.5 35 19C37 15.8 40 13.6 45.5 14C53 14.6 58 20.5 58 28C58 35.5 53 41.4 45.5 42C40 42.4 37 40.2 35 37C33 40.5 30.5 44 25.5 44.5C16.5 45.5 9 39 9 28Z', D) + r(57, 26, 28, 4, D) + o(88.5, 28, 3.6, D) + l(80, 24, 80, 32, 1.4, D) + l(84, 24, 84, 32, 1.4, D) + p('M11.5 28L20 25.6V30.4Z', C) + l(20, 28, 86, 28, .7, C, 'butt') + r(31.4, 23.6, 1.6, 8.8, C, .6) + s('M39.5 21.4C38 23 40 24.4 38.6 26', .9, C) + s('M39.5 34.6C38 33 40 31.6 38.6 30', .9, C) + l(8, 54, 93, 51, 1.3, D) + r(8, 52.6, 6, 3.2, D, .8),
    'glass pad': (D, C) => { let out = ''; [[22, .34], [50, .62], [78, .2]].forEach(([cx, fill]) => { const hw = y => 10 * Math.sqrt(Math.max(0, 1 - ((y - 7) / 25) ** 2)), yw = 7 + 25 * (1 - fill); let d = `M${f(cx - hw(yw))} ${f(yw)}`; for (let y = yw; y <= 32; y += 1.5) d += `L${f(cx - hw(y))} ${f(y)}`; d += `L${cx} 32`; for (let y = 32; y >= yw; y -= 1.5) d += `L${f(cx + hw(y))} ${f(y)}`; out += p(d + 'Z', D) + s(`M${cx - 10} 7C${cx - 10} 22 ${cx - 6} 32 ${cx} 32C${cx + 6} 32 ${cx + 10} 22 ${cx + 10} 7`, 1.5, D) + l(cx, 32, cx, 52, 1.6, D, 'butt') + l(cx - 7.5, 52.6, cx + 7.5, 52.6, 2, D) }); return out },
    'square lead': (D, C) => { let out = r(13, 6, 74, 28, D, 2) + r(9, 34, 82, 16, D, 2) + keys(19, 37, 68, 10, 17, D, C) + r(11.4, 38, 2.4, 8, C, 1.2) + r(14.8, 38, 2.4, 8, C, 1.2); for (let j = 0; j < 2; j++) for (let i = 0; i < 6; i++) out += o(22 + i * 11.2, 14 + j * 11.4, 2.9, C); return out },
    'saw lead': (D, C) => { let out = r(14, 4, 72, 52, D, 2.5); for (let i = 0; i < 5; i++) out += o(23 + i * 13.5, 13, 3.3, C); for (let j = 0; j < 3; j++) for (let i = 0; i < 8; i++) out += o(21 + i * 8.3, 27 + j * 9.6, 1.5, C); return out + s('M21 27C22 50 50 57 54.2 46.2', 1.2, C) + s('M37.6 27C42 48 75 51 79.1 36.6', 1.2, C) + s('M62.5 27C61 43 35 37 29.3 46.2', 1.2, C) },
    /* the kit's sixteen */
    kick: (D, C) => o(50, 29, 25, D) + ring(50, 29, 20.4, 1.3, C) + o(59.5, 37.5, 3.6, C) + l(31, 47, 22, 58, 2.4, D) + l(69, 47, 78, 58, 2.4, D),
    snare: (D, C) => shell(24, 16, 52, 19, D, C, 6) + stand(50, 38, D),
    rim: (D, C) => shell(24, 22, 52, 17, D, C, 6) + stand(50, 42, D, 58, 10) + l(12, 8.5, 76, 18.2, 2.6, D) + o(12, 8.5, 2.2, D),
    clap: (D, C) => P['clap b'](D, C),
    /* way a: two hands facing one another, fingers up, meeting — and the clap above them */
    'clap a': (D, C) => g(hand(D, C), 'translate(41.6 35) rotate(17)') + g(hand(D, C), 'translate(58.4 35) scale(-1 1) rotate(17)') + l(50, 2.5, 50, 8, 1.5, D) + l(40.5, 4.6, 43, 9.4, 1.5, D) + l(59.5, 4.6, 57, 9.4, 1.5, D),
    /* way b: two hands the same way up, one in front of the other, as they are seen from beside the one who claps */
    'clap b': (D, C) => g(hand(D, C, false), 'translate(57 30) rotate(-24)') + g(handEdge(C) + hand(D, C), 'translate(45.5 33.5) rotate(-24)') + l(27.5, 5, 31, 10.5, 1.5, D) + l(37, 2.2, 38.6, 8.2, 1.5, D) + l(20.6, 11.6, 25.6, 14.6, 1.5, D),
    'low tom': (D, C) => shell(30, 12, 40, 30, D, C, 4) + l(32, 30, 25, 58, 2, D) + l(68, 30, 75, 58, 2, D) + l(50, 44, 50, 58, 2, D, 'butt'),
    'mid tom': (D, C) => shell(22, 13, 46, 22, D, C, 5) + s('M68 24H83V52', 2, D) + l(74, 58, 83, 51, 1.9, D) + l(92, 58, 83, 51, 1.9, D),
    'high tom': (D, C) => shell(27, 16, 36, 17, D, C, 4) + s('M63 24.5H80V52', 2, D) + l(71, 58, 80, 51, 1.9, D) + l(89, 58, 80, 51, 1.9, D),
    hat: (D, C) => l(50, 9, 50, 51, 1.9, D, 'butt') + r(48, 12.6, 4, 4.4, D, 1) + p('M22 22.4C32 18.4 68 18.4 78 22.4C68 23.6 32 23.6 22 22.4Z', D) + p('M22 23.6C32 27.6 68 27.6 78 23.6C68 22.8 32 22.8 22 23.6Z', D) + l(50, 50, 38, 58, 1.9, D) + l(50, 50, 62, 58, 1.9, D) + p('M57 58L72 52.6V55.6L63 58Z', D),
    'open hat': (D, C) => l(50, 5, 50, 51, 1.9, D, 'butt') + r(48, 8, 4, 4.4, D, 1) + g(p('M22 17C32 13 68 13 78 17C68 18.2 32 18.2 22 17Z', D), 'rotate(-4 50 17)') + p('M22 27.6C32 31.6 68 31.6 78 27.6C68 26.8 32 26.8 22 27.6Z', D) + l(50, 50, 38, 58, 1.9, D) + l(50, 50, 62, 58, 1.9, D) + p('M57 58L72 51V54L63 58Z', D),
    crash: (D, C) => stand(36, 27, D) + l(36, 28, 60, 14, 1.9, D) + g(p('M-30 0C-18 -4.6 18 -4.6 30 0C18 1.6 -18 1.6 -30 0Z', D) + e(0, -3.2, 5, 2.4, D), 'translate(60 13) rotate(-15)'),
    ride: (D, C) => stand(47, 19, D) + p('M12 18C26 12.6 68 12.6 82 18C68 19.8 26 19.8 12 18Z', D) + e(47, 13.4, 6.6, 3, D) + l(92, 3, 73, 13.6, 1.5, D) + o(73, 13.6, 1.5, D),
    tambourine: (D, C) => { let out = ring(50, 30, 21.5, 6, D); for (let k = 0; k < 6; k++) { const a = k * 60 + 30; out += g(r(-4.4, -1.5, 8.8, 3, C, 1.5) + l(-1.4, 0, 1.4, 0, 1, D), `translate(${f(50 + 21.5 * Math.cos(a * Math.PI / 180))} ${f(30 + 21.5 * Math.sin(a * Math.PI / 180))}) rotate(${a + 90})`) } return out },
    cowbell: (D, C) => p('M37.5 14H62.5C64 14 65 14.8 65.4 16.2L75 47.5C75.6 49.6 74.4 51 72.4 51H27.6C25.6 51 24.4 49.6 25 47.5L34.6 16.2C35 14.8 36 14 37.5 14Z', D) + l(29, 45.6, 71, 45.6, 1.1, C, 'butt') + r(45, 7.6, 10, 6.6, D, 1.2) + l(50, 2.5, 50, 8, 1.9, D, 'butt'),
    conga: (D, C) => p('M34.5 9H65.5C71.5 21 71.5 39 62.5 57H37.5C28.5 39 28.5 21 34.5 9Z', D) + r(31.5, 5, 37, 5, D, 1.6) + l(31.8, 21.6, 68.2, 21.6, 1, C, 'butt') + l(33.6, 44, 66.4, 44, 1, C, 'butt') + l(39.5, 11.5, 39.5, 17.5, 1, C, 'butt') + l(50, 11.5, 50, 17.5, 1, C, 'butt') + l(60.5, 11.5, 60.5, 17.5, 1, C, 'butt'),
    shaker: (D, C) => { const one = e(0, -30, 9.5, 12.5, D) + l(0, -19, 0, 0, 2.6, D) + l(-9.3, -30, 9.3, -30, .9, C, 'butt'); return g(one, 'translate(42 56) rotate(-27)') + g(one, 'translate(58 56) rotate(27)') },
    clave: (D, C) => g(r(-29, -3.2, 58, 6.4, D, 3.2), 'translate(48 34) rotate(17)') + g(r(-30.4, -4.6, 60.8, 9.2, C, 4.6) + r(-29, -3.2, 58, 6.4, D, 3.2), 'translate(52 26) rotate(-21)'),
    /* the sampler; and the kit as one thing */
    sampler: (D, C) => { let out = r(13, 5, 74, 50, D, 3) + r(19, 10.5, 29, 13, C, 1) + o(26.5, 36.5, 4.6, C) + l(26.5, 36.5, 28.6, 33.4, 1, D); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) out += r(53.5 + i * 7.3, 10.5 + j * 7.3, 5.6, 5.6, C, .8); for (let i = 0; i < 3; i++) out += r(36.4 + i * 4.4, 33.4, 2.8, 2.8, C, .6); return out + l(19, 46.4, 48, 46.4, 1, C, 'butt') + r(29.4, 44.6, 4.4, 3.6, C, .8) + r(53.5, 42.4, 27.5, 6, C, 1) },
    kit: (D, C) => o(50, 41, 16, D) + ring(50, 41, 12.6, 1.1, C) + l(38, 52.4, 33, 58.4, 1.8, D) + l(62, 52.4, 67, 58.4, 1.8, D)
      + r(31, 12.5, 15, 9, D) + r(29.6, 10.6, 17.8, 2.6, D, 1) + r(29.6, 20.2, 17.8, 2.6, D, 1) + r(54, 12.5, 15, 9, D) + r(52.6, 10.6, 17.8, 2.6, D, 1) + r(52.6, 20.2, 17.8, 2.6, D, 1) + l(50, 22, 50, 26, 1.8, D, 'butt') + l(42, 22.6, 58, 22.6, 1.6, D, 'butt')
      + r(71, 33, 17, 15, D) + r(69.6, 31, 19.8, 2.6, D, 1) + r(69.6, 46.4, 19.8, 2.6, D, 1) + l(73, 48, 71, 58.4, 1.6, D) + l(86, 48, 88, 58.4, 1.6, D)
      + r(13, 34, 16, 6.6, D) + r(11.6, 32.2, 18.8, 2.4, D, 1) + r(11.6, 39.6, 18.8, 2.4, D, 1) + l(21, 42, 21, 52, 1.6, D, 'butt') + l(21, 51, 15.5, 58.4, 1.6, D) + l(21, 51, 26.5, 58.4, 1.6, D)
      + l(7, 22, 7, 58.4, 1.5, D, 'butt') + p('M-2 23C2 20.6 12 20.6 16 23C12 23.8 2 23.8 -2 23Z', D) + p('M-2 24.4C2 26.8 12 26.8 16 24.4C12 23.8 2 23.8 -2 24.4Z', D)
      + l(25, 30, 25, 9, 1.4, D, 'butt') + g(p('M-13 0C-8 -2.6 8 -2.6 13 0C8 1 -8 1 -13 0Z', D), 'translate(25 8) rotate(-13)') + l(93, 58.4, 93, 12, 1.4, D, 'butt') + g(p('M-14 0C-9 -2.8 9 -2.8 14 0C9 1 -9 1 -14 0Z', D), 'translate(88 11) rotate(9)'),
  }
  /* a picture set into a box, as large as it goes, in the middle */
  const pic = (name, x, y, w, h, D, C, pad = 0) => { const draw = P[name]; if (!draw) return ''; const k = Math.min((w - 2 * pad) / 100, (h - 2 * pad) / 60); return `<g transform="translate(${f(x + (w - 100 * k) / 2)} ${f(y + (h - 60 * k) / 2)}) scale(${f(k)})">${draw(D, C)}</g>` }
  return { pic, names: Object.keys(P) }
})()
/* what each sound, each pad and each instrument is drawn as */
const picOfInst = I => I.kind === 'drums' ? 'kit' : I.kind === 'sampler' ? 'sampler' : I.sound
/* every picture on one sheet, large, each on a plate of the pigment a track of its kind would have (the words are the draft's) */
function picSheet () {
  const fam = nm => /bass/.test(nm) ? 'bass' : SYNTH_SOUNDS[nm] ? 'keys' : nm === 'sampler' ? 'vox' : 'drums'
  const all = Object.keys(SYNTH_SOUNDS).concat(DRUM_PADS.map(q => q[0]), ['kit', 'sampler']), cols = 8, pw = 158, ph = 95, gx = 14, gy = 30, x0 = 40, y0 = 78
  let s = R(0, 0, W, H, { fill: K1 }) + T(40, 44, 'the instruments, as pictures', { size: 12, w: 500 }) + T(40, 62, 'each sound of the synth, each pad of the kit, the kit and the sampler: drawn as the thing it is, in the track\u2019s dark on the track\u2019s pigment', { size: 9.5, a: .46 })
  all.forEach((nm, i) => {
    const sw = swatch(fam(nm), fam(nm) === 'keys' ? (i % 7) / 8 + .1 : fam(nm) === 'drums' ? ((i - 14) % 8) / 9 + .2 : .4), x = x0 + (i % cols) * (pw + gx), y = y0 + Math.floor(i / cols) * (ph + gy)
    s += P(shapePath(x, y, pw, ph, SHAPES.notes), { fill: sw.c }) + PIC.pic(nm, x, y, pw, ph, sw.deep, sw.c, 9) + T(x + 1, y + ph + 13, nm, { size: 9.5, a: .7 })
  })
  return s
}
function clapSheet () {
  const sw = swatch('drums', .45)
  let s = R(0, 0, W, H, { fill: K1 }) + T(40, 44, 'clap', { size: 12, w: 500 }) + T(40, 62, 'two ways, each large, as a pad and small', { size: 9.5, a: .46 })
  ;['clap a', 'clap b'].forEach((nm, i) => {
    const x = 40 + i * 700
    s += T(x, 100, i ? 'way b: one hand in front of the other' : 'way a: two hands facing', { size: 9.5, a: .46 })
    s += P(shapePath(x, 112, 560, 336, SHAPES.notes), { fill: sw.c }) + PIC.pic(nm, x, 112, 560, 336, sw.deep, sw.c, 20)
    s += P(shapePath(x, 470, 92, 50, SHAPES.notes), { fill: sw.c }) + PIC.pic(nm, x, 470, 92, 50, sw.deep, sw.c, 5)
    s += P(shapePath(x + 110, 470, 92, 50, SHAPES.notes), { fill: sw.sel }) + P(shapePath(x + 110.5, 470.5, 91, 49, SHAPES.notes), { stroke: INK }) + PIC.pic(nm, x + 110, 470, 92, 50, sw.deep, sw.sel, 5)
    s += R(x + 222, 470, 64, 64, { rx: 2, fill: sw.c }) + PIC.pic(nm, x + 222, 470, 64, 64, sw.deep, sw.c, 3)
  })
  return s
}
