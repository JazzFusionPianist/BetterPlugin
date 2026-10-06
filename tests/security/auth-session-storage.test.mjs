import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { authStorageKey, createAuthSessionStorage } from '../../packages/core/lib/authSessionStorage.ts'

const { createClient } = createRequire(new URL('../../apps/web/package.json', import.meta.url))('@supabase/supabase-js')
const backend = () => {
  const data = new Map()
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}

test('preserves existing SDK storage keys and saved sign-ins on upgrade', () => {
  const key = authStorageKey('https://project.supabase.co')
  assert.equal(key, 'sb-project-auth-token')
  const disk = backend()
  disk.setItem(key, 'existing-session')
  const adapter = createAuthSessionStorage(key, () => disk)
  assert.equal(adapter.getRememberMe(), true)
  assert.equal(adapter.storage.getItem(key), 'existing-session')
})

test('unchecking removes durable session, user, and PKCE copies without touching unrelated data', () => {
  const disk = backend(), key = 'test-auth'
  const keys = [key, `${key}-user`, `${key}-code-verifier`]
  keys.forEach(key => disk.setItem(key, key))
  disk.setItem('chat-device-key', 'unchanged')
  const adapter = createAuthSessionStorage(key, () => disk)
  adapter.setRememberMe(false)
  for (const key of keys) {
    assert.equal(disk.getItem(key), null)
    assert.equal(adapter.storage.getItem(key), key)
  }
  adapter.storage.setItem(key, 'refreshed-temporary-session')
  assert.equal(disk.getItem(key), null)
  const reopened = createAuthSessionStorage(key, () => disk)
  assert.equal(reopened.getRememberMe(), false)
  assert.equal(reopened.storage.getItem(key), null)
  assert.equal(disk.getItem('chat-device-key'), 'unchanged')
  adapter.setRememberMe(true)
  assert.equal(disk.getItem(key), 'refreshed-temporary-session')
  adapter.storage.removeItem(key)
  assert.equal(disk.getItem(key), null)
  assert.equal(adapter.storage.getItem(key), null)
})

test('works without browser storage and fails login safely when durable erasure is denied', () => {
  const adapter = createAuthSessionStorage('test', () => undefined)
  adapter.setRememberMe(false)
  adapter.storage.setItem('test', 'temporary')
  assert.equal(adapter.storage.getItem('test'), 'temporary')
  const disk = backend()
  disk.setItem('test', 'saved')
  const denied = createAuthSessionStorage('test', () => ({ ...disk, removeItem() { throw new Error('denied') } }))
  assert.throws(() => denied.setRememberMe(false), /denied/)
})

for (const remembered of [true, false]) {
  test(`Supabase password sign-in, token refresh, reopen, and sign-out (remember=${remembered})`, async () => {
    const disk = backend(), key = `sdk-test-${remembered}`
    let serial = 0
    const fetch = async (url, options = {}) => {
      if (String(url).includes('/logout')) return new Response('{}', { status: 200 })
      assert.match(String(url), /\/auth\/v1\/token\?grant_type=(password|refresh_token)$/)
      const body = JSON.parse(options.body)
      if (String(url).endsWith('password')) assert.equal(body.password, 'test-only-password')
      else assert.match(body.refresh_token, /^test-only-refresh-/)
      serial += 1
      const claims = { sub: 'test-user', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }
      const token = `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.test-only-signature`
      return new Response(JSON.stringify({ access_token: token, refresh_token: `test-only-refresh-${serial}`,
        token_type: 'bearer', expires_in: 3600, user: { id: 'test-user', aud: 'authenticated', email: 'test@example.invalid' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    const client = adapter => createClient('https://project.supabase.co', 'test-only-public-key', {
      auth: { storageKey: key, storage: adapter.storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
    })
    const adapter = createAuthSessionStorage(key, () => disk), original = client(adapter)
    await original.auth.getSession()
    adapter.setRememberMe(remembered)
    const login = await original.auth.signInWithPassword({ email: 'test@example.invalid', password: 'test-only-password' })
    assert.equal(login.error, null)
    const refresh = await original.auth.refreshSession()
    assert.equal(refresh.error, null)
    assert.equal(refresh.data.session.refresh_token, 'test-only-refresh-2')
    assert.equal(Boolean(disk.getItem(key)), remembered)
    const reopened = client(createAuthSessionStorage(key, () => disk))
    assert.equal(Boolean((await reopened.auth.getSession()).data.session), remembered)
    assert.equal((await original.auth.signOut()).error, null)
    assert.equal(disk.getItem(key), null)
    assert.equal((await original.auth.getSession()).data.session, null)
    original.auth.stopAutoRefresh()
    reopened.auth.stopAutoRefresh()
  })
}
