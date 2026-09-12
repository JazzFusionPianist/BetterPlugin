/**
 * Canonical R2 object-key extraction — the ONE place the "stored public
 * url → object key" rule lives.
 *
 * Keep in sync with packages/core/lib/r2Keys.ts — that file is the
 * canonical copy; apps/plugin/src/lib/r2Keys.ts and
 * apps/web/lib/games/r2Keys.ts are byte-identical local copies (the
 * repo's deliberate-duplication pattern: core stays bundler-agnostic,
 * each app keeps its import graph local).
 *
 * A stored url (messages.attachment_url, conversation_stems.file_url)
 * is "ours" when its origin is either the configured public base
 * (VITE_R2_PUBLIC_URL / NEXT_PUBLIC_R2_PUBLIC_URL — the caller passes
 * it, since env access is bundler-specific) or R2's default public
 * domain shape (https://pub-<hash>.r2.dev/). Everything else — external
 * links, data:, supabase storage — returns null and passes through.
 *
 * The 20260912_file_keys migration's backfill (regexp_replace stripping
 * the origin of 'http%r2.dev/%' rows) must stay equivalent to this
 * function, and the presign endpoint's membership probe matches these
 * exact keys — change one, change all.
 */

const R2_DEV_RE = /^https?:\/\/pub-[a-z0-9]+\.r2\.dev\//

/**
 * The R2 object key for a stored public url, or null when the url isn't
 * one of ours.
 *
 * @param url  The stored public url.
 * @param base Optional configured public base (origin, trailing slash
 *             ok) — checked before the pub-*.r2.dev shape so custom
 *             domains resolve too.
 */
export function r2KeyFromUrl(url: string, base?: string): string | null {
  const b = base?.replace(/\/$/, '')
  if (b && url.startsWith(b + '/')) {
    return url.slice(b.length + 1) || null
  }
  const m = R2_DEV_RE.exec(url)
  if (m) return url.slice(m[0].length) || null
  return null
}
