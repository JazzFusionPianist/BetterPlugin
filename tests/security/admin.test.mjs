import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, as, A, B, C } from './fixture.mjs'

test('platform authority is isolated; anonymous, missing-profile and ordinary users are denied', async () => {
  const db=await fixture()
  try {
    for(const role of ['anon','authenticated']) {
      await assert.rejects(as(db,role,role==='anon'?undefined:B,'aal1',`select admin_get_user_details('${A}')`), /permission denied|MFA required/)
      await assert.rejects(as(db,role,role==='anon'?undefined:B,'aal1',`select admin_delete_user('${A}')`), /permission denied|MFA required/)
    }
    await assert.rejects(as(db,'authenticated',C,'aal2',`select admin_get_user_details('${A}')`), /MFA required/)
    await assert.rejects(as(db,'authenticated',B,'aal2',`update profiles set is_admin=true where id='${B}'`), /permission denied/)
    await assert.rejects(as(db,'authenticated',B,'aal2',`update profiles set is_verified=true where id='${B}'`), /MFA required/)
    await assert.rejects(as(db,'authenticated',C,'aal2',`insert into profiles(id,is_admin) values('${C}',true)`), /permission denied/)
    await assert.rejects(as(db,'authenticated',B,'aal2','select * from private.platform_admins'), /permission denied/)
    await assert.rejects(as(db,'authenticated',A,'aal1',`select admin_get_user_details('${B}')`), /MFA required/)
    assert.equal((await as(db,'authenticated',A,'aal2',`select admin_get_user_details('${B}') as details`)).rows[0].details.email,'member@example.invalid')
    assert.equal((await as(db,'authenticated',A,'aal2',`update profiles set is_verified=true where id='${B}' returning is_verified`)).rows[0].is_verified,true)
    assert.equal((await as(db,'authenticated',B,'aal1',`update profiles set display_name='Allowed' where id='${B}' returning display_name`)).rows[0].display_name,'Allowed')
    assert.equal((await as(db,'authenticated',C,'aal1',`insert into profiles(id,display_name) values('${C}','New') returning is_admin`)).rows[0].is_admin,false)
    await assert.rejects(as(db,'authenticated',A,'aal2',`select admin_delete_user('${A}')`), /own account/)
  } finally { await db.close() }
})
