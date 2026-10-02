import { connectProTools, inspectSession } from './ptsl.mjs'
import { stageArchive } from './archive.mjs'
import { importToProTools } from './proToolsImport.mjs'
import { planRegionImport } from '../../core/lib/regionBundle.ts'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, writeFile, rename } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'

const command = process.argv[2]
if (!['inspect', 'import'].includes(command)) {
  console.error('Usage: cli.mjs inspect | import bundle.orb-regions.zip [--apply session-instance-id]')
  process.exitCode = 1
} else {
  const client = connectProTools(process.env.ORB_PTSL_SDK)
  try {
    await client.register()
    const session = await inspectSession(client.call)
    if (command === 'inspect') {
      console.log(JSON.stringify({ instanceId: session.instanceId, sampleRate: session.sampleRate,
        trackCount: session.tracks.length }, null, 2))
    } else {
      if (!process.argv[3]) throw new Error('Provide an Orb region bundle archive.')
      const cache = join(homedir(), '.cache', 'orb', 'region-bundles')
      const { bundle, paths } = await stageArchive(process.argv[3], cache)
      const plan = planRegionImport(bundle, session.sampleRate)
      if (!process.argv[4]) {
        console.log(JSON.stringify({ dryRun: true, sessionId: session.instanceId, tracks: plan }, null, 2))
      } else {
        if (process.argv[4] !== '--apply' || !process.argv[5] || process.argv.length !== 6)
          throw new Error('To apply, provide --apply followed by the inspected session instance ID.')
        const key = createHash('sha256').update(`${session.instanceId}\n${bundle.id}`).digest('hex')
        const folder = join(cache, 'imports')
        await mkdir(folder, { recursive: true, mode: 0o700 })
        const journalPath = join(folder, `${key}.json`)
        const journal = {
          async begin(receipt) {
            try { await writeFile(journalPath, JSON.stringify(receipt, null, 2), { flag: 'wx', mode: 0o600 }) }
            catch (error) {
              if (error.code === 'EEXIST') throw new Error(`An import was already attempted. Review ${journalPath} before retrying.`)
              throw error
            }
          },
          async record(receipt) {
            const temporary = `${journalPath}.${randomUUID()}`
            await writeFile(temporary, JSON.stringify(receipt, null, 2), { flag: 'wx', mode: 0o600 })
            await rename(temporary, journalPath)
          },
        }
        const receipt = await importToProTools({ bundle, paths, call: client.call,
          expectedSessionId: process.argv[5], journal })
        console.log(JSON.stringify({ ...receipt, journalPath }, null, 2))
      }
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally { client.close() }
}
