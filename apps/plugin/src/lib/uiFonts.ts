export const WEB_UI_FONT_OPTIONS = [
  'instrument',
  'inter',
  'roboto',
  'ibm-plex-sans',
  'ibm-plex-mono',
  'merriweather',
  'noto-sans-kr',
  'noto-serif-kr',
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
