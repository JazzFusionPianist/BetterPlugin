/** Compatibility entrypoint for the existing scheduler. All deletion work now
 * uses the authenticated durable queue; never infer deletion from pasted URLs.
 * Set CRON_SECRET to the same server-only value as the API worker.
 */
Deno.serve(async(req:Request)=>{
  const secret=Deno.env.get('CRON_SECRET')
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const auth=req.headers.get('authorization')
  if(!secret)return Response.json({error:'Cleanup is not configured'},{status:503})
  if(auth!==`Bearer ${secret}` && (!serviceKey || auth!==`Bearer ${serviceKey}`))return Response.json({error:'Unauthorized'},{status:401})
  if(req.method!=='POST' && req.method!=='GET')return Response.json({error:'Method not allowed'},{status:405})
  try{
    const response=await fetch('https://better-plugin.vercel.app/api/security-cleanup',{
      method:'POST',headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(50000),redirect:'error',
    })
    if(!response.ok)return Response.json({error:'Cleanup unavailable; queued work will retry'},{status:502})
    return new Response(await response.text(),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
  }catch{return Response.json({error:'Cleanup unavailable; queued work will retry'},{status:502})}
})
