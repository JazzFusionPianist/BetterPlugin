import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${process.env.GAMES_QA_URL || 'http://127.0.0.1:5191'}/piano.html`)
  await page.locator('[data-ready="true"]').waitFor()
  const result = await page.evaluate(() => window.pianoQA)
  for (const [index, expected] of [1.53, 1.21, .62].entries()) assert(Math.abs(result.size[index] - expected) < .003, `U1 dimension ${index}: ${result.size[index]}`)
  assert.equal(result.whiteKeys, 52); assert.equal(result.blackKeys, 36)
  assert.equal(result.pedals, 3); assert.equal(result.casters, 4)
  assert.deepEqual(errors, [])
  const out = new URL('../../artifacts/games-audit/', import.meta.url).pathname
  await mkdir(out, { recursive: true })
  await page.screenshot({ path: `${out}chess3d-u1-closeup.png` })
  console.log('U1 dimensions (within 3mm exterior detail tolerance), 88 keys, three pedals, four casters, rendered PBR room:', result)
} finally { await browser.close() }
