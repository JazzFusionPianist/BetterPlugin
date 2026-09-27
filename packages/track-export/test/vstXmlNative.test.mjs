import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

test('macOS native VST XML parser rejects malformed and unsafe drag payloads', { skip: process.platform !== 'darwin' }, () => {
  const binary = join(mkdtempSync(join(tmpdir(), 'slur-vstxml-test-')), 'parser-test')
  const source = fileURLToPath(new URL('./VstXmlDropTest.mm', import.meta.url))
  const build = spawnSync('clang++', ['-std=c++17', '-fobjc-arc', '-framework', 'Foundation', source, '-o', binary], { encoding: 'utf8', timeout: 60000 })
  assert.equal(build.status, 0, build.stderr)
  const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 10000 })
  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /all checks passed/)
})
