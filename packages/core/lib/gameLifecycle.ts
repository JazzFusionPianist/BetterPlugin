import type {SupabaseClient} from '@supabase/supabase-js'

/** A terminal transition must be acknowledged, not inferred from a realtime event. */
export async function finishGameRoom<T>(client:SupabaseClient, table:string, id:string, patch:Record<string,unknown>):Promise<T> {
  const {data,error}=await client.from(table).update({...patch,status:'finished'}).eq('id',id).select().single()
  if(error) throw error
  if(!data) throw new Error('The game could not be closed. Please retry.')
  return data as T
}

export function isLocalComputerRoom(room:{id:string}|null):boolean {
  return !!room?.id.startsWith('computer:')
}
