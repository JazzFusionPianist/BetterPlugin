/**
 * Polyfill ⌘V / Ctrl+V paste inside the JUCE WebView.
 *
 * In a plain browser the browser handles paste natively. Inside a
 * WKWebView hosted by a DAW, the host frequently eats the keystroke
 * before the WebView's responder chain sees it, so the standard
 * 'paste' event never fires — typing Cmd+V into an input does
 * nothing.
 *
 * Workaround: install a single document-level keydown listener that
 * recognises Cmd+V / Ctrl+V on text fields, fetches the system
 * clipboard via the JUCE native function `getClipboardText`, and
 * inserts the text into the focused element. We only intervene when
 * the JUCE bridge is present — outside the plugin we let the browser
 * handle it.
 */
import { callJuceNative, hasJuceBridge, hasJuceNativeFunction } from './juceBridge'

function isTextField (el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false
  const node = el as HTMLElement
  if (node.tagName === 'TEXTAREA') return true
  if (node.tagName === 'INPUT') {
    const type = (node as HTMLInputElement).type
    return type === 'text' || type === 'search' || type === 'url'
        || type === 'email' || type === 'password' || type === 'tel'
        || type === '' || type === undefined
  }
  return false
}

/** Insert `text` at the current cursor position of `el`, preserving
 *  selection semantics and triggering an `input` event so React's
 *  controlled-input state stays in sync. */
function insertAtCursor (el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length
  const end   = el.selectionEnd   ?? el.value.length
  const next  = el.value.slice(0, start) + text + el.value.slice(end)

  // React tracks the input's value via the prototype setter — calling
  // el.value = … directly would set the field but React wouldn't know,
  // so the next render would clobber it. Bypass with the prototype setter.
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, next)
  else el.value = next

  const cursor = start + text.length
  el.setSelectionRange(cursor, cursor)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

let installed = false

export function installPastePolyfill () {
  if (installed) return
  if (!hasJuceBridge) return            // browser handles paste natively
  if (!hasJuceNativeFunction('getClipboardText')) return
  installed = true

  document.addEventListener('keydown', async (e) => {
    // ⌘V on macOS / Ctrl+V on Win — and only if Shift isn't held
    // (Shift+Ctrl+V = paste-as-plain in some browsers; we keep that
    // path open too since we always insert plain text anyway).
    const isPaste = (e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')
    if (!isPaste) return
    if (!isTextField(e.target)) return

    // Suppress whatever default the WebView might still do — even if
    // it's currently nothing — so we don't double-insert.
    e.preventDefault()
    e.stopPropagation()

    try {
      const text = await callJuceNative('getClipboardText', [], 1500)
      if (!text) return
      insertAtCursor(e.target as HTMLInputElement | HTMLTextAreaElement, text)
    } catch (err) {
      console.warn('[pastePolyfill] getClipboardText failed', err)
    }
  }, { capture: true })
}
