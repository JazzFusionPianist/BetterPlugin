import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const migration = await readFile(new URL('../../supabase/migrations/20260923185345_security_admin_roles.sql', import.meta.url), 'utf8')
export const A = '00000000-0000-4000-8000-000000000001'
export const B = '00000000-0000-4000-8000-000000000002'
export const C = '00000000-0000-4000-8000-000000000003'

export async function fixture() {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
    $$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid;$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role';$$;
    grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users(id uuid primary key,email text,created_at timestamptz,last_sign_in_at timestamptz,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
    create table profiles(id uuid primary key references auth.users(id) on delete cascade,
      display_name text,username text,avatar_color text,avatar_url text,bio text,updated_at timestamptz,
      is_admin boolean default false,is_verified boolean default false,member_no bigint);
    alter table profiles enable row level security;
    create policy profile_read on profiles for select to authenticated using(true);
    create policy profile_insert on profiles for insert to authenticated with check(id=auth.uid());
    create policy profile_update on profiles for update to authenticated using(id=auth.uid());
    grant all on profiles to anon,authenticated;
    create table profile_credits(id uuid primary key,user_id uuid,status text,reviewed_at timestamptz,
      reviewed_by uuid,note text,work text,artist text,part text,year int,link text);
    alter table profile_credits enable row level security;
    create function handle_new_user() returns trigger language plpgsql as $$begin return new; end;$$;
    insert into auth.users(id,email) values('${A}','admin@example.invalid'),('${B}','member@example.invalid'),('${C}','new@example.invalid');
    insert into auth.sessions select id,id from auth.users;
    insert into profiles(id,is_admin,member_no) values('${A}',true,1),('${B}',false,2);
  `)
  await db.exec(migration)
  return db
}

export async function as(db, role, id, aal, sql) {
  await db.exec('begin')
  try {
    await db.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({role,sub:id,aal,session_id:id})])
    await db.exec(`set local role ${role}`)
    return await db.query(sql)
  } finally { await db.exec('rollback') }
}


export async function securityFixture(){
  const db=await fixture()
  await db.exec(`
    create table conversations(id uuid primary key,created_by uuid,kind text,title text,avatar_url text,created_at timestamptz default now());
    create table conversation_members(conversation_id uuid,user_id uuid,role text default 'member',primary key(conversation_id,user_id));
    create function is_conversation_member(cid uuid) returns boolean language sql security definer set search_path=public as $$select exists(select 1 from conversation_members where conversation_id=cid and user_id=auth.uid());$$;
    create table messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references conversations(id),sender_id uuid,content text,attachment_keys text[],attachment_url text,attachment_name text,attachment_type text,attachment_metadata jsonb);
    create table conversation_stems(id uuid primary key default gen_random_uuid(),conversation_id uuid references conversations(id),uploader_id uuid,file_key text,file_url text,file_name text,mime_type text,timeline_metadata jsonb);
    create table live_sessions(id uuid primary key default gen_random_uuid(),host_id uuid,title text,started_at timestamptz default now(),has_video boolean,has_audio boolean,video_source text);
    alter table messages enable row level security;
    alter table conversation_stems enable row level security;
    alter table live_sessions enable row level security;
    create policy mi on messages for insert to authenticated with check(sender_id=auth.uid() and is_conversation_member(conversation_id));
    create policy ms on messages for select to authenticated using(is_conversation_member(conversation_id));
    create policy si on conversation_stems for insert to authenticated with check(uploader_id=auth.uid() and is_conversation_member(conversation_id));
    grant all on conversations,messages,conversation_members,conversation_stems,live_sessions to authenticated;
    create schema storage;create table storage.objects(bucket_id text,name text);create table storage.buckets(id text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  `)
  await db.exec(await readFile(new URL('../../supabase/migrations/20260927184436_security_files_and_access.sql',import.meta.url),'utf8'))
  return db
}
export async function act(db,id,sql,params=[]){
  await db.exec('begin')
  try{
    await db.query(`select set_config('request.jwt.claims',$1,true)`,[JSON.stringify({role:'authenticated',sub:id,aal:'aal1',session_id:id})])
    await db.exec('set local role authenticated')
    const result=await db.query(sql,params);await db.exec('commit');return result
  }catch(e){await db.exec('rollback');throw e}
}
