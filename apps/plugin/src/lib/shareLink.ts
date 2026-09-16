/**
 * Listen links — a stem or chat audio, playable by anyone with the URL,
 * no account and no plug-in. The web app's /listen page is static, so
 * everything it needs rides in the query string: the (already public)
 * R2 file URL, the file name, who sent it, and the original position
 * boiled down to what a listener reads (bar | beat, tempo, meter).
 *
 * The same compact shape is parsed by apps/web/app/listen — keep the
 * two in step.
 */
import type { AttachmentTimelineMetadata } from '../types/collab'

export const LISTEN_BASE = 'https://orb-app-liard.vercel.app/listen'

/** Compact position carried in the link (`p` param). */
export interface ListenPosition {
  /** bar number (1-based) */
  b?: number
  /** beat within the bar (1-based, fractional) */
  t?: number
  /** tempo, bpm */
  m?: number
  /** meter, "4/4" */
  s?: string
  /** project seconds */
  c?: number
  /** 1 = exact (BWF/iXML stamp), 0 = playhead estimate */
  x?: 0 | 1
}

function round(n: number, places: number): number {
  const f = 10 ** places
  return Math.round(n * f) / f
}

export function compactPosition(metadata?: AttachmentTimelineMetadata | null): ListenPosition | null {
  if (!metadata) return null
  const { position } = metadata
  const tempos = metadata.tempo_map?.slice().sort((a, b) => a.ppq - b.ppq) ?? []
  const meters = metadata.time_signature_map?.slice().sort((a, b) => a.ppq - b.ppq) ?? []
  // Project-absolute position (anchored at ingestion) beats the raw stamp.
  const ppq = position.absolute_ppq ?? position.ppq ?? tempos[tempos.length - 1]?.ppq ?? meters[meters.length - 1]?.ppq
  const tempo = ppq == null ? tempos[tempos.length - 1] : tempos.filter(p => p.ppq <= ppq).pop() ?? tempos[0]
  const meter = ppq == null ? meters[meters.length - 1] : meters.filter(p => p.ppq <= ppq).pop() ?? meters[0]

  let bar = position.bar
  let beat = position.beat
  if (bar == null && ppq != null && meter) {
    const beatPpq = 4 / meter.denominator
    const barPpq = meter.numerator * beatPpq
    bar = Math.floor(Math.max(0, ppq) / barPpq) + 1
    beat = (Math.max(0, ppq) % barPpq) / beatPpq + 1
  }
  const stamped = position.source === 'bwf' || position.source === 'ixml'
  const seconds = position.seconds == null
    ? undefined
    : Math.max(0, position.seconds - (stamped && position.seconds >= 3600 ? 3600 : 0))

  const out: ListenPosition = {}
  if (bar != null) out.b = bar
  if (beat != null) out.t = round(beat, 2)
  if (tempo) out.m = round(tempo.bpm, 2)
  if (meter) out.s = `${meter.numerator}/${meter.denominator}`
  if (seconds != null) out.c = round(seconds, 3)
  out.x = position.confidence === 'exact' ? 1 : 0
  return Object.keys(out).length > 1 ? out : null
}

export function buildListenUrl(input: {
  url: string
  name: string
  from?: string | null
  metadata?: AttachmentTimelineMetadata | null
}): string {
  const params = new URLSearchParams()
  params.set('u', input.url)
  params.set('n', input.name)
  if (input.from) params.set('f', input.from)
  const position = compactPosition(input.metadata)
  if (position) params.set('p', JSON.stringify(position))
  return `${LISTEN_BASE}?${params.toString()}`
}

/** Clipboard write that also works inside the plug-in's WKWebView. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the selection-based copy
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
