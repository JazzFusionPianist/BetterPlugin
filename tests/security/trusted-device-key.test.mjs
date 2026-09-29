import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createDeviceWrappingKey,wrapRecoveryCode,unwrapRecoveryCode} from '../../packages/core/lib/deviceKeyStore.ts'

test('trusted device recovery material is non-exportable, account-bound and authenticated',async()=>{
  const key=await createDeviceWrappingKey()
  assert.equal(key.extractable,false)
  await assert.rejects(crypto.subtle.exportKey('raw',key))

  const code='private-recovery-material'
  const wrapped=await wrapRecoveryCode(key,'user-a',code)
  assert.equal(await unwrapRecoveryCode(key,'user-a',wrapped),code)
  await assert.rejects(unwrapRecoveryCode(key,'user-b',wrapped))

  const tampered=structuredClone(wrapped)
  new Uint8Array(tampered.ciphertext)[0]^=1
  await assert.rejects(unwrapRecoveryCode(key,'user-a',tampered))
})
