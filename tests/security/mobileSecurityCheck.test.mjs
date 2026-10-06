import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { needsHostedSecurityCheck } from '../../packages/core/lib/securityCheck.ts'

test('Android HTTPS WebView and iOS custom scheme both use a hosted challenge', () => {
  assert.equal(needsHostedSecurityCheck('https:', true), true)
  assert.equal(needsHostedSecurityCheck('capacitor:', true), true)
  assert.equal(needsHostedSecurityCheck('juce:', false), true)
  assert.equal(needsHostedSecurityCheck('https:', false), false)
  assert.equal(needsHostedSecurityCheck('http:', false), false)
})

test('native parents receive verified challenge tokens over their own message port', () => {
  const source = readFileSync(new URL('../../apps/plugin/public/security-check.js', import.meta.url), 'utf8')
  for (const origin of ['null', 'capacitor://localhost', 'http://localhost', 'https://localhost']) {
    const nonce = '12345678-1234-1234-1234-123456789abc'
    const parent = {}, listeners = new Map(), scripts = [], messages = []
    let widget
    const window = {
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener: type => listeners.delete(type),
      turnstile: { render: (_, options) => { widget = options } },
    }
    vm.runInNewContext(source, { location: { hash: '#' + nonce }, parent, window,
      console: { warn() {} },
      document: { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } } })
    const connect = listeners.get('message')
    const event = { source: parent, origin, data: { type: 'slur-security-check', nonce },
      ports: [{ postMessage: message => messages.push(message) }] }
    connect({ ...event, origin: 'https://localhost.evil.example' })
    connect({ ...event, source: {} })
    connect({ ...event, data: { ...event.data, nonce: 'wrong' } })
    assert.equal(scripts.length, 0)
    connect(event)
    assert.equal(scripts.length, 1)
    scripts[0].onload()
    assert.deepEqual(messages.map(message => message.type), ['ready'])
    widget.callback('test-only-token')
    assert.equal(messages.at(-1).token, 'test-only-token')
    assert.equal(messages.at(-1).nonce, nonce)
    widget['expired-callback']()
    assert.equal(messages.at(-1).type, 'expired')
    widget['error-callback']('200500')
    assert.equal(messages.at(-1).type, 'error')
    assert.equal(listeners.has('message'), false)
  }
})
