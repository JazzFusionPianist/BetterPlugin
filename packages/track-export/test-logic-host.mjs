// Explicit local smoke test, restricted to the existing synthetic QA project.
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { inspectLogicTracks, exportLogicTracks } from './src/logicTracks.mjs'
const directory = join(homedir(), 'Library/Application Support/Slur/TrackExport/Jobs', randomUUID())
await mkdir(directory, { recursive: true, mode: 0o700 })
const snapshot = await inspectLogicTracks(directory)
if (snapshot.name !== 'Orb Logic Region QA') throw new Error('Open the synthetic Logic QA project first.')
console.log('QA job: ' + directory)
console.log(await exportLogicTracks({ directory, sessionId: snapshot.sessionId,
  options: { range: 'entire', revision: snapshot.revision, trackIds: snapshot.tracks.slice(0, 2).map(t => t.id) } }))
