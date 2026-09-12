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
 *
 * Cache: sessionStorage (survives in-tab reloads, dies with the tab) under
 * 'orb_r2_url:<uid>:<key>' — scoped to the signed-in user so a sign-out /
 * sign-in on the same tab can never serve one account's presigned urls to
 * another — with an in-memory Map fallback for environments where storage
 * throws (private windows, embedded webviews). All entries are also
 * dropped outright on SIGNED_OUT (belt and braces on top of the uid
 * scoping). A consumer that hits an expired url (403 from R2) calls
 * invalidateResolved() and re-resolves.
 */
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultSupabase } from './supabase'

/** Presigned URLs live 60 min (server-set); refresh 60 s before expiry. */
const REFRESH_MARGIN_MS = 60_000
const DEFAULT_TTL_SECONDS = 3600

interface CacheEntry { url: string; exp: number }

const STORAGE_PREFIX = 'orb_r2_url:'
/** Fallback when sessionStorage throws — same shape, same lifetime rules. */
const memCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<string>>()

/** Drop every cached presigned url (storage + memory). */
function cacheClearAll(): void {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(k)
    }
  } catch { /* storage unavailable — memory below still clears */ }
  memCache.clear()
}

// On sign-out, flush the whole presigned-url cache. The uid-scoped cache
// keys already prevent cross-user reuse; this makes sure signed urls
// don't linger in storage after the session that minted them ends.
try {
  defaultSupabase?.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') cacheClearAll()
  })
} catch { /* no client / SSR — cache stays uid-scoped regardless */ }

function cacheGet(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key)
    if (raw) {
      const v = JSON.parse(raw) as { url?: unknown; exp?: unknown }
      if (typeof v.url === 'string' && typeof v.exp === 'number') {
        return { url: v.url, exp: v.exp }
      }
    }
  } catch { /* storage unavailable or entry corrupt — fall through */ }
  return memCache.get(key) ?? null
}

function cacheSet(key: string, entry: CacheEntry): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry))
    return
  } catch { /* quota / private mode — keep it in memory instead */ }
  memCache.set(key, entry)
}

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

/** Drop the cached presigned url for a stored public url — call when the
 *  network says the url no longer works (403: expired or revoked), then
 *  resolveUrl() again for a fresh one. No-op for non-R2 urls. Sweeps the
 *  entry for every uid (cache keys are '<uid>:<key>' and this call site
 *  is sync — in practice only the current uid has one). */
export function invalidateResolved(publicUrl: string): void {
  const key = keyFromPublicUrl(publicUrl)
  if (!key) return
  const suffix = ':' + key
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(STORAGE_PREFIX) && k.endsWith(suffix)) {
        sessionStorage.removeItem(k)
      }
    }
  } catch { /* storage unavailable — memory below still clears */ }
  for (const k of [...memCache.keys()]) {
    if (k.endsWith(suffix)) memCache.delete(k)
  }
}

/**
 * Resolve a stored public url to a presigned GET url.
 *
 * - Non-R2 urls pass through unchanged.
 * - Presigned urls are cached per key (sessionStorage, memory fallback)
 *   and refreshed 60 s before expiry.
 * - ANY failure (no session, endpoint missing, network) returns the
 *   public url unchanged — safe while public access is still enabled.
 */
export async function resolveFileUrl(
  supabase: SupabaseClient | null,
  publicUrl: string,
): Promise<string> {
  const key = keyFromPublicUrl(publicUrl)
  if (!key || !supabase) return publicUrl

  // Cache entries are scoped per signed-in user ('<uid>:<key>') so a
  // sign-out / sign-in in the same tab never reuses another account's
  // presigned urls. getSession() reads local state — no network.
  let uid = 'anon'
  let token: string | undefined
  try {
    const { data } = await supabase.auth.getSession()
    uid = data.session?.user?.id ?? 'anon'
    token = data.session?.access_token
  } catch { return publicUrl }
  if (!token) return publicUrl

  const cacheKey = `${uid}:${key}`
  const now = Date.now()
  const hit = cacheGet(cacheKey)
  if (hit && hit.exp - REFRESH_MARGIN_MS > now) return hit.url

  const pending = inflight.get(cacheKey)
  if (pending) return pending

  const p = (async (): Promise<string> => {
    try {
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
      cacheSet(cacheKey, { url, exp: Date.now() + (expiresIn ?? DEFAULT_TTL_SECONDS) * 1000 })
      return url
    } catch {
      return publicUrl
    } finally {
      inflight.delete(cacheKey)
    }
  })()
  inflight.set(cacheKey, p)
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
