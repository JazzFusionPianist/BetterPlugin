// Two isolated browser stores, synthetic relay and identities. No production access.
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})})
const requests=[],tables={chat_device_links:[],chat_passkey_vaults:[]},errors=[]
let identity=null
async function relay(request){
  requests.push(structuredClone(request))
  if(request.rpc){
    if(request.rpc==='my_chat_key')return {data:identity,error:null}
    assert.equal(request.rpc,'register_chat_key')
    const candidate={user_id:'00000000-0000-4000-8000-000000000001',box_key:request.args.p_box,sign_key:request.args.p_sign}
    if(identity)assert.deepEqual(candidate,identity)
    else identity=candidate
    return {data:null,error:null}
  }
  const {table,action,values,filters,single}=request
  assert.ok(Object.hasOwn(tables,table))
  const matches=row=>filters.every(({op,key,value})=>op==='eq'?row[key]===value:row[key]>value)
  let rows=tables[table].filter(matches)
  if(action==='insert'){
    const row={...values,response:null,expires_at:new Date(Date.now()+300000).toISOString()}
    tables[table].push(row);rows=[row]
  }else if(action==='update'){
    for(const row of rows)Object.assign(row,values)
  }else if(action==='delete')tables[table]=tables[table].filter(row=>!matches(row))
  return {data:structuredClone(single?rows[0]:rows),error:null}
}
try{
  const oldContext=await browser.newContext(),newContext=await browser.newContext()
  const old=await oldContext.newPage(),fresh=await newContext.newPage()
  for(const page of [old,fresh]){
    await page.exposeFunction('testRelay',relay)
    page.on('pageerror',e=>errors.push(e.message))
  }
  const url='http://127.0.0.1:5189/tests/device-relay.html'
  await old.goto(url)
  await old.waitForFunction(()=>window.testDeviceState==='ready')
  const envelope=await old.evaluate(()=>window.testSeal())
  await fresh.goto(url)
  await fresh.waitForFunction(()=>window.testDeviceState==='restore')
  assert.equal(await fresh.evaluate(async envelope=>{
    try{await window.testOpen(envelope);return true}catch{return false}
  },envelope),false)
  await fresh.getByRole('button',{name:'Use another device'}).click()
  await fresh.waitForFunction(()=>document.querySelector('output')?.textContent.length===22)
  const code=await fresh.locator('output').textContent()
  const input=old.getByRole('textbox',{name:'Connection code from your new device'})
  await input.fill('A'.repeat(22))
  await old.getByRole('button',{name:'Connect',exact:true}).click()
  await old.getByRole('alert').waitFor()
  assert.equal(tables.chat_device_links[0].response,null)
  await input.fill(code)
  await old.getByRole('button',{name:'Connect',exact:true}).click()
  await fresh.getByRole('main').filter({hasText:'Connected'}).waitFor()
  assert.equal((await fresh.evaluate(e=>window.testOpen(e),envelope)).content,'Private fixture history')
  assert.equal(tables.chat_device_links.length,0)
  await fresh.reload()
  await fresh.waitForFunction(()=>window.testDeviceState==='ready')
  assert.equal((await fresh.evaluate(e=>window.testOpen(e),envelope)).content,'Private fixture history')
  for(const page of [old,fresh])assert.equal(await page.evaluate(serialized=>window.testLeaks(serialized),JSON.stringify(requests)),false)
  assert.deepEqual(errors,[])
  console.log('Two isolated browser contexts: wrong code rejected; approval, encrypted history and reload passed. Relay never received the master secret.')
}finally{await browser.close()}
