/**
 * Keyboard-capture reporter. The native side force-feeds key events into
 * the WKWebView (Logic would otherwise eat everything typed into the
 * plugin) — but that also steals the DAW transport keys. This module
 * tells the plugin when the page actually wants the keyboard:
 *
 *   - an editable element has focus (chat, search, calendar inputs…), or
 *   - a component holding the keyboard is mounted (falling blocks).
 *
 * Everything else — including the fx room — leaves the keys to the DAW,
 * so space is play/stop even while the plugin window is key.
 * No-op outside the plugin.
 */

import { callJuceNative, hasJuceBridge, hasJuceNativeFunction } from './juceBridge'

let holds = 0
let last: boolean | null = null

const isEditable = (el: Element | null): boolean =>
  !!el && (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  )

function report () {
  if (!hasJuceBridge || !hasJuceNativeFunction('setKeyboardCapture')) return
  const wanted = holds > 0 || isEditable(document.activeElement)
  if (wanted === last) return
  last = wanted
  void callJuceNative('setKeyboardCapture', [wanted]).catch(() => {})
}

/** Keep the keyboard while the caller is mounted (e.g. a keyboard game).
 *  Returns a release function for the unmount cleanup. */
export function holdKeyboard (): () => void {
  holds++
  report()
  let released = false
  return () => {
    if (released) return
    released = true
    holds--
    report()
  }
}

export function installKeyboardCaptureReporter () {
  document.addEventListener('focusin', report, true)
  // focusout fires before the next focusin — defer so activeElement settled
  document.addEventListener('focusout', () => setTimeout(report, 0), true)
  report()
}
