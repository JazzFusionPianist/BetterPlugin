import type { Stroke } from '@orb/core'

/**
 * Pencil-stroke geometry helpers. Points are flat [x0,y0,x1,y1,…] lists
 * of 0..1 canvas fractions.
 */

/**
 * Smooth path through the points — quadratic curves through segment
 * midpoints (the classic Notes-style smoothing): every captured point
 * becomes a control point, so corners round off and jitter melts away.
 */
export function strokePath(p: number[]): string {
  const n = p.length / 2
  if (n === 0) return ''
  if (n === 1) return `M ${p[0]} ${p[1]} L ${p[0]} ${p[1]}`
  if (n === 2) return `M ${p[0]} ${p[1]} L ${p[2]} ${p[3]}`
  let d = `M ${p[0]} ${p[1]}`
  for (let i = 1; i < n - 1; i++) {
    const x = p[i * 2]!, y = p[i * 2 + 1]!
    const mx = (x + p[(i + 1) * 2]!) / 2
    const my = (y + p[(i + 1) * 2 + 1]!) / 2
    d += ` Q ${x} ${y} ${mx} ${my}`
  }
  d += ` L ${p[(n - 1) * 2]} ${p[(n - 1) * 2 + 1]}`
  return d
}

/**
 * strokePath, but mapped from fraction space into pixel space:
 * X = (x - ox) * sx, Y = (y - oy) * sy. Zero-length paths (dots) get a
 * hair of length so every renderer paints the round cap.
 */
export function strokePathScaled(p: number[], sx: number, sy: number, ox = 0, oy = 0): string {
  const q: number[] = new Array(p.length)
  for (let i = 0; i + 1 < p.length; i += 2) {
    q[i] = (p[i]! - ox) * sx
    q[i + 1] = (p[i + 1]! - oy) * sy
  }
  if (q.length === 2) return `M ${q[0]} ${q[1]} l 0.01 0`
  return strokePath(q)
}

export interface BBox { x: number; y: number; w: number; h: number }

/** Bounding box over every stroke, padded a little so line caps fit. */
export function strokesBBox(strokes: Stroke[], pad = 0.012): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of strokes) {
    for (let i = 0; i + 1 < s.p.length; i += 2) {
      const x = s.p[i]!, y = s.p[i + 1]!
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!isFinite(minX)) return { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }
  return {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(0.02, maxX - minX + pad * 2),
    h: Math.max(0.02, maxY - minY + pad * 2),
  }
}
