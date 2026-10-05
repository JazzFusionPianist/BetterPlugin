import { AwsClient } from 'aws4fetch'

export class HttpError extends Error {
  readonly status:number
  constructor(status:number,message:string){super(message);this.status=status}
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function safeKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length <= 512 && !key.startsWith('/') && !key.includes('..') && /^[a-zA-Z0-9/_\-.]+$/.test(key)
}
export function env(name: string, fallback?: string): string {
  const value = process.env[name] || (fallback ? process.env[fallback] : '')
  if (!value) throw new HttpError(503, 'Service configuration is incomplete')
  return value
}
export function database() { return env('SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/, '') }
export function anonKey() { return env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') }
export function bearer(req: Request): string {
  const match = /^Bearer ([^\s]+)$/.exec(req.headers.get('authorization') ?? '')
  if (!match) throw new HttpError(401, 'Sign in required')
  return match[1]
}
export async function rpc<T>(token: string, name: string, args: Record<string, unknown> = {}, privileged = false): Promise<T> {
  const key = privileged ? env('SUPABASE_SERVICE_ROLE_KEY') : anonKey()
  const res = await fetch(`${database()}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${privileged ? key : token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const failure = await res.json().catch(() => ({})) as { code?: string; message?: string }
    if (failure.code === 'P0001' && failure.message === 'Rate limit exceeded') throw new HttpError(429, 'Too many requests')
    if (res.status === 401) throw new HttpError(401, 'Session expired')
    if (failure.code === '42501' || res.status === 403) throw new HttpError(403, 'Access denied')
    if (failure.code === 'P0002' && failure.message === 'Attachment expired') throw new HttpError(410, 'Attachment expired')
    if (failure.code === '22023') throw new HttpError(400, 'Invalid request')
    throw new HttpError(502, 'Database operation failed')
  }
  // PostgREST returns an empty body for PostgreSQL void functions (rate limits,
  // finalization and cleanup). Treat that as null instead of a JSON parse error.
  const body = await res.text()
  return (body.trim() ? JSON.parse(body) : null) as T
}
export async function authenticate(req: Request, action: string) {
  const token = bearer(req)
  const user = await rpc<{ id: string }>(token, 'security_check_session')
  await rpc(token, 'security_rate_limit', { p_action: action })
  return { token, userId: user.id }
}
export async function readBody<T>(req: Request, limit = 16384): Promise<T> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'JSON required')
  const reader = req.body?.getReader()
  if (!reader) throw new HttpError(400, 'Request body required')
  let bytes = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > limit) throw new HttpError(413, 'Request too large')
      chunks.push(value)
    }
    const merged = new Uint8Array(bytes); let offset = 0
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }
    const body: unknown = JSON.parse(new TextDecoder().decode(merged))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('object required')
    return body as T
  } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'Invalid JSON') }
  finally { await reader.cancel().catch(() => {}) }
}
export function response(req: Request, body: unknown, status = 200): Response {
  const origin = req.headers.get('origin')
  const allowed = new Set((process.env.ALLOWED_ORIGINS || 'https://better-plugin.vercel.app,https://orb-app-liard.vercel.app,capacitor://localhost,juce://juce.backend').split(',').map(x => x.trim()))
  const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin' }
  if (origin && allowed.has(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, authorization' })
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers })
}
export function endpoint(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return response(req, null, 204)
    if (req.method !== 'POST') return response(req, { error: 'POST required' }, 405)
    try { return response(req, await fn(req)) }
    catch (error) {
      if (!(error instanceof HttpError)) {
        // Stack locations only: exception messages can contain URLs or tokens.
        console.error('Security endpoint failure', error instanceof Error ? error.name : typeof error,
          error instanceof Error ? error.stack?.split('\n').slice(1, 3).join('\n') : '')
      }
      return response(req, { error: error instanceof HttpError ? error.message : 'Request failed' }, error instanceof HttpError ? error.status : 500)
    }
  }
}
export function r2() {
  return new AwsClient({ accessKeyId: env('CLOUDFLARE_R2_ACCESS_KEY_ID'), secretAccessKey: env('CLOUDFLARE_R2_SECRET_ACCESS_KEY'), service: 's3', region: 'auto' })
}
export function objectUrl(key: string, storage: 'private' | 'public' | 'legacy') {
  if (!safeKey(key)) throw new HttpError(400, 'Invalid file key')
  const bucket = storage === 'private' ? env('CLOUDFLARE_R2_PRIVATE_BUCKET') : env('CLOUDFLARE_R2_BUCKET')
  return `https://${env('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`
}
export interface FileRecord { object_key: string; storage: 'private' | 'public' | 'legacy'; size: number; mime: string; name: string; status: string; retention_expires_at?:string|null }
