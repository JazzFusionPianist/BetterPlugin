export interface RelayGrant { config:RTCConfiguration; expiresAt:number }
/** Each live session owns its credentials. Never share them across users/rooms. */
export class RelayLease {
 private stopped=false
 private timer:ReturnType<typeof setTimeout>|undefined
 private renewal:Promise<void>|undefined
 private grant:RelayGrant
 private load:()=>Promise<RelayGrant>
 private update:(config:RTCConfiguration)=>void
 private fail:()=>void
 constructor(initial:RelayGrant,load:()=>Promise<RelayGrant>,update:(config:RTCConfiguration)=>void,fail:()=>void){
  if(!RelayLease.valid(initial))throw new Error('Invalid media grant')
  this.grant=initial;this.load=load;this.update=update;this.fail=fail;this.schedule()
 }
 get config(){if(this.stopped || this.grant.expiresAt<=Date.now())throw new Error('Media authorization expired.');return this.grant.config}
 stop(){this.stopped=true;clearTimeout(this.timer);this.timer=undefined}
 private schedule(){this.timer=setTimeout(()=>void this.refresh(),Math.max(1000,this.grant.expiresAt-Date.now()-120000))}
 private static valid(grant:RelayGrant){
  return Number.isFinite(grant.expiresAt) && grant.expiresAt>=Date.now()+120000
   && grant.expiresAt<=Date.now()+660000 && grant.config.iceTransportPolicy==='relay'
   && Array.isArray(grant.config.iceServers) && grant.config.iceServers.length>0
 }
 refresh():Promise<void>{
  if(this.stopped)return Promise.resolve()
  if(this.renewal)return this.renewal
  this.renewal=(async()=>{
   try{
    const next=await this.load()
    if(this.stopped)return
    if(!RelayLease.valid(next))throw new Error('Invalid media grant')
    this.grant=next;this.update(next.config);clearTimeout(this.timer);this.schedule()
   }catch{if(!this.stopped){this.stop();this.fail()}}
   finally{this.renewal=undefined}
  })()
  return this.renewal
 }
}
