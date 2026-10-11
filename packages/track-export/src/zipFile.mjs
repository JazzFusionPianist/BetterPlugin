// Read selected entries of a (possibly multi-GB) ZIP without loading it whole.
// Stored and deflated entries only; ZIP64 and encryption are rejected.
import { open } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'

export async function zipDirectory(path) {
  const fh = await open(path, 'r')
  try {
    const { size } = await fh.stat()
    const tail = Math.min(size, 65557)
    const buf = Buffer.alloc(tail)
    await fh.read(buf, 0, tail, size - tail)
    let eocd = -1
    for (let p = tail - 22; p >= 0; p--) if (buf.readUInt32LE(p) === 0x06054b50) { eocd = p; break }
    if (eocd < 0) throw new Error('Not a ZIP archive.')
    const count = buf.readUInt16LE(eocd + 10), cdSize = buf.readUInt32LE(eocd + 12), cdOffset = buf.readUInt32LE(eocd + 16)
    if (count === 0xffff || cdOffset === 0xffffffff) throw new Error('ZIP64 archives are not supported yet.')
    if (cdOffset + cdSize > size || cdSize > 64 * 1024 * 1024) throw new Error('Invalid ZIP directory.')
    const cd = Buffer.alloc(cdSize)
    await fh.read(cd, 0, cdSize, cdOffset)
    const entries = new Map()
    for (let p = 0, i = 0; i < count; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('Invalid ZIP entry.')
      const flags = cd.readUInt16LE(p + 8), method = cd.readUInt16LE(p + 10)
      const compressed = cd.readUInt32LE(p + 20), uncompressed = cd.readUInt32LE(p + 24)
      const nameLen = cd.readUInt16LE(p + 28), extraLen = cd.readUInt16LE(p + 30), commentLen = cd.readUInt16LE(p + 32)
      const local = cd.readUInt32LE(p + 42)
      const name = cd.toString('utf8', p + 46, p + 46 + nameLen)
      if (!(flags & 1)) entries.set(name, { method, compressed, uncompressed, local })
      p += 46 + nameLen + extraLen + commentLen
    }
    return { path, size, entries }
  } finally { await fh.close() }
}

export async function readZipEntry(dir, name, maxBytes = 512 * 1024 * 1024) {
  const e = dir.entries.get(name)
  if (!e) throw new Error(`Missing ${name} in archive.`)
  if (e.uncompressed > maxBytes || e.compressed > maxBytes) throw new Error(`${name} is too large.`)
  const fh = await open(dir.path, 'r')
  try {
    const header = Buffer.alloc(30)
    await fh.read(header, 0, 30, e.local)
    if (header.readUInt32LE(0) !== 0x04034b50) throw new Error('Invalid ZIP local header.')
    const start = e.local + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
    if (start + e.compressed > dir.size) throw new Error('Truncated ZIP entry.')
    const raw = Buffer.alloc(e.compressed)
    await fh.read(raw, 0, e.compressed, start)
    const out = e.method === 0 ? raw : e.method === 8 ? inflateRawSync(raw, { maxOutputLength: maxBytes }) : null
    if (!out) throw new Error(`Unsupported compression in ${name}.`)
    if (out.length !== e.uncompressed) throw new Error(`Damaged ${name} in archive.`)
    return out
  } finally { await fh.close() }
}
