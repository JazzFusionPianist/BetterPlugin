/**
 * Presigned-read access to R2 attachments.
 *
 * Stored URLs (messages.attachment_url, conversation_stems.file_url) are
 * the bucket's PUBLIC urls. While public access is still enabled they work
 * as-is; this module upgrades them to short-lived presigned GET urls via
 * /api/r2-file-url so playback keeps working once public access is turned
 * off. Every failure path falls back to the original public url — a stale
 * client or a missing endpoint can never break playback while public
 * access is on.
 *
 * Identity stays the PUBLIC url everywhere (cache keys, engine.activeUrl,
 * React keys); the presigned url is only used at the network edge
 * (audio src, fetch, <img>/<video> src).
 */
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultSupabase } from './supabase'

/** Presigned URLs live 30 min (server-set); refresh 60 s before expiry. */
const REFRESH_MARGIN_MS = 60_000

interface CacheEntry { url: string; expiresAt: number }
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<string>>()

/** The public base the bucket serves from. Prefer the build-time env
 *  (VITE_R2_PUBLIC_URL, same var the presign endpoint mirrors); when it
 *  isn't set, fall back to detecting R2's default public domain shape
 *  (https://pub-<hash>.r2.dev/). */
const ENV_BASE: string | undefined =
  (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined)?.replace(/\/$/, '')
const R2_DEV_RE = /^https:\/\/pub-[a-z0-9]+\.r2\.dev\//

/** Extract the object key from a public R2 url; null when the url isn't
 *  one of ours (external links, data:, supabase storage — pass through). */
function keyFromPublicUrl(url: string): string | null {
  if (ENV_BASE && url.startsWith(ENV_BASE + '/')) {
    return url.slice(ENV_BASE.length + 1) || null
  }
  const m = R2_DEV_RE.exec(url)
  if (m) return url.slice(m[0].length) || null
  return null
}

/**
 * Resolve a stored public url to a presigned GET url.
 *
 * - Non-R2 urls pass through unchanged.
 * - Presigned urls are cached per key and refreshed 60 s before expiry.
 * - ANY failure (no session, endpoint missing, network) returns the
 *   public url unchanged — safe while public access is still enabled.
 */
export async function resolveFileUrl(
  supabase: SupabaseClient | null,
  publicUrl: string,
): Promise<string> {
  const key = keyFromPublicUrl(publicUrl)
  if (!key || !supabase) return publicUrl

  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt - REFRESH_MARGIN_MS > now) return hit.url

  const pending = inflight.get(key)
  if (pending) return pending

  const p = (async (): Promise<string> => {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return publicUrl

      const res = await fetch('/api/r2-file-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key }),
      })
      if (!res.ok) return publicUrl
      const { url, expiresIn } = await res.json() as { url?: string; expiresIn?: number }
      if (!url) return publicUrl
      cache.set(key, { url, expiresAt: Date.now() + (expiresIn ?? 1800) * 1000 })
      return url
    } catch {
      return publicUrl
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  return p
}

/** resolveFileUrl bound to the module singleton client — for module-level
 *  call sites (waveform decode cache) that don't thread a client through. */
export function resolveUrl(publicUrl: string): Promise<string> {
  return resolveFileUrl(defaultSupabase, publicUrl)
}

/**
 * Hook: the resolved (presigned) url for a stored public url. Returns the
 * public url immediately, then swaps in the presigned one once resolved.
 * Keyed on the public url — cache refreshes don't re-render mid-lifetime.
 */
export function useResolvedUrl(url: string): string {
  const [resolved, setResolved] = useState(url)
  useEffect(() => {
    let dead = false
    setResolved(url)
    void resolveUrl(url).then(r => { if (!dead && r !== url) setResolved(r) })
    return () => { dead = true }
  }, [url])
  return resolved
}
