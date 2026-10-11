import { renderRegionAudio, type AudioFileTransfer } from '@orb/core/lib/regionAudioFiles.ts'
import { downloadAudio } from './audioDownloads'
import { audioDownloadCache } from './audioDownloadCache'
import { callJuceNative, hasJuceNativeFunction } from './juceBridge'

// SMPTE time at song zero in the receiving DAW's default project: Logic puts bar 1 at
// 01:00:00:00; Pro Tools, Cubase, Studio One, REAPER and LUNA start at 00:00:00:00.
let hostOffset: Promise<number> | null = null
export function receiverTimeOffsetSeconds(): Promise<number> {
  hostOffset ??= (hasJuceNativeFunction('trackExportHost') ? callJuceNative('trackExportHost', []) : Promise.resolve(''))
    .then(host => host === 'Logic Pro' ? 3600 : 0).catch(() => 0)
  return hostOffset
}

export function downloadAudioTransfer(transfer: AudioFileTransfer) {
  if (!transfer.region) return downloadAudio(transfer.url)
  return audioDownloadCache.get(transfer.key, async (_, signal) => {
    const source = await downloadAudio(transfer.url)
    signal.throwIfAborted()
    const bytes = Uint8Array.from(atob(source.base64), c => c.charCodeAt(0))
    // Each file carries its own position (BWF), so the DAW can put it back in place.
    const file = await renderRegionAudio(transfer, bytes, { timeOffsetSeconds: await receiverTimeOffsetSeconds() })
    signal.throwIfAborted()
    const output = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (let i = 0; i < output.length; i += 0x8000) binary += String.fromCharCode(...output.subarray(i, i + 0x8000))
    return { base64: btoa(binary), bytes: output.length }
  })
}
