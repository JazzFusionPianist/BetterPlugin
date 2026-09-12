#!/usr/bin/env node
/**
 * rescue-temp-files.mjs — move `temp/`-scoped R2 attachments to permanent
 * keys before the bucket's 7-day lifecycle rule deletes them, and point the
 * DB rows at the new location.
 *
 * What it does:
 *   1. SELECT messages.attachment_url and conversation_stems.file_url rows
 *      containing '/temp/' (via Supabase PostgREST).
 *   2. For every temp object URL found in the row (multi-audio messages
 *      store a JSON array of urls — each is handled):
 *        - S3 CopyObject  temp/<userId>/<file> → <userId>/<file>
 *          (same key minus the 'temp/' prefix)
 *        - HEAD the destination to verify the copy landed.
 *   3. UPDATE the DB row's URL ('/temp/' → '/') and its key column
 *      (messages.attachment_keys / conversation_stems.file_key — what
 *      the presign endpoint's membership probe matches on) to the
 *      rescued keys.
 *
 * Source temp/ objects are left in place — the lifecycle rule reaps them.
 *
 * Usage:
 *   node scripts/rescue-temp-files.mjs             # DRY RUN (default): log only
 *   node scripts/rescue-temp-files.mjs --execute   # actually copy + update
 *
 * Required env:
 *   SUPABASE_URL                      https://<ref>.supabase.co
 *   SUPABASE_SERVICE_KEY              service-role key (bypasses RLS; needed
 *                                     to read/update every row). If you don't
 *                                     want to handle the service key locally,
 *                                     the equivalent SELECT/UPDATE can be run
 *                                     through the Supabase Management API's
 *                                     /v1/projects/<ref>/database/query
 *                                     endpoint with a personal access token —
 *                                     but the R2 copies still need this script.
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_R2_ACCESS_KEY_ID
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY
 *   CLOUDFLARE_R2_BUCKET
 *
 * No npm deps — SigV4 is implemented with node:crypto.
 */

import { createHash, createHmac } from 'node:crypto'

// ── config ────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--execute')

const env = (name) => {
  const v = process.env[name]
  if (!v) {
    console.error(`missing env: ${name}`)
    process.exit(1)
  }
  return v
}

const SUPABASE_URL = env('SUPABASE_URL').replace(/\/$/, '')
const SERVICE_KEY = env('SUPABASE_SERVICE_KEY')
const ACCOUNT_ID = env('CLOUDFLARE_ACCOUNT_ID')
const R2_ACCESS_KEY = env('CLOUDFLARE_R2_ACCESS_KEY_ID')
const R2_SECRET_KEY = env('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
const BUCKET = env('CLOUDFLARE_R2_BUCKET')

const R2_HOST = `${ACCOUNT_ID}.r2.cloudflarestorage.com`

// ── SigV4 (S3, region "auto") ─────────────────────────────────────────

const sha256Hex = (data) => createHash('sha256').update(data).digest('hex')
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()
const EMPTY_HASH = sha256Hex('')

/** Encode one key for a URI path: RFC 3986, but keep '/'. Our keys are
 *  [A-Za-z0-9/_.-] so this is effectively identity — belt and braces. */
const encodeKeyPath = (key) =>
  key.split('/').map((s) => encodeURIComponent(s)).join('/')

/** Signed S3 request against R2. `extraHeaders` are included in signing. */
async function s3Request(method, key, extraHeaders = {}) {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const dateStamp = amzDate.slice(0, 8)
  const path = `/${BUCKET}/${encodeKeyPath(key)}`

  const headers = {
    host: R2_HOST,
    'x-amz-content-sha256': EMPTY_HASH,
    'x-amz-date': amzDate,
    ...Object.fromEntries(
      Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), v])),
  }
  const signedNames = Object.keys(headers).sort()
  const canonicalHeaders = signedNames.map((n) => `${n}:${String(headers[n]).trim()}\n`).join('')
  const signedHeaders = signedNames.join(';')

  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, EMPTY_HASH].join('\n')
  const scope = `${dateStamp}/auto/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n')

  const kDate = hmac(`AWS4${R2_SECRET_KEY}`, dateStamp)
  const kRegion = hmac(kDate, 'auto')
  const kService = hmac(kRegion, 's3')
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  const { host: _host, ...sendHeaders } = headers
  return fetch(`https://${R2_HOST}${path}`, {
    method,
    headers: { ...sendHeaders, authorization },
  })
}

