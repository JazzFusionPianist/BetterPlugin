// Classic pinball — physics engine + two-ink canvas renderer.
// No React, no DOM state: the view owns a PinballGame instance, feeds it
// input + time, and draws every frame with drawPinball().
//
// Table anatomy (classic single-level layout):
//   - plunger lane on the right, one-way flap at the top
//   - dome guides the launched ball across the top rollover lanes (a·b·c)
//   - three pop bumpers mid-field, a 3-target drop bank on the left wall
//   - two slingshots above the flippers, in/outlanes on both sides
//   - two flippers, centre drain, ball save, end-of-ball bonus × multiplier
//
// All coordinates are in table units (420 × 720, y down). The renderer
// scales to whatever canvas it's given.

export const TABLE_W = 420
export const TABLE_H = 720

const BALL_R = 7
const GRAVITY = 1350           // u/s²
const MAX_SPEED = 1500         // u/s
const SUBSTEP = 1 / 240        // s
const FLIPPER_LEN = 58
const FLIPPER_R = 7
const FLIPPER_SPEED = 30       // rad/s
const BUMPER_KICK = 720
const SLING_KICK = 460
const LAUNCH_MIN = 1150       // even a tap clears the lane
const LAUNCH_MAX = 1780
const BALL_SAVE_S = 7
const EXTRA_BALL_AT = 75_000
const BALLS_PER_GAME = 3

export type PinballPhase = 'ready' | 'captive' | 'live' | 'over'

export interface PinballTheme {
  paper: string
  ink: string
  blue: string
  t3: string
}

interface Seg {
  ax: number; ay: number; bx: number; by: number
  nx: number; ny: number      // unit normal (side the ball bounces off)
  e: number                   // restitution
  oneWay?: boolean            // only collides when the ball is on the normal side
  kind?: 'sling-l' | 'sling-r' | 'target'
  targetIdx?: number
}

interface Bumper { x: number; y: number; r: number; heat: number }
interface Post { x: number; y: number; r: number }
interface Rollover { x: number; y: number; r: number; lit: boolean; heat: number; label: string; inside: boolean }
interface DropTarget { x: number; y0: number; y1: number; down: boolean }
interface OutlaneSensor { x: number; y: number; r: number; fired: boolean }
interface Popup { x: number; y: number; text: string; age: number; ttl: number; big?: boolean }

function seg(ax: number, ay: number, bx: number, by: number, e = 0.45, opts: Partial<Seg> = {}): Seg {
  // Normal = left of A→B direction; callers order endpoints so the
  // playfield side is on the left of the travel direction.
  const dx = bx - ax, dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  return { ax, ay, bx, by, nx: dy / len, ny: -dx / len, e, ...opts }
}

export class PinballGame {
  phase: PinballPhase = 'ready'
  score = 0
  ballNumber = 1               // 1-based
  ballsTotal = BALLS_PER_GAME
  bonusUnits = 0
  bonusMult = 1
  extraBallGiven = false

  ball = { x: 386, y: 666, vx: 0, vy: 0 }
  plungerPull = 0              // 0..1
  plungerDown = false

  flippers = {
    left:  { px: 140, py: 672, angle: 0.46, rest: 0.46, up: -0.55, pressed: false, omega: 0, dir: 1 },
    right: { px: 280, py: 672, angle: Math.PI - 0.46, rest: Math.PI - 0.46, up: Math.PI + 0.55, pressed: false, omega: 0, dir: -1 },
  }

  time = 0                     // game-time seconds
  ballSaveUntil = -1
  ballSaveUsed = false
  drainFlash = 0
  private stallTime = 0        // seconds the ball has sat near-motionless

