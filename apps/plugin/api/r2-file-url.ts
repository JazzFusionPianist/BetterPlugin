/**
 * Vercel Edge Function: returns a presigned GET URL for a Cloudflare R2 object.
 *
 * Client flow:
 *   1. POST /api/r2-file-url with body: { key: '<userId>/<file>' }
 *      and header: Authorization: Bearer <supabase access_token>
 *   2. Receives: { url, expiresIn }  — a presigned GET, valid 60 minutes.
 *   3. Use `url` anywhere a public URL was used (audio src, fetch, <img>).
 *
 * Auth — conversation membership via RLS (v2, keyed):
 *   With the CALLER'S OWN JWT we ask PostgREST whether any row referencing
 *   this key is visible to them, matching the dedicated key columns
 *   (populated by the app's writers, backfilled by 20260912_file_keys):
 *     GET /rest/v1/messages?select=id&attachment_keys=cs.{"<key>"}&limit=1
 *     GET /rest/v1/conversation_stems?select=id&file_key=eq.<key>&limit=1
 *   Exact-key matching — no ilike, so no wildcard-escaping and no
 *   substring collisions between keys.
 *   RLS on both tables is is_conversation_member, so a visible row proves
 *   the caller is a member of the conversation the file belongs to (and,
 *   as a side effect, that the JWT is valid — no separate /auth/v1/user
 *   call needed). PostgREST 401 → 401; no visible row in either → 403.
 *
 * Threat model — leaked presigned URLs:
 *   A presigned URL contains the object key in the clear and works for
 *   anyone holding it until it expires. The membership check above is the
 *   PRIMARY defense: only conversation members can mint one. The TTL is a
 *   UX parameter, not the security boundary — long enough (60 min) that a
 *   listening session doesn't hit mid-play expiry, short enough that a
 *   pasted-somewhere URL goes stale within the hour. Clients recover from
 *   expiry by re-minting (see src/lib/r2Access.ts).
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

// Workspace (logged-in) presign TTL. The future listen-link endpoint
// must use its own, much shorter TTL (600s) — short TTL is what makes
// link revocation effectively immediate there.
const EXPIRES_SECONDS = 3600 // 60 min — membership check is the gate; TTL is UX

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
}

interface Body {
  key?: string
}

/** R2 object keys we hand out: no traversal, no absolute paths, a tight
 *  character set (matches what r2-upload-url generates). */
function isSafeKey(key: string): boolean {
  if (!key || key.length > 512) return false
  if (key.startsWith('/')) return false
  if (key.includes('..')) return false
  return /^[A-Za-z0-9/_.-]+$/.test(key)
}

/** One PostgREST probe under the caller's JWT: is any row of `table`
 *  matching `filter` (an already-encoded `column=op.value` query pair)
 *  visible through RLS? */
async function rowVisible(
  restBase: string,
  anonKey: string,
  token: string,
  table: string,
  filter: string,
): Promise<{ visible: boolean; status: number }> {
  const url = `${restBase}/${table}?select=id&${filter}&limit=1`
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) return { visible: false, status: res.status }
  let rows: unknown
  try { rows = await res.json() }
  catch { return { visible: false, status: 502 } }
  if (!Array.isArray(rows)) {
    // A 200 whose body isn't a row array is not PostgREST answering the
    // probe (proxy interstitial, gateway HTML, misrouted request) — an
    // infra failure, NOT a "no visible row" membership verdict. Report
    // 502 so the handler doesn't turn it into a 403.
    return { visible: false, status: 502 }
  }
  return { visible: rows.length > 0, status: 200 }
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

  const key = typeof body.key === 'string' ? body.key : ''
  if (!isSafeKey(key)) {
    return json({ error: 'invalid key' }, 400)
  }

  // ── auth: membership via RLS, with the caller's own JWT ─────────────
  // A row referencing this key visible under is_conversation_member RLS
  // proves membership (and validates the JWT in the same round trip).
  const restBase = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`
  // messages.attachment_keys is text[] — `cs` (contains) with a PostgREST
  // array literal. The key goes double-quoted inside {} (it contains '/');
  // encodeURIComponent covers the braces, quotes, and slashes so the pair
  // survives URL parsing intact. conversation_stems.file_key is scalar — eq.
  const messagesFilter = `attachment_keys=cs.${encodeURIComponent(`{"${key}"}`)}`
  const stemsFilter = `file_key=eq.${encodeURIComponent(key)}`
  try {
    const viaMessages = await rowVisible(
      restBase, supabaseAnonKey, token, 'messages', messagesFilter)
    if (viaMessages.status === 401) {
      return json({ error: 'invalid or expired token' }, 401)
    }
    if (viaMessages.status !== 200) {
      // Probe failed outright (PostgREST down / misconfigured) — an
      // infra error, not a verdict on membership.
      return json({ error: 'membership check failed' }, 502)
    }
    if (!viaMessages.visible) {
      const viaStems = await rowVisible(
        restBase, supabaseAnonKey, token, 'conversation_stems', stemsFilter)
      if (viaStems.status === 401) {
        return json({ error: 'invalid or expired token' }, 401)
      }
      if (viaStems.status !== 200) {
        return json({ error: 'membership check failed' }, 502)
      }
      if (!viaStems.visible) {
        return json({ error: "not a member of this file's conversation" }, 403)
      }
    }
  } catch {
    return json({ error: 'membership check failed' }, 502)
  }

  const client = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key
    .split('/').map(encodeURIComponent).join('/')}`

  const signed = await client.sign(
    new Request(`${objectUrl}?X-Amz-Expires=${EXPIRES_SECONDS}`, { method: 'GET' }),
    { aws: { signQuery: true } }
  )

  return json({ url: signed.url, expiresIn: EXPIRES_SECONDS }, 200)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  })
}
