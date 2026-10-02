// Installs only a read-only qualification helper; does not advertise DAW export
// support or change OS permissions. Existing Logic helper/plugins stay untouched.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, copyFile, mkdir, mkdtemp, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const run = promisify(execFile)
const root = dirname(fileURLToPath(import.meta.url))
const identity = process.env.SLUR_CODESIGN_IDENTITY
if (!identity) throw new Error('Set SLUR_CODESIGN_IDENTITY to a stable Developer ID certificate.')
const support = join(homedir(), 'Library/Application Support/Slur/TrackExport')
await mkdir(support, { recursive: true, mode: 0o700 })
const stage = await mkdtemp(join(support, 'visual-install-'))
const app = join(stage, 'Slur Visual Bridge.app'), contents = join(app, 'Contents')
await mkdir(join(contents, 'MacOS'), { recursive: true })
await copyFile(join(root, 'native/VisualInfo.plist'), join(contents, 'Info.plist'))
for (const architecture of ['arm64', 'x86_64']) {
  await run('xcrun', ['swiftc', '-parse-as-library', '-O', '-target', `${architecture}-apple-macos14.0`,
    '-framework', 'AppKit', '-framework', 'ScreenCaptureKit', '-framework', 'Vision',
    join(root, 'native/VisualHostProbe.swift'), '-o', join(stage, architecture)], { timeout: 120000 })
}
await run('lipo', ['-create', join(stage, 'arm64'), join(stage, 'x86_64'), '-output', join(contents, 'MacOS/SlurVisualBridge')])
await run('codesign', ['--force', '--options', 'runtime', '--timestamp', '--sign', identity, app])
await run('codesign', ['--verify', '--strict', app])
const destination = join(homedir(), 'Applications/Slur Visual Bridge.app')
await mkdir(dirname(destination), { recursive: true })
let previous = false
if (await access(destination).then(() => true, () => false)) {
  await rename(destination, join(stage, 'previous.app')); previous = true
}
try { await rename(app, destination) }
catch (error) {
  if (previous) await rename(join(stage, 'previous.app'), destination)
  throw error
}
console.log('Installed read-only qualification helper: ' + destination)
console.log('Previous helper, if any, retained in: ' + stage)
