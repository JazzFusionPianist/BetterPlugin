// Orb Merge — a suika-style drop-and-merge. Pure engine + canvas
// renderer, no React. Same-tier orbs kiss → they fuse into the next
// tier; two of the final tier annihilate for a bonus. Game over when
// the pile rests above the fill line.

export const OM_W = 340
export const OM_H = 470
export const OM_TOP = 78                 // fill line — resting above this ends the run

export const OM_RADII = [13, 17, 22, 28, 34, 41, 49, 58, 68, 79, 92]
export const OM_POINTS = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66]
export const OM_COLORS = [
  '#8FA0FF', '#2440FF', '#E8543F', '#E9A13B', '#BA78FF',
  '#5F9EA0', '#B08D57', '#D3A4FF', '#1FA05A', '#FFD24A', '#1A1917',
]
export const OM_TIERS = OM_RADII.length
const DROP_TIERS = 5
const DROP_WEIGHTS = [30, 26, 20, 14, 10]

export interface OMOrb {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  tier: number
  age: number
  born: number      // engine time, for the pop-in scale
}

function rngTier(): number {
  const total = DROP_WEIGHTS.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < DROP_TIERS; i++) {
    r -= DROP_WEIGHTS[i]
    if (r <= 0) return i
  }
  return 0
}

export class OrbMergeGame {
  orbs: OMOrb[] = []
  score = 0
  over = false
  curTier = rngTier()
  nextTier = rngTier()
  dropX = OM_W / 2
  time = 0
  private idc = 1
  private sinceDrop = 1
  private overTimer = 0

  reset(): void {
    this.orbs = []
    this.score = 0
    this.over = false
    this.curTier = rngTier()
    this.nextTier = rngTier()
    this.dropX = OM_W / 2
    this.time = 0
    this.sinceDrop = 1
    this.overTimer = 0
  }

  aim(x: number): void {
    const r = OM_RADII[this.curTier]
    this.dropX = Math.max(r + 2, Math.min(OM_W - r - 2, x))
  }

  /** Returns true when an orb was actually released. */
  drop(): boolean {
    if (this.over || this.sinceDrop < 0.3) return false
    const r = OM_RADII[this.curTier]
    this.orbs.push({
      id: this.idc++,
      x: Math.max(r + 2, Math.min(OM_W - r - 2, this.dropX)),
      y: OM_TOP - r - 4,
      vx: 0, vy: 60,
      tier: this.curTier,
      age: 0,
      born: this.time,
    })
    this.curTier = this.nextTier
    this.nextTier = rngTier()
    this.sinceDrop = 0
    return true
  }

  step(dt: number): void {
    if (this.over) return
    this.time += dt
    this.sinceDrop += dt
    const SUB = 5
    const h = Math.min(dt, 0.033) / SUB
    for (let s = 0; s < SUB; s++) this.substep(h)

    // any settled orb poking above the fill line for ~2s = game over.
    // The velocity gate is loose on purpose — a jostled pile still counts.
    let above = false
    for (const o of this.orbs) {
      if (o.age > 0.5 && Math.abs(o.vy) < 150 && o.y - OM_RADII[o.tier] * 0.5 < OM_TOP) { above = true; break }
    }
    this.overTimer = above ? this.overTimer + dt : Math.max(0, this.overTimer - dt * 0.7)
    if (this.overTimer > 2.0) this.over = true
  }

