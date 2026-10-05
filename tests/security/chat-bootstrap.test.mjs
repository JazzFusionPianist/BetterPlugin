import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createChatBootstrap } from '../../packages/core/lib/chatBootstrap.ts'

function fixture(overrides={}){
  const events=[]
  let stored=null
  const operations={
    unlocked:()=>false,
    assertCurrent:async()=>{},
    registered:async()=>false,
    load:async()=>stored,
    create:async()=>{events.push('create');return 'candidate'},
    ensure:async(_user,code)=>{events.push('persist');stored??=code;return stored},
    unlock:async(_user,code)=>{events.push('register');assert.equal(stored,code)},
    ...overrides,
  }
  return {events,operations,prepare:createChatBootstrap(operations)}
}

test('new conversations prepare silently only after a durable key is available',async()=>{
  const f=fixture()
  assert.equal(await f.prepare('user'),'ready')
  assert.deepEqual(f.events,['create','persist','register'])
})

test('React remounts share one preparation',async()=>{
  const f=fixture()
  const first=f.prepare('user'),second=f.prepare('user')
  assert.equal(first,second)
  assert.deepEqual(await Promise.all([first,second]),['ready','ready'])
  assert.equal(f.events.filter(e=>e==='create').length,1)
})

test('storage failure never registers a public identity and can be retried',async()=>{
  const f=fixture({ensure:async()=>{throw new Error('keychain unavailable')}})
  await assert.rejects(f.prepare('user'),/keychain/)
  assert.ok(!f.events.includes('register'))
  await assert.rejects(f.prepare('user'))
  assert.equal(f.events.filter(e=>e==='create').length,2)
})

test('failed readback cannot create unrecoverable messages',async()=>{
  const f=fixture({load:async()=>null})
  await assert.rejects(f.prepare('user'),/verified/)
  assert.ok(!f.events.includes('register'))
})

test('existing identity without a local key is never replaced',async()=>{
  const f=fixture({registered:async()=>true})
  assert.equal(await f.prepare('user'),'restore')
  assert.deepEqual(f.events,[])
})

test('pending and registered identities reuse the durable key',async()=>{
  for(const registered of [false,true]){
    const f=fixture({registered:async()=>registered,load:async()=> 'saved',unlock:async(user,code)=>{
      assert.equal(user,'user');assert.equal(code,'saved')
    }})
    assert.equal(await f.prepare('user'),'ready')
    assert.deepEqual(f.events,[])
  }
})

test('concurrent windows use the insert winner, not their generated candidate',async()=>{
  let stored=null
  const f=fixture({
    load:async()=>stored,
    ensure:async()=>{stored='other-window';return stored},
    unlock:async(_user,code)=>assert.equal(code,'other-window'),
  })
  assert.equal(await f.prepare('user'),'ready')
})

test('account changes during persistence prevent registration',async()=>{
  let calls=0
  const f=fixture({assertCurrent:async()=>{if(++calls===3)throw new Error('Session changed')}})
  await assert.rejects(f.prepare('user'),/Session changed/)
  assert.ok(!f.events.includes('register'))
})

test('simultaneous first login on two devices asks the losing device to connect, never replaces identity',async()=>{
  let registered=false
  const f=fixture({registered:async()=>registered,matches:async()=>false,unlock:async()=>{
    registered=true;throw new Error('Key mismatch')
  }})
  assert.equal(await f.prepare('user'),'restore')
  assert.deepEqual(f.events,['create','persist'])
})
