/**
 * Vercel Edge Function: deletes a chat message (or stem) row AND the R2
 * objects it references — files no longer expire, so deletion is how a
 * sender's storage gets reclaimed.
 *
 * Client flow:
 *   1. POST /api/message-delete with body: { messageId: '<uuid>' }
 *      (or { stemId: '<uuid>' } for a conversation_stems row)
 *      and header: Authorization: Bearer <supabase access_token>
 *   2. Receives: { ok: true, deletedKeys, failedKeys }
 *
 * Auth — ownership via RLS (the single authority):
 *   The row DELETE goes to PostgREST with the CALLER'S OWN JWT, so only
 *   a row the caller may delete under RLS actually dies:
 *     messages           → policy "msg_delete" (sender_id = auth.uid())
 *     conversation_stems → policy "uploaders can delete stems"
 *   `Prefer: return=representation` hands back the deleted row(s):
 *   a 2xx with an empty array means RLS deleted nothing — the caller
 *   isn't the owner (or the row is already gone) → 403. A PostgREST
 *   failure → 502, fail-closed (no R2 delete without a dead row).
 *
 * R2 keys — only ever from the deleted row's own columns (the dedicated
 * key columns from 20260912_file_keys, defensively falling back to the
 * stored public url(s) for rows the backfill could not key). Keys from
 * the request body are never accepted. Object deletes are best-effort:
 * per-key ok/fail is reported, the row delete is never undone.
 *
 * Required env vars (Vercel Project Settings → Environment Variables):
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_R2_ACCESS_KEY_ID
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY
 *   CLOUDFLARE_R2_BUCKET
 *   SUPABASE_URL       (falls back to VITE_SUPABASE_URL — the Vercel project
 *   SUPABASE_ANON_KEY   may need these mirrored server-side; the VITE_* pair
 *                       is already set for the client build and works too)
 */
import { AwsClient } from 'aws4fetch'

export const config = { runtime: 'edge' }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
}

interface Body {
  messageId?: string
  stemId?: string
}

/** Row ids are uuids — a tight charset so the PostgREST filter pair
 *  can't be steered by a crafted id. */
function isSafeId(id: string): boolean {
  return /^[0-9a-fA-F-]{1,64}$/.test(id)
}

/** R2 object keys we delete: no traversal, no absolute paths, a tight
 *  character set (matches what r2-upload-url generates). */
function isSafeKey(key: string): boolean {
  if (!key || key.length > 512) return false
  if (key.startsWith('/')) return false
  if (key.includes('..')) return false
  return /^[A-Za-z0-9/_.-]+$/.test(key)
}

// Fallback key extraction for rows without attachment_keys/file_key —
// the same "stored public url → object key" rule as the canonical
// r2KeyFromUrl (packages/core/lib/r2Keys.ts) and the 20260912 backfill.
const R2_DEV_RE = /^https?:\/\/pub-[a-z0-9]+\.r2\.dev\//

function keyFromPublicUrl(url: string, base?: string): string | null {
  const b = base?.replace(/\/$/, '')
  if (b && url.startsWith(b + '/')) {
    return url.slice(b.length + 1) || null
  }
  const m = R2_DEV_RE.exec(url)
  if (m) return url.slice(m[0].length) || null
  return null
}

/** Every R2 key a deleted messages row references: attachment_keys is
 *  authoritative (populated by the writers, backfilled by
 *  20260912_file_keys); rows it could not key fall back to the stored
 *  url — a plain public url, or a JSON array of { url } tracks for
 *  multi-audio messages. */