  segs: Seg[] = []
  bumpers: Bumper[] = [
    { x: 155, y: 345, r: 24, heat: 0 },
    { x: 258, y: 318, r: 24, heat: 0 },
    { x: 204, y: 438, r: 24, heat: 0 },
  ]
  posts: Post[] = [
    { x: 66, y: 534, r: 5 },
    { x: 354, y: 534, r: 5 },
    { x: 172, y: 252, r: 4.5 },
    { x: 237, y: 252, r: 4.5 },
  ]
  rollovers: Rollover[] = [
    { x: 138, y: 268, r: 11, lit: false, heat: 0, label: 'a', inside: false },
    { x: 204, y: 240, r: 11, lit: false, heat: 0, label: 'b', inside: false },
    { x: 270, y: 268, r: 11, lit: false, heat: 0, label: 'c', inside: false },
  ]
  targets: DropTarget[] = [
    { x: 88, y0: 330, y1: 356, down: false },
    { x: 88, y0: 364, y1: 390, down: false },
    { x: 88, y0: 398, y1: 424, down: false },
  ]
  private targetResetAt = -1
  outlanes: OutlaneSensor[] = [
    { x: 42, y: 616, r: 14, fired: false },
    { x: 363, y: 610, r: 12, fired: false },
  ]
  popups: Popup[] = []

  constructor() {
    this.buildStaticGeometry()
  }

  private buildStaticGeometry() {
    const s = this.segs
    // Top dome — arc from left wall to right wall.
    const cx = 210, cy = 210, r = 190, N = 26
    for (let i = 0; i < N; i++) {
      const t0 = Math.PI + (i / N) * Math.PI
      const t1 = Math.PI + ((i + 1) / N) * Math.PI
      // Order: right→left along the arc so the inward side is the normal side.
      s.push(seg(cx + r * Math.cos(t1), cy + r * Math.sin(t1), cx + r * Math.cos(t0), cy + r * Math.sin(t0), 0.5))
    }
    // Left wall + right outer wall
    s.push(seg(20, 210, 20, 600, 0.4))          // normal → +x (into field)
    s.push(seg(400, 680, 400, 210, 0.4))        // normal → −x
    // Left outlane slant → drain
    s.push(seg(20, 600, 130, 708, 0.35))
    // Shooter lane inner wall — runs all the way to the lane floor so the
    // lane is sealed except for the flap up top (a side hole here let the
    // ball squeeze in and catapult back out).
    s.push(seg(372, 250, 372, 680, 0.4))
    s.push(seg(372, 680, 372, 250, 0.4))
    // Right outlane slant → drain
    s.push(seg(372, 680, 290, 712, 0.35))
    // Shooter lane floor (plunger deck)
    s.push(seg(372, 680, 400, 680, 0.3))
    // One-way flap over the lane exit — launched balls pass, field balls don't re-enter.
    s.push(seg(372, 250, 400, 222, 0.35, { oneWay: true }))
    // Inlane guides (vertical) + inlane floors feeding the flippers.
    // Guide bottoms sit HIGH (y=610) so the outlane channel between the
    // guide corner and the drain slant stays wider than the ball — with
    // longer guides the corner gap wedged the ball permanently.
    s.push(seg(66, 540, 66, 610, 0.4))          // left guide, field side
    s.push(seg(66, 610, 66, 540, 0.4))          // left guide, outlane side
    s.push(seg(66, 610, 140, 668, 0.35))        // left inlane floor
    s.push(seg(354, 610, 354, 540, 0.4))        // right guide, field side
    s.push(seg(354, 540, 354, 610, 0.4))        // right guide, outlane side
    s.push(seg(280, 668, 354, 610, 0.35))       // right inlane floor
    // Slingshots — outer face kicks
    s.push(seg(100, 560, 148, 628, 1.05, { kind: 'sling-l' }))
    s.push(seg(148, 628, 100, 634, 0.4))
    s.push(seg(100, 634, 100, 560, 0.4))
    s.push(seg(272, 628, 320, 560, 1.05, { kind: 'sling-r' }))
    s.push(seg(320, 560, 320, 634, 0.4))
    s.push(seg(320, 634, 272, 628, 0.4))
    // Drop-target bank backing wall (targets themselves are dynamic)
    s.push(seg(80, 322, 88, 322, 0.4))
    s.push(seg(88, 432, 80, 432, 0.4))
    s.push(seg(80, 432, 80, 322, 0.4))
  }

  // ── Input ────────────────────────────────────────────────────────────────

  start() {
    if (this.phase !== 'ready' && this.phase !== 'over') return
    this.score = 0
    this.ballNumber = 1
    this.ballsTotal = BALLS_PER_GAME
    this.bonusUnits = 0
    this.bonusMult = 1
    this.extraBallGiven = false
    this.popups = []
    this.resetTargets()
    for (const ro of this.rollovers) { ro.lit = false; ro.heat = 0 }
    this.newBall()
  }

