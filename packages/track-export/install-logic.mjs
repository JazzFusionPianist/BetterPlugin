// Signed, universal local helper. Never modifies macOS privacy permissions.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, copyFile, mkdir, mkdtemp, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const run = promisify(execFile)
const root = dirname(fileURLToPath(import.meta.url))
const identity = process.env.SLUR_CODESIGN_IDENTITY
if (!identity) throw new Error('Set SLUR_CODESIGN_IDENTITY to a stable Developer ID certificate before installing the Logic helper.')
const support = join(homedir(), 'Library/Application Support/Slur/TrackExport')
await mkdir(support, { recursive: true, mode: 0o700 })
const stage = await mkdtemp(join(support, 'logic-install-'))
const app = join(stage, 'Slur Track Bridge.app'), contents = join(app, 'Contents')
await mkdir(join(contents, 'MacOS'), { recursive: true })
await copyFile(join(root, 'native/Info.plist'), join(contents, 'Info.plist'))
for (const architecture of ['arm64', 'x86_64']) {
  await run('xcrun', ['swiftc', '-O', '-target', `${architecture}-apple-macos13.0`,
    '-framework', 'AppKit', '-framework', 'ApplicationServices', join(root, 'native/LogicTrackBridge.swift'),
    '-o', join(stage, architecture)], { timeout: 120000 })
}
await run('lipo', ['-create', join(stage, 'arm64'), join(stage, 'x86_64'), '-output', join(contents, 'MacOS/SlurTrackBridge')])
await run('codesign', ['--force', '--options', 'runtime', '--timestamp', '--sign', identity, app])
await run('codesign', ['--verify', '--strict', app])
const destination = join(homedir(), 'Applications/Slur Track Bridge.app')
await mkdir(dirname(destination), { recursive: true })
if (await access(destination).then(() => true, () => false)) await rename(destination, join(stage, 'previous.app'))
try { await rename(app, destination) }
catch (error) { await rename(join(stage, 'previous.app'), destination).catch(() => {}); throw error }
console.log('Installed ' + destination + '. Previous helper, if any, retained in ' + stage)
