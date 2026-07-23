/**
 * The wall is a PAGE — a fixed 2:3 portrait sheet, the same physical
 * object on every device. Item x/y fractions are fractions OF THE
 * SHEET, and every screen shows the whole sheet contain-fitted and
 * centred (uniform scale), so a composition arranged on a phone is
 * pixel-for-pixel the same picture on a desktop, just bigger.
 */

export const WALL_AW = 2
export const WALL_AH = 3

/** Reference sheet width (px) — the size units were designed at: a
 *  phone-width sheet. Polaroid size and stroke widths are stored in
 *  reference px and multiplied by (sheet.w / WALL_REF_W) at render, so
 *  the whole picture scales as one object. */
export const WALL_REF_W = 375

export interface WallSheet { x: number; y: number; w: number; h: number }

/** Contain-fit the sheet into a w×h viewport (layout px). */
export function wallSheet(w: number, h: number): WallSheet {
  const s = Math.min(w / WALL_AW, h / WALL_AH)
  const sw = s * WALL_AW, sh = s * WALL_AH
  return { x: (w - sw) / 2, y: (h - sh) / 2, w: sw, h: sh }
}
