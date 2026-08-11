/**
 * Decode an audio file once at upload time and boil it down to a small
 * array of normalized amplitude buckets — the waveform the open-call
 * feed prints without ever decoding audio again. Returns null when the
 * browser can't decode the codec (the track still uploads; the player
 * falls back to a plain progress bar).
 */
export interface AudioMeta {
  duration: number
  peaks: number[]
}

export async function readAudioMeta(file: File, buckets = 160): Promise<AudioMeta | null> {
  try {
    const buf = await file.arrayBuffer()
    type AC = typeof AudioContext
    const Ctx: AC | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    try {
      const audio = await ctx.decodeAudioData(buf)
      const ch0 = audio.getChannelData(0)
      const ch1 = audio.numberOfChannels > 1 ? audio.getChannelData(1) : null
      const n = ch0.length
      const per = Math.max(1, Math.floor(n / buckets))
      const peaks: number[] = []
      for (let b = 0; b < buckets; b++) {
        const start = b * per
        if (start >= n) break
        const end = Math.min(n, start + per)
        let max = 0
        // Stride through big buckets — max-abs of every 32nd sample is
        // indistinguishable at 160px and 30× cheaper on long stems.
        const step = end - start > 8192 ? 32 : 1
        for (let i = start; i < end; i += step) {
          const v = Math.abs(ch0[i]!) + (ch1 ? Math.abs(ch1[i]!) : 0)
          if (v > max) max = v
        }
        peaks.push(max)
      }
      const top = Math.max(...peaks, 0.0001)
      return {
        duration: audio.duration,
        peaks: peaks.map((p) => Math.round((p / top) * 1000) / 1000),
      }
    } finally {
      ctx.close().catch(() => {})
    }
  } catch {
    return null
  }
}
