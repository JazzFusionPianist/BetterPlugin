import { mkdir, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const root = dirname(fileURLToPath(import.meta.url))
const app = join(homedir(), 'Applications', 'Orb Logic Bridge.app')
await mkdir(join(app, 'Contents', 'MacOS'), { recursive: true })
await writeFile(join(app, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>com.orb.logic-bridge</string>
<key>CFBundleName</key><string>Orb Logic Bridge</string>
<key>CFBundleExecutable</key><string>OrbLogicBridge</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>`)
await run('xcrun', ['swiftc', '-O', '-framework', 'AppKit', '-framework', 'ApplicationServices',
  join(root, 'native', 'LogicBridge.swift'), '-o', join(app, 'Contents', 'MacOS', 'OrbLogicBridge')], { timeout: 120000 })
// A stable signing identity avoids invalidating Accessibility on every rebuild.
// Ad-hoc development builds still require reapproval after a binary change.
const identity = process.env.ORB_CODESIGN_IDENTITY || '-'
await run('codesign', ['--force', '--sign', identity, '--identifier', 'com.orb.logic-bridge', app])
await run('codesign', ['--verify', '--strict', app])
console.log(`Installed ${app}. Grant Accessibility yourself; this installer does not change permissions.`)
