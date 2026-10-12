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
  const bounds = await canvas.boundingBox()
  assert(bounds && bounds.width > 0 && bounds.height > 0, 'Canvas is framed before capture')
  const screenshot = await page.screenshot({ clip: bounds, animations: 'disabled', timeout: 60000 })
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
const projection = page => page.locator('[role="gridcell"]').evaluateAll(buttons => buttons.map(b => [Number(Number(b.dataset.screenX).toFixed(4)), Number(Number(b.dataset.screenY).toFixed(4))]))
async function assertBoardCentered(page) {
  const error = await page.locator('.chess3d-stage').evaluate(el => [
    Math.abs(Number(el.dataset.boardCenterX) - el.clientWidth / 2),
    Math.abs(Number(el.dataset.boardCenterY) - el.clientHeight / 2),
  ])
  assert(error.every(value => Number.isFinite(value) && value < .01), `Board/zoom pivot must be centered: ${error}`)
}
try {
  for (const platform of ['plugin', 'web']) {
    for (const size of sizes) {
      const page = await browser.newPage({ viewport: size })
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.addInitScript(() => {
        window.chessFogPrograms = 0
        window.chessPortableShadowPrograms = 0
        for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
          const shaderSource = context.prototype.shaderSource
          context.prototype.shaderSource = function(shader, source) {
            if (/^\s*#define USE_FOG\b/m.test(source)) window.chessFogPrograms++
            if (/^\s*#define SHADOWMAP_TYPE_BASIC\b/m.test(source) && source.includes('shadow /= 9.0;')) window.chessPortableShadowPrograms++
            return shaderSource.call(this, shader, source)
          }
        }
      })
      await page.goto(`${base}/?platform=${platform}&game=chess_3d&arcade=1`)
      await page.locator('.game-computer-btn').waitFor()
      await page.locator('canvas[data-chess3d]').waitFor()
      await page.locator('[data-room-ready="true"]').waitFor()
      assert.equal(await page.locator('.chess3d-stage').getAttribute('data-camera-mode'), 'lobby')
      assert(Math.abs(Number(await page.locator('.chess3d-stage').getAttribute('data-camera-distance')) - 34) < .001)
      assert.equal(await page.locator('.chess3d-stage').getAttribute('data-candle-turn'), '')
      await page.addInitScript(() => {
        window.chessSoundStarts = 0
        const start = AudioBufferSourceNode.prototype.start
        AudioBufferSourceNode.prototype.start = function(...args) { if (this.buffer?.duration > .01) window.chessSoundStarts++; return start.apply(this, args) }
      })
      await page.evaluate(() => {
        window.chessSoundStarts = 0
        const start = AudioBufferSourceNode.prototype.start
        AudioBufferSourceNode.prototype.start = function(...args) { if (this.buffer?.duration > .01) window.chessSoundStarts++; return start.apply(this, args) }
      })
      assert.equal(await page.locator('.game-finish-title').count(), 0, 'No oversized Chess(3d) title obstructs the lobby')
      await page.evaluate(() => document.fonts.ready)
      const buttons = await page.locator('.game-invite-btn').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node)
        return { color: style.color, background: style.backgroundColor, border: parseFloat(style.borderTopWidth) }
      }))
      const rgb = value => value.match(/[\d.]+/g).map(Number)
      const luminance = value => rgb(value).slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
      for (const button of buttons) {
        const fg = luminance(button.color), bg = luminance(button.background)
        assert((Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) >= 4.5, 'Lobby labels meet AA contrast')
        assert(rgb(button.background).length === 3 || rgb(button.background)[3] === 1, `Lobby buttons are opaque over furniture: ${JSON.stringify(button)}`)
      }
      assert.equal(buttons[1].border, 2)
      await page.evaluate(() => { window.initialChessCanvas = document.querySelector('canvas[data-chess3d]') })
      const lobbyPixels = await canvasPixels(page)
      assert.equal(await page.evaluate(() => window.chessFogPrograms), 0, 'Indoor darkness comes from lighting, not camera-distance fog')
      assert(await page.evaluate(() => window.chessPortableShadowPrograms > 0), 'Soft shadows use the portable depth comparison, not hardware shadow samplers')
      const lobbyCanvas = await page.locator('canvas[data-chess3d]').boundingBox()
      await page.mouse.move(lobbyCanvas.x + lobbyCanvas.width * .25, lobbyCanvas.y + lobbyCanvas.height * .7)
      await page.mouse.down()
      await page.mouse.move(lobbyCanvas.x + lobbyCanvas.width * .4, lobbyCanvas.y + lobbyCanvas.height * .8, { steps: 8 })
      await page.mouse.up()
      assert.notEqual((await canvasPixels(page)).hash, lobbyPixels.hash, 'Lobby supports orbit before starting a match')
      const lobbyRotated = await canvasPixels(page)
      await page.mouse.wheel(0, 250)
      await page.waitForTimeout(120)
      assert.notEqual((await canvasPixels(page)).hash, lobbyRotated.hash, 'Lobby supports wheel zoom')
      await page.locator('.chess3d-camera button').first().click()
      await page.screenshot({ path: `${out}${platform}-${size.width}x${size.height}-lobby.png` })
      await page.locator('.game-computer-btn').click()
      await page.getByRole('button', { name: 'Resign', exact: true }).waitFor()
      assert(await page.evaluate(() => window.initialChessCanvas === document.querySelector('canvas[data-chess3d]')), 'Starting a match preserves the loaded room instead of remounting it')
      await page.waitForTimeout(250)
      assert.equal(await page.locator('.chess3d-stage').getAttribute('data-camera-mode'), 'playing')
      assert(Math.abs(Number(await page.locator('.chess3d-stage').getAttribute('data-camera-distance')) - 23.5) < .001)
      assert.equal(await page.locator('.chess3d-stage').getAttribute('data-candle-turn'), 'near')
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
      assert.equal(await page.locator('.chess3d-camera button').count(), 5, 'Camera tools and the mute control appear in the toolbar')
      await page.getByRole('button', { name: 'Unmute', exact: true }).click()
      await page.waitForTimeout(300)
      assert.equal(await page.evaluate(() => window.chessSoundStarts), 0, 'No sound plays on entry or enabling audio')
      assert.equal(await page.locator('.chess3d-stage').getAttribute('data-piece-source'), 'poly-haven', 'Detailed CC0 meshes load successfully')
      assert(await page.locator('.chess3d-stage').getAttribute('data-opponent-label'), 'Computer name is shown on the chair')
      assert.equal(Number(await page.locator('.chess3d-stage').getAttribute('data-opponent-label-scale')), size.width <= 600 ? 1.6 : platform === 'plugin' ? 1.5 : 1, 'Compact screens and plugin enlarge the chair nameplate')
      await assertBoardCentered(page)
      await clickSquare(page, 'e2')
      assert.equal(await page.locator('.chess3d-stage').getAttribute('data-selected'), 'e2', 'Raycasting selects the clicked pawn')
      await clickSquare(page, 'e4')
      await page.waitForFunction(() => window.gamesQA.tables.get('game_rooms')[0].move_history.length >= 2)
      assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].board[4][4]), 'wP')
      assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].captured.presentation), '3d', 'Moves must preserve the variant')
      await page.waitForTimeout(300)
      assert.equal(await page.evaluate(() => window.chessSoundStarts), 2, 'One sampled placement for each actual player/computer move')
      await page.getByRole('button', { name: 'Mute', exact: true }).click()
      assert.equal(await page.evaluate(() => localStorage.getItem('slur.chess3d.sound')), 'off')
      const after = await canvasPixels(page)
      await page.screenshot({ path: `${out}${platform}-${size.width}x${size.height}-playing.png` })
      await clickSquare(page, 'b1')
      await clickSquare(page, 'c3')
      await page.waitForFunction(() => window.gamesQA.tables.get('game_rooms')[0].move_history.length >= 4)
      await page.waitForTimeout(300)
      assert.equal(await page.evaluate(() => window.chessSoundStarts), 2, 'Muted moves remain silent for both players')
      const defaultProjection = await projection(page)
      // Orbit and zoom change the whole room without making a chess move.
      const beforeMoves = await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].move_history.length)
      const canvas = await page.locator('canvas[data-chess3d]').boundingBox()
      await page.mouse.move(canvas.x + canvas.width * .5, canvas.y + canvas.height * .5)
      await page.mouse.down()
      await page.mouse.move(canvas.x + canvas.width * .65, canvas.y + canvas.height * .5, { steps: 8 })
      await page.mouse.up()
      assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].move_history.length), beforeMoves)
      await page.waitForTimeout(120)
      const rotated = await canvasPixels(page)
      assert.notEqual(rotated.hash, after.hash, 'Dragging rotates the real room')
      await assertBoardCentered(page)
      await page.mouse.wheel(0, 300)
      await page.waitForTimeout(120)
      assert.notEqual((await canvasPixels(page)).hash, rotated.hash, 'Wheel zooms the real room')
      await assertBoardCentered(page)
      assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].move_history.length), beforeMoves)
      await page.locator('.chess3d-camera button').first().click()
      await page.waitForFunction(expected => JSON.stringify([...document.querySelectorAll('[role="gridcell"]')].map(b => [Number(Number(b.dataset.screenX).toFixed(4)), Number(Number(b.dataset.screenY).toFixed(4))])) === JSON.stringify(expected), defaultProjection)
      assert.deepEqual(await projection(page), defaultProjection, 'Reset restores the room perspective')
      for (const index of [2, 3, 1, 0]) {
        await page.locator('.chess3d-camera button').nth(index).click()
        await page.waitForTimeout(80)
        await assertBoardCentered(page)
      }
      assert.equal(await page.getByRole('button', { name: 'Toggle lamp', exact: true }).count(), 0, 'Lamp is toggled directly in the room, not from the toolbar')
      if (size.width === 1200) {
        const scene = await page.locator('canvas[data-chess3d]').boundingBox()
        await page.mouse.move(scene.x + scene.width * .5, scene.y + scene.height * .75)
        await page.mouse.down()
        await page.mouse.move(scene.x + scene.width * .5, scene.y + scene.height * .2, { steps: 10 })
        await page.mouse.up()
        await page.mouse.wheel(0, 1600)
        await page.waitForTimeout(150)
        const lamp = await page.locator('.chess3d-stage').evaluate(el => ({ x: Number(el.dataset.lampX), y: Number(el.dataset.lampY) }))
        assert(lamp.x > 0 && lamp.x < scene.width && lamp.y > 0 && lamp.y < scene.height, 'Wall lamp is reachable by orbit/zoom')
        const lit = await canvasPixels(page)
        await page.mouse.click(scene.x + lamp.x, scene.y + lamp.y)
        assert.equal(await page.locator('.chess3d-stage').getAttribute('data-lamp-on'), 'false', 'Clicking the actual shade toggles the lamp')
        assert.notEqual((await canvasPixels(page)).hash, lit.hash, 'Physical lamp changes lighting/reflections')
        await page.mouse.click(scene.x + lamp.x, scene.y + lamp.y)
        assert.equal(await page.locator('.chess3d-stage').getAttribute('data-lamp-on'), 'true')
        const tableLamp = await page.locator('.chess3d-stage').evaluate(el => ({ x: Number(el.dataset.tableLampX), y: Number(el.dataset.tableLampY) }))
        assert(tableLamp.x > 0 && tableLamp.x < scene.width && tableLamp.y > 0 && tableLamp.y < scene.height)
        await page.mouse.click(scene.x + tableLamp.x, scene.y + tableLamp.y)
        assert.equal(await page.locator('.chess3d-stage').getAttribute('data-table-lamp-on'), 'false')
        assert.equal(await page.locator('.chess3d-stage').getAttribute('data-lamp-on'), 'true', 'Lamps toggle independently')
        await page.mouse.click(scene.x + tableLamp.x, scene.y + tableLamp.y)
        assert.equal(await page.locator('.chess3d-stage').getAttribute('data-table-lamp-on'), 'true')
        // Bring the uplight bowl away from the camera toolbar before clicking it.
        await page.mouse.move(scene.x + scene.width * .30, scene.y + scene.height * .65)
        await page.mouse.down()
        await page.mouse.move(scene.x + scene.width * .48, scene.y + scene.height * .65, { steps: 8 })
        await page.mouse.up()
        await page.waitForTimeout(100)
        const reader = await page.locator('.chess3d-stage').evaluate(el => ({ x: Number(el.dataset.readerLampX), y: Number(el.dataset.readerLampY) }))
        assert(reader.x > 0 && reader.x < scene.width && reader.y > 0 && reader.y < scene.height, 'Torchiere is reachable by orbiting the room')
        assert(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', { x: scene.x + reader.x, y: scene.y + reader.y }), 'The lamp click lands on the room, not a toolbar button')
        const readerLit = await canvasPixels(page)
        await page.mouse.click(scene.x + reader.x, scene.y + reader.y)
        assert.equal(await page.locator('.chess3d-stage').getAttribute('data-reader-lamp-on'), 'false')
        assert.equal(await page.locator('.chess3d-stage').getAttribute('data-lamp-on'), 'true')
        assert.equal(await page.locator('.chess3d-stage').getAttribute('data-table-lamp-on'), 'true')
        assert.notEqual((await canvasPixels(page)).hash, readerLit.hash, 'Task lighting and reflections change when the reading head is clicked')
        await page.mouse.click(scene.x + reader.x, scene.y + reader.y)
        assert.equal(await page.locator('.chess3d-stage').getAttribute('data-reader-lamp-on'), 'true')
        await page.locator('.chess3d-camera button').first().click()
      }
      assert.equal(await page.evaluate(() => window.gamesQA.tables.get('game_rooms')[0].move_history.length), beforeMoves)
      if (size.width === 600) {
        const resumedBoard = await page.locator('[role="gridcell"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
        const cameraDistance = Number(await page.locator('.chess3d-stage').getAttribute('data-camera-distance'))
        await page.evaluate(async () => {
          const room = window.gamesQA.tables.get('game_rooms')[0]
          await window.gamesQA.update('game_rooms', room.id, { host_color: 'black', guest_id: 'opponent' })
        })
        await page.waitForTimeout(100)
        assert(Math.abs(Number(await page.locator('.chess3d-stage').getAttribute('data-camera-distance')) - cameraDistance) < .001, 'Changing sides preserves the camera distance despite player-header resizing')
        await assertBoardCentered(page)
        await page.evaluate(() => window.gamesQA.reopen(true))
        await page.locator('canvas[data-chess3d]').waitFor()
        await page.locator('[data-room-ready="true"]').waitFor()
        await page.waitForFunction(expected => JSON.stringify([...document.querySelectorAll('[role="gridcell"]')].map(node => node.getAttribute('aria-label'))) === JSON.stringify(expected), resumedBoard)
        await page.waitForFunction(() => document.querySelector('[role="gridcell"]')?.dataset.screenX)
        await page.waitForTimeout(100)
        assert(Math.abs(Number(await page.locator('.chess3d-stage').getAttribute('data-camera-distance')) - cameraDistance) < .001, 'Resuming retains the default camera')
        await assertBoardCentered(page)
      }
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
      console.log(`${platform} ${size.width}x${size.height}: render/assets, framing, raycast, move/AI, orbit/zoom/reset, visibility passed`)
      await page.close()
    }
    const page = await browser.newPage({ viewport: { width: 600, height: 500 } })
    const heldTextures = []
    let releaseTextures = false
    await page.route(/chess-room3d\/.*\.webp/, route => releaseTextures ? route.continue() : heldTextures.push(route))
    await page.goto(`${base}/?platform=${platform}&game=chess_3d`, { waitUntil: 'domcontentloaded' })
    await page.locator('canvas[data-chess3d]').waitFor({ state: 'attached' })
    assert.equal(await page.locator('canvas[data-chess3d]').evaluate(el => getComputedStyle(el).visibility), 'hidden', 'No untextured room is exposed while maps load')
    releaseTextures = true
    await Promise.all(heldTextures.map(route => route.continue()))
    await page.locator('[data-room-ready="true"]').waitFor()
    assert.equal(await page.locator('canvas[data-chess3d]').evaluate(el => getComputedStyle(el).visibility), 'visible')
    await page.unroute(/chess-room3d\/.*\.webp/)
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
