export type AudioDownload = { base64: string; bytes: number }
export type DownloadProgress = { received: number; total: number }
type Loader = (url: string, signal: AbortSignal, progress: (value: DownloadProgress) => void) => Promise<AudioDownload>

/** One URL = one download, regardless of which single/batch button requested it.
 * Completed bytes survive row collapse/unmount, but never account changes. */
export function createAudioDownloadCache(maxBytes = 512 * 1024 * 1024) {
  const ready = new Map<string, AudioDownload>()
  const pending = new Map<string, { promise: Promise<AudioDownload>; controller: AbortController }>()
  const progress = new Map<string, DownloadProgress>()
  const listeners = new Set<() => void>()
  let revision = 0, generation = 0, bytes = 0
  const notify = () => { revision++; for (const listener of listeners) listener() }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    snapshot: () => revision,
    scope: () => generation,
    peek: (url: string) => ready.get(url),
    progress: (url: string) => progress.get(url),
    clear() {
      generation++
      for (const entry of pending.values()) entry.controller.abort()
      pending.clear(); ready.clear(); progress.clear(); bytes = 0; notify()
    },
    get(url: string, loader: Loader): Promise<AudioDownload> {
      const cached = ready.get(url)
      if (cached) { ready.delete(url); ready.set(url, cached); return Promise.resolve(cached) }
      const existing = pending.get(url)
      if (existing) return existing.promise
      const epoch = generation, controller = new AbortController()
      const promise = Promise.resolve().then(() => loader(url, controller.signal, value => {
        if (generation === epoch) { progress.set(url, value); notify() }
      })).then(value => {
        if (generation !== epoch) throw new Error('Download cancelled: account changed.')
        if (value.bytes > maxBytes) throw new Error('Audio exceeds the download cache limit.')
        while (bytes + value.bytes > maxBytes && ready.size) {
          const oldest = ready.keys().next().value!
          bytes -= ready.get(oldest)!.bytes; ready.delete(oldest)
        }
        ready.set(url, value); bytes += value.bytes
        return value
      }).finally(() => {
        if (generation === epoch) { pending.delete(url); progress.delete(url); notify() }
      })
      pending.set(url, { promise, controller })
      progress.set(url, { received: 0, total: -1 }); notify()
      return promise
    },
  }
}

export const audioDownloadCache = createAudioDownloadCache()
