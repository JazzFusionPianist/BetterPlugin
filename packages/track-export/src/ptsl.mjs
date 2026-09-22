import grpc from '@grpc/grpc-js'
import { loadSync } from '@grpc/proto-loader'
import { join } from 'node:path'

// The licensed SDK stays outside the repository. No remote command endpoint.
export function connectProTools(sdkRoot) {
  if (!sdkRoot) throw new Error('Set ORB_PTSL_SDK to your licensed Pro Tools Scripting SDK directory.')
  const definition = loadSync(join(sdkRoot, 'Source', 'PTSL.proto'), {
    keepCase: true, longs: String, enums: String, defaults: false, oneofs: true,
  })
  const schema = grpc.loadPackageDefinition(definition).ptsl
  const client = new schema.PTSL('127.0.0.1:31416', grpc.credentials.createInsecure(), {
    'grpc.max_receive_message_length': 16 * 1024 * 1024,
  })
  let sessionId = ''
  async function call(command, body = {}) {
    return new Promise((resolve, reject) => {
      let finalResponse
      const stream = client.SendGrpcStreamingRequest({
        header: { command: `CId_${command}`, version: 2026, version_minor: 4, version_revision: 0, session_id: sessionId },
        request_body_json: JSON.stringify(body),
      }, { deadline: Date.now() + (command === 'BounceTrack' ? 29 * 60_000 : 60_000) })
      stream.on('data', response => { finalResponse = response })
      stream.on('error', reject)
      stream.on('end', () => {
        try {
          if (!['TStatus_Completed', 'Completed'].includes(finalResponse?.header?.status))
            throw new Error(`${command}: ${finalResponse?.response_error_json || finalResponse?.header?.status || 'No response'}`)
          const result = JSON.parse(finalResponse.response_body_json || '{}')
          if (command === 'RegisterConnection') {
            if (!result.session_id) throw new Error('Pro Tools did not register the connection.')
            sessionId = result.session_id
          }
          resolve(result)
        } catch (error) { reject(error) }
      })
    })
  }
  return { call, close: () => client.close(), register: () => call('RegisterConnection', {
    company_name: 'Slur Studio', application_name: 'Slur Chat',
  }) }
}

export async function inspectSession(call) {
  const ids = await call('GetSessionIDs')
  if (!ids.instance_id) throw new Error('No current Pro Tools session.')
  const rate = await call('GetSessionSampleRate')
  const sampleRate = Number(String(rate.sample_rate).replace(/^(SRate_|SR_)/, ''))
  if (![44100, 48000, 88200, 96000, 176400, 192000].includes(sampleRate)) throw new Error('Unsupported session sample rate.')
  const tracks = []
  for (;;) {
    const page = await call('GetTrackList', { pagination_request: { limit: 100, offset: tracks.length } })
    const list = page.track_list ?? []
    tracks.push(...list)
    if (list.length < 100) break
    if (tracks.length > 10000) throw new Error('Pro Tools returned too many tracks.')
  }
  const after = await call('GetSessionIDs')
  if (after.instance_id !== ids.instance_id) throw new Error('The session changed while reading its state.')
  return { instanceId: ids.instance_id, sampleRate, tracks }
}
