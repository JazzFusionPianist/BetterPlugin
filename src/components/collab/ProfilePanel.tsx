import { useRef, useState, useEffect } from 'react'
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

export default function ProfilePanel({ supabase, user, me, onClose, onUpdated }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(me?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // ── 비밀번호 변경 ─────────────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  // ── 회원탈퇴 ─────────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setName(me?.display_name ?? '')
  }, [me?.display_name])

  const showMsg = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2400)
  }

  const handleSaveName = async () => {
    if (!name.trim() || name === me?.display_name) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim() })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      showMsg('failed: ' + error.message)
    } else {
      showMsg('saved')
      onUpdated()
    }
  }

  const handlePickFile = () => fileRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showMsg('max 5MB')
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/avatar-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (upErr) {
      setUploading(false)
      showMsg('upload failed: ' + upErr.message)
      return
    }

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = pub.publicUrl

    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', user.id)

    setUploading(false)
    if (dbErr) {
      showMsg('db update failed: ' + dbErr.message)
    } else {
      showMsg('photo updated')
      onUpdated()
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleChangePassword = async () => {
    if (newPw.length < 6) { showMsg('min 6 characters'); return }
    if (newPw !== confirmPw) { showMsg('passwords do not match'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (error) {
      showMsg('error: ' + error.message)
    } else {
      showMsg('password changed')
      setNewPw('')
      setConfirmPw('')
      setPwOpen(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') { showMsg('type DELETE to confirm'); return }
    setDeleting(true)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setDeleting(false)
      showMsg('error: ' + error.message)
      return
    }
    await supabase.auth.signOut()
  }

  const initials = me?.initials ?? getInitials(name || 'U')
  const color = me?.avatar_color ?? '#4A8FE7'
  const photo = me?.avatar_url

  return (
    <>
      <div className="s-header">
        <div className="s-close" onClick={onClose}>&#8249;</div>
        <span className="s-title">PROFILE</span>
      </div>

      <div className="s-body">
        {/* ── 아바타 ── */}
        <div className="profile-top">
          <button
            className="profile-av-btn"
            onClick={handlePickFile}
            disabled={uploading}
            title="Change photo"
          >
            <div className="av profile-av" style={{ background: color }}>
              {photo ? (
                <img src={photo} alt="avatar" />
              ) : (
                <span>{initials}</span>
              )}
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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div className="profile-email">{user.email}</div>
        </div>

        {/* ── Display Name ── */}
        <div className="s-section">
          <div className="s-section-label">display name</div>
          <div className="profile-name-row">
            <input
              className="profile-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="your name"
              maxLength={40}
            />
            <button
              className="profile-save"
              onClick={handleSaveName}
              disabled={saving || !name.trim() || name === me?.display_name}
            >
              {saving ? '...' : 'save'}
            </button>
          </div>
        </div>

        {/* ── Email ── */}
        <div className="s-section">
          <div className="s-section-label">email</div>
          <div className="profile-readonly">{user.email}</div>
        </div>

        {/* ── 비밀번호 변경 ── */}
        <div className="s-section">
          <button
            className="profile-danger-row"
            onClick={() => { setPwOpen(v => !v); setDeleteOpen(false) }}
          >
            <span>Change Password</span>
            <span className="profile-chevron">{pwOpen ? '▲' : '▷'}</span>
          </button>
          {pwOpen && (
            <div className="profile-sub">
              <input
                className="profile-input"
                type="password"
                placeholder="new password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
              />
              <input
                className="profile-input"
                type="password"
                placeholder="confirm password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                style={{ marginTop: 6 }}
              />
              <button
                className="profile-save"
                style={{ marginTop: 8, width: '100%' }}
                onClick={handleChangePassword}
                disabled={savingPw || !newPw || !confirmPw}
              >
                {savingPw ? '...' : 'update password'}
              </button>
            </div>
          )}
        </div>

        {/* ── 회원탈퇴 ── */}
        <div className="s-section">
          <button
            className="profile-danger-row profile-danger-red"
            onClick={() => { setDeleteOpen(v => !v); setPwOpen(false) }}
          >
            <span>Delete Account</span>
            <span className="profile-chevron">{deleteOpen ? '▲' : '▷'}</span>
          </button>
          {deleteOpen && (
            <div className="profile-sub">
              <p className="profile-danger-desc">
                This will permanently delete your account and all data. Type <strong>DELETE</strong> to confirm.
              </p>
              <input
                className="profile-input profile-input-danger"
                type="text"
                placeholder="DELETE"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
              />
              <button
                className="profile-save profile-save-danger"
                style={{ marginTop: 8, width: '100%' }}
                onClick={handleDeleteAccount}
                disabled={deleting || deleteInput !== 'DELETE'}
              >
                {deleting ? 'deleting...' : 'delete my account'}
              </button>
            </div>
          )}
        </div>

        {msg && <div className="profile-msg">{msg}</div>}
      </div>
    </>
  )
}
