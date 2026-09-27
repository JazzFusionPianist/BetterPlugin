// Developer-only UI fixture. Run the resulting app with the normal UI tool.
// It uses the production DragMonitor but never connects to chat or the network.
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { dawprojectFixture } from './dawprojectFixture.mjs'
if (process.platform !== 'darwin') throw new Error('The native drag QA harness requires macOS.')
const root = fileURLToPath(new URL('../../..', import.meta.url))
const folder = await mkdtemp(join(tmpdir(), 'slur-drag-qa-'))
const app = join(folder, 'Slur Region QA.app'), contents = join(app, 'Contents')
await mkdir(join(contents, 'MacOS'), { recursive: true }); await mkdir(join(contents, 'Resources'))
await writeFile(join(contents, 'Info.plist'), `<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.slur.regionqa</string><key>CFBundleName</key><string>Slur Region QA</string><key>CFBundleExecutable</key><string>SlurRegionQA</string><key>NSHighResolutionCapable</key><true/></dict></plist>`)
const p = await dawprojectFixture(), paths = new Map()
for (const a of p.bundle.assets) { const path = join(folder, `${a.id}.wav`); await writeFile(path, new Uint8Array(await p.filesByAsset.get(a.id).arrayBuffer())); paths.set(a.id, path) }
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const xml = `<vst-xml version="1.3"><sourceApp>Slur synthetic QA</sourceApp>${p.bundle.regions.map((r, i) => `<region id="${i + 1}" channelID="${r.trackId}"><name>${esc(r.name)}</name><filename>${esc(paths.get(r.assetId))}</filename><start>${r.offsetFrames}</start><end>${r.offsetFrames + r.lengthFrames}</end><projectTime domain="seconds">${r.start.samples / r.start.sampleRate}</projectTime></region>`).join('')}</vst-xml>`
await writeFile(join(contents, 'Resources', 'fixture.xml'), xml)
const compile = spawnSync('clang++', ['-std=c++17', '-fobjc-arc', '-DSLUR_DRAG_QA=1', '-framework', 'AppKit', '-framework', 'WebKit',
  resolve(root, 'packages/track-export/test/DragHarness.mm'), resolve(root, 'Plugin/Source/DragMonitor.mm'), '-o', join(contents, 'MacOS', 'SlurRegionQA')], { encoding: 'utf8' })
if (compile.status !== 0) { console.error(compile.stderr); process.exit(1) }
console.log(JSON.stringify({ app, fixture: join(contents, 'Resources', 'fixture.xml'), resultDirectory: tmpdir() }))
