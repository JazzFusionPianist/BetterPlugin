import { useState, useEffect } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'

interface Props {
  supabase: SupabaseClient
  user: User
  me: Profile | null
  onClose: () => void
  onUpdated: () => void
}

export default function InformationPanel({ supabase, user, me, onClose, onUpdated }: Props) {
  const [name, setName] = useState(me?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // ── 비밀번호 변경 ──────────────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  // ── 회원탈퇴 ──────────────────────────────────────────────────────────────
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
      .from('profiles').update({ display_name: name.trim() }).eq('id', user.id)
    setSaving(false)
    if (error) showMsg('failed: ' + error.message)
    else { showMsg('saved'); onUpdated() }
  }

  const handleChangePassword = async () => {
    if (newPw.length < 6) { showMsg('min 6 characters'); return }
    if (newPw !== confirmPw) { showMsg('passwords do not match'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (error) showMsg('error: ' + error.message)
    else { showMsg('password changed'); setNewPw(''); setConfirmPw(''); setPwOpen(false) }
  }

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') { showMsg('type DELETE to confirm'); return }
    setDeleting(true)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) { setDeleting(false); showMsg('error: ' + error.message); return }
    await supabase.auth.signOut()
  }

  return (
    <>
      <div className="s-header">
        <div className="s-close" onClick={onClose}>&#8249;</div>
        <span className="s-title">USER INFO</span>
      </div>

      <div className="s-body">
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
          <button className="profile-danger-row" onClick={() => { setPwOpen(v => !v); setDeleteOpen(false) }}>
            <span>Change Password</span>
            <span className="profile-chevron">{pwOpen ? '▲' : '▷'}</span>
          </button>
          {pwOpen && (
            <div className="profile-sub">
              <input className="profile-input" type="password" placeholder="new password"
                value={newPw} onChange={e => setNewPw(e.target.value)} />
              <input className="profile-input" type="password" placeholder="confirm password"
                value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={{ marginTop: 6 }} />
              <button className="profile-save" style={{ marginTop: 8, width: '100%' }}
                onClick={handleChangePassword} disabled={savingPw || !newPw || !confirmPw}>
                {savingPw ? '...' : 'update password'}
              </button>
            </div>
          )}
        </div>

        {/* ── 회원탈퇴 ── */}
        <div className="s-section">
          <button className="profile-danger-row profile-danger-red"
            onClick={() => { setDeleteOpen(v => !v); setPwOpen(false) }}>
            <span>Delete Account</span>
            <span className="profile-chevron">{deleteOpen ? '▲' : '▷'}</span>
          </button>
          {deleteOpen && (
            <div className="profile-sub">
              <p className="profile-danger-desc">
                This will permanently delete your account and all data. Type <strong>DELETE</strong> to confirm.
              </p>
              <input className="profile-input profile-input-danger" type="text" placeholder="DELETE"
                value={deleteInput} onChange={e => setDeleteInput(e.target.value)} />
              <button className="profile-save profile-save-danger"
                style={{ marginTop: 8, width: '100%' }}
                onClick={handleDeleteAccount}
                disabled={deleting || deleteInput !== 'DELETE'}>
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
