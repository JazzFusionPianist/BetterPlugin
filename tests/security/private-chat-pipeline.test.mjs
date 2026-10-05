import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRecoveryCode,deriveIdentity,unlockChat,lockChat,openMessage} from '../../packages/core/lib/chatCrypto.ts'
import {sendPrivateMessage,sendPrivateStems,drainPrivateChat,privateChatEnabled,decodePendingChat,cancelPendingChat,readPendingChat} from '../../packages/core/lib/privateChat.ts'

const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002'
const room='10000000-0000-4000-8000-000000000001'
const id='20000000-0000-4000-8000-000000000001'
const pub=k=>({user_id:k.user_id,box_key:k.box_key,sign_key:k.sign_key})
const storage=new Map()
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}
globalThis.window=new EventTarget()

async function fixture({ready=true,mode=1}={}){
  lockChat();storage.clear()
  const master=await createRecoveryCode(),a=await deriveIdentity(A,master),b=await deriveIdentity(B,await createRecoveryCode())
  const state={user:A,mode,ready,error:false,members:[A,B],lostResponse:false,insertAttempts:0}
  const tables={messages:[],conversation_stems:[],chat_pending_sends:[]}
  const receipts=new Map()
  const client={
    auth:{getSession:async()=>({data:{session:state.user?{user:{id:state.user}}:null},error:null})},
    rpc:async(name,args={})=>{
      if(name==='register_chat_key')return {error:null}
      if(name==='chat_security_mode')return state.error?{error:{message:'offline'}}:{data:state.mode,error:null}
      if(name==='conversation_chat_keys')return {data:state.members.map(u=>u===A?pub(a):state.ready?pub(b):{user_id:B,box_key:null,sign_key:null}),error:null}
      if(name==='expire_private_chat')return {error:null}
      if(['note_private_chat','cancel_private_chat','deliver_private_chat'].includes(name)){
        if(state.beforeDeliver&&name==='deliver_private_chat')await state.beforeDeliver(args)
        if(receipts.has(args.p_id))return {data:receipts.get(args.p_id),error:null}
        const row=tables.chat_pending_sends.find(r=>r.id===args.p_id)
        if(!row)return {error:{code:'42501'}}
        if(name==='note_private_chat'){
          if(row.state==='waiting'){
            row.reason=args.p_reason
            if(['membership_changed','invalid'].includes(args.p_reason))row.state='blocked'
          }
          return {data:row.state,error:null}
        }
        if(name==='cancel_private_chat'){
          receipts.set(row.id,'cancelled');tables.chat_pending_sends=tables.chat_pending_sends.filter(r=>r!==row)
          return {data:'cancelled',error:null}
        }
        if(row.state!=='waiting')return {data:row.state,error:null}
        if(state.rejectIds?.has(row.id))return {error:{code:'22023'}}
        const table=row.kind==='stems'?'conversation_stems':'messages'
        tables[table].push(...args.p_records.map(r=>({...structuredClone(r),created_at:new Date().toISOString()})))
        receipts.set(row.id,'delivered');tables.chat_pending_sends=tables.chat_pending_sends.filter(r=>r!==row)
        if(state.lostResponse){state.lostResponse=false;return {error:{code:'NETWORK'}}}
        return {data:'delivered',error:null}
      }
      throw new Error(`Unexpected RPC ${name}`)
    },
    from(table){
      let action='select',rows,filters=[],one=false
      const query={
        select(){return query},order(){return query},limit(){return query},
        single(){one=true;return query},
        eq(k,v){filters.push(r=>r[k]===v);return query},
        in(k,values){filters.push(r=>values.includes(r[k]));return query},
        insert(input){action='insert';rows=Array.isArray(input)?input:[input];return query},
        delete(){action='delete';return query},
        then(resolve,reject){return Promise.resolve().then(()=>{
          if(action==='insert'){
            state.insertAttempts++
            if(rows.some(r=>tables[table].some(old=>old.id===r.id)))return {data:null,error:{code:'23505'}}
            const stored=rows.map(r=>({...structuredClone(r),created_at:new Date().toISOString(),state:'waiting',reason:null,expires_at:new Date(Date.now()+86400000).toISOString()}))
            tables[table].push(...stored)
            if(state.lostQueueResponse){state.lostQueueResponse=false;return {data:null,error:{code:'NETWORK'}}}
            return {data:one?stored[0]:stored,error:null}
          }
          const selected=tables[table].filter(r=>filters.every(f=>f(r)))
          if(action==='delete')tables[table]=tables[table].filter(r=>!selected.includes(r))
          return {data:one?selected[0]:selected,error:null}
        }).then(resolve,reject)},
      }
      return query
    },
  }
  await unlockChat(client,A,master)
  return {client,state,tables,a,b,master,receipts}
}

