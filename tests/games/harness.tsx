import {createRoot} from 'react-dom/client'
import {useState} from 'react'
import {GameSurface,useGameViewport} from '../../packages/core/hooks/useGameSurface'
import type {SupabaseClient} from '@supabase/supabase-js'
import {LanguageProvider as PluginLanguage} from '../../apps/plugin/src/i18n/LanguageContext'
import {LanguageProvider as WebLanguage} from '../../apps/web/lib/games/i18n'
import {ArcadeContext as PluginArcade} from '../../apps/plugin/src/components/collab/ArcadeLobby'
import {ArcadeContext as WebArcade} from '../../apps/web/components/games/ArcadeLobby'
import PluginLobby from '../../apps/plugin/src/components/collab/ArcadeLobby'
import WebLobby from '../../apps/web/components/games/ArcadeLobby'
import PluginList from '../../apps/plugin/src/components/collab/GameListView'
import WebList from '../../apps/web/components/games/GameListView'
import {useGameChat} from '../../packages/core/hooks/useGameChat'

// Exercise audio scheduling without sending hidden QA playback to the speakers.
if (new URLSearchParams(location.search).get('audio') !== '1') {
  const connect = AudioNode.prototype.connect
  AudioNode.prototype.connect = function (...args: Parameters<AudioNode['connect']>) {
    if (args[0] instanceof AudioDestinationNode) return args[0]
    return Reflect.apply(connect, this, args)
  } as AudioNode['connect']
}

