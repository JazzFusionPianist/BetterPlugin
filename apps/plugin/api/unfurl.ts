import { authenticate, readBody, response } from '../server/security'
/**
 * Vercel Edge Function: unfurl a URL into Open Graph metadata.
 *
 * Used by the chat to show a Slack/iMessage-style link preview card
 * for any URL the user pastes. CORS would block the client from
 * fetching most third-party pages directly, so we proxy through this
 * function and parse the meta tags server-side.
 *
 * Client:
 *   GET /api/unfurl?url=<encoded URL>
 * Response:
 *   { title?, description?, image?, siteName?, url }
 *   - All fields except `url` are optional — missing fields signal
 *     "the source didn't expose this tag". The client renders a
 *     compact card with whatever it got.
 *
 * Hardening:
 *   - Only http(s) URLs accepted.
 *   - We stream at most 256 KB of HTML — OG tags live in <head>, so
 *     reading more than that is pure waste and a DoS lever.
 *   - 5-second total timeout via AbortController.
 *   - Strict regex extraction — no DOM parser, no script execution.
 */

export const config = { runtime: 'edge' }

const MAX_BYTES = 256 * 1024            // 256 KB cap on read
const TIMEOUT_MS = 5_000
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

interface UnfurlResult {
  title?: string
  description?: string
  image?: string
  siteName?: string
  url: string
}

/** Pull one meta-tag value out of head HTML. Matches both attribute
 *  orders (property/content vs name/content) and either quote style. */
function extractMeta (html: string, key: string): string | undefined {
  // property="og:image" content="…"  OR  content="…" property="og:image"
  const patterns: RegExp[] = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = re.exec(html)
    if (m && m[1]) return decodeEntities(m[1].trim())
  }
  return undefined
}

function extractTitle (html: string): string | undefined {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (m && m[1]) return decodeEntities(m[1].trim().slice(0, 300))
  return undefined
}

/** Minimal HTML entity decode for the handful that show up in OG tags. */
function decodeEntities (s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

/** Resolve a possibly-relative URL against the source. og:image is
 *  sometimes "/foo.png" — we want the absolute form so the client can
 *  just stick it in an <img src>. */
function absolutise (raw: string | undefined, base: string): string | undefined {
  if (!raw) return undefined
  try { const u=new URL(raw,base);return u.protocol==='https:' && ['i.ytimg.com','img.youtube.com','i.scdn.co','i1.sndcdn.com','is1-ssl.mzstatic.com'].includes(u.hostname)?u.toString():undefined }
  catch { return undefined }
}

async function readBoundedText (resp: Response, maxBytes: number): Promise<string> {
  if (!resp.body) return ''
  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let received = 0
  let out = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    out += decoder.decode(value, { stream: true })
    if (received >= maxBytes) {
      // Abandon further reads — we have enough.
      try { await reader.cancel() } catch { /* ignore */ }
      break
    }
  }
  out += decoder.decode()
  return out
}

export default async function handler (req: Request): Promise<Response> {
  if(req.method==='OPTIONS')return response(req,null,204)
  if(req.method!=='POST')return response(req,{error:'POST required'},405)
  let target:unknown
  try{await authenticate(req,'unfurl');target=(await readBody<{url:unknown}>(req)).url}catch{return response(req,{error:'Not authorized'},403)}
  if(typeof target!=='string' || target.length>2048)return response(req,{error:'Invalid URL'},400)
  if (!target) return jsonError(400, 'missing url')

  let parsed: URL
  try { parsed = new URL(target) }
  catch { return jsonError(400, 'invalid url') }
  const allowed=new Set(['www.youtube.com','youtube.com','youtu.be','soundcloud.com','open.spotify.com','music.apple.com'])
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol) || parsed.protocol!=='https:' || parsed.username || parsed.password || (parsed.port && parsed.port!=='443') || !allowed.has(parsed.hostname)) return jsonError(400, 'bad scheme')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let html = ''
  try {
    const resp = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'error',
      headers: {
        // Some sites gate OG tags behind a non-bot user agent.
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'en;q=0.8',
      },
    })
    if (!resp.ok) return jsonError(502, `upstream ${resp.status}`)
    const ct = resp.headers.get('content-type') || ''
    if (!ct.includes('html')) return jsonError(415, 'not html')
    html = await readBoundedText(resp, MAX_BYTES)
  } catch {
    clearTimeout(timer)
    return jsonError(504, 'Preview unavailable')
  }
  clearTimeout(timer)

  const finalUrl = parsed.toString()
  const result: UnfurlResult = {
    title:
      extractMeta(html, 'og:title')
      ?? extractMeta(html, 'twitter:title')
      ?? extractTitle(html),
    description:
      extractMeta(html, 'og:description')
      ?? extractMeta(html, 'twitter:description')
      ?? extractMeta(html, 'description'),
    image: absolutise(
      extractMeta(html, 'og:image')
        ?? extractMeta(html, 'twitter:image')
        ?? extractMeta(html, 'twitter:image:src'),
      finalUrl
    ),
    siteName:
      extractMeta(html, 'og:site_name')
      ?? parsed.hostname.replace(/^www\./, ''),
    url: finalUrl,
  }

  // Cache aggressively at the edge — 4h, stale-while-revalidate 24h.
  // Same URL → same response, so per-user caching is irrelevant.
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, no-store',
      'access-control-allow-origin': '*',
    },
  })
}

function jsonError (status: number, msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    },
  })
}
