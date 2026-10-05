import { callJuceNative, hasJuceNativeFunction } from './juceBridge.ts'

const DB_NAME='orb-chat-device-keys-v1'
const STORE_NAME='trusted-devices'
const CONTEXT='orb-chat-device-v1'

export interface WrappedRecoveryCode {v:1;iv:ArrayBuffer;ciphertext:ArrayBuffer}
interface TrustedDeviceRecord extends WrappedRecoveryCode {user:string;key:CryptoKey;createdAt:number}

const encoder=new TextEncoder(),decoder=new TextDecoder()
const additionalData=(user:string)=>encoder.encode(`${CONTEXT}:${user}`)

function nativeStorageAvailable(){return hasJuceNativeFunction('chatRecoveryKey')}
function callNative(params:string[]){return callJuceNative('chatRecoveryKey',params)}

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
    const result=await callNative(['load',user])
    if(result.startsWith('value:'))return result.slice(6)
    if(result==='missing')return null
    throw new Error('Could not read the device keychain.')
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

/** Insert-only: simultaneous windows must use the same durable identity. */
export async function ensureRememberedRecoveryCode(user:string,candidate:string){
  if(nativeStorageAvailable()){
    const result=await callNative(['create',user,candidate])
    if(result.startsWith('value:'))return result.slice(6)
    throw new Error('Could not prepare the device keychain.')
  }
  const key=await createDeviceWrappingKey(),wrapped=await wrapRecoveryCode(key,user,candidate)
  const db=await openDatabase()
  let record:TrustedDeviceRecord|undefined
  try{
    const transaction=db.transaction(STORE_NAME,'readwrite')
    const done=transactionDone(transaction)
    const store=transaction.objectStore(STORE_NAME)
    const request=store.get(user)
    request.onsuccess=()=>{
      record=request.result as TrustedDeviceRecord|undefined
      if(!record){
        record={...wrapped,user,key,createdAt:Date.now()}
        store.add(record)
      }
    }
    await done
    if(!record)throw new Error('Could not prepare device storage.')
    return await unwrapRecoveryCode(record.key,user,record)
  }finally{db.close()}
}
