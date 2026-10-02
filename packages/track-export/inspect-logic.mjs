// Local developer smoke test; read-only except for its private diagnostic job.
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { inspectLogicTracks } from './src/logicTracks.mjs'
const directory = join(homedir(), 'Library/Application Support/Slur/TrackExport/Jobs', randomUUID())
await mkdir(directory, { recursive: true, mode: 0o700 })
console.log(JSON.stringify(await inspectLogicTracks(directory), null, 2))
