'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  open: boolean
  onClose: () => void
  /** Fired after a successful sign-in (session established). */
  onAuthed: () => void
}

type Mode = 'signin' | 'signup'

export default function AuthModal({ open, onClose, onAuthed }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  // Focus the email field when the modal opens.
  useEffect(() => {
    if (open) {
      setError(null); setNote(null)
      const t = setTimeout(() => emailRef.current?.focus(), 260)
      return () => clearTimeout(t)
    }
  }, [open])

  // Esc closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const toggle = () => {
    setMode(m => (m === 'signin' ? 'signup' : 'signin'))
    setError(null); setNote(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(null); setNote(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); return }
        onAuthed()
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim() || email.split('@')[0] } },
        })
        if (error) { setError(error.message); return }
        // If email confirmation is on, there's no session yet.
        if (data.session) onAuthed()
        else setNote('Check your email to confirm your account, then sign in.')
      }
    } catch (err) {
      console.error('[auth]', err)
      setError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`modal-card mode-${mode}`}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12" /></svg>
        </button>
        <div className="modal-mark" />
        <div className="modal-title">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</div>
        <div className="modal-sub">{mode === 'signin' ? 'Sign in to your Orb account.' : 'Join Orb and bring your crew in.'}</div>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="auth-name">Display name</label>
              <input id="auth-name" type="text" placeholder="What should we call you?" autoComplete="name"
                value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" ref={emailRef} type="email" placeholder="you@example.com" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input id="auth-password" type="password" placeholder="••••••••"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="modal-submit" disabled={busy}>
            {busy ? (mode === 'signin' ? 'Signing in…' : 'Creating…') : (mode === 'signin' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        {error && <div className="modal-error">{error}</div>}
        {note && <div className="modal-note">{note}</div>}

        <div className="modal-foot">
          <span>{mode === 'signin' ? 'New to Orb?' : 'Already have an account?'}</span>
          <button type="button" onClick={toggle}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button>
        </div>
      </div>
    </div>
  )
}