test('normal send encrypts body, names, audio secret and region metadata before any insert',async()=>{
  const {client,tables,b}=await fixture()
  const url=`orb-file:private/${A}/test.bin#e2ee=${'A'.repeat(43)}`
  assert.deepEqual(await sendPrivateMessage(client,A,id,room,'private conversation',{type:'audio',url,name:'private-region.wav',metadata:{position:{samples:96000}}}),{pending:false,cancelled:false})
  assert.equal(tables.chat_pending_sends.length,0)
  assert.equal(tables.messages.length,1)
  const row=tables.messages[0],stored=JSON.stringify(row)
  for(const plaintext of ['private conversation','private-region.wav','#e2ee','96000'])assert.equal(stored.includes(plaintext),false)
  const clear=await openMessage(b,row,row.encrypted_payload)
  assert.equal(clear.content,'private conversation');assert.equal(clear.attachment_url,url)
  assert.equal(clear.attachment_metadata.position.samples,96000)
})

test('unprepared recipient leaves a self-encrypted draft that delivers once after automatic enrollment',async()=>{
  const {client,state,tables,b}=await fixture({ready:false})
  assert.deepEqual(await sendPrivateMessage(client,A,id,room,'wait privately'),{pending:true,cancelled:false})
  assert.equal(tables.messages.length,0)
  assert.equal(tables.chat_pending_sends.length,1)
  const pending=tables.chat_pending_sends[0]
  assert.equal(JSON.stringify(pending).includes('wait privately'),false)
  assert.equal((await decodePendingChat(A,pending)).message.content,'wait privately')
  await assert.rejects(openMessage(b,{id,conversation_id:room,sender_id:A},pending.envelope))
  state.ready=true
  await Promise.all([drainPrivateChat(client,A),drainPrivateChat(client,A)])
  await drainPrivateChat(client,A)
  assert.equal(tables.messages.length,1);assert.equal(tables.chat_pending_sends.length,0)
  assert.equal((await openMessage(b,tables.messages[0],tables.messages[0].encrypted_payload)).content,'wait privately')
})

test('lost response is retried idempotently; no duplicate message or plaintext fallback',async()=>{
  const {client,state,tables}=await fixture()
  state.lostResponse=true
  assert.deepEqual(await sendPrivateMessage(client,A,id,room,'only once'),{pending:false,cancelled:false})
  assert.equal(tables.messages.length,1);assert.equal(tables.chat_pending_sends.length,0)
  await drainPrivateChat(client,A)
  assert.equal(tables.messages.length,1);assert.equal(tables.chat_pending_sends.length,0)
})

test('lost outbox insert response recovers the same signed draft without inserting twice',async()=>{
  const {client,state,tables}=await fixture()
  state.lostQueueResponse=true
  assert.deepEqual(await sendPrivateMessage(client,A,id,room,'saved before response'),{pending:false,cancelled:false})
  assert.equal(state.insertAttempts,1);assert.equal(tables.messages.length,1)
})

test('outbox recovery never substitutes a different draft that reused the same id',async()=>{
  const {client,state,tables}=await fixture({ready:false})
  await sendPrivateMessage(client,A,id,room,'original draft')
  await assert.rejects(sendPrivateMessage(client,A,id,room,'different draft'),e=>e.code==='23505')
  assert.equal(tables.chat_pending_sends.length,1)
  assert.equal((await decodePendingChat(A,tables.chat_pending_sends[0])).message.content,'original draft')
  state.ready=true;await drainPrivateChat(client,A)
  assert.equal(tables.messages.length,1)
})

test('mode lookup failure and downgrade cannot silently fall back to account plaintext',async()=>{
  const {client,state,tables}=await fixture()
  state.error=true
  await assert.rejects(sendPrivateMessage(client,A,id,room,'do not leak'),/connect/)
  assert.equal(state.insertAttempts,0)
  state.error=false;assert.equal(await privateChatEnabled(client,A),true)
  state.mode=0
  await assert.rejects(sendPrivateMessage(client,A,id,room,'do not downgrade'),/update/)
  assert.equal(state.insertAttempts,0);assert.equal(tables.messages.length,0)
})

