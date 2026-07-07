/**
 * Vercel Edge Function: returns a presigned PUT URL for Cloudflare R2.
 *
 * Client flow:
 *   1. POST /api/r2-upload-url with body:
 *        { ext: 'mp3', contentType: 'audio/mpeg', userId: '<uuid>' }
 *   2. Receives: { uploadUrl, publicUrl, key }
 *   3. PUT the file to uploadUrl with the same Content-Type header.
 *   4. Store publicUrl in messages.attachment_url.
 *
 * The presigned URL is valid for 15 minutes. R2 has a 7-day lifecycle rule
 * that auto-deletes objects, matching the chat attachment expiry policy.
 *
 * Required env vars (Vercel Project Settings → Environment Variables):
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_R2_ACCESS_KEY_ID
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY
 *   CLOUDFLARE_R2_BUCKET
 *   VITE_R2_PUBLIC_URL  (also available server-side as R2_PUBLIC_URL)
 */
import { AwsClient } from 'aws4fetch'

export const config = { runtime: 'edge' }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

interface Body {
  ext?: string
  contentType?: string
  userId?: string
}

export default async function handler(req: Request): Promise<Response> {
  // CORS: the mobile/web app (different origin — capacitor://localhost,
  // localhost dev, or its own vercel domain) shares this presign endpoint.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405)
  }

  const accountId  = process.env.CLOUDFLARE_ACCOUNT_ID
  const accessKey  = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretKey  = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  const bucket     = process.env.CLOUDFLARE_R2_BUCKET
  // Public URL is also exposed via VITE_R2_PUBLIC_URL on the client; mirror it
  // server-side too in case the project only sets the VITE_* one.
  const publicBase = process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL

  if (!accountId || !accessKey || !secretKey || !bucket || !publicBase) {
    return json({
      error: 'R2 not configured',
      missing: {
        CLOUDFLARE_ACCOUNT_ID: !accountId,
        CLOUDFLARE_R2_ACCESS_KEY_ID: !accessKey,
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: !secretKey,
        CLOUDFLARE_R2_BUCKET: !bucket,
        R2_PUBLIC_URL_or_VITE_R2_PUBLIC_URL: !publicBase,
      },
    }, 500)
  }

  let body: Body
  try { body = await req.json() }
  catch { return json({ error: 'invalid JSON body' }, 400) }

  const { ext, contentType, userId } = body
  if (!ext || !contentType || !userId) {
    return json({ error: 'ext, contentType, userId required' }, 400)
  }
  // Sanitise ext — prevent path traversal / weird chars
  const safeExt = String(ext).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin'
  const safeUserId = String(userId).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64)

  const key = `${safeUserId}/${Date.now()}-${cryptoRandom(16)}.${safeExt}`

  const client = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeURIComponent(key)}`

  // aws4fetch's `signQuery: true` produces a presigned URL with auth in the
  // query string — the browser can then PUT to it directly without needing
  // any auth headers. Content-Type is signed in so the client must send the
  // same one.
  const signed = await client.sign(
    new Request(`${objectUrl}?X-Amz-Expires=900`, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
    }),
    { aws: { signQuery: true } }
  )

  const publicUrl = `${publicBase.replace(/\/$/, '')}/${key}`

  return json({
    uploadUrl: signed.url,
    publicUrl,
    key,
    contentType,
  }, 200)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  })
}

function cryptoRandom(len: number): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, len)
}
