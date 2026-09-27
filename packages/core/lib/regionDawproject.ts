import { strToU8, zipSync } from 'fflate'
import { hasCompleteLayout, parseRegionBundle, sha256, type RegionBundle } from './regionBundle.ts'

/** Audio-only DAWproject adapter. Never treats BWF clocks as edited placement. */
function xml(value: string): string {
  // XML 1.0 disallows these codepoints, even inside escaped attributes.
  if (/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(value))
    throw new Error('A region or track name contains unsupported XML characters.')
  return value.replace(/[&<>"'\t\r\n]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;', '\t': '&#9;', '\r': '&#13;', '\n': '&#10;' })[c]!)
}

function seconds(frames: number, rate: number): string {
  const time = frames / rate
  if (frames < 0 || !Number.isFinite(time) || Math.round(time * rate) !== frames)
    throw new Error('This position cannot be represented safely in DAWproject.')
  return String(time)
}

/** Verify the actual media header, not just a remote manifest or extension. */
function verifyWave(bytes: Uint8Array, asset: RegionBundle['assets'][number]) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (p: number) => String.fromCharCode(...bytes.subarray(p, p + 4))
  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || view.getUint32(4, true) + 8 !== bytes.length)
    throw new Error('DAWproject transfer currently requires PCM or float WAV audio.')
  let format: { channels: number; rate: number; block: number } | undefined
  let dataSize: number | undefined
  for (let p = 12; p + 8 <= bytes.length;) {
    const size = view.getUint32(p + 4, true), start = p + 8
    if (start + size > bytes.length) throw new Error('Invalid WAV chunk.')
    if (tag(p) === 'fmt ') {
      if (format || size < 16) throw new Error('Invalid WAV format.')
      const codec = view.getUint16(start, true), channels = view.getUint16(start + 2, true)
      const rate = view.getUint32(start + 4, true), block = view.getUint16(start + 12, true)
      const bits = view.getUint16(start + 14, true)
      if (!((codec === 1 && [16, 24, 32].includes(bits)) || (codec === 3 && [32, 64].includes(bits)))
        || channels < 1 || channels > 2 || block !== channels * bits / 8
        || view.getUint32(start + 8, true) !== rate * block)
        throw new Error('DAWproject transfer supports mono/stereo PCM or float WAV audio.')
      format = { channels, rate, block }
    }
    if (tag(p) === 'data') {
      if (dataSize !== undefined) throw new Error('Multiple WAV data chunks are not supported.')
      dataSize = size
    }
    p = start + size + (size % 2)
  }
  if (!format || dataSize === undefined || dataSize % format.block !== 0
    || format.rate !== asset.sampleRate || format.channels !== asset.channels
    || dataSize / format.block !== asset.frames) throw new Error(`Audio metadata does not match ${asset.name}.`)
}

/**
 * Seconds on every timeline: receiver tempo changes must not stretch audio.
 * A project file, NOT a promise to insert into the receiver's current project.
 * No made-up transport tempo, effects, fades, source processing or markers.
 */
export async function createRegionDawproject(prepared: { bundle: RegionBundle; filesByAsset: Map<string, File> }): Promise<File> {
  const bundle = parseRegionBundle(prepared.bundle)
  if (!bundle || !hasCompleteLayout(bundle)) throw new Error('Exact region positions and tracks are required for DAWproject.')
  const files: Record<string, Uint8Array> = {}
  const paths = new Map<string, string>()
  for (const asset of bundle.assets) {
    if (asset.frames === null || asset.channels === null || asset.sampleRate === null)
      throw new Error('Complete audio metadata is required for DAWproject.')
    const file = prepared.filesByAsset.get(asset.id)
    if (!file || file.size !== asset.bytes) throw new Error(`Missing or changed audio: ${asset.name}`)
    const buffer = await file.arrayBuffer()
    if (await sha256(buffer) !== asset.sha256) throw new Error(`Changed audio: ${asset.name}`)
    const bytes = new Uint8Array(buffer)
    verifyWave(bytes, asset)
    const path = `audio/${asset.sha256}.wav`
    files[path] = bytes
    paths.set(asset.id, path)
  }
  const tracks = bundle.tracks.slice().sort((a, b) => a.order - b.order)
  const structure = tracks.map((track, i) => {
    if (track.channels > 2) throw new Error('DAWproject transfer currently supports mono/stereo tracks.')
    return `<Track id="track${i}" name="${xml(track.name)}" contentType="audio" loaded="true">`
      + `<Channel id="channel${i}" audioChannels="${track.channels}" destination="masterChannel" role="regular" solo="false">`
      + '<Mute value="false"/><Pan value="0.5" unit="normalized"/><Volume value="1" unit="linear"/>'
      + '</Channel></Track>'
  }).join('')
  // Explicit track lanes and a nested audio-event timeline follow Fender's
  // structure. Cubase 15 dropped all clips with our initial direct Clips lane.
  const lanes = tracks.map((track, i) => `<Lanes id="lane${i}" track="track${i}" timeUnit="seconds"><Clips id="clips${i}" timeUnit="seconds">`
    + bundle.regions.filter(region => region.trackId === track.id).map((region, j) => {
      const asset = bundle.assets.find(a => a.id === region.assetId)!
      if (asset.channels !== track.channels) throw new Error('Region and track channel layouts must match.')
      const rate = asset.sampleRate!
      const start = seconds(region.start!.samples, region.start!.sampleRate)
      const duration = seconds(region.lengthFrames!, rate)
      const offset = seconds(region.offsetFrames!, rate)
      const stop = seconds(region.offsetFrames! + region.lengthFrames!, rate)
      return `<Clip name="${xml(region.name)}" time="${start}" duration="${duration}" contentTimeUnit="seconds" playStart="${offset}" playStop="${stop}" fadeTimeUnit="seconds" fadeInTime="0" fadeOutTime="0" enable="true">`
        + `<Clips id="events${i}_${j}" timeUnit="seconds"><Clip time="0" duration="${seconds(asset.frames!, rate)}" contentTimeUnit="seconds">`
        + `<Audio id="audio${i}_${j}" timeUnit="seconds" duration="${seconds(asset.frames!, rate)}" sampleRate="${rate}" channels="${asset.channels}">`
        + `<File path="${paths.get(asset.id)}" external="false"/></Audio></Clip></Clips></Clip>`
    }).join('') + '</Clips></Lanes>').join('')
  files['project.xml'] = strToU8('<?xml version="1.0" encoding="UTF-8"?>'
    + '<Project version="1.0"><Application name="Slur" version="1.0"/><Structure>' + structure
    + '<Channel id="masterChannel" name="Main" audioChannels="2" role="master"><Volume value="1" unit="linear"/></Channel>'
    + '</Structure><Arrangement id="arrangement"><Lanes id="lanes" timeUnit="seconds">' + lanes + '</Lanes></Arrangement></Project>')
  files['metadata.xml'] = strToU8('<?xml version="1.0" encoding="UTF-8"?><MetaData><Title>Slur Regions</Title>'
    + '<Comment>Audio-only region layout in seconds. No source tempo map or processing is included.</Comment></MetaData>')
  return new File([Uint8Array.from(zipSync(files, { level: 0 }))], 'Slur Regions.dawproject', { type: 'application/zip' })
}
