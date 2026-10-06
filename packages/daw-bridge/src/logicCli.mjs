import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, mkdir } from 'node:fs/promises'
import { exportLogicAAF } from './logicExport.mjs'

const [archive, directory] = process.argv.slice(2)
if (!archive || !directory) throw new Error('Usage: logicCli.mjs bundle.orb-regions.zip output-directory')
const settings = JSON.parse(await readFile(join(homedir(), 'Library/Application Support/Orb/DawBridge/settings.json'), 'utf8'))
await mkdir(directory, { recursive: true, mode: 0o700 })
console.log(JSON.stringify(await exportLogicAAF({ archive, directory, python: settings.python,
  script: join(dirname(fileURLToPath(import.meta.url)), 'logicAAF.py') })))