test('even a fresh client cannot send plaintext while rollout is disabled',async()=>{
  const {client,state}=await fixture({mode:0})
  await assert.rejects(sendPrivateMessage(client,A,id,room,'never plaintext'),/updating/)
  await assert.rejects(sendPrivateStems(client,A,[{id,conversation_id:room,uploader_id:A}]),/updating/)
  assert.equal(state.insertAttempts,0)
})

test('membership changes and account switches leave drafts undelivered',async()=>{
  const {client,state,tables}=await fixture({ready:false})
  await sendPrivateMessage(client,A,id,room,'for original recipients')
  state.ready=true;state.members=[A]
  await drainPrivateChat(client,A)
  assert.equal(tables.messages.length,0);assert.equal(tables.chat_pending_sends.length,1)
  state.members=[A,B];state.user=B
  await assert.rejects(drainPrivateChat(client,A),/Session changed/)
  assert.equal(tables.messages.length,0)
})

test('stem bundle inserts encrypted rows atomically and keeps positions inside ciphertext',async()=>{
  const {client,tables,b}=await fixture()
  const rows=[id,crypto.randomUUID()].map((id,i)=>({id,conversation_id:room,uploader_id:A,file_key:`private/${A}/${i}.bin`,file_url:`orb-file:private/${A}/${i}.bin#e2ee=${'A'.repeat(43)}`,file_name:`region-${i}.wav`,mime_type:'audio/wav',file_size:100,timeline_metadata:{track:'Voice',samples:i*96000}}))
  assert.deepEqual(await sendPrivateStems(client,A,rows),{pending:false,cancelled:false})
  assert.equal(tables.conversation_stems.length,2);assert.equal(tables.chat_pending_sends.length,0)
  for(const [i,row] of tables.conversation_stems.entries()){
    assert.equal(row.file_url,'orb-encrypted:');assert.equal(row.timeline_metadata,null)
    assert.equal(JSON.stringify(row).includes('Voice'),false)
    assert.equal((await openMessage(b,{...row,sender_id:A},row.encrypted_payload)).timeline_metadata.samples,i*96000)
  }
})

test('oversized messages fail before creating a permanently undeliverable draft',async()=>{
  const {client,state}=await fixture()
  await assert.rejects(sendPrivateMessage(client,A,id,room,'x'.repeat(200000)),/too large/)
  assert.equal(state.insertAttempts,0)
})

test('cancellation on another device wins while a send is being prepared',async()=>{
  const {client,state,tables,receipts}=await fixture()
  state.beforeDeliver=async()=>{
    state.beforeDeliver=null
    assert.equal(await cancelPendingChat(client,A,id,room),'cancelled')
  }
  assert.deepEqual(await sendPrivateMessage(client,A,id,room,'cancel me'),{pending:false,cancelled:true})
  assert.equal(tables.messages.length,0);assert.equal(receipts.get(id),'cancelled')
})

test('one rejected pending item does not stop later messages; retry reports an actionable blocked state',async()=>{
  const {client,state,tables}=await fixture({ready:false})
  await sendPrivateMessage(client,A,id,room,'bad delivery')
  const next=crypto.randomUUID();await sendPrivateMessage(client,A,next,room,'good delivery')
  state.ready=true;state.rejectIds=new Set([id])
  await drainPrivateChat(client,A)
  assert.equal(tables.messages.length,1);assert.equal(tables.messages[0].id,next)
  assert.equal(tables.chat_pending_sends[0].state,'blocked');assert.equal(tables.chat_pending_sends[0].reason,'invalid')
})

test('polling reports cancellation from another device to mounted conversation views',async()=>{
  const {client,tables,receipts}=await fixture({ready:false})
  await sendPrivateMessage(client,A,id,room,'pending')
  await readPendingChat(client,A,room)
  const events=[],listener=e=>events.push(e.detail.conversation)
  window.addEventListener('slur-chat-delivered',listener)
  try{
    tables.chat_pending_sends=[];receipts.set(id,'cancelled')
    await drainPrivateChat(client,A)
    assert.deepEqual(events,[room])
    await drainPrivateChat(client,A);assert.deepEqual(events,[room])
  }finally{window.removeEventListener('slur-chat-delivered',listener)}
})
