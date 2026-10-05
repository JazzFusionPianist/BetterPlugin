// Local, synthetic identities only. Does not use logged-in browser profiles.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})})
const out='/tmp/slur-device-connection-qa'
await mkdir(out,{recursive:true})
try{
  for(const width of [320,1100]){
    const page=await browser.newPage({viewport:{width,height:720}}),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.goto('http://127.0.0.1:5189/tests/device-connection.html')
    await page.getByRole('button',{name:'Use another device'}).click()
    await page.waitForFunction(()=>document.querySelector('output')?.textContent.length===22)
    const text=await page.locator('body').innerText()
    assert.ok(!/recovery|encrypt|private key/i.test(text))
    assert.equal(await page.evaluate(()=>document.body.innerText.includes(window.testMaster)),false)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    await page.screenshot({path:`${out}/connect-${width}.png`,fullPage:true})
    await page.goto('http://127.0.0.1:5189/tests/device-connection.html?mode=approve')
    const input=page.getByRole('textbox',{name:'Connection code from your new device'})
    await input.waitFor()
    assert.equal(await page.getByRole('button',{name:'Connect',exact:true}).isEnabled(),false)
    await input.fill(await page.evaluate(()=>window.testDeviceCode))
    assert.equal(await page.getByRole('button',{name:'Connect',exact:true}).isEnabled(),true)
    await page.screenshot({path:`${out}/approve-${width}.png`,fullPage:true})
    assert.deepEqual(errors,[])
    await page.goto('http://127.0.0.1:5189/tests/device-connection.html?mode=ready')
    await page.getByRole('main').filter({hasText:'Conversations'}).waitFor()
    assert.equal(await page.getByRole('region',{name:'Device sign-in'}).count(),0)
    await page.close()
  }
  console.log('Device connection UI: 320px and 1100px passed; no recovery secrets rendered.')
  for(const width of [320,1100]){
    const page=await browser.newPage({viewport:{width,height:720}})
    await page.clock.install()
    await page.goto('http://127.0.0.1:5189/tests/device-connection.html?mode=account')
    await page.getByRole('main').filter({hasText:'Conversations'}).waitFor()
    await page.evaluate(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('slur-device-sign-in'))})
    await page.clock.fastForward(31000)
    assert.deepEqual(await page.evaluate(()=>window.testAccountCalls),['security_check_session'])
    assert.equal(await page.getByRole('region',{name:'Device sign-in'}).count(),0)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    await page.screenshot({path:`${out}/account-${width}.png`,fullPage:true})
    await page.close()
  }
  console.log('Account chat UI: immediate access without keys, no enrollment on reconnect, session checks retained.')
  for(const width of [320,1100]){
    const page=await browser.newPage({viewport:{width,height:720}}),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    for(const [query,label,retry] of [
      ['','Waiting to send',true],['&reason=retry','Waiting for connection.',true],
      ['&state=blocked&reason=membership_changed','Conversation changed. Please send again.',false],
      ['&state=blocked&reason=invalid','Could not send. Please send again.',false],
      ['&state=expired','Not sent. Please send again.',false],
    ]){
      await page.goto(`http://127.0.0.1:5189/tests/device-connection.html?mode=pending${query}`)
      await page.getByRole('status').filter({hasText:label}).waitFor()
      assert.equal(await page.getByRole('button',{name:'Retry',exact:true}).count(),Number(retry))
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
      await page.getByRole('button',{name:'Cancel send'}).click()
      assert.equal(await page.getByRole('button',{name:'Cancel send'}).isDisabled(),true)
      await page.getByRole('status').filter({hasText:'Send cancelled.'}).waitFor()
      assert.equal(await page.evaluate(()=>window.testCancelCalls()),1)
      assert.equal(await page.getByRole('button').count(),0)
    }
    await page.goto('http://127.0.0.1:5189/tests/device-connection.html?mode=pending&result=delivered')
    await page.getByRole('button',{name:'Cancel send'}).click()
    await page.getByRole('status').filter({hasText:'Already sent.'}).waitFor()
    await page.goto('http://127.0.0.1:5189/tests/device-connection.html?mode=pending&result=error')
    await page.getByRole('button',{name:'Cancel send'}).click()
    await page.getByRole('status').filter({hasText:'Could not confirm cancellation. Try again.'}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Cancel send'}).isEnabled(),true)
    await page.screenshot({path:`${out}/pending-${width}.png`,fullPage:true})
    assert.deepEqual(errors,[])
    await page.close()
  }
  console.log('Pending delivery UI: states, cancellation, lost-response notice and 320/1100px layouts passed.')
  const page=await browser.newPage()
  // Intercept a synthetic HTTPS origin; all content comes from the local test server.
  await page.route('https://slur.example/**',async route=>{
    const target=new URL(route.request().url())
    const response=await page.request.get(`http://127.0.0.1:5189${target.pathname}${target.search}`)
    await route.fulfill({response})
  })
  const cdp=await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',ctap2Version:'ctap2_1',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true,hasPrf:true}})
  await page.goto('https://slur.example/tests/device-connection.html')
  await page.waitForFunction(()=>typeof window.testPasskey==='function')
  assert.deepEqual(await page.evaluate(()=>window.testPasskey()),{restored:true,leaked:false})
  console.log('Chromium virtual WebAuthn PRF: create, wrap and restore passed. Physical passkeys not tested.')
}finally{await browser.close()}
