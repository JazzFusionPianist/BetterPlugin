import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { isDeepStrictEqual, promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { stageArchive } from './archive.mjs'
import { exportLogicAAF } from './logicExport.mjs'

const run = promisify(execFile)

async function runCapture(python, args, options) {
  try { return await run(python, args, options) }
  catch (error) {
    let report
    try { report = JSON.parse(error.stderr) } catch { /* Unexpected worker failure. */ }
    throw new Error(typeof report?.error === 'string' ? report.error
      : 'Logic capture failed. Nothing was sent. Inspect the local capture job before retrying.')
  }
}

/** No network listener or permission changes. The companion restricts keys to
 * a focused Logic file dialog. Requests live
 * in private per-operation folders and are never retried after a partial edit. */
export async function callLogicHelper(operation, projectId, options = {}) {
  if (!['inspect', 'captureAAF', 'importAAF', 'readbackAAF', 'checkDrop'].includes(operation)) throw new Error('Unknown Logic operation.')
  const root = options.root ?? join(homedir(), 'Library', 'Application Support', 'Orb', 'DawBridge', 'Jobs')
  const directory = join(root, randomUUID())
  await mkdir(directory, { recursive: true, mode: 0o700 })
  if (options.aaf) await copyFile(options.aaf, join(directory, 'Orb-regions.aaf'))
  const request = { operation, expiresAt: Date.now() + (options.timeout ?? 140000),
    ...(projectId ? { projectId } : {}), ...(options.point ? { point: options.point } : {}),
    ...(options.sampleRate ? { sampleRate: options.sampleRate } : {}) }
  await writeFile(join(directory, 'request.tmp'), JSON.stringify(request), { flag: 'wx', mode: 0o600 })
  await rename(join(directory, 'request.tmp'), join(directory, 'logic-request.json'))
  await (options.launch ?? (() => run('/usr/bin/open', ['-g', '-a', join(homedir(), 'Applications', 'Orb Logic Bridge.app')])) )()
  const started = Date.now()
  while (Date.now() - started < (options.timeout ?? 140000)) {
    let response
    try { response = JSON.parse(await readFile(join(directory, 'logic-response.json'), 'utf8')) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    if (response) {
      if (response.ok !== true) throw new Error(response.error || 'Logic helper failed.')
      if (projectId && response.snapshot?.projectId !== projectId) throw new Error('Logic project changed during the operation.')
      return { ...response, directory }
    }
    await delay(100)
  }
  // A running helper may already have changed the session: deliberately no retry.
  throw new Error(`Logic did not finish. Inspect Logic and the journal before retrying: ${directory}`)
}

export function unchangedExistingTracks(before, after, importedNames) {
  const fingerprint = track => JSON.stringify({
    name: track.AXDescription?.replace(/^Track \d+ /, ''),
    regions: track.regions.map(r => ({ name: r.AXDescription, help: r.AXHelp })),
  })
  const name = track => track.AXDescription?.match(/^Track \d+ [\u201c"](.+)[\u201d"]$/)?.[1]
  const old = before.tracks.map(fingerprint).sort()
  const remaining = after.tracks.filter(t => !importedNames.includes(name(t))).map(fingerprint).sort()
  if (JSON.stringify(old) !== JSON.stringify(remaining)) throw new Error('Existing Logic tracks changed during import. Inspect the session.')
  for (const expected of importedNames)
    if (after.tracks.filter(t => name(t) === expected).length !== 1) throw new Error('Imported Logic tracks were not uniquely identified.')
}

export async function prepareLogicRestore({ directory, python, script, sampleRate, helper = callLogicHelper }) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 384000) throw new Error('No valid native Logic sample rate.')
  const inspected = await helper('inspect')
  if (!inspected.snapshot?.projectId) throw new Error('No current saved Logic project.')
  const ticket = directory.split('/').at(-1)
  if (!/^[a-f0-9-]{32,36}$/i.test(ticket)) throw new Error('Invalid Logic preparation identity.')
  await exportLogicAAF({ archive: join(directory, 'input.orb-regions.zip'), directory, python, script,
    trackSuffix: ` [Orb ${ticket.replaceAll('-', '').slice(0, 8)}]`, expectedSampleRate: sampleRate })
  await writeFile(join(directory, 'logic-prepared.json'), JSON.stringify({ projectId: inspected.snapshot.projectId,
    sampleRate, expiresAt: Date.now() + 10 * 60 * 1000 }), { flag: 'wx', mode: 0o600 })
  return { status: 'prepared', ticket }
}

