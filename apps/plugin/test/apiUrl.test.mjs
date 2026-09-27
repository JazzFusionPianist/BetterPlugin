import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveApiUrl } from '../src/lib/apiUrl.ts'
test('carried AU/AAX pages route uploads and downloads to the production API', () => {
  for (const page of ['juce://juce.backend/index.html?carried=1', 'https://juce.backend/', 'file:///Slur/index.html'])
    for (const path of ['/api/r2-upload-url', '/api/r2-file-url'])
      assert.equal(resolveApiUrl(path, page), 'https://better-plugin.vercel.app' + path)
})
test('web and local dev pages keep their own same-origin backend', () => {
  for (const page of ['https://better-plugin.vercel.app/', 'http://127.0.0.1:5198/', 'https://preview.vercel.app/'])
    assert.equal(resolveApiUrl('/api/r2-upload-url', page), '/api/r2-upload-url')
  assert.throws(() => resolveApiUrl('//attacker.example', 'juce://juce.backend/'))
})
