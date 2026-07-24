/**
 * The wall is a PAGE — a fixed-proportion sheet, contain-fitted and
 * centred, so a composition arranged on one screen is the same picture
 * on every screen of that orientation. Portrait devices (phones) read
 * the 2:3 page; wide screens (desktop / iPad landscape) read a 3:2
 * page with its own stored layout slots (lx/ly/lscale, falling back to
 * the portrait values until arranged).
 *
 * Units: item x/y are fractions of the sheet. Polaroid size and stroke
 * widths are stored in reference px and multiplied by K = unit/375
 * (unit = the sheet's SHORT side), so the picture scales as one object
 * and a photo keeps its relative presence across orientations. Doodle
 * stroke points are stored in unit-space (fractions of the short side,
 * centred on the doodle's own bbox centre), which keeps ink aspect-true
 * on both page shapes.
 */

export interface WallSheet {
  x: number; y: number; w: number; h: number
  /** Sheet short side in px — the scale unit. */
  unit: number
  /** True when this viewport reads the 3:2 landscape page. */
  land: boolean
}

/** Reference short-side (px) the size units were designed at. */
export const WALL_REF_W = 375

/** Contain-fit the orientation's sheet into a w×h viewport (layout px). */
export function wallSheet(w: number, h: number): WallSheet {
  const land = w > h
  const aw = land ? 3 : 2, ah = land ? 2 : 3
  const s = Math.min(w / aw, h / ah)
  const sw = s * aw, sh = s * ah
  return { x: (w - sw) / 2, y: (h - sh) / 2, w: sw, h: sh, unit: Math.min(sw, sh), land }
}
