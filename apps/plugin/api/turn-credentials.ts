/**
 * Vercel Edge Function: proxies Cloudflare Calls TURN credential
 * generation. Keeps the Calls API token server-side; returns short-lived
 * (24h) ICE server credentials to the browser.
 *
 * Required env vars (Vercel → Project Settings → Environment Variables):
 *   CLOUDFLARE_CALLS_TURN_TOKEN_ID  — TURN key ID from Cloudflare dashboard
 *   CLOUDFLARE_CALLS_TURN_API_TOKEN — API token (the secret) for that key
 *
 * If either is missing, returns 404 so the client falls through to STUN-only.
 *
 * Response shape (matches Cloudflare's API):
 *   { "iceServers": { "urls": ["turn:..."], "username": "...", "credential": "..." } }
 */
export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  const tokenId  = process.env.CLOUDFLARE_CALLS_TURN_TOKEN_ID
  const apiToken = process.env.CLOUDFLARE_CALLS_TURN_API_TOKEN

  if (!tokenId || !apiToken) {
    return json({ error: 'TURN not configured' }, 404)
  }

  try {
    const cfRes = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${tokenId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }),  // 24h
      }
    )
    if (!cfRes.ok) {
      const text = await cfRes.text()
      return json({ error: `Cloudflare API ${cfRes.status}: ${text}` }, 500)
    }
    const data = await cfRes.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        // Cache on Vercel's edge for 23h so we re-use credentials across users.
        // Browsers won't cache (no s-maxage equivalent in browser), so each
        // browser session does one round-trip.
        'cache-control': 's-maxage=82800, stale-while-revalidate=3600',
      },
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
