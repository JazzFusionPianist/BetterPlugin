import type {
  AttachmentTimelineMetadata,
  TempoMapPoint,
  TimeSignatureMapPoint,
} from '../types/collab'

interface DawTimelineEventDetail {
  sr: number
  ppq: number | null
  barPpq?: number | null
  barCount?: number | null
  projectSamples?: number | null
  bpm: number
  tnum: number
  tden: number
  playing: boolean
}

let listenerAttached = false
let latest: DawTimelineEventDetail | null = null
let nativeTimelinePromiseId = -1
const tempoMap: TempoMapPoint[] = []
const signatureMap: TimeSignatureMapPoint[] = []

function sortedByPpq<T extends { ppq: number }>(points: T[]): T[] {
  return points.slice().sort((a, b) => a.ppq - b.ppq)
}

function appendTempo(ppq: number, bpm: number) {
  if (!Number.isFinite(ppq) || !Number.isFinite(bpm) || bpm <= 0) return
  const previous = tempoMap[tempoMap.length - 1]
  if (previous && Math.abs(previous.bpm - bpm) < 0.001) return
  tempoMap.push({ ppq, bpm })
  if (tempoMap.length > 512) tempoMap.shift()
}

function appendSignature(ppq: number, numerator: number, denominator: number) {
  if (!Number.isFinite(ppq) || numerator <= 0 || denominator <= 0) return
  const previous = signatureMap[signatureMap.length - 1]
  if (previous && previous.numerator === numerator && previous.denominator === denominator) return
  signatureMap.push({ ppq, numerator, denominator })
  if (signatureMap.length > 128) signatureMap.shift()
}

function acceptTimelineDetail(detail: DawTimelineEventDetail | null): boolean {
  if (!detail || detail.ppq == null || !Number.isFinite(detail.ppq)) return false
  latest = detail
  appendTempo(detail.ppq, detail.bpm)
  appendSignature(detail.ppq, detail.tnum, detail.tden)
  return true
}

/** Track the host context the plug-in observes while it is instantiated. */
export function initAudioTimelineTracking() {
  if (listenerAttached || typeof window === 'undefined') return
  listenerAttached = true
  window.addEventListener('__juceDawAudio', (event: Event) => {
    const detail = (event as CustomEvent<DawTimelineEventDetail>).detail
    acceptTimelineDetail(detail)
  })
}

/** Ask the native plug-in for a fresh snapshot at the exact drop moment. */
export async function refreshDawTimelineSnapshot(): Promise<AttachmentTimelineMetadata | null> {
  const backend = window.__JUCE__?.backend
  if (!backend) return getDawTimelineSnapshot()

  const promiseId = nativeTimelinePromiseId--
  const raw = await new Promise<unknown>(resolve => {
    const timeout = window.setTimeout(() => {
      backend.removeEventListener('__juce__complete', handler)
      resolve(null)
    }, 750)
    const handler = (data: unknown) => {
      const result = data as { promiseId?: number; result?: unknown }
      if (result.promiseId !== promiseId) return
      window.clearTimeout(timeout)
      backend.removeEventListener('__juce__complete', handler)
      resolve(result.result)
    }
    backend.addEventListener('__juce__complete', handler)
    backend.emitEvent('__juce__invoke', { name: 'getDawTimeline', params: [], resultId: promiseId })
  })

  try {
    const detail = typeof raw === 'string' ? JSON.parse(raw) as DawTimelineEventDetail : raw as DawTimelineEventDetail
    acceptTimelineDetail(detail)
  } catch {
    // Keep the last event-driven snapshot if an older plug-in returns no data.
  }
  return getDawTimelineSnapshot()
}

/** Snapshot used when an exported region contains no embedded source timestamp. */
export function getDawTimelineSnapshot(): AttachmentTimelineMetadata | null {
  if (!latest) return null
  const ppq = latest.ppq
  if (ppq == null) return null
  const denominatorScale = latest.tden / 4
  const beat = Number.isFinite(latest.barPpq)
    ? (ppq - (latest.barPpq ?? ppq)) * denominatorScale + 1
    : undefined

  return {
    schema_version: 1,
    position: {
      source_samples: latest.projectSamples ?? undefined,
      sample_rate: latest.sr,
      seconds: latest.projectSamples != null && latest.sr > 0
        ? latest.projectSamples / latest.sr
        : undefined,
      ppq,
      bar: latest.barCount != null ? latest.barCount + 1 : undefined,
      beat: beat != null ? Math.max(1, beat) : undefined,
      source: 'daw_playhead',
      confidence: 'estimated',
    },
    tempo_map: sortedByPpq(tempoMap),
    time_signature_map: sortedByPpq(signatureMap),
    captured_at: new Date().toISOString(),
  }
}

