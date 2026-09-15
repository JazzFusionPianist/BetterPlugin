'use client'

/**
 * Studio bits ported from the Orb Chat plug-in's StudioShell.tsx —
 * the home programme rows, the todo lane, and the notes tab
 * (conversation_notes documents). Byte-for-byte where possible.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarEvent } from '@orb/core'

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}


interface TodoRow {
  id: string
  user_id: string
  content: string
  done: boolean
  created_at: string
}

export function useTodos(supabase: SupabaseClient, userId: string) {
  const [todos, setTodos] = useState<TodoRow[]>([])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) { console.error('[StudioTodos] load failed', error); return }
    setTodos((data ?? []) as TodoRow[])
  }, [supabase, userId])

  useEffect(() => {
    void refresh()
    const ch = supabase
      .channel(`studio-todos:${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` },
        () => { void refresh() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, userId, refresh])

  const add = useCallback(async (content: string) => {
    const { error } = await supabase.from('todos').insert({ user_id: userId, content })
    if (error) { console.error('[StudioTodos] add failed', error); throw error }
    await refresh()
  }, [supabase, userId, refresh])

  const toggle = useCallback(async (t: TodoRow) => {
    setTodos(prev => prev.map(x => x.id === t.id ? { ...x, done: !t.done } : x))
    const { error } = await supabase.from('todos').update({ done: !t.done }).eq('id', t.id)
    if (error) { console.error('[StudioTodos] toggle failed', error); void refresh() }
  }, [supabase, refresh])

  const clearDone = useCallback(async () => {
    setTodos(prev => prev.filter(x => !x.done))
    const { error } = await supabase.from('todos').delete().eq('user_id', userId).eq('done', true)
    if (error) { console.error('[StudioTodos] clear failed', error); void refresh() }
  }, [supabase, userId, refresh])

  return { todos, add, toggle, clearDone }
}

/** Programme-margin upcoming list — date column · time · title, hairline
 *  separators, today in the accent. Shared by the home pane and the
 *  "my calendar" view (mirrors the web app's UpcomingList split). */
