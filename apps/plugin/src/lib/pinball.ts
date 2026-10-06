// Pinball — physics engine + canvas renderer.
// No React, no DOM state: the view owns a PinballGame instance, feeds it
// input + time, and draws every frame with drawPinball().
//
// Table anatomy:
//   - plunger lane on the right, one-way flap at the top, skill-shot post
//   - dome guides the launched ball across the top rollover lanes (a·b·c)
//   - three standup targets (o · r · b), three pop bumpers
//   - drop-target banks on BOTH side walls (3 + 3), a spinner in the left orbit
//   - a saucer dead centre: it swallows the ball, starts a mission, kicks it out
//   - a ramp on the right; its rail runs over the top of the table and drops
//     the ball on a third, upper flipper on the left
//   - ball lock on the rail → three-ball multiball, jackpots on the ramp
//   - a captive ball, three star rollovers, four lane lights (they relight
//     the kickback in the left outlane and move with the flippers)
//   - two slingshots above the flippers, in/outlanes, rubber posts
//   - two flippers, centre drain, ball save, end-of-ball bonus × multiplier
//   - nudge, with two warnings before a tilt
//
// All coordinates are in table units (460 × 860, y down). The renderer
// scales to whatever canvas it's given.

export const TABLE_W = 460
export const TABLE_H = 860

const BALL_R = 7
const GRAVITY = 1350           // u/s²
// Above LAUNCH_MAX so full-pull launches aren't clamped into one identical
// trajectory (they were — every pull ≥ ⅓ used to hit the same left orbit).
const MAX_SPEED = 1950         // u/s
const SUBSTEP = 1 / 240        // s
const FLIPPER_LEN = 58
const FLIPPER_R = 7
const FLIPPER_SPEED = 30       // rad/s
const BUMPER_KICK = 720
const SLING_KICK = 460
const LAUNCH_MIN = 1180        // even a tap clears the lane
const LAUNCH_MAX = 1930
const PLUNGER_RATE = 0.75      // pull/s — slower charge = finer aim
const BALL_SAVE_S = 7
const EXTRA_BALL_AT = 100_000
const BALLS_PER_GAME = 3

const PLUNGER_X = 426
const PLUNGER_Y = 806
const LANE_X = 412             // shooter lane's inner wall

const RAIL_SPEED = 560         // u/s along the rail
const RAMP_PTS = 3000
const JACKPOT_PTS = 25_000
const MISSION_PTS = 20_000
const MISSION_S = 45
const NUDGE_COOLDOWN_S = 0.35
const TILT_WARNINGS = 2
const TILT_FORGET_S = 7        // one warning is forgiven every so often

// Print inks — chosen to sit beside klein blue on paper or dark ground.
export const INK_BLUE = '#2440FF'
export const INK_VERMILION = '#E8543F'
export const INK_OCHRE = '#E9A13B'
// The arcade's flat colours.
const FLAT_PAPER = '#FBFAF7'
const FLAT_INK = '#1A1917'
const FLAT_GOLD = '#F5B82E'
const FLAT_PINK = '#F3A3C0'

export type PinballPhase = 'ready' | 'captive' | 'live' | 'over'

export interface PinballTheme {
  paper: string
  ink: string
  blue: string
  t3: string
  /** The arcade's table: flat shapes on the room's wall, no paper sheet. */
  flat?: boolean
}

export const MISSIONS = ['lanes', 'banks', 'ramps', 'spinner', 'bumpers'] as const
export type MissionId = typeof MISSIONS[number]
const MISSION_GOAL: Record<MissionId, number> = { lanes: 3, banks: 6, ramps: 3, spinner: 5, bumpers: 25 }

/** What the room shows beside the table. */
export interface PinballHud {
  mission: MissionId | null
  missionProgress: number
  missionGoal: number
  missionSeconds: number
  missionsDone: boolean[]
  orb: boolean[]
  lockLit: boolean
  locked: number
  multiball: boolean
  jackpots: number
  kickback: boolean
  tiltWarnings: number
  tilted: boolean
}

interface Seg {
  ax: number; ay: number; bx: number; by: number
  nx: number; ny: number      // unit normal (side the ball bounces off)
  e: number                   // restitution
  friction?: number           // extra tangential damping per contact (dome)
  oneWay?: boolean            // only collides when the ball is on the normal side
  kind?: 'sling-l' | 'sling-r' | 'standup'
  standupIdx?: number
  /** How the flat table draws it: a guide rail, a faint boundary, or not at all. */
  look?: 'guide' | 'faint' | 'none'
}

type BallMode = 'plunger' | 'free' | 'rail' | 'locked' | 'held'
interface Ball {
  x: number; y: number; vx: number; vy: number
  mode: BallMode
  s: number                    // distance along the rail
  stopAt: number               // where on the rail it parks (lock), or -1
  ax: number; ay: number; still: number   // stuck-ball watchdog
}

interface Flipper {
  px: number; py: number; len: number; r: number
  angle: number; rest: number; up: number
  side: 'left' | 'right'
  omega: number
}

interface Bumper { x: number; y: number; r: number; heat: number }
interface Post { x: number; y: number; r: number; heat: number; bouncy?: boolean }
interface Rollover { x: number; y: number; r: number; lit: boolean; heat: number; label: string }
interface DropTarget { x: number; y0: number; y1: number; down: boolean; heat: number; face: 1 | -1 }
interface Standup { seg: Seg; heat: number; lit: boolean; label: string; lx: number; ly: number }
interface Light { x: number; y: number; r: number; lit: boolean; heat: number }
interface Popup { x: number; y: number; text: string; age: number; ttl: number; big?: boolean }

function seg(ax: number, ay: number, bx: number, by: number, e = 0.45, opts: Partial<Seg> = {}): Seg {
  // Normal = left of A→B direction; callers order endpoints so the
  // playfield side is on the left of the travel direction.
  const dx = bx - ax, dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  return { ax, ay, bx, by, nx: dy / len, ny: -dx / len, e, ...opts }
}

// ── The ramp and its rail ───────────────────────────────────────────────────
// The ramp's mouth sits where the left flipper's shots arrive, facing down
// and left. A ball that runs into it fast enough is lifted onto the rail — a
// fixed path that sweeps right, climbs the right side, crosses over the top
// of the table and comes down the left side onto the upper flipper. Past its
// mouth the ramp is above the table: other balls pass underneath.
const RAMP = {
  mx: 292, my: 588,            // middle of the mouth
  dx: 0.664, dy: -0.747,       // the way in
  half: 26, depth: 46,
  cx: 380, cy: 500,            // the bend's control point
  ex: 402, ey: 430,            // where the ramp becomes the rail
}
const RAIL_CX = 230, RAIL_CY = 250, RAIL_R = 172

/** A point on the ramp's bend, t in 0..1, and its direction there. */
function rampAt(t: number): { x: number; y: number; tx: number; ty: number } {
  const u = 1 - t
  const x = u * u * RAMP.mx + 2 * u * t * RAMP.cx + t * t * RAMP.ex
  const y = u * u * RAMP.my + 2 * u * t * RAMP.cy + t * t * RAMP.ey
  let tx = 2 * u * (RAMP.cx - RAMP.mx) + 2 * t * (RAMP.ex - RAMP.cx)
  let ty = 2 * u * (RAMP.cy - RAMP.my) + 2 * t * (RAMP.ey - RAMP.cy)
  const l = Math.hypot(tx, ty) || 1
  tx /= l; ty /= l
  return { x, y, tx, ty }
}
/** Half the ramp's width along its bend: wide at the mouth, the rail's gauge at the top. */
const rampHalf = (t: number) => RAMP.half - (RAMP.half - 7) * Math.min(1, t * 1.25)

function buildRail(): { pts: [number, number][]; len: number[]; total: number } {
  const pts: [number, number][] = []
  for (let i = 0; i <= 14; i++) { const p = rampAt(i / 14); pts.push([p.x, p.y]) }
  const arcStart = pts.length
  pts.push([RAMP.ex, RAIL_CY])
  const N = 40
  for (let i = 1; i <= N; i++) {
    const a = (i / N) * Math.PI
    pts.push([RAIL_CX + RAIL_R * Math.cos(a), RAIL_CY - RAIL_R * Math.sin(a)])
  }
  pts.push([58, 470])
  // The last bend, onto the upper flipper.
  for (let i = 1; i <= 8; i++) {
    const t = i / 8, u = 1 - t
    pts.push([u * u * 58 + 2 * u * t * 58 + t * t * 98, u * u * 470 + 2 * u * t * 502 + t * t * 506])
  }
  const len = [0]
  for (let i = 1; i < pts.length; i++) {
    len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  RAIL_ARC_AT = len[arcStart]
  return { pts, len, total: len[len.length - 1] }
}
let RAIL_ARC_AT = 0
const RAIL = buildRail()
// Distance along the rail to a point on its arc (angle from the right end).
const railAtArc = (deg: number) => RAIL_ARC_AT + RAIL_R * (deg * Math.PI / 180)
/** Where locked balls wait — the far one fills first. */
const LOCK_STOPS = [railAtArc(100), railAtArc(80)]

function railPoint(s: number): [number, number] {
  const { pts, len } = RAIL
  if (s <= 0) return pts[0]
  if (s >= RAIL.total) return pts[pts.length - 1]
  let lo = 0, hi = len.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (len[mid] <= s) lo = mid
    else hi = mid
  }
  const t = (s - len[lo]) / ((len[hi] - len[lo]) || 1)
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t]
}

/** How far into the ramp's mouth a point is (0..depth), or -1 outside it. */
function inRampMouth(x: number, y: number): number {
  const rx = x - RAMP.mx, ry = y - RAMP.my
  const along = rx * RAMP.dx + ry * RAMP.dy
  if (along < 0 || along > RAMP.depth) return -1
  const across = rx * -RAMP.dy + ry * RAMP.dx
  return Math.abs(across) <= RAMP.half - 2 ? along : -1
}

// The captive ball's channel: it sits at the low end and rides up when struck.
const CAPTIVE = { x: 356, y: 628, tx: 386, ty: 584, r: 8 }

export class PinballGame {
  phase: PinballPhase = 'ready'
  score = 0
  ballNumber = 1               // 1-based
  ballsTotal = BALLS_PER_GAME
  bonusUnits = 0
  bonusMult = 1
  extraBallGiven = false

  balls: Ball[] = []
  plungerPull = 0              // 0..1
  plungerDown = false