function ppqAtSeconds(seconds: number, points: TempoMapPoint[]): number | undefined {
  if (points.length === 0) return undefined
  const sorted = sortedByPpq(points)
  let ppq = 0
  let elapsed = 0
  let bpm = sorted[0]!.bpm
  for (const point of sorted) {
    if (point.ppq <= ppq) { bpm = point.bpm; continue }
    const segmentSeconds = (point.ppq - ppq) * 60 / bpm
    if (elapsed + segmentSeconds >= seconds) return ppq + (seconds - elapsed) * bpm / 60
    elapsed += segmentSeconds
    ppq = point.ppq
    bpm = point.bpm
  }
  return ppq + (seconds - elapsed) * bpm / 60
}

function barBeatAtPpq(ppq: number, points: TimeSignatureMapPoint[]): { bar: number; beat: number } | null {
  if (points.length === 0) return null
  const sorted = sortedByPpq(points)
  let segmentStart = 0
  let barIndex = 0
  let numerator = sorted[0]!.numerator
  let denominator = sorted[0]!.denominator
  for (const point of sorted) {
    if (point.ppq <= segmentStart) {
      numerator = point.numerator
      denominator = point.denominator
      continue
    }
    if (point.ppq > ppq) break
    const barPpq = numerator * 4 / denominator
    barIndex += (point.ppq - segmentStart) / barPpq
    segmentStart = point.ppq
    numerator = point.numerator
    denominator = point.denominator
  }
  const beatPpq = 4 / denominator
  const barPpq = numerator * beatPpq
  const offset = Math.max(0, ppq - segmentStart)
  return {
    bar: Math.floor(barIndex + offset / barPpq) + 1,
    beat: (offset % barPpq) / beatPpq + 1,
  }
}

/** Fill older BWF-only records with the project context available now. */
export function mergeEmbeddedTimelineWithProject(
  embedded: AttachmentTimelineMetadata | null | undefined,
  project: AttachmentTimelineMetadata | null | undefined,
): AttachmentTimelineMetadata | null {
  if (!embedded) return project ?? null
  if (!project) return embedded

  const tempoMap = embedded.tempo_map?.length ? embedded.tempo_map : project.tempo_map
  const signatureMap = embedded.time_signature_map?.length ? embedded.time_signature_map : project.time_signature_map
  let ppq = embedded.position.ppq
  let bar = embedded.position.bar
  let beat = embedded.position.beat

  if (ppq == null && embedded.position.seconds != null && tempoMap?.length) {
    // Logic's BWF timeline normally starts at 01:00:00 while its musical
    // timeline starts at bar 1. Preserve sub-hour project time for conversion.
    const musicalSeconds = Math.max(0, embedded.position.seconds - (embedded.position.seconds >= 3600 ? 3600 : 0))
    ppq = ppqAtSeconds(musicalSeconds, tempoMap)
  }
  if ((bar == null || beat == null) && ppq != null && signatureMap?.length) {
    const musical = barBeatAtPpq(ppq, signatureMap)
    bar = bar ?? musical?.bar
    beat = beat ?? musical?.beat
  }

  return {
    ...embedded,
    position: { ...embedded.position, ppq, bar, beat },
    tempo_map: tempoMap,
    time_signature_map: signatureMap,
  }
}

function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!)
}

