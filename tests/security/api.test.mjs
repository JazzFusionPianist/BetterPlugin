import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {stripTypeScriptTypes} from 'node:module'
import {matchesFileType} from '../../apps/plugin/server/fileType.ts'
const load=async name=>{
 let source=await readFile(new URL('../../apps/plugin/api/'+name+'.ts',import.meta.url),'utf8')
 source=source.replace(/'\.\.\/server\/(security|fileType)'/g,(_,name)=>JSON.stringify(new URL('../../apps/plugin/server/'+name+'.ts',import.meta.url).href))
 return (await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'))).default
}
test('file APIs reject anonymous/malformed/unauthorized requests, preserve CORS and sign immutable uploads',async()=>{
 const upload=await load('r2-upload-url'),download=await load('r2-file-url')
 const oldFetch=globalThis.fetch
 Object.assign(process.env,{SUPABASE_URL:'https://db.example.invalid',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service',CLOUDFLARE_R2_PRIVATE_BUCKET:'test-private',CLOUDFLARE_R2_ACCESS_KEY_ID:'test-key',CLOUDFLARE_R2_SECRET_ACCESS_KEY:'test-secret',CLOUDFLARE_ACCOUNT_ID:'test-account'})
 const req=body=>new Request('https://app.example.invalid/api/r2-upload-url',{method:'POST',headers:{authorization:'Bearer test-session','content-type':'application/json',origin:'juce://juce.backend'},body:JSON.stringify(body)})
 try{
  globalThis.fetch=async url=>{
   if(String(url).endsWith('/security_check_session'))return Response.json({id:'00000000-0000-4000-8000-000000000001'})
   if(String(url).endsWith('/security_rate_limit'))return new Response(null,{status:204})
   if(String(url).endsWith('/file_access'))return Response.json({code:'42501',message:'internal secret detail'},{status:403})
   if(String(url).endsWith('/reserve_file'))return Response.json({object_key:'private/test/file.bin',storage:'private',size:99,mime:'application/octet-stream'})
   throw new Error('Unexpected network request')
  }
  assert.equal((await upload(new Request('https://app.example.invalid',{method:'POST'}))).status,401)
  assert.equal((await upload(req([]))).status,400)
  assert.equal((await upload(req({size:0}))).status,400)
  assert.equal((await download(req({key:'../../secret'}))).status,400)
  const denied=await download(req({key:'private/another.bin'}))
  assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),'juce://juce.backend')
  assert.doesNotMatch(await denied.text(),/internal secret/)
  const signed=await upload(req({size:99,ext:'bin',contentType:'application/octet-stream',name:'encrypted-attachment'}))
  assert.equal(signed.status,200)
  const data=await signed.json(),url=new URL(data.uploadUrl)
  assert.equal(data.publicUrl,'orb-file:private/test/file.bin')
  assert.match(url.searchParams.get('X-Amz-SignedHeaders'),/if-none-match/)
  assert.match(url.searchParams.get('X-Amz-SignedHeaders'),/content-length/)
  assert.equal(signed.headers.get('cache-control'),'private, no-store')
 }finally{globalThis.fetch=oldFetch}
})
test('format inspection rejects active content masquerading as media and requires encrypted header for private uploads',()=>{
 const b=s=>new TextEncoder().encode(s)
 assert.equal(matchesFileType(b('<html><script>alert(1)</script>'),'image/png',false),false)
 assert.equal(matchesFileType(b('RIFF1234WAVErest'),'audio/wav',false),true)
 assert.equal(matchesFileType(b('ORBFIL01encrypted bytes'),'application/octet-stream',true),true)
 assert.equal(matchesFileType(b('RIFF1234WAVErest'),'audio/wav',true),false)
})
