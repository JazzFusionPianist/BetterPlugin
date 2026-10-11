// Source audio as PCM/float WAV. AIFF/AIFC(none/sowt/fl32) is converted losslessly
// (byte order only); other encodings are rejected instead of being transcoded.

function ext80(b, p) {
  // IEEE 754 80-bit extended → Number (AIFF sample rate).
  const exp = b.readUInt16BE(p) & 0x7fff, sign = b[p] & 0x80 ? -1 : 1
  const hi = b.readUInt32BE(p + 2), lo = b.readUInt32BE(p + 6)
  if (exp === 0 && hi === 0 && lo === 0) return 0
  return sign * (hi * 2 ** 32 + lo) * 2 ** (exp - 16383 - 63)
}

function waveHeader(channels, rate, bits, float, dataBytes, frames) {
  const extra = float ? 12 : 0, b = Buffer.alloc(44 + extra)
  const block = channels * bits / 8
  b.write('RIFF', 0); b.writeUInt32LE(36 + extra + dataBytes + dataBytes % 2, 4); b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(float ? 3 : 1, 20); b.writeUInt16LE(channels, 22)
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * block, 28); b.writeUInt16LE(block, 32); b.writeUInt16LE(bits, 34)
  if (extra) { b.write('fact', 36); b.writeUInt32LE(4, 40); b.writeUInt32LE(frames, 44) }
  b.write('data', 36 + extra); b.writeUInt32LE(dataBytes, 40 + extra)
  return b
}

export function aiffToWave(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'FORM' || !['AIFF', 'AIFC'].includes(bytes.toString('ascii', 8, 12)))
    throw new Error('Not an AIFF file.')
  const aifc = bytes.toString('ascii', 8, 12) === 'AIFC'
  let comm, ssnd
  for (let p = 12; p + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', p, p + 4), size = bytes.readUInt32BE(p + 4), at = p + 8
    if (at + size > bytes.length) throw new Error('Truncated AIFF chunk.')
    if (id === 'COMM') comm = { at, size }
    if (id === 'SSND') ssnd = { at, size }
    p = at + size + size % 2
  }
  if (!comm || !ssnd) throw new Error('Incomplete AIFF file.')
  const channels = bytes.readUInt16BE(comm.at), frames = bytes.readUInt32BE(comm.at + 2)
  const bits = bytes.readUInt16BE(comm.at + 6), rate = Math.round(ext80(bytes, comm.at + 8))
  const codec = aifc ? bytes.toString('ascii', comm.at + 18, comm.at + 22) : 'NONE'
  const float = codec === 'fl32' || codec === 'FL32'
  const little = codec === 'sowt'
  if (!['NONE', 'none', 'sowt', 'fl32', 'FL32'].includes(codec)) throw new Error(`AIFF-C ${codec} audio is not supported yet.`)
  if (![1, 2].includes(channels) || !(rate >= 1 && rate <= 768000) || !(float ? bits === 32 : [16, 24, 32].includes(bits)))
    throw new Error('Unsupported AIFF format.')
  const offset = bytes.readUInt32BE(ssnd.at), width = bits / 8, dataBytes = frames * channels * width
  const start = ssnd.at + 8 + offset
  if (start + dataBytes > ssnd.at + ssnd.size) throw new Error('AIFF audio is shorter than its header.')
  const out = Buffer.alloc(dataBytes + dataBytes % 2)
  if (little) bytes.copy(out, 0, start, start + dataBytes)
  else for (let i = 0; i < dataBytes; i += width) for (let k = 0; k < width; k++) out[i + k] = bytes[start + i + width - 1 - k]
  return Buffer.concat([waveHeader(channels, rate, bits, float, dataBytes, frames), out])
}

/** Plain fmt/data WAV with identical samples (EXTENSIBLE headers, odd RIFF sizes, extra chunks). */
export function normalizeWave(bytes) {
  let fmt, data
  for (let p = 12; p + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', p, p + 4), at = p + 8
    let size = bytes.readUInt32LE(p + 4)
    // Some recorders leave a streaming placeholder size on the final data chunk.
    if (id === 'data' && at + size > bytes.length) size = bytes.length - at
    if (at + size > bytes.length) throw new Error('Truncated WAV chunk.')
    if (id === 'fmt ' && size >= 16) fmt = { at, size }
    if (id === 'data') data = { at, size }
    p = at + size + size % 2
  }
  if (!fmt || !data) throw new Error('Incomplete WAV file.')
  let codec = bytes.readUInt16LE(fmt.at)
  if (codec === 65534 && fmt.size >= 40) codec = bytes.readUInt16LE(fmt.at + 24)
  const channels = bytes.readUInt16LE(fmt.at + 2), rate = bytes.readUInt32LE(fmt.at + 4), bits = bytes.readUInt16LE(fmt.at + 14)
  const block = channels * bits / 8
  if (!((codec === 1 && [16, 24, 32].includes(bits)) || (codec === 3 && [32, 64].includes(bits))) || ![1, 2].includes(channels))
    throw new Error('Only mono/stereo PCM or float WAV sources are supported yet.')
  const dataBytes = data.size - data.size % block
  const plain = bytes.readUInt16LE(fmt.at) !== 65534 && fmt.size === 16 && bytes.readUInt32LE(4) + 8 === bytes.length
  if (plain && dataBytes === data.size) return bytes
  return Buffer.concat([waveHeader(channels, rate, bits, codec === 3, dataBytes, dataBytes / block),
    bytes.subarray(data.at, data.at + dataBytes), Buffer.alloc(dataBytes % 2)])
}

/** Returns the WAV bytes for a source file, converting AIFF; throws for other formats. */
export function sourceAsWave(bytes) {
  const tag = bytes.toString('ascii', 0, 4)
  if (tag === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE') return normalizeWave(bytes)
  if (tag === 'FORM') return aiffToWave(bytes)
  if (tag === 'RF64' || tag === 'BW64') throw new Error('RF64 (>4 GB) audio is not supported yet.')
  throw new Error('Only WAV and AIFF source audio can be shared from a project file yet.')
}

/** WAV writer used for Slur Tap stems: interleaved float32 PCM. */
export function floatWave(channels, rate, interleaved) {
  const data = Buffer.from(interleaved.buffer, interleaved.byteOffset, interleaved.byteLength)
  return Buffer.concat([waveHeader(channels, rate, 32, true, data.length, data.length / (4 * channels)), data, Buffer.alloc(data.length % 2)])
}