function xmlNumber(xml: string, tag: string): number | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>\\s*([^<]+)`, 'i'))
  if (!match) return undefined
  const text = match[1]!.trim()
  if (text.includes('/')) {
    const [a, b] = text.split('/').map(Number)
    return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : undefined
  }
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

export interface AudioFormatProbe {
  sampleRate?: number
  bitDepth?: number
}

function readWavFormat(bytes: Uint8Array): AudioFormatProbe | null {
  if (bytes.length < 12 || fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, 8) !== 'WAVE') return null
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true)
    const dataOffset = offset + 8
    if (fourCC(bytes, offset) === 'fmt ' && size >= 16 && dataOffset + 16 <= bytes.length) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + dataOffset, 16)
      return { sampleRate: view.getUint32(4, true), bitDepth: view.getUint16(14, true) }
    }
    offset = dataOffset + size + (size & 1)
  }
  return null
}

/** Read enough of a previously uploaded WAV to recover its format fields. */
export async function probeRemoteAudioFormat(url: string): Promise<AudioFormatProbe | null> {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-65535' } })
    if (!response.ok || !response.body) return null
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    while (length < 65536) {
      const { done, value } = await reader.read()
      if (done) break
      const remaining = 65536 - length
      const chunk = value.length > remaining ? value.subarray(0, remaining) : value
      chunks.push(chunk)
      length += chunk.length
      if (value.length > remaining) break
    }
    await reader.cancel().catch(() => {})
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return readWavFormat(bytes)
  } catch {
    return null
  }
}

/**
 * Read sample-accurate BWF/iXML timestamps from a dropped WAV. The audio is
 * left byte-for-byte unchanged; the extracted manifest travels with the chat
 * message. Non-WAV formats safely fall back to the host playhead snapshot.
 */
export async function extractAudioTimeline(
  file: File,
  fallback: AttachmentTimelineMetadata | null,
): Promise<AttachmentTimelineMetadata | null> {
  const riffHeader = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (riffHeader.length < 12 || fourCC(riffHeader, 0) !== 'RIFF' || fourCC(riffHeader, 8) !== 'WAVE') return fallback

  let sampleRate: number | undefined
  let bitDepth: number | undefined
  let sourceSamples: number | undefined
  let source: 'bwf' | 'ixml' | undefined
  let ixml = ''

  // Read only each chunk header, then seek over its declared length. Logic
  // commonly writes the bext chunk *after* the multi-megabyte data chunk, so
  // scanning a prefix of the file misses the timestamp. Blob.slice gives us
  // random access without copying the audio payload into memory again.
  for (let offset = 12; offset + 8 <= file.size;) {
    const headerBytes = new Uint8Array(await file.slice(offset, offset + 8).arrayBuffer())
    if (headerBytes.length < 8) break
    const id = fourCC(headerBytes, 0)
    const size = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength)
      .getUint32(4, true)
    const dataOffset = offset + 8
    if (dataOffset + size > file.size) break

    if (id === 'fmt ' && size >= 8) {
      const fmt = await file.slice(dataOffset, dataOffset + Math.min(size, 16)).arrayBuffer()
      if (fmt.byteLength >= 8) sampleRate = new DataView(fmt).getUint32(4, true)
      if (fmt.byteLength >= 16) bitDepth = new DataView(fmt).getUint16(14, true)
    }
    if (id === 'bext' && size >= 346) {
      const bext = await file.slice(dataOffset + 338, dataOffset + 346).arrayBuffer()
      if (bext.byteLength === 8) {
        const bextView = new DataView(bext)
        const low = bextView.getUint32(0, true)
        const high = bextView.getUint32(4, true)
        sourceSamples = high * 0x1_0000_0000 + low
        source = 'bwf'
      }
    }
    if (id.toLowerCase() === 'ixml') {
      const xmlBytes = await file.slice(dataOffset, dataOffset + Math.min(size, 1024 * 1024)).arrayBuffer()
      ixml = new TextDecoder().decode(xmlBytes)
    }
    offset = dataOffset + size + (size & 1)
  }

  if (sourceSamples == null && ixml) {
    const direct = xmlNumber(ixml, 'BWF_TIME_REFERENCE') ?? xmlNumber(ixml, 'TIMESTAMP_SAMPLES')
    const low = xmlNumber(ixml, 'TIMESTAMP_SAMPLES_SINCE_MIDNIGHT_LO')
    const high = xmlNumber(ixml, 'TIMESTAMP_SAMPLES_SINCE_MIDNIGHT_HI')
    if (direct != null) sourceSamples = direct
    else if (low != null && high != null) sourceSamples = high * 0x1_0000_0000 + low
    if (sourceSamples != null) source = 'ixml'
    sampleRate = xmlNumber(ixml, 'TIMESTAMP_SAMPLE_RATE') ?? sampleRate
  }

  if (sourceSamples == null || !source) return fallback
  const exact: AttachmentTimelineMetadata = {
    schema_version: 1,
    position: {
      source_samples: sourceSamples,
      sample_rate: sampleRate,
      bit_depth: bitDepth,
      seconds: sampleRate && sampleRate > 0 ? sourceSamples / sampleRate : undefined,
      source,
      confidence: 'exact',
    },
    tempo_map: fallback?.tempo_map,
    time_signature_map: fallback?.time_signature_map,
    captured_at: new Date().toISOString(),
  }
  return mergeEmbeddedTimelineWithProject(exact, fallback)
}

// ChatView is eagerly bundled with the collaboration screen, so start
// observing host changes before the user opens a particular conversation.
initAudioTimelineTracking()
