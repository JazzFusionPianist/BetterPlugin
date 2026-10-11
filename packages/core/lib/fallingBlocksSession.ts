const prefix='slur.falling-blocks.session.v1:'

export function readFallingBlocksSession<T>(userId:string, match:string):{state:T;started:number}|null {
  try {
    const saved=JSON.parse(localStorage.getItem(prefix+userId)??'null')
    const s=saved?.state
    if(saved?.match!==match || !Number.isFinite(saved.started) || !s) return null
    if(!Array.isArray(s.board) || s.board.length!==20 || !s.board.every((r:unknown)=>Array.isArray(r)&&r.length===10)) return null
    const piece=(v:unknown)=>typeof v==='string' && /^[IOTSZJL]$/.test(v)
    if(!s.board.every((r:unknown[])=>r.every(v=>v===null||piece(v)))) return null
    if(!Array.isArray(s.next)||!s.next.length||!s.next.every(piece)||!Array.isArray(s.bag)||!s.bag.every(piece)) return null
    if(s.current && (!piece(s.current.type)||!Number.isInteger(s.current.row)||!Number.isInteger(s.current.col)||![0,1,2,3].includes(s.current.rotation))) return null
    if(!Number.isFinite(s.score)||!Number.isFinite(s.lines)||typeof s.topOut!=='boolean') return null
    return {state:s as T,started:saved.started}
  } catch {return null}
}

export function writeFallingBlocksSession(userId:string,match:string,state:unknown,started:number):void {
  try {localStorage.setItem(prefix+userId,JSON.stringify({match,state,started}))} catch { /* Storage may be unavailable in a WebView. */ }
}
