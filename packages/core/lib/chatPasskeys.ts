import { b64, unb64, cryptoReady, type Identity } from './chatCrypto.ts'
import { wrapPasskeyVault, unwrapPasskeyVault, type PasskeyVault } from './chatDeviceTransfer.ts'

type PRFResult={prf?:{enabled?:boolean;results?:{first?:ArrayBuffer}}}
const random=()=>crypto.getRandomValues(new Uint8Array(32))
const buffer=(value:string)=>Uint8Array.from(unb64(value)).buffer
function rp(){
  if(typeof window==='undefined' || location.protocol!=='https:' || !window.PublicKeyCredential || !navigator.credentials)
    throw new Error('Use an existing device to connect this device.')
  return location.hostname
}
async function evaluate(credentialId:string,salt:Uint8Array,rpId:string){
  const result=await navigator.credentials.get({publicKey:{challenge:random(),rpId,userVerification:'required',timeout:60000,
    allowCredentials:[{id:buffer(credentialId),type:'public-key'}],
    extensions:{prf:{eval:{first:Uint8Array.from(salt)}}} as AuthenticationExtensionsClientInputs}}) as PublicKeyCredential|null
  if(!result || b64(new Uint8Array(result.rawId))!==credentialId)throw new Error('Sign-in was cancelled.')
  const auth=result.response as AuthenticatorAssertionResponse
  if(!(new Uint8Array(auth.authenticatorData)[32]!&4))throw new Error('Device verification is required.')
  const prf=(result.getClientExtensionResults() as PRFResult).prf?.results?.first
  if(!prf || prf.byteLength!==32)throw new Error('This device does not support this sign-in method. Use an existing device instead.')
  return new Uint8Array(prf)
}
/** WebAuthn user presence is intentional; never trigger a prompt on mount. */
export async function createPasskeyBackup(identity:Identity,master:string){
  await cryptoReady();const rpId=rp(),salt=random()
  const created=await navigator.credentials.create({publicKey:{challenge:random(),rp:{id:rpId,name:'Slur'},
    user:{id:new TextEncoder().encode(identity.user_id),name:identity.user_id,displayName:'Slur'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{residentKey:'required',userVerification:'required'},attestation:'none',timeout:60000,
    extensions:{prf:{}} as AuthenticationExtensionsClientInputs}}) as PublicKeyCredential|null
  if(!created || !(created.getClientExtensionResults() as PRFResult).prf?.enabled)throw new Error('Use an existing device to connect new devices.')
  const credentialId=b64(new Uint8Array(created.rawId)),prf=await evaluate(credentialId,salt,rpId)
  try{return await wrapPasskeyVault(master,identity,credentialId,rpId,salt,prf)}finally{prf.fill(0)}
}
export async function restorePasskeyBackup(vault:PasskeyVault,identity:Identity){
  await cryptoReady();const rpId=rp()
  if(vault.rpId!==rpId)throw new Error('Open Slur on the website where this device was connected.')
  const prf=await evaluate(vault.credentialId,unb64(vault.salt),rpId)
  try{return await unwrapPasskeyVault(vault,identity,rpId,prf)}finally{prf.fill(0)}
}
