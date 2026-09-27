import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, realpath, stat, writeFile, unlink } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { homedir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { zipSync, strToU8 } from 'fflate'
import { probeWave } from './proToolsTracks.mjs'
import { parseRegionBundle } from '../../core/lib/regionBundle.ts'

const run = promisify(execFile)
const LIMIT = 298 * 1024 * 1024
export async function executeLogic(request, directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeFile(join(directory, 'logic-request.json'), JSON.stringify({ ...request, expiresAt: Date.now() + 120000 }), { mode: 0o600 })
  await unlink(join(directory, 'logic-response.json')).catch(error => { if (error.code !== 'ENOENT') throw error })
  const executable = join(homedir(), 'Applications/Slur Track Bridge.app/Contents/MacOS/SlurTrackBridge')
  try { await run(executable, [directory], { timeout: request.operation === 'export' ? 1740000 : 120000, maxBuffer: 1024 * 1024 }) }
  catch (cause) {
    const error = new Error(cause.code === 'ENOENT' ? 'Install the matching Slur Track Bridge before connecting Logic.'
      : 'Logic bridge stopped unexpectedly. Check Logic and the local export journal before retrying.')
    error.cleanupUncertain = request.operation === 'export'
    throw error
  }
  let result
  try { result = JSON.parse(await readFile(join(directory, 'logic-response.json'), 'utf8')) }
  catch {
    const error = new Error('Logic returned no valid completion receipt. Inspect Logic before retrying.')
    error.cleanupUncertain = request.operation === 'export'; throw error
  }
  if (!result.ok) {
    const error = new Error(result.error || 'Logic export failed.')
    error.cleanupUncertain = result.cleanupUncertain === true
    throw error
  }
  return result
}
export async function inspectLogicTracks(directory, execute = executeLogic) {
  return (await execute({ operation: 'inspect' }, directory)).snapshot
}
export async function exportLogicTracks({ sessionId, options, directory, execute = executeLogic }) {
  if (options?.range !== 'entire' || !Array.isArray(options.trackIds) || !options.trackIds.length
    || options.trackIds.length > 64 || new Set(options.trackIds).size !== options.trackIds.length
    || !/^[a-f0-9]{64}$/.test(options.revision ?? '')
    || options.trackIds.some(id => typeof id !== 'string' || !id.startsWith(options.revision + ':')))
    throw new Error('Refresh Logic tracks and choose 1–64 tracks with Entire session.')
  const receipt = { daw: 'Logic Pro', sessionId, options, status: 'exporting' }
  const journal = () => writeFile(join(directory, 'export.json'), JSON.stringify(receipt), { mode: 0o600 })
  await journal()
  try {
    const result = await execute({ operation: 'export', sessionId, options }, directory)
    if (result.sessionId !== sessionId || result.revision !== options.revision || result.restored !== true
      || !Array.isArray(result.files) || result.files.length !== options.trackIds.length
      || new Set(result.files.map(f => f.id)).size !== options.trackIds.length
      || result.files.some(f => !options.trackIds.includes(f.id)))
      throw new Error('Logic did not confirm the selected tracks and restoration. Nothing was attached.')
    const bundle = { format: 'orb-region-bundle', version: 1, id: randomUUID(), timebase: 'song-samples',
      source: { daw: 'Logic Pro', projectId: sessionId, captureId: randomUUID() }, tracks: [], regions: [], assets: [] }
    const files = {}, assetPaths = {}, root = await realpath(directory)
    let total = 0, duration, sampleRate
    for (const [index, output] of result.files.entries()) {
      if (typeof output.path !== 'string' || typeof output.name !== 'string') throw new Error('Invalid Logic output.')
      const path = await realpath(join(directory, output.path)), info = await stat(path)
      if (!path.startsWith(root + sep) || !info.isFile()) throw new Error('Invalid Logic output path.')
      total += info.size
      if (total > LIMIT) throw new Error('Logic export exceeds 300 MB. Choose fewer tracks.')
      const bytes = await readFile(path), wave = probeWave(bytes)
      if (wave.bits !== 24 || ![1, 2].includes(wave.channels) || !wave.frames
        || (duration !== undefined && (duration !== wave.frames || sampleRate !== wave.sampleRate)))
        throw new Error('Logic stems have different lengths or unsupported audio formats. Nothing was attached.')
      duration = wave.frames; sampleRate = wave.sampleRate
      const hash = createHash('sha256').update(bytes).digest('hex')
      const name = (output.name.replace(/[\x00-\x1f/\\:]/g, '_').slice(0, 100) || 'Track') + '.wav'
      if (!assetPaths[hash]) {
        assetPaths[hash] = 'audio/' + hash + '.wav'; files[assetPaths[hash]] = bytes
        bundle.assets.push({ id: hash, sha256: hash, name, bytes: bytes.length, sampleRate, channels: wave.channels, frames: duration })
      }
      bundle.tracks.push({ id: output.id, name: output.name, order: index, channels: wave.channels })
      bundle.regions.push({ id: randomUUID(), assetId: hash, trackId: output.id, name,
        start: { samples: 0, sampleRate }, offsetFrames: 0, lengthFrames: duration })
    }
    if (!parseRegionBundle(bundle)) throw new Error('Invalid Logic track metadata.')
    files['orb-regions.json'] = strToU8(JSON.stringify({ ...bundle, assetPaths }))
    await writeFile(join(directory, 'selection.orb-regions.zip'), zipSync(files, { level: 0 }), { mode: 0o600 })
    receipt.status = 'complete'; await journal()
    return { name: 'tracks.orb-regions.zip', tracks: result.files.length }
  } catch (error) { receipt.status = 'failed'; receipt.error = error.message; await journal(); throw error }
}
