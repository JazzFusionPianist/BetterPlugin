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

declare global {
  interface Window {
    __JUCE__?: {
      initialisationData: {
        __juce__functions: string[]
        __juce__platform: string[]
      }
      backend: {
        addEventListener:    (event: string, handler: (data: unknown) => void) => void
        removeEventListener: (event: string, handler: (data: unknown) => void) => void
        emitEvent:           (event: string, data: unknown) => void
      }
    }
  }
}

let _juceNextId = 0

/** List of C++ native functions registered by the plugin, exposed at init. */
export function juceRegisteredFunctions (): string[] {
  return window.__JUCE__?.initialisationData.__juce__functions ?? []
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
 */
export function callJuceNative (
  name: string,
  params: unknown[] = [],
  timeoutMs = 5000,
): Promise<string> {
  return new Promise<string>((resolve) => {
    const backend = window.__JUCE__?.backend
    if (!backend) { resolve('error:no-juce'); return }
    if (!hasJuceNativeFunction(name)) { resolve('error:no-function'); return }

    const promiseId = _juceNextId++
    let done = false

    const handler = (data: unknown) => {
      const d = data as { promiseId: number; result: string }
      if (d.promiseId === promiseId) {
        if (done) return
        done = true
        clearTimeout(timer)
        backend.removeEventListener('__juce__complete', handler)
        resolve(d.result)
      }
    }

    const timer = setTimeout(() => {
      if (done) return
      done = true
      backend.removeEventListener('__juce__complete', handler)
      resolve('error:timeout')
    }, timeoutMs)

    backend.addEventListener('__juce__complete', handler)
    backend.emitEvent('__juce__invoke', { name, params, resultId: promiseId })
  })
}

/** True if the app is running inside a JUCE WebBrowserComponent. */
export const hasJuceBridge = typeof window !== 'undefined' && !!window.__JUCE__?.backend
