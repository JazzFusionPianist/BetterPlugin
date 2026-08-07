'use client'

/**
 * The colour of a record seen across the room — the average of its
 * cover art, sampled once per URL on a 3×3 canvas. Returns null when
 * the image can't be read (CORS taint, load failure); callers fall
 * back to a deterministic tint.
 */

const cache = new Map<string, string | null>()

export async function sampleCoverColor(url: string): Promise<string | null> {
  if (cache.has(url)) return cache.get(url)!
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('load'))
      img.src = url
    })
    const c = document.createElement('canvas')
    c.width = 3; c.height = 3
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('ctx')
    ctx.drawImage(img, 0, 0, 3, 3)
    const d = ctx.getImageData(0, 0, 3, 3).data
    let r = 0; let g = 0; let b = 0
    for (let i = 0; i < 9; i++) { r += d[i * 4]!; g += d[i * 4 + 1]!; b += d[i * 4 + 2]! }
    const hex = `#${[r, g, b].map((v) => Math.round(v / 9).toString(16).padStart(2, '0')).join('')}`
    cache.set(url, hex)
    return hex
  } catch {
    cache.set(url, null)
    return null
  }
}
