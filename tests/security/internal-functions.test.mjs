import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {fixture,act,A} from './fixture.mjs'
test('internal function hardening preserves triggers and authenticated RPC grants',async()=>{
 const db=await fixture()
 try{
  await db.exec(`create function enforce_group_member_cap() returns trigger language plpgsql security definer as $$begin return NEW;end$$;
   create function rls_auto_enable() returns event_trigger language plpgsql security definer as $$begin return;end$$;
   create function poker_deal_hand(uuid,jsonb) returns void language sql security definer as $$select null::void$$;
   create table rooms(id uuid,updated_at timestamptz);grant all on rooms to authenticated;`)
  for(const prefix of ['ear_training','yacht','orb_party','sketch','board']){
   await db.exec(`create function ${prefix}_rooms_touch_updated_at() returns trigger language plpgsql as $$begin NEW.updated_at=now();return NEW;end$$;`)
  }
  await db.exec(`create trigger touch before insert on rooms for each row execute function board_rooms_touch_updated_at();
   create trigger cap before insert on rooms for each row execute function enforce_group_member_cap();`)
  await db.exec(await readFile('supabase/migrations/20260927181602_security_internal_function_permissions.sql','utf8'))
  for(const name of ['enforce_group_member_cap()','rls_auto_enable()']){
   for(const role of ['anon','authenticated'])assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,name])).rows[0].allowed,false)
  }
  assert.equal((await db.query("select has_function_privilege('anon','poker_deal_hand(uuid,jsonb)','execute') allowed")).rows[0].allowed,false)
  assert.equal((await db.query("select has_function_privilege('authenticated','poker_deal_hand(uuid,jsonb)','execute') allowed")).rows[0].allowed,true)
  const result=await act(db,A,'insert into rooms(id) values($1) returning updated_at',[A])
  assert.ok(result.rows[0].updated_at)
 }finally{await db.close()}
})