export async function restoreLogicDrop({ ticket, point, sampleRate, root, python, script, helper = callLogicHelper }) {
  if (!/^[a-f0-9-]{32,36}$/i.test(ticket) || !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite))
    throw new Error('Invalid Logic drop.')
  const directory = join(root, ticket)
  const prepared = JSON.parse(await readFile(join(directory, 'logic-prepared.json'), 'utf8'))
  if (Date.now() > prepared.expiresAt) throw new Error('The prepared Logic drop expired. Prepare it again.')
  if (!Number.isInteger(sampleRate) || sampleRate !== prepared.sampleRate) throw new Error('Logic sample rate changed after preparation.')
  const target = await helper('checkDrop', prepared.projectId, { point })
  const job = JSON.parse(await readFile(join(directory, 'logic-export.json'), 'utf8'))
  const imports = join(root, '..', 'LogicImports')
  await mkdir(imports, { recursive: true, mode: 0o700 })
  const key = createHash('sha256').update(`${prepared.projectId}\n${job.bundle.source?.captureId ?? job.bundle.id}`).digest('hex')
  const globalAttempt = join(imports, key + '.json')
  try {
    await writeFile(globalAttempt, JSON.stringify({ status: 'started', ticket }), { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('This source bundle was already imported or attempted in this project. Inspect the Logic import journal before retrying.')
    throw error
  }
  const attempt = join(directory, 'logic-import-attempt.json')
  await writeFile(attempt, JSON.stringify({ status: 'started', projectId: prepared.projectId }), { flag: 'wx', mode: 0o600 })
  try {
    await helper('importAAF', prepared.projectId, { aaf: join(directory, 'Orb-regions.aaf') })
    const readback = await helper('readbackAAF', prepared.projectId, { sampleRate })
    unchangedExistingTracks(target.snapshot, readback.snapshot, job.bundle.tracks.map(t => t.name))
    const { stdout } = await run(python, [script, join(directory, 'logic-export.json'), join(readback.directory, 'Logic-export.aaf')],
      { timeout: 120000, maxBuffer: 1024 * 1024 })
    const result = JSON.parse(stdout)
    if (result.status !== 'complete') throw new Error('Logic did not verify the imported regions.')
    await writeFile(attempt, JSON.stringify(result), { mode: 0o600 })
    await writeFile(globalAttempt, JSON.stringify({ ...result, ticket }), { mode: 0o600 })
    return result
  } catch (error) {
    await writeFile(attempt, JSON.stringify({ status: 'interrupted', error: error.message }), { mode: 0o600 })
    await writeFile(globalAttempt, JSON.stringify({ status: 'interrupted', ticket, error: error.message }), { mode: 0o600 })
    throw error
  }
}

export async function captureLogicSelection({ directory, python, script, sampleRate, helper = callLogicHelper }) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 384000) throw new Error('No valid native Logic sample rate.')
  const inspected = await helper('inspect')
  const projectId = inspected.snapshot?.projectId
  if (!projectId) throw new Error('No current saved Logic project.')
  const snapshot = join(directory, 'inspected-selection.json')
  await writeFile(snapshot, JSON.stringify(inspected.snapshot), { flag: 'wx', mode: 0o600 })
  await runCapture(python, [script, '--validate', snapshot], { timeout: 10000, maxBuffer: 1024 * 1024 })
  const captured = await helper('captureAAF', projectId, { sampleRate })
  const before = JSON.parse(await readFile(join(captured.directory, 'before.json'), 'utf8'))
  if (!isDeepStrictEqual(before.tracks, inspected.snapshot.tracks))
    throw new Error('The Logic selection changed before capture. Nothing was sent.')
  const archive = join(directory, 'selection.orb-regions.zip')
  await runCapture(python, [script, join(captured.directory, 'Logic-export.aaf'),
    join(captured.directory, 'before.json'), join(captured.directory, 'after.json'), archive],
  { timeout: 120000, maxBuffer: 1024 * 1024 })
  const { bundle } = await stageArchive(archive, join(directory, 'ValidatedAssets'))
  if (bundle.assets.some(asset => asset.sampleRate !== sampleRate)) throw new Error('Logic exported at a different sample rate. Nothing was sent.')
  return { name: 'selection.orb-regions.zip', tracks: bundle.tracks.length, regions: bundle.regions.length }
}