  flippers: Flipper[] = [
    { px: 146, py: 812, len: FLIPPER_LEN, r: FLIPPER_R, angle: 0.46, rest: 0.46, up: -0.55, side: 'left', omega: 0 },
    { px: 286, py: 812, len: FLIPPER_LEN, r: FLIPPER_R, angle: Math.PI - 0.46, rest: Math.PI - 0.46, up: Math.PI + 0.55, side: 'right', omega: 0 },
    // The upper flipper, fed by the rail; it works with the left button.
    { px: 100, py: 524, len: 46, r: 5.5, angle: 0.52, rest: 0.52, up: -0.42, side: 'left', omega: 0 },
  ]
  private pressed = { left: false, right: false }

  time = 0                     // game-time seconds
  ballSaveUntil = -1
  ballSaveUsed = false
  drainFlash = 0
  slingHeat: [number, number] = [0, 0]   // left, right

  // Saucer (kicker hole) — swallows the ball, scores, spits it back out.
  saucer = { x: 216, y: 566, r: 14, heat: 0, holdUntil: -1, cooldownUntil: -1, ejectSide: 1 as 1 | -1, holding: false }
  private saucerVisits = 0

  // Spinner in the left orbit — every pass spins it and pays out.
  spinner = { x: 43, y: 440, r: 12, rot: 0, rotV: 0, cooldownUntil: -1, heat: 0 }

  // Hit chain: rapid consecutive part hits multiply part scores (×2 at 6
  // hits, ×3 at 12, ×4 at 18; 2s between hits keeps the chain alive).
  chain = 0
  chainMult = 1
  private chainAt = -10

  // Bumper frenzy: 15 bumper hits in one ball → bumpers pay triple for 12s.
  private bumperHits = 0
  frenzyUntil = -1

  // Clear BOTH drop banks during one ball for a bonus.
  private bankClearedL = false
  private bankClearedR = false
  private bankResetAt: [number, number] = [-1, -1]   // left, right

  // Missions — the saucer starts the next one; each runs against a clock.
  mission: MissionId | null = null
  missionProgress = 0
  missionLeft = 0
  missionsDone: boolean[] = MISSIONS.map(() => false)
  private missionNext = 0

  // Multiball — spell o·r·b on the standups to light the lock, then the ramp
  // parks the ball on the rail. Two parked and a third up the ramp frees all.
  lockLit = false
  locked = 0
  multiball = false
  jackpots = 0
  rampHeat = 0

  // Kickback — lit, the left outlane throws the ball back once.
  kickback = true
  kickHeat = 0
  private kickGraceUntil = -1

  // Nudge and tilt.
  tiltWarnings = 0
  tilted = false
  private nudgeAt = -10
  private tiltForgetAt = -1
  shake = 0                    // the table's jolt, for the renderer

  captive = { heat: 0, travel: 0, vel: 0 }

  segs: Seg[] = []
  bumpers: Bumper[] = [
    { x: 160, y: 344, r: 28, heat: 0 },
    { x: 272, y: 322, r: 24, heat: 0 },
    { x: 216, y: 432, r: 22, heat: 0 },
  ]
  posts: Post[] = [
    { x: 72, y: 674, r: 5, heat: 0 },
    { x: 360, y: 674, r: 5, heat: 0 },
    { x: 180, y: 240, r: 4.5, heat: 0 },
    { x: 252, y: 240, r: 4.5, heat: 0 },
    // Mid-field rubbers — extra chaos on the way down.
    { x: 132, y: 604, r: 6, heat: 0, bouncy: true },
    { x: 322, y: 648, r: 6, heat: 0, bouncy: true },
    // Skill-shot deflector near the lane exit: launch power decides
    // whether the ball clips it or sails past into the left orbit.
    { x: 386, y: 146, r: 5.5, heat: 0, bouncy: true },
  ]
  /** Top lanes a · b · c, between four short dividers. */
  rollovers: Rollover[] = [
    { x: 180, y: 178, r: 9, lit: false, heat: 0, label: 'a' },
    { x: 216, y: 178, r: 9, lit: false, heat: 0, label: 'b' },
    { x: 252, y: 178, r: 9, lit: false, heat: 0, label: 'c' },
  ]
  targets: DropTarget[] = [
    // Left bank faces right…
    { x: 94, y0: 400, y1: 426, down: false, heat: 0, face: 1 },
    { x: 94, y0: 434, y1: 460, down: false, heat: 0, face: 1 },
    { x: 94, y0: 468, y1: 494, down: false, heat: 0, face: 1 },
    // …right bank faces left.
    { x: 350, y0: 380, y1: 406, down: false, heat: 0, face: -1 },
    { x: 350, y0: 414, y1: 440, down: false, heat: 0, face: -1 },
    { x: 350, y0: 448, y1: 474, down: false, heat: 0, face: -1 },
  ]
  standups: Standup[] = [
    { seg: seg(78, 306, 94, 276, 0.9, { kind: 'standup', standupIdx: 0 }), heat: 0, lit: false, label: 'o', lx: 110, ly: 297 },
    { seg: seg(104, 266, 122, 240, 0.9, { kind: 'standup', standupIdx: 1 }), heat: 0, lit: false, label: 'r', lx: 137, ly: 259 },
    { seg: seg(338, 312, 354, 284, 0.9, { kind: 'standup', standupIdx: 2 }), heat: 0, lit: false, label: 'b', lx: 322, ly: 301 },
  ]
  /** Star rollovers below the saucer. */
  stars: Light[] = [
    { x: 170, y: 664, r: 8, lit: false, heat: 0 },
    { x: 216, y: 680, r: 8, lit: false, heat: 0 },
    { x: 262, y: 664, r: 8, lit: false, heat: 0 },
  ]
  /** Lane lights: left outlane, left inlane, right inlane, right outlane. */
  lanes: Light[] = [
    { x: 46, y: 706, r: 10, lit: false, heat: 0 },
    { x: 90, y: 692, r: 10, lit: false, heat: 0 },
    { x: 342, y: 692, r: 10, lit: false, heat: 0 },
    { x: 386, y: 706, r: 10, lit: false, heat: 0 },
  ]
  popups: Popup[] = []

  // Which sensors each ball is standing in (so a pass counts once).
  private inside = new Map<Ball, Set<object>>()

  constructor() {
    this.buildStaticGeometry()
  }

