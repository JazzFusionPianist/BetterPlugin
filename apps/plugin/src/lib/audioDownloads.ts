import { useSyncExternalStore } from 'react'
import { audioDownloadCache } from './audioDownloadCache'
import { resolveUrl, invalidateResolved } from './r2Access'
import { DAW_FILE_LIMIT } from './limits'

export function useAudioDownloads() {
  useSyncExternalStore(audioDownloadCache.subscribe, audioDownloadCache.snapshot, audioDownloadCache.snapshot)
  return audioDownloadCache
}

export const downloadAudio = (url: string) => audioDownloadCache.get(url, async (source, accountSignal, progress) => {
  const controller = new AbortController()
  const abort = () => controller.abort()
  accountSignal.addEventListener('abort', abort, { once: true })
  if (accountSignal.aborted) controller.abort()
  const timeout = setTimeout(abort, 120_000)
  try {
    let resolved = await resolveUrl(source)
    let response = await fetch(resolved, { signal: controller.signal })
    if (response.status === 403 && resolved !== source) {
      invalidateResolved(source); resolved = await resolveUrl(source)
      response = await fetch(resolved, { signal: controller.signal })
    }
    if (!response.ok || !response.body) throw new Error(`Audio download failed (${response.status}).`)
    const total = Number(response.headers.get('content-length') ?? -1)
    if (total > DAW_FILE_LIMIT) throw new Error('Audio exceeds the 300 MB download limit.')
    const reader = response.body.getReader(), chunks: Uint8Array[] = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      if (received > DAW_FILE_LIMIT) { await reader.cancel(); throw new Error('Audio exceeds the 300 MB download limit.') }
      chunks.push(value); progress({ received, total })
    }
    if (!received) throw new Error('The audio file is empty.')
    const merged = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }
    let binary = ''
    for (let i = 0; i < merged.length; i += 0x8000)
      binary += String.fromCharCode(...merged.subarray(i, i + 0x8000))
    return { base64: btoa(binary), bytes: received }
  } finally {
    clearTimeout(timeout); controller.abort(); accountSignal.removeEventListener('abort', abort)
  }
})
