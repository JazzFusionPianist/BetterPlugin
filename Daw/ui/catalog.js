/* ── Patch on Slur's prints, as Patch on Slur says they are ──
   MADE BY tools/catalog-from-patch.mjs from the plug-in's own catalog (printCatalog.ts) on every build: not to be edited
   here. PATCH_CATALOG.PRINTS, .STUDY_HANDS, .fmtValue, .parseAmount, .auxOf … (the wall reads them in wall.js). */
"use strict";
var PATCH_CATALOG = (() => {
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

  // ../apps/plugin/src/components/collab/printCatalog.ts
  var printCatalog_exports = {};
  __export(printCatalog_exports, {
    BAND_RGB: () => BAND_RGB,
    CLOCK_HANDS: () => CLOCK_HANDS,
    CURVE_LEN: () => CURVE_LEN,
    DIV_LABELS: () => DIV_LABELS,
    DIV_ORDER: () => DIV_ORDER,
    DRIFT_HANDS: () => DRIFT_HANDS,
    ENV_HANDS: () => ENV_HANDS,
    FAMILIES: () => FAMILIES,
    FOLLOW_HANDS: () => FOLLOW_HANDS,
    KEY_NAMES: () => KEY_NAMES,
    LFO_HANDS: () => LFO_HANDS,
    LFO_RANDOM: () => LFO_RANDOM,
    LFO_SHAPES: () => LFO_SHAPES,
    LFO_STEPS: () => LFO_STEPS,
    MAIN_HAND: () => MAIN_HAND,
    MAX_CROSS: () => MAX_CROSS,
    MODES: () => MODES,
    NEW_VARIANTS: () => NEW_VARIANTS,
    PLAY_HANDS: () => PLAY_HANDS,
    PRINTS: () => PRINTS,
    PULSE_HANDS: () => PULSE_HANDS,
    RATE_DIVS: () => RATE_DIVS,
    RATE_FEEL: () => RATE_FEEL,
    RATE_HANDS: () => RATE_HANDS,
    SCENE_HANDS: () => SCENE_HANDS,
    SCENE_STRIDE: () => SCENE_STRIDE,
    SINE_PTS: () => SINE_PTS,
    STUDY_HANDS: () => STUDY_HANDS,
    STUTTER_LABELS: () => STUTTER_LABELS,
    TREM_PRESETS: () => TREM_PRESETS,
    VARIANTS: () => VARIANTS,
    VARIANT_LABEL: () => VARIANT_LABEL,
    WET_TYPES: () => WET_TYPES,
    auxOf: () => auxOf,
    bandsJoin: () => bandsJoin,
    bandsMoveCut: () => bandsMoveCut,
    bandsPut: () => bandsPut,
    bandsSplit: () => bandsSplit,
    baseShape: () => baseShape,
    clamp: () => clamp,
    crossovers: () => crossovers,
    flavoursOf: () => flavoursOf,
    fmtDecay: () => fmtDecay,
    fmtGate: () => fmtGate,
    fmtHz: () => fmtHz,
    fmtRing: () => fmtRing,
    fmtSwell: () => fmtSwell,
    fmtValue: () => fmtValue,
    fx: () => fx,
    handsOfType: () => handsOfType,
    hasAmountType: () => hasAmountType,
    hasKeyType: () => hasKeyType,
    isControlType: () => isControlType,
    isSplitterType: () => isSplitterType,
    isUtilityType: () => isUtilityType,
    lfoAddPoint: () => lfoAddPoint,
    lfoBend: () => lfoBend,
    lfoLine: () => lfoLine,
    lfoMovePoint: () => lfoMovePoint,
    lfoRemovePoint: () => lfoRemovePoint,
    lfoSetStep: () => lfoSetStep,
    nameOf: () => nameOf,
    neutralOf: () => neutralOf,
    newWireDepth: () => newWireDepth,
    noInputType: () => noInputType,
    outPortsOf: () => outPortsOf,
    parseAmount: () => parseAmount,
    parseDecay: () => parseDecay,
    parseLead: () => parseLead,
    playsHandsType: () => playsHandsType,
    ptsToSteps: () => ptsToSteps,
    randomStep: () => randomStep,
    sampleShape: () => sampleShape,
    sceneRow: () => sceneRow,
    shapeAt: () => shapeAt,
    stepsToPts: () => stepsToPts,
    studyHandsOf: () => studyHandsOf,
    valueOf: () => valueOf,
    variantOf: () => variantOf,
    wireRef: () => wireRef,
    xf: () => xf
  });

  // ../apps/plugin/src/lib/fxBridge.ts
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
  var FX_TUNE = 52;
  var isUtilityType = (t) => t === FX_MIX_TYPE || t === FX_SPLIT_LR || t === FX_SPLIT_MS || t === FX_BANDS || t === FX_LFO || t === FX_RATE || t === FX_MACRO || t === FX_SIDE || t === FX_FOLLOW || t === FX_ENV || t === FX_DRIFT || t === FX_PULSE || t === FX_SCENE;
  var isSplitterType = (t) => t === FX_SPLIT_LR || t === FX_SPLIT_MS || t === FX_BANDS;
  var outPortsOf = (t, aux) => t === FX_BANDS ? Math.max(2, Math.min(6, (aux[5] || 1) + 1)) : isSplitterType(t) ? 2 : 1;
  var isControlType = (t) => t === FX_LFO || t === FX_RATE || t === FX_MACRO || t === FX_FOLLOW || t === FX_ENV || t === FX_DRIFT || t === FX_PULSE || t === FX_SCENE;
  var playsHandsType = (t) => t === FX_LFO || t === FX_RATE || t === FX_MACRO || t === FX_FOLLOW || t === FX_ENV || t === FX_DRIFT || t === FX_PULSE;
  var hasKeyType = (t) => t === 4 || t === 26 || t === FX_COMP || t === FX_REPEAT || t === FX_CARVE || t === FX_MATCH || t === FX_VOCODE;
  var noInputType = (t) => t === FX_LFO || t === FX_SIDE;
  var hasAmountType = (t) => !isUtilityType(t) || t === FX_MACRO || t === FX_SCENE;
  var wireRef = (hand) => {
    if (!hand || !hand.startsWith("wire:")) return null;
    const i = hand.indexOf(":", 5);
    return i < 0 ? null : { from: Number(hand.slice(5, i)), hand: hand.slice(i + 1) };
  };
  var SCENE_HANDS = ["amount", "variant", "decay", "fb", "div", "wet", "aux0", "aux1", "aux2", "aux3", "aux4", "aux5", "aux6", "aux7"];
  var SCENE_STRIDE = SCENE_HANDS.length + 1;
  var sceneRow = (x) => {
    const aux = [...x.aux];
    while (aux.length < 8) aux.push(0);
    return [x.id, x.amount, x.variant, x.decay[Math.max(0, Math.min(2, x.variant))] ?? 0.5, x.delayFb, x.delayDiv, x.wet ? 1 : 0, ...aux.slice(0, 8)];
  };

  // ../apps/plugin/src/components/collab/printCatalog.ts
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
  var nameOf = (type) => type === FX_MIX_TYPE ? "mix" : type === FX_SPLIT_LR ? "L/R" : type === FX_SPLIT_MS ? "M/S" : type === FX_LFO ? "LFO" : type === FX_RATE ? "rate" : type === FX_MACRO ? "macro" : type === FX_SIDE ? "side" : type === FX_FOLLOW ? "follow" : type === FX_COMP ? "comp" : type === FX_BANDS ? "bands" : type === FX_CARVE ? "carve" : type === FX_MATCH ? "match" : type === FX_VOCODE ? "vocode" : type === FX_FREEZE ? "freeze" : type === FX_SHIFT ? "shift" : type === FX_SMEAR ? "smear" : type === FX_PAN ? "pan" : type === FX_REPEAT ? "repeat" : type === FX_ENV ? "env" : type === FX_FOLD ? "fold" : type === FX_DRIFT ? "drift" : type === FX_PULSE ? "pulse" : type === FX_SCENE ? "scene" : type === FX_SIEVE ? "sieve" : type === FX_TUNE ? "tune" : MODES.find((m) => m.id === type)?.name ?? "";
  var FAMILIES = [
    ["tone", ["cut", "amp", "tone", "tape", "glue", "comp", "air"]],
    ["grit", ["crush", "radio", "ring", "fold"]],
    ["space", ["delay", "space", "shimmer", "doubler", "stereo"]],
    ["motion", ["mod", "tremolo", "swell", "stutter", "gate", "wow", "repeat"]],
    ["pitch", ["pitch", "formant", "harmony", "arp", "grain", "tune"]],
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
  var NEW_VARIANTS = { [FX_ENV]: ["level", "wire"], [FX_FOLD]: ["sine", "triangle"], [FX_TUNE]: ["natural", "raw"] };
  var flavoursOf = (type) => type === FX_MIX_TYPE ? ["blend", "sum"] : VARIANTS[type] ?? NEW_VARIANTS[type] ?? [];
  var VARIANT_LABEL = { 1: "drive", 2: "room", 6: "kind", 7: "pass", 8: "stage", 9: "spread", 10: "type", 13: "order", 14: "band", 15: "mode", 16: "mode", 18: "mode", 20: "target", 21: "interval", 22: "floor", 23: "grid", 24: "mode", 25: "mode", 26: "release", 27: "motion", [FX_TUNE]: "formant" };
  var WET_TYPES = /* @__PURE__ */ new Set([2, 10, 9, 6, 15, 18, 21]);
  var MAIN_HAND = { 7: "cutoff", [FX_COMP]: "threshold", [FX_CARVE]: "depth", [FX_PAN]: "pan", [FX_FOLD]: "drive", [FX_FREEZE]: "hold", [FX_SIEVE]: "keep", [FX_TUNE]: "retune", [FX_SHIFT]: "mix", [FX_SMEAR]: "mix", [FX_REPEAT]: "mix" };
  var neutralOf = (type) => type === 0 || type === 3 || type === 16 || type === 17 || type === FX_PAN ? 0.5 : type === 5 ? 0.75 : 0;
  var auxOf = (type, macroNo = 0) => type === 7 ? [2, 0, 0] : type === 13 ? [12, 0, 0] : type === 15 ? [0, 0, 2] : type === 18 ? [120, 300, 7, 0, 0, 50, 0, 0] : type === FX_RATE ? [0, 3, 0, 200] : type === FX_LFO ? [0, 3, 0, 200, 0, 100, 0, 0] : type === FX_MACRO ? [macroNo, 0, 0] : type === FX_FOLLOW ? [10, 200, 50, -40] : type === FX_COMP ? [40, 100, 150, 6, 0] : type === FX_BANDS ? [250, 0, 0, 0, 0, 1, 0, 0] : type === FX_CARVE ? [20, 200, 20, 2e4] : type === FX_MATCH ? [1, 12, 0] : type === FX_VOCODE ? [24, 10, 80] : type === FX_SHIFT ? [200, 0, 0] : type === FX_SMEAR ? [800, 0, 0] : type === FX_SIEVE ? [5, 80, 100] : type === FX_TUNE ? [0, 0, 20, 0, 50, 0] : type === FX_REPEAT ? [0, 3, 0, 200, -30, 0] : type === FX_ENV ? [10, 200, 70, 300, -30, 0] : type === FX_DRIFT ? [0, 3, 0, 200, 60, 100, 0, 0] : type === FX_PULSE ? [0, 1, 0, 200, 8, 3, 0, 50] : [0, 0, 0];
  var variantOf = (type) => type === 7 ? 1 : 0;
  var DIV_LABELS = ["1/16", "1/8t", "1/8", "1/8.", "1/4", "1/4.", "1/2", "1/32"];
  var DIV_ORDER = [7, 0, 1, 2, 3, 4, 5, 6];
  var RATE_DIVS = ["1/32", "1/16", "1/8", "1/4", "1/2", "1/1", "2/1", "4/1"];
  var RATE_FEEL = ["straight", "dotted", "triplet"];
  var KEY_NAMES = ["C", "C\u266F", "D", "D\u266F", "E", "F", "F\u266F", "G", "G\u266F", "A", "A\u266F", "B"];
  var STUTTER_LABELS = ["1/4", "1/8", "1/16", "1/32", "1/64"];
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
  function sampleShape(pts, count = 64) {
    return Array.from({ length: count }, (_, i) => shapeAt(pts, i / count));
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
  function lfoAddPoint(pts, p) {
    const n = pts.length / 3, next = [...pts];
    let at = n;
    for (let i = 0; i < n; i++) if (pts[i * 3] > p.x) {
      at = i;
      break;
    }
    next.splice(at * 3, 0, p.x, p.y, 0);
    return { pts: next, i: at };
  }
  function lfoMovePoint(pts, i, p, alone = false) {
    const n = pts.length / 3, next = [...pts];
    const lo = i === 0 ? 0 : pts[(i - 1) * 3], hi = i === n - 1 ? 1 : pts[(i + 1) * 3];
    let x = i === 0 ? 0 : i === n - 1 ? 1 : Math.min(hi, Math.max(lo, p.x));
    if (i > 0 && i < n - 1) {
      if (x - lo < 0.012) x = lo;
      else if (hi - x < 0.012) x = hi;
    }
    next[i * 3] = x;
    next[i * 3 + 1] = p.y;
    if (i === 0 || i === n - 1) {
      const o = i === 0 ? n - 1 : 0;
      const joined = Math.abs(pts[i * 3 + 1] - pts[o * 3 + 1]) < 1e-4;
      if (alone) {
      } else if (joined) next[o * 3 + 1] = p.y;
      else if (Math.abs(p.y - pts[o * 3 + 1]) < 0.03) next[i * 3 + 1] = pts[o * 3 + 1];
    }
    return next;
  }
  function lfoBend(pts, i, y) {
    const next = [...pts], y0 = pts[i * 3 + 1], y1 = pts[(i + 1) * 3 + 1];
    next[i * 3 + 2] = Math.min(1, Math.max(-1, (y - (y0 + y1) / 2) / 0.5));
    return next;
  }
  var lfoRemovePoint = (pts, i) => {
    const n = pts.length / 3;
    if (i === 0 || i === n - 1) return pts;
    const next = [...pts];
    next.splice(i * 3, 3);
    return next;
  };
  function lfoSetStep(pts, steps, p) {
    const k = Math.min(steps - 1, Math.floor(p.x * steps));
    const h = ptsToSteps(pts, steps);
    h[k] = p.y;
    return stepsToPts(h);
  }
  function lfoLine(pts) {
    const n = pts.length / 3, out = [[pts[0], pts[1]]];
    for (let i = 0; i < n - 1; i++) {
      const x0 = pts[i * 3], x1 = pts[(i + 1) * 3];
      if (x1 - x0 < 1e-6) {
        out.push([x1, pts[(i + 1) * 3 + 1]]);
        continue;
      }
      for (let k = 1; k <= 24; k++) {
        const t = k / 24, y0 = pts[i * 3 + 1], y1 = pts[(i + 1) * 3 + 1], b = pts[i * 3 + 2];
        out.push([x0 + (x1 - x0) * t, Math.min(1, Math.max(0, y0 + (y1 - y0) * t + b * 2 * t * (1 - t)))]);
      }
    }
    return out;
  }
  var BAND_RGB = [[232, 92, 74], [240, 156, 56], [236, 214, 84], [96, 208, 128], [72, 168, 255], [176, 120, 255]];
  var MAX_CROSS = 5;
  var F0 = 20;
  var F1 = 2e4;
  var fx = (hz) => Math.log(Math.max(F0, Math.min(F1, hz)) / F0) / Math.log(F1 / F0);
  var xf = (t) => F0 * Math.pow(F1 / F0, Math.max(0, Math.min(1, t)));
  var crossovers = (aux) => {
    const n = Math.max(1, Math.min(MAX_CROSS, aux[5] || 1));
    return Array.from({ length: n }, (_, k) => aux[k] || 250).sort((a, b) => a - b);
  };
  function bandsPut(aux, cuts) {
    const sorted = [...cuts].sort((a, b) => a - b);
    const out = [...aux];
    while (out.length < 8) out.push(0);
    for (let k = 0; k < MAX_CROSS; k++) out[k] = sorted[k] ?? 0;
    out[5] = sorted.length;
    return out;
  }
  function bandsMoveCut(cuts, k, t) {
    const lo = k > 0 ? cuts[k - 1] * 1.05 : F0, hi = k < cuts.length - 1 ? cuts[k + 1] / 1.05 : F1;
    const next = [...cuts];
    next[k] = Math.round(Math.max(lo, Math.min(hi, xf(t))));
    return next;
  }
  var bandsSplit = (cuts, t) => cuts.length >= MAX_CROSS ? cuts : [...cuts, Math.round(xf(t))];
  var bandsJoin = (cuts, k) => cuts.length > 1 ? cuts.filter((_, i) => i !== k) : cuts;
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
  function fmtSwell(a) {
    const T = 0.02 * Math.pow(75, a);
    return T < 1 ? `${Math.round(T * 1e3)}ms` : `${T.toFixed(2)}s`;
  }
  function fmtGate(a) {
    const t = Math.round(-60 + a * 60);
    return t === 0 ? "0 dB" : `\u2212${-t} dB`;
  }
  function fmtRing(a) {
    const hz = 20 * Math.pow(2, a * 8);
    return hz >= 1e3 ? `${(hz / 1e3).toFixed(2)}k` : `${Math.round(hz)}`;
  }
  function fmtValue(type, a, variant = 0) {
    if (type === FX_MACRO) return `${Math.round(a * 100)}`;
    if (type === 13) return `${Math.round(a * 24)}st`;
    if (type === 16 || type === 17) {
      const st = Math.round((a - 0.5) * 24);
      return `${st > 0 ? "+" : ""}${st} st`;
    }
    if (type === 0 || type === 3) {
      const t = Math.round((a - 0.5) * 200);
      return t === 0 ? "0" : t > 0 ? `+${t}` : `${t}`;
    }
    if (type === 22) return fmtSwell(a);
    if (type === 23) return STUTTER_LABELS[Math.min(4, Math.floor(a * 5))];
    if (type === 25) return fmtRing(a);
    if (type === 26) return fmtGate(a);
    if (type === 5) {
      const db = a < 0.75 ? (a / 0.75 - 1) * 60 : (a - 0.75) * 48;
      return `${db > 0 ? "+" : db < 0 ? "\u2212" : ""}${Math.abs(db).toFixed(1)}`;
    }
    if (type === FX_COMP) return `${Math.round(-60 * a)} dB`;
    if (type === FX_CARVE) return `${Math.round(-24 * a)} dB`;
    if (type === FX_PAN) {
      const p = Math.round((a - 0.5) * 200);
      return p === 0 ? "centre" : p < 0 ? `L ${-p}` : `R ${p}`;
    }
    if (type === FX_FREEZE) return a > 0.5 ? "held" : "open";
    if (type === FX_SCENE) return a <= 5e-3 ? "A" : a >= 0.995 ? "B" : `${Math.round(a * 100)} %`;
    if (type === FX_SIEVE) {
      const keep = Math.max(1, Math.round(Math.pow(2, (1 - a) * 10)));
      return a < 4e-3 ? "all" : `${keep}`;
    }
    if (type === FX_TUNE) return a < 4e-3 ? "off" : a >= 0.995 ? "hard" : `${Math.round(2 + 400 * (1 - a) * (1 - a))} ms`;
    if (type === 7) {
      if (variant === 2) return `${(0.3 + (1 - a) * 9).toFixed(1)}oct`;
      const hz = variant === 0 ? 20 * Math.pow(1e3, a) : 2e4 * Math.pow(1e3, -a);
      return hz >= 1e3 ? `${(hz / 1e3).toFixed(hz >= 1e4 ? 1 : 2)}k hz` : `${Math.round(hz)} hz`;
    }
    return `${Math.round(a * 100)}`;
  }
  function parseAmount(type, s, variant = 0) {
    const t = s.trim().toLowerCase();
    if (type === 23) {
      const i = STUTTER_LABELS.indexOf(t);
      if (i >= 0) return i / 5 + 0.1;
    }
    if (type === FX_FREEZE) return /^(held|hold|on|1)/.test(t) ? 1 : /^(open|off|0)/.test(t) ? 0 : null;
    if (type === FX_SCENE) {
      if (t === "a") return 0;
      if (t === "b") return 1;
    }
    if (type === FX_SIEVE && t === "all") return 0;
    if (type === FX_TUNE) {
      if (t === "off") return 0;
      if (t === "hard") return 1;
    }
    if (type === FX_PAN) {
      if (t === "c" || t === "centre" || t === "center") return 0.5;
      const lr = /^([lr])\s*(\d*\.?\d+)/.exec(t);
      if (lr) return clamp((lr[1] === "l" ? -1 : 1) * Number(lr[2]) / 200 + 0.5, 0, 1);
    }
    const v = parseLead(t);
    if (v === null) return null;
    if (type === 13) return clamp(v / 24, 0, 1);
    if (type === 16 || type === 17) return clamp(v / 24 + 0.5, 0, 1);
    if (type === 0 || type === 3) return clamp(v / 200 + 0.5, 0, 1);
    if (type === 22) {
      const T = /s\s*$/.test(t) && !/ms\s*$/.test(t) ? v : v / 1e3;
      return clamp(Math.log(Math.max(1e-6, T) / 0.02) / Math.log(75), 0, 1);
    }
    if (type === 23) return clamp(v, 0, 1);
    if (type === 25) return clamp(Math.log2(Math.max(1, v) / 20) / 8, 0, 1);
    if (type === 26) return clamp((v + 60) / 60, 0, 1);
    if (type === 5) return clamp(v < 0 ? (v / 60 + 1) * 0.75 : v / 48 + 0.75, 0, 1);
    if (type === FX_COMP) return clamp(-v / 60, 0, 1);
    if (type === FX_CARVE) return clamp(-v / 24, 0, 1);
    if (type === FX_SIEVE) return clamp(1 - Math.log2(Math.max(1, v)) / 10, 0, 1);
    if (type === FX_TUNE) return clamp(1 - Math.sqrt(Math.max(0, v - 2) / 400), 0, 1);
    if (type === FX_PAN) return clamp(v / 200 + 0.5, 0, 1);
    if (type === 7) {
      if (variant === 2) return clamp(1 - (v - 0.3) / 9, 0, 1);
      const hz = Math.max(1, v);
      return clamp(variant === 0 ? Math.log(hz / 20) / Math.log(1e3) : -Math.log(hz / 2e4) / Math.log(1e3), 0, 1);
    }
    return clamp(v / 100, 0, 1);
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
    [FX_TUNE]: [{ key: "aux2", label: "humanize" }, { key: "aux3", label: "flex" }, { key: "aux4", label: "vibrato" }],
    [FX_COMP]: [{ key: "aux0", label: "ratio" }, { key: "aux1", label: "attack" }, { key: "aux2", label: "release" }, { key: "aux3", label: "knee" }, { key: "aux4", label: "makeup" }],
    15: [{ key: "aux2", label: "interval" }],
    16: [{ key: "aux0", label: "cents" }],
    18: [{ key: "aux0", label: "size" }, { key: "aux1", label: "spray" }, { key: "aux2", label: "scatter" }, { key: "aux5", label: "pan" }],
    22: [{ key: "aux0", label: "depth" }]
  };
  var RATE_HANDS = [{ key: "aux0", label: "clock" }, { key: "aux1", label: "rate" }, { key: "aux2", label: "feel" }, { key: "aux3", label: "hz" }];
  var FOLLOW_HANDS = [{ key: "aux0", label: "attack" }, { key: "aux1", label: "release" }, { key: "aux2", label: "sense" }, { key: "aux3", label: "threshold" }];
  var ENV_HANDS = [{ key: "aux0", label: "attack" }, { key: "aux1", label: "decay" }, { key: "aux2", label: "sustain" }, { key: "aux3", label: "release" }, { key: "aux4", label: "threshold" }, { key: "aux5", label: "gate" }];
  var LFO_HANDS = [...RATE_HANDS, { key: "aux5", label: "depth" }, { key: "aux6", label: "reset" }, { key: "decay", label: "morph" }];
  var DRIFT_HANDS = [...RATE_HANDS, { key: "aux4", label: "smooth" }, { key: "aux5", label: "depth" }];
  var PULSE_HANDS = [...RATE_HANDS, { key: "aux4", label: "steps" }, { key: "aux5", label: "hits" }, { key: "aux6", label: "rotate" }, { key: "aux7", label: "length" }];
  var handsOfType = (type) => type === FX_RATE ? RATE_HANDS : type === FX_LFO ? LFO_HANDS : type === FX_FOLLOW ? FOLLOW_HANDS : type === FX_ENV ? ENV_HANDS : type === FX_DRIFT ? DRIFT_HANDS : type === FX_PULSE ? PULSE_HANDS : type === FX_SCENE ? [{ key: "amount", label: "scene" }] : isUtilityType(type) ? [] : [{ key: "amount", label: MAIN_HAND[type] ?? "amount" }, ...PLAY_HANDS[type] ?? []];
  var newWireDepth = (fromType) => fromType === FX_MACRO || fromType === FX_FOLLOW || fromType === FX_ENV || fromType === FX_PULSE ? 1 : 0.5;
  var valueOf = (v, n) => typeof v === "function" ? v(n) : v;
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
    add(
      FX_TUNE,
      choice("key", "key", 0, KEY_NAMES, (n) => ((n.aux[0] || 0) % 12 + 12) % 12, { fill: true, when: (n) => (n.aux[1] || 0) !== 2 }),
      choice("scale", "scale", 1, ["major", "minor", "chromatic"], (n) => Math.min(2, Math.max(0, n.aux[1] || 0))),
      gauge("humanize", "humanize", 2, (n) => n.aux[2] ?? 20, 0, 100, 20, { unit: "%" }),
      // slows the pull once a note has settled: long notes keep their life
      gauge("flex", "flex", 3, (n) => n.aux[3] || 0, 0, 100, 0, { unit: "%" }),
      // leaves a pitch far from any note (a slide, a bend) alone
      gauge("vibrato", "vibrato", 4, (n) => n.aux[4] ?? 50, 0, 100, 50, { unit: "%" }),
      // how much of the voice's own quiver is kept
      choice("engine", "engine", 5, ["fine", "live"], (n) => n.aux[5] || 0)
    );
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
  var studyHandsOf = (n) => (STUDY_HANDS[n.type] || []).filter((x) => !x.when || x.when(n));
  return __toCommonJS(printCatalog_exports);
})();
