import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {stripTypeScriptTypes} from 'node:module'
const mod=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
test('blocked legacy records do not starve later history and are retried after wrapping',async()=>{
 let source=await readFile('packages/core/lib/historyUpgrade.ts','utf8')
 source=source.replace("'./chatCrypto'",JSON.stringify(mod("export async function conversationKeys(c,u,room){if(room==='blocked')throw Error('Recipient not ready')};export async function encryptChatMessage(){return {v:1}}")))
 source=source.replace("'./secureFiles'",JSON.stringify(mod('export async function resolveSecureFile(){throw Error("No file expected")};export async function uploadSecureFile(){throw Error("No file expected")}')))
 const {upgradeHistory}=await import(mod(stripTypeScriptTypes(source)))
 const rows=Array.from({length:11},(_,i)=>({id:String(i).padStart(2,'0'),conversation_id:i<10?'blocked':'ready',content:'text',attachment_url:null}))
 const migrated=new Set()
 const client={from(table){let after='';const q={select(){return q},eq(){return q},is(){return q},order(){return q},limit(){return q},gt(_,v){after=v;return q},then(resolve){resolve({data:table==='messages'?rows.filter(r=>r.id>after&&!migrated.has(r.id)).slice(0,10):[],error:null})}};return q},async rpc(_,args){migrated.add(args.p_id);return {error:null}}}
 assert.deepEqual(await upgradeHistory(client,'owner',''),{upgraded:0,skipped:10})
 assert.deepEqual(await upgradeHistory(client,'owner',''),{upgraded:1,skipped:0})
 assert.equal(migrated.has('10'),true)
 rows[0].conversation_id='ready'
 assert.deepEqual(await upgradeHistory(client,'owner',''),{upgraded:1,skipped:9})
})
