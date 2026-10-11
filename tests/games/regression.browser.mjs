import assert from 'node:assert/strict'
const {chromium,webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')

const engine=process.env.GAMES_QA_ENGINE==='webkit'?webkit:chromium
const browser = await engine.launch({headless:true,...(engine===chromium&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})})
const base = process.env.GAMES_QA_URL ?? 'http://127.0.0.1:5191'
async function checkLabelsAndContrast(page, expected) {
  const labels=await page.locator('.game-row-controls button').allTextContents()
  for(const label of expected) assert(labels.includes(label),`missing button label: ${label}`)
  const failures=await page.locator('.game-row-controls .game-btn-danger').evaluateAll(buttons=>{
    const luminance=color=>{
      const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{
        const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4
      })
      return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722
    }
    return buttons.flatMap(button=>{
      const s=getComputedStyle(button),a=luminance(s.color),b=luminance(s.backgroundColor)
      const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05)
      return ratio<4.5?[{label:button.textContent,ratio}]:[]
    })
  })
  assert.deepEqual(failures,[],'danger button contrast must reach 4.5:1')
}
try {
  for (const platform of ['plugin','web']) {
    const page = await browser.newPage({viewport:{width:600,height:500}})
    const errors = []
    page.on('pageerror',e=>errors.push(e.message))
    for (const game of ['pinball','falling_blocks']) {
      await page.goto(`${base}/?platform=${platform}&game=${game}&arcade=1`)
      await page.locator('.pb-start-btn,.game-computer-btn').first().click()
      await page.waitForTimeout(300)
      if(game==='falling_blocks') await checkLabelsAndContrast(page,['Quit','Reset'])
      // Hidden panes must not cancel keys intended for the other screen.
      await page.evaluate(()=>window.gamesQA.hide(true))
      await page.waitForTimeout(100)
      const cancelled = await page.evaluate(()=>{
        document.activeElement?.blur()
        const keys=['ArrowLeft','ArrowDown',' ','Enter']
        return keys.filter(key=>!window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})))
      })
      assert.deepEqual(cancelled,[],`${platform}/${game}: hidden keyboard capture`)
      await page.evaluate(()=>window.gamesQA.hide(false))
      await page.waitForTimeout(100)
      assert.equal(await page.locator('.game-view').count(),1)
      if(game==='pinball') {
        const hash=()=>page.locator('canvas').evaluate(el=>{
          const pixels=el.getContext('2d').getImageData(0,0,el.width,el.height).data
          let hash=0;for(let i=0;i<pixels.length;i+=7)hash=(hash*31+pixels[i])>>>0;return hash
        })
        const before=await hash()
        await page.keyboard.down('ArrowDown')
        await page.waitForTimeout(300)
        await page.keyboard.up('ArrowDown')
        await page.waitForTimeout(200)
        assert.notEqual(await hash(),before,'pinball canvas must respond to controls')
      }
    }
    await page.goto(`${base}/?platform=${platform}&game=chess&arcade=1`)
    await page.locator('.game-computer-btn').click()
    await page.waitForTimeout(300)
    for (const viewport of [{width:1200,height:800},{width:600,height:500},{width:390,height:844}]) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(150)
      const board = await page.locator('.chess-board').boundingBox()
      assert(board && Math.abs(board.width-board.height)<2,'chess must stay square')
      assert(board.width>120,'chess must not collapse in compact panes')
      assert(board.y>=0 && board.y+board.height<=viewport.height+1,'chess must fit vertically')
      assert.equal(await page.locator('.game-computer-btn').count(),0,'resize must not reset the room')
      await checkLabelsAndContrast(page,['Resign','Draw'])
    }
    assert.deepEqual(errors,[],`${platform}: browser errors`)
    // Three opponents must retain complete, proportional boards in a compact pane.
    await page.goto(`${base}/?platform=${platform}&game=falling_blocks&players=4&arcade=1`)
    await page.waitForFunction(()=>document.querySelectorAll('.falling-blocks-board').length===4)
    for(const viewport of [{width:300,height:500},{width:600,height:500},{width:1200,height:800},{width:844,height:390}]) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(300)
      const boards=await page.locator('.falling-blocks-board').evaluateAll(es=>es.map(e=>{
        const r=e.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right}
      }))
      assert.equal(boards.length,4,`${platform}: three opponents`)
      for(const board of boards) {
        assert(board.width>15,`${platform}: collapsed falling blocks board`)
        assert(Math.abs(board.height/board.width-2)<.15,`${platform}: distorted falling blocks board`)
        assert(board.left>=0 && board.right<=viewport.width,`${platform}: clipped falling blocks board`)
      }
    }
    // Force the local player's turn through the mock realtime transport.
    // This avoids depending on a random sequence of computer decisions.
    await page.goto(`${base}/?platform=${platform}&game=poker&arcade=1`)
    await page.locator('.game-computer-count').last().click()
    await page.locator('.game-computer-btn').click()
    await page.waitForFunction(()=>window.gamesQA.tables.get('poker_rooms')?.some(r=>r.status==='playing'))
    await page.evaluate(async()=>{
      const row=window.gamesQA.tables.get('poker_rooms')[0]
      await window.gamesQA.update('poker_rooms',row.id,{
        host_id:'other-host',
        state:{...row.state,current_player_index:row.player_ids.indexOf('90000000-0000-4000-8000-000000000001')},
      })
    })
    await page.locator('.poker-actions').waitFor()
    for(const viewport of [{width:300,height:500},{width:600,height:500},{width:1200,height:800},{width:844,height:390}]) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(150)
      for(const selector of ['.poker-actions','.poker-raise-controls']) {
        await page.locator(selector).evaluate(el=>el.scrollIntoView({block:'nearest'}))
        const actions=await page.locator(selector).boundingBox()
        assert(actions && actions.x>=0 && actions.x+actions.width<=viewport.width+1,`${platform}: poker controls must fit horizontally`)
        assert(actions.y>=0 && actions.y+actions.height<=viewport.height+1,`${platform}: poker controls must be reachable vertically`)
        const chat=await page.locator('.game-chat-inputrow').boundingBox()
        assert(chat && chat.y>=0 && chat.y+chat.height<=viewport.height+1,'scrolling poker must not move the chat offscreen')
      }
    }
    assert.deepEqual(errors,[],`${platform}: runtime errors`)
    await page.close()
  }
  const page = await browser.newPage({viewport:{width:300,height:500}})
  await page.addInitScript(()=>localStorage.setItem('orb_ms_diff','obsolete'))
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`${base}/?platform=plugin&game=minesweeper`)
  await page.locator('.pb-start-btn').waitFor()
  assert.deepEqual(errors,[],'invalid stored difficulty must not crash')
  await page.locator('.game-computer-count').last().click()
  await page.locator('.pb-start-btn').click()
  await page.waitForTimeout(150)
  const firstCell=await page.locator('.ms-cell').first().boundingBox()
  assert(firstCell && firstCell.x>=0,'the first hard-board column must be reachable')
  await page.goto(`${base}/?game=chat`)
  await page.locator('[data-chat]').waitFor()
  await page.evaluate(()=>{
    window.gamesQA.tables.set('game_chats',Array.from({length:120},(_,i)=>({id:`m${i}`,content:`Message ${i}`,room_id:'A',sender_id:'other',created_at:new Date(1700000000000+i*60000).toISOString()})))
    window.gamesQA.room('B')
  })
  await page.waitForTimeout(50)
  await page.evaluate(()=>window.gamesQA.room('A'))
  await page.waitForFunction(()=>window.gamesQA.chat.messages.length===80)
  assert.equal(await page.locator('[data-message]').first().textContent(),'Message 40')
  assert.equal(await page.locator('[data-message]').last().textContent(),'Message 119')
  await page.evaluate(()=>window.gamesQA.insert('Realtime message'))
  await page.waitForFunction(()=>window.gamesQA.chat.messages.at(-1)?.content==='Realtime message')
  assert.equal(await page.locator('[data-message]').count(),80,'bounded realtime history')
  assert(await page.locator('[data-chat]').evaluate(el=>el.scrollTop>0),'new messages scroll only the chat')
  await page.locator('[data-chat]').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'))})
  await page.evaluate(()=>window.gamesQA.insert('Leave scroll position alone'))
  await page.waitForFunction(()=>window.gamesQA.chat.messages.at(-1)?.content==='Leave scroll position alone')
  assert.equal(await page.locator('[data-chat]').evaluate(el=>el.scrollTop),0,'reading older messages must not jump')
  await page.evaluate(()=>window.gamesQA.room('B'))
  await page.waitForFunction(()=>window.gamesQA.chat.messages.length===0)
  await page.evaluate(()=>window.gamesQA.insert('Old room','A'))
  await page.waitForTimeout(100)
  assert.equal(await page.locator('[data-message]').count(),0,'room subscriptions must not leak')
  await page.close()
  console.log('PASS: button labels and contrast, hidden input, canvas interaction, resizing, four-player layout, poker actions, hard minesweeper, stored settings, latest chat history, bounded realtime, scroll and room isolation')
} finally {await browser.close()}
