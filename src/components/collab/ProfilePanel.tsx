import { useRef, useState } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import { getInitials } from '../../types/collab'

interface Props {
  supabase: SupabaseClient
  user: User
  me: Profile | null
  onClose: () => void
  onUpdated: () => void
}

export default function ProfilePanel({ supabase, user, me, onClose: _onClose, onUpdated }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const showMsg = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2400)
  }

  const handlePickFile = () => fileRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showMsg('max 5MB'); return }
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/avatar-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setUploading(false); showMsg('upload failed: ' + upErr.message); return }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: dbErr } = await supabase
      .from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id)
    setUploading(false)
    if (dbErr) showMsg('db update failed: ' + dbErr.message)
    else { showMsg('photo updated'); onUpdated() }
    if (fileRef.current) fileRef.current.value = ''
  }

  const initials = me?.initials ?? getInitials(me?.display_name || 'U')
  const color = me?.avatar_color ?? '#4A8FE7'
  const photo = me?.avatar_url

  return (
    <div className="s-body">
      <div className="profile-top">
        <button className="profile-av-btn" onClick={handlePickFile} disabled={uploading} title="Change photo">
          <div className="av profile-av" style={{ background: color }}>
            {photo ? <img src={photo} alt="avatar" /> : <span>{initials}</span>}
          </div>
          <div className="profile-av-overlay">
            {uploading ? '...' : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        <div className="profile-email">{me?.display_name ?? user.email}</div>
      </div>
      {msg && <div className="profile-msg">{msg}</div>}
    </div>
  )
}
