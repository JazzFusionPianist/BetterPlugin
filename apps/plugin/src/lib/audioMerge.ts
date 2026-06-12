/**
 * Merge several dragged DAW regions into a single audio file.
 *
 * When the user selects multiple regions on ONE track and drags them in,
 * the host delivers them as separate region files. This concatenates them
 * back into one WAV so they arrive as a single clip — the common
 * "comp'd take / split region" workflow.
 *
 * We can't reconstruct the original timeline gaps (the drag carries no
 * position metadata — see DragMonitor), so regions are joined back-to-back
 * in filename order (best-effort musical order; numeric-aware so
 * "take 2" sorts before "take 10"). The user already opted into this via
 * the "merge into one" choice, which is why length/gaps don't matter here.
 */

interface DroppedRegion { name: string; data: string }  // data = base64 audio

let sharedCtx: AudioContext | null = null
function getCtx(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext()
  return sharedCtx
}

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

// Interleaved Float32 → 16-bit PCM WAV.
function encodeWav(samples: Float32Array, sampleRate: number, channels: number): Blob {
  const dataSize = samples.length * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)
  const wstr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  const blockAlign = channels * 2
  wstr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); wstr(8, 'WAVE')
  wstr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true); wstr(36, 'data'); view.setUint32(40, dataSize, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
}

/**
 * Decode + concatenate the dropped regions into one WAV File.
 * Returns null if nothing decodable. All regions are resampled to the
 * shared AudioContext rate by decodeAudioData, so they share a rate.
 */
export async function mergeDroppedRegions(batch: DroppedRegion[]): Promise<File | null> {
  if (batch.length === 0) return null

  // Filename order ≈ timeline order for auto-named takes.
  const sorted = [...batch].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))

  const ctx = getCtx()
  const buffers: AudioBuffer[] = []
  for (const r of sorted) {
    try {
      // decodeAudioData detaches the buffer, so each gets its own copy.
      const buf = await ctx.decodeAudioData(b64ToArrayBuffer(r.data))
      buffers.push(buf)
    } catch (e) {
      console.error('[audioMerge] decode failed:', r.name, e)
    }
  }
  if (buffers.length === 0) return null

  const sampleRate = buffers[0]!.sampleRate
  const channels   = Math.min(2, Math.max(...buffers.map(b => b.numberOfChannels)))
  const totalFrames = buffers.reduce((s, b) => s + b.length, 0)

  const out = new Float32Array(totalFrames * channels)
  let frameOff = 0
  for (const b of buffers) {
    const chData: Float32Array[] = []
    for (let ch = 0; ch < channels; ch++)
      chData.push(b.getChannelData(ch < b.numberOfChannels ? ch : 0))
    for (let i = 0; i < b.length; i++) {
      const base = (frameOff + i) * channels
      for (let ch = 0; ch < channels; ch++) out[base + ch] = chData[ch]![i]!
    }
    frameOff += b.length
  }

  const wav = encodeWav(out, sampleRate, channels)
  const baseName = (sorted[0]!.name.replace(/\.[^.]+$/, '')) || 'merged'
  return new File([wav], `${baseName} (merged).wav`, { type: 'audio/wav' })
}
