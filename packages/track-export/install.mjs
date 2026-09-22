// Local developer install. References (never redistributes) the licensed Avid SDK.
import { build } from 'esbuild'
import { access, mkdir, readFile, writeFile, symlink, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = dirname(fileURLToPath(import.meta.url))
const runtime = join(homedir(), 'Library', 'Application Support', 'Slur', 'TrackExport')
const prior = await readFile(join(runtime, 'settings.json'), 'utf8').then(JSON.parse).catch(e => {
  if (e.code === 'ENOENT') return {}; throw e
})
const sdk = process.env.SLUR_PTSL_SDK || prior.sdk
if (!sdk) throw new Error('Set SLUR_PTSL_SDK to your licensed Pro Tools SDK directory.')
await access(join(sdk, 'Source', 'PTSL.proto'))
await mkdir(runtime, { recursive: true, mode: 0o700 })
await build({ entryPoints: [join(root, 'src/native.mjs')], outfile: join(runtime, 'native.cjs'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node22' })
await unlink(join(runtime, 'node')).catch(e => { if (e.code !== 'ENOENT') throw e })
await symlink(process.execPath, join(runtime, 'node'))
await writeFile(join(runtime, 'settings.json'), JSON.stringify({ sdk: resolve(sdk) }), { mode: 0o600 })
console.log('Installed Slur track export helper: ' + runtime)
