import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProToolsTimeline, verifyProToolsTimeline } from '../src/proToolsTimeline.mjs'

const report = 'SESSION NAME:\tOrb Test\r\nSAMPLE RATE:\t48000.000000\r\n'
  + 'TRACK NAME:\tStereo Take (Stereo)\r\nCOMMENTS:\t\r\nSTATE: \r\n'
  + 'CHANNEL \tEVENT \tCLIP NAME \tSTART TIME \tEND TIME \tDURATION \tSTATE\r\n'
  + '1\t1\tTake.L\t12345\t36345\t24000\tUnmuted\r\n'
  + '2\t1\tTake.R\t12345\t36345\t24000\tUnmuted\r\n'
const expected = [{ id: 'new-track', name: 'Stereo Take', channels: 2, clips: [
  { channel: 1, name: 'Take.L', start: 12345, duration: 24000 },
  { channel: 2, name: 'Take.R', start: 12345, duration: 24000 },
] }]
const tracks = [{ id: 'existing', name: 'Other' }, { id: 'new-track', name: 'Stereo Take' }]

test('sample EDL verifies both stereo channels on the ID-bound destination track', () => {
  assert.equal(parseProToolsTimeline(report).tracks[0].events.length, 2)
  assert.deepEqual(verifyProToolsTimeline(report, expected, tracks, 48000), { trackCount: 1, channelClipCount: 2 })
})

test('wrong time format, truncated rows, and duplicate track labels fail closed', () => {
  assert.throws(() => parseProToolsTimeline(report.replace('12345', '00:00:01:00')), /integer samples/)
  assert.throws(() => parseProToolsTimeline(report.replace('36345', '36344')), /duration/)
  assert.throws(() => verifyProToolsTimeline(report + '\nTRACK NAME:\tStereo Take (Stereo)', expected, tracks, 48000), /uniquely/)
  assert.throws(() => verifyProToolsTimeline(report, expected, tracks.slice(0, 1), 48000), /track changed/)
  assert.throws(() => verifyProToolsTimeline(report.replace('48000.000000', '44100'), expected, tracks, 48000), /sample rate/)
})

test('missing or additional channel instances are never treated as restored', () => {
  assert.throws(() => verifyProToolsTimeline(report.replace('2\t1\tTake.R\t12345\t36345\t24000\tUnmuted\r\n', ''), expected, tracks, 48000), /verification failed/)
  assert.throws(() => verifyProToolsTimeline(report + '1\t2\tExtra\t40000\t50000\t10000\tUnmuted\n', expected, tracks, 48000), /Unexpected clips/)
})
