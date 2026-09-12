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
import { r2KeyFromUrl } from './r2Keys'

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

/** The public base the bucket serves from (VITE_R2_PUBLIC_URL, same var
 *  the presign endpoint mirrors). Key extraction itself is the canonical
 *  r2KeyFromUrl (keep in sync with packages/core/lib/r2Keys.ts). */
const ENV_BASE: string | undefined =
  import.meta.env.VITE_R2_PUBLIC_URL as string | undefined

/** Extract the object key from a public R2 url; null when the url isn't
 *  one of ours (external links, data:, supabase storage — pass through). */
function keyFromPublicUrl(url: string): string | null {
  return r2KeyFromUrl(url, ENV_BASE)
}

// ── fallback telemetry ───────────────────────────────────────────────
//
// Every time we serve the PUBLIC url instead of a presigned one, count
// why. The counts are the readiness gauge for turning public bucket
// access off (the "3g" cutoff): precondition is counts ≈ 0 in normal
// use — a nonzero '403'/'no-session' says clients still lean on the
// fallback and the cutoff would break playback. 'no-key' additionally
// catches a misconfigured VITE_R2_PUBLIC_URL (our urls not recognized
// as ours). Inspect via getFallbackCounts() in the console.

export type FallbackReason = '403' | '401' | '5xx' | 'no-session' | 'network' | 'no-key'

const FALLBACK_COUNTS_KEY = 'orb_r2_fallbacks'
/** Module counter, persisted to localStorage so counts survive reloads. */
let fallbackCounts: Record<string, number> | null = null
const warnedReasons = new Set<FallbackReason>()

function loadFallbackCounts(): Record<string, number> {
  if (!fallbackCounts) {
    fallbackCounts = {}
    try {
      const raw = localStorage.getItem(FALLBACK_COUNTS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof v === 'number') fallbackCounts[k] = v
          }
        }
      }
    } catch { /* storage unavailable or corrupt — count in memory only */ }
  }
  return fallbackCounts
}

function recordFallback(reason: FallbackReason): void {
  const counts = loadFallbackCounts()
  counts[reason] = (counts[reason] ?? 0) + 1
  try {
    localStorage.setItem(FALLBACK_COUNTS_KEY, JSON.stringify(counts))
  } catch { /* storage unavailable — memory counter above still holds */ }
  // One warn per reason per session — enough to notice, no console spam.
  if (!warnedReasons.has(reason)) {
    warnedReasons.add(reason)
    console.warn(`[r2Access] presign fallback (${reason}) — served the public url; see getFallbackCounts()`)
  }
}

/** Cumulative public-url fallback counts by reason ({reason: count}). */
export function getFallbackCounts(): Record<string, number> {
  return { ...loadFallbackCounts() }
}

/** Strict mode (staging): VITE_R2_STRICT=1 disables the public-url
 *  fallback for R2 urls entirely — resolve rejects with the original
 *  error instead, so a broken presign path fails VISIBLY rather than
 *  silently leaning on public access. Non-R2 urls still pass through
 *  (they were never ours to presign). */
const STRICT = (import.meta.env.VITE_R2_STRICT as string | undefined) === '1'

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
 *   Every such fallback is counted (getFallbackCounts()); with
 *   VITE_R2_STRICT=1 the fallback is disabled and the original error
 *   is thrown instead (staging visibility).
 */
export async function resolveFileUrl(
  supabase: SupabaseClient | null,
  publicUrl: string,
): Promise<string> {
  const key = keyFromPublicUrl(publicUrl)
  if (!key) {
    // Not recognized as one of our R2 urls — pass through (even in
    // strict mode: there's nothing to presign). Counted so a
    // misconfigured public base shows up in the telemetry.
    recordFallback('no-key')
    return publicUrl
  }
  if (!supabase) {
    recordFallback('no-session')
    if (STRICT) throw new Error('[r2Access] no supabase client — cannot presign')
    return publicUrl
  }

  // Cache entries are scoped per signed-in user ('<uid>:<key>') so a
  // sign-out / sign-in in the same tab never reuses another account's
  // presigned urls. getSession() reads local state — no network.
  let uid = 'anon'
  let token: string | undefined
  try {
    const { data } = await supabase.auth.getSession()
    uid = data.session?.user?.id ?? 'anon'
    token = data.session?.access_token
  } catch (err) {
    recordFallback('no-session')
    if (STRICT) throw err
    return publicUrl
  }
  if (!token) {
    recordFallback('no-session')
    if (STRICT) throw new Error('[r2Access] no session — cannot presign')
    return publicUrl
  }

  const cacheKey = `${uid}:${key}`
  const now = Date.now()
  const hit = cacheGet(cacheKey)
  if (hit && hit.exp - REFRESH_MARGIN_MS > now) return hit.url

  const pending = inflight.get(cacheKey)
  if (pending) return pending

  const p = (async (): Promise<string> => {
    try {
      let res: Response
      try {
        res = await fetch('/api/r2-file-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ key }),
        })
      } catch (err) {
        recordFallback('network')
        if (STRICT) throw err
        return publicUrl
      }
      if (!res.ok) {
        // 403 (not a member / key unknown) and 401 (token) are the
        // interesting buckets; everything else non-ok is infra ('5xx').
        const reason: FallbackReason =
          res.status === 403 ? '403' : res.status === 401 ? '401' : '5xx'
        recordFallback(reason)
        if (STRICT) throw new Error(`[r2Access] presign failed: HTTP ${res.status}`)
        return publicUrl
      }
      let parsed: { url?: string; expiresIn?: number }
      try {
        parsed = await res.json() as { url?: string; expiresIn?: number }
      } catch (err) {
        recordFallback('5xx')
        if (STRICT) throw err
        return publicUrl
      }
      const { url, expiresIn } = parsed
      if (!url) {
        recordFallback('5xx')
        if (STRICT) throw new Error('[r2Access] presign failed: 200 without url')
        return publicUrl
      }
      cacheSet(cacheKey, { url, exp: Date.now() + (expiresIn ?? DEFAULT_TTL_SECONDS) * 1000 })
      return url
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