// Local in-memory transport: no credentials, external requests or production writes.
const tables=new Map<string,Record<string,any>[]>()
const listeners=new Set<any>()
let failure:{table:string;action:string}|null=null
const user='90000000-0000-4000-8000-000000000001'
const me={id:user,display_name:'Player with a long display name',username:'player',initials:'P',avatar_color:'#1e9e63',isOnline:true}
const friends=Array.from({length:12},(_,i)=>({...me,id:`friend-${i}`,display_name:`Friend with a long name ${i}`,initials:'F'}))
for (const name of ['pinball','falling_blocks','yacht','orb_merge','sudoku','minesweeper','solitaire']) {
  tables.set(`${name}_scores`, friends.slice(0,10).map((p,i)=>({user_id:p.id,best_score:100000-i*1000,plays:1,updated_at:new Date().toISOString(),profiles:p})))
}
function query(table:string){
  let action='select',values:any,one=false,cap=Infinity,sort:any,filters:((r:any)=>boolean)[]=[]
  const q:any={
    select:()=>q,order:(key:string,options:any)=>{sort={key,ascending:options?.ascending!==false};return q},limit:(n:number)=>{cap=n;return q},
    eq:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q},
    neq:(k:string,v:any)=>{filters.push(r=>r[k]!==v);return q},
    is:(k:string,v:any)=>{filters.push(r=>(r[k]??null)===v);return q},
    contains:(k:string,v:any[])=>{filters.push(r=>v.every(x=>r[k]?.includes(x)));return q},
    in:(k:string,v:any[])=>{filters.push(r=>v.includes(r[k]));return q},
    gt:(k:string,v:any)=>{filters.push(r=>r[k]>v);return q},or:()=>q,not:()=>q,
    insert:(v:any)=>{action='insert';values=v;return q},upsert:(v:any)=>{action='upsert';values=v;return q},
    update:(v:any)=>{action='update';values=v;return q},delete:()=>{action='delete';return q},
    single:()=>{one=true;return q},maybeSingle:()=>{one=true;return q},
    then:(resolve:any,reject:any)=>Promise.resolve().then(()=>{
      if(failure?.table===table && failure.action===action) {failure=null;return {data:null,error:{message:'Test write rejected'}}}
      const rows=tables.get(table)??[];tables.set(table,rows)
      let result=rows.filter(r=>filters.every(f=>f(r)))
      if(action==='insert'||action==='upsert'){
        result=(Array.isArray(values)?values:[values]).map(v=>{
          const old=action==='upsert'?rows.find(r=>v.room_id?r.room_id===v.room_id&&r.user_id===v.user_id:r.id===v.id):null
          if(old){Object.assign(old,v);return old}
          const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),guest_id:null,ready_ids:[],state:{},...v};rows.push(row);return row
        })
      }else if(action==='update')result.forEach(r=>Object.assign(r,values))
      else if(action==='delete')tables.set(table,rows.filter(r=>!result.includes(r)))
      if(action!=='select')queueMicrotask(()=>{
        for(const row of result)for(const l of listeners){
          if(l.table!==table)continue
          if(l.filter){const [key,value]=l.filter.split('=eq.');if(String(row[key])!==value)continue}
          l.callback({new:{...row},old:{...row},eventType:action==='delete'?'DELETE':action==='insert'?'INSERT':'UPDATE'})
        }
      })
      const count=result.length
      if(sort)result.sort((a,b)=>(typeof a[sort.key]==='number'?a[sort.key]-b[sort.key]:String(a[sort.key]).localeCompare(String(b[sort.key])))*(sort.ascending?1:-1))
      result=result.slice(0,cap)
      return {data:one?result[0]??null:result.map(r=>({...r})),error:null,count}
    }).then(resolve,reject),
  };return q
}
const transport={from:query,rpc:async(name:string,args:any)=>{
  if(name==='poker_deal_hand')await query('poker_hole_cards').upsert(Object.entries(args.p_hole_cards).map(([user_id,cards])=>({room_id:args.p_room_id,user_id,cards})))
  return {data:null,error:null}
},
  channel:()=>{const own:any[]=[];const channel:any={on:(_:any,opts:any,callback:any)=>{const l={...opts,callback};listeners.add(l);own.push(l);return channel},subscribe:()=>channel,unsubscribe:()=>own.forEach(l=>listeners.delete(l))};return channel},
  removeChannel:(c:any)=>c.unsubscribe(),auth:{getUser:async()=>({data:{user:{id:user}},error:null}),getSession:async()=>({data:{session:null}})},
} as unknown as SupabaseClient
const params=new URLSearchParams(location.search)
const platform=params.get('platform')??'plugin',game=params.get('game')??'list',arcade=params.get('arcade')==='1'
const playerCount=Number(params.get('players'))
if(game==='falling_blocks' && playerCount>=2 && playerCount<=4) {
  const player_ids=[user,...friends.slice(0,playerCount-1).map(p=>p.id)]
  const id='qa-falling-blocks-room',now=new Date().toISOString()
  tables.set('falling_blocks_rooms',[{id,host_id:user,status:'playing',player_count:playerCount,player_ids,ready_ids:player_ids,winner_id:null,created_at:now,updated_at:now}])
  tables.set('falling_blocks_player_states',player_ids.map(user_id=>({room_id:id,user_id,board:Array.from({length:20},()=>Array(10).fill(null)),score:0,lines:0,top_out:false,garbage_pending:0,updated_at:now})))
  sessionStorage.setItem('join_room_id',id)
}
if(platform==='plugin'){
  await import('../../apps/plugin/src/pages/collab.css')
  await import('../../apps/plugin/src/pages/arcade.css')
}else{
  await import('../../apps/web/app/globals.css')
  await import('../../apps/web/app/games.css')
  await import('../../apps/web/app/arcade.css')
}
localStorage.setItem('orb_lang',params.get('lang')??'en')
const paths={chess:'ChessView',chess_3d:'Chess3DView',falling_blocks:'FallingBlocksView',poker:'PokerView',pinball:'PinballView',yacht:'YachtView',orb_merge:'OrbMergeView',ear_training:'EarTrainingView',sudoku:'SudokuView',minesweeper:'MinesweeperView',solitaire:'SolitaireView',connect4:'BoardGameView',gomoku:'BoardGameView',reversi:'BoardGameView'}
const pluginModules=import.meta.glob('../../apps/plugin/src/components/collab/*View.tsx')
const webModules=import.meta.glob('../../apps/web/components/games/*View.tsx')
const prefix=platform==='plugin'?'../../apps/plugin/src/components/collab/':'../../apps/web/components/games/'
const module=['list','chat'].includes(game)?null:await (platform==='plugin'?pluginModules:webModules)[`${prefix}${paths[game as keyof typeof paths]}.tsx`]() as any
const View=module?.default
function ChatFixture() {
  const [room,setRoom]=useState('A')
  const chat=useGameChat(transport,user,room)
  Object.assign(window.gamesQA,{chat,room:setRoom,insert:(content:string,room_id=room)=>transport.from('game_chats').insert({content,room_id,sender_id:user})})
  return <div style={{height:200,overflow:'auto'}} ref={chat.scrollRef} onScroll={chat.onScroll} data-chat>
    {chat.messages.map(m=><div key={m.id} style={{height:30}} data-message>{m.content}</div>)}
  </div>
}
function Harness(){
  const {ref,spacious}=useGameViewport()
  const [hidden,setHidden]=useState(false)
  const [closed,setClosed]=useState(false)
  const [epoch,setEpoch]=useState(0)
  Object.assign(window,{gamesQA:{...window.gamesQA,hide:setHidden,tables,
    failNext:(table:string,action='update')=>{failure={table,action}},
    reopen:(resume=false)=>{
      sessionStorage.removeItem('join_room_id')
      const table=(game==='chess'||game==='chess_3d')?'game_rooms':game==='connect4'||game==='gomoku'||game==='reversi'?'board_rooms':`${game}_rooms`
      const room=tables.get(table)?.find(r=>r.status==='playing')
      if(resume && room)sessionStorage.setItem('join_room_id',room.id)
      setClosed(false);setEpoch(n=>n+1)
    },
    update:(table:string,id:string,values:any)=>transport.from(table).update(values).eq('id',id)}})
  const common={supabase:transport,currentUserId:user,currentUserProfile:me,friendProfiles:friends,onlineIds:new Set(friends.map(p=>p.id)),onClose:()=>setClosed(true)}
  const skin=arcade&&(game==='list'||spacious)
  const cls=platform==='plugin'?`plugin games game-open ${skin?'screen-wide arcade-skin':params.get('embedded')==='1'?'screen-wide':''} ${game!=='list'?`gwall-${game} dark`:''}`:`games-panel ${skin?'arcade-skin':''} ${game!=='list'?`wall-${game}`:''}`
  const listProps={onSelectGame:()=>{},onClose:()=>{},inviteContext:null}
  const content=closed?<p data-closed>Closed</p>:game==='chat'?<ChatFixture/>:game==='list'?(skin?(platform==='plugin'?<PluginLobby {...listProps}/>:<WebLobby {...listProps}/>):(platform==='plugin'?<PluginList {...listProps}/>:<WebList {...listProps}/>)):<View key={epoch} {...common} game={game}/>
  return <><div ref={ref} className={cls} hidden={hidden} style={{width:'100%',height:'100%',position:'relative',inset:0}}>
    <GameSurface visible={!hidden}>{platform==='plugin'?<PluginLanguage><PluginArcade.Provider value={skin}><div className="content"><div className="view gview">{content}</div></div></PluginArcade.Provider></PluginLanguage>:<WebLanguage><WebArcade.Provider value={skin}>{content}</WebArcade.Provider></WebLanguage>}</GameSurface>
  </div><input id="outside-input" aria-label="Outside game" style={{position:'fixed',bottom:0,left:0,display:hidden?'block':'none'}}/></>
}
const style=document.createElement('style')
style.textContent='html,body,#root{margin:0!important;width:100%;height:100%;overflow:hidden} [hidden]{display:none!important} .plugin>.content{height:100%;inset:0;top:0} .gview{height:100%} body{--paper:#FBFAF7;--ink:#1A1917;--blue:#2440FF;--f-sans:Arial,sans-serif;--f-serif:Arial,sans-serif;--f-mono:monospace} .game-view{animation:none!important}'
document.head.append(style)
createRoot(document.getElementById('root')!).render(<Harness/> )
