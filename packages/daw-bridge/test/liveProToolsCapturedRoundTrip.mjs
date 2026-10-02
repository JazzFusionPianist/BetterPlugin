// Import only a captured synthetic QA bundle into the user-approved test session.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { stageArchive } from '../src/archive.mjs'
import { connectProTools, inspectSession } from '../src/ptsl.mjs'
import { importToProTools } from '../src/proToolsImport.mjs'
import { parseProToolsTimeline, timelineExportRequest } from '../src/proToolsTimeline.mjs'

const archive = process.argv[2], sourceDirectory = process.argv[3]
if (!archive || !sourceDirectory) throw new Error('Pass a captured QA archive and its original successful test directory.')
const original = JSON.parse(await readFile(join(sourceDirectory, 'bundle.json'), 'utf8'))
const originalReceipt = JSON.parse(await readFile(join(sourceDirectory, 'receipt.json'), 'utf8'))
const output = join(dirname(archive), 'round-trip')
await mkdir(output, { recursive: true })
const { bundle, paths } = await stageArchive(archive, join(output, 'cache'))
if (originalReceipt.status !== 'complete' || bundle.source?.daw !== 'Pro Tools'
  || bundle.source.projectId !== originalReceipt.sessionId || bundle.regions.length !== original.regions.length
  || bundle.tracks.length !== original.tracks.length) throw new Error('Not a complete capture of the approved QA layout.')
for (const track of bundle.tracks) {
  if (!track.name.startsWith('Orb QA ')) throw new Error('Only synthetic QA tracks may be imported by this script.')
  const source = original.tracks.find(t => t.name === track.name && t.channels === track.channels)
  if (!source || !originalReceipt.tracks.some(t => t.sourceId === source.id && t.id === track.id))
    throw new Error('Source track identity was not preserved.')
  const regions = bundle.regions.filter(r => r.trackId === track.id)
  if (regions.length !== original.regions.filter(r => r.trackId === source.id).length) throw new Error('Region count differs.')
  for (const region of regions) {
    const prior = original.regions.find(r => r.name === region.name && r.trackId === source.id)
    if (!prior || ['start', 'offsetFrames', 'lengthFrames'].some(key => JSON.stringify(region[key]) !== JSON.stringify(prior[key])))
      throw new Error('Captured region timing differs from the original.')
    const beforeAsset = original.assets.find(a => a.id === prior.assetId)
    const asset = bundle.assets.find(a => a.id === region.assetId)
    // Pro Tools adds BWF metadata on import. Compare PCM and format, not headers.
    const originalAudio = pcm(await readFile(join(sourceDirectory, beforeAsset.name)))
    const capturedAudio = pcm(await readFile(paths.get(asset.id)))
    if (!originalAudio.format.equals(capturedAudio.format) || !originalAudio.samples.equals(capturedAudio.samples))
      throw new Error('Captured audio samples differ from the original QA WAV.')
  }
}
const client = connectProTools(process.env.ORB_PTSL_SDK)
const trace = []
async function call(command, body) {
  if ((await client.call('GetSessionName')).session_name !== 'new test'
    || (await client.call('GetSessionIDs')).instance_id !== originalReceipt.sessionId) throw new Error('Approved test session changed.')
  const result = await client.call(command, body)
  trace.push({ command, body, result })
  return result
}
try {
  await client.register()
  const before = await inspectSession(call)
  const timeline = parseProToolsTimeline((await call('ExportSessionInfoAsText', timelineExportRequest)).session_info)
  const journal = {
    begin: r => writeFile(join(output, 'receipt.json'), JSON.stringify(r, null, 2), { flag: 'wx' }),
    record: r => writeFile(join(output, 'receipt.json'), JSON.stringify(r, null, 2)),
  }
  const receipt = await importToProTools({ bundle, paths, expectedSessionId: originalReceipt.sessionId, call, journal })
  const after = await inspectSession(call)
  if (before.tracks.some(t => !after.tracks.some(a => a.id === t.id && a.name === t.name))) throw new Error('Existing track changed.')
  const added = new Set(receipt.tracks.map(t => {
    const track = after.tracks.find(a => a.id === t.id)
    return track.name + (track.format === 'TFormat_Stereo' ? ' (Stereo)' : '')
  }))
  const afterTimeline = parseProToolsTimeline((await call('ExportSessionInfoAsText', timelineExportRequest)).session_info)
  if (JSON.stringify(timeline.tracks) !== JSON.stringify(afterTimeline.tracks.filter(t => !added.has(t.name))))
    throw new Error('Existing timeline changed.')
  console.log(JSON.stringify({ ...receipt, sourcePCMByteIdentical: true, originalLayoutPreserved: true,
    existingTracksPreserved: before.tracks.length, output }, null, 2))
} finally {
  await writeFile(join(output, 'trace.json'), JSON.stringify(trace, null, 2))
  client.close()
}

function pcm(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error('QA media is not a RIFF WAV.')
  let format, samples
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4), end = offset + 8 + size
    if (end > bytes.length) throw new Error('Truncated QA WAV.')
    const name = bytes.toString('ascii', offset, offset + 4)
    if (name === 'fmt ') format = bytes.subarray(offset + 8, offset + 24)
    if (name === 'data') samples = bytes.subarray(offset + 8, end)
    offset = end + size % 2
  }
  if (!format || !samples) throw new Error('Missing QA WAV data.')
  return { format, samples }
}
