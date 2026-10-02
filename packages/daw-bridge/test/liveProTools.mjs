// Opt-in real-host test. Never included in the automatic *.test.mjs suite.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { connectProTools, inspectSession } from '../src/ptsl.mjs'
import { importToProTools } from '../src/proToolsImport.mjs'
import { timelineExportRequest, parseProToolsTimeline } from '../src/proToolsTimeline.mjs'

const expectedName = process.argv[2], expectedId = process.argv[3]
if (!expectedName || !expectedId) throw new Error('Pass the approved test session name and inspected instance ID.')
const rate = Number(process.argv[4] || 48000)
if (![44100, 48000, 96000].includes(rate)) throw new Error('Unsupported test rate.')
const run = `${Date.now()}-${randomUUID().slice(0, 8)}`
const directory = join(homedir(), '.cache', 'orb', 'live-tests', run)
await mkdir(directory, { recursive: true, mode: 0o700 })
const client = connectProTools(process.env.ORB_PTSL_SDK)
const trace = []
const call = async (command, body) => {
  if (!command.startsWith('Get') && command !== 'ExportSessionInfoAsText') {
    const name = (await client.call('GetSessionName')).session_name
    const id = (await client.call('GetSessionIDs')).instance_id
    if (name !== expectedName || id !== expectedId) throw new Error('Approved test session changed.')
  }
  try {
    const result = await client.call(command, body)
    trace.push({ command, body, result })
    return result
  } catch (error) {
    trace.push({ command, body, error: error.message })
    throw error
  } finally { await writeFile(join(directory, 'trace.json'), JSON.stringify(trace, null, 2), { mode: 0o600 }) }
}
function wave(channels) {
  const frames = rate * 2, bytes = Buffer.alloc(44 + frames * channels * 2)
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels, 22)
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * channels * 2, 28)
  bytes.writeUInt16LE(channels * 2, 32); bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40)
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels; channel++)
    bytes.writeInt16LE(Math.round(1000 * Math.sin(frame * 2 * Math.PI * (220 + channel * 110) / rate)),
      44 + (frame * channels + channel) * 2)
  return bytes
}
try {
  await client.register()
  if ((await call('GetSessionName')).session_name !== expectedName) throw new Error('Wrong test session name.')
  const before = await inspectSession(call)
  if (before.instanceId !== expectedId) throw new Error('Wrong test session ID.')
  const baseline = await call('ExportSessionInfoAsText', timelineExportRequest)
  await writeFile(join(directory, 'before.json'), JSON.stringify({ session: before, ...baseline }, null, 2))
  const bundle = { format: 'orb-region-bundle', version: 1, id: run, timebase: 'song-samples',
    source: { daw: 'Orb synthetic qualification', projectId: run, captureId: run }, tracks: [], regions: [], assets: [] }
  const paths = new Map()
  for (const channels of [1, 2]) {
    const track = { id: `track-${channels}`, name: `Orb QA ${run.slice(-8)} ${channels === 1 ? 'Mono' : 'Stereo'}`,
      order: channels - 1, channels }
    bundle.tracks.push(track)
    const bytes = wave(channels), hash = createHash('sha256').update(bytes).digest('hex')
    const name = `Orb-QA-${run}-${channels}ch.wav`, path = join(directory, name)
    await writeFile(path, bytes, { flag: 'wx' }); paths.set(hash, path)
    bundle.assets.push({ id: hash, sha256: hash, name, bytes: bytes.length, sampleRate: rate, channels, frames: rate * 2 })
    for (const index of [0, 1]) bundle.regions.push({ id: `${track.id}-${index}`, trackId: track.id, assetId: hash,
      name: `Orb-${run.slice(-8)}-${channels}-${index}`, start: { samples: (index + 1) * rate + 137 * channels, sampleRate: rate },
      offsetFrames: index * Math.floor(rate / 2) + 13, lengthFrames: Math.floor(rate / 3) })
  }
  await writeFile(join(directory, 'bundle.json'), JSON.stringify(bundle, null, 2))
  const journal = {
    begin: r => writeFile(join(directory, 'receipt.json'), JSON.stringify(r, null, 2), { flag: 'wx' }),
    record: r => writeFile(join(directory, 'receipt.json'), JSON.stringify(r, null, 2)),
  }
  console.log(`Test artifacts: ${directory}`)
  const receipt = await importToProTools({ bundle, paths, expectedSessionId: expectedId, call, journal })
  const after = await inspectSession(call)
  for (const track of before.tracks) {
    const remaining = after.tracks.find(t => t.id === track.id)
    if (!remaining || ['name', 'type', 'format', 'timebase'].some(key => remaining[key] !== track[key]))
      throw new Error('An existing track changed during the test.')
  }
  const afterReport = await call('ExportSessionInfoAsText', timelineExportRequest)
  const old = parseProToolsTimeline(baseline.session_info).tracks
  const addedLabels = new Set(bundle.tracks.map(t => t.name + (t.channels === 2 ? ' (Stereo)' : '')))
  const preserved = parseProToolsTimeline(afterReport.session_info).tracks.filter(t => !addedLabels.has(t.name))
  if (JSON.stringify(old) !== JSON.stringify(preserved)) throw new Error('Existing timeline changed during test.')
  console.log(JSON.stringify({ ...receipt, existingTracksPreserved: before.tracks.length, directory }, null, 2))
} catch (error) {
  console.error(error.message, `\nInspect: ${directory}`)
  process.exitCode = 1
} finally { client.close() }