/** CopyObject srcKey → destKey, then HEAD-verify the destination. */
async function copyAndVerify(srcKey, destKey) {
  const copyRes = await s3Request('PUT', destKey, {
    'x-amz-copy-source': `/${BUCKET}/${encodeKeyPath(srcKey)}`,
  })
  const copyBody = await copyRes.text()
  if (!copyRes.ok || copyBody.includes('<Error>')) {
    throw new Error(`CopyObject failed (${copyRes.status}): ${copyBody.slice(0, 300)}`)
  }
  const headRes = await s3Request('HEAD', destKey)
  if (!headRes.ok) {
    throw new Error(`HEAD verify failed (${headRes.status}) for ${destKey}`)
  }
  return Number(headRes.headers.get('content-length') ?? 0)
}

// ── Supabase PostgREST helpers ────────────────────────────────────────

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function sbSelect(table, urlColumn) {
  const rows = []
  const page = 1000
  for (let offset = 0; ; offset += page) {
    const q = `${SUPABASE_URL}/rest/v1/${table}` +
      `?select=id,${urlColumn}&${urlColumn}=like.*%2Ftemp%2F*` +
      `&order=id&limit=${page}&offset=${offset}`
    const res = await fetch(q, { headers: sbHeaders })
    if (!res.ok) throw new Error(`select ${table} failed (${res.status}): ${await res.text()}`)
    const batch = await res.json()
    rows.push(...batch)
    if (batch.length < page) break
  }
  return rows
}

async function sbUpdate(table, id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`update ${table} ${id} failed (${res.status}): ${await res.text()}`)
}

// ── the rescue ────────────────────────────────────────────────────────

/** All temp-object URLs inside a field (plain url, or the JSON array a
 *  multi-audio message stores). */
const TEMP_URL_RE = /https?:\/\/[^\s"',]+\/temp\/[A-Za-z0-9/_.\-]+/g

/** R2 object key from a public url: the pathname minus the leading '/'. */
const keyOf = (url) => decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))

/** Every R2 public url inside a field (plain url, or a multi-audio JSON
 *  array) — for rebuilding the row's key column after the rescue. */
const R2_URL_RE = /https?:\/\/[^\s"',]+\.r2\.dev\/[A-Za-z0-9/_.\-]+/g

async function rescueTable(table, urlColumn, keyPatch) {
  console.log(`\n── ${table}.${urlColumn} ──`)
  const rows = await sbSelect(table, urlColumn)
  console.log(`${rows.length} row(s) reference /temp/`)

  let copied = 0, updated = 0, failed = 0
  for (const row of rows) {
    const field = row[urlColumn]
    const tempUrls = [...new Set(field.match(TEMP_URL_RE) ?? [])]
    if (tempUrls.length === 0) {
      console.warn(`  [skip] ${table} ${row.id}: '/temp/' present but no parseable temp url`)
      continue
    }
    try {
      for (const url of tempUrls) {
        const srcKey = keyOf(url)
        if (!srcKey.startsWith('temp/')) {
          throw new Error(`unexpected key (no temp/ prefix): ${srcKey}`)
        }
        const destKey = srcKey.slice('temp/'.length)
        if (DRY_RUN) {
          console.log(`  [dry] would copy ${srcKey} -> ${destKey}`)
        } else {
          const size = await copyAndVerify(srcKey, destKey)
          copied++
          console.log(`  [ok]  copied ${srcKey} -> ${destKey} (${size} bytes)`)
        }
      }
      const newField = field.replaceAll('/temp/', '/')
      // Rescued rows also get their key column set (the presign
      // endpoint matches on keys, not url substrings).
      const patch = { [urlColumn]: newField, ...keyPatch(newField) }
      if (DRY_RUN) {
        console.log(`  [dry] would update ${table} ${row.id}: ${JSON.stringify(patch)}`)
      } else {
        await sbUpdate(table, row.id, patch)
        updated++
        console.log(`  [ok]  updated ${table} ${row.id}`)
      }
    } catch (err) {
      failed++
      console.error(`  [FAIL] ${table} ${row.id}: ${err.message}`)
    }
  }
  console.log(`${table}: ${copied} object(s) copied, ${updated} row(s) updated, ${failed} failure(s)`)
  return failed
}

console.log(DRY_RUN
  ? 'DRY RUN — nothing will be copied or updated (pass --execute to apply)'
  : 'EXECUTE — copying objects and updating rows')

let failures = 0
failures += await rescueTable('messages', 'attachment_url', (newField) => {
  // Plain url or multi-audio JSON array — every R2 url in the field.
  const keys = [...new Set((newField.match(R2_URL_RE) ?? []).map(keyOf))]
  return { attachment_keys: keys.length > 0 ? keys : null }
})
failures += await rescueTable('conversation_stems', 'file_url', (newField) => ({
  file_key: newField.match(R2_URL_RE) ? keyOf(newField) : null,
}))

if (failures > 0) {
  console.error(`\ndone with ${failures} failure(s) — those rows were left untouched`)
  process.exit(1)
}
console.log('\ndone')
