export interface ChatBootstrapOperations {
  unlocked(user:string):boolean
  assertCurrent(user:string):Promise<void>
  registered():Promise<boolean>
  load(user:string):Promise<string|null>
  matches?(user:string,code:string):Promise<boolean>
  create():Promise<string>
  ensure(user:string,candidate:string):Promise<string>
  unlock(user:string,code:string):Promise<void>
}

/** Coalesce React remounts; storage itself must also arbitrate other windows. */
export function createChatBootstrap(operations:ChatBootstrapOperations){
  const pending=new Map<string,Promise<'ready'|'restore'>>()
  async function prepare(user:string):Promise<'ready'|'restore'>{
    await operations.assertCurrent(user)
    if(operations.unlocked(user))return 'ready'
    const registered=await operations.registered()
    let code=await operations.load(user)
    // Never replace an identity whose messages may already exist elsewhere.
    if(registered&&!code)return 'restore'
    if(registered&&code&&operations.matches&&!await operations.matches(user,code))return 'restore'
    if(!code){
      const candidate=await operations.create()
      await operations.assertCurrent(user)
      code=await operations.ensure(user,candidate)
    }
    // No public registration until durable storage has been read back.
    if(!code || await operations.load(user)!==code)throw new Error('Device storage could not be verified.')
    await operations.assertCurrent(user)
    try { await operations.unlock(user,code) }
    catch(error){
      await operations.assertCurrent(user)
      if(operations.matches && await operations.registered() && !await operations.matches(user,code))return 'restore'
      throw error
    }
    return 'ready'
  }
  return (user:string)=>{
    const existing=pending.get(user)
    if(existing)return existing
    const task=prepare(user).finally(()=>{if(pending.get(user)===task)pending.delete(user)})
    pending.set(user,task)
    return task
  }
}
