import test from 'node:test'
import assert from 'node:assert/strict'
import { readLogicSelection, matchLogicDrop, parseLogicPosition, applyLogicLayout } from '../../core/lib/logicRegionDrop.ts'
import { hasCompleteLayout, hasMusicalLayout, parseRegionBundle, prepareRegionBundle, readBundleAttachment, uploadRegionBundle } from '../../core/lib/regionBundle.ts'
import { createRegionArchive, prepareArchivedRegionBundle } from '../../core/lib/regionArchive.ts'

function snapshot() {
  const region = (name, start, end, selected = true) => ({ AXDescription: name, AXSelected: selected,
    AXHelp: `Region starts at ${start}  and ends at ${end} , Audio region. Further help.` })
  return { version: 1, projectId: 'file:///private/Music/Test.logicx/', tracks: [
    { AXDescription: 'Track 6 “Drums”', regions: [region('region 1', '1 bar 3 beats 11 ticks', '1 bar 3 beats 3 divisions 171 ticks')] },
    { AXDescription: 'Track 7 “Guitar”', regions: [region('region 2', '2 bars 11 ticks', '2 bars 3 divisions 171 ticks')] },
    { AXDescription: 'Track 8 “Unselected”', regions: [region('region 1', '3 bars', '4 bars', false)] },
  ] }
}

test('captures only selected track names and musical positions, not unselected duplicates', () => {
  const selection = readLogicSelection(snapshot())
  assert.equal(selection.regions.length, 2)
  assert.deepEqual(selection.regions.map(r => [r.name, r.trackName, r.trackOrder]), [['region 1', 'Drums', 5], ['region 2', 'Guitar', 6]])
  assert.deepEqual(selection.regions[0].start, { bar: 1, beat: 3, division: 1, tick: 11, divisionDenominator: null, resolution: 'logic-tick' })
  assert.equal(selection.regions[0].end.division, 3)
})

test('file completion order never substitutes for region identity', () => {
  const selection = readLogicSelection(snapshot())
  const matches = matchLogicDrop(selection, selection, ['region 2.wav', 'region 1.aif'])
  assert.deepEqual(matches.map(r => r.trackName), ['Guitar', 'Drums'])
  for (const names of [['region 1.wav'], ['region 1.wav', 'region 1.wav'], ['renamed.wav', 'region 2.wav']])
    assert.throws(() => matchLogicDrop(selection, selection, names), /Nothing was sent/)
})

test('changed project, selection, position or duplicate selected names reject the whole drop', () => {
  const before = readLogicSelection(snapshot())
  for (const mutate of [s => { s.project = 'other.logicx' }, s => { s.regions.pop() },
    s => { s.regions[0].start.tick++ }, s => { s.regions[0].trackName = 'Moved' }]) {
    const after = structuredClone(before); mutate(after)
    assert.throws(() => matchLogicDrop(before, after, ['region 1.wav', 'region 2.wav']))
  }
  const duplicate = structuredClone(before); duplicate.regions[1].name = duplicate.regions[0].name
  assert.throws(() => matchLogicDrop(duplicate, duplicate, ['region 1.wav', 'region 1.wav']))
})

test('rejects malformed or unsupported position descriptions rather than guessing', () => {
  for (const input of ['', '-1 bar', '0 bars', 'one bar', '1 bar 2 bars', '1 bar garbage', '1000001 bars', '1 bar 999999 ticks'])
    assert.throws(() => parseLogicPosition(input))
  assert.throws(() => parseLogicPosition('1 bar', 3))
  assert.equal(parseLogicPosition('2 bars').tick, 1)
  assert.equal(parseLogicPosition('2 bars 3 divisions', 8).divisionDenominator, 8)
  for (const value of [null, {}, { ...snapshot(), tracks: [null] }]) assert.throws(() => readLogicSelection(value))
})

test('musical layout survives upload/receive validation without claiming sample precision or leaking paths', async () => {
  const files = [new File(['two'], 'region 2.wav'), new File(['one'], 'region 1.wav')]
  const prepared = await prepareRegionBundle(files, async () => ({ frames: 1000, channels: 2, sampleRate: 48000 }))
  const selection = readLogicSelection(snapshot())
  const matched = matchLogicDrop(selection, selection, files.map(f => f.name))
  prepared.bundle = applyLogicLayout(prepared.bundle, matched.map(region => ({ region, captureId: 'capture', projectId: 'hashed-project', })))
  const entries = await uploadRegionBundle(prepared, async f => ({ url: `orb-file:audio/${f.name.replaceAll(' ', '-')}`, name: f.name }))
  const received = readBundleAttachment(entries).bundle
  assert.equal(hasCompleteLayout(received), false)
  assert.equal(hasMusicalLayout(received), true)
  assert.deepEqual(received.regions.map(r => r.start), [null, null])
  assert.deepEqual(received.regions.map(r => r.musicalStart.bar), [2, 1])
  assert.deepEqual(received.tracks.map(t => t.name), ['Guitar', 'Drums'])
  assert.equal(JSON.stringify(received).includes('/private/'), false)
  assert.deepEqual(parseRegionBundle(received), received)
  const archived = await prepareArchivedRegionBundle(await createRegionArchive(prepared))
  assert.deepEqual(archived.bundle.regions, received.regions)
  assert.deepEqual(archived.bundle.tracks, received.tracks)
  const invalid = structuredClone(received); invalid.regions[0].musicalStart.divisionDenominator = 3
  assert.equal(parseRegionBundle(invalid), null)
})
