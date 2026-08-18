export const WEB_UI_FONT_OPTIONS = [
  'editorial',
  'arial',
  'helvetica',
  'open-sans',
  'noto-sans',
  'times-new-roman',
  'academio',
  'copperplate',
  'georgia',
  'courier',
] as const

export type WebUiFont = typeof WEB_UI_FONT_OPTIONS[number]
export type LocalUiFont = `local:${string}`
export type UiFont = WebUiFont | LocalUiFont

export function isWebUiFont(value: string | null): value is WebUiFont {
  return WEB_UI_FONT_OPTIONS.includes(value as WebUiFont)
}

export function isLocalUiFont(value: string | null): value is LocalUiFont {
  return typeof value === 'string' && value.startsWith('local:') && value.length > 'local:'.length
}

export function getLocalFontFamily(value: UiFont): string | null {
  return isLocalUiFont(value) ? value.slice('local:'.length) : null
}

/* ── Text size ──────────────────────────────────────────────────────────
   Implemented as browser-zoom on the plugin root (with compensated
   width/height so the layout still fills the host window exactly).
   Zoom scales text and chrome together, so the catalogue's proportions
   — badge heights, line-heights, hairline spacing — survive every size;
   font-size-only scaling would clip the hundreds of px-sized boxes. */
export const UI_FONT_SIZE_OPTIONS = ['small', 'default', 'large', 'xlarge'] as const
export type UiFontSize = typeof UI_FONT_SIZE_OPTIONS[number]

export const UI_FONT_SIZE_SCALE: Record<UiFontSize, number> = {
  small: 0.9,
  default: 1,
  large: 1.12,
  xlarge: 1.25,
}

export function isUiFontSize(value: string | null): value is UiFontSize {
  return UI_FONT_SIZE_OPTIONS.includes(value as UiFontSize)
}
