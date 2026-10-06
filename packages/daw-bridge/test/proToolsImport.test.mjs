import test from 'node:test'
import assert from 'node:assert/strict'
import { importToProTools } from '../src/proToolsImport.mjs'
import { fixture } from './fixtures.mjs'
import { loadSync } from '@grpc/proto-loader'
import { join } from 'node:path'

function host() {
  const calls = [], receipts = []
  const tracks = [{ id: 'existing', name: 'Existing' }], clips = [], placed = []
  let newTracks = 0, currentSession = 'destination', failSpot = false, begun = false
  const call = async (command, body) => {
    calls.push({ command, body })
    switch (command) {
      case 'GetSessionIDs': return { instance_id: currentSession }
      case 'GetSessionSampleRate': return { sample_rate: 'SRate_48000' }
      case 'GetTrackList': return { track_list: tracks, pagination_response: { total: tracks.length } }
      case 'GetTransportState': return { current_setting: 'TState_TransportStopped' }
      case 'ImportAudioToClipList': return { file_list: [{ original_input_path: body.file_list[0],
        destination_file_list: [{ file_id: 'media-1', file_path: '/session/Audio Files/take.wav', clip_id_list: ['whole'] }] }] }
      case 'GetMediaFileInfo': return { audio_file_info: { sample_rate: 'SRate_48000', num_channels: 1,
        length: { length: '96000', time_type: 'BTType_Samples' } } }
      case 'CreateNewTracks': {
        const id = `new-${++newTracks}`
        tracks.push({ id, name: body.track_name })
        return { created_track_ids: [id], created_track_names: [body.track_name] }
      }
      case 'CreateAudioClips': {
        const entry = body.clip_list[0], id = `clip-${clips.length}`
        clips.push({ clip_id: id, clip_full_name: entry.name, file_id: entry.clip_info[0].file_id,
          src_start_point: entry.clip_info[0].src_start_point, src_end_point: entry.clip_info[0].src_end_point,
          duration: Number(entry.clip_info[0].src_end_point.position) - Number(entry.clip_info[0].src_start_point.position) })
        return { clip_list: [{ clip_ids: [id] }] }
      }
      case 'GetClipList': return { clips, pagination_response: { total: clips.length } }
      case 'SpotClipsByID':
        if (failSpot) throw new Error('disconnected')
        placed.push({ ...body, start: Number(body.dst_location_data.location.location) }); return {}
      case 'ExportSessionInfoAsText': return { session_info: 'SAMPLE RATE:\t48000.000000\n' + tracks.map(t =>
        `TRACK NAME:\t${t.name}\nCHANNEL\tEVENT\tCLIP NAME\tSTART TIME\tEND TIME\tDURATION\tSTATE\n`
        + placed.filter(p => p.dst_track_id === t.id).map((p, i) => {
          const c = clips.find(c => c.clip_id === p.src_clips[0])
          return `1\t${i + 1}\t${c.clip_full_name}\t${p.start}\t${p.start + c.duration}\t${c.duration}\tUnmuted\n`
        }).join('')).join('\n') }
      default: throw new Error(`Unexpected command ${command}`)
    }
  }
  const journal = {
    async begin(receipt) { if (begun) throw new Error('Already attempted'); begun = true; receipts.push(structuredClone(receipt)) },
    async record(receipt) { receipts.push(structuredClone(receipt)) },
  }
  return { call, journal, calls, receipts, changeSession: () => { currentSession = 'other' }, failSpot: () => { failSpot = true } }
}

function options(h) {
  const { bundle, hash } = fixture()
  bundle.regions[2].start.samples = 148000
  return { bundle, paths: new Map([[hash, '/cache/take.wav']]), expectedSessionId: 'destination', call: h.call, journal: h.journal }
}

test('creates one new track per source and spots every independent region by track ID', async () => {
  const h = host()
  const result = await importToProTools(options(h))
  assert.equal(result.status, 'complete')
  assert.deepEqual(h.calls.filter(c => c.command === 'CreateNewTracks').map(c => c.body.track_name), ['Voice', 'Guitar'])
  const spots = h.calls.filter(c => c.command === 'SpotClipsByID')
  assert.deepEqual(spots.map(c => c.body.dst_track_id), ['new-1', 'new-2', 'new-2'])
  assert.deepEqual(spots.map(c => c.body.dst_location_data.location.location), ['0', '96000', '148000'])
  const clips = h.calls.filter(c => c.command === 'CreateAudioClips')
  assert.equal(clips[1].body.clip_list[0].clip_info[0].src_start_point.position, 12000)
  assert.equal(clips[1].body.clip_list[0].clip_info[0].src_end_point.position, 36000)
  assert.ok(!spots.some(c => c.body.dst_track_id === 'existing'))
  assert.deepEqual(result.verification, { trackCount: 2, channelClipCount: 3 })
})

test('overlap is refused before mutation until layering is qualified', async () => {
  const h = host(), o = options(h)
  o.bundle.regions[2].start.samples = 100000
  await assert.rejects(importToProTools(o), /Overlapping/)
  assert.equal(h.receipts.length, 0)
})

test('recording blocks import before journal creation or any host edit', async () => {
  const h = host(), o = options(h)
  o.call = (command, body) => command === 'GetTransportState'
    ? Promise.resolve({ current_setting: 'TState_TransportRecording' }) : h.call(command, body)
  await assert.rejects(importToProTools(o), /Stop Pro Tools/)
  assert.equal(h.receipts.length, 0)
})

