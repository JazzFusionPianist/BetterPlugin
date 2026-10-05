import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'

const source = readFileSync(new URL('../../apps/plugin/public/security-check.js', import.meta.url), 'utf8')
test('native challenge frames cannot navigate the app or call the privileged bridge', { skip: process.platform !== 'darwin' }, () => {
  const binary = join(mkdtempSync(join(tmpdir(), 'slur-web-security-')), 'test')
  const build = spawnSync('clang++', ['-std=c++17', '-fobjc-arc', '-framework', 'WebKit', '-framework', 'AppKit',
    fileURLToPath(new URL('../../Plugin/Tests/WebSecurityTest.mm', import.meta.url)), '-o', binary], { encoding: 'utf8' })
  assert.equal(build.status, 0, build.stderr)
  const result = spawnSync(binary, [], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
test('hosted challenge accepts only its bound parent and sends tokens over a private port', () => {
  const nonce = '12345678-1234-1234-1234-123456789abc'
  const parent = {}, listeners = new Map(), scripts = [], messages = []
  let callbacks
  const window = { addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: type => listeners.delete(type), turnstile: { render: (_, options) => { callbacks = options } } }
  vm.runInNewContext(source, { location: { hash: '#' + nonce }, parent, window,
    document: { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } } })
  const connect = listeners.get('message')
  const event = { source: parent, origin: 'null', data: { type: 'slur-security-check', nonce },
    ports: [{ postMessage: message => messages.push(message) }] }
  connect({ ...event, source: {} })
  connect({ ...event, origin: 'https://untrusted.example' })
  connect({ ...event, data: { ...event.data, nonce: 'wrong' } })
  assert.equal(scripts.length, 0)
  connect(event)
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0].src, 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')
  scripts[0].onload()
  callbacks.callback('synthetic-test-token')
  callbacks['expired-callback']()
  callbacks['error-callback']()
  assert.deepEqual(messages.map(message => message.type), ['ready', 'token', 'expired', 'error'])
  assert.equal(messages[1].token, 'synthetic-test-token')
  assert.equal(messages[0].nonce, nonce)
  assert.equal(listeners.has('message'), false)
  connect(event)
  assert.equal(scripts.length, 1)
})

test('only the challenge page permits plugin framing; app pages remain frame-denied', () => {
  const config = JSON.parse(readFileSync(new URL('../../apps/plugin/vercel.json', import.meta.url), 'utf8'))
  const app = config.headers.find(rule => rule.source.includes('(?!security-check'))
  assert.equal(app.headers.find(header => header.key === 'X-Frame-Options').value, 'DENY')
  const check = config.headers.find(rule => rule.source === '/security-check.html')
  const csp = check.headers.find(header => header.key === 'Content-Security-Policy').value
  assert.match(csp, /frame-ancestors juce:\/\/juce.backend https:\/\/juce.backend/)
  assert.match(csp, /form-action 'none'/)
  assert.doesNotMatch(source, /password|access_token|refresh_token/)
})
