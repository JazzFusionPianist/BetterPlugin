import {readFile} from 'node:fs/promises'
import {securityFixture,act,A,B} from './fixture.mjs'
import {createRecoveryCode,deriveIdentity,sealMessage} from '../../packages/core/lib/chatCrypto.ts'
export const room='10000000-0000-4000-8000-000000000001'
export const id='20000000-0000-4000-8000-000000000001'
export const pub=k=>({user_id:k.user_id,box_key:k.box_key,sign_key:k.sign_key})
export async function outboxFixture(){
  const db=await securityFixture()
  await db.exec('alter table conversation_stems add column file_size bigint; alter table conversation_stems add column created_at timestamptz default now(); alter table messages add column created_at timestamptz default now();')
  for(const file of ['20260927184452_security_encrypted_chat.sql','20260927184456_security_membership_and_sessions.sql','20260927184459_security_history_upgrade.sql',
    '20261002193130_account_based_chat.sql','20261003033724_automatic_private_chat.sql','20261003112523_private_chat_outbox_lifecycle.sql'])
    await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'))
  await db.exec(`insert into conversations(id) values('${room}');insert into conversation_members(conversation_id,user_id) values('${room}','${A}'),('${room}','${B}');update private.chat_rollout set enabled=true;`)
  const a=await deriveIdentity(A,await createRecoveryCode()),b=await deriveIdentity(B,await createRecoveryCode())
  for(const k of [a,b])await act(db,k.user_id,'select register_chat_key($1,$2)',[k.box_key,k.sign_key])
  const queue=async({itemIds=[id],kind='message',keys=[]}={})=>{
    const envelope=await sealMessage(a,itemIds[0],room,{kind,content:'private draft'},[pub(a)])
    await act(db,A,'insert into chat_pending_sends(id,conversation_id,envelope,kind,item_ids,attachment_keys) values($1,$2,$3,$4,$5,$6)',[itemIds[0],room,envelope,kind,itemIds,keys])
  }
  const message=async(msgId=id)=>({id:msgId,conversation_id:room,sender_id:A,content:'\u{1f512} Encrypted message',
    encrypted_payload:await sealMessage(a,msgId,room,{content:'private message'},[pub(a),pub(b)])})
  const deliver=async(records,{user=A,audience=[A,B],pending=id}={})=>(await act(db,user,'select deliver_private_chat($1,$2,$3) state',[pending,audience,records])).rows[0].state
  const cancel=async(user=A,pending=id)=>(await act(db,user,'select cancel_private_chat($1) state',[pending])).rows[0].state
  return {db,a,b,queue,message,deliver,cancel}
}