  private buildStaticGeometry() {
    const s = this.segs
    // Top dome — arc from left wall to right wall.
    const cx = 230, cy = 230, r = 210, N = 28
    for (let i = 0; i < N; i++) {
      const t0 = Math.PI + (i / N) * Math.PI
      const t1 = Math.PI + ((i + 1) / N) * Math.PI
      // Dome friction spreads launch power: only a full pull survives the
      // whole arc into the left orbit; softer pulls peel off into the lanes.
      s.push(seg(cx + r * Math.cos(t1), cy + r * Math.sin(t1), cx + r * Math.cos(t0), cy + r * Math.sin(t0), 0.5, { friction: 0.978, look: 'none' }))
    }
    // Left wall + right outer wall
    s.push(seg(20, 230, 20, 740, 0.4, { look: 'none' }))
    s.push(seg(440, 820, 440, 230, 0.4, { look: 'none' }))
    // Left outlane slant → drain
    s.push(seg(20, 740, 136, 848, 0.35, { look: 'faint' }))
    // Shooter lane inner wall — sealed to the floor (a side hole here let
    // the ball squeeze in and catapult back out).
    s.push(seg(LANE_X, 284, LANE_X, 820, 0.4, { look: 'faint' }))
    s.push(seg(LANE_X, 820, LANE_X, 284, 0.4, { look: 'none' }))
    // Right outlane slant → drain
    s.push(seg(LANE_X, 820, 296, 852, 0.35, { look: 'faint' }))
    // Shooter lane floor (plunger deck)
    s.push(seg(LANE_X, 820, 440, 820, 0.3, { look: 'none' }))
    // One-way flap over the lane exit — launched balls pass, field balls don't re-enter.
    s.push(seg(LANE_X, 284, 440, 256, 0.35, { oneWay: true }))
    // The outlanes' shoulders: they narrow each outlane's mouth, so most of
    // what comes down the sides is turned in toward the inlane.
    s.push(seg(20, 646, 44, 676, 0.4, { look: 'guide' }))
    s.push(seg(388, 676, LANE_X, 646, 0.4, { look: 'guide' }))
    // Inlane guides (vertical) + inlane floors feeding the flippers.
    // Guide bottoms sit HIGH so the outlane channel stays wider than the
    // ball — longer guides wedged the ball permanently.
    s.push(seg(72, 680, 72, 750, 0.4, { look: 'guide' }))
    s.push(seg(72, 750, 72, 680, 0.4, { look: 'none' }))
    s.push(seg(72, 750, 146, 808, 0.35, { look: 'guide' }))
    s.push(seg(360, 750, 360, 680, 0.4, { look: 'guide' }))
    s.push(seg(360, 680, 360, 750, 0.4, { look: 'none' }))
    s.push(seg(286, 808, 360, 750, 0.35, { look: 'guide' }))
    // Slingshots — outer face kicks. Sling bottoms sit HIGH: the inlane
    // floor passes underneath, and lower corners narrowed that passage to
    // a ball wedge.
    s.push(seg(106, 700, 154, 768, 1.05, { kind: 'sling-l' }))
    s.push(seg(154, 768, 106, 756, 0.4, { look: 'none' }))
    s.push(seg(106, 756, 106, 700, 0.4, { look: 'none' }))
    s.push(seg(278, 768, 326, 700, 1.05, { kind: 'sling-r' }))
    s.push(seg(326, 700, 326, 756, 0.4, { look: 'none' }))
    s.push(seg(326, 756, 278, 768, 0.4, { look: 'none' }))
    // Drop-target bank backing walls (targets themselves are dynamic).
    // Caps are sloped TOWARD the open side so a ball can neither nap on
    // top of a bank nor settle in the pocket behind a dropped target.
    s.push(seg(86, 388, 94, 396, 0.4, { look: 'faint' }))
    // (the left bank's foot runs on down to the upper flipper's hinge, so a
    // ball cannot sit balanced on the hinge)
    s.push(seg(86, 496, 103, 518, 0.4, { look: 'faint' }))
    s.push(seg(86, 496, 86, 388, 0.4, { look: 'faint' }))
    s.push(seg(354, 376, 362, 368, 0.4, { look: 'faint' }))
    s.push(seg(362, 478, 354, 486, 0.4, { look: 'faint' }))
    s.push(seg(362, 368, 362, 486, 0.4, { look: 'faint' }))
    // Lane dividers at the top.
    for (const x of [162, 198, 234, 270]) s.push(seg(x, 160, x, 194, 0.45, { look: 'none' }))
    // The ramp's mouth: two short lips. Past them the ramp is off the table.
    for (const side of [-1, 1]) {
      const ax = RAMP.mx + side * RAMP.half * -RAMP.dy, ay = RAMP.my + side * RAMP.half * RAMP.dx
      const bx = ax + RAMP.dx * 34 - side * 3 * -RAMP.dy, by = ay + RAMP.dy * 34 - side * 3 * RAMP.dx
      s.push(seg(ax, ay, bx, by, 0.4, { look: 'none' }))
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────

  start() {
    this.phase = 'live'
    this.score = 0
    this.ballNumber = 1
    this.ballsTotal = BALLS_PER_GAME
    this.bonusUnits = 0
    this.bonusMult = 1
    this.extraBallGiven = false
    this.popups = []
    this.balls = []
    this.inside.clear()
    for (const t of this.targets) t.down = false
    this.bankResetAt = [-1, -1]
    for (const ro of this.rollovers) { ro.lit = false; ro.heat = 0 }
    for (const st of this.standups) st.lit = false
    for (const l of this.stars) l.lit = false
    for (const l of this.lanes) l.lit = false
    this.saucer.holding = false
    this.saucer.holdUntil = -1
    this.saucer.cooldownUntil = -1
    this.saucerVisits = 0
    this.mission = null
    this.missionProgress = 0
    this.missionLeft = 0
    this.missionsDone = MISSIONS.map(() => false)
    this.missionNext = 0
    this.lockLit = false
    this.locked = 0
    this.multiball = false
    this.jackpots = 0
    this.kickback = true
    this.newBall()
  }

  /** Restart mid-game (header reset button). */
  reset() {
    this.start()
  }

  setFlipper(side: 'left' | 'right', pressed: boolean) {
    if (pressed && !this.pressed[side] && this.phase === 'live' && !this.tilted) this.rotateLanes(side === 'left' ? -1 : 1)
    this.pressed[side] = pressed
  }

  /** Hold-to-charge plunger (keyboard). */
  setPlungerDown(down: boolean) {
    if (this.phase !== 'captive') { this.plungerDown = false; return }
    if (this.plungerDown && !down) this.launch()
    else this.plungerDown = down
  }

  /** Direct pull (touch drag), 0..1. */
  setPlungerPull(pull: number) {
    if (this.phase !== 'captive') return
    this.plungerPull = Math.max(0, Math.min(1, pull))
  }

  releasePlunger() {
    if (this.phase !== 'captive') return
    this.launch()
  }

  /** A shove of the table: every loose ball jumps. Two warnings, then tilt. */
  nudge() {
    if (this.phase !== 'live' || this.tilted) return
    if (this.time - this.nudgeAt < NUDGE_COOLDOWN_S) return
    this.nudgeAt = this.time
    this.shake = 1
    if (this.tiltWarnings >= TILT_WARNINGS) {
      this.tilted = true
      this.pressed.left = false
      this.pressed.right = false
      this.mission = null
      this.popups.push({ x: TABLE_W / 2, y: 420, text: 'tilt', age: 0, ttl: 1.8, big: true })
      return
    }
    this.tiltWarnings += 1
    this.tiltForgetAt = this.time + TILT_FORGET_S
    for (const b of this.balls) {
      if (b.mode !== 'free') continue
      b.vy -= 190
      b.vx += (b.x < TABLE_W / 2 ? 1 : -1) * 70
    }
  }

  hud(): PinballHud {
    return {
      mission: this.mission,
      missionProgress: this.missionProgress,
      missionGoal: this.mission ? MISSION_GOAL[this.mission] : 0,
      missionSeconds: this.mission ? Math.max(0, Math.ceil(this.missionLeft)) : 0,
      missionsDone: this.missionsDone,
      orb: this.standups.map(s => s.lit),
      lockLit: this.lockLit,
      locked: this.locked,
      multiball: this.multiball,
      jackpots: this.jackpots,
      kickback: this.kickback,
      tiltWarnings: this.tiltWarnings,
      tilted: this.tilted,
    }
  }

  /** A short string that changes whenever the hud would read differently. */
  hudKey(): string {
    return [
      this.mission ?? '-', this.missionProgress, this.mission ? Math.ceil(this.missionLeft) : 0,
      this.missionsDone.map(d => (d ? 1 : 0)).join(''), this.standups.map(s => (s.lit ? 1 : 0)).join(''),
      this.lockLit ? 1 : 0, this.locked, this.multiball ? 1 : 0, this.jackpots, this.kickback ? 1 : 0,
      this.tiltWarnings, this.tilted ? 1 : 0,
    ].join('|')
  }

  private plungerBall(): Ball | undefined {
    return this.balls.find(b => b.mode === 'plunger')
  }

  private makeBall(mode: BallMode, x: number, y: number): Ball {
    return { x, y, vx: 0, vy: 0, mode, s: 0, stopAt: -1, ax: x, ay: y, still: 0 }
  }

  private launch() {
    const b = this.plungerBall()
    if (!b) return
    const power = LAUNCH_MIN + (LAUNCH_MAX - LAUNCH_MIN) * Math.max(0.12, this.plungerPull)
    b.vx = 0
    b.vy = -power
    b.mode = 'free'
    this.plungerPull = 0
    this.plungerDown = false
    this.phase = 'live'
    this.resetWatchdog(b)
    // One save per ball: the relaunch after a save gets NO window,
    // otherwise instant drains would loop the save forever.
    this.ballSaveUntil = this.ballSaveUsed ? -1 : this.time + BALL_SAVE_S
  }

  /** Put a ball on the plunger. Parked (locked) balls stay where they are. */
  private serve() {
    this.balls = this.balls.filter(b => b.mode === 'locked')
    this.balls.push(this.makeBall('plunger', PLUNGER_X, PLUNGER_Y))
    this.plungerPull = 0
    this.plungerDown = false
    this.phase = 'captive'
    this.saucer.holding = false
  }

  private newBall() {
    this.serve()
    this.ballSaveUsed = false
    this.bonusUnits = 0
    this.bonusMult = 1
    for (const ro of this.rollovers) ro.lit = false
    this.chain = 0
    this.chainMult = 1
    this.chainAt = -10
    this.bumperHits = 0
    this.frenzyUntil = -1
    this.bankClearedL = false
    this.bankClearedR = false
    this.tilted = false
    this.tiltWarnings = 0
    this.multiball = false
  }

  /** Finish the run right now: bank the pending bonus and go to game over. */
  endNow() {
    if (this.phase !== 'live' && this.phase !== 'captive') return
    const bonus = this.tilted ? 0 : this.bonusUnits * 100 * this.bonusMult
    if (bonus > 0) this.score += bonus
    this.saucer.holding = false
    this.mission = null
    this.phase = 'over'
  }

  /** Chain bookkeeping: every part hit within 2s of the previous one grows
   *  the chain; the multiplier steps up every 6 hits (cap ×4). */
  private chained(base: number): number {
    if (this.time - this.chainAt < 2.0) this.chain += 1
    else this.chain = 1
    this.chainAt = this.time
    const mult = Math.min(4, 1 + Math.floor(this.chain / 6))
    if (mult > this.chainMult) {
      this.popups.push({ x: TABLE_W / 2, y: 300, text: `chain ×${mult}`, age: 0, ttl: 1.3, big: true })
    }
    this.chainMult = mult
    return base * mult
  }

  private resetWatchdog(b: Ball) {
    b.ax = b.x
    b.ay = b.y
    b.still = 0
  }

  // ── Scoring helpers ──────────────────────────────────────────────────────

  private addScore(n: number, x?: number, y?: number, label?: string) {
    if (this.tilted) return
    this.score += n
    if (label && x != null && y != null) {
      this.popups.push({ x, y, text: label, age: 0, ttl: 0.9 })
    }
    if (!this.extraBallGiven && this.score >= EXTRA_BALL_AT) {
      this.extraBallGiven = true
      this.ballsTotal += 1
      this.popups.push({ x: TABLE_W / 2, y: 270, text: 'extra ball', age: 0, ttl: 1.6, big: true })
    }
  }

  private big(text: string, y = 400) {
    this.popups.push({ x: TABLE_W / 2, y, text, age: 0, ttl: 1.6, big: true })
  }

  private bumpMult() {
    this.bonusMult = Math.min(6, this.bonusMult + 1)
  }

  // ── Missions ─────────────────────────────────────────────────────────────

  private startMission() {
    if (this.mission || this.tilted) return
    let idx = -1
    for (let i = 0; i < MISSIONS.length; i++) {
      const k = (this.missionNext + i) % MISSIONS.length
      if (!this.missionsDone[k]) { idx = k; break }
    }
    if (idx < 0) return
    this.mission = MISSIONS[idx]
    this.missionNext = (idx + 1) % MISSIONS.length
    this.missionProgress = 0
    this.missionLeft = MISSION_S
    this.big(`mission  ${this.mission}`, 470)
  }

  private missionHit(id: MissionId, n = 1) {
    if (this.mission !== id || this.tilted) return
    this.missionProgress = Math.min(MISSION_GOAL[id], this.missionProgress + n)
    if (this.missionProgress < MISSION_GOAL[id]) return
    this.missionsDone[MISSIONS.indexOf(id)] = true
    this.mission = null
    this.bumpMult()
    this.addScore(MISSION_PTS)
    this.big(`${id} +${MISSION_PTS.toLocaleString()}`, 470)
    if (this.missionsDone.every(Boolean)) {
      this.addScore(100_000)
      this.big('all missions +100,000', 440)
      this.missionsDone = MISSIONS.map(() => false)
    }
  }

  // ── Lane lights + kickback ───────────────────────────────────────────────

  private rotateLanes(dir: -1 | 1) {
    const lit = this.lanes.map(l => l.lit)
    const n = lit.length
    this.lanes.forEach((l, i) => { l.lit = lit[(i - dir + n) % n] })
  }

  // ── Simulation ───────────────────────────────────────────────────────────

  tick(dtMs: number) {
    let dt = Math.min(dtMs, 40) / 1000
    const frameDt = dt
    this.time += dt

    // Decay visual heat + popups regardless of phase.
    for (const b of this.bumpers) b.heat = Math.max(0, b.heat - dt * 3.2)
    for (const ro of this.rollovers) ro.heat = Math.max(0, ro.heat - dt * 2.4)
    for (const p of this.posts) p.heat = Math.max(0, p.heat - dt * 3)
    for (const t of this.targets) t.heat = Math.max(0, t.heat - dt * 3)
    for (const st of this.standups) st.heat = Math.max(0, st.heat - dt * 3)
    for (const l of this.stars) l.heat = Math.max(0, l.heat - dt * 3)
    for (const l of this.lanes) l.heat = Math.max(0, l.heat - dt * 3)
    this.slingHeat = [Math.max(0, this.slingHeat[0] - dt * 3), Math.max(0, this.slingHeat[1] - dt * 3)]
    this.saucer.heat = Math.max(0, this.saucer.heat - dt * 1.6)
    this.spinner.heat = Math.max(0, this.spinner.heat - dt * 2)
    this.spinner.rot += this.spinner.rotV * dt
    this.spinner.rotV *= Math.max(0, 1 - dt * 2.2)
    this.rampHeat = Math.max(0, this.rampHeat - dt * 1.6)
    this.kickHeat = Math.max(0, this.kickHeat - dt * 2)
    this.shake = Math.max(0, this.shake - dt * 5)
    this.captive.heat = Math.max(0, this.captive.heat - dt * 3)
    // The captive ball: thrown up its channel, pulled back down.
    this.captive.vel -= 7 * dt
    this.captive.travel += this.captive.vel * dt
    if (this.captive.travel <= 0) { this.captive.travel = 0; this.captive.vel = 0 }
    if (this.captive.travel >= 1) { this.captive.travel = 1; this.captive.vel = -Math.abs(this.captive.vel) * 0.3 }
    if (this.time - this.chainAt > 2.0 && this.chain > 0) { this.chain = 0; this.chainMult = 1 }
    this.drainFlash = Math.max(0, this.drainFlash - dt * 1.8)
    this.popups = this.popups.filter(p => (p.age += dt) < p.ttl)

    // Flipper angles move every frame (visible even while captive).
    this.updateFlippers(dt)

    if (this.phase === 'captive') {
      if (this.plungerDown) this.plungerPull = Math.min(1, this.plungerPull + dt * PLUNGER_RATE)
      // Ball rides the plunger tip as it's pulled back.
      const pb = this.plungerBall()
      if (pb) { pb.x = PLUNGER_X; pb.y = PLUNGER_Y + this.plungerPull * 7 }
      return
    }
    if (this.phase !== 'live') return

    // The mission's clock, and a tilt warning forgiven.
    if (this.mission) {
      this.missionLeft -= dt
      if (this.missionLeft <= 0) {
        this.big(`${this.mission} missed`, 470)
        this.mission = null
      }
    }
    if (this.tiltWarnings > 0 && !this.tilted && this.time >= this.tiltForgetAt) {
      this.tiltWarnings -= 1
      this.tiltForgetAt = this.time + TILT_FORGET_S
    }

    // Saucer holding a ball: pin it, then kick it out.
    if (this.saucer.holding) {
      const held = this.balls.find(b => b.mode === 'held')
      if (!held) this.saucer.holding = false
      else {
        held.x = this.saucer.x
        held.y = this.saucer.y
        held.vx = 0
        held.vy = 0
        if (this.time >= this.saucer.holdUntil) {
          this.saucer.holding = false
          this.saucer.cooldownUntil = this.time + 3
          held.mode = 'free'
          held.vx = this.saucer.ejectSide * 240
          held.vy = -960
          this.saucer.ejectSide = (this.saucer.ejectSide * -1) as 1 | -1
          this.resetWatchdog(held)
        }
      }
    }

    // Banks scheduled to pop back up
    for (const side of [0, 1] as const) {
      if (this.bankResetAt[side] >= 0 && this.time >= this.bankResetAt[side]) {
        for (const t of this.targets) if ((t.face === 1) === (side === 0)) t.down = false
        this.bankResetAt[side] = -1
      }
    }

    while (dt > 0 && this.phase === 'live') {
      const step = Math.min(SUBSTEP, dt)
      dt -= step
      this.substep(step)
    }
    if (this.phase !== 'live') return

    // Multiball is over when one ball is left.
    if (this.multiball && this.balls.filter(b => b.mode !== 'locked').length <= 1) {
      this.multiball = false
    }

    // ── Stuck-ball watchdog: if a ball barely moves for a while, free it.
    for (const b of this.balls) {
      if (b.mode !== 'free') continue
      const moved = Math.hypot(b.x - b.ax, b.y - b.ay)
      if (moved > 12) { this.resetWatchdog(b); continue }
      b.still += frameDt
      if (b.still <= 2.2) continue
      if (b.x > LANE_X && b.y > 290) {
        // Died in the shooter lane (weak plunge) → back on the plunger.
        if (this.balls.some(o => o !== b && (o.mode === 'free' || o.mode === 'rail' || o.mode === 'held'))) {
          b.vy = -LAUNCH_MIN                  // others are in play: just send it again
        } else {
          b.x = PLUNGER_X; b.y = PLUNGER_Y; b.vx = 0; b.vy = 0
          b.mode = 'plunger'
          this.plungerPull = 0
          this.plungerDown = false
          this.phase = 'captive'
        }
      } else if (!this.nearFlipper(b)) {
        // Parked in some pocket → gentle table nudge.
        b.vy -= 170
        b.vx += (b.x < TABLE_W / 2 ? 1 : -1) * (60 + Math.random() * 80)
      }
      this.resetWatchdog(b)
    }
  }

  /** True when the ball is resting on/next to a flipper (a legit cradle —
   *  never nudge those). */
  private nearFlipper(b: Ball): boolean {
    for (const f of this.flippers) {
      const dx = Math.cos(f.angle) * f.len
      const dy = Math.sin(f.angle) * f.len
      const d = distToSeg(b.x, b.y, f.px, f.py, f.px + dx, f.py + dy)
      if (d < BALL_R + f.r + 4) return true
    }
    return false
  }

  private updateFlippers(dt: number) {
    for (const f of this.flippers) {
      const target = this.pressed[f.side] && !this.tilted ? f.up : f.rest
      const prev = f.angle
      const delta = target - f.angle
      const maxStep = FLIPPER_SPEED * dt
      if (Math.abs(delta) <= maxStep) f.angle = target
      else f.angle += Math.sign(delta) * maxStep
      f.omega = dt > 0 ? (f.angle - prev) / dt : 0
    }
  }

  private substep(dt: number) {
    for (const b of this.balls.slice()) {
      if (b.mode === 'rail') { this.rideRail(b, dt); continue }
      if (b.mode !== 'free') continue
      b.vy += GRAVITY * dt
      const sp = Math.hypot(b.vx, b.vy)
      if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp }
      b.x += b.vx * dt
      b.y += b.vy * dt

      // Three resolution passes keep corners honest at high speed.
      for (let pass = 0; pass < 3; pass++) {
        this.collideSegs(b)
        this.collideCircles(b)
        this.collideFlippers(b)
      }
      this.checkSensors(b)

      // Drain
      if (b.y > TABLE_H + BALL_R) this.onDrain(b)
      if (this.phase !== 'live') return
    }
    this.collideBalls()
  }

  /** Loose balls knock each other (multiball). */
  private collideBalls() {
    const free = this.balls.filter(b => b.mode === 'free')
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const a = free[i], c = free[j]
        const dx = c.x - a.x, dy = c.y - a.y
        const dist = Math.hypot(dx, dy)
        if (dist >= BALL_R * 2 || dist < 1e-6) continue
        const nx = dx / dist, ny = dy / dist
        const push = (BALL_R * 2 - dist) / 2
        a.x -= nx * push; a.y -= ny * push
        c.x += nx * push; c.y += ny * push
        const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny
        if (rel < 0) {
          const k = rel * 0.95
          a.vx += k * nx; a.vy += k * ny
          c.vx -= k * nx; c.vy -= k * ny
        }
      }
    }
  }

  // ── Ramp, rail, lock, multiball ──────────────────────────────────────────

  private enterRamp(b: Ball) {
    b.mode = 'rail'
    b.s = Math.max(0, inRampMouth(b.x, b.y))
    b.stopAt = -1
    this.rampHeat = 1
    this.bonusUnits += 2
    this.missionHit('ramps')
    if (this.multiball) {
      this.jackpots += 1
      this.addScore(JACKPOT_PTS)
      this.big(`jackpot +${JACKPOT_PTS.toLocaleString()}`, 430)
      return
    }
    const pts = this.chained(RAMP_PTS)
    this.addScore(pts, 300, 540, `ramp +${pts.toLocaleString()}`)
    if (!this.lockLit || this.tilted) return
    this.lockLit = false
    for (const st of this.standups) st.lit = false
    if (this.locked < LOCK_STOPS.length) {
      b.stopAt = LOCK_STOPS[this.locked]
      return
    }
    // Two are waiting and here comes the third: let them all go.
    this.multiball = true
    this.locked = 0
    for (const o of this.balls) if (o.mode === 'locked') { o.mode = 'rail'; o.stopAt = -1 }
    this.big('multiball', 400)
  }

  private rideRail(b: Ball, dt: number) {
    b.s += RAIL_SPEED * dt
    if (b.stopAt >= 0 && b.s >= b.stopAt) {
      // Parked. The player gets a fresh ball; this one waits for multiball.
      b.s = b.stopAt
      const [x, y] = railPoint(b.s)
      b.x = x; b.y = y; b.vx = 0; b.vy = 0
      b.mode = 'locked'
      b.stopAt = -1
      this.locked += 1
      this.big(`ball ${this.locked} locked`, 400)
      const savedUnits = this.bonusUnits, savedMult = this.bonusMult, savedUsed = this.ballSaveUsed
      this.serve()
      this.bonusUnits = savedUnits
      this.bonusMult = savedMult
      this.ballSaveUsed = savedUsed
      return
    }
    if (b.s >= RAIL.total) {
      // Off the end, onto the upper flipper.
      b.mode = 'free'
      b.x = 106; b.y = 503
      b.vx = 80; b.vy = 40
      this.resetWatchdog(b)
      return
    }
    const [x, y] = railPoint(b.s)
    b.x = x; b.y = y
  }

  // ── Collisions ───────────────────────────────────────────────────────────

  private collideSegs(b: Ball) {
    for (const s of this.segs) this.collideSeg(b, s)
    // Standup targets — always solid, score + flash on hit; each lights its letter.
    for (const st of this.standups) {
      if (this.collideSeg(b, st.seg)) {
        if (st.heat < 0.5) {
          this.bonusUnits += 1
          const stPts = this.chained(150)
          this.addScore(stPts, st.lx, st.ly - 18, `+${stPts}`)
          if (!st.lit && !this.lockLit && !this.multiball) {
            st.lit = true
            if (this.standups.every(o => o.lit)) {
              this.lockLit = true
              this.big(this.locked >= LOCK_STOPS.length ? 'multiball is lit' : 'lock is lit', 400)
            }
          }
        }
        st.heat = 1
      }
    }
    // Dynamic drop targets as short vertical segments facing the field.
    for (const t of this.targets) {
      if (t.down) continue
      const hit = this.collideSeg(b, seg(t.x, t.y0, t.x, t.y1, 0.5))
      if (!hit) continue
      t.down = true
      t.heat = 1
      this.bonusUnits += 2
      const tPts = this.chained(300)
      this.addScore(tPts, t.x + t.face * 26, (t.y0 + t.y1) / 2, `+${tPts}`)
      this.missionHit('banks')
      const bank = this.targets.filter(tt => tt.face === t.face)
      if (bank.every(tt => tt.down)) {
        this.bumpMult()
        this.addScore(2500, t.face === 1 ? 156 : 290, 440, `bank +2500`)
        this.bankResetAt[t.face === 1 ? 0 : 1] = this.time + 0.9
        if (t.face === 1) this.bankClearedL = true
        else this.bankClearedR = true
        if (this.bankClearedL && this.bankClearedR) {
          this.bankClearedL = false
          this.bankClearedR = false
          this.addScore(10_000)
          this.big('both banks +10,000', 440)
        }
      }
    }
  }

  /** Returns true when a collision happened. */
  private collideSeg(b: Ball, s: Seg): boolean {
    const abx = s.bx - s.ax, aby = s.by - s.ay
    const apx = b.x - s.ax, apy = b.y - s.ay
    const len2 = abx * abx + aby * aby || 1
    let t = (apx * abx + apy * aby) / len2
    t = Math.max(0, Math.min(1, t))
    const px = s.ax + abx * t, py = s.ay + aby * t
    const dx = b.x - px, dy = b.y - py
    const dist = Math.hypot(dx, dy)
    if (dist >= BALL_R) return false
    // One-way flaps ignore the ball when it comes from the back side.
    const sideDot = apx * s.nx + apy * s.ny
    if (s.oneWay && sideDot < 0) return false
    let nx: number, ny: number
    if (dist > 1e-6) { nx = dx / dist; ny = dy / dist }
    else { nx = s.nx; ny = s.ny }
    // Push out
    b.x += nx * (BALL_R - dist)
    b.y += ny * (BALL_R - dist)
    const vn = b.vx * nx + b.vy * ny
    if (vn < 0) {
      b.vx -= (1 + s.e) * vn * nx
      b.vy -= (1 + s.e) * vn * ny
      // A touch of tangential friction so the ball settles on slopes.
      const fr = s.friction ?? 0.995
      b.vx *= fr
      b.vy *= fr
      if (s.kind === 'sling-l' || s.kind === 'sling-r') {
        const speed = Math.hypot(b.vx, b.vy)
        if (speed < SLING_KICK) {
          const k = SLING_KICK / (speed || 1)
          b.vx *= k; b.vy *= k
        }
        b.vx += nx * 90; b.vy += ny * 90
        this.slingHeat[s.kind === 'sling-l' ? 0 : 1] = 1
        this.bonusUnits += 1
        const slingPts = this.chained(25)
        this.addScore(slingPts, (s.ax + s.bx) / 2, (s.ay + s.by) / 2 - 14, `+${slingPts}`)
      }
    }
    return true
  }

  private collideCircles(b: Ball) {
    for (const post of this.posts) {
      const dx = b.x - post.x, dy = b.y - post.y
      const dist = Math.hypot(dx, dy)
      const minD = BALL_R + post.r
      if (dist >= minD || dist < 1e-6) continue
      const nx = dx / dist, ny = dy / dist
      b.x += nx * (minD - dist); b.y += ny * (minD - dist)
      const vn = b.vx * nx + b.vy * ny
      if (vn < 0) {
        const e = post.bouncy ? 1.75 : 1.5
        b.vx -= e * vn * nx; b.vy -= e * vn * ny
        post.heat = 1
        if (post.bouncy) this.addScore(this.chained(10))
      }
    }
    for (const bp of this.bumpers) {
      const dx = b.x - bp.x, dy = b.y - bp.y
      const dist = Math.hypot(dx, dy)
      const minD = BALL_R + bp.r
      if (dist >= minD || dist < 1e-6) continue
      const nx = dx / dist, ny = dy / dist
      b.x += nx * (minD - dist); b.y += ny * (minD - dist)
      // Pop bumper: pure radial kick at fixed speed.
      b.vx = nx * BUMPER_KICK
      b.vy = ny * BUMPER_KICK
      bp.heat = 1
      this.bonusUnits += 1
      this.bumperHits += 1
      this.missionHit('bumpers')
      if (this.bumperHits === 15) {
        this.frenzyUntil = this.time + 12
        this.big('bumper frenzy', 250)
      }
      const base = this.time < this.frenzyUntil ? 450 : 150
      const pts = this.chained(base)
      this.addScore(pts, bp.x, bp.y - bp.r - 10, `+${pts}`)
    }
    // The captive ball: it does not leave its channel; a solid knock sends it
    // up to the target at the far end.
    {
      const dx = b.x - CAPTIVE.x, dy = b.y - CAPTIVE.y
      const dist = Math.hypot(dx, dy)
      const minD = BALL_R + CAPTIVE.r
      if (dist < minD && dist > 1e-6) {
        const nx = dx / dist, ny = dy / dist
        b.x += nx * (minD - dist); b.y += ny * (minD - dist)
        const vn = b.vx * nx + b.vy * ny
        if (vn < 0) {
          b.vx -= 1.3 * vn * nx; b.vy -= 1.3 * vn * ny
          if (-vn > 260 && this.captive.travel < 0.05) {
            this.captive.vel = 4.2
            this.captive.heat = 1
            this.bonusUnits += 2
            const pts = this.chained(1000)
            this.addScore(pts, CAPTIVE.tx + 4, CAPTIVE.ty - 16, `+${pts.toLocaleString()}`)
          }
        }
      }
    }
  }

  private collideFlippers(b: Ball) {
    for (const f of this.flippers) {
      const dx = Math.cos(f.angle) * f.len
      const dy = Math.sin(f.angle) * f.len
      const ax = f.px, ay = f.py, bx2 = f.px + dx, by2 = f.py + dy
      const abx = bx2 - ax, aby = by2 - ay
      const apx = b.x - ax, apy = b.y - ay
      const len2 = abx * abx + aby * aby || 1
      let t = (apx * abx + apy * aby) / len2
      t = Math.max(0, Math.min(1, t))
      const px = ax + abx * t, py = ay + aby * t
      const ddx = b.x - px, ddy = b.y - py
      const dist = Math.hypot(ddx, ddy)
      const minD = BALL_R + f.r
      if (dist >= minD || dist < 1e-6) continue
      const nx = ddx / dist, ny = ddy / dist
      b.x += nx * (minD - dist); b.y += ny * (minD - dist)
      // Surface velocity of the flipper at the contact point (ω × r).
      const rx = px - f.px, ry = py - f.py
      const svx = -f.omega * ry
      const svy = f.omega * rx
      const rvx = b.vx - svx, rvy = b.vy - svy
      const vn = rvx * nx + rvy * ny
      if (vn < 0) {
        const e = Math.abs(f.omega) > 1 ? 0.7 : 0.35
        b.vx = rvx - (1 + e) * vn * nx + svx
        b.vy = rvy - (1 + e) * vn * ny + svy
      }
    }
  }

  /** True the first time a ball is found inside a sensor; it must leave
   *  before the sensor counts it again. */
  private entered(b: Ball, sensor: object, isIn: boolean): boolean {
    let set = this.inside.get(b)
    if (!set) { set = new Set(); this.inside.set(b, set) }
    if (!isIn) { set.delete(sensor); return false }
    if (set.has(sensor)) return false
    set.add(sensor)
    return true
  }

  private checkSensors(b: Ball) {
    // Up the ramp, fast enough: onto the rail.
    if (b.vx * RAMP.dx + b.vy * RAMP.dy > 420 && inRampMouth(b.x, b.y) > 10) {
      this.enterRamp(b)
      return
    }
    for (const ro of this.rollovers) {
      const isIn = Math.hypot(b.x - ro.x, b.y - ro.y) < ro.r + BALL_R
      if (!this.entered(b, ro, isIn) || ro.lit) continue
      ro.lit = true
      ro.heat = 1
      this.bonusUnits += 1
      const roPts = this.chained(50)
      this.addScore(roPts, ro.x, ro.y - 26, `+${roPts}`)
      this.missionHit('lanes')
      if (this.rollovers.every(r => r.lit)) {
        this.bumpMult()
        this.addScore(3000, 216, 226, `lanes +3000`)
        // Unlight after the completion so the loop can be run again.
        for (const r of this.rollovers) r.lit = false
      }
    }
    // Saucer capture — centre hit only, with a cooldown after each eject.
    const sc = this.saucer
    if (!sc.holding && this.time > sc.cooldownUntil) {
      if (Math.hypot(b.x - sc.x, b.y - sc.y) < sc.r) {
        sc.holding = true
        sc.holdUntil = this.time + 0.9
        sc.heat = 1
        b.mode = 'held'
        this.bonusUnits += 3
        this.saucerVisits += 1
        this.addScore(2500, sc.x, sc.y - 24, 'saucer +2500')
        if (this.saucerVisits % 2 === 0 && this.bonusMult < 6) this.bumpMult()
        this.startMission()
        return
      }
    }
    // Spinner — every pass through the left orbit spins it and pays out.
    const sp = this.spinner
    if (this.time > sp.cooldownUntil && Math.hypot(b.x - sp.x, b.y - sp.y) < sp.r + BALL_R) {
      sp.cooldownUntil = this.time + 0.45
      sp.rotV += 26
      sp.heat = 1
      const spPts = this.chained(250)
      this.addScore(spPts, sp.x + 26, sp.y, `+${spPts}`)
      this.missionHit('spinner')
    }
    for (const st of this.stars) {
      const isIn = Math.hypot(b.x - st.x, b.y - st.y) < st.r + BALL_R
      if (!this.entered(b, st, isIn)) continue
      st.heat = 1
      this.addScore(this.chained(100), st.x, st.y - 16, '+100')
      if (st.lit) continue
      st.lit = true
      this.bonusUnits += 1
      if (this.stars.every(o => o.lit)) {
        this.addScore(2000, 216, 646, 'stars +2000')
        for (const o of this.stars) o.lit = false
      }
    }
    for (const l of this.lanes) {
      const isIn = Math.hypot(b.x - l.x, b.y - l.y) < l.r + BALL_R
      if (!this.entered(b, l, isIn)) continue
      l.heat = 1
      this.addScore(500, l.x, l.y - 18, '+500')
      l.lit = true
      if (this.lanes.every(o => o.lit)) {
        for (const o of this.lanes) o.lit = false
        if (!this.kickback) {
          this.kickback = true
          this.big('kickback is lit', 520)
        } else {
          this.addScore(5000, 216, 646, 'lanes +5000')
        }
      }
    }
    // Kickback — deep in the left outlane, and thrown back up through its mouth.
    if (b.x < 70 && b.y > 770 && b.y < 800 && (this.kickback || this.time < this.kickGraceUntil) && !this.tilted) {
      if (this.kickback) {
        this.kickback = false
        this.kickGraceUntil = this.time + 2.5
        this.big('kickback', 520)
      }
      this.kickHeat = 1
      b.x = 55.5
      b.vx = 0
      b.vy = -1500
      this.resetWatchdog(b)
    }
  }

  private onDrain(b: Ball) {
    if (this.phase !== 'live') return
    this.balls = this.balls.filter(o => o !== b)
    this.inside.delete(b)
    // Others still in play (multiball): this one is simply gone.
    if (this.balls.some(o => o.mode === 'free' || o.mode === 'rail' || o.mode === 'held')) return
    this.drainFlash = 1
    // (a running mission waits for the next ball: its clock only runs in play)
    if (this.time < this.ballSaveUntil && !this.ballSaveUsed && !this.tilted) {
      this.big('ball saved', 420)
      const savedBonus = this.bonusUnits
      const savedMult = this.bonusMult
      this.newBall()
      this.ballSaveUsed = true      // after newBall — the respawn launch gets no save window
      this.bonusUnits = savedBonus
      this.bonusMult = savedMult
      return
    }
    // End-of-ball bonus (a tilt forfeits it)
    const bonus = this.tilted ? 0 : this.bonusUnits * 100 * this.bonusMult
    if (bonus > 0) {
      this.addScore(bonus)
      this.big(`bonus +${bonus.toLocaleString()}`, 420)
    }
    if (this.ballNumber >= this.ballsTotal) {
      this.phase = 'over'
      return
    }
    this.ballNumber += 1
    this.newBall()
  }
}

