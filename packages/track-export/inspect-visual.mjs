// Local read-only development probe. Never uploads or invokes an export.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
const host = process.argv[2]
if (!['cubase15', 'fender8'].includes(host)) throw new Error('Usage: node inspect-visual.mjs cubase15|fender8')
const jobs = join(homedir(), 'Library/Application Support/Slur/TrackExport/Jobs')
await mkdir(jobs, { recursive: true, mode: 0o700 })
const folder = await mkdtemp(join(jobs, 'visual-qualification-'))
await writeFile(join(folder, 'visual-request.json'), JSON.stringify({
  operation: 'inspect-export-dialog', host, expiresAt: Date.now() + 60_000,
}), { flag: 'wx', mode: 0o600 })
let failure
try {
  await promisify(execFile)(join(homedir(), 'Applications/Slur Visual Bridge.app/Contents/MacOS/SlurVisualBridge'),
    [folder], { timeout: 30_000, maxBuffer: 65536 })
} catch (error) { failure = error }
let response
try { response = JSON.parse(await readFile(join(folder, 'visual-response.json'), 'utf8')) }
catch { throw failure ?? new Error('No probe response was written.') }
console.log(JSON.stringify({ folder, ...response }, null, 2))
if (!response.ok) process.exitCode = 1
