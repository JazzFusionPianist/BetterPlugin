/** Run only after reviewing the inventory against public portfolio references.
 * node scripts/security/migrate-legacy-r2.mjs --inventory /private/path/manifest.json
 * node scripts/security/migrate-legacy-r2.mjs --apply /private/path/manifest.json
 * node scripts/security/migrate-legacy-r2.mjs --purge-public /private/path/manifest.json
 * Entries must explicitly be marked classification: "private". Other entries
 * are untouched. Purge re-verifies the private copy and the DB record first.
 */
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
const require=createRequire(new URL('../../apps/plugin/package.json',import.meta.url))
const {AwsClient}=require('aws4fetch')
const required=name=>{if(!process.env[name])throw new Error(`Missing ${name}`);return process.env[name]}
const base=required('SUPABASE_URL'),key=required('SUPABASE_SERVICE_ROLE_KEY')
const api=async(path,init={})=>{
 const response=await fetch(base+'/rest/v1/'+path,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(30000)})
 if(!response.ok)throw new Error(`Database operation failed (${response.status})`)
 return response.status===204?null:response.json()
}
const [mode,file]=process.argv.slice(2)
if(!file || !['--inventory','--apply','--purge-public'].includes(mode))throw new Error('Specify a mode and a local manifest path.')
if(mode==='--inventory'){
 const rows=[]
 for(let offset=0;;offset+=500){
  const page=await api(`secure_files?select=object_key,storage,status&storage=eq.legacy&status=eq.ready&order=object_key&limit=500&offset=${offset}`)
  rows.push(...page.map(row=>({...row,classification:'review-required'})))
  if(page.length<500)break
 }
 await writeFile(file,JSON.stringify(rows,null,2)+'\n',{mode:0o600,flag:'wx'})
 console.log(`Wrote ${rows.length} entries. No remote files changed. Classify public portfolio reuse before proceeding.`)
}else{
 const entries=JSON.parse(await readFile(file,'utf8'))
 if(!Array.isArray(entries))throw new Error('Expected manifest array.')
 const aws=new AwsClient({accessKeyId:required('CLOUDFLARE_R2_ACCESS_KEY_ID'),secretAccessKey:required('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),service:'s3',region:'auto'})
 const oldBucket=required('CLOUDFLARE_R2_BUCKET'),newBucket=required('CLOUDFLARE_R2_PRIVATE_BUCKET')
 if(oldBucket===newBucket)throw new Error('Private bucket must be separate.')
 const origin=`https://${required('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`
 const path=(bucket,k)=>'/'+encodeURIComponent(bucket)+'/'+k.split('/').map(encodeURIComponent).join('/')
 const head=async url=>{const r=await aws.fetch(url,{method:'HEAD'});if(!r.ok)throw new Error('Object verification failed');return {etag:r.headers.get('etag'),size:r.headers.get('content-length')}}
 let count=0
 for(const entry of entries){
  if(entry.classification!=='private')continue
  const k=entry.object_key
  if(typeof k!=='string' || !/^[A-Za-z0-9/_\-.]+$/.test(k) || k.startsWith('/') || k.includes('..'))throw new Error('Invalid object key')
  const rows=await api(`secure_files?select=storage,status&object_key=eq.${encodeURIComponent(k)}`)
  if(rows.length!==1 || rows[0].status!=='ready')throw new Error('File record changed; refresh inventory')
  const oldUrl=origin+path(oldBucket,k),newUrl=origin+path(newBucket,k)
  const before=await head(oldUrl)
  if(mode==='--apply'){
   if(!['legacy','private'].includes(rows[0].storage))throw new Error('Public file cannot be migrated with this manifest')
   const copied=await aws.fetch(newUrl,{method:'PUT',headers:{'x-amz-copy-source':path(oldBucket,k),'x-amz-copy-source-if-match':before.etag}})
   if(!copied.ok)throw new Error('Object copy failed')
  }else if(rows[0].storage!=='private')throw new Error('Copy and switch the database before purging')
  const after=await head(newUrl)
  if(!before.etag || before.etag!==after.etag || before.size!==after.size)throw new Error('Copy verification mismatch; original retained')
  if(mode==='--apply'){
   await api('rpc/switch_legacy_file_storage',{method:'POST',body:JSON.stringify({p_key:k})})
  }else{
   const removed=await aws.fetch(oldUrl,{method:'DELETE'})
   if(!removed.ok)throw new Error('Public original deletion failed')
  }
  count++
 }
 console.log(`${mode}: verified and processed ${count} explicitly classified private files. Purge any CDN caches separately.`)
}
