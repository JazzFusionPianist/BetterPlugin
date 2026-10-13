/* ── Patch on Slur's prints, as Patch on Slur draws them ──
   MADE BY tools/prints-from-patch.mjs from the plug-in's own drawing module (printGlyphs.ts): not to be edited here, and not
   to be redrawn. PATCH_PRINTS.printInner(node, family, tint) gives the SVG of a print in a box from -1 to 1. */
var PATCH_PRINTS = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../../../../private/var/folders/ny/hgzrfsdx7yx60m06brwr75x80000gn/T/slurprints-HmgdrX/react.cjs
  var require_react = __commonJS({
    "../../../../private/var/folders/ny/hgzrfsdx7yx60m06brwr75x80000gn/T/slurprints-HmgdrX/react.cjs"(exports, module) {
      var f = () => ({});
      var id = (x) => x;
      module.exports = new Proxy({}, { get: (_, k) => k === "__esModule" ? false : k === "memo" || k === "forwardRef" ? id : f });
    }
  });

  // ../../../../private/var/folders/ny/hgzrfsdx7yx60m06brwr75x80000gn/T/slurprints-HmgdrX/entry.ts
  var entry_exports = {};
  __export(entry_exports, {
    PLATE_TINT: () => PLATE_TINT,
    REACH: () => REACH,
    SHAPE: () => SHAPE,
    printInner: () => printInner
  });

  // apps/plugin/src/lib/juceBridge.ts
  var hasJuceBridge = typeof window !== "undefined" && !!window.__JUCE__?.backend;

  // apps/plugin/src/lib/fxBridge.ts
  var FX_MIX_TYPE = 11;
  var FX_SPLIT_LR = 28;
  var FX_SPLIT_MS = 29;
  var FX_LFO = 30;
  var FX_RATE = 31;
  var FX_MACRO = 32;
  var FX_SIDE = 33;
  var FX_FOLLOW = 34;
  var FX_COMP = 35;
  var FX_BANDS = 36;
  var FX_CARVE = 37;
  var FX_MATCH = 38;
  var FX_VOCODE = 39;
  var FX_FREEZE = 40;
  var FX_SHIFT = 41;
  var FX_SMEAR = 42;
  var FX_PAN = 43;
  var FX_REPEAT = 44;
  var FX_ENV = 45;
  var FX_FOLD = 46;
  var FX_DRIFT = 47;
  var FX_PULSE = 48;
  var FX_SCENE = 49;
  var FX_SIEVE = 50;
  var SCENE_HANDS = ["amount", "variant", "decay", "fb", "div", "wet", "aux0", "aux1", "aux2", "aux3", "aux4", "aux5", "aux6", "aux7"];
  var SCENE_STRIDE = SCENE_HANDS.length + 1;

  // apps/plugin/src/components/collab/LfoEditor.tsx
  var import_react2 = __toESM(require_react(), 1);

  // apps/plugin/src/lib/liveHands.ts
  var import_react = __toESM(require_react(), 1);
  var LIVE_HANDS = 12;
  var live = new Float32Array(16 * LIVE_HANDS);
  var lfoPhase = new Float32Array(16);
  var lfoCycle = new Float64Array(16);
  var SPEC_BANDS = 40;
  var spectra = /* @__PURE__ */ new Map();
  var lfoAt = 0;
  var have = false;
  var subs = /* @__PURE__ */ new Set();
  var notify = () => {
    for (const s of subs) s();
  };
  if (typeof window !== "undefined" && hasJuceBridge) {
    window.addEventListener("__juceDawAudio", (e) => {
      const d = e.detail;
      if (Array.isArray(d.lph)) for (let i = 0; i < 16; i++) {
        lfoPhase[i] = Number(d.lph[i]) || 0;
        lfoCycle[i] = Number(d.lcy?.[i]) || 0;
      }
      if (Array.isArray(d.spec)) {
        spectra.clear();
        for (const row of d.spec) if (Array.isArray(row) && row.length === 1 + SPEC_BANDS * 3) spectra.set(Number(row[0]), row.slice(1).map(Number));
      }
      lfoAt = performance.now();
      if (!Array.isArray(d.live)) return;
      let changed = !have;
      for (let i = 0; i < 16 && i < d.live.length; i++) {
        const h = d.live[i];
        if (!Array.isArray(h)) continue;
        for (let k = 0; k < LIVE_HANDS && k < h.length; k++) {
          const v = Number(h[k]);
          if (!Number.isFinite(v)) continue;
          if (live[i * LIVE_HANDS + k] !== v) {
            live[i * LIVE_HANDS + k] = v;
            changed = true;
          }
        }
      }
      have = true;
      if (changed) notify();
    });
  }

  // apps/plugin/src/components/collab/LfoEditor.tsx
  var import_jsx_runtime = __toESM(require_react(), 1);
  var B = 0.2071;
  var LFO_SHAPES = [
    { name: "sine", pts: [0, 0.5, B, 0.25, 1, B, 0.5, 0.5, -B, 0.75, 0, -B, 1, 0.5, 0] },
    { name: "triangle", pts: [0, 0.5, 0, 0.25, 1, 0, 0.75, 0, 0, 1, 0.5, 0] },
    { name: "saw up", pts: [0, 0, 0, 1, 1, 0] },
    { name: "saw down", pts: [0, 1, 0, 1, 0, 0] },
    { name: "square", pts: [0, 1, 0, 0.5, 1, 0, 0.5, 0, 0, 1, 0, 0] },
    { name: "pulse", pts: [0, 1, 0, 0.25, 1, 0, 0.25, 0, 0, 1, 0, 0] },
    { name: "stairs", pts: [0, 0, 0, 0.25, 0, 0, 0.25, 1 / 3, 0, 0.5, 1 / 3, 0, 0.5, 2 / 3, 0, 0.75, 2 / 3, 0, 0.75, 1, 0, 1, 1, 0] },
    { name: "steps", pts: null },
    // a step sequencer: as many steps as you like, each at the height you drag it to (aux 6 = how many)
    { name: "random", pts: null }
  ];
  var LFO_RANDOM = LFO_SHAPES.length - 1;
  var LFO_STEPS = LFO_SHAPES.length - 2;
  var SINE_PTS = LFO_SHAPES[0].pts;
  function shapeAt(pts, x) {
    const n = pts.length / 3;
    if (n === 0) return 0.5;
    if (n === 1) return pts[1];
    for (let i = 0; i < n - 1; i++) {
      const x0 = pts[i * 3], y0 = pts[i * 3 + 1], b = pts[i * 3 + 2], x1 = pts[(i + 1) * 3], y1 = pts[(i + 1) * 3 + 1];
      if (x < x0) return y0;
      if (x < x1 || i === n - 2) {
        const t = x1 > x0 ? Math.min(1, Math.max(0, (x - x0) / (x1 - x0))) : 1;
        return Math.min(1, Math.max(0, y0 + (y1 - y0) * t + b * 0.5 * 4 * t * (1 - t)));
      }
    }
    return pts[(n - 1) * 3 + 1];
  }
  function randomStep(slot, cycle, steps, k) {
    const step = cycle * steps + k;
    let h = (Math.imul(step | 0, 2654435761 | 0) ^ slot * 40503 + 12345 >>> 0) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519 | 0) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 3266489917 | 0) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0 & 16777215) / 16777215;
  }

  // apps/plugin/src/components/collab/printGlyphs.ts
  var PAPER = "#FBFAF7";
  var SHAPE = {
    tone: "M -1 -1 H 1 V 1 H -1 Z",
    grit: "M -1 -1 H .38 L 1 -.38 V 1 H -.38 L -1 .38 Z",
    space: "M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z",
    motion: "M -.6 -1 H 1.25 L .6 1 H -1.25 Z",
    pitch: "M 0 -1.2 L 1.2 0 L 0 1.2 L -1.2 0 Z",
    utility: "M -1 -.12 H 1 V .12 H -1 Z M -.12 -1 H .12 V 1 H -.12 Z",
    control: "M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z M -.5 0 A .5 .5 0 1 1 .5 0 A .5 .5 0 1 1 -.5 0 Z",
    spectral: "M -1 -1 H -.66 V 1 H -1 Z M -.4 -.5 H -.06 V 1 H -.4 Z M .2 -1 H .54 V 1 H .2 Z M .8 -.2 H 1.14 V 1 H .8 Z"
  };
  var REACH = { tone: 1, grit: 1, space: 1, motion: 1.25, pitch: 1.2, utility: 0.74, control: 1, spectral: 1 };
  var UTIL_SCALE = 0.7;
  var SPEC_SCALE = 0.85;
  var LINE = 0.6;
  var PLATE_TINT = {
    7: "#E9C46A",
    8: "#C95C3A",
    0: "#F0B450",
    1: "#D27A45",
    4: "#6FB07A",
    [FX_COMP]: "#3FB872",
    24: "#B8B4AA",
    20: "#9C7A5C",
    14: "#B38F62",
    25: "#D9A441",
    [FX_FOLD]: "#E06A48",
    10: "#4AA3A0",
    2: "#5C80FF",
    21: "#8FA8FF",
    9: "#6C9AC8",
    3: "#7FB3C8",
    6: "#A7B04A",
    12: "#C2547A",
    22: "#B48ACF",
    23: "#C97B5C",
    26: "#8C9E6C",
    27: "#C8A05C",
    [FX_REPEAT]: "#E0A050",
    16: "#5C80FF",
    17: "#F27BA6",
    15: "#B79CFF",
    13: "#3FB872",
    18: "#E9C46A",
    5: "#FBFAF7",
    [FX_MIX_TYPE]: "#ECE2C8",
    [FX_SPLIT_LR]: "#FBFAF7",
    [FX_SPLIT_MS]: "#FBFAF7",
    [FX_PAN]: "#E6E2F0",
    [FX_BANDS]: "#ECD654",
    [FX_SIDE]: "#5CE0A8",
    [FX_LFO]: "#B79CFF",
    [FX_RATE]: "#FFA848",
    [FX_MACRO]: "#F27B5A",
    [FX_FOLLOW]: "#FFD660",
    [FX_ENV]: "#FFAC78",
    [FX_DRIFT]: "#AAC8FF",
    [FX_PULSE]: "#FF8C8C",
    [FX_SCENE]: "#F6E296",
    [FX_CARVE]: "#E0607E",
    [FX_MATCH]: "#78D8FF",
    [FX_VOCODE]: "#A58BF0",
    [FX_FREEZE]: "#96E8FF",
    [FX_SHIFT]: "#FF96D2",
    [FX_SMEAR]: "#BAC4FF",
    [FX_SIEVE]: "#FFD078",
    19: "#D9A0C8"
    // voice
  };
  var f3 = (v) => (Math.round(v * 1e3) / 1e3).toString();
  var poly = (pts, close = false) => pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${f3(x)} ${f3(y)}`).join(" ") + (close ? " Z" : "");
  var wave = (x0, x1, y, amp, cycles, phase = 0, env, n = 64) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = amp * (env ? env(t) : 1);
      pts.push([x0 + (x1 - x0) * t, y + a * Math.sin(phase + t * cycles * 2 * Math.PI)]);
    }
    return poly(pts);
  };
  var P = (d, w = 0.09, op = 0.95, dash, cap = "round") => `<path d="${d}" fill="none" stroke="${PAPER}" stroke-opacity="${op}" stroke-width="${f3(w * LINE)}" stroke-linecap="${cap}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  var F = (d, op = 0.95) => `<path d="${d}" fill="${PAPER}" fill-opacity="${op}"/>`;
  var C = (cx, cy, r, fill = true, op = 0.95, w = 0.09) => fill ? `<circle cx="${f3(cx)}" cy="${f3(cy)}" r="${f3(r)}" fill="${PAPER}" fill-opacity="${op}"/>` : `<circle cx="${f3(cx)}" cy="${f3(cy)}" r="${f3(r)}" fill="none" stroke="${PAPER}" stroke-opacity="${op}" stroke-width="${f3(w * LINE)}"/>`;
  var R = (x, y, w, h, op = 0.95, fill = PAPER) => `<rect x="${f3(x)}" y="${f3(y)}" width="${f3(w)}" height="${f3(h)}" fill="${fill}" fill-opacity="${op}"/>`;
  var T = (x, y, s, size = 0.5, weight = 500, op = 0.95) => `<text x="${f3(x)}" y="${f3(y)}" text-anchor="middle" font-family="'Space Mono', ui-monospace, monospace" font-weight="${weight}" font-size="${size}" fill="${PAPER}" fill-opacity="${op}">${s}</text>`;
  var pictures = {
    0: () => [-0.6, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.6].map((y) => P(`M -.62 ${y} H .62`, 0.07)).join(""),
    // tone
    7: (n) => {
      const sl = Math.max(1, Math.min(4, n.aux[0] || 2)), xe = Math.min(0.7, 0.78 - (sl - 1) * 0.15);
      const c1 = 0.05 + (xe - 0.05) * 0.6, c2 = 0.05 + (xe - 0.05) * 0.4;
      return n.variant === 0 ? P(`M -.7 .75 H ${f3(-xe)} C ${f3(-c2)} .75 ${f3(-c1)} -.1 -.05 -.1 H .7`, 0.1) : P(`M -.7 -.1 H .05 C ${f3(c1)} -.1 ${f3(c2)} .75 ${f3(xe)} .75 H .7`, 0.1);
    },
    8: () => P(poly([[-0.7, 0.45], [-0.45, 0.45], [-0.35, -0.45], [-0.05, -0.45], [0.05, 0.45], [0.35, 0.45], [0.45, -0.45], [0.7, -0.45]]), 0.1),
    // amp
    1: () => C(-0.35, -0.05, 0.3, false) + C(0.35, -0.05, 0.3, false) + C(-0.35, -0.05, 0.07) + C(0.35, -0.05, 0.07) + P("M -.62 .45 Q 0 .62 .62 .45", 0.08),
    // tape
    4: () => P(wave(-0.7, 0.7, 0, 0.55, 2, 0, (t) => 1 - 0.55 * t)) + P("M .2 -.3 H .72 M .2 .3 H .72", 0.06, 0.55),
    // glue
    [FX_COMP]: () => P("M -.65 .65 L .0 .0 C .15 -.15 .35 -.22 .68 -.28", 0.1) + P("M -.65 .65 L .68 -.68", 0.05, 0.35, ".08 .1"),
    24: () => P(wave(-0.7, 0.7, 0.15, 0.18, 1.2), 0.08) + [-0.5, -0.25, 0, 0.25, 0.5].map((x) => P(`M ${x} -.35 V -.6`, 0.06) + C(x, -0.7, 0.04)).join(""),
    // air
    20: () => {
      const pts = [];
      for (let i = 0; i < 17; i++) {
        const t = i / 16;
        const v = Math.round(Math.sin(t * 2 * Math.PI) * 3) / 3 * 0.5;
        pts.push([-0.7 + 1.4 * t, v]);
        pts.push([-0.7 + 1.4 * (i + 1) / 16, v]);
      }
      pts.pop();
      return P(poly(pts), 0.09, 0.95, void 0, "butt");
    },
    14: () => P("M -.7 .5 H -.3 C -.15 .5 -.1 -.55 0 -.55 C .1 -.55 .15 .5 .3 .5 H .7", 0.1) + P("M -.7 .5 H .7", 0.05, 0.4, ".06 .08"),
    // radio
    25: () => P(wave(-0.7, 0.7, 0, 0.55, 5, 0, (t) => Math.sin(t * Math.PI * 2)), 0.08) + P(wave(-0.7, 0.7, 0, 0.55, 1), 0.05, 0.4, ".06 .08"),
    // ring
    [FX_FOLD]: () => {
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const t = i / 64;
        const s = Math.sin(t * 2 * Math.PI) * 2.2;
        const tt = s * 0.5 + 0.25;
        const f = tt - Math.floor(tt);
        const y = f < 0.5 ? f * 4 - 1 : 3 - f * 4;
        pts.push([-0.7 + 1.4 * t, -y * 0.5]);
      }
      return P(poly(pts)) + P("M -.7 -.5 H .7 M -.7 .5 H .7", 0.04, 0.35, ".06 .08");
    },
    10: () => Array.from({ length: 7 }, (_, i) => R(-0.55 + i * 0.17, -0.35 + i * 0.045, 0.07, 0.7 - i * 0.09, 1 - i * 0.12)).join(""),
    // delay
    2: () => [0, 1, 2, 3].map((i) => C(0, 0, 0.12 + i * 0.16, false, 1 - i * 0.18, 0.07)).join("") + C(0, 0, 0.06),
    // space
    21: () => [0, 1, 2].map((i) => C(0, 0.1, 0.12 + i * 0.16, false, 1 - i * 0.2, 0.06)).join("") + [-0.3, 0.3].map((x) => P(`M ${x} -.15 V -.6 M ${x - 0.1} -.5 L ${x} -.62 L ${x + 0.1} -.5`, 0.06)).join(""),
    // shimmer
    9: () => P(wave(-0.7, 0.7, -0.08, 0.28, 2), 0.08) + P(wave(-0.7, 0.7, 0.12, 0.28, 2, 0.9), 0.08, 0.55),
    // doubler
    3: () => C(0, 0, 0.09) + P("M -.15 0 H -.7 M -.55 -.15 L -.7 0 L -.55 .15 M .15 0 H .7 M .55 -.15 L .7 0 L .55 .15", 0.08),
    // stereo
    6: () => [0, 1, 2, 3, 4, 5].map((i) => P(wave(-0.65, 0.65, -0.45 + i * 0.18, 0.05, 3, i), 0.06)).join(""),
    // mod
    12: () => P(wave(-0.7, 0.7, 0, 0.5, 7, 0, (t) => Math.abs(Math.sin(t * Math.PI * 2))), 0.07),
    // tremolo
    22: () => P("M -.7 .55 C -.2 .55 .1 .3 .35 -.35 C .45 -.55 .55 -.6 .7 -.6", 0.1) + P("M -.7 .55 H .7", 0.04, 0.35),
    // swell
    23: () => {
      let s = "";
      for (let g = 0; g < 3; g++) for (let k = 0; k < 3; k++) s += R(-0.68 + g * 0.48 + k * 0.1, -0.4 + k * 0.1, 0.06, 0.8 - k * 0.2, 1 - g * 0.28);
      return s;
    },
    // stutter
    26: () => P("M -.7 .35 H -.3", 0.08) + P(wave(-0.3, 0.3, 0, 0.45, 2.5), 0.08) + P("M .3 .35 H .7", 0.08) + P("M -.3 -.55 V .55 M .3 -.55 V .55", 0.05, 0.45, ".06 .06"),
    // gate
    27: () => P(wave(-0.7, 0.7, 0, 0.22, 0.9, 0.6), 0.1),
    // wow
    [FX_REPEAT]: () => {
      const tops = [0, 0.25, 0.12, 0.35], ops = [1, 0.65, 0.45];
      let s = "";
      for (let g = 0; g < 3; g++) for (let k = 0; k < 4; k++) s += R(-0.66 + g * 0.46 + k * 0.085, -0.45 + tops[k], 0.05, 0.9 - tops[k] * 2, ops[g]);
      return s + P("M -.68 -.62 V .62", 0.04, 0.5, ".05 .06");
    },
    16: () => {
      const pts = [];
      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        pts.push([-0.7 + 1.4 * t, 0.35 * Math.sin(2 * Math.PI * (1.2 * t + 2.2 * t * t)) * (1 - 0.3 * t)]);
      }
      return P(poly(pts), 0.08);
    },
    // pitch
    17: () => P("M -.7 .5 C -.55 .5 -.5 -.45 -.32 -.45 C -.14 -.45 -.1 .25 0 .25 C .1 .25 .12 -.2 .28 -.2 C .44 -.2 .5 .5 .7 .5"),
    // formant
    15: () => P(wave(-0.7, 0.7, 0.22, 0.22, 2), 0.08) + P(wave(-0.7, 0.7, -0.25, 0.22, 3, 0.5), 0.08, 0.6),
    // harmony
    13: () => [0, 1, 2, 3, 4].map((i) => C(-0.6 + i * 0.3, 0.45 - i * 0.22, 0.07)).join("") + P("M -.6 .45 L .6 -.43", 0.04, 0.35, ".05 .07"),
    // arp
    18: () => [[-0.6, -0.4, 0.9], [-0.35, 0.1, 0.7], [-0.1, -0.55, 0.8], [0.15, 0.3, 0.6], [0.4, -0.2, 0.9], [-0.5, 0.45, 0.5], [0.5, 0.5, 0.7], [0.05, -0.1, 0.5], [-0.25, -0.15, 0.6], [0.3, 0.05, 0.8], [0.55, -0.5, 0.5]].map(([x, y, op]) => P(`M ${x} ${y} h .12`, 0.07, op)).join(""),
    // grain
    19: () => P("M -.7 .5 C -.55 .5 -.5 -.45 -.32 -.45 C -.14 -.45 -.1 .25 0 .25 C .1 .25 .12 -.2 .28 -.2 C .44 -.2 .5 .5 .7 .5", 0.09, 0.6) + P(wave(-0.7, 0.7, 0.1, 0.12, 4), 0.06),
    // voice (legacy)
    // control (inside the ring)
    [FX_LFO]: (n) => {
      const random = n.aux[4] || 0;
      if (random > 0) {
        let d = "";
        for (let k = 0; k < random; k++) {
          const y = 0.35 - randomStep(0, 0, random, k) * 0.7;
          d += `${k === 0 ? "M" : "L"} ${f3(-0.72 + k / random * 1.44)} ${f3(y)} L ${f3(-0.72 + (k + 1) / random * 1.44)} ${f3(y)} `;
        }
        return P(d, 0.09);
      }
      const p = n.pts && n.pts.length >= 6 ? n.pts : SINE_PTS;
      const pts = [];
      for (let k = 0; k <= 48; k++) {
        const x = k / 48;
        pts.push([-0.72 + x * 1.44, 0.35 - shapeAt(p, x) * 0.7]);
      }
      return P(poly(pts), 0.09);
    },
    [FX_RATE]: (n) => T(0, 0.17, n.aux[0] === 1 ? "hz" : ["1/32", "1/16", "1/8", "1/4", "1/2", "1/1", "2/1", "4/1"][n.aux[1] ?? 3] ?? "1/4", 0.38, 500),
    [FX_MACRO]: (n) => T(0, 0.17, String((n.aux[0] || 0) + 1), 0.55, 500),
    [FX_FOLLOW]: () => P("M -.7 .5 L -.35 -.45 C -.15 .1 .15 .4 .7 .5") + [0.5, 0.8, 0.6, 0.35, 0.2, 0.12, 0.08].map((h, i) => R(-0.6 + i * 0.16, 0.5 - h, 0.08, h, 0.2)).join(""),
    [FX_ENV]: (n) => {
      const lg = (v, lo, hi) => Math.log(Math.max(lo, Math.min(hi, v)) / lo) / Math.log(hi / lo);
      const atk = 0.08 + 0.3 * lg(n.aux[0] || 10, 1, 5e3), dec = 0.1 + 0.34 * lg(n.aux[1] || 200, 1, 5e3), rel = 0.12 + 0.44 * lg(n.aux[3] || 300, 1, 1e4);
      const sus = Math.max(0, Math.min(100, n.aux[2] ?? 70)) / 100;
      const susW = Math.max(0.1, 1.4 - atk - dec - rel), xA = -0.7 + atk, xD = xA + dec, xS = xD + susW, xR = xS + rel, yS = 0.5 - sus;
      const d = `M -.7 .5 L ${f3(xA)} -.5 L ${f3(xD)} ${f3(yS)} H ${f3(xS)} L ${f3(xR)} .5`;
      return F(d + " Z", 0.15) + P(d);
    },
    [FX_DRIFT]: () => P(poly(Array.from({ length: 41 }, (_, i) => [-0.7 + 1.4 * i / 40, 0.35 * Math.sin(i * 0.55) * Math.cos(i * 0.21 + 1) + 0.12 * Math.sin(i * 1.7)]))),
    [FX_PULSE]: (n) => {
      const steps = n.aux[4] || 8, hits = pulseHits(steps, n.aux[5] ?? 3, n.aux[6] || 0);
      return hits.map((on, k) => {
        const a = -Math.PI / 2 + k / steps * 2 * Math.PI;
        return C(0.55 * Math.cos(a), 0.55 * Math.sin(a), on ? steps > 16 ? 0.06 : 0.1 : 0.045, true, on ? 0.95 : 0.5);
      }).join("");
    },
    [FX_SCENE]: (n) => {
      const a = Math.min(1, Math.max(0, n.amount)), hasA = !!n.sceneA?.length, hasB = !!n.sceneB?.length;
      return P("M -.55 0 H .55", 0.06, 0.5) + C(-0.55, 0, hasA ? 0.1 : 0.06, hasA, 0.95, 0.06) + C(0.55, 0, hasB ? 0.1 : 0.06, hasB, 0.95, 0.06) + C(-0.55 + 1.1 * a, 0, 0.13) + T(-0.55, 0.5, "A", 0.32, 500, hasA ? 0.95 : 0.45) + T(0.55, 0.5, "B", 0.32, 500, hasB ? 0.95 : 0.45);
    }
  };
  function pulseHits(steps, hits, rotate) {
    const n = Math.max(1, Math.min(32, steps)), h = Math.max(0, Math.min(n, hits));
    return Array.from({ length: n }, (_, k) => ((k + rotate) % n + n) % n * h % n < h);
  }
  var bars = (col, specs, w = 0.34) => specs.map(([x, top, op]) => R(x, top, w, 1 - top, op ?? 1, col)).join("");
  var fit = (col, d, w = 0.16) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f3(w * LINE)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  var plates = {
    [FX_CARVE]: (col) => bars(col, [[-1.15, -1], [-0.75, -0.72], [-0.35, 0.18], [0.05, 0.3], [0.45, -0.62], [0.85, -0.95]], 0.28),
    [FX_MATCH]: (col) => bars(col, [[-1.1, -0.3], [-0.5, -0.95], [0.1, -0.1], [0.7, -0.6]], 0.4) + [[-1.1, -0.95], [-0.5, -0.3], [0.1, -0.6], [0.7, -0.1]].map(([x, t]) => `<rect x="${x}" y="${t}" width=".4" height="${f3(1 - t)}" fill="none" stroke="${PAPER}" stroke-opacity=".75" stroke-width=".07"/>`).join(""),
    [FX_VOCODE]: (col) => bars(col, [[-1.15, -0.55], [-0.45, -1], [0.25, -0.25], [0.95, -0.75]]) + [[-0.72, -0.2], [-0.02, -0.7], [0.68, -0.45]].map(([x, t]) => R(x, t, 0.12, 1 - t, 0.85)).join(""),
    [FX_FREEZE]: (col, n) => bars(col, [[-1.15, -0.55], [-0.7, -0.55], [-0.25, -0.55], [0.2, -0.55], [0.65, -0.55]], 0.3) + (n.amount > 0.5 ? P("M -1.25 -.72 H 1.05", 0.09) : P("M -1.25 -.72 H 1.05", 0.07, 0.35, ".1 .12")),
    [FX_SHIFT]: (col, n) => (n.aux[0] || 0) < 0 ? bars(col, [[-1.15, -0.95], [-0.65, -0.55], [-0.15, -0.15], [0.35, 0.25]], 0.36) + P("M 1.15 .45 H .55 M .75 .25 L .55 .45 L .75 .65", 0.09) : bars(col, [[-1.15, 0.25], [-0.65, -0.15], [-0.15, -0.55], [0.35, -0.95]], 0.36) + P("M .55 -.35 H 1.15 M .95 -.55 L 1.15 -.35 L .95 -.15", 0.09),
    [FX_SMEAR]: (col) => {
      let s = "";
      for (const [x, t] of [[-1.15, -0.5], [-0.5, -0.95], [0.15, -0.3]]) [1, 0.5, 0.25, 0.12].forEach((o, k) => {
        s += R(x + k * 0.17, t + k * 0.12, 0.34, 1 - t - k * 0.12, o, col);
      });
      return s;
    },
    [FX_SIEVE]: (col, n) => {
      const keep = n.amount < 4e-3 ? 9 : Math.max(1, Math.min(9, Math.round(9 * Math.pow(2, -n.amount * 4))));
      const order = [2, 6, 4, 0, 8, 3, 5, 1, 7];
      return bars(col, Array.from({ length: 9 }, (_, k) => {
        const kept = order.indexOf(k) < keep;
        return [-1.2 + k * 0.29, kept ? k === 2 ? -0.95 : k === 6 ? -0.7 : -0.35 - k % 3 * 0.15 : 0.25 + k % 3 * 0.15, kept ? 1 : 0.3];
      }), 0.14);
    },
    5: (col, n) => fit(col, "M 0 -1.05 V 1.05", 0.1) + R(-0.5, -0.16 + (0.75 - Math.min(1, Math.max(0, n.amount))) * 0.9, 1, 0.32, 1, col),
    [FX_MIX_TYPE]: (col) => fit(col, "M -1.05 -.6 C -.3 -.6 -.35 0 0 0 M -1.05 .6 C -.3 .6 -.35 0 0 0 M 0 0 H 1.05") + `<circle r=".2" fill="${col}"/>`,
    [FX_SPLIT_LR]: (col) => fit(col, "M -1.05 0 H 0 M 0 0 C .35 0 .3 -.6 1.05 -.6 M 0 0 C .35 0 .3 .6 1.05 .6") + `<circle cx="1.05" cy="-.6" r=".2" fill="${col}"/><circle cx="1.05" cy=".6" r=".2" fill="none" stroke="${col}" stroke-width=".12"/>`,
    [FX_SPLIT_MS]: (col) => `<circle r=".8" fill="none" stroke="${col}" stroke-width=".16"/><circle r=".32" fill="${col}"/>`,
    [FX_PAN]: (col, n) => fit(col, "M -1.05 0 H 1.05 M -1.05 -.3 V .3 M 1.05 -.3 V .3", 0.12) + `<circle cx="${f3(-0.84 + 1.68 * Math.min(1, Math.max(0, n.amount)))}" r=".24" fill="${col}"/>`,
    [FX_BANDS]: (col, n) => {
      const nb = Math.max(1, Math.min(5, n.aux[5] || 1));
      let d = "M -1.05 0 H 1.05";
      for (let k = 1; k <= nb; k++) {
        const x = -1.05 + 2.1 * k / (nb + 1);
        d += ` M ${f3(x)} -.55 V .55`;
      }
      return fit(col, d, 0.14);
    },
    [FX_SIDE]: (col) => `<circle cx=".3" r=".58" fill="none" stroke="${col}" stroke-width=".14"/>` + fit(col, "M -1.15 0 H -.28 M -.55 -.28 L -.28 0 L -.55 .28", 0.14)
  };
  function printInner(n, family, tint) {
    const plate = plates[n.type];
    if (plate) return `<g transform="scale(${family === "utility" ? UTIL_SCALE : SPEC_SCALE})">${plate(tint, n)}</g>`;
    const pic = pictures[n.type]?.(n) ?? "";
    const inkScale = family === "control" ? 0.78 : 1;
    return `<path d="${SHAPE[family]}" fill="${tint}" fill-rule="evenodd"/><g transform="scale(${inkScale})">${pic}</g>`;
  }
  return __toCommonJS(entry_exports);
})();
