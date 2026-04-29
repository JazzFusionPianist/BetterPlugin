import { useState, useEffect } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import FloatingOrbs from '../FloatingOrbs'

interface Props {
  supabase: SupabaseClient
  user: User
  me: Profile | null
  onClose: () => void
  onUpdated: () => void
  onNameSaved?: (name: string) => void
}

export default function InformationPanel({ supabase, user, me, onClose, onUpdated, onNameSaved }: Props) {
  const [name, setName] = useState(me?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // ── Change password ──
  const [pwOpen, setPwOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  // ── Delete account ──
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
      .from('profiles').upsert({ id: user.id, display_name: name.trim() }, { onConflict: 'id' })
    setSaving(false)
    if (error) showMsg('failed: ' + error.message)
    else { onNameSaved?.(name.trim()); showMsg('saved'); onUpdated() }
  }

  const handleChangePassword = async () => {
    setPwError(null)
    if (!currentPw) { setPwError('enter your current password'); return }
    if (newPw.length < 6) { setPwError('new password: min 6 characters'); return }
    if (newPw !== confirmPw) { setPwError('passwords do not match'); return }
    setSavingPw(true)
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email ?? '',
      password: currentPw,
    })
    if (authErr) {
      setSavingPw(false)
      setPwError('incorrect current password')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (error) setPwError('error: ' + error.message)
    else {
      showMsg('password changed')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwOpen(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') { showMsg('type DELETE to confirm'); return }
    setDeleting(true)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) { setDeleting(false); showMsg('error: ' + error.message); return }
    await supabase.auth.signOut()
  }

  return (
    <div className="settings-panel">
      <FloatingOrbs count={28} />

      <div className="settings-card settings-header-card" onClick={onClose} role="button" tabIndex={0}>
        <span className="settings-header-back">‹</span>
        <span className="settings-header-title">User Info</span>
      </div>

      <div className="info-stack">
        {/* Display name */}
        <div className="settings-card info-name-card">
          <input
            className="info-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="your name"
            maxLength={40}
          />
          <button
            className="info-save-btn"
            onClick={handleSaveName}
            disabled={saving || !name.trim() || name === me?.display_name}
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>

        {/* Email */}
        <div className="settings-card settings-row-card info-email-card">
          <span>Email</span>
          <span className="settings-row-action info-email-value">{user.email}</span>
        </div>

        {/* Change Password — toggle */}
        <div
          className="settings-card settings-row-card"
          onClick={() => { setPwOpen(v => !v); setDeleteOpen(false); setPwError(null) }}
          role="button"
          tabIndex={0}
        >
          <span>Change Password</span>
          <span className="settings-row-action info-toggle-chev">{pwOpen ? '▾' : '›'}</span>
        </div>

        {pwOpen && (
          <>
            <div className="settings-card info-input-card">
              <input
                className="info-input"
                type="password"
                placeholder="current password"
                value={currentPw}
                onChange={e => { setCurrentPw(e.target.value); setPwError(null) }}
              />
            </div>
            <div className="settings-card info-input-card">
              <input
                className="info-input"
                type="password"
                placeholder="new password"
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setPwError(null) }}
              />
            </div>
            <div className="settings-card info-input-card">
              <input
                className="info-input"
                type="password"
                placeholder="confirm new password"
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setPwError(null) }}
              />
            </div>
            {pwError && <div className="info-error">{pwError}</div>}
            <button
              className="settings-card info-action-card"
              onClick={handleChangePassword}
              disabled={savingPw || !currentPw || !newPw || !confirmPw}
            >
              {savingPw ? 'verifying...' : 'Update password'}
            </button>
          </>
        )}

        {/* Delete Account — toggle */}
        <div
          className="settings-card settings-row-card settings-card-danger"
          onClick={() => { setDeleteOpen(v => !v); setPwOpen(false) }}
          role="button"
          tabIndex={0}
        >
          <span>Delete Account</span>
          <span className="info-toggle-chev info-toggle-chev-danger">{deleteOpen ? '▾' : '›'}</span>
        </div>

        {deleteOpen && (
          <>
            <div className="settings-card info-desc-card">
              This will permanently delete your account and all data. Type <strong>DELETE</strong> to confirm.
            </div>
            <div className="settings-card info-input-card">
              <input
                className="info-input"
                type="text"
                placeholder="DELETE"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
              />
            </div>
            <button
              className="settings-card info-action-card info-action-danger"
              onClick={handleDeleteAccount}
              disabled={deleting || deleteInput !== 'DELETE'}
            >
              {deleting ? 'deleting...' : 'Delete my account'}
            </button>
          </>
        )}
      </div>

      {msg && <div className="profile-msg">{msg}</div>}
    </div>
  )
}
