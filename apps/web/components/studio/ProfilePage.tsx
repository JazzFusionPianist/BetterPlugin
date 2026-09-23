'use client'

/**
 * Profile page — the studio's catalogue entry for a person. Mine is
 * editable in place (photo, name, @handle, bio); a friend's is the same
 * page read-only, plus follow / message. Below the masthead sits the
 * discography: credit lines ("bass on <work>") that an admin approves
 * before anyone else sees them, and the person's releases if they've
 * shelved any in the app.
 *
 * Grammar: paper, hairlines, serif voice for names and works, sans
 * machinery for numbers and handles, words for actions (never icons),
 * two taps for anything destructive.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getInitials, type Profile } from '@orb/core'
import { useCredits, type Credit } from '@/lib/useCredits'

interface Props {
  supabase: SupabaseClient
  user: User
  profile: Profile
  isMine: boolean
  /** Follow state toward this person (friend view only). */
  following?: boolean
  follower?: boolean
  onFollow?: () => Promise<void>
  onUnfollow?: () => Promise<void>
  onMessage?: () => void
  /** Called after any profile write so the shell refetches. */
  onUpdated: () => void
  /** Optimistic local patch for my own profile. */
  updateMe?: (patch: Partial<Profile>) => void
}

const cleanUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20)
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/

/** The person's colour, washed for the arch behind their masthead. */
function tintOf(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return '#F1EEE6'
  const v = parseInt(m[1]!, 16)
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, 0.22)`
}

export const memberNo = (n: number | null | undefined) =>
  n != null ? `#${String(n).padStart(6, '0')}` : null

interface ReleaseRow {
  id: string
  title: string
  artist: string | null
  released_on: string | null
  created_at: string
  position: number
  trackCount: number
}

/** Releases shelved in the app (mutual-follow RLS) — read-only here. */
function useReleases(supabase: SupabaseClient, ownerId: string) {
  const [rows, setRows] = useState<ReleaseRow[]>([])
  useEffect(() => {
    let dead = false
    void (async () => {
      const { data: rel } = await supabase
        .from('releases')
        .select('id, title, artist, released_on, created_at, position')
        .eq('user_id', ownerId)
        .order('position', { ascending: true })
      if (dead || !rel || rel.length === 0) { if (!dead) setRows([]); return }
      const ids = rel.map(r => r.id as string)
      const { data: tracks } = await supabase
        .from('release_tracks')
        .select('release_id')
        .in('release_id', ids)
      if (dead) return
      const counts = new Map<string, number>()
      for (const t of tracks ?? []) counts.set(t.release_id as string, (counts.get(t.release_id as string) ?? 0) + 1)
      setRows(rel.map(r => ({
        id: r.id as string,
        title: r.title as string,
        artist: (r.artist as string | null) ?? null,
        released_on: (r.released_on as string | null) ?? null,
        created_at: r.created_at as string,
        position: r.position as number,
        trackCount: counts.get(r.id as string) ?? 0,
      })))
    })()
    return () => { dead = true }
  }, [supabase, ownerId])
  return rows
}

const yearOf = (r: ReleaseRow) =>
  r.released_on ? String(new Date(r.released_on + 'T00:00:00').getFullYear()) : String(new Date(r.created_at).getFullYear())

/** The approval mark — an admin has checked this line. Accent disc,
 *  paper check, sized to the line's cap height. */
