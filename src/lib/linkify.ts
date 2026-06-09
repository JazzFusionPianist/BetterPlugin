import type { ReactNode } from 'react'
import { createElement, Fragment } from 'react'
import { callJuceNative, hasJuceBridge, hasJuceNativeFunction } from './juceBridge'

/**
 * Open a URL outside the current view.
 *
 * - In the JUCE WebView, calls the native `openExternal` function which
 *   defers to `juce::URL::launchInDefaultBrowser()`. Without this,
 *   clicking the link would replace the plugin UI with the URL — fatal
 *   in a hosted plugin context.
 * - In a normal browser (Vercel preview, dev server), falls back to
 *   `window.open` so the page just opens in a new tab.
 *
 * The native function is only present once the plugin binary is
 * rebuilt with handleOpenExternal registered; until then this gracefully
 * degrades to the browser path.
 */
export async function openExternalUrl (url: string): Promise<void> {
  if (hasJuceBridge && hasJuceNativeFunction('openExternal')) {
    try { await callJuceNative('openExternal', [url], 2000); return }
    catch (e) { console.warn('[openExternalUrl] native call failed', e) }
  }
  try { window.open(url, '_blank', 'noopener,noreferrer') }
  catch (e) { console.warn('[openExternalUrl] window.open failed', e) }
}

// ─── URL detection ──────────────────────────────────────────────────────────

/**
 * Match URLs in chat text. Accepts:
 *   - explicit http(s)://… URLs
 *   - bare hosts beginning with `www.`
 * We DON'T match arbitrary "example.com" without protocol or www — the
 * false-positive rate (English text with a period) is too high.
 *
 * The trailing-character cleanup below handles punctuation that
 * sometimes glues onto a URL when written in prose ("see https://x.com.").
 */
const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi

/** Punctuation we'll un-stick from the end of a captured URL. */
const TRAILING = new Set([')', ']', '}', '.', ',', ';', ':', '!', '?', '\'', '"'])

/** Pair characters — if we strip a closing paren but the URL contains
 *  an unmatched opening one, leave the close attached. */
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

function trimTrailing (url: string): { url: string; rest: string } {
  let rest = ''
  while (url.length > 0) {
    const last = url[url.length - 1]
    if (!TRAILING.has(last)) break
    // Don't strip a closing bracket if it pairs with one inside the URL.
    if (CLOSERS[last]) {
      const opens  = [...url].filter(c => c === CLOSERS[last]).length
      const closes = [...url].filter(c => c === last).length
      if (closes <= opens) break
    }
    rest = last + rest
    url = url.slice(0, -1)
  }
  return { url, rest }
}

/** Normalise the link target for href (add https:// when only www. is given). */
function toHref (raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert a plain text string into a ReactNode array with detected URLs
 * wrapped in clickable anchor elements. URLs route through
 * openExternalUrl so they don't navigate the embedded WebView.
 *
 * Pass through unchanged if no URLs are found, so the common case
 * (most chat messages) skips React-element construction.
 */
export function linkify (text: string): ReactNode {
  if (!text) return text
  URL_RE.lastIndex = 0
  if (!URL_RE.test(text)) return text
  URL_RE.lastIndex = 0

  const parts: ReactNode[] = []
  let cursor = 0
  let key = 0
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0
    if (start > cursor) parts.push(text.slice(cursor, start))
    const { url, rest } = trimTrailing(match[0])
    const href = toHref(url)
    parts.push(createElement('a', {
      key: `lk-${key++}`,
      href,
      className: 'msg-link',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        openExternalUrl(href)
      },
    }, url))
    if (rest) parts.push(rest)
    cursor = start + match[0].length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return createElement(Fragment, null, ...parts)
}
