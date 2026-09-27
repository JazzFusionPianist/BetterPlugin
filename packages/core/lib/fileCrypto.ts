import sodium from 'libsodium-wrappers'
import { b64, unb64 } from './chatCrypto.ts'
const CHUNK=1024*1024
const MAX=1024*1024*1024
const MAGIC=new TextEncoder().encode('ORBFIL01')
function part(bytes:Uint8Array):ArrayBuffer{return new Uint8Array(bytes).buffer}
function frame(bytes:Uint8Array):BlobPart[]{const length=new ArrayBuffer(4);new DataView(length).setUint32(0,bytes.length,true);return [length,part(bytes)]}
export async function encryptFile(file:File):Promise<{blob:Blob;key:string}>{
  await sodium.ready
  if(file.size<1 || file.size>MAX)throw new Error('File size limit exceeded.')
  const key=sodium.crypto_secretstream_xchacha20poly1305_keygen()
  const stream=sodium.crypto_secretstream_xchacha20poly1305_init_push(key)
  try{
    const out:BlobPart[]=[part(MAGIC),part(stream.header)]
    const metadata=JSON.stringify({mime:file.type||'application/octet-stream',name:file.name,size:file.size})
    out.push(...frame(sodium.crypto_secretstream_xchacha20poly1305_push(stream.state,metadata,null,sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE)))
    for(let offset=0;offset<file.size;offset+=CHUNK){
      const bytes=new Uint8Array(await file.slice(offset,offset+CHUNK).arrayBuffer())
      out.push(...frame(sodium.crypto_secretstream_xchacha20poly1305_push(stream.state,bytes,null,
        offset+CHUNK>=file.size?sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL:sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE)))
    }
    return {blob:new Blob(out,{type:'application/octet-stream'}),key:b64(key)}
  }finally{sodium.memzero(key)}
}
export async function decryptFile(blob:Blob,secret:string):Promise<Blob>{
  await sodium.ready
  if(blob.size>MAX+65536 || blob.size<36)throw new Error('Invalid encrypted file size.')
  const key=unb64(secret),header=new Uint8Array(await blob.slice(0,32).arrayBuffer())
  if(key.length!==32 || !sodium.memcmp(header.slice(0,8),MAGIC))throw new Error('Invalid encrypted file.')
  const state=sodium.crypto_secretstream_xchacha20poly1305_init_pull(header.slice(8),key)
  sodium.memzero(key)
  const out:BlobPart[]=[];let offset=32,total=0,ended=false,metadata:{mime:string;size:number}|undefined
  while(offset<blob.size){
    if(ended || offset+4>blob.size)throw new Error('Invalid file frame.')
    const length=new DataView(await blob.slice(offset,offset+4).arrayBuffer()).getUint32(0,true);offset+=4
    if(length<17 || length>CHUNK+17 || offset+length>blob.size)throw new Error('Invalid file frame.')
    const clear=sodium.crypto_secretstream_xchacha20poly1305_pull(state,new Uint8Array(await blob.slice(offset,offset+length).arrayBuffer()),null)
    if(!clear)throw new Error('File authentication failed.')
    offset+=length
    if(!metadata){metadata=JSON.parse(sodium.to_string(clear.message));if(!metadata || !Number.isSafeInteger(metadata.size) || metadata.size<1 || metadata.size>MAX || typeof metadata.mime!=='string')throw new Error('Invalid metadata.')}
    else{out.push(part(clear.message));total+=clear.message.length;if(total>MAX)throw new Error('File size limit exceeded.')}
    ended=clear.tag===sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
  }
  if(!ended || total!==metadata?.size)throw new Error('Encrypted file was truncated.')
  // Never create an executable same-origin HTML/SVG blob from a sender's MIME.
  const mime=/^(audio\/(mpeg|mp3|wav|x-wav|wave|flac|ogg|mp4|aac|webm|opus)|video\/(mp4|webm|ogg)|image\/(png|jpeg|gif|webp|avif))$/i.test(metadata.mime)?metadata.mime:'application/octet-stream'
  return new Blob(out,{type:mime})
}
