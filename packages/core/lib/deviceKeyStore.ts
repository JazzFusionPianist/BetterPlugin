const DB_NAME='orb-chat-device-keys-v1'
const STORE_NAME='trusted-devices'
const CONTEXT='orb-chat-device-v1'

export interface WrappedRecoveryCode {v:1;iv:ArrayBuffer;ciphertext:ArrayBuffer}
interface TrustedDeviceRecord extends WrappedRecoveryCode {user:string;key:CryptoKey;createdAt:number}

const encoder=new TextEncoder(),decoder=new TextDecoder()
const additionalData=(user:string)=>encoder.encode(`${CONTEXT}:${user}`)

type JuceBackend={
  addEventListener:(event:string,handler:(data:unknown)=>void)=>void
  removeEventListener:(event:string,handler:(data:unknown)=>void)=>void
  emitEvent:(event:string,data:unknown)=>void
}
type JuceHost={initialisationData?:{__juce__functions?:string[]};backend?:JuceBackend}
let nativeCallId=0
function juceHost(){return typeof window==='undefined'?undefined:(window as unknown as {__JUCE__?:JuceHost}).__JUCE__}
function nativeStorageAvailable(){const host=juceHost();return !!host?.backend && !!host.initialisationData?.__juce__functions?.includes('chatRecoveryKey')}
function callNative(params:string[]){
  return new Promise<string>((resolve,reject)=>{
    const host=juceHost(),backend=host?.backend
    if(!backend || !nativeStorageAvailable()){reject(new Error('Native trusted device storage is unavailable.'));return}
    const promiseId=nativeCallId++
    let finished=false
    const handler=(value:unknown)=>{
      const data=value as {promiseId?:number;result?:string}
      if(data.promiseId!==promiseId || finished)return
      finished=true;clearTimeout(timer);backend.removeEventListener('__juce__complete',handler);resolve(String(data.result??''))
    }
    const timer=setTimeout(()=>{if(finished)return;finished=true;backend.removeEventListener('__juce__complete',handler);reject(new Error('Native trusted device storage timed out.'))},5000)
    backend.addEventListener('__juce__complete',handler)
    backend.emitEvent('__juce__invoke',{name:'chatRecoveryKey',params,resultId:promiseId})
  })
}

export function trustedDeviceStorageAvailable(){
  return nativeStorageAvailable() || (typeof indexedDB!=='undefined' && typeof crypto!=='undefined' && !!crypto.subtle)
}

export async function createDeviceWrappingKey():Promise<CryptoKey>{
  return crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']) as Promise<CryptoKey>
}

export async function wrapRecoveryCode(key:CryptoKey,user:string,code:string):Promise<WrappedRecoveryCode>{
  const iv=crypto.getRandomValues(new Uint8Array(12)).buffer
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:additionalData(user),tagLength:128},key,encoder.encode(code.trim()))
  return {v:1,iv,ciphertext}
}

export async function unwrapRecoveryCode(key:CryptoKey,user:string,wrapped:WrappedRecoveryCode){
  if(wrapped.v!==1 || !(wrapped.iv instanceof ArrayBuffer) || wrapped.iv.byteLength!==12 || !(wrapped.ciphertext instanceof ArrayBuffer))throw new Error('Invalid trusted device key.')
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:wrapped.iv,additionalData:additionalData(user),tagLength:128},key,wrapped.ciphertext)
  return decoder.decode(plaintext)
}

function openDatabase(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    if(!trustedDeviceStorageAvailable()){reject(new Error('Trusted device storage is unavailable.'));return}
    const request=indexedDB.open(DB_NAME,1)
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME,{keyPath:'user'})}
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error??new Error('Could not open trusted device storage.'))
    request.onblocked=()=>reject(new Error('Trusted device storage is blocked.'))
  })
}

function requestResult<T>(request:IDBRequest<T>){
  return new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error('Trusted device storage failed.'))})
}

function transactionDone(transaction:IDBTransaction){
  return new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onabort=transaction.onerror=()=>reject(transaction.error??new Error('Trusted device storage failed.'))})
}

export async function rememberRecoveryCode(user:string,code:string){
  if(nativeStorageAvailable()){
    const result=await callNative(['store',user,code.trim()])
    if(result==='ok')return
    throw new Error('Could not store recovery key in the system keychain.')
  }
  const key=await createDeviceWrappingKey(),wrapped=await wrapRecoveryCode(key,user,code)
  const db=await openDatabase()
  try{
    const transaction=db.transaction(STORE_NAME,'readwrite')
    transaction.objectStore(STORE_NAME).put({...wrapped,user,key,createdAt:Date.now()} satisfies TrustedDeviceRecord)
    await transactionDone(transaction)
  }finally{db.close()}
}

export async function loadRememberedRecoveryCode(user:string){
  if(nativeStorageAvailable()){
    try{const result=await callNative(['load',user]);return result.startsWith('value:')?result.slice(6):null}catch{return null}
  }
  if(!trustedDeviceStorageAvailable())return null
  try{
    const db=await openDatabase()
    try{
      const transaction=db.transaction(STORE_NAME,'readonly')
      const record=await requestResult(transaction.objectStore(STORE_NAME).get(user)) as TrustedDeviceRecord|undefined
      await transactionDone(transaction)
      if(!record)return null
      try{return await unwrapRecoveryCode(record.key,user,record)}
      catch{await forgetRememberedRecoveryCode(user).catch(()=>{});return null}
    }finally{db.close()}
  }catch{return null}
}

export async function forgetRememberedRecoveryCode(user:string){
  if(nativeStorageAvailable()){
    const result=await callNative(['delete',user])
    if(result==='ok')return
    throw new Error('Could not delete recovery key from the system keychain.')
  }
  if(!trustedDeviceStorageAvailable())return
  const db=await openDatabase()
  try{
    const transaction=db.transaction(STORE_NAME,'readwrite')
    transaction.objectStore(STORE_NAME).delete(user)
    await transactionDone(transaction)
  }finally{db.close()}
}
