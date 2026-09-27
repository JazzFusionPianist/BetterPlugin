import { prepareRegionBundle } from '../../core/lib/regionBundle.ts'

export function wave(rate = 48000, channels = 1) {
  const frames = rate * 2, b = Buffer.alloc(44 + frames * channels * 2)
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22); b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * channels * 2, 28); b.writeUInt16LE(channels * 2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(frames * channels * 2, 40)
  // Quiet synthetic test tone, never user audio. Channel 2 differs to test stereo.
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++)
    b.writeInt16LE(Math.round(1500 * Math.sin(i * 2 * Math.PI * (440 + c * 220) / rate)), 44 + (i * channels + c) * 2)
  return new File([b], 'Same name.wav', { type: 'audio/wav' })
}

export async function dawprojectFixture() {
  const mono = wave(), stereo = wave(44100, 2)
  const p = await prepareRegionBundle([mono, mono, stereo], async f => {
    const v = new DataView(await f.arrayBuffer()), rate = v.getUint32(24, true)
    return { sampleRate: rate, channels: v.getUint16(22, true), frames: rate * 2 }
  })
  p.bundle.source = { daw: 'Slur synthetic QA', projectId: 'test-project', captureId: 'test-capture' }
  p.bundle.tracks = [{ id: 'mono', name: 'Drums & One', order: 0, channels: 1 },
    { id: 'stereo', name: 'Keys <Two>', order: 1, channels: 2 }]
  p.bundle.regions.forEach((r, i) => {
    r.trackId = i === 2 ? 'stereo' : 'mono'
    r.start = { samples: [120000, 384001, 72000][i], sampleRate: 48000 }
    r.offsetFrames = i === 2 ? 11025 : 24000
    r.lengthFrames = i === 2 ? 44100 : 36000
    r.name = `Region ${i + 1} "trim"`
  })
  return p
}
