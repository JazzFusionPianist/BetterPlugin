import { createHash } from 'node:crypto'

export function fixture() {
  const bytes = new Uint8Array([1, 2, 3, 4])
  const hash = createHash('sha256').update(bytes).digest('hex')
  const bundle = {
    format: 'orb-region-bundle', version: 1, id: 'bundle-1', timebase: 'song-samples',
    source: { daw: 'Pro Tools', projectId: 'source', captureId: 'capture-1' },
    tracks: [{ id: 'guitar', name: 'Guitar', order: 1, channels: 1 },
      { id: 'voice', name: 'Voice', order: 0, channels: 1 }],
    assets: [{ id: hash, sha256: hash, name: 'Take.wav', bytes: 4, channels: 1, sampleRate: 48000, frames: 96000 }],
    regions: [
      { id: 'a', assetId: hash, trackId: 'guitar', name: 'A', start: { samples: 96000, sampleRate: 48000 }, offsetFrames: 12000, lengthFrames: 24000 },
      { id: 'b', assetId: hash, trackId: 'voice', name: 'B', start: { samples: 0, sampleRate: 48000 }, offsetFrames: 0, lengthFrames: 24000 },
      { id: 'c', assetId: hash, trackId: 'guitar', name: 'C', start: { samples: 100000, sampleRate: 48000 }, offsetFrames: 36000, lengthFrames: 24000 },
    ],
  }
  return { bundle, bytes, hash }
}
