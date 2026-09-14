/**
 * Dependency-free ZIP writer, STORE method only (no compression).
 *
 * Built for the studio's "send as zip" drop option: the payload is
 * almost always WAV/AIFF, which deflate barely shrinks but would cost
 * real time to chew through — STORE writes at memcpy speed and every
 * unzipper ever shipped can read it.
 *
 * Layout is the classic single-disk archive: [local header + data] per
 * file, then the central directory, then the end-of-central-directory
 * record. Names are written as UTF-8 (general-purpose bit 11 set).
 */

export interface ZipEntry {
  name: string
  data: Uint8Array | ArrayBuffer
}

/* ── CRC-32 (IEEE 802.3), small 256-entry table ─────────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xFF]! ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function toBytes(data: Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> {
  // The cast narrows ArrayBufferLike → ArrayBuffer for BlobPart; audio
  // payloads never ride SharedArrayBuffers.
  return (data instanceof Uint8Array ? data : new Uint8Array(data)) as Uint8Array<ArrayBuffer>
}

/** MS-DOS date/time pair for "now" (2-second resolution, ZIP's native format). */
function dosDateTime(): { time: number; date: number } {
  const d = new Date()
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  const date = ((Math.max(0, d.getFullYear() - 1980)) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, date }
}

/** "kick.wav" colliding again becomes "kick (2).wav", "kick (3).wav", … */
function dedupeNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map(raw => {
    const name = raw || 'file'
    const key = name.toLowerCase()
    const count = seen.get(key) ?? 0
    seen.set(key, count + 1)
    if (count === 0) return name
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    // The suffixed name could itself collide with a literal "kick (2).wav"
    // in the batch — bump until free.
    for (let n = count + 1; ; n++) {
      const candidate = `${stem} (${n})${ext}`
      if (!seen.has(candidate.toLowerCase())) {
        seen.set(candidate.toLowerCase(), 1)
        return candidate
      }
    }
  })
}

/* ── the writer ──────────────────────────────────────────────────────── */

const SIG_LOCAL = 0x04034B50
const SIG_CENTRAL = 0x02014B50
const SIG_EOCD = 0x06054B50
const VERSION = 20          // 2.0 — plain STORE needs nothing newer
const FLAG_UTF8 = 0x0800    // general-purpose bit 11: names are UTF-8
const METHOD_STORE = 0

/** Build a ZIP Blob from the given files — stored, not compressed. */
export function buildZip(files: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const { time, date } = dosDateTime()
  const names = dedupeNames(files.map(f => f.name))

  const parts: BlobPart[] = []
  const central: BlobPart[] = []
  let offset = 0
  let centralSize = 0

  files.forEach((entry, i) => {
    const data = toBytes(entry.data)
    const nameBytes = encoder.encode(names[i]!)
    const crc = crc32(data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, SIG_LOCAL, true)
    local.setUint16(4, VERSION, true)
    local.setUint16(6, FLAG_UTF8, true)
    local.setUint16(8, METHOD_STORE, true)
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)   // compressed = uncompressed (STORE)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true)             // extra field length
    parts.push(local.buffer, nameBytes, data)

    const cdir = new DataView(new ArrayBuffer(46))
    cdir.setUint32(0, SIG_CENTRAL, true)
    cdir.setUint16(4, VERSION, true)         // version made by
    cdir.setUint16(6, VERSION, true)         // version needed
    cdir.setUint16(8, FLAG_UTF8, true)
    cdir.setUint16(10, METHOD_STORE, true)
    cdir.setUint16(12, time, true)
    cdir.setUint16(14, date, true)
    cdir.setUint32(16, crc, true)
    cdir.setUint32(20, data.length, true)
    cdir.setUint32(24, data.length, true)
    cdir.setUint16(28, nameBytes.length, true)
    cdir.setUint16(30, 0, true)              // extra length
    cdir.setUint16(32, 0, true)              // comment length
    cdir.setUint16(34, 0, true)              // disk number start
    cdir.setUint16(36, 0, true)              // internal attributes
    cdir.setUint32(38, 0, true)              // external attributes
    cdir.setUint32(42, offset, true)         // local header offset
    central.push(cdir.buffer, nameBytes)
    centralSize += 46 + nameBytes.length

    offset += 30 + nameBytes.length + data.length
  })

  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, SIG_EOCD, true)
  eocd.setUint16(4, 0, true)                 // this disk
  eocd.setUint16(6, 0, true)                 // disk with central directory
  eocd.setUint16(8, files.length, true)
  eocd.setUint16(10, files.length, true)
  eocd.setUint32(12, centralSize, true)
  eocd.setUint32(16, offset, true)           // central directory offset
  eocd.setUint16(20, 0, true)                // comment length

  return new Blob([...parts, ...central, eocd.buffer], { type: 'application/zip' })
}