function keysFromMessageRow(row: Record<string, unknown>, publicBase?: string): string[] {
  const stored = row.attachment_keys
  if (Array.isArray(stored)) {
    const keys = stored.filter((k): k is string => typeof k === 'string')
    if (keys.length > 0) return keys
  }
  const url = row.attachment_url
  if (typeof url !== 'string' || !url) return []
  let urls: string[]
  if (url.startsWith('[')) {
    try {
      const tracks = JSON.parse(url) as unknown
      if (!Array.isArray(tracks)) return []
      urls = tracks
        .map(t => (t && typeof t === 'object' && typeof (t as { url?: unknown }).url === 'string')
          ? (t as { url: string }).url
          : null)
        .filter((u): u is string => u !== null)
    } catch {
      return []
    }
  } else {
    urls = [url]
  }
  return urls
    .map(u => keyFromPublicUrl(u, publicBase))
    .filter((k): k is string => k !== null)
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405)
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  const bucket    = process.env.CLOUDFLARE_R2_BUCKET
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  // Only needed for the legacy-row url fallback — optional (r2.dev urls
  // resolve without it, custom-domain urls need it).
  const publicBase = process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL

  if (!accountId || !accessKey || !secretKey || !bucket || !supabaseUrl || !supabaseAnonKey) {
    return json({
      error: 'not configured',
      missing: {
        CLOUDFLARE_ACCOUNT_ID: !accountId,
        CLOUDFLARE_R2_ACCESS_KEY_ID: !accessKey,
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: !secretKey,
        CLOUDFLARE_R2_BUCKET: !bucket,
        SUPABASE_URL_or_VITE_SUPABASE_URL: !supabaseUrl,
        SUPABASE_ANON_KEY_or_VITE_SUPABASE_ANON_KEY: !supabaseAnonKey,
      },
    }, 500)
  }

  const authz = req.headers.get('authorization') ?? ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : ''
  if (!token) {
    return json({ error: 'Authorization: Bearer <access_token> required' }, 401)
  }

  let body: Body
  try { body = await req.json() }
  catch { return json({ error: 'invalid JSON body' }, 400) }

  const messageId = typeof body.messageId === 'string' ? body.messageId : ''
  const stemId = typeof body.stemId === 'string' ? body.stemId : ''
  if ((messageId ? 1 : 0) + (stemId ? 1 : 0) !== 1) {
    return json({ error: 'exactly one of messageId / stemId required' }, 400)
  }
  const id = messageId || stemId
  if (!isSafeId(id)) {
    return json({ error: 'invalid id' }, 400)
  }
  const table = messageId ? 'messages' : 'conversation_stems'

  // ── delete the row via PostgREST with the caller's JWT — RLS is the
  // single authority on who may delete what ───────────────────────────
  const restBase = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`
  let row: Record<string, unknown>
  try {
    const res = await fetch(`${restBase}/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        Prefer: 'return=representation',
        Accept: 'application/json',
      },
    })
    if (res.status === 401) {
      return json({ error: 'invalid or expired token' }, 401)
    }
    if (!res.ok) {
      // PostgREST failed outright — fail closed, nothing was verified.
      return json({ error: 'delete failed' }, 502)
    }
    let rows: unknown
    try { rows = await res.json() }
    catch { return json({ error: 'delete failed' }, 502) }
    if (!Array.isArray(rows)) {
      // A 2xx whose body isn't a row array is not PostgREST answering
      // (proxy interstitial, misrouted request) — infra, not a verdict.
      return json({ error: 'delete failed' }, 502)
    }
    if (rows.length === 0) {
      // RLS deleted nothing: not the owner, or the row is already gone.
      return json({ error: 'not-owner' }, 403)
    }
    row = rows[0] as Record<string, unknown>
  } catch {
    return json({ error: 'delete failed' }, 502)
  }

  // ── R2 keys — only ever from the deleted row's own columns ──────────
  const rawKeys = messageId
    ? keysFromMessageRow(row, publicBase)
    : (typeof row.file_key === 'string' && row.file_key
        ? [row.file_key]
        : (typeof row.file_url === 'string'
            ? [keyFromPublicUrl(row.file_url, publicBase)].filter((k): k is string => k !== null)
            : []))
  const keys = [...new Set(rawKeys)].filter(isSafeKey)

  // ── best-effort object deletes — the row is gone either way ─────────
  const client = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    service: 's3',
    region: 'auto',
  })

  const deletedKeys: string[] = []
  const failedKeys: string[] = []
  for (const key of keys) {
    const objectUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key
      .split('/').map(encodeURIComponent).join('/')}`
    try {
      const res = await client.fetch(objectUrl, { method: 'DELETE' })
      // 404 = already gone — that's the state we wanted.
      if (res.ok || res.status === 404) deletedKeys.push(key)
      else failedKeys.push(key)
    } catch {
      failedKeys.push(key)
    }
  }

  return json({ ok: true, deletedKeys, failedKeys }, 200)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  })
}
