/** Signatures catch format confusion, not malware. Generic private files download as attachments. */
export function matchesFileType(bytes:Uint8Array,mime:string,privateFile:boolean){
  const text=(offset:number,size:number)=>new TextDecoder('latin1').decode(bytes.slice(offset,offset+size))
  // Includes legacy encrypted blobs and DAW formats without a browser MIME type.
  if(privateFile && mime==='application/octet-stream')return bytes.length>0
  switch(mime){
    case 'image/png':return bytes[0]===137 && text(1,3)==='PNG' && bytes[4]===13 && bytes[5]===10
    case 'image/jpeg':return bytes[0]===255 && bytes[1]===216 && bytes[2]===255
    case 'image/gif':return ['GIF87a','GIF89a'].includes(text(0,6))
    case 'image/webp':return text(0,4)==='RIFF' && text(8,4)==='WEBP'
    case 'audio/wav':case 'audio/x-wav':case 'audio/wave':return ['RIFF','RF64'].includes(text(0,4)) && text(8,4)==='WAVE'
    case 'audio/aiff':case 'audio/x-aiff':return text(0,4)==='FORM' && ['AIFF','AIFC'].includes(text(8,4))
    case 'audio/flac':case 'audio/x-flac':return text(0,4)==='fLaC'
    case 'audio/ogg':case 'audio/opus':return text(0,4)==='OggS'
    case 'audio/mpeg':case 'audio/mp3':return text(0,3)==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224)
    case 'audio/aac':return bytes[0]===255 && (bytes[1]&246)===240
    case 'video/mp4':case 'video/quicktime':return privateFile && (text(4,4)==='ftyp'||text(4,4)==='moov'||text(4,4)==='mdat')
    case 'application/zip':return privateFile && bytes[0]===80 && bytes[1]===75 && ((bytes[2]===3&&bytes[3]===4)||(bytes[2]===5&&bytes[3]===6)||(bytes[2]===7&&bytes[3]===8))
    case 'audio/mp4':case 'audio/x-m4a':case 'audio/m4a':return text(4,4)==='ftyp'
    case 'audio/midi':case 'audio/x-midi':return text(0,4)==='MThd'
    case 'video/webm':return privateFile && bytes[0]===26 && bytes[1]===69 && bytes[2]===223 && bytes[3]===163
    case 'audio/webm':return bytes[0]===26 && bytes[1]===69 && bytes[2]===223 && bytes[3]===163
    default:return false
  }
}
