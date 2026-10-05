import {test} from 'node:test'
import assert from 'node:assert/strict'
import {deriveIdentity,createRecoveryCode,sealMessage,openMessage,unlockChat,lockChat,chatUnlocked} from '../../packages/core/lib/chatCrypto.ts'
import {encryptFile,decryptFile} from '../../packages/core/lib/fileCrypto.ts'
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002'
const publicKey=k=>({user_id:k.user_id,box_key:k.box_key,sign_key:k.sign_key})
test('automatic unlock refuses registration after sign-out or account switching',async()=>{
 const code=await createRecoveryCode()
 for(const user of [null,B]){
  let registered=false
  const client={auth:{getSession:async()=>({data:{session:user?{user:{id:user}}:null},error:null})},
   rpc:async()=>{registered=true;return {error:null}}}
  await assert.rejects(unlockChat(client,A,code),/Session changed/)
  assert.equal(registered,false)
  assert.equal(chatUnlocked(A),false)
 }
})
test('revocation during registration cannot reopen conversations',async()=>{
 const code=await createRecoveryCode()
 const client={auth:{getSession:async()=>({data:{session:{user:{id:A}}},error:null})},
  rpc:async()=>{lockChat();return {error:null}}}
 await assert.rejects(unlockChat(client,A,code))
 assert.equal(chatUnlocked(A),false)
})
test('only intended recipients decrypt, signatures bind message identity and recovery restores keys',async()=>{
 const code=await createRecoveryCode(),a=await deriveIdentity(A,code),b=await deriveIdentity(B,await createRecoveryCode()),outsider=await deriveIdentity('other',await createRecoveryCode())
 const envelope=await sealMessage(a,'id','room',{content:'private text',attachment_url:'orb-file:key#e2ee=secret'},[publicKey(a),publicKey(b)])
 const row={id:'id',conversation_id:'room',sender_id:A}
 assert.deepEqual(await openMessage(b,row,envelope),{content:'private text',attachment_url:'orb-file:key#e2ee=secret'})
 assert.equal((await openMessage(await deriveIdentity(A,code),row,envelope)).content,'private text')
 assert.equal(JSON.stringify(envelope).includes('private text'),false)
 await assert.rejects(openMessage(outsider,row,envelope))
 await assert.rejects(openMessage(b,{...row,id:'replay'},envelope))
 await assert.rejects(openMessage(b,{...row,sender_id:B},envelope))
 await assert.rejects(openMessage(b,{...row,conversation_id:'other-room'},envelope))
 await assert.rejects(openMessage(b,row,{...envelope,body:envelope.body.slice(0,-4)+'AAAA'}))
 const forged=structuredClone(envelope);forged.recipients.reverse();await assert.rejects(openMessage(b,row,forged))
})
test('file stream detects tampering, truncation, append and wrong key across chunk boundaries',async()=>{
 const bytes=new Uint8Array(1024*1024+31);bytes.fill(71)
 const file=new File([bytes],'song.wav',{type:'audio/wav'}),encrypted=await encryptFile(file)
 const result=await decryptFile(encrypted.blob,encrypted.key)
 assert.equal(result.type,'audio/wav');assert.deepEqual(new Uint8Array(await result.arrayBuffer()),bytes)
 await assert.rejects(decryptFile(encrypted.blob,await createRecoveryCode()))
 await assert.rejects(decryptFile(encrypted.blob.slice(0,-1),encrypted.key))
 await assert.rejects(decryptFile(new Blob([encrypted.blob,'extra']),encrypted.key))
 const tampered=new Uint8Array(await encrypted.blob.arrayBuffer());tampered[tampered.length-20]^=1
 await assert.rejects(decryptFile(new Blob([tampered]),encrypted.key))
})
test('envelopes serialize only public recipient fields even when passed full local identities',async()=>{
 const a=await deriveIdentity(A,await createRecoveryCode()),b=await deriveIdentity(B,await createRecoveryCode())
 const envelope=await sealMessage(a,'id','room',{content:'safe envelope'},[a,{...b,extra:'private caller metadata'}])
 for(const recipient of envelope.recipients)assert.deepEqual(Object.keys(recipient).sort(),['box_key','key','sign_key','user_id'])
 const encoded=JSON.stringify(envelope)
 for(const forbidden of ['boxSecret','signSecret','private caller metadata'])assert.equal(encoded.includes(forbidden),false)
 assert.equal((await openMessage(b,{id:'id',conversation_id:'room',sender_id:A},envelope)).content,'safe envelope')
})