function distToSeg(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax, aby = by - ay
  const len2 = abx * abx + aby * aby || 1
  let t = ((x - ax) * abx + (y - ay) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(x - (ax + abx * t), y - (ay + aby * t))
}

// ───────────────────────────────────────────────────────────────────────────
// Renderer — two looks from one table. The print: ink structure on paper,
// klein blue + a vermilion/ochre supporting cast, glow blooms where the ball
// just hit. The arcade's flat table: paper shapes on the room's wall.
// ───────────────────────────────────────────────────────────────────────────

function withAlpha(hex: string, a: number): string {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return `rgba(${r},${g},${b},${a})`
}

type Ctx = CanvasRenderingContext2D

function line(ctx: Ctx, ax: number, ay: number, bx: number, by: number) {
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
}
function disc(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}
function ring(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
}
function pillRect(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const r = Math.min(w, h) / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fill()
}
/** A small arrow lamp pointing along `rot` (0 = up). */
function arrow(ctx: Ctx, x: number, y: number, rot: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot * Math.PI / 180)
  ctx.beginPath()
  ctx.moveTo(0, -10); ctx.lineTo(5, 5); ctx.lineTo(-5, 5)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}
function railPath(ctx: Ctx, off: number) {
  // The rail's two wires: the path itself, drawn `off` to either side.
  ctx.beginPath()
  ctx.moveTo(RAMP.ex + off, RAMP.ey)
  ctx.lineTo(RAMP.ex + off, RAIL_CY)
  ctx.arc(RAIL_CX, RAIL_CY, RAIL_R + off, 0, Math.PI, true)
  ctx.lineTo(58 - off, 470)
  ctx.quadraticCurveTo(58 - off, 502 + off * 1.4, 98, 506 + off * 1.15)
  ctx.stroke()
}
/** The ramp's floor, from its mouth round the bend to the rail. */
function rampFloor(ctx: Ctx) {
  const N = 18
  ctx.beginPath()
  for (let i = 0; i <= N; i++) {
    const p = rampAt(i / N), h = rampHalf(i / N)
    const x = p.x + h * -p.ty, y = p.y + h * p.tx
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  for (let i = N; i >= 0; i--) {
    const p = rampAt(i / N), h = rampHalf(i / N)
    ctx.lineTo(p.x - h * -p.ty, p.y - h * p.tx)
  }
  ctx.closePath()
}
function rampEdges(ctx: Ctx) {
  const N = 18
  for (const side of [-1, 1]) {
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const p = rampAt(i / N), h = rampHalf(i / N) * side
      const x = p.x + h * -p.ty, y = p.y + h * p.tx
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}
function rampChevrons(ctx: Ctx) {
  for (const t of [0.1, 0.27, 0.44]) {
    const p = rampAt(t)
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(Math.atan2(p.tx, -p.ty))
    ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(0, -4); ctx.lineTo(7, 4); ctx.stroke()
    ctx.restore()
  }
}

/** Which shots the lit arrows point at right now. */
function wanted(g: PinballGame) {
  return {
    orbit: g.mission === 'spinner',
    bankL: g.mission === 'banks',
    bankR: g.mission === 'banks',
    ramp: g.mission === 'ramps' || g.lockLit || g.multiball,
    saucer: !g.mission && !g.multiball && g.missionsDone.some(d => !d),
  }
}

export function drawPinball(
  ctx: CanvasRenderingContext2D,
  g: PinballGame,
  th: PinballTheme,
  w: number,
  h: number,
) {
  ctx.save()
  ctx.clearRect(0, 0, w, h)
  const k = Math.min(w / TABLE_W, h / TABLE_H)
  const ox = (w - TABLE_W * k) / 2
  const oy = (h - TABLE_H * k) / 2
  ctx.translate(ox, oy)
  ctx.scale(k, k)
  // A nudge jolts the whole table.
  if (g.shake > 0) ctx.translate(Math.sin(g.time * 90) * 3 * g.shake, -4 * g.shake)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (th.flat) drawFlat(ctx, g)
  else drawPrint(ctx, g, th)
  ctx.restore()
}

// ── The arcade's flat table ────────────────────────────────────────────────

function drawFlat(ctx: Ctx, g: PinballGame) {
  const P = FLAT_PAPER, INK = FLAT_INK, GOLD = FLAT_GOLD
  const dim = (a: number) => withAlpha(P, a)
  const want = wanted(g)
  const lamp = (x: number, y: number, on: boolean, r = 4.5, heat = 0) => {
    if (on || heat > 0.05) {
      ctx.fillStyle = on ? P : dim(0.3 + heat * 0.7)
      disc(ctx, x, y, r + heat * 1.5)
    } else {
      ctx.strokeStyle = dim(0.55); ctx.lineWidth = 1.5
      ring(ctx, x, y, r - 0.75)
    }
  }

  // The table: an arch, like its door in the lobby.
  ctx.fillStyle = withAlpha(INK, 0.22)
  ctx.beginPath()
  ctx.moveTo(20, 838)
  ctx.lineTo(20, 230)
  ctx.arc(230, 230, 210, Math.PI, 0)
  ctx.lineTo(440, 838)
  ctx.quadraticCurveTo(440, 860, 418, 860)
  ctx.lineTo(42, 860)
  ctx.quadraticCurveTo(20, 860, 20, 838)
  ctx.closePath()
  ctx.fill()

  // Walls: boundaries are faint, guides are solid.
  for (const s of g.segs) {
    if (s.kind || s.oneWay || s.look === 'none' || !s.look) continue
    ctx.strokeStyle = s.look === 'guide' ? P : dim(0.35)
    ctx.lineWidth = s.look === 'guide' ? 4 : 3
    line(ctx, s.ax, s.ay, s.bx, s.by)
  }
  // The flap over the lane's exit.
  ctx.strokeStyle = dim(0.35); ctx.lineWidth = 3
  line(ctx, LANE_X, 284, 432, 264)

  // Plunger — it sinks as it is pulled; a gold line shows the pull.
  ctx.fillStyle = P
  pillRect(ctx, PLUNGER_X - 7, 822 + g.plungerPull * 14, 14, 34)
  if (g.phase === 'captive' && g.plungerPull > 0.01) {
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3
    line(ctx, LANE_X + 5, 800, LANE_X + 5, 800 - 110 * g.plungerPull)
  }

  // Top lanes: four dividers, three lamps.
  ctx.fillStyle = P
  for (const x of [162, 198, 234, 270]) pillRect(ctx, x - 3, 160, 6, 34)
  for (const ro of g.rollovers) lamp(ro.x, 208, ro.lit, 4.5, ro.heat)

  // Standups o · r · b
  ctx.font = '500 15px "Instrument Sans", sans-serif'
  for (const st of g.standups) {
    const on = st.lit || g.lockLit
    ctx.strokeStyle = st.heat > 0.05 ? GOLD : dim(on ? 1 : 0.4)
    ctx.lineWidth = 7
    line(ctx, st.seg.ax, st.seg.ay, st.seg.bx, st.seg.by)
    ctx.fillStyle = dim(on ? 1 : 0.45)
    ctx.fillText(st.label, st.lx, st.ly)
  }

  // Bumpers — one colour each; they swell when struck.
  const frenzy = g.time < g.frenzyUntil
  const bumperInk = [GOLD, P, FLAT_PINK]
  g.bumpers.forEach((bp, i) => {
    if (frenzy) { ctx.strokeStyle = dim(0.6); ctx.lineWidth = 2; ring(ctx, bp.x, bp.y, bp.r + 6) }
    ctx.fillStyle = bumperInk[i % 3]
    disc(ctx, bp.x, bp.y, bp.r + bp.heat * 4)
  })

  // Spinner
  {
    const sp = g.spinner
    const c = Math.cos(sp.rot)
    ctx.strokeStyle = sp.heat > 0.05 ? GOLD : P
    ctx.lineWidth = 5
    line(ctx, sp.x - 11 * c, sp.y + 3 * c, sp.x + 11 * c, sp.y - 3 * c)
  }

  // Drop targets
  for (const t of g.targets) {
    ctx.fillStyle = t.heat > 0.05 ? GOLD : dim(t.down ? 0.2 : 1)
    pillRect(ctx, t.x - 4, t.y0, 8, t.y1 - t.y0)
  }

  // Captive ball: its channel, its target, the ball.
  ctx.strokeStyle = dim(0.22); ctx.lineWidth = 24
  line(ctx, CAPTIVE.x - 2, CAPTIVE.y + 3, CAPTIVE.tx, CAPTIVE.ty)
  ctx.strokeStyle = g.captive.heat > 0.05 ? GOLD : P; ctx.lineWidth = 6
  line(ctx, CAPTIVE.tx - 1, CAPTIVE.ty - 14, CAPTIVE.tx + 13, CAPTIVE.ty - 2)
  ctx.fillStyle = P
  disc(ctx, CAPTIVE.x + (CAPTIVE.tx - CAPTIVE.x) * g.captive.travel * 0.8, CAPTIVE.y + (CAPTIVE.ty - CAPTIVE.y) * g.captive.travel * 0.8, CAPTIVE.r)

  // Star rollovers
  for (const st of g.stars) {
    ctx.strokeStyle = dim(st.lit ? 1 : 0.5); ctx.lineWidth = 1.8
    ring(ctx, st.x, st.y, 8 + st.heat * 2)
    ctx.fillStyle = dim(st.lit ? 1 : 0.5)
    disc(ctx, st.x, st.y, 3)
  }
  // Lane lights
  for (const l of g.lanes) lamp(l.x, l.y, l.lit, 4.5, l.heat)

  // Shot arrows — gold on the shot that is wanted.
  const arrows: [number, number, number, boolean][] = [
    [46, 600, 0, want.orbit], [126, 447, -90, want.bankL], [316, 427, 90, want.bankR],
    [268, 622, 38, want.ramp], [216, 622, 0, want.saucer],
  ]
  ctx.lineWidth = 2
  for (const [x, y, rot, on] of arrows) {
    ctx.fillStyle = on ? GOLD : dim(0.28)
    ctx.strokeStyle = on ? GOLD : dim(0.28)
    arrow(ctx, x, y, rot)
  }

  // Saucer, and the five mission lamps over it.
  {
    const sc = g.saucer
    ctx.fillStyle = withAlpha(INK, 0.55)
    disc(ctx, sc.x, sc.y, sc.r)
    ctx.strokeStyle = sc.heat > 0.05 || sc.holding ? GOLD : P; ctx.lineWidth = 2.5
    ring(ctx, sc.x, sc.y, sc.r)
    MISSIONS.forEach((id, i) => {
      const a = (210 + i * 30) * Math.PI / 180
      const x = sc.x + 44 * Math.cos(a), y = sc.y + 44 * Math.sin(a)
      if (g.mission === id) { ctx.fillStyle = GOLD; disc(ctx, x, y, 5.5) }
      else lamp(x, y, g.missionsDone[i])
    })
  }

  // Posts and rubbers
  for (const p of g.posts) {
    ctx.fillStyle = p.heat > 0.05 ? GOLD : P
    disc(ctx, p.x, p.y, p.r + p.heat)
  }

  // Bonus multiplier lamps
  for (let i = 0; i < 5; i++) lamp(176 + i * 20, 730, i < g.bonusMult - 1, 4)

  // Slingshots
  const slingTris: [number, number][][] = [
    [[109, 708], [151, 765], [109, 753]],
    [[323, 708], [281, 765], [323, 753]],
  ]
  slingTris.forEach((pts, i) => {
    ctx.fillStyle = g.slingHeat[i] > 0.05 ? GOLD : P
    ctx.strokeStyle = ctx.fillStyle
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1])
    ctx.closePath(); ctx.fill(); ctx.stroke()
  })

  // Kickback — a bar lying in the left outlane's floor, a lamp over it.
  {
    const up = g.kickHeat * 9
    ctx.strokeStyle = g.kickHeat > 0.05 ? GOLD : dim(g.kickback ? 1 : 0.3)
    ctx.lineWidth = 7
    line(ctx, 40 + up * 0.7, 763 - up, 60 + up * 0.7, 781.5 - up)
    if (g.kickback) { ctx.fillStyle = GOLD; disc(ctx, 34, 736, 5) }
    else lamp(34, 736, false)
  }

  // Flippers — ink; dead grey while tilted.
  for (const f of g.flippers) {
    ctx.strokeStyle = g.tilted ? withAlpha(INK, 0.45) : INK
    ctx.lineWidth = f.r * 2 + 3
    line(ctx, f.px, f.py, f.px + Math.cos(f.angle) * f.len, f.py + Math.sin(f.angle) * f.len)
  }

  // The ramp and its rail run over everything. The ramp's floor lights gold
  // for a jackpot, and glows when the lock is lit.
  ctx.fillStyle = g.multiball ? GOLD : g.lockLit ? withAlpha(GOLD, 0.5) : dim(0.2 + g.rampHeat * 0.4)
  rampFloor(ctx)
  ctx.fill()
  ctx.strokeStyle = P; ctx.lineWidth = 2.5
  rampEdges(ctx)
  ctx.strokeStyle = g.multiball ? INK : P
  rampChevrons(ctx)
  ctx.save()
  ctx.lineCap = 'butt'
  ctx.strokeStyle = dim(0.5); ctx.lineWidth = 14
  ctx.setLineDash([1.6, 22.4])
  railPath(ctx, 0)
  ctx.restore()
  ctx.strokeStyle = dim(0.9); ctx.lineWidth = 1.8
  railPath(ctx, 7)
  railPath(ctx, -7)
  // Where a ball will wait.
  LOCK_STOPS.forEach((s, i) => {
    if (i < g.locked) return
    const [x, y] = railPoint(s)
    ctx.strokeStyle = g.lockLit && i === g.locked ? GOLD : dim(0.5); ctx.lineWidth = 1.5
    ring(ctx, x, y, 6.75)
  })

  // Balls
  if (g.phase === 'captive' || g.phase === 'live') {
    for (const b of g.balls) {
      if (b.mode === 'held') continue
      ctx.fillStyle = P
      disc(ctx, b.x, b.y, BALL_R + 0.5)
      if (b.mode === 'free' && g.time < g.ballSaveUntil && !g.ballSaveUsed) {
        ctx.strokeStyle = dim(0.7); ctx.lineWidth = 1.5
        ring(ctx, b.x, b.y, BALL_R + 5)
      }
    }
  }

  // What just happened, in words.
  for (const p of g.popups) {
    const t = p.age / p.ttl
    ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.55) / 0.45)
    ctx.fillStyle = P
    ctx.font = `500 ${p.big ? 22 : 13}px "Instrument Sans", sans-serif`
    ctx.fillText(p.text, p.x, p.y - t * 18)
    ctx.globalAlpha = 1
  }
}

