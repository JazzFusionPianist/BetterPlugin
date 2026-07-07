'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getInitials, type Profile } from '@orb/core'

interface Props {
  open: boolean
  supabase: SupabaseClient
  user: User
  me: Profile | null
  onAvatarUpdated: (url: string) => void
  onMeUpdated: (patch: Partial<Profile>) => void
  onFindPeople: () => void
  onClose: () => void
}

const APP_VERSION = '0.1.0'

/** Bottom sheet behind the centre avatar — profile editing, about, sign out. */
export default function SettingsSheet({
  open, supabase, user, me, onAvatarUpdated, onMeUpdated, onFindPeople, onClose,
}: Props) {
  const [name, setName] = useState(me?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setName(me?.display_name ?? '') }, [me?.display_name, open])
  useEffect(() => { if (open) { setNote(null); setAboutOpen(false) } }, [open])

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(null), 2200) }

  const pickAvatar = () => fileRef.current?.click()
  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { flash('Max 5MB'); return }
    setUploading(true)
    try {
      // Same storage layout the plugin uses — one avatars bucket, per-user dir.
      const ext = file.name.split('.').pop() || 'png'
      const path = `${user.id}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) { flash('Upload failed'); return }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: dbErr } = await supabase
        .from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id)
      if (dbErr) { flash('Save failed'); return }
      onAvatarUpdated(pub.publicUrl)
      flash('Photo updated')
    } finally {
      setUploading(false)
    }
  }

  const saveName = async () => {
    const v = name.trim()
    if (!v || v === me?.display_name || saving) return
    setSaving(true)
    try {
      const initials = getInitials(v)
      const { error } = await supabase
        .from('profiles').upsert({ id: user.id, display_name: v, initials }, { onConflict: 'id' })
      if (error) { flash('Save failed'); return }
      onMeUpdated({ display_name: v, initials })
      flash('Name updated')
    } finally {
      setSaving(false)
    }
  }

  const initials = me?.initials ?? '··'
  const color = me?.avatar_color ?? '#4A8FE7'
  const dirty = name.trim() !== '' && name.trim() !== me?.display_name

  return (
    <div
      className={`sset-overlay${open ? ' open' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="sset">
        <span className="psheet-grab" />

        <button className="sset-avatar" onClick={pickAvatar} disabled={uploading} aria-label="Change photo">
          <span className="sset-av" style={{ background: color }}>
            {me?.avatar_url ? <img src={me.avatar_url} alt="" /> : <span>{initials}</span>}
          </span>
          <span className="sset-av-edit">
            {uploading
              ? <span className="sprompt-spinner" />
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatarFile} />

        <div className="sset-namerow">
          <input
            className="sset-name"
            value={name}
            maxLength={24}
            placeholder="Display name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName() }}
          />
          {dirty && (
            <button className="sset-save" onClick={saveName} disabled={saving}>
              {saving ? '…' : 'Save'}
            </button>
          )}
        </div>
        <div className="sset-email">{user.email}</div>

        {note && <div className="sset-note">{note}</div>}

        <div className="sset-rows">
          <button className="sset-row" onClick={onFindPeople}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="8" r="4" /><path d="M2.5 21c0-4 3.5-6 7.5-6 1.2 0 2.4.2 3.4.5M19 14v6M16 17h6" /></svg>
            Find people
            <span className="sset-chev">›</span>
          </button>
          <button className="sset-row" onClick={() => setAboutOpen(o => !o)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
            About
            <span className="sset-chev">{aboutOpen ? '˅' : '›'}</span>
          </button>
          {aboutOpen && (
            <div className="sset-about">
              <div className="sset-about-brand"><span className="auth-brand-dot" />Orb</div>
              <p>Make music together — your crew, your sessions, your sound. In your DAW and in your pocket.</p>
              <span className="sset-about-ver">Version {APP_VERSION}</span>
            </div>
          )}
          <button className="sset-row sset-signout" onClick={() => supabase.auth.signOut()}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