function ApprovedMark() {
  return (
    <svg className="wd-cred-mark" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-label="approved by orb">
      <title>approved by orb</title>
      <circle cx="12" cy="12" r="12" fill="var(--acc)" />
      <path d="M6.8 12.6l3.4 3.4 7-7.2" stroke="#FBFAF7" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── credit line editor (add + edit share it) ───────────────────────── */

interface CreditDraft { work: string; artist: string; part: string; year: string; link: string }
const emptyDraft = (): CreditDraft => ({ work: '', artist: '', part: '', year: '', link: '' })
const draftOf = (c: Credit): CreditDraft => ({
  work: c.work, artist: c.artist ?? '', part: c.part, year: c.year != null ? String(c.year) : '', link: c.link ?? '',
})

function CreditForm({ draft, onChange, onSubmit, onCancel, submitWord, busy }: {
  draft: CreditDraft
  onChange: (d: CreditDraft) => void
  onSubmit: () => void
  onCancel: () => void
  submitWord: string
  busy: boolean
}) {
  const ok = draft.work.trim().length > 0 && draft.part.trim().length > 0
    && (draft.year === '' || /^\d{4}$/.test(draft.year))
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); if (ok && !busy) onSubmit() }
    else if (e.key === 'Escape') onCancel()
  }
  return (
    <div className="wd-cred-form">
      <div className="wd-cred-form-row">
        <input className="wd-cred-in work" placeholder="work — song or release" value={draft.work} autoFocus
          maxLength={120} spellCheck={false} onKeyDown={onKey}
          onChange={e => onChange({ ...draft, work: e.target.value })} />
        <input className="wd-cred-in" placeholder="artist" value={draft.artist}
          maxLength={120} spellCheck={false} onKeyDown={onKey}
          onChange={e => onChange({ ...draft, artist: e.target.value })} />
      </div>
      <div className="wd-cred-form-row">
        <input className="wd-cred-in part" placeholder="your part — bass, mix, lyrics…" value={draft.part}
          maxLength={80} spellCheck={false} onKeyDown={onKey}
          onChange={e => onChange({ ...draft, part: e.target.value })} />
        <input className="wd-cred-in year" placeholder="year" value={draft.year} inputMode="numeric"
          maxLength={4} onKeyDown={onKey}
          onChange={e => onChange({ ...draft, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
        <input className="wd-cred-in link" placeholder="link (optional)" value={draft.link}
          maxLength={500} spellCheck={false} onKeyDown={onKey}
          onChange={e => onChange({ ...draft, link: e.target.value })} />
      </div>
      <div className="wd-cred-form-acts">
        <button className="wd-word acc" disabled={!ok || busy} onClick={onSubmit}>{busy ? '…' : submitWord}</button>
        <button className="wd-word" onClick={onCancel}>cancel</button>
        <span className="wd-cred-form-fine">an admin looks it over before it shows on your page</span>
      </div>
    </div>
  )
}

/* ── the page ───────────────────────────────────────────────────────── */

export default function ProfilePage({
  supabase, user, profile, isMine, following, follower, onFollow, onUnfollow, onMessage, onUpdated, updateMe,
}: Props) {
  const { credits, loaded: creditsLoaded, add, update, remove } = useCredits(supabase, profile.id)
  const releases = useReleases(supabase, profile.id)

  const [msg, setMsg] = useState<string | null>(null)
  const msgTimer = useRef<number | null>(null)
  const say = useCallback((m: string) => {
    setMsg(m)
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    msgTimer.current = window.setTimeout(() => setMsg(null), 2400)
  }, [])

  // ── masthead editing ────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.display_name)
  const [handle, setHandle] = useState(profile.username ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (editing) return
    setName(profile.display_name)
    setHandle(profile.username ?? '')
    setBio(profile.bio ?? '')
  }, [profile.display_name, profile.username, profile.bio, editing])
  useEffect(() => { setEditing(false) }, [profile.id])

  // @handle availability — live, debounced, only when it changed.
  const [handleState, setHandleState] = useState<'idle' | 'checking' | 'free' | 'taken' | 'bad'>('idle')
  useEffect(() => {
    if (!editing) { setHandleState('idle'); return }
    const h = handle.trim()
    if (h === (profile.username ?? '')) { setHandleState('idle'); return }
    if (!USERNAME_RE.test(h)) { setHandleState('bad'); return }
    setHandleState('checking')
    let dead = false
    const t = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { u: h })
      if (dead) return
      setHandleState(error ? 'bad' : data ? 'free' : 'taken')
    }, 350)
    return () => { dead = true; window.clearTimeout(t) }
  }, [handle, editing, profile.username, supabase])

  const canSave = name.trim().length > 0
    && (handle === (profile.username ?? '') || handleState === 'free')
    && !saving

  const saveMast = async () => {
    if (!canSave) return
    setSaving(true)
    const patch: Record<string, unknown> = {
      display_name: name.trim(),
      initials: getInitials(name.trim()),
      bio: bio.trim() || null,
    }
    if (handle !== (profile.username ?? '')) patch.username = handle.trim()
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    setSaving(false)
    if (error) { say(error.message.includes('username') ? 'that @handle is taken' : 'couldn’t save — try again'); return }
    updateMe?.({
      display_name: patch.display_name as string,
      initials: patch.initials as string,
      bio: (patch.bio as string | null),
      ...(patch.username ? { username: patch.username as string } : {}),
    })
    setEditing(false)
    onUpdated()
    say('saved')
  }

  // ── photo ───────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const onPickPhoto = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { say('photos up to 5 mb'); return }
    setUploading(true)
    const ext = f.name.split('.').pop() || 'png'
    const path = `${user.id}/avatar-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, f, { upsert: true, contentType: f.type })
    if (upErr) { setUploading(false); say('upload failed — try again'); return }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id)
    setUploading(false)
    if (dbErr) { say('couldn’t save the photo'); return }
    updateMe?.({ avatar_url: pub.publicUrl })
    onUpdated()
    say('photo updated')
  }

  // ── follow ──────────────────────────────────────────────────────────
  const [followBusy, setFollowBusy] = useState(false)
  const toggleFollow = async () => {
    if (followBusy) return
    setFollowBusy(true)
    try { if (following) await onUnfollow?.(); else await onFollow?.() }
    finally { setFollowBusy(false) }
  }

  // ── credits ─────────────────────────────────────────────────────────
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<CreditDraft>(emptyDraft)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<CreditDraft>(emptyDraft)
  const [credBusy, setCredBusy] = useState(false)
  const [sureId, setSureId] = useState<string | null>(null)
  useEffect(() => {
    if (!sureId) return
    const t = window.setTimeout(() => setSureId(null), 2600)
    return () => window.clearTimeout(t)
  }, [sureId])

  const submitAdd = async () => {
    setCredBusy(true)
    const err = await add({
      work: draft.work, artist: draft.artist, part: draft.part,
      year: draft.year ? Number(draft.year) : null, link: draft.link,
    })
    setCredBusy(false)
    if (err) { say('couldn’t add that — try again'); return }
    setDraft(emptyDraft()); setAdding(false)
    say('sent for approval')
  }
  const submitEdit = async () => {
    if (!editId) return
    setCredBusy(true)
    const err = await update(editId, {
      work: editDraft.work, artist: editDraft.artist, part: editDraft.part,
      year: editDraft.year ? Number(editDraft.year) : null, link: editDraft.link,
    })
    setCredBusy(false)
    if (err) { say('couldn’t save — try again'); return }
    setEditId(null)
  }

  const visibleCredits = useMemo(
    () => isMine ? credits : credits.filter(c => c.status === 'approved'),
    [credits, isMine],
  )
  const pendingCount = isMine ? credits.filter(c => c.status === 'pending').length : 0

  const no = memberNo(profile.member_no)
  const initials = profile.initials || getInitials(profile.display_name || '?')

  return (
    <div className="wd-prof">
      <div className="wd-prof-scroll">

        {/* ── masthead ─────────────────────────────────────────── */}
        <div className="wd-prof-mast" style={{ ["--prof-tint" as string]: tintOf(profile.avatar_color) }}>
          <div
            className={`wd-prof-av${isMine ? ' mine' : ''}${uploading ? ' busy' : ''}`}
            style={{ background: profile.avatar_color }}
            onClick={isMine && !uploading ? () => fileRef.current?.click() : undefined}
            role={isMine ? 'button' : undefined}
            title={isMine ? 'change photo' : undefined}
          >
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{initials.slice(0, 2)}</span>}
            {isMine && <em>{uploading ? 'uploading…' : 'change'}</em>}
          </div>
          {isMine && (
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { void onPickPhoto(e.target.files?.[0]); if (e.target) e.target.value = '' }} />
          )}

          <div className="wd-prof-col">
            {editing ? (
              <>
                <input className="wd-prof-name-in" value={name} maxLength={40} spellCheck={false} autoFocus
                  placeholder="your name"
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }} />
                <div className="wd-prof-handle-row">
                  <span className="wd-prof-at">@</span>
                  <input className="wd-prof-handle-in" value={handle} spellCheck={false} placeholder="handle"
                    onChange={e => setHandle(cleanUsername(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }} />
                  <span className={`wd-prof-handle-state ${handleState}`}>
                    {handleState === 'checking' ? 'checking…'
                      : handleState === 'free' ? 'available'
                      : handleState === 'taken' ? 'taken'
                      : handleState === 'bad' ? '3–20 letters, numbers, dots or underscores'
                      : no ?? ''}
                  </span>
                </div>
                <textarea className="wd-prof-bio-in" value={bio} rows={2} maxLength={160}
                  placeholder="a line about you — what you play, where you are"
                  onChange={e => setBio(e.target.value)} />
                <div className="wd-prof-acts">
                  <button className="wd-word acc" disabled={!canSave} onClick={() => void saveMast()}>{saving ? '…' : 'save'}</button>
                  <button className="wd-word" onClick={() => setEditing(false)}>cancel</button>
                  <span className="wd-prof-count">{bio.length}/160</span>
                </div>
              </>
            ) : (
              <>
                <div className="wd-prof-name">{profile.display_name}</div>
                <div className="wd-prof-handle">
                  {profile.username && <span>@{profile.username}</span>}
                  {no && <span className="no">{no}</span>}
                </div>
                {profile.bio
                  ? <div className="wd-prof-bio">{profile.bio}</div>
                  : isMine && <div className="wd-prof-bio empty">no line about you yet</div>}
                <div className="wd-prof-acts">
                  {isMine ? (
                    <button className="wd-word" onClick={() => setEditing(true)}>edit</button>
                  ) : (
                    <>
                      <button className="wd-word acc" onClick={onMessage}>message</button>
                      <button className={`wd-word${following ? ' dim' : ''}`} disabled={followBusy} onClick={() => void toggleFollow()}>
                        {followBusy ? '…' : following ? 'following' : follower ? 'follow back' : 'follow'}
                      </button>
                      {follower && !following && <span className="wd-prof-fine">follows you</span>}
                      {following && follower && <span className="wd-prof-fine">friends</span>}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── discography — credits ─────────────────────────────── */}
        <div className="wd-prof-sec">
          <div className="wd-prof-sec-head">
            <span>discography</span>
            <span className="wd-prof-sec-right">
              {pendingCount > 0 && <span className="wd-prof-pend">{pendingCount} awaiting approval</span>}
              {isMine && !adding && (
                <button className="wd-word acc sm" onClick={() => { setAdding(true); setEditId(null) }}>+ add credit</button>
              )}
            </span>
          </div>

          {adding && (
            <CreditForm draft={draft} onChange={setDraft} onSubmit={() => void submitAdd()}
              onCancel={() => { setAdding(false); setDraft(emptyDraft()) }} submitWord="add" busy={credBusy} />
          )}

          {creditsLoaded && visibleCredits.length === 0 && !adding && (
            <div className="wd-prof-none">
              {isMine ? 'nothing here yet — add the records you played on' : 'no credits yet'}
            </div>
          )}

          {visibleCredits.map((c, i) => (
            editId === c.id ? (
              <CreditForm key={c.id} draft={editDraft} onChange={setEditDraft} onSubmit={() => void submitEdit()}
                onCancel={() => setEditId(null)} submitWord="save" busy={credBusy} />
            ) : (
              <div key={c.id} className={`wd-cred${c.status !== 'approved' ? ` ${c.status}` : ''}`}>
                <span className="wd-cred-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="wd-cred-main">
                  <span className="wd-cred-work">
                    {c.link
                      ? <a href={c.link} target="_blank" rel="noopener noreferrer">{c.work}</a>
                      : c.work}
                    {c.artist && <span className="wd-cred-artist"> {c.artist}</span>}
                    {c.status === 'approved' && <ApprovedMark />}
                  </span>
                  <span className="wd-cred-sub">
                    <span className="wd-cred-part">{c.part}</span>
                    {c.year != null && <span className="wd-cred-year">{c.year}</span>}
                    {c.status === 'pending' && <span className="wd-cred-state">awaiting approval</span>}
                    {c.status === 'rejected' && (
                      <span className="wd-cred-state no">{c.note ? `not approved — ${c.note}` : 'not approved'}</span>
                    )}
                  </span>
                </span>
                {isMine && (
                  <span className="wd-cred-acts">
                    <button className="wd-word sm" onClick={() => { setEditId(c.id); setEditDraft(draftOf(c)); setAdding(false) }}>edit</button>
                    <button className={`wd-word sm${sureId === c.id ? ' sure' : ''}`}
                      onClick={() => { if (sureId === c.id) { setSureId(null); void remove(c.id) } else setSureId(c.id) }}>
                      {sureId === c.id ? 'sure?' : 'remove'}
                    </button>
                  </span>
                )}
              </div>
            )
          ))}
        </div>

        {/* ── releases — the app's shelves, read-only here ─────── */}
        {releases.length > 0 && (
          <div className="wd-prof-sec">
            <div className="wd-prof-sec-head"><span>releases</span></div>
            {releases.map((r, i) => (
              <div key={r.id} className="wd-cred">
                <span className="wd-cred-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="wd-cred-main">
                  <span className="wd-cred-work">{r.title}{r.artist && <span className="wd-cred-artist"> {r.artist}</span>}</span>
                  <span className="wd-cred-sub">
                    <span className="wd-cred-year">{yearOf(r)}</span>
                    {r.trackCount > 0 && <span className="wd-cred-part">{r.trackCount} {r.trackCount === 1 ? 'track' : 'tracks'}</span>}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {msg && <div className="wd-toast">{msg}</div>}
    </div>
  )
}
