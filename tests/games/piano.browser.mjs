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
  const { initialLights, unlitLights, nearTurn, farTurn } = result.lighting
  assert(initialLights[0].position[0] < -7 && initialLights[0].position[2] < -28, 'Wall light follows the installed model, not its origin')
  assert(initialLights[1].position[0] < -17 && initialLights[1].position[2] < -21, 'Table light follows the moved table and actual bulb')
  assert(initialLights[2].position[0] > 6 && initialLights[2].position[2] > 3)
  assert(initialLights[3].position[0] < -6 && initialLights[3].position[2] < -3)
  assert.equal(unlitLights[0].intensity, 0); assert.equal(unlitLights[1].intensity, 0)
  assert(nearTurn[2].intensity > 0); assert.equal(nearTurn[3].intensity, 0)
  assert(farTurn[3].intensity > 0); assert.equal(farTurn[2].intensity, 0)
  for (const [index, expected] of [1.53, 1.21, .62].entries()) assert(Math.abs(result.size[index] - expected) < .003, `Piano room-fit dimension ${index}: ${result.size[index]}`)
  assert.equal(result.whiteKeys, 52); assert.equal(result.blackKeys, 36)
  assert.equal(result.pedals, 3); assert.equal(result.casters, 4)
  assert(result.blackKeyHeight > .013 && result.blackKeyHeight < .017)
  assert.equal(result.pianoX, 12.5); assert.equal(result.benchX, result.pianoX)
  assert.equal(result.externalPiano, false, 'Only the original Slur piano is rendered')
  assert.equal(result.chairX, 0, 'Opponent chair is aligned with the board')
  for (const [index, expected] of [.65, .49, .35].entries()) assert(Math.abs(result.benchSize[index] - expected) < .003, `Bench dimension ${index}: ${result.benchSize[index]}`)
  assert.deepEqual(errors, [])
  const out = new URL('../../artifacts/games-audit/', import.meta.url).pathname
  await mkdir(out, { recursive: true })
  await page.screenshot({ path: `${out}chess3d-u1-closeup.png` })
  await page.goto(`${process.env.GAMES_QA_URL || 'http://127.0.0.1:5191'}/piano.html?view=room`)
  await page.locator('[data-ready="true"]').waitFor()
  await page.screenshot({ path: `${out}chess3d-room-furniture.png` })
  console.log('Original Slur piano dimensions, 88 keys, detailed pedals and furniture placement:', result)
} finally { await browser.close() }
