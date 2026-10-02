import assert from 'node:assert/strict'
import { test } from 'node:test'
import { callJuceNative } from '../src/lib/juceBridge.ts'
import { regionBundleFunction } from '../src/lib/regionBundleProtocol.ts'

test('bundle and native placement protocols cannot be confused after merging', () => {
  assert.equal(regionBundleFunction([]), null)
  assert.equal(regionBundleFunction(['regionTransfer', 'trackExportHost']), null)
  assert.equal(regionBundleFunction(['regionTransferHost']), null)
  assert.equal(regionBundleFunction(['regionTransfer', 'regionTransferHost']), 'regionTransfer')
  assert.equal(regionBundleFunction(['regionTransfer', 'regionTransferHost', 'regionBundleTransfer']), 'regionBundleTransfer')
})

function native(t) {
  const previous = globalThis.window
  t.after(() => { globalThis.window = previous })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const subscriptions = new Map()
  const requests = []
  let next = 0
  const backend = {
    addEventListener(event, handler) {
      const id = next++
      subscriptions.set(id, { event, handler })
      return [event, id]
    },
    // JUCE returns a subscription tuple, not a DOM event/handler pair.
    removeEventListener(token) {
      assert.ok(Array.isArray(token))
      const [event, id] = token
      assert.equal(subscriptions.get(id)?.event, event)
      subscriptions.delete(id)
    },
    emitEvent(event, request) {
      assert.equal(event, '__juce__invoke')
      requests.push(request)
    },
  }
  globalThis.window = { __JUCE__: {
    initialisationData: { __juce__functions: ['writeAudioFiles', 'regionTransfer', 'getDawTimeline'], __juce__platform: ['test'] },
    backend,
  } }
  const emit = data => [...subscriptions.values()].forEach(({ handler }) => handler(data))
  const reply = (request, result) => emit({ promiseId: request.resultId, result })
  return { backend, requests, subscriptions, reply, emit }
}

test('browser and unregistered functions settle without emitting requests', async t => {
  const mock = native(t)
  assert.equal(await callJuceNative('missing'), 'error:no-function')
  delete window.__JUCE__
  assert.equal(await callJuceNative('regionTransfer'), 'error:no-juce')
  assert.equal(mock.requests.length, 0)
  assert.equal(mock.subscriptions.size, 0)
})

test('chat writes, region export and timeline replies cannot cross-resolve', async t => {
  const mock = native(t)
  const writes = callJuceNative('writeAudioFiles', ['audio'], 250000)
  const exportAAF = callJuceNative('regionTransfer', ['exportLogic'], 0)
  const timeline = callJuceNative('getDawTimeline', [], 750)
  assert.equal(new Set(mock.requests.map(r => r.resultId)).size, 3)
  mock.reply(mock.requests[2], '{"bpm":120}')
  mock.reply(mock.requests[0], 'armed')
  mock.reply(mock.requests[1], '{"ok":true,"status":"saved"}')
  assert.deepEqual(await Promise.all([writes, exportAAF, timeline]),
    ['armed', '{"ok":true,"status":"saved"}', '{"bpm":120}'])
  assert.equal(mock.subscriptions.size, 0)
})

test('save dialogs can remain open beyond the conversion deadline', async t => {
  const mock = native(t)
  let settled = false
  const pending = callJuceNative('regionTransfer', ['exportLogic'], 0).then(v => { settled = true; return v })
  t.mock.timers.tick(600000)
  await Promise.resolve()
  assert.equal(settled, false)
  mock.reply(mock.requests[0], '{"ok":true,"status":"saved"}')
  assert.equal(await pending, '{"ok":true,"status":"saved"}')
  assert.equal(mock.subscriptions.size, 0)
})

test('cancelled save dialogs release the response subscription', async t => {
  const mock = native(t)
  const pending = callJuceNative('regionTransfer', ['exportLogic'], 0)
  mock.reply(mock.requests[0], '{"ok":true,"status":"cancelled"}')
  assert.equal(await pending, '{"ok":true,"status":"cancelled"}')
  assert.equal(mock.subscriptions.size, 0)
})

test('a timed-out response cannot settle a later invocation', async t => {
  const mock = native(t)
  const first = callJuceNative('getDawTimeline', [], 750)
  t.mock.timers.tick(750)
  assert.equal(await first, 'error:timeout')
  assert.equal(mock.subscriptions.size, 0)
  const second = callJuceNative('getDawTimeline')
  mock.reply(mock.requests[0], 'old')
  assert.equal(mock.subscriptions.size, 1)
  mock.reply(mock.requests[1], 'current')
  assert.equal(await second, 'current')
})

test('synchronous completion releases both subscription and timeout', async t => {
  const mock = native(t)
  mock.backend.emitEvent = (_, request) => mock.reply(request, 'armed')
  assert.equal(await callJuceNative('writeAudioFiles'), 'armed')
  assert.equal(mock.subscriptions.size, 0)
  t.mock.timers.tick(10000)
})

test('a failed native emission does not leave a permanent listener', async t => {
  const mock = native(t)
  mock.backend.emitEvent = () => { throw new Error('disconnected') }
  assert.equal(await callJuceNative('regionTransfer', [], 0), 'error:bridge')
  assert.equal(mock.subscriptions.size, 0)
})

test('malformed and duplicate completions are ignored', async t => {
  const mock = native(t)
  const pending = callJuceNative('writeAudioFiles')
  for (const payload of [null, undefined, 2, {}, { promiseId: -900 }]) mock.emit(payload)
  mock.reply(mock.requests[0], 'armed')
  mock.reply(mock.requests[0], 'wrong')
  assert.equal(await pending, 'armed')
  assert.equal(mock.subscriptions.size, 0)
})
