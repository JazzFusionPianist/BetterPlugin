import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { connectProTools } from './ptsl.mjs'
import { inspectProToolsTracks, exportProToolsTracks } from './proToolsTracks.mjs'

const folder = resolve(process.argv[2])
async function main() {
let client, lock, owned = false
try {
  const request = JSON.parse(await readFile(join(folder, 'request.json'), 'utf8'))
  const settings = JSON.parse(await readFile(join(dirname(resolve(process.argv[1])), 'settings.json'), 'utf8'))
  if (!['inspectTracks', 'exportTracks'].includes(request.operation)) throw new Error('Unknown track export operation.')
  client = connectProTools(settings.sdk)
  await client.register()
  let result
  if (request.operation === 'inspectTracks') result = await inspectProToolsTracks(client.call)
  else {
    // Share the host-mutation lock with the experimental region bridge, if installed.
    const cache = join(homedir(), 'Library', 'Application Support', 'Orb', 'RegionTransfers')
    await mkdir(cache, { recursive: true, mode: 0o700 })
    lock = join(cache, 'pro-tools.lock')
    try { await writeFile(lock, JSON.stringify({ pid: process.pid, folder, operation: 'exportTracks' }), { flag: 'wx', mode: 0o600 }) }
    catch (e) { if (e.code === 'EEXIST') throw new Error('Another Pro Tools transfer is running or interrupted. Inspect the local transfer journal before retrying.'); throw e }
    owned = true
    result = await exportProToolsTracks({ call: client.call, sessionId: request.sessionId, options: request.options, directory: folder })
  }
  await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: true, ...result }), { mode: 0o600 })
} catch (e) {
  await writeFile(join(folder, 'response.json'), JSON.stringify({ ok: false, error: e.message }), { mode: 0o600 })
  process.exitCode = 1
} finally { client?.close(); if (owned) await unlink(lock) }
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