  setFlipper(side: 'left' | 'right', pressed: boolean) {
    this.flippers[side].pressed = pressed
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

  private launch() {
    const power = LAUNCH_MIN + (LAUNCH_MAX - LAUNCH_MIN) * Math.max(0.18, this.plungerPull)
    this.ball.vx = 0
    this.ball.vy = -power
    this.plungerPull = 0
    this.plungerDown = false
    this.phase = 'live'
    // One save per ball: the relaunch after a save gets NO window,
    // otherwise instant drains would loop the save forever.
    this.ballSaveUntil = this.ballSaveUsed ? -1 : this.time + BALL_SAVE_S
  }

  private newBall() {
    this.ball = { x: 386, y: 666, vx: 0, vy: 0 }
    this.plungerPull = 0
    this.plungerDown = false
    this.phase = 'captive'
    this.ballSaveUsed = false
    this.bonusUnits = 0
    this.bonusMult = 1
    for (const ro of this.rollovers) ro.lit = false
    for (const o of this.outlanes) o.fired = false
  }

  // ── Scoring helpers ──────────────────────────────────────────────────────

  private addScore(n: number, x?: number, y?: number, label?: string) {
    this.score += n
    if (label && x != null && y != null) {
      this.popups.push({ x, y, text: label, age: 0, ttl: 0.9 })
    }
    if (!this.extraBallGiven && this.score >= EXTRA_BALL_AT) {
      this.extraBallGiven = true
      this.ballsTotal += 1
      this.popups.push({ x: TABLE_W / 2, y: 300, text: 'extra ball', age: 0, ttl: 1.6, big: true })
    }
  }

  private resetTargets() {
    for (const t of this.targets) t.down = false
    this.targetResetAt = -1
  }

  // ── Simulation ───────────────────────────────────────────────────────────

  tick(dtMs: number) {
    let dt = Math.min(dtMs, 40) / 1000
    this.time += dt

    // Decay visual heat + popups regardless of phase.
    for (const b of this.bumpers) b.heat = Math.max(0, b.heat - dt * 3.2)
    for (const ro of this.rollovers) ro.heat = Math.max(0, ro.heat - dt * 2.4)
    this.drainFlash = Math.max(0, this.drainFlash - dt * 1.8)
    this.popups = this.popups.filter(p => (p.age += dt) < p.ttl)

    // Flipper angles move every frame (visible even while captive).
    this.updateFlippers(dt)

    if (this.phase === 'captive') {
      if (this.plungerDown) this.plungerPull = Math.min(1, this.plungerPull + dt * 1.15)
      // Ball rides the plunger tip as it's pulled back.
      this.ball.x = 386
      this.ball.y = 666 + this.plungerPull * 7
      return
    }
    if (this.phase !== 'live') return

    // Targets scheduled to pop back up
    if (this.targetResetAt >= 0 && this.time >= this.targetResetAt) this.resetTargets()

    while (dt > 0) {
      const step = Math.min(SUBSTEP, dt)
      dt -= step
      this.substep(step)
      if (this.phase !== 'live') break
    }
  }

  private updateFlippers(dt: number) {
    for (const side of ['left', 'right'] as const) {
      const f = this.flippers[side]
      const target = f.pressed ? f.up : f.rest
      const prev = f.angle
      const delta = target - f.angle
      const maxStep = FLIPPER_SPEED * dt
      if (Math.abs(delta) <= maxStep) f.angle = target
      else f.angle += Math.sign(delta) * maxStep
      f.omega = dt > 0 ? (f.angle - prev) / dt : 0
    }
  }

  private substep(dt: number) {
    const b = this.ball
    b.vy += GRAVITY * dt
    const sp = Math.hypot(b.vx, b.vy)
    if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp }
    b.x += b.vx * dt
    b.y += b.vy * dt

    // Two resolution passes keep corners honest at high speed.
    for (let pass = 0; pass < 2; pass++) {
      this.collideSegs()
      this.collideCircles()
      this.collideFlippers()
    }
    this.checkSensors()

    // Anti-stall: a ball parked on some geometry pocket above the flipper
    // zone gets a gentle table nudge (never touches a flipper cradle).
    const speed2 = Math.hypot(b.vx, b.vy)
    if (speed2 < 15 && b.y < 640) {
      this.stallTime += dt
      if (this.stallTime > 1.5) {
        this.stallTime = 0
        b.vy -= 130
        b.vx += (b.x < TABLE_W / 2 ? 1 : -1) * (40 + Math.random() * 60)
      }
    } else {
      this.stallTime = 0
    }

    // Drain
    if (b.y > TABLE_H + BALL_R) this.onDrain()
  }