// ── The print ──────────────────────────────────────────────────────────────

function setGlow(ctx: Ctx, color: string, heat: number) {
  if (heat > 0.02) {
    ctx.shadowColor = withAlpha(color, Math.min(1, heat))
    ctx.shadowBlur = 22 * heat
  }
}
function clearGlow(ctx: Ctx) {
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
}

function drawPrint(ctx: Ctx, g: PinballGame, th: PinballTheme) {
  const want = wanted(g)

  // Paper sheet
  ctx.fillStyle = th.paper
  ctx.fillRect(0, 0, TABLE_W, TABLE_H)

  // Registration dots + table title
  ctx.fillStyle = th.t3
  for (const [cx, cy] of [[8, 8], [TABLE_W - 8, 8]] as const) disc(ctx, cx, cy, 1.4)
  ctx.font = 'italic 13px "Instrument Sans", sans-serif'
  ctx.fillStyle = withAlpha(th.blue, 0.5)
  ctx.fillText('orb pinball', 216, 132)

  // Inlane arrows — faint blue chevrons pointing at the flippers
  ctx.strokeStyle = withAlpha(th.blue, 0.4)
  ctx.lineWidth = 1.4
  for (const [x, dir] of [[88, 1], [344, -1]] as const) {
    for (let i = 0; i < 2; i++) {
      const y = 716 + i * 20
      ctx.beginPath()
      ctx.moveTo(x - 4 * dir, y); ctx.lineTo(x + 2 * dir, y + 7); ctx.lineTo(x - 4 * dir, y + 14)
      ctx.stroke()
    }
  }

  // Static walls
  ctx.strokeStyle = th.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  for (const s of g.segs) {
    if (s.kind || s.oneWay) continue
    ctx.moveTo(s.ax, s.ay)
    ctx.lineTo(s.bx, s.by)
  }
  ctx.stroke()

  // One-way flap — dashed, half-tone
  ctx.strokeStyle = th.t3
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  for (const s of g.segs) if (s.oneWay) line(ctx, s.ax, s.ay, s.bx, s.by)
  ctx.setLineDash([])

  // Ramp — ochre floor and chevrons; it fills when a jackpot is on it
  ctx.fillStyle = withAlpha(INK_OCHRE, g.multiball ? 0.75 : g.lockLit ? 0.4 : 0.12 + g.rampHeat * 0.4)
  rampFloor(ctx)
  ctx.fill()
  ctx.strokeStyle = INK_OCHRE; ctx.lineWidth = 1.6
  rampEdges(ctx)
  rampChevrons(ctx)

  // Slingshots — vermilion plates, glow on kick
  const slingTris: [number, number][][] = [
    [[106, 700], [154, 768], [106, 756]],
    [[326, 700], [278, 768], [326, 756]],
  ]
  slingTris.forEach((pts, i) => {
    const heat = g.slingHeat[i]
    setGlow(ctx, INK_VERMILION, heat)
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1])
    ctx.closePath()
    ctx.fillStyle = withAlpha(INK_VERMILION, 0.14 + heat * 0.5)
    ctx.fill()
    ctx.strokeStyle = INK_VERMILION
    ctx.lineWidth = 1.6
    ctx.stroke()
    clearGlow(ctx)
  })

  // Standup targets — vermilion tabs, each with its letter
  ctx.font = 'italic 13px "Instrument Sans", sans-serif'
  for (const st of g.standups) {
    const on = st.lit || g.lockLit
    setGlow(ctx, INK_VERMILION, Math.max(st.heat, on ? 0.35 : 0))
    ctx.strokeStyle = INK_VERMILION
    ctx.lineWidth = 4
    line(ctx, st.seg.ax, st.seg.ay, st.seg.bx, st.seg.by)
    clearGlow(ctx)
    ctx.fillStyle = on ? INK_VERMILION : th.t3
    ctx.fillText(st.label, st.lx, st.ly)
  }

  // Drop-target banks — ochre
  for (const t of g.targets) {
    if (t.down) {
      ctx.strokeStyle = withAlpha(INK_OCHRE, 0.55)
      ctx.lineWidth = 1
      ctx.strokeRect(t.face === 1 ? t.x - 4 : t.x, t.y0, 4, t.y1 - t.y0)
    } else {
      setGlow(ctx, INK_OCHRE, t.heat)
      ctx.fillStyle = INK_OCHRE
      ctx.fillRect(t.face === 1 ? t.x - 5 : t.x, t.y0, 5, t.y1 - t.y0)
      clearGlow(ctx)
    }
  }

  // Rollover lanes (a · b · c) — blue
  for (const ro of g.rollovers) {
    setGlow(ctx, th.blue, Math.max(ro.heat, ro.lit ? 0.35 : 0))
    ctx.beginPath()
    ctx.arc(ro.x, ro.y, ro.r, 0, Math.PI * 2)
    if (ro.lit) { ctx.fillStyle = th.blue; ctx.fill() }
    else if (ro.heat > 0) { ctx.fillStyle = withAlpha(th.blue, ro.heat * 0.5); ctx.fill() }
    ctx.strokeStyle = ro.lit ? th.blue : th.ink
    ctx.lineWidth = 1.4
    ctx.stroke()
    clearGlow(ctx)
    ctx.fillStyle = ro.lit ? th.paper : th.ink
    ctx.font = 'italic 11px "Instrument Sans", sans-serif'
    ctx.fillText(ro.label, ro.x, ro.y + 0.5)
  }

  // Star rollovers and lane lights — small blue rings
  for (const l of [...g.stars, ...g.lanes]) {
    setGlow(ctx, th.blue, Math.max(l.heat, l.lit ? 0.3 : 0))
    ctx.strokeStyle = l.lit ? th.blue : th.t3
    ctx.lineWidth = 1.2
    ring(ctx, l.x, l.y, 6)
    if (l.lit) { ctx.fillStyle = th.blue; disc(ctx, l.x, l.y, 2.6) }
    clearGlow(ctx)
  }

  // Shot arrows
  const arrows: [number, number, number, boolean][] = [
    [46, 600, 0, want.orbit], [126, 447, -90, want.bankL], [316, 427, 90, want.bankR],
    [268, 622, 38, want.ramp], [216, 622, 0, want.saucer],
  ]
  ctx.lineWidth = 1
  for (const [x, y, rot, on] of arrows) {
    ctx.fillStyle = on ? INK_VERMILION : withAlpha(th.t3, 0.35)
    ctx.strokeStyle = ctx.fillStyle
    arrow(ctx, x, y, rot)
  }

  // Spinner — a bar that whirls in the left orbit when the ball rips past
  {
    const sp = g.spinner
    setGlow(ctx, th.blue, sp.heat)
    ctx.strokeStyle = withAlpha(th.blue, 0.45)
    ctx.lineWidth = 1
    ctx.setLineDash([2, 3])
    ring(ctx, sp.x, sp.y, sp.r)
    ctx.setLineDash([])
    const c = Math.cos(sp.rot), s2 = Math.sin(sp.rot)
    ctx.strokeStyle = sp.heat > 0.05 ? th.blue : th.ink
    ctx.lineWidth = 3
    line(ctx, sp.x - c * sp.r, sp.y - s2 * sp.r * 0.35, sp.x + c * sp.r, sp.y + s2 * sp.r * 0.35)
    clearGlow(ctx)
  }

  // Pop bumpers — ink ring, blue heart, glow bloom on hit
  const frenzyOn = g.time < g.frenzyUntil
  for (const bp of g.bumpers) {
    const heatEff = Math.max(bp.heat, frenzyOn ? 0.45 : 0)
    setGlow(ctx, th.blue, heatEff)
    if (heatEff > 0) {
      ctx.fillStyle = withAlpha(th.blue, heatEff * 0.35)
      disc(ctx, bp.x, bp.y, bp.r + 6 * heatEff)
    }
    ctx.strokeStyle = th.ink
    ctx.lineWidth = 2
    ring(ctx, bp.x, bp.y, bp.r)
    ctx.strokeStyle = bp.heat > 0.05 ? th.blue : withAlpha(th.blue, 0.45)
    ctx.lineWidth = 1.2
    ring(ctx, bp.x, bp.y, bp.r - 7)
    ctx.fillStyle = th.blue
    disc(ctx, bp.x, bp.y, 3.5)
    clearGlow(ctx)
  }

  // Captive ball — its channel dashed, a vermilion target at the far end
  ctx.strokeStyle = th.t3
  ctx.lineWidth = 1
  ctx.setLineDash([2, 3])
  line(ctx, CAPTIVE.x, CAPTIVE.y, CAPTIVE.tx, CAPTIVE.ty)
  ctx.setLineDash([])
  setGlow(ctx, INK_VERMILION, g.captive.heat)
  ctx.strokeStyle = INK_VERMILION
  ctx.lineWidth = 4
  line(ctx, CAPTIVE.tx - 1, CAPTIVE.ty - 14, CAPTIVE.tx + 13, CAPTIVE.ty - 2)
  clearGlow(ctx)
  ctx.strokeStyle = th.ink
  ctx.lineWidth = 1.6
  ring(ctx, CAPTIVE.x + (CAPTIVE.tx - CAPTIVE.x) * g.captive.travel * 0.8, CAPTIVE.y + (CAPTIVE.ty - CAPTIVE.y) * g.captive.travel * 0.8, CAPTIVE.r - 1)

  // Saucer — blue well, mission lamps in an arc over it
  {
    const sc = g.saucer
    setGlow(ctx, th.blue, Math.max(sc.heat, sc.holding ? 0.8 : 0))
    ctx.fillStyle = withAlpha(th.blue, sc.holding ? 0.85 : 0.12 + sc.heat * 0.4)
    disc(ctx, sc.x, sc.y, sc.r)
    ctx.strokeStyle = th.blue
    ctx.lineWidth = 1.6
    ring(ctx, sc.x, sc.y, sc.r)
    clearGlow(ctx)
    MISSIONS.forEach((id, i) => {
      const a = (210 + i * 30) * Math.PI / 180
      const x = sc.x + 44 * Math.cos(a), y = sc.y + 44 * Math.sin(a)
      if (g.mission === id) { ctx.fillStyle = INK_VERMILION; disc(ctx, x, y, 4.5) }
      else if (g.missionsDone[i]) { ctx.fillStyle = th.blue; disc(ctx, x, y, 4) }
      else { ctx.strokeStyle = th.t3; ctx.lineWidth = 1; ring(ctx, x, y, 3.5) }
    })
  }

  // Posts — ink dots (rubbers glow vermilion when struck)
  for (const p of g.posts) {
    setGlow(ctx, INK_VERMILION, p.heat)
    ctx.fillStyle = p.heat > 0.05 ? INK_VERMILION : th.ink
    disc(ctx, p.x, p.y, p.r)
    clearGlow(ctx)
  }

  // Bonus multiplier lamps
  for (let i = 0; i < 5; i++) {
    if (i < g.bonusMult - 1) { ctx.fillStyle = th.blue; disc(ctx, 176 + i * 20, 730, 3.5) }
    else { ctx.strokeStyle = th.t3; ctx.lineWidth = 1; ring(ctx, 176 + i * 20, 730, 3) }
  }

  // Kickback — a bar at the foot of the left outlane
  setGlow(ctx, INK_VERMILION, g.kickHeat)
  ctx.strokeStyle = g.kickback ? INK_VERMILION : th.t3
  ctx.lineWidth = 3
  line(ctx, 40 + g.kickHeat * 6, 763 - g.kickHeat * 9, 60 + g.kickHeat * 6, 781.5 - g.kickHeat * 9)
  clearGlow(ctx)

  // Plunger + power gauge
  const pull = g.plungerPull
  const deckY = 820
  ctx.strokeStyle = th.ink
  ctx.lineWidth = 2
  const springTop = deckY + 2
  const knobY = deckY + 14 + pull * 18
  ctx.beginPath()
  const coils = 4
  for (let i = 0; i <= coils; i++) {
    const yy = springTop + ((knobY - 6) - springTop) * (i / coils)
    const xx = PLUNGER_X + (i % 2 === 0 ? -6 : 6)
    if (i === 0) ctx.moveTo(PLUNGER_X, springTop)
    else ctx.lineTo(xx, yy)
  }
  ctx.lineTo(PLUNGER_X, knobY - 4)
  ctx.stroke()
  ctx.fillStyle = pull > 0.02 ? th.blue : th.ink
  disc(ctx, PLUNGER_X, Math.min(knobY, TABLE_H - 6), 5)
  if (g.phase === 'captive') {
    // Power gauge on the lane wall: ticks + blue fill by pull.
    const gx = LANE_X + 5, gy0 = 804, gh = 56
    ctx.strokeStyle = th.t3
    ctx.lineWidth = 1
    line(ctx, gx, gy0 - gh, gx, gy0)
    for (let i = 0; i <= 4; i++) {
      const yy = gy0 - (gh * i) / 4
      line(ctx, gx, yy, gx + 3.5, yy)
    }
    if (pull > 0.01) {
      ctx.strokeStyle = th.blue
      ctx.lineWidth = 3
      line(ctx, gx, gy0, gx, gy0 - gh * pull)
    }
  }

  // Flippers — solid ink capsules
  for (const f of g.flippers) {
    ctx.strokeStyle = g.tilted ? th.t3 : th.ink
    ctx.lineWidth = f.r * 2
    line(ctx, f.px, f.py, f.px + Math.cos(f.angle) * f.len, f.py + Math.sin(f.angle) * f.len)
    ctx.fillStyle = th.paper
    disc(ctx, f.px, f.py, 3)
  }

  // The rail — two blue wires over the top of the table
  ctx.strokeStyle = withAlpha(th.blue, 0.7)
  ctx.lineWidth = 1.2
  railPath(ctx, 7)
  railPath(ctx, -7)
  LOCK_STOPS.forEach((s, i) => {
    if (i < g.locked) return
    const [x, y] = railPoint(s)
    ctx.strokeStyle = g.lockLit && i === g.locked ? INK_VERMILION : th.t3
    ctx.lineWidth = 1
    ctx.setLineDash([2, 3])
    ring(ctx, x, y, 7)
    ctx.setLineDash([])
  })

  // Balls — ink coins with a paper glint; dashed blue halo during ball save
  if (g.phase === 'captive' || g.phase === 'live') {
    for (const b of g.balls) {
      if (b.mode === 'held') continue
      ctx.fillStyle = th.ink
      disc(ctx, b.x, b.y, BALL_R)
      ctx.fillStyle = th.paper
      disc(ctx, b.x - 2.2, b.y - 2.4, 1.8)
      if (b.mode === 'free' && g.time < g.ballSaveUntil && !g.ballSaveUsed) {
        ctx.strokeStyle = th.blue
        ctx.lineWidth = 1.2
        ctx.setLineDash([3, 3])
        ring(ctx, b.x, b.y, BALL_R + 5)
        ctx.setLineDash([])
      }
    }
  }

  // Score popups — italics rising off the plate
  for (const p of g.popups) {
    const t = p.age / p.ttl
    ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.55) / 0.45)
    ctx.fillStyle = th.blue
    ctx.font = `italic ${p.big ? 22 : 13}px "Instrument Sans", sans-serif`
    ctx.fillText(p.text, p.x, p.y - t * 18)
    ctx.globalAlpha = 1
  }
}
