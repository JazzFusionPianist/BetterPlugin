import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Installed helper is opt-in for local integration checks. These tests exercise
// only rejection paths before capture; they do not open or manipulate any DAW.
const helper = process.env.SLUR_VISUAL_PROBE_TEST_BINARY
const skip = !helper
const root = join(homedir(), 'Library/Application Support/Slur/TrackExport/Jobs')
const execute = promisify(execFile)
async function job(overrides = {}) {
  await mkdir(root, { recursive: true, mode: 0o700 })
  const folder = await mkdtemp(join(root, 'visual-safety-'))
  await writeFile(join(folder, 'visual-request.json'), JSON.stringify({
    operation: 'inspect-export-dialog', host: 'fender8', expiresAt: Date.now() + 60_000, ...overrides,
  }), { mode: 0o600 })
  return folder
}
async function rejected(folder, pattern) {
  await assert.rejects(execute(helper, [folder], { timeout: 5000 }), error => {
    assert.match(error.stderr, pattern)
    return true
  })
  assert.equal(await access(join(folder, 'visual-response.json')).then(() => true, () => false), false)
}
test('rejects arbitrary filesystem paths before capture', { skip }, async () => {
  await assert.rejects(execute(helper, ['/tmp'], { timeout: 5000 }), /Invalid qualification job directory/)
})
test('rejects expired jobs before capture', { skip }, async () => {
  await rejected(await job({ expiresAt: Date.now() - 1000 }), /Expired or invalid/)
})
test('rejects unbounded job expiry', { skip }, async () => {
  await rejected(await job({ expiresAt: Date.now() + 600_000 }), /Expired or invalid/)
})
test('rejects unlisted hosts before capture', { skip }, async () => {
  await rejected(await job({ host: 'com.apple.finder' }), /Host is not qualified/)
})
test('probe cannot be used to render or click', { skip }, async () => {
  await rejected(await job({ operation: 'export' }), /Unsupported qualification operation/)
})
test('requires a private job directory', { skip }, async () => {
  const folder = await job()
  await chmod(folder, 0o755)
  try { await rejected(folder, /must be private/) }
  finally { await chmod(folder, 0o700) }
})
test('does not overwrite an existing response', { skip }, async () => {
  const folder = await job(), output = join(folder, 'visual-response.json')
  await writeFile(output, 'existing-result', { mode: 0o600 })
  await assert.rejects(execute(helper, [folder], { timeout: 5000 }), /Refusing to overwrite/)
  assert.equal(await readFile(output, 'utf8'), 'existing-result')
})
test('rejects symbolic-link job paths', { skip }, async () => {
  const folder = await job(), target = await job(), link = join(folder, 'alias')
  await symlink(target, link)
  await rejected(link, /Invalid qualification job directory/)
})
