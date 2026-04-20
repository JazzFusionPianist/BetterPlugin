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

/** Call a native function by name. Returns 'error:no-juce' in a browser. */
export function callJuceNative (name: string, params: unknown[] = []): Promise<string> {
  return new Promise<string>((resolve) => {
    const backend = window.__JUCE__?.backend
    if (!backend) { resolve('error:no-juce'); return }

    const promiseId = _juceNextId++

    const handler = (data: unknown) => {
      const d = data as { promiseId: number; result: string }
      if (d.promiseId === promiseId) {
        backend.removeEventListener('__juce__complete', handler)
        resolve(d.result)
      }
    }

    backend.addEventListener('__juce__complete', handler)
    backend.emitEvent('__juce__invoke', { name, params, resultId: promiseId })
  })
}

/** True if the app is running inside a JUCE WebBrowserComponent. */
export const hasJuceBridge = typeof window !== 'undefined' && !!window.__JUCE__?.backend
