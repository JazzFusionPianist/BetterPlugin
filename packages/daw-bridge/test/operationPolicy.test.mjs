import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertRegionOperationEnabled } from '../src/operationPolicy.mjs'

test('dialog-driven Logic drop operations fail closed', () => {
  for (const operation of ['prepareLogic', 'armLogic', 'dropLogic']) {
    assert.throws(() => assertRegionOperationEnabled(operation), /Dialog-driven Logic restoration is disabled/)
  }
})

test('explicit export and Pro Tools operations remain available', () => {
  for (const operation of ['exportLogic', 'captureLogic', 'inspect', 'capture', 'import', 'exportTracks']) {
    assert.doesNotThrow(() => assertRegionOperationEnabled(operation))
  }
})

test('old native requests are rejected before settings, archives or helpers are accessed', async t => {
  const root = await mkdtemp(join(tmpdir(), 'orb-disabled-logic-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const operation of ['prepareLogic', 'dropLogic']) {
    await writeFile(join(root, 'request.json'), JSON.stringify({ operation, sessionId: 'old-ticket' }))
    await assert.rejects(promisify(execFile)(process.execPath, [
      '--experimental-strip-types', process.env.ORB_NATIVE_WORKER
        || fileURLToPath(new URL('../src/native.mjs', import.meta.url)), root,
    ]), error => error.code === 1)
    const response = JSON.parse(await readFile(join(root, 'response.json'), 'utf8'))
    assert.equal(response.ok, false)
    assert.match(response.error, /Dialog-driven Logic restoration is disabled/)
    assert.deepEqual((await readdir(root)).sort(), ['request.json', 'response.json'])
  }
})
