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

  return (
    <>
      <div className="s-header">
        <div className="s-close" onClick={onClose}>&#8249;</div>
        <span className="s-title">USER INFO</span>
      </div>

      <div className="s-body">
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

        <div className="s-section">
          <div className="s-section-label">email</div>
          <div className="profile-readonly">{user.email}</div>
        </div>

        {msg && <div className="profile-msg">{msg}</div>}
      </div>
    </>
  )
}
