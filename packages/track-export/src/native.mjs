import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { connectProTools } from './ptsl.mjs'
import { inspectProToolsTracks, inspectProToolsTrackRange, exportProToolsTracks } from './proToolsTracks.mjs'
import { supportsTrackExportOperation } from '../../core/lib/trackExportPolicy.ts'
import { inspectLunaRegions, captureLunaRegions, inspectLunaDestination, importLunaRegions } from './lunaRegions.mjs'
import { inspectProToolsDestination, importProToolsRegions } from './proToolsRegions.mjs'

import { suggestProjects, inspectProjectRegions, captureProjectRegions } from './projectRegions.mjs'
import { reaperConnected, reaperBridgeInstalled, inspectReaperTracks, inspectReaperTrackRange, exportReaperTracks, inspectReaperRegions, exportReaperRegions } from './reaperBridge.mjs'
import { listTaps, inspectTapTracks, exportTapTracks, inspectTapRegions, exportTapRegions } from './tapCache.mjs'

const STEM_OPERATIONS = {
  // What this host can use right now; the page picks the first available route.
  stemStatus: async c => ({
    reaper: { installed: await reaperBridgeInstalled(), connected: await reaperConnected() },
    taps: (await listTaps(c)).length,
  }),
  suggestProjects: c => suggestProjects(c),
  inspectProjectRegions: c => inspectProjectRegions(c),
  exportProjectRegions: c => captureProjectRegions(c),
  inspectReaperTracks: () => inspectReaperTracks(),
  inspectReaperTrackRange: () => inspectReaperTrackRange(),
  exportReaperTracks: c => exportReaperTracks(c),
  inspectReaperRegions: () => inspectReaperRegions(),
  exportReaperRegions: c => exportReaperRegions(c),
  inspectTapTracks: c => inspectTapTracks(c),
  exportTapTracks: c => exportTapTracks(c),
  inspectTapRegions: c => inspectTapRegions(c),
  exportTapRegions: c => exportTapRegions(c),
}

const folder = resolve(process.argv[2])
async function main() {
let client, lock, owned = false, retainLock = false
try {
  const request = JSON.parse(await readFile(join(folder, 'request.json'), 'utf8'))
  // Satellite-free REAPER/project-file routes and the Slur Tap fallback.
  // host, hostKey and projectPath are injected by the native bridge, never by the page.
  if (Object.hasOwn(STEM_OPERATIONS, request.operation)) {
    const context = { host: String(request.host ?? ''), hostKey: String(request.hostKey ?? ''), projectPath: request.projectPath,
      sessionId: request.sessionId, options: request.options, directory: folder }
    if (request.operation === 'exportReaperTracks') {
      const cache = join(homedir(), 'Library', 'Application Support', 'Slur', 'RegionTransfers')
      await mkdir(cache, { recursive: true, mode: 0o700 })
      lock = join(cache, 'reaper.lock')
      try { await writeFile(lock, JSON.stringify({ pid: process.pid, folder }), { flag: 'wx', mode: 0o600 }) }
      catch (e) { if (e.code === 'EEXIST') throw new Error('Another REAPER render is running or was interrupted. Check REAPER before retrying.'); throw e }
      owned = true
    }
    if (/ProjectRegions$/.test(request.operation) && typeof context.projectPath !== 'string') throw new Error('Link the project file first.')
    const result = await STEM_OPERATIONS[request.operation](context)
    await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: true, ...result }), { mode: 0o600 })
    return
  }
  if (['inspectLunaRegions', 'exportLunaRegions', 'inspectLunaDestination', 'importLunaRegions'].includes(request.operation)) {
    let result
    if (request.operation === 'inspectLunaRegions') result = await inspectLunaRegions()
    else if (request.operation === 'inspectLunaDestination') result = await inspectLunaDestination()
    else {
      const cache = join(homedir(), 'Library', 'Application Support', 'Slur', 'RegionTransfers')
      await mkdir(cache, { recursive: true, mode: 0o700 })
      lock = join(cache, 'luna.lock')
      try { await writeFile(lock, JSON.stringify({ pid: process.pid, folder, operation: request.operation }), { flag: 'wx', mode: 0o600 }) }
      catch (e) { if (e.code === 'EEXIST') throw new Error('Another LUNA transfer is running or interrupted. Inspect its journal before retrying.'); throw e }
      owned = true
      if (request.operation === 'exportLunaRegions') result = await captureLunaRegions({ sessionId: request.sessionId, options: request.options, directory: folder })
      else {
        const encoded = request.options?.archive
        if (typeof encoded !== 'string' || !encoded.length || encoded.length > 400 * 1024 * 1024
          || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Invalid region archive.')
        result = await importLunaRegions({ sessionId: request.sessionId, archive: Buffer.from(encoded, 'base64'), directory: folder })
      }
    }
    await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: true, ...result }), { mode: 0o600 })
    return
  }
  if (!supportsTrackExportOperation(request.operation) && !['inspectProToolsDestination', 'importProToolsRegions'].includes(request.operation))
    throw new Error('Unsupported transfer operation.')
  const settings = JSON.parse(await readFile(join(dirname(resolve(process.argv[1])), 'settings.json'), 'utf8'))
  client = connectProTools(settings.sdk)
  await client.register()
  let result
  if (request.operation === 'inspectTracks') result = { daw: 'Pro Tools', ...await inspectProToolsTracks(client.call) }
  else if (request.operation === 'inspectTrackRange') result = await inspectProToolsTrackRange(client.call)
  else if (request.operation === 'inspectProToolsDestination') result = await inspectProToolsDestination(client.call)
  else {
    // Share the host-mutation lock with the experimental region bridge, if installed.
    const cache = join(homedir(), 'Library', 'Application Support', 'Orb', 'RegionTransfers')
    await mkdir(cache, { recursive: true, mode: 0o700 })
    lock = join(cache, 'pro-tools.lock')
    try { await writeFile(lock, JSON.stringify({ pid: process.pid, folder, operation: request.operation }), { flag: 'wx', mode: 0o600 }) }
    catch (e) { if (e.code === 'EEXIST') throw new Error('Another DAW transfer is running or interrupted. Inspect the local transfer journal before retrying.'); throw e }
    owned = true
    if (request.operation === 'importProToolsRegions') {
      const encoded = request.options?.archive
      if (typeof encoded !== 'string' || !encoded.length || encoded.length > 400 * 1024 * 1024
        || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Invalid region archive.')
      result = await importProToolsRegions({ call: client.call, sessionId: request.sessionId, archive: Buffer.from(encoded, 'base64'), directory: folder })
    } else result = await exportProToolsTracks({ call: client.call, sessionId: request.sessionId, options: request.options, directory: folder })
  }
  await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: true, ...result }), { mode: 0o600 })
} catch (e) {
  retainLock = e.cleanupUncertain === true
  await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: false, error: e.message }), { mode: 0o600 })
  process.exitCode = 1
} finally { client?.close(); if (owned && !retainLock) await unlink(lock) }
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
