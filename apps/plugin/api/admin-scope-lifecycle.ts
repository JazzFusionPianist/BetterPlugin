/**
 * TEMPORARY admin endpoint — scope the R2 bucket's 7-day lifecycle rule to
 * the `temp/` prefix so permanent uploads (release covers, gallery) stop
 * being auto-deleted. DELETE THIS FILE once the rule is applied.
 *
 * Node runtime (not edge) — we need crypto MD5: S3 PutBucketLifecycle
 * requires a Content-MD5 header.
 *
 * Auth: requires `x-admin-token` header matching env ADMIN_TASK_TOKEN.
 * Body: { "action": "get" } → returns current lifecycle XML.
 *       { "action": "put" } → applies the scoped config, returns before/after.
 */
import type { IncomingMessage, ServerResponse } from 'http'
import { createHash } from 'crypto'
import { AwsClient } from 'aws4fetch'

const SCOPED_CONFIG = `<?xml version="1.0" encoding="UTF-8"?>
<LifecycleConfiguration>
  <Rule>
    <ID>expire-temp-7d</ID>
    <Filter><Prefix>temp/</Prefix></Filter>
    <Status>Enabled</Status>
    <Expiration><Days>7</Days></Expiration>
  </Rule>
  <Rule>
    <ID>abort-mpu-7d</ID>
    <Filter><Prefix></Prefix></Filter>
    <Status>Enabled</Status>
    <AbortIncompleteMultipartUpload><DaysAfterInitiation>7</DaysAfterInitiation></AbortIncompleteMultipartUpload>
  </Rule>
</LifecycleConfiguration>`

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

export default async function handler(req: IncomingMessage & { headers: Record<string, string | string[] | undefined> }, res: ServerResponse) {
  const send = (status: number, body: unknown) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }

  const adminToken = process.env.ADMIN_TASK_TOKEN
  const given = req.headers['x-admin-token']
  if (!adminToken || given !== adminToken) return send(403, { error: 'forbidden' })
  if (req.method !== 'POST') return send(405, { error: 'POST required' })

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  const bucket = process.env.CLOUDFLARE_R2_BUCKET
  if (!accountId || !accessKey || !secretKey || !bucket) return send(500, { error: 'R2 env missing' })

  let action = 'get'
  try { action = (JSON.parse(await readBody(req)) as { action?: string }).action ?? 'get' }
  catch { /* default get */ }

  const client = new AwsClient({ accessKeyId: accessKey, secretAccessKey: secretKey, service: 's3', region: 'auto' })
  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}?lifecycle`

  const getConfig = async () => {
    const r = await client.fetch(url, { method: 'GET' })
    return { status: r.status, body: await r.text() }
  }

  const before = await getConfig()
  if (action !== 'put') return send(200, { before })

  const md5 = createHash('md5').update(SCOPED_CONFIG).digest('base64')
  const putRes = await client.fetch(url, {
    method: 'PUT',
    headers: { 'Content-MD5': md5, 'Content-Type': 'application/xml' },
    body: SCOPED_CONFIG,
  })
  const putBody = await putRes.text()
  const after = await getConfig()
  return send(200, { before, put: { status: putRes.status, body: putBody }, after })
}
