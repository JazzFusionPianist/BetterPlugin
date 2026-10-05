import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stageArchive } from './archive.mjs'
import { hasCompleteLayout } from '../../core/lib/regionBundle.ts'

/** Export only. Logic must import the AAF before timeline restoration is complete. */
export async function exportLogicAAF({ archive, directory, python, script, trackSuffix = '', expectedSampleRate }) {
  if (!script) throw new Error('The Logic AAF converter is not configured.')
  const { bundle, paths } = await stageArchive(archive, join(directory, 'assets'))
  if (!hasCompleteLayout(bundle)) throw new Error('Verified source layout is required for Logic export.')
  if (expectedSampleRate !== undefined && bundle.assets.some(asset => asset.sampleRate !== expectedSampleRate))
    throw new Error('Automatic Logic restoration currently requires the project and bundle to have the same sample rate.')
  if (trackSuffix) bundle.tracks = bundle.tracks.map(track => ({ ...track, name: track.name + trackSuffix }))
  const job = join(directory, 'logic-export.json')
  await writeFile(job, JSON.stringify({ bundle, paths: Object.fromEntries(paths) }), { flag: 'wx', mode: 0o600 })
  const destination = join(directory, 'Orb-regions.aaf')
  const { stdout } = await promisify(execFile)(python, [script, job, destination], { timeout: 120000, maxBuffer: 1024 * 1024 })
  return { ...JSON.parse(stdout), path: destination }
}
