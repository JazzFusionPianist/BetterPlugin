// Local installation uses the user's separately licensed SDK; never redistribute it.
import { build } from 'esbuild'
import { access, mkdir, copyFile, readFile, writeFile, symlink, unlink } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const packageRoot = dirname(fileURLToPath(import.meta.url))
const runtime = join(homedir(), 'Library', 'Application Support', 'Orb', 'DawBridge')
const previous = await readFile(join(runtime, 'settings.json'), 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return {}
  throw error
})
const sdk = process.env.ORB_PTSL_SDK || previous.sdk
if (sdk) await access(join(sdk, 'Source', 'PTSL.proto'))
await mkdir(join(runtime, 'src'), { recursive: true, mode: 0o700 })
// Homebrew Node may dynamically link libnode. Copying only its binary breaks dyld.
await unlink(join(runtime, 'node')).catch(error => { if (error.code !== 'ENOENT') throw error })
await symlink(process.execPath, join(runtime, 'node'))
const python = process.env.ORB_PYTHON || 'python3'
await run(python, ['-m', 'venv', join(runtime, 'python')])
const installedPython = join(runtime, 'python', 'bin', 'python')
await run(installedPython, ['-m', 'pip', 'install', '-r', join(packageRoot, 'requirements.txt')], { timeout: 120000 })
await copyFile(join(packageRoot, 'src', 'proToolsAAF.py'), join(runtime, 'src', 'proToolsAAF.py'))
await copyFile(join(packageRoot, 'src', 'logicAAF.py'), join(runtime, 'src', 'logicAAF.py'))
await copyFile(join(packageRoot, 'src', 'logicCapture.py'), join(runtime, 'src', 'logicCapture.py'))
await copyFile(join(packageRoot, 'src', 'logicVerify.py'), join(runtime, 'src', 'logicVerify.py'))
await build({ entryPoints: [join(packageRoot, 'src', 'native.mjs')], outfile: join(runtime, 'src', 'native.cjs'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node22', sourcemap: false })
await writeFile(join(runtime, 'settings.json'), JSON.stringify({ sdk: sdk ? resolve(sdk) : null, python: installedPython }), { mode: 0o600 })
await run(join(runtime, 'node'), ['--version'])
console.log(`Installed Orb region bridge: ${runtime}`)
