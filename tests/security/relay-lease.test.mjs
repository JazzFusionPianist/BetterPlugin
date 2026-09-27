import {test} from 'node:test'
import assert from 'node:assert/strict'
import {RelayLease} from '../../apps/plugin/src/lib/relayLease.ts'
const grant=credential=>({config:{iceTransportPolicy:'relay',iceServers:[{urls:['turn:example.invalid'],username:'test',credential}]},expiresAt:Date.now()+540000})
test('renewal is scoped, coalesced, and never restarts a stopped broadcast',async()=>{
 let complete,calls=0,updates=0,failed=0
 const pending=new Promise(r=>complete=r)
 const a=new RelayLease(grant('a'),()=>{calls++;return pending},()=>updates++,()=>failed++)
 const b=new RelayLease(grant('b'),async()=>grant('b2'),()=>{},()=>{})
 try{
  const p=a.refresh();assert.equal(a.refresh(),p);assert.equal(calls,1)
  a.stop();complete(grant('a2'));await p
  assert.equal(updates,0);assert.equal(failed,0);assert.equal(b.config.iceServers[0].credential,'b')
  assert.throws(()=>a.config,/expired/)
 }finally{a.stop();b.stop()}
})
test('revocation, expired grants and relay downgrade stop media immediately',async()=>{
 for(const load of [async()=>{throw Error('revoked')},async()=>({...grant('expired'),expiresAt:0}),async()=>({...grant('direct'),config:{iceTransportPolicy:'all'}})]){
  let failed=0,updates=0
  const lease=new RelayLease(grant('valid'),load,()=>updates++,()=>failed++)
  await lease.refresh();assert.equal(failed,1);assert.equal(updates,0);assert.throws(()=>lease.config)
  await lease.refresh();assert.equal(failed,1)
 }
})
test('valid renewal updates the peer configuration',async()=>{
 let updated
 const lease=new RelayLease(grant('first'),async()=>grant('second'),x=>updated=x,()=>assert.fail('Unexpected failure'))
 try{await lease.refresh();assert.equal(updated.iceServers[0].credential,'second');assert.equal(lease.config.iceTransportPolicy,'relay')}finally{lease.stop()}
})
