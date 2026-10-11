import {mkdir,writeFile} from 'node:fs/promises'
const {chromium,webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base=process.env.GAMES_QA_URL??'http://127.0.0.1:5191'
const tag=(process.env.GAMES_QA_TAG??'full').replace(/[^a-zA-Z0-9_-]/g,'_')
const out=new URL(`../../artifacts/games-audit/${tag}/`,import.meta.url).pathname
await mkdir(out,{recursive:true})
const engine=process.env.GAMES_QA_ENGINE==='webkit'?webkit:chromium
const browser = await engine.launch({headless:true,...(engine===chromium&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})})
const results=[]
const games=process.env.GAMES_QA_GAMES?.split(',')??['list','chess','falling_blocks','poker','pinball','yacht','orb_merge','ear_training','sudoku','minesweeper','solitaire','connect4','gomoku','reversi']
const sizes=process.env.GAMES_QA_QUICK?[{width:600,height:500}]:[{width:300,height:500},{width:600,height:500},{width:1200,height:800},{width:390,height:844},{width:844,height:390}]
try{
  for(const platform of ['plugin','web'])for(const size of sizes)for(const game of games){
    if(platform==='web'&&['sudoku','minesweeper','solitaire','connect4','gomoku','reversi'].includes(game))continue
    const page=await browser.newPage({viewport:size})
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`${base}/?platform=${platform}&game=${game}&arcade=${size.width>=520?1:0}&embedded=${process.env.GAMES_QA_EMBEDDED??0}&lang=${process.env.GAMES_QA_LANG??'en'}`)
    await page.waitForSelector('.game-view,.arcade,.game-cd-view',{timeout:20000}).catch(()=>{})
    await page.waitForTimeout(400)
    for(const state of ['lobby','playing']){
      if(state==='playing'){
        const start=page.locator('.pb-start-btn,.game-computer-btn').first()
        if(!await start.count())continue
        await start.click({timeout:2000}).catch(e=>errors.push(`start: ${e.message.split('\n')[0]}`))
        await page.waitForTimeout(450)
      }
      const metrics=await page.evaluate(()=>{
        const selectors=['.game-action-row','.game-finish-card','.game-board-wrap','.chess-board','.falling-blocks-board.is-self','.falling-blocks-board.is-opponent','.poker-actions','.pb-canvas-wrap','.om-canvas-wrap','.ms-board','.sd-board','.sol-board','.game-chat-inputrow','.arcade-row']
        const visible=el=>el.checkVisibility({visibilityProperty:true,opacityProperty:true})
        const rects=selectors.flatMap(selector=>Array.from(document.querySelectorAll(selector)).filter(visible).map(el=>{
          const r=el.getBoundingClientRect();let clip=null
          for(let p=el.parentElement;p;p=p.parentElement){const cs=getComputedStyle(p);if(cs.display==='contents')continue;if(['hidden','clip'].includes(cs.overflowY)||['hidden','clip'].includes(cs.overflowX)){
            const b=p.getBoundingClientRect();if(r.top<b.top-1||r.bottom>b.bottom+1||r.left<b.left-1||r.right>b.right+1){clip=p.className;break}
          }}
          return {selector,x:r.x,y:r.y,w:r.width,h:r.height,clip,scroll:el.scrollHeight-el.clientHeight}
        }))
        const canvas=Array.from(document.querySelectorAll('canvas')).filter(visible).map(c=>{
          const pixels=c.getContext('2d')?.getImageData(0,0,c.width,c.height).data??[];const colors=new Set()
          for(let i=0;i<pixels.length;i+=400)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]},${pixels[i+3]}`)
          return {width:c.width,height:c.height,colors:colors.size}
        })
        return {rects,canvas,documentOverflow:document.documentElement.scrollWidth-innerWidth}
      })
      const record={platform,size,game,state,errors:[...errors],...metrics};results.push(record)
      await page.screenshot({path:`${out}${platform}-${game}-${size.width}x${size.height}-${state}.png`})
      const bad=metrics.rects.filter(r=>r.clip&&r.selector!=='.arcade-row')
      console.log(JSON.stringify({platform,size,game,state,errors,bad,canvas:metrics.canvas}))
    }
    await page.close()
  }
}finally{await writeFile(`${out}report.json`,JSON.stringify(results,null,2));await browser.close()}
const failures=results.filter(r=>r.errors.length || r.documentOverflow>1 || r.rects.some(el=>el.clip && el.selector!=='.arcade-row') || r.canvas.some(c=>c.width<1 || c.height<1 || c.colors<2))
console.log(`${results.length} screen states checked; ${failures.length} failures`)
if(failures.length)process.exitCode=1
