import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './auth.css'

type Mode = 'signin' | 'signup'

/* Static print-shop marginalia — the plugin's small still version of the
   app's drifting registration marks. Ink and one blue accent only. */
function Marginalia() {
  return (
    <svg className="auth-marks" width="300" height="500" viewBox="0 0 300 500" aria-hidden="true">
      {/* registration crosshairs */}
      <g stroke="#1A1917" strokeWidth="1" fill="none" opacity="0.11">
        <path d="M46 62 h16 M54 54 v16" />
        <circle cx="54" cy="62" r="4.5" />
      </g>
      <g stroke="#2440FF" strokeWidth="1" fill="none" opacity="0.13">
        <path d="M236 420 h14 M243 413 v14" />
        <circle cx="243" cy="420" r="4" />
      </g>
      <g stroke="#1A1917" strokeWidth="1" fill="none" opacity="0.09">
        <path d="M258 96 h12 M264 90 v12" />
        <circle cx="264" cy="96" r="3.5" />
      </g>
      {/* dots + small circles */}
      <circle cx="34" cy="404" r="1.6" fill="#1A1917" opacity="0.12" />
      <circle cx="222" cy="34" r="1.3" fill="#1A1917" opacity="0.1" />
      <circle cx="66" cy="470" r="6" stroke="#1A1917" strokeWidth="1" fill="none" opacity="0.09" />
      <circle cx="272" cy="252" r="7" stroke="#1A1917" strokeWidth="1" fill="none" opacity="0.08" />
    </svg>
  )
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)

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
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
      } else {
        const { data, error } = await supabase!.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim() || email.split('@')[0] } },
        })
        if (error) { setError(error.message); return }
        // If email confirmation is on, there's no session yet.
        if (!data.session) setNote('Check your email to confirm your account, then sign in.')
      }
    } catch (err) {
      console.error('[auth]', err)
      setError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <Marginalia />
      <div className="auth-grain" aria-hidden="true" />

      <div className="auth-panel">
        <header className="auth-head">
          <span className="auth-brand"><span className="auth-brand-dot" />Orb</span>
          <h1 className="auth-title">
            {mode === 'signin' ? 'Welcome back.' : 'Let’s get you set up.'}
          </h1>
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
            <input id="auth-email" type="email" placeholder=" " autoComplete="email" required
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
