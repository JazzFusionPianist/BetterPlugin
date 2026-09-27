import test from 'node:test'
import assert from 'node:assert/strict'
import { createAudioDownloadCache } from '../src/lib/audioDownloadCache.ts'

test('three individual stems then all seven only downloads the missing four', async () => {
  const cache = createAudioDownloadCache(), calls = []
  const load = async url => { calls.push(url); return { base64: url, bytes: 1 } }
  const tracks = Array.from({ length: 7 }, (_, i) => `track-${i}`)
  for (const url of tracks.slice(0, 3)) await cache.get(url, load)
  assert.equal(calls.length, 3)
  const all = await Promise.all(tracks.map(url => cache.get(url, load)))
  assert.equal(calls.length, 7)
  assert.equal(all.length, 7)
  assert.ok(tracks.every(url => cache.peek(url)))
  await cache.get(tracks[5], load)
  assert.equal(calls.length, 7, 'individual after batch reuses the same bytes')
})

test('overlapping individual and batch requests share in-flight work and progress', async () => {
  const cache = createAudioDownloadCache()
  let finish, calls = 0, updates = 0
  const unsubscribe = cache.subscribe(() => updates++)
  const loader = async (_url, _signal, report) => {
    calls++; report({ received: 2, total: 4 })
    return new Promise(resolve => { finish = resolve })
  }
  const single = cache.get('one', loader), batch = cache.get('one', loader)
  assert.equal(single, batch)
  await Promise.resolve()
  assert.equal(calls, 1)
  assert.deepEqual(cache.progress('one'), { received: 2, total: 4 })
  finish({ base64: 'data', bytes: 4 })
  await single
  assert.ok(cache.peek('one'))
  assert.equal(cache.progress('one'), undefined)
  assert.ok(updates >= 3)
  unsubscribe()
})

test('failure is retryable and does not invalidate successful siblings', async () => {
  const cache = createAudioDownloadCache()
  await cache.get('good', async () => ({ base64: 'ok', bytes: 2 }))
  await assert.rejects(cache.get('bad', async () => { throw Error('offline') }))
  assert.ok(cache.peek('good')); assert.equal(cache.peek('bad'), undefined)
  await cache.get('bad', async () => ({ base64: 'retry', bytes: 2 }))
  assert.ok(cache.peek('bad'))
})

test('account clear cancels in-flight work and blocks stale completion', async () => {
  const cache = createAudioDownloadCache()
  let finish, signal
  const stale = cache.get('private', async (_url, s) => {
    signal = s
    return new Promise(resolve => { finish = resolve })
  })
  await Promise.resolve()
  cache.clear()
  assert.ok(signal.aborted)
  finish({ base64: 'private', bytes: 1 })
  await assert.rejects(stale, /account changed/)
  assert.equal(cache.peek('private'), undefined)
})

test('bounded cache evicts oldest bytes and notifies readers', async () => {
  const cache = createAudioDownloadCache(2)
  const loader = async url => ({ base64: url, bytes: 1 })
  await cache.get('a', loader); await cache.get('b', loader)
  await cache.get('a', loader); await cache.get('c', loader)
  assert.ok(cache.peek('a')); assert.ok(cache.peek('c'))
  assert.equal(cache.peek('b'), undefined)
})
