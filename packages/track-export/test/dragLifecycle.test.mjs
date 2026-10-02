import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

test('native drag keeps ownership when a delayed WebKit arm arrives', { skip: process.platform !== 'darwin' }, () => {
  const binary = join(mkdtempSync(join(tmpdir(), 'slur-drag-lifecycle-')), 'lifecycle')
  const source = fileURLToPath(new URL('./DragLifecycleTest.mm', import.meta.url))
  const build = spawnSync('clang++', ['-std=c++17', '-fobjc-arc', '-framework', 'AppKit', '-framework', 'WebKit', source, '-o', binary], { encoding: 'utf8', timeout: 60000 })
  assert.equal(build.status, 0, build.stderr)
  const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 10000 })
  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /all checks passed/)
})
