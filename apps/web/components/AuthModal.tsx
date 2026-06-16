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
  const [showPw, setShowPw] = useState(false)
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
      className={`auth-overlay${open ? ' open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`auth mode-${mode}`}>
        <button className="auth-x" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" /></svg>
        </button>

        <header className="auth-head">
          <span className="auth-brand"><span className="auth-brand-dot" />Orb</span>
          <h2 className="auth-title">
            {mode === 'signin' ? 'Welcome back.' : 'Let’s get you set up.'}
          </h2>
          <p className="auth-lede">
            {mode === 'signin'
              ? 'Sign in to jump back into your sessions.'
              : 'A name, an email, a password — and you’re in.'}
          </p>
        </header>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && (
            <div className="fld">
              <input id="auth-name" type="text" placeholder=" " autoComplete="name"
                value={name} onChange={e => setName(e.target.value)} />
              <label htmlFor="auth-name">Display name</label>
            </div>
          )}
          <div className="fld">
            <input id="auth-email" ref={emailRef} type="email" placeholder=" " autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)} />
            <label htmlFor="auth-email">Email</label>
          </div>
          <div className="fld">
            <input id="auth-password" type={showPw ? 'text' : 'password'} placeholder=" "
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required
              value={password} onChange={e => setPassword(e.target.value)} />
            <label htmlFor="auth-password">Password</label>
            {password && (
              <button type="button" className="fld-toggle" onClick={() => setShowPw(s => !s)}
                tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            )}
          </div>

          {error && <div className="auth-error">{error}</div>}
          {note && <div className="auth-note">{note}</div>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <footer className="auth-switch">
          {mode === 'signin' ? 'New here?' : 'Already have an account?'}
          <button type="button" onClick={toggle}>{mode === 'signin' ? 'Create an account' : 'Sign in instead'}</button>
        </footer>
      </div>
    </div>
  )
}
