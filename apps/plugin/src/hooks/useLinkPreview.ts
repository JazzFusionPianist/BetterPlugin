import { useEffect, useState } from 'react'

/**
 * Lightweight link-preview hook for chat bubbles.
 *
 * - YouTube URLs short-circuit: we synthesise the preview from the
 *   video id (thumbnail from img.youtube.com, title via the public
 *   oEmbed endpoint which is CORS-friendly). Zero edge-function load.
 * - Every other URL hits /api/unfurl, the Vercel Edge Function that
 *   fetches the page server-side and parses OG meta tags.
 * - In-memory cache so the same URL never round-trips twice per
 *   session, even across remounts of the chat view.
 *
 * Returns `null` while loading and on failure — the caller renders
 * nothing in those states (preview is enhancement, not core UX).
 */

export interface LinkPreview {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
}

const cache = new Map<string, LinkPreview | 'failed'>()
const inflight = new Map<string, Promise<LinkPreview | null>>()

// ─── YouTube fast path ────────────────────────────────────────────────────────

const YT_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
])

function youtubeId (url: URL): string | null {
  if (url.hostname === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '').split('/')[0]
    return /^[\w-]{6,15}$/.test(id) ? id : null
  }
  if (url.pathname.startsWith('/watch')) {
    const v = url.searchParams.get('v')
    return v && /^[\w-]{6,15}$/.test(v) ? v : null
  }
  if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
    const id = url.pathname.split('/')[2]
    return id && /^[\w-]{6,15}$/.test(id) ? id : null
  }
  return null
}

async function fetchYoutubeTitle (videoUrl: string): Promise<string | undefined> {
  // YouTube's oEmbed endpoint is CORS-friendly and rate-limit-friendly.
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`)
    if (!r.ok) return undefined
    const j = (await r.json()) as { title?: string; author_name?: string }
    return j.title
  } catch { return undefined }
}

async function previewYoutube (url: URL): Promise<LinkPreview | null> {
  const id = youtubeId(url)
  if (!id) return null
  // hqdefault.jpg always exists; maxresdefault may 404 on older videos.
  const image = `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  const title = await fetchYoutubeTitle(url.toString())
  return {
    url: url.toString(),
    title: title ?? 'YouTube video',
    siteName: 'YouTube',
    image,
  }
}

// ─── Generic path via /api/unfurl ────────────────────────────────────────────

async function previewGeneric (raw: string): Promise<LinkPreview | null> {
  try {
    const r = await fetch(`/api/unfurl?url=${encodeURIComponent(raw)}`)
    if (!r.ok) return null
    const j = (await r.json()) as LinkPreview & { error?: string }
    if (j.error) return null
    // Require at least one of title/image to be worth rendering.
    if (!j.title && !j.image) return null
    return j
  } catch { return null }
}

// ─── Public hook ─────────────────────────────────────────────────────────────

export function useLinkPreview (rawUrl: string | null): LinkPreview | null {
  const [preview, setPreview] = useState<LinkPreview | null>(() => {
    if (!rawUrl) return null
    const c = cache.get(rawUrl)
    return c && c !== 'failed' ? c : null
  })

  useEffect(() => {
    if (!rawUrl) { setPreview(null); return }
    const cached = cache.get(rawUrl)
    if (cached === 'failed') { setPreview(null); return }
    if (cached) { setPreview(cached); return }

    let cancelled = false
    const existing = inflight.get(rawUrl)
    const promise = existing ?? (async () => {
      let url: URL
      try { url = new URL(rawUrl) } catch { return null }
      const result = YT_HOSTS.has(url.hostname)
        ? await previewYoutube(url)
        : await previewGeneric(url.toString())
      cache.set(rawUrl, result ?? 'failed')
      inflight.delete(rawUrl)
      return result
    })()
    if (!existing) inflight.set(rawUrl, promise)

    promise.then(r => { if (!cancelled) setPreview(r) })
    return () => { cancelled = true }
  }, [rawUrl])

  return preview
}
