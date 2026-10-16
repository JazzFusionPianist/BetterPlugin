/* ── Patch on Slur's prints, as Patch on Slur draws them ──
   MADE BY tools/prints-from-patch.mjs from the plug-in's own drawing module (printGlyphs.ts) on every build: not to be edited
   here, and not to be redrawn. PATCH_PRINTS.printInner(node, family, tint) gives the SVG of a print in a box from -1 to 1. */
var PATCH_PRINTS = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
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
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // apps/plugin/src/components/collab/prints-entry.ts
  var prints_entry_exports = {};
  __export(prints_entry_exports, {
    PLATE_TINT: () => PLATE_TINT,
    REACH: () => REACH,
    SHAPE: () => SHAPE,
    printInner: () => printInner
  });

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

  // apps/plugin/src/components/collab/printCatalog.ts
  var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function parseLead(s) {
    const m = /^\s*([+\-−]?\s*\d*\.?\d+)\s*([a-zA-Z%]*)/.exec(s.replace(/,/g, "."));
    if (!m) return null;
    let v = Number(m[1].replace("\u2212", "-").replace(/\s+/g, ""));
    if (!Number.isFinite(v)) return null;
    const unit = m[2].toLowerCase();
    if (unit === "k" || unit === "khz") v *= 1e3;
    return v;
  }
  var fmtHz = (hz) => hz >= 1e3 ? `${(hz / 1e3).toFixed(hz >= 1e4 ? 1 : 2)}k` : `${Math.round(hz)}`;
  var MODES = [
    { id: 7, name: "cut" },
    { id: 8, name: "amp" },
    { id: 0, name: "tone" },
    { id: 1, name: "tape" },
    { id: 6, name: "mod" },
    { id: 9, name: "doubler" },
    { id: 10, name: "delay" },
    { id: 2, name: "space" },
    { id: 3, name: "stereo" },
    { id: 4, name: "glue" },
    { id: 5, name: "gain" },
    { id: 12, name: "tremolo" },
    { id: 13, name: "arp" },
    { id: 14, name: "radio" },
    { id: 15, name: "harmony" },
    { id: 16, name: "pitch" },
    { id: 17, name: "formant" },
    { id: 18, name: "grain" },
    { id: 20, name: "crush" },
    { id: 21, name: "shimmer" },
    { id: 22, name: "swell" },
    { id: 23, name: "stutter" },
    { id: 24, name: "air" },
    { id: 25, name: "ring" },
    { id: 26, name: "gate" },
    { id: 27, name: "wow" }
  ];
  var nameOf = (type) => type === FX_MIX_TYPE ? "mix" : type === FX_SPLIT_LR ? "L/R" : type === FX_SPLIT_MS ? "M/S" : type === FX_LFO ? "LFO" : type === FX_RATE ? "rate" : type === FX_MACRO ? "macro" : type === FX_SIDE ? "side" : type === FX_FOLLOW ? "follow" : type === FX_COMP ? "comp" : type === FX_BANDS ? "bands" : type === FX_CARVE ? "carve" : type === FX_MATCH ? "match" : type === FX_VOCODE ? "vocode" : type === FX_FREEZE ? "freeze" : type === FX_SHIFT ? "shift" : type === FX_SMEAR ? "smear" : type === FX_PAN ? "pan" : type === FX_REPEAT ? "repeat" : type === FX_ENV ? "env" : type === FX_FOLD ? "fold" : type === FX_DRIFT ? "drift" : type === FX_PULSE ? "pulse" : type === FX_SCENE ? "scene" : type === FX_SIEVE ? "sieve" : MODES.find((m) => m.id === type)?.name ?? "";
  var FAMILIES = [
    ["tone", ["cut", "amp", "tone", "tape", "glue", "comp", "air"]],
    ["grit", ["crush", "radio", "ring", "fold"]],
    ["space", ["delay", "space", "shimmer", "doubler", "stereo"]],
    ["motion", ["mod", "tremolo", "swell", "stutter", "gate", "wow", "repeat"]],
    ["pitch", ["pitch", "formant", "harmony", "arp", "grain"]],
    ["utility", ["gain", "mix", "L/R", "M/S", "pan", "bands", "side"]],
    ["control", ["LFO", "macro", "follow", "env", "drift", "pulse", "scene"]],
    ["spectral", ["carve", "match", "vocode", "freeze", "shift", "smear", "sieve"]]
  ];
  var PRINTS = (() => {
    const byName = /* @__PURE__ */ new Map();
    for (let t = 0; t <= 60; t++) {
      const nm = nameOf(t);
      if (nm) byName.set(nm, t);
    }
    return FAMILIES.flatMap(([family, names]) => names.map((name) => ({ type: byName.get(name) ?? -1, name, family })));
  })();
  var VARIANTS = [
    [],
    // tone
    ["hard", "clean"],
    // tape
    ["hall", "room", "plate"],
    // space
    [],
    // stereo
    [],
    // glue
    [],
    // gain
    ["chorus", "flanger", "phaser"],
    // mod
    ["low", "high", "band"],
    // cut
    ["clean", "crunch", "lead", "fuzz"],
    // amp
    ["tight", "wide"],
    // doubler
    ["clean", "tape", "pingpong"],
    // delay
    [],
    // (mix slot)
    ["sine", "triangle", "square", "pulse", "saw"],
    // tremolo
    ["up", "down", "up-down", "random"],
    // arp
    ["am", "phone"],
    // radio
    ["key", "chromatic"],
    // harmony
    ["raw", "natural"],
    // pitch
    [],
    // formant
    ["cloud", "stutter", "reverse"],
    // grain
    ["female", "male", "child", "giant"],
    // voice
    ["both", "bits", "rate"],
    // crush
    ["octave", "fifth", "down"],
    // shimmer
    ["soft", "hard"],
    // swell
    ["beat", "bar"],
    // stutter
    ["silk", "bright"],
    // air
    ["ring", "am"],
    // ring
    ["tight", "loose"],
    // gate
    ["wow", "flutter", "both"]
    // wow
  ];
  var NEW_VARIANTS = { [FX_ENV]: ["level", "wire"], [FX_FOLD]: ["sine", "triangle"] };
  var flavoursOf = (type) => type === FX_MIX_TYPE ? ["blend", "sum"] : VARIANTS[type] ?? NEW_VARIANTS[type] ?? [];
  var VARIANT_LABEL = { 1: "drive", 2: "room", 6: "kind", 7: "pass", 8: "stage", 9: "spread", 10: "type", 13: "order", 14: "band", 15: "mode", 16: "mode", 18: "mode", 20: "target", 21: "interval", 22: "floor", 23: "grid", 24: "mode", 25: "mode", 26: "release", 27: "motion" };
  var MAIN_HAND = { 7: "cutoff", [FX_COMP]: "threshold", [FX_CARVE]: "depth", [FX_PAN]: "pan", [FX_FOLD]: "drive", [FX_FREEZE]: "hold", [FX_SIEVE]: "keep", [FX_SHIFT]: "mix", [FX_SMEAR]: "mix", [FX_REPEAT]: "mix" };
  var DIV_LABELS = ["1/16", "1/8t", "1/8", "1/8.", "1/4", "1/4.", "1/2", "1/32"];
  var DIV_ORDER = [7, 0, 1, 2, 3, 4, 5, 6];
  var RATE_DIVS = ["1/32", "1/16", "1/8", "1/4", "1/2", "1/1", "2/1", "4/1"];
  var RATE_FEEL = ["straight", "dotted", "triplet"];
  var KEY_NAMES = ["C", "C\u266F", "D", "D\u266F", "E", "F", "F\u266F", "G", "G\u266F", "A", "A\u266F", "B"];
  var CURVE_LEN = 32;
  function baseShape(variant, ph) {
    switch (variant) {
      case 1:
        return 1 - 2 * Math.abs(ph - 0.5);
      case 2:
        return ph < 0.5 ? 0 : 1;
      // square: the dip comes first
      case 3:
        return ph < 0.25 ? 0 : 1;
      // pulse: a short dip
      case 4:
        return ph;
      // saw: rises, drops
      default:
        return 0.5 + 0.5 * Math.cos(2 * Math.PI * ph);
    }
  }
  var TREM_PRESETS = /* @__PURE__ */ (() => {
    const pts = (f) => Array.from({ length: CURVE_LEN }, (_, i) => Math.min(1, Math.max(0, f(i / CURVE_LEN))));
    const steps = (pattern) => pts((ph) => pattern[Math.floor(ph * pattern.length)] ?? 0);
    const gate = (pattern, width = 0.6) => pts((ph) => {
      const k = ph * pattern.length;
      const i = Math.floor(k);
      return pattern[i] && k - i < width ? 1 : 0;
    });
    return [
      { name: "sine", curve: () => pts((ph) => baseShape(0, ph)) },
      { name: "triangle", curve: () => pts((ph) => baseShape(1, ph)) },
      { name: "square", curve: () => pts((ph) => baseShape(2, ph)) },
      { name: "pulse", curve: () => pts((ph) => baseShape(3, ph)) },
      { name: "saw", curve: () => pts((ph) => baseShape(4, ph)) },
      { name: "eighths", curve: () => gate([1, 1, 1, 1, 1, 1, 1, 1], 0.55) },
      { name: "sixteenths", curve: () => gate(new Array(16).fill(1), 0.5) },
      { name: "3-3-2", curve: () => gate([1, 0, 0, 1, 0, 0, 1, 0], 0.9) },
      { name: "gallop", curve: () => gate([1, 0, 1, 1, 1, 0, 1, 1], 0.7) },
      { name: "swing", curve: () => pts((ph) => {
        const k = ph * 4;
        const i = Math.floor(k);
        const f = k - i;
        return f < (i % 2 ? 0.45 : 0.65) ? 1 : 0.15;
      }) },
      { name: "offbeat", curve: () => gate([0, 1, 0, 1, 0, 1, 0, 1], 0.6) },
      { name: "breath", curve: () => pts((ph) => Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ph), 2.2)) },
      { name: "stairs", curve: () => steps([1, 0.75, 0.5, 0.25, 1, 0.75, 0.5, 0.25]) },
      { name: "random", curve: () => {
        let s = 7;
        return steps(Array.from({ length: 8 }, () => {
          s = s * 1103515245 + 12345 & 2147483647;
          return 0.2 + s % 1e3 / 1250;
        }));
      } }
    ];
  })();
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
  function stepsToPts(heights) {
    const n = heights.length, out = [];
    for (let k = 0; k < n; k++) out.push(k / n, heights[k], 0, (k + 1) / n, heights[k], 0);
    return out;
  }
  function ptsToSteps(pts, count) {
    const n = pts.length / 6;
    return Array.from({ length: count }, (_, k) => k < n ? pts[k * 6 + 1] : 0.5);
  }
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
  function fmtDecay(variant, d) {
    const rs = variant === 0 ? Math.min(1, Math.max(0, 0.769 + d * 0.191)) : variant === 1 ? Math.min(1, Math.max(0.02, 0.16 + (d - 0.5) * 0.44)) : Math.min(1, Math.max(0, 0.5 + (d - 0.5) * 0.7));
    const g = 0.7 + 0.28 * rs;
    const t = 0.096 / -Math.log10(g);
    return `${t >= 10 ? t.toFixed(1) : t.toFixed(2)}s`;
  }
  function parseDecay(variant, s) {
    const t = parseLead(s);
    if (t === null || t <= 0) return null;
    const g = Math.pow(10, -0.096 / t);
    const rs = (g - 0.7) / 0.28;
    const d = variant === 0 ? (rs - 0.769) / 0.191 : variant === 1 ? (rs - 0.16) / 0.44 + 0.5 : (rs - 0.5) / 0.7 + 0.5;
    return clamp(d, 0, 1);
  }
  var PLAY_HANDS = {
    2: [{ key: "decay", label: "decay" }],
    10: [{ key: "fb", label: "feedback" }],
    13: [{ key: "aux0", label: "step" }],
    [FX_CARVE]: [{ key: "aux0", label: "attack" }, { key: "aux1", label: "release" }, { key: "aux2", label: "from" }, { key: "aux3", label: "to" }],
    [FX_MATCH]: [{ key: "aux1", label: "smooth" }],
    [FX_VOCODE]: [{ key: "aux0", label: "bands" }, { key: "aux1", label: "attack" }, { key: "aux2", label: "release" }],
    [FX_SHIFT]: [{ key: "aux0", label: "hz" }, { key: "aux1", label: "feedback" }],
    [FX_SMEAR]: [{ key: "aux0", label: "time" }, { key: "aux1", label: "blur" }],
    [FX_REPEAT]: [{ key: "aux4", label: "threshold" }],
    [FX_SIEVE]: [{ key: "aux0", label: "attack" }, { key: "aux1", label: "release" }, { key: "aux2", label: "mix" }],
    [FX_COMP]: [{ key: "aux0", label: "ratio" }, { key: "aux1", label: "attack" }, { key: "aux2", label: "release" }, { key: "aux3", label: "knee" }, { key: "aux4", label: "makeup" }],
    15: [{ key: "aux2", label: "interval" }],
    16: [{ key: "aux0", label: "cents" }],
    18: [{ key: "aux0", label: "size" }, { key: "aux1", label: "spray" }, { key: "aux2", label: "scatter" }, { key: "aux5", label: "pan" }],
    22: [{ key: "aux0", label: "depth" }]
  };
  var RATE_HANDS = [{ key: "aux0", label: "clock" }, { key: "aux1", label: "rate" }, { key: "aux2", label: "feel" }, { key: "aux3", label: "hz" }];
  var LFO_HANDS = [...RATE_HANDS, { key: "aux5", label: "depth" }, { key: "aux6", label: "reset" }, { key: "decay", label: "morph" }];
  var DRIFT_HANDS = [...RATE_HANDS, { key: "aux4", label: "smooth" }, { key: "aux5", label: "depth" }];
  var PULSE_HANDS = [...RATE_HANDS, { key: "aux4", label: "steps" }, { key: "aux5", label: "hits" }, { key: "aux6", label: "rotate" }, { key: "aux7", label: "length" }];
  var aux8 = (n) => {
    const a = [...n.aux || []];
    while (a.length < 8) a.push(0);
    return a;
  };
  var withAux = (n, k, v, extra) => {
    const a = aux8(n);
    a[k] = v;
    extra?.(a);
    return { aux: a };
  };
  var ms = (v) => `${Math.round(v)} ms`;
  var gauge = (key, label, k, read, min, max, def, o = {}) => Object.assign({ kind: "gauge", key, label, at: `aux${k}`, min, max, def, step: 1, get: read, set: (v, n) => withAux(n, k, Math.round(v)) }, o);
  var choice = (key, label, k, options, read, o = {}) => Object.assign({ kind: "choice", key, label, at: `aux${k}`, options, get: read, set: (v, n) => withAux(n, k, v) }, o);
  var sw = (key, label, k) => ({ kind: "switch", key, label, at: `aux${k}`, get: (n) => !!(n.aux || [])[k], set: (on, n) => withAux(n, k, on ? 1 : 0) });
  var flavourHand = (type) => ({ kind: "choice", key: "variant", label: type === FX_MIX_TYPE ? "mode" : VARIANT_LABEL[type] ?? "mode", at: "variant", options: flavoursOf(type), get: (n) => n.variant, set: (v) => ({ variant: v }) });
  var divHand = (key, label, o = {}) => Object.assign({ kind: "choice", key, label, at: "div", options: DIV_ORDER.map((i) => DIV_LABELS[i]), fill: true, get: (n) => DIV_ORDER.indexOf(n.delayDiv), set: (v) => ({ delayDiv: DIV_ORDER[v] }) }, o);
  var keyHands = (k, when) => [
    choice("key", "key", k, KEY_NAMES, (n) => ((n.aux[k] || 0) % 12 + 12) % 12, { fill: true, when }),
    choice("scale", "scale", k + 1, ["major", "minor"], (n) => (n.aux[k + 1] || 0) === 1 ? 1 : 0, { when })
  ];
  var CLOCK_HANDS = [
    choice("mode", "clock", 0, ["sync", "hz"], (n) => n.aux[0] || 0),
    choice("div", "rate", 1, RATE_DIVS, (n) => n.aux[1] ?? 3, { fill: true, when: (n) => (n.aux[0] || 0) === 0 }),
    choice("feel", "feel", 2, RATE_FEEL, (n) => n.aux[2] || 0, { when: (n) => (n.aux[0] || 0) === 0 }),
    gauge("hz", "hz", 3, (n) => (n.aux[3] || 200) / 100, 0.01, 20, 2, { step: 0.01, fine: 260, live: (v) => v / 100, format: (v) => `${v.toFixed(2)} hz`, set: (v, n) => withAux(n, 3, Math.round(v * 100)), when: (n) => (n.aux[0] || 0) !== 0 })
  ];
  var toPos = (hz) => 100 * Math.log(Math.max(20, Math.min(2e4, hz)) / 20) / Math.log(1e3);
  var toHz = (pos) => Math.round(20 * Math.pow(1e3, Math.max(0, Math.min(100, pos)) / 100));
  var STUDY_HANDS = (() => {
    const h = {};
    for (let t = 0; t <= 60; t++) if (flavoursOf(t).length && t !== 5 && t !== 7 && t !== 12 && t !== FX_COMP && t !== FX_FOLLOW && t !== FX_ENV) h[t] = [flavourHand(t)];
    const add = (type, ...more) => {
      h[type] = (h[type] || []).concat(more);
    };
    add(2, { kind: "gauge", key: "decay", label: "decay", at: "decay", min: 0, max: 1, step: 5e-3, def: 0.5, get: (n) => n.decay[n.variant] ?? 0.5, liveDrag: true, set: (v, n) => {
      const d = [...n.decay];
      d[n.variant] = v;
      return { decay: d };
    }, format: (d, n) => fmtDecay(n.variant, d), parse: (s, n) => parseDecay(n.variant, s) });
    add(10, divHand("time", "time"), { kind: "gauge", key: "fb", label: "feedback", at: "fb", min: 0, max: 100, step: 1, unit: "%", def: 35, live: (v) => v * 100, liveDrag: true, get: (n) => Math.round(n.delayFb * 100), set: (v) => ({ delayFb: v / 100 }) });
    add(13, divHand("rate", "rate"), gauge("step", "step", 0, (n) => n.aux[0] || 12, 1, 12, 12, { unit: "st", fine: 120, set: (v, n) => withAux(n, 0, v) }));
    {
      const chroma = (n) => n.variant === 1;
      add(
        15,
        ...keyHands(0, (n) => n.variant !== 1),
        gauge("int", (n) => chroma(n) ? "interval" : "degrees", 2, (n) => n.aux[2] || 0, (n) => chroma(n) ? -12 : -7, (n) => chroma(n) ? 12 : 7, (n) => chroma(n) ? 7 : 2, { bipolar: true, fine: 140, format: (v, n) => `${v > 0 ? "+" : ""}${v}${chroma(n) ? " st" : v === 0 ? " unison" : ""}`, set: (v, n) => withAux(n, 2, v) })
      );
    }
    add(16, gauge("cents", "cents", 0, (n) => n.aux[0] || 0, -100, 100, 0, { bipolar: true, format: (v) => `${v > 0 ? "+" : ""}${v} c`, set: (v, n) => withAux(n, 0, v) }), choice("engine", "engine", 1, ["fine", "live"], (n) => n.aux[1] || 0));
    add(17, choice("engine", "engine", 0, ["fine", "live"], (n) => n.aux[0] || 0));
    add(
      18,
      gauge("size", "size", 0, (n) => n.aux[0] || 120, 10, 600, 120, { unit: "ms", set: (v, n) => withAux(n, 0, v) }),
      gauge("spray", "spray", 1, (n) => n.aux[1] || 0, 0, 1500, 300, { unit: "ms", set: (v, n) => withAux(n, 1, v) }),
      gauge("scatter", "scatter", 2, (n) => n.aux[2] || 0, 0, 24, 0, { unit: "st", fine: 140, set: (v, n) => withAux(n, 2, v) }),
      choice("pmode", "pitch", 6, ["key", "intervals", "cents", "free"], (n) => n.aux[6] || 0),
      ...keyHands(3, (n) => (n.aux[6] || 0) === 0),
      divHand("rate", "rate", { when: (n) => n.variant === 1 }),
      gauge("pan", "pan", 5, (n) => n.aux[5] ?? 50, 0, 100, 50, { unit: "%", set: (v, n) => withAux(n, 5, v) }),
      sw("freeze", "freeze", 7)
    );
    add(22, gauge("depth", "depth", 0, (n) => n.aux[1] === 1 ? n.aux[0] : 100, 0, 100, 100, { unit: "%", set: (v, n) => withAux(n, 0, v, (a) => {
      a[1] = 1;
    }) }));
    h[12] = [
      choice("shape", "shape", 2, TREM_PRESETS.map((p) => p.name), (n) => Math.min(TREM_PRESETS.length - 1, n.aux[2] || 0), { set: (pi, n) => ({ ...withAux(n, 2, pi), curve: TREM_PRESETS[pi].curve(), variant: Math.min(4, pi) }) }),
      choice("target", "moves", 0, ["volume", "pan"], (n) => n.aux[0] || 0),
      divHand("rate", "rate")
    ];
    h[7] = [
      { kind: "choice", key: "variant", label: "pass", at: "variant", options: ["low pass", "high pass"], get: (n) => n.variant === 1 ? 0 : 1, set: (k) => ({ variant: k === 0 ? 1 : 0 }) },
      // the engine's words are low (cut) and high (cut): a low cut is a high pass. Said here as passes, low first.
      choice("slope", "slope", 0, ["12", "24", "36", "48"], (n) => (n.aux[0] >= 1 && n.aux[0] <= 4 ? n.aux[0] : 2) - 1, { fill: true, set: (k, n) => withAux(n, 0, k + 1) })
    ];
    h[5] = [
      { kind: "switch", key: "phaseL", label: "\xF8 left", at: "variant", get: (n) => (n.variant & 1) !== 0, set: (_, n) => ({ variant: n.variant ^ 1 }) },
      { kind: "switch", key: "phaseR", label: "\xF8 right", at: "variant", get: (n) => (n.variant & 2) !== 0, set: (_, n) => ({ variant: n.variant ^ 2 }) }
    ];
    h[FX_COMP] = [
      { kind: "choice", key: "variant", label: "detector", at: "variant", options: ["peak", "rms"], get: (n) => n.variant, set: (v) => ({ variant: v }) },
      gauge("ratio", "ratio", 0, (n) => (n.aux[0] || 40) / 10, 1, 20, 4, { step: 0.1, live: (v) => v / 10, format: (v) => `${v.toFixed(1)}:1`, set: (v, n) => withAux(n, 0, Math.round(v * 10)) }),
      gauge("attack", "attack", 1, (n) => (n.aux[1] || 100) / 10, 0.1, 100, 10, { step: 0.1, fine: 260, live: (v) => v / 10, format: (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)} ms`, set: (v, n) => withAux(n, 1, Math.round(v * 10)) }),
      gauge("release", "release", 2, (n) => n.aux[2] || 150, 10, 2e3, 150, { fine: 320, format: ms }),
      gauge("knee", "knee", 3, (n) => n.aux[3] ?? 6, 0, 24, 6, { step: 0.5, format: (v) => `${v.toFixed(1)} dB` }),
      gauge("makeup", "makeup", 4, (n) => n.aux[4] || 0, 0, 24, 0, { step: 0.5, format: (v) => `+${v.toFixed(1)} dB` })
    ];
    h[FX_CARVE] = [
      gauge("attack", "attack", 0, (n) => n.aux[0] || 20, 1, 200, 20, { format: ms }),
      gauge("release", "release", 1, (n) => n.aux[1] || 200, 20, 2e3, 200, { fine: 320, format: ms }),
      // from / to: the range that is carved, on a log track (the gauge's unit is 0..100 along it)
      gauge("from", "from", 2, (n) => toPos(n.aux[2] || 20), 0, 100, 0, { step: 0.5, fine: 400, live: toPos, format: (v) => `${fmtHz(toHz(v))} hz`, set: (v, n) => withAux(n, 2, toHz(v)), parse: (s) => {
        const v = parseLead(s);
        return v === null ? null : toPos(v);
      } }),
      gauge("to", "to", 3, (n) => toPos(n.aux[3] || 2e4), 0, 100, 100, { step: 0.5, fine: 400, live: toPos, format: (v) => `${fmtHz(toHz(v))} hz`, set: (v, n) => withAux(n, 3, toHz(v)), parse: (s) => {
        const v = parseLead(s);
        return v === null ? null : toPos(v);
      } })
    ];
    h[FX_MATCH] = [gauge("smooth", "smooth", 1, (n) => n.aux[1] || 12, 1, 48, 12, { format: (v) => `${Math.round(v)}` }), sw("learn", "learn", 0)];
    h[FX_VOCODE] = [
      gauge("bands", "bands", 0, (n) => n.aux[0] || 24, 8, 64, 24, { format: (v) => `${Math.round(v)}` }),
      gauge("attack", "attack", 1, (n) => n.aux[1] || 10, 1, 200, 10, { format: ms }),
      gauge("release", "release", 2, (n) => n.aux[2] || 80, 10, 2e3, 80, { fine: 320, format: ms })
    ];
    h[FX_SHIFT] = [
      gauge("shz", "hz", 0, (n) => n.aux[0] || 0, -2e3, 2e3, 0, { bipolar: true, fine: 400, format: (v) => `${v > 0 ? "+" : ""}${Math.round(v)} hz` }),
      gauge("sfb", "feedback", 1, (n) => n.aux[1] || 0, 0, 95, 0, { unit: "%" })
    ];
    h[FX_SMEAR] = [gauge("stime", "time", 0, (n) => n.aux[0] || 800, 50, 5e3, 800, { step: 10, fine: 320, format: ms }), gauge("blur", "blur", 1, (n) => n.aux[1] || 0, 0, 100, 0, { unit: "%" })];
    h[FX_SIEVE] = [
      gauge("attack", "attack", 0, (n) => n.aux[0] || 5, 1, 200, 5, { format: ms }),
      gauge("release", "release", 1, (n) => n.aux[1] || 80, 20, 2e3, 80, { fine: 320, format: ms }),
      gauge("smix", "mix", 2, (n) => n.aux[2] ?? 100, 0, 100, 100, { unit: "%" })
    ];
    h[FX_REPEAT] = [...CLOCK_HANDS, gauge("threshold", "threshold", 4, (n) => n.aux[4] || -30, -60, -1, -30, { format: (v) => `${Math.round(v)} dB` })];
    h[FX_FREEZE] = [{ kind: "switch", key: "hold", label: "hold", at: "amount", get: (n) => n.amount > 0.5, set: (on) => ({ amount: on ? 1 : 0 }) }];
    const round = (v) => `${Math.round(v)}`;
    const depth = gauge("lfodepth", "depth", 5, (n) => n.aux[5] ?? 100, 0, 100, 100, { unit: "%" });
    {
      const isRandom = (n) => (n.aux[4] || 0) > 0, isSteps = (n) => !isRandom(n) && n.variant === LFO_STEPS;
      const toShapes = LFO_SHAPES.filter((sh) => sh.pts);
      const morphOf = (n) => n.pts2 ? toShapes.findIndex((sh) => sh.pts.length === n.pts2.length && sh.pts.every((v, i) => Math.abs(v - n.pts2[i]) < 1e-6)) : -1;
      h[FX_LFO] = [
        {
          kind: "choice",
          key: "shape",
          label: "shape",
          at: "variant",
          list: true,
          none: "drawn",
          options: LFO_SHAPES.map((sh) => sh.name),
          get: (n) => isRandom(n) ? LFO_RANDOM : n.variant,
          set: (k, n) => {
            const aux = aux8(n);
            const sh = LFO_SHAPES[k];
            if (k === LFO_RANDOM) {
              aux[4] = aux[4] || 8;
              return { variant: k, aux };
            }
            aux[4] = 0;
            if (k === LFO_STEPS) {
              aux[6] = aux[6] || 8;
              return { variant: k, aux, pts: stepsToPts(Array.from({ length: aux[6] }, (_, i) => i / Math.max(1, aux[6] - 1))) };
            }
            return { pts: [...sh.pts], variant: k, aux };
          }
        },
        gauge("steps", "steps", 4, (n) => n.aux[4] || 8, 1, 32, 8, { format: round, set: (v, n) => withAux(n, 4, Math.max(1, Math.round(v))), when: isRandom }),
        // the morph: a second shape the lfo leans toward, as far as its `morph` hand says (a macro can play it)
        {
          kind: "choice",
          key: "morphto",
          label: "morph to",
          at: "pts2",
          list: true,
          none: "none",
          options: toShapes.map((sh) => sh.name),
          get: morphOf,
          set: (k, n) => {
            const cur = morphOf(n);
            return { pts2: k < 0 || k === cur ? void 0 : [...toShapes[k].pts], ...cur < 0 && k >= 0 ? { decay: [0, 0, 0] } : {} };
          },
          // (a shape picked fresh starts unmorphed: the hand at 0)
          when: (n) => !isRandom(n) && !isSteps(n)
        },
        {
          kind: "gauge",
          key: "morph",
          label: "morph",
          at: "decay",
          min: 0,
          max: 100,
          step: 1,
          unit: "%",
          def: 0,
          live: (v) => v * 100,
          liveDrag: true,
          get: (n) => Math.round((n.decay[Math.max(0, Math.min(2, n.variant))] ?? 0) * 100),
          set: (v) => ({ decay: [v / 100, v / 100, v / 100] }),
          when: (n) => !isRandom(n) && !isSteps(n) && !!n.pts2
        },
        gauge("nsteps", "steps", 6, (n) => n.aux[6] || 8, 2, 32, 8, {
          format: round,
          when: isSteps,
          set: (v, n) => {
            const c = Math.max(2, Math.round(v));
            return { ...withAux(n, 6, c), pts: stepsToPts(ptsToSteps(n.pts ?? SINE_PTS, c)) };
          }
        }),
        ...CLOCK_HANDS,
        depth
      ];
    }
    h[FX_RATE] = [...CLOCK_HANDS];
    h[FX_DRIFT] = [...CLOCK_HANDS, gauge("dsmooth", "smooth", 4, (n) => n.aux[4] ?? 60, 0, 100, 60, { unit: "%" }), depth];
    h[FX_PULSE] = [
      ...CLOCK_HANDS,
      gauge("psteps", "steps", 4, (n) => n.aux[4] || 8, 1, 32, 8, { format: round, set: (v, n) => withAux(n, 4, Math.max(1, Math.round(v))) }),
      gauge("hits", "hits", 5, (n) => n.aux[5] ?? 3, 0, (n) => n.aux[4] || 8, 3, { format: round }),
      gauge("rotate", "rotate", 6, (n) => n.aux[6] || 0, 0, (n) => Math.max(0, (n.aux[4] || 8) - 1), 0, { format: round }),
      gauge("length", "length", 7, (n) => n.aux[7] || 50, 1, 100, 50, { unit: "%" })
    ];
    h[FX_FOLLOW] = [
      { kind: "choice", key: "variant", label: "mode", at: "variant", options: ["envelope", "transient"], get: (n) => n.variant, set: (v) => ({ variant: v }) },
      gauge("attack", "attack", 0, (n) => n.aux[0] || 10, 1, 500, 10, { format: ms }),
      gauge("release", "release", 1, (n) => n.aux[1] || 200, 5, 2e3, 200, { format: ms }),
      gauge("sense", "sense", 2, (n) => n.aux[2] ?? 50, 0, 100, 50, { format: round }),
      gauge("threshold", "threshold", 3, (n) => n.aux[3] || -40, -60, -1, -40, { format: (v) => `${Math.round(v)} dB` })
    ];
    h[FX_ENV] = [
      { kind: "choice", key: "variant", label: "opened by", at: "variant", options: ["level", "wire"], get: (n) => n.variant, set: (v) => ({ variant: v }) },
      gauge("attack", "attack", 0, (n) => n.aux[0] || 10, 1, 5e3, 10, { fine: 320, format: ms }),
      gauge("edecay", "decay", 1, (n) => n.aux[1] || 200, 1, 5e3, 200, { fine: 320, format: ms }),
      gauge("sustain", "sustain", 2, (n) => n.aux[2] ?? 70, 0, 100, 70, { unit: "%" }),
      gauge("release", "release", 3, (n) => n.aux[3] || 300, 1, 1e4, 300, { fine: 320, format: ms }),
      gauge("threshold", "threshold", 4, (n) => n.aux[4] || -30, -60, -1, -30, { format: (v) => `${Math.round(v)} dB`, when: (n) => n.variant === 0 })
    ];
    return h;
  })();

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
  return __toCommonJS(prints_entry_exports);
})();
