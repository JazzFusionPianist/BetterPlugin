/**
 * Vercel Edge Function: returns a presigned GET URL for a Cloudflare R2 object.
 *
 * Client flow:
 *   1. POST /api/r2-file-url with body: { key: '<userId>/<file>' }
 *      and header: Authorization: Bearer <supabase access_token>
 *   2. Receives: { url, expiresIn }  — a presigned GET, valid 30 minutes.
 *   3. Use `url` anywhere a public URL was used (audio src, fetch, <img>).
 *
 * Auth: the bearer token is verified against Supabase's GoTrue
 * (`GET ${SUPABASE_URL}/auth/v1/user`) — any signed-in user may read any
 * object (attachments are cross-user by design: chat, stems). 401 otherwise.
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

const EXPIRES_SECONDS = 1800 // 30 min — middle ground pending review

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

  // ── auth: the caller must hold a live Supabase session ──────────────
  const authz = req.headers.get('authorization') ?? ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : ''
  if (!token) {
    return json({ error: 'Authorization: Bearer <access_token> required' }, 401)
  }
  try {
    const userRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    })
    if (!userRes.ok) {
      return json({ error: 'invalid or expired token' }, 401)
    }
  } catch {
    return json({ error: 'auth check failed' }, 401)
  }

  let body: Body
  try { body = await req.json() }
  catch { return json({ error: 'invalid JSON body' }, 400) }

  const key = typeof body.key === 'string' ? body.key : ''
  if (!isSafeKey(key)) {
    return json({ error: 'invalid key' }, 400)
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
