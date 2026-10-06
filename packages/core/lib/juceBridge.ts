/**
 * JUCE WebBrowserComponent native-function bridge.
 *
 * JUCE exposes window.__JUCE__.backend as an event emitter (not a
 * straightforward object with named methods). To call a C++ function
 * registered via withNativeFunction, we emit '__juce__invoke' and wait
 * for a '__juce__complete' reply keyed by promiseId.
 *
 * Mirrors the pattern from JUCE's shipped index.js.
 */

type NativeBackend = {
  addEventListener: (event: string, handler: (data: unknown) => void) => [string, number]
  removeEventListener: (subscription: [string, number]) => void
  emitEvent: (event: string, data: unknown) => void
}
function nativeBridge() {
  return typeof window === 'undefined' ? undefined :
    (window as unknown as {__JUCE__?: {initialisationData: {__juce__functions: string[]}, backend: NativeBackend}}).__JUCE__
}

let _juceNextId = 0

/** List of C++ native functions registered by the plugin, exposed at init. */
export function juceRegisteredFunctions (): string[] {
  return nativeBridge()?.initialisationData.__juce__functions ?? []
}

/** Is a specific native function registered by the plugin build? */
export function hasJuceNativeFunction (name: string): boolean {
  return juceRegisteredFunctions().includes(name)
}

/**
 * Call a native function by name. Returns 'error:no-juce' in a regular
 * browser, 'error:no-function' if the plugin build didn't register the
 * name (so we never hang waiting for a reply that will never come), and
 * 'error:timeout' if the plugin took longer than `timeoutMs`.
 * Pass 0 only for native operations with their own deadline followed by a
 * user-controlled dialog; waiting for a user decision has no API deadline.
 */
export function callJuceNative (
  name: string,
  params: unknown[] = [],
  timeoutMs = 5000,
): Promise<string> {
  return new Promise<string>((resolve) => {
    const backend = nativeBridge()?.backend
    if (!backend) { resolve('error:no-juce'); return }
    if (!hasJuceNativeFunction(name)) { resolve('error:no-function'); return }

    const promiseId = _juceNextId++
    let done = false

    const handler = (data: unknown) => {
      if (!data || typeof data !== 'object') return
      const d = data as { promiseId: number; result: string }
      if (d.promiseId === promiseId) {
        if (done) return
        done = true
        clearTimeout(timer)
        backend.removeEventListener(subscription)
        resolve(d.result)
      }
    }

    const timer = timeoutMs > 0 ? setTimeout(() => {
      if (done) return
      done = true
      backend.removeEventListener(subscription)
      resolve('error:timeout')
    }, timeoutMs) : undefined

    const subscription = backend.addEventListener('__juce__complete', handler)
    try {
      backend.emitEvent('__juce__invoke', { name, params, resultId: promiseId })
    } catch {
      done = true
      clearTimeout(timer)
      backend.removeEventListener(subscription)
      resolve('error:bridge')
    }
  })
}

/** True if the app is running inside a JUCE WebBrowserComponent. */
export const hasJuceBridge = !!nativeBridge()?.backend
