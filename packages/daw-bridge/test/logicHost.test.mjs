import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { callLogicHelper, unchangedExistingTracks, restoreLogicDrop, captureLogicSelection } from '../src/logicHost.mjs'

async function temporary(t) {
  const parent = await mkdtemp(join(tmpdir(), 'orb-logic-host-'))
  t.after(() => rm(parent, { recursive: true, force: true }))
  const root = join(parent, 'Jobs')
  await mkdir(root)
  return root
}

test('helper uses bounded private requests and verifies current project identity', async t => {
  const root = await temporary(t)
  const projectId = 'file:///test.logicx'
  const result = await callLogicHelper('inspect', projectId, { root, launch: async () => {
    const [id] = await readdir(root)
    const request = JSON.parse(await readFile(join(root, id, 'logic-request.json')))
    assert.equal(request.operation, 'inspect')
    assert.equal(request.projectId, projectId)
    assert.ok(request.expiresAt > Date.now())
    await writeFile(join(root, id, 'logic-response.json'), JSON.stringify({ ok: true, snapshot: { projectId } }))
  } })
  assert.equal(result.snapshot.projectId, projectId)
})

test('helper project changes and permission denial fail without retry', async t => {
  const root = await temporary(t)
  for (const [response, error] of [
    [{ ok: true, snapshot: { projectId: 'different' } }, /project changed/],
    [{ ok: false, error: 'Accessibility not granted' }, /Accessibility/],
  ]) {
    let launched = 0
    const seen = new Set(await readdir(root))
    await assert.rejects(callLogicHelper('captureAAF', 'expected', { root, launch: async () => {
      launched++
      const id = (await readdir(root)).find(id => !seen.has(id))
      await writeFile(join(root, id, 'logic-response.json'), JSON.stringify(response))
    } }), error)
    assert.equal(launched, 1)
  }
})

test('unanswered helper calls are not retried automatically', async t => {
  const root = await temporary(t)
  let launched = 0
  await assert.rejects(callLogicHelper('inspect', undefined, { root, timeout: 1, launch: async () => { launched++ } }), /Inspect Logic/)
  assert.equal(launched, 1)
})

test('capture validation errors are readable and never start an export', async t => {
  const root = await temporary(t)
  for (const structured of [true, false]) {
    const directory = join(root, randomUUID())
    await mkdir(directory)
    const script = join(directory, 'validator.cjs')
    const stderr = structured ? JSON.stringify({ error: 'Select between 1 and 512 audio regions in Logic.' })
      : 'Traceback containing /private/user/path'
    await writeFile(script, `process.stderr.write(${JSON.stringify(stderr)}); process.exit(1)`)
    const calls = []
    await assert.rejects(captureLogicSelection({ directory, python: process.execPath, script, sampleRate: 48000,
      helper: async operation => { calls.push(operation); return { snapshot: { projectId: 'project' } } },
    }), error => {
      assert.match(error.message, structured ? /^Select between/ : /^Logic capture failed/)
      assert.doesNotMatch(error.message, /Traceback|private|Command failed/)
      return true
    })
    assert.deepEqual(calls, ['inspect'])
  }
})

const track = (name, number = 1, selected = false) => ({ AXDescription: `Track ${number} “${name}”`,
  regions: [{ AXDescription: 'Take', AXHelp: 'Region starts at exact position', AXSelected: selected }] })

test('capture compares snapshot content, not JSON property order', async t => {
  const root = await temporary(t)
  for (const changeSelection of [false, true]) {
    const directory = join(root, randomUUID())
    await mkdir(directory)
    const inspected = { projectId: 'project', tracks: [track('Original', 1, true)] }
    const region = inspected.tracks[0].regions[0]
    const before = { tracks: [{ regions: [{ AXSelected: !changeSelection,
      AXHelp: region.AXHelp, AXDescription: region.AXDescription }], AXDescription: inspected.tracks[0].AXDescription }] }
    await writeFile(join(directory, 'before.json'), JSON.stringify(before))
    const script = join(directory, 'capture.cjs')
    await writeFile(script, `if (process.argv[2] !== '--validate') {
      process.stderr.write(JSON.stringify({error:'Converter reached'})); process.exit(1)
    }`)
    await assert.rejects(captureLogicSelection({ directory, python: process.execPath, script, sampleRate: 48000,
      helper: async operation => operation === 'inspect' ? { snapshot: inspected } : { directory },
    }), changeSelection ? /selection changed before capture/ : /Converter reached/)
  }
})