export function UpcomingRows({ events, groupTitleById, limit, nowTick }: {
  events: CalendarEvent[]; groupTitleById: Map<string, string>; limit: number; nowTick: number
}) {
  const rows = useMemo(() => {
    const now = new Date(nowTick)
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return events
      .filter(e => new Date(e.starts_at) >= (e.all_day ? dayStart : now))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, limit)
  }, [events, limit, nowTick])

  if (rows.length === 0) {
    return <div className="wd-up"><div className="wd-up-head">upcoming</div>
      <div className="wd-up-none">nothing scheduled — enjoy the quiet</div></div>
  }

  const now = new Date(nowTick)
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const label = (iso: string): { text: string; today: boolean } => {
    const d = new Date(iso)
    const days = Math.floor(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - dayStart.getTime()) / 86400000)
    if (days <= 0) return { text: 'today', today: true }
    if (days === 1) return { text: 'tomorrow', today: false }
    if (days < 7) return { text: d.toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase(), today: false }
    return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase(), today: false }
  }

  return (
    <div className="wd-up">
      <div className="wd-up-head">upcoming</div>
      {rows.map(e => {
        const l = label(e.starts_at)
        return (
          <div key={e.id} className="wd-up-row">
            <span className={`wd-up-date${l.today ? ' today' : ''}`}>{l.text}</span>
            <span className="wd-up-time">{e.all_day ? 'all day' : fmtTime(e.starts_at)}</span>
            <span className="wd-up-title">{e.title}</span>
            {e.conversation_id && (
              <span className="wd-up-from">{groupTitleById.get(e.conversation_id) ?? ''}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export interface NoteRow {
  id: string
  conversation_id: string
  title: string
  content: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** "just now" → "4m ago" → "2h ago" → "yesterday" → "12 aug". */
function relTime(iso: string, now: number): string {
  const min = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (min < 24 * 60) return `${Math.floor(min / 60)}h ago`
  const d = new Date(iso)
  const dayStart = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  const days = Math.floor((dayStart(new Date(now)) - dayStart(d)) / 86400000)
  if (days <= 1) return 'yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase()
}

/** Tags the note toolbar can produce — everything else is unwrapped. */
const NOTE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'H3', 'P', 'BR', 'DIV'])

/** Small allowlist sanitizer for note HTML. script/style subtrees are
 *  dropped whole; other off-list tags are unwrapped (children kept);
 *  every attribute is stripped. Applied before save AND before any
 *  remote HTML touches the editor. */
function sanitizeNoteHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const clean = (node: Element) => {
    for (const el of Array.from(node.children)) {
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') { el.remove(); continue }
      clean(el)
      if (NOTE_TAGS.has(el.tagName)) {
        for (const a of Array.from(el.attributes)) el.removeAttribute(a.name)
      } else {
        const parent = el.parentNode
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el)
          el.remove()
        }
      }
    }
  }
  clean(doc.body)
  return doc.body.innerHTML
}

/** Decode a tagless HTML fragment back to plain text (entities → chars). */
function htmlToText(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
}

/** One-line plain preview of note content, HTML or legacy plain text. */
function noteSnippet(content: string): string {
  const plain = content.includes('<')
    ? htmlToText(content.replace(/<br\s*\/?>/gi, ' ').replace(/></g, '> <'))
    : content
  return plain.replace(/\s+/g, ' ').trim()
}

/** Note documents for the open conversation — list + realtime refresh.
 *  Lives at the shell level so the notes tab can badge its count the
 *  way calendar does. Any INSERT/UPDATE/DELETE on this conversation's
 *  rows re-pulls the ordered list. */
export function useConversationNotes(supabase: SupabaseClient, conversationId: string | null) {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!conversationId) return
    const { data, error } = await supabase
      .from('conversation_notes')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('updated_at', { ascending: false })
    if (error) { console.error('[StudioNotes] load failed', error); setLoaded(true); return }
    setNotes((data ?? []) as NoteRow[])
    setLoaded(true)
  }, [supabase, conversationId])

  useEffect(() => {
    setNotes([]); setLoaded(false)
    if (!conversationId) return
    void refresh()
    const ch = supabase
      .channel(`studio-notes:${conversationId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_notes',
          filter: `conversation_id=eq.${conversationId}` },
        () => { void refresh() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, conversationId, refresh])

  return { notes, loaded, refresh }
}

/** The notes tab — a document list (default) and a per-note editor. */
export function StudioNotes({ supabase, conversationId, userId, nameOf, notes, loaded, refresh, nowTick }: {
  supabase: SupabaseClient; conversationId: string; userId: string
  nameOf: (id: string | null) => string
  notes: NoteRow[]; loaded: boolean; refresh: () => Promise<void>; nowTick: number
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [focusNew, setFocusNew] = useState(false)
  const [delSureId, setDelSureId] = useState<string | null>(null)
  const creatingRef = useRef(false)

  // Conversation switched under the tab — back to that room's list.
  useEffect(() => { setOpenId(null); setFocusNew(false); setDelSureId(null) }, [conversationId])

  const openNote = openId ? notes.find(n => n.id === openId) ?? null : null

  // The open note deleted elsewhere (another member, another device) —
  // fall back to the list quietly.
  useEffect(() => {
    if (openId && loaded && !notes.some(n => n.id === openId)) {
      setOpenId(null); setFocusNew(false)
    }
  }, [openId, loaded, notes])

  const createNote = useCallback(async () => {
    if (creatingRef.current) return
    creatingRef.current = true
    const { data, error } = await supabase
      .from('conversation_notes')
      .insert({ conversation_id: conversationId, created_by: userId, updated_by: userId })
      .select()
      .single()
    creatingRef.current = false
    if (error || !data) { console.error('[StudioNotes] create failed', error); return }
    await refresh()
    setFocusNew(true)
    setOpenId((data as NoteRow).id)
  }, [supabase, conversationId, userId, refresh])

  const deleteNote = useCallback(async (id: string) => {
    const { error } = await supabase.from('conversation_notes').delete().eq('id', id)
    if (error) { console.error('[StudioNotes] delete failed', error); return }
    setOpenId(null); setFocusNew(false)
    void refresh()
  }, [supabase, refresh])

  if (openNote) {
    return (
      <NoteEditor
        key={openNote.id}
        supabase={supabase}
        note={openNote}
        userId={userId}
        nameOf={nameOf}
        nowTick={nowTick}
        autoFocusTitle={focusNew}
        onBack={() => { setOpenId(null); setFocusNew(false) }}
        onDelete={() => { void deleteNote(openNote.id) }}
      />
    )
  }

  return (
    <div className="wd-notes">
      <div className="wd-notes-bar">
        <button className="wd-notes-new" onClick={() => void createNote()}>+ new note</button>
      </div>
      <div className="wd-notes-list">
        {!loaded
          ? <div className="wd-quiet">…</div>
          : notes.length === 0
            ? <div className="wd-quiet">no notes yet — keep setlists, schedules, anything the band needs</div>
            : notes.map(n => {
              const title = n.title.trim()
              const snip = noteSnippet(n.content)
              return (
                <div key={n.id} className="wd-note-row"
                  onClick={() => { setFocusNew(false); setDelSureId(null); setOpenId(n.id) }}>
                  <div className="wd-note-row-main">
                    <div className={`wd-note-title${title ? '' : ' untitled'}`}>{title || 'untitled'}</div>
                    {snip && <div className="wd-note-snip">{snip}</div>}
                    <div className="wd-note-meta">
                      {`edited by ${n.updated_by ? nameOf(n.updated_by) : '—'} / ${relTime(n.updated_at, nowTick)}`}
                    </div>
                  </div>
                  <button
                    className={`wd-note-del row${delSureId === n.id ? ' sure' : ''}`}
                    onClick={e => {
                      e.stopPropagation()
                      if (delSureId !== n.id) { setDelSureId(n.id); return }
                      setDelSureId(null)
                      void deleteNote(n.id)
                    }}
                  >
                    {delSureId === n.id ? 'sure?' : 'delete'}
                  </button>
                </div>
              )
            })}
      </div>
    </div>
  )
}

/** One note opened — borderless serif title + quiet paper body, both
 *  autosaved (800ms debounce). The body is a contentEditable storing
 *  sanitized HTML (legacy plain text renders as before). Remote
 *  realtime edits arrive as new `note` props and are adopted ONLY
 *  while the local editor is clean — mid-typing or mid-save, local
 *  text wins (v1's typing guard, now an innerHTML dirty check). */
function NoteEditor({ supabase, note, userId, nameOf, nowTick, autoFocusTitle, onBack, onDelete }: {
  supabase: SupabaseClient; note: NoteRow; userId: string
  nameOf: (id: string | null) => string; nowTick: number
  autoFocusTitle: boolean; onBack: () => void; onDelete: () => void
}) {
  const [title, setTitle] = useState(note.title)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [delSure, setDelSure] = useState(false)

  const titleRef = useRef(note.title)
  const contentRef = useRef(note.content)   // raw editor innerHTML (or legacy text at open)
  const dirtyRef = useRef(false)
  const inFlightRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // A fresh note opens with the title ready to type.
  useEffect(() => {
    if (autoFocusTitle) titleInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback(async () => {
    const snapTitle = titleRef.current
    const snapContent = contentRef.current
    // Sanitize on the way out; a tagless fragment decodes back to plain
    // text so legacy notes stay legacy until formatting is used.
    const html = sanitizeNoteHtml(snapContent)
    inFlightRef.current = true
    const { error } = await supabase
      .from('conversation_notes')
      .update({
        title: snapTitle,
        content: html.includes('<') ? html : htmlToText(html),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', note.id)
    inFlightRef.current = false
    if (error) { console.error('[StudioNotes] save failed', error); return }
    // Still dirty only if more typing landed while the save flew.
    if (titleRef.current === snapTitle && contentRef.current === snapContent) dirtyRef.current = false
    setSavedAt(Date.now())
  }, [supabase, note.id, userId])

  const queueSave = useCallback(() => {
    dirtyRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void persist() }, 800)
  }, [persist])

  // Closing the editor (back, tab switch, unmount) flushes a pending edit.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (dirtyRef.current) void persist()
  }, [persist])

  // Remote realtime edits arrive as new note props — adopt them only
  // while the local editor is clean, protecting in-flight typing.
  // Remote HTML is sanitized before it touches the DOM; legacy plain
  // text (no '<') goes in as text. Also paints the initial content.
  useEffect(() => {
    if (dirtyRef.current || inFlightRef.current) return
    setTitle(note.title); titleRef.current = note.title
    const el = bodyRef.current
    if (!el) return
    if (note.content.includes('<')) {
      const target = sanitizeNoteHtml(note.content)
      if (el.innerHTML !== target) el.innerHTML = target
    } else if ((el.textContent ?? '') !== note.content || el.innerHTML.includes('<')) {
      el.textContent = note.content
    }
    contentRef.current = el.innerHTML
  }, [note.title, note.content, note.updated_at])

  const syncBody = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    contentRef.current = el.innerHTML
    queueSave()
  }, [queueSave])

  // Toolbar commands — execCommand keeps the selection's formatting in
  // the small allowlist the sanitizer accepts.
  const exec = useCallback((cmd: string) => {
    const el = bodyRef.current
    if (!el) return
    el.focus()
    document.execCommand(cmd)
    syncBody()
  }, [syncBody])
  const block = useCallback((tag: string) => {
    const el = bodyRef.current
    if (!el) return
    el.focus()
    // Older WebKits want the bracketed form.
    if (!document.execCommand('formatBlock', false, tag)) {
      document.execCommand('formatBlock', false, `<${tag}>`)
    }
    syncBody()
  }, [syncBody])
  const toggleH3 = useCallback(() => {
    const cur = String(document.queryCommandValue('formatBlock') || '').toLowerCase()
    block(cur === 'h3' ? 'p' : 'h3')
  }, [block])
  const keepSel = (e: { preventDefault: () => void }) => e.preventDefault()

  const fine = savedAt !== null && note.updated_by === userId
    ? `saved / ${relTime(new Date(savedAt).toISOString(), Math.max(nowTick, savedAt))}`
    : `edited by ${note.updated_by ? nameOf(note.updated_by) : '—'} / ${relTime(note.updated_at, nowTick)}`

  return (
    <div className="wd-note-ed">
      <div className="wd-note-ed-head">
        <button className="wd-note-back" onClick={onBack} aria-label="back to notes">‹</button>
        <input
          ref={titleInputRef}
          className="wd-note-ed-title"
          value={title}
          placeholder="title…"
          spellCheck={false}
          onChange={e => { setTitle(e.target.value); titleRef.current = e.target.value; queueSave() }}
        />
        <span className="wd-note-ed-fine">{fine}</span>
      </div>
      <div className="wd-note-tools">
        <button className="wd-tool" title="bold" onMouseDown={keepSel} onClick={() => exec('bold')}><b>B</b></button>
        <button className="wd-tool" title="italic" onMouseDown={keepSel} onClick={() => exec('italic')}><i>I</i></button>
        <button className="wd-tool" title="underline" onMouseDown={keepSel} onClick={() => exec('underline')}><u>U</u></button>
        <button className="wd-tool" title="strikethrough" onMouseDown={keepSel} onClick={() => exec('strikeThrough')}><s>S</s></button>
        <button className="wd-tool" title="bulleted list" onMouseDown={keepSel} onClick={() => exec('insertUnorderedList')}>• list</button>
        <button className="wd-tool" title="numbered list" onMouseDown={keepSel} onClick={() => exec('insertOrderedList')}>1. list</button>
        <button className="wd-tool" title="heading" onMouseDown={keepSel} onClick={toggleH3}>H</button>
      </div>
      <div
        ref={bodyRef}
        className="wd-note-ed-body rich"
        contentEditable
        spellCheck={false}
        data-placeholder="setlists, timetables, flight numbers — anything worth keeping"
        onInput={syncBody}
      />
      <div className="wd-note-ed-foot">
        <button
          className={`wd-note-del${delSure ? ' sure' : ''}`}
          onClick={() => {
            if (!delSure) { setDelSure(true); return }
            // A dying row shouldn't get a farewell autosave.
            if (timerRef.current) clearTimeout(timerRef.current)
            dirtyRef.current = false
            onDelete()
          }}
        >
          {delSure ? 'sure?' : 'delete note'}
        </button>
      </div>
    </div>
  )
}

