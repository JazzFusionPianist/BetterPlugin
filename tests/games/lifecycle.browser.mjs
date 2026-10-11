import assert from 'node:assert/strict'
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const engine=process.env.GAMES_QA_ENGINE==='webkit'?webkit:chromium
const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})})
const base=process.env.GAMES_QA_URL??'http://127.0.0.1:5191'
try {
  for(const platform of ['plugin','web']) {
    const page=await browser.newPage({viewport:{width:390,height:844}})
    const errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    // Rejected termination must not make the UI pretend the server match ended.
    await page.goto(`${base}/?platform=${platform}&game=chess`)
    await page.locator('.game-computer-btn').click()
    await page.locator('.chess-board').waitFor()
    await page.evaluate(()=>window.gamesQA.failNext('game_rooms'))
    await page.getByRole('button',{name:'Resign',exact:true}).click()
    await page.locator('.et-confirm-danger').click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.evaluate(()=>window.gamesQA.tables.get('game_rooms')[0].status),'playing')
    await page.locator('.et-confirm-danger').click()
    await page.locator('[data-closed]').waitFor()
    assert.equal(await page.evaluate(()=>window.gamesQA.tables.get('game_rooms')[0].status),'finished')
    await page.evaluate(()=>window.gamesQA.reopen(true))
    await page.locator('.game-computer-btn').waitFor()
    // All available games have an in-game quit/resign control.
    const games=platform==='plugin'?['falling_blocks','poker','yacht','ear_training','pinball','orb_merge','sudoku','minesweeper','solitaire','connect4','gomoku','reversi']:['falling_blocks','poker','yacht','ear_training','pinball','orb_merge']
    for(const game of games) {
      await page.goto(`${base}/?platform=${platform}&game=${game}`)
      await page.locator('.game-computer-btn,.pb-start-btn').first().click()
      await page.waitForTimeout(350)
      const quit=page.locator('.game-row-controls .game-btn-danger')
      await quit.waitFor()
      await quit.click()
      if(await page.locator('.et-confirm-danger').count()) await page.locator('.et-confirm-danger').click()
      await page.waitForTimeout(200)
      assert(await page.locator('[data-closed],.game-finish-card').count(),`${platform}/${game}: quit must finish or close`)
    }
    // Computer Ear Training must not write fake user IDs to foreign-key columns.
    await page.goto(`${base}/?platform=${platform}&game=ear_training`)
    await page.locator('.game-computer-btn').click()
    await page.locator('.et-option').first().waitFor()
    assert.equal(await page.evaluate(()=>window.gamesQA.tables.get('ear_training_rooms')?.length??0),0)
    await page.locator('.et-option').first().click()
    await page.locator('.et-reveal').waitFor({timeout:6000})
    await page.waitForFunction(()=>document.querySelector('.et-round-label')?.textContent.includes('2'),{},{timeout:6000})
    await page.getByRole('button',{name:'Forfeit',exact:true}).click()
    await page.locator('.et-confirm-danger').click()
    await page.locator('[data-closed]').waitFor()
    // A remount may restore only the exact running match, never overwrite its board.
    await page.goto(`${base}/?platform=${platform}&game=falling_blocks&players=4`)
    await page.waitForFunction(()=>document.querySelectorAll('.falling-blocks-board').length===4)
    await page.waitForTimeout(200)
    await page.evaluate(()=>document.activeElement?.blur())
    await page.keyboard.press('Space')
    await page.waitForTimeout(500)
    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('slur.falling-blocks.session.v1:90000000-0000-4000-8000-000000000001')))
    assert(before.state.score>0)
    await page.evaluate(()=>window.gamesQA.reopen(true))
    await page.waitForTimeout(300)
    const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('slur.falling-blocks.session.v1:90000000-0000-4000-8000-000000000001')))
    assert.deepEqual(after.state.board,before.state.board,'resume must preserve locked blocks')
    assert.deepEqual(after.state.next,before.state.next,'resume must preserve upcoming blocks')
    assert.equal(after.state.score,before.state.score,'resume must preserve score')
    await page.evaluate(()=>window.gamesQA.reopen(false))
    await page.locator('.pb-start-btn').waitFor()
    assert.equal(await page.locator('.game-row-controls .game-btn-danger').count(),0,'fresh entry must stay in lobby even with an abandoned server room')
    assert.deepEqual(errors,[],`${platform}: runtime errors`)
    await page.close()
  }
  console.log('PASS: explicit resume, rejected/acknowledged quit, quit controls, local Ear Training answers/rounds, Falling Blocks snapshot preservation')
} finally {await browser.close()}