test('successful Spot RPC with a wrong actual location is not reported as completed', async () => {
  const h = host(), o = options(h)
  o.call = (command, body) => h.call(command, command === 'SpotClipsByID'
    ? { ...body, dst_location_data: { ...body.dst_location_data, location: { location: '12345' } } } : body)
  await assert.rejects(importToProTools(o), /Timeline verification failed/)
  assert.equal(h.receipts.at(-1).status, 'incomplete')
})

test('wrong source offset returned by the host stops before the clip is placed', async () => {
  const h = host(), o = options(h)
  o.call = async (command, body) => {
    const result = await h.call(command, body)
    return command === 'GetClipList' ? { ...result, clips: result.clips.map(c => ({ ...c,
      src_start_point: { position: '999', time_type: 'BTType_Samples' } })) } : result
  }
  await assert.rejects(importToProTools(o), /source or trim differs/)
  assert.ok(!h.calls.some(c => c.command === 'SpotClipsByID'))
})

test('accepts the real-host clip_list response field as well as the SDK clips field', async () => {
  const h = host(), o = options(h)
  o.call = async (command, body) => {
    const r = await h.call(command, body)
    return command === 'GetClipList' ? { clip_list: r.clips, pagination_response: r.pagination_response } : r
  }
  assert.equal((await importToProTools(o)).status, 'complete')
})

test('reads later clip pages when the host reports a page-local total', async () => {
  const h = host(), o = options(h)
  o.call = async (command, body) => {
    if (command === 'GetClipList' && body.pagination_request.offset === 0)
      return { clip_list: Array.from({ length: 100 }, (_, i) => ({ clip_id: `unrelated-${i}` })),
        pagination_response: { total: 100, offset: 0, limit: 100 } }
    return h.call(command, body)
  }
  assert.equal((await importToProTools(o)).status, 'complete')
  assert.ok(h.calls.some(c => c.command === 'GetClipList' && c.body.pagination_request.offset === 100))
})

test('different source rate requests conversion rather than incompatible CopyAudio', async () => {
  const h = host(), o = options(h)
  o.bundle.assets[0].sampleRate = 44100
  o.bundle.assets[0].frames = 88200
  assert.equal((await importToProTools(o)).status, 'complete')
  assert.equal(h.calls.find(c => c.command === 'ImportAudioToClipList').body.audio_operations, 'AOperations_ConvertAudio')
})

test('missing source layout fails before host mutation or journal creation', async () => {
  const h = host(), o = options(h)
  o.bundle.source = null
  await assert.rejects(importToProTools(o), /complete track layout/)
  assert.equal(h.receipts.length, 0)
  assert.ok(h.calls.every(c => c.command.startsWith('Get')))
})

test('requires the explicitly inspected destination session', async () => {
  const h = host(), o = options(h)
  o.expectedSessionId = 'wrong'
  await assert.rejects(importToProTools(o), /session changed/)
  assert.ok(h.calls.every(c => c.command.startsWith('Get')))
})

test('source channel mismatch fails before mutation', async () => {
  const h = host(), o = options(h)
  o.bundle.tracks[0].channels = 2
  await assert.rejects(importToProTools(o), /mono\/stereo/)
  assert.ok(h.calls.every(c => c.command.startsWith('Get')))
})

test('unknown result stops and records partial progress without global Undo', async () => {
  const h = host(); h.failSpot()
  await assert.rejects(importToProTools(options(h)), /some new items may remain/)
  assert.equal(h.receipts.at(-1).status, 'incomplete')
  assert.equal(h.receipts.at(-1).tracks.length, 1)
  assert.equal(h.receipts.at(-1).placedRegions.length, 0)
  assert.ok(!h.calls.some(c => /Undo|Delete|CloseSession/.test(c.command)))
})

test('changing the session during an import stops before the next edit', async () => {
  const h = host(), o = options(h)
  o.journal = { ...h.journal, async begin(r) { await h.journal.begin(r); h.changeSession() } }
  await assert.rejects(importToProTools(o), /session or sample rate changed/)
  assert.ok(h.calls.every(c => c.command.startsWith('Get')))
})

test('attempt journal prevents duplicate import after completion', async () => {
  const h = host(), o = options(h)
  await importToProTools(o)
  const count = h.calls.filter(c => c.command === 'CreateNewTracks').length
  await assert.rejects(importToProTools(o), /Already attempted/)
  assert.equal(h.calls.filter(c => c.command === 'CreateNewTracks').length, count)
})

test('generated commands conform to the locally licensed SDK schema', { skip: !process.env.ORB_PTSL_SDK }, async () => {
  const definitions = loadSync(join(process.env.ORB_PTSL_SDK, 'Source', 'PTSL.proto'), { keepCase: true })
  function validate(type, body) {
    const descriptor = definitions[`ptsl.${type}`]?.type
    assert.ok(descriptor, `SDK message ${type}`)
    for (const [name, value] of Object.entries(body)) {
      const field = descriptor.field.find(f => f.name === name)
      assert.ok(field, `${type}.${name}`)
      const values = field.label === 'LABEL_REPEATED' ? value : [value]
      assert.ok(Array.isArray(values))
      for (const item of values) {
        if (field.type === 'TYPE_INT64') assert.ok(Number.isSafeInteger(item), `${type}.${name} must be a safe JSON number`)
        if (field.type === 'TYPE_MESSAGE') validate(field.typeName.replace(/^\.?(ptsl\.)?/, ''), item)
        if (field.type === 'TYPE_ENUM') {
          const key = `ptsl.${field.typeName.replace(/^\.?(ptsl\.)?/, '')}`
          assert.ok(definitions[key].type.value.some(v => v.name === item), `${key}: ${item}`)
        }
      }
    }
  }
  const h = host()
  await importToProTools(options(h))
  for (const { command, body } of h.calls) if (body) validate(`${command}RequestBody`, body)
})
