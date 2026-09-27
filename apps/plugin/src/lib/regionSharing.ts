import { prepareRegionBundle, parseRegionBundle, uploadRegionBundle } from '@orb/core/lib/regionBundle.ts'
import { analyzeRegion } from './audioMerge'
import type { AttachmentTimelineMetadata } from '../types/collab'
import { applyVstLayout, cropVstWave, parseVstEvidence, type VstRegionEvidence } from '@orb/core/lib/regionVstXml.ts'

const nativeEvidence = new WeakMap<File, VstRegionEvidence>()
export function rememberRegionEvidence(file: File, value: unknown): File {
  const evidence = parseVstEvidence(value)
  if (!evidence) throw new Error('Invalid DAW region data. Nothing was sent.')
  nativeEvidence.set(file, evidence)
  return file
}

/** Keep each occurrence, including repeats, without guessing tracks/placement.
 * A raw recording timestamp travels separately from verified edited positions. */
export async function prepareSharedRegions(files: File[]) {
  const evidence = files.map(f => nativeEvidence.get(f))
  if (evidence.some(Boolean)) {
    if (!evidence.every(Boolean)) throw new Error('Incomplete DAW region data. Nothing was sent.')
    const verified = evidence as VstRegionEvidence[]
    const cropped = await Promise.all(files.map((file, i) => cropVstWave(file, verified[i]!)))
    const info = await Promise.all(cropped.map(analyzeRegion))
    const byFile = new Map(info.map(item => [item.file, item]))
    const prepared = await prepareRegionBundle(cropped, async file => byFile.get(file) ?? {})
    prepared.bundle = applyVstLayout(prepared.bundle, verified)
    return prepared
  }
  const info = await Promise.all(files.map(analyzeRegion))
  const byFile = new Map(info.map(item => [item.file, item]))
  const prepared = await prepareRegionBundle(files, async file => byFile.get(file) ?? {})
  for (const [index, region] of prepared.bundle.regions.entries()) {
    const position = info[index]?.timeline?.position
    if (position && (position.source === 'bwf' || position.source === 'ixml')
      && Number.isSafeInteger(position.source_samples) && position.source_samples! >= 0
      && Number.isSafeInteger(position.sample_rate) && position.sample_rate! > 0) {
      region.recordingTimestamp = { source: position.source, samples: position.source_samples!, sampleRate: position.sample_rate! }
    }
  }
  if (!parseRegionBundle(prepared.bundle)) throw new Error('Invalid shared region metadata.')
  return prepared
}

export async function uploadSharedRegions(
  prepared: Awaited<ReturnType<typeof prepareSharedRegions>>,
  upload: (file: File) => Promise<{ url: string; name: string } | null>,
) {
  const entries = await uploadRegionBundle(prepared, upload)
  // Unique assets in the transport; the manifest retains every occurrence.
  return entries.map((entry, index) => {
    const region = prepared.bundle.regions.find(item => item.assetId === entry.assetId)!
    const stamp = region.recordingTimestamp
    const metadata: AttachmentTimelineMetadata | undefined = stamp ? {
      schema_version: 1, captured_at: new Date().toISOString(),
      position: { source: stamp.source, source_samples: stamp.samples, sample_rate: stamp.sampleRate,
        seconds: stamp.samples / stamp.sampleRate, confidence: 'exact', basis: 'unknown',
        meaning: 'recording_timestamp' },
    } : undefined
    return { url: entry.url, name: entry.name, assetId: region.assetId, metadata,
      ...(index === 0 ? { regionBundle: prepared.bundle } : {}) }
  })
}
