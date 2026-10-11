import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { default: sharp } = await import(process.env.SHARP_MODULE || 'sharp')
const engine = process.env.GAMES_QA_ENGINE === 'webkit' ? webkit : chromium
const browser = await engine.launch({ headless: true, ...(engine === chromium ? {
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
} : {}) })
const base = process.env.GAMES_QA_URL || 'http://127.0.0.1:5191'
const out = new URL(`../../artifacts/games-audit/chess3d-${engine === webkit ? 'webkit' : 'chromium'}/`, import.meta.url).pathname
await mkdir(out, { recursive: true })
const records = []
const sizes = [{ width: 300, height: 500 }, { width: 600, height: 500 }, { width: 1200, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]
const hash = buffer => createHash('sha256').update(buffer).digest('hex')
async function canvasPixels(page) {
  const canvas = page.locator('canvas[data-chess3d]')
  const screenshot = await canvas.screenshot()
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const colors = new Set()
  for (let i = 0; i < data.length; i += info.channels * 17) colors.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`)
  assert(colors.size > 30, `Nonblank 3D scene expected, got ${colors.size} colors`)
  return { width: info.width, height: info.height, colors: colors.size, hash: hash(screenshot) }
}
async function clickSquare(page, square) {
  const target = page.getByRole('gridcell', { name: new RegExp(`^${square}( |$)`) })
  const point = await target.evaluate(el => ({ x: Number(el.dataset.screenX), y: Number(el.dataset.screenY) }))
  const canvas = await page.locator('canvas[data-chess3d]').boundingBox()
  await page.mouse.click(canvas.x + point.x, canvas.y + point.y)
}
try {
  for (const platform of ['plugin', 'web']) {
    for (const size of sizes) {
      const page = await browser.newPage({ viewport: size })
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(`${base}/?platform=${platform}&game=chess_3d&arcade=1`)
      await page.locator('.game-computer-btn').waitFor()
      await page.locator('canvas[data-chess3d]').waitFor()
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: `${out}${platform}-${size.width}x${size.height}-lobby.png` })
      await page.locator('.game-computer-btn').click()
      await page.getByRole('button', { name: 'Resign', exact: true }).waitFor()
      await page.waitForTimeout(250)
      assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].captured.presentation), '3d')
      const first = await canvasPixels(page)
      const framing = await page.locator('.chess3d-stage').evaluate(el => {
        const bounds = el.getBoundingClientRect()
        return { width: bounds.width, height: bounds.height, outside: [...el.querySelectorAll('[role="gridcell"]')].filter(button => {
          const x = Number(button.dataset.screenX), y = Number(button.dataset.screenY)
          return x < 0 || y < 0 || x > bounds.width || y > bounds.height
        }).length, overflow: document.documentElement.scrollWidth - innerWidth }
      })
      assert(framing.height > 130 && framing.width > 150, `${platform}: scene must retain usable space`)
      assert.equal(framing.outside, 0, `${platform}: all squares must be framed`)
      assert.equal(framing.overflow, 0)
      await page.getByRole('button', { name: 'Top view', exact: true }).click()
      await page.waitForTimeout(80)
      assert.notEqual((await canvasPixels(page)).hash, first.hash, 'Camera action must change pixels')
      await clickSquare(page, 'e2')
      assert.equal(await page.locator('.chess3d-stage').getAttribute('data-selected'), 'e2', 'Raycasting selects the clicked pawn')
      await clickSquare(page, 'e4')
      await page.waitForFunction(() => window.gamesQA.tables.get('game_rooms')[0].move_history.length >= 2)
      assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].board[4][4]), 'wP')
      assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].captured.presentation), '3d', 'Moves must preserve the variant')
      await page.getByRole('button', { name: 'Reset camera', exact: true }).click()
      await page.waitForTimeout(300)
      const after = await canvasPixels(page)
      await page.screenshot({ path: `${out}${platform}-${size.width}x${size.height}-playing.png` })
      // Camera gestures must not turn into a chess move.
      const beforeMoves = await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].move_history.length)
      const canvas = await page.locator('canvas[data-chess3d]').boundingBox()
      await page.mouse.move(canvas.x + canvas.width * .5, canvas.y + canvas.height * .5)
      await page.mouse.down()
      await page.mouse.move(canvas.x + canvas.width * .65, canvas.y + canvas.height * .5, { steps: 8 })
      await page.mouse.up()
      assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].move_history.length), beforeMoves)
      assert.notEqual((await canvasPixels(page)).hash, after.hash, 'Orbit drag must update the scene')
      await page.evaluate(() => window.gamesQA.hide(true))
      await page.locator('#outside-input').fill('outside')
      await page.keyboard.press('ArrowLeft')
      await page.evaluate(() => window.gamesQA.hide(false))
      await page.locator('canvas[data-chess3d]').waitFor()
      if (size.width === 390) {
        await page.evaluate(() => window.gamesQA.failNext('game_rooms'))
        await page.getByRole('button', { name: 'Resign', exact: true }).click()
        await page.locator('.et-confirm-danger').click()
        await page.getByRole('alert').waitFor()
        assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].status), 'playing')
        await page.locator('.et-confirm-danger').click()
        await page.locator('[data-closed]').waitFor()
        await page.evaluate(() => window.gamesQA.reopen(true))
        await page.locator('.game-computer-btn').waitFor()
        assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].status), 'finished')
      }
      assert.deepEqual(errors, [])
      records.push({ platform, size, framing, pixels: first, moved: after })
      console.log(`${platform} ${size.width}x${size.height}: render, framing, raycast, move/AI, camera, visibility passed`)
      await page.close()
    }
    const page = await browser.newPage({ viewport: { width: 600, height: 500 } })
    await page.goto(`${base}/?platform=${platform}&game=chess_3d`)
    await page.getByRole('button', { name: 'Invite a friend', exact: true }).click()
    await page.locator('.game-invite-do-btn').first().click()
    await page.waitForFunction(() => window.gamesQA.tables.get('notifications')?.length)
    assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].captured.presentation), '3d')
    assert.equal(await page.evaluate(() => window.gamesQA.tables.get('notifications')[0].metadata.game_type), 'chess_3d')
    await page.locator('.game-invite-modal-close').click()
    const helperResults = await page.evaluate(async platform => {
      const path = platform === 'plugin' ? 'apps/plugin/src/lib/gameRooms.ts' : 'apps/web/lib/games/gameRooms.ts'
      const helpers = await import(`/@fs/Users/jasonpark/Documents/Coding/BetterPlugin/Community/${path}`)
      const qa = window.gamesQA, user = '90000000-0000-4000-8000-000000000001'
      const roomId = await helpers.createGameRoom(qa.transport, 'chess_3d', user)
      const room = qa.tables.get('game_rooms').find(r => r.id === roomId)
      const capacity = await helpers.getRoomCapacity(qa.transport, 'chess_3d', roomId)
      const joined = await helpers.joinGameRoom(qa.transport, 'chess_3d', roomId, 'guest')
      await qa.update('game_rooms', roomId, { status: 'playing', updated_at: '2099-01-01' })
      const active = await helpers.findActiveGame(qa.transport, user)
      return { presentation: room.captured.presentation, type: room.game_type, capacity, active, joined, guest: room.guest_id }
    }, platform)
    assert.equal(helperResults.presentation, '3d')
    assert.equal(helperResults.type, 'chess')
    assert.equal(helperResults.active.gameType, 'chess_3d')
    assert.equal(helperResults.capacity.capacity, 2)
    assert.equal(helperResults.guest, 'guest')
    await page.close()
    // WebGL absence must leave a playable 2D fallback, not a blank screen.
    const fallback = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await fallback.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type.includes('webgl') ? null : getContext.call(this, type, ...args)
      }
    })
    await fallback.goto(`${base}/?platform=${platform}&game=chess_3d`)
    await fallback.locator('.game-computer-btn').click()
    await fallback.locator('.chess3d-fallback .chess-board').waitFor()
    await fallback.screenshot({ path: `${out}${platform}-fallback.png` })
    await fallback.close()
    console.log(`${platform}: invite, create/resume helpers and WebGL fallback passed`)
  }
} finally {
  await writeFile(`${out}report.json`, JSON.stringify(records, null, 2))
  await browser.close()
}