test('import verification ignores selection and row renumbering, not content', () => {
  const before = { tracks: [track('Original')] }
  const after = { tracks: [track('Imported', 1), track('Original', 2, true)] }
  unchangedExistingTracks(before, after, ['Imported'])
  after.tracks[1].regions[0].AXHelp = 'Moved'
  assert.throws(() => unchangedExistingTracks(before, after, ['Imported']), /Existing Logic tracks changed/)
})

test('missing existing tracks and duplicate imported tracks fail verification', () => {
  assert.throws(() => unchangedExistingTracks({ tracks: [track('Original')] }, { tracks: [track('Imported')] }, ['Imported']), /Existing/)
  assert.throws(() => unchangedExistingTracks({ tracks: [] }, { tracks: [track('Imported'), track('Imported', 2)] }, ['Imported']), /uniquely/)
})

async function prepared(root, captureId = 'capture') {
  const ticket = randomUUID()
  const directory = join(root, ticket)
  await mkdir(directory)
  await writeFile(join(directory, 'logic-prepared.json'), JSON.stringify({ projectId: 'project', sampleRate: 48000, expiresAt: Date.now() + 100000 }))
  await writeFile(join(directory, 'logic-export.json'), JSON.stringify({ bundle: { id: 'bundle', source: { captureId }, tracks: [] } }))
  return { ticket, directory }
}

test('wrong drop target cannot start an import or consume its journal', async t => {
  const root = await temporary(t)
  const { ticket, directory } = await prepared(root)
  const calls = []
  await assert.rejects(restoreLogicDrop({ ticket, root, point: [12, 20], sampleRate: 48000, helper: async op => {
    calls.push(op); throw new Error('Not a Logic track lane')
  } }), /Not a Logic/)
  assert.deepEqual(calls, ['checkDrop'])
  await assert.rejects(access(join(directory, 'logic-import-attempt.json')), { code: 'ENOENT' })
})

test('interrupted import stays blocked even after preparing the bundle again', async t => {
  const root = await temporary(t)
  const first = await prepared(root)
  const second = await prepared(root)
  const calls = []
  const helper = async operation => {
    calls.push(operation)
    if (operation === 'checkDrop') return { snapshot: { tracks: [] } }
    throw new Error('Import interrupted')
  }
  await assert.rejects(restoreLogicDrop({ ticket: first.ticket, root, point: [0, 0], sampleRate: 48000, helper }), /Import interrupted/)
  const receipt = JSON.parse(await readFile(join(first.directory, 'logic-import-attempt.json')))
  assert.equal(receipt.status, 'interrupted')
  await assert.rejects(restoreLogicDrop({ ticket: second.ticket, root, point: [0, 0], sampleRate: 48000, helper }), /already imported or attempted/)
  assert.deepEqual(calls, ['checkDrop', 'importAAF', 'checkDrop'])
})

test('expired and malformed drops never call the helper', async t => {
  const root = await temporary(t)
  const { ticket, directory } = await prepared(root)
  let called = false
  const helper = async () => { called = true }
  await assert.rejects(restoreLogicDrop({ ticket, root, point: [0, 0], sampleRate: 44100, helper }), /sample rate changed/)
  await writeFile(join(directory, 'logic-prepared.json'), JSON.stringify({ projectId: 'project', expiresAt: 1 }))
  await assert.rejects(restoreLogicDrop({ ticket, root, point: [0, 0], helper }), /expired/)
  await assert.rejects(restoreLogicDrop({ ticket: '../escape', root, point: [0, 0], helper }), /Invalid/)
  await assert.rejects(restoreLogicDrop({ ticket, root, point: [NaN, 0], helper }), /Invalid/)
  assert.equal(called, false)
})
