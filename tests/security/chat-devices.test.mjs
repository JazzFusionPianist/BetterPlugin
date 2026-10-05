import {test} from 'node:test'
import assert from 'node:assert/strict'
import {b64,createRecoveryCode,deriveIdentity} from '../../packages/core/lib/chatCrypto.ts'
import {createLinkKey,deviceLinkCode,approveDeviceLink,receiveDeviceLink,wrapPasskeyVault,unwrapPasskeyVault} from '../../packages/core/lib/chatDeviceTransfer.ts'

const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002'
const random=()=>crypto.getRandomValues(new Uint8Array(32))
const pub=k=>({user_id:k.user_id,box_key:k.box_key,sign_key:k.sign_key})
async function device(){
  const master=await createRecoveryCode(),identity=pub(await deriveIdentity(A,master)),keys=await createLinkKey()
  const link={id:crypto.randomUUID(),user_id:A,public_key:b64(keys.publicKey),expires_at:new Date(Date.now()+300000).toISOString()}
  return {master,identity,keys,link}
}

test('new device restores only after full out-of-band approval, without putting master on relay',async()=>{
  const {master,identity,keys,link}=await device(),code=await deviceLinkCode(link)
  assert.match(code,/^[A-Za-z0-9_-]{22}$/)
  const response=await approveDeviceLink(link,code,master,identity)
  assert.equal(JSON.stringify({link,response}).includes(master),false)
  assert.equal(await receiveDeviceLink(link,response,keys.privateKey,identity),master)
  const other=await createLinkKey()
  await assert.rejects(receiveDeviceLink(link,response,other.privateKey,identity))
  await assert.rejects(approveDeviceLink(link,'000000',master,identity))
  const replacement={...link,public_key:b64(other.publicKey)}
  assert.notEqual(await deviceLinkCode(replacement),code)
  await assert.rejects(approveDeviceLink(replacement,code,master,identity))
})

test('device transfer rejects replay, altered signature, wrong account and expired request',async()=>{
  const {master,identity,keys,link}=await device()
  const response=await approveDeviceLink(link,await deviceLinkCode(link),master,identity)
  for(const changed of [{...response,id:crypto.randomUUID()},{...response,user:B},{...response,signature:'A'.repeat(86)},
    {...response,ciphertext:response.ciphertext.slice(2)},{...response,expires:new Date(Date.now()+1000).toISOString()}])
    await assert.rejects(receiveDeviceLink(link,changed,keys.privateKey,identity))
  await assert.rejects(receiveDeviceLink({...link,expires_at:new Date(Date.now()-1).toISOString()},response,keys.privateKey,identity))
  await assert.rejects(receiveDeviceLink({...link,user_id:B},response,keys.privateKey,identity))
  await assert.rejects(approveDeviceLink(link,await deviceLinkCode(link),await createRecoveryCode(),identity))
})

test('passkey vault requires the PRF secret, binds account and origin, rejects all modified fields',async()=>{
  const {master,identity}=await device(),prf=random(),credential=b64(random())
  const vault=await wrapPasskeyVault(master,identity,credential,'slur.example',random(),prf)
  assert.equal(JSON.stringify(vault).includes(master),false)
  assert.equal(JSON.stringify(vault).includes(b64(prf)),false)
  assert.equal(await unwrapPasskeyVault(vault,identity,'slur.example',prf),master)
  await assert.rejects(unwrapPasskeyVault(vault,identity,'slur.example',random()))
  await assert.rejects(unwrapPasskeyVault(vault,identity,'other.example',prf))
  for(const [key,value] of Object.entries({v:2,user:B,credentialId:b64(random()),salt:b64(random()),nonce:'A'.repeat(16),ciphertext:'A'.repeat(64),boxKey:'A'.repeat(43),signKey:'A'.repeat(43)}))
    await assert.rejects(unwrapPasskeyVault({...vault,[key]:value},identity,'slur.example',prf))
  await assert.rejects(wrapPasskeyVault(master,identity,credential,'slur.example',random(),new Uint8Array(31)))
})
