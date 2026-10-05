import { readFile, writeFile, mkdir, unlink, rename } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { connectProTools, inspectSession } from './ptsl.mjs'
import { captureProToolsSelection } from './proToolsCapture.mjs'
import { inspectProToolsTracks, exportProToolsTracks } from './proToolsTracks.mjs'
import { importToProTools } from './proToolsImport.mjs'
import { stageArchive } from './archive.mjs'
import { exportLogicAAF } from './logicExport.mjs'
import { captureLogicSelection, callLogicHelper } from './logicHost.mjs'
import { assertRegionOperationEnabled } from './operationPolicy.mjs'

const run = promisify(execFile)
const folder = resolve(process.argv[2] || '')
const scriptDirectory = dirname(resolve(process.argv[1]))
async function main() {
let client, lock, lockOwned = false
try {
  const request = JSON.parse(await readFile(join(folder, 'request.json'), 'utf8'))
  assertRegionOperationEnabled(request.operation)
  if (!['inspect', 'inspectTracks', 'exportTracks', 'capture', 'import', 'exportLogic', 'captureLogic', 'inspectLogic'].includes(request.operation)) throw new Error('Unknown region operation.')
  if (request.operation === 'inspectLogic') {
    const result = await callLogicHelper('inspect', undefined, { timeout: 8000 })
    await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: true, snapshot: result.snapshot }), { mode: 0o600 })
    return
  }
  const settings = JSON.parse(await readFile(join(scriptDirectory, '..', 'settings.json'), 'utf8'))
  if (request.operation === 'captureLogic') {
    const result = await captureLogicSelection({ directory: folder, python: settings.python, sampleRate: Number(request.sessionId),
      script: join(scriptDirectory, 'logicCapture.py') })
    await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: true, ...result }), { mode: 0o600 })
    return
  }
  if (request.operation === 'exportLogic') {
    const result = await exportLogicAAF({ archive: join(folder, 'input.orb-regions.zip'), directory: folder,
      python: settings.python, script: join(scriptDirectory, 'logicAAF.py') })
    await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: true, ...result }), { mode: 0o600 })
    return
  }
  client = connectProTools(settings.sdk)
  await client.register()
  if (request.operation === 'inspectTracks') {
    const result = await inspectProToolsTracks(client.call)
    await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: true, ...result }), { mode: 0o600 })
    return
  }
  const session = await inspectSession(client.call)
  const name = (await client.call('GetSessionName')).session_name
  let result = { sessionId: session.instanceId, sampleRate: session.sampleRate, name }
  if (request.operation !== 'inspect') {
    if (request.sessionId !== session.instanceId) throw new Error('The inspected Pro Tools session changed.')
    const cache = join(homedir(), 'Library', 'Application Support', 'Orb', 'RegionTransfers')
    await mkdir(cache, { recursive: true, mode: 0o700 })
    lock = join(cache, 'pro-tools.lock')
    try { await writeFile(lock, JSON.stringify({ pid: process.pid, operation: request.operation, folder }), { flag: 'wx', mode: 0o600 }) }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error(`Another Pro Tools transfer is running or interrupted. Inspect ${lock} before retrying.`)
      throw error
    }
    lockOwned = true
    if (request.operation === 'exportTracks') {
      result = { ...result, ...await exportProToolsTracks({ call: client.call, sessionId: request.sessionId,
        options: request.options, directory: folder }) }
    } else if (request.operation === 'capture') {
      const directory = join(cache, 'Captures', randomUUID())
      const capture = await captureProToolsSelection({ call: client.call, expectedSessionId: request.sessionId, directory,
        journal: { record: receipt => writeFile(join(directory, 'journal.json'), JSON.stringify(receipt), { mode: 0o600 }) } })
      const archive = join(folder, 'selection.orb-regions.zip')
      await run(settings.python, [join(scriptDirectory, 'proToolsAAF.py'),
        capture.aaf, capture.capture, capture.timeline, archive], { timeout: 120000, maxBuffer: 1024 * 1024 })
      // Shared parser and hashes validate the producer's output before returning it to the app.
      const staged = await stageArchive(archive, join(cache, 'CapturedAssets'))
      result = { ...result, name: 'selection.orb-regions.zip', regions: staged.bundle.regions.length,
        tracks: staged.bundle.tracks.length }
    } else {
      const { bundle, paths } = await stageArchive(join(folder, 'input.orb-regions.zip'), join(cache, 'Assets'))
      const key = createHash('sha256').update(`${session.instanceId}\n${bundle.source?.captureId ?? bundle.id}`).digest('hex')
      const attempts = join(cache, 'Imports')
      await mkdir(attempts, { recursive: true, mode: 0o700 })
      const journalPath = join(attempts, key + '.json')
      const journal = {
        async begin(receipt) {
          try { await writeFile(journalPath, JSON.stringify(receipt), { flag: 'wx', mode: 0o600 }) }
          catch (error) {
            if (error.code === 'EEXIST') throw new Error(`This source capture was already imported or attempted. Review ${journalPath}.`)
            throw error
          }
        },
        async record(receipt) {
          const temporary = journalPath + '.' + randomUUID()
          await writeFile(temporary, JSON.stringify(receipt), { flag: 'wx', mode: 0o600 })
          await rename(temporary, journalPath)
        },
      }
      result = await importToProTools({ bundle, paths, call: client.call, expectedSessionId: request.sessionId, journal })
    }
  }
  await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: true, ...result }), { mode: 0o600 })
} catch (error) {
  await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: false, error: error.message }), { mode: 0o600 })
  process.exitCode = 1
} finally {
  client?.close()
  if (lockOwned) await unlink(lock)
}
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
