import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/** One thing a room has to do — a person and a day read from the line. */
export interface RoomTask {
  id: string
  conversation_id: string | null
  created_by: string
  assignee_id: string | null
  title: string
  note: string | null
  due_on: string | null
  done_at: string | null
  done_by: string | null
  position: number
  created_at: string
}

export interface NewTask { title: string; note?: string | null; assignee_id?: string | null; due_on?: string | null }

const sortTasks = (a: RoomTask, b: RoomTask) =>
  Number(!!a.done_at) - Number(!!b.done_at)
  || (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999')
  || a.created_at.localeCompare(b.created_at)

/** A room's tasks (or, with conversationId null, nothing — personal tasks
 *  come through useMyTasks). Realtime on the table keeps the room in step. */
export function useRoomTasks(supabase: SupabaseClient, conversationId: string | null, userId: string) {
  const [tasks, setTasks] = useState<RoomTask[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!conversationId) { setTasks([]); setLoaded(true); return }
    const { data, error } = await supabase.from('room_tasks').select('*').eq('conversation_id', conversationId)
    if (error) { console.error('[tasks] fetch', error.message); setLoaded(true); return }
    setTasks(((data ?? []) as RoomTask[]).sort(sortTasks))
    setLoaded(true)
  }, [supabase, conversationId])

  useEffect(() => { setLoaded(false); void refresh() }, [refresh])
  useEffect(() => {
    if (!conversationId) return
    const ch = supabase.channel(`tasks:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_tasks', filter: `conversation_id=eq.${conversationId}` }, () => { void refresh() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, conversationId, refresh])

  const add = useCallback(async (t: NewTask): Promise<string | null> => {
    const { error } = await supabase.from('room_tasks').insert({
      conversation_id: conversationId, created_by: userId,
      title: t.title.trim(), note: t.note?.trim() || null, assignee_id: t.assignee_id ?? null, due_on: t.due_on ?? null,
    })
    if (error) { console.error('[tasks] add', error.message); return error.message }
    await refresh()
    return null
  }, [supabase, conversationId, userId, refresh])

  const setDone = useCallback(async (id: string, done: boolean): Promise<string | null> => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done_at: done ? new Date().toISOString() : null, done_by: done ? userId : null } : t).sort(sortTasks))
    const { error } = await supabase.from('room_tasks').update({ done_at: done ? new Date().toISOString() : null, done_by: done ? userId : null }).eq('id', id)
    if (error) { console.error('[tasks] done', error.message); await refresh(); return error.message }
    return null
  }, [supabase, userId, refresh])

  const remove = useCallback(async (id: string): Promise<string | null> => {
    setTasks(prev => prev.filter(t => t.id !== id))
    const { error } = await supabase.from('room_tasks').delete().eq('id', id)
    if (error) { console.error('[tasks] remove', error.message); await refresh(); return error.message }
    return null
  }, [supabase, refresh])

  return { tasks, loaded, refresh, add, setDone, remove }
}

/** Everything open with a day that is mine — assigned to me, or written
 *  by me with no one assigned — for the home's week. */
export function useMyTasks(supabase: SupabaseClient, userId: string) {
  const [tasks, setTasks] = useState<RoomTask[]>([])
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('room_tasks').select('*')
      .is('done_at', null).not('due_on', 'is', null)
      .or(`assignee_id.eq.${userId},and(assignee_id.is.null,created_by.eq.${userId})`)
    if (error) { console.error('[tasks] mine', error.message); return }
    setTasks(((data ?? []) as RoomTask[]).sort(sortTasks))
  }, [supabase, userId])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const ch = supabase.channel(`tasks-mine:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_tasks' }, () => { void refresh() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, userId, refresh])
  return { tasks, refresh }
}