  private substep(h: number): void {
    const G = 1300
    for (const o of this.orbs) {
      o.age += h
      o.vy += G * h
      o.vx *= 1 - 0.12 * h
      o.x += o.vx * h
      o.y += o.vy * h
      const r = OM_RADII[o.tier]
      if (o.x < r) { o.x = r; o.vx = Math.abs(o.vx) * 0.2 }
      if (o.x > OM_W - r) { o.x = OM_W - r; o.vx = -Math.abs(o.vx) * 0.2 }
      if (o.y > OM_H - r) { o.y = OM_H - r; o.vy = -Math.abs(o.vy) * 0.12; o.vx *= 0.94 }
    }
    // pairwise: merge same tiers, separate the rest
    for (let i = 0; i < this.orbs.length; i++) {
      const a = this.orbs[i]
      for (let j = i + 1; j < this.orbs.length; j++) {
        const b = this.orbs[j]
        const ra = OM_RADII[a.tier], rb = OM_RADII[b.tier]
        const dx = b.x - a.x, dy = b.y - a.y
        const dd = dx * dx + dy * dy
        const rr = ra + rb
        if (dd >= rr * rr || dd === 0) continue
        if (a.tier === b.tier && a.age > 0.08 && b.age > 0.08) {
          this.merge(i, j)
          j = this.orbs.length            // indices shifted — restart inner loop
          continue
        }
        const d = Math.sqrt(dd)
        const nx = dx / d, ny = dy / d
        const overlap = rr - d
        const ma = ra * ra, mb = rb * rb
        const total = ma + mb
        a.x -= nx * overlap * (mb / total)
        a.y -= ny * overlap * (mb / total)
        b.x += nx * overlap * (ma / total)
        b.y += ny * overlap * (ma / total)
        const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (rvn < 0) {
          const imp = (-(1 + 0.08) * rvn) / (1 / ma + 1 / mb)
          a.vx -= (imp / ma) * nx
          a.vy -= (imp / ma) * ny
          b.vx += (imp / mb) * nx
          b.vy += (imp / mb) * ny
        }
      }
    }
  }

  private merge(i: number, j: number): void {
    const a = this.orbs[i], b = this.orbs[j]
    const t = a.tier
    const nx = (a.x + b.x) / 2, ny = (a.y + b.y) / 2
    this.orbs = this.orbs.filter((_, k) => k !== i && k !== j)
    if (t + 1 >= OM_TIERS) {
      this.score += 111                    // two final orbs annihilate
      return
    }
    this.score += OM_POINTS[t + 1]
    this.orbs.push({
      id: this.idc++,
      x: nx, y: ny, vx: 0, vy: -40,
      tier: t + 1, age: 0.09, born: this.time,
    })
  }
}

export interface OMTheme { paper: string; ink: string; faint: string }

export function drawOrbMerge(
  ctx: CanvasRenderingContext2D,
  g: OrbMergeGame,
  scale: number,
  theme: OMTheme,
): void {
  ctx.save()
  ctx.scale(scale, scale)
  ctx.clearRect(0, 0, OM_W, OM_H)

  // container
  ctx.strokeStyle = theme.faint
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(1, OM_TOP - 26)
  ctx.lineTo(1, OM_H - 1)
  ctx.lineTo(OM_W - 1, OM_H - 1)
  ctx.lineTo(OM_W - 1, OM_TOP - 26)
  ctx.stroke()
  // fill line
  ctx.setLineDash([4, 6])
  ctx.strokeStyle = g.over ? '#E8543F' : theme.faint
  ctx.beginPath()
  ctx.moveTo(0, OM_TOP)
  ctx.lineTo(OM_W, OM_TOP)
  ctx.stroke()
  ctx.setLineDash([])

  // aim guide + held orb
  if (!g.over) {
    const r = OM_RADII[g.curTier]
    ctx.strokeStyle = theme.faint
    ctx.setLineDash([2, 7])
    ctx.beginPath()
    ctx.moveTo(g.dropX, OM_TOP - 2)
    ctx.lineTo(g.dropX, OM_H - 4)
    ctx.stroke()
    ctx.setLineDash([])
    drawOrb(ctx, g.dropX, OM_TOP - r - 4, g.curTier, 1, theme)
  }

  for (const o of g.orbs) {
    const pop = Math.min(1, (g.time - o.born) / 0.13)
    drawOrb(ctx, o.x, o.y, o.tier, 0.72 + 0.28 * pop, theme)
  }
  ctx.restore()
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, tier: number, k: number,
  theme: OMTheme,
): void {
  const r = OM_RADII[tier] * k
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = OM_COLORS[tier]
  ctx.fill()
  ctx.lineWidth = 1.4
  ctx.strokeStyle = theme.ink
  ctx.stroke()
  // gloss
  ctx.beginPath()
  ctx.arc(x - r * 0.32, y - r * 0.36, r * 0.34, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.fill()
  // ring badge on the biggest tiers so they read at a glance
  if (tier >= 8) {
    ctx.beginPath()
    ctx.arc(x, y, r * 0.62, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
}
