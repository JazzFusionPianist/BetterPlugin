// Explicit synthetic session only; never run against a user's song.
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectLunaTracks, exportLunaTracks } from '../src/lunaTracks.mjs'
import { unpackRegionArchive } from '../../core/lib/regionArchive.ts'
const snapshot = await inspectLunaTracks()
assert.equal(snapshot.name, 'Slur LUNA Export QA 2026-09-23', 'Open only the synthetic QA session.')
const directory = await mkdtemp(join(tmpdir(), 'slur-luna-live-'))
const trackIds = snapshot.tracks.filter(t => !t.disabledReason).map(t => t.id)
const beforeIds = snapshot.tracks.map(t => t.id)
const result = await exportLunaTracks({ sessionId: snapshot.sessionId, directory,
  options: { trackIds, range: 'entire', ...snapshot.ranges.entire, sampleRate: snapshot.sampleRate } })
const archive = await unpackRegionArchive(new Uint8Array(await readFile(join(directory, 'selection.orb-regions.zip'))))
assert.equal(result.tracks, trackIds.length)
assert.equal(archive.bundle.source.daw, 'LUNA')
assert.ok(archive.bundle.regions.every(r => r.start.samples === 0 && r.lengthFrames === snapshot.ranges.entire.end))
assert.deepEqual((await inspectLunaTracks()).tracks.map(t => t.id), beforeIds)
console.log(JSON.stringify({ tracks: result.tracks, range: snapshot.ranges.entire, sampleRate: snapshot.sampleRate, directory, addedProjectTracks: 0 }))
