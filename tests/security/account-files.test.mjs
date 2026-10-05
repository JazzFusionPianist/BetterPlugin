import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {stripTypeScriptTypes} from 'node:module'

let source=await readFile(new URL('../../packages/core/lib/secureFiles.ts',import.meta.url),'utf8')
source=source.replace(/'\.\/(fileCrypto|r2Keys)'/g,(_,name)=>JSON.stringify(new URL(`../../packages/core/lib/${name}.ts`,import.meta.url).href))
const {uploadSecureFile,resolveSecureFile}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'))
const client={auth:{getSession:async()=>({data:{session:{access_token:'test-session'}}})}}
test('new private uploads preserve bytes, do not create file keys, and require authorized completion',async()=>{
 const previousFetch=globalThis.fetch,previousXHR=globalThis.XMLHttpRequest
 const requests=[],uploads=[]
 globalThis.XMLHttpRequest=class{
   upload={};status=200
   open(method,url){assert.equal(method,'PUT');assert.equal(url,'https://upload.example.invalid/signed')}
   setRequestHeader(){}
   send(data){uploads.push(data);queueMicrotask(()=>this.onload())}
 }
 try{
   globalThis.fetch=async(url,options)=>{
     assert.equal(options.headers.Authorization,'Bearer test-session')
     requests.push({url,body:JSON.parse(options.body)})
     if(url.endsWith('/r2-upload-url'))return Response.json({uploadUrl:'https://upload.example.invalid/signed',key:'private/test/region.wav',publicUrl:'orb-file:private/test/region.wav'})
     assert.ok(url.endsWith('/r2-upload-complete'));return Response.json({ok:true})
   }
   const file=new File(['RIFF1234WAVEtest'],'region.wav',{type:'audio/wav'})
   const result=await uploadSecureFile(client,file,{apiBase:'https://app.example.invalid'})
   assert.equal(uploads[0],file)
   assert.deepEqual(requests[0].body,{ext:'wav',contentType:'audio/wav',size:file.size,name:'region.wav',visibility:'private'})
   assert.equal(result.url,'orb-file:private/test/region.wav')
   assert.ok(!result.url.includes('#'))
   globalThis.fetch=async()=>new Response(null,{status:403})
   await assert.rejects(uploadSecureFile(client,file,{apiBase:'https://app.example.invalid'}),/authorize/)
   assert.equal(uploads.length,1)
 }finally{globalThis.fetch=previousFetch;globalThis.XMLHttpRequest=previousXHR}
})
test('unencrypted private downloads still require a fresh signed URL and never fall back after denial',async()=>{
 const previous=globalThis.fetch,calls=[]
 try{
   globalThis.fetch=async(url,options)=>{
     calls.push(url);assert.equal(options.headers.Authorization,'Bearer test-session')
     return Response.json({url:'https://files.example.invalid/signed'})
   }
   assert.equal(await resolveSecureFile(client,'orb-file:private/test/region.wav','https://app.example.invalid'),'https://files.example.invalid/signed')
   assert.equal(calls.length,1)
   globalThis.fetch=async()=>new Response(null,{status:403})
   await assert.rejects(resolveSecureFile(client,'orb-file:private/test/region.wav','https://app.example.invalid'),/no longer have access/)
 }finally{globalThis.fetch=previous}
})
