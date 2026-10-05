import { renderRegionAudio, type AudioFileTransfer } from '@orb/core/lib/regionAudioFiles.ts'
import { downloadAudio } from './audioDownloads'
import { audioDownloadCache } from './audioDownloadCache'

export function downloadAudioTransfer(transfer: AudioFileTransfer) {
  if (!transfer.region) return downloadAudio(transfer.url)
  return audioDownloadCache.get(transfer.key, async (_, signal) => {
    const source = await downloadAudio(transfer.url)
    signal.throwIfAborted()
    const bytes = Uint8Array.from(atob(source.base64), c => c.charCodeAt(0))
    const file = await renderRegionAudio(transfer, bytes)
    signal.throwIfAborted()
    const output = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (let i = 0; i < output.length; i += 0x8000) binary += String.fromCharCode(...output.subarray(i, i + 0x8000))
    return { base64: btoa(binary), bytes: output.length }
  })
}
