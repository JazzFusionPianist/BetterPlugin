/**
 * Listen links — the shape shared with apps/plugin/src/lib/shareLink.ts.
 * Everything the static /listen page needs rides in the query string:
 * the public file URL, the name, who sent it, and the original position
 * boiled down to what a listener reads.
 */

export const LISTEN_BASE = 'https://orb-app-liard.vercel.app/listen'

/** Compact position (`p` param): bar, beat, bpm, meter, seconds, exact. */
export interface ListenPosition {
  b?: number
  t?: number
  m?: number
  s?: string
  c?: number
  x?: 0 | 1
}

export interface ListenParams {
  url: string
  name: string
  from?: string
  position?: ListenPosition
}

export function parseListenParams(search: string): ListenParams | null {
  const params = new URLSearchParams(search)
  const url = params.get('u')
  if (!url || !/^(https?:)?\/\//.test(url) && !url.startsWith('/')) return null
  const out: ListenParams = { url, name: params.get('n') || 'audio' }
  const from = params.get('f')
  if (from) out.from = from
  const raw = params.get('p')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ListenPosition
      if (parsed && typeof parsed === 'object') out.position = parsed
    } catch { /* a link without a readable position still plays */ }
  }
  return out
}

/** Loose mirror of the plug-in's AttachmentTimelineMetadata. */
interface TimelineLike {
  position?: {
    seconds?: number; ppq?: number; bar?: number; beat?: number
    source?: string; confidence?: string
  }
  tempo_map?: { ppq: number; bpm: number }[]
  time_signature_map?: { ppq: number; numerator: number; denominator: number }[]
}

function round(n: number, places: number): number {
  const f = 10 ** places
  return Math.round(n * f) / f
}

export function compactPosition(metadata: unknown): ListenPosition | null {
  const meta = metadata as TimelineLike | null | undefined
  if (!meta || typeof meta !== 'object' || !meta.position) return null
  const position = meta.position
  const tempos = meta.tempo_map?.slice().sort((a, b) => a.ppq - b.ppq) ?? []
  const meters = meta.time_signature_map?.slice().sort((a, b) => a.ppq - b.ppq) ?? []
  const ppq = position.ppq ?? tempos[tempos.length - 1]?.ppq ?? meters[meters.length - 1]?.ppq
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

export function buildListenUrl(input: { url: string; name: string; from?: string | null; metadata?: unknown }): string {
  const params = new URLSearchParams()
  params.set('u', input.url)
  params.set('n', input.name)
  if (input.from) params.set('f', input.from)
  const position = compactPosition(input.metadata)
  if (position) params.set('p', JSON.stringify(position))
  return `${LISTEN_BASE}?${params.toString()}`
}

/** "bar 17 · beat 1 · 120 bpm · 4/4" — the line a listener reads. */
export function describePosition(p?: ListenPosition): string | null {
  if (!p) return null
  const parts: string[] = []
  if (p.b != null) parts.push(`bar ${p.b}${p.t != null ? ` · beat ${p.t % 1 === 0 ? p.t : p.t.toFixed(2)}` : ''}`)
  if (p.m != null) parts.push(`${p.m % 1 === 0 ? p.m : p.m.toFixed(1)} bpm`)
  if (p.s) parts.push(p.s)
  return parts.length ? parts.join(' · ') : null
}

/** Share sheet on phones, clipboard elsewhere. Returns how it went out. */
export async function shareListenUrl(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const nav = navigator as Navigator & { share?: (data: { url: string; title?: string }) => Promise<void> }
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  if (touch && nav.share) {
    try { await nav.share({ url, title }); return 'shared' } catch { /* dismissed — fall back to copying */ }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
