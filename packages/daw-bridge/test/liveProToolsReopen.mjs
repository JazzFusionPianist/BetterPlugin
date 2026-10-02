// Opt-in persistence qualification for the user's named disposable test session.
import { readFile, writeFile, rename, access } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import assert from 'node:assert/strict'
import { connectProTools, inspectSession } from '../src/ptsl.mjs'
import { timelineExportRequest, parseProToolsTimeline } from '../src/proToolsTimeline.mjs'

const directories = process.argv.slice(2)
if (!directories.length) throw new Error('Pass completed live-test directories.')
const runs = await Promise.all(directories.map(async directory => ({ directory,
  receipt: JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8')),
  bundle: JSON.parse(await readFile(join(directory, 'bundle.json'), 'utf8')),
  trace: JSON.parse(await readFile(join(directory, 'trace.json'), 'utf8')),
})))
if (runs.some(r => r.receipt.status !== 'complete')) throw new Error('Use only completed tests.')
const client = connectProTools(process.env.ORB_PTSL_SDK)
const moved = []
try {
  await client.register()
  const before = await inspectSession(client.call)
  if ((await client.call('GetSessionName')).session_name !== 'new test'
    || runs.some(r => r.receipt.sessionId !== before.instanceId)) throw new Error('Wrong test session.')
  const path = (await client.call('GetSessionPath')).session_path.path
  if (!path.endsWith('/new test/new test.ptx')) throw new Error('Unexpected session path.')
  const baseline = parseProToolsTimeline((await client.call('ExportSessionInfoAsText', timelineExportRequest)).session_info)
  const createdIds = new Set(runs.flatMap(r => r.trace.filter(t => t.command === 'CreateAudioClips')
    .flatMap(t => t.result.clip_list.flatMap(c => c.clip_ids))))
  const expectedNames = new Set(runs.flatMap(r => r.trace.filter(t => t.command === 'GetClipList')
    .flatMap(t => (t.result.clip_list ?? t.result.clips ?? []).filter(c => createdIds.has(c.clip_id)).map(c => c.clip_full_name))))
  await client.call('SaveSession')
  await client.call('CloseSession', { save_on_close: true })
  for (const { directory, bundle } of runs) for (const asset of bundle.assets) {
    const source = join(directory, asset.name), offline = source + '.offline'
    await rename(source, offline); moved.push({ source, offline })
  }
  await client.call('OpenSession', { session_path: path })
  const after = await inspectSession(client.call)
  assert.equal((await client.call('GetSessionName')).session_name, 'new test')
  assert.deepEqual(after.tracks.map(t => [t.id, t.name]), before.tracks.map(t => [t.id, t.name]))
  const timeline = parseProToolsTimeline((await client.call('ExportSessionInfoAsText', timelineExportRequest)).session_info)
  assert.deepEqual(timeline, baseline)
  const found = []
  for (let offset = 0; ;) {
    const page = await client.call('GetClipList', { pagination_request: { offset, limit: 100 } })
    const clips = page.clip_list ?? page.clips ?? []
    found.push(...clips.filter(c => expectedNames.has(c.clip_full_name)))
    offset += clips.length
    if (!clips.length || offset >= page.pagination_response.total) break
  }
  assert.equal(found.length, expectedNames.size)
  const media = new Map()
  for (const clip of found) {
    assert.equal(clip.is_online, true, clip.clip_full_name)
    if (media.has(clip.file_id)) continue
    const info = (await client.call('GetMediaFileInfo', { file_id: clip.file_id })).audio_file_info
    const withinSession = relative(join(dirname(path), 'Audio Files'), info.file_path)
    assert.ok(withinSession && !withinSession.startsWith('..') && !withinSession.startsWith('/'))
    await access(info.file_path)
    media.set(clip.file_id, info.file_path)
  }
  const report = { status: 'passed', sessionPath: path, totalTracks: after.tracks.length,
    testedRegions: runs.reduce((n, r) => n + r.bundle.regions.length, 0), verifiedChannelClips: found.length,
    mediaFilesInSession: [...media.values()], sourceFilesUnavailableDuringTest: moved.length }
  await writeFile(join(directories[0], 'reopen.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  for (const { source, offline } of moved) await rename(offline, source)
  client.close()
}
