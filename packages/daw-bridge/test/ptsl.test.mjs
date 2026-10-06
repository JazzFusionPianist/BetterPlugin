import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectSession } from '../src/ptsl.mjs'

test('session inspection does not stop at a page-local track total', async () => {
  const tracks = Array.from({ length: 137 }, (_, index) => ({ id: `track-${index}`, index }))
  const session = await inspectSession(async (command, body) => {
    if (command === 'GetSessionIDs') return { instance_id: 'same-session' }
    if (command === 'GetSessionSampleRate') return { sample_rate: 'SRate_48000' }
    if (command === 'GetTrackList') {
      const offset = body.pagination_request.offset
      const page = tracks.slice(offset, offset + 100)
      return { track_list: page, pagination_response: { total: page.length, offset, limit: 100 } }
    }
    throw new Error(`Unexpected ${command}`)
  })
  assert.deepEqual(session.tracks, tracks)
})