  private collideSegs() {
    for (const s of this.segs) this.collideSeg(s)
    // Dynamic drop targets as short vertical segments facing the field.
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i]
      if (t.down) continue
      const hit = this.collideSeg(seg(t.x, t.y0, t.x, t.y1, 0.5))
      if (hit) {
        t.down = true
        this.bonusUnits += 2
        this.addScore(300, t.x + 26, (t.y0 + t.y1) / 2, '+300')
        if (this.targets.every(tt => tt.down)) {
          this.bonusMult = Math.min(6, this.bonusMult + 1)
          this.addScore(2500, 150, 380, `bank +2500 · bonus ×${this.bonusMult}`)
          this.targetResetAt = this.time + 0.9
        }
      }
    }
  }

  /** Returns true when a collision happened. */
  private collideSeg(s: Seg): boolean {
    const b = this.ball
    const abx = s.bx - s.ax, aby = s.by - s.ay
    const apx = b.x - s.ax, apy = b.y - s.ay
    const len2 = abx * abx + aby * aby || 1
    let t = (apx * abx + apy * aby) / len2
    t = Math.max(0, Math.min(1, t))
    const px = s.ax + abx * t, py = s.ay + aby * t
    let dx = b.x - px, dy = b.y - py
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
      b.vx *= 0.995
      b.vy *= 0.995
      if (s.kind === 'sling-l' || s.kind === 'sling-r') {
        const speed = Math.hypot(b.vx, b.vy)
        if (speed < SLING_KICK) {
          const k = SLING_KICK / (speed || 1)
          b.vx *= k; b.vy *= k
        }
        b.vx += nx * 90; b.vy += ny * 90
        this.bonusUnits += 1
        this.addScore(25, (s.ax + s.bx) / 2, (s.ay + s.by) / 2 - 14, '+25')
      }
    }
    return true
  }

  private collideCircles() {
    const b = this.ball
    for (const post of this.posts) {
      const dx = b.x - post.x, dy = b.y - post.y
      const dist = Math.hypot(dx, dy)
      const minD = BALL_R + post.r
      if (dist >= minD || dist < 1e-6) continue
      const nx = dx / dist, ny = dy / dist
      b.x += nx * (minD - dist); b.y += ny * (minD - dist)
      const vn = b.vx * nx + b.vy * ny
      if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny }
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
      this.addScore(150, bp.x, bp.y - bp.r - 10, '+150')
    }
  }

  private collideFlippers() {
    const b = this.ball
    for (const side of ['left', 'right'] as const) {
      const f = this.flippers[side]
      const dx = Math.cos(f.angle) * FLIPPER_LEN
      const dy = Math.sin(f.angle) * FLIPPER_LEN
      const ax = f.px, ay = f.py, bx2 = f.px + dx, by2 = f.py + dy
      const abx = bx2 - ax, aby = by2 - ay
      const apx = b.x - ax, apy = b.y - ay
      const len2 = abx * abx + aby * aby || 1
      let t = (apx * abx + apy * aby) / len2
      t = Math.max(0, Math.min(1, t))
      const px = ax + abx * t, py = ay + aby * t
      const ddx = b.x - px, ddy = b.y - py
      const dist = Math.hypot(ddx, ddy)
      const minD = BALL_R + FLIPPER_R
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

  private checkSensors() {
    const b = this.ball
    for (const ro of this.rollovers) {
      const d = Math.hypot(b.x - ro.x, b.y - ro.y)
      const inside = d < ro.r + BALL_R
      if (inside && !ro.inside) {
        ro.inside = true
        if (!ro.lit) {
          ro.lit = true
          ro.heat = 1
          this.bonusUnits += 1
          this.addScore(50, ro.x, ro.y - 20, '+50')
          if (this.rollovers.every(r => r.lit)) {
            this.bonusMult = Math.min(6, this.bonusMult + 1)
            this.addScore(3000, 204, 210, `lanes +3000 · bonus ×${this.bonusMult}`)
            // Unlight after the completion so the loop can be run again.
            for (const r of this.rollovers) r.lit = false
          }
        }
      } else if (!inside) {
        ro.inside = false
      }
    }
    for (const o of this.outlanes) {
      if (o.fired) continue
      if (Math.hypot(b.x - o.x, b.y - o.y) < o.r + BALL_R) {
        o.fired = true
        this.addScore(500, o.x, o.y - 16, '+500')
      }
    }
  }

  private onDrain() {
    if (this.phase !== 'live') return
    this.drainFlash = 1
    if (this.time < this.ballSaveUntil && !this.ballSaveUsed) {
      this.popups.push({ x: TABLE_W / 2, y: 420, text: 'ball saved', age: 0, ttl: 1.4, big: true })
      const savedBonus = this.bonusUnits
      const savedMult = this.bonusMult
      this.newBall()
      this.ballSaveUsed = true      // after newBall — the respawn launch gets no save window
      this.bonusUnits = savedBonus
      this.bonusMult = savedMult
      return
    }
    // End-of-ball bonus
    const bonus = this.bonusUnits * 100 * this.bonusMult
    if (bonus > 0) {
      this.addScore(bonus)
      this.popups.push({ x: TABLE_W / 2, y: 420, text: `bonus +${bonus.toLocaleString()}`, age: 0, ttl: 1.6, big: true })
    }
    if (this.ballNumber >= this.ballsTotal) {
      this.phase = 'over'
      return
    }
    this.ballNumber += 1
    this.newBall()
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Renderer — two-ink print on paper. Hairline geometry, klein-blue accents.
// ───────────────────────────────────────────────────────────────────────────

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

  // Paper sheet + hairline frame
  ctx.fillStyle = th.paper
  ctx.fillRect(0, 0, TABLE_W, TABLE_H)

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Registration dots (quiet corners)
  ctx.fillStyle = th.t3
  for (const [cx, cy] of [[8, 8], [TABLE_W - 8, 8]] as const) {
    ctx.beginPath(); ctx.arc(cx, cy, 1.4, 0, Math.PI * 2); ctx.fill()
  }

  // Static walls
  ctx.strokeStyle = th.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  for (const s of g.segs) {
    if (s.kind === 'sling-l' || s.kind === 'sling-r') continue
    if (s.oneWay) continue
    ctx.moveTo(s.ax, s.ay)
    ctx.lineTo(s.bx, s.by)
  }
  ctx.stroke()

  // One-way flap — dashed, half-tone
  ctx.strokeStyle = th.t3
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  for (const s of g.segs) {
    if (!s.oneWay) continue
    ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by)
  }
  ctx.stroke()
  ctx.setLineDash([])

  // Slingshots — triangle plates
  drawTri(ctx, [[100, 560], [148, 628], [100, 634]], th)
  drawTri(ctx, [[320, 560], [272, 628], [320, 634]], th)

  // Drop-target bank
  for (const t of g.targets) {
    if (t.down) {
      ctx.strokeStyle = th.t3
      ctx.lineWidth = 1
      ctx.strokeRect(t.x - 4, t.y0, 4, t.y1 - t.y0)
    } else {
      ctx.fillStyle = th.ink
      ctx.fillRect(t.x - 5, t.y0, 5, t.y1 - t.y0)
    }
  }

  // Rollover lanes (a · b · c)
  for (const ro of g.rollovers) {
    ctx.beginPath()
    ctx.arc(ro.x, ro.y, ro.r, 0, Math.PI * 2)
    if (ro.lit) {
      ctx.fillStyle = th.blue
      ctx.fill()
    } else if (ro.heat > 0) {
      ctx.fillStyle = withAlpha(th.blue, ro.heat * 0.5)
      ctx.fill()
    }
    ctx.strokeStyle = ro.lit ? th.blue : th.ink
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.fillStyle = ro.lit ? th.paper : th.ink
    ctx.font = 'italic 12px Georgia, "Instrument Serif", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ro.label, ro.x, ro.y + 0.5)
  }

  // Pop bumpers — concentric print circles, blue bloom on hit
  for (const bp of g.bumpers) {
    if (bp.heat > 0) {
      ctx.beginPath()
      ctx.arc(bp.x, bp.y, bp.r + 6 * bp.heat, 0, Math.PI * 2)
      ctx.fillStyle = withAlpha(th.blue, bp.heat * 0.35)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2)
    ctx.strokeStyle = th.ink
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(bp.x, bp.y, bp.r - 7, 0, Math.PI * 2)
    ctx.strokeStyle = bp.heat > 0.05 ? th.blue : th.t3
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(bp.x, bp.y, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = bp.heat > 0.05 ? th.blue : th.ink
    ctx.fill()
  }

  // Posts
  ctx.fillStyle = th.ink
  for (const p of g.posts) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
  }

  // Outlane markers
  ctx.font = 'italic 10px Georgia, "Instrument Serif", serif'
  ctx.fillStyle = th.t3
  ctx.textAlign = 'center'
  ctx.fillText('500', 42, 600)
  ctx.fillText('500', 363, 596)

  // Plunger
  const pull = g.plungerPull
  const deckY = 680
  ctx.strokeStyle = th.ink
  ctx.lineWidth = 2
  // spring (zig-zag compresses with pull)
  const springTop = deckY + 2 + pull * 0
  const knobY = deckY + 14 + pull * 18
  ctx.beginPath()
  const coils = 4
  for (let i = 0; i <= coils; i++) {
    const yy = springTop + ((knobY - 6) - springTop) * (i / coils)
    const xx = 386 + (i % 2 === 0 ? -6 : 6)
    if (i === 0) ctx.moveTo(386, springTop)
    else ctx.lineTo(xx, yy)
  }
  ctx.lineTo(386, knobY - 4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(386, Math.min(knobY, TABLE_H - 6), 5, 0, Math.PI * 2)
  ctx.fillStyle = pull > 0.02 ? th.blue : th.ink
  ctx.fill()

  // Flippers — solid ink capsules
  for (const side of ['left', 'right'] as const) {
    const f = g.flippers[side]
    const tx = f.px + Math.cos(f.angle) * FLIPPER_LEN
    const ty = f.py + Math.sin(f.angle) * FLIPPER_LEN
    ctx.strokeStyle = th.ink
    ctx.lineWidth = FLIPPER_R * 2
    ctx.beginPath()
    ctx.moveTo(f.px, f.py)
    ctx.lineTo(tx, ty)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(f.px, f.py, 3, 0, Math.PI * 2)
    ctx.fillStyle = th.paper
    ctx.fill()
  }

  // Ball — ink coin with a paper glint; dashed blue halo during ball save
  if (g.phase === 'captive' || g.phase === 'live') {
    const b = g.ball
    ctx.beginPath()
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
    ctx.fillStyle = th.ink
    ctx.fill()
    ctx.beginPath()
    ctx.arc(b.x - 2.2, b.y - 2.4, 1.8, 0, Math.PI * 2)
    ctx.fillStyle = th.paper
    ctx.fill()
    if (g.phase === 'live' && g.time < g.ballSaveUntil && !g.ballSaveUsed) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, BALL_R + 5, 0, Math.PI * 2)
      ctx.strokeStyle = th.blue
      ctx.lineWidth = 1.2
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Score popups — serif italics rising off the plate
  for (const p of g.popups) {
    const t = p.age / p.ttl
    ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.55) / 0.45)
    ctx.fillStyle = th.blue
    ctx.font = `italic ${p.big ? 22 : 13}px Georgia, "Instrument Serif", serif`
    ctx.textAlign = 'center'
    ctx.fillText(p.text, p.x, p.y - t * 18)
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

function drawTri(ctx: CanvasRenderingContext2D, pts: [number, number][], th: PinballTheme) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  ctx.lineTo(pts[1][0], pts[1][1])
  ctx.lineTo(pts[2][0], pts[2][1])
  ctx.closePath()
  ctx.strokeStyle = th.ink
  ctx.lineWidth = 1.4
  ctx.stroke()
}

function withAlpha(hex: string, a: number): string {
  // Accepts #rgb/#rrggbb; falls back to the raw string with alpha ignored.
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return `rgba(${r},${g},${b},${a})`
}
